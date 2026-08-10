import type { ReactNode } from 'react';

import {
  EmptyStateBody,
  EmptyStateContent,
  EmptyStateRoot,
  EmptyStateTitle,
} from './EmptyState.style';

interface EmptyStateProps {
  action?: ReactNode;
  body: string;
  title: string;
}

export function EmptyState({ action, body, title }: EmptyStateProps) {
  return (
    <EmptyStateRoot variant="outlined">
      <EmptyStateContent>
        <EmptyStateTitle>{title}</EmptyStateTitle>
        <EmptyStateBody>{body}</EmptyStateBody>
        {action}
      </EmptyStateContent>
    </EmptyStateRoot>
  );
}
