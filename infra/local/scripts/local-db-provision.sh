#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_local-compose-common.sh"

echo "Provisioning local database roles with project: $COMPOSE_PROJECT_NAME"
"${COMPOSE[@]}" up -d postgres
"${COMPOSE[@]}" run --rm --no-deps database-provision
