/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_N8N_BASE_URL: string
  /** Quando "true", permite mocks explícitos de desenvolvimento. Nunca usar como fallback de API. */
  readonly VITE_ENABLE_MOCKS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
