## Real Browser E2E

Run against a locally running backend and Playwright runner:

```bash
# backend must be reachable at http://127.0.0.1:8000
export PUBLIC_BACKEND_API_URL=http://127.0.0.1:8000/api
cd frontend
pnpm run test:e2e:parity:local
```

## Canonical E2E suite

Single command entrypoints:

```bash
# local browser runner (no docker)
cd frontend && pnpm run test:e2e:parity:local

# smoke-only local gate
cd frontend && pnpm run test:e2e:parity:smoke:local

# dockerized runner
cd frontend && pnpm run test:e2e:parity
```

## Route journey coverage

Route-level parity smoke coverage:

- `frontend/tests/functional/critical-feature-smoke.test.ts`
- `frontend/tests/functional/parity-feature-smoke.test.ts`

## Workflow journey coverage

Parity workflow journeys:

- `frontend/tests/functional/detailed/parity-p1-connectors-oscal-security-graph.test.ts`
- `frontend/tests/functional/detailed/parity-p2-expanded-workflows.test.ts`

Coverage status:

- `20/20` parity manifest features have tagged workflow E2E coverage.

## API contract and parity manifest validation

```bash
python3 scripts/check_feature_coverage.py
cd backend && poetry run pytest core/bounded_contexts/tests/test_feature_api_contracts.py core/bounded_contexts/tests/test_parity_feature_api_contracts.py -q
```

## Runtime dependency validation

Redis:

```bash
cd backend
USE_REDIS=True REDIS_HOST=localhost REDIS_PORT=6379 poetry run python ../scripts/check_runtime_infra.py --require-redis
```

MinIO/S3:

```bash
cd backend
AWS_STORAGE_BUCKET_NAME=ciso-assistant-bucket \
AWS_S3_ENDPOINT_URL=http://localhost:9000 \
AWS_ACCESS_KEY_ID=minioadmin \
AWS_SECRET_ACCESS_KEY=minioadmin \
USE_S3=True \
poetry run python ../scripts/check_runtime_infra.py --require-s3
```

Combined gate:

```bash
python3 scripts/check_feature_coverage.py
cd backend
AWS_STORAGE_BUCKET_NAME=ciso-assistant-bucket \
AWS_S3_ENDPOINT_URL=http://localhost:9000 \
AWS_ACCESS_KEY_ID=minioadmin \
AWS_SECRET_ACCESS_KEY=minioadmin \
USE_S3=True \
USE_REDIS=True \
REDIS_HOST=localhost \
REDIS_PORT=6379 \
poetry run python ../scripts/check_runtime_infra.py --require-redis --require-s3
poetry run pytest core/bounded_contexts/tests/test_feature_api_contracts.py core/bounded_contexts/tests/test_parity_feature_api_contracts.py -q
cd ../frontend && pnpm run test:e2e:parity:local
```
