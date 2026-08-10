#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_local-compose-common.sh"

RUN_ARGS=(run --rm migrate)
if [[ "${1:-}" == "--build" ]]; then
  RUN_ARGS=(run --rm --build migrate)
fi

echo "Running local migrations with project: $COMPOSE_PROJECT_NAME"

if "${COMPOSE[@]}" "${RUN_ARGS[@]}"; then
  STATUS=0
else
  STATUS=$?
fi

cleanup_local_tool_images "$MIGRATE_IMAGE"

exit "$STATUS"