import { num } from './exec.mjs';
import {
  deriveBand,
  normalizeMac,
  normalizeSecurity,
  rssiFromSignalPct,
  barsFromRssi,
} from '../shared/wifi.mjs';

const IFACE_KEYS = {
  name: ['name', 'nama'],
  description: ['description', 'deskripsi'],
  state: ['state', 'status', 'keadaan'],
  ssid: ['ssid'],
  bssid: ['ap bssid', 'bssid ap', 'bssid'],
  band: ['band', 'pita'],
  channel: ['channel', 'saluran'],
  radio: ['radio type', 'tipe radio', 'radio'],
  auth: ['authentication', 'autentikasi'],
  signal: ['signal', 'sinyal'],
  rssi: ['rssi'],
};

const NET_KEYS = {
  type: ['network type', 'jenis jaringan'],
  auth: ['authentication', 'autentikasi'],
  encryption: ['encryption', 'enkripsi'],
};

const BSSID_KEYS = {
  signal: ['signal', 'sinyal'],
  radio: ['radio type', 'tipe radio', 'radio'],
  channel: ['channel', 'saluran'],
};

function keyFor(map, normalized) {
  for (const [canonical, aliases] of Object.entries(map)) {
    if (aliases.includes(normalized)) return canonical;
  }
  return null;
}

const kvLine = /^\s*([A-Za-z][^:]{0,60}?)\s*:\s*(.*?)\s*$/;

/**
 * Parse `netsh wlan show interfaces` (English or Indonesian).
 * Returns one entry per wireless interface; check `connected`.
 */
export function parseWlanInterfaces(text) {
  const blocks = [];
  let cur = {};

  for (const line of String(text).split(/\r?\n/)) {
    const m = kvLine.exec(line);
    if (!m) continue;
    const normalized = m[1].toLowerCase().replace(/\s+/g, ' ').trim();
    const canonical = keyFor(IFACE_KEYS, normalized);
    if (!canonical) continue;
    const value = m[2].trim();
    if (canonical === 'name' && cur.name && Object.keys(cur).length > 1) {
      blocks.push(cur);
      cur = {};
    }
    if (cur[canonical] === undefined) cur[canonical] = value;
  }
  if (Object.keys(cur).length > 0) blocks.push(cur);

  return blocks.map((b) => {
    const stateText = String(b.state || '').toLowerCase();
    const connected = /connected|terhubung|authenticated/.test(stateText);
    const signalPct = b.signal != null ? clamp(num(b.signal), 0, 100) : null;
    const rssi = b.rssi != null ? num(b.rssi) : signalPct != null ? rssiFromSignalPct(signalPct) : null;
    return {
      connected,
      name: b.name || null,
      description: b.description || null,
      ssid: b.ssid || null,
      bssid: normalizeMac(b.bssid) || null,
      band: b.band || null,
      channel: b.channel != null ? num(b.channel) : null,
      radio: b.radio || null,
      auth: b.auth || null,
      security: normalizeSecurity(b.auth),
      signalPct,
      rssiDbm: rssi,
      bars: barsFromRssi(rssi),
      state: b.state || null,
    };
  });
}

/**
 * Parse `netsh wlan show networks mode=bssid` (English or Indonesian).
 * Returns { networks, supported }.
 * `supported: false` when the driver exposes no per-BSSID blocks at all —
 * caller must degrade to "connected link only" mode.
 */
export function parseWlanNetworks(text) {
  const src = String(text);
  if (/(^|\n)\s*There are\s+0\s+networks/i.test(src) ||
      /(^|\n)\s*Terdapat\s+0\s+jaringan/i.test(src) ||
      /no\s+networks/i.test(src)) {
    return { networks: [], supported: true };
  }

  const networks = [];
  // Split into SSID-level sections, anchored to line starts.
  // [ \t] (not \s) so newlines cannot be swallowed into the lookahead.
  const ssidSplit = src.split(/(?=^[ \t]*SSID[ \t]+\d+[ \t]*:)/gim);

  for (const section of ssidSplit) {
    // SSID header line: "SSID 1 : Name" — may be empty for hidden networks
    const header = /^[ \t]*SSID[ \t]+\d+[ \t]*:[ \t]*(.*?)[ \t]*\r?$/im.exec(section);
    if (!header) continue;
    const ssid = header[1].trim();

    // Split into BSSID-level blocks, line-anchored with [ \t] only
    const parts = section.split(/(?=^[ \t]*BSSID[ \t]+\d+[ \t]*:)/gim);
    const netMeta = {};
    const bssidBlocks = [];

    for (const part of parts) {
      const bssidMatch = /^[ \t]*BSSID[ \t]+\d+[ \t]*:[ \t]*(.*?)[ \t]*\r?$/im.exec(part);
      if (bssidMatch) {
        const bssid = normalizeMac(bssidMatch[1]);
        const fields = {};
        for (const line of part.split(/\r?\n/)) {
          const m = kvLine.exec(line);
          if (!m) continue;
          const normalized = m[1].toLowerCase().replace(/\s+/g, ' ').trim();
          const canonical = keyFor(BSSID_KEYS, normalized);
          if (canonical && fields[canonical] === undefined) fields[canonical] = m[2].trim();
        }
        bssidBlocks.push({ bssid, ...fields });
      } else {
        for (const line of part.split(/\r?\n/)) {
          const m = kvLine.exec(line);
          if (!m) continue;
          const normalized = m[1].toLowerCase().replace(/\s+/g, ' ').trim();
          const canonical = keyFor(NET_KEYS, normalized);
          if (canonical && netMeta[canonical] === undefined) netMeta[canonical] = m[2].trim();
        }
      }
    }

    if (bssidBlocks.length === 0) {
      // Network visible but no detail blocks (common on restrictive drivers).
      networks.push(makeNetwork(ssid, netMeta, {}));
      continue;
    }
    for (const block of bssidBlocks) {
      networks.push(makeNetwork(ssid, netMeta, block));
    }
  }

  const supported = networks.some((n) => n.bssid !== null);
  return { networks, supported };
}

function makeNetwork(ssid, netMeta, block) {
  const signalPct = block.signal != null ? clamp(num(block.signal), 0, 100) : null;
  const rssi = signalPct != null ? rssiFromSignalPct(signalPct) : null;
  const channel = block.channel != null ? num(block.channel) : null;
  const radio = block.radio || null;
  const band = deriveBand(channel, radio);
  return {
    ssid: ssid || '',
    bssid: block.bssid || null,
    band,
    channel,
    radio,
    rssiDbm: rssi,
    signalPct,
    signalBars: barsFromRssi(rssi),
    security: normalizeSecurity(netMeta.auth),
    securityRaw: netMeta.auth || null,
    encryption: netMeta.encryption || null,
    networkType: netMeta.type || null,
    isConnected: false, // set later by orchestrator
    seenAt: new Date().toISOString(),
  };
}

function clamp(n, min, max) {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}
