# 0004 — Native WiFi enumeration (WlanScan / WlanGetNetworkBssList)

- Date: 2026-11-13
- Status: **Accepted implicitly by user** — the netsh environment scan flaked
  constantly on this machine (ISSUE-0004) and the user asked for the symptom
  to stop recurring ("sering banget … this adapter does not expose
  per-BSSID scan results"). The stale cache was a mitigation, not a fix.

## Decision

The scanner gains a **native Windows source** as the primary environment
collector, compiled once with the .NET Framework `csc.exe` (same toolchain
as the native launcher — no new installs):

- Source: `native/WifiScan.cs` → `native/wifiscan.exe` (gitignored binary,
  like the launchers). Rebuild with the shipped `csc.exe` command in
  `docs/RUNBOOK.md`.
- Calls `WlanOpenHandle` → `WlanEnumInterfaces` → `WlanScan` →
  `WlanGetNetworkBssList` and prints one JSON line to stdout:
  `{"ok":true,"networks":[{ssid,bssid,freqMhz,rssiDbm,signalPct,phyType,isHidden}],…}`.
- The Node collector uses it when present and working; on any failure it
  **falls back to the netsh path unchanged** (`netsh wlan show networks
  mode=bssid`) — verified behavior before and after.
- Band/channel are derived from `ulChCenterFrequency` (kHz) in Node code —
  see `deriveBandFromFreq` in `src/shared/wifi.mjs`.
- Security per network is reported as `unknown` for native-sourced rows
  (BSS list carries no auth/cipher); the connected link's own security
  remains known via netsh interfaces.
- Read-only: `WlanScan` only requests a scan; the app still never transmits
  or touches any other machine's network.

## Consequences

- The environment view no longer degrades on this machine (77 BSS entries
  via native vs 0-56 intermittently via netsh).
- The UI degraded-mode note now fires only when BOTH sources fail.
- One extra build artifact to keep fresh (`wifiscan.exe`), documented in
  RUNBOOK; netsh remains as a zero-build fallback.
