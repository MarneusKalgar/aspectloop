#!/usr/bin/env bash

set -euo pipefail

required_variables=(
  PGHOST
  PGPORT
  POSTGRES_ADMIN_USER
  POSTGRES_ADMIN_PASSWORD
  POSTGRES_ADMIN_DATABASE
  POSTGRES_MAX_CONNECTIONS
  POSTGRES_SUPERUSER_RESERVED_CONNECTIONS
  POSTGRES_OPERATIONAL_HEADROOM
  POSTGRES_TOOL_CONNECTION_BUDGET
  PLATFORM_DB_POOL_SIZE
  EXTRACTION_DB_POOL_SIZE
  CORRECTION_DB_POOL_SIZE
  PLATFORM_DATABASE_NAME
  PLATFORM_DATABASE_USER
  PLATFORM_DATABASE_PASSWORD
  EXTRACTION_DATABASE_NAME
  EXTRACTION_DATABASE_USER
  EXTRACTION_DATABASE_PASSWORD
  CORRECTION_DATABASE_NAME
  CORRECTION_DATABASE_USER
  CORRECTION_DATABASE_PASSWORD
)

for variable_name in "${required_variables[@]}"; do
  if [[ -z "${!variable_name:-}" ]]; then
    echo "Missing required role-verification variable: $variable_name" >&2
    exit 1
  fi
done

numeric_variables=(
  POSTGRES_MAX_CONNECTIONS
  POSTGRES_SUPERUSER_RESERVED_CONNECTIONS
  POSTGRES_OPERATIONAL_HEADROOM
  POSTGRES_TOOL_CONNECTION_BUDGET
  PLATFORM_DB_POOL_SIZE
  EXTRACTION_DB_POOL_SIZE
  CORRECTION_DB_POOL_SIZE
)

for variable_name in "${numeric_variables[@]}"; do
  if [[ ! "${!variable_name}" =~ ^[0-9]+$ ]]; then
    echo "$variable_name must be a non-negative integer." >&2
    exit 1
  fi
done

database_names=(
  "$PLATFORM_DATABASE_NAME"
  "$EXTRACTION_DATABASE_NAME"
  "$CORRECTION_DATABASE_NAME"
)
role_names=(
  "$PLATFORM_DATABASE_USER"
  "$EXTRACTION_DATABASE_USER"
  "$CORRECTION_DATABASE_USER"
)
role_passwords=(
  "$PLATFORM_DATABASE_PASSWORD"
  "$EXTRACTION_DATABASE_PASSWORD"
  "$CORRECTION_DATABASE_PASSWORD"
)

admin_result="$(
  PGPASSWORD="$POSTGRES_ADMIN_PASSWORD" psql \
    --username "$POSTGRES_ADMIN_USER" \
    --dbname "$POSTGRES_ADMIN_DATABASE" \
    --no-password \
    --tuples-only \
    --no-align \
    --set ON_ERROR_STOP=1 \
    --command "SELECT current_setting('server_version_num'), current_setting('data_checksums'), current_setting('max_connections'), current_setting('superuser_reserved_connections')"
)"
IFS='|' read -r server_version_num data_checksums max_connections reserved_connections <<<"$admin_result"

if ((server_version_num < 180000 || server_version_num >= 190000)); then
  echo "Expected PostgreSQL major 18; received server_version_num=$server_version_num." >&2
  exit 1
fi

if [[ "$data_checksums" != "on" ]]; then
  echo "Expected PostgreSQL data checksums to be enabled." >&2
  exit 1
fi

if [[ "$max_connections" != "$POSTGRES_MAX_CONNECTIONS" ]]; then
  echo "Configured max_connections does not match the running server." >&2
  exit 1
fi

if [[ "$reserved_connections" != "$POSTGRES_SUPERUSER_RESERVED_CONNECTIONS" ]]; then
  echo "Configured superuser reserve does not match the running server." >&2
  exit 1
fi

available_connections=$((max_connections - reserved_connections))
planned_connections=$((
  PLATFORM_DB_POOL_SIZE +
    EXTRACTION_DB_POOL_SIZE +
    CORRECTION_DB_POOL_SIZE +
    POSTGRES_TOOL_CONNECTION_BUDGET +
    POSTGRES_OPERATIONAL_HEADROOM
))

if ((planned_connections > available_connections)); then
  echo "Connection budget exceeds non-reserved PostgreSQL capacity." >&2
  exit 1
fi

for index in "${!database_names[@]}"; do
  database_name="${database_names[$index]}"
  role_name="${role_names[$index]}"
  role_password="${role_passwords[$index]}"

  own_identity="$(
    PGPASSWORD="$role_password" psql \
      --username "$role_name" \
      --dbname "$database_name" \
      --no-password \
      --tuples-only \
      --no-align \
      --set ON_ERROR_STOP=1 \
      --command "SELECT current_user || '|' || current_database()"
  )"

  if [[ "$own_identity" != "$role_name|$database_name" ]]; then
    echo "Role $role_name did not connect to its owned database." >&2
    exit 1
  fi

  schema_owner="$(
    PGPASSWORD="$role_password" psql \
      --username "$role_name" \
      --dbname "$database_name" \
      --no-password \
      --tuples-only \
      --no-align \
      --set ON_ERROR_STOP=1 \
      --command "SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname = 'public'"
  )"

  if [[ "$schema_owner" != "$role_name" ]]; then
    echo "Role $role_name does not own the public schema in $database_name." >&2
    exit 1
  fi

  unexpected_access="$(
    PGPASSWORD="$POSTGRES_ADMIN_PASSWORD" psql \
      --username "$POSTGRES_ADMIN_USER" \
      --dbname "$POSTGRES_ADMIN_DATABASE" \
      --no-password \
      --tuples-only \
      --no-align \
      --set ON_ERROR_STOP=1 \
      --set "owned_database=$database_name" \
      --set "role_name=$role_name" <<'SQL'
SELECT string_agg(datname, ', ' ORDER BY datname)
FROM pg_database
WHERE datallowconn
  AND datname <> :'owned_database'
  AND has_database_privilege(:'role_name', datname, 'CONNECT');
SQL
  )"

  if [[ -n "$unexpected_access" ]]; then
    echo "Role $role_name can unexpectedly connect to: $unexpected_access." >&2
    exit 1
  fi

  echo "PASS: $role_name owns and can access only $database_name."
done

echo "PASS: PostgreSQL 18 checksums are enabled."
echo "PASS: connection budget uses $planned_connections of $available_connections non-reserved slots."
