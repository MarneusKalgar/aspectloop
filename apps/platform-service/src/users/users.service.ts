import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

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

  /**
   * Persists a reviewer and logs only its generated internal identifier.
   *
   * @param input Validated user creation values.
   * @returns The persisted user entity.
   */
  async createUser(input: CreateUserInput): Promise<User> {
    const user = this.usersRepository.create({
      displayName: input.displayName,
      email: normalizeEmail(input.email),
      passwordHash: input.passwordHash,
      roles: input.roles ?? ['CORRECTOR'],
      scopes: input.scopes ?? ['corrections:write'],
    });

    const savedUser = await this.usersRepository.save(user);

    this.logger.log({
      event: 'users.user.created',
      outcome: 'success',
      userId: savedUser.id,
    });

    return savedUser;
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

  /** Returns unique users in caller order for bounded response composition. */
  async findByIds(ids: string[]): Promise<User[]> {
    const uniqueIds = [...new Set(ids)];

    if (uniqueIds.length === 0) {
      return [];
    }

    const users = await this.usersRepository.findBy({ id: In(uniqueIds) });
    const usersById = new Map(users.map((user) => [user.id, user]));

    return uniqueIds.flatMap((id) => {
      const user = usersById.get(id);

      return user ? [user] : [];
    });
  }
}
