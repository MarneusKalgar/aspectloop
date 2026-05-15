import { setupWorker } from 'msw/browser';

import { graphqlHandlers } from './handlers/graphql';

export const worker = setupWorker(...graphqlHandlers);
