import type { OpaqueTokenService } from '#app/auth/credentials/opaque-token.service';

import { OPAQUE_TOKEN_PURPOSE } from '#app/auth/credentials/opaque-token.service';
import { EMAIL_CONFIRMATION } from '#app/auth/registration/registration.constants';
import { createConfirmationMessage } from '#app/auth/registration/registration.message';
import { MAIL_LIMITS } from '#app/mail/mail.port';

const CAPTURE_ORIGIN = 'http://mailpit:8025';
const REQUEST_TIMEOUT_MS = 2000;
const MAX_RESPONSE_BYTES = 131_072;
const OWNED_RECIPIENT = /^auth-http-[0-9a-f-]{36}@example\.test$/;
const CAPTURE_ID = /^[a-zA-Z0-9_-]{1,64}$/;

/** Captures only one run's private messages; never exposes an inbox-wide delete surface. */
export class OwnedMailCapture {
  private readonly ownedIds = new Set<string>();

  /** Restricts search to a verifier-created recipient and fixed subject, not arbitrary mail. */
  constructor(
    private readonly recipient: string,
    private readonly subject: string,
  ) {
    if (
      !OWNED_RECIPIENT.test(recipient) ||
      (subject !== `D1 mail ${recipient.slice(10, 46)}` && subject !== EMAIL_CONFIRMATION.SUBJECT)
    ) {
      throw new Error('MAIL-CAPTURE ownership');
    }
  }

  /** Requires capture availability before submission; missing capture is never a skip. */
  async assertAvailable(): Promise<void> {
    await this.search();
  }

  /** Confirms exact owned cleanup without granting any inbox-wide deletion capability. */
  async assertEmpty(): Promise<void> {
    if ((await this.search()).length !== 0) {
      throw new Error('MAIL-CAPTURE cleanup incomplete');
    }
  }

  /** Deletes only recorded IDs after checking ownership, including late-visible delivery. */
  async cleanup(): Promise<void> {
    await this.search();

    if (this.ownedIds.size === 0) {
      return;
    }

    try {
      const response = await fetch(`${CAPTURE_ORIGIN}/api/v1/messages`, {
        body: JSON.stringify({ IDs: [...this.ownedIds] }),
        headers: { 'content-type': 'application/json' },
        method: 'DELETE',
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      await response.body?.cancel();

      if (!response.ok) {
        throw new Error('Capture delete failed');
      }
    } catch {
      throw new Error('MAIL-CAPTURE cleanup');
    }

    this.ownedIds.clear();
  }

  /** Reads bounded confirmation links privately; never navigates a URL or exposes the token/body. */
  async readConfirmationTokens(
    expectedCount: number,
    expectedFrom: string,
    webBaseUrl: string,
    tokens: OpaqueTokenService,
  ): Promise<string[]> {
    if (
      this.subject !== EMAIL_CONFIRMATION.SUBJECT ||
      !Number.isInteger(expectedCount) ||
      expectedCount < 1 ||
      expectedCount > 10
    ) {
      throw new Error('MAIL-CAPTURE confirmation request');
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const ids = await this.search();

      if (ids.length === expectedCount) {
        const result: string[] = [];

        for (const id of ids) {
          const message = await this.request(`/api/v1/message/${id}`);

          if (
            !isRecord(message) ||
            typeof message.Text !== 'string' ||
            message.Text.length > MAIL_LIMITS.TEXT_BYTES ||
            !isRecord(message.From) ||
            message.From.Address !== expectedFrom ||
            message.Subject !== this.subject ||
            !Array.isArray(message.To) ||
            message.To.length !== 1 ||
            !isRecord(message.To[0]) ||
            message.To[0].Address !== this.recipient
          ) {
            throw new Error('MAIL-CAPTURE content');
          }

          const text = message.Text.replace(/\r\n/g, '\n').trimEnd();
          const candidate = text.split('\n')[2];
          let link: URL;

          try {
            link = new URL(candidate ?? '');
          } catch {
            throw new Error('MAIL-CAPTURE confirmation link');
          }

          if (
            link.origin !== new URL(webBaseUrl).origin ||
            link.pathname !== EMAIL_CONFIRMATION.PATH ||
            link.search !== '' ||
            link.username !== '' ||
            link.password !== '' ||
            !link.hash.startsWith('#token=')
          ) {
            throw new Error('MAIL-CAPTURE confirmation link');
          }

          const rawToken = link.hash.slice('#token='.length);

          if (
            !tokens.parse(rawToken, OPAQUE_TOKEN_PURPOSE.EMAIL_VERIFICATION) ||
            createConfirmationMessage(webBaseUrl, { rawToken, to: this.recipient }).text !== text
          ) {
            throw new Error('MAIL-CAPTURE confirmation content');
          }

          result.push(rawToken);
        }

        if (new Set(result).size !== expectedCount) {
          throw new Error('MAIL-CAPTURE duplicate');
        }

        return result;
      }

      if (ids.length > expectedCount) {
        throw new Error('MAIL-CAPTURE duplicate');
      }

      /** Allows only a bounded capture visibility delay after private delivery completion. */
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
    }

    throw new Error('MAIL-CAPTURE missing');
  }

  /** Finds and checks owned text privately; raw recipient/body values never reach stdout. */
  async verifyText(expectedText: string, expectedFrom: string): Promise<void> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const ids = await this.search();

      if (ids.length > 0) {
        if (ids.length !== 1) {
          throw new Error('MAIL-CAPTURE duplicate');
        }

        const message = await this.request(`/api/v1/message/${ids[0]}`);

        if (
          !isRecord(message) ||
          typeof message.Text !== 'string' ||
          message.Text.replace(/\r\n/g, '\n').trimEnd() !== expectedText ||
          !isRecord(message.From) ||
          message.From.Address !== expectedFrom ||
          message.Subject !== this.subject
        ) {
          throw new Error('MAIL-CAPTURE content');
        }

        return;
      }

      /** Allows a short bounded visibility delay after the SMTP acknowledgement. */
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
    }

    throw new Error('MAIL-CAPTURE missing');
  }

  /** Requests only a fixed local capture route without following redirects. */
  private async request(path: string): Promise<unknown> {
    let response: Response;

    try {
      response = await fetch(`${CAPTURE_ORIGIN}${path}`, {
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        await response.body?.cancel();

        throw new Error('Capture request failed');
      }
    } catch {
      throw new Error('MAIL-CAPTURE unavailable');
    }

    return readJson(response);
  }

  /** Searches a unique owned recipient and records only exact subject/recipient matches. */
  private async search(): Promise<string[]> {
    const query = encodeURIComponent(`to:${this.recipient}`);
    const envelope = await this.request(`/api/v1/search?query=${query}&limit=10`);

    if (
      !isRecord(envelope) ||
      !Array.isArray(envelope.messages) ||
      envelope.messages.length > 10 ||
      typeof envelope.messages_count !== 'number' ||
      !Number.isInteger(envelope.messages_count) ||
      envelope.messages_count < 0 ||
      envelope.messages_count > 10
    ) {
      throw new Error('MAIL-CAPTURE malformed');
    }

    const ids: string[] = [];

    for (const message of envelope.messages) {
      if (!isRecord(message) || message.Subject !== this.subject) {
        continue;
      }

      if (
        typeof message.ID !== 'string' ||
        !CAPTURE_ID.test(message.ID) ||
        message.ID === 'latest' ||
        !Array.isArray(message.To) ||
        message.To.length !== 1 ||
        !isRecord(message.To[0]) ||
        message.To[0].Address !== this.recipient
      ) {
        throw new Error('MAIL-CAPTURE ownership');
      }

      this.ownedIds.add(message.ID);
      ids.push(message.ID);
    }

    return ids;
  }
}

/** Narrows API envelopes without including private values in failure messages. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Reads a bounded private API response without retaining provider diagnostics in errors. */
async function readJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error('MAIL-CAPTURE malformed');
  }

  const chunks: Buffer[] = [];
  let size = 0;

  try {
    while (true) {
      const next = await reader.read();

      if (next.done) {
        break;
      }

      size += next.value.byteLength;

      if (size > MAX_RESPONSE_BYTES) {
        throw new Error('MAIL-CAPTURE malformed');
      }

      chunks.push(Buffer.from(next.value));
    }

    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new Error('MAIL-CAPTURE malformed');
  } finally {
    try {
      await reader.cancel();
    } catch {
      // A failed response stream is already unusable; do not expose its transport diagnostics.
    }

    reader.releaseLock();
  }
}
