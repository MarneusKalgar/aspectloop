import { z } from 'zod';

export const platformErrorResponseSchema = z.object({
  message: z.union([z.string().min(1).max(512), z.array(z.string().min(1).max(512)).max(10)]),
  statusCode: z.number().int().min(400).max(599),
});

export type PlatformErrorResponse = z.infer<typeof platformErrorResponseSchema>;
