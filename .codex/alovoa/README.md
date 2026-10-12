# Alovoa / Pairara practice audit and dispositions

Reference source: `/Users/tkhan/IdeaProjects/alovoa`, currently named Pairara. Target: Regovise's canonical `apps/web` + `cloudflare`. Audited 2026-10-11 from local source. The reference remains read-only; no secret contents or live/production operations were used in the audit.

## Authorized October 2026 release update

The user approved and the canonical source now includes the security patch, major toolchain migrations, zero advisory debt, session and one-time sign-in guards, native questionnaire tables with atomic persistence, queue replay integrity, and exact Worker/web artifact promotion. The pre-approval audit history below does not describe the final release status. [Production hardening and limits](../../documentation/engineering/production-hardening.md) and [implementation results](implementation-results.md) are authoritative for the approved work.

## Catalogue index

| Catalogue | Entries | Scope |
| --- | --- | --- |
| [Frontend practices](frontend-practices.md) | FP01–FP38 | Transport/contracts, lifecycle/browser preferences, UI accessibility/quality, action/route evidence and tests. |
| [Backend practices](backend-practices.md) | BR01–BR55 | HTTP/domain/provider seams, identity/security, D1/queues/concurrency, budgets/observation and meaningful runtime tests. |
| [Operations practices](operations-practices.md) | O01–O34 | Command ownership, language/reuse debt, local harnesses, evidence, CI/release/supply-chain and advisory audits. |

These are 127 catalogued entries with overlap, not 127 distinct implemented features. Each audit records source evidence, applicability, target gaps and proposed acceptance. Reference scripts/test files existing does not mean they ran or passed during this audit.

## Applied bounded work

| Practice slice | Actual target change | Evidence currently recorded / limit |
| --- | --- | --- |
| FP01/FP02 and transport subset FP34 | Typed HTTP/protocol errors; body-read-once parser; valid JSON preserved; empty 204/205; no opaque HTML/raw error leak. Existing auth headers/cookies/base/body/public verbs and no-retry behavior preserved. | Frontend subtask recorded 34 credential-free transport/QA-policy tests plus web typecheck and script syntax checks passed. No feature-wide wire validator, live auth/provider or actual database tested by these cases. |
| FP29/FP30 | Responsive QA fails on collected runtime/API/network diagnostics, requires loopback before browser/bootstrap and disables bootstrap redirects. | Synthetic failures and remote-target-before-Playwright rejection tested. Full responsive browser run is a separate integration result, not inferred from policy tests. |
| FP17 cosmetic preference slice | Root-added safe preference read/write/remove and CoachMarksPanel reuse with unchanged keys/values; auth/identity storage untouched. | `npm --prefix apps/web run verify:api-client` passed all 36 cases in the documentation follow-up, including two synthetic unavailable/quota/normal-storage regressions. This tests cosmetic helper behavior, not auth storage or live browser state. |
| BR21 bounded provider-read slice | Request-plus-body deadlines/cancellation for selected native GRC/AWS/SCF reads, preserving caller success/failure/signing semantics and existing AWS retry policy. | Backend subtask recorded 24 isolated helper/signer/native-fixture checks and Worker typecheck passed. No live provider calls; not an overall collection budget or universal provider migration. |
| O29 bounded release safeguards | Deployment/migration wrappers return offline plan before secret/provider/cloud operations; CI cloud-affecting steps exclude explicit dry-run; public metadata/SQL inventory planner. | Operations subtask recorded seven synthetic release/CI-expression tests plus shell/Node syntax checks. No deployment, remote migration, credential verification, schema-history or provider-readiness proof. |
| FP18/FP20/FP24 bounded public questionnaire/navigation work | Matched anonymous questionnaire routes; scoped stale-response handling and truthful submitted header. Mobile drawer uses existing Radix dialog with keyboard trapping, dismissal and focus return. | [Browser verification](ui-verification.md): measured desktop/phone scenarios and canonical questionnaire readback. A subsequent independent review found a pending-save edit race; its fix/regression is included in the final implementation results. No full screen-reader/all-question-type certification. |
| O27–O31 CI/artifact subset | Read-only CI permissions, SHA-pinned actions, finite jobs, no validation credentials, and digest-bound promotion of the tested web build. | Twelve artifact tests plus seven release safeguards. Web bytes are promoted exactly; Worker rebundles at the checked-out SHA with locked dependencies. No GitHub Actions/live deployment was executed here. |
| O32 compatible dependency remediation | Two reviewed lock-only updates inside existing direct ranges; direct names/majors and package manifest dependency maps preserved. | Scratch and canonical compatibility checks; fresh audit reduced 23 to 17 vulnerable-package entries. Eleven high entries remain and keep the separate audit failing. [Approved major migration](web-toolchain-migration.md) supersedes these historical findings. |
| BR49–BR53/O17–O21 local execution subset | Real migration-derived isolated Worker/D1/R2/queue runs, fresh/repeat bootstrap, explicit synthetic provider injection and faithful blocked-provider mode. | Core/GRC/scrutiny/FedRAMP canonical readbacks pass; exact synthetic SCF inputs exercise mapping/report code without establishing genuine mappings. Local smoke assertions now inspect canonical materialized record IDs. |

## Implemented tooling and documentation; aggregate checks remain explicit

Root command metadata, [canonical architecture](../../ARCHITECTURE.md), [developer guide](../../documentation/engineering/developer-guide.md) and [ops owner docs](../../ops/README.md) now describe one verification entry without a workspace/dependency migration.

Current source includes:

- `verify` fast source/reuse/type/build/static-contract/synthetic gates, bounded child time/log/cancellation handling, finishing fingerprint verification and separate `verify:full` local integration mode;
- canonical source-boundary/runtime-JavaScript provenance policy and reviewed exact-function clone ratchet;
- static feature/route/API traceability, labeled as declared source rather than runtime proof;
- unique artifact receipts with revision/selected working-tree fingerprint including ops JSON, runtime pins and root/canonical lockfiles;
- fresh temporary local D1/R2/queue/DO runner with minimal environment, explicit empty env file, blocked outbound Worker fetch and owned cleanup;
- a separate advisory-registry dependency audit with no automatic patch.

The documentation subtask ran `npm run verify:structure`: 281 canonical modules checked, zero failures; 29 new-document links resolved. This is a source-policy/owner-document result, not aggregate runtime proof.

These apply bounded portions of O01/O03/O04/O06/O07/O10/O13/O16–O21/O24/O32 and related frontend testing principles. Matching root execution receipts and final remaining boundaries are recorded in [implementation results](implementation-results.md). The local runner does not perform browser or live-provider verification, and `--keep-state` still terminates its Worker. CI source and local artifact tests are implemented; no actual GitHub Actions/live deployment result is claimed.

## Retained foundations

Keep Regovise's established domain boundaries, typed TypeScript app/Worker source, locked dependency trees, Radix/Regovise primitives, bound SQL, scoped role foundations, D1 metadata/R2 manifests, deterministic evaluations and explicit human reviews, selected job/lease/recovery paths, OIDC/PBKDF2 and existing provider/email/Jira semantics. Retained does not mean every security exception or all domain transitions are correct; the audits identify gaps requiring their own approved tests.

The ATO preview remains a separate synthetic/in-memory UI artifact. Its browser/visual evidence supports design interaction review, not backend persistence, authority or regulatory completion.

## Proposed or protected work

The remaining entries retain their catalogue disposition until a named slice is approved and tested. In particular:

- Auth/session possession, tenant/root administration, grant binding, CORS/security/cache headers, encryption and audit/retention/redaction changes require explicit sensitive scope.
- Universal system/authorization-case/inheritance/decision/obligation contracts, schema/persistence, durable intent/outbox/queue ownership/recovery and clock/budget rules require contract/architecture approval.
- Shared wire codec/endpoint-owner migration, native upload/export behavior and broad cache/lazy-route/refactoring need bounded plans and compatibility proof.
- New testing/query/form/state/theme dependencies or platform/runtime upgrades need approval; existing Node/TypeScript tools cover the implemented slices.
- Production/remote migration/deployment/secret synchronization/live provider validation remains separately authorized. Offline planning cannot establish actual target history/readiness.

The previously proposed security-hardening patch is now applied under the user's explicit approval. Canonical security/session/questionnaire tests replace the scratch candidate proof. The archived local proposals are superseded and are not inputs to release promotion.

An implemented central parser, source inventory or local smoke does not close these requirements by implication. The individual catalogue's current follow-up section is authoritative for that subtask's tested scope.

## Rejected and irrelevant transfers

Reject the reference's cloud-mutating “dry-run” ordering, shared-state/kill-by-port harness mechanics, blanket mutation retries, silent missing-durability/in-progress queue fallbacks, source/toast/route presence presented as working outcomes, and truncated raw-body logs treated as redaction. Do not transplant bearer-token localStorage/URL behavior, deep Worker class inheritance, broad unsafe header policy, or business-specific retention/monetary/cadence defaults.

Dating/matching/social/payment/game/media/native-store/Expo features, brand typography/gradients, unrelated mobile release plumbing and blanket JavaScript/Python rewrites are not Regovise product requirements. Transfer relevant invariants/tests rather than those features.

## Completion and evidence policy

Use the [evidence tiers](../../ops/quality/README.md): source-declared; exact runnable test declared; actual synthetic/local execution; isolated Worker/D1 canonical readback; separately authorized external/production observation. Keep failures, skipped/unexecuted work, stale source identity and configured-provider gates explicit.

Do not state “all best practices fully implemented” from these partial slices or a green root command. Root verification can establish its named checks against a recorded source fingerprint. Broader protected work and every consequential product action still need their specific contract and outcome evidence.
