# ARCHITECTURE — wifi-detector

Status: **Implemented (v0.1, 2026-11-13)** — see `docs/DECISIONS/0002`.
Historical draft sections preserved; deltas from the draft are flagged.

## Problem restated

Buildings have many APs, often reusing the same SSID across 2.4/5/6/7 GHz.
Devices fail to roam or see the AP after moving rooms. The user cannot tell
whether weak bars mean "too far away" or "channel full of neighbors".

## Components (implemented)

1. **Collector** (`src/collector/`):
   - `exec.mjs` — named command runner (argv arrays, no shell scripts).
   - `parsers.mjs` — pure parsers: `parseWlanInterfaces`, `parseWlanNetworks`
     (English + Indonesian netsh output). Hidden SSIDs supported (ssid = "").
   - `wlan.mjs` — netsh wrappers; driver-withheld detail → `supported:false`.
   - `index.mjs` — orchestrator: merges connected link into the network
     list, computes congestion + diagnosis, keeps a ~6-minute RSSI ring.
2. **Analysis** (`src/analysis/`):
   - `congestion.mjs` — per band|channel: network count, RSSI-weighted
     energy (mW sum → dBm), `low|medium|high` class (count-only fallback
     when no RSSI).
   - `diagnosis.mjs` — `band-mismatch` (same-SSID BSS ≥10 dB stronger) >
     `congestion` (connected channel medium/high) > `distance` (RSSI ≤ −75) >
     `unknown`. Confidence always reported; never claims certainty.
3. **Native helper** (`native/wifiscan.exe`, DECISIONS/0004): reads the
   driver's cached BSS table via `WlanGetNetworkBssList` (or forces a scan
   with `WlanScan`). Replaces netsh for the environment read; netsh remains
   the fallback. Frequencies (kHz) arrive raw; band/channel are derived in
   Node (`freqInfo`). SSID length ≤32 bytes, RSSI in dBm. JSON to stdout.
4. **Presentation** (`src/public/` + `src/server.mjs`):
   - Local dashboard on `127.0.0.1:4748` — SSE push (2.5 s) with auto-reconnect.
   - Delta from draft: connected-link RSSI drawn on a plain `<canvas>`, no chart lib.
5. **Storage**: in-memory only (v0.1). SQLite is proposal-phase-2, not coded.
6. **Connect** (`src/connect/`, DECISIONS/0003 — the only state-changing path):
   - `profile.mjs` — WLAN profile XML builder (open/WPA/WPA2/WPA3-PSK);
     Enterprise/WEP refused; SSID + password XML-escaped.
   - `connect.mjs` — uses a saved Windows profile when one exists; otherwise
     writes a temporary profile XML (`%TEMP%\wifi-detector-<random>.xml`),
     runs `netsh wlan add/connect`, deletes the file in `finally`.
   - `/api/connect` — POST only, requires header `x-wifi-detector: 1`;
     password never logged, echoed, or persisted. UI flow: explicit
     Connect → modal → confirm (drops current Wi-Fi, spelled out) → result.

## Data flow

```
netsh (passive) -> parsers -> Collector.sampleOnce() every 2 s
  -> computeCongestion + diagnose
  -> snapshot { connected, networks[], congestion[], diagnosis, history }
  -> SSE /api/events -> browser dashboard  (or /api/snapshot for polling)
```

## Non-goals (v0.1)

- No transmitting, jamming, deauth, injection, spoofing — ever.
- No cloud; nothing leaves `127.0.0.1`.
- Recommendations are advisory, not AP-steering commands.

## Deltas vs the original draft

- "Nearest network" is surfaced as the same-SSID comparison inside
  diagnosis, not as a separate API. (Draft said "nearest AP view" — same
  data, one place.)
- `source` field added to network rows (`scan` | `interface`) — the connected
  link is shown even when the environment scan is withheld by the driver.
- 6 GHz band reported as `unknown` rather than guessed (see ISSUE-0003).

## Open questions / future

- Native WiFi API (`WlanScan`) for forced scans and stable per-BSSID RSSI
  (supersedes netsh flakiness — ISSUE-0004; requires new decision record).
- SQLite trend history (weekly congestion per channel).
- Packaging for sale (zip vs installer; code signing).
