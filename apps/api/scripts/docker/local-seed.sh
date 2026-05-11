#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_local-compose-common.sh"

RUN_ARGS=(run --rm seed)
if [[ "${1:-}" == "--build" ]]; then
  RUN_ARGS=(run --rm --build seed)
fi

echo "Running local seed with project: $COMPOSE_PROJECT_NAME"

if "${COMPOSE[@]}" "${RUN_ARGS[@]}"; then
  STATUS=0
else
  STATUS=$?
fi

cleanup_local_tool_images "$SEED_IMAGE"

exit "$STATUS"