import { fileURLToPath } from 'node:url';

/**
 * Absolute path to the ignored local infrastructure environment file.
 *
 * @type {string}
 */
export const ENV_FILE = fileURLToPath(new URL('../.env.local', import.meta.url));

/**
 * Absolute path to the generated password-free pgAdmin server registry.
 *
 * @type {string}
 */
export const SERVERS_FILE = fileURLToPath(new URL('./servers.local.json', import.meta.url));

/**
 * Exact example value that must be replaced before pgAdmin starts.
 *
 * @type {string}
 */
export const PASSWORD_PLACEHOLDER = 'replace-with-local-only-password';

/**
 * A local pgAdmin login uses one non-space address segment on each side of `@`.
 *
 * @type {RegExp}
 */
export const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+$/;

/**
 * Domains rejected by pgAdmin's email validator despite having valid email shape.
 *
 * @type {ReadonlyArray<string>}
 */
export const SPECIAL_USE_EMAIL_SUFFIXES = Object.freeze([
  'example.com',
  'example.net',
  'example.org',
  'invalid',
  'local',
  'localhost',
  'test',
]);

/**
 * Positive integers use unsigned base-10 digits without a leading zero.
 *
 * @type {RegExp}
 */
export const POSITIVE_INTEGER_PATTERN = /^[1-9][0-9]*$/;

/**
 * Shortest accepted local pgAdmin login password.
 *
 * @type {number}
 */
export const MINIMUM_PASSWORD_LENGTH = 12;

/**
 * Largest valid TCP port.
 *
 * @type {number}
 */
export const MAXIMUM_PORT = 65_535;

/**
 * Compose-network PostgreSQL endpoint used by every generated registration.
 *
 * @type {{host: string, port: number, sslMode: string}}
 */
export const POSTGRES_ENDPOINT = Object.freeze({
  host: 'postgres',
  port: 5432,
  sslMode: 'disable',
});

/**
 * Runtime database and role environment keys exposed in pgAdmin by default.
 *
 * @type {ReadonlyArray<Readonly<{group: string, label: string, databaseKey: string, usernameKey: string}>>}
 */
export const SERVER_DEFINITIONS = Object.freeze([
  Object.freeze({
    databaseKey: 'PLATFORM_DATABASE_NAME',
    group: 'AspectLoop runtime roles',
    label: 'Platform database - service runtime',
    usernameKey: 'PLATFORM_RUNTIME_USER',
  }),
  Object.freeze({
    databaseKey: 'PLATFORM_DATABASE_NAME',
    group: 'AspectLoop runtime roles',
    label: 'Platform database - gateway correction runtime',
    usernameKey: 'GATEWAY_CORRECTION_RUNTIME_USER',
  }),
  Object.freeze({
    databaseKey: 'EXTRACTION_DATABASE_NAME',
    group: 'AspectLoop service roles',
    label: 'Extraction database',
    usernameKey: 'EXTRACTION_DATABASE_USER',
  }),
  Object.freeze({
    databaseKey: 'CORRECTION_DATABASE_NAME',
    group: 'AspectLoop service roles',
    label: 'Correction database',
    usernameKey: 'CORRECTION_DATABASE_USER',
  }),
]);

/**
 * Privileged Platform owner registration hidden unless explicitly requested.
 *
 * @type {Readonly<{group: string, label: string, databaseKey: string, usernameKey: string}>}
 */
export const PLATFORM_MIGRATOR_SERVER_DEFINITION = Object.freeze({
  databaseKey: 'PLATFORM_DATABASE_NAME',
  group: 'AspectLoop privileged roles',
  label: 'Platform database - owner/migrator (tool use only)',
  usernameKey: 'PLATFORM_MIGRATOR_USER',
});
