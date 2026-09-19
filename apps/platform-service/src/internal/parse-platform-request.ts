import { BadRequestException } from '@nestjs/common';

interface RuntimeSchema<T> {
  safeParse(value: unknown): { data: T; success: true } | { success: false };
}

/** Validates an internal request without exposing schema diagnostics to callers. */
export function parsePlatformRequest<T>(schema: RuntimeSchema<T>, value: unknown): T {
  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    throw new BadRequestException('Invalid Platform request');
  }

  return parsed.data;
}
