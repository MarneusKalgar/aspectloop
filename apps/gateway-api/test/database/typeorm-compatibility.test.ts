import 'reflect-metadata';

import type { EntityManager } from 'typeorm';

import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { expect, test } from 'vitest';

import { getTypeOrmDataSourceOptions } from '../../src/config/typeorm';
import { CorrectionSession } from '../../src/correction-sessions/correction-session.entity';
import { User } from '../../src/users/user.entity';

const databaseUrl = process.env.TYPEORM_TEST_DATABASE_URL;

/** Locks one correction session inside a transaction and persists a version change. */
async function incrementLockedSession(sessionId: string, manager: EntityManager): Promise<void> {
  const repository = manager.getRepository(CorrectionSession);
  const session = await repository
    .createQueryBuilder('correctionSession')
    .setLock('pessimistic_write')
    .where('correctionSession.id = :id', { id: sessionId })
    .getOneOrFail();

  session.version += 1;
  await manager.save(session);
}

/** Verifies the TypeORM 1 behavior that M04-A depends on against PostgreSQL. */
async function testTypeOrmCompatibility(): Promise<void> {
  if (!databaseUrl) {
    throw new Error('TYPEORM_TEST_DATABASE_URL must identify a disposable migrated database');
  }

  const dataSource = new DataSource(
    getTypeOrmDataSourceOptions({
      databaseUrl,
      nodeEnv: 'development',
    }),
  );
  const documentId = `m04a-${randomUUID()}`;
  const invalidDocumentId = `${documentId}-invalid`;
  const email = `${documentId}@example.test`;

  await dataSource.initialize();

  try {
    const userRepository = dataSource.getRepository(User);
    const sessionRepository = dataSource.getRepository(CorrectionSession);

    await expect(
      userRepository.findOne({ where: { id: undefined as unknown as string } }),
    ).rejects.toThrow();
    await expect(
      userRepository.findOne({ where: { id: null as unknown as string } }),
    ).rejects.toThrow();

    const user = await userRepository.save(
      userRepository.create({
        displayName: 'M04-A verification',
        email,
        passwordHash: 'not-a-login-credential',
        roles: ['CORRECTOR'],
        scopes: ['corrections:write'],
      }),
    );

    const invalidSession = sessionRepository.create({
      createdById: randomUUID(),
      documentId: invalidDocumentId,
      documentType: 'invoice',
      draftPayload: {},
      lockedById: null,
      sourcePayload: {},
      sourceProvenance: null,
      status: 'draft',
      submittedAt: null,
      version: 1,
    });

    await expect(sessionRepository.save(invalidSession)).rejects.toThrow();

    const session = await sessionRepository.save(
      sessionRepository.create({
        createdById: user.id,
        documentId,
        documentType: 'invoice',
        draftPayload: {},
        lockedById: null,
        sourcePayload: {},
        sourceProvenance: null,
        status: 'draft',
        submittedAt: null,
        version: 1,
      }),
    );

    const loadedSession = await sessionRepository.findOneOrFail({
      relations: {
        createdBy: true,
        lockedBy: true,
      },
      where: { id: session.id },
    });

    expect(loadedSession.createdBy.id).toBe(user.id);
    expect(loadedSession.lockedBy).toBeNull();

    await dataSource.transaction(incrementLockedSession.bind(undefined, session.id));

    await expect(sessionRepository.findOneByOrFail({ id: session.id })).resolves.toMatchObject({
      version: 2,
    });
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.getRepository(CorrectionSession).delete({ documentId: invalidDocumentId });
      await dataSource.getRepository(CorrectionSession).delete({ documentId });
      await dataSource.getRepository(User).delete({ email });
      await dataSource.destroy();
    }
  }
}

test('supports the required TypeORM 1 PostgreSQL behavior', testTypeOrmCompatibility);
