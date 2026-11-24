# 0001 — Windows-first, passive, read-only scanning

- Date: 2026-11-13
- Status: **Proposed** (needs user approval; see docs/STATE.md)

## Context

The product must work out-of-the-box on typical customer machines. The user
described same-SSID APs across 2.4/5/6/7 GHz and poor roaming — the app's job
is to *observe* the radio environment and *explain* it, not to act on it.

## Decision

- Target **Windows 10/11 first**. macOS/Linux support is explicitly deferred.
- All wireless data comes from **passive, read-only sources**:
  `netsh wlan show networks mode=bssid` initially; possibly the Native WiFi
  API later (evaluation pending ISSUE-0001).
- The app never connects to, authenticates to, spoofs, deauthenticates,
  injects, or jams networks. There is no transmission capability of any kind.
- Storage, if any, is local (SQLite) and opt-in.

## Consequences

- Simplest possible permission model — no UAC elevation planned.
- Cannot measure what the OS does not expose (band quirks, 6 GHz); those gaps
  are tracked as issues, not worked around with hacks.
- Being read-only and local makes the app easy to explain, sell, and ship.

## Alternatives considered

- **Linux via `iw`** — rejected for v1; support matrix too wide.
- **Raw 802.11 frame capture with monitor mode** — rejected: needs monitor
  mode, elevation, and special drivers; violates the passive/no-touch
  principle and the product's simplicity.
- **Router/AP APIs (SNMP, controller APIs)** — rejected for v1: couples the
  product to specific AP vendors; may be a future "Pro" feature, requiring a
  new decision record.
