import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import type { DocumentObjectKind } from './document.constants';

import {
  DOCUMENT_OBJECT_BUCKET_CHECK,
  DOCUMENT_OBJECT_BYTE_LENGTH_CHECK,
  DOCUMENT_OBJECT_CONTENT_TYPE_CHECK,
  DOCUMENT_OBJECT_FILENAME_CHECK,
  DOCUMENT_OBJECT_KEY_IDENTITY_CHECK,
  DOCUMENT_OBJECT_KIND_CHECK,
  DOCUMENT_OBJECT_SHA256_CHECK,
} from './document.constraints';
import { Document } from './document.entity';

@Check('CHK_document_object_kind', DOCUMENT_OBJECT_KIND_CHECK)
@Check('CHK_document_object_bucket', DOCUMENT_OBJECT_BUCKET_CHECK)
@Check('CHK_document_object_key_identity', DOCUMENT_OBJECT_KEY_IDENTITY_CHECK)
@Check('CHK_document_object_filename', DOCUMENT_OBJECT_FILENAME_CHECK)
@Check('CHK_document_object_content_type', DOCUMENT_OBJECT_CONTENT_TYPE_CHECK)
@Check('CHK_document_object_byte_length', DOCUMENT_OBJECT_BYTE_LENGTH_CHECK)
@Check('CHK_document_object_sha256', DOCUMENT_OBJECT_SHA256_CHECK)
@Entity('document_object')
@Index('IDX_document_object_document_kind_unique', ['documentId', 'kind'], { unique: true })
@Index('IDX_document_object_location_unique', ['storageBucket', 'objectKey'], { unique: true })
export class DocumentObject {
  @Column({ name: 'byte_length', type: 'bigint', update: false })
  byteLength!: string;

  @Column({ length: 255, name: 'content_type', type: 'varchar', update: false })
  contentType!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', update: false })
  createdAt!: Date;

  @JoinColumn({ name: 'document_id' })
  @ManyToOne(() => Document, { nullable: false, onDelete: 'RESTRICT' })
  document!: Document;

  @Column({ name: 'document_id', type: 'uuid', update: false })
  documentId!: string;

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 32, type: 'varchar', update: false })
  kind!: DocumentObjectKind;

  @Column({ length: 1024, name: 'object_key', type: 'varchar', update: false })
  objectKey!: string;

  @Column({ length: 255, name: 'original_filename', type: 'varchar', update: false })
  originalFilename!: string;

  @Column({ length: 64, type: 'char', update: false })
  sha256!: string;

  @Column({ length: 63, name: 'storage_bucket', type: 'varchar', update: false })
  storageBucket!: string;
}
