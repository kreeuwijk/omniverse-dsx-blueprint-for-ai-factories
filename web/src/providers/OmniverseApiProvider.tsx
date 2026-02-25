/**
 * OmniverseApiProvider - Context provider for direct Kit streaming
 *
 * Rebuilt to use the SDK-recommended connection pattern from
 * create-ov-web-rtc-app (v5.17.0). Key changes from original:
 *   - Uses signalingServer only (not mediaServer + signalingServer)
 *   - Supports VITE_OMNIVERSE_SERVER and VITE_SIGNALING_PORT env vars
 *   - SDK handles media server resolution internally
 */

import { useEffect, useRef, useState, ReactNode } from "react";
import {
  OmniverseAPI,
  OmniverseStreamStatus,
  StreamHandlerCallback,
} from "@/lib/OmniverseApi";
import { DirectConfig, StreamEvent } from "@nvidia/omniverse-webrtc-streaming-library";
import { OmniverseApiContext } from "@/hooks/useOmniverseApi";

// Default element IDs for the streaming video/audio elements
export const defaultVideoElementId = "remote-video";
export const defaultAudioElementId = "remote-audio";
export const defaultMessageElementId = "message-display";

// Default stream event handlers
const defaultOnStreamStart = (message: StreamEvent) => {
  console.debug(`[OmniverseAPI] start: ${JSON.stringify(message)}`);
};

const defaultOnStreamUpdate = (message: StreamEvent) => {
  console.debug(`[OmniverseAPI] update: ${JSON.stringify(message)}`);
};

// v5.17.0: onCustomEvent receives ApplicationMessage | StreamMessage, not StreamEvent
const defaultOnStreamCustomEvent = (message: unknown) => {
  if (import.meta.env.DEV) {
    console.debug("[OmniverseAPI] custom event:", message);
  }
};

const defaultOnStreamStop = (message: StreamEvent) => {
  console.debug(`[OmniverseAPI] stop: ${JSON.stringify(message)}`);
};

const defaultOnStreamTerminate = (message: StreamEvent) => {
  console.debug(`[OmniverseAPI] terminate: ${JSON.stringify(message)}`);
};

/**
 * Creates an OmniverseAPI instance using the SDK-recommended DirectConfig.
 *
 * Follows the create-ov-web-rtc-app pattern:
 *   - Uses `signalingServer` as the primary server address
 *   - Does NOT set `mediaServer` separately (SDK resolves it internally)
 *   - Port defaults to 49100 (matching Kit's omni.kit.livestream.app)
 */
function createOmniverseApi(
  videoElementId: string,
  audioElementId: string,
  onStreamStart: StreamHandlerCallback,
  onStreamUpdate: StreamHandlerCallback,
  onStreamCustomEvent: (message: unknown) => void,
  onStreamStop: StreamHandlerCallback,
  onStreamTerminate: StreamHandlerCallback
): OmniverseAPI {
  const queryParams = new URLSearchParams(window.location.search);

  const getParam = (name: string, defaultVal: string) => {
    return queryParams.get(name) || defaultVal;
  };

  // Get streaming configuration from query params or environment variables
  const server = getParam(
    "server",
    import.meta.env.VITE_OMNIVERSE_SERVER || window.location.hostname
  );
  const signalingPort = Number(
    getParam("signalingPort", import.meta.env.VITE_SIGNALING_PORT || "49100")
  );
  const width = Number(getParam("width", "1920"));
  const height = Number(getParam("height", "1080"));
  const fps = Number(getParam("fps", "60"));

  if (server === "localhost" && window.location.hostname !== "localhost") {
    console.warn(
      "[OmniverseAPI] Warning: server=localhost but accessing from",
      window.location.hostname,
      "- Kit WebRTC may not connect. Use ?server=" + window.location.hostname
    );
  }

  // SDK-recommended DirectConfig (from create-ov-web-rtc-app scaffold):
  //   - signalingServer: the Kit host address
  //   - NO mediaServer field (SDK resolves media server internally)
  const streamConfig: DirectConfig = {
    videoElementId,
    audioElementId,
    signalingServer: server,
    signalingPort,
    width,
    height,
    fps,
    onStart: onStreamStart,
    onUpdate: onStreamUpdate,
    onCustomEvent: onStreamCustomEvent,
    onStop: onStreamStop,
    onTerminate: onStreamTerminate,
    nativeTouchEvents: true,
    authenticate: false,
    maxReconnects: 20,
  };

  console.log("[OmniverseAPI] Connecting with config:", {
    signalingServer: server,
    signalingPort,
    width,
    height,
    fps,
    pageProtocol: window.location.protocol,
    pageHostname: window.location.hostname,
  });

  const api = new OmniverseAPI(streamConfig);
  return api;
}

export interface OmniverseApiProviderProps {
  children: ReactNode;
  /** Optional callback when stream status changes */
  onStatusChange?: (status: OmniverseStreamStatus) => void;
}

/**
 * Provider component that establishes direct WebRTC streaming to Kit.
 *
 * @example
 * ```tsx
 * <OmniverseApiProvider>
 *   <App />
 * </OmniverseApiProvider>
 * ```
 */
export const OmniverseApiProvider = ({
  children,
  onStatusChange,
}: OmniverseApiProviderProps) => {
  const apiInitialized = useRef(false);
  const [api, setApi] = useState<OmniverseAPI | undefined>(undefined);
  const [status, setStatus] = useState(OmniverseStreamStatus.waiting);

  // Handle stream status changes
  const handleStreamStatusChange = (msg: StreamEvent) => {
    if (msg.action !== "start") {
      return;
    }
    let newStatus = status;
    switch (msg.status) {
      case "inProgress": {
        newStatus = OmniverseStreamStatus.connecting;
        break;
      }
      case "error": {
        newStatus = OmniverseStreamStatus.error;
        break;
      }
      case "success": {
        newStatus = OmniverseStreamStatus.connected;
        break;
      }
      default:
        break;
    }
    setStatus(newStatus);
    onStatusChange?.(newStatus);
  };

  const onStreamStart: StreamHandlerCallback = (msg) => {
    defaultOnStreamStart(msg);
    handleStreamStatusChange(msg);
  };

  const onStreamUpdate: StreamHandlerCallback = (msg) => {
    defaultOnStreamUpdate(msg);
    handleStreamStatusChange(msg);
  };

  useEffect(() => {
    // Skip if already initialized
    if (apiInitialized.current) {
      return;
    }
    apiInitialized.current = true;

    // Small delay to ensure video element is in DOM
    const timer = setTimeout(() => {
      const videoElement = document.getElementById(defaultVideoElementId);
      if (!videoElement) {
        console.error("[OmniverseAPI] Video element not found:", defaultVideoElementId);
        return;
      }
      console.log("[OmniverseAPI] Initializing connection...");

      const newApi = createOmniverseApi(
        defaultVideoElementId,
        defaultAudioElementId,
        onStreamStart,
        onStreamUpdate,
        defaultOnStreamCustomEvent,
        defaultOnStreamStop,
        defaultOnStreamTerminate
      );
      setApi(newApi);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return (
    <OmniverseApiContext.Provider value={{ api, status }}>
      {children}
    </OmniverseApiContext.Provider>
  );
};

export default OmniverseApiProvider;
