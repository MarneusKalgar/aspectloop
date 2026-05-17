import type { CorrectionInboxStatCardDefinition } from './types';

export const correctionInboxStatCardDefinitions = [
  {
    id: 'assigned',
    labelKey: 'corrections.inbox.stats.assigned.label',
    tone: 'shell',
  },
  {
    id: 'inProgress',
    labelKey: 'corrections.inbox.stats.inProgress.label',
    tone: 'primary',
  },
  {
    id: 'completedToday',
    labelKey: 'corrections.inbox.stats.completedToday.label',
    tone: 'default',
  },
] satisfies CorrectionInboxStatCardDefinition[];
