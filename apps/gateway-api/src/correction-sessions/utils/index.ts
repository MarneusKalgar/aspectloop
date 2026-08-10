import { ConflictException } from '@nestjs/common';

import { CorrectionSession } from '../correction-session.entity';

/**
 * Ensures that a correction session is only accessed by its owning user.
 */
export function ensureSessionAccess(session: CorrectionSession, userId: string): void {
  if (session.lockedById && session.lockedById !== userId) {
    throw new ConflictException(`Document ${session.documentId} is locked by another user`);
  }

  if (session.createdById !== userId) {
    throw new ConflictException(`User ${userId} does not own correction session ${session.id}`);
  }
}

/**
 * Looks up a legacy flat payload value for a registry field path.
 */
export function findLegacyFieldValue(
  payload: Record<string, unknown>,
  fieldId: string,
  fieldPath: string,
): unknown {
  const fieldName = fieldPath.split('.').at(-1);

  if (fieldName && payload[fieldName] !== undefined) {
    return payload[fieldName];
  }

  if (payload[fieldId] !== undefined) {
    return payload[fieldId];
  }

  return undefined;
}
