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
import { readPrivateFixtureInput } from './auth-http/private-fixture-input';
import { verifyAuthHttpScenarios } from './auth-http/scenarios';
import {
  assertLocalVerificationTarget,
  createVerificationDataSource,
  readCleanupDatabaseUrl,
} from './auth-sessions/verification-support';
import { verifyMailScenarios } from './mail/scenarios';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Omits all credential-bearing failure details from verification output. */
function handleFailure(error: unknown): void {
  const name = error instanceof Error ? error.name : 'UnknownError';
  console.error(`Platform auth HTTP verification failed (${name}); details omitted.`);
  process.exitCode = 1;
}

/** Runs only an explicit local HTTP, mail, or private-browser fixture action. */
async function main(): Promise<void> {
  const mode = process.argv[2];
  const environment = validateEnv(process.env);
  const cleanupUrl = readCleanupDatabaseUrl();
  assertLocalVerificationTarget(environment.DATABASE_URL, cleanupUrl);
  assertLocalHttpDestinations();
  const needsFixtureId = mode === '--fixture-cleanup' || mode === '--fixture-create-stdin';
  const mailMode = mode === '--mail' || mode === '--mail-outage';

  if (
    (mode !== '--http' && mode !== '--fixture-create' && !needsFixtureId && !mailMode) ||
    (needsFixtureId && !UUID_PATTERN.test(process.argv[3] ?? '')) ||
    process.argv.length !== (needsFixtureId ? 4 : 3)
  ) {
    throw new Error('Expected one explicit HTTP/private fixture mode');
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

    const privateInput = mode === '--fixture-create-stdin' ? await readPrivateFixtureInput() : null;

    if (privateInput && privateInput.id !== process.argv[3]) {
      throw new Error('Private fixture ownership mismatch');
    }

    let password: string;

    if (privateInput) {
      password = privateInput.password;
    } else if (mode === '--fixture-create') {
      password = await readPrivateFixturePassword();
    } else {
      password = randomBytes(32).toString('base64url');
    }

    if (password.length < 12 || !platformSignInPasswordSchema.safeParse(password).success) {
      throw new Error(
        `Fixture password must contain 12-${PLATFORM_IDENTITY_POLICY.PASSWORD_MAX_UTF8_BYTES} supported characters`,
      );
    }

    fixture = await createOwnedAuthFixture(runtime, environment, password, privateInput?.id);

    if (mode === '--fixture-create-stdin') {
      console.log(`E1_FIXTURE ${JSON.stringify(fixture)}`);
      fixture = null;
      return;
    }

    if (mode === '--fixture-create') {
      console.log(`Private browser fixture ID: ${fixture.id}`);
      console.log(`Private browser fixture email: ${fixture.email}`);
      console.log('Use the supplied password only in the local browser; clean up by fixture ID.');
      fixture = null;
      return;
    }

    if (mailMode) {
      await verifyMailScenarios(environment, fixture, password, mode === '--mail-outage');
      console.log('D1 local mail verification completed.');
    } else {
      await verifyAuthHttpScenarios(cleanup, fixture, password);
      console.log('Default-stack browser-session HTTP verification passed.');
    }
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
