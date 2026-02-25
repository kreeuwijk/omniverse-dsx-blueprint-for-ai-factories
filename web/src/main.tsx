import { MantineProvider } from "@mantine/core";

// **
// ------ THIS IMPORTS MANTIME GLOBAL CSS. KEEP TO SEE MANTINE COMPONENTS PROPERLY OR COMMENT OUT FOR UI MIGRATION WORK. ------
import "@mantine/core/styles.css";
// **

import "@mantine/notifications/styles.css";
import "@arcgis/core/assets/esri/themes/dark/main.css";
import "./nucleus";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import ConfigProvider from "./providers/ConfigProvider";
import { DS9ConfigProvider } from "./context/DS9Context";
import { SimulationProvider } from "./context/SimulationContext";
import { router } from "./router";
import { HttpError } from "./util/Errors";
import "./index.css"
import { ThemeProvider } from "./components/theme/ThemeProvider";
import { UIProvider } from "./context/UIContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: Error) => {
        if (failureCount >= 5 && error instanceof HttpError) {
          if (error.status === 401) {
            window.location.href = "/login";
            return false;
          }
        }

        return failureCount < 5;
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <MantineProvider forceColorScheme={"dark"}>
        <ConfigProvider>
          <DS9ConfigProvider>
            <SimulationProvider>
              <UIProvider>
                <RouterProvider router={router} />
              </UIProvider>
            </SimulationProvider>
          </DS9ConfigProvider>
        </ConfigProvider>
        <Notifications />
      </MantineProvider>
    </ThemeProvider>
  </QueryClientProvider>,
);
