import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('correction_session')
@Index('IDX_correction_session_document_id_unique', ['documentId'], { unique: true })
@Index('IDX_correction_session_document_type_status', ['documentType', 'status'])
@Index('IDX_correction_session_locked_by_updated_at', ['lockedById', 'updatedAt'])
export class CorrectionSession {
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'created_by', type: 'uuid' })
  createdById!: string;

  @Column({ name: 'document_id', type: 'text' })
  documentId!: string;

  @Column({ name: 'document_type', type: 'text' })
  documentType!: string;

  @Column({ name: 'draft_payload', type: 'jsonb' })
  draftPayload!: Record<string, unknown>;

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'locked_by', nullable: true, type: 'uuid' })
  lockedById!: null | string;

  @Column({ name: 'source_payload', type: 'jsonb' })
  sourcePayload!: Record<string, unknown>;

  @Column({ name: 'source_provenance', nullable: true, type: 'jsonb' })
  sourceProvenance!: null | Record<string, unknown>;

  @Column({ default: () => "'draft'", type: 'text' })
  status!: string;

  @Column({ name: 'submitted_at', nullable: true, type: 'timestamptz' })
  submittedAt!: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ default: 1, type: 'integer' })
  version!: number;
}
