# Validated edge release and production probe

The canonical release package contains the compiled Worker runtime, Vite web assets, public Wrangler configuration and local SQL migration inventory. `release_artifact.mjs create` requires an explicit committed HEAD and a clean canonical source/tooling tree. It compares the source fingerprint before and after packaging, uses an owned temporary config and empty env file with a minimal credential-free environment, and runs Wrangler twice: a production dry-run bundle and a `--no-bundle --dry-run` validation whose runtime files must match byte for byte. Wrangler's timestamp README and diagnostic source map are excluded because the current config does not upload them. Source-map uploads, custom build hooks and unsupported local file references fail closed.

The manifest binds the SHA, source fingerprint, every file/directory and transformed public configuration. Promotion requires its independently retained SHA-256. Missing, unexpected, symlinked, unsafe or changed files fail before credentials/provider commands. Deployment/migration copy the verified package into owned scratch, verify that copy, and use its config with an explicit empty env file. Authentication defaults to the explicitly configured API token/account; `--use-existing-wrangler-auth` or `REGOVISE_USE_EXISTING_WRANGLER_AUTH=1` is a deliberate local fallback requiring the known account ID and existing user home context. Only native Wrangler accesses its credential storage; this tool never opens those files. Offline packaging always isolates the user config and ignores this fallback. Cached authentication is rejected in GitHub Actions, and all Wrangler invocations are noninteractive and bounded. Deployment uses `--no-bundle`; it does not rebuild the Worker or UI. Public bindings, custom domains, schedules and Durable Object migrations remain those in the validated source configuration. D1 migration inventory is **not** target history or a compatibility assessment.

The successful deployment receipt includes Wrangler's authoritative `Current Version ID`. Only that UUID, exit status, artifact digest and commit are exposed; arbitrary Wrangler binding/provider output is omitted. A successful exit without one version ID cannot be declared a successful release. Optional migration reports a successful CLI exit, not an independently verified schema state.

Before any migration/deployment, CI and the real deployment shell run `production_probe.mjs --validate-inputs` to validate the artifact, HTTPS origin, authentication mode and required configuration without network requests. Missing configuration fails with variable names only; identity values and secrets are not printed. CI explicitly supplies the trusted existing `regovise` / `admin@regovise.com` identity rather than relying on implicit probe defaults. This presence check does not establish that a configured secret/cookie is accepted by the deployed application.

The canonical CI lanes gate `npm run audit:dependencies` (high/critical findings or audit failure block release) and `npm run verify:full`. Validation receives no production secrets. The production job downloads the same commit package, verifies the digest handed off separately from validation, and serializes promotion. Manual dry-run skips the production job entirely. Secret synchronization and synthetic parity preparation are absent.

## Operator sequence

These commands are for an authorized operator. Local validation and packaging are offline except npm dependency/advisory retrieval; provider preflight, migration listing, promotion and production probing are separately identified below. Do not enable shell tracing, print environment variables or paste credential values into commands. The existing loader sources the operator's configured credential file without printing values; no instructions below inspect its contents.

1. Finish the approved changes, install the committed lockfiles and run `npm run audit:dependencies` and `npm run verify:full`. Resolve failures. Commit the exact source/tooling/lockfiles. Stop editing while generating final evidence. Run the two checks again against the final commit if prior evidence was generated against different bytes.
2. Capture and retain the final commit and artifact receipt. The tool refuses to replace an existing output directory:

   ```sh
   RELEASE_COMMIT="$(git rev-parse HEAD)"
   RELEASE_ARTIFACT_DIR="$(pwd)/target/regovise-release-${RELEASE_COMMIT}"
   node ops/release/release_artifact.mjs create --commit "$RELEASE_COMMIT" --artifact "$RELEASE_ARTIFACT_DIR" > artifacts/verification/release-package.json
   EXPECTED_MANIFEST_SHA256="$(node -e 'const fs=require("node:fs"); process.stdout.write(JSON.parse(fs.readFileSync("artifacts/verification/release-package.json", "utf8")).manifestSha256)')"
   node ops/release/release_artifact.mjs verify --commit "$RELEASE_COMMIT" --artifact "$RELEASE_ARTIFACT_DIR" --manifest-sha256 "$EXPECTED_MANIFEST_SHA256"
   ```

   Keep the manifest digest outside the package. The receipt contains public release metadata only. `create` performs no cloud requests, environment-file reads or release operations.
3. Load credentials only in the authorized operator shell. Public credential helper source can be reviewed without opening an env file. Token/access preflight makes provider read requests and prints token status/ID plus public Worker metadata; it does not print token values. Do not redirect full preflight failures to public artifacts because the legacy helper may include provider error details:

   ```sh
   source cloudflare/scripts/_prod_env.sh
   cf_load_prod_env
   cf_prepare_wrangler_env
   cf_verify_cloudflare_token
   cf_verify_workers_deploy_access ciso-assistant-edge-production
   ```

   If no API token is configured, use the already authenticated native Wrangler context instead of token preflight. Obtain the single intended account ID from `wrangler whoami --json` in the operator's private context (metadata only; do not publish the raw response), export that known `CLOUDFLARE_ACCOUNT_ID`, and explicitly set `REGOVISE_USE_EXISTING_WRANGLER_AUTH=1` or add `--use-existing-wrangler-auth` to promotion/migration. No automatic login is attempted. Native CLI may refresh its existing OAuth token; agent code does not inspect the native credential file.

4. Before requesting migrations, read the target history without applying SQL. **Do not use `wrangler d1 migrations list` for a strictly read-only preflight:** installed Wrangler 4.149.0 initializes its history table before listing. Use the packaged config and an owned empty env file so Wrangler does not load any `.dev.vars` or dotenv file. These explicit SELECT queries are provider metadata reads, not offline commands:

   ```sh
   RELEASE_EMPTY_ENV="$(mktemp -t regovise-release-empty-env)"
   trap 'rm -f "$RELEASE_EMPTY_ENV"' EXIT
   CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=false WRANGLER_SEND_METRICS=false node cloudflare/node_modules/wrangler/bin/wrangler.js d1 execute D1_MAIN --remote --env production --config "$RELEASE_ARTIFACT_DIR/payload/wrangler.toml" --env-file "$RELEASE_EMPTY_ENV" --command "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'd1_migrations';"
   # Run only when the history table exists:
   CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=false WRANGLER_SEND_METRICS=false node cloudflare/node_modules/wrangler/bin/wrangler.js d1 execute D1_MAIN --remote --env production --config "$RELEASE_ARTIFACT_DIR/payload/wrangler.toml" --env-file "$RELEASE_EMPTY_ENV" --command "SELECT name FROM d1_migrations ORDER BY id;"
   # Confirm the configured dead-letter queue exists; this reads queue metadata only:
   CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=false WRANGLER_SEND_METRICS=false node cloudflare/node_modules/wrangler/bin/wrangler.js queues info ciso-assistant-dlq --config "$RELEASE_ARTIFACT_DIR/payload/wrangler.toml" --env-file "$RELEASE_EMPTY_ENV"
   ```

   Compare the applied target names with the committed inventory to identify pending files and review compatibility. If the history table is absent, treat history as uninitialized and review the existing schema separately; do not assume all SQL is safe to apply. Existing queues must be present before deployment; Wrangler rejects missing configured queues. Provision a missing queue only under the explicit approved release scope, then recheck it. If no migrations are pending, omit the apply command. Never infer pending state from the offline inventory alone.
5. Validate the eventual probe inputs before any cloud mutation. Prefer the existing-cookie mode. For explicitly approved bootstrap authentication, pass the known existing admin identity rather than relying on default values (the probe has none):

   ```sh
   # Existing cookie mode:
   node ops/release/production_probe.mjs --validate-inputs --commit "$RELEASE_COMMIT" --artifact "$RELEASE_ARTIFACT_DIR" --manifest-sha256 "$EXPECTED_MANIFEST_SHA256"
   # Alternative: existing configured bootstrap secret and explicitly selected admin:
   REGOVISE_VERIFY_TENANT_SLUG=regovise REGOVISE_VERIFY_EMAIL=admin@regovise.com node ops/release/production_probe.mjs --validate-inputs --bootstrap-session --commit "$RELEASE_COMMIT" --artifact "$RELEASE_ARTIFACT_DIR" --manifest-sha256 "$EXPECTED_MANIFEST_SHA256"
   ```

   Input validation makes no requests and reports no configured identity/cookie/secret values. Missing fields fail with the required variable names. It verifies credential presence/shape, not authentication; the later real probe establishes that separately. Keep planning and credential-input validation as separate invocations.

   Apply only an approved pending migration set, if needed, then promote the exact package. Both use the explicitly selected token/account or cached Wrangler/account mode and print sanitized receipts:

   ```sh
   # Optional, only after the target history/compatibility review:
   node ops/release/release_artifact.mjs migrate --commit "$RELEASE_COMMIT" --artifact "$RELEASE_ARTIFACT_DIR" --manifest-sha256 "$EXPECTED_MANIFEST_SHA256"
   node ops/release/release_artifact.mjs deploy --commit "$RELEASE_COMMIT" --artifact "$RELEASE_ARTIFACT_DIR" --manifest-sha256 "$EXPECTED_MANIFEST_SHA256" > artifacts/verification/production-deploy.json
   ```

   Retain the returned version ID. If deployment reports an error after upload, investigate the actual deployed version instead of blindly repeating an upload. No secrets are rotated or synchronized by these commands.
6. Verify the public deployed asset bytes and a real authenticated session. Prefer an existing `REGOVISE_RELEASE_SESSION_COOKIE` obtained through the approved sign-in path; the tool accepts exactly a `ca_session` cookie and never identity headers. It never prints the cookie or identities:

   ```sh
   node ops/release/production_probe.mjs --commit "$RELEASE_COMMIT" --artifact "$RELEASE_ARTIFACT_DIR" --manifest-sha256 "$EXPECTED_MANIFEST_SHA256" --report artifacts/verification/production-release-probe.json
   ```

   If the approved operator has the existing bootstrap secret and admin identity configured, explicitly add `--bootstrap-session`. This calls **only** the existing-admin session endpoint, then revokes that same session in `finally`, even when an asset/auth check fails. Set `REGOVISE_VERIFY_TENANT_SLUG` and `REGOVISE_VERIFY_EMAIL` to the existing admin identity through the established configuration. It does not initialize a tenant, create a user or seed domain records. A provided existing cookie is left intact. CI explicitly chooses this create-and-revoke authentication mode.

`cloudflare/scripts/check_production_release.sh` provides the same probe using the established local credential loader; `--plan`/`--dry-run` branches before sourcing the helper and before any credential/network effect. `deploy_production.sh` likewise plans before loading credentials; real promotion now requires `--artifact`, `--commit` and `--manifest-sha256` (or corresponding `RELEASE_ARTIFACT_DIR`, `RELEASE_COMMIT`, `EXPECTED_MANIFEST_SHA256`). Migration and bootstrap authentication require explicit invocation flags/environment choices. Legacy `npm --prefix cloudflare run smoke:production` delegates to this narrow probe and requires the same release inputs; it no longer queries domain lists or falls back to demo identity headers.

## Proof limits and tests

The production probe reads core health, anonymous/authenticated session metadata and every packaged public web file. It rejects redirects, non-HTTPS origins, wrong environments, request-header authentication, changed assets and oversized responses. It records no client domain records or provider transactions. Core health may read configured AI/Vectorize runtime status; that request is not independent proof that every provider works. Public UI bytes and a successful cookie session do not establish full browser journeys, external integrations or regulatory readiness. Those claims need their own scoped evidence.

The deployed Worker version ID comes from the successful Wrangler deploy receipt. The HTTP probe verifies web bytes, not remotely downloading/hashing Worker code; the connection between Worker bytes and version relies on verified no-bundle promotion and the authoritative provider receipt. Cloudflare’s supported bundle workflow is documented in [Wrangler bundling](https://developers.cloudflare.com/workers/wrangler/bundling/) and [deploy commands](https://developers.cloudflare.com/workers/wrangler/commands/workers/) (checked 2026-10-12).

Run `node --test ops/release/*.test.mjs cloudflare/scripts/release_plan.test.mjs`. Tests use synthetic temporary files and injected fetch/process runners; they do not call production/providers or read real env files. They cover payload/manifest/commit tampering, exact no-bundle promotion, source freeze, credential-free packaging, public version receipt filtering, cookie-only probing, owned auth-session cleanup, size/redirect/auth/asset failures and CI dry-run guards. The legacy web-only artifact utility remains available for local static packages; canonical CI uses the combined edge release utility.
