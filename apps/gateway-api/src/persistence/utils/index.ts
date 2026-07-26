import {
  BadGatewayException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { PersistenceDocument } from '../persistence.types';

export function ensurePersistenceDocument(value: unknown, documentId: string): PersistenceDocument {
  if (!isRecord(value)) {
    throw new InternalServerErrorException(
      `Persistence service returned an invalid payload for document ${documentId}`,
    );
  }

  const { documentId: payloadDocumentId, documentType, payload, updatedAt, version } = value;

  if (
    typeof payloadDocumentId !== 'string' ||
    typeof documentType !== 'string' ||
    !isRecord(payload) ||
    typeof updatedAt !== 'string' ||
    typeof version !== 'number'
  ) {
    throw new InternalServerErrorException(
      `Persistence service returned an invalid payload for document ${documentId}`,
    );
  }

  return {
    documentId: payloadDocumentId,
    documentType,
    payload,
    updatedAt,
    version,
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function parsePersistenceResponse(
  response: Response,
  documentId: string,
): Promise<PersistenceDocument> {
  if (response.status === 404) {
    throw new NotFoundException(`Document ${documentId} was not found in persistence service`);
  }

  if (!response.ok) {
    const responseMessage = await readPersistenceErrorMessage(response);

    throw new BadGatewayException(
      responseMessage
        ? `Persistence service request failed with status ${response.status} for document ${documentId}: ${responseMessage}`
        : `Persistence service request failed with status ${response.status} for document ${documentId}`,
    );
  }

  return ensurePersistenceDocument((await response.json()) as unknown, documentId);
}

async function readPersistenceErrorMessage(response: Response): Promise<null | string> {
  try {
    const responseBody = (await response.json()) as unknown;

    if (isRecord(responseBody) && typeof responseBody.message === 'string') {
      return responseBody.message;
    }

    return null;
  } catch {
    return null;
  }
}
