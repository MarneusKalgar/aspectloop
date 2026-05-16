import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../auth/useAuth';
import { env } from '../config/env';
import { useCorrectionSessionsQuery } from '../graphql/hooks/useCorrectionSessionsQuery';

interface CorrectionSessionRow {
  documentId: string;
  documentType: string;
  id: string;
  status: string;
  updatedAt: string;
  version: number;
}

export function CorrectionsInboxPage() {
  const { signOut, user } = useAuth();
  const { t } = useTranslation();
  const correctionSessionsQuery = useCorrectionSessionsQuery();
  const correctionSessions = normalizeCorrectionSessions(correctionSessionsQuery.data);
  const { error, loading } = correctionSessionsQuery;

  return (
    <Stack spacing={3}>
      <Stack
        direction="row"
        spacing={2}
        sx={{ alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Box>
          <Typography component="h1" variant="h4">
            {t('corrections.inbox.heading')}
          </Typography>
          <Typography color="text.secondary">{t('corrections.inbox.subtitle')}</Typography>
        </Box>

        <Stack spacing={1} sx={{ alignItems: 'flex-end' }}>
          <Chip
            color={env.mockGraphqlRuntime ? 'secondary' : 'primary'}
            label={env.mockGraphqlRuntime ? t('app.runtime.mock') : t('app.runtime.live')}
            variant="outlined"
          />
          <Typography color="text.secondary" variant="body2">
            {user?.displayName}
          </Typography>
          <Button onClick={() => void signOut()} variant="text">
            {t('auth.signOut.trigger')}
          </Button>
        </Stack>
      </Stack>

      {loading ? (
        <Stack sx={{ alignItems: 'center', justifyContent: 'center', minHeight: '20vh' }}>
          <CircularProgress />
        </Stack>
      ) : null}

      {error ? <Alert severity="error">{error}</Alert> : null}

      {!loading && !error && correctionSessions.length === 0 ? (
        <Paper sx={{ p: 4 }} variant="outlined">
          <Stack spacing={1}>
            <Typography variant="h6">{t('corrections.inbox.empty.title')}</Typography>
            <Typography color="text.secondary">{t('corrections.inbox.empty.body')}</Typography>
          </Stack>
        </Paper>
      ) : null}

      {!loading && !error && correctionSessions.length > 0 ? (
        <Paper sx={{ overflow: 'hidden' }} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('corrections.inbox.table.documentId')}</TableCell>
                <TableCell>{t('corrections.inbox.table.documentType')}</TableCell>
                <TableCell>{t('corrections.inbox.table.status')}</TableCell>
                <TableCell>{t('corrections.inbox.table.version')}</TableCell>
                <TableCell>{t('corrections.inbox.table.updatedAt')}</TableCell>
                <TableCell align="right">&nbsp;</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {correctionSessions.map((session) => (
                <TableRow hover key={session.id}>
                  <TableCell>{session.documentId}</TableCell>
                  <TableCell>{session.documentType}</TableCell>
                  <TableCell>{session.status}</TableCell>
                  <TableCell>{session.version}</TableCell>
                  <TableCell>{new Date(session.updatedAt ?? '').toLocaleString()}</TableCell>
                  <TableCell align="right">
                    <Button disabled variant="text">
                      {t('corrections.inbox.openSession')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      ) : null}
    </Stack>
  );
}

function isCorrectionSessionRow(value: unknown): value is CorrectionSessionRow {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.documentId === 'string' &&
    typeof candidate.documentType === 'string' &&
    typeof candidate.id === 'string' &&
    typeof candidate.status === 'string' &&
    typeof candidate.updatedAt === 'string' &&
    typeof candidate.version === 'number'
  );
}

function normalizeCorrectionSessions(value: unknown): CorrectionSessionRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isCorrectionSessionRow);
}
