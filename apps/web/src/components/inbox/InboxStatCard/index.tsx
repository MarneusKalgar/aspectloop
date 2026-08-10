import {
  InboxStatCardContent,
  InboxStatCardHint,
  InboxStatCardLabel,
  InboxStatCardRoot,
  type InboxStatCardTone,
  InboxStatCardValue,
} from './InboxStatCard.style';

interface InboxStatCardProps {
  hint?: string;
  label: string;
  tone?: InboxStatCardTone;
  value: string;
}

export function InboxStatCard({ hint, label, tone = 'default', value }: InboxStatCardProps) {
  return (
    <InboxStatCardRoot ownerState={{ tone }} variant="outlined">
      <InboxStatCardContent>
        <InboxStatCardValue ownerState={{ tone }}>{value}</InboxStatCardValue>
        <InboxStatCardLabel ownerState={{ tone }}>{label}</InboxStatCardLabel>
        {hint ? <InboxStatCardHint ownerState={{ tone }}>{hint}</InboxStatCardHint> : null}
      </InboxStatCardContent>
    </InboxStatCardRoot>
  );
}

export type { InboxStatCardTone } from './InboxStatCard.style';
