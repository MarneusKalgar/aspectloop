import {
  type AuthenticatedUser,
  createUnsignedAccessToken,
  readUserFromAccessToken,
} from '../auth/access-token';

interface CorrectionSessionSummary {
  documentId: string;
  documentType: string;
  id: string;
  status: string;
  updatedAt: string;
  version: number;
}

interface MockUserRecord extends AuthenticatedUser {
  createdAt: string;
  password: string;
  updatedAt: string;
}

const now = new Date().toISOString();

const defaultUser: MockUserRecord = {
  createdAt: now,
  displayName: 'Correction Tester',
  email: 'corrector@example.com',
  id: 'mock-user-1',
  password: 'Passw0rd!',
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
const mockSessions = new Map<string, CorrectionSessionSummary>([
  [defaultSession.id, defaultSession],
]);

export function createMockToken(user: MockUserRecord): string {
  return createUnsignedAccessToken({
    displayName: user.displayName,
    email: user.email,
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
    roles: user.roles,
    scopes: user.scopes,
    sub: user.id,
  });
}

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

export function findMockUserByEmail(email: string): MockUserRecord | undefined {
  return mockUsers.get(email);
}

export function findMockUserByToken(token: null | string): MockUserRecord | null {
  if (!token) {
    return null;
  }

  const userFromToken = readUserFromAccessToken(token);

  if (!userFromToken) {
    return null;
  }

  return [...mockUsers.values()].find((user) => user.id === userFromToken.id) ?? null;
}

export function getMockSession(sessionId: string) {
  return mockSessions.get(sessionId) ?? null;
}

export function listMockSessions(): CorrectionSessionSummary[] {
  return [...mockSessions.values()];
}
