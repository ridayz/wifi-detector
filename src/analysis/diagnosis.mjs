import { congestionFor } from './congestion.mjs';
import { barsFromRssi } from '../shared/wifi.mjs';

/**
 * Honest diagnosis of "why are my bars low?".
 *
 * Inputs:
 *   connected   — interface object from parsers.parseWlanInterfaces (or null)
 *   networks    — scan results (empty when driver scan unsupported)
 *   congestion  — output of computeCongestion
 *   scanSupported — false when per-BSSID scan is unavailable on this machine
 *
 * Output matches docs/API-CONTRACT.md `Diagnosis` (plus `scanSupported`).
 * Never fabricates certainty — confidence reflects what the data shows.
 */
export function diagnose(connected, networks, congestion, scanSupported) {
  if (!connected || !connected.connected) {
    return {
      targetBssid: null,
      cause: 'unknown',
      confidence: 'low',
      summary: 'No connected Wi-Fi link detected. Join a network and re-check.',
      suggestions: ['Open Wi-Fi settings and join a network'],
      scanSupported: Boolean(scanSupported),
      bars: 0,
    };
  }

  const rssi = connected.rssiDbm;
  const bars = barsFromRssi(rssi);
  const sameSsid = (networks || []).filter(
    (n) => n && n.ssid === connected.ssid && n.bssid && n.bssid !== connected.bssid,
  );
  const best = sameSsid.reduce(
    (acc, n) => (n.rssiDbm != null && (acc == null || n.rssiDbm > acc.rssiDbm) ? n : acc),
    null,
  );

  // 1) A clearly stronger same-SSID BSS exists → likely wrong AP/band.
  if (bars <= 2 && best && rssi != null && best.rssiDbm - rssi >= 10) {
    return withScan({
      targetBssid: connected.bssid,
      cause: 'band-mismatch',
      confidence: 'high',
      summary: `Connected to ${connected.bssid} (${rssi} dBm), but a stronger '${connected.ssid}' access point exists on ${best.band} channel ${best.channel} (${best.rssiDbm} dBm). Your device is likely sticking to a weaker AP or band.`,
      suggestions: [
        `Switch to the ${best.band} BSS of '${connected.ssid}' (BSSID ${best.bssid}, channel ${best.channel})`,
        'Enable band steering on your router if this happens repeatedly',
      ],
      bars,
    }, scanSupported);
  }

  // 2) Channel congestion is measurable and not low.
  const cong = connected.band && connected.channel != null
    ? congestionFor(congestion, normalizeBandKey(connected.band), connected.channel)
    : null;
  if (bars <= 3 && cong && (cong.congestion === 'high' || cong.congestion === 'medium')) {
    return withScan({
      targetBssid: connected.bssid,
      cause: 'congestion',
      confidence: cong.congestion === 'high' ? 'medium' : 'low',
      summary: `Channel ${connected.channel} (${cong.band}) is congested: ${cong.networkCount} networks visible${cong.energyDbm != null ? ` with ~${cong.energyDbm} dBm combined energy` : ''}. Interference, not distance, is likely dragging your link down.`,
      suggestions: [
        'Move closer to the access point as well, or switch band',
        'Ask your network admin to move this network to a freer channel',
      ],
      bars,
    }, scanSupported);
  }

  // 3) Weak signal, no congestion evidence → distance/attenuation.
  if (rssi != null && rssi <= -75) {
    return withScan({
      targetBssid: connected.bssid,
      cause: 'distance',
      confidence: 'medium',
      summary: `Signal is weak (${rssi} dBm) without measurable channel congestion. You are likely too far from the access point, or something is attenuating the signal.`,
      suggestions: [
        'Move closer to the access point or reduce walls/obstacles',
        'Check if your device prefers a different AP with a stronger signal',
      ],
      bars,
    }, scanSupported);
  }

  // 4) Signal looks fine, or data is inconclusive.
  return withScan({
    targetBssid: connected.bssid,
    cause: 'unknown',
    confidence: 'low',
    summary: bars >= 3
      ? `Signal looks acceptable (${rssi != null ? `${rssi} dBm` : 'no RSSI from driver'}, ${bars} bars).`
      : 'Not enough data to tell distance from congestion on this adapter.',
    suggestions: bars >= 3
      ? []
      : ['Re-check after moving a few meters or after a scan refresh'],
    bars,
  }, scanSupported);
}

function withScan(diag, scanSupported) {
  return { ...diag, scanSupported: Boolean(scanSupported) };
}

/**
 * Interface band text ("5 GHz", "6 GHz", "2.4 GHz") → analysis key.
 * Tolerates "2.4GHz", "5 GHz", case differences; falls back to the raw value.
 */
export function normalizeBandKey(band) {
  const b = String(band || '').toLowerCase().replace(/\s+/g, '');
  if (b.startsWith('2.4')) return '2.4GHz';
  if (b.startsWith('5')) return '5GHz';
  if (b.startsWith('6')) return '6GHz';
  if (b.startsWith('7')) return '7GHz';
  return String(band || 'unknown');
}
