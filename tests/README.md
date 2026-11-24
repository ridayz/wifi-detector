# tests/ — tests (not created yet)

Rules for agents:

- Tests mirror `src/`. Use the same runner chosen for the project (Node's
  built-in `node:test` preferred — zero deps, consistent with sibling
  project `wifi-radar`).
- Parser tests must use captured real-world fixtures (EN and ID Windows
  locales, 2.4/5/6 GHz, hidden SSIDs, zero-network output).
- Analysis tests are golden tests: fixed scan bursts → expected diagnosis.
- No test may transmit on any network. Capture-and-parse only.
