import ReactDOM from "react-dom/client";
import { useEffect, useState } from "react";
import { MantineProvider } from "@mantine/core";
import { OVDSXStreamApp } from "./OVDSXStreamApp";
import HeaderLocal from "./components/HeaderLocal";

const params = new URLSearchParams(window.location.search);

const querySignalingServer = params.get("signalingServer");
const querySignalingPath = params.get("signalingPath");
const querySignalingPort = params.get("signalingPort");

export default function App() {
  const [fullScreen, setFullScreen] = useState(false);

  useEffect(() => {
    const sync = () => setFullScreen(document.fullscreenElement != null);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  async function toggleFullScreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  }

  function terminate() {
    if (confirm("Are you sure you want to close the streaming session?")) {
      window.close();
      window.location.href = "/";
    }
  }

  return (
    <MantineProvider forceColorScheme="dark">
      <div style={{ width: "100vw", height: "100vh", background: "black", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {!fullScreen && (
          <div style={{ position: "relative", overflow: "hidden", zIndex: 100 }}>
            <HeaderLocal
              fullScreen={fullScreen}
              onToggleFullScreen={() => void toggleFullScreen()}
              onClose={() => void terminate()}
            />
          </div>
        )}
        <OVDSXStreamApp
          signalingServer={querySignalingServer || undefined}
          signalingPath={querySignalingPath || undefined}
          signalingPort={querySignalingPort ? Number(querySignalingPort) : undefined}
        />
      </div>
    </MantineProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
