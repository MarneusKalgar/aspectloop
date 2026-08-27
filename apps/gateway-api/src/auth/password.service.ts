import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class PasswordService {
  private readonly saltRounds: number;

  constructor(private readonly configService: ConfigService) {
    this.saltRounds = this.configService.get<number>('BCRYPT_SALT_ROUNDS') ?? 10;
  }

  /**
   * Hashes a password without emitting credential-adjacent diagnostics.
   *
   * @param password Plain password supplied by the auth flow.
   * @returns The password hash stored for verification.
   */
  hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  /**
   * Compares a supplied password with the stored password hash.
   *
   * @param password Plain password supplied by the auth flow.
   * @param storedHash Persisted password hash.
   * @returns Whether the password matches.
   */
  verify(password: string, storedHash: string): Promise<boolean> {
    return bcrypt.compare(password, storedHash);
  }
}
