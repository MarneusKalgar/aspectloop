import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import type {
  DocumentObjectReservationFailureCode,
  DocumentObjectReservationStatus,
} from '../source-object/reservation/document-object-reservation.constants';
import type { DocumentObjectKind } from './document.constants';

import {
  DOCUMENT_OBJECT_BUCKET_CHECK,
  DOCUMENT_OBJECT_BYTE_LENGTH_CHECK,
  DOCUMENT_OBJECT_CONTENT_TYPE_CHECK,
  DOCUMENT_OBJECT_FILENAME_CHECK,
  DOCUMENT_OBJECT_RESERVATION_ATTEMPT_CHECK,
  DOCUMENT_OBJECT_RESERVATION_FAILURE_CODE_CHECK,
  DOCUMENT_OBJECT_RESERVATION_FINALIZED_AT_CHECK,
  DOCUMENT_OBJECT_RESERVATION_KEY_IDENTITY_CHECK,
  DOCUMENT_OBJECT_RESERVATION_KIND_CHECK,
  DOCUMENT_OBJECT_RESERVATION_LEASE_CHECK,
  DOCUMENT_OBJECT_RESERVATION_STATE_CHECK,
  DOCUMENT_OBJECT_RESERVATION_STATUS_CHECK,
  DOCUMENT_OBJECT_SHA256_CHECK,
} from './document.constraints';
import { Document } from './document.entity';

/**
 * Mutable database authority for one logical source-object write.
 *
 * Unique identities serialize concurrent callers; only a current lease may
 * transition to immutable {@link DocumentObject} metadata.
 */
@Check('CHK_document_object_reservation_attempt', DOCUMENT_OBJECT_RESERVATION_ATTEMPT_CHECK)
@Check('CHK_document_object_reservation_bucket', DOCUMENT_OBJECT_BUCKET_CHECK)
@Check('CHK_document_object_reservation_byte_length', DOCUMENT_OBJECT_BYTE_LENGTH_CHECK)
@Check('CHK_document_object_reservation_content_type', DOCUMENT_OBJECT_CONTENT_TYPE_CHECK)
@Check(
  'CHK_document_object_reservation_failure_code',
  DOCUMENT_OBJECT_RESERVATION_FAILURE_CODE_CHECK,
)
@Check(
  'CHK_document_object_reservation_finalized_at',
  DOCUMENT_OBJECT_RESERVATION_FINALIZED_AT_CHECK,
)
@Check('CHK_document_object_reservation_filename', DOCUMENT_OBJECT_FILENAME_CHECK)
@Check(
  'CHK_document_object_reservation_key_identity',
  DOCUMENT_OBJECT_RESERVATION_KEY_IDENTITY_CHECK,
)
@Check('CHK_document_object_reservation_kind', DOCUMENT_OBJECT_RESERVATION_KIND_CHECK)
@Check('CHK_document_object_reservation_lease', DOCUMENT_OBJECT_RESERVATION_LEASE_CHECK)
@Check('CHK_document_object_reservation_sha256', DOCUMENT_OBJECT_SHA256_CHECK)
@Check('CHK_document_object_reservation_state', DOCUMENT_OBJECT_RESERVATION_STATE_CHECK)
@Check('CHK_document_object_reservation_status', DOCUMENT_OBJECT_RESERVATION_STATUS_CHECK)
@Entity('document_object_reservation')
@Index('IDX_document_object_reservation_document_kind_unique', ['documentId', 'kind'], {
  unique: true,
})
@Index('IDX_document_object_reservation_location_unique', ['storageBucket', 'objectKey'], {
  unique: true,
})
@Index('IDX_document_object_reservation_object_unique', ['objectId'], { unique: true })
export class DocumentObjectReservation {
  @Column({ default: 1, name: 'attempt_count', type: 'smallint' })
  attemptCount!: number;

  @Column({ name: 'byte_length', type: 'bigint' })
  byteLength!: string;

  @Column({ length: 255, name: 'content_type', type: 'varchar' })
  contentType!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @JoinColumn({ name: 'document_id' })
  @ManyToOne(() => Document, { nullable: false, onDelete: 'RESTRICT' })
  document!: Document;

  @Column({ name: 'document_id', type: 'uuid' })
  documentId!: string;

  @Column({ length: 64, name: 'failure_code', nullable: true, type: 'varchar' })
  failureCode!: DocumentObjectReservationFailureCode | null;

  @Column({ name: 'finalized_at', nullable: true, type: 'timestamptz' })
  finalizedAt!: Date | null;

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 32, type: 'varchar' })
  kind!: DocumentObjectKind;

  @Column({ name: 'lease_expires_at', type: 'timestamptz' })
  leaseExpiresAt!: Date;

  @Column({ name: 'lease_id', type: 'uuid' })
  leaseId!: string;

  @Column({ name: 'object_id', type: 'uuid' })
  objectId!: string;

  @Column({ length: 1024, name: 'object_key', type: 'varchar' })
  objectKey!: string;

  @Column({ length: 255, name: 'original_filename', type: 'varchar' })
  originalFilename!: string;

  @Column({ length: 64, type: 'char' })
  sha256!: string;

  @Column({ default: 'pending', length: 32, type: 'varchar' })
  status!: DocumentObjectReservationStatus;

  @Column({ length: 63, name: 'storage_bucket', type: 'varchar' })
  storageBucket!: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
