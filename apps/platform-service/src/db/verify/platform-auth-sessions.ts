import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

import { validateEnv } from '#app/config/env.validation';
import { User } from '#app/users/user.entity';

import {
  verifyBoundedLockWait,
  verifyIssuanceRollback,
  verifyLogoutSemantics,
  verifyRetiredSchema,
} from './auth-sessions/browser-session-retirement.scenarios';
import {
  verifyBrowserSessionActivity,
  verifyBrowserSessionIssuance,
  verifyBrowserSessionLogoutOrderings,
  verifyBrowserSessionRejection,
} from './auth-sessions/browser-session.scenarios';
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
    await verifyRetiredSchema(cleanup);
    reportScenario('C3-DB01', 'obsolete refresh table and column are absent');
    await verifyBoundedLockWait(first, cleanup, userId);
    reportScenario('C3-DB02', 'bounded issuance lock wait maps to dependency unavailable');
    await verifyIssuanceRollback(first, faultInjectingTokens, userId);
    reportScenario('C3-DB03', 'issuance integrity failure rolls back without remapping');
    await verifyLogoutSemantics(first, cleanup, userId);
    reportScenario('C3-DB04', 'idempotent expired logout preserves independent sessions');
    await verifyBrowserSessionIssuance(first, second, userId, environment);
    reportScenario('SESSION-01', 'opaque browser issuance, digest storage, and independent logins');
    await verifyBrowserSessionRejection(first, cleanup, userId, environment);
    reportScenario('SESSION-02', 'invalid, legacy, unverified, and unsupported state rejection');
    await verifyBrowserSessionActivity(first, cleanup, userId);
    reportScenario('SESSION-03', 'database-clock expiry, throttled activity, and no resurrection');
    await verifyBrowserSessionLogoutOrderings(first, second, cleanup, userId);
    reportScenario('SESSION-04', 'contending activity and logout writes in both orderings');
    console.log(
      'Platform auth-session verification passed: opaque browser issuance, validation, activity, expiry, and logout.',
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
