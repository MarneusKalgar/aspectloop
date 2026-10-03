import { setGraphqlNoStore } from '@gateway/core/graphql-http.middleware';
import { expect, test, vi } from 'vitest';

/** Pins cache prevention on the HTTP route before Yoga handles a request. */
function testGraphqlNoStore(): void {
  const setHeader = vi.fn();
  const next = vi.fn();

  setGraphqlNoStore({}, { setHeader }, next);

  expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  expect(next).toHaveBeenCalledOnce();
}

test('marks every GraphQL HTTP response no-store', testGraphqlNoStore);
