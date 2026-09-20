import type { User } from '../users/user.entity';

export interface ActiveAuthSession {
  effectiveExpiresAt: Date;
  issuedAt: Date;
  refreshToken: string;
  sessionId: string;
  user: User;
}
