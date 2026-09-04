#!/usr/bin/env bash

set -euo pipefail

pg_isready --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --quiet

readiness="$(
  psql \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    --no-password \
    --tuples-only \
    --no-align \
    --set ON_ERROR_STOP=1 \
    --set "platform_database=$PLATFORM_DATABASE_NAME" \
    --set "platform_role=$PLATFORM_DATABASE_USER" \
    --set "extraction_database=$EXTRACTION_DATABASE_NAME" \
    --set "extraction_role=$EXTRACTION_DATABASE_USER" \
    --set "correction_database=$CORRECTION_DATABASE_NAME" \
    --set "correction_role=$CORRECTION_DATABASE_USER" \
    --set "max_connections=$POSTGRES_MAX_CONNECTIONS" \
    --set "reserved_connections=$POSTGRES_SUPERUSER_RESERVED_CONNECTIONS" \
    2>/dev/null <<'SQL'
WITH expected(database_name, role_name) AS (
  VALUES
    (:'platform_database', :'platform_role'),
    (:'extraction_database', :'extraction_role'),
    (:'correction_database', :'correction_role')
), owned_databases AS (
  SELECT expected.database_name
  FROM expected
  JOIN pg_database ON pg_database.datname = expected.database_name
  JOIN pg_roles ON pg_roles.oid = pg_database.datdba
  WHERE pg_roles.rolname = expected.role_name
    AND pg_database.datallowconn
    AND pg_roles.rolcanlogin
    AND NOT pg_roles.rolsuper
    AND NOT pg_roles.rolcreatedb
    AND NOT pg_roles.rolcreaterole
    AND NOT pg_roles.rolreplication
)
SELECT CASE
  WHEN (SELECT count(*) FROM owned_databases) = 3
    AND has_database_privilege(:'platform_role', :'platform_database', 'CONNECT')
    AND has_database_privilege(:'extraction_role', :'extraction_database', 'CONNECT')
    AND has_database_privilege(:'correction_role', :'correction_database', 'CONNECT')
    AND NOT EXISTS (
      SELECT 1
      FROM expected
      CROSS JOIN pg_database
      WHERE pg_database.datallowconn
        AND pg_database.datname <> expected.database_name
        AND has_database_privilege(expected.role_name, pg_database.datname, 'CONNECT')
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

[[ "$readiness" == "ready" ]]
