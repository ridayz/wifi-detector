import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectEnvironment } from '../src/collector/index.mjs';

const net = (ssid, bssid) => ({ ssid, bssid, band: '5GHz', channel: 44, rssiDbm: -60, signalBars: 3 });

test('fresh scan wins when supported, stale cache ignored', () => {
  const lastGood = { capturedAt: Date.now(), networks: [net('Old', 'aa:aa:aa:aa:aa:aa')] };
  const fresh = [net('New', 'bb:bb:bb:bb:bb:bb')];
  const out = selectEnvironment(fresh, true, lastGood);
  assert.equal(out.source, 'fresh');
  assert.equal(out.staleSec, null);
  assert.deepEqual(out.networks, fresh);
});

test('zero networks on a supported scan is authoritative (no stale fallback)', () => {
  const out = selectEnvironment([], true, { capturedAt: Date.now(), networks: [net('Old', 'aa:aa:aa:aa:aa:aa')] });
  assert.equal(out.source, 'fresh');
  assert.equal(out.networks.length, 0);
});

test('driver flake reuses last full scan within window', () => {
  const capturedAt = Date.now() - 30_000; // 30s ago
  const lastGood = { capturedAt, networks: [net('SameSSID', 'aa:aa:aa:aa:aa:aa'), net('Other', 'bb:bb:bb:bb:bb:bb')] };
  const out = selectEnvironment([], false, lastGood, Date.now());
  assert.equal(out.source, 'stale');
  assert.equal(out.networks.length, 2);
  assert.ok(out.staleSec >= 29 && out.staleSec <= 32);
  // stale copies are disconnected-marked until collector re-marks them
  assert.ok(out.networks.every((n) => n.isConnected === false));
});

test('cache older than the window is discarded', () => {
  const lastGood = { capturedAt: Date.now() - 121_000, networks: [net('Old', 'aa:aa:aa:aa:aa:aa')] };
  const out = selectEnvironment([], false, lastGood, Date.now());
  assert.equal(out.source, 'none');
  assert.equal(out.networks.length, 0);
});
