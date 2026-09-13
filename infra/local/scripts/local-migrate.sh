#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_local-compose-common.sh"

# Run each migration as a disposable container capped by the shared tool allowance.
RUN_ARGS=(run --rm --no-deps)
if [[ "${1:-}" == "--build" ]]; then
  RUN_ARGS=(run --rm --no-deps --build)
fi

echo "Running local migrations with project: $COMPOSE_PROJECT_NAME"
# Start only PostgreSQL, then reconcile owner/runtime roles before any migration.
"${COMPOSE[@]}" up -d postgres
"${COMPOSE[@]}" run --rm --no-deps database-provision

STATUS=0
# Preserve owner order and stop before later databases when one migration command fails.
for service in platform-migrator extraction-service correction-service; do
  echo "Running migration job: $service"
  service_pool_size="$TOOL_DB_POOL_SIZE"
  if [[ "$service" == "platform-migrator" ]]; then
    service_pool_size="$PLATFORM_TOOL_DB_POOL_SIZE"
  fi

  if "${COMPOSE[@]}" "${RUN_ARGS[@]}" -e "DB_POOL_SIZE=$service_pool_size" \
    "$service" npm run db:migrate:local; then
    continue
  else
    STATUS=$?
    break
  fi
done

# New tables are owner-created, so reconcile explicit runtime grants afterward.
if ((STATUS == 0)); then
  "${COMPOSE[@]}" run --rm --no-deps database-provision
fi

exit "$STATUS"
