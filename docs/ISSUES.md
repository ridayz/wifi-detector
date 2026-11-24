# ISSUES — wifi-detector

Rules: every issue gets an ID (`ISSUE-000N`), date, severity, and a full
template. Close by adding a `## Resolution` subsection — do not delete entries.

## Template

```
### ISSUE-000N — short title
- Date: YYYY-MM-DD
- Severity: low | medium | high | blocker
- Symptom / question:
- Reproduce:
- Root cause: (or "unknown")
- Affected files:
- Status: open | resolved
- Resolution: (fill in when done; include verification)
```

---

### ISSUE-0001 — Windows passive scan: band + RSSI fidelity unverified
- Date: 2026-11-13
- Severity: high → medium (mitigated in v0.1; still open for 6 GHz)
- Symptom / question:
  `netsh wlan show networks mode=bssid` on this machine alternates between
  rich per-BSSID output (verified 2026-11-13: 56 networks with signal/channel/
  radio) and bare output without BSSID blocks. Band label is never printed;
  it is derived from channel + radio type, which is ambiguous on 6 GHz.
- Reproduce: run the collector twice; observe `supported.networksScan` flip.
- Root cause: driver scan-cache behavior (scan trigger timing), not our code.
- Affected files: src/collector/wlan.mjs, src/shared/wifi.mjs
- Status: open (6 GHz band inference only; the rest works)

### ISSUE-0002 — "Why are my bars low?" diagnosis algorithm is undefined
- Date: 2026-11-13
- Severity: medium (core feature — implemented, needs field tuning)
- Symptom / question:
  Implemented in v0.1 (src/analysis/diagnosis.mjs): causes are
  `band-mismatch` (a same-SSID BSS ≥10 dB stronger), `congestion` (connected
  channel rated medium/high), `distance` (RSSI ≤ −75 dBm, no congestion),
  else `unknown`. Thresholds are first guesses.
- Reproduce: use the app in a busy same-SSID building; compare verdicts and
  confidence against reality.
- Root cause: thresholds unvalidated outside one office.
- Affected files: src/analysis/diagnosis.mjs, docs/API-CONTRACT.md
- Status: open (implemented, needs real-world tuning)

### ISSUE-0003 — 6 GHz / 7 GHz availability is hardware- and region-dependent
- Date: 2026-11-13
- Severity: medium
- Symptom / question:
  6 GHz networks may vanish entirely on unsupported hardware/domains, or be
  reported as band `unknown` (802.11ax on channels 15–177 is ambiguous
  between 5 and 6 GHz). The UI must never claim "the channel is empty of
  6 GHz networks" on such machines.
- Reproduce: run scan on the dev machine; verify 6 GHz-capable SSIDs show
  `band: "unknown"` and that this is documented (it is, in README/RUNBOOK).
- Root cause: platform limitation; netsh prints no band for scanned networks.
- Affected files: src/shared/wifi.mjs, README.md, docs/RUNBOOK.md
- Status: open (accepted limitation for v0.1)

### ISSUE-0005 — Connect flow unverified against real networks
- Date: 2026-11-13
- Severity: medium
- Symptom / question:
  v0.1 connect (DECISIONS/0003) is unit-tested (XML builder, CSRF guard,
  enterprise refusal via live probe) but has NOT been exercised against a
  real network join: wrong-password behavior, out-of-range AP, saved-profile
  reuse, and full profile lifecycle (create → connect → delete) are all
  untested. The agent must not join real networks to test without the
  user present.
- Reproduce: user clicks Connect on a guest network they own; observe
  join/failure messages; verify no `wifi-detector-*.xml` remains in
  %TEMP% afterwards.
- Root cause: by design — agent is not authorized to change the machine's
  network state autonomously.
- Affected files: src/connect/*.mjs, src/server.mjs (/api/connect)
- Status: open (needs one attended test session by the user)

### ISSUE-0004 — netsh environment scan output is flaky (no/empty per-BSSID detail)
- Date: 2026-11-13
- Severity: medium (degrades main feature)
- Symptom / question:
  On this machine (MediaTek MT7921, Windows 11), `netsh wlan show networks
  mode=bssid` alternates between full output (56 networks, all fields) and a
  bare "There are 1 networks currently visible." with no BSSID blocks and
  no signal/channel data. The app cannot force a rescan; Windows owns scan
  timing. v0.1 degrades to "connected link only" mode when this happens and
  surfaces a note in the dashboard.
- Reproduce: poll `api/snapshot` repeatedly; observe `supported.networksScan`
  flip between true and false. Also observed at 8 s scan interval — not a
  polling-rate problem.
- Root cause: driver scan cache/throttling (not controllable via netsh).
- Affected files: src/collector/wlan.mjs, src/collector/index.mjs
- Resolution (2026-11-13): native source landed as primary collector
  (`native/WifiScan.cs` → `wifiscan.exe`, WlanScan + WlanGetNetworkBssList).
  netsh kept as zero-build fallback. Verified: 3 consecutive snapshots all
  show full environment (44 networks). See DECISIONS/0004.
- Status: **resolved (2026-11-13)**
