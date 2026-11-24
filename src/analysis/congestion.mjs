import { dbmToMw, mwToDbm } from '../shared/wifi.mjs';

/**
 * Group scanned networks by band|channel and compute a congestion report.
 * Honest rules:
 *  - networkCount is always known (even if RSSI is not),
 *  - energyDbm is null when no RSSI is available,
 *  - congestion is "unknown" only when we have neither signal.
 */
export function computeCongestion(networks) {
  const groups = new Map();

  for (const n of networks || []) {
    if (!n || n.channel == null || n.band === 'unknown') continue;
    const key = `${n.band}|${n.channel}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(n);
  }

  const reports = [];
  for (const [key, list] of groups) {
    const [band, channelStr] = key.split('|');
    const channel = Number(channelStr);
    const networkCount = list.length;

    let mwSum = 0;
    let withRssi = 0;
    for (const n of list) {
      const mw = dbmToMw(n.rssiDbm);
      if (mw !== null) {
        mwSum += mw;
        withRssi += 1;
      }
    }
    const energyDbm = withRssi > 0 ? mwToDbm(mwSum) : null;

    let congestion;
    if (energyDbm !== null) {
      if (energyDbm >= -47 || networkCount >= 8) congestion = 'high';
      else if (energyDbm >= -58 || networkCount >= 4) congestion = 'medium';
      else congestion = 'low';
    } else {
      // Count-only fallback
      if (networkCount >= 8) congestion = 'high';
      else if (networkCount >= 4) congestion = 'medium';
      else congestion = 'low';
    }

    reports.push({ band, channel, networkCount, energyDbm, congestion });
  }

  // Stable order: band, then channel ascending
  reports.sort((a, b) => a.band.localeCompare(b.band) || a.channel - b.channel);
  return reports;
}

/** Find the congestion report for a specific band+channel, or null. */
export function congestionFor(reports, band, channel) {
  return (reports || []).find((r) => r.band === band && r.channel === channel) || null;
}
