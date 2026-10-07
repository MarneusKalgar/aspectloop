import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { describe, expect, it } from 'vitest';

import { BROWSER_SESSION_ERROR_CODE } from '../session-error';
import { classifyCookieActionFailure } from './cookie-action-request';

/** Creates parsed completed GraphQL outcomes without issuing cookie requests. */
function completedError(code: string): CombinedGraphQLErrors {
  return new CombinedGraphQLErrors({
    errors: [{ extensions: { code }, message: 'Controlled response' }],
  });
}

describe('cookie action failure interpretation' /** Keeps Apollo error knowledge out of coordinator ordering and marker transitions. */, () => {
  it('recognizes expected rejection only for sign-in' /** A parsed response settles the action but does not acknowledge revocation. */, () => {
    const error = completedError(BROWSER_SESSION_ERROR_CODE.INVALID_CREDENTIALS);
    expect(classifyCookieActionFailure(error, 'sign-in')).toEqual({
      completed: true,
      expectedRejection: true,
    });
    expect(classifyCookieActionFailure(error, 'sign-out')).toEqual({
      completed: true,
      expectedRejection: false,
    });
  });
  it('separates completed outage from network/abort/malformed uncertainty' /** Transport settlement alone is not evidence of cookie completion. */, () => {
    const outage = completedError(BROWSER_SESSION_ERROR_CODE.DEPENDENCY_UNAVAILABLE);
    expect(classifyCookieActionFailure(outage, 'sign-out')).toEqual({
      completed: true,
      expectedRejection: false,
    });
    const uncertain = [
      new TypeError('Network failure'),
      new DOMException('Aborted', 'AbortError'),
      new Error('Malformed result'),
    ];

    for (const error of uncertain) {
      expect(classifyCookieActionFailure(error, 'sign-in')).toEqual({
        completed: false,
        expectedRejection: false,
      });
    }
  });
});
