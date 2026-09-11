#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

if (($# > 1)); then
  echo "Usage: $0 [--build]" >&2
  exit 1
fi

if (($# == 1)) && [[ "$1" != "--build" ]]; then
  echo "Usage: $0 [--build]" >&2
  exit 1
fi

# Garage credentials are generated locally once and never written to tracked files.
node "$REPOSITORY_ROOT/infra/local/garage/init-credentials.mjs"
source "$SCRIPT_DIR/_local-compose-common.sh"

UP_ARGS=(up -d --wait --wait-timeout 120)
if [[ "${1:-}" == "--build" ]]; then
  UP_ARGS+=(--build)
fi

# Start and await infrastructure before any application can access Garage.
"${COMPOSE[@]}" "${UP_ARGS[@]}" postgres rabbitmq persistence-mock garage
node "$REPOSITORY_ROOT/infra/local/garage/bootstrap.mjs"

# Start and await the complete default graph only after Garage bootstrap succeeds.
"${COMPOSE[@]}" "${UP_ARGS[@]}"
