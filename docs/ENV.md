# ENV — wifi-detector

No environment variables exist yet. Secrets never go in this file — use
`.env.example`. This project is designed to run fully local.

## Implemented variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4748` | Port for the local dashboard, if built (must differ from `wifi-radar`'s 4747) |
| `WIFI_SCAN_INTERVAL_MS` | `2000` | Passive scan interval in milliseconds |
| `WIFI_IFACE` | `Wi-Fi` | Interface name used for connect operations (as shown in `netsh wlan show interfaces`) |
| `WIFI_HISTORY_DB` | `./data/wifi-detector.sqlite3` | Path for optional scan history (phase 2); unset disables storage |

## Notes

- No API keys, no credentials. If a future feature needs them, it goes in
  `.env.example` with placeholders only, and a `docs/DECISIONS/` record
  explaining why.
