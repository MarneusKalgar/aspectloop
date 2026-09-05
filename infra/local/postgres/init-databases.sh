#!/usr/bin/env bash

set -euo pipefail

required_variables=(
  POSTGRES_USER
  POSTGRES_PASSWORD
  POSTGRES_DB
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
    echo "Missing required PostgreSQL bootstrap variable: $variable_name" >&2
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

for first_index in "${!database_names[@]}"; do
  if [[ "${database_names[$first_index]}" == "$POSTGRES_DB" ]]; then
    echo "Service database names must differ from the bootstrap database." >&2
    exit 1
  fi

  if [[ "${role_names[$first_index]}" == "$POSTGRES_USER" ]]; then
    echo "Service roles must differ from the bootstrap administrator." >&2
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

    if [[ "${role_names[$first_index]}" == "${role_names[$second_index]}" ]]; then
      echo "Service role names must be unique." >&2
      exit 1
    fi
  done
done

export PGPASSWORD="$POSTGRES_PASSWORD"

psql \
  --host "${PGHOST:-/var/run/postgresql}" \
  --port "${PGPORT:-5432}" \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --no-password \
  --set ON_ERROR_STOP=1 \
  --set "admin_database=$POSTGRES_DB" <<'SQL'
SELECT format('REVOKE CONNECT ON DATABASE %I FROM PUBLIC', :'admin_database') \gexec
REVOKE CONNECT ON DATABASE template1 FROM PUBLIC;
SQL

for index in "${!database_names[@]}"; do
  database_name="${database_names[$index]}"
  role_name="${role_names[$index]}"
  role_password="${role_passwords[$index]}"

  psql \
    --host "${PGHOST:-/var/run/postgresql}" \
    --port "${PGPORT:-5432}" \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    --no-password \
    --set ON_ERROR_STOP=1 \
    --set "database_name=$database_name" \
    --set "role_name=$role_name" \
    --set "role_password=$role_password" <<'SQL'
SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION',
  :'role_name',
  :'role_password'
)
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'role_name') \gexec

SELECT format(
  'ALTER ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION',
  :'role_name',
  :'role_password'
) \gexec

SELECT format('CREATE DATABASE %I OWNER %I', :'database_name', :'role_name')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'database_name') \gexec

SELECT format('ALTER DATABASE %I OWNER TO %I', :'database_name', :'role_name') \gexec
SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', :'database_name') \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', :'database_name', :'role_name') \gexec
SQL

  psql \
    --host "${PGHOST:-/var/run/postgresql}" \
    --port "${PGPORT:-5432}" \
    --username "$POSTGRES_USER" \
    --dbname "$database_name" \
    --no-password \
    --set ON_ERROR_STOP=1 \
    --set "role_name=$role_name" <<'SQL'
SELECT format('ALTER SCHEMA public OWNER TO %I', :'role_name') \gexec
REVOKE ALL ON SCHEMA public FROM PUBLIC;
SELECT format('GRANT USAGE, CREATE ON SCHEMA public TO %I', :'role_name') \gexec
SQL
done

echo "Initialized platform, extraction, and correction database ownership."
