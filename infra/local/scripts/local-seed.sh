#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Seed requires the same generated platform key that owns the source bucket.
node "$REPOSITORY_ROOT/infra/local/garage/init-credentials.mjs"
source "$SCRIPT_DIR/_local-compose-common.sh"

# Run each seed as a disposable container capped by its service's validated
# limit and the shared tool allowance.
RUN_ARGS=(run --rm --no-deps)
if [[ "${1:-}" == "--build" ]]; then
  RUN_ARGS=(run --rm --no-deps --build)
fi

echo "Running local seed with project: $COMPOSE_PROJECT_NAME"
# Start both authorities and establish the private bucket before running the seed.
"${COMPOSE[@]}" up -d --wait postgres garage
node "$REPOSITORY_ROOT/infra/local/garage/bootstrap.mjs"

STATUS=0
# Preserve owner order and stop before later databases when one seed command fails.
for service in platform-service extraction-service correction-service; do
  echo "Running seed job: $service"
  service_pool_size="$TOOL_DB_POOL_SIZE"
  if [[ "$service" == "platform-service" ]]; then
    service_pool_size="$PLATFORM_TOOL_DB_POOL_SIZE"
  fi

  if "${COMPOSE[@]}" "${RUN_ARGS[@]}" -e "DB_POOL_SIZE=$service_pool_size" \
    "$service" npm run db:seed:local; then
    continue
  else
    STATUS=$?
    break
  fi
done

exit "$STATUS"
