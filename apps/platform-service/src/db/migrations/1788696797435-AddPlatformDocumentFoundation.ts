import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddPlatformDocumentFoundation1788696797435 implements MigrationInterface {
  name = 'AddPlatformDocumentFoundation1788696797435';

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "document_object" DROP CONSTRAINT "FK_32d9b6b93614f8730ef7b7adb6b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "document" DROP CONSTRAINT "FK_81b7502f2f9bd98bf7c846fb006"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_document_object_document_kind_unique"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_document_object_location_unique"`);
    await queryRunner.query(`DROP TABLE "document_object"`);
    await queryRunner.query(`DROP TABLE "document"`);
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "document" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "document_type" character varying(64) NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "owner_id" uuid NOT NULL, "status" character varying(32) NOT NULL DEFAULT 'source_stored', "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', CONSTRAINT "CHK_document_version_positive" CHECK ("version" >= 1), CONSTRAINT "CHK_document_type" CHECK (char_length(trim("document_type")) > 0), CONSTRAINT "CHK_document_status" CHECK ("status" IN ('source_stored', 'extraction_queued', 'extraction_processing', 'extraction_completed', 'extraction_failed')), CONSTRAINT "PK_e57d3357f83f3cdc0acffc3d777" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "document_object" ("byte_length" bigint NOT NULL, "content_type" character varying(255) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "document_id" uuid NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "kind" character varying(32) NOT NULL, "object_key" character varying(1024) NOT NULL, "original_filename" character varying(255) NOT NULL, "sha256" character(64) NOT NULL, "storage_bucket" character varying(63) NOT NULL, CONSTRAINT "CHK_document_object_sha256" CHECK ("sha256" ~ '^[0-9a-f]{64}$'), CONSTRAINT "CHK_document_object_byte_length" CHECK ("byte_length" > 0 AND "byte_length" <= 9007199254740991), CONSTRAINT "CHK_document_object_content_type" CHECK (char_length(trim("content_type")) > 0), CONSTRAINT "CHK_document_object_filename" CHECK (char_length(trim("original_filename")) > 0 AND strpos("original_filename", '/') = 0 AND strpos("original_filename", chr(92)) = 0 AND "original_filename" !~ '[[:cntrl:]]'), CONSTRAINT "CHK_document_object_key_identity" CHECK ("object_key" = 'documents/' || "document_id"::text || '/source/' || "id"::text), CONSTRAINT "CHK_document_object_bucket" CHECK ("storage_bucket" ~ '^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$'), CONSTRAINT "CHK_document_object_kind" CHECK ("kind" IN ('source')), CONSTRAINT "PK_5c7f9d7a0e50e8fe437aa575f3a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_document_object_location_unique" ON "document_object"  ("storage_bucket", "object_key") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_document_object_document_kind_unique" ON "document_object"  ("document_id", "kind") `,
    );
    await queryRunner.query(
      `ALTER TABLE "document" ADD CONSTRAINT "FK_81b7502f2f9bd98bf7c846fb006" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_object" ADD CONSTRAINT "FK_32d9b6b93614f8730ef7b7adb6b" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }
}
