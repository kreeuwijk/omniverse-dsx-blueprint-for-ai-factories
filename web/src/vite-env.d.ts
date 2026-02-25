/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL for the AI Agent chat endpoint (Backend AI Agent service) */
  readonly VITE_CHAT_API_URL?: string;
  /** URL for the camera switch endpoint (Omniverse Kit App) */
  readonly VITE_CAMERA_API_URL?: string;
  /** Set to "true" to disable Omniverse streaming (for UI development) */
  readonly VITE_DISABLE_OMNIVERSE?: string;
  /** Server address for Kit streaming (defaults to current hostname) */
  readonly VITE_OMNIVERSE_SERVER?: string;
  /** Signaling port for WebRTC (default: 49100) */
  readonly VITE_SIGNALING_PORT?: string;
  /** Vite's built-in DEV mode flag (automatically provided by Vite) */
  readonly DEV: boolean;
  /** Vite's built-in PROD mode flag */
  readonly PROD: boolean;
  /** Vite's built-in MODE flag */
  readonly MODE: string;
  /** Vite's built-in BASE_URL flag */
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}