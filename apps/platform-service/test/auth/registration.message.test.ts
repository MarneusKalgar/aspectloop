import { createConfirmationMessage } from '@platform/auth/registration/registration.message';
import { expect, test } from 'vitest';

/** Proves fixed message content, configured origin and fragment-only token rendering without a service. */
function confirmationMessage(): void {
  const rawToken = `00000000-0000-4000-8000-000000000001.${'A'.repeat(43)}`;
  const to = 'reviewer@example.test';
  const message = createConfirmationMessage('https://app.example.test', { rawToken, to });

  expect(message).toEqual({
    subject: 'Confirm your AspectLoop email',
    text: `Use this link to confirm your email:\n\nhttps://app.example.test/confirm-email#token=${rawToken}\n\nIf you did not request this email, you can ignore it.`,
    to,
  });
}

test('confirmation text is built independently of Nest service orchestration', confirmationMessage);
