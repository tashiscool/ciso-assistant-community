#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=./_prod_env.sh
source "${ROOT_DIR}/scripts/_prod_env.sh"

cf_load_prod_env "${1:-}"
cf_step "Cloudflare token preflight"
cf_prepare_wrangler_env
cf_verify_cloudflare_token
echo "[ok] Environment loaded from ${EDGE_ENV_FILE_LOADED}"
