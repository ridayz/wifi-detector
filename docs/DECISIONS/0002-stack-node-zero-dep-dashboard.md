# 0002 — Stack: Windows-first, Node.js 20, zero-dependency local dashboard

- Date: 2026-11-13
- Status: **Accepted by user** ("langsung buat aja aplikasinya", 2026-11-13)

## Decision

- **Windows 10/11 first**, Linux best effort later (no macOS in v1).
- **Node.js 20+**, zero external npm dependencies — mirrors the approach of
  `wifi-radar`: built-in `http`, Server-Sent Events, `node:test` for tests.
- Data source: **passive `netsh`** (`netsh wlan show interfaces` for the
  current link; `netsh wlan show networks mode=bssid` for the environment
  scan). If the driver does not expose per-BSSID scan results (observed on
  MediaTek MT7921, ISSUE-0004), the app degrades to "connected link only"
  mode and says so.
- Delivery: **local-only web dashboard** on `127.0.0.1:4748` (4747 is used by
  `wifi-radar`). No network listeners beyond loopback.
- Storage: in-memory ring buffer only (≈6 minutes of history). No DB in v1.

## Rationale

- Same toolchain the user already runs (sibling `wifi-radar`); an agent that
  knows one knows the other.
- Zero deps = trivially auditable and a tiny supply-chain surface, important
  for something meant to be sold.
- `netsh` is preinstalled on every target machine; no Elevation/UAC needed.

## Consequences

- Per-BSSID richness depends on the driver; some machines get a degraded view
  (tracked as ISSUE-0004, see docs/ISSUES.md).
- 6 GHz band inference from channel number is ambiguous; networks on 6 GHz
  may be reported as `unknown` until validation (ISSUE-0003).
- No packaging/installer decision yet; "clone and run" per `docs/RUNBOOK.md`.

## Alternatives considered

- Native WiFi API via koffi/ffi — rejected for v1: native toolchain, harder to
  audit, premature before validating what `netsh` gives us.
- Electron/Tauri desktop app — rejected for v1: heavy; the local dashboard
  covers the need first.
- Python + scapy/monitor mode — rejected: violates passive/read-only
  constraint and adds elevation requirements.
