import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagnose } from '../src/analysis/diagnosis.mjs';

const connected = (overrides = {}) => ({
  connected: true,
  ssid: 'Kantor-Main',
  bssid: 'AA:AA:AA:AA:AA:AA',
  band: '5 GHz',
  channel: 44,
  radio: '802.11ac',
  signalPct: 50,
  rssiDbm: -75,
  bars: 2,
  ...overrides,
});

test('stronger same-SSID BSS triggers band-mismatch with high confidence', () => {
  const nets = [
    { ssid: 'Kantor-Main', bssid: 'BB:BB:BB:BB:BB:BB', rssiDbm: -52, band: '5GHz', channel: 44 },
    { ssid: 'Kantor-Main', bssid: 'AA:AA:AA:AA:AA:AA', rssiDbm: -75, band: '5GHz', channel: 44, isConnected: true },
  ];
  const diag = diagnose(connected(), nets, [], true);
  assert.equal(diag.cause, 'band-mismatch');
  assert.equal(diag.confidence, 'high');
});

test('congested connected channel triggers congestion cause', () => {
  const congestion = [{ band: '5GHz', channel: 44, networkCount: 9, energyDbm: -46, congestion: 'high' }];
  // rssi -70 → 3 bars? barsFromRssi(-70) = 2 (below -65). Use weak rssi so bars<=3.
  const diag = diagnose(connected({ rssiDbm: -70, bars: 2 }), [], congestion, true);
  assert.equal(diag.cause, 'congestion');
});

test('weak signal with clean channel triggers distance cause', () => {
  const diag = diagnose(connected({ rssiDbm: -82, bars: 1 }), [], [], true);
  assert.equal(diag.cause, 'distance');
  assert.equal(diag.confidence, 'medium');
});

test('healthy signal yields unknown cause and no suggestions', () => {
  const diag = diagnose(connected({ rssiDbm: -45, bars: 4 }), [], [], true);
  assert.equal(diag.cause, 'unknown');
  assert.equal(diag.bars, 4);
  assert.deepEqual(diag.suggestions, []);
});

test('no connection yields explicit unknown', () => {
  const diag = diagnose(null, [], [], true);
  assert.equal(diag.cause, 'unknown');
  assert.equal(diag.bars, 0);
});

test('scanSupported flag is surfaced verbatim', () => {
  const diag = diagnose(connected(), [], [], false);
  assert.equal(diag.scanSupported, false);
});
