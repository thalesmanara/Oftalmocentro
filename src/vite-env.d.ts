/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_N8N_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
