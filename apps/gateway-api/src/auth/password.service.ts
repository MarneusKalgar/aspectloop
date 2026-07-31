import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);
  private readonly saltRounds: number;

  constructor(private readonly configService: ConfigService) {
    this.saltRounds = this.configService.get<number>('BCRYPT_SALT_ROUNDS') ?? 10;
  }

  hash(password: string): Promise<string> {
    this.logger.debug('Hashing password');

    return bcrypt.hash(password, this.saltRounds);
  }

  verify(password: string, storedHash: string): Promise<boolean> {
    return bcrypt.compare(password, storedHash);
  }
}
