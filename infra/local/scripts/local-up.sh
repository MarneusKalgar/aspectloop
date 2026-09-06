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

UP_ARGS=(up -d)
if [[ "${1:-}" == "--build" ]]; then
  UP_ARGS=(up --build -d)
fi

# Applications remain independent until M04-F adds the first real object-store consumer.
"${COMPOSE[@]}" "${UP_ARGS[@]}"

# The aggregate startup command succeeds only after layered Garage readiness is complete.
"${COMPOSE[@]}" up -d --wait --wait-timeout 90 garage
node "$REPOSITORY_ROOT/infra/local/garage/bootstrap.mjs"
