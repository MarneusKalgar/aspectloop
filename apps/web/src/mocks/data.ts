import type { MeQuery } from '@app/graphql/generated/graphql';

import { defaultMockReviewerCredentials } from './fixtures/default-reviewer';

interface CorrectionSessionSummary {
  documentId: string;
  documentType: string;
  id: string;
  status: string;
  updatedAt: string;
  version: number;
}

type MockPublicUser = NonNullable<MeQuery['me']>;
type MockUserRecord = MockPublicUser & { password: string };

const now = new Date().toISOString();

const defaultUser: MockUserRecord = {
  createdAt: now,
  displayName: 'Correction Tester',
  email: defaultMockReviewerCredentials.email,
  id: 'mock-user-1',
  password: defaultMockReviewerCredentials.password,
  roles: ['CORRECTOR'],
  scopes: ['corrections:write'],
  updatedAt: now,
};

const defaultSession: CorrectionSessionSummary = {
  documentId: 'demo-invoice-001',
  documentType: 'supplier_invoice',
  id: 'mock-session-1',
  status: 'draft',
  updatedAt: now,
  version: 1,
};

const mockUsers = new Map<string, MockUserRecord>([[defaultUser.email, defaultUser]]);
let currentSessionUserId: null | string = null;
const mockSessions = new Map<string, CorrectionSessionSummary>([
  [defaultSession.id, defaultSession],
]);

/** Removes the mock session between tests or after sign-out. */
export function clearMockSessionUser(): void {
  currentSessionUserId = null;
}

/** Adds a mock account without creating an authenticated session. */
export function createMockUser(input: {
  displayName: string;
  email: string;
  password: string;
}): MockUserRecord {
  const timestamp = new Date().toISOString();
  const user: MockUserRecord = {
    createdAt: timestamp,
    displayName: input.displayName,
    email: input.email,
    id: `mock-user-${mockUsers.size + 1}`,
    password: input.password,
    roles: ['CORRECTOR'],
    scopes: ['corrections:write'],
    updatedAt: timestamp,
  };

  mockUsers.set(user.email, user);

  return user;
}

/** Finds only the mock account required to verify sign-in credentials. */
export function findMockUserByEmail(email: string): MockUserRecord | undefined {
  return mockUsers.get(email);
}

/** Finds one stable correction fixture without changing authentication state. */
export function getMockSession(sessionId: string) {
  return mockSessions.get(sessionId) ?? null;
}

/** Returns a secret-free public projection for the current mock session. */
export function getMockSessionUser(): MockPublicUser | null {
  const user = [...mockUsers.values()].find((candidate) => candidate.id === currentSessionUserId);

  return user ? toMockPublicUser(user) : null;
}

/** Returns the in-memory correction fixtures for an authenticated mock query. */
export function listMockSessions(): CorrectionSessionSummary[] {
  return [...mockSessions.values()];
}

/** Keeps a browser-mock session in memory without issuing a readable credential. */
export function setMockSessionUser(userId: string): void {
  currentSessionUserId = userId;
}

/** Projects only public user fields into mocked GraphQL responses. */
export function toMockPublicUser(user: MockUserRecord): MockPublicUser {
  return {
    createdAt: user.createdAt,
    displayName: user.displayName,
    email: user.email,
    id: user.id,
    roles: user.roles,
    scopes: user.scopes,
    updatedAt: user.updatedAt,
  };
}
