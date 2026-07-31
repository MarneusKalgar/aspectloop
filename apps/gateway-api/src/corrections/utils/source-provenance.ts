import { CorrectionFieldProvenance } from '../correction-flow.types';

/**
 * Resolves field provenance metadata from the session-owned provenance map.
 */
export function getSourceProvenance(
  sourceProvenance: null | Record<string, unknown>,
  path: string,
): CorrectionFieldProvenance | null {
  if (!sourceProvenance) {
    return null;
  }

  const value = sourceProvenance[path];

  if (!isCorrectionFieldProvenance(value)) {
    return null;
  }

  return value;
}

/**
 * Guards that a raw JSON value matches the provenance shape expected by the API contract.
 */
export function isCorrectionFieldProvenance(value: unknown): value is CorrectionFieldProvenance {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.source === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
