import 'reflect-metadata';

import type { EntityManager } from 'typeorm';

import { getTypeOrmDataSourceOptions } from '@platform/config/typeorm';
import { Document } from '@platform/documents/document.entity';
import { User } from '@platform/users/user.entity';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { expect, test } from 'vitest';

const databaseUrl = process.env.TYPEORM_TEST_DATABASE_URL;

/** Locks one Platform document inside a transaction and persists a version change. */
async function incrementLockedDocument(documentId: string, manager: EntityManager): Promise<void> {
  const repository = manager.getRepository(Document);
  const document = await repository
    .createQueryBuilder('document')
    .setLock('pessimistic_write')
    .where('document.id = :id', { id: documentId })
    .getOneOrFail();

  document.version += 1;
  await manager.save(document);
}

/** Verifies the required TypeORM 1 behavior against Platform-owned PostgreSQL entities. */
async function testTypeOrmCompatibility(): Promise<void> {
  if (!databaseUrl) {
    throw new Error(
      'TYPEORM_TEST_DATABASE_URL must identify a migrated database with Platform runtime grants',
    );
  }

  const dataSource = new DataSource({
    ...getTypeOrmDataSourceOptions({
      databaseUrl,
      discoveryMode: 'source',
      nodeEnv: 'development',
    }),
    // Vitest transforms these imports; TypeORM's runtime glob loader would ask
    // Node to parse raw legacy-decorator syntax from the source files instead.
    entities: [Document, User],
    migrations: [],
  });
  const documentId = randomUUID();
  const invalidDocumentId = randomUUID();
  const email = `m04.1-b-${documentId}@example.test`;

  await dataSource.initialize();

  try {
    const userRepository = dataSource.getRepository(User);
    const documentRepository = dataSource.getRepository(Document);

    await expect(
      userRepository.findOne({ where: { id: undefined as unknown as string } }),
    ).rejects.toThrow();
    await expect(
      userRepository.findOne({ where: { id: null as unknown as string } }),
    ).rejects.toThrow();

    const invalidDocument = documentRepository.create({
      documentType: 'supplier_invoice',
      id: invalidDocumentId,
      ownerId: randomUUID(),
      status: 'source_stored',
      version: 1,
    });

    await expect(
      dataSource.transaction(async (manager) =>
        manager.getRepository(Document).save(invalidDocument),
      ),
    ).rejects.toThrow();

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const transactionalUserRepository = queryRunner.manager.getRepository(User);
      const transactionalDocumentRepository = queryRunner.manager.getRepository(Document);
      const user = await transactionalUserRepository.save(
        transactionalUserRepository.create({
          displayName: 'M04.1-B verification',
          email,
          passwordHash: 'not-a-login-credential',
          roles: ['CORRECTOR'],
          scopes: ['corrections:write'],
        }),
      );
      const document = await transactionalDocumentRepository.save(
        transactionalDocumentRepository.create({
          documentType: 'supplier_invoice',
          id: documentId,
          ownerId: user.id,
          status: 'source_stored',
          version: 1,
        }),
      );
      const loadedDocument = await transactionalDocumentRepository.findOneOrFail({
        relations: { owner: true },
        where: { id: document.id },
      });

      expect(loadedDocument.owner.id).toBe(user.id);

      await incrementLockedDocument(document.id, queryRunner.manager);

      await expect(
        transactionalDocumentRepository.findOneByOrFail({ id: document.id }),
      ).resolves.toMatchObject({ version: 2 });
    } finally {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
    }
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

test('supports the required TypeORM 1 PostgreSQL behavior', testTypeOrmCompatibility);
