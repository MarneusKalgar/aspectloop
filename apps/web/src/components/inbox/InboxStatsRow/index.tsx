import type { ReactNode } from 'react';

import { InboxStatsRowRoot } from './InboxStatsRow.style';

export function InboxStatsRow({ children }: { children: ReactNode }) {
  return <InboxStatsRowRoot>{children}</InboxStatsRowRoot>;
}
