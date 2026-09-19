import assert from 'node:assert/strict';
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

import {
  EMAIL_PATTERN,
  ENV_FILE,
  MAXIMUM_PORT,
  MINIMUM_PASSWORD_LENGTH,
  PASSWORD_PLACEHOLDER,
  PLATFORM_MIGRATOR_SERVER_DEFINITION,
  POSITIVE_INTEGER_PATTERN,
  POSTGRES_ENDPOINT,
  SERVER_DEFINITIONS,
  SERVERS_FILE,
  SPECIAL_USE_EMAIL_SUFFIXES,
} from './constants.mjs';

/**
 * Validates local pgAdmin configuration and generates its server registry.
 *
 * @returns {void}
 */
function main() {
  if (!existsSync(ENV_FILE)) {
    throw new Error('Copy infra/local/.env.example to infra/local/.env.local first');
  }

  const environment = parseEnv(readFileSync(ENV_FILE, 'utf8'));
  const login = validateLogin(environment);
  writeRegistry(serverRegistry(environment));

  console.log(
    `Prepared password-free pgAdmin registrations for ${login.email} at ` +
      `http://127.0.0.1:${login.hostPort}.`,
  );
}

/**
 * Reads an optional strict boolean setting while preserving a shell override.
 *
 * @param {Record<string, string>} environment - Parsed infrastructure environment.
 * @param {string} name - Optional boolean environment variable name.
 * @returns {boolean} Parsed boolean value, defaulting to false.
 */
function optionalBoolean(environment, name) {
  const value = process.env[name] ?? environment[name] ?? 'false';
  assert.ok(value === 'true' || value === 'false', `${name} must be true or false`);

  return value === 'true';
}

/**
 * Parses and bounds one required TCP port.
 *
 * @param {Record<string, string>} environment - Parsed infrastructure environment.
 * @param {string} name - Port environment variable name.
 * @returns {number} Validated TCP port.
 */
function port(environment, name) {
  const raw = required(environment, name);
  assert.match(raw, POSITIVE_INTEGER_PATTERN, `${name} must be a positive integer`);

  const value = Number(raw);
  assert.ok(Number.isSafeInteger(value) && value <= MAXIMUM_PORT, `${name} is out of range`);

  return value;
}

/**
 * Reads one required setting while preserving an explicit shell override.
 *
 * @param {Record<string, string>} environment - Parsed infrastructure environment.
 * @param {string} name - Required environment variable name.
 * @returns {string} Configured value.
 */
function required(environment, name) {
  const value = process.env[name] ?? environment[name];
  assert.ok(value, `Missing ${name}`);

  return value;
}

/**
 * Builds password-free pgAdmin registrations from current database ownership.
 *
 * @param {Record<string, string>} environment - Parsed infrastructure environment.
 * @returns {{Servers: Record<string, object>}} pgAdmin import document.
 */
function serverRegistry(environment) {
  /** @type {Record<string, object>} */
  const servers = {};
  const definitions = [...SERVER_DEFINITIONS];

  if (optionalBoolean(environment, 'PGADMIN_INCLUDE_PLATFORM_MIGRATOR')) {
    definitions.push(PLATFORM_MIGRATOR_SERVER_DEFINITION);
  }

  for (const [index, definition] of definitions.entries()) {
    const database = required(environment, definition.databaseKey);
    const username = required(environment, definition.usernameKey);

    servers[String(index + 1)] = {
      DBRestriction: database,
      Group: definition.group,
      Host: POSTGRES_ENDPOINT.host,
      MaintenanceDB: database,
      Name: `${definition.label} (${username})`,
      Port: POSTGRES_ENDPOINT.port,
      SSLMode: POSTGRES_ENDPOINT.sslMode,
      Username: username,
    };
  }

  return { Servers: servers };
}

/**
 * Validates the pgAdmin login address against its special-use domain policy.
 *
 * @param {string} email - Candidate pgAdmin administrator address.
 * @returns {void}
 */
function validateEmail(email) {
  assert.match(email, EMAIL_PATTERN, 'PGADMIN_DEFAULT_EMAIL must be an email address');

  const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase();
  const specialUseSuffix = SPECIAL_USE_EMAIL_SUFFIXES.find(
    (suffix) => domain === suffix || domain.endsWith(`.${suffix}`),
  );

  assert.equal(
    specialUseSuffix,
    undefined,
    'PGADMIN_DEFAULT_EMAIL must not use a special-use or reserved domain',
  );
}

/**
 * Validates pgAdmin login settings without returning or logging the password.
 *
 * @param {Record<string, string>} environment - Parsed infrastructure environment.
 * @returns {{email: string, hostPort: number}} Safe login summary.
 */
function validateLogin(environment) {
  const email = required(environment, 'PGADMIN_DEFAULT_EMAIL');
  const password = required(environment, 'PGADMIN_DEFAULT_PASSWORD');

  validateEmail(email);
  assert.notEqual(
    password,
    PASSWORD_PLACEHOLDER,
    'Replace the pgAdmin password placeholder in infra/local/.env.local',
  );
  assert.ok(
    password.length >= MINIMUM_PASSWORD_LENGTH,
    `PGADMIN_DEFAULT_PASSWORD must contain at least ${MINIMUM_PASSWORD_LENGTH} characters`,
  );

  return {
    email,
    hostPort: port(environment, 'PGADMIN_PORT'),
  };
}

/**
 * Atomically writes the generated non-secret server registry.
 *
 * @param {{Servers: Record<string, object>}} registry - Complete pgAdmin import document.
 * @returns {void}
 */
function writeRegistry(registry) {
  const temporaryFile = `${SERVERS_FILE}.${process.pid}.tmp`;

  try {
    writeFileSync(temporaryFile, `${JSON.stringify(registry, null, 2)}\n`, { mode: 0o644 });
    renameSync(temporaryFile, SERVERS_FILE);
  } finally {
    rmSync(temporaryFile, { force: true });
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Unknown pgAdmin preparation error');
  process.exitCode = 1;
}
