import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

import type { DocumentStatus } from './document.constants';

import { User } from '../users/user.entity';
import {
  DOCUMENT_STATUS_CHECK,
  DOCUMENT_TYPE_CHECK,
  DOCUMENT_VERSION_CHECK,
} from './document.constraints';

@Check('CHK_document_status', DOCUMENT_STATUS_CHECK)
@Check('CHK_document_type', DOCUMENT_TYPE_CHECK)
@Check('CHK_document_version_positive', DOCUMENT_VERSION_CHECK)
@Entity('document')
export class Document {
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ length: 64, name: 'document_type', type: 'varchar' })
  documentType!: string;

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @JoinColumn({ name: 'owner_id' })
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  owner!: User;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId!: string;

  @Column({ default: () => "'source_stored'", length: 32, type: 'varchar' })
  status!: DocumentStatus;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @VersionColumn({ default: 1, type: 'integer' })
  version!: number;
}
