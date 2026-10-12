#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PLAN_ONLY="${DRY_RUN:-0}"
MIGRATION_ENV_OVERRIDE=""
ENV_FILE_ARG=""
while (( $# > 0 )); do
  case "$1" in
    --plan|--dry-run) PLAN_ONLY=1; shift ;;
    --env)
      if (( $# < 2 )) || [[ "$2" == --* || -z "$2" ]]; then echo "--env requires a Wrangler environment" >&2; exit 2; fi
      MIGRATION_ENV_OVERRIDE="$2"; shift 2 ;;
    --env=*)
      MIGRATION_ENV_OVERRIDE="${1#--env=}"
      if [[ -z "${MIGRATION_ENV_OVERRIDE}" ]]; then echo "--env requires a Wrangler environment" >&2; exit 2; fi
      shift ;;
    --help)
      echo "Usage: apply_d1_migrations_remote.sh [--plan|--dry-run] [--env NAME] [ENV_FILE]"
      echo "Planning inventories local SQL without loading ENV_FILE or contacting D1."
      exit 0 ;;
    --*) echo "Unknown migration argument: $1" >&2; exit 2 ;;
    *)
      if [[ -n "${ENV_FILE_ARG}" ]]; then echo "Only one environment file may be supplied" >&2; exit 2; fi
      ENV_FILE_ARG="$1"; shift ;;
  esac
done

if [[ "${PLAN_ONLY}" == "1" ]]; then
  exec node "${ROOT_DIR}/scripts/release_plan.mjs" --operation migration --env "${MIGRATION_ENV_OVERRIDE:-${CLOUDFLARE_WORKER_ENV:-production}}"
fi

# shellcheck source=./_prod_env.sh
source "${ROOT_DIR}/scripts/_prod_env.sh"

cf_load_prod_env "${ENV_FILE_ARG}"
if [[ "${DRY_RUN:-0}" == "1" ]]; then
  echo "Set DRY_RUN=1 before invocation or pass --plan/--dry-run; environment-file dry-run settings cannot provide an offline plan." >&2
  exit 2
fi
if [[ -n "${MIGRATION_ENV_OVERRIDE}" ]]; then export CLOUDFLARE_WORKER_ENV="${MIGRATION_ENV_OVERRIDE}"; fi
cf_prepare_wrangler_env

CF_ENV="${CLOUDFLARE_WORKER_ENV:-production}"

cf_step "Apply D1 migrations (${CF_ENV})"
cd "${ROOT_DIR}"
npx wrangler d1 migrations apply D1_MAIN --env "${CF_ENV}" --remote
