# RUNBOOK — wifi-detector

## Native scanner (`native/wifiscan.exe`) — recommended

The app prefers the native WlanScan helper when present; without it, it falls
back to `netsh` (unchanged behavior). Rebuild from `native/WifiScan.cs`:

```powershell
cd projects/wifi-detector
& "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:exe `
  /out:native\wifiscan.exe native\WifiScan.cs
```

- The binary is gitignored (`native/*.exe`).
- Default mode is `--no-scan` (reads the driver's cached BSS table — fast,
  milliseconds). An empty argument forces a real RF scan (+2.5 s).
- If the helper is missing, crashes, or prints non-JSON, the collector falls
  back to netsh with zero configuration.
- Verified (2026-11-13): 77 BSS entries enumerated; 3 consecutive snapshots
  all show the full environment (44 networks) where netsh alternated.

## Prerequisites

- Windows 10/11 (primary target)
- Node.js 20+ (`node --version`)
- Wi-Fi adapter (2.4/5 GHz; 6/7 GHz optional)
- .NET Framework csc.exe (for rebuilding the native scanner; ships in Windows)

## Run locally

Desktop app (user-facing):

Double-click **WiFi Detector.lnk** (Desktop) or `WiFi Detector.exe` in this
folder. The native launcher (`scripts/native-launcher/`, C# + .NET Framework
csc) starts the server hidden, waits for port 4748, opens the browser, and
keeps a tray icon. Rebuild the `.exe` after `src/` changes — it is gitignored.
See `scripts/native-launcher/README.md`.

From a terminal (development):

```powershell
cd projects/wifi-detector
node src/server.mjs
```

Then open <http://127.0.0.1:4748>.

Environment overrides (all optional): `PORT` (default `4748`),
`WIFI_SCAN_INTERVAL_MS` (default `2000`).

## Tests

```powershell
cd projects/wifi-detector
node --test
```

Expected: `27 pass / 0 fail` — parser fixtures (EN/ID Windows locales, empty
and hidden SSIDs), frequency-to-band/channel mapping, congestion math,
diagnosis logic, environment cache.

## Manual verification of the connect flow (attended, by the user)

The agent must not join real networks autonomously. With the user watching:

1. Click **Connect** on a guest/test SSIDs row.
2. Leave the password empty → only works when a saved Windows profile exists;
   otherwise the error names the saved-profile fallback.
3. Enter a deliberately wrong password → expect an authentication-failed
   message, no profile left behind (check %TEMP% for `wifi-detector-*.xml`).
4. Verify enterprise rows show `Unavailable` and are not clickable.
5. After a successful join, the dashboard's connected panel reflects the
   new link within ~2 s (SSE).

## Verification after any change

1. `node --test` passes.
2. `node src/server.mjs` starts and `http://127.0.0.1:4748/api/snapshot`
   returns JSON with `supported.interfaces: true`.
3. Check `networks` non-empty on a machine with visible APs. If only the
   connected link shows, check whether `native/wifiscan.exe` exists — the
   netsh fallback can withhold per-BSSID detail on some drivers (ISSUE-0004,
   resolved natively in v0.1.2).
4. Confirm no listeners beyond `127.0.0.1:4748` (e.g. Resource Monitor).

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `networks` shows only your connected SSID, `networksScan: false` | Native helper missing/failing AND netsh withheld detail | Rebuild `native/wifiscan.exe` (see "Native scanner"); netsh is the zero-build fallback. |
| 6 GHz networks show band `unknown` | 6 GHz band cannot be inferred reliably from channel alone | Expected until validation (ISSUE-0003). |
| Diagnosis says `congestion` but bars look fine | Heuristic triggers at bars ≤ 3 on congested channels | Confidence is `low` in that case; treat as hint, not verdict. |
| Port 4748 already in use | Another process (or wifi-radar on 4747) | `$env:PORT=4749; node src/server.mjs` |
| Empty UI table, "is Wi-Fi on?" | No networks visible | Check the adapter, Airplane mode, or driver. |

## Rollback

Unused — no deploys yet. For local use: Ctrl+C the server; nothing persists.
