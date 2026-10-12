# Bounded Regovise follow-up candidates

Prepared from the 2026-10-11 source/runtime map. These are recommendations, not implementation authorization. Each slice should have its own acceptance criteria; do not broaden into a general rewrite. Security/auth/access-control changes require explicit approval. See [risks](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/risks.md) and [architecture](/Users/tkhan/IdeaProjects/ciso-assistant-community/.codex/architecture.md).

## Completed orientation

- [x] Pull configured upstream safely and record revision/dirty-tree boundaries.
- [x] Establish canonical versus legacy/sandbox ownership.
- [x] Trace all canonical service and frontend route families.
- [x] Inventory source/imports/routes/API calls/migrations/tables.
- [x] Run canonical static/type/build checks.
- [x] Exercise 85 navigation destinations across four widths and seeded detail/dialog/anonymous paths in isolated state.
- [x] Capture source-backed capability limits and prioritized risks.

## Twenty independently scoped candidates

| # | Slice | Acceptance criteria / boundary |
| --- | --- | --- |
| 1 | Correct fresh demo bootstrap ordering | Fresh 41-migration DB bootstraps without tenant preseed; second bootstrap succeeds; fixtures/relationships remain consistent. Scope demo provisioning only. |
| 2 | Correct anonymous questionnaire route params | Anonymous valid/invalid share-token route requests shell and resolves from loading; access-code checks still govern responses. No login/authorization redesign. |
| 3 | Verify and correct production header/session exchange | Isolated production-mode matrix establishes possession requirement, legacy/local path expectations and failure behavior. Sensitive implementation requires approval. |
| 4 | Verify root-admin scope semantics | Direct/group/nonrecursive/recursive domain/root assignments match intended tenant-admin policy; reject nonroot privilege where required. Approval before access-control edits. |
| 5 | Bind portal grants to requested artifacts | Two-offering/two-tenant public/private artifact matrix; expired/revoked/unrelated grants rejected and valid linked grant preserved. Approval before authorization edits. |
| 6 | Guard tenant workflow snapshot and review CORS | Anonymous/cross-tenant requests and malicious/trusted origins tested locally; explicitly document front-door policy. Sensitive edits need approval. |
| 7 | Complete mobile drawer keyboard interaction | Escape closes; focus stays within open drawer and returns to trigger; background controls are unreachable while open; desktop/tablet unaffected. |
| 8 | Make tablet navigation destinations discoverable | All permitted secondary routes reachable at 768–1279px with visible names; preserve canonical route ownership. Design/spec before implementation. |
| 9 | Repair shell shortcut/notification affordances | Cmd/Ctrl+K matches its displayed behavior and permission gates; static notification dot becomes accurate or its misleading interaction is removed. |
| 10 | Catalogue provider-specific evidence-source configuration | Document supported live inputs per provider, required fields, failure cases and storage/redaction policy; scope one provider form after approval. |
| 11 | Make Integration Manager outcomes truthful | Test/Sync identifies dry-run results explicitly; define separate real connector operation and evidence contract before extending it. |
| 12 | Establish native export validity contracts | One chosen advertised format opens in an actual parser/renderer and matches selected data; previews clearly identified; avoid broad exporter rewrite. |
| 13 | Complete Report Builder download handoff | Returned downloadPath is usable from UI; confirm one supported format/content; retain failed-export history. |
| 14 | Prevent report preview examples from representing empty actual data | Empty/filter-miss shows explicit empty state; example mode separate; current data/filter semantics verified. |
| 15 | Scope real chart/dashboard rendering | Select one existing chart type and report definition; preview matches queried series/filters; remove unsupported claims until implemented. Approval for architecture/dependencies. |
| 16 | Clarify quantitative summary/simulation contract | Portfolio/scenario values reconcile; fixed multipliers/default assumptions identified; define bounded parity spec before scientific engine port. |
| 17 | Specify real risk conversion/review-packet actions | Agree output/linkage contract; one traceable conversion or artifact path; no notice-only claim of completed work. |
| 18 | Validate questionnaire field/upload/rule contract | Chosen question types match server validation; reference versus uploaded file handling clear; hide/disable/lock and submit/reopen behavior tested. |
| 19 | Fault-inject one queue/artifact/writeback path | Retry/idempotency/dead-letter replay maintains consistent D1/R2/DO state; scoped audit trace and no duplicate external action. External mutations require explicit scope. |
| 20 | Review exact release artifact and dependency/schema readiness | Separate committed/uncommitted changes, dependency audit triage and41-migration compatibility; main deploy cannot silently ship incompatible schema. No auto-deploy. |

## First five safe parallel investigations

1. Reproduce clean bootstrap and prepare a regression test/spec for ordering (no auth changes).
2. Reproduce anonymous questionnaire parameter loss and prepare a route-level regression spec.
3. Read-only identity/root/grant/workflow authorization matrix from code and isolated fixtures; request approval only for the concrete sensitive patch.
4. Audit one claimed export's actual content/MIME/parser validity and separate preview from native output.
5. Keyboard/tablet navigation audit with screenshots and focus observations; propose one bounded UX correction.

The initial mapping did not authorize these implementations. Start one chosen bounded slice after a direct user request, preserving the existing local changes.
