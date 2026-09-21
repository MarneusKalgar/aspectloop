import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

import { validateEnv } from '#app/config/env.validation';
import { User } from '#app/users/user.entity';

import {
  verifyBrowserSessionActivity,
  verifyBrowserSessionIssuance,
  verifyBrowserSessionLogoutOrderings,
  verifyBrowserSessionRejection,
} from './auth-sessions/browser-session.scenarios';
import {
  verifyBoundedLockWait,
  verifyDeletedUser,
  verifyExpiryBoundaries,
  verifyIndependentFamilies,
  verifyIssuancePersistence,
  verifyLogoutSemantics,
  verifyRefreshLogoutRace,
  verifyRotationAndReplay,
  verifyRotationRollback,
} from './auth-sessions/legacy-refresh.scenarios';
import {
  assertLocalVerificationTarget,
  createVerificationClient,
  createVerificationDataSource,
  FaultInjectingOpaqueTokenService,
  insertVerifiedUser,
  readCleanupDatabaseUrl,
  reportScenario,
} from './auth-sessions/verification-support';

/** Reports only the error class because auth errors may be credential-adjacent. */
function handleFailure(error: unknown): void {
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  console.error(`Platform auth-session verification failed (${errorName}); details omitted.`);
  process.exitCode = 1;
}

/** Runs real PostgreSQL verification through runtime credentials and cleans only its owned user. */
async function main(): Promise<void> {
  const environment = validateEnv(process.env);
  const cleanupDatabaseUrl = readCleanupDatabaseUrl();
  assertLocalVerificationTarget(environment.DATABASE_URL, cleanupDatabaseUrl);
  const faultInjectingTokens = new FaultInjectingOpaqueTokenService(new ConfigService(environment));
  const first = createVerificationClient(environment, faultInjectingTokens);
  const second = createVerificationClient(environment);
  const cleanup = createVerificationDataSource(cleanupDatabaseUrl, environment, 1);
  const userId = randomUUID();

  try {
    await Promise.all([
      first.dataSource.initialize(),
      second.dataSource.initialize(),
      cleanup.initialize(),
    ]);
    await insertVerifiedUser(first.dataSource, userId);
    await verifyIssuancePersistence(first, environment, userId);
    reportScenario('AUTH-B01', 'digest-only issuance and configured TTL bounds');
    await verifyRotationAndReplay(first, second, cleanup, userId, environment);
    reportScenario('AUTH-B02', 'single rotation winner and durable replay revocation');
    await verifyIndependentFamilies(first, second, userId);
    reportScenario('AUTH-B03', 'independent session families');
    await verifyLogoutSemantics(first, cleanup, userId);
    reportScenario('AUTH-B04', 'current, historical, expired, and invalid logout secrets');
    await verifyRefreshLogoutRace(first, second, userId);
    reportScenario('AUTH-B05', 'refresh/logout serialization and peer-family isolation');
    await verifyExpiryBoundaries(first, cleanup, userId);
    reportScenario('AUTH-B06', 'inactivity and absolute expiry boundaries');
    await verifyBoundedLockWait(first, cleanup, userId);
    reportScenario('AUTH-B07', 'bounded lock wait maps to dependency unavailable');
    await verifyRotationRollback(first, faultInjectingTokens, userId);
    reportScenario('AUTH-B08', 'integrity failure rolls back without transient-error remapping');
    await verifyBrowserSessionIssuance(first, second, userId, environment);
    reportScenario('SESSION-01', 'opaque browser issuance, digest storage, and independent logins');
    await verifyBrowserSessionRejection(first, cleanup, userId, environment);
    reportScenario('SESSION-02', 'invalid, legacy, unverified, and unsupported state rejection');
    await verifyBrowserSessionActivity(first, cleanup, userId);
    reportScenario('SESSION-03', 'database-clock expiry, throttled activity, and no resurrection');
    await verifyBrowserSessionLogoutOrderings(first, second, cleanup, userId);
    reportScenario('SESSION-04', 'validation-before-logout and logout-before-validation ordering');
    await verifyDeletedUser(first, cleanup, userId);
    reportScenario('AUTH-B09', 'deleted-user cascade and fail-closed refresh');
    console.log(
      'Platform auth-session verification passed: legacy refresh compatibility plus opaque browser issuance, validation, activity, expiry, and logout.',
    );
  } finally {
    try {
      if (cleanup.isInitialized) {
        await cleanup.getRepository(User).delete({ id: userId });
      }
    } finally {
      await Promise.all(
        [first.dataSource, second.dataSource, cleanup]
          .filter((dataSource) => dataSource.isInitialized)
          .map((dataSource) => dataSource.destroy()),
      );
    }
  }
}

void main().catch(handleFailure);
