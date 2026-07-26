import {
  DocumentFieldConfig,
  DocumentFieldValidationConfig,
  DocumentSectionConfig,
  DocumentTypeConfig,
} from '../document-registry/document-registry.types';

export interface CorrectionAuditEntryView {
  editedAt: Date;
  editedBy: string;
  fieldId: string;
  id: string;
  newValue: unknown;
  path: string;
  previousValue: unknown;
  source: CorrectionSource;
}

export interface CorrectionDocumentView {
  audit: CorrectionAuditEntryView[];
  documentId: string;
  documentType: string;
  fields: CorrectionFieldView[];
  publishStatus: CorrectionPublishStatus;
  schema: CorrectionSchemaView;
  sessionId: string;
  status: CorrectionStatus;
  updatedAt: Date;
  version: number;
}

export interface CorrectionEditConflictView {
  currentValue: unknown;
  path: string;
  reason: string;
  submittedValue: unknown;
}

export interface CorrectionFieldBoundingBox {
  height: number;
  left: number;
  top: number;
  width: number;
}

export type CorrectionFieldInputType = 'CODE_LIST' | 'DATE' | 'NUMBER' | 'TEXT';

export interface CorrectionFieldMetadataView {
  codeListKey: null | string;
  id: string;
  inputType: CorrectionFieldInputType;
  label: string;
  path: string;
  required: boolean;
  validation: CorrectionFieldValidationView | null;
}

export interface CorrectionFieldProvenance {
  boundingBox?: CorrectionFieldBoundingBox | null;
  confidence?: null | number;
  extractionModel?: null | string;
  page?: null | number;
  source: ProvenanceSource;
}

export interface CorrectionFieldTarget {
  fieldConfig: DocumentFieldConfig;
  fieldId: string;
  path: string;
  rowPath: null | string;
  section: DocumentSectionConfig;
}

export interface CorrectionFieldValidationView {
  max?: number;
  maxLength?: number;
  min?: number;
  minLength?: number;
  pattern?: string;
  scale?: number;
}

export interface CorrectionFieldView {
  codeList: null | { label: string; value: string }[];
  id: string;
  inputType: CorrectionFieldInputType;
  label: string;
  originalValue: unknown;
  path: string;
  provenance: CorrectionFieldProvenance | null;
  required: boolean;
  rowPath: null | string;
  sectionId: string;
  validation: CorrectionFieldValidationView | null;
  value: unknown;
}

export const CORRECTION_OUTBOX_EVENT_TYPE_DOCUMENT_CORRECTED = 'document.corrected';

export type CorrectionOutboxEventType = typeof CORRECTION_OUTBOX_EVENT_TYPE_DOCUMENT_CORRECTED;

export const CORRECTION_OUTBOX_STATUS_FAILED = 'FAILED';
export const CORRECTION_OUTBOX_STATUS_PENDING = 'PENDING';
export const CORRECTION_OUTBOX_STATUS_PUBLISHED = 'PUBLISHED';

export type CorrectionOutboxStatus =
  | typeof CORRECTION_OUTBOX_STATUS_FAILED
  | typeof CORRECTION_OUTBOX_STATUS_PENDING
  | typeof CORRECTION_OUTBOX_STATUS_PUBLISHED;

export const CORRECTION_PUBLISH_STATUS_FAILED = 'FAILED';
export const CORRECTION_PUBLISH_STATUS_NOT_QUEUED = 'NOT_QUEUED';
export const CORRECTION_PUBLISH_STATUS_PENDING = 'PENDING';
export const CORRECTION_PUBLISH_STATUS_PUBLISHED = 'PUBLISHED';

export interface CorrectionEventOutboxRecord {
  attempts: number;
  createdAt: Date;
  eventType: CorrectionOutboxEventType;
  id: string;
  lastError: null | string;
  payload: Record<string, unknown>;
  publishedAt: Date | null;
  sessionId: string;
  status: CorrectionOutboxStatus;
}

export type CorrectionPublishStatus =
  | typeof CORRECTION_PUBLISH_STATUS_FAILED
  | typeof CORRECTION_PUBLISH_STATUS_NOT_QUEUED
  | typeof CORRECTION_PUBLISH_STATUS_PENDING
  | typeof CORRECTION_PUBLISH_STATUS_PUBLISHED;

export interface CorrectionSchemaView {
  documentType: string;
  sections: CorrectionSectionView[];
  version: number;
}

export interface CorrectionSectionView {
  fields: CorrectionFieldMetadataView[];
  id: string;
  label: string;
  path: string;
  repeatable: boolean;
}

export const CORRECTION_SOURCE_REPROCESS = 'REPROCESS';
export const CORRECTION_SOURCE_SYSTEM_MERGE = 'SYSTEM_MERGE';
export const CORRECTION_SOURCE_USER_EDIT = 'USER_EDIT';

export type CorrectionSource =
  | typeof CORRECTION_SOURCE_REPROCESS
  | typeof CORRECTION_SOURCE_SYSTEM_MERGE
  | typeof CORRECTION_SOURCE_USER_EDIT;

export const CORRECTION_STATUS_CONFLICTED = 'CONFLICTED';
export const CORRECTION_STATUS_DRAFT = 'DRAFT';
export const CORRECTION_STATUS_SUBMITTED = 'SUBMITTED';

export type CorrectionStatus =
  | typeof CORRECTION_STATUS_CONFLICTED
  | typeof CORRECTION_STATUS_DRAFT
  | typeof CORRECTION_STATUS_SUBMITTED;

export interface FlattenCorrectionDocumentInput {
  config: DocumentTypeConfig;
  snapshots: SessionCorrectionSnapshots;
}

export interface MergeCorrectionEditAuditDraft {
  editedAt: Date;
  editedBy: string;
  fieldId: string;
  newValue: unknown;
  path: string;
  previousValue: unknown;
  source: CorrectionSource;
}

export interface MergeCorrectionEditInput {
  fieldId: string;
  path: string;
  value: unknown;
}

export interface MergeResult {
  auditEntries: MergeCorrectionEditAuditDraft[];
  draftPayload: Record<string, unknown>;
}

export type ProvenanceSource = 'ENRICHMENT' | 'EXTRACTION' | 'OCR' | 'USER';

export interface SessionCorrectionSnapshots {
  draftPayload: Record<string, unknown>;
  sourcePayload: Record<string, unknown>;
  sourceProvenance: null | Record<string, unknown>;
}

export const STORED_CORRECTION_STATUS_CONFLICTED = 'conflicted';
export const STORED_CORRECTION_STATUS_DRAFT = 'draft';
export const STORED_CORRECTION_STATUS_SUBMITTED = 'submitted';

export type StoredCorrectionStatus = Lowercase<CorrectionStatus>;

export interface SubmitCorrectionsCommandInput {
  edits: MergeCorrectionEditInput[];
  expectedVersion: number;
  sessionId: string;
}

export interface SubmitCorrectionsPayloadView {
  conflicts: CorrectionEditConflictView[];
  documentId: string;
  publishStatus: CorrectionPublishStatus;
  sessionId: string;
  status: CorrectionStatus;
  version: number;
}

export function mapDocumentFieldInputType(
  inputType: DocumentFieldConfig['inputType'],
): CorrectionFieldInputType {
  switch (inputType) {
    case 'code-list':
      return 'CODE_LIST';
    case 'date':
      return 'DATE';
    case 'number':
      return 'NUMBER';
    case 'text':
    default:
      return 'TEXT';
  }
}

export function mapDocumentFieldValidation(
  validation: DocumentFieldValidationConfig | undefined,
): CorrectionFieldValidationView | null {
  if (!validation) {
    return null;
  }

  return {
    max: validation.max,
    maxLength: validation.maxLength,
    min: validation.min,
    minLength: validation.minLength,
    pattern: validation.pattern,
    scale: validation.scale,
  };
}
