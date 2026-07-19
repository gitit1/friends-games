/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Dev-only touch/kiosk lock (see the .env file). Set to the string 'true' to
   * enable. Read at startup — restart the dev server after changing it.
   */
  readonly VITE_TOUCH_LOCK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
