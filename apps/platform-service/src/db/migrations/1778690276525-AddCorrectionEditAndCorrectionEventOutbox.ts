import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddCorrectionEditAndCorrectionEventOutbox1778690276525 implements MigrationInterface {
  name = 'AddCorrectionEditAndCorrectionEventOutbox1778690276525';

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "correction_event_outbox" DROP CONSTRAINT "FK_0d607284fbebce68c664c580a12"`,
    );
    await queryRunner.query(
      `ALTER TABLE "correction_edit" DROP CONSTRAINT "FK_5945d5b5133bc5d5f72442de360"`,
    );
    await queryRunner.query(`ALTER TABLE "correction_session" DROP COLUMN "source_provenance"`);
    await queryRunner.query(`ALTER TABLE "correction_session" DROP COLUMN "source_payload"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_correction_event_outbox_status_created_at"`);
    await queryRunner.query(`DROP TABLE "correction_event_outbox"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_correction_edit_session_id_edited_at"`);
    await queryRunner.query(`DROP TABLE "correction_edit"`);
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "correction_edit" ("edited_at" TIMESTAMP WITH TIME ZONE NOT NULL, "edited_by" text NOT NULL, "field_id" text NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "new_value" jsonb, "path" text NOT NULL, "previous_value" jsonb, "session_id" uuid NOT NULL, "source" text NOT NULL, CONSTRAINT "PK_f9d6ec446b0fe6221459f638138" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_correction_edit_session_id_edited_at" ON "correction_edit" ("session_id", "edited_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "correction_event_outbox" ("attempts" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "event_type" text NOT NULL, "id" uuid NOT NULL, "last_error" text, "payload" jsonb NOT NULL, "published_at" TIMESTAMP WITH TIME ZONE, "session_id" uuid NOT NULL, "status" text NOT NULL, CONSTRAINT "PK_411dfebe067a61437325f521ba2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_correction_event_outbox_status_created_at" ON "correction_event_outbox" ("status", "created_at") `,
    );

    await queryRunner.query(`ALTER TABLE "correction_session" ADD "source_payload" jsonb`);
    await queryRunner.query(
      `UPDATE "correction_session" SET "source_payload" = "draft_payload" WHERE "source_payload" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "correction_session" ALTER COLUMN "source_payload" SET NOT NULL`,
    );

    await queryRunner.query(`ALTER TABLE "correction_session" ADD "source_provenance" jsonb`);
    await queryRunner.query(
      `ALTER TABLE "correction_edit" ADD CONSTRAINT "FK_5945d5b5133bc5d5f72442de360" FOREIGN KEY ("session_id") REFERENCES "correction_session"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "correction_event_outbox" ADD CONSTRAINT "FK_0d607284fbebce68c664c580a12" FOREIGN KEY ("session_id") REFERENCES "correction_session"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
