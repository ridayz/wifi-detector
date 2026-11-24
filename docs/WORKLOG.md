# WORKLOG — wifi-detector

Append-only journal. One entry per session. Newest first.

## 2026-11-13 — native WiFi scanner replaces netsh for environment read
- Agent/model: opencode session
- Summary: User complained the degraded-mode notice fired too often. Built
  `native/wifiscan.exe` (C#, wlanapi.dll P/Invoke: WlanOpenHandle,
  WlanScan, WlanGetNetworkBssList — 360-byte entry layout verified live:
  77 BSS entries, connected AP matched netsh values exactly). Node
  `nativeScan.mjs` uses it as the primary source (cached table, ms-fast);
  netsh unchanged as zero-build fallback. `freqInfo` derives band/channel
  from frequency. Reentrancy guard added to the collector loop. UI: slim
  in-panel note appears only when BOTH sources fail; amber warning tone
  removed. Verified: 3 consecutive snapshots all show 44 networks;
  `networksScan: true`; degraded note gone; 0 console errors. Docs synced
  (0004, ISSUE-0004 closed, STATE, RUNBOOK native-scanner section,
  ARCHITECTURE, API-CONTRACT source field, README).

## 2026-11-13 — DESIGN.md written

## 2026-11-13 — DESIGN.md written
- Agent/model: opencode session
- Summary: Captured the user-approved visual language as
  `docs/DESIGN.md` — style names "Midnight Neon" (dark) / "Tokyo Day"
  (light), full token tables, neon rules (dark only), component inventory,
  and the change-process for palette edits. Starts from an explicit note
  that the palette is a user-approved deviation from the Dev.Team
  ink/amber default so future agents don't "fix" it back. Referenced from
  START_HERE and README.

## 2026-11-13 — user approved UI ("udh mantep ini")
- Agent/model: opencode session
- Summary: User approved the result ("udh mantep ini") after the neon blue
  pass. Current state: deep navy dark theme with neon accent (`#29b6ff`),
  Tokyo Day light theme, full-bleed layout, native launcher on the Desktop,
  26/26 tests passing. Remaining known items: ISSUE-0004 (driver flake —
  native WiFi API is the fix), ISSUE-0005 (live connect unverified),
  ISSUE-0002 (diagnosis thresholds).

## 2026-11-13 — neon blue pass (dark theme)
- Agent/model: opencode session
- Summary: User asked for neon blue. Dark accent switched #7aa2f7 →
  `#29b6ff` (electric sky blue); `--glow-*` tokens set to neon blue alphas;
  panel hairline now accent-tinted (`rgba(41,182,255,.22)`), topbar neon
  underline; glows wired into logo, live/bad/wait dots, signal bars, connected
  tag, high-congestion chip, primary button, and hover states of header
  buttons. Light theme unchanged (Tokyo Day, no neon). Icon rebuilt neon
  blue, `.exe` rebuilt, verified live: accent/glow computed correctly,
  panel border + logo shadow active, 0 console errors.

## 2026-11-13 — dark theme shifted bluer (user request)
- Agent/model: opencode session
- Summary: Tokyo Night ramp re-tinted toward deep navy slate after the user
  asked for "agak kebiruan... kaya dark gitu": `--bg #0e1522`, surface
  `#131d2e` / `#18253d` / `#1f3050`, text `#c9d6f5`, accent unchanged
  (`#7aa2f7`). Light theme untouched (Tokyo Day). Icon recolored
  (`#0e1522`), `.exe` rebuilt, 0 console errors. If this is still not it,
  user to name a reference scheme (Nord, Solarized, VS Code Dark+, GitHub
  Dark).

## 2026-11-13 — Tokyo Night palette
- Agent/model: opencode session
- Summary: Replaced the graphite ramp with Tokyo Night (after the user
  called graphite "kurang"): dark = Tokyo Night (`--bg #1a1b26`, surface
  `#1f2335`/`#24283b`, text `#c0caf5`, accent blue `#7aa2f7`, ok/warn/bad =
  `#9ece6a`/`#e0af68`/`#f7768e`, text-3 raised to `#8a92bd` for 4.5:1);
  light = Tokyo Day (`--bg #eceef4`, accent `#2e7de9`). Keeps the
  design-language structure (single ramp, one accent, hairlines). Icon
  recolored blue on `#1a1b26`, `.exe` rebuilt, verified live: dark/light
  both computed correctly, 0 console errors.

## 2026-11-13 — fullscreen toggle + full-bleed layout
- Agent/model: opencode session
- Summary: Removed the 1440px max-width clamp so the dashboard fills the
  viewport (design-language: shell fills viewport); added a Fullscreen
  toggle to the header (icon swap expand/collapse, aria-pressed, error
  toast if browser blocks). Note: requestFullscreen needs a genuine user
  click (synthetic clicks lack transient activation) — verified via DOM that
  it is wired and state-syncs on fullscreenchange; visual verification
  pending a real click in the user's browser. 0 console errors.

## 2026-11-13 — manual Scan button
- Agent/model: opencode session
- Summary: Added a **Scan** button to the dashboard header (magnifier icon,
  same button style as the theme toggle). POST /api/scan — x-wifi-detector
  CSRF guard, 1 req/s debounce, returns post-scan snapshot for immediate UI
  refresh (SSE also repaints). Verified: no-header POST → 403, with-header
  → 200; that probe triggered a full environment read (40 networks).
  Console errors = 0. Docs synced (API-CONTRACT, STATE, this file).

## 2026-11-13 — native Windows launcher
- Agent/model: opencode session
- Summary: Built `WiFi Detector.exe` via the repo's native-launcher pattern
  (Launcher.cs + WIFIDET define, port 4748, node runtime). Icon drawn with
  new committed tool MakeIcon.cs (ink rounded square, amber WiFi arcs) →
  icons/wifi-detector.ico. build.cmd now compiles three apps. Desktop
  shortcut `WiFi Detector.lnk` created (mirrors Free Model Radar / Dark
  Fiber Manager). Verified: dev server stopped, double-click launches
  hidden server, port 4748 answers 200, tray process alive, browser opened
  by the launcher itself. Docs synced (README, RUNBOOK, STATE, this file,
  native-launcher/README).

## 2026-11-13 — show/hide password in connect modal
- Agent/model: opencode session
- Summary: Added eye toggle in the connect modal (type password↔text,
  icons toggle, aria-pressed, input refocuses). Modal now clears the password
  field on close as well as on submit (no secret remains in the DOM).
  Driver was in degraded mode at verification time (no full scan available),
  so the toggle was verified via DOM evaluation (input flips to text); the
  button itself is wired into the modal as usual. 0 console errors.

## 2026-11-13 — connect feature (DECISIONS/0003)
- Agent/model: opencode session
- Summary: Added explicit, click-driven WiFi connect from the networks table
  (open / WPA-PSK / WPA2 / WPA3). Enterprise + WEP refused with a clear
  message. CSRF-guarded POST /api/connect (x-wifi-detector: 1); password
  never logged/echoed/persisted; throwaway profile XML deleted in finally.
  New module src/connect/, unit tests for XML building + escaping (26/26
  pass), UI: Actions column + confirm modal + result message. Verified via
  loopback probes: snapshot 200, missing-header POST → 403, enterprise POST
  → refusal. Live join NOT tested (ISSUE-0005) — agent must not join real
  networks autonomously. Docs synced (0003, AGENTS network rules,
  API-CONTRACT, ARCHITECTURE, STATE, ISSUES, RUNBOOK, ENV, README, this).

## 2026-11-13 — environment stale-cache (v0.1.1)
- Agent/model: opencode session
- Summary: Driver (MediaTek MT7921) alternates between rich and bare
  `netsh` output. Added `selectEnvironment` + 4 unit tests: fresh scan wins;
  driver flake reuses the last full scan (≤2 min, disconnected-marked then
  re-marked by the collector); expired cache discarded. Snapshot gains
  `environmentStaleSec`; UI shows "last full scan Ns ago" on the table.
  8 s scan interval tested — flake persists; not a polling-rate problem.
  Docs synced (API-CONTRACT, ISSUE-0004, STATE, RUNBOOK, this file).

## 2026-11-13 — UI reskin to design-language
- Agent/model: opencode session
- Summary: Applied the Dev.Team design-language (.opencode/skills/
  design-language/SKILL.md) to the dashboard: neutral ink ramp + amber accent
  (dark default, light theme with separate tokens), theme toggle persisted to
  localStorage, mono + tabular-nums for every number, hairline borders,
  Inter Tight / Segoe UI Variable stack, removed gradients/glow/emoji icons,
  bars redesigned as 4-segment amber-on-hairline. Verified: console errors =
  0, both themes screenshot-checked. Docs updated (STATE, this file).

## 2026-11-13 — v0.1 implemented
- Agent/model: opencode session
- Summary: Stack accepted (0002): Windows-first, Node 20+, zero npm deps,
  local web dashboard on 127.0.0.1:4748, passive netsh collector. Built
  parsers (EN/ID netsh, hidden SSIDs), congestion analysis, low-bar diagnosis,
  SSE dashboard with RSSI sparkline. 17/17 unit tests pass. Verified live on
  the dev machine (MediaTek MT7921): full environment scan works; alternates
  to degraded connected-link mode when driver withholds per-BSSID detail
  (ISSUE-0004). Hidden-SSID parser bug found via live data and fixed
  (regression fixture added). Docs synced (README, RUNBOOK, STATE, ISSUES,
  ARCHITECTURE, API-CONTRACT).
