import { CORRECTION_OUTBOX_EVENT_TYPE_DOCUMENT_CORRECTED } from '../correction-flow.types';

export interface BuildCorrectedDocumentEventInput {
  correctedAt: Date;
  correctedBy: string;
  documentId: string;
  documentType: string;
  eventId: string;
  idempotencyKey: string;
  sessionId: string;
  version: number;
}

/**
 * Builds the corrected-document event payload written to the outbox and published
 * to RabbitMQ.
 */
export function buildCorrectedDocumentEvent(
  input: BuildCorrectedDocumentEventInput,
): Record<string, unknown> {
  return {
    correctedAt: input.correctedAt.toISOString(),
    correctedBy: input.correctedBy,
    correctionSessionId: input.sessionId,
    documentId: input.documentId,
    documentType: input.documentType,
    eventId: input.eventId,
    eventType: CORRECTION_OUTBOX_EVENT_TYPE_DOCUMENT_CORRECTED,
    idempotencyKey: input.idempotencyKey,
    version: input.version,
  };
}
