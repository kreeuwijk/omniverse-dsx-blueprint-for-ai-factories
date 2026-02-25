/**
 * useOmniverseApi hook - Access the OmniverseAPI context for direct Kit communication
 */

import { createContext, useContext } from "react";
import { OmniverseAPI, OmniverseStreamStatus } from "@/lib/OmniverseApi";

interface IOmniverseApiContext {
  api?: OmniverseAPI;
  status: OmniverseStreamStatus;
}

export const OmniverseApiContext = createContext<IOmniverseApiContext | undefined>(
  undefined
);

/**
 * Hook to access the OmniverseAPI context.
 * Must be used within an OmniverseApiProvider.
 *
 * @returns The OmniverseAPI context containing the api instance and connection status
 * @throws Error if used outside of OmniverseApiProvider
 *
 * @example
 * ```tsx
 * const { api, status } = useOmniverseApi();
 *
 * if (status === OmniverseStreamStatus.connected && api) {
 *   const response = await api.request("my_handler", { param: "value" });
 * }
 * ```
 */
const useOmniverseApi = () => {
  const context = useContext(OmniverseApiContext);
  if (context === undefined) {
    throw new Error("useOmniverseApi must be used within OmniverseApiProvider");
  }
  return context;
};

export default useOmniverseApi;
