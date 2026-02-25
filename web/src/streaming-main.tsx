/**
 * Standalone entry point for local Kit streaming with full DS9 UI
 * This bypasses OIDC authentication and NVCF for local development
 *
 * Access via: http://localhost:8081/
 */

import { MantineProvider } from "@mantine/core";

// Mantine styles
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";

// Note: ArcGIS styles loaded lazily to avoid blocking render
// import "@arcgis/core/assets/esri/themes/dark/main.css";

import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ReactDOM from "react-dom/client";
import { DS9ConfigProvider } from "./context/DS9Context";
import { SimulationProvider } from "./context/SimulationContext";
import { ThemeProvider } from "./components/theme/ThemeProvider";
import { UIProvider } from "./context/UIContext";
import { MockAuthProvider } from "./providers/MockAuthProvider";
import LocalStream from "./pages/LocalStream";
import "./index.css";

// Load ArcGIS styles asynchronously (don't block render)
import("@arcgis/core/assets/esri/themes/dark/main.css").catch(() => {
  console.warn("ArcGIS styles not loaded");
});

// Query client for data fetching (simplified, no auth redirect)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
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
);
