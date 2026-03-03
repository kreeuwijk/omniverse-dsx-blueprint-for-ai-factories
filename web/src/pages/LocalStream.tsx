/**
 * LocalStream - Streaming UI with direct Kit streaming (no NVCF, no auth)
 *
 * Renders the video stream and overlay UI. The header is intentionally
 * excluded here so that library consumers (build:lib) get a headerless
 * component — the standalone app entry (main.tsx) adds the header.
 */

import { Box } from "@mantine/core";
import DS9OverlayLite from "./DS9OverlayLite";
import { useUI } from "@/context/UIContext";
import { OmniverseApiProvider } from "@/providers/OmniverseApiProvider";
import {
  defaultVideoElementId,
  defaultAudioElementId,
  defaultMessageElementId,
} from "@/providers/OmniverseApiProvider";
import useOmniverseApi from "@/hooks/useOmniverseApi";
import { OmniverseStreamStatus } from "@/lib/OmniverseApi";
import { StreamLoader } from "../components/StreamLoader";
import { StreamError } from "../components/StreamError";

/**
 * Video stream component - must be rendered BEFORE OmniverseApiProvider connects
 */
function StreamVideo() {
  return (
    <>
      <video
        id={defaultVideoElementId}
        width="100%"
        height="100%"
        tabIndex={-1}
        playsInline
        muted
        autoPlay
        className="h-full w-full object-cover"
        style={{ background: "black" }}
      />
      <audio id={defaultAudioElementId} muted />
      <h3 style={{ visibility: "hidden" }} id={defaultMessageElementId}>
        ...
      </h3>
    </>
  );
}

/**
 * UI Overlay component that uses the OmniverseApi context
 */
function LocalStreamUI() {
  const { status } = useOmniverseApi();
  const { state } = useUI();

  function reload() {
    window.location.reload();
  }

  const isLoading = status === OmniverseStreamStatus.waiting ||
                    status === OmniverseStreamStatus.connecting;
  const isError = status === OmniverseStreamStatus.error;

  return (
    <>
      <Box
        style={{
          inset: 0,
          pointerEvents: state.activeConfigMode === "site" ? "auto" : "none"
        }}
      >
            <DS9OverlayLite />
      </Box>

      {isLoading && (
        <div id="dsx-loader-container" style={{ position: "absolute", inset: 0, zIndex: 200 }}>
          <StreamLoader />
        </div>
      )}

      {isError && (
        <div id="dsx-error-container" style={{ position: "absolute", inset: 0, zIndex: 200 }}>
          <StreamError
            disabled={false}
            loading={false}
            error={"Failed to connect to Kit streaming. Make sure Kit is running with streaming enabled."}
            onReload={reload}
            onStartNewSession={reload}
          />
        </div>
      )}
    </>
  );
}

/**
 * Main LocalStream component — renders the stream and overlay only (no header).
 */
export default function LocalStream() {
  return (
    <div id="dsx-local-stream-container" style={{ position: "relative", overflow: "auto", width: "100%", height: "100%", minHeight: 800 }}>
      <div id="dsx-video-element-container" style={{ overflow: "hidden", width: "100%", height: "100%", position: "absolute", zIndex: 1 }}>
        <StreamVideo />
      </div>

      <OmniverseApiProvider>
        <LocalStreamUI />
      </OmniverseApiProvider>
    </div>
  );
}
