import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class PasswordService {
  private readonly dummyHash: Promise<string>;
  private readonly saltRounds: number;

  constructor(private readonly configService: ConfigService) {
    this.saltRounds = this.configService.get<number>('BCRYPT_SALT_ROUNDS') ?? 10;
    this.dummyHash = bcrypt.hash('aspectloop-dummy-credential', this.saltRounds);
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

  /** Performs the configured-cost comparison even when no account hash exists. */
  async verifyOrDummy(password: string, storedHash: null | string): Promise<boolean> {
    const comparedHash = storedHash ?? (await this.dummyHash);
    const matches = await bcrypt.compare(password, comparedHash);

    return storedHash !== null && matches;
  }
}
