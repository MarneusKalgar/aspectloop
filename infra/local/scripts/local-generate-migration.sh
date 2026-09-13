#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_local-compose-common.sh"

SERVICE_NAME="${1:-}"
MIGRATION_NAME="${2:-}"

if (($# != 2)); then
  echo "Usage: $0 <platform-service|extraction-service|correction-service> <migration-name>" >&2
  exit 1
fi

case "$SERVICE_NAME" in
  platform-service | extraction-service | correction-service) ;;
  *)
    echo "Unsupported migration owner: $SERVICE_NAME" >&2
    exit 1
    ;;
esac

# Keep generated files inside the datasource discovery directory and reject path input.
if [[ ! "$MIGRATION_NAME" =~ ^[A-Za-z][A-Za-z0-9]*$ ]]; then
  echo "Migration name must start with a letter and contain only letters or digits" >&2
  exit 1
fi

SERVICE_DIRECTORY="$REPOSITORY_ROOT/apps/$SERVICE_NAME"
MIGRATION_DIRECTORY="$SERVICE_DIRECTORY/src/db/migrations"
if [[ ! -d "$MIGRATION_DIRECTORY" ]]; then
  echo "Missing migration directory: $MIGRATION_DIRECTORY" >&2
  exit 1
fi

MIGRATION_PATH="./src/db/migrations/$MIGRATION_NAME"

# Generation is a disposable database tool and shares the accepted six-slot allowance.
generation_pool_size="$TOOL_DB_POOL_SIZE"
if [[ "$SERVICE_NAME" == "platform-service" ]]; then
  generation_pool_size="$PLATFORM_TOOL_DB_POOL_SIZE"
fi
echo "Generating $SERVICE_NAME migration at $MIGRATION_PATH with DB pool cap $generation_pool_size"
if [[ "$SERVICE_NAME" == "platform-service" ]]; then
  "${COMPOSE[@]}" up -d postgres
  "${COMPOSE[@]}" run --rm --no-deps database-provision
  "${COMPOSE[@]}" run --rm --no-deps \
    -e "DB_POOL_SIZE=$generation_pool_size" \
    -w "/app/apps/platform-service" \
    platform-migrator \
    npm run db:generate:local -- "$MIGRATION_PATH"
  exit 0
fi

"${COMPOSE[@]}" exec \
  -e "DB_POOL_SIZE=$TOOL_DB_POOL_SIZE" \
  -w "/app/apps/$SERVICE_NAME" \
  "$SERVICE_NAME" \
  npm run db:generate:local -- "$MIGRATION_PATH"
