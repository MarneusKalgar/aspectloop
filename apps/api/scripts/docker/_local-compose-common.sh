#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_ENV_FILE="$API_DIR/.env.local"

if [[ ! -f "$COMPOSE_ENV_FILE" ]]; then
  echo "Missing compose env file: $COMPOSE_ENV_FILE" >&2
  exit 1
fi

COMPOSE_PROJECT_BASE_NAME="${COMPOSE_PROJECT_NAME:-elemika}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_BASE_NAME}_api_local"
export COMPOSE_PROJECT_NAME

MIGRATE_IMAGE="${COMPOSE_PROJECT_NAME}_migrate_tmp"
SEED_IMAGE="${COMPOSE_PROJECT_NAME}_seed_tmp"

COMPOSE=(
  docker
  compose
  --project-name
  "$COMPOSE_PROJECT_NAME"
  --env-file
  "$COMPOSE_ENV_FILE"
  -f
  "$API_DIR/compose.local.yml"
)

cleanup_local_tool_images() {
  docker rmi "$@" 2>/dev/null || true
}