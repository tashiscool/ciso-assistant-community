# Regovise best-practice port: implementation and evidence

Reference: read-only `/Users/tkhan/IdeaProjects/alovoa` (Pairara), commit `9a2b93396af084f7b6214d80c46814e66c67fd74`. Target: Regovise `apps/web` + `cloudflare`, HEAD `752f0ffe127a8ec6b2476207b6f08fbcf9d71185` with preserved existing work. [The disposition index](README.md) links 127 overlapping source-backed practice entries; that count is not a count of implemented features.

## Applied changes

| Area | Change | Meaningful scope of evidence |
| --- | --- | --- |
| Client transport | Typed status/code/details, safe opaque-error fallback, one body read, explicit empty/protocol handling, unchanged valid JSON/method/body/cookie/header behavior, no mutation retries. | Stubbed actual client/parser regressions, real questionnaire requests. No universal wire schema or auth redesign. |
| Cosmetic storage | Coach-mark preferences tolerate unavailable/quota-limited localStorage and keep their existing keys/values. | Normal/blocked storage fixtures; auth storage untouched. |
| Provider reads | Shared request-and-body deadlines, caller cancellation and resource cleanup on selected GRC/GitHub/Wiz/Okta/AWS/SCF reads. | Actual helper/signer/native fixture regressions. No live credentials/provider verification, new retries or universal job budget. |
| Navigation/questionnaire | Radix modal drawer keyboard behavior; remove development footer; anonymous route token/error fix, stale-response handling and truthful current status. | [Real browser tasks and canonical answer readback](ui-verification.md). Pending-save edit protection is covered by its final delayed-response regression. |
| Reproduced backend defects | Create tenant before demo IAM folders; correct VDR INSERT to 15 placeholders for 15 columns/binds. | Fresh/repeat bootstrap and core/FedRAMP persisted package/report suites; no schema change. |
| Repository quality | Root commands/runtime pins/editor config/owner docs; canonical source/provenance policy; exact-function clone ratchet; static feature/API/route traceability. | Negative policy fixtures, deterministic fingerprints, actual type/build/static checks. Six existing clone groups remain reviewed debt; inventories are source declarations. |
| Local execution | Fresh owned D1/R2/queues/DO, minimal environment/empty config, explicit provider fakes/outbound block, bounded owned processes, full log flush, cleanup diagnostics and source-bound receipts. | Real local domain readbacks and process/timeout/ownership regressions; test adapters and fakes are explicitly classified. |
| Release | Offline plan returns before secret/cloud effects; dry-run CI guards; SHA-pinned actions/read-only CI credentials; promote digest-bound tested web bytes. | Seven release plus twelve artifact regressions; no live release. Worker still rebundles from the same commit/locked dependencies. |
| Dependencies | Reviewed compatible lock updates: current direct package names/ranges/majors preserved, no new direct dependencies. | Scratch and canonical installs/builds/types/tests. Fresh audit: web 11 (6 high, 5 moderate), Worker 6 (5 high, 1 low). Audit correctly fails. |

## Verification receipts

Final result: [`npm run verify:full` passed all 18 gates](../../artifacts/verification/verify-2026-10-12T04-34-58-766Z-94dfcaee/result.json), including **122 selected regression cases** (51 frontend, 24 provider, 7 release, 12 artifact, 28 operations/policy) and the four real isolated domain suites. Source identity is stable before/after: `b61ab31bebe0741966583515df49d2a7852b286c6840094ef20b3707eb865fd2`. Verification used local Node `v24.13.0`; pinned CI Node `22.22.0`/Linux and actual GitHub Actions execution remain separate.

An [earlier passing aggregate run](../../artifacts/verification/verify-2026-10-12T03-53-48-121Z-81f4948b/result.json) remains historical. Independent review then found pending-save draft loss; response fields now lock during the request. Seven compiled-handler/effect/rendered-props regressions cover success, failure, submission, rule locks and stale context. A real browser with a five-second delay added only to the owned temporary Worker response confirms pending-field locking and recovery; actual backend response/readback is retained.

A further independent pass found stale success notices, missing navigation disclosure semantics and structured answers falling through to a text editor. Edits/request starts now clear old success, pending Save has a visible label, and successful notices use polite status semantics. Group buttons expose controlled expanded state with unique referenced IDs. Native multiselect edits preserve string arrays; existing tables, incompatible structured answers and structured evidence remain read-only and roundtrip unchanged when another field is saved. Fifteen questionnaire cases now cover these paths. Full table editing requires a separately reviewed public metadata/validation contract; no new API field or storage shape was invented.

The final independent source/image/receipt recheck found no remaining P0/P1/P2 issue within this bounded supported slice. It confirmed array selections and unchanged table rows in the submitted canonical readback. Full public table editing, screen-reader testing and other browser engines remain outside that result.

The positive local GRC lane injects artificial `TEST` SCF controls/mappings and persists real local packages/reports. The blocked-provider lane verifies failed refresh, unchanged mapping state and explicit fixture collection; it does not replace blocked live-provider success with fabricated proof. Scrutiny reads canonical materialized record IDs and checks their backlinks/placeholder/review state instead of assuming evidence titles contain a run-title marker.

[Browser evidence](ui-verification.md) separately records measured 1440×1000 and 390×844 task/keyboard/screenshot observations plus canonical questionnaire readback. Static alignment/queue/IA/token checks are not every-action, provider, full accessibility or regulatory verification.

An older long-lived browser run reported incomplete cleanup; its [follow-up receipt](../../artifacts/verification/local-2026-10-12T03-28-13-053Z-995d36e5/cleanup-followup.json) confirms its recorded groups were already absent and removes only its retained scratch. The original failure is preserved. The final browser run stopped normally and removed its owned state. No shared/local user state, production data, unrelated process or reference repo was changed.

## Authorized production hardening

The user subsequently approved production hardening, deployment, commit and push. The proposed security patch is now applied and tested against canonical source. Approved major Vite/Tailwind/Router/Wrangler/Workers Types migrations now report zero advisories in both canonical lockfiles. Session/password, bounded HTTP/origin, native questionnaire tables and queue replay integrity safeguards have additional behavioral regressions. Release promotion uses one digest-bound Worker/web/config/SQL package with no synthetic production preparation or secret synchronization.

See [production hardening and evidence boundaries](../../documentation/engineering/production-hardening.md) and [release operator commands](../../ops/release/README.md) for the final scope. Historical candidate patches/logs under `proposals` are superseded and are not executable release inputs. The ATO preview remains a synthetic design artifact; broad domain capability limits in the maps are not silently classified complete.

The initial tree contained 155 modified tracked files and many untracked artifacts. Hash comparison of 271 captured pre-existing public changed files identifies nine intentionally edited paths; the other 262 remained unchanged. Edits inside those paths preserve existing work rather than resetting the tree. Git diff totals also contain the user's earlier changes and are not attributed wholesale to this port.

Full best-practice adoption remains incomplete where protected changes or unapproved architecture/product contracts are required. The implemented portions and the matching evidence above are reviewable now.

## Final approved source verification

`npm run verify:full` passed 22 gates and 324 regression cases on Node 24.13.0, plus fresh isolated core/GRC/scrutiny/FedRAMP journeys. Source fingerprint `9e3b276c98c473fe89218b26575fbf57423124c3b0d2a19322670c77c92cd21c` was identical before and after the complete run. Receipt: `artifacts/verification/verify-2026-10-12T05-54-52-373Z-093e9d9a/result.json`. Both canonical registry audits were zero. The exact Node 22 CI pin was not exercised locally because its temporary extraction exceeded machine disk headroom; the incomplete task-owned extraction was removed. The actual supported host runtime pass is reported rather than a CI execution claim.

Independent visual review cleared the seven desktop/phone screenshots in `artifacts/verification/release-ui`. Native keyboard activation, nested table actions, phone filtering, questionnaire row/list/date persistence, submitted locks and mobile navigation focus containment/recovery were exercised. Development fixture session bootstrap legitimately authenticates the local browser; public anonymous login-required rejection is proven through the canonical HTTP/SQLite tests and real local API request, rather than inferred from the already authenticated development browser.
