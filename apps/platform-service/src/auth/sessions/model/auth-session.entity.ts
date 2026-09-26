import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { AUTH_DIGEST_HEX_LENGTH } from '#app/auth/credentials/credential.constants';
import { User } from '#app/users/user.entity';

import { AUTH_REVOCATION_REASON_MAX_LENGTH } from '../session.constants';

@Check(
  'CHK_auth_session_activity_state',
  '("credential_digest" IS NULL AND "last_activity_at" IS NULL) OR ("credential_digest" IS NOT NULL AND "last_activity_at" IS NOT NULL)',
)
@Check(
  'CHK_auth_session_activity_expiry_order',
  '"last_activity_at" IS NULL OR ("created_at" <= "last_activity_at" AND "last_activity_at" <= "inactivity_expires_at")',
)
@Check(
  'CHK_auth_session_credential_digest_format',
  `"credential_digest" IS NULL OR "credential_digest" ~ '^[0-9a-f]{${AUTH_DIGEST_HEX_LENGTH}}$'`,
)
@Check(
  'CHK_auth_session_expiry_order',
  '"created_at" <= "last_refreshed_at" AND "last_refreshed_at" <= "inactivity_expires_at" AND "inactivity_expires_at" <= "absolute_expires_at"',
)
@Check(
  'CHK_auth_session_revocation_state',
  '("revoked_at" IS NULL AND "revocation_reason" IS NULL) OR ("revoked_at" IS NOT NULL AND "revocation_reason" IS NOT NULL)',
)
@Entity('auth_session')
@Index('IDX_auth_session_user', ['userId'])
@Index('IDX_auth_session_absolute_expiry', ['absoluteExpiresAt'])
@Index('IDX_auth_session_inactivity_expiry', ['inactivityExpiresAt'])
@Index('IDX_auth_session_credential_digest_unique', ['credentialDigest'], {
  unique: true,
  where: '"credential_digest" IS NOT NULL',
})
export class AuthSession {
  @Column({ name: 'absolute_expires_at', type: 'timestamptz' })
  absoluteExpiresAt!: Date;

  @Column({ default: () => 'CURRENT_TIMESTAMP', name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({
    length: AUTH_DIGEST_HEX_LENGTH,
    name: 'credential_digest',
    nullable: true,
    type: 'char',
  })
  credentialDigest!: null | string;

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'inactivity_expires_at', type: 'timestamptz' })
  inactivityExpiresAt!: Date;

  @Column({ name: 'last_activity_at', nullable: true, type: 'timestamptz' })
  lastActivityAt!: Date | null;

  @Column({ name: 'last_refreshed_at', type: 'timestamptz' })
  lastRefreshedAt!: Date;

  @Column({
    length: AUTH_REVOCATION_REASON_MAX_LENGTH,
    name: 'revocation_reason',
    nullable: true,
    type: 'varchar',
  })
  revocationReason!: null | string;

  @Column({ name: 'revoked_at', nullable: true, type: 'timestamptz' })
  revokedAt!: Date | null;

  @JoinColumn({ name: 'user_id' })
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user!: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;
}
