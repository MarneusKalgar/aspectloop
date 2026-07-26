import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { AuthUser } from '../auth/types/auth-user';
import { CorrectionSession } from '../correction-sessions/correction-session.entity';
import { CorrectionSessionsService } from '../correction-sessions/correction-sessions.service';
import { DocumentRegistryService } from '../document-registry/document-registry.service';
import { PersistenceClient } from '../persistence/persistence.client';
import { CORRECTION_OUTBOX_RELAY_SERVICE } from './constants';
import { CorrectionEdit, CorrectionEventOutbox } from './correction-edit.entity';
import {
  CORRECTION_OUTBOX_EVENT_TYPE_DOCUMENT_CORRECTED,
  CORRECTION_OUTBOX_STATUS_PENDING,
  CORRECTION_STATUS_SUBMITTED,
  CorrectionAuditEntryView,
  CorrectionDocumentView,
  STORED_CORRECTION_STATUS_SUBMITTED,
  SubmitCorrectionsCommandInput,
  SubmitCorrectionsPayloadView,
} from './correction-flow.types';
import { FlattenService } from './services/flatten.service';
import { MergeService } from './services/merge.service';
import { buildCorrectedDocumentEvent } from './utils/build-corrected-document-event';
import { derivePublishStatus } from './utils/derive-publish-status';
import { normalizeCorrectionStatus } from './utils/normalize-correction-status';
import { applyTransactionTimeouts } from './utils/transaction-timeouts';

interface CorrectionOutboxRelayPort {
  flushOutboxByIds(ids: string[]): Promise<void>;
}

@Injectable()
/**
 * Orchestrates the read and submit flows for an open correction session.
 *
 * The service keeps session state in Postgres, persists the merged document to the
 * external persistence service, and writes an outbox row for reliable RabbitMQ delivery.
 */
export class CorrectionsService {
  private readonly logger = new Logger(CorrectionsService.name);

  constructor(
    @InjectRepository(CorrectionEdit)
    private readonly correctionEditRepository: Repository<CorrectionEdit>,
    @InjectRepository(CorrectionEventOutbox)
    private readonly correctionEventOutboxRepository: Repository<CorrectionEventOutbox>,
    private readonly correctionSessionsService: CorrectionSessionsService,
    private readonly documentRegistryService: DocumentRegistryService,
    private readonly flattenService: FlattenService,
    private readonly mergeService: MergeService,
    private readonly persistenceClient: PersistenceClient,
    private readonly dataSource: DataSource,
    @Inject(CORRECTION_OUTBOX_RELAY_SERVICE)
    private readonly correctionOutboxRelayService: CorrectionOutboxRelayPort,
  ) {}

  /**
   * Builds the frontend-facing correction document view from session snapshots,
   * registry metadata, audit history, and the latest publish attempt state.
   */
  async getCorrectionDocument(
    sessionId: string,
    authUser: AuthUser,
  ): Promise<CorrectionDocumentView> {
    const session = await this.correctionSessionsService.getSession(sessionId, authUser);
    const config = this.documentRegistryService.getDocumentTypeOrThrow(session.documentType);
    const snapshots = this.correctionSessionsService.getSessionSnapshots(session);
    const [auditEntries, latestOutboxEntry] = await Promise.all([
      this.correctionEditRepository.find({
        order: { editedAt: 'ASC' },
        where: { sessionId: session.id },
      }),
      this.correctionEventOutboxRepository
        .createQueryBuilder('outbox')
        .where('outbox.sessionId = :sessionId', { sessionId: session.id })
        .orderBy('outbox.createdAt', 'DESC')
        .getOne(),
    ]);

    const audit: CorrectionAuditEntryView[] = auditEntries.map((entry) => ({
      editedAt: entry.editedAt,
      editedBy: entry.editedBy,
      fieldId: entry.fieldId,
      id: entry.id,
      newValue: entry.newValue,
      path: entry.path,
      previousValue: entry.previousValue,
      source: entry.source,
    }));

    return {
      audit,
      documentId: session.documentId,
      documentType: session.documentType,
      fields: this.flattenService.flattenFields({ config, snapshots }),
      publishStatus: derivePublishStatus(latestOutboxEntry),
      schema: this.flattenService.buildCorrectionSchema(config),
      sessionId: session.id,
      status: normalizeCorrectionStatus(session.status),
      updatedAt: session.updatedAt,
      version: session.version,
    };
  }

  /**
   * Applies submitted edits to the draft payload, persists the merged document,
   * advances the session version, records audit rows, and enqueues a publish event.
   */
  async submitCorrections(
    input: SubmitCorrectionsCommandInput,
    authUser: AuthUser,
  ): Promise<SubmitCorrectionsPayloadView> {
    const session = await this.correctionSessionsService.getSession(input.sessionId, authUser);

    if (session.version !== input.expectedVersion) {
      throw new ConflictException(
        `Correction session version mismatch: expected ${input.expectedVersion}, actual ${session.version}`,
      );
    }

    const config = this.documentRegistryService.getDocumentTypeOrThrow(session.documentType);
    const merged = this.mergeService.applyEdits(
      config,
      session.draftPayload,
      input.edits,
      authUser.sub,
    );
    const submittedAt = new Date();
    const nextVersion = session.version + 1;

    await this.persistenceClient.saveDocument(session.documentId, {
      documentType: session.documentType,
      payload: merged.draftPayload,
    });

    const outboxId = await this.dataSource.transaction(async (manager) => {
      await applyTransactionTimeouts(manager);

      const lockedSession = await manager
        .getRepository(CorrectionSession)
        .createQueryBuilder('correctionSession')
        .setLock('pessimistic_write')
        .where('correctionSession.id = :id', { id: session.id })
        .getOne();

      if (lockedSession?.version !== input.expectedVersion) {
        throw new ConflictException(
          `Correction session version mismatch: expected ${input.expectedVersion}, actual ${lockedSession?.version ?? 'missing'}`,
        );
      }

      const currentSession = lockedSession;

      currentSession.draftPayload = merged.draftPayload;
      currentSession.lockedById = authUser.sub;
      currentSession.status = STORED_CORRECTION_STATUS_SUBMITTED;
      currentSession.submittedAt = submittedAt;
      currentSession.version = nextVersion;

      await manager.save(currentSession);

      if (merged.auditEntries.length > 0) {
        const editRepository = manager.getRepository(CorrectionEdit);
        const correctionEdits: CorrectionEdit[] = [];

        for (const auditEntry of merged.auditEntries) {
          correctionEdits.push(
            editRepository.create({
              editedAt: auditEntry.editedAt,
              editedBy: auditEntry.editedBy,
              fieldId: auditEntry.fieldId,
              newValue: auditEntry.newValue,
              path: auditEntry.path,
              previousValue: auditEntry.previousValue,
              sessionId: session.id,
              source: auditEntry.source,
            }),
          );
        }

        await editRepository.save(correctionEdits);
      }

      const outboxRepository = manager.getRepository(CorrectionEventOutbox);
      const outboxEntry = outboxRepository.create({
        eventType: CORRECTION_OUTBOX_EVENT_TYPE_DOCUMENT_CORRECTED,
        payload: buildCorrectedDocumentEvent({
          correctedAt: submittedAt,
          correctedBy: authUser.sub,
          documentId: session.documentId,
          documentType: session.documentType,
          eventId: crypto.randomUUID(),
          idempotencyKey: `${session.documentId}:${nextVersion}`,
          sessionId: session.id,
          version: nextVersion,
        }),
        sessionId: session.id,
        status: CORRECTION_OUTBOX_STATUS_PENDING,
      });

      const savedOutboxEntry = await outboxRepository.save(outboxEntry);

      return savedOutboxEntry.id;
    });

    try {
      await this.correctionOutboxRelayService.flushOutboxByIds([outboxId]);
    } catch (error) {
      this.logger.warn(
        `Best-effort outbox flush failed for ${outboxId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const latestOutboxEntry = await this.correctionEventOutboxRepository
      .createQueryBuilder('outbox')
      .where('outbox.id = :id', { id: outboxId })
      .getOneOrFail();

    return {
      conflicts: [],
      documentId: session.documentId,
      publishStatus: derivePublishStatus(latestOutboxEntry),
      sessionId: session.id,
      status: CORRECTION_STATUS_SUBMITTED,
      version: nextVersion,
    };
  }
}
