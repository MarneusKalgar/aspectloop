import type { User } from '#app/users/user.entity';

export interface ActiveAuthSession {
  effectiveExpiresAt: Date;
  issuedAt: Date;
  refreshToken: string;
  sessionId: string;
  user: User;
}

export interface IssuedBrowserSession {
  sessionCredential: string;
  sessionExpiresAt: Date;
  sessionId: string;
  user: User;
}

export interface ValidatedBrowserSession {
  sessionExpiresAt: Date;
  sessionId: string;
  user: User;
}
