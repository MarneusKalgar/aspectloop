/*
 * -------------------------------------------------------
 * THIS FILE WAS AUTOMATICALLY GENERATED (DO NOT MODIFY)
 * -------------------------------------------------------
 */

/* eslint-disable */

export enum CorrectionPublishStatus {
  FAILED = 'FAILED',
  NOT_QUEUED = 'NOT_QUEUED',
  PENDING = 'PENDING',
  PUBLISHED = 'PUBLISHED',
}

export enum CorrectionSource {
  REPROCESS = 'REPROCESS',
  SYSTEM_MERGE = 'SYSTEM_MERGE',
  USER_EDIT = 'USER_EDIT',
}

export enum CorrectionStatus {
  CONFLICTED = 'CONFLICTED',
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
}

export enum FieldInputType {
  CODE_LIST = 'CODE_LIST',
  DATE = 'DATE',
  NUMBER = 'NUMBER',
  TEXT = 'TEXT',
}

export enum ProvenanceSource {
  ENRICHMENT = 'ENRICHMENT',
  EXTRACTION = 'EXTRACTION',
  OCR = 'OCR',
  USER = 'USER',
}

export class CorrectionEditInput {
  fieldId: string;
  path: string;
  value?: Nullable<JSON>;
}

export class OpenCorrectionSessionInput {
  documentId: string;
  documentType: string;
}

export class SaveCorrectionSessionDraftInput {
  draftPayload: JSON;
  expectedVersion: number;
  sessionId: string;
}

export class SignInInput {
  email: string;
  password: string;
}

export class SignUpInput {
  displayName: string;
  email: string;
  password: string;
}

export class SubmitCorrectionsInput {
  edits: CorrectionEditInput[];
  expectedVersion: number;
  sessionId: string;
}

export class AuthPayload {
  accessToken: string;
  user: User;
}

export class BoundingBox {
  height: number;
  left: number;
  top: number;
  width: number;
}

export class CodeListOption {
  label: string;
  value: string;
}

export class CorrectionAuditEntry {
  editedAt: DateTime;
  editedBy: string;
  fieldId: string;
  id: string;
  newValue?: Nullable<JSON>;
  path: string;
  previousValue?: Nullable<JSON>;
  source: CorrectionSource;
}

export class CorrectionDocument {
  audit: CorrectionAuditEntry[];
  documentId: string;
  documentType: string;
  fields: CorrectionField[];
  publishStatus: CorrectionPublishStatus;
  schema: CorrectionSchema;
  sessionId: string;
  status: CorrectionStatus;
  updatedAt: DateTime;
  version: number;
}

export class CorrectionField {
  codeList?: Nullable<CodeListOption[]>;
  id: string;
  inputType: FieldInputType;
  label: string;
  originalValue?: Nullable<JSON>;
  path: string;
  provenance?: Nullable<FieldProvenance>;
  required: boolean;
  rowPath?: Nullable<string>;
  sectionId: string;
  validation?: Nullable<FieldValidation>;
  value?: Nullable<JSON>;
}

export class CorrectionFieldMetadata {
  codeListKey?: Nullable<string>;
  id: string;
  inputType: FieldInputType;
  label: string;
  path: string;
  required: boolean;
  validation?: Nullable<FieldValidation>;
}

export class CorrectionSchema {
  documentType: string;
  sections: CorrectionSection[];
  version: number;
}

export class CorrectionSection {
  fields: CorrectionFieldMetadata[];
  id: string;
  label: string;
  path: string;
  repeatable: boolean;
}

export class CorrectionSession {
  createdAt: DateTime;
  documentId: string;
  documentType: string;
  draftPayload: JSON;
  id: string;
  lockedBy: User;
  status: string;
  updatedAt: DateTime;
  version: number;
}

export class DocumentTypeSummary {
  label: string;
  type: string;
  version: number;
}

export class FieldProvenance {
  boundingBox?: Nullable<BoundingBox>;
  confidence?: Nullable<number>;
  extractionModel?: Nullable<string>;
  page?: Nullable<number>;
  source: ProvenanceSource;
}

export class FieldValidation {
  max?: Nullable<number>;
  maxLength?: Nullable<number>;
  min?: Nullable<number>;
  minLength?: Nullable<number>;
  pattern?: Nullable<string>;
  scale?: Nullable<number>;
}

export abstract class IMutation {
  abstract _empty(): Nullable<string> | Promise<Nullable<string>>;

  abstract openCorrectionSession(
    input: OpenCorrectionSessionInput,
  ): CorrectionSession | Promise<CorrectionSession>;

  abstract saveCorrectionSessionDraft(
    input: SaveCorrectionSessionDraftInput,
  ): CorrectionSession | Promise<CorrectionSession>;

  abstract signIn(input: SignInInput): AuthPayload | Promise<AuthPayload>;

  abstract signOut(): SignOutPayload | Promise<SignOutPayload>;

  abstract signUp(input: SignUpInput): SignUpPayload | Promise<SignUpPayload>;

  abstract submitCorrections(
    input: SubmitCorrectionsInput,
  ): SubmitCorrectionsPayload | Promise<SubmitCorrectionsPayload>;
}

export abstract class IQuery {
  abstract _empty(): Nullable<string> | Promise<Nullable<string>>;

  abstract correctionDocument(sessionId: string): CorrectionDocument | Promise<CorrectionDocument>;

  abstract correctionDocumentTypes(): DocumentTypeSummary[] | Promise<DocumentTypeSummary[]>;

  abstract correctionSession(sessionId: string): CorrectionSession | Promise<CorrectionSession>;

  abstract correctionSessions(): CorrectionSession[] | Promise<CorrectionSession[]>;

  abstract me(): Nullable<User> | Promise<Nullable<User>>;
}

export class SignOutPayload {
  success: boolean;
}

export class SignUpPayload {
  success: boolean;
  user: User;
}

export class SubmitCorrectionsPayload {
  conflicts: VersionConflict[];
  documentId: string;
  publishStatus: CorrectionPublishStatus;
  sessionId: string;
  status: CorrectionStatus;
  version: number;
}

export class User {
  createdAt: DateTime;
  displayName: string;
  email: string;
  id: string;
  roles: string[];
  scopes: string[];
  updatedAt: DateTime;
}

export class VersionConflict {
  currentValue?: Nullable<JSON>;
  path: string;
  reason: string;
  submittedValue?: Nullable<JSON>;
}

export type DateTime = any;
export type JSON = any;
type Nullable<T> = T | null;
