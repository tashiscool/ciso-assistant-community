#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=./_prod_env.sh
source "${ROOT_DIR}/scripts/_prod_env.sh"

cf_load_prod_env "${1:-}"
cf_prepare_wrangler_env

CF_ENV="${CLOUDFLARE_WORKER_ENV:-production}"

cf_step "Apply D1 migrations (${CF_ENV})"
cd "${ROOT_DIR}"
npx wrangler d1 migrations apply D1_MAIN --env "${CF_ENV}" --remote
