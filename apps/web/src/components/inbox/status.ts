import type { ChipProps } from '@mui/material';

const successStates = new Set(['COMPLETED', 'DONE', 'SUBMITTED']);
const warningStates = new Set(['IN_PROGRESS', 'PENDING']);
const infoStates = new Set(['OPEN', 'READY']);

export function formatSessionStatusLabel(status: string) {
  return status
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

export function getSessionStatusChipColor(status: string): ChipProps['color'] {
  const normalizedStatus = status.trim().toUpperCase();

  if (successStates.has(normalizedStatus)) {
    return 'success';
  }

  if (warningStates.has(normalizedStatus)) {
    return 'warning';
  }

  if (infoStates.has(normalizedStatus)) {
    return 'primary';
  }

  return 'default';
}

export function normalizeSessionStatus(status: string) {
  return status.trim().toUpperCase();
}
