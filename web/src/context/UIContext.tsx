import React, { createContext, useContext, useMemo, useReducer, Dispatch } from "react";

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

// ---- State types ----

interface PanelState {
  configurator: boolean;
  analytics: boolean;
  simulations: boolean;
  viewer: boolean;
  agent: boolean;
}

interface ViewState {
  activeCamera: CameraName;
  activeConfigMode: ConfigMode;
}

type UIState = PanelState & ViewState;

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

// ---- Two separate contexts ----

const PanelContext = createContext<{ state: PanelState; dispatch: Dispatch<Action> } | undefined>(undefined);
const ViewContext = createContext<{ state: ViewState; dispatch: Dispatch<Action> } | undefined>(undefined);

// ---- Single provider that wraps both ----

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(uiReducer, initialUIState);

  const panelValue = useMemo(() => ({
    state: {
      configurator: state.configurator,
      analytics: state.analytics,
      simulations: state.simulations,
      viewer: state.viewer,
      agent: state.agent,
    },
    dispatch,
  }), [state.configurator, state.analytics, state.simulations, state.viewer, state.agent, dispatch]);

  const viewValue = useMemo(() => ({
    state: {
      activeCamera: state.activeCamera,
      activeConfigMode: state.activeConfigMode,
    },
    dispatch,
  }), [state.activeCamera, state.activeConfigMode, dispatch]);

  return (
    <PanelContext.Provider value={panelValue}>
      <ViewContext.Provider value={viewValue}>
        {children}
      </ViewContext.Provider>
    </PanelContext.Provider>
  );
};

// ---- Granular hooks ----

export const usePanels = () => {
  const context = useContext(PanelContext);
  if (!context) throw new Error("usePanels must be used within UIProvider");
  return context;
};

export const useView = () => {
  const context = useContext(ViewContext);
  if (!context) throw new Error("useView must be used within UIProvider");
  return context;
};

// ---- Backward-compatible hook ----

export const useUI = () => {
  const panels = usePanels();
  const view = useView();
  return {
    state: { ...panels.state, ...view.state },
    dispatch: panels.dispatch, // same dispatch instance
  };
};
