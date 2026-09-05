#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
GATEWAY_DIR="$REPOSITORY_ROOT/apps/gateway-api"
GATEWAY_ENV_FILE="$GATEWAY_DIR/.env.local"
EXTRACTION_ENV_FILE="$REPOSITORY_ROOT/apps/extraction-service/.env.local"
CORRECTION_ENV_FILE="$REPOSITORY_ROOT/apps/correction-service/.env.local"
INFRA_ENV_FILE="$REPOSITORY_ROOT/infra/local/.env.local"

APP_ENV_FILES=("$GATEWAY_ENV_FILE" "$EXTRACTION_ENV_FILE" "$CORRECTION_ENV_FILE")
for env_file in "${APP_ENV_FILES[@]}" "$INFRA_ENV_FILE"; do
  if [[ ! -f "$env_file" ]]; then
    echo "Missing local env file: $env_file" >&2
    exit 1
  fi
done

# Preserve shell overrides; otherwise read the one numeric tool setting from Compose's env source.
TOOL_DB_POOL_SIZE="${POSTGRES_TOOL_CONNECTION_BUDGET:-}"
if [[ -z "$TOOL_DB_POOL_SIZE" ]]; then
  while IFS='=' read -r key value; do
    if [[ "$key" == "POSTGRES_TOOL_CONNECTION_BUDGET" ]]; then
      TOOL_DB_POOL_SIZE="$value"
    fi
  done < "$INFRA_ENV_FILE"
fi
TOOL_DB_POOL_SIZE="${TOOL_DB_POOL_SIZE:-6}"
if [[ ! "$TOOL_DB_POOL_SIZE" =~ ^[1-9][0-9]*$ ]]; then
  echo "POSTGRES_TOOL_CONNECTION_BUDGET must be a positive integer" >&2
  exit 1
fi

COMPOSE_PROJECT_BASE_NAME="${COMPOSE_PROJECT_NAME:-aspectloop}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_BASE_NAME}_api_local"
export COMPOSE_PROJECT_NAME

COMPOSE=(
  docker
  compose
  --project-name
  "$COMPOSE_PROJECT_NAME"
)
for env_file in "${APP_ENV_FILES[@]}" "$INFRA_ENV_FILE"; do
  COMPOSE+=(--env-file "$env_file")
done
COMPOSE+=(
  -f
  "$REPOSITORY_ROOT/infra/local/compose.local.yml"
  -f
  "$REPOSITORY_ROOT/infra/local/compose.tools.yml"
)
