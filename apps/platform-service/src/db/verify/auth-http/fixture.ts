import type { DataSource } from 'typeorm';

import {
  PLATFORM_AUTH_ROLES,
  PLATFORM_AUTH_SCOPES,
  PLATFORM_IDENTITY_POLICY,
} from '@aspectloop/contracts/platform';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

import type { EnvironmentVariables } from '#app/config/env.schema';

import { PasswordService } from '#app/auth/credentials/password.service';
import { User } from '#app/users/user.entity';

export interface OwnedAuthFixture {
  email: string;
  id: string;
}

/** Creates an isolated, verified HTTP user using the production password hasher. */
export async function createOwnedAuthFixture(
  runtime: DataSource,
  environment: EnvironmentVariables,
  password: string,
): Promise<OwnedAuthFixture> {
  const id = randomUUID();
  const email = `auth-http-${id}@example.test`;
  const passwordHash = await new PasswordService(new ConfigService(environment)).hash(password);

  await runtime.getRepository(User).insert({
    displayName: 'Auth HTTP verification fixture',
    email,
    emailVerifiedAt: new Date(),
    id,
    passwordHash,
    roles: [...PLATFORM_AUTH_ROLES],
    scopes: [...PLATFORM_AUTH_SCOPES],
  });

  return { email, id };
}

/** Reads a human-supplied password from a terminal without echoing its bytes. */
export async function readPrivateFixturePassword(): Promise<string> {
  const input = process.stdin;

  if (!input.isTTY || !input.setRawMode) {
    throw new Error('Interactive terminal required for private fixture password');
  }

  input.setRawMode(true);
  input.resume();
  process.stdout.write('Fixture password (12-72 ASCII characters; hidden): ');

  try {
    return await new Promise<string>((resolve, reject) => {
      let password = '';

      /** Accepts one line while keeping all password bytes off stdout. */
      function onData(chunk: Buffer): void {
        for (const byte of chunk) {
          if (byte === 3) {
            input.off('data', onData);
            reject(new Error('Fixture creation cancelled'));
            return;
          }

          if (byte === 13 || byte === 10) {
            input.off('data', onData);
            process.stdout.write('\n');
            resolve(password);
            return;
          }

          if (byte === 8 || byte === 127) {
            password = password.slice(0, -1);
          } else if (
            byte >= 32 &&
            byte <= 126 &&
            password.length < PLATFORM_IDENTITY_POLICY.PASSWORD_MAX_UTF8_BYTES
          ) {
            password += String.fromCharCode(byte);
          }
        }
      }

      input.on('data', onData);
    });
  } finally {
    input.setRawMode(false);
    input.pause();
  }
}

/** Removes only the uniquely named fixture and its cascading sessions. */
export async function removeOwnedAuthFixture(cleanup: DataSource, id: string): Promise<void> {
  await cleanup.getRepository(User).delete({ email: `auth-http-${id}@example.test`, id });
}
