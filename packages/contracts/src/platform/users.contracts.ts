import { z } from 'zod';

import { PLATFORM_IDENTITY_POLICY } from './identity.constants';

export const platformUserViewSchema = z
  .object({
    createdAt: z.iso.datetime({ offset: true }),
    displayName: z.string().min(1).max(PLATFORM_IDENTITY_POLICY.DISPLAY_NAME_MAX_LENGTH),
    email: z.string().min(1).max(PLATFORM_IDENTITY_POLICY.EMAIL_MAX_LENGTH),
    id: z.uuid(),
    roles: z.array(z.string().min(1)),
    scopes: z.array(z.string().min(1)),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const platformUserResponseSchema = z
  .object({
    user: platformUserViewSchema.nullable(),
  })
  .strict();

export const platformUsersBatchRequestSchema = z
  .object({
    userIds: z.array(z.uuid()).max(100),
  })
  .strict();

export const platformUsersBatchResponseSchema = z
  .object({
    users: z.array(platformUserViewSchema).max(100),
  })
  .strict();

export type PlatformUserResponse = z.infer<typeof platformUserResponseSchema>;
export type PlatformUsersBatchRequest = z.infer<typeof platformUsersBatchRequestSchema>;
export type PlatformUsersBatchResponse = z.infer<typeof platformUsersBatchResponseSchema>;
export type PlatformUserView = z.infer<typeof platformUserViewSchema>;
