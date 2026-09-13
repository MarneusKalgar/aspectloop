import type { PlatformDocumentTypeConfig, PlatformUserView } from '@aspectloop/contracts/platform';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { PlatformRequestContext } from '../platform/platform-client';

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
import { PlatformClient } from '../platform/platform-client';
import { CorrectionSession } from './correction-session.entity';
import * as correctionSessionUtils from './utils';

const correctionSessionHelpers = correctionSessionUtils;

export interface CorrectionSessionSnapshots {
  draftPayload: Record<string, unknown>;
  sourcePayload: Record<string, unknown>;
  sourceProvenance: null | Record<string, unknown>;
}

export type CorrectionSessionView = CorrectionSession & {
  lockedBy: PlatformUserView;
};

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
    private readonly platformClient: PlatformClient,
  ) {}

  /**
   * Loads a session and verifies that the current user owns the session lock.
   */
  async getSession(
    sessionId: string,
    authUser: AuthUser,
    context: PlatformRequestContext = {},
  ): Promise<CorrectionSessionView> {
    const session = await this.findSessionOrThrow(sessionId, context);

    correctionSessionHelpers.ensureSessionAccess(session, authUser.sub);

    return session;
  }

  /**
   * Returns the immutable source snapshot, mutable draft snapshot, and provenance map
   * used by correction-document flattening.
   */
  getSessionSnapshots(session: CorrectionSession): CorrectionSessionSnapshots {
    return {
      draftPayload: session.draftPayload,
      sourcePayload: session.sourcePayload,
      sourceProvenance: session.sourceProvenance,
    };
  }

  /**
   * Lists the current user's correction sessions for the inbox route.
   */
  async listSessions(
    authUser: AuthUser,
    context: PlatformRequestContext = {},
  ): Promise<CorrectionSessionView[]> {
    const sessions = await this.correctionSessionsRepository.find({
      order: {
        updatedAt: 'DESC',
      },
      where: {
        createdById: authUser.sub,
      },
    });

    return this.normalizeAndHydrateSessions(sessions, context);
  }

  /**
   * Opens a new correction session from the external document payload or reuses an
   * existing session when the same user already owns it.
   */
  async openSession(
    input: OpenCorrectionSessionInput,
    authUser: AuthUser,
    context: PlatformRequestContext = {},
  ): Promise<CorrectionSessionView> {
    const config = await this.documentRegistryService.getDocumentTypeOrThrow(
      input.documentType,
      context,
    );

    const existingSession = await this.correctionSessionsRepository.findOne({
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
      return this.findSessionOrThrow(existingSession.id, context);
    }

    const document = await this.persistenceClient.getDocument(input.documentId);

    if (document.documentType !== input.documentType) {
      throw new BadRequestException(
        `Document ${input.documentId} belongs to type ${document.documentType}, not ${input.documentType}`,
      );
    }

    const normalizedDocumentPayload = this.normalizePayloadForDocumentType(
      config,
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

    return this.findSessionOrThrow(session.id, context);
  }

  /**
   * Persists the latest draft snapshot while preserving the immutable source snapshot.
   */
  async saveDraft(
    input: SaveCorrectionSessionDraftInput,
    authUser: AuthUser,
    context: PlatformRequestContext = {},
  ): Promise<CorrectionSessionView> {
    const session = await this.findSessionOrThrow(input.sessionId, context);

    correctionSessionHelpers.ensureSessionAccess(session, authUser.sub);

    if (session.version !== input.expectedVersion) {
      throw new ConflictException(
        `Correction session version mismatch: expected ${input.expectedVersion}, actual ${session.version}`,
      );
    }

    if (!isRecord(input.draftPayload)) {
      throw new BadRequestException('draftPayload must be a JSON object');
    }

    const config = await this.documentRegistryService.getDocumentTypeOrThrow(
      session.documentType,
      context,
    );
    const normalizedDraftPayload = this.normalizePayloadForDocumentType(config, input.draftPayload);

    await this.persistenceClient.saveDocument(session.documentId, {
      documentType: session.documentType,
      payload: normalizedDraftPayload,
    });

    session.draftPayload = normalizedDraftPayload;
    session.lockedById = authUser.sub;
    session.version += 1;

    await this.correctionSessionsRepository.save(session);
    this.logger.log(`Saved draft for correction session ${session.id}`);

    return this.findSessionOrThrow(session.id, context);
  }

  /**
   * Loads the full session graph needed by the correction APIs or raises not found.
   */
  private async findSessionOrThrow(
    sessionId: string,
    context: PlatformRequestContext,
  ): Promise<CorrectionSessionView> {
    const session = await this.correctionSessionsRepository.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Correction session ${sessionId} was not found`);
    }

    const [hydratedSession] = await this.normalizeAndHydrateSessions([session], context);

    return hydratedSession;
  }

  /** Loads each required registry config once and each user set through one batch request. */
  private async normalizeAndHydrateSessions(
    sessions: CorrectionSession[],
    context: PlatformRequestContext,
  ): Promise<CorrectionSessionView[]> {
    if (sessions.length === 0) {
      return [];
    }

    const documentTypes = [...new Set(sessions.map((session) => session.documentType))];
    const configs = await Promise.all(
      documentTypes.map((documentType) =>
        this.documentRegistryService.getDocumentTypeOrThrow(documentType, context),
      ),
    );
    const configsByType = new Map(configs.map((config) => [config.type, config]));
    const normalizedSessions = sessions.map((session) => {
      const config = configsByType.get(session.documentType);

      if (!config) {
        throw new InternalServerErrorException('Correction session document type is invalid');
      }

      return this.normalizeSessionPayloads(session, config);
    });
    if (normalizedSessions.some((session) => session.lockedById === null)) {
      throw new InternalServerErrorException('Correction session user reference is invalid');
    }

    const userIds = [
      ...new Set(
        normalizedSessions.flatMap((session) =>
          session.lockedById === null ? [] : [session.lockedById],
        ),
      ),
    ];

    const { users } = await this.platformClient.getUsers({ userIds }, context);
    const usersById = new Map(users.map((user) => [user.id, user]));

    return normalizedSessions.map((session) => {
      const lockedById = session.lockedById;

      if (lockedById === null) {
        throw new InternalServerErrorException('Correction session user reference is invalid');
      }

      const user = usersById.get(lockedById);

      if (!user) {
        throw new InternalServerErrorException('Correction session user reference is invalid');
      }

      return Object.assign(session, { lockedBy: user });
    });
  }

  /**
   * Rewrites legacy flat payloads into the current registry-driven nested document shape.
   *
   * This keeps old sessions readable while the runtime and frontend operate on stable
   * field paths such as header.invoiceNumber.
   */
  private normalizePayloadForDocumentType(
    config: PlatformDocumentTypeConfig,
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
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
  private normalizeSessionPayloads(
    session: CorrectionSession,
    config: PlatformDocumentTypeConfig,
  ): CorrectionSession {
    session.draftPayload = this.normalizePayloadForDocumentType(config, session.draftPayload);
    session.sourcePayload = this.normalizePayloadForDocumentType(config, session.sourcePayload);

    return session;
  }
}
