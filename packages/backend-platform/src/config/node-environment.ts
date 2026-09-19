import type { ValidationOptions } from 'class-validator';

import { IsIn } from 'class-validator';

export const NODE_ENVIRONMENTS = ['development', 'test', 'stage', 'production'] as const;

export type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];

/**
 * Validates the shared backend deployment-environment vocabulary.
 *
 * @param validationOptions Optional class-validator behavior overrides.
 * @returns A property decorator restricted to supported Node environments.
 */
export function IsNodeEnvironment(validationOptions?: ValidationOptions): PropertyDecorator {
  return IsIn(NODE_ENVIRONMENTS, validationOptions);
}
