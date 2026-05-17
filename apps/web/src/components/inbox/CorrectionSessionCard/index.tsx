import type { CorrectionSessionListItem } from '../types';

import { SessionStatusChip } from '../SessionStatusChip';
import {
  CorrectionSessionCardAction,
  CorrectionSessionCardDetail,
  CorrectionSessionCardDetailLabel,
  CorrectionSessionCardDetails,
  CorrectionSessionCardDetailValue,
  CorrectionSessionCardHeader,
  CorrectionSessionCardMeta,
  CorrectionSessionCardRoot,
  CorrectionSessionCardSubtitle,
  CorrectionSessionCardTitle,
} from './CorrectionSessionCard.style';

interface CorrectionSessionCardProps {
  documentTypeLabel: string;
  openSessionLabel: string;
  session: CorrectionSessionListItem;
  updatedAtLabel: string;
  versionLabel: string;
}

export function CorrectionSessionCard({
  documentTypeLabel,
  openSessionLabel,
  session,
  updatedAtLabel,
  versionLabel,
}: CorrectionSessionCardProps) {
  return (
    <CorrectionSessionCardRoot variant="outlined">
      <CorrectionSessionCardHeader>
        <CorrectionSessionCardMeta>
          <CorrectionSessionCardTitle>{session.documentId}</CorrectionSessionCardTitle>
          <CorrectionSessionCardSubtitle>{session.documentType}</CorrectionSessionCardSubtitle>
        </CorrectionSessionCardMeta>
        <SessionStatusChip status={session.status} />
      </CorrectionSessionCardHeader>
      <CorrectionSessionCardDetails>
        <CorrectionSessionCardDetail>
          <CorrectionSessionCardDetailLabel>{documentTypeLabel}</CorrectionSessionCardDetailLabel>
          <CorrectionSessionCardDetailValue>
            {session.documentType}
          </CorrectionSessionCardDetailValue>
        </CorrectionSessionCardDetail>
        <CorrectionSessionCardDetail>
          <CorrectionSessionCardDetailLabel>{versionLabel}</CorrectionSessionCardDetailLabel>
          <CorrectionSessionCardDetailValue>v{session.version}</CorrectionSessionCardDetailValue>
        </CorrectionSessionCardDetail>
        <CorrectionSessionCardDetail>
          <CorrectionSessionCardDetailLabel>{updatedAtLabel}</CorrectionSessionCardDetailLabel>
          <CorrectionSessionCardDetailValue>
            {formatUpdatedAt(session.updatedAt)}
          </CorrectionSessionCardDetailValue>
        </CorrectionSessionCardDetail>
      </CorrectionSessionCardDetails>
      <CorrectionSessionCardAction disabled variant="outlined">
        {openSessionLabel}
      </CorrectionSessionCardAction>
    </CorrectionSessionCardRoot>
  );
}

function formatUpdatedAt(value: string) {
  return new Date(value).toLocaleString();
}
