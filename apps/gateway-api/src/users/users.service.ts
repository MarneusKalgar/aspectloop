import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { normalizeEmail } from '../core/utils/normalize-email';
import { User } from './user.entity';

interface CreateUserInput {
  displayName: string;
  email: string;
  passwordHash: string;
  roles?: string[];
  scopes?: string[];
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async createUser(input: CreateUserInput): Promise<User> {
    const user = this.usersRepository.create({
      displayName: input.displayName,
      email: normalizeEmail(input.email),
      passwordHash: input.passwordHash,
      roles: input.roles ?? ['CORRECTOR'],
      scopes: input.scopes ?? ['corrections:write'],
    });

    this.logger.log(`Creating user ${user.email}`);

    return this.usersRepository.save(user);
  }

  async findByEmail(email: string): Promise<null | User> {
    return this.usersRepository.findOne({
      where: { email: normalizeEmail(email) },
    });
  }

  async findByEmailWithPassword(email: string): Promise<null | User> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: normalizeEmail(email) })
      .getOne();
  }

  async findById(id: string): Promise<null | User> {
    return this.usersRepository.findOne({ where: { id } });
  }
}
