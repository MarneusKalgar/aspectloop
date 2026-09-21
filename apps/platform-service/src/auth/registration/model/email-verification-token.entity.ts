import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { User } from '../../../users/user.entity';
import { AUTH_DIGEST_HEX_LENGTH } from '../../credentials/credential.constants';

@Check('CHK_email_verification_token_expiry', '"expires_at" > "created_at"')
@Check('CHK_email_verification_token_digest', '"token_digest" ~ \'^[0-9a-f]{64}$\'')
@Check(
  'CHK_email_verification_token_terminal_state',
  'NOT ("used_at" IS NOT NULL AND "invalidated_at" IS NOT NULL)',
)
@Entity('email_verification_token')
@Index('IDX_email_verification_token_digest_unique', ['tokenDigest'], { unique: true })
@Index('IDX_email_verification_token_user', ['userId'])
@Index('IDX_email_verification_token_expiry', ['expiresAt'])
@Index('IDX_email_verification_token_user_current_unique', ['userId'], {
  unique: true,
  where: '"used_at" IS NULL AND "invalidated_at" IS NULL',
})
export class EmailVerificationToken {
  @Column({ default: () => 'CURRENT_TIMESTAMP', name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ name: 'invalidated_at', nullable: true, type: 'timestamptz' })
  invalidatedAt!: Date | null;

  @Column({ length: AUTH_DIGEST_HEX_LENGTH, name: 'token_digest', type: 'char' })
  tokenDigest!: string;

  @Column({ name: 'used_at', nullable: true, type: 'timestamptz' })
  usedAt!: Date | null;

  @JoinColumn({ name: 'user_id' })
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user!: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;
}
