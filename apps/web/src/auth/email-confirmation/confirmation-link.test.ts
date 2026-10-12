import { describe, expect, it } from 'vitest';

import { captureConfirmationLink, readConfirmationFragment } from './confirmation-link';

const TOKEN = `7af8ba5c-3798-49b1-9db5-a27483e147bd.${'A'.repeat(43)}`;

describe('confirmation startup capture', /** Groups the bounded startup and sanitation cases. */ () => {
  /** Captures only a single bounded fragment and rejects ambiguous or unsafe syntax. */
  it('accepts the server token alphabet but rejects malformed and oversized fragments', () => {
    expect(readConfirmationFragment(`#token=${TOKEN}`)).toBe(TOKEN);

    for (const fragment of [
      '',
      '#token=',
      '#token=not-an-opaque-token',
      '#other=secret',
      '#token=a&token=b',
      '#token=%00',
      '#token=<script>',
      `#token=${'a'.repeat(129)}`,
    ]) {
      expect(readConfirmationFragment(fragment)).toBeNull();
    }
  });

  /** Replaces the current entry without copying secret-bearing state or query parameters. */
  it('strips a valid link before asynchronous work and retains nothing in history', () => {
    window.history.replaceState({ unsafe: TOKEN }, '', `/confirm-email?ignored=1#token=${TOKEN}`);
    expect(captureConfirmationLink()).toBe(TOKEN);
    expect(window.location.pathname).toBe('/confirm-email');
    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe('');
    expect(window.history.state).toBeNull();
    expect(captureConfirmationLink()).toBeNull();
  });

  /** Invalid fragments are also removed so opening/reloading cannot forward them elsewhere. */
  it('strips malformed fragments without retaining a token', () => {
    window.history.replaceState(null, '', '/confirm-email#token=a&token=b');
    expect(captureConfirmationLink()).toBeNull();
    expect(window.location.hash).toBe('');
  });
});
