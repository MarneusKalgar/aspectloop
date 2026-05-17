import type { ReactNode } from 'react';

import { BrandLogoRoot, BrandMark, BrandName } from './BrandLogo.style';

interface BrandLogoProps {
  mark?: ReactNode;
  showWordmark?: boolean;
  stacked?: boolean;
  variant?: 'large' | 'regular';
}

export function BrandLogo({
  mark = 'E',
  showWordmark = true,
  stacked = false,
  variant = 'regular',
}: BrandLogoProps) {
  return (
    <BrandLogoRoot direction="row" ownerState={{ stacked }}>
      <BrandMark ownerState={{ large: variant === 'large' }}>{mark}</BrandMark>
      {showWordmark ? <BrandName>Elemika</BrandName> : null}
    </BrandLogoRoot>
  );
}
