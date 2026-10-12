import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { RunScope } from './run-scope.ts';

import { LIVE_TOOL_ACTION, runTool, UUID_PATTERN } from './local-tool.mjs';

export interface PrivateAccount {
  email: string;
  id: string;
  password: string;
}

export interface PrivateRegistration {
  email: string;
  password: string;
  readLink: () => Promise<{ id: string; token: string }>;
}

const ENVELOPE_MAX_LENGTH = 256;
const TOKEN_MAX_LENGTH = 128;

/** Creates one exact run-owned account via private stdin and validates its non-secret metadata. */
export async function createAccount(id: string): Promise<PrivateAccount> {
  const password = randomBytes(32).toString('base64url');
  const output = await runTool(LIVE_TOOL_ACTION.CREATE, {
    id,
    input: JSON.stringify({ id, password }),
  });
  const metadata = readFixtureEnvelope(output, 'E1_FIXTURE ');

  if (
    metadata.id !== id ||
    typeof metadata.email !== 'string' ||
    metadata.email !== `auth-http-${id}@example.test` ||
    Object.keys(metadata).length !== 2
  ) {
    throw new Error('E1 fixture metadata rejected');
  }

  return { email: metadata.email, id, password };
}

/** Reserves optional registration ownership before the browser can commit an ambiguous signup. */
export async function createRegistrationFixture(
  scope: RunScope,
): Promise<null | PrivateRegistration> {
  if (!scope.registrationId) {
    return null;
  }

  const id = scope.registrationId;
  const reserved = await runTool(LIVE_TOOL_ACTION.REGISTRATION_RESERVE, { id });

  if (!reserved.split('\n').includes('E2_RESERVED')) {
    throw new Error('E2 absent-recipient ownership prerequisite failed');
  }

  await writeFile(join(scope.runDir, 'registration-owned'), 'owned', { mode: 0o600 });

  return {
    email: `auth-http-${id}@example.test`,
    password: randomBytes(32).toString('base64url'),
    /** Reads one exact Mailpit link through a bounded private pipe, never raw reporting. */
    async readLink() {
      const output = await runTool(LIVE_TOOL_ACTION.REGISTRATION_TOKEN, { id });

      return parseRegistrationLink(output);
    },
  };
}

/** Validates one owned link without retaining diagnostics or projecting it into reporter output. */
export function parseRegistrationLink(output: string): { id: string; token: string } {
  const value = readFixtureEnvelope(output, 'E2_LINK ');

  if (typeof value.id !== 'string' || !UUID_PATTERN.test(value.id)) {
    throw new Error('E2 private link metadata rejected');
  }

  if (
    typeof value.token !== 'string' ||
    value.token.length > TOKEN_MAX_LENGTH ||
    !/^[A-Za-z0-9_.-]+$/.test(value.token)
  ) {
    throw new Error('E2 private link metadata rejected');
  }

  if (Object.keys(value).length !== 2) {
    throw new Error('E2 private link metadata rejected');
  }

  return { id: value.id, token: value.token };
}

/** Reads only a bounded private metadata envelope and discards native JSON diagnostics. */
function readFixtureEnvelope(
  output: string,
  prefix: 'E1_FIXTURE ' | 'E2_LINK ',
): Record<string, unknown> {
  const line = output.split('\n').find(
    /** Selects fixed metadata, never Docker/npm diagnostics. */
    (candidate) => candidate.startsWith(prefix),
  );

  if (!line || line.length > ENVELOPE_MAX_LENGTH) {
    throw new Error('Live private fixture metadata rejected');
  }

  let value: unknown;

  try {
    value = JSON.parse(line.slice(prefix.length));
  } catch {
    throw new Error('Live private fixture metadata rejected');
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Live private fixture metadata rejected');
  }

  return value as Record<string, unknown>;
}
