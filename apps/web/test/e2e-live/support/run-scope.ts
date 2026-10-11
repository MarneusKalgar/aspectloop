import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { UUID_PATTERN } from './local-tool.mjs';

export interface RunOwnership {
  ids: [string, string];
  registrationId?: string;
}

export interface RunScope extends RunOwnership {
  runDir: string;
}

const OWNERSHIP_MAX_LENGTH = 256;

/** Parses bounded ownership data and returns only validated, distinct fixture identifiers. */
export function parseRunOwnership(raw: string): RunOwnership {
  if (raw.length > OWNERSHIP_MAX_LENGTH) {
    throw new Error('E1 ownership scope rejected');
  }

  let scope: unknown;

  try {
    scope = JSON.parse(raw);
  } catch {
    throw new Error('E1 ownership scope rejected');
  }

  if (!scope || typeof scope !== 'object' || Array.isArray(scope) || !('ids' in scope)) {
    throw new Error('E1 ownership scope rejected');
  }

  const ids = readFixtureIds(scope.ids);

  if (!('registrationId' in scope) || scope.registrationId === undefined) {
    return { ids };
  }

  if (!isFixtureId(scope.registrationId) || ids.includes(scope.registrationId)) {
    throw new Error('E1 ownership scope rejected');
  }

  return { ids, registrationId: scope.registrationId };
}

/** Reads only the admitted runner ledger; application runtime configuration is unrelated. */
export function readRunScope(): RunScope {
  const runDir = validateRunDirectory(process.env, tmpdir());
  const raw = readFileSync(join(runDir, 'scope.json'), 'utf8');

  return { ...parseRunOwnership(raw), runDir };
}

/** Admits only the local private runner's ephemeral directory and privacy switches. */
export function validateRunDirectory(
  environment: NodeJS.ProcessEnv,
  temporaryDirectory: string,
): string {
  const runDir = environment.ASPECTLOOP_E1_RUN_DIR;

  if (!runDir || environment.CI || environment.PLAYWRIGHT_NO_COPY_PROMPT !== '1') {
    throw new Error('Use the approved E1 live runner');
  }

  if (dirname(resolve(runDir)) !== resolve(temporaryDirectory)) {
    throw new Error('Use the approved E1 live runner');
  }

  if (!/[/\\]aspectloop-e1-[\w-]+$/.test(runDir)) {
    throw new Error('Use the approved E1 live runner');
  }

  return runDir;
}

/** Validates exact UUID syntax without admitting paths, credentials, or tool configuration. */
function isFixtureId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/** Narrows the required pair without an unchecked tuple assertion. */
function readFixtureIds(value: unknown): [string, string] {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error('E1 ownership scope rejected');
  }

  const ids: unknown[] = value;
  const [first, second] = ids;

  if (!isFixtureId(first) || !isFixtureId(second) || first === second) {
    throw new Error('E1 ownership scope rejected');
  }

  return [first, second];
}
