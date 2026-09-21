import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { AUTH_DIGEST_HEX_LENGTH } from '../../credentials/credential.constants';
import { AuthSession } from './auth-session.entity';

@Check('CHK_auth_refresh_token_expiry', '"expires_at" > "created_at"')
@Check('CHK_auth_refresh_token_digest', '"token_digest" ~ \'^[0-9a-f]{64}$\'')
@Check(
  'CHK_auth_refresh_token_rotation_state',
  '"replacement_token_id" IS NULL OR "rotated_at" IS NOT NULL',
)
@Entity('auth_refresh_token')
@Index('IDX_auth_refresh_token_digest_unique', ['tokenDigest'], { unique: true })
@Index('IDX_auth_refresh_token_session', ['sessionId'])
@Index('IDX_auth_refresh_token_expiry', ['expiresAt'])
@Index('IDX_auth_refresh_token_session_current_unique', ['sessionId'], {
  unique: true,
  where: '"rotated_at" IS NULL AND "revoked_at" IS NULL',
})
export class AuthRefreshToken {
  @Column({ default: () => 'CURRENT_TIMESTAMP', name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @JoinColumn({ name: 'replacement_token_id' })
  @ManyToOne(() => AuthRefreshToken, { nullable: true, onDelete: 'SET NULL' })
  replacementToken!: AuthRefreshToken | null;

  @Column({ name: 'replacement_token_id', nullable: true, type: 'uuid' })
  replacementTokenId!: null | string;

  @Column({ name: 'revoked_at', nullable: true, type: 'timestamptz' })
  revokedAt!: Date | null;

  @Column({ name: 'rotated_at', nullable: true, type: 'timestamptz' })
  rotatedAt!: Date | null;

  @JoinColumn({ name: 'session_id' })
  @ManyToOne(() => AuthSession, { onDelete: 'CASCADE' })
  session!: AuthSession;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId!: string;

  @Column({ length: AUTH_DIGEST_HEX_LENGTH, name: 'token_digest', type: 'char' })
  tokenDigest!: string;
}
