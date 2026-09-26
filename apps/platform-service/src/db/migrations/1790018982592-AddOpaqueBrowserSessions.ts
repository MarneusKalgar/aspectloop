import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOpaqueBrowserSessions1790018982592 implements MigrationInterface {
  name = 'AddOpaqueBrowserSessions1790018982592';

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auth_session" DROP CONSTRAINT "CHK_auth_session_activity_state"`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_session" DROP CONSTRAINT "CHK_auth_session_activity_expiry_order"`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_session" DROP CONSTRAINT "CHK_auth_session_credential_digest_format"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_auth_session_credential_digest_unique"`);
    await queryRunner.query(`ALTER TABLE "auth_session" DROP COLUMN "last_activity_at"`);
    await queryRunner.query(`ALTER TABLE "auth_session" DROP COLUMN "credential_digest"`);
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "auth_session" ADD "credential_digest" character(64)`);
    await queryRunner.query(
      `ALTER TABLE "auth_session" ADD "last_activity_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_auth_session_credential_digest_unique" ON "auth_session"  ("credential_digest") WHERE "credential_digest" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_session" ADD CONSTRAINT "CHK_auth_session_credential_digest_format" CHECK ("credential_digest" IS NULL OR "credential_digest" ~ '^[0-9a-f]{64}$')`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_session" ADD CONSTRAINT "CHK_auth_session_activity_expiry_order" CHECK ("last_activity_at" IS NULL OR ("created_at" <= "last_activity_at" AND "last_activity_at" <= "inactivity_expires_at"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_session" ADD CONSTRAINT "CHK_auth_session_activity_state" CHECK (("credential_digest" IS NULL AND "last_activity_at" IS NULL) OR ("credential_digest" IS NOT NULL AND "last_activity_at" IS NOT NULL))`,
    );
  }
}
