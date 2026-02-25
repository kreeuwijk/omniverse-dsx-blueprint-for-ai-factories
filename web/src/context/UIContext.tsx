import React, { createContext, useContext, useReducer } from "react";

// The different configurator modes a user can toggle between
export type ConfigMode = "site" | "gpu" | "power";

// Valid camera names for the 3D scene
export type CameraName = 
  | 'camera_int_datahall_01'
  | 'camera_int_datahall_02'
  | 'camera_int_datahall_03'
  | 'camera_int_datahall_04'
  | 'camera_ext_default_01'
  | 'camera_ext_default_02'
  | 'camera_ext_default_03'
  | 'camera_ext_default_04'
  | 'cfd_camera';

type UIState = {
  // Visibility states for UI panels
  configurator: boolean;
  analytics: boolean;
  simulations: boolean;
  viewer: boolean;
  agent: boolean;

  // Current active camera in the 3D scene
  activeCamera: CameraName;

  // Active tab on configurator panel
  activeConfigMode: ConfigMode;
};

export type Action =
  | { type: "TOGGLE_CONFIGURATOR" }
  | { type: "TOGGLE_ANALYTICS" }
  | { type: "TOGGLE_SIMULATIONS" }
  | { type: "TOGGLE_VIEWER" }
  | { type: "TOGGLE_AGENT" }
  | { type: "SET_ACTIVE_CAMERA"; camera: CameraName }
  | { type: "SET_ACTIVE_CONFIG_MODE"; activeConfigMode: ConfigMode}

const initialUIState: UIState = {
  configurator: true,
  analytics: false,
  simulations: false,
  viewer: false,
  agent: false,
  activeCamera: 'camera_int_datahall_01',
  activeConfigMode: "site" // default to site configurator
};

function uiReducer(state: UIState, action: Action): UIState {
  switch (action.type) {
    case "TOGGLE_VIEWER":
      if (!state.viewer) {
        return {
          configurator: false,
          analytics: false,
          simulations: false,
          viewer: true,
          agent: state.agent,
          activeCamera: state.activeCamera,
          // If a user is on the site configurator, it will switch to the gpu configurator. Otherwise, it will keep the active configurator mode.
          activeConfigMode: state.activeConfigMode === "site" ? "gpu" : state.activeConfigMode
        };
      }
      return { ...initialUIState, agent: state.agent, activeCamera: state.activeCamera };

    case "TOGGLE_CONFIGURATOR":
      if (state.viewer) return { ...initialUIState, configurator: true, agent: state.agent, activeCamera: state.activeCamera };
      if (state.simulations)
        return { ...state, configurator: !state.configurator, simulations: false };
      return { ...state, configurator: !state.configurator };

    case "TOGGLE_ANALYTICS":
      if (state.viewer) return { ...initialUIState, analytics: true, agent: state.agent, activeCamera: state.activeCamera };
      return { ...state, analytics: !state.analytics };

    case "TOGGLE_SIMULATIONS":
      if (state.viewer) return { ...initialUIState, simulations: true, agent: state.agent, activeCamera: state.activeCamera };

      if (!state.simulations) {
        return {
          ...state,
          simulations: true,
          configurator: false,
        };
      }
      return { ...state, simulations: false };

    case "TOGGLE_AGENT":
      return { ...state, agent: !state.agent };

    case "SET_ACTIVE_CAMERA":
      return { ...state, activeCamera: action.camera };

    case "SET_ACTIVE_CONFIG_MODE":
      return { ...state, activeConfigMode: action.activeConfigMode };

    default:
      return state;
  }
}

type UIContextType = {
  state: UIState;
  dispatch: React.Dispatch<Action>;
};

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(uiReducer, initialUIState);

  return (
    <UIContext.Provider value={{ state, dispatch }}>
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) throw new Error("useUI must be used within UIProvider");
  return context;
};