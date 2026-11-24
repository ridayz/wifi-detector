import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseWlanInterfaces,
  parseWlanNetworks,
} from '../src/collector/parsers.mjs';
import {
  barsFromRssi,
  rssiFromSignalPct,
  deriveBand,
  normalizeSecurity,
  normalizeMac,
  freqInfo,
} from '../src/shared/wifi.mjs';

const IFACE_EN = `
There is 1 interface on the system:

    Name                   : Wi-Fi
    Description            : MediaTek Wi-Fi 6 MT7921 Wireless LAN Card
    State                  : connected
    SSID                   : DCI-GUEST
    AP BSSID               : fc:11:65:5f:87:80
    Band                   : 5 GHz
    Channel                : 157
    Radio type             : 802.11ac
    Authentication         : WPA2-Personal
    Signal                 : 84%
    Rssi                   : -54
`;

const IFACE_ID = `
Ada 1 antarmuka pada sistem:

    Nama                   : Wi-Fi
    Deskripsi              : MediaTek Wi-Fi 6 MT7921
    Keadaan                : terhubung
    SSID                   : DCI-GUEST
    BSSID AP               : fc-11-65-5f-87-80
    Saluran                : 157
    Tipe radio             : 802.11ac
    Autentikasi            : WPA2-Personal
    Sinyal                 : 84%
`;

const NETWORKS_EN = `
Interface name : Wi-Fi
There are 2 networks currently visible.

SSID 1 : DCI-GUEST
    Network type            : Infrastructure
    Authentication          : WPA2-Personal
    Encryption              : CCMP
    BSSID 1                 : fc:11:65:5f:87:80
         Signal             : 84%
         Radio type         : 802.11ac
         Channel            : 157
    BSSID 2                 : fc:11:65:5f:87:81
         Signal             : 55%
         Radio type         : 802.11b/g/n
         Channel            : 6

SSID 4 : HiddenNet
    Network type            : Infrastructure
    Authentication          : WPA3-Personal
    Encryption              : CCMP
    BSSID 1                 : 11:22:33:44:55:66
         Signal             : 40%
         Radio type         : 802.11ax
         Channel            : 36

SSID 5 :
    Network type            : Infrastructure
    Authentication          : WPA2-Personal
    Encryption              : CCMP
    BSSID 1                 : 77:88:99:aa:bb:cc
         Signal             : 30%
         Radio type         : 802.11ax
         Channel            : 36

SSID 3 : Kantor-Main
    Network type            : Infrastructure
    Authentication          : WPA3-Personal
    Encryption              : CCMP
    BSSID 1                 : aa:bb:cc:dd:ee:ff
         Signal             : 92%
         Radio type         : 802.11ax
         Channel            : 44
`;

const NETWORKS_EMPTY = `
Interface name : Wi-Fi
There are 0 networks currently visible.
`;

test('parses EN interface block with Rssi line', () => {
  const [iface] = parseWlanInterfaces(IFACE_EN);
  assert.equal(iface.connected, true);
  assert.equal(iface.ssid, 'DCI-GUEST');
  assert.equal(iface.bssid, 'FC:11:65:5F:87:80');
  assert.equal(iface.band, '5 GHz');
  assert.equal(iface.channel, 157);
  assert.equal(iface.radio, '802.11ac');
  assert.equal(iface.rssiDbm, -54);
  assert.equal(iface.signalPct, 84);
  assert.deepEqual([iface.bars], [barsFromRssi(-54)]);
});

test('parses ID interface block, normalizes MAC, derives RSSI from signal', () => {
  const [iface] = parseWlanInterfaces(IFACE_ID);
  assert.equal(iface.connected, true);
  assert.equal(iface.ssid, 'DCI-GUEST');
  assert.equal(iface.channel, 157);
  assert.equal(iface.rssiDbm, rssiFromSignalPct(84)); // -58
});

test('parses EN networks with per-BSSID detail', () => {
  const { networks, supported } = parseWlanNetworks(NETWORKS_EN);
  assert.equal(supported, true);
  assert.equal(networks.length, 5);

  const guesA = networks.find((n) => n.bssid === 'FC:11:65:5F:87:80');
  assert.equal(guesA.ssid, 'DCI-GUEST');
  assert.equal(guesA.band, '5GHz'); // from channel 157 + 802.11ac
  assert.equal(guesA.channel, 157);
  assert.equal(guesA.security, 'WPA2');
  assert.equal(guesA.rssiDbm, -58); // 84% -> -58

  const guesB = networks.find((n) => n.bssid === 'FC:11:65:5F:87:81');
  assert.equal(guesB.band, '2.4GHz');
  assert.equal(guesB.channel, 6);

  const kantor = networks.find((n) => n.ssid === 'Kantor-Main');
  assert.equal(kantor.security, 'WPA3');
  assert.equal(kantor.rssiDbm, rssiFromSignalPct(92)); // -54

  // A hidden network (empty SSID name) must parse with ssid === '' and a real BSSID
  const hidden = networks.find((n) => n.bssid === '77:88:99:AA:BB:CC');
  assert.equal(hidden.ssid, '');
  assert.equal(hidden.channel, 36);
});

test('zero visible networks reports supported with empty list', () => {
  const { networks, supported } = parseWlanNetworks(NETWORKS_EMPTY);
  assert.equal(supported, true);
  assert.deepEqual(networks, []);
});

test('deriveBand honest cases', () => {
  assert.equal(deriveBand(6, '802.11b/g/n'), '2.4GHz');
  assert.equal(deriveBand(157, '802.11ac'), '5GHz');
  assert.equal(deriveBand(44, '802.11ax'), 'unknown'); // ambiguous 5/6 GHz
  assert.equal(deriveBand(212, '802.11ax'), '6GHz');   // > 177 only 6 GHz
  assert.equal(deriveBand(190, '802.11be'), '6GHz');
  assert.equal(deriveBand(null, '802.11ac'), 'unknown');
});

test('freqInfo derives band and channel from frequency', () => {
  assert.deepEqual(freqInfo(2412), { band: '2.4GHz', channel: 1 });
  assert.deepEqual(freqInfo(2437), { band: '2.4GHz', channel: 6 });
  assert.deepEqual(freqInfo(2462), { band: '2.4GHz', channel: 11 });
  assert.deepEqual(freqInfo(2484), { band: '2.4GHz', channel: 14 });
  assert.deepEqual(freqInfo(5745), { band: '5GHz', channel: 149 });
  assert.deepEqual(freqInfo(5785), { band: '5GHz', channel: 157 });
  assert.deepEqual(freqInfo(5805), { band: '5GHz', channel: 161 });
  assert.deepEqual(freqInfo(5975), { band: '6GHz', channel: 5 });
  assert.deepEqual(freqInfo(null), { band: 'unknown', channel: null });
  assert.deepEqual(freqInfo(0), { band: 'unknown', channel: null });
});

test('security + mac normalization', () => {
  assert.equal(normalizeSecurity('WPA2-Personal'), 'WPA2');
  assert.equal(normalizeSecurity('WPA3-Personal'), 'WPA3');
  assert.equal(normalizeSecurity('Open'), 'open');
  assert.equal(normalizeMac('fc-11-65-5f-87-80'), 'FC:11:65:5F:87:80');
  assert.equal(normalizeMac('not-a-mac'), null);
});
