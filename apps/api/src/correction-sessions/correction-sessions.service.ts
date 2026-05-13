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
import { DocumentRegistryService } from '../document-registry/document-registry.service';
import {
  OpenCorrectionSessionInput,
  SaveCorrectionSessionDraftInput,
} from '../graphql/graphql.types';
import { PersistenceClient } from '../persistence/persistence.client';
import { isRecord } from '../persistence/utils';
import { CorrectionSession } from './correction-session.entity';
import { ensureSessionAccess } from './utils';

@Injectable()
export class CorrectionSessionsService {
  private readonly logger = new Logger(CorrectionSessionsService.name);

  constructor(
    @InjectRepository(CorrectionSession)
    private readonly correctionSessionsRepository: Repository<CorrectionSession>,
    private readonly documentRegistryService: DocumentRegistryService,
    private readonly persistenceClient: PersistenceClient,
  ) {}

  async getSession(sessionId: string, authUser: AuthUser): Promise<CorrectionSession> {
    const session = await this.findSessionOrThrow(sessionId);

    ensureSessionAccess(session, authUser.sub);

    return session;
  }

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

      ensureSessionAccess(existingSession, authUser.sub);
      this.logger.log(`Reusing correction session ${existingSession.id} for ${input.documentId}`);
      return this.findSessionOrThrow(existingSession.id);
    }

    const document = await this.persistenceClient.getDocument(input.documentId);

    if (document.documentType !== input.documentType) {
      throw new BadRequestException(
        `Document ${input.documentId} belongs to type ${document.documentType}, not ${input.documentType}`,
      );
    }

    const session = this.correctionSessionsRepository.create({
      createdById: authUser.sub,
      documentId: input.documentId,
      documentType: input.documentType,
      draftPayload: document.payload,
      lockedById: authUser.sub,
      status: 'draft',
      submittedAt: null,
      version: 1,
    });

    await this.correctionSessionsRepository.save(session);
    this.logger.log(`Opened correction session ${session.id} for ${input.documentId}`);

    return this.findSessionOrThrow(session.id);
  }

  async saveDraft(
    input: SaveCorrectionSessionDraftInput,
    authUser: AuthUser,
  ): Promise<CorrectionSession> {
    const session = await this.findSessionOrThrow(input.sessionId);

    ensureSessionAccess(session, authUser.sub);

    if (session.version !== input.expectedVersion) {
      throw new ConflictException(
        `Correction session version mismatch: expected ${input.expectedVersion}, actual ${session.version}`,
      );
    }

    if (!isRecord(input.draftPayload)) {
      throw new BadRequestException('draftPayload must be a JSON object');
    }

    await this.persistenceClient.saveDocument(session.documentId, {
      documentType: session.documentType,
      payload: input.draftPayload,
    });

    session.draftPayload = input.draftPayload;
    session.lockedById = authUser.sub;
    session.version += 1;

    await this.correctionSessionsRepository.save(session);
    this.logger.log(`Saved draft for correction session ${session.id}`);

    return this.findSessionOrThrow(session.id);
  }

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

    return session;
  }
}
