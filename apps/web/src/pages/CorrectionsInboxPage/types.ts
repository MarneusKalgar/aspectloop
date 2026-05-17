import type { InboxStatCardTone } from '../../components/inbox/InboxStatCard';

export interface CorrectionInboxStatCardDefinition {
  id: CorrectionInboxStatCardId;
  labelKey: string;
  tone: InboxStatCardTone;
}

export type CorrectionInboxStatCardId = 'assigned' | 'completedToday' | 'inProgress';

export interface CorrectionSessionRow {
  documentId: string;
  documentType: string;
  id: string;
  status: string;
  updatedAt: string;
  version: number;
}
