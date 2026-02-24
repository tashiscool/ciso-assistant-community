## Critical feature coverage checks

### Backend/API contract guard

```bash
python3 scripts/check_feature_coverage.py
cd backend && poetry run pytest core/bounded_contexts/tests/test_feature_api_contracts.py -q
```

### Playwright critical smoke (containerized end-to-end)

```bash
cd frontend
pnpm run test:e2e:critical
```

This command boots the backend and runs `tests/functional/critical-feature-smoke.test.ts`.
