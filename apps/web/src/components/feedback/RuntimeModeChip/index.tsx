import { RuntimeModeChipRoot } from './RuntimeModeChip.style';

interface RuntimeModeChipProps {
  isMockRuntime: boolean;
  liveLabel: string;
  mockLabel: string;
}

export function RuntimeModeChip({ isMockRuntime, liveLabel, mockLabel }: RuntimeModeChipProps) {
  return (
    <RuntimeModeChipRoot
      color={isMockRuntime ? 'secondary' : 'primary'}
      label={isMockRuntime ? mockLabel : liveLabel}
      size="small"
      variant="outlined"
    />
  );
}
