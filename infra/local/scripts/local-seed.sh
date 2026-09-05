#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_local-compose-common.sh"

# Run each seed as a disposable container capped by the shared tool allowance.
RUN_ARGS=(run --rm --no-deps -e "DB_POOL_SIZE=$TOOL_DB_POOL_SIZE")
if [[ "${1:-}" == "--build" ]]; then
  RUN_ARGS=(run --rm --no-deps --build -e "DB_POOL_SIZE=$TOOL_DB_POOL_SIZE")
fi

echo "Running local seed with project: $COMPOSE_PROJECT_NAME"
# Start only PostgreSQL; --no-deps prevents runtime-only dependencies from joining tool jobs.
"${COMPOSE[@]}" up -d --wait postgres

STATUS=0
# Preserve owner order and stop before later databases when one seed command fails.
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
