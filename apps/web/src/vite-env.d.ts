/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  /** Set to `"true"` to inject mock heartbeat rows on an interval (client-only, not persisted). */
  readonly VITE_ENABLE_MOCK_REALTIME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
