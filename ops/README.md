# Regovise verification operations

`ops/` owns root-facing checks and local test orchestration. It composes the canonical React/Worker commands; it does not replace domain services or authorize deployment.

| Directory | Owner/task |
| --- | --- |
| `quality/` | Required source/lockfile/docs policy, exact-clone debt ratchet, canonical verification runner and dependency advisory audit. |
| `audit/` | Static feature/route/API declaration traceability with explicit runtime-proof limits. |
| `local/` | Fresh isolated Worker/D1/R2/queue verification lifecycle. |
| `release/` | Tested web-asset manifest/hash packaging, validation and installation for CI artifact promotion. |
| `lib/` | Repository root/source discovery, hashes, revision and result writing. |
| `test/` | Node built-in synthetic policy/config/fingerprint regressions. |

## Root commands

Run from the repository root after installing existing web/Worker locked dependencies. Node `22.22.0` is pinned in `.nvmrc`, `.node-version` and canonical CI; the root manifest records the accepted Node/npm range:

| Command | Effect / lane |
| --- | --- |
| `npm run verify` | Fail-fast source/reuse/type/build/static-contract/synthetic-test/traceability gates. Writes an artifact receipt and per-check logs. No Worker/browser startup or production operation. |
| `npm run verify:full` | Same fast gates, then isolated local Worker/D1 integration for `core,grc,scrutiny,fedramp`. Builds assets through the fast lane first. |
| `npm run verify:local` | Isolated Worker runner, default `core` suite; requires an existing web build. |
| `npm run verify:structure` | Required authority docs/lockfiles and canonical runtime/source boundary policy. |
| `npm run verify:reuse` | Exact named-function duplicate ratchet against reviewed baseline. |
| `npm run verify:contracts` | Existing frontend/Worker alignment and GRC fixture checks. |
| `npm run test:practices` | Synthetic Node tests for the operations scaffolding. |
| `npm run audit:traceability` | Writes static feature declarations to `artifacts/verification/feature-traceability.json`; runtime status is explicitly unestablished. |
| `npm run audit:dependencies` | Queries npm registry advisories for the two canonical lockfile trees; no automatic fix. This network advisory lane is outside default verification. |
| `npm run verify:release-plan` | Offline public-config/local-SQL release plan; no credential read, cloud mutation or deployment. |

The root package is command metadata, not a new npm workspace. Existing `apps/web` and `cloudflare` lockfiles/dependency trees remain authoritative. No native/mobile app is implied by the sibling reference repository.

## Evidence and artifacts

Verification writes `artifacts/verification/verify-<timestamp>-<id>/result.json` and individual check logs. Local runs write a separate `local-<timestamp>-<id>/` receipt/log directory. Results identify revision, selected source fingerprint, command, duration and exit state. Fast check children have bounded time/log limits and owned cancellation; the final source fingerprint must match the starting fingerprint before the runner reports passed. Failed/skipped/unexecuted work must stay visible; a declared source file is not an executed pass.

These commands are development verification, not regulatory compliance certification or live provider validation. [Quality](quality/README.md), [local runtime](local/README.md), [developer guide](../documentation/engineering/developer-guide.md) and [the reference-practice disposition index](../.codex/alovoa/README.md) describe exact boundaries. Remote/auth/schema/audit changes follow [AGENTS.md](../AGENTS.md) and explicit approval.
