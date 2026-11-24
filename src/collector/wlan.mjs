import { run } from './exec.mjs';
import { parseWlanInterfaces, parseWlanNetworks } from './parsers.mjs';

/** Read the currently joined WiFi link. */
export async function readInterfaces() {
  const res = await run('netsh', ['wlan', 'show', 'interfaces'], { timeout: 5000 });
  if (!res.stdout) {
    return { interfaces: [], error: res.error || 'netsh returned nothing' };
  }
  try {
    return { interfaces: parseWlanInterfaces(res.stdout), error: null };
  } catch (err) {
    return { interfaces: [], error: String(err?.message || err) };
  }
}

/**
 * Read the visible WiFi environment (passive scan).
 * `supported:false` means the driver exposes no per-BSSID detail — degrade
 * gracefully instead of inventing numbers.
 */
export async function readNetworks() {
  const res = await run('netsh', ['wlan', 'show', 'networks', 'mode=bssid'], { timeout: 8000 });
  if (!res.stdout) {
    return { networks: [], supported: false, error: res.error || 'netsh returned nothing' };
  }
  try {
    const parsed = parseWlanNetworks(res.stdout);
    return { ...parsed, error: null };
  } catch (err) {
    return { networks: [], supported: false, error: String(err?.message || err) };
  }
}
