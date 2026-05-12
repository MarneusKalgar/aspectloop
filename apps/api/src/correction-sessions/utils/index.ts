import { ConflictException } from '@nestjs/common';

import { CorrectionSession } from '../correction-session.entity';

export function ensureSessionAccess(session: CorrectionSession, userId: string): void {
  if (session.lockedById && session.lockedById !== userId) {
    throw new ConflictException(`Document ${session.documentId} is locked by another user`);
  }

  if (session.createdById !== userId) {
    throw new ConflictException(`User ${userId} does not own correction session ${session.id}`);
  }
}
