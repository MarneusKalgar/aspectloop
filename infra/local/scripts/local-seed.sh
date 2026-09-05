#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_local-compose-common.sh"

RUN_ARGS=(run --rm --no-deps -e "DB_POOL_SIZE=$TOOL_DB_POOL_SIZE")
if [[ "${1:-}" == "--build" ]]; then
  RUN_ARGS=(run --rm --no-deps --build -e "DB_POOL_SIZE=$TOOL_DB_POOL_SIZE")
fi

echo "Running local seed with project: $COMPOSE_PROJECT_NAME"
"${COMPOSE[@]}" up -d --wait postgres

STATUS=0
for service in gateway-api extraction-service correction-service; do
  echo "Running seed job: $service"
  if "${COMPOSE[@]}" "${RUN_ARGS[@]}" "$service" npm run db:seed:local; then
    continue
  else
    STATUS=$?
    break
  fi
done

exit "$STATUS"
