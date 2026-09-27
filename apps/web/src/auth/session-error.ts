/** Public GraphQL auth codes consumed by Web without importing backend contracts. */
export const BROWSER_SESSION_ERROR_CODE = Object.freeze({
  EMAIL_UNVERIFIED: 'AUTH_EMAIL_UNVERIFIED',
  INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  RATE_LIMITED: 'AUTH_RATE_LIMITED',
  SESSION_INVALID: 'AUTH_SESSION_INVALID',
});

/** Finds only stable auth codes in an Apollo GraphQL error chain. */
export function getSessionErrorCode(error: unknown): null | string {
  if (error === null || typeof error !== 'object') {
    return null;
  }

  if ('extensions' in error && error.extensions !== null && typeof error.extensions === 'object') {
    const extensions = error.extensions;

    if ('code' in extensions && typeof extensions.code === 'string') {
      return extensions.code;
    }
  }

  if ('errors' in error && Array.isArray(error.errors)) {
    const nestedErrors: unknown[] = error.errors;

    for (const item of nestedErrors) {
      const code = getSessionErrorCode(item);

      if (code) {
        return code;
      }
    }
  }

  if ('cause' in error) {
    return getSessionErrorCode(error.cause);
  }

  return null;
}

/** Recognizes expected sign-in rejections that leave the current state intact. */
export function isExpectedSignInRejection(error: unknown): boolean {
  const code = getSessionErrorCode(error);

  return (
    code === BROWSER_SESSION_ERROR_CODE.INVALID_CREDENTIALS ||
    code === BROWSER_SESSION_ERROR_CODE.EMAIL_UNVERIFIED ||
    code === BROWSER_SESSION_ERROR_CODE.RATE_LIMITED
  );
}

/** Distinguishes an expired or revoked session from an unavailable dependency. */
export function isInvalidSessionError(error: unknown): boolean {
  return getSessionErrorCode(error) === BROWSER_SESSION_ERROR_CODE.SESSION_INVALID;
}
