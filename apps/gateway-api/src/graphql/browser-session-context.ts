import type {
  BrowserSessionRequest,
  BrowserSessionValidationContext,
} from '#app/auth/session/browser-session-authentication.service';
import type { SessionCookieResponse } from '#app/auth/session/browser-session-cookie.adapter';

import { recordsSessionActivity } from './operation-policy/session-activity.policy';

export interface BrowserSessionContextInput {
  params: SelectedOperationParameters;
  req: BrowserSessionGraphqlContext['req'];
  res: BrowserSessionGraphqlContext['res'];
}

export interface BrowserSessionGraphqlContext {
  readonly browserSession: BrowserSessionValidationContext;
  readonly req: BrowserSessionRequest;
  readonly res: SessionCookieResponse;
}

export interface SelectedOperationParameters {
  operationName?: unknown;
  query?: unknown;
  variables?: unknown;
}

/** Derives request activity from Yoga's selected operation, never public flags. */
export function createBrowserSessionGraphqlContext({
  params,
  req,
  res,
}: BrowserSessionContextInput): BrowserSessionGraphqlContext {
  const query = typeof params.query === 'string' ? params.query : '';
  const operationName = typeof params.operationName === 'string' ? params.operationName : undefined;

  return {
    browserSession: Object.freeze({
      recordActivity: recordsSessionActivity(query, operationName, params.variables),
    }),
    req,
    res,
  };
}
