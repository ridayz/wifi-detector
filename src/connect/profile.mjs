/**
 * Connect helpers — see docs/DECISIONS/0003-connect-from-app.md.
 * Nothing in this module transmits passwords anywhere except the local OS
 * via netsh, and nothing logs them. XML is escaped; temp files are deleted
 * by the caller in `finally`.
 */

/** Detect whether a network's auth is usable from the app (non-802.1X). */
export function connectSupported(securityRaw, securityNorm) {
  const raw = String(securityRaw || '');
  if (/enterprise|802\.?1x|eap/i.test(raw)) return false;
  if (securityNorm === 'WEP') return false; // legacy/shared-key — refuse in v0.1
  if (securityNorm === 'open') return true;
  if (['WPA', 'WPA2', 'WPA3'].includes(securityNorm)) return true;
  const a = String(securityNorm || '').toLowerCase();
  return a.startsWith('wpa');
}

const XML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
const escXml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => XML_ESCAPES[c]);

const AUTH = {
  open: { authentication: 'open', encryption: 'none', oneX: false },
  WPA: { authentication: 'WPAPSK', encryption: 'TKIP', oneX: false },
  WPA2: { authentication: 'WPA2PSK', encryption: 'AES', oneX: false },
  WPA3: { authentication: 'WPA3SAE', encryption: 'AES', oneX: false },
};

/**
 * Build a WLAN profile XML (netsh `add profile` format).
 * Returns { xml, needsKey }. Password may be null only when needsKey is false.
 */
export function buildProfileXml(ssid, securityNorm, password) {
  const norm = AUTH[securityNorm] ? securityNorm : 'WPA2';
  const auth = AUTH[norm];
  const needsKey = norm !== 'open';
  if (needsKey) {
    if (typeof password !== 'string' || password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }
  }
  const name = escXml(ssid);
  const keyBlock = needsKey
    ? `<sharedKey>\n      <keyType>passPhrase</keyType>\n      <protected>false</protected>\n      <keyMaterial>${escXml(password)}</keyMaterial>\n    </sharedKey>`
    : '';
  const xml =
`<?xml version="1.0"?>
<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">
  <name>${name}</name>
  <SSIDConfig>
    <SSID>
      <name>${name}</name>
    </SSID>
  </SSIDConfig>
  <connectionType>ESS</connectionType>
  <connectionMode>manual</connectionMode>
  <MSM>
    <security>
      <authEncryption>
        <authentication>${auth.authentication}</authentication>
        <encryption>${auth.encryption}</encryption>
        <useOneX>${auth.oneX}</useOneX>
      </authEncryption>
      ${keyBlock}
    </security>
  </MSM>
</WLANProfile>
`;
  return { xml, needsKey };
}
