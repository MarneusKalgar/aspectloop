import type {
  BrowserSessionRequest,
  BrowserSessionValidationContext,
} from '#app/auth/session/browser-session-authentication.service';

import { recordsSessionActivity } from './operation-policy/session-activity.policy';

export interface BrowserSessionGraphqlContext {
  readonly browserSession: BrowserSessionValidationContext;
  readonly req: BrowserSessionRequest;
}

interface SelectedOperationParameters {
  operationName?: unknown;
  query?: unknown;
}

/** Derives request activity from Yoga's selected operation, never public flags. */
export function createBrowserSessionGraphqlContext(
  req: BrowserSessionRequest,
  params: SelectedOperationParameters,
): BrowserSessionGraphqlContext {
  const query = typeof params.query === 'string' ? params.query : '';
  const operationName = typeof params.operationName === 'string' ? params.operationName : undefined;

  return {
    browserSession: Object.freeze({ recordActivity: recordsSessionActivity(query, operationName) }),
    req,
  };
}
