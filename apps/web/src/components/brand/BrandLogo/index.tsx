import type { ReactNode } from 'react';

import { BrandLogoRoot, BrandMark, BrandName } from './BrandLogo.style';

interface BrandLogoProps {
  mark?: ReactNode;
  showWordmark?: boolean;
  stacked?: boolean;
  variant?: 'large' | 'regular';
}

/**
 * Renders the AspectLoop product mark and optional wordmark for application chrome.
 *
 * @param props - Controls the rendered mark, wordmark visibility, layout, and size variant.
 * @returns The branded logo lockup.
 */
export function BrandLogo({
  mark = 'AL',
  showWordmark = true,
  stacked = false,
  variant = 'regular',
}: BrandLogoProps) {
  return (
    <BrandLogoRoot direction="row" ownerState={{ stacked }}>
      <BrandMark ownerState={{ large: variant === 'large' }}>{mark}</BrandMark>
      {showWordmark ? <BrandName>AspectLoop</BrandName> : null}
    </BrandLogoRoot>
  );
}
