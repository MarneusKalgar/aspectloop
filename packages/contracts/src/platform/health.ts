import { z } from 'zod';

export const platformHealthResponseSchema = z
  .object({
    service: z.literal('platform-service'),
    status: z.literal('ok'),
  })
  .strict();

export const platformReadinessResponseSchema = z
  .object({
    service: z.literal('platform-service'),
    status: z.literal('ready'),
  })
  .strict();

export type PlatformHealthResponse = z.infer<typeof platformHealthResponseSchema>;
export type PlatformReadinessResponse = z.infer<typeof platformReadinessResponseSchema>;
