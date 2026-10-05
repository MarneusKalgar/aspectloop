import { createContext, type PropsWithChildren, useContext, useEffect, useRef } from 'react';

import { createBrowserSessionEnvironment } from './browser-environment';
import { SessionCoordinator } from './session-coordinator';

const CoordinationContext = createContext<null | SessionCoordinator>(null);

/** Deletes only the proven JavaScript-readable legacy cookie on the SPA host. */
export function clearLegacyBrowserCookie(): void {
  document.cookie = `aspectloop_access_token=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
}

/** Shares one tab coordinator between transport and identity without sharing credentials. */
export function SessionCoordinatorProvider({ children }: PropsWithChildren) {
  const instance = useRef<null | SessionCoordinator>(null);
  instance.current ??= new SessionCoordinator(createBrowserSessionEnvironment());
  const coordinator = instance.current;

  useEffect(
    /** Attaches peer hints only while mounted and cleans up StrictMode subscriptions. */
    () => {
      clearLegacyBrowserCookie();
      return coordinator.start();
    },
    [coordinator],
  );

  return (
    <CoordinationContext.Provider value={coordinator}>{children}</CoordinationContext.Provider>
  );
}

/** Supplies the exact coordinator used by this tab's Apollo transport. */
export function useSessionCoordinator(): SessionCoordinator {
  const coordinator = useContext(CoordinationContext);
  if (!coordinator) {
    throw new Error('SessionCoordinatorProvider is required.');
  }

  return coordinator;
}
