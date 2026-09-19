#!/usr/bin/env bash

set -euo pipefail

# This script serves both as the fresh-cluster initializer and the repeatable
# administrator-run provisioner used before and after local migrations.
required_variables=(
  POSTGRES_USER
  POSTGRES_PASSWORD
  POSTGRES_DB
  PLATFORM_DATABASE_NAME
  PLATFORM_MIGRATOR_USER
  PLATFORM_MIGRATOR_PASSWORD
  PLATFORM_RUNTIME_USER
  PLATFORM_RUNTIME_PASSWORD
  GATEWAY_CORRECTION_RUNTIME_USER
  GATEWAY_CORRECTION_RUNTIME_PASSWORD
  EXTRACTION_DATABASE_NAME
  EXTRACTION_DATABASE_USER
  EXTRACTION_DATABASE_PASSWORD
  CORRECTION_DATABASE_NAME
  CORRECTION_DATABASE_USER
  CORRECTION_DATABASE_PASSWORD
)

for variable_name in "${required_variables[@]}"; do
  if [[ -z "${!variable_name:-}" ]]; then
    echo "Missing required PostgreSQL provisioning variable: $variable_name" >&2
    exit 1
  fi
done

database_names=(
  "$PLATFORM_DATABASE_NAME"
  "$EXTRACTION_DATABASE_NAME"
  "$CORRECTION_DATABASE_NAME"
)
database_owner_names=(
  "$PLATFORM_MIGRATOR_USER"
  "$EXTRACTION_DATABASE_USER"
  "$CORRECTION_DATABASE_USER"
)
role_names=(
  "$PLATFORM_MIGRATOR_USER"
  "$PLATFORM_RUNTIME_USER"
  "$GATEWAY_CORRECTION_RUNTIME_USER"
  "$EXTRACTION_DATABASE_USER"
  "$CORRECTION_DATABASE_USER"
)
role_passwords=(
  "$PLATFORM_MIGRATOR_PASSWORD"
  "$PLATFORM_RUNTIME_PASSWORD"
  "$GATEWAY_CORRECTION_RUNTIME_PASSWORD"
  "$EXTRACTION_DATABASE_PASSWORD"
  "$CORRECTION_DATABASE_PASSWORD"
)

for identifier in "${database_names[@]}" "${role_names[@]}"; do
  if [[ ! "$identifier" =~ ^[a-z_][a-z0-9_]{0,62}$ ]]; then
    echo "Database and role names must be lowercase PostgreSQL identifiers." >&2
    exit 1
  fi
done

# Reject administrator collisions and duplicate identities before issuing SQL.
for first_index in "${!database_names[@]}"; do
  if [[ "${database_names[$first_index]}" == "$POSTGRES_DB" ]]; then
    echo "Service database names must differ from the bootstrap database." >&2
    exit 1
  fi

  for second_index in "${!database_names[@]}"; do
    if ((first_index >= second_index)); then
      continue
    fi

    if [[ "${database_names[$first_index]}" == "${database_names[$second_index]}" ]]; then
      echo "Service database names must be unique." >&2
      exit 1
    fi
  done
done

for first_index in "${!role_names[@]}"; do
  if [[ "${role_names[$first_index]}" == "$POSTGRES_USER" ]]; then
    echo "Service roles must differ from the bootstrap administrator." >&2
    exit 1
  fi

  for second_index in "${!role_names[@]}"; do
    if ((first_index >= second_index)); then
      continue
    fi

    if [[ "${role_names[$first_index]}" == "${role_names[$second_index]}" ]]; then
      echo "Service role names must be unique." >&2
      exit 1
    fi
  done
done

export PGPASSWORD="$POSTGRES_PASSWORD"
postgres_host="${PGHOST:-/var/run/postgresql}"
postgres_port="${PGPORT:-5432}"

# A disposable tool container may start while PostgreSQL is still becoming ready.
for attempt in {1..30}; do
  if pg_isready \
    --host "$postgres_host" \
    --port "$postgres_port" \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    --quiet; then
    break
  fi

  if ((attempt == 30)); then
    echo "PostgreSQL did not become ready for role provisioning." >&2
    exit 1
  fi

  sleep 1
done

# Create or normalize every login without granting role-management capabilities.
for index in "${!role_names[@]}"; do
  role_name="${role_names[$index]}"
  role_password="${role_passwords[$index]}"

  psql \
    --host "$postgres_host" \
    --port "$postgres_port" \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    --no-password \
    --set ON_ERROR_STOP=1 \
    --set "role_name=$role_name" \
    --set "role_password=$role_password" <<'SQL'
SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
  :'role_name',
  :'role_password'
)
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'role_name') \gexec

SELECT format(
  'ALTER ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
  :'role_name',
  :'role_password'
) \gexec

SELECT format('REVOKE %I FROM %I', granted_role.rolname, member_role.rolname)
FROM pg_auth_members
JOIN pg_roles AS granted_role ON granted_role.oid = pg_auth_members.roleid
JOIN pg_roles AS member_role ON member_role.oid = pg_auth_members.member
WHERE member_role.rolname = :'role_name'
\gexec
SQL
done

# Create databases, reconcile owners, and remove every inherited direct grant.
for index in "${!database_names[@]}"; do
  database_name="${database_names[$index]}"
  owner_name="${database_owner_names[$index]}"

  psql \
    --host "$postgres_host" \
    --port "$postgres_port" \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    --no-password \
    --set ON_ERROR_STOP=1 \
    --set "database_name=$database_name" \
    --set "owner_name=$owner_name" <<'SQL'
SELECT format('CREATE DATABASE %I OWNER %I', :'database_name', :'owner_name')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'database_name') \gexec

SELECT format('ALTER DATABASE %I OWNER TO %I', :'database_name', :'owner_name') \gexec
SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', :'database_name') \gexec
SQL

  for role_name in "${role_names[@]}"; do
    psql \
      --host "$postgres_host" \
      --port "$postgres_port" \
      --username "$POSTGRES_USER" \
      --dbname "$POSTGRES_DB" \
      --no-password \
      --set ON_ERROR_STOP=1 \
      --set "database_name=$database_name" \
      --set "role_name=$role_name" <<'SQL'
SELECT format('REVOKE ALL ON DATABASE %I FROM %I', :'database_name', :'role_name') \gexec
SQL
  done
done

# Bootstrap databases are administrator-only, including against stale direct grants.
psql \
  --host "$postgres_host" \
  --port "$postgres_port" \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --no-password \
  --set ON_ERROR_STOP=1 \
  --set "admin_database=$POSTGRES_DB" <<'SQL'
SELECT format('REVOKE CONNECT ON DATABASE %I FROM PUBLIC', :'admin_database') \gexec
REVOKE CONNECT ON DATABASE template1 FROM PUBLIC;
SQL

for role_name in "${role_names[@]}"; do
  psql \
    --host "$postgres_host" \
    --port "$postgres_port" \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    --no-password \
    --set ON_ERROR_STOP=1 \
    --set "admin_database=$POSTGRES_DB" \
    --set "role_name=$role_name" <<'SQL'
SELECT format('REVOKE ALL ON DATABASE %I FROM %I', :'admin_database', :'role_name') \gexec
SELECT format('REVOKE ALL ON DATABASE template1 FROM %I', :'role_name') \gexec
SQL
done

# Grant only the intended database capabilities. Owner/migrator roles require
# database CREATE so TypeORM can install declared extensions such as uuid-ossp;
# runtime-only roles remain CONNECT-only.
psql \
  --host "$postgres_host" \
  --port "$postgres_port" \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --no-password \
  --set ON_ERROR_STOP=1 \
  --set "platform_database=$PLATFORM_DATABASE_NAME" \
  --set "platform_migrator=$PLATFORM_MIGRATOR_USER" \
  --set "platform_runtime=$PLATFORM_RUNTIME_USER" \
  --set "gateway_runtime=$GATEWAY_CORRECTION_RUNTIME_USER" \
  --set "extraction_database=$EXTRACTION_DATABASE_NAME" \
  --set "extraction_role=$EXTRACTION_DATABASE_USER" \
  --set "correction_database=$CORRECTION_DATABASE_NAME" \
  --set "correction_role=$CORRECTION_DATABASE_USER" <<'SQL'
SELECT format('GRANT CONNECT, CREATE ON DATABASE %I TO %I', :'platform_database', :'platform_migrator') \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', :'platform_database', :'platform_runtime') \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', :'platform_database', :'gateway_runtime') \gexec
SELECT format('GRANT CONNECT, CREATE ON DATABASE %I TO %I', :'extraction_database', :'extraction_role') \gexec
SELECT format('GRANT CONNECT, CREATE ON DATABASE %I TO %I', :'correction_database', :'correction_role') \gexec
SQL

# Extraction and correction retain their current owner/runtime topology.
for index in 1 2; do
  database_name="${database_names[$index]}"
  owner_name="${database_owner_names[$index]}"

  psql \
    --host "$postgres_host" \
    --port "$postgres_port" \
    --username "$POSTGRES_USER" \
    --dbname "$database_name" \
    --no-password \
    --set ON_ERROR_STOP=1 \
    --set "owner_name=$owner_name" <<'SQL'
SELECT format('ALTER SCHEMA public OWNER TO %I', :'owner_name') \gexec
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
SELECT format('GRANT USAGE, CREATE ON SCHEMA public TO %I', :'owner_name') \gexec
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC', :'owner_name') \gexec
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC', :'owner_name') \gexec
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC', :'owner_name') \gexec
SQL
done

# Platform runtime permissions are rebuilt from a deny-all baseline and granted
# only for the current allowlisted tables.
psql \
  --host "$postgres_host" \
  --port "$postgres_port" \
  --username "$POSTGRES_USER" \
  --dbname "$PLATFORM_DATABASE_NAME" \
  --no-password \
  --set ON_ERROR_STOP=1 \
  --set "platform_migrator=$PLATFORM_MIGRATOR_USER" \
  --set "platform_runtime=$PLATFORM_RUNTIME_USER" \
  --set "gateway_runtime=$GATEWAY_CORRECTION_RUNTIME_USER" <<'SQL'
SELECT format('ALTER SCHEMA public OWNER TO %I', :'platform_migrator') \gexec
REVOKE ALL ON SCHEMA public FROM PUBLIC;
SELECT format('REVOKE ALL ON SCHEMA public FROM %I', :'platform_runtime') \gexec
SELECT format('REVOKE ALL ON SCHEMA public FROM %I', :'gateway_runtime') \gexec
SELECT format('GRANT USAGE, CREATE ON SCHEMA public TO %I', :'platform_migrator') \gexec
SELECT format('GRANT USAGE ON SCHEMA public TO %I', :'platform_runtime') \gexec
SELECT format('GRANT USAGE ON SCHEMA public TO %I', :'gateway_runtime') \gexec

SELECT format('ALTER TABLE %I.%I OWNER TO %I', n.nspname, c.relname, :'platform_migrator')
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
ORDER BY c.relname
\gexec

SELECT format('ALTER SEQUENCE %I.%I OWNER TO %I', n.nspname, c.relname, :'platform_migrator')
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'S'
ORDER BY c.relname
\gexec

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
SELECT format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', :'platform_runtime') \gexec
SELECT format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', :'platform_runtime') \gexec
SELECT format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', :'platform_runtime') \gexec
SELECT format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', :'gateway_runtime') \gexec
SELECT format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', :'gateway_runtime') \gexec
SELECT format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', :'gateway_runtime') \gexec

SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC', :'platform_migrator') \gexec
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC', :'platform_migrator') \gexec
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC', :'platform_migrator') \gexec
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM %I', :'platform_migrator', :'platform_runtime') \gexec
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', :'platform_migrator', :'platform_runtime') \gexec
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', :'platform_migrator', :'platform_runtime') \gexec
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM %I', :'platform_migrator', :'gateway_runtime') \gexec
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', :'platform_migrator', :'gateway_runtime') \gexec
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', :'platform_migrator', :'gateway_runtime') \gexec

SELECT format('GRANT EXECUTE ON FUNCTION %s TO %I', p.oid::regprocedure, :'platform_runtime')
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'uuid_generate_v4'
  AND p.pronargs = 0
\gexec

SELECT format('GRANT EXECUTE ON FUNCTION %s TO %I', p.oid::regprocedure, :'platform_migrator')
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'uuid_generate_v4'
  AND p.pronargs = 0
\gexec

SELECT format('GRANT EXECUTE ON FUNCTION %s TO %I', p.oid::regprocedure, :'gateway_runtime')
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'uuid_generate_v4'
  AND p.pronargs = 0
\gexec

SELECT format('GRANT SELECT, INSERT, UPDATE ON TABLE public.%I TO %I', table_name, :'platform_runtime')
FROM (VALUES ('users'), ('document')) AS allowed(table_name)
WHERE to_regclass(format('public.%I', table_name)) IS NOT NULL
\gexec

SELECT format('GRANT SELECT, INSERT ON TABLE public.%I TO %I', 'document_object', :'platform_runtime')
WHERE to_regclass('public.document_object') IS NOT NULL
\gexec

SELECT format('GRANT SELECT, INSERT, UPDATE ON TABLE public.%I TO %I', 'document_object_reservation', :'platform_runtime')
WHERE to_regclass('public.document_object_reservation') IS NOT NULL
\gexec

SELECT format('GRANT SELECT, INSERT, UPDATE ON TABLE public.%I TO %I', table_name, :'gateway_runtime')
FROM (
  VALUES
    ('correction_session'),
    ('correction_edit'),
    ('correction_event_outbox')
) AS allowed(table_name)
WHERE to_regclass(format('public.%I', table_name)) IS NOT NULL
\gexec
SQL

echo "Provisioned five isolated database identities and explicit Platform runtime grants."
