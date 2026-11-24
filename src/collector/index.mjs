import { readInterfaces, readNetworks } from './wlan.mjs';
import { readNativeNetworks } from './nativeScan.mjs';
import { computeCongestion } from '../analysis/congestion.mjs';
import { diagnose, normalizeBandKey } from '../analysis/diagnosis.mjs';

const HISTORY_LIMIT = 180; // ~6 minutes at 2s
const STALE_WINDOW_MS = 120_000; // keep last full scan for 2 minutes

/**
 * Pick the environment to display: fresh scan always wins. If the driver
 * withholds detail this cycle, reuse the last full scan (marked stale) —
 * but only within STALE_WINDOW_MS. Pure and unit-tested.
 */
export function selectEnvironment(freshScan, freshSupported, lastGood, now = Date.now()) {
  if (freshSupported) {
    return { networks: freshScan ?? [], staleSec: null, source: 'fresh' };
  }
  if (lastGood && now - lastGood.capturedAt <= STALE_WINDOW_MS) {
    return {
      networks: lastGood.networks.map((n) => ({ ...n, isConnected: false })),
      staleSec: Math.round((now - lastGood.capturedAt) / 1000),
      source: 'stale',
    };
  }
  return { networks: [], staleSec: null, source: 'none' };
}
export class Collector {
  constructor({ scanIntervalMs = 2000 } = {}) {
    this.scanIntervalMs = scanIntervalMs;
    this.snapshot = null;
    this.history = [];
    this.lastGood = null;
    this.lastError = null;
    this._timer = null;
  }

  async sampleOnce() {
    const [ifaceRes, nativeRes] = await Promise.all([readInterfaces(), readNativeNetworks()]);
    const netRes = nativeRes.supported
      ? nativeRes
      : await readNetworks(); // netsh fallback — unchanged behavior

    const connected = (ifaceRes.interfaces || []).find((l) => l.connected) || null;
    let networks = netRes.networks || [];

    // Mark the network the device is joined to.
    for (const n of networks) {
      if (connected && n.ssid === connected.ssid && n.bssid && n.bssid === connected.bssid) {
        n.isConnected = true;
      }
    }

    // Drop detail-less scan rows that duplicate the connected link
    // (no BSSID/RSSI/channel) — the interface row below carries the truth.
    if (connected) {
      networks = networks.filter((n) => !(n.ssid === connected.ssid && !n.bssid));
    }

    // Fresh full scan wins; otherwise reuse the last full scan (≤2 min old)
    // so the table does not go blank on driver flake (ISSUE-0004).
    const freshNetworks = networks;
    const env = selectEnvironment(freshNetworks, Boolean(netRes.supported), this.lastGood);
    if (env.source === 'fresh' && env.networks.some((n) => n.bssid)) {
      this.lastGood = {
        capturedAt: Date.now(),
        networks: env.networks.map((n) => ({ ...n })),
      };
    }
    networks = env.networks;

    // Re-mark the joined network — stale copies arrive unmarked.
    for (const n of networks) {
      n.isConnected = Boolean(connected && n.bssid && connected.bssid && n.bssid === connected.bssid);
      if (n.isConnected) n.source = n.source || 'scan';
    }

    // Fold the connected link into the environment list if the driver scan
    // did not include it (common on restrictive drivers) — labelled source:
    // "interface". This keeps the table honest: one row, not a fake list.
    if (connected && !networks.some((n) => n.bssid && n.bssid === connected.bssid)) {
      networks.push({
        ssid: connected.ssid || '',
        bssid: connected.bssid,
        band: normalizeBandKey(connected.band),
        channel: connected.channel,
        radio: connected.radio,
        rssiDbm: connected.rssiDbm,
        signalPct: connected.signalPct,
        signalBars: connected.bars,
        security: connected.security || 'unknown',
        securityRaw: connected.auth,
        encryption: null,
        networkType: 'Infrastructure',
        isConnected: true,
        seenAt: new Date().toISOString(),
        source: 'interface',
      });
    } else {
      for (const n of networks) n.source = n.source || 'scan';
    }

    networks.sort((a, b) => (b.rssiDbm ?? -999) - (a.rssiDbm ?? -999));

    const scanSupported = Boolean(netRes.supported);
    const congestion = computeCongestion(networks);
    const diagnosis = diagnose(connected, networks, congestion, scanSupported);

    this.snapshot = {
      id: `${Date.now()}`,
      capturedAt: new Date().toISOString(),
      supported: {
        interfaces: !ifaceRes.error,
        networksScan: Boolean(netRes.supported),
      },
      connected: connected && {
        ssid: connected.ssid,
        bssid: connected.bssid,
        band: connected.band,
        channel: connected.channel,
        radio: connected.radio,
        security: connected.security,
        signalPct: connected.signalPct,
        rssiDbm: connected.rssiDbm,
        bars: connected.bars,
      },
      networks,
      congestion,
      diagnosis,
      environmentStaleSec: env.staleSec,
      errors: [ifaceRes.error, netRes.error].filter(Boolean),
    };

    if (connected && connected.rssiDbm != null) {
      this.history.push({ t: this.snapshot.capturedAt, rssi: connected.rssiDbm });
      if (this.history.length > HISTORY_LIMIT) this.history.shift();
    }
    this.snapshot.history = this.history.slice(-60);
    this.lastError = this.snapshot.errors.length ? this.snapshot.errors.join(' | ') : null;
    return this.snapshot;
  }

  /** Trigger an immediate scan (used by the dashboard's Scan button). */
  async requestScan() {
    return this.sampleOnce();
  }

  start() {
    if (this._timer) return;
    const tick = async () => {
      if (this._busy) return; // skip ticks that arrive while a scan is running
      this._busy = true;
      try {
        await this.sampleOnce();
      } catch (err) {
        this.lastError = String(err?.message || err);
      } finally {
        this._busy = false;
      }
    };
    tick();
    this._timer = setInterval(tick, this.scanIntervalMs);
    this._timer.unref?.();
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }
}
