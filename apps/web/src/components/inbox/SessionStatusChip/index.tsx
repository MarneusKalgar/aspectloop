import { formatSessionStatusLabel, getSessionStatusChipColor } from '../status';
import { SessionStatusChipRoot } from './SessionStatusChip.style';

interface SessionStatusChipProps {
  status: string;
}

export function SessionStatusChip({ status }: SessionStatusChipProps) {
  return (
    <SessionStatusChipRoot
      color={getSessionStatusChipColor(status)}
      label={formatSessionStatusLabel(status)}
      size="small"
      variant="outlined"
    />
  );
}
