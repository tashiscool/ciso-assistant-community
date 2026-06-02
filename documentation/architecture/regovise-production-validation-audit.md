# Regovise Production Validation Audit

Date: June 2, 2026

## Scope

This audit records the production validation passes run against `https://regovise.com` across the tenant-facing route groups, builder suite, operations workspaces, evidence and continuous monitoring, assurance and agent workflows, AI/RegML/automation, GRC content engine, and FedRAMP Provider Shell.

The validation strategy was intentionally production-safe:

- Use seeded tenant data for read-only coverage.
- Avoid production mutations unless the flow is explicitly test-owned and cleanup-safe.
- Record findings as production evidence under `.playwright-regovise/`.
- Separate local source fixes from production deployment status.

## Fixed Locally

The audit surfaced several backend contract issues that were fixed locally in source. These changes are not deployed until the Cloudflare Worker is redeployed.

### Assurance package missing-record handling

Production validation found missing package/detail lookups could return server errors instead of clean not-found responses.

Local fix:

- `cloudflare/src/services/assurance/http.ts`
- Missing evidence job IDs now return `400`.
- Missing package jobs now return `404`.
- Missing reconciliation records now return `404`.

Relevant validation evidence:

- `.playwright-regovise/assurance-agent-workflows-batch1-final-1780369196514/summary.json`

### Agent writeback rejection missing-record handling

Production validation found missing writeback rejection could behave like a successful no-op.

Local fix:

- `cloudflare/src/services/agent/http.ts`
- Missing writeback approval requests now return `404`.
- Non-pending writebacks now return `409`.

Relevant validation evidence:

- `.playwright-regovise/assurance-agent-workflows-batch2-rerun-1780369474703/summary.json`

### FedRAMP Trust Center artifact route publication state

Production validation found a Trust Center artifact with `publicationState: working` still advertised a download route. The route returned `404 artifact_not_found`.

Local fix:

- `cloudflare/src/services/fedramp/runtime.ts`
- Artifact summaries now expose a route only when both `status` and `publication_state` are `published`.

Relevant validation evidence:

- `.playwright-regovise/fedramp-provider-shell-batch2-trust-center-artifacts-grants-focused-1780371828401/summary.json`

### FedRAMP action route method guards

Production validation found several action subroutes fell through to collection `GET` responses instead of returning method guards. These were not data corruption issues, but they made action endpoints semantically ambiguous.

Local fix:

- `cloudflare/src/services/fedramp/http.ts`
- Message `queue` and `acknowledge` action routes are checked before the messages list route.
- Incident `queue`, `confirm-fedramp`, `confirm-cisa`, and `confirm-agencies` action routes are checked before the incidents list route.
- VDR report publish action routes are checked before the reports list route.
- CCM OAR and quarterly review publish action routes are checked before collection list routes.
- SCN notice publish action routes now return `405` for non-POST methods.

Relevant validation evidence:

- `.playwright-regovise/fedramp-provider-shell-batch3-communications-focused-1780371917050/summary.json`
- `.playwright-regovise/fedramp-provider-shell-batch4-incidents-focused-1780371991860/summary.json`
- `.playwright-regovise/fedramp-provider-shell-batch5-vdr-focused-1780372068899/summary.json`
- `.playwright-regovise/fedramp-provider-shell-batch6-ccm-focused-1780372161019/summary.json`
- `.playwright-regovise/fedramp-provider-shell-batch7-scn-focused-1780372243761/summary.json`

## Production Status

Most validated route groups passed their focused production checks. The FedRAMP Provider Shell eight-batch audit found one production failure before local fixes:

- Batch 2 failed because a non-published VDR artifact advertised a download route.
- The local runtime fix withholds the route for non-downloadable artifacts.
- Production will continue to show the failure until the fixed Worker is deployed.

The FedRAMP Provider Shell focused batch results were:

- Batch 1 shell overview/public manifest: pass.
- Batch 2 Trust Center artifacts/grants: one production failure, fixed locally.
- Batch 3 communications: pass with production route-order warnings, fixed locally.
- Batch 4 incidents: pass with production route-order warnings, fixed locally.
- Batch 5 VDR: pass with production route-order warning, fixed locally.
- Batch 6 CCM/OAR/quarterly/feedback: pass with production route-order warnings, fixed locally.
- Batch 7 SCN: pass with production non-POST publish warning, fixed locally.
- Batch 8 secure config/scope/crypto/semantic coverage: pass.

## Documentation Status

This document is the audit documentation update for the findings above.

Deployment update:

- Production Worker Version ID: `d387636f-337e-4bfe-8fc7-fc7879c40717`.
- Post-deploy smoke passed through the production deployment pipeline.
- Targeted FedRAMP post-deploy fix validation passed `15/15`.
- Post-deploy validation artifact: `.playwright-regovise/fedramp-provider-shell-postdeploy-fix-validation-1780375045112/summary.json`.
- The FedRAMP artifact route failure is resolved: non-published artifacts no longer advertise download routes.
- The FedRAMP action-route warnings are resolved: message, incident, VDR, CCM, and SCN action `GET` paths now return `405`.

## Verification

Local verification completed after the source fixes:

```bash
npm --prefix cloudflare run typecheck
```

The command passed.

Production deployment verification completed:

```bash
npm --prefix cloudflare run deploy:production:script -- /Users/tkhan/IdeaProjects/alovoa/.env-prod
```

The command passed and deployed Worker Version ID `d387636f-337e-4bfe-8fc7-fc7879c40717`.

## Remaining Work

- Commit and push this post-deploy documentation update.
- Keep `.playwright-regovise/` artifacts ignored as evidence outputs rather than tracked source files.
