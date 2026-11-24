import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildProfileXml, connectSupported } from '../src/connect/profile.mjs';

test('buildProfileXml builds an open profile without a key', () => {
  const { xml, needsKey } = buildProfileXml('CafeGuest', 'open', null);
  assert.equal(needsKey, false);
  assert.match(xml, /<authentication>open<\/authentication>/);
  assert.doesNotMatch(xml, /sharedKey/);
  assert.match(xml, /<name>CafeGuest<\/name>/);
});

test('buildProfileXml escapes XML-hostile characters in SSID and password', () => {
  const { xml, needsKey } = buildProfileXml('Evil & <Co> "9"', 'WPA2', 'p&ss<w>rd"x');
  assert.equal(needsKey, true);
  assert.match(xml, /Evil &amp; &lt;Co&gt; &quot;9&quot;/);
  assert.match(xml, /p&amp;ss&lt;w&gt;rd&quot;x/);
  assert.doesNotMatch(xml, /<Co>/);
});

test('WPA3 maps to WPA3SAE/AES', () => {
  const { xml } = buildProfileXml('Home', 'WPA3', 'supersecret1');
  assert.match(xml, /<authentication>WPA3SAE<\/authentication>/);
  assert.match(xml, /<encryption>AES<\/encryption>/);
});

test('short password rejected', () => {
  assert.throws(() => buildProfileXml('X', 'WPA2', 'short'), /at least 8/);
});

test('connectSupported refuses enterprise and WEP', () => {
  assert.equal(connectSupported('WPA2-Enterprise', 'WPA2'), false);
  assert.equal(connectSupported('WPA2-EAP', 'WPA2'), false);
  assert.equal(connectSupported('', 'WEP'), false);
  assert.equal(connectSupported('WPA2-Personal', 'WPA2'), true);
  assert.equal(connectSupported('Open', 'open'), true);
  assert.equal(connectSupported('WPA2-Personal', 'WPA3'), true);
});
