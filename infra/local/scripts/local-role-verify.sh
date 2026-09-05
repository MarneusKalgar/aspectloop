#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_local-compose-common.sh"

echo "Verifying local database ownership with project: $COMPOSE_PROJECT_NAME"
# The verifier is isolated in the tools overlay and removed after every run.
"${COMPOSE[@]}" run --rm role-verify
