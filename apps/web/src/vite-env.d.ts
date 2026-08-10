/// <reference types="vite/client" />

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface ImportMetaEnv {
  readonly BROWSER_MOCK_ENABLED: boolean;
  readonly VITE_API_URL: string;
  readonly VITE_APP_NAME: string;
}
