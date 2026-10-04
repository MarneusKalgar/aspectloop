import type { OperationPolicy } from './operation-policy';

/** Product operations that count as authenticated browser activity. */
export const CORRECTION_OPERATION_NAME = Object.freeze({
  CORRECTION_DOCUMENT: 'correctionDocument',
  CORRECTION_DOCUMENT_TYPES: 'correctionDocumentTypes',
  CORRECTION_SESSION: 'correctionSession',
  CORRECTION_SESSIONS: 'correctionSessions',
  OPEN_CORRECTION_SESSION: 'openCorrectionSession',
  SAVE_CORRECTION_SESSION_DRAFT: 'saveCorrectionSessionDraft',
  SUBMIT_CORRECTIONS: 'submitCorrections',
} as const);

export const CORRECTION_QUERY_POLICIES: Readonly<Record<string, OperationPolicy>> = Object.freeze({
  [CORRECTION_OPERATION_NAME.CORRECTION_DOCUMENT]: Object.freeze({ recordActivity: true }),
  [CORRECTION_OPERATION_NAME.CORRECTION_DOCUMENT_TYPES]: Object.freeze({ recordActivity: true }),
  [CORRECTION_OPERATION_NAME.CORRECTION_SESSION]: Object.freeze({ recordActivity: true }),
  [CORRECTION_OPERATION_NAME.CORRECTION_SESSIONS]: Object.freeze({ recordActivity: true }),
});

export const CORRECTION_MUTATION_POLICIES: Readonly<Record<string, OperationPolicy>> =
  Object.freeze({
    [CORRECTION_OPERATION_NAME.OPEN_CORRECTION_SESSION]: Object.freeze({ recordActivity: true }),
    [CORRECTION_OPERATION_NAME.SAVE_CORRECTION_SESSION_DRAFT]: Object.freeze({
      recordActivity: true,
    }),
    [CORRECTION_OPERATION_NAME.SUBMIT_CORRECTIONS]: Object.freeze({ recordActivity: true }),
  });
