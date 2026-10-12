import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { initializeConfirmationAttempt } from './auth/email-confirmation/confirmation-attempt';
import { captureConfirmationLink } from './auth/email-confirmation/confirmation-link';

initializeConfirmationAttempt(captureConfirmationLink());

/** Sanitizes the link synchronously before loading the router or asynchronous app dependencies. */
async function bootstrap() {
  if (import.meta.env.BROWSER_MOCK_ENABLED) {
    const { worker } = await import('@app/mocks/browser');

    await worker.start({
      onUnhandledRequest: 'bypass',
      serviceWorker: {
        url: '/mockServiceWorker.js',
      },
    });
  }

  const { App } = await import('./App');

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
