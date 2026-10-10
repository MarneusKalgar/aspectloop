import type {
  PlatformConfirmEmailRequest,
  PlatformPreparedResendEmailConfirmationRequest,
  PlatformPreparedSignUpRequest,
} from '@aspectloop/contracts/platform';

import {
  AUTH_ERROR_CODE,
  platformConfirmEmailRequestSchema,
  platformPreparedResendEmailConfirmationRequestSchema,
  platformPreparedSignUpRequestSchema,
} from '@aspectloop/contracts/platform';
import { BadRequestException } from '@nestjs/common';

import { parsePlatformRequest } from '#app/internal/parse-platform-request';
import { isMailAddress } from '#app/mail/message/mail-message';

import { PlatformAuthException } from '../platform-auth.exception';

/** Maps invalid token strings uniformly while retaining fixed structural request rejections. */
export function parseRegistrationConfirmation(input: unknown): PlatformConfirmEmailRequest {
  const parsed = platformConfirmEmailRequestSchema.safeParse(input);

  if (!parsed.success) {
    if (hasOnlyStringToken(input)) {
      throw new PlatformAuthException(
        AUTH_ERROR_CODE.CONFIRMATION_INVALID,
        'Email confirmation is invalid',
      );
    }

    throw new BadRequestException('Invalid Platform request');
  }

  return parsed.data;
}

/** Validates and normalizes prepared resend before identity admission or persistence. */
export function parseRegistrationResend(
  input: unknown,
): PlatformPreparedResendEmailConfirmationRequest {
  const parsed = parsePlatformRequest(platformPreparedResendEmailConfirmationRequestSchema, input);
  assertDeliverableMailbox(parsed.email);
  return parsed;
}

/** Validates prepared signup without changing exact password bytes or live identity contracts. */
export function parseRegistrationSignUp(input: unknown): PlatformPreparedSignUpRequest {
  const parsed = parsePlatformRequest(platformPreparedSignUpRequestSchema, input);
  assertDeliverableMailbox(parsed.email);
  return parsed;
}

/** Rejects syntax disagreements with D1 before hashing or account/token persistence. */
function assertDeliverableMailbox(email: string): void {
  if (!isMailAddress(email)) {
    throw new BadRequestException('Invalid Platform request');
  }
}

/** Recognizes only the strict string-token request shape, including empty/oversized candidates. */
function hasOnlyStringToken(input: unknown): input is { token: string } {
  return (
    input !== null &&
    typeof input === 'object' &&
    !Array.isArray(input) &&
    Object.keys(input).length === 1 &&
    Object.hasOwn(input, 'token') &&
    'token' in input &&
    typeof input.token === 'string'
  );
}
