import type {
  PlatformUserResponse,
  PlatformUsersBatchRequest,
  PlatformUsersBatchResponse,
} from '@aspectloop/contracts/platform';

import {
  PLATFORM_INTERNAL_API_PREFIX,
  platformUserResponseSchema,
  platformUsersBatchRequestSchema,
  platformUsersBatchResponseSchema,
} from '@aspectloop/contracts/platform';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';

import { parsePlatformRequest } from '../internal/parse-platform-request';
import { toPlatformUserView } from './user-view';
import { UsersService } from './users.service';

@Controller(`${PLATFORM_INTERNAL_API_PREFIX.slice(1)}/users`)
export class UsersController {
  /** Creates the internal user-query boundary. */
  constructor(private readonly usersService: UsersService) {}

  /** Returns one password-free user view or an explicit null result. */
  @Get(':userId')
  async getUser(
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<PlatformUserResponse> {
    const user = await this.usersService.findById(userId);

    return platformUserResponseSchema.parse({
      user: user ? toPlatformUserView(user) : null,
    });
  }

  /** Resolves a bounded set of users without exposing password hashes. */
  @Post('batch')
  async getUsers(@Body() body: unknown): Promise<PlatformUsersBatchResponse> {
    const request: PlatformUsersBatchRequest = parsePlatformRequest(
      platformUsersBatchRequestSchema,
      body,
    );
    const users = await this.usersService.findByIds(request.userIds);

    return platformUsersBatchResponseSchema.parse({
      users: users.map(toPlatformUserView),
    });
  }
}
