import { InboxFilterChip, InboxFilterChipsRoot } from './InboxFilterChips.style';

export interface InboxFilterChipOption {
  key: string;
  label: string;
}

interface InboxFilterChipsProps {
  activeFilter: string;
  onChange: (filter: string) => void;
  options: InboxFilterChipOption[];
}

export function InboxFilterChips({ activeFilter, onChange, options }: InboxFilterChipsProps) {
  return (
    <InboxFilterChipsRoot>
      {options.map((option) => (
        <InboxFilterChip
          clickable
          color={option.key === activeFilter ? 'primary' : 'default'}
          key={option.key}
          label={option.label}
          onClick={() => {
            onChange(option.key);
          }}
          variant={option.key === activeFilter ? 'filled' : 'outlined'}
        />
      ))}
    </InboxFilterChipsRoot>
  );
}
