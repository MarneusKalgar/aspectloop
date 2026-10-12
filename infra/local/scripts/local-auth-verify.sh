#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Prints fixed M04.2 modes and the fail-fast sessions -> HTTP -> email aggregate.
usage() {
  echo "Usage: $0 [--sessions | --http | --email | --registration | --mail | --mail-outage | --fixture-create | --fixture-cleanup UUID] [--build]"
  echo "No mode runs sessions -> HTTP -> email; requested modes fail if prerequisites are unavailable."
}

MODE=""
FIXTURE_ID=""
BUILD=false
while [[ "$#" -gt 0 ]]; do
  argument="$1"
  case "$argument" in
    --sessions)
      if [[ -n "$MODE" ]]; then usage >&2; exit 2; fi
      MODE="sessions"
      ;;
    --http | --email)
      if [[ -n "$MODE" ]]; then usage >&2; exit 2; fi
      MODE="${argument#--}"
      ;;
    --registration)
      if [[ -n "$MODE" ]]; then usage >&2; exit 2; fi
      MODE="registration"
      ;;
    --mail | --mail-outage)
      if [[ -n "$MODE" ]]; then usage >&2; exit 2; fi
      MODE="${argument#--}"
      ;;
    --fixture-create)
      if [[ -n "$MODE" ]]; then usage >&2; exit 2; fi
      MODE="fixture-create"
      ;;
    --fixture-cleanup)
      if [[ -n "$MODE" ]]; then usage >&2; exit 2; fi
      if [[ "$#" -lt 2 ]]; then usage >&2; exit 2; fi
      MODE="fixture-cleanup"
      shift
      FIXTURE_ID="$1"
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
  shift
done

if [[ -z "$MODE" ]]; then
  MODE="aggregate"
fi

if [[ "$MODE" == "fixture-cleanup" && ! "$FIXTURE_ID" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$ ]]; then
  usage >&2
  exit 2
fi

source "$SCRIPT_DIR/_local-compose-common.sh"

"${COMPOSE[@]}" up -d --wait postgres

RUN_ARGS=(run --rm --no-deps)
if [[ "$BUILD" == "true" ]]; then
  RUN_ARGS=(run --rm --no-deps --build)
fi

case "$MODE" in
  aggregate)
    "${COMPOSE[@]}" "${RUN_ARGS[@]}" platform-auth-verify
    "${COMPOSE[@]}" "${RUN_ARGS[@]}" platform-auth-verify npm run db:auth:http:verify:local -- --http
    "${COMPOSE[@]}" "${RUN_ARGS[@]}" platform-auth-verify npm run db:auth:http:verify:local -- --email
    ;;
  sessions)
    "${COMPOSE[@]}" "${RUN_ARGS[@]}" platform-auth-verify
    ;;
  http | email)
    "${COMPOSE[@]}" "${RUN_ARGS[@]}" platform-auth-verify npm run db:auth:http:verify:local -- "--$MODE"
    ;;
  registration)
    # The prepared runner fails if capture is unavailable; it never starts Mailpit implicitly.
    "${COMPOSE[@]}" "${RUN_ARGS[@]}" platform-auth-verify npm run db:auth:registration:verify:local
    ;;
  mail | mail-outage)
    # Capture absence fails --mail. This tool never starts or stops Mailpit implicitly.
    "${COMPOSE[@]}" "${RUN_ARGS[@]}" platform-auth-verify npm run db:auth:http:verify:local -- "--$MODE"
    ;;
  fixture-create)
    "${COMPOSE[@]}" "${RUN_ARGS[@]}" platform-auth-verify npm run db:auth:http:verify:local -- --fixture-create
    ;;
  fixture-cleanup)
    "${COMPOSE[@]}" "${RUN_ARGS[@]}" platform-auth-verify npm run db:auth:http:verify:local -- --fixture-cleanup "$FIXTURE_ID"
    ;;
esac
