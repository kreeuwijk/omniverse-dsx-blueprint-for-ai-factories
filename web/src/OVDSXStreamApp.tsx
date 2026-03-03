/**
 * Standalone streaming app component for local Kit streaming.
 * Used by main.tsx as a reusable component
 * that can be rendered by library consumers.
 *
 * Bypasses OIDC authentication and NVCF — connects directly to a local
 * Kit application via WebRTC.
 */

import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";

import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DS9ConfigProvider } from "./context/DS9Context";
import { SimulationProvider } from "./context/SimulationContext";
import { ThemeProvider } from "./components/theme/ThemeProvider";
import { UIProvider } from "./context/UIContext";
import { MockAuthProvider } from "./providers/MockAuthProvider";
import { OVDSXAppContext, OVDSXStreamConfig } from "./context/OVDSXAppContext";
import LocalStream from "./pages/LocalStream";
import "./index.css";

import("@arcgis/core/assets/esri/themes/dark/main.css").catch(() => {
  console.warn("ArcGIS styles not loaded");
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
    },
  },
});

export interface OVDSXStreamAppProps extends OVDSXStreamConfig {}

export function OVDSXStreamApp(props: OVDSXStreamAppProps) {
  const stream: OVDSXStreamConfig = {
    signalingServer: props.signalingServer,
    signalingPath: props.signalingPath,
    signalingPort: props.signalingPort,
  };

  return (
    <OVDSXAppContext.Provider value={{ stream, catalog: {} }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
          <MantineProvider forceColorScheme={"dark"}>
            <MockAuthProvider>
              <DS9ConfigProvider>
                <SimulationProvider>
                  <UIProvider>
                    <LocalStream />
                  </UIProvider>
                </SimulationProvider>
              </DS9ConfigProvider>
            </MockAuthProvider>
            <Notifications />
          </MantineProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </OVDSXAppContext.Provider>
  );
}
