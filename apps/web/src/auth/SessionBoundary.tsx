import type { PropsWithChildren } from 'react';

import { Alert, Box, Button, CircularProgress, Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';

import type { SessionRecovery, SessionView } from './session-view';

import { BROWSER_AUTH_STATUS } from './session.types';

interface RecoveryActionProps {
  busy: boolean;
  onRecoverSignOut: () => void;
  onRetryBootstrap: () => void;
  recovery: SessionRecovery;
}

interface SessionBoundaryProps extends PropsWithChildren {
  logoutBusy: boolean;
  onRecoverSignOut: () => void;
  onRetryBootstrap: () => void;
  rejectionMessage: null | string;
  view: SessionView;
}

/** Withholds protected children during retirement and presents the selected session outcome. */
export function SessionBoundary({
  children,
  logoutBusy,
  onRecoverSignOut,
  onRetryBootstrap,
  rejectionMessage,
  view,
}: SessionBoundaryProps) {
  const { t } = useTranslation();
  if (view.session.status === BROWSER_AUTH_STATUS.LOADING) {
    return (
      <Stack
        aria-label={t('router.loading')}
        role="status"
        spacing={2}
        sx={{ alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}
      >
        <CircularProgress />
        {view.localSignOutAvailable && (
          <Button onClick={onRecoverSignOut}>{t('auth.session.localSignOut')}</Button>
        )}
      </Stack>
    );
  }

  if (view.session.status === BROWSER_AUTH_STATUS.UNAVAILABLE) {
    const showRecovery =
      view.notice?.recovery === 'retry-bootstrap' ||
      (view.notice?.recovery === 'retry-sign-out' && !logoutBusy);
    return (
      <Box sx={{ maxWidth: 560, mx: 'auto', p: 4 }}>
        {view.notice && (
          <Alert
            action={
              showRecovery ? (
                <RecoveryAction
                  busy={logoutBusy}
                  onRecoverSignOut={onRecoverSignOut}
                  onRetryBootstrap={onRetryBootstrap}
                  recovery={view.notice.recovery}
                />
              ) : undefined
            }
            severity="warning"
          >
            {t(view.notice.messageKey)}
          </Alert>
        )}
        {view.unsupported && <Alert severity="warning">{t('auth.session.unsupported')}</Alert>}
      </Box>
    );
  }

  return (
    <>
      {view.unsupported && <Alert severity="warning">{t('auth.session.unsupported')}</Alert>}
      {view.session.status === BROWSER_AUTH_STATUS.ANONYMOUS && rejectionMessage && (
        <Alert severity="error">{rejectionMessage}</Alert>
      )}
      {children}
    </>
  );
}

/** Renders only the selected recovery; busy sign-out cannot be dispatched twice. */
function RecoveryAction({
  busy,
  onRecoverSignOut,
  onRetryBootstrap,
  recovery,
}: RecoveryActionProps) {
  const { t } = useTranslation();
  if (recovery === 'retry-bootstrap') {
    return (
      <Button color="inherit" onClick={onRetryBootstrap}>
        {t('auth.session.retry')}
      </Button>
    );
  }

  if (recovery === 'retry-sign-out' && !busy) {
    return (
      <Button color="inherit" onClick={onRecoverSignOut}>
        {t('auth.session.retrySignOut')}
      </Button>
    );
  }

  return null;
}
