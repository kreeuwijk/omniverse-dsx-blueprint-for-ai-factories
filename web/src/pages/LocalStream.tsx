/**
 * LocalStream - Full app UI with direct Kit streaming (no NVCF, no auth)
 *
 * This page provides the complete DS9 application experience with direct
 * WebRTC streaming to a local Kit application, bypassing NVCF and authentication.
 */

import { ActionIcon, Box, Flex } from "@mantine/core";
import { IconMaximize, IconMinimize, IconX } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import HeaderLocal from "../components/HeaderLocal";
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
    <div className="w-full h-full">
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
    </div>
  );
}

/**
 * UI Overlay component that uses the OmniverseApi context
 */
function LocalStreamUI() {
  const { status } = useOmniverseApi();
  const { state } = useUI();

  const [fullScreen, setFullScreen] = useState(false);
  const videoElement = useRef<HTMLVideoElement>(null);

  async function toggleFullScreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }

    if (videoElement.current) {
      videoElement.current.click();
    }
  }

  useEffect(() => {
    const sync = () => {
      setFullScreen(document.fullscreenElement != null);
    };
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  function terminate() {
    if (confirm("Are you sure you want to close the streaming session?")) {
      window.close();
      window.location.href = "/";
    }
  }

  function reload() {
    window.location.reload();
  }

  const isLoading = status === OmniverseStreamStatus.waiting ||
                    status === OmniverseStreamStatus.connecting;
  const isError = status === OmniverseStreamStatus.error;

  return (
    <>
      {/* Header */}
      {!fullScreen && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 100 }}>
          <HeaderLocal />
          <Flex
            bg={"black.0"}
            p={"xs"}
            justify={"end"}
            gap={"xl"}
            style={{ borderTop: "1px solid #222" }}
          >
            <ActionIcon
              variant={"outline"}
              color={"gray"}
              size={"16"}
              title={"Toggle fullscreen"}
              onClick={() => void toggleFullScreen()}
            >
              {fullScreen ? <IconMinimize /> : <IconMaximize />}
            </ActionIcon>

            <ActionIcon
              variant={"outline"}
              color={"gray"}
              size={"16"}
              title={"Close"}
              onClick={() => void terminate()}
            >
              <IconX />
            </ActionIcon>
          </Flex>
        </div>
      )}

      {/* DS9 Overlay - UI components on top of the stream */}
      <Box
        style={{
          position: "absolute",
          inset: 0,
          top: fullScreen ? 0 : 100, // Account for header
          zIndex: 50,
          pointerEvents: state.activeConfigMode === "site" ? "auto" : "none"
        }}
      >
            <DS9OverlayLite />
      </Box>

      {/* Loading indicator */}
      {isLoading && (
        <div style={{ position: "absolute", inset: 0, zIndex: 200 }}>
          <StreamLoader />
        </div>
      )}

      {/* Error display */}
      {isError && (
        <div style={{ position: "absolute", inset: 0, zIndex: 200 }}>
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
 * Main LocalStream page
 * Structure: Video element first, then provider wraps the UI overlay
 */
export default function LocalStream() {
  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", background: "black" }}>
      {/* Video element MUST be rendered first and outside the provider */}
      <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
        <StreamVideo />
      </div>

      {/* Provider and UI overlay */}
      <OmniverseApiProvider>
        <LocalStreamUI />
      </OmniverseApiProvider>
    </div>
  );
}
