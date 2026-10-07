import { platformBrowserSessionCredentialSchema } from '@aspectloop/contracts/platform';

export const BROWSER_SESSION_COOKIE_NAME = 'aspectloop_session';
const COOKIE_PATH = '/graphql';
const MAX_COOKIE_HEADER_LENGTH = 8192;

export interface SessionCookieResponse {
  append(name: string, value: string): unknown;
}

/** Reads and writes the host-only browser credential at the Gateway boundary. */
export class BrowserSessionCookieAdapter {
  private readonly secure: boolean;

  /** The local HTTP exception is limited to development and test. */
  constructor(nodeEnvironment: string) {
    this.secure = nodeEnvironment === 'stage' || nodeEnvironment === 'production';
  }

  /** Clears the same cookie name, path, and security scope used for issuance. */
  clear(response: SessionCookieResponse): void {
    response.append(
      'Set-Cookie',
      `${BROWSER_SESSION_COOKIE_NAME}=; Path=${COOKIE_PATH}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; SameSite=Lax${this.secure ? '; Secure' : ''}`,
    );
  }

  /** Expires only the proven host-only, root-path historical access cookie. */
  clearLegacy(response: SessionCookieResponse): void {
    response.append(
      'Set-Cookie',
      `aspectloop_access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax${this.secure ? '; Secure' : ''}`,
    );
  }

  /** Accepts exactly one canonical browser-session credential from Cookie. */
  read(cookieHeader: unknown): null | string {
    if (typeof cookieHeader !== 'string' || cookieHeader.length > MAX_COOKIE_HEADER_LENGTH) {
      return null;
    }

    let credential: null | string = null;

    for (const cookie of cookieHeader.split(';')) {
      const separator = cookie.indexOf('=');

      if (separator < 0 || cookie.slice(0, separator).trim() !== BROWSER_SESSION_COOKIE_NAME) {
        continue;
      }

      if (credential !== null) {
        return null;
      }

      const candidate = cookie.slice(separator + 1).trim();

      if (!platformBrowserSessionCredentialSchema.safeParse(candidate).success) {
        return null;
      }

      credential = candidate;
    }

    return credential;
  }

  /** Sets the credential only after a confirmed Platform sign-in. */
  set(response: SessionCookieResponse, credential: string, absoluteExpiry: string): void {
    const parsed = platformBrowserSessionCredentialSchema.safeParse(credential);
    const expires = new Date(absoluteExpiry);

    if (!parsed.success || Number.isNaN(expires.getTime())) {
      throw new Error('Invalid browser session cookie');
    }

    response.append(
      'Set-Cookie',
      `${BROWSER_SESSION_COOKIE_NAME}=${parsed.data}; Path=${COOKIE_PATH}; Expires=${expires.toUTCString()}; HttpOnly; SameSite=Lax${this.secure ? '; Secure' : ''}`,
    );
  }
}
