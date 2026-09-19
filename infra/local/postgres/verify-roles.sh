#!/usr/bin/env bash

set -euo pipefail

required_variables=(
  PGHOST PGPORT
  POSTGRES_ADMIN_USER POSTGRES_ADMIN_PASSWORD POSTGRES_ADMIN_DATABASE
  POSTGRES_MAX_CONNECTIONS POSTGRES_SUPERUSER_RESERVED_CONNECTIONS
  POSTGRES_OPERATIONAL_HEADROOM POSTGRES_TOOL_CONNECTION_BUDGET
  GATEWAY_DB_POOL_SIZE PLATFORM_DB_POOL_SIZE
  EXTRACTION_DB_POOL_SIZE CORRECTION_DB_POOL_SIZE
  PLATFORM_DATABASE_NAME
  PLATFORM_MIGRATOR_USER PLATFORM_MIGRATOR_PASSWORD
  PLATFORM_RUNTIME_USER PLATFORM_RUNTIME_PASSWORD
  GATEWAY_CORRECTION_RUNTIME_USER GATEWAY_CORRECTION_RUNTIME_PASSWORD
  EXTRACTION_DATABASE_NAME EXTRACTION_DATABASE_USER EXTRACTION_DATABASE_PASSWORD
  CORRECTION_DATABASE_NAME CORRECTION_DATABASE_USER CORRECTION_DATABASE_PASSWORD
)

for variable_name in "${required_variables[@]}"; do
  if [[ -z "${!variable_name:-}" ]]; then
    echo "Missing required role-verification variable: $variable_name" >&2
    exit 1
  fi
done

numeric_variables=(
  POSTGRES_MAX_CONNECTIONS POSTGRES_SUPERUSER_RESERVED_CONNECTIONS
  POSTGRES_OPERATIONAL_HEADROOM POSTGRES_TOOL_CONNECTION_BUDGET
  GATEWAY_DB_POOL_SIZE PLATFORM_DB_POOL_SIZE
  EXTRACTION_DB_POOL_SIZE CORRECTION_DB_POOL_SIZE
)
for variable_name in "${numeric_variables[@]}"; do
  if [[ ! "${!variable_name}" =~ ^[0-9]+$ ]]; then
    echo "$variable_name must be a non-negative integer." >&2
    exit 1
  fi
done

pool_variables=(
  GATEWAY_DB_POOL_SIZE PLATFORM_DB_POOL_SIZE
  EXTRACTION_DB_POOL_SIZE CORRECTION_DB_POOL_SIZE
)
for variable_name in "${pool_variables[@]}"; do
  if (("${!variable_name}" < 1)); then
    echo "$variable_name must be a positive integer." >&2
    exit 1
  fi
done

roles=(
  "$PLATFORM_MIGRATOR_USER"
  "$PLATFORM_RUNTIME_USER"
  "$GATEWAY_CORRECTION_RUNTIME_USER"
  "$EXTRACTION_DATABASE_USER"
  "$CORRECTION_DATABASE_USER"
)
owner_roles=(
  "$PLATFORM_MIGRATOR_USER"
  "$EXTRACTION_DATABASE_USER"
  "$CORRECTION_DATABASE_USER"
)
passwords=(
  "$PLATFORM_MIGRATOR_PASSWORD"
  "$PLATFORM_RUNTIME_PASSWORD"
  "$GATEWAY_CORRECTION_RUNTIME_PASSWORD"
  "$EXTRACTION_DATABASE_PASSWORD"
  "$CORRECTION_DATABASE_PASSWORD"
)
expected_databases=(
  "$PLATFORM_DATABASE_NAME"
  "$PLATFORM_DATABASE_NAME"
  "$PLATFORM_DATABASE_NAME"
  "$EXTRACTION_DATABASE_NAME"
  "$CORRECTION_DATABASE_NAME"
)
logical_databases=(
  "$PLATFORM_DATABASE_NAME"
  "$EXTRACTION_DATABASE_NAME"
  "$CORRECTION_DATABASE_NAME"
)

for identifier in "${logical_databases[@]}" "${roles[@]}"; do
  if [[ ! "$identifier" =~ ^[a-z_][a-z0-9_]{0,62}$ ]]; then
    echo "Database and role names must be lowercase PostgreSQL identifiers." >&2
    exit 1
  fi
done

# Reads one scalar as the local administrator without exposing credentials.
admin_scalar() {
  local database_name="$1"
  local statement="$2"

  PGPASSWORD="$POSTGRES_ADMIN_PASSWORD" psql \
    --username "$POSTGRES_ADMIN_USER" \
    --dbname "$database_name" \
    --no-password \
    --tuples-only \
    --no-align \
    --set ON_ERROR_STOP=1 \
    --command "$statement"
}

# Fails when a statement unexpectedly succeeds for a restricted runtime login.
expect_denied() {
  local role_name="$1"
  local role_password="$2"
  local database_name="$3"
  local statement="$4"
  local description="$5"

  if PGPASSWORD="$role_password" psql \
    --username "$role_name" \
    --dbname "$database_name" \
    --no-password \
    --set ON_ERROR_STOP=1 \
    --command "$statement" \
    >/dev/null 2>&1; then
    echo "Expected denial: $description." >&2
    exit 1
  fi
}

# Returns the complete PostgreSQL 18 table privilege tuple for one table.
table_privileges() {
  local role_name="$1"
  local table_name="$2"

  PGPASSWORD="$POSTGRES_ADMIN_PASSWORD" psql \
    --username "$POSTGRES_ADMIN_USER" \
    --dbname "$PLATFORM_DATABASE_NAME" \
    --no-password \
    --tuples-only \
    --no-align \
    --set ON_ERROR_STOP=1 \
    --set "checked_role=$role_name" \
    --set "checked_table=$table_name" <<'SQL'
SELECT concat_ws(
  ',',
  has_table_privilege(:'checked_role', format('public.%I', :'checked_table'), 'SELECT'),
  has_table_privilege(:'checked_role', format('public.%I', :'checked_table'), 'INSERT'),
  has_table_privilege(:'checked_role', format('public.%I', :'checked_table'), 'UPDATE'),
  has_table_privilege(:'checked_role', format('public.%I', :'checked_table'), 'DELETE'),
  has_table_privilege(:'checked_role', format('public.%I', :'checked_table'), 'TRUNCATE'),
  has_table_privilege(:'checked_role', format('public.%I', :'checked_table'), 'REFERENCES'),
  has_table_privilege(:'checked_role', format('public.%I', :'checked_table'), 'TRIGGER'),
  has_table_privilege(:'checked_role', format('public.%I', :'checked_table'), 'MAINTAIN')
);
SQL
}

# Compares one table's effective privilege tuple to its allowlist entry.
assert_table_privileges() {
  local role_name="$1"
  local table_name="$2"
  local expected="$3"
  local actual
  actual="$(table_privileges "$role_name" "$table_name")"

  if [[ "$actual" != "$expected" ]]; then
    echo "$role_name privileges on $table_name were $actual; expected $expected." >&2
    exit 1
  fi
}

admin_result="$(
  admin_scalar "$POSTGRES_ADMIN_DATABASE" \
    "SELECT current_setting('server_version_num'), current_setting('data_checksums'), current_setting('max_connections'), current_setting('superuser_reserved_connections')"
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
  GATEWAY_DB_POOL_SIZE + PLATFORM_DB_POOL_SIZE +
    EXTRACTION_DB_POOL_SIZE + CORRECTION_DB_POOL_SIZE +
    POSTGRES_TOOL_CONNECTION_BUDGET + POSTGRES_OPERATIONAL_HEADROOM
))
if ((planned_connections > available_connections)); then
  echo "Connection budget exceeds non-reserved PostgreSQL capacity." >&2
  exit 1
fi

# Prove role safety, real login credentials, and the complete logical database matrix.
for index in "${!roles[@]}"; do
  role_name="${roles[$index]}"
  role_password="${passwords[$index]}"
  expected_database="${expected_databases[$index]}"

  safe_attributes="$(
    PGPASSWORD="$POSTGRES_ADMIN_PASSWORD" psql \
      --username "$POSTGRES_ADMIN_USER" \
      --dbname "$POSTGRES_ADMIN_DATABASE" \
      --no-password \
      --tuples-only \
      --no-align \
      --set ON_ERROR_STOP=1 \
      --set "checked_role=$role_name" <<'SQL'
SELECT rolcanlogin
  AND NOT rolsuper
  AND NOT rolcreatedb
  AND NOT rolcreaterole
  AND NOT rolreplication
  AND NOT rolbypassrls
  AND NOT EXISTS (
    SELECT 1 FROM pg_auth_members WHERE pg_auth_members.member = pg_roles.oid
  )
FROM pg_roles
WHERE rolname = :'checked_role';
SQL
  )"
  if [[ "$safe_attributes" != "t" ]]; then
    echo "Role $role_name is missing or has unsafe cluster attributes." >&2
    exit 1
  fi

  identity="$(
    PGPASSWORD="$role_password" psql \
      --username "$role_name" \
      --dbname "$expected_database" \
      --no-password \
      --tuples-only \
      --no-align \
      --set ON_ERROR_STOP=1 \
      --command "SELECT current_user || '|' || current_database()"
  )"
  if [[ "$identity" != "$role_name|$expected_database" ]]; then
    echo "Role $role_name did not connect to its intended database." >&2
    exit 1
  fi

  for database_name in "${logical_databases[@]}"; do
    connection_allowed="$(
      PGPASSWORD="$POSTGRES_ADMIN_PASSWORD" psql \
        --username "$POSTGRES_ADMIN_USER" \
        --dbname "$POSTGRES_ADMIN_DATABASE" \
        --no-password \
        --tuples-only \
        --no-align \
        --set ON_ERROR_STOP=1 \
        --set "checked_role=$role_name" \
        --set "checked_database=$database_name" <<'SQL'
SELECT has_database_privilege(:'checked_role', :'checked_database', 'CONNECT');
SQL
    )"

    if [[ "$database_name" == "$expected_database" && "$connection_allowed" != "t" ]]; then
      echo "Role $role_name cannot connect to $database_name." >&2
      exit 1
    fi
    if [[ "$database_name" != "$expected_database" && "$connection_allowed" != "f" ]]; then
      echo "Role $role_name can unexpectedly connect to $database_name." >&2
      exit 1
    fi

    create_allowed="$(
      PGPASSWORD="$POSTGRES_ADMIN_PASSWORD" psql \
        --username "$POSTGRES_ADMIN_USER" \
        --dbname "$POSTGRES_ADMIN_DATABASE" \
        --no-password \
        --tuples-only \
        --no-align \
        --set ON_ERROR_STOP=1 \
        --set "checked_role=$role_name" \
        --set "checked_database=$database_name" <<'SQL'
SELECT has_database_privilege(:'checked_role', :'checked_database', 'CREATE');
SQL
    )"

    expected_create="f"
    for owner_role in "${owner_roles[@]}"; do
      if [[ "$role_name" == "$owner_role" && "$database_name" == "$expected_database" ]]; then
        expected_create="t"
        break
      fi
    done

    if [[ "$create_allowed" != "$expected_create" ]]; then
      echo "Role $role_name CREATE on $database_name was $create_allowed; expected $expected_create." >&2
      exit 1
    fi
  done

  echo "PASS: $role_name is safe and has only its intended database capabilities."
done

for index in "${!logical_databases[@]}"; do
  database_name="${logical_databases[$index]}"
  owner_name="${owner_roles[$index]}"
  database_owner="$(
    admin_scalar "$POSTGRES_ADMIN_DATABASE" \
      "SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = '$database_name'"
  )"
  schema_owner="$(
    admin_scalar "$database_name" \
      "SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname = 'public'"
  )"

  if [[ "$database_owner" != "$owner_name" || "$schema_owner" != "$owner_name" ]]; then
    echo "$owner_name does not own $database_name and its public schema." >&2
    exit 1
  fi
done

unexpected_owner="$(
  admin_scalar "$PLATFORM_DATABASE_NAME" \
    "SELECT string_agg(relname, ', ' ORDER BY relname) FROM pg_class JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace WHERE nspname = 'public' AND relkind IN ('r', 'p', 'S') AND pg_get_userbyid(relowner) <> '$PLATFORM_MIGRATOR_USER'"
)"
if [[ -n "$unexpected_owner" ]]; then
  echo "Platform objects not owned by the migrator: $unexpected_owner." >&2
  exit 1
fi

required_tables=(
  users document document_object document_object_reservation
  correction_session correction_edit correction_event_outbox migrations
)
for table_name in "${required_tables[@]}"; do
  exists="$(admin_scalar "$PLATFORM_DATABASE_NAME" "SELECT to_regclass('public.$table_name') IS NOT NULL")"
  if [[ "$exists" != "t" ]]; then
    echo "Missing required Platform database table: $table_name." >&2
    exit 1
  fi
done

assert_table_privileges "$PLATFORM_RUNTIME_USER" users "t,t,t,f,f,f,f,f"
assert_table_privileges "$PLATFORM_RUNTIME_USER" document "t,t,t,f,f,f,f,f"
assert_table_privileges "$PLATFORM_RUNTIME_USER" document_object "t,t,f,f,f,f,f,f"
assert_table_privileges "$PLATFORM_RUNTIME_USER" document_object_reservation "t,t,t,f,f,f,f,f"
assert_table_privileges "$GATEWAY_CORRECTION_RUNTIME_USER" correction_session "t,t,t,f,f,f,f,f"
assert_table_privileges "$GATEWAY_CORRECTION_RUNTIME_USER" correction_edit "t,t,t,f,f,f,f,f"
assert_table_privileges "$GATEWAY_CORRECTION_RUNTIME_USER" correction_event_outbox "t,t,t,f,f,f,f,f"

for table_name in correction_session correction_edit correction_event_outbox migrations; do
  assert_table_privileges "$PLATFORM_RUNTIME_USER" "$table_name" "f,f,f,f,f,f,f,f"
done
for table_name in users document document_object document_object_reservation migrations; do
  assert_table_privileges "$GATEWAY_CORRECTION_RUNTIME_USER" "$table_name" "f,f,f,f,f,f,f,f"
done

schema_privileges="$(
  PGPASSWORD="$POSTGRES_ADMIN_PASSWORD" psql \
    --username "$POSTGRES_ADMIN_USER" \
    --dbname "$PLATFORM_DATABASE_NAME" \
    --no-password \
    --tuples-only \
    --no-align \
    --set ON_ERROR_STOP=1 \
    --set "platform_runtime=$PLATFORM_RUNTIME_USER" \
    --set "gateway_runtime=$GATEWAY_CORRECTION_RUNTIME_USER" <<'SQL'
SELECT concat_ws(
  ',',
  has_schema_privilege(:'platform_runtime', 'public', 'USAGE'),
  has_schema_privilege(:'platform_runtime', 'public', 'CREATE'),
  has_schema_privilege(:'gateway_runtime', 'public', 'USAGE'),
  has_schema_privilege(:'gateway_runtime', 'public', 'CREATE')
);
SQL
)"
if [[ "$schema_privileges" != "t,f,t,f" ]]; then
  echo "Runtime schema privileges were $schema_privileges; expected t,f,t,f." >&2
  exit 1
fi

function_privileges="$(
  PGPASSWORD="$POSTGRES_ADMIN_PASSWORD" psql \
    --username "$POSTGRES_ADMIN_USER" \
    --dbname "$PLATFORM_DATABASE_NAME" \
    --no-password \
    --tuples-only \
    --no-align \
    --set ON_ERROR_STOP=1 \
    --set "platform_runtime=$PLATFORM_RUNTIME_USER" \
    --set "gateway_runtime=$GATEWAY_CORRECTION_RUNTIME_USER" <<'SQL'
SELECT concat_ws(
  ',',
  has_function_privilege(:'platform_runtime', 'public.uuid_generate_v4()', 'EXECUTE'),
  has_function_privilege(:'gateway_runtime', 'public.uuid_generate_v4()', 'EXECUTE')
);
SQL
)"
if [[ "$function_privileges" != "t,t" ]]; then
  echo "Runtime UUID function privileges were $function_privileges; expected t,t." >&2
  exit 1
fi

expect_denied "$PLATFORM_RUNTIME_USER" "$PLATFORM_RUNTIME_PASSWORD" "$PLATFORM_DATABASE_NAME" \
  "BEGIN; UPDATE public.document_object SET id = id WHERE false; ROLLBACK;" \
  "Platform runtime UPDATE on document_object"
expect_denied "$PLATFORM_RUNTIME_USER" "$PLATFORM_RUNTIME_PASSWORD" "$PLATFORM_DATABASE_NAME" \
  "BEGIN; DELETE FROM public.document_object WHERE false; ROLLBACK;" \
  "Platform runtime DELETE on document_object"
expect_denied "$PLATFORM_RUNTIME_USER" "$PLATFORM_RUNTIME_PASSWORD" "$PLATFORM_DATABASE_NAME" \
  "BEGIN; TRUNCATE public.document_object; ROLLBACK;" \
  "Platform runtime TRUNCATE on document_object"
expect_denied "$PLATFORM_RUNTIME_USER" "$PLATFORM_RUNTIME_PASSWORD" "$PLATFORM_DATABASE_NAME" \
  "BEGIN; CREATE TABLE public.platform_runtime_ddl_probe(id integer); ROLLBACK;" \
  "Platform runtime schema DDL"
expect_denied "$GATEWAY_CORRECTION_RUNTIME_USER" "$GATEWAY_CORRECTION_RUNTIME_PASSWORD" "$PLATFORM_DATABASE_NAME" \
  "BEGIN; CREATE TABLE public.gateway_runtime_ddl_probe(id integer); ROLLBACK;" \
  "gateway correction runtime schema DDL"
expect_denied "$GATEWAY_CORRECTION_RUNTIME_USER" "$GATEWAY_CORRECTION_RUNTIME_PASSWORD" "$PLATFORM_DATABASE_NAME" \
  "SELECT 1 FROM public.users LIMIT 0;" \
  "gateway correction runtime Platform-table access"
expect_denied "$GATEWAY_CORRECTION_RUNTIME_USER" "$GATEWAY_CORRECTION_RUNTIME_PASSWORD" "$PLATFORM_DATABASE_NAME" \
  "SELECT 1 FROM public.migrations LIMIT 0;" \
  "gateway correction runtime migration-history access"
expect_denied "$PLATFORM_RUNTIME_USER" "$PLATFORM_RUNTIME_PASSWORD" "$PLATFORM_DATABASE_NAME" \
  "SELECT 1 FROM public.correction_session LIMIT 0;" \
  "Platform runtime legacy correction access"

echo "PASS: Platform objects are migrator-owned and runtime grants match the table allowlists."
echo "PASS: runtime DDL, immutable-object mutation, cross-domain access, and migration access are denied."
echo "PASS: PostgreSQL 18 checksums are enabled."
echo "PASS: connection budget uses $planned_connections of $available_connections non-reserved slots."
