# Regovise developer guide

Start with [AGENTS.md](../../AGENTS.md) and [ARCHITECTURE.md](../../ARCHITECTURE.md). The canonical app is `apps/web` plus `cloudflare`; preserve the separately owned Django/Svelte/CLI/reference tracks and existing dirty working-tree changes.

## Prerequisites and first check

Use the checked-in `.nvmrc` / `.node-version` pin, Node `22.22.0`, for CI-matching development. The root manifest allows Node `>=22.12 <25`, npm `>=10 <12`, with npm `11.6.2` as package-manager metadata. Use the existing canonical lockfiles rather than updating runtime/library versions as part of an unrelated patch. The root package composes commands and does not create a new npm workspace.

From the repository root:

```sh
npm --prefix apps/web ci
npm --prefix cloudflare ci
npm run verify
```

The default lane typechecks/builds and runs static/synthetic checks; it writes a unique receipt/log directory. It does not start the Worker/browser or run production scripts. A failed check has its named log in `artifacts/verification/verify-*/`.

For actual isolated local Worker/D1 tests:

```sh
npm run verify:full
```

This adds fresh local migrations, bootstrap/repeated-bootstrap and the four selected smoke suites with scratch bindings and blocked outbound Worker HTTP. Exact artificial SCF fixtures exercise mapping/report persistence and are explicitly recorded as synthetic. See [the local runner contract](../../ops/local/README.md) before interpreting its result. A local pass does not validate genuine mappings, live provider credentials, remote schema/history or a production deployment.

## Select a bounded slice

Before non-trivial edits, identify user task, relevant current files, proposed behavior, risks, acceptance criteria and appropriate tests. Follow current feature/domain boundaries. Inspect discovered package scripts before running commands. Avoid broad changes to dependencies, APIs, schema/persistence or architecture without approval; authentication/access/audit/encryption/secret-sensitive changes require explicit scoped authorization.

| Work | Likely owner | Meaningful proof |
| --- | --- | --- |
| Screen/form/state | Existing feature page, PagePrimitives and established Radix controls | Actual task and error/empty/keyboard/mobile/saved-result behavior. |
| JSON transport | `apps/web/src/shared/api/` | Fake-fetch response/method/body/header/error tests; existing domain shape preserved. |
| Domain route | `cloudflare/src/services/<domain>/` | Current request/status/permission/side-effect contract and canonical readback. |
| Provider reliability | Existing collector/helper + `utils/providerRequest.ts` when applicable | Stub-only success/failure/abort/hung-body tests, unchanged request/signing and result shape. |
| Schema/state transition | Existing migration/service/queue owner | Approved data/rollout/rollback contract and isolated runtime transition/negative/replay tests. |
| Tooling | Existing workspace script or root `ops/` owner | Synthetic failure/safety tests; correct scope and nonzero failure result. |
| Deployment | Existing approved release workflow | Offline plan first; separately authorized credential/cloud/migration/deployment operations and receipts. |

Reuse established code where semantics match. Exact clone ratchets are maintenance evidence, not permission to merge core manual assessments with GRC gap runs or deterministic evaluation with human sufficiency decisions. A route alias can preserve an address without implementing an old export/visual/editor action.

## UI workflow discipline

Use the current source/screen and approved visual target. Preserve routes/query context, record IDs and permissions. Keep scope visible, drafts unsaved until server-confirmed, and queued/running/failed/completed outcomes distinct. Handle failed/partial/missing-source states without fake green metrics. Never claim an official authorization from tasks, an RMF handoff or a generated package.

Use semantic controls, proper keyboard/modal focus, actionable field/error messages and internally contained table scrolling. Test desktop and mobile tasks beyond build success. The [ATO preview](../../apps/web/prototypes/ato-workspace/README.md) is a separate synthetic UI artifact; its in-memory outcomes are not product/API persistence.

## Check selection

| Command | Use |
| --- | --- |
| `npm run verify` | Normal final canonical source/type/build/contract/synthetic gate. |
| `npm run verify:full` | Runtime/storage-sensitive slice needing the current isolated smoke suite. |
| `npm run verify:structure`, `npm run verify:reuse` | Required owner boundaries/exception hashes and reviewed clone-debt ratchets. |
| `npm --prefix apps/web run verify:api-client` | Central transport and responsive-QA policy regressions; no actual auth/provider/database. |
| `npm --prefix cloudflare run verify:provider-requests` | Selected provider deadline/fixture contracts; no live network credentials. |
| `npm --prefix cloudflare run test:release-plan` | Synthetic offline-plan/cloud-effect safeguards. |
| `npm --prefix apps/web run verify:responsive` | Separately prepared loopback browser target; meaningful layout/navigation/runtime diagnostics, local bootstrap side effects. |
| `npm run audit:traceability` | Static feature/route/API declarations, explicitly not runtime proof. |
| `npm run audit:dependencies` | Network advisory query for existing locked canonical trees; no automatic patch. |
| `npm run verify:release-plan` | Offline public-metadata/local-SQL inventory plan; no remote operations. |

Run the relevant checks, explain failures and stop broadening once the bounded slice is proven. Don't rerun unrelated expensive suites just to inflate evidence. Test declarations, source assertions, actual local executions, saved runtime readbacks and external observations should be reported separately.

## Source/reuse policy and generated artifacts

Canonical runtime language/boundary exceptions live in `ops/quality/source-policy.json`. The imported service-delivery runtime has a provenance/hash-bound exception; don't hand-edit that bundle to pass a new rule. Reviewed existing exact-function groups live in `reuse-baseline.json`; new/expanded/stale groups fail. Tooling-generated outputs belong in explicit artifact directories, not disguised source edits.

Result identity combines commit and selected working-tree source fingerprint, including ops JSON policy, runtime pins and root/canonical lockfiles. The runner checks it again before passing; a changed fingerprint fails the run. Child check deadlines/cancellation and bounded logs are recorded. Use a receipt for the actual source tested; a previous pass is historical after covered code/config/migrations change. Logs/screenshots/fixtures must not contain secrets or real regulatory/user data. Keep retention/data handling choices explicit rather than copying a dating product's defaults.

## Release and protected work

The offline release planner reads public Wrangler metadata and local SQL hashes. It does not know pending remote migrations or provider/credential readiness and executes no checks/builds/secret loading/cloud actions. Real deploy/migrate/secret-sync/production-smoke commands remain separately authorized. Never treat `--dry-run` on an inner tool as proof that its wrapper performed no earlier effect; use the wrapper's explicit offline plan.

Do not open secret/env files or print environment contents. Do not use production endpoints while diagnosing ordinary local changes. Preserve existing auth/session/cookie/access behavior unless the requested sensitive slice explicitly approves changing it.

The [Alovoa/Pairara disposition index](../../.codex/alovoa/README.md) separates applied reliability/tooling, retained Regovise foundations, proposed protected work and rejected/irrelevant patterns. It is a practice catalogue, not a claim that every best practice or regulatory obligation is complete.
