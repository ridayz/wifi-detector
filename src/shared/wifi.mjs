/**
 * Shared WiFi helpers. Single source of truth for RSSI math, signal bars,
 * band derivation, and security normalization. Used by collector + analysis.
 */

/** Normalize signal percentage (0-100) to dBm estimate. */
export function rssiFromSignalPct(pct) {
  if (pct == null || Number.isNaN(pct)) return null;
  return Math.round(Math.min(100, Math.max(0, pct)) / 2 - 100);
}

/** Map RSSI dBm to 0-4 bars. */
export function barsFromRssi(rssi) {
  if (rssi == null) return 0;
  if (rssi >= -55) return 4;
  if (rssi >= -65) return 3;
  if (rssi >= -75) return 2;
  if (rssi >= -85) return 1;
  return 0;
}

/**
 * Derive the band from channel + radio type. Honest: returns "unknown"
 * rather than guessing. 802.11ax may live on 2.4/5/6 GHz.
 */
export function deriveBand(channel, radio) {
  const r = String(radio || '').toLowerCase();
  const ch = channel != null ? Number(channel) : NaN;
  if (!Number.isFinite(ch)) return 'unknown';

  if (/\b802\.11be\b/.test(r)) return '6GHz'; // 7 GHz out of scope for v1
  if (/\b802\.11ac\b|\b802\.11a\b/.test(r)) return ch <= 177 ? '5GHz' : 'unknown';
  if (/\b802\.11g\b|\b802\.11b\/g\b/.test(r) && ch <= 14) return '2.4GHz';
  if (/\b802\.11n\b/.test(r)) return ch <= 14 ? '2.4GHz' : '5GHz';
  if (/\b802\.11ax\b/.test(r)) {
    if (ch <= 14) return '2.4GHz';
    if (ch <= 177) return 'unknown'; // 5 GHz and 6 GHz both possible here
    return '6GHz'; // channels > 177 only exist in 6 GHz
  }
  if (ch >= 1 && ch <= 14) return '2.4GHz';
  if (ch > 14 && ch <= 177) return 'unknown';
  return '6GHz';
}

/**
 * Derive band + channel from a channel center frequency in MHz.
 * Single source of truth for native (frequency-bearing) values.
 */
export function freqInfo(mhz) {
  const f = Number(mhz);
  if (!Number.isFinite(f) || f <= 0) return { band: 'unknown', channel: null };
  if (f >= 2400 && f < 2500) return { band: '2.4GHz', channel: f === 2484 ? 14 : Math.round((f - 2407) / 5) };
  if (f >= 5000 && f < 5900) return { band: '5GHz', channel: Math.round((f - 5000) / 5) };
  if (f >= 5900 && f < 7135) return { band: '6GHz', channel: Math.round((f - 5950) / 5) };
  if (f >= 7135) return { band: '7GHz', channel: null };
  return { band: 'unknown', channel: null };
}

/** Normalize netsh authentication text to a stable enum. */
export function normalizeSecurity(auth) {
  const a = String(auth || '').toLowerCase();
  if (/open|aberto/.test(a)) return 'open';
  if (/wep/.test(a)) return 'WEP';
  if (/wpa3/.test(a)) return 'WPA3';
  if (/wpa2/.test(a)) return 'WPA2';
  if (/wpa\b/.test(a)) return 'WPA';
  if (/802\.1x/.test(a)) return 'WPA2'; // enterprise WPA2-common case
  return 'unknown';
}

/** Normalize MAC address to upper-case colon form. */
export function normalizeMac(mac) {
  const m = String(mac || '').trim().replace(/-/g, ':').toUpperCase();
  return /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/.test(m) ? m : null;
}

/** Convert dBm to milliwatts (linear), or null. */
export function dbmToMw(dbm) {
  return dbm == null || !Number.isFinite(dbm) ? null : 10 ** (dbm / 10);
}

/** Convert linear milliwatt sum back to dBm, or null. */
export function mwToDbm(mw) {
  return mw == null || mw <= 0 ? null : Math.round(10 * Math.log10(mw));
}
