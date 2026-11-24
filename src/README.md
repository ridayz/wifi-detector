# src/ — application code (not created yet)

Rules for agents:

- No code may be written here before the stack decision is recorded in
  `docs/DECISIONS/` and `docs/STATE.md` unblocks coding.
- Planned layout (Proposed): `collector/`, `analysis/`, `shared/types.ts`,
  `public/` (or `cli/`). See `docs/ARCHITECTURE.md`.
- Mirror public logic in `tests/` with pure, deterministic tests
  (fixtures for netsh/CLI output → typed samples → analysis output).
