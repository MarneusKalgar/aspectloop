import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { User } from '../users/user.entity';

interface JwtPayload {
  displayName: string;
  email: string;
  roles: string[];
  scopes: string[];
  sub: string;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(private readonly jwtService: JwtService) {}

  /**
   * Generates an access token while logging only the internal subject identifier.
   *
   * @param user Authenticated user represented by the token.
   * @returns A signed access token.
   */
  generateAccessToken(user: User): Promise<string> {
    const payload: JwtPayload = {
      displayName: user.displayName,
      email: user.email,
      roles: user.roles,
      scopes: user.scopes,
      sub: user.id,
    };

    this.logger.debug({
      event: 'auth.access_token.generating',
      userId: user.id,
    });

    return this.jwtService.signAsync(payload);
  }
}
