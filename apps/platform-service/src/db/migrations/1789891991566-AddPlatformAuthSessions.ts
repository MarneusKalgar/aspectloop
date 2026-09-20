import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlatformAuthSessions1789891991566 implements MigrationInterface {
  name = 'AddPlatformAuthSessions1789891991566';

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "email_verification_token" DROP CONSTRAINT "FK_b9ff7bf0d4ef247fff0d33f6ac0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_refresh_token" DROP CONSTRAINT "FK_c303c8b83f7d838b81297a6586d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_refresh_token" DROP CONSTRAINT "FK_3be6dd0157f99e3d88a54a91056"`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_session" DROP CONSTRAINT "FK_b8783d517fab10672700a39cb49"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email_verified_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_email_verification_token_digest_unique"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_email_verification_token_user"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_email_verification_token_expiry"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_email_verification_token_user_current_unique"`,
    );
    await queryRunner.query(`DROP TABLE "email_verification_token"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_auth_refresh_token_digest_unique"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_auth_refresh_token_session"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_auth_refresh_token_expiry"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_auth_refresh_token_session_current_unique"`);
    await queryRunner.query(`DROP TABLE "auth_refresh_token"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_auth_session_user"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_auth_session_absolute_expiry"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_auth_session_inactivity_expiry"`);
    await queryRunner.query(`DROP TABLE "auth_session"`);
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "auth_session" ("absolute_expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "inactivity_expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "last_refreshed_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revocation_reason" character varying(32), "revoked_at" TIMESTAMP WITH TIME ZONE, "user_id" uuid NOT NULL, CONSTRAINT "CHK_auth_session_revocation_state" CHECK (("revoked_at" IS NULL AND "revocation_reason" IS NULL) OR ("revoked_at" IS NOT NULL AND "revocation_reason" IS NOT NULL)), CONSTRAINT "CHK_auth_session_expiry_order" CHECK ("created_at" <= "last_refreshed_at" AND "last_refreshed_at" <= "inactivity_expires_at" AND "inactivity_expires_at" <= "absolute_expires_at"), CONSTRAINT "PK_19354ed146424a728c1112a8cbf" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_auth_session_inactivity_expiry" ON "auth_session"  ("inactivity_expires_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_auth_session_absolute_expiry" ON "auth_session"  ("absolute_expires_at") `,
    );
    await queryRunner.query(`CREATE INDEX "IDX_auth_session_user" ON "auth_session"  ("user_id") `);
    await queryRunner.query(
      `CREATE TABLE "auth_refresh_token" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "id" uuid NOT NULL, "replacement_token_id" uuid, "revoked_at" TIMESTAMP WITH TIME ZONE, "rotated_at" TIMESTAMP WITH TIME ZONE, "session_id" uuid NOT NULL, "token_digest" character(64) NOT NULL, CONSTRAINT "CHK_auth_refresh_token_rotation_state" CHECK ("replacement_token_id" IS NULL OR "rotated_at" IS NOT NULL), CONSTRAINT "CHK_auth_refresh_token_digest" CHECK ("token_digest" ~ '^[0-9a-f]{64}$'), CONSTRAINT "CHK_auth_refresh_token_expiry" CHECK ("expires_at" > "created_at"), CONSTRAINT "PK_57203170666c2ed599635e17a81" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_auth_refresh_token_session_current_unique" ON "auth_refresh_token"  ("session_id") WHERE "rotated_at" IS NULL AND "revoked_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_auth_refresh_token_expiry" ON "auth_refresh_token"  ("expires_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_auth_refresh_token_session" ON "auth_refresh_token"  ("session_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_auth_refresh_token_digest_unique" ON "auth_refresh_token"  ("token_digest") `,
    );
    await queryRunner.query(
      `CREATE TABLE "email_verification_token" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "id" uuid NOT NULL, "invalidated_at" TIMESTAMP WITH TIME ZONE, "token_digest" character(64) NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "user_id" uuid NOT NULL, CONSTRAINT "CHK_email_verification_token_terminal_state" CHECK (NOT ("used_at" IS NOT NULL AND "invalidated_at" IS NOT NULL)), CONSTRAINT "CHK_email_verification_token_digest" CHECK ("token_digest" ~ '^[0-9a-f]{64}$'), CONSTRAINT "CHK_email_verification_token_expiry" CHECK ("expires_at" > "created_at"), CONSTRAINT "PK_8a4ba9e58712768183e862529f6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_email_verification_token_user_current_unique" ON "email_verification_token"  ("user_id") WHERE "used_at" IS NULL AND "invalidated_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_email_verification_token_expiry" ON "email_verification_token"  ("expires_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_email_verification_token_user" ON "email_verification_token"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_email_verification_token_digest_unique" ON "email_verification_token"  ("token_digest") `,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "email_verified_at" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(
      `ALTER TABLE "auth_session" ADD CONSTRAINT "FK_b8783d517fab10672700a39cb49" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_refresh_token" ADD CONSTRAINT "FK_3be6dd0157f99e3d88a54a91056" FOREIGN KEY ("replacement_token_id") REFERENCES "auth_refresh_token"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_refresh_token" ADD CONSTRAINT "FK_c303c8b83f7d838b81297a6586d" FOREIGN KEY ("session_id") REFERENCES "auth_session"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_verification_token" ADD CONSTRAINT "FK_b9ff7bf0d4ef247fff0d33f6ac0" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
