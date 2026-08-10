import type { PropsWithChildren } from 'react';

import { AppPageShellInner, AppPageShellRoot } from './AppPageShell.style';

export function AppPageShell({ children }: PropsWithChildren) {
  return (
    <AppPageShellRoot>
      <AppPageShellInner>{children}</AppPageShellInner>
    </AppPageShellRoot>
  );
}
