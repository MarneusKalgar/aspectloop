#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Accepts only fixed verification actions, never arbitrary Compose arguments.
case "${1:-}" in
  check | stop-platform | restore-platform)
    [[ "$#" -eq 1 ]] || exit 2
    ;;
  create | cleanup)
    [[ "$#" -eq 2 && "$2" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$ ]] || exit 2
    ;;
  *) exit 2 ;;
esac

source "$SCRIPT_DIR/_local-compose-common.sh"

# Never operate a remote Docker daemon through a machine-local verification command.
[[ -z "${DOCKER_HOST:-}" || "${DOCKER_HOST:-}" == unix://* ]] || exit 2
docker_context="${DOCKER_CONTEXT:-$(docker context show)}"
docker_endpoint="$(docker context inspect "$docker_context" --format '{{.Endpoints.docker.Host}}')"
[[ "$docker_endpoint" == unix://* ]] || exit 2

# Requires prepared healthy services; does not start, migrate, seed, or rebuild them.
check_prepared() {
  local service id state
  for service in postgres platform-service gateway-api; do
    id="$("${COMPOSE[@]}" ps -q "$service")"
    [[ -n "$id" ]] || return 1
    state="$(docker inspect --format '{{.State.Status}}/{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$id")"
    [[ "$state" == "running/healthy" ]] || return 1
  done
}

case "$1" in
  check)
    check_prepared
    ;;
  create)
    check_prepared
    "${COMPOSE[@]}" run --rm -T --no-deps --name "${COMPOSE_PROJECT_NAME}-e1-fixture-$2" platform-auth-verify npm run db:auth:http:verify:local -- --fixture-create-stdin "$2"
    ;;
  cleanup)
    # Join termination of this exact owned creation job before deleting its user.
    # This prevents a worker interruption from leaving a late fixture insertion.
    tool_container="${COMPOSE_PROJECT_NAME}-e1-fixture-$2"
    if tool_project="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$tool_container" 2>/dev/null)"; then
      [[ "$tool_project" == "$COMPOSE_PROJECT_NAME" ]] || exit 1
      docker stop --timeout 10 "$tool_container" >/dev/null
    fi
    "${COMPOSE[@]}" run --rm -T --no-deps platform-auth-verify npm run db:auth:http:verify:local -- --fixture-cleanup "$2"
    ;;
  stop-platform)
    [[ "${ASPECTLOOP_E1_ALLOW_OUTAGE:-}" == "1" ]] || exit 2
    check_prepared
    "${COMPOSE[@]}" stop --timeout 10 platform-service
    ;;
  restore-platform)
    [[ "${ASPECTLOOP_E1_ALLOW_OUTAGE:-}" == "1" ]] || exit 2
    "${COMPOSE[@]}" start platform-service
    deadline=$((SECONDS + 45))
    while ((SECONDS < deadline)); do
      if check_prepared; then
        exit 0
      fi
      sleep 1
    done
    exit 1
    ;;
esac
