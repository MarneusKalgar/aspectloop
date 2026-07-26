import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { CorrectionSession } from '../correction-sessions/correction-session.entity';
import { CorrectionSource } from './correction-flow.types';

@Entity('correction_edit')
@Index('IDX_correction_edit_session_id_edited_at', ['sessionId', 'editedAt'])
export class CorrectionEdit {
  @Column({ name: 'edited_at', type: 'timestamptz' })
  editedAt!: Date;

  @Column({ name: 'edited_by', type: 'text' })
  editedBy!: string;

  @Column({ name: 'field_id', type: 'text' })
  fieldId!: string;

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'new_value', nullable: true, type: 'jsonb' })
  newValue!: unknown;

  @Column({ type: 'text' })
  path!: string;

  @Column({ name: 'previous_value', nullable: true, type: 'jsonb' })
  previousValue!: unknown;

  @JoinColumn({ name: 'session_id' })
  @ManyToOne(() => CorrectionSession, { nullable: false, onDelete: 'CASCADE' })
  session!: CorrectionSession;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId!: string;

  @Column({ type: 'text' })
  source!: CorrectionSource;
}

export { CorrectionEventOutbox } from './correction-event-outbox.entity';
