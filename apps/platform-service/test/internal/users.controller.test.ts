import { expect, test, vi } from 'vitest';

import type { User } from '../../src/users/user.entity';
import type { UsersService } from '../../src/users/users.service';

import { UsersController } from '../../src/users/users.controller';

const USER_ID = '9d30c36d-5ae4-4f1b-b127-15f32de2f7cb';

/** Creates persistence state containing a password hash that must never cross HTTP. */
function createUser(): User {
  return {
    createdAt: new Date('2026-09-12T00:00:00.000Z'),
    displayName: 'Reviewer',
    email: 'reviewer@example.test',
    emailVerifiedAt: new Date('2026-09-12T00:00:00.000Z'),
    id: USER_ID,
    passwordHash: 'private-hash',
    roles: ['CORRECTOR'],
    scopes: ['corrections:write'],
    updatedAt: new Date('2026-09-12T00:00:00.000Z'),
  };
}

/** Verifies a batch request produces one bounded repository call. */
async function testBatchUsers(): Promise<void> {
  const findByIds = vi.fn().mockResolvedValue([createUser()]);
  const controller = new UsersController({ findByIds } as unknown as UsersService);

  await expect(controller.getUsers({ userIds: [USER_ID] })).resolves.toMatchObject({
    users: [{ id: USER_ID }],
  });
  expect(findByIds).toHaveBeenCalledWith([USER_ID]);
}

/** Verifies user responses follow the password-free runtime contract. */
async function testUserView(): Promise<void> {
  const findById = vi.fn().mockResolvedValue(createUser());
  const controller = new UsersController({ findById } as unknown as UsersService);

  const response = await controller.getUser(USER_ID);

  expect(response.user).toMatchObject({ id: USER_ID });
  expect(response.user).not.toHaveProperty('passwordHash');
}

test('returns password-free internal user views', testUserView);
test('delegates bounded user batches once', testBatchUsers);
