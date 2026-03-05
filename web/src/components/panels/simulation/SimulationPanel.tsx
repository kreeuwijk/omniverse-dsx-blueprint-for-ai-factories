import { useEffect, useRef } from "react"
import { Item, ItemMedia, ItemContent, ItemActions } from "../../ui/item"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../ui/tabs"
import { Label } from "../../ui/label"
import { Button } from "../../ui/button"
import { ZapIcon, SquareActivityIcon, ThermometerIcon } from "lucide-react"
import { SIMULATION_OPTIONS } from "@/data/options"
import { useSimulation, SimulationPanel as SimulationPanelType } from "@/context/SimulationContext"
import { useUI } from "@/context/UIContext"
import { useSavePreference } from "@/hooks/useSavePreference"
import { switchCamera, switchVisibility, setPrimAttribute, syncAgentState } from "@/streamMessages"
import SimulationPic from "./simulation.png"
import PowerFailureTest from "./PowerFailureTest"


// The Simulation Panel component provides a user interface for selecting and configuring different types of simulations, such as thermal and electrical simulations.
// It allows users to choose specific zones, operations, and variables related to the selected simulation type.
// The panel is turned off by default and can be toggled on via the toolbar.
// State is now managed via SimulationContext to allow AI Agent control.

// ─── Thermal CFD Constants ──────────────────────────────────────────────────
const CFD_CAMERA_PATH = "/World/interactive_cameras/cfd_camera"
const CFD_LAYER_PATH = "/World/CFD_Layer/NV_DC_DS9_GB300_SinglePOD/CAE/IndeXVolume_Elements"
const LOAD_LEVEL_PRIM = "/World/CFD_Layer/NV_DC_DS9_GB300_SinglePOD/CAE/IndeXVolume_Elements/Materials/DCDTMaterial/VolumeShader"
const LOAD_LEVEL_ATTR = "inputs:load_level"

// ─── Electrical Constants ───────────────────────────────────────────────────
const RPP_CAMERA_PATH = "/World/interactive_cameras/rpp_cameras"
const DEFAULT_CAMERA_PATH = "/World/interactive_cameras/camera_int_datahall_01"

const SimulationPanel = () => {
    // Get simulation state from context (allows AI Agent to control these values)
    const {
        activeSimulationTab,
        setActiveSimulationTab,
        thermalZone,
        thermalVariable,
        thermalHeatLoad,
        setThermalHeatLoad,
        thermalIsRunning,
        setThermalIsRunning,
    } = useSimulation()

    // UI context — controls whether the globe or USD stream is visible
    const { state, dispatch } = useUI();

    // Track savedCamera via ref so the unmount cleanup always has the latest value
    const savedCameraRef = useRef(state.savedCamera);
    useEffect(() => { savedCameraRef.current = state.savedCamera; });

    // On unmount, restore the user's previously selected camera
    useEffect(() => {
        return () => {
            const cam = savedCameraRef.current;
            if (cam) {
                switchCamera(`/World/interactive_cameras/${cam}`);
            }
        };
    }, []);

    // Custom hook for saving preferences (handles authentication and API calls)
    const savePreference = useSavePreference();

    useEffect(() => {
        if (activeSimulationTab === 'thermal' && thermalZone === 'Data Hall') {
            dispatch({ type: "SET_ACTIVE_CONFIG_MODE", activeConfigMode: "gpu" });
            switchCamera(CFD_CAMERA_PATH);
        } else if (activeSimulationTab === 'electrical') {
            dispatch({ type: "SET_ACTIVE_CONFIG_MODE", activeConfigMode: "gpu" });
            switchCamera(RPP_CAMERA_PATH);
        } else {
            if (thermalIsRunning) {
                setThermalIsRunning(false);
                switchVisibility(CFD_LAYER_PATH, false);
            }
            switchCamera(DEFAULT_CAMERA_PATH);
        }
    }, [activeSimulationTab, thermalZone, dispatch]);

    // Sync simulation state to agent backend so it stays aware of UI changes
    useEffect(() => {
        syncAgentState({
            active_simulation: activeSimulationTab,
            thermal_is_running: thermalIsRunning,
            thermal_zone: thermalZone,
            thermal_variable: thermalVariable,
        });
    }, [activeSimulationTab, thermalIsRunning, thermalZone, thermalVariable]);

    // Handler for simulation tab change
    const handleSimulationTabChange = (tab: SimulationPanelType) => {
        setActiveSimulationTab(tab);
        savePreference({ simulation_tab: tab });
    };

    // Real-time slider handler — sends attribute update on every tick
    const handleThermalHeatLoadChange = (value: number) => {
        setThermalHeatLoad(value);
        setPrimAttribute(LOAD_LEVEL_PRIM, LOAD_LEVEL_ATTR, value);
        syncAgentState({ heat_load: value });
    };

    // Start/Stop handler — toggles visibility of /World/CFD_Layer
    const handleThermalStartStop = (running: boolean) => {
        setThermalIsRunning(running);
        switchVisibility(CFD_LAYER_PATH, running);
    };

    return (
        <Item className="w-full bg-panel flex items-start min-h-[260px] h-auto pointer-events-auto">
            <div className='p-3 bg-panel-title rounded-lg'>
                <SquareActivityIcon />
                <span className='text-lg text-white font-semibold tracking-wide [writing-mode:vertical-rl] rotate-180 mx-2'>
                    Simulations
                </span>
            </div>
            <ItemMedia />
            <ItemContent className='h-full'>
                <Tabs value={activeSimulationTab} onValueChange={(value) => handleSimulationTabChange(value as SimulationPanelType)}>
                    <div className='inline-flex gap-4 justify-between'>
                        <TabsList className='w-full'>
                            <TabsTrigger value='thermal'><ThermometerIcon className="text-[#76B900]" />Thermal</TabsTrigger>
                            <TabsTrigger value='electrical'><ZapIcon className="text-[#76B900]" />Electrical</TabsTrigger>
                        </TabsList>
                    </div>
                    {/* Thermal Tab Content*/}
                    <TabsContent value='thermal'>
                        {/* Heat Load Slider */}
                        <div className="flex items-center gap-3 mt-4">
                            <Label className="shrink-0 mb-0">Heat Load</Label>
                            <input
                                type="range"
                                min={40}
                                max={100}
                                value={thermalHeatLoad}
                                onChange={(e) => handleThermalHeatLoadChange(Number(e.target.value))}
                                className="flex-1 h-1.5 accent-primary cursor-pointer"
                            />
                            <span className="text-sm w-[40px] text-right tabular-nums">{thermalHeatLoad}%</span>
                        </div>
                        {/* Start / Stop Button */}
                        <div className="flex justify-center mt-4">
                            {!thermalIsRunning ? (
                                <Button size="sm" variant="outline" onClick={() => handleThermalStartStop(true)}>
                                    Begin Test
                                </Button>
                            ) : (
                                <Button size="sm" variant="destructive" onClick={() => handleThermalStartStop(false)}>
                                    Stop Test
                                </Button>
                            )}
                        </div>
                        <div className="flex justify-between items-center mt-4 font-bold">
                            <span>{SIMULATION_OPTIONS.thermal.variables[thermalVariable].start}</span>
                            <span>{SIMULATION_OPTIONS.thermal.variables[thermalVariable].end}</span>
                        </div>
                        <img className="w-full h-[24px]" src={SimulationPic} />
                    </TabsContent>
                    {/* Electrical Tab Content — Power Failure Test */}
                    <TabsContent value='electrical'>
                        <PowerFailureTest />
                    </TabsContent>
                </Tabs>
            </ItemContent>
            <ItemActions />
        </Item>
    )
}

export default SimulationPanel