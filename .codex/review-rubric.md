# Default Review Rubric

Use this rubric for code review and implementation self-checks.

## P0

- auth bypass
- secret exposure
- data loss
- broken deploy
- destructive migration without safeguards

## P1

- broken core workflow
- serious correctness bug
- unsafe input handling
- missing transactional or persistence safeguards
- unreliable external API integration

## P2

- missing tests for changed behavior
- brittle error handling
- unclear ownership boundaries
- performance issue in common path
- weak observability

## P3

- naming
- docs polish
- small simplifications
- minor UX polish


# Regovise review additions

Scope every change against `.codex/architecture.md`, the canonical-platform decision and its originating request. `apps/web` and `cloudflare` receive shipping behavior; legacy and sandbox directories are parity/design sources.

- Trace UI action → feature API → service handler → scoped authorization → D1/R2/queue effects → returned state. A route, badge, metadata fixture or success notice alone is insufficient evidence of implemented behavior.
- Preserve tenant, folder and artifact/offering scope through read/write/export/portal paths. Explicitly test restricted users; a demo administrator happy path is insufficient.
- Check advertised outputs through a real format parser/renderer. Distinguish native files, structured manifests, semantic previews and example data.
- Treat GET handlers with lazy default/backfill writes as state-changing when choosing test targets. Use isolated local state; do not assume production smoke is read-only.
- Assess retry/idempotency, concurrency and partial D1/R2/queue/DO failure for changed background behavior.
- Verify loading/error/empty/success and permission-denied behavior plus desktop/tablet/mobile discovery. Keyboard focus and Escape behavior need interaction checks, beyond token scanning.
- Keep static alignment success separate from runtime/external-provider/regulatory parity. Record exactly which revision/config/data/environment was tested.
- Never use secret files or production systems for routine exploration. Follow AGENTS.md approval requirements for sensitive changes.

Current source-backed risks and unfinished contracts are listed in `.codex/risks.md`. Recommended bounded follow-ups are in `.codex/backlog.md`.
