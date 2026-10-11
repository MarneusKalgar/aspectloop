import type { EnvironmentVariables } from '@platform/config/env.schema';
import type { DataSource } from 'typeorm';

import { browserRegistrationFixture } from '@platform/db/verify/auth-http/browser-registration-fixture';
import { OwnedMailCapture } from '@platform/db/verify/mail/owned-mail-capture';
import { afterEach, describe, expect, it, vi } from 'vitest';

const ID = 'd41be59c-d8eb-4e8c-a5e1-99aab7197f04';
const EMAIL = `auth-http-${ID}@example.test`;
const environment = {
  SMTP_HOST: 'mailpit',
  SMTP_PORT: 1025,
  SMTP_SECURE: 'false',
} as EnvironmentVariables;

afterEach(
  /** Releases verifier-only spies, time and private-pipe configuration. */ () => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllEnvs();
  },
);

/** Supplies only a test repository; no real database, SMTP or capture connection is opened. */
function fixtureDatabase() {
  const repository = {
    countBy: vi.fn().mockResolvedValue(0),
    delete: vi.fn().mockResolvedValue(undefined),
    findOneBy: vi.fn().mockResolvedValue({ id: 'persisted-browser-user' }),
  };
  const database = {
    getRepository: /** Returns only the owned fake repository. */ () => repository,
  } as unknown as DataSource;

  return { database, repository };
}

describe('private browser registration ownership', /** Groups closed reservation, private exchange and exact cleanup rules. */ () => {
  /** Registration is created by the browser, not a seeded verified fixture or SQL insert. */
  it('reserves only an absent exact recipient and refuses pre-existing users', async () => {
    const { database, repository } = fixtureDatabase();
    vi.spyOn(OwnedMailCapture.prototype, 'assertAvailable').mockResolvedValue(undefined);
    vi.spyOn(OwnedMailCapture.prototype, 'assertEmpty').mockResolvedValue(undefined);
    vi.spyOn(console, 'log').mockImplementation(
      /** Discards only test-owned safe acknowledgements. */ () => undefined,
    );
    await browserRegistrationFixture('--browser-registration-reserve', ID, database, environment);
    expect(repository.countBy).toHaveBeenCalledWith({ email: EMAIL });
    expect(repository.delete).not.toHaveBeenCalled();
    repository.countBy.mockResolvedValue(1);
    await expect(
      browserRegistrationFixture('--browser-registration-reserve', ID, database, environment),
    ).rejects.toThrow();
  });

  /** Only exact owned recipient plus privately discovered persisted ID can be deleted. */
  it('joins the SMTP bound before exact database and mail cleanup', async () => {
    vi.useFakeTimers();
    const { database, repository } = fixtureDatabase();
    const capture = vi.spyOn(OwnedMailCapture.prototype, 'cleanup').mockResolvedValue(undefined);
    vi.spyOn(OwnedMailCapture.prototype, 'assertEmpty').mockResolvedValue(undefined);
    vi.spyOn(console, 'log').mockImplementation(
      /** Discards only fixture cleanup status. */ () => undefined,
    );
    const job = browserRegistrationFixture(
      '--browser-registration-cleanup',
      ID,
      database,
      environment,
    );
    expect(capture).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(6500);
    await job;
    expect(capture).toHaveBeenCalledOnce();
    expect(repository.delete).toHaveBeenCalledWith({ email: EMAIL, id: 'persisted-browser-user' });
    expect(repository.countBy).toHaveBeenCalledWith({ email: EMAIL });
  });

  /** Arbitrary destinations/identifiers/actions and public token output are rejected before work. */
  it('closes the tool surface and requires a private token pipe', async () => {
    const { database, repository } = fixtureDatabase();
    vi.stubEnv('ASPECTLOOP_E2_PRIVATE_PIPE', '0');
    const read = vi.spyOn(OwnedMailCapture.prototype, 'readConfirmationTokens');
    await expect(
      browserRegistrationFixture('--browser-registration-token', ID, database, environment),
    ).rejects.toThrow('requires its private pipe');
    await expect(
      browserRegistrationFixture('--browser-registration-cleanup', '../', database, environment),
    ).rejects.toThrow('ownership/action rejected');
    await expect(
      browserRegistrationFixture('--arbitrary', ID, database, environment),
    ).rejects.toThrow('ownership/action rejected');
    await expect(
      browserRegistrationFixture('--browser-registration-reserve', ID, database, {
        ...environment,
        SMTP_HOST: 'external.example.test',
      }),
    ).rejects.toThrow('private local Mailpit');
    expect(read).not.toHaveBeenCalled();
    expect(repository.delete).not.toHaveBeenCalled();
  });
});
