import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

import { ACCESS_KEY_ID_PATTERN, POSITIVE_INTEGER_PATTERN, SECRET_PATTERN } from './constants.mjs';

/**
 * Returns a stable error class name without exposing an error message or payload.
 *
 * @param {unknown} error - Caught value.
 * @returns {string} Safe error class name.
 */
export function errorName(error) {
  if (error instanceof Error) {
    return error.name;
  }

  return 'UnknownError';
}

/**
 * Generates a Garage access-key identifier without exposing it in command arguments.
 *
 * @returns {string} Garage-compatible access-key identifier.
 */
export function generateAccessKeyId() {
  return `GK${randomBytes(12).toString('hex')}`;
}

/**
 * Generates a 256-bit lowercase hexadecimal Garage secret.
 *
 * @returns {string} Garage-compatible secret.
 */
export function generateSecret() {
  return randomBytes(32).toString('hex');
}

/**
 * Reports whether a configured value satisfies the selected Garage credential contract.
 *
 * @param {string} name - Environment variable name.
 * @param {string} value - Candidate credential value.
 * @returns {boolean} Whether the value has the required Garage format.
 */
export function isValidCredential(name, value) {
  if (name.endsWith('_ACCESS_KEY_ID')) {
    return ACCESS_KEY_ID_PATTERN.test(value);
  }

  return SECRET_PATTERN.test(value);
}

/**
 * Parses a bounded positive integer from local infrastructure configuration.
 *
 * @param {Record<string, string>} environment - Parsed local environment.
 * @param {string} name - Environment variable name.
 * @param {number} maximum - Largest accepted value.
 * @returns {number} Parsed positive integer.
 */
export function positiveInteger(environment, name, maximum) {
  const raw = required(environment, name);
  assert.match(raw, POSITIVE_INTEGER_PATTERN, `${name} must be a positive integer`);

  const value = Number(raw);
  assert.ok(Number.isSafeInteger(value) && value <= maximum, `${name} is out of range`);

  return value;
}

/**
 * Reads one required value while preserving explicit shell overrides.
 *
 * @param {Record<string, string>} environment - Parsed local environment.
 * @param {string} name - Environment variable name.
 * @returns {string} Required configuration value.
 */
export function required(environment, name) {
  const value = process.env[name] ?? environment[name];
  assert.ok(value, `Missing ${name}`);

  return value;
}

/**
 * Replaces one env assignment or appends it without parsing arbitrary shell syntax.
 *
 * @param {string} content - Existing env-file content.
 * @param {string} name - Environment variable name.
 * @param {string} value - Replacement value.
 * @returns {string} Updated env-file content.
 */
export function setAssignment(content, name, value) {
  const assignment = `${name}=${value}`;
  const lines = content.split('\n');
  let index = -1;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    if (lines[lineIndex].startsWith(`${name}=`)) {
      index = lineIndex;
      break;
    }
  }

  if (index >= 0) {
    lines[index] = assignment;

    return lines.join('\n');
  }

  const separator = content.length === 0 || content.endsWith('\n') ? '' : '\n';

  return `${content}${separator}${assignment}\n`;
}
