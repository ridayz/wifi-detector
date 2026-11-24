# API CONTRACT — wifi-detector

Version: `v0.1.0` — implemented 2026-11-13.
Status: **Stable (additive changes only).** Breaking changes require a
`docs/DECISIONS/` record and a version bump.

Consumers: local dashboard (same process). No network API exposure (loopback
only).

## Types

```ts
type Band = "2.4GHz" | "5GHz" | "6GHz" | "7GHz";

interface WifiNetworkSample {
  ssid: string;          // "" for hidden networks — never null
  bssid: string | null;  // MAC address, upper-case colon form; null when driver withholds it
  band: Band | "unknown";
  channel: number | null;
  rssiDbm: number | null;       // null when OS does not expose it
  signalBars: 0|1|2|3|4;        // normalized for UI
  signalPct?: number | null;    // raw netsh percentage when available
  security: "open" | "WEP" | "WPA" | "WPA2" | "WPA3" | "unknown";
  securityRaw?: string | null;  // verbatim netsh authentication text
  networkType?: string | null;  // e.g. "Infrastructure"
  isConnected: boolean;         // true only for the currently joined network
  source?: "scan" | "interface" | "native"; // "interface" = synthesized from the connected-link reader; "native" = from the WlanScan helper
  seenAt: string;               // ISO-8601 timestamp
}

interface ScanBurst {
  id: string;                   // unique per scan cycle (epoch ms as string)
  capturedAt: string;           // ISO-8601
  supported: { interfaces: boolean; networksScan: boolean };
  connected: ConnectedLink | null;
  errors: string[];             // driver/parser errors for this cycle (empty on success)
  environmentStaleSec: number | null; // seconds since last full scan when serving from cache; null = fresh
  history: { t: string; rssi: number }[]; // ring, ≤180 samples
  networks: WifiNetworkSample[];
  congestion: CongestionReport[];
  diagnosis: Diagnosis;
}

interface ConnectedLink {
  ssid: string | null;
  bssid: string | null;
  band: string | null;          // raw driver text, e.g. "5 GHz"
  channel: number | null;
  radio: string | null;
  security: "open" | "WEP" | "WPA" | "WPA2" | "WPA3" | "unknown";
  signalPct: number | null;
  rssiDbm: number | null;
  bars: 0|1|2|3|4;
}

interface CongestionReport {
  band: Band;
  channel: number;
  networkCount: number;         // number of APs heard on this channel
  energyDbm: number | null;     // RSSI-weighted estimate, null if unknown
  congestion: "low" | "medium" | "high" | "unknown";
}

interface Diagnosis {
  targetBssid: string | null;   // the network the device is joined to
  cause: "distance" | "congestion" | "band-mismatch" | "unknown";
  confidence: "low" | "medium" | "high";
  summary: string;              // human-readable, honest wording
  suggestions: string[];        // e.g. "Switch to the 5 GHz BSS of this SSID"
  scanSupported: boolean;       // false = environment scan unavailable on this adapter
  bars: 0|1|2|3|4;
}
```

## POST /api/scan

Force one environment scan on demand (the dashboard's **Scan** button).

- Requires header `x-wifi-detector: 1` — same CSRF guard as `/api/connect`.
- Debounced: at most one manual scan per second (429 otherwise).
- Response: `{ ok: true, snapshot: ScanBurst }` — the full post-scan snapshot;
  also delivered to SSE subscribers on the next cycle.
- Read-only: triggers `netsh` telemetry only, changes nothing on the machine.

## POST /api/connect

State-changing endpoint (only one). See `docs/DECISIONS/0003-connect-from-app.md`.

- Requires header `x-wifi-detector: 1` (CSRF guard for loopback; no CORS
  is ever enabled, so cross-origin pages cannot call it).
- Body: `{ ssid, password?, security?, securityRaw? }` — `password` is
  optional when a saved Windows profile exists; `security` is one of
  `open|WPA|WPA2|WPA3|WEP`; `securityRaw` carries the driver text
  (used to refuse Enterprise/802.1X and WEP with a clear message).
- Response: `{ ok: boolean, message: string }`. The password is never
  echoed, never logged, never written to the snapshot.
- No credentials are persisted by the app. Temporary WLAN profile XML
  (only for networks with no saved profile) is deleted in `finally`.
- v0.1 does not support: 802.1X / WPA-Enterprise, WEP, hidden-SSID
  auto-join, automatic band steering.

## Stability rules

1. Field names are contract. Renames are breaking changes.
2. Anything unknown is `null`/`"unknown"` — never fabricated.
3. New fields are additive only within a minor version bump.
4. The UI must handle every `*|"unknown"` and `"null"` explicitly.

## Implementation notes (2026-11-13)

- Types are expressed in JSDoc inside `src/` (zero-dep Node); the contract
  above is authoritative, and `src/shared/wifi.mjs` + the parsers mirror it.
- The snapshot returned by `/api/snapshot` is a `ScanBurst`, including the
  `history` ring (≤180 `{ t, rssi }` samples, ~6 min at 2 s), capped by
  `HISTORY_LIMIT` in `src/collector/index.mjs`.
- Hidden SSIDs are `ssid: ""` (never null/undefined).
- Bands are `"unknown"` whenever inference is ambiguous — never guessed.
- Any contract change must land with parser + golden tests.
