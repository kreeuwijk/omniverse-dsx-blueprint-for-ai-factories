/**
 * DS9OverlayLite - Lightweight version of DS9 overlay for local streaming
 * Lazy loads heavy components like ArcGIS Map
 */

import { lazy, Suspense, useState } from "react";
import Toolbar from "@/components/toolbar/Toolbar";
import { useUI } from "@/context/UIContext";
import SceneView from "@arcgis/core/views/SceneView";
import WebScene from "@arcgis/core/WebScene";

// Lazy load heavy components
const ConfiguratorPanel = lazy(() => import("@/components/panels/ConfiguratorPanel"));
const AnalyticsPanel = lazy(() => import("@/components/panels/AnalyticsPanel"));
const AgentPanel = lazy(() => import("@/components/panels/AgentPanel"));
const SimulationPanel = lazy(() => import("@/components/panels/simulation/SimulationPanel"));
const ViewConfigsModal = lazy(() => import("@/components/modals/ViewConfigsModal"));
const Map = lazy(() => import("@/components/map/Map"));

// Placeholder for loading state
const PanelLoader = () => (
  <div className="flex items-center justify-center p-4 text-gray-400">
    Loading...
  </div>
);

// Map loading placeholder
const MapLoader = () => (
  <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-gray-400">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto mb-4"></div>
      <p>Loading Map...</p>
    </div>
  </div>
);

const DS9OverlayLite = () => {
  const { state } = useUI();
  const [sceneView, setSceneView] = useState<SceneView | null>(null);
  const [webScene, setWebScene] = useState<WebScene | null>(null);

  return (
    <div>
      <Toolbar />

      {/* Right-side panels */}
      <div className="absolute p-8 gap-8 right-0 z-40 w-[544px] flex flex-col h-full">
        <Suspense fallback={<PanelLoader />}>
          {state.configurator && <ConfiguratorPanel sceneView={sceneView} webScene={webScene} />}
          {state.simulations && <SimulationPanel />}
          {state.analytics && <AnalyticsPanel />}
        </Suspense>
      </div>

      {/* Left-side Agent panel */}
      <div className="absolute py-8 z-50 left-[128px] flex flex-col max-h-[70vh]">
        <Suspense fallback={<PanelLoader />}>
          <AgentPanel />
        </Suspense>
      </div>

      <Suspense fallback={null}>
        <ViewConfigsModal />
      </Suspense>

      {/* Map stays mounted so sceneView/webScene refs remain available for ConfiguratorPanel */}
      <div className={state.activeConfigMode === "site" ? "block" : "hidden"}>
        <Suspense fallback={<MapLoader />}>
          <Map setSceneView={setSceneView} setWebScene={setWebScene} />
        </Suspense>
      </div>
    </div>
  );
};

export default DS9OverlayLite;
