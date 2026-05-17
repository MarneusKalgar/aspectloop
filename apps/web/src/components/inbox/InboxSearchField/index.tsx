import { InputAdornment, SvgIcon } from '@mui/material';

import { InboxSearchFieldRoot } from './InboxSearchField.style';

interface InboxSearchFieldProps {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}

export function InboxSearchField({ label, onChange, placeholder, value }: InboxSearchFieldProps) {
  return (
    <InboxSearchFieldRoot
      label={label}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      placeholder={placeholder}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        },
      }}
      value={value}
    />
  );
}

function SearchIcon() {
  return (
    <SvgIcon>
      <circle cx="11" cy="11" fill="none" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-4.35-4.35" fill="none" stroke="currentColor" strokeWidth="2" />
    </SvgIcon>
  );
}
