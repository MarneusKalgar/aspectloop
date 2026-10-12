import {
  type ComponentProps,
  createContext,
  type PropsWithChildren,
  useContext,
  useSyncExternalStore,
} from 'react';

import type { AuthContextValue } from './session.types';

import { useSessionCoordinator } from './session-coordination/SessionCoordinatorProvider';
import { selectSessionView } from './session-view';
import { SessionBoundary } from './SessionBoundary';
import { useSessionActions } from './useSessionActions';
import { useSessionBootstrap } from './useSessionBootstrap';

export type { AuthContextValue } from './session.types';
const AuthContext = createContext<AuthContextValue | null>(null);
const BoundaryContext = createContext<null | Omit<
  ComponentProps<typeof SessionBoundary>,
  'children'
>>(null);

/** Composes coordination, bootstrap, account actions, and presentation without owning their policy. */
export function AuthProvider({
  children,
  routedBoundary = false,
}: PropsWithChildren<{ routedBoundary?: boolean }>) {
  const coordinator = useSessionCoordinator();
  const snapshot = useSyncExternalStore(coordinator.subscribe, coordinator.getSnapshot);
  const resolution = useSessionBootstrap(coordinator, snapshot);
  const view = selectSessionView(snapshot, resolution, coordinator.supportsAccountActions());
  const { logoutBusy, rejection, signIn, signOut, signUp } = useSessionActions(
    coordinator,
    snapshot.revision,
    view,
  );
  const currentRejection = rejection?.epoch === snapshot.marker?.epoch ? rejection : null;

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

  const boundary = {
    logoutBusy,
    onRecoverSignOut: recoverSignOut,
    onRetryBootstrap: retryBootstrap,
    rejectionCode: currentRejection?.code ?? null,
    rejectionMessage: currentRejection?.message ?? null,
    view,
  };

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
      <BoundaryContext.Provider value={boundary}>
        {routedBoundary ? children : <SessionBoundary {...boundary}>{children}</SessionBoundary>}
      </BoundaryContext.Provider>
    </AuthContext.Provider>
  );
}

/** Applies unchanged session presentation to every route except explicit public registration pages. */
export function AuthSessionBoundary({ children }: PropsWithChildren) {
  const boundary = useContext(BoundaryContext);

  if (!boundary) {
    throw new Error('AuthSessionBoundary must be used within AuthProvider');
  }

  return <SessionBoundary {...boundary}>{children}</SessionBoundary>;
}

/** Provides only the current generation's user and explicit session actions. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
