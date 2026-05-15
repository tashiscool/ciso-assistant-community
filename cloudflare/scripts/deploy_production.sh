#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$(cd "${ROOT_DIR}/../apps/web" && pwd)"

# shellcheck source=./_prod_env.sh
source "${ROOT_DIR}/scripts/_prod_env.sh"

CLI_RUN_PREDEPLOY_TESTS="${RUN_PREDEPLOY_TESTS-}"
CLI_APPLY_D1_MIGRATIONS="${APPLY_D1_MIGRATIONS-}"
CLI_RUN_POST_DEPLOY_SMOKE="${RUN_POST_DEPLOY_SMOKE-}"
CLI_RUN_SECRET_SYNC="${RUN_SECRET_SYNC-}"
CLI_DRY_RUN="${DRY_RUN-}"
CLI_CLOUDFLARE_WORKER_ENV="${CLOUDFLARE_WORKER_ENV-}"

cf_load_prod_env "${1:-}"

if [[ -z "${BOOTSTRAP_SETUP_SECRET-}" && -f "${ROOT_DIR}/.env-prod" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/.env-prod"
  set +a
fi

cf_prepare_wrangler_env
cf_verify_cloudflare_token

RUN_PREDEPLOY_TESTS="${CLI_RUN_PREDEPLOY_TESTS:-${RUN_PREDEPLOY_TESTS:-1}}"
APPLY_D1_MIGRATIONS="${CLI_APPLY_D1_MIGRATIONS:-${APPLY_D1_MIGRATIONS:-0}}"
RUN_POST_DEPLOY_SMOKE="${CLI_RUN_POST_DEPLOY_SMOKE:-${RUN_POST_DEPLOY_SMOKE:-1}}"
RUN_SECRET_SYNC="${CLI_RUN_SECRET_SYNC:-${RUN_SECRET_SYNC:-1}}"
DRY_RUN="${CLI_DRY_RUN:-${DRY_RUN:-0}}"
CLOUDFLARE_WORKER_ENV="${CLI_CLOUDFLARE_WORKER_ENV:-${CLOUDFLARE_WORKER_ENV:-production}}"
REGOVISE_WORKER_SERVICE_NAME="${REGOVISE_WORKER_SERVICE_NAME:-ciso-assistant-edge-production}"
export REGOVISE_WORKER_SERVICE_NAME

cf_step "Cloudflare Workers deploy access preflight"
cf_verify_workers_deploy_access

if [[ "${RUN_PREDEPLOY_TESTS}" == "1" ]]; then
  cf_step "Predeploy checks"
  npm --prefix "${WEB_DIR}" run typecheck
  npm --prefix "${WEB_DIR}" run build
  npm --prefix "${ROOT_DIR}" run typecheck
  npx wrangler deploy --dry-run --env "${CLOUDFLARE_WORKER_ENV}"
fi

if [[ "${APPLY_D1_MIGRATIONS}" == "1" ]]; then
  cf_step "D1 migration apply"
  bash "${ROOT_DIR}/scripts/apply_d1_migrations_remote.sh" "${EDGE_ENV_FILE_LOADED}"
else
  echo "[skip] APPLY_D1_MIGRATIONS=0"
fi

if [[ "${RUN_SECRET_SYNC}" == "1" ]]; then
  if [[ -n "${MAILCHANNELS_API_KEY:-}" ]]; then
    cf_step "Sync Mailchannels secret"
    if [[ "${DRY_RUN}" == "1" ]]; then
      echo "[dry-run] printf '%s' \"\$MAILCHANNELS_API_KEY\" | npx wrangler secret put MAILCHANNELS_API_KEY --env ${CLOUDFLARE_WORKER_ENV}"
    else
      cd "${ROOT_DIR}"
      printf '%s' "${MAILCHANNELS_API_KEY}" | npx wrangler secret put MAILCHANNELS_API_KEY --env "${CLOUDFLARE_WORKER_ENV}"
    fi
  else
    echo "[skip] MAILCHANNELS_API_KEY is not set"
  fi

  if [[ -n "${EMAIL_WEBHOOK_BEARER_TOKEN:-}" ]]; then
    cf_step "Sync email webhook bearer secret"
    if [[ "${DRY_RUN}" == "1" ]]; then
      echo "[dry-run] printf '%s' \"\$EMAIL_WEBHOOK_BEARER_TOKEN\" | npx wrangler secret put EMAIL_WEBHOOK_BEARER_TOKEN --env ${CLOUDFLARE_WORKER_ENV}"
    else
      cd "${ROOT_DIR}"
      printf '%s' "${EMAIL_WEBHOOK_BEARER_TOKEN}" | npx wrangler secret put EMAIL_WEBHOOK_BEARER_TOKEN --env "${CLOUDFLARE_WORKER_ENV}"
    fi
  else
    echo "[skip] EMAIL_WEBHOOK_BEARER_TOKEN is not set"
  fi

  if [[ -n "${BOOTSTRAP_SETUP_SECRET:-}" ]]; then
    cf_step "Sync bootstrap setup secret"
    if [[ "${DRY_RUN}" == "1" ]]; then
      echo "[dry-run] printf '%s' \"\$BOOTSTRAP_SETUP_SECRET\" | npx wrangler secret put BOOTSTRAP_SETUP_SECRET --env ${CLOUDFLARE_WORKER_ENV}"
    else
      cd "${ROOT_DIR}"
      printf '%s' "${BOOTSTRAP_SETUP_SECRET}" | npx wrangler secret put BOOTSTRAP_SETUP_SECRET --env "${CLOUDFLARE_WORKER_ENV}"
    fi
  else
    echo "[skip] BOOTSTRAP_SETUP_SECRET is not set"
  fi
else
  echo "[skip] RUN_SECRET_SYNC=0"
fi

cf_step "Worker deploy"
if [[ "${DRY_RUN}" == "1" ]]; then
  echo "[dry-run] npx wrangler deploy --env ${CLOUDFLARE_WORKER_ENV}"
else
  cd "${ROOT_DIR}"
  npx wrangler deploy --env "${CLOUDFLARE_WORKER_ENV}"
fi

if [[ "${RUN_POST_DEPLOY_SMOKE}" == "1" ]]; then
  cf_step "Post-deploy smoke + latency"
  cf_require_var REGOVISE_PROD_BASE_URL
  if [[ "${DRY_RUN}" == "1" ]]; then
    echo "[dry-run] node ${ROOT_DIR}/scripts/prod_smoke.mjs ${REGOVISE_PROD_BASE_URL}"
  else
    node "${ROOT_DIR}/scripts/prod_smoke.mjs" "${REGOVISE_PROD_BASE_URL}"
  fi
else
  echo "[skip] RUN_POST_DEPLOY_SMOKE=0"
fi

echo
echo "[ok] Regovise production deployment pipeline completed"
