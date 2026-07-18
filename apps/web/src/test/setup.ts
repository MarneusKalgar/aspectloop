import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { graphqlHandlers } from '../mocks/handlers/graphql';

export const server = setupServer(...graphqlHandlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  cleanup();
  document.cookie = 'elemika_access_token=; Max-Age=0; path=/';
  server.resetHandlers();
  window.history.pushState({}, '', '/');
});

afterAll(() => {
  server.close();
});
