#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DROAST_IMAGE="immanuwell/droast:1.4.13"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required to run the Dockerfile policy check." >&2
  exit 1
fi

docker run --rm \
  --volume "$REPOSITORY_ROOT:/workspace:ro" \
  --workdir /workspace \
  "$DROAST_IMAGE" .
