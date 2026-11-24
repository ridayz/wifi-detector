# 0003 — WiFi connectivity from inside the app (explicit, click-driven)

- Date: 2026-11-13
- Status: **Accepted by user** ("bikin juga bisa konek dari aplikasi kita men",
  2026-11-13)

## Context

The product started as a passive, read-only analyzer (0001). The user now wants
connect-to-network capability inside the same app. This breaks 0001's
read-only stance, so it gets its own record with strict boundaries.

## Decision

- Connecting happens **only via explicit user click** in the dashboard. No
  background auto-connect, auto-join, or steering logic.
- v0.1 connectivity is **WPA-PSK / WPA2-PSK / WPA3-SAE (no 802.1X)** and open
  networks. Enterprise (802.1X, e.g. DCI-INTERNAL / DCI-IOTS) is rejected with
  a clear message — certificates are a separate engineering effort.
- Password flow:
  - If a Windows profile already exists for the SSID → connect with no
    password (never reads back stored credentials).
  - Otherwise a temporary profile XML (netsh `add profile`) is created in the
    OS temp dir with a random name, used for `netsh wlan connect`, then
    **deleted in `finally`**.
  - The XML is written to `os.tmpdir()`, passed only via `execFile` argv —
    never via a shell. Passwords never appear in `argv` of any process, never
    in logs, never in the snapshot, never in `WORKLOG`/`ISSUES`.
  - XML content is escaped for `&`, `<`, `>`, quotes.
- CSRF guard on `POST /api/connect`: requires custom header
  `x-wifi-detector: 1`. Loopback forms/fetches from other origins cannot
  attach it without a preflighted CORS request, which we never approve.
- The current connection may drop by joining another network. The UI shows a
  confirm step with that consequence spelled out. No silent switches.

## Consequences

- The app is no longer purely read-only; 0001's guarantee applies to the
  collector/analyzer paths only. Connect capability is isolated under
  `src/connect/`.
- Live connection testing (wrong password, out-of-range AP, enterprise
  rejection) is on the user — the agent must not join real networks without
  the user's explicit direction.
- Hidden-SSID and auto-join behavior are intentionally out of scope for v0.1.
