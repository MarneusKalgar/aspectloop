#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
PROJECT_BASE_NAME="${COMPOSE_PROJECT_NAME:-aspectloop}"

INTEGRATION=false
FRESH=false
OUTAGE=false

usage() {
  echo "Usage: $0 [--integration] [--fresh] [--outage]"
  echo "  default        Check the existing stack, gateway probes, and database roles."
  echo "  --integration  Also verify seeded artifacts, TypeORM, and concurrency; writes fixtures."
  echo "  --fresh        Reset local volumes, rebuild, migrate, and seed twice; implies --integration."
  echo "  --outage       Stop Platform temporarily, verify gateway failure, and restore it."
}

for argument in "$@"; do
  case "$argument" in
    --integration)
      INTEGRATION=true
      ;;
    --fresh)
      FRESH=true
      INTEGRATION=true
      ;;
    --outage)
      OUTAGE=true
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

source "$SCRIPT_DIR/_local-compose-common.sh"

step() {
  printf '\n==> %s\n' "$1"
}

# Child npm commands source the common helper again. Pass the original base so
# they do not append _api_local to an already-suffixed project name.
run_local_command() {
  (
    cd "$REPOSITORY_ROOT"
    COMPOSE_PROJECT_NAME="$PROJECT_BASE_NAME" npm run "$@"
  )
}

# The local Compose file gives every default runtime service a healthcheck.
check_stack_health() {
  local service health

  for service in \
    postgres rabbitmq persistence-mock garage platform-service gateway-api \
    extraction-service correction-service; do
    health="$(docker inspect --format '{{if .State.Running}}{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}{{else}}stopped{{end}}' \
      "$COMPOSE_PROJECT_NAME-$service")"
    printf '%s: %s\n' "$service" "$health"
    if [[ "$health" != "healthy" ]]; then
      echo "Local service is not healthy: $service" >&2
      return 1
    fi
  done
}

# Probe from inside the gateway so custom host port mappings need no parsing.
# The container's last health result may briefly outlive the Nest child process.
check_gateway() {
  local expected_readiness="$1" result deadline
  deadline=$((SECONDS + 60))

  while true; do
    if result="$("${COMPOSE[@]}" exec -T gateway-api node --input-type=module -e '
    const expected = process.argv[1];
    const base = `http://127.0.0.1:${process.env.API_PORT ?? "8080"}`;
    const liveness = await fetch(`${base}/health`, { signal: AbortSignal.timeout(7000) });
    const liveBody = await liveness.json();
    if (liveness.status !== 200 || liveBody.service !== "gateway-api" || liveBody.status !== "ok") {
      throw new Error("Gateway liveness failed");
    }
    const readiness = await fetch(`${base}/health/readiness`, { signal: AbortSignal.timeout(7000) });
    const readyBody = await readiness.json();
    if (expected === "ready") {
      if (readiness.status !== 200 || readyBody.service !== "gateway-api" || readyBody.status !== "ready") {
        throw new Error("Gateway readiness failed");
      }
    } else if (readiness.status !== 503 || readyBody.code !== "PLATFORM_UNAVAILABLE") {
      throw new Error("Gateway did not fail closed when Platform stopped");
    }
    console.log(`Gateway liveness ok; readiness ${expected}`);
  ' "$expected_readiness" 2>&1)"; then
      printf '%s\n' "$result"
      return 0
    fi

    if ((SECONDS >= deadline)); then
      echo "Gateway did not reach the expected readiness state within 60 seconds." >&2
      printf '%s\n' "$result" >&2
      return 1
    fi

    sleep 2
  done
}

# Use the running Platform container's actual runtime URL, changing only the
# host/port for the host-side TypeORM test. Never print the credentialed URL.
typeorm_database_url() {
  local binding port

  binding="$("${COMPOSE[@]}" port postgres 5432)"
  port="${binding##*:}"
  if [[ ! "$port" =~ ^[1-9][0-9]*$ ]]; then
    echo "Could not resolve the local PostgreSQL host port" >&2
    return 1
  fi

  "${COMPOSE[@]}" exec -T platform-service node --input-type=module -e '
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("Platform DATABASE_URL is missing");
    }
    let url;
    try {
      url = new URL(databaseUrl);
    } catch {
      throw new Error("Platform DATABASE_URL is invalid");
    }
    url.hostname = "127.0.0.1";
    url.port = process.argv[1];
    process.stdout.write(url.toString());
  ' "$port"
}

# An EXIT trap restores Platform even if an outage assertion fails.
PLATFORM_STOPPED=false
restore_platform() {
  if [[ "$PLATFORM_STOPPED" == "true" ]]; then
    step "Restore Platform service"
    if "${COMPOSE[@]}" up -d --wait --wait-timeout 120 platform-service; then
      PLATFORM_STOPPED=false
    else
      echo "Platform could not be restored to a healthy state." >&2
      return 1
    fi
  fi
}

on_exit() {
  local status=$?
  trap - EXIT
  if ! restore_platform; then
    status=1
  fi
  exit "$status"
}
trap on_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

step "Validate local Compose configuration"
"${COMPOSE[@]}" config --quiet

if [[ "$FRESH" == "true" ]]; then
  echo "--fresh deletes the containers and named volumes for $COMPOSE_PROJECT_NAME."
  if ! read -r -p "Type $COMPOSE_PROJECT_NAME to continue: " confirmation; then
    echo "Fresh verification requires interactive confirmation." >&2
    exit 2
  fi
  if [[ "$confirmation" != "$COMPOSE_PROJECT_NAME" ]]; then
    echo "Fresh verification cancelled; no volumes were removed." >&2
    exit 2
  fi

  step "Reset the local stack"
  run_local_command local:reset

  # Gateway's outbox relay requires the migrated schema at startup. Keep all
  # application services stopped until database setup is complete.
  step "Run migrations twice in owner order before application startup"
  run_local_command local:migrate -- --build
  run_local_command local:migrate

  step "Run seeds twice in owner order before application startup"
  run_local_command local:seed -- --build
  run_local_command local:seed

  step "Start and await the migrated local stack"
  run_local_command local:up
fi

step "Check all default runtime containers"
check_stack_health

step "Check gateway liveness and Platform-dependent readiness"
check_gateway ready

step "Verify database roles and negative privileges"
run_local_command local:db:verify-roles

if [[ "$INTEGRATION" == "true" ]]; then
  step "Verify seeded artifact bytes, checksum, and write-once behavior"
  run_local_command local:artifact:verify

  step "Verify TypeORM against the migrated Platform database"
  database_url="$(typeorm_database_url)"
  (
    cd "$REPOSITORY_ROOT"
    TYPEORM_TEST_DATABASE_URL="$database_url" npm run test:typeorm:run
  )

  step "Verify two-client artifact concurrency and recovery"
  run_local_command local:artifact:concurrency:verify
fi

if [[ "$OUTAGE" == "true" ]]; then
  step "Stop Platform and verify gateway fails closed"
  PLATFORM_STOPPED=true
  "${COMPOSE[@]}" stop platform-service
  check_gateway unavailable

  restore_platform
  step "Verify gateway readiness recovers"
  check_gateway ready
fi

step "Local verification passed"
