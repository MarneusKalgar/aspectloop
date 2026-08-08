import { formatSessionStatusLabel, normalizeSessionStatus } from '@app/components/inbox/status';

import type { CorrectionSessionRow } from './types';

export function getStatusOptions(sessions: CorrectionSessionRow[], allLabel: string) {
  const statuses = Array.from(
    new Set(sessions.map((session) => normalizeSessionStatus(session.status))),
  );

  return [
    {
      key: 'ALL',
      label: allLabel,
    },
    ...statuses.map((status) => ({
      key: status,
      label: formatSessionStatusLabel(status),
    })),
  ];
}

export function isCorrectionSessionRow(value: unknown): value is CorrectionSessionRow {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.documentId === 'string' &&
    typeof candidate.documentType === 'string' &&
    typeof candidate.id === 'string' &&
    typeof candidate.status === 'string' &&
    typeof candidate.updatedAt === 'string' &&
    typeof candidate.version === 'number'
  );
}

export function isToday(value: string) {
  const date = new Date(value);
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export function normalizeCorrectionSessions(value: unknown): CorrectionSessionRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isCorrectionSessionRow);
}
