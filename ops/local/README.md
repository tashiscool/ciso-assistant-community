# Isolated local Worker verification

`run_worker.mjs` verifies the current product Worker with fresh **local** test bindings, synthetic demo state and a temporary test-only outbound-fetch guard. The default run is finite. An explicit `--serve` session stays open for local browser checks until SIGINT. It never uses normal shared Wrangler persistence or private environment files.

## Prerequisites and commands

From the repository root, install existing locked workspace dependencies and build web assets:

```sh
npm --prefix apps/web ci
npm --prefix cloudflare ci
npm --prefix apps/web run build
npm run verify:local
```

The default suite is `core`. Explicit supported suites are `core`, `grc`, `scrutiny`, `fedramp`:

```sh
npm run verify:local -- --suites=core,grc,scrutiny,fedramp
```

The default GRC lane verifies a named failed SCF refresh with unchanged mapping state, normalized finding fixtures and an unconfigured GitHub collector's explicitly fixture response. The vendored content snapshot contains framework documents, not an SCF crosswalk dataset; this lane records positive mapped-assessment/report assertions as skipped.

Use the explicit artificial SCF transport to exercise the positive persisted GRC queue/mapping/assessment/evidence/report paths:

```sh
npm run verify:local -- --suites=core,grc,scrutiny,fedramp --scf-fixtures
```

`--scf-fixtures` supplies seven exact GET responses for a small summary, three crosswalks and three `TEST-*` controls from `scfFixtureResponses()` in this runner. Their version is `regovise-test-fixture`, and titles state `SYNTHETIC TEST ONLY`. They have no regulatory meaning. They are returned within the scratch Worker wrapper without a provider network request, and carry an `x-regovise-provider-fixture` header. All unknown external paths/methods remain blocked. The GRC script verifies the matching wrapper mode before asserting synthetic results. Its default invocation without fixture flags retains its existing live-provider success requirements.

For fast checks plus all four suites, run `npm run verify:full`. An unknown suite fails before runtime setup. Use `--keep-state` only when local debugging requires the run's scratch files:

```sh
npm run verify:local -- --suites=core --keep-state
```

Retaining state does **not** keep the Worker running. The runner still terminates its owned child process; the preserved scratch path can be recovered from the run logs/configuration. Do not redirect this runner to a production Worker or reuse production identifiers/credentials.

To keep a new isolated Worker available for browser testing after fresh/repeated bootstrap:

```sh
npm run verify:local -- --serve
```

This prints its allocated URL and `ready.json` path, including its own harness/Worker process ids. SIGINT stops only its owned process groups and cleans its scratch files. No shared-port discovery or killing is performed. `--serve` defaults to no suites; optional suites execute first. This interactive session does not claim stable source freshness for its lifetime.

## Actual lifecycle

1. Check that `apps/web/dist/index.html` exists.
2. Allocate a unique verification artifact directory, OS temporary scratch directory and loopback port.
3. Generate a temporary public config with a fake D1 identity, local R2/queue/Durable Object bindings, development origin, email disabled and service delivery disabled. No AI/Vectorize/production routes/cron bindings are configured.
4. Use a minimal child environment and explicit empty env file; disable Wrangler dotenv loading/metrics and use run-owned config/cache/log locations. No private `.dev.vars`/production env contents are loaded.
5. Write a test-only Worker entry that imports current product code and rejects its `globalThis.fetch` requests outside its own origin, except explicitly enabled exact synthetic SCF fixture responses. Native redirect following is disabled. Suite processes have the same own-origin fetch restriction with no external fixtures. This is a Worker-fetch guard, not an OS/network sandbox or certification of live-provider behavior.
6. Apply the repository's ordered migrations with Wrangler `--local` into this run's scratch persistence.
7. Start local Wrangler, wait for the expected core health response, then execute real fresh and repeated demo bootstrap. No manual tenant-insertion workaround is part of this runner.
8. Execute selected existing local smoke scripts against the allocated loopback URL. Suites share this run's synthetic state, so their scope/order and saved readbacks must be considered when interpreting results.
9. Terminate only owned child/process groups, including descendants after a parent exits; flush and sync captured output before completion. Remove owned scratch state unless explicitly retained or cleanup failed, and write the result/log receipt. Shared state is not intentionally touched.

The configuration/readiness/cleanup/fixture boundaries are exercised by synthetic operations tests. Actual local migration/bootstrap/domain outcomes require a completed runtime receipt; merely reading this runner does not establish a pass. Child processes have bounded deadlines (migrations 120 seconds, each suite 180 seconds, finite Worker 900 seconds), and readiness/bootstrap have request deadlines. Graceful group shutdown escalates to forced termination. `--serve` explicitly removes the Worker lifetime limit. This does not establish full browser task coverage.

## Results and failure diagnosis

Artifacts are under `artifacts/verification/local-*/`: `migrations.log`, `worker.log`, `ready.json`, selected suite logs, and `result.json`. The receipt records initial/final source fingerprints, local target, provider mode, synthetic fixture provenance/proof limits, migration/bootstrap/suite outcomes and cleanup. A finite run fails if its source fingerprint changes during execution; an interactive serve session records the change without claiming strict freshness.

Distinguish missing build/tool, migration error, Worker startup/readiness error, fresh bootstrap error, test assertion and cleanup error. Do not treat a mocked provider fallback, queued job or routing-health success as actual external collection or regulatory readiness. Keep relevant redacted local evidence; do not add secrets or real agency/user data to fixtures/logs.

The separate web responsive check expects a running isolated local target and its existing browser dependency. Use the explicit serve session for that target; the finite runner stops its Worker after smoke completion and does not itself orchestrate a combined browser sweep. See [web checks](../../apps/web/README.md) and [quality evidence](../quality/README.md).
