import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

type EnvironmentClass<TEnvironment extends object> = new () => TEnvironment;

/**
 * Transforms raw environment values and enforces a service-owned validation schema.
 *
 * @param environmentClass Service-local class-validator schema.
 * @param config Raw environment configuration supplied by NestJS.
 * @returns A transformed and validated configuration instance.
 * @throws When one or more environment values violate the schema.
 */
export function validateEnvironment<TEnvironment extends object>(
  environmentClass: EnvironmentClass<TEnvironment>,
  config: Record<string, unknown>,
): TEnvironment {
  const validatedConfig = plainToInstance(environmentClass, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const messages = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('\n');
    throw new Error(`Environment validation failed:\n${messages}`);
  }

  return validatedConfig;
}
