import type { PlatformDocumentTypeConfig, PlatformUserView } from '@aspectloop/contracts/platform';
import type { Repository } from 'typeorm';

import { expect, test, vi } from 'vitest';

import type { AuthUser } from '../../src/auth/types/auth-user';
import type { CorrectionSession } from '../../src/correction-sessions/correction-session.entity';
import type { DocumentRegistryService } from '../../src/document-registry/document-registry.service';
import type { PersistenceClient } from '../../src/persistence/persistence.client';
import type { PlatformClient } from '../../src/platform/platform-client';

import { CorrectionSessionsService } from '../../src/correction-sessions/correction-sessions.service';

const USER_ID = '9d30c36d-5ae4-4f1b-b127-15f32de2f7cb';
const AUTH_USER: AuthUser = {
  displayName: 'Reviewer',
  email: 'reviewer@example.test',
  roles: ['CORRECTOR'],
  scopes: ['corrections:write'],
  sub: USER_ID,
};
const USER: PlatformUserView = {
  createdAt: '2026-09-12T00:00:00.000Z',
  displayName: AUTH_USER.displayName,
  email: AUTH_USER.email,
  id: USER_ID,
  roles: AUTH_USER.roles,
  scopes: AUTH_USER.scopes,
  updatedAt: '2026-09-12T00:00:00.000Z',
};
const CONFIG: PlatformDocumentTypeConfig = {
  label: 'Supplier invoice',
  sections: [
    {
      fields: [
        {
          id: 'number',
          inputType: 'text',
          label: 'Number',
          path: 'header.number',
        },
      ],
      id: 'header',
      label: 'Header',
      path: 'header',
      repeatable: false,
    },
  ],
  type: 'supplier_invoice',
  version: 1,
};

/** Creates a scalar-only correction row with no TypeORM user relation. */
function createSession(id: string): CorrectionSession {
  return {
    createdAt: new Date('2026-09-12T00:00:00.000Z'),
    createdById: USER_ID,
    documentId: `document-${id}`,
    documentType: CONFIG.type,
    draftPayload: { header: { number: id } },
    id,
    lockedById: USER_ID,
    sourcePayload: { header: { number: id } },
    sourceProvenance: null,
    status: 'draft',
    submittedAt: null,
    updatedAt: new Date('2026-09-12T00:00:00.000Z'),
    version: 1,
  };
}

/** Verifies list composition uses one unique-user batch and no Platform table join. */
async function testBatchedUserHydration(): Promise<void> {
  const find = vi.fn().mockResolvedValue([createSession('one'), createSession('two')]);
  const getDocumentTypeOrThrow = vi.fn().mockResolvedValue(CONFIG);
  const getUsers = vi.fn().mockResolvedValue({ users: [USER] });
  const service = new CorrectionSessionsService(
    { find } as unknown as Repository<CorrectionSession>,
    { getDocumentTypeOrThrow } as unknown as DocumentRegistryService,
    {} as unknown as PersistenceClient,
    { getUsers } as unknown as PlatformClient,
  );

  const sessions = await service.listSessions(AUTH_USER, { requestId: 'm04.1-b:test' });

  expect(find).toHaveBeenCalledWith({
    order: { updatedAt: 'DESC' },
    where: { createdById: USER_ID },
  });
  expect(getUsers).toHaveBeenCalledOnce();
  expect(getUsers).toHaveBeenCalledWith({ userIds: [USER_ID] }, { requestId: 'm04.1-b:test' });
  expect(sessions.map((session) => session.lockedBy.id)).toEqual([USER_ID, USER_ID]);
}

test('hydrates correction users through one Platform batch', testBatchedUserHydration);
