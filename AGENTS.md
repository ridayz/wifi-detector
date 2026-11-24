# AGENTS.md — Agent Rules for wifi-detector

You are working on **wifi-detector**. Read `START_HERE.md` first. These rules
bind every agent, regardless of model or provider.

## Mission

Help users understand and diagnose their Wi-Fi environment:

- Scan nearby networks (SSID, BSSID, channel, band 2.4/5/6/7 GHz, RSSI).
- Show which network/access point is nearest to this device in real time.
- Explain why bars are low: distance vs. channel congestion (or both).

## Ground rules

1. Docs are the source of truth. Do not contradict them silently — either
   follow them or propose a doc change first and get approval.
2. Never mark a task done until:
   - `docs/STATE.md` reflects the new reality,
   - related entries in `docs/ISSUES.md` are updated (opened/closed),
   - an entry is appended to `docs/WORKLOG.md`,
   - tests/lint pass if code exists (`npm test`, `npm run lint`).
3. Docs are written in English. Code comments and commit messages in English.
4. Keep files small and focused. Prefer editing over rewriting.

## Scope — what you may touch

- `src/` — application code (collector, analysis, connect).
- `tests/` — tests mirroring `src/`.
- `docs/` — decision records, notes, and the state files.
- `README.md`, `START_HERE.md`, `AGENTS.md` — only with good reason.

## Scope — what you may NOT touch

- Any other project in this workspace (especially `wifi-radar`).
- `.env` or any secrets/credentials. Use `.env.example` instead.
- `docs/DECISIONS/` history: never rewrite an accepted decision; write a new
  one that supersedes it.

## Network behavior — boundaries

Passive collection is the default; the single exception is the
user-initiated connect flow (docs/DECISIONS/0003-connect-from-app.md):

- **Collector/analyzer path:** read-only telemetry only. Never transmits.
- **Connect path:** only on an explicit click in the UI, one network per
  click. No background auto-join, no auto-switch, no band steering.
- Enterprise (802.1X) and WEP are refused with a clear message.
- Passwords: never logged, never stored, never echoed by the API; temporary
  profile XML is deleted after use.
- **Forbidden, always:** deauthentication, jamming, packet injection,
  spoofing, decrypting third-party traffic. If a task seems to require any
  of this, stop and state that it is out of scope.

Also: scanning hardware requires appropriate permissions. Do not try to work
around OS permission prompts.

## Stack status

**Accepted (2026-11-13, see `docs/DECISIONS/0002-stack-node-zero-dep-dashboard.md`):**
Windows-first, Node.js 20+ (zero npm deps), local web dashboard on
`127.0.0.1:4748`, data via passive `netsh` (`show interfaces` +
`show networks mode=bssid`). The app degrades to "connected link only" when the
driver withholds per-BSSID scan detail (ISSUE-0004). Do not change the stack
without a new decision record.

## Definition of Done

1. Code (if any) runs without errors; `npm test` passes once a test setup
   exists.
2. `docs/STATE.md` updated (done / in progress / blocked / next steps).
3. `docs/ISSUES.md` updated (new bugs captured, resolved ones closed with a
   note).
4. `docs/WORKLOG.md` appended with date, model/agent, and summary.
5. `README.md` updated if user-facing behavior changed.
6. Commit message: imperative, concise, English (e.g.
   `docs: define scan data contract v0.1.0`).

## Issue format (docs/ISSUES.md)

Every issue must have: **ID, date, severity, symptom/question, how to
reproduce, root cause (or "unknown"), affected files, fix/status, resolution
date**. Until fixed, mark `Status: open`.

## Handoff protocol (free-tier reality)

Work here may be continued by a different model on a different provider at any
time. Before ending a session:

- Leave `docs/STATE.md` precise enough that a stranger could continue.
- Record open questions in `docs/ISSUES.md`, not in your head.
- If you got stuck, say so in STATE.md under "Blocked".

## Communication style

Reply in the user's language (Bahasa Indonesia when the user writes
Indonesian). Keep technical docs in English. No fluff.
