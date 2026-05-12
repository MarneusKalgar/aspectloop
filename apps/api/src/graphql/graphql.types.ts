/*
 * -------------------------------------------------------
 * THIS FILE WAS AUTOMATICALLY GENERATED (DO NOT MODIFY)
 * -------------------------------------------------------
 */

/* eslint-disable */

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

export class AuthPayload {
  accessToken: string;
  user: User;
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

export abstract class IMutation {
  abstract _empty(): Nullable<string> | Promise<Nullable<string>>;

  abstract openCorrectionSession(
    input: OpenCorrectionSessionInput,
  ): CorrectionSession | Promise<CorrectionSession>;

  abstract saveCorrectionSessionDraft(
    input: SaveCorrectionSessionDraftInput,
  ): CorrectionSession | Promise<CorrectionSession>;

  abstract signIn(input: SignInInput): AuthPayload | Promise<AuthPayload>;

  abstract signUp(input: SignUpInput): AuthPayload | Promise<AuthPayload>;
}

export abstract class IQuery {
  abstract _empty(): Nullable<string> | Promise<Nullable<string>>;

  abstract correctionDocumentTypes(): DocumentTypeSummary[] | Promise<DocumentTypeSummary[]>;

  abstract correctionSession(sessionId: string): CorrectionSession | Promise<CorrectionSession>;

  abstract me(): Nullable<User> | Promise<Nullable<User>>;
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

export type DateTime = any;
export type JSON = any;
type Nullable<T> = T | null;
