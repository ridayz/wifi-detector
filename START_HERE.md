# START HERE

Read these files **in this exact order** before doing anything:

1. `AGENTS.md` — the rules. Non-negotiable.
2. `docs/STATE.md` — where the work stands right now.
3. `docs/ISSUES.md` — what is broken or undecided yet.
4. `docs/API-CONTRACT.md` — the planned data contracts.

Then, only if needed:

- `docs/ARCHITECTURE.md` — planned design (all marked *Proposed*).
- `docs/DESIGN.md` — the approved visual language (Midnight Neon / Tokyo Day).
- `docs/RUNBOOK.md` — how to run/test (will be filled in when code lands).
- `docs/DECISIONS/` — why past decisions were made.
- `src/README.md`, `tests/README.md` — folder rules for where you edit.

## Golden rules

- The docs are the source of truth. If the code and the docs disagree, the
  docs win until a human says otherwise.
- Update `docs/STATE.md`, `docs/ISSUES.md`, and `docs/WORKLOG.md` **before**
  declaring work done.
- Do not write application code until the stack decision is recorded in
  `docs/DECISIONS/` and `docs/STATE.md` says the green light.
- Ask before: adding dependencies, changing stack, touching `.env`/secrets,
  modifying any other project (e.g. `wifi-radar`), or any non-read-only
  network behavior.
