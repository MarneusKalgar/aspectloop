#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

if (($# > 1)); then
  echo "Usage: $0 [--volumes]" >&2
  exit 1
fi

if (($# == 1)) && [[ "$1" != "--volumes" ]]; then
  echo "Usage: $0 [--volumes]" >&2
  exit 1
fi

# Ensure upgraded checkouts can resolve required Garage configuration before teardown.
node "$REPOSITORY_ROOT/infra/local/garage/init-credentials.mjs"
source "$SCRIPT_DIR/_local-compose-common.sh"

DOWN_ARGS=(down --remove-orphans)
if [[ "${1:-}" == "--volumes" ]]; then
  DOWN_ARGS=(down --volumes --remove-orphans)
fi
"${COMPOSE[@]}" "${DOWN_ARGS[@]}"
