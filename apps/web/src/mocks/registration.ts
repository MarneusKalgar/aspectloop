import { findMockUserByEmail } from './data';

interface MockConfirmation {
  expiresAt: number;
  issuedAt: number;
  token: null | string;
}

const confirmations = new Map<string, MockConfirmation>();
const COOLDOWN_MS = 60_000;
const EXPIRY_MS = 60 * 60_000;

/** Clears test-owned mail state between isolated human-run tests. */
export function clearMockConfirmations(): void {
  confirmations.clear();
}

/** Consumes a current token exactly once without setting or replacing the mock session. */
export function consumeMockConfirmation(token: string, now = Date.now()): boolean {
  for (const [email, confirmation] of confirmations) {
    if (confirmation.token !== token || confirmation.expiresAt <= now) {
      continue;
    }

    const user = findMockUserByEmail(email);

    if (!user || user.emailVerified) {
      return false;
    }

    confirmation.token = null;
    user.emailVerified = true;

    return true;
  }

  return false;
}

/** Supplies a fixture-local link to tests, never a browser debug endpoint or public response. */
export function getMockConfirmationToken(email: string): null | string {
  return confirmations.get(email.trim().toLowerCase())?.token ?? null;
}

/** Models generic unknown/verified/cooldown suppression without changing a user's profile. */
export function requestMockConfirmation(email: string, now = Date.now()): void {
  const user = findMockUserByEmail(email);

  if (!user || user.emailVerified) {
    return;
  }

  const previous = confirmations.get(user.email);

  if (previous && now < previous.issuedAt + COOLDOWN_MS) {
    return;
  }

  confirmations.set(user.email, {
    expiresAt: now + EXPIRY_MS,
    issuedAt: now,
    token: `${crypto.randomUUID()}.${crypto.randomUUID().replaceAll('-', '')}${'A'.repeat(11)}`,
  });
}
