import { createContext, useContext } from "react";

export interface OVDSXStreamConfig {
  signalingServer?: string;
  signalingPath?: string;
  signalingPort?: number;
}

export interface OVDSXCatalogConfig {
  endpointsOrg?: string;
  kasPath?: string;
  captchaSiteKey?: string;
  id?: string;
  publisherName?: string;
  onClickGetAPIKey?: (...args: unknown[]) => unknown;
  nvcfFunctionId?: string;
  attributes?: Record<string, unknown>;
  spec?: Record<string, unknown>;
}

export interface OVDSXAppConfig {
  stream: OVDSXStreamConfig;
  catalog: OVDSXCatalogConfig;
}

const defaultConfig: OVDSXAppConfig = {
  stream: {},
  catalog: {},
};

export const OVDSXAppContext = createContext<OVDSXAppConfig>(defaultConfig);

export function useOVDSXAppConfig(): OVDSXAppConfig {
  return useContext(OVDSXAppContext);
}
