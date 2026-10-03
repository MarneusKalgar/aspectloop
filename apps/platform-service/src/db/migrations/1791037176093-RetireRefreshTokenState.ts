import { MigrationInterface, QueryRunner } from 'typeorm';

export class RetireRefreshTokenState1791037176093 implements MigrationInterface {
  name = 'RetireRefreshTokenState1791037176093';

  /** Rejects rollback because retired refresh credentials and timestamps cannot be recovered. */
  public down(): Promise<void> {
    return Promise.reject(
      new Error(
        'RetireRefreshTokenState is irreversible. Use a reviewed forward migration; retired refresh credentials and timestamps cannot be recovered.',
      ),
    );
  }

  /** Retires refresh-only persistence atomically while preserving users and browser sessions. */
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!queryRunner.isTransactionActive) {
      throw new Error('RetireRefreshTokenState requires an active migration transaction.');
    }

    await queryRunner.query(
      `ALTER TABLE "auth_session" DROP CONSTRAINT "CHK_auth_session_expiry_order"`,
    );
    await queryRunner.query(`ALTER TABLE "auth_session" DROP COLUMN "last_refreshed_at"`);
    await queryRunner.query(
      `ALTER TABLE "auth_session" ADD CONSTRAINT "CHK_auth_session_expiry_order" CHECK ("created_at" <= "inactivity_expires_at" AND "inactivity_expires_at" <= "absolute_expires_at")`,
    );
    await queryRunner.query(`DROP TABLE "auth_refresh_token"`);
  }
}
