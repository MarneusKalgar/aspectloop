import { z } from 'zod';

import { PLATFORM_SERVICE_NAME } from './health.constants';

export const platformHealthResponseSchema = z
  .object({
    service: z.literal(PLATFORM_SERVICE_NAME),
    status: z.literal('ok'),
  })
  .strict();

export const platformReadinessResponseSchema = z
  .object({
    service: z.literal(PLATFORM_SERVICE_NAME),
    status: z.literal('ready'),
  })
  .strict();

export type PlatformHealthResponse = z.infer<typeof platformHealthResponseSchema>;
export type PlatformReadinessResponse = z.infer<typeof platformReadinessResponseSchema>;
