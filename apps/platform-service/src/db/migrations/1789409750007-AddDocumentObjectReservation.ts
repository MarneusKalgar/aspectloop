import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddDocumentObjectReservation1789409750007 implements MigrationInterface {
  name = 'AddDocumentObjectReservation1789409750007';

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "document_object_reservation" DROP CONSTRAINT "FK_6a2fe564a334d00066057e5698d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_document_object_reservation_document_kind_unique"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_document_object_reservation_location_unique"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_document_object_reservation_object_unique"`);
    await queryRunner.query(`DROP TABLE "document_object_reservation"`);
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "document_object_reservation" ("attempt_count" smallint NOT NULL DEFAULT '1', "byte_length" bigint NOT NULL, "content_type" character varying(255) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "document_id" uuid NOT NULL, "failure_code" character varying(64), "finalized_at" TIMESTAMP WITH TIME ZONE, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "kind" character varying(32) NOT NULL, "lease_expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "lease_id" uuid NOT NULL, "object_id" uuid NOT NULL, "object_key" character varying(1024) NOT NULL, "original_filename" character varying(255) NOT NULL, "sha256" character(64) NOT NULL, "status" character varying(32) NOT NULL DEFAULT 'pending', "storage_bucket" character varying(63) NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_document_object_reservation_status" CHECK ("status" IN ('pending', 'failed', 'finalized')), CONSTRAINT "CHK_document_object_reservation_state" CHECK (("status" = 'pending' AND "failure_code" IS NULL AND "finalized_at" IS NULL) OR ("status" = 'failed' AND "failure_code" IS NOT NULL AND "finalized_at" IS NULL) OR ("status" = 'finalized' AND "failure_code" IS NULL AND "finalized_at" IS NOT NULL)), CONSTRAINT "CHK_document_object_reservation_sha256" CHECK ("sha256" ~ '^[0-9a-f]{64}$'), CONSTRAINT "CHK_document_object_reservation_lease" CHECK ("lease_expires_at" > "created_at"), CONSTRAINT "CHK_document_object_reservation_kind" CHECK ("kind" IN ('source')), CONSTRAINT "CHK_document_object_reservation_key_identity" CHECK ("object_key" = 'documents/' || "document_id"::text || '/source/' || "object_id"::text), CONSTRAINT "CHK_document_object_reservation_filename" CHECK (char_length(trim("original_filename")) > 0 AND strpos("original_filename", '/') = 0 AND strpos("original_filename", chr(92)) = 0 AND "original_filename" !~ '[[:cntrl:]]'), CONSTRAINT "CHK_document_object_reservation_finalized_at" CHECK ("finalized_at" IS NULL OR "finalized_at" >= "created_at"), CONSTRAINT "CHK_document_object_reservation_failure_code" CHECK ("failure_code" IS NULL OR "failure_code" IN ('integrity_mismatch', 'invalid_location', 'invalid_response', 'not_found', 'unavailable')), CONSTRAINT "CHK_document_object_reservation_content_type" CHECK (char_length(trim("content_type")) > 0), CONSTRAINT "CHK_document_object_reservation_byte_length" CHECK ("byte_length" > 0 AND "byte_length" <= 9007199254740991), CONSTRAINT "CHK_document_object_reservation_bucket" CHECK ("storage_bucket" ~ '^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$'), CONSTRAINT "CHK_document_object_reservation_attempt" CHECK ("attempt_count" >= 1 AND "attempt_count" <= 10), CONSTRAINT "PK_d47e453c6a3e66e0a3f7fafed12" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_document_object_reservation_object_unique" ON "document_object_reservation"  ("object_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_document_object_reservation_location_unique" ON "document_object_reservation"  ("storage_bucket", "object_key") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_document_object_reservation_document_kind_unique" ON "document_object_reservation"  ("document_id", "kind") `,
    );
    await queryRunner.query(
      `ALTER TABLE "document_object_reservation" ADD CONSTRAINT "FK_6a2fe564a334d00066057e5698d" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }
}
