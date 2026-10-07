import { createContext, type PropsWithChildren, useContext, useSyncExternalStore } from 'react';

import type { AuthContextValue } from './session.types';

import { useSessionCoordinator } from './session-coordination/SessionCoordinatorProvider';
import { selectSessionView } from './session-view';
import { SessionBoundary } from './SessionBoundary';
import { useSessionActions } from './useSessionActions';
import { useSessionBootstrap } from './useSessionBootstrap';

export type { AuthContextValue } from './session.types';
const AuthContext = createContext<AuthContextValue | null>(null);

/** Composes coordination, bootstrap, account actions, and presentation without owning their policy. */
export function AuthProvider({ children }: PropsWithChildren) {
  const coordinator = useSessionCoordinator();
  const snapshot = useSyncExternalStore(coordinator.subscribe, coordinator.getSnapshot);
  const resolution = useSessionBootstrap(coordinator, snapshot);
  const view = selectSessionView(snapshot, resolution, coordinator.supportsAccountActions());
  const { logoutBusy, rejection, signIn, signOut, signUp } = useSessionActions(
    coordinator,
    snapshot.revision,
    view,
  );
  const rejectionMessage =
    rejection?.epoch === snapshot.marker?.epoch ? (rejection?.message ?? null) : null;

  /** Retries ordinary reads/cache retirement, never uncertain cookie writes. */
  function retryBootstrap(): void {
    coordinator.retryRead();
  }

  /** Presents explicit revocation recovery without creating an unhandled rejection. */
  function recoverSignOut(): void {
    void signOut().catch(
      /** Shared revocation state, not a discarded error, determines the rendered outcome. */
      () => undefined,
    );
  }

  return (
    <AuthContext.Provider
      value={{
        accountActionsAvailable: view.accountActionsAvailable,
        retryBootstrap,
        signIn,
        signOut,
        signUp,
        ...view.session,
      }}
    >
      <SessionBoundary
        logoutBusy={logoutBusy}
        onRecoverSignOut={recoverSignOut}
        onRetryBootstrap={retryBootstrap}
        rejectionMessage={rejectionMessage}
        view={view}
      >
        {children}
      </SessionBoundary>
    </AuthContext.Provider>
  );
}

/** Provides only the current generation's user and explicit session actions. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
