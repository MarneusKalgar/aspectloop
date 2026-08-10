import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';

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

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
