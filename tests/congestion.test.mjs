import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeCongestion, congestionFor } from '../src/analysis/congestion.mjs';

const sample = (ssid, bssid, band, channel, rssiDbm) => ({
  ssid, bssid, band, channel, rssiDbm, signalBars: 0, security: 'WPA2',
});

test('groups by band|channel and counts networks', () => {
  const reports = computeCongestion([
    sample('A', 'aa:aa:aa:aa:aa:aa', '2.4GHz', 6, -60),
    sample('B', 'bb:bb:bb:bb:bb:bb', '2.4GHz', 6, -70),
    sample('C', 'cc:cc:cc:cc:cc:cc', '5GHz', 157, -50),
  ]);
  assert.equal(reports.length, 2);
  const ch6 = congestionFor(reports, '2.4GHz', 6);
  assert.equal(ch6.networkCount, 2);
});

test('RSSI-weighted energy is computed and back-converted to dBm', () => {
  const reports = computeCongestion([
    sample('A', 'aa:aa:aa:aa:aa:aa', '2.4GHz', 1, -50),
    sample('B', 'bb:bb:bb:bb:bb:bb', '2.4GHz', 1, -50),
  ]);
  const ch1 = congestionFor(reports, '2.4GHz', 1);
  assert.equal(ch1.energyDbm, -47); // two -50 mW sources ≈ -47 dBm
  assert.equal(ch1.congestion, 'high');
});

test('empty channel set yields no report entries', () => {
  assert.deepEqual(computeCongestion([]), []);
  assert.deepEqual(computeCongestion(null), []);
});

test('null RSSI falls back to count-based classification', () => {
  const reports = computeCongestion(
    Array.from({ length: 4 }, (_, i) => sample('S' + i, `aa:aa:aa:aa:aa:0${i}`, '5GHz', 44, null)),
  );
  const ch44 = congestionFor(reports, '5GHz', 44);
  assert.equal(ch44.networkCount, 4);
  assert.equal(ch44.energyDbm, null);
  assert.equal(ch44.congestion, 'medium');
});

test('networks with unknown band/channel are skipped', () => {
  const reports = computeCongestion([
    sample('A', 'aa:aa:aa:aa:aa:aa', 'unknown', 44, -50),
    sample('B', 'bb:bb:bb:bb:bb:bb', '5GHz', null, -50),
  ]);
  assert.deepEqual(reports, []);
});
