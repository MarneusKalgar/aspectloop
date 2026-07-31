import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { CorrectionSession } from '../correction-sessions/correction-session.entity';
import { CorrectionOutboxEventType, CorrectionOutboxStatus } from './correction-flow.types';

@Entity('correction_event_outbox')
@Index('IDX_correction_event_outbox_status_created_at', ['status', 'createdAt'])
export class CorrectionEventOutbox {
  @Column({ default: 0, type: 'integer' })
  attempts!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'event_type', type: 'text' })
  eventType!: CorrectionOutboxEventType;

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'last_error', nullable: true, type: 'text' })
  lastError!: null | string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ name: 'published_at', nullable: true, type: 'timestamptz' })
  publishedAt!: Date | null;

  @JoinColumn({ name: 'session_id' })
  @ManyToOne(() => CorrectionSession, { nullable: false, onDelete: 'CASCADE' })
  session!: CorrectionSession;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId!: string;

  @Column({ type: 'text' })
  status!: CorrectionOutboxStatus;
}
