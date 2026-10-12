#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "${ROOT_DIR}/.." && pwd)"
PLAN_ONLY="${DRY_RUN:-0}"
RELEASE_ENV_OVERRIDE=""
ENV_FILE_ARG=""
ARTIFACT_ARG="${RELEASE_ARTIFACT_DIR:-${REPO_DIR}/target/regovise-release-artifact}"
COMMIT_ARG="${RELEASE_COMMIT:-}"
DIGEST_ARG="${EXPECTED_MANIFEST_SHA256:-}"
USE_EXISTING_AUTH="${REGOVISE_USE_EXISTING_WRANGLER_AUTH:-0}"
while (( $# > 0 )); do
  case "$1" in
    --plan|--dry-run) PLAN_ONLY=1; shift ;;
    --use-existing-wrangler-auth) USE_EXISTING_AUTH=1; shift ;;
    --env|--artifact|--commit|--manifest-sha256)
      if (( $# < 2 )) || [[ "$2" == --* || -z "$2" ]]; then echo "$1 requires a value" >&2; exit 2; fi
      case "$1" in
        --env) RELEASE_ENV_OVERRIDE="$2" ;;
        --artifact) ARTIFACT_ARG="$2" ;;
        --commit) COMMIT_ARG="$2" ;;
        --manifest-sha256) DIGEST_ARG="$2" ;;
      esac
      shift 2 ;;
    --env=*)
      RELEASE_ENV_OVERRIDE="${1#--env=}"
      if [[ -z "${RELEASE_ENV_OVERRIDE}" ]]; then echo "--env requires a Wrangler environment" >&2; exit 2; fi
      shift ;;
    --help)
      echo "Usage: deploy_production.sh [--plan|--dry-run] [--env production] [--use-existing-wrangler-auth] --artifact DIR --commit SHA --manifest-sha256 DIGEST [ENV_FILE]"
      echo "Planning loads no credentials. Real deployment promotes a previously validated immutable package."
      exit 0 ;;
    --*) echo "Unknown release argument: $1" >&2; exit 2 ;;
    *)
      if [[ -n "${ENV_FILE_ARG}" ]]; then echo "Only one environment file may be supplied" >&2; exit 2; fi
      ENV_FILE_ARG="$1"; shift ;;
  esac
done

# This branch must precede even sourcing the credential helper.
if [[ "${PLAN_ONLY}" == "1" ]]; then
  plan_args=(--env "${RELEASE_ENV_OVERRIDE:-${CLOUDFLARE_WORKER_ENV:-production}}")
  if [[ "${APPLY_D1_MIGRATIONS:-0}" == "1" ]]; then plan_args+=(--migrations); fi
  if [[ "${RUN_POST_DEPLOY_SMOKE:-1}" == "0" ]]; then plan_args+=(--no-smoke); fi
  exec node "${ROOT_DIR}/scripts/release_plan.mjs" "${plan_args[@]}"
fi

if [[ "${RELEASE_ENV_OVERRIDE:-${CLOUDFLARE_WORKER_ENV:-production}}" != "production" ]]; then
  echo "Validated release promotion supports production only" >&2; exit 2
fi
if [[ -z "${COMMIT_ARG}" || -z "${DIGEST_ARG}" ]]; then
  echo "Real deployment requires the validated commit and independently retained manifest SHA-256" >&2; exit 2
fi
# Reject invalid/tampered packages before loading any private environment file.
node "${REPO_DIR}/ops/release/release_artifact.mjs" verify --artifact "${ARTIFACT_ARG}" --commit "${COMMIT_ARG}" --manifest-sha256 "${DIGEST_ARG}"

CLI_APPLY_D1_MIGRATIONS="${APPLY_D1_MIGRATIONS:-0}"
CLI_RUN_POST_DEPLOY_SMOKE="${RUN_POST_DEPLOY_SMOKE:-1}"
CLI_BOOTSTRAP_SESSION="${RELEASE_PROBE_BOOTSTRAP_SESSION:-0}"
# shellcheck source=./_prod_env.sh
source "${ROOT_DIR}/scripts/_prod_env.sh"
cf_load_prod_env "${ENV_FILE_ARG}"
if [[ "${DRY_RUN:-0}" == "1" ]]; then
  echo "Pass --plan/--dry-run before invocation; an environment-file setting is too late for offline planning" >&2; exit 2
fi
if [[ "${USE_EXISTING_AUTH}" == "1" && -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  cf_require_var CLOUDFLARE_ACCOUNT_ID
  export CLOUDFLARE_ACCOUNT_ID REGOVISE_USE_EXISTING_WRANGLER_AUTH=1
else
  cf_prepare_wrangler_env
fi
export REGOVISE_PROD_BASE_URL="${REGOVISE_PROD_BASE_URL:-https://regovise.com}"

release_args=(--artifact "${ARTIFACT_ARG}" --commit "${COMMIT_ARG}" --manifest-sha256 "${DIGEST_ARG}")
if [[ "${USE_EXISTING_AUTH}" == "1" ]]; then release_args+=(--use-existing-wrangler-auth); fi
if [[ "${CLI_RUN_POST_DEPLOY_SMOKE}" == "1" ]]; then
  probe_args=(--artifact "${ARTIFACT_ARG}" --commit "${COMMIT_ARG}" --manifest-sha256 "${DIGEST_ARG}")
  if [[ "${CLI_BOOTSTRAP_SESSION}" == "1" ]]; then probe_args+=(--bootstrap-session); fi
  node "${REPO_DIR}/ops/release/production_probe.mjs" --validate-inputs "${probe_args[@]}"
fi
if [[ "${CLI_APPLY_D1_MIGRATIONS}" == "1" ]]; then
  node "${REPO_DIR}/ops/release/release_artifact.mjs" migrate "${release_args[@]}"
fi
node "${REPO_DIR}/ops/release/release_artifact.mjs" deploy "${release_args[@]}"
if [[ "${CLI_RUN_POST_DEPLOY_SMOKE}" == "1" ]]; then
  node "${REPO_DIR}/ops/release/production_probe.mjs" "${probe_args[@]}" --report "${REPO_DIR}/artifacts/verification/production-release-probe.json"
fi
# No build, secret synchronization or client data preparation belongs in promotion.
echo "[ok] Validated Regovise release promotion completed"
