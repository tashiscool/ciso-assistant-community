#!/usr/bin/env bash

cf_root_dir() {
  cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd
}

cf_resolve_env_file() {
  local root
  root="$(cf_root_dir)"
  local explicit_file="${1:-${ENV_FILE:-}}"
  if [[ -n "${explicit_file}" ]]; then
    printf '%s\n' "${explicit_file}"
    return 0
  fi

  local candidates=(
    "${root}/.env-prod"
    "${root}/.env.production.local"
  )

  local candidate
  for candidate in "${candidates[@]}"; do
    if [[ -f "${candidate}" ]]; then
      printf '%s\n' "${candidate}"
      return 0
    fi
  done

  printf '%s\n' "${root}/.env-prod"
}

cf_env_file_default() {
  cf_resolve_env_file
}

cf_load_prod_env() {
  local env_file
  env_file="$(cf_resolve_env_file "${1:-}")"
  if [[ ! -f "${env_file}" ]]; then
    echo "Missing production env file: ${env_file}" >&2
    return 1
  fi

  local preserved_prod_base_url="${REGOVISE_PROD_BASE_URL-}"

  set -a
  # shellcheck disable=SC1090
  source "${env_file}"
  set +a

  if [[ -n "${preserved_prod_base_url}" && -z "${REGOVISE_PROD_BASE_URL-}" ]]; then
    export REGOVISE_PROD_BASE_URL="${preserved_prod_base_url}"
  fi

  export EDGE_ENV_FILE_LOADED="${env_file}"
}

cf_require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required variable: ${name}" >&2
    return 1
  fi
}

cf_require_cmd() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "Missing required command: ${cmd}" >&2
    return 1
  fi
}

cf_step() {
  local label="$1"
  printf '\n[%s]\n' "${label}"
}

cf_prepare_wrangler_env() {
  cf_require_var CLOUDFLARE_API_TOKEN
  cf_require_var CLOUDFLARE_ACCOUNT_ID
  export CLOUDFLARE_API_TOKEN
  export CLOUDFLARE_ACCOUNT_ID
}

cf_verify_cloudflare_token() {
  cf_require_cmd curl
  cf_require_cmd node
  cf_require_var CLOUDFLARE_API_TOKEN
  cf_require_var CLOUDFLARE_ACCOUNT_ID

  local configured_verify_url="${CLOUDFLARE_TOKEN_VERIFY_URL:-https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/tokens/verify}"
  local fallback_verify_url="https://api.cloudflare.com/client/v4/user/tokens/verify"
  local payload=""

  cf_fetch_token_verify_payload() {
    local verify_url="$1"
    local attempt
    local response=""
    for attempt in 1 2 3; do
      if response="$(curl -sS --fail-with-body "${verify_url}" -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}")"; then
        printf '%s' "${response}"
        return 0
      fi
      sleep 1
    done
    return 1
  }

  if ! payload="$(cf_fetch_token_verify_payload "${configured_verify_url}")"; then
    if [[ "${configured_verify_url}" != "${fallback_verify_url}" ]]; then
      payload="$(cf_fetch_token_verify_payload "${fallback_verify_url}")"
    else
      return 1
    fi
  fi

  printf '%s' "${payload}" | node -e '
let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.success) {
      const errors = Array.isArray(parsed.errors) ? parsed.errors.map((e) => e?.message || JSON.stringify(e)).join("; ") : "unknown error";
      console.error(`Cloudflare token verify failed: ${errors}`);
      process.exit(1);
    }
    const status = String(parsed?.result?.status ?? "unknown");
    const tokenId = String(parsed?.result?.id ?? "n/a");
    if (status.toLowerCase() !== "active") {
      console.error(`Cloudflare token is not active (status=${status}, id=${tokenId})`);
      process.exit(1);
    }
    console.log(`[ok] Cloudflare token verified (status=${status}, id=${tokenId})`);
  } catch (error) {
    console.error(`Unable to parse Cloudflare token verify response: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
});
'
}

cf_verify_workers_deploy_access() {
  cf_require_cmd curl
  cf_require_cmd node
  cf_require_var CLOUDFLARE_API_TOKEN
  cf_require_var CLOUDFLARE_ACCOUNT_ID
  local service_name="${1:-${REGOVISE_WORKER_SERVICE_NAME:-}}"
  if [[ -z "${service_name}" ]]; then
    echo "Missing required worker service name for Workers API preflight." >&2
    return 1
  fi

  local check_url="https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/services/${service_name}"
  local payload
  payload="$(curl -sS "${check_url}" -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}")"

  SERVICE_NAME_FOR_CHECK="${service_name}" printf '%s' "${payload}" | node -e '
let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  try {
    const parsed = JSON.parse(raw);
    if (parsed.success === true) {
      console.log(`[ok] Workers deploy API access confirmed for service=${process.env.SERVICE_NAME_FOR_CHECK}`);
      return;
    }
    const errors = Array.isArray(parsed.errors) ? parsed.errors : [];
    const codeSet = new Set(errors.map((item) => Number(item?.code)));
    const messages = errors.map((item) => item?.message || JSON.stringify(item)).join("; ") || "unknown error";
    if (codeSet.has(10000) || codeSet.has(10001) || codeSet.has(9106)) {
      console.error(`Workers deploy API access denied for service=${process.env.SERVICE_NAME_FOR_CHECK}: ${messages}`);
      process.exit(1);
    }
    if (codeSet.has(1003)) {
      console.log(`[ok] Workers API reachable (service not found yet for ${process.env.SERVICE_NAME_FOR_CHECK})`);
      return;
    }
    console.warn(`[warn] Workers API preflight returned non-success: ${messages}`);
  } catch (error) {
    console.error(`Unable to parse Workers API preflight response: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
});
'
}
