import { PLATFORM_EMAIL_CONFIRMATION_TOKEN_MAX_LENGTH } from '@aspectloop/contracts/platform';

const LINK_TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/;

/** Removes even malformed fragments before routing, workers, or session bootstrap can run. */
export function captureConfirmationLink(): null | string {
  if (window.location.pathname !== '/confirm-email') {
    return null;
  }

  const token = readConfirmationFragment(window.location.hash);
  window.history.replaceState(null, '', '/confirm-email');

  return token;
}

/** Accepts the opaque UUID/secret alphabet in one bounded, unambiguous fragment. */
export function readConfirmationFragment(fragment: string): null | string {
  const prefix = '#token=';

  if (
    !fragment.startsWith(prefix) ||
    fragment.length > prefix.length + PLATFORM_EMAIL_CONFIRMATION_TOKEN_MAX_LENGTH
  ) {
    return null;
  }

  const token = fragment.slice(prefix.length);

  // Syntax admission is not proof of validity; only Platform can authenticate and consume it.
  return LINK_TOKEN_PATTERN.test(token) ? token : null;
}
