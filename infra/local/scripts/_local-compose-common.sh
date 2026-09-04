#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
GATEWAY_DIR="$REPOSITORY_ROOT/apps/gateway-api"
GATEWAY_ENV_FILE="$GATEWAY_DIR/.env.local"
INFRA_ENV_FILE="$REPOSITORY_ROOT/infra/local/.env.local"

for env_file in "$GATEWAY_ENV_FILE" "$INFRA_ENV_FILE"; do
  if [[ ! -f "$env_file" ]]; then
    echo "Missing local env file: $env_file" >&2
    exit 1
  fi
done

COMPOSE_PROJECT_BASE_NAME="${COMPOSE_PROJECT_NAME:-aspectloop}"
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
  "$GATEWAY_ENV_FILE"
  --env-file
  "$INFRA_ENV_FILE"
  -f
  "$REPOSITORY_ROOT/infra/local/compose.local.yml"
)

cleanup_local_tool_images() {
  docker rmi "$@" 2>/dev/null || true
}
