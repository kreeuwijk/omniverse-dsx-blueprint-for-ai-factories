/**
 * API Configuration
 * 
 * Centralized configuration for all backend API endpoints.
 * These URLs can be overridden via environment variables.
 */

/**
 * DSX Agent HTTP API port. Defaults to 8012.
 * Override via VITE_DSX_AGENT_PORT (must match DSX_AGENT_PORT on the Kit side).
 */
const DSX_AGENT_PORT = import.meta.env.VITE_DSX_AGENT_PORT || '8012';

/**
 * Resolve the host for Kit's agent HTTP API.
 * Uses window.location.hostname so the browser connects to the same host
 * serving the web page — works for both local and remote access.
 */
const AGENT_HOST = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

/**
 * Backend AI Agent API endpoint for chat (full response).
 * Can be overridden via VITE_CHAT_API_URL (takes precedence over port).
 */
export const CHAT_API_URL = import.meta.env.VITE_CHAT_API_URL || `http://${AGENT_HOST}:${DSX_AGENT_PORT}/api/agent/chat`;

/**
 * Backend AI Agent API endpoint for streaming chat (Server-Sent Events).
 * Returns token-by-token responses via SSE for real-time display.
 */
export const CHAT_STREAM_API_URL = `${CHAT_API_URL}/stream`;

/**
 * Backend AI Agent API base URL for preferences.
 * Derived from the chat API URL.
 * Used to persist GPU selection when AI agent changes it.
 */
export const PREFERENCES_API_URL = CHAT_API_URL.replace('/chat', '/preferences');

/**
 * Backend AI Agent state sync endpoint.
 * Frontend POSTs UI state changes so the agent stays aware of
 * user-driven GPU switches, simulation tab changes, test start/stop, etc.
 */
export const AGENT_STATE_URL = CHAT_API_URL.replace('/chat', '/state');
