import { Alert, CircularProgress, Stack, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { CorrectionInboxStatCardId, CorrectionSessionRow } from './types';

import { useAuth } from '../../auth/useAuth';
import { EmptyState } from '../../components/feedback/EmptyState';
import { RuntimeModeChip } from '../../components/feedback/RuntimeModeChip';
import { CorrectionSessionCardList } from '../../components/inbox/CorrectionSessionCardList';
import { CorrectionSessionsTable } from '../../components/inbox/CorrectionSessionsTable';
import { InboxFilterChips } from '../../components/inbox/InboxFilterChips';
import { InboxSearchField } from '../../components/inbox/InboxSearchField';
import { InboxStatCard } from '../../components/inbox/InboxStatCard';
import { InboxStatsRow } from '../../components/inbox/InboxStatsRow';
import { normalizeSessionStatus } from '../../components/inbox/status';
import { AppPageShell } from '../../components/layout/AppPageShell';
import { AuthenticatedAppBar } from '../../components/layout/AuthenticatedAppBar';
import { PageIntro } from '../../components/layout/PageIntro';
import { env } from '../../config/env';
import { useCorrectionSessionsQuery } from '../../graphql/hooks/useCorrectionSessionsQuery';
import { correctionInboxStatCardDefinitions } from './constants';
import { getStatusOptions, isToday, normalizeCorrectionSessions } from './utils';

export function CorrectionsInboxPage() {
  const { signOut, user } = useAuth();
  const { t } = useTranslation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [searchValue, setSearchValue] = useState('');
  const [activeStatusFilter, setActiveStatusFilter] = useState('ALL');
  const correctionSessionsQuery = useCorrectionSessionsQuery();
  const correctionSessions = normalizeCorrectionSessions(correctionSessionsQuery.data);
  const { error, loading } = correctionSessionsQuery;
  const statusOptions = getStatusOptions(correctionSessions, t('corrections.inbox.filters.all'));
  const normalizedSearchValue = searchValue.trim().toLowerCase();
  const normalizedFilter = activeStatusFilter.trim().toUpperCase();
  const filteredSessions = correctionSessions.filter((session: CorrectionSessionRow) => {
    const matchesFilter =
      normalizedFilter === 'ALL' || normalizeSessionStatus(session.status) === normalizedFilter;
    const matchesSearch =
      normalizedSearchValue.length === 0 ||
      session.documentId.toLowerCase().includes(normalizedSearchValue) ||
      session.documentType.toLowerCase().includes(normalizedSearchValue);

    return matchesFilter && matchesSearch;
  });
  const statValues: Record<CorrectionInboxStatCardId, number> = {
    assigned: correctionSessions.length,
    completedToday: correctionSessions.filter(
      (session: CorrectionSessionRow) =>
        normalizeSessionStatus(session.status) === 'COMPLETED' && isToday(session.updatedAt),
    ).length,
    inProgress: correctionSessions.filter(
      (session: CorrectionSessionRow) => normalizeSessionStatus(session.status) === 'IN_PROGRESS',
    ).length,
  };
  const statCards = correctionInboxStatCardDefinitions.map((definition) => ({
    label: t(definition.labelKey),
    tone: definition.tone,
    value: String(statValues[definition.id]),
  }));
  const sessionContent =
    !loading && !error && filteredSessions.length > 0 ? (
      isDesktop ? (
        <CorrectionSessionsTable
          documentIdLabel={t('corrections.inbox.table.documentId')}
          documentTypeLabel={t('corrections.inbox.table.documentType')}
          openSessionLabel={t('corrections.inbox.openSession')}
          sessions={filteredSessions}
          statusLabel={t('corrections.inbox.table.status')}
          updatedAtLabel={t('corrections.inbox.table.updatedAt')}
          versionLabel={t('corrections.inbox.table.version')}
        />
      ) : (
        <CorrectionSessionCardList
          documentTypeLabel={t('corrections.inbox.table.documentType')}
          openSessionLabel={t('corrections.inbox.openSession')}
          sessions={filteredSessions}
          updatedAtLabel={t('corrections.inbox.table.updatedAt')}
          versionLabel={t('corrections.inbox.table.version')}
        />
      )
    ) : null;

  return (
    <>
      <AuthenticatedAppBar
        isMockRuntime={env.mockGraphqlRuntime}
        liveRuntimeLabel={t('app.runtime.live')}
        mockRuntimeLabel={t('app.runtime.mock')}
        onSignOut={() => {
          void signOut();
        }}
        pageLabel={t('corrections.inbox.heading')}
        signOutLabel={t('auth.signOut.trigger')}
        userEmail={user?.email ?? ''}
        userName={user?.displayName ?? t('app.name')}
      />
      <AppPageShell>
        <Stack spacing={3}>
          <PageIntro
            actions={
              <RuntimeModeChip
                isMockRuntime={env.mockGraphqlRuntime}
                liveLabel={t('app.runtime.live')}
                mockLabel={t('app.runtime.mock')}
              />
            }
            subtitle={t('corrections.inbox.subtitle')}
            title={t('corrections.inbox.heading')}
          />

          <InboxStatsRow>
            {statCards.map((statCard) => (
              <InboxStatCard
                key={statCard.label}
                label={statCard.label}
                tone={statCard.tone}
                value={statCard.value}
              />
            ))}
          </InboxStatsRow>

          <Stack spacing={2}>
            <InboxSearchField
              label={t('corrections.inbox.search.label')}
              onChange={setSearchValue}
              placeholder={t('corrections.inbox.search.placeholder')}
              value={searchValue}
            />
            <InboxFilterChips
              activeFilter={activeStatusFilter}
              onChange={setActiveStatusFilter}
              options={statusOptions}
            />
          </Stack>

          {loading ? (
            <Stack sx={{ alignItems: 'center', justifyContent: 'center', minHeight: '20vh' }}>
              <CircularProgress />
            </Stack>
          ) : null}

          {error ? <Alert severity="error">{error}</Alert> : null}

          {!loading && !error && filteredSessions.length === 0 ? (
            <EmptyState
              body={
                correctionSessions.length === 0
                  ? t('corrections.inbox.empty.body')
                  : t('corrections.inbox.empty.filteredBody')
              }
              title={
                correctionSessions.length === 0
                  ? t('corrections.inbox.empty.title')
                  : t('corrections.inbox.empty.filteredTitle')
              }
            />
          ) : null}

          {sessionContent}
        </Stack>
      </AppPageShell>
    </>
  );
}
