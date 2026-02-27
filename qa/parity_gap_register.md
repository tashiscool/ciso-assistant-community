# RegScale + Paramify Parity Gap Register

Last updated: 2026-02-27

## Latest execution evidence

1. `PLAYWRIGHT_DEV_SERVER=true PUBLIC_BACKEND_API_URL=http://127.0.0.1:8000/api pnpm playwright test tests/functional/detailed/parity-p1-connectors-oscal-security-graph.test.ts --project=chromium --workers=1`
Result: `3 passed`.
2. `PLAYWRIGHT_DEV_SERVER=true PUBLIC_BACKEND_API_URL=http://127.0.0.1:8000/api pnpm playwright test tests/functional/detailed/parity-p2-expanded-workflows.test.ts --project=chromium --workers=1`
Result: `16 passed`.
3. `PLAYWRIGHT_DEV_SERVER=true PUBLIC_BACKEND_API_URL=http://127.0.0.1:8000/api pnpm playwright test tests/functional/detailed/ebios-rm.test.ts --project=chromium --workers=1`
Result: `1 passed`.
4. `PLAYWRIGHT_DEV_SERVER=true PUBLIC_BACKEND_API_URL=http://127.0.0.1:8000/api pnpm playwright test tests/functional/critical-feature-smoke.test.ts tests/functional/parity-feature-smoke.test.ts tests/functional/detailed/parity-p1-connectors-oscal-security-graph.test.ts tests/functional/detailed/parity-p2-expanded-workflows.test.ts --project=chromium --workers=1 --reporter=line`
Result: `39 passed`.
5. `PLAYWRIGHT_DEV_SERVER=true pnpm playwright test tests/functional/critical-feature-smoke.test.ts tests/functional/parity-feature-smoke.test.ts --project=chromium --workers=1`
Result: `20 passed`.
6. `poetry run pytest core/bounded_contexts/tests/test_feature_api_contracts.py core/bounded_contexts/tests/test_parity_feature_api_contracts.py -q`
Result: `57 passed`.
7. `python3 scripts/check_feature_coverage.py`
Result: `Feature coverage validation passed for 20 features.`
8. `AWS_STORAGE_BUCKET_NAME=ciso-assistant-bucket AWS_S3_ENDPOINT_URL=http://localhost:9000 AWS_ACCESS_KEY_ID=minioadmin AWS_SECRET_ACCESS_KEY=minioadmin USE_S3=True USE_REDIS=True REDIS_HOST=localhost REDIS_PORT=6379 poetry run python ../scripts/check_runtime_infra.py --require-redis --require-s3`
Result: Redis + MinIO/S3 round-trip checks passed.

## Critical gap status

| Gap ID | Priority | Status | Gap | Evidence / Guardrail |
|---|---|---|---|---|
| `SG-001` | P1 | Closed | Attack-path global fallback could bypass IAM scope | `backend/core/bounded_contexts/security_graph/api/graph_views.py` now uses IAM-scoped folder helper; regression checks in `backend/core/bounded_contexts/tests/test_feature_api_contracts.py` |
| `INF-001` | P1 | Closed | Redis runtime was not explicitly validated in parity checks | `scripts/check_runtime_infra.py --require-redis` |
| `INF-002` | P1 | Closed | MinIO/S3 runtime was not explicitly validated in parity checks | `scripts/check_runtime_infra.py --require-s3` with local MinIO credentials |
| `E2E-000` | P1 | Closed | Local parity Playwright reliability gate was unstable | Local parity and detailed suites are currently green on Chromium |
| `E2E-001` | P1 | Closed | Most parity features had route-smoke checks only (not full journey automation) | `parity-p1-connectors-oscal-security-graph.test.ts` + `parity-p2-expanded-workflows.test.ts` now provide workflow coverage for all parity features |
| `API-001` | P2 | Open | ConMon profile dashboard/detail can return `404` immediately after create/activate in local runs | `frontend/tests/functional/detailed/parity-p2-expanded-workflows.test.ts` guards eventual consistency with conditional assertions |
| `API-002` | P2 | Open | POA&M item creation can return `500` in local runs | `frontend/tests/functional/detailed/parity-p2-expanded-workflows.test.ts` currently verifies fallback list/export path when create fails |
| `API-003` | P2 | Open | Vendor token issuance can return `403` depending auth class/permissions | `frontend/tests/functional/detailed/parity-p2-expanded-workflows.test.ts` asserts non-empty error payload and continues |
| `E2E-002` | P2 | Open | Locale-sensitive UI selectors still create EN/FR brittleness in Playwright | FR screenshots still show translation-dependent UI drift in some forms |
| `E2E-003` | P2 | Open | SSO end-to-end auth flow remains environment-gated (`settings/sso.test.ts` skipped when IdP or SSO config path is unavailable) | Last run reported SAML/OIDC scenarios as skipped |
| `UX-001` | P2 | Open | No parity-specific accessibility/keyboard/mobile automation gate | No canonical a11y/mobile suite tied to parity manifest |

## Feature-level test depth

Legend: `Y` = covered, `Y*` = covered with known backend/env caveat, `P` = partial, `N` = missing

| Feature ID | API contract | Route smoke | Workflow E2E | Gap |
|---|---|---|---|---|
| `connectors` | Y | Y | Y | None |
| `scanner_connectors` | Y | Y | Y | None |
| `sarif_scap_import` | Y | Y | Y | None |
| `servicenow_jira_integration` | Y | Y | Y | None |
| `assessments_lightning` | Y | Y | Y | None |
| `version_history` | Y | Y | Y | None |
| `security_graph` | Y | Y | Y | None |
| `evidence_automation` | Y | Y | Y | None |
| `workflows` | Y | Y | Y | Keep as baseline journey suite |
| `oscal` | Y | Y | Y | None |
| `continuous_monitoring` | Y | Y | Y* | Backend returns `404` in immediate post-create paths in local runs |
| `poam_management` | Y | Y | Y* | Backend can return `500` on create in local runs |
| `ai_assistant` | Y | Y | Y | None |
| `ai_vendor_scoring` | Y | Y | Y | None |
| `vendor_questionnaires` | Y | Y | Y* | Backend can return `403` token create based on permissions |
| `multi_framework_libraries` | Y | Y | Y | None |
| `fedramp_automation` | Y | Y | Y | None |
| `quantitative_risk` | Y | Y | Y | None |
| `mapping_engine` | Y | Y | Y | None |
| `ocsf_oscal_translation` | Y | Y | Y | None |

## Next implementation steps

1. Harden ConMon APIs to make profile activation and immediate dashboard/detail retrieval deterministic (`404` should not occur for fresh valid records).
2. Fix POA&M create path stability so successful create is deterministic and local runs no longer rely on fallback assertions for `500`.
3. Align vendor questionnaire token creation auth expectations (`201` for authorized parity test users) and keep `403` limited to explicit negative tests.
4. Remove SSO scenario skips by ensuring deterministic local IdP setup and asserting full SAML/OIDC login flow in CI.
5. Standardize FR/EN-safe selectors (role/test-id first, text fallback second) and retrofit remaining non-parity detailed suites.
6. Add parity a11y/mobile smoke gates (keyboard navigation + viewport checks) and include in canonical run command.
