#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Generate current password-free service registrations before Compose resolves bind mounts.
node "$REPOSITORY_ROOT/infra/local/pgadmin/prepare.mjs"
source "$SCRIPT_DIR/_local-compose-common.sh"

# Start only the owned database and optional administration UI.
echo "Starting local pgAdmin with project: $COMPOSE_PROJECT_NAME"
"${COMPOSE[@]}" --profile devtools up -d --wait --wait-timeout 120 postgres pgadmin

echo "pgAdmin is healthy. Use the loopback URL and login from infra/local/.env.local."
