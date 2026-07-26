import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddUserAndCorrectionSession1778593296233 implements MigrationInterface {
  name = 'AddUserAndCorrectionSession1778593296233';

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "correction_session" DROP CONSTRAINT "FK_48967761ec782b577a09addc9a5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "correction_session" DROP CONSTRAINT "FK_fc37edf138abdac7af5b17f50d1"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_correction_session_document_id_unique"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_correction_session_document_type_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_correction_session_locked_by_updated_at"`);
    await queryRunner.query(`DROP TABLE "correction_session"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_users_email_unique"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "email" character varying(320) NOT NULL, "display_name" character varying(120) NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "password_hash" character varying(255) NOT NULL, "roles" text array NOT NULL DEFAULT '{}', "scopes" text array NOT NULL DEFAULT '{}', "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_users_email_unique" ON "users" ("email") `);
    await queryRunner.query(
      `CREATE TABLE "correction_session" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "document_id" text NOT NULL, "document_type" text NOT NULL, "draft_payload" jsonb NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "locked_by" uuid, "status" text NOT NULL DEFAULT 'draft', "submitted_at" TIMESTAMP WITH TIME ZONE, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', CONSTRAINT "PK_bc84930ad8bbbfbb246824e670d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_correction_session_locked_by_updated_at" ON "correction_session" ("locked_by", "updated_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_correction_session_document_type_status" ON "correction_session" ("document_type", "status") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_correction_session_document_id_unique" ON "correction_session" ("document_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "correction_session" ADD CONSTRAINT "FK_fc37edf138abdac7af5b17f50d1" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "correction_session" ADD CONSTRAINT "FK_48967761ec782b577a09addc9a5" FOREIGN KEY ("locked_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }
}
