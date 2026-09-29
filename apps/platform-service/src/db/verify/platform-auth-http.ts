import 'reflect-metadata';
import {
  PLATFORM_IDENTITY_POLICY,
  platformSignInPasswordSchema,
} from '@aspectloop/contracts/platform';
import { randomBytes } from 'node:crypto';

import { validateEnv } from '#app/config/env.validation';

import { assertLocalHttpDestinations } from './auth-http/client';
import {
  createOwnedAuthFixture,
  type OwnedAuthFixture,
  readPrivateFixturePassword,
  removeOwnedAuthFixture,
} from './auth-http/fixture';
import { verifyAuthHttpScenarios } from './auth-http/scenarios';
import {
  assertLocalVerificationTarget,
  createVerificationDataSource,
  readCleanupDatabaseUrl,
} from './auth-sessions/verification-support';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Omits all credential-bearing failure details from verification output. */
function handleFailure(error: unknown): void {
  const name = error instanceof Error ? error.name : 'UnknownError';
  console.error(`Platform auth HTTP verification failed (${name}); details omitted.`);
  process.exitCode = 1;
}

/** Runs only the requested local HTTP or private-browser fixture action. */
async function main(): Promise<void> {
  const mode = process.argv[2];
  const environment = validateEnv(process.env);
  const cleanupUrl = readCleanupDatabaseUrl();
  assertLocalVerificationTarget(environment.DATABASE_URL, cleanupUrl);
  assertLocalHttpDestinations();

  if (
    (mode !== '--http' && mode !== '--fixture-create' && mode !== '--fixture-cleanup') ||
    (mode === '--fixture-cleanup' && !UUID_PATTERN.test(process.argv[3] ?? ''))
  ) {
    throw new Error('Expected --http, --fixture-create, or --fixture-cleanup UUID');
  }

  const runtime = createVerificationDataSource(environment.DATABASE_URL, environment, 2);
  const cleanup = createVerificationDataSource(cleanupUrl, environment, 1);
  let fixture: null | OwnedAuthFixture = null;

  try {
    await Promise.all([runtime.initialize(), cleanup.initialize()]);

    if (mode === '--fixture-cleanup') {
      await removeOwnedAuthFixture(cleanup, process.argv[3] ?? '');
      console.log('Private browser fixture cleanup completed.');
      return;
    }

    const password =
      mode === '--fixture-create'
        ? await readPrivateFixturePassword()
        : randomBytes(32).toString('base64url');

    if (password.length < 12 || !platformSignInPasswordSchema.safeParse(password).success) {
      throw new Error(
        `Fixture password must contain 12-${PLATFORM_IDENTITY_POLICY.PASSWORD_MAX_UTF8_BYTES} supported characters`,
      );
    }

    fixture = await createOwnedAuthFixture(runtime, environment, password);

    if (mode === '--fixture-create') {
      console.log(`Private browser fixture ID: ${fixture.id}`);
      console.log(`Private browser fixture email: ${fixture.email}`);
      console.log('Use the supplied password only in the local browser; clean up by fixture ID.');
      fixture = null;
      return;
    }

    await verifyAuthHttpScenarios(cleanup, fixture, password);
    console.log('Default-stack browser-session HTTP verification passed.');
  } finally {
    try {
      if (fixture && cleanup.isInitialized) {
        await removeOwnedAuthFixture(cleanup, fixture.id);
      }
    } finally {
      await Promise.all(
        [runtime, cleanup]
          /** Closes only data sources that completed initialization. */
          .filter((dataSource) => dataSource.isInitialized)
          /** Releases each owned connection even when fixture cleanup failed. */
          .map((dataSource) => dataSource.destroy()),
      );
    }
  }
}

void main().catch(handleFailure);
