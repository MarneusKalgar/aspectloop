import { chmodSync, existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

import {
  CREDENTIAL_NAMES,
  CREDENTIAL_PLACEHOLDER,
  DEFAULT_ASSIGNMENTS,
  ENV_FILE,
} from './constants.mjs';
import {
  errorName,
  generateAccessKeyId,
  generateSecret,
  isValidCredential,
  setAssignment,
} from './utils.mjs';

/**
 * Initializes missing Garage defaults and preserves every established valid secret.
 *
 * @returns {void}
 */
function main() {
  if (!existsSync(ENV_FILE)) {
    throw new Error('Copy infra/local/.env.example to infra/local/.env.local first');
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
    const temporaryFile = `${ENV_FILE}.${process.pid}.tmp`;

    try {
      writeFileSync(temporaryFile, content, { mode: 0o600 });
      renameSync(temporaryFile, ENV_FILE);
    } finally {
      rmSync(temporaryFile, { force: true });
    }
  }

  chmodSync(ENV_FILE, 0o600);
  console.log(
    changed ? 'Initialized ignored local Garage credentials.' : 'Keeping local Garage credentials.',
  );
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
