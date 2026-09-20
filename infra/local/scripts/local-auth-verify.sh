#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Prints the intentionally narrow M04.2-B verification surface.
usage() {
  echo "Usage: $0 --sessions [--build]"
}

SESSIONS=false
BUILD=false
for argument in "$@"; do
  case "$argument" in
    --sessions)
      SESSIONS=true
      ;;
    --build)
      BUILD=true
      ;;
    --help | -h)
      usage
      exit 0
      ;;
    *)
      usage >&2
      exit 2
      ;;
  esac
done

if [[ "$SESSIONS" != "true" ]]; then
  usage >&2
  exit 2
fi

source "$SCRIPT_DIR/_local-compose-common.sh"

"${COMPOSE[@]}" up -d --wait postgres

RUN_ARGS=(run --rm --no-deps)
if [[ "$BUILD" == "true" ]]; then
  RUN_ARGS=(run --rm --no-deps --build)
fi

"${COMPOSE[@]}" "${RUN_ARGS[@]}" platform-auth-verify
