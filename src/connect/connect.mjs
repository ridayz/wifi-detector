import { buildProfileXml, connectSupported } from './profile.mjs';
import { run } from '../collector/exec.mjs';
import { writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

/** True when a saved Windows profile exists for this SSID (password not read). */
export async function hasProfile(ssid) {
  const res = await run('netsh', ['wlan', 'show', 'profiles'], { timeout: 5000 });
  if (!res.stdout) return { supported: false, exists: false };
  const want = String(ssid).trim().toLowerCase();
  const patterns = [
    /All User Profile\s*:\s*(.+)/i,          // EN
    /Semua Profil Pengguna\s*:\s*(.+)/i,      // ID
    /Profil Semua Pengguna\s*:\s*(.+)/i,
    /Profile\s*:\s*(.+)/i,
    /Profil\s*:\s*(.+)/i,
  ];
  for (const line of res.stdout.split(/\r?\n/)) {
    for (const p of patterns) {
      const m = p.exec(line);
      if (m && m[1] && m[1].trim().toLowerCase() === want) {
        return { supported: true, exists: true };
      }
    }
  }
  return { supported: true, exists: false };
}

/**
 * Connect to an SSID. Returns { ok, message }.
 * - Uses the saved profile when one exists (no password needed).
 * - Otherwise creates a temporary WLAN profile XML, connects, deletes it.
 * - Enterprise / WEP / unknown auth is refused with a clear message.
 */
export async function connectTo({ ssid, password, securityNorm, securityRaw, iface = 'Wi-Fi' }) {
  const cleanSsid = String(ssid || '').trim();
  if (!cleanSsid) return { ok: false, message: 'Missing SSID' };
  if (cleanSsid.length > 32) return { ok: false, message: 'SSID longer than 32 bytes is invalid' };

  if (!connectSupported(securityRaw, securityNorm)) {
    return { ok: false, message: 'Enterprise (802.1X) and WEP networks are not supported from the app (yet).' };
  }

  // Prefer the saved profile — never read its credentials.
  const saved = await hasProfile(cleanSsid);
  if (saved.exists) {
    const res = await run('netsh', ['wlan', 'connect', `name=${cleanSsid}`, `ssid=${cleanSsid}`, `interface=${iface}`], { timeout: 20000 });
    return interpretResult(res, cleanSsid);
  }

  // Otherwise: build a throwaway profile XML, connect, then delete it.
  const norm = ['open', 'WPA', 'WPA2', 'WPA3'].includes(securityNorm) ? securityNorm : 'WPA2';
  let xml, needsKey;
  try {
    ({ xml, needsKey } = buildProfileXml(cleanSsid, norm, password ?? null));
  } catch (err) {
    return { ok: false, message: String(err?.message || err) };
  }

  const tmp = path.join(os.tmpdir(), `wifi-detector-${randomBytes(8).toString('hex')}.xml`);
  let staged = false;
  try {
    await writeFile(tmp, xml, 'utf8');
    staged = true;
    const add = await run('netsh', ['wlan', 'add', 'profile', `filename=${tmp}`, `interface=${iface}`], { timeout: 5000 });
    if (add.code !== 0) {
      return { ok: false, message: `Could not add wireless profile. ${sanitize(add.stderr || add.stdout)}` };
    }
    const res = await run('netsh', ['wlan', 'connect', `name=${cleanSsid}`, `ssid=${cleanSsid}`, `interface=${iface}`], { timeout: 20000 });
    return interpretResult(res, cleanSsid);
  } finally {
    if (staged) try { await rm(tmp, { force: true }); } catch { /* best effort */ }
  }
}

function interpretResult(res, ssid) {
  const out = `${res.stdout || ''}\n${res.stderr || ''}`;
  if (/complete[sd]?|completion|success|OK/i.test(out) && !/failed|error|unable|wrong|invalid/i.test(out)) {
    return { ok: true, message: `Connection request sent to '${ssid}'.` };
  }
  if (/not.*available|out of range|not in sight|tidak dapat ditemukan|tidak tersedia/i.test(out)) {
    return { ok: false, message: `'${ssid}' is not in range or on a different band.` };
  }
  if (/profile.*not.*exist|profil.*tidak.*ada|tidak ditemukan/i.test(out)) {
    return { ok: false, message: `No usable profile for '${ssid}'.` };
  }
  if (/password|key|authentication|sandi|kata sandi/i.test(out) && /fail|wrong|error|salah|gagal/i.test(out)) {
    return { ok: false, message: `Authentication failed for '${ssid}' — wrong password?` };
  }
  return { ok: false, message: `Connect failed for '${ssid}'. ${sanitize(out)}`.trim() };
}

/** Remove any long output but keep it safe to display. Bounded and printable. */
function sanitize(text) {
  return String(text || '').replace(/[\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
}
