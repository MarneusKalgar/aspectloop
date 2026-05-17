import type { ReactNode } from 'react';

import {
  PageIntroActions,
  PageIntroCopy,
  PageIntroRoot,
  PageIntroSubtitle,
  PageIntroTitle,
} from './PageIntro.style';

interface PageIntroProps {
  actions?: ReactNode;
  subtitle: string;
  title: string;
}

export function PageIntro({ actions, subtitle, title }: PageIntroProps) {
  return (
    <PageIntroRoot>
      <PageIntroCopy>
        <PageIntroTitle>{title}</PageIntroTitle>
        <PageIntroSubtitle>{subtitle}</PageIntroSubtitle>
      </PageIntroCopy>
      {actions ? <PageIntroActions>{actions}</PageIntroActions> : null}
    </PageIntroRoot>
  );
}
