import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { User } from '../users/user.entity';
import { JwtPayload } from './types/auth-user';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(private readonly jwtService: JwtService) {}

  generateAccessToken(user: User): Promise<string> {
    const payload: JwtPayload = {
      displayName: user.displayName,
      email: user.email,
      roles: user.roles,
      scopes: user.scopes,
      sub: user.id,
    };

    this.logger.debug(`Generating access token for user ${user.id}`);

    return this.jwtService.signAsync(payload);
  }
}
