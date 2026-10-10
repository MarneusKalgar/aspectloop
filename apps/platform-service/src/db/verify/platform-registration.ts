import 'reflect-metadata';
import { AUTH_ERROR_CODE } from '@aspectloop/contracts/platform';
import { ConfigService } from '@nestjs/config';

import { validateEnv } from '#app/config/env.validation';

import {
  assertAuthError,
  assertLocalVerificationTarget,
  createVerificationDataSource,
  FaultInjectingOpaqueTokenService,
  readCleanupDatabaseUrl,
  reportScenario,
} from './auth-sessions/verification-support';
import { verifyReplacementOrderings } from './registration/concurrency.scenarios';
import {
  verifyDurableCooldownAndMailFailure,
  verifyOwnedFailureCleanup,
  verifyRegistrationLockWait,
  verifyRegistrationRollback,
} from './registration/failure.scenarios';
import { verifyIdentityLimits } from './registration/identity-limit.scenarios';
import {
  verifyConfirmationRejections,
  verifyRegistrationCreation,
} from './registration/state.scenarios';
import {
  createRegistrationClient,
  createVerificationMail,
  OwnedRegistrationFixtures,
} from './registration/verification-support';

/** Masks all assertion/provider details because captured tokens and passwords stay private. */
function handleFailure(error: unknown): void {
  const name = error instanceof Error ? error.name : 'UnknownError';
  console.error(`D2 registration verification failed (${name}); private details omitted.`);
  process.exitCode = 1;
}

/** Runs prepared production commands against local PostgreSQL/Mailpit; no public route is introduced. */
async function main(): Promise<void> {
  if (process.argv.length !== 2) {
    throw new Error('Registration verification accepts no additional arguments');
  }

  const environment = validateEnv(process.env);
  const cleanupUrl = readCleanupDatabaseUrl();
  assertLocalVerificationTarget(environment.DATABASE_URL, cleanupUrl);
  const mail = createVerificationMail(environment);
  const faultTokens = new FaultInjectingOpaqueTokenService(new ConfigService(environment));
  const first = createRegistrationClient(environment, mail, faultTokens);
  const second = createRegistrationClient(environment, mail);
  const cleanup = createVerificationDataSource(cleanupUrl, environment, 1);
  const fixtures = new OwnedRegistrationFixtures(cleanup);
  const completed: [string, string][] = [];

  try {
    const initializations = await Promise.allSettled([
      first.dataSource.initialize(),
      second.dataSource.initialize(),
      cleanup.initialize(),
    ]);

    for (const initialization of initializations) {
      if (initialization.status === 'rejected') {
        throw initialization.reason;
      }
    }

    const originalSession = await verifyRegistrationCreation(
      first,
      second,
      cleanup,
      fixtures,
      mail,
      environment,
    );
    completed.push([
      'D2-REG-01',
      'atomic concurrent signup, generic identity outcomes, digest-only mail and unchanged profile',
    ]);
    await verifyConfirmationRejections(first, second, cleanup, fixtures, mail, environment);
    completed.push(['D2-REG-02', 'uniform invalid candidates and exactly one concurrent consume']);
    await verifyReplacementOrderings(first, second, cleanup, fixtures, mail, environment);
    completed.push(['D2-REG-03', 'both real PostgreSQL replacement/consume lock orderings']);
    await verifyRegistrationRollback(first, fixtures, mail, environment, faultTokens);
    completed.push(['D2-REG-04', 'user/token rollback and persisted wrong-purpose rejection']);
    await verifyDurableCooldownAndMailFailure(first, cleanup, fixtures, environment);
    completed.push([
      'D2-REG-05',
      'terminal cooldown across limiter restart and controlled D1 failure receipts',
    ]);
    await verifyRegistrationLockWait(first, cleanup, fixtures, mail, environment);
    completed.push([
      'D2-REG-06',
      'bounded runtime-role lock wait and safe dependency classification',
    ]);
    await verifyIdentityLimits(first, fixtures, mail, environment);
    completed.push([
      'D2-REG-07',
      'live sign-in parallel/unknown identity threshold and correct-unverified reset',
    ]);
    await verifyOwnedFailureCleanup(first, cleanup, mail, environment, originalSession);
    completed.push([
      'D2-REG-08',
      'post-commit response/capture failure cleanup preserves unrelated owned state',
    ]);
    await first.sessions.validateBrowserSession(originalSession, false);
    await first.sessions.signOutBrowserSession(originalSession);
    await assertAuthError(
      first.sessions.validateBrowserSession(originalSession, false),
      AUTH_ERROR_CODE.SESSION_INVALID,
    );
    completed.push([
      'D2-REG-09',
      'confirmation/registration preserve an independent existing session',
    ]);
    await mail.drain();
  } finally {
    try {
      mail.shutdown();
    } finally {
      try {
        if (cleanup.isInitialized) {
          await fixtures.cleanup();
        }
      } finally {
        await Promise.all(
          [first.dataSource, second.dataSource, cleanup]
            /** Closes only successfully initialized owned pools. */
            .filter((source) => source.isInitialized)
            /** Releases runtime and cleanup roles even if exact fixture cleanup failed. */
            .map((source) => source.destroy()),
        );
      }
    }
  }

  for (const [id, summary] of completed) {
    reportScenario(id, summary);
  }

  console.log(
    'D2 registration verification passed; exact owned database and mail cleanup completed.',
  );
}

void main().catch(handleFailure);
