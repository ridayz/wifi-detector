# STATE — wifi-detector

Last updated: 2026-11-13 (implementation session)

## Stage

`in-progress` — v0.1 implemented and verified on this machine; field
validation pending.

## Done

- 2026-11-13 — Project scaffold + full documentation system (README, START_HERE,
  AGENTS) created.
- 2026-11-13 — Stack accepted: Windows-first, Node.js 20+, zero npm deps, local
  web dashboard on 127.0.0.1:4748, passive netsh collector
  (`docs/DECISIONS/0002-stack-node-zero-dep-dashboard.md`).
- 2026-11-13 — v0.1 implemented: server + SSE dashboard, EN/ID netsh parsers,
  band/channel derivation, congestion analysis, low-bar diagnosis, RSSI
  history sparkline. 17/17 unit tests pass.
- 2026-11-13 — UI reskin to the Dev.Team design-language token structure
  (`.opencode/skills/design-language/SKILL.md`); palette is Midnight Neon
  (dark) / Tokyo Day (light) — see `docs/DESIGN.md`. Console clean.
- 2026-11-13 — Environment stale-cache (v0.1.1): driver flake no longer blanks
  the networks table — last full scan (≤2 min) is reused and labelled.
  `node --test` → 21/21 pass. Rich 56-network scan observed once (04:32),
  driver now consistently withholds detail on this machine.
- 2026-11-13 — Native WiFi enumeration (DECISIONS/0004, ISSUE-0004 resolved):
  environment read now goes through `native/wifiscan.exe` (WlanScan /
  WlanGetNetworkBssList) with netsh as zero-build fallback. 3 consecutive
  snapshots all show full environment; UI degraded-note fires only when both
  sources fail. 27/27 unit tests pass.
- 2026-11-13 — Connect feature (DECISIONS/0003): user may join networks from
  the table (open / WPA-PSK / WPA2 / WPA3; enterprise + WEP refused).
  CSRF-guarded POST /api/connect; passwords never stored/logged; temp
  profiles deleted. 26/26 unit tests pass. Live join NOT yet verified
  (ISSUE-0005).
- 2026-11-13 — Native Windows launcher: `WiFi Detector.exe` (tray icon,
  starts server hidden, opens browser on double-click) + Desktop shortcut
  `WiFi Detector.lnk`. Built via `scripts/native-launcher/build.cmd`
  (WIFIDET). Icon drawn by `MakeIcon.cs`. Verified live: double-click starts
  server, port 4748 answers 200, tray process running.
- 2026-11-13 — Verified live on this machine (MediaTek MT7921, Windows 11):
  full environment scan observed working (5 GHz dense, AP confirmed), app
  alternates to degraded mode when driver withholds per-BSSID detail.
- 2026-11-13 — Hidden-SSID parsing bug fixed and locked in with a fixture
  (hidden network row now parses as ssid = "").

## In progress

- Field validation of diagnosis heuristics (needs the user to use it in rooms
  with multiple APs / same SSID).

## Blocked

- None.

## Next steps

1. User runs it at home/office with same-SSID APs; collect real feedback.
2. Tune diagnosis thresholds from that feedback (ISSUE-0002).
3. Decide packaging: zip + `node src/server.mjs` vs installer; decide license
   for sale (private/commercial).
4. Optional: SQLite scan history for trend analysis.

## Risks / notes

- `netsh` environment scans are flaky on some drivers; **the native helper
  (DECISIONS/0004) is now the primary source**, netsh the fallback. Degraded
  mode remains possible only if both fail (APP shows a slim in-panel note).
- 6 GHz band inference is limited but frequency (not channel) drives band
  mapping now — `freqInfo` in `src/shared/wifi.mjs`.
- Same-SSID band steering may re-associate the device mid-diagnosis —
  acceptable for v0.1.
- wifi-radar is a different product; do not modify it here.
