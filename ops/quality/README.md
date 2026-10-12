# Quality policies and canonical gates

The quality lane uses existing Node built-ins and the installed TypeScript compiler. It introduces no replacement runtime/dependency tree.

## Verification modes

`npm run verify` invokes `verify.mjs` and stops on the first nonzero check. Current checks are source policy, reuse ratchet, web/Worker typechecks, web build, IA source contracts, accessibility tokens, Observable import UI, frontend/Worker alignment, GRC fixture schemas, queue-recovery contract, API client regressions, provider deadline regressions, release regressions, web-artifact integrity regressions, operations regressions and static feature traceability.

`npm run verify:full` adds `ops/local/run_worker.mjs --suites=core,grc,scrutiny,fedramp --scf-fixtures` after the fast lane. Exact test-only synthetic SCF responses exercise persisted mapping/report paths; all real outbound provider transport stays blocked. The default GRC local mode separately verifies blocked-provider failure and records dependent success assertions as skipped. Neither mode establishes genuine regulatory mappings. This lane does not implicitly run the responsive browser script, live AWS/provider credentials, production smoke, remote migrations or deployment.

Fast check children have a 180-second budget; the isolated integration check has a 900-second budget. `run_check.mjs` uses argv rather than a shell, minimal child environment, 20 MiB bounded logs, owned process-group termination on timeout/cancellation, and 3-second escalation. These bounds do not imply a universal budget inside every business operation.

Every run gets a unique `artifacts/verification/verify-*/` directory, per-check logs and `result.json`. The receipt records the current commit and a fingerprint of selected canonical source/CSS/JSON, migrations, scripts/workflows, ops MJS/JSON policies, runtime/tool configs and all root/canonical lockfiles. It is not a hash of every legacy file or all documentation. The runner also computes a finishing fingerprint and fails if covered source changed during the run. Changing covered source afterward makes that run historical evidence for the prior fingerprint.

## Source policy

`source_policy.mjs` requires canonical owner documentation and lockfiles, scans `apps/web/src` and `cloudflare/src`, detects direct browser→server or Worker→browser implementation imports, and rejects unclassified runtime JavaScript. Existing `.mjs` tooling and legacy Python/Svelte are outside that canonical runtime language rule.

`source-policy.json` records the canonical/reference roots and a reason/hash for the imported service-delivery runtime exception. A changed hash needs provenance review; removing an exception's file must remove the stale entry. This scanner has selected syntactic patterns, not complete runtime/import/security analysis. Keep the broader architecture boundaries explicit in review.

## Reuse ratchet

`check_reuse.mjs` uses the current TypeScript AST to inspect named function declarations with at least four statements and 250 normalized body characters across canonical TS/TSX source. It reports cross-file body-hash groups against `reuse-baseline.json`.

The reviewed baseline is debt, not an invitation to add copies. New clone groups, expansion to another file/function, missing reasons and stale baseline groups fail. Reduce the baseline when the source is mechanically consolidated. Do not add broad exceptions or redesign domain models merely to silence the check. It does not cover every method/arrow/callback or prove semantic duplication; normalized whitespace can also obscure literal differences.

## Evidence tiers

| Tier | Meaning |
| --- | --- |
| Source-declared | Current route/call/handler/reference is present. No runtime pass inferred. |
| Test-declared | An exact runnable test/selector exists; existence is not execution. |
| Executed synthetic/local | Recorded command and assertions passed against a stated fixture/runtime. |
| Isolated Worker/D1 readback | Actual local runtime transitions and canonical saved results tested in fresh scratch state. |
| External/production observation | Separately authorized configured-provider/deployment observation with its own receipt and source identity. |

A parser test is not whole-wire validation. A shared-handler test is not every click. A route `<500`, static alignment, screenshot or success banner is not persistence/delivery/authorization proof. Root `verify` does not claim all product actions are proven simply because its checks pass.

## Advisory audit

`npm run audit:dependencies` runs `npm audit --json --ignore-scripts` for `apps/web` and `cloudflare`, writes `artifacts/verification/dependency-audit.json` and fails on query errors/missing totals/high or critical findings. It makes advisory-registry requests but performs no install/fix. Review exact package/version/reachability and existing lockfile constraints before any approved dependency patch; a dependency audit is not an application security audit.

## CI web artifact integrity

The current verification/deployment workflows pin Node `22.22.0` and hash-pinned actions. Deployment runs canonical verification, creates an inventory of tested static web assets, then downloads and verifies the same manifest/commit/digests before installing assets for deployment. `ops/release/web_artifact.mjs` rejects altered/missing/extra bytes, symlinks, path traversal, environment-file names and overlapping source/destination trees. Its synthetic regressions are part of `verify`. This secures the web-asset promotion path; it is not proof of a completed CI run, live deployment, provider readiness or remote migration compatibility.
