#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Initialize only absent template credentials before Compose resolves its environment.
node "$REPOSITORY_ROOT/infra/local/garage/init-credentials.mjs"
source "$SCRIPT_DIR/_local-compose-common.sh"

# Native CLI health precedes layout changes; authenticated S3 readiness follows them.
"${COMPOSE[@]}" up -d --wait --wait-timeout 90 garage
node "$REPOSITORY_ROOT/infra/local/garage/bootstrap.mjs"
