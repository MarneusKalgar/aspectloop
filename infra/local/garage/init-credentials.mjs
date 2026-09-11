import { chmodSync, existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

import {
  CREDENTIAL_NAMES,
  CREDENTIAL_PLACEHOLDER,
  DEFAULT_ASSIGNMENTS,
  ENV_FILE,
  GATEWAY_ENV_FILE,
  GATEWAY_S3_DEFAULTS,
  LOCAL_GARAGE_REGION,
} from './constants.mjs';
import {
  errorName,
  generateAccessKeyId,
  generateSecret,
  isValidCredential,
  setAssignment,
} from './utils.mjs';

/**
 * Initializes infrastructure credentials and synchronizes the gateway-local S3 view.
 *
 * @returns {void}
 */
function main() {
  if (!existsSync(ENV_FILE)) {
    throw new Error('Copy infra/local/.env.example to infra/local/.env.local first');
  }

  if (!existsSync(GATEWAY_ENV_FILE)) {
    throw new Error('Copy apps/gateway-api/.env.example to apps/gateway-api/.env.local first');
  }

  const original = readFileSync(ENV_FILE, 'utf8');
  const environment = parseEnv(original);
  let content = original;
  let changed = false;

  for (const [name, value] of Object.entries(DEFAULT_ASSIGNMENTS)) {
    if (environment[name]) {
      continue;
    }

    content = setAssignment(content, name, value);
    changed = true;
  }

  for (const name of CREDENTIAL_NAMES) {
    const value = environment[name] ?? '';

    if (isValidCredential(name, value)) {
      continue;
    }

    if (value !== '' && value !== CREDENTIAL_PLACEHOLDER) {
      throw new Error(`${name} is set but does not match the Garage credential format`);
    }

    const generated = name.endsWith('_ACCESS_KEY_ID') ? generateAccessKeyId() : generateSecret();
    content = setAssignment(content, name, generated);
    changed = true;
  }

  if (changed) {
    writePrivateEnvFile(ENV_FILE, content);
  } else {
    chmodSync(ENV_FILE, 0o600);
  }

  const initializedEnvironment = parseEnv(content);
  const originalGateway = readFileSync(GATEWAY_ENV_FILE, 'utf8');
  const gatewayEnvironment = parseEnv(originalGateway);
  let gatewayContent = originalGateway;

  for (const [name, value] of Object.entries(GATEWAY_S3_DEFAULTS)) {
    if (gatewayEnvironment[name]) {
      continue;
    }

    gatewayContent = setAssignment(gatewayContent, name, value);
  }

  gatewayContent = setAssignment(
    gatewayContent,
    'S3_ENDPOINT',
    `http://${initializedEnvironment.GARAGE_HOST}:${initializedEnvironment.GARAGE_S3_PORT}`,
  );
  gatewayContent = setAssignment(gatewayContent, 'S3_REGION', LOCAL_GARAGE_REGION);

  for (const name of [
    'PLATFORM_S3_BUCKET',
    'PLATFORM_S3_ACCESS_KEY_ID',
    'PLATFORM_S3_SECRET_ACCESS_KEY',
  ]) {
    gatewayContent = setAssignment(gatewayContent, name, initializedEnvironment[name]);
  }

  if (gatewayContent !== originalGateway) {
    writePrivateEnvFile(GATEWAY_ENV_FILE, gatewayContent);
  } else {
    chmodSync(GATEWAY_ENV_FILE, 0o600);
  }

  console.log(
    changed || gatewayContent !== originalGateway
      ? 'Initialized ignored local Garage credentials.'
      : 'Keeping local Garage credentials.',
  );
}

/**
 * Atomically writes one ignored local env file with owner-only permissions.
 *
 * @param {string} filePath - Absolute ignored env-file path.
 * @param {string} content - Complete env-file content.
 * @returns {void}
 */
function writePrivateEnvFile(filePath, content) {
  const temporaryFile = `${filePath}.${process.pid}.tmp`;

  try {
    writeFileSync(temporaryFile, content, { mode: 0o600 });
    renameSync(temporaryFile, filePath);
  } finally {
    rmSync(temporaryFile, { force: true });
  }

  chmodSync(filePath, 0o600);
}

try {
  main();
} catch (error) {
  console.error(
    `Garage credential initialization failed (${errorName(error)}); ` +
      'configuration values were omitted.',
  );
  process.exitCode = 1;
}
