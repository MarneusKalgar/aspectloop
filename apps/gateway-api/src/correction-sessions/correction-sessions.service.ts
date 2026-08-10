import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AuthUser } from '../auth/types/auth-user';
import { STORED_CORRECTION_STATUS_DRAFT } from '../corrections/correction-flow.types';
import { getValueAtPath, setValueAtPath } from '../corrections/utils/document-paths';
import { DocumentRegistryService } from '../document-registry/document-registry.service';
import {
  OpenCorrectionSessionInput,
  SaveCorrectionSessionDraftInput,
} from '../graphql/generated/graphql.types';
import { PersistenceClient } from '../persistence/persistence.client';
import { isRecord } from '../persistence/utils';
import { CorrectionSession } from './correction-session.entity';
import * as correctionSessionUtils from './utils';

const correctionSessionHelpers = correctionSessionUtils;

export interface CorrectionSessionSnapshots {
  draftPayload: Record<string, unknown>;
  sourcePayload: Record<string, unknown>;
  sourceProvenance: null | Record<string, unknown>;
}

@Injectable()
/**
 * Manages correction-session lifecycle, ownership checks, and snapshot shaping.
 */
export class CorrectionSessionsService {
  private readonly logger = new Logger(CorrectionSessionsService.name);

  constructor(
    @InjectRepository(CorrectionSession)
    private readonly correctionSessionsRepository: Repository<CorrectionSession>,
    private readonly documentRegistryService: DocumentRegistryService,
    private readonly persistenceClient: PersistenceClient,
  ) {}

  /**
   * Loads a session and verifies that the current user owns the session lock.
   */
  async getSession(sessionId: string, authUser: AuthUser): Promise<CorrectionSession> {
    const session = await this.findSessionOrThrow(sessionId);

    correctionSessionHelpers.ensureSessionAccess(session, authUser.sub);

    return session;
  }

  /**
   * Returns the immutable source snapshot, mutable draft snapshot, and provenance map
   * used by correction-document flattening.
   */
  getSessionSnapshots(session: CorrectionSession): CorrectionSessionSnapshots {
    const normalizedSession = this.normalizeSessionPayloads(session);

    return {
      draftPayload: normalizedSession.draftPayload,
      sourcePayload: normalizedSession.sourcePayload,
      sourceProvenance: normalizedSession.sourceProvenance,
    };
  }

  /**
   * Lists the current user's correction sessions for the inbox route.
   */
  async listSessions(authUser: AuthUser): Promise<CorrectionSession[]> {
    const sessions = await this.correctionSessionsRepository.find({
      order: {
        updatedAt: 'DESC',
      },
      relations: {
        createdBy: true,
        lockedBy: true,
      },
      where: {
        createdById: authUser.sub,
      },
    });

    return sessions.map((session) => this.normalizeSessionPayloads(session));
  }

  /**
   * Opens a new correction session from the external document payload or reuses an
   * existing session when the same user already owns it.
   */
  async openSession(
    input: OpenCorrectionSessionInput,
    authUser: AuthUser,
  ): Promise<CorrectionSession> {
    this.documentRegistryService.getDocumentTypeOrThrow(input.documentType);

    const existingSession = await this.correctionSessionsRepository.findOne({
      relations: {
        lockedBy: true,
      },
      where: { documentId: input.documentId },
    });

    if (existingSession) {
      if (existingSession.documentType !== input.documentType) {
        throw new BadRequestException(
          `Document ${input.documentId} belongs to type ${existingSession.documentType}, not ${input.documentType}`,
        );
      }

      correctionSessionHelpers.ensureSessionAccess(existingSession, authUser.sub);
      this.logger.log(`Reusing correction session ${existingSession.id} for ${input.documentId}`);
      return this.findSessionOrThrow(existingSession.id);
    }

    const document = await this.persistenceClient.getDocument(input.documentId);

    if (document.documentType !== input.documentType) {
      throw new BadRequestException(
        `Document ${input.documentId} belongs to type ${document.documentType}, not ${input.documentType}`,
      );
    }

    const normalizedDocumentPayload = this.normalizePayloadForDocumentType(
      input.documentType,
      document.payload,
    );

    const session = this.correctionSessionsRepository.create({
      createdById: authUser.sub,
      documentId: input.documentId,
      documentType: input.documentType,
      draftPayload: normalizedDocumentPayload,
      lockedById: authUser.sub,
      sourcePayload: normalizedDocumentPayload,
      sourceProvenance: null,
      status: STORED_CORRECTION_STATUS_DRAFT,
      submittedAt: null,
      version: 1,
    });

    await this.correctionSessionsRepository.save(session);
    this.logger.log(`Opened correction session ${session.id} for ${input.documentId}`);

    return this.findSessionOrThrow(session.id);
  }

  /**
   * Persists the latest draft snapshot while preserving the immutable source snapshot.
   */
  async saveDraft(
    input: SaveCorrectionSessionDraftInput,
    authUser: AuthUser,
  ): Promise<CorrectionSession> {
    const session = await this.findSessionOrThrow(input.sessionId);

    correctionSessionHelpers.ensureSessionAccess(session, authUser.sub);

    if (session.version !== input.expectedVersion) {
      throw new ConflictException(
        `Correction session version mismatch: expected ${input.expectedVersion}, actual ${session.version}`,
      );
    }

    if (!isRecord(input.draftPayload)) {
      throw new BadRequestException('draftPayload must be a JSON object');
    }

    const normalizedDraftPayload = this.normalizePayloadForDocumentType(
      session.documentType,
      input.draftPayload,
    );

    await this.persistenceClient.saveDocument(session.documentId, {
      documentType: session.documentType,
      payload: normalizedDraftPayload,
    });

    session.draftPayload = normalizedDraftPayload;
    session.lockedById = authUser.sub;
    session.version += 1;

    await this.correctionSessionsRepository.save(session);
    this.logger.log(`Saved draft for correction session ${session.id}`);

    return this.findSessionOrThrow(session.id);
  }

  /**
   * Loads the full session graph needed by the correction APIs or raises not found.
   */
  private async findSessionOrThrow(sessionId: string): Promise<CorrectionSession> {
    const session = await this.correctionSessionsRepository.findOne({
      relations: {
        createdBy: true,
        lockedBy: true,
      },
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Correction session ${sessionId} was not found`);
    }

    return this.normalizeSessionPayloads(session);
  }

  /**
   * Rewrites legacy flat payloads into the current registry-driven nested document shape.
   *
   * This keeps old sessions readable while the runtime and frontend operate on stable
   * field paths such as header.invoiceNumber.
   */
  private normalizePayloadForDocumentType(
    documentType: string,
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    const config = this.documentRegistryService.getDocumentTypeOrThrow(documentType);
    const normalizedPayload = structuredClone(payload);

    for (const section of config.sections) {
      if (section.repeatable) {
        continue;
      }

      for (const field of section.fields) {
        if (getValueAtPath(normalizedPayload, field.path) !== undefined) {
          continue;
        }

        const legacyValue = correctionSessionHelpers.findLegacyFieldValue(
          normalizedPayload,
          field.id,
          field.path,
        );

        if (legacyValue === undefined) {
          continue;
        }

        setValueAtPath(normalizedPayload, field.path, legacyValue);
      }
    }

    return normalizedPayload;
  }

  /**
   * Normalizes both source and draft snapshots before they are exposed to callers.
   */
  private normalizeSessionPayloads(session: CorrectionSession): CorrectionSession {
    session.draftPayload = this.normalizePayloadForDocumentType(
      session.documentType,
      session.draftPayload,
    );
    session.sourcePayload = this.normalizePayloadForDocumentType(
      session.documentType,
      session.sourcePayload,
    );

    return session;
  }
}
