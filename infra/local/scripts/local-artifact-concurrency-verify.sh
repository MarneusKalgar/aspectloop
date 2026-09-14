#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

if (($# > 1)); then
  echo "Usage: $0 [--build]" >&2
  exit 1
fi

if (($# == 1)) && [[ "$1" != "--build" ]]; then
  echo "Usage: $0 [--build]" >&2
  exit 1
fi

# Keep Platform-local credentials synchronized before the real-Garage race.
node "$REPOSITORY_ROOT/infra/local/garage/init-credentials.mjs"
source "$SCRIPT_DIR/_local-compose-common.sh"

"${COMPOSE[@]}" up -d --wait postgres garage
node "$REPOSITORY_ROOT/infra/local/garage/bootstrap.mjs"

RUN_ARGS=(run --rm --no-deps -e "DB_POOL_SIZE=$PLATFORM_TOOL_DB_POOL_SIZE")
if [[ "${1:-}" == "--build" ]]; then
  RUN_ARGS=(run --rm --no-deps --build -e "DB_POOL_SIZE=$PLATFORM_TOOL_DB_POOL_SIZE")
fi

"${COMPOSE[@]}" "${RUN_ARGS[@]}" platform-service npm run db:artifact:concurrency:verify:local

