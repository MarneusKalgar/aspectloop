import type { TextFieldProps } from '@mui/material/TextField';

import { InputAdornment, SvgIcon } from '@mui/material';
import { useState } from 'react';

import { PasswordToggleButton, StyledPasswordField } from './PasswordField.style';

type PasswordFieldProps = Omit<TextFieldProps, 'type'>;

export function PasswordField(props: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <StyledPasswordField
      {...props}
      slotProps={{
        ...props.slotProps,
        input: {
          ...(typeof props.slotProps?.input === 'object' ? props.slotProps.input : {}),
          endAdornment: (
            <InputAdornment position="end">
              <PasswordToggleButton
                aria-label={isVisible ? 'Hide password' : 'Show password'}
                edge="end"
                onClick={() => {
                  setIsVisible((currentValue) => !currentValue);
                }}
              >
                {isVisible ? <VisibilityOffIcon /> : <VisibilityIcon />}
              </PasswordToggleButton>
            </InputAdornment>
          ),
        },
      }}
      type={isVisible ? 'text' : 'password'}
    />
  );
}

function VisibilityIcon() {
  return (
    <SvgIcon>
      <path
        d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="12" cy="12" fill="none" r="3" stroke="currentColor" strokeWidth="2" />
    </SvgIcon>
  );
}

function VisibilityOffIcon() {
  return (
    <SvgIcon>
      <path d="M3 3l18 18" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M10.6 10.7A3 3 0 0013.3 13.4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M9.9 4.2A10.9 10.9 0 0112 4c7 0 11 8 11 8a21.7 21.7 0 01-4.4 5.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M6.6 6.7A21.7 21.7 0 001 12s4 8 11 8a10.9 10.9 0 004.1-.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </SvgIcon>
  );
}
