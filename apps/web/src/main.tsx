import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { env } from './config/env';

async function bootstrap() {
  if (env.mockGraphqlRuntime) {
    const { worker } = await import('./mocks/browser');

    await worker.start({
      onUnhandledRequest: 'bypass',
    });
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
