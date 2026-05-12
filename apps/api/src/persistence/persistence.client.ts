import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PersistenceDocumentStore } from './interfaces';
import { PersistenceDocument, SavePersistenceDocumentInput } from './persistence.types';
import { parsePersistenceResponse } from './utils/index';

@Injectable()
export class PersistenceClient implements PersistenceDocumentStore {
  private readonly baseUrl: string;
  private readonly logger = new Logger(PersistenceClient.name);
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.getOrThrow<string>('PERSISTENCE_BASE_URL').replace(/\/$/, '');
    this.timeoutMs = this.configService.get<number>('PERSISTENCE_REQUEST_TIMEOUT_MS') ?? 5000;
  }

  async getDocument(documentId: string): Promise<PersistenceDocument> {
    const response = await this.fetchDocument(documentId);

    return parsePersistenceResponse(response, documentId);
  }

  async saveDocument(
    documentId: string,
    input: SavePersistenceDocumentInput,
  ): Promise<PersistenceDocument> {
    const response = await this.fetchDocument(documentId, {
      body: JSON.stringify(input),
      headers: {
        'content-type': 'application/json',
      },
      method: 'PUT',
    });

    return parsePersistenceResponse(response, documentId);
  }

  private async fetchDocument(documentId: string, init?: RequestInit): Promise<Response> {
    try {
      return await fetch(`${this.baseUrl}/documents/${encodeURIComponent(documentId)}`, {
        ...init,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      this.logger.error(
        `Persistence request failed for document ${documentId}`,
        error instanceof Error ? error.stack : String(error),
      );

      throw new BadGatewayException(
        `Persistence service is unavailable for document ${documentId}`,
      );
    }
  }
}
