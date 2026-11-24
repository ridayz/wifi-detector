import { run } from './exec.mjs';
import { freqInfo, normalizeMac, barsFromRssi } from '../shared/wifi.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HELPER = path.join(__dirname, '..', '..', 'native', 'wifiscan.exe');

export const NATIVE_PATH = HELPER;

/**
 * Read the environment via the native helper (WlanScan / WlanGetNetworkBssList).
 * Strategy: cached driver BSS table first (milliseconds), forced scan second.
 * Returns { supported, networks, error }.
 */
export async function readNativeNetworks() {
  for (const args of [['--no-scan'], []]) {
    const label = args.includes('--no-scan') ? 'cache' : 'forced-scan';
    const res = await run(HELPER, args, { timeout: args.includes('--no-scan') ? 4000 : 8000 });
    if (!res.ok || !res.stdout) continue;
    const line = res.stdout.trim();
    if (!line.startsWith('{')) continue;
    try {
      const parsed = JSON.parse(line);
      if (!parsed.ok || !Array.isArray(parsed.networks)) continue;
      return {
        networks: parsed.networks.map(mapRow),
        supported: true,
        error: null,
        source: `native-${label}`,
        capturedAt: parsed.capturedAt || null,
      };
    } catch (err) {
      // try next strategy
    }
  }
  return { networks: [], supported: false, error: 'native scanner unavailable', source: 'native-none' };
}

function mapRow(n) {
  const freq = Number(n.freqMhz);
  const { band, channel } = freqInfo(freq);
  const rssi = Number.isFinite(n.rssiDbm) ? n.rssiDbm : null;
  return {
    ssid: typeof n.ssid === 'string' ? n.ssid : '',
    bssid: normalizeMac(n.bssid),
    band,
    channel,
    freqMhz: Number.isFinite(freq) ? freq : null,
    radio: n.radio || null,
    rssiDbm: rssi,
    signalPct: Number.isFinite(n.signalPct) ? n.signalPct : null,
    signalBars: barsFromRssi(rssi),
    security: 'unknown',
    securityRaw: null,
    encryption: null,
    networkType: 'Infrastructure',
    isConnected: false,
    seenAt: new Date().toISOString(),
    source: 'native',
  };
}
