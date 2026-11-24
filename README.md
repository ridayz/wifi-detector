# wifi-detector

WiFi Detector — a real-time, **passive** analyzer of the Wi-Fi environment:
it scans nearby networks (SSID, BSSID, channel, band 2.4/5/6/7 GHz, signal
strength), tracks which network is nearest right now, and explains **why**
signal bars are low — distance, channel congestion, or both.

Status: `in-progress` (v0.1 implemented; field validation ongoing)

## The problem

In a building full of Wi-Fi access points, many networks share the same SSID
across 2.4 / 5 / 6 / 7 GHz bands. When a device moves to the next room, it
often fails to roam automatically, or cannot see the access point at all —
even though it was connected in the previous room. Reconnecting manually is
the usual, frustrating workaround.

## What it does

- **Scan** nearby Wi-Fi networks in real time: SSID, BSSID, channel, band
  (2.4 / 5 / 6 / 7 GHz), RSSI (dBm), signal bars, security type.
- **Show the congestion** of each band/channel with an RSSI-weighted energy
  estimate.
- **Track the connected link**: band, channel, RSSI history sparkline.
- **Diagnose low bars** — "distance" vs "channel congestion" vs "band/AP
  mismatch" — with an explicit confidence level. Never presents a guess as
  certainty.
- **Connect to a network** from the table (open / WPA-PSK / WPA2 / WPA3;
  Enterprise + WEP refused; password never leaves the machine, never stored).

## Hard constraint

The app is **passive and read-only**. It observes OS wireless telemetry only.
It never transmits, deauthenticates, jams, spoofs, or injects packets.
See `docs/DECISIONS/0001-windows-first-passive-read-only.md`.

## Requirements

- Windows 10/11
- Node.js 20+
- Wi-Fi adapter capable of 2.4/5 GHz (6/7 GHz optional)

## Design

The UI follows the Dev.Team design-language
(`.opencode/skills/design-language/SKILL.md`) structurally; the palette is
**Tokyo Night** (user choice): `#1a1b26` background, `#7aa2f7` accent,
`#c0caf5` text; the light theme is Tokyo Day (`#eceef4` / `#2e7de9`).
Inter Tight / Segoe UI Variable stack, mono + tabular numerals, hairline
borders, no gradients/glow/emoji. Dark theme by default; toggle persisted in
localStorage.

## Run

**Desktop shortcut:** double-click **WiFi Detector.lnk** on the Desktop —
below, it starts the server hidden (if not already running), waits for port
4748, then opens your browser and parks a tray icon (double-click the tray
icon to reopen).

**Direct:** double-click `WiFi Detector.exe` in this folder. Build it again
with `scripts\native-launcher\build.cmd` after changing `src/` — the `.exe`
is build output and is gitignored.

**Manual (for development):**

```powershell
cd projects/wifi-detector
node --test        # 27 unit tests
node src/server.mjs
```

Open **http://127.0.0.1:4748** — loopback only; nothing leaves the machine.
`PORT` and `WIFI_SCAN_INTERVAL_MS` can override defaults (see `docs/ENV.md`).

## Known limitations

- Environment data comes from the **Native WiFi API** helper
  (`native/wifiscan.exe`, DECISIONS/0004): millisecond BSS-table reads, no
  driver flakiness on this machine. If the helper is missing the app falls
  back to netsh (unchanged behavior).
- 6 GHz band inference from channel number is ambiguous; 6 GHz networks may
  show band `unknown` until validation (ISSUE-0003).
- The diagnosis is a heuristic, not a fact. Read the confidence level.

## Project system

This repo is designed for agent hand-off. Start with `START_HERE.md`; docs
in English; `docs/STATE.md` is the source of truth for progress.

- `docs/STATE.md` / `docs/ISSUES.md` — live status and known problems
- `docs/ARCHITECTURE.md` / `docs/API-CONTRACT.md` — how it works and its contracts
- `docs/DESIGN.md` — the approved visual language (Midnight Neon / Tokyo Day)
- `docs/RUNBOOK.md` — run/test/verify
- `docs/DECISIONS/` — why the stack and guardrails are what they are
- `projects/wifi-radar` — **separate** product (monitoring your connected
  link); do not modify it from this project

## License

Undecided. Closed source is the default direction (commercial product).
