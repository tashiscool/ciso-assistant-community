# RegScale + Paramify Parity Gap Register

Last updated: 2026-02-26

## Latest execution evidence

1. `PLAYWRIGHT_DEV_SERVER=true pnpm playwright test tests/functional/detailed/business-impact-analysis.test.ts tests/functional/detailed/common.test.ts tests/functional/detailed/findings-assessments.test.ts tests/functional/detailed/mappings.test.ts tests/functional/detailed/settings/general.test.ts tests/functional/detailed/settings/sso.test.ts --project=chromium --workers=1`
Result: `40 passed`, `2 skipped` (SSO SAML/OIDC scenario gates).
2. `PLAYWRIGHT_DEV_SERVER=true pnpm playwright test tests/functional/critical-feature-smoke.test.ts tests/functional/parity-feature-smoke.test.ts --project=chromium --workers=1`
Result: `20 passed`.
3. `PLAYWRIGHT_DEV_SERVER=true pnpm playwright test tests/functional/parity-feature-smoke.test.ts --project=chromium --workers=1`
Result: `13 passed` (no frontend `/api/*` 404 noise after proxy route addition).
4. `poetry run pytest core/bounded_contexts/tests/test_feature_api_contracts.py core/bounded_contexts/tests/test_parity_feature_api_contracts.py -q`
Result: `57 passed`.
5. `python3 scripts/check_feature_coverage.py`
Result: `Feature coverage validation passed for 20 features.`
6. `AWS_STORAGE_BUCKET_NAME=ciso-assistant-bucket AWS_S3_ENDPOINT_URL=http://localhost:9000 AWS_ACCESS_KEY_ID=minioadmin AWS_SECRET_ACCESS_KEY=minioadmin USE_S3=True USE_REDIS=True REDIS_HOST=localhost REDIS_PORT=6379 poetry run python ../scripts/check_runtime_infra.py --require-redis --require-s3`
Result: Redis + MinIO/S3 round-trip checks passed.

## Critical gap status

| Gap ID | Priority | Status | Gap | Evidence / Guardrail |
|---|---|---|---|---|
| `SG-001` | P1 | Closed | Attack-path global fallback could bypass IAM scope | `backend/core/bounded_contexts/security_graph/api/graph_views.py` now uses IAM-scoped folder helper; regression checks in `backend/core/bounded_contexts/tests/test_feature_api_contracts.py` |
| `INF-001` | P1 | Closed | Redis runtime was not explicitly validated in parity checks | `scripts/check_runtime_infra.py --require-redis` |
| `INF-002` | P1 | Closed | MinIO/S3 runtime was not explicitly validated in parity checks | `scripts/check_runtime_infra.py --require-s3` with local MinIO credentials |
| `E2E-000` | P1 | Closed | Local parity Playwright reliability gate was unstable | Local parity and detailed suites are currently green on Chromium |
| `E2E-001` | P1 | Open | Most parity features still have route-smoke checks only (not full journey automation) | Feature-level matrix below |
| `E2E-002` | P2 | Open | Locale-sensitive UI selectors still create EN/FR brittleness in Playwright | FR screenshots still show translation-dependent UI drift in some forms |
| `E2E-003` | P2 | Open | SSO end-to-end auth flow remains environment-gated (`settings/sso.test.ts` skipped when IdP or SSO config path is unavailable) | Last run reported SAML/OIDC scenarios as skipped |
| `UX-001` | P2 | Open | No parity-specific accessibility/keyboard/mobile automation gate | No canonical a11y/mobile suite tied to parity manifest |

## Feature-level test depth

Legend: `Y` = covered, `P` = partial, `N` = missing

| Feature ID | API contract | Route smoke | Workflow E2E | Gap |
|---|---|---|---|---|
| `connectors` | Y | Y | N | Add create/test/save connector journey with auth config validation |
| `scanner_connectors` | Y | Y | N | Add scanner ingestion execution path |
| `sarif_scap_import` | Y | Y | N | Add import file workflow and result assertions |
| `servicenow_jira_integration` | Y | Y | N | Add provider test-connection flow |
| `assessments_lightning` | Y | Y | N | Add create/start/pause/resume/complete flow |
| `version_history` | Y | Y | N | Add snapshots/diff/audit UI action flows |
| `security_graph` | Y | Y | N | Add attack-path and blast-radius user journey assertions |
| `evidence_automation` | Y | Y | N | Add source create/test/sync workflow |
| `workflows` | Y | Y | Y | Keep as baseline journey suite |
| `oscal` | Y | Y | N | Add file-upload validate/import/export journey |
| `continuous_monitoring` | Y | Y | N | Add profile/dashboard data load journey |
| `poam_management` | Y | Y | N | Add POA&M lifecycle and export journey |
| `ai_assistant` | Y | Y | N | Add author/extractor/auditor happy-path with mock-safe fixtures |
| `ai_vendor_scoring` | Y | Y | N | Add scoring submission and summary journey |
| `vendor_questionnaires` | Y | Y | N | Add token issuance + questionnaire submission journey |
| `multi_framework_libraries` | Y | Y | P | Existing library/mapping tests are partial; add explicit parity path |
| `fedramp_automation` | Y | Y | N | Add KSI/OAR/complete export journey |
| `quantitative_risk` | Y | Y | N | Add study creation + analytics execution journey |
| `mapping_engine` | Y | Y | P | Existing `/requirement-mapping-sets` flow is partial vs `/experimental/mapping` |
| `ocsf_oscal_translation` | Y | Y | N | Add OCSF import + OSCAL translation journey |

## Next implementation steps

1. Build P1 workflow E2E tests for `connectors`, `assessments_lightning`, `version_history`, `security_graph`, `evidence_automation`, and `oscal`.
2. Add P1 journey tests for `continuous_monitoring`, `poam_management`, `vendor_questionnaires`, and `fedramp_automation`.
3. Add P1 journey tests for `ai_assistant`, `ai_vendor_scoring`, `quantitative_risk`, and `ocsf_oscal_translation` with deterministic fixtures/mocks.
4. Remove SSO scenario skips by ensuring deterministic local IdP setup and asserting full SAML/OIDC login flow in CI.
5. Standardize FR/EN-safe selectors (role/test-id first, text fallback second) and retrofit parity suites.
6. Add parity a11y/mobile smoke gates (keyboard navigation + viewport checks) and include in canonical run command.
