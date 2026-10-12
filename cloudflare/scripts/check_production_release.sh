#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "${ROOT_DIR}/.." && pwd)"
PLAN_ONLY="${DRY_RUN:-0}"
ENV_FILE_ARG=""
probe_args=()
while (( $# > 0 )); do
  case "$1" in
    --plan|--dry-run) PLAN_ONLY=1; probe_args+=(--plan); shift ;;
    --bootstrap-session|--validate-inputs) probe_args+=("$1"); shift ;;
    --artifact|--commit|--manifest-sha256|--base-url|--report)
      if (( $# < 2 )) || [[ "$2" == --* || -z "$2" ]]; then echo "$1 requires a value" >&2; exit 2; fi
      probe_args+=("$1" "$2"); shift 2 ;;
    --*) echo "Unknown production check argument: $1" >&2; exit 2 ;;
    *)
      if [[ -n "${ENV_FILE_ARG}" ]]; then echo "Only one environment file may be supplied" >&2; exit 2; fi
      ENV_FILE_ARG="$1"; shift ;;
  esac
done
if [[ "${PLAN_ONLY}" == "1" ]]; then
  probe_args+=(--plan)
  exec node "${REPO_DIR}/ops/release/production_probe.mjs" "${probe_args[@]}"
fi
# Existing credential loader is invoked only for an explicitly requested real check.
# No token verification, secret sync, migrations or domain fixture preparation.
source "${ROOT_DIR}/scripts/_prod_env.sh"
cf_load_prod_env "${ENV_FILE_ARG}"
if [[ "${DRY_RUN:-0}" == "1" ]]; then
  echo "Pass --plan/--dry-run before invocation; an environment-file setting is too late for offline planning" >&2; exit 2
fi
exec node "${REPO_DIR}/ops/release/production_probe.mjs" ${probe_args[@]+"${probe_args[@]}"}
