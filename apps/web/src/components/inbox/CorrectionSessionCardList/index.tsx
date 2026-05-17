import type { CorrectionSessionListItem } from '../types';

import { CorrectionSessionCard } from '../CorrectionSessionCard';
import { CorrectionSessionCardListRoot } from './CorrectionSessionCardList.style';

interface CorrectionSessionCardListProps {
  documentTypeLabel: string;
  openSessionLabel: string;
  sessions: CorrectionSessionListItem[];
  updatedAtLabel: string;
  versionLabel: string;
}

export function CorrectionSessionCardList({
  documentTypeLabel,
  openSessionLabel,
  sessions,
  updatedAtLabel,
  versionLabel,
}: CorrectionSessionCardListProps) {
  return (
    <CorrectionSessionCardListRoot>
      {sessions.map((session) => (
        <CorrectionSessionCard
          documentTypeLabel={documentTypeLabel}
          key={session.id}
          openSessionLabel={openSessionLabel}
          session={session}
          updatedAtLabel={updatedAtLabel}
          versionLabel={versionLabel}
        />
      ))}
    </CorrectionSessionCardListRoot>
  );
}
