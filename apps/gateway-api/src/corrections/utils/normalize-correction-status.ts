import {
  CORRECTION_STATUS_CONFLICTED,
  CORRECTION_STATUS_DRAFT,
  CORRECTION_STATUS_SUBMITTED,
  CorrectionDocumentView,
} from '../correction-flow.types';

/**
 * Normalizes stored session status text into the public correction-document status union.
 */
export function normalizeCorrectionStatus(status: string): CorrectionDocumentView['status'] {
  const normalizedStatus = status.trim().toUpperCase();

  if (
    normalizedStatus === CORRECTION_STATUS_CONFLICTED ||
    normalizedStatus === CORRECTION_STATUS_DRAFT ||
    normalizedStatus === CORRECTION_STATUS_SUBMITTED
  ) {
    return normalizedStatus;
  }

  return CORRECTION_STATUS_DRAFT;
}
