import { fileURLToPath } from 'node:url';

/**
 * Absolute path to the ignored local infrastructure environment file.
 *
 * @type {string}
 */
export const ENV_FILE = fileURLToPath(new URL('../.env.local', import.meta.url));

/**
 * Absolute path to the ignored gateway local environment file.
 *
 * @type {string}
 */
export const GATEWAY_ENV_FILE = fileURLToPath(
  new URL('../../../apps/gateway-api/.env.local', import.meta.url),
);

/**
 * Compose project names start with an alphanumeric character and then allow
 * alphanumeric characters, underscores, and hyphens.
 *
 * @type {RegExp}
 */
export const COMPOSE_PROJECT_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

/**
 * Garage's local server region. This is infrastructure topology, not an
 * operator-selectable application setting.
 *
 * @type {string}
 */
export const LOCAL_GARAGE_REGION = 'garage';

/**
 * Garage zones start with an alphanumeric character and then allow alphanumeric
 * characters, underscores, and hyphens.
 *
 * @type {RegExp}
 */
export const GARAGE_ZONE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

/**
 * Local bucket names contain 3-63 lowercase alphanumeric, dot, or hyphen
 * characters and must start and end with an alphanumeric character.
 *
 * @type {RegExp}
 */
export const S3_BUCKET_NAME_PATTERN = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

/**
 * Garage access-key identifiers use the literal GK prefix and 24 lowercase
 * hexadecimal characters.
 *
 * @type {RegExp}
 */
export const ACCESS_KEY_ID_PATTERN = /^GK[a-f0-9]{24}$/;

/**
 * Garage RPC and S3 secrets contain exactly 64 lowercase hexadecimal characters.
 *
 * @type {RegExp}
 */
export const SECRET_PATTERN = /^[a-f0-9]{64}$/;

/**
 * Positive integers use unsigned base-10 digits without a leading zero.
 *
 * @type {RegExp}
 */
export const POSITIVE_INTEGER_PATTERN = /^[1-9][0-9]*$/;

/**
 * Exact non-secret marker replaced by the local credential initializer.
 *
 * @type {string}
 */
export const CREDENTIAL_PLACEHOLDER = 'generate-with-local-garage-init';

/**
 * Garage secrets and access-key identifiers managed by the initializer.
 *
 * @type {Readonly<string[]>}
 */
export const CREDENTIAL_NAMES = Object.freeze([
  'GARAGE_RPC_SECRET',
  'PLATFORM_S3_ACCESS_KEY_ID',
  'PLATFORM_S3_SECRET_ACCESS_KEY',
  'EXTRACTION_S3_ACCESS_KEY_ID',
  'EXTRACTION_S3_SECRET_ACCESS_KEY',
  'CORRECTION_S3_ACCESS_KEY_ID',
  'CORRECTION_S3_SECRET_ACCESS_KEY',
]);

/**
 * Non-secret Garage defaults appended when an older local env file lacks them.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const DEFAULT_ASSIGNMENTS = Object.freeze({
  CORRECTION_S3_BUCKET: 'aspectloop-correction-artifacts',
  EXTRACTION_S3_BUCKET: 'aspectloop-extraction-artifacts',
  GARAGE_ADMIN_PORT: '3903',
  GARAGE_CAPACITY_BYTES: '1000000000',
  GARAGE_HOST: '127.0.0.1',
  GARAGE_S3_PORT: '3900',
  GARAGE_ZONE: 'local',
  PLATFORM_S3_BUCKET: 'aspectloop-platform-source',
});

/**
 * Gateway-local S3 settings whose values are derived from infrastructure config.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const GATEWAY_S3_DEFAULTS = Object.freeze({
  S3_FORCE_PATH_STYLE: 'true',
  S3_REQUEST_TIMEOUT_MS: '5000',
});

/**
 * Service owners that receive isolated Garage buckets and credentials.
 *
 * @type {Readonly<string[]>}
 */
export const GARAGE_OWNERS = Object.freeze(['PLATFORM', 'EXTRACTION', 'CORRECTION']);

/**
 * Expected status for denied S3 bucket access.
 *
 * @type {number}
 */
export const ACCESS_DENIED_STATUS = 403;

/**
 * Expected status for a healthy Garage Admin API.
 *
 * @type {number}
 */
export const HEALTHY_STATUS = 200;

/**
 * Expected transient status while Garage layout converges.
 *
 * @type {number}
 */
export const UNAVAILABLE_STATUS = 503;

/**
 * Number of bounded Garage readiness attempts.
 *
 * @type {number}
 */
export const READINESS_ATTEMPTS = 15;

/**
 * Delay between Garage readiness attempts.
 *
 * @type {number}
 */
export const READINESS_DELAY_MS = 1000;

/**
 * Timeout for one Garage HTTP operation.
 *
 * @type {number}
 */
export const OPERATION_TIMEOUT_MS = 5000;

/**
 * Timeout for one native Garage CLI process.
 *
 * @type {number}
 */
export const CLI_TIMEOUT_MS = 10_000;

/**
 * Maximum valid TCP port.
 *
 * @type {number}
 */
export const MAX_PORT = 65535;

/**
 * Expected local single-node Garage layout version.
 *
 * @type {number}
 */
export const LAYOUT_VERSION = 1;
