#!/usr/bin/env bash
set -euo pipefail

CONFIG_FILE="${WRANGLER_CONFIG:-wrangler.edge-api.toml}"
ENVIRONMENT="${WRANGLER_ENV:-}"

run_wrangle() {
  if [[ -n "${ENVIRONMENT}" ]]; then
    npx wrangler d1 execute app_d1_main --config "${CONFIG_FILE}" --env "${ENVIRONMENT}" --file "$1"
  else
    npx wrangler d1 execute app_d1_main --config "${CONFIG_FILE}" --file "$1"
  fi
}

for migration in migrations/*.sql; do
  echo "Applying ${migration} using ${CONFIG_FILE}"
  run_wrangle "${migration}"
done

