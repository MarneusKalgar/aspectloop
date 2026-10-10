import type { DataSource } from 'typeorm';

import { OwnedMailCapture } from '@platform/db/verify/mail/owned-mail-capture';
import { OwnedRegistrationFixtures } from '@platform/db/verify/registration/verification-support';
import { afterEach, expect, test, vi } from 'vitest';

/** Proves capture failure does not prevent exact database cleanup and still fails the whole verifier. */
async function captureFailureStillCleans(): Promise<void> {
  const context = fixture();
  const owned = await context.owned.allocate();
  context.repository.findOneBy.mockResolvedValue({
    email: owned.email,
    id: '00000000-0000-4000-8000-000000000001',
  });
  context.captureCleanup.mockRejectedValueOnce(new Error('private capture details'));
  await expect(context.owned.cleanup()).rejects.toThrow(
    'Registration verification cleanup failed; private details omitted',
  );
  expect(context.repository.delete).toHaveBeenCalledOnce();
}

/** Proves cleanup discovers the actual persisted UUID rather than assuming the recipient UUID is the user ID. */
async function exactPostCommitOwnership(): Promise<void> {
  const context = fixture();
  const owned = await context.owned.allocate();
  const persistedId = '00000000-0000-4000-8000-000000000001';
  context.repository.findOneBy.mockResolvedValue({ email: owned.email, id: persistedId });
  await context.owned.cleanup();
  expect(context.repository.delete).toHaveBeenCalledExactlyOnceWith({
    email: owned.email,
    id: persistedId,
  });
  expect(context.captureCleanup).toHaveBeenCalledOnce();
}

/** Refuses to claim an already existing mailbox before registering cleanup ownership. */
async function existingRecipientNotOwned(): Promise<void> {
  const context = fixture();
  context.repository.countBy.mockResolvedValueOnce(1);
  await expect(context.owned.allocate()).rejects.toThrow();
  await context.owned.cleanup();
  expect(context.repository.delete).not.toHaveBeenCalled();
  expect(context.captureCleanup).not.toHaveBeenCalled();
}

/** Replaces only private cleanup boundaries; no test opens real PostgreSQL or Mailpit connections. */
function fixture() {
  const repository = {
    countBy: vi.fn().mockResolvedValue(0),
    delete: vi.fn().mockResolvedValue({ affected: 1 }),
    findOneBy: vi.fn().mockResolvedValue(null),
  };
  const database = { getRepository: vi.fn().mockReturnValue(repository) };
  vi.spyOn(OwnedMailCapture.prototype, 'assertAvailable').mockResolvedValue();
  vi.spyOn(OwnedMailCapture.prototype, 'assertEmpty').mockResolvedValue();
  const captureCleanup = vi.spyOn(OwnedMailCapture.prototype, 'cleanup').mockResolvedValue();

  return {
    captureCleanup,
    owned: new OwnedRegistrationFixtures(database as unknown as DataSource),
    repository,
  };
}

/** Restores all private fixture/capture prototypes after each isolated test. */
function restore(): void {
  vi.restoreAllMocks();
}

afterEach(restore);
test('post-commit ownership uses actual persisted ID plus exact email', exactPostCommitOwnership);
test('capture failure still cleans the database and fails verification', captureFailureStillCleans);
test('pre-existing recipients are never claimed for cleanup', existingRecipientNotOwned);
