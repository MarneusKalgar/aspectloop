import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class FixCorrectionEventOutboxIdDefault1778694129280 implements MigrationInterface {
  name = 'FixCorrectionEventOutboxIdDefault1778694129280';

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "correction_event_outbox" ALTER COLUMN "id" DROP DEFAULT`);
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "correction_event_outbox" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4()`,
    );
  }
}
