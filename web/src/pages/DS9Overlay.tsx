import Toolbar from "@/components/toolbar/Toolbar";
import ConfiguratorPanel from "@/components/panels/ConfiguratorPanel";
import AnalyticsPanel from "@/components/panels/AnalyticsPanel";
import AgentPanel from "@/components/panels/AgentPanel";
import { useUI } from "@/context/UIContext";
import ViewConfigsModal from "@/components/modals/ViewConfigsModal";
import SimulationPanel from "@/components/panels/simulation/SimulationPanel";
import Map from "@/components/map/Map";
import { useState } from "react";
import SceneView from "@arcgis/core/views/SceneView";
import WebScene from "@arcgis/core/WebScene";

const DS9Overlay = () => {
    const { state } = useUI();
    const [sceneView, setSceneView] = useState<SceneView | null>(null);
    const [webScene, setWebScene] = useState<WebScene | null>(null);

    return (
        <div>
            <Toolbar />
            {/* Right-side panels */}
            <div className="absolute p-8 gap-8 right-0 z-40 w-[544px] flex flex-col h-full">
                {state.configurator && <ConfiguratorPanel sceneView={sceneView} webScene={webScene}></ConfiguratorPanel>}
                {state.simulations && <SimulationPanel></SimulationPanel>}
                {state.analytics && <AnalyticsPanel></AnalyticsPanel>}
            </div>
            {/* Left-side Agent panel - positioned next to toolbar */}
            <div className="absolute py-8 z-50 left-[128px] flex flex-col max-h-[70vh]">
                <AgentPanel />
            </div>
            <ViewConfigsModal />
            {/* Map that only shows when Site Configurator is active */}
            <div className={` ${state.activeConfigMode === "site" ? "block" : "hidden" }`}>
                <Map setSceneView={setSceneView} setWebScene={setWebScene}/>
            </div>
        </div>
    )
}

export default DS9Overlay;