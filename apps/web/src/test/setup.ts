import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';

import { SESSION_MARKER_KEY } from '../auth/session-coordination/session-marker';
import { clearMockSessionUser } from '../mocks/data';
import { graphqlHandlers } from '../mocks/handlers/graphql';
import { createQueuedTestLocks } from './session-environment';

export const server = setupServer(...graphqlHandlers);

beforeEach(
  /** jsdom has no native Web Locks; install an explicitly test-only exclusive queue. */
  () => {
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: createQueuedTestLocks(),
    });
    window.localStorage.removeItem(SESSION_MARKER_KEY);
  },
);

beforeAll(
  /** Starts the scoped mock server before human-run test execution. */
  () => {
    server.listen({ onUnhandledRequest: 'error' });
  },
);

afterEach(
  /** Retires app effects before resetting only test-owned session state. */
  () => {
    cleanup();
    clearMockSessionUser();
    server.resetHandlers();
    window.history.pushState({}, '', '/');
    window.localStorage.removeItem(SESSION_MARKER_KEY);
  },
);

afterAll(
  /** Closes the mock server after the human-run suite finishes. */
  () => {
    server.close();
  },
);
