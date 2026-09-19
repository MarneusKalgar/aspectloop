#!/usr/bin/env bash

set -euo pipefail

pg_isready --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --quiet

# Readiness covers role safety, database ownership, the exact connect matrix,
# schema ownership, checksums, and the configured PostgreSQL capacity.
cluster_readiness="$(
  psql \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    --no-password \
    --tuples-only \
    --no-align \
    --set ON_ERROR_STOP=1 \
    --set "platform_database=$PLATFORM_DATABASE_NAME" \
    --set "platform_migrator=$PLATFORM_MIGRATOR_USER" \
    --set "platform_runtime=$PLATFORM_RUNTIME_USER" \
    --set "gateway_runtime=$GATEWAY_CORRECTION_RUNTIME_USER" \
    --set "extraction_database=$EXTRACTION_DATABASE_NAME" \
    --set "extraction_role=$EXTRACTION_DATABASE_USER" \
    --set "correction_database=$CORRECTION_DATABASE_NAME" \
    --set "correction_role=$CORRECTION_DATABASE_USER" \
    --set "max_connections=$POSTGRES_MAX_CONNECTIONS" \
    --set "reserved_connections=$POSTGRES_SUPERUSER_RESERVED_CONNECTIONS" \
    2>/dev/null <<'SQL'
WITH expected_roles(role_name) AS (
  VALUES
    (:'platform_migrator'),
    (:'platform_runtime'),
    (:'gateway_runtime'),
    (:'extraction_role'),
    (:'correction_role')
), safe_roles AS (
  SELECT pg_roles.rolname
  FROM expected_roles
  JOIN pg_roles ON pg_roles.rolname = expected_roles.role_name
  WHERE pg_roles.rolcanlogin
    AND NOT pg_roles.rolsuper
    AND NOT pg_roles.rolcreatedb
    AND NOT pg_roles.rolcreaterole
    AND NOT pg_roles.rolreplication
    AND NOT pg_roles.rolbypassrls
    AND NOT EXISTS (
      SELECT 1 FROM pg_auth_members WHERE pg_auth_members.member = pg_roles.oid
    )
), expected_owners(database_name, role_name) AS (
  VALUES
    (:'platform_database', :'platform_migrator'),
    (:'extraction_database', :'extraction_role'),
    (:'correction_database', :'correction_role')
), owned_databases AS (
  SELECT expected_owners.database_name
  FROM expected_owners
  JOIN pg_database ON pg_database.datname = expected_owners.database_name
  JOIN pg_roles ON pg_roles.oid = pg_database.datdba
  WHERE pg_roles.rolname = expected_owners.role_name
    AND pg_database.datallowconn
), allowed_connections(role_name, database_name) AS (
  VALUES
    (:'platform_migrator', :'platform_database'),
    (:'platform_runtime', :'platform_database'),
    (:'gateway_runtime', :'platform_database'),
    (:'extraction_role', :'extraction_database'),
    (:'correction_role', :'correction_database')
), actual_connections AS (
  SELECT expected_roles.role_name, expected_owners.database_name
  FROM expected_roles
  CROSS JOIN expected_owners
  WHERE has_database_privilege(
    expected_roles.role_name,
    expected_owners.database_name,
    'CONNECT'
  )
)
SELECT CASE
  WHEN (SELECT count(*) FROM safe_roles) = 5
    AND (SELECT count(*) FROM owned_databases) = 3
    AND NOT EXISTS (
      SELECT role_name, database_name FROM allowed_connections
      EXCEPT
      SELECT role_name, database_name FROM actual_connections
    )
    AND NOT EXISTS (
      SELECT role_name, database_name FROM actual_connections
      EXCEPT
      SELECT role_name, database_name FROM allowed_connections
    )
    AND current_setting('data_checksums') = 'on'
    AND current_setting('server_version_num')::integer >= 180000
    AND current_setting('server_version_num')::integer < 190000
    AND current_setting('max_connections')::integer = :'max_connections'::integer
    AND current_setting('superuser_reserved_connections')::integer = :'reserved_connections'::integer
  THEN 'ready'
  ELSE 'not-ready'
END;
SQL
)"

platform_schema_readiness="$(
  psql \
    --username "$POSTGRES_USER" \
    --dbname "$PLATFORM_DATABASE_NAME" \
    --no-password \
    --tuples-only \
    --no-align \
    --set ON_ERROR_STOP=1 \
    --set "platform_migrator=$PLATFORM_MIGRATOR_USER" \
    --set "platform_runtime=$PLATFORM_RUNTIME_USER" \
    --set "gateway_runtime=$GATEWAY_CORRECTION_RUNTIME_USER" \
    2>/dev/null <<'SQL'
SELECT CASE
  WHEN (
    SELECT pg_get_userbyid(nspowner) = :'platform_migrator'
    FROM pg_namespace
    WHERE nspname = 'public'
  )
    AND has_schema_privilege(:'platform_runtime', 'public', 'USAGE')
    AND NOT has_schema_privilege(:'platform_runtime', 'public', 'CREATE')
    AND has_schema_privilege(:'gateway_runtime', 'public', 'USAGE')
    AND NOT has_schema_privilege(:'gateway_runtime', 'public', 'CREATE')
  THEN 'ready'
  ELSE 'not-ready'
END;
SQL
)"

service_schema_readiness="ready"
for database_and_owner in \
  "$EXTRACTION_DATABASE_NAME|$EXTRACTION_DATABASE_USER" \
  "$CORRECTION_DATABASE_NAME|$CORRECTION_DATABASE_USER"; do
  IFS='|' read -r database_name owner_name <<<"$database_and_owner"
  schema_owner="$(
    psql \
      --username "$POSTGRES_USER" \
      --dbname "$database_name" \
      --no-password \
      --tuples-only \
      --no-align \
      --set ON_ERROR_STOP=1 \
      --command "SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname = 'public'" \
      2>/dev/null
  )"

  if [[ "$schema_owner" != "$owner_name" ]]; then
    service_schema_readiness="not-ready"
  fi
done

[[ "$cluster_readiness" == "ready" ]]
[[ "$platform_schema_readiness" == "ready" ]]
[[ "$service_schema_readiness" == "ready" ]]
