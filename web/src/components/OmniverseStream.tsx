/**
 * OmniverseStream - Video stream component for Kit WebRTC streaming
 *
 * Renders the video and audio elements required for WebRTC streaming.
 * Must be used within an OmniverseApiProvider.
 */

import {
  defaultVideoElementId,
  defaultAudioElementId,
  defaultMessageElementId,
} from "@/providers/OmniverseApiProvider";
import useOmniverseApi from "@/hooks/useOmniverseApi";
import { OmniverseStreamStatus } from "@/lib/OmniverseApi";

interface OmniverseStreamProps {
  /** Additional CSS classes for the container */
  className?: string;
  /** Show connection status overlay */
  showStatus?: boolean;
}

/**
 * Renders the WebRTC video stream from a Kit application.
 *
 * @example
 * ```tsx
 * <OmniverseApiProvider>
 *   <OmniverseStream className="w-full h-full" showStatus />
 * </OmniverseApiProvider>
 * ```
 */
function OmniverseStream({ className = "", showStatus = false }: OmniverseStreamProps) {
  const { status } = useOmniverseApi();

  // Show disabled message if Omniverse is turned off
  if (import.meta.env.VITE_DISABLE_OMNIVERSE === "true") {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-gray-900 text-gray-50 text-xl ${className}`}>
        Omniverse Streaming Disabled
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Video element for WebRTC stream - matches dcdt implementation */}
      <video
        id={defaultVideoElementId}
        tabIndex={-1}
        playsInline
        muted
        autoPlay
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          background: "black",
        }}
      />

      {/* Audio element for WebRTC audio */}
      <audio id={defaultAudioElementId} />

      {/* Hidden message element used by streaming library */}
      <h3 style={{ visibility: "hidden" }} id={defaultMessageElementId}>
        ...
      </h3>

      {/* Optional status overlay */}
      {showStatus && status !== OmniverseStreamStatus.connected && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-white text-center">
            {status === OmniverseStreamStatus.waiting && (
              <p>Waiting to connect...</p>
            )}
            {status === OmniverseStreamStatus.connecting && (
              <p>Connecting to Kit...</p>
            )}
            {status === OmniverseStreamStatus.error && (
              <p className="text-red-400">Connection error. Please refresh.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default OmniverseStream;
