import { useEffect, useRef, useCallback } from "react";
import { Settings2Icon, MapPinIcon, GpuIcon, ZapIcon, Save } from "lucide-react";
import { useAuth } from "react-oidc-context";
import { Item, ItemContent, ItemMedia } from "@/components/ui/item";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ButtonGroup } from "@/components/ui/button-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";

import { useConfig } from "@/context/DS9Context";
import { Gpu, Country, Region, CONFIGURATOR_OPTIONS, Power, gpuDisplayMap, SITE_OPTIONS } from "@/data/options";
import { PREFERENCES_API_URL } from "@/config/api";
import { switchCamera, switchVisibility } from "@/streamMessages";
import { useSimulation } from "@/context/SimulationContext";
import site from "@/assets/site.png";

const GPU_PRIM_BASE = "/World/assembly_Bldg_Equipment/assembly_Bldg_Equipment/DSX_Bldg_Equipement/DS9_Z0S0_BLDG_EQUIPMENT/Assembly_HAC_GPU_BLDG_SR_Interactive";
const GPU_PRIM_MAP: Record<string, string> = {
    "GB200": `${GPU_PRIM_BASE}/hall_GPUs_GB200`,
    "GB300": `${GPU_PRIM_BASE}/hall_GPUs_GB300_standin`,
};
import SaveConfigDialog from "./configurator/SaveConfigDialog";
import IconButtonNative from "./IconButtonNative";
import SceneView from "@arcgis/core/views/SceneView";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import { useUI } from "@/context/UIContext";
import WebScene from "@arcgis/core/WebScene";

interface ChildProps {
    sceneView: SceneView | null;
    webScene: WebScene | null;
}

const ConfiguratorPanel = ({ sceneView, webScene }: ChildProps) => {
    // Site configurator state is now in context (allows AI Agent control)
    const {
        selectedGpu,
        setSelectedGpu,
        setSelectedSite,
        selectedPower,
        setSelectedPower,
        selectedCountry,
        setSelectedCountry,
        selectedRegion,
        setSelectedRegion
    } = useConfig();
    const { dispatch, state } = useUI();
    const { thermalIsRunning, setThermalIsRunning } = useSimulation();

    // When any Configurator tab is clicked, switch camera to data hall
    // and stop the thermal test if it was running.
    const handleConfigTabClick = (mode: "site" | "gpu" | "power") => {
        dispatch({ type: "SET_ACTIVE_CONFIG_MODE", activeConfigMode: mode });
        if (thermalIsRunning) {
            setThermalIsRunning(false);
            switchVisibility("/World/CFD_Layer/NV_DC_DS9_GB300_SinglePOD/CAE/IndeXVolume_Elements", false);
        }
        switchCamera("/World/interactive_cameras/camera_int_datahall_01");
    };

    // Handles when a user selects a GPU from the dropdown
    // Get authenticated user info for user_id
    // Use 'sub' (subject) from OIDC token - this is the stable unique identifier
    // that matches what the backend uses for user_id in the database
    const auth = useAuth();
    const userId = auth.user?.profile?.sub || 'anonymous';

    // Track previous values to detect changes from AI Agent
    const prevCountryRef = useRef<Country | null>(null);
    const prevRegionRef = useRef<Region | null>(null);

    // Load saved GPU preference on mount
    useEffect(() => {
        const loadSavedPreference = async () => {
            // Don't fetch if user is not authenticated
            if (userId === 'anonymous' || !auth.user?.id_token) return;

            try {
                const response = await fetch(`${PREFERENCES_API_URL}/${encodeURIComponent(userId)}`, {
                    headers: {
                        // Include id_token in Authorization header for explicit authentication
                        // Backend should validate this token and ensure user_id matches the token's 'sub' claim
                        // If backend doesn't support header auth yet, it will fall back to cookie-based auth
                        'Authorization': `Bearer ${auth.user.id_token}`,
                    },
                    credentials: 'include', // Ensure cookies (id_token) are sent as fallback
                });
                if (!response.ok) return;

                const data = await response.json();

                // If user has a saved GPU preference, apply it
                if (data.gpu_selection && gpuDisplayMap[data.gpu_selection]) {
                    const displayGpu = gpuDisplayMap[data.gpu_selection];
                    setSelectedGpu(displayGpu);
                    for (const [key, primPath] of Object.entries(GPU_PRIM_MAP)) {
                        switchVisibility(primPath, key === data.gpu_selection);
                    }
                    console.info(`[ConfiguratorPanel] Loaded saved GPU preference: ${data.gpu_selection} for user ${userId}`);
                }
            } catch (error) {
                console.error('[ConfiguratorPanel] Failed to load GPU preference:', error);
            }
        };

        loadSavedPreference();
    }, [userId, setSelectedGpu, auth.user?.id_token]);

    const handleGpuSelect = async (gpu: Gpu) => {
        setSelectedGpu(gpu);

        const variantMap: Record<Gpu, string> = {
            "NVIDIA GB200": "GB200",
            "NVIDIA GB300": "GB300"
        };

        const variant = variantMap[gpu];
        if (!variant) return;

        for (const [key, primPath] of Object.entries(GPU_PRIM_MAP)) {
            switchVisibility(primPath, key === variant);
        }

        // Don't save preference if user is not authenticated
        if (userId === 'anonymous' || !auth.user?.id_token) return;

        // Save GPU preference to backend for persistence
        // SECURITY NOTE: The backend MUST verify that the user_id in the request body
        // matches the authenticated user from the token (either from cookies or Authorization header).
        // This prevents unauthorized users from modifying other users' preferences.
        try {
            await fetch(PREFERENCES_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Include id_token in Authorization header for explicit authentication
                    // Backend should validate this token and ensure user_id matches the token's 'sub' claim
                    // If backend doesn't support header auth yet, it will fall back to cookie-based auth
                    'Authorization': `Bearer ${auth.user.id_token}`,
                },
                credentials: 'include', // Ensure cookies (id_token) are sent as fallback
                body: JSON.stringify({
                    user_id: userId,
                    gpu_selection: variant
                }),
            });
            console.info(`[ConfiguratorPanel] GPU preference saved: ${variant} for user ${userId}`);
        } catch (error) {
            console.error('[ConfiguratorPanel] Failed to save GPU preference:', error);
        }
    }

    const handlePowerSelect = async (power: Power) => {
        setSelectedPower(power);

        // Don't save preference if user is not authenticated
        if (userId === 'anonymous' || !auth.user?.id_token) return;

        // Save power preference to backend to notify AI Agent of manual change
        try {
            await fetch(PREFERENCES_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${auth.user.id_token}`,
                },
                credentials: 'include',
                body: JSON.stringify({
                    user_id: userId,
                    power_source: power
                }),
            });
            console.info(`[ConfiguratorPanel] Power preference saved: ${power} for user ${userId}`);
        } catch (error) {
            console.error('[ConfiguratorPanel] Failed to save power preference:', error);
        }
    };

    // Handles when a user selects a country
    // Note: Only updates context state. The useEffect handles side effects (zoom, analytics toggle)
    // This ensures consistent behavior whether the change comes from user interaction or AI Agent.
    const handleCountrySelect = async (country: Country) => {
        setSelectedCountry(country);
        if (country !== "Sweden") {
            // For United States, reset region
            setSelectedRegion(null);
        }

        // Don't save preference if user is not authenticated
        if (userId === 'anonymous' || !auth.user?.id_token) return;

        // Save country preference to backend to notify AI Agent of manual change
        try {
            await fetch(PREFERENCES_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${auth.user.id_token}`,
                },
                credentials: 'include',
                body: JSON.stringify({
                    user_id: userId,
                    site_country: country,
                    // Always include site_region in payload for consistency
                    // Set to null when country changes (region will be set separately if needed)
                    site_region: null
                }),
            });
            console.info(`[ConfiguratorPanel] Country preference saved: ${country} for user ${userId}`);
        } catch (error) {
            console.error('[ConfiguratorPanel] Failed to save country preference:', error);
        }
    }

    // Handles when a user selects a region
    // Note: Only updates context state. The useEffect handles side effects (zoom, analytics toggle)
    const handleRegionSelect = async (region: Region) => {
        setSelectedRegion(region);

        // Don't save preference if user is not authenticated
        if (userId === 'anonymous' || !auth.user?.id_token) return;

        // Save region preference to backend to notify AI Agent of manual change
        try {
            await fetch(PREFERENCES_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${auth.user.id_token}`,
                },
                credentials: 'include',
                body: JSON.stringify({
                    user_id: userId,
                    site_region: region
                }),
            });
            console.info(`[ConfiguratorPanel] Region preference saved: ${region} for user ${userId}`);
        } catch (error) {
            console.error('[ConfiguratorPanel] Failed to save region preference:', error);
            alert("We couldn't save your region preference. Please try again.");
        }
    }

    // Zooms to the selected site on the map
    const zoomToSite = useCallback(async (site: Country | Region) => {
        if (!sceneView || !webScene) {
            console.warn("View or scene is not ready yet.");
            return;
        }

        // Get sites layer. Title must correspond to the layer name in the web scene.
        const sitesLayer = webScene.layers.find(layer => layer.title === "AiFDT Sites") as FeatureLayer;

        if (!sitesLayer) {
            console.error("Sites layer not found in the web scene.");
            return;
        }

        // When the sites layer is loaded, zoom to selected site
        sceneView.whenLayerView(sitesLayer).then(() => {
            let query = sitesLayer.createQuery();

            // Prevent SQL injection in ArcGIS FeatureLayer query by escaping single quotes
            const selectedSite = site.replace(/'/g, "''");
            query.where = `Location = '${selectedSite}'`;

            sitesLayer.queryExtent(query).then((result) => {
                const extent = result.extent;

                sceneView.goTo({
                    // Zoom further out from the feature extent
                    target: extent.expand(10),
                    // Start in 2D
                    tilt: 0,
                    // Point north
                    heading: 0
                });
            });
        });
    }, [sceneView, webScene]);

    // Zooms to the specified coordinates and zoom level on the map
    const zoomToCoords = useCallback((longitude: number, latitude: number, zoom: number) => {
        if (!sceneView) {
            console.log("View is not ready yet.")
            return;
        }

        sceneView.goTo({
            center: [longitude, latitude],
            zoom: zoom,
            heading: 0
        });
    }, [sceneView]);

    // Effect to handle site changes (from user interaction or AI Agent via context state)
    // This centralizes all side effects (zoom, analytics panel toggle, selectedSite update)
    // to ensure consistent behavior regardless of how the change was triggered.
    useEffect(() => {
        // Check for changes using current ref values (before updating)
        const countryChanged = prevCountryRef.current !== selectedCountry;
        const regionChanged = prevRegionRef.current !== selectedRegion;

        // Skip side effects on initial render when both are still null
        // But still update refs at the end to track current state
        const isInitialRender = prevCountryRef.current === null && selectedCountry === null;

        if (!isInitialRender) {
            // Handle country change
            if (countryChanged && selectedCountry) {
                if (selectedCountry === "Sweden") {
                    // Sweden is a complete site selection (no region needed)
                    setSelectedSite(selectedCountry);
                    zoomToSite(selectedCountry);
                    // Show Analytics panel for complete site selection
                    if (!state.analytics) {
                        dispatch({ type: "TOGGLE_ANALYTICS" });
                    }
                } else if (selectedCountry === "United States") {
                    // For US, check if we also have a region (could be set simultaneously by AI)
                    if (selectedRegion) {
                        // Region is already set, treat as complete site selection
                        setSelectedSite(selectedRegion);
                        zoomToSite(selectedRegion);
                        if (!state.analytics) {
                            dispatch({ type: "TOGGLE_ANALYTICS" });
                        }
                    } else {
                        // No region yet - incomplete site selection
                        setSelectedSite(null);
                        // Hide Analytics panel for incomplete site selection
                        if (state.analytics) {
                            dispatch({ type: "TOGGLE_ANALYTICS" });
                        }
                        // Zoom to center of US
                        zoomToCoords(-98.5795, 39.8282, 5);
                    }
                }
            }
            // Handle country cleared
            else if (countryChanged && !selectedCountry) {
                setSelectedSite(null);
                if (state.analytics) {
                    dispatch({ type: "TOGGLE_ANALYTICS" });
                }
            }

            // Handle region change (only when country hasn't changed - if both changed, handled above)
            if (regionChanged && !countryChanged && selectedRegion && selectedCountry === "United States") {
                setSelectedSite(selectedRegion);
                zoomToSite(selectedRegion);
                // Show Analytics panel for complete site selection
                if (!state.analytics) {
                    dispatch({ type: "TOGGLE_ANALYTICS" });
                }
            }
        }

        // Always update refs at the end to track current state
        // This ensures refs are updated even on initial render when both are null
        prevCountryRef.current = selectedCountry;
        prevRegionRef.current = selectedRegion;
    }, [selectedCountry, selectedRegion, setSelectedSite, state.analytics, zoomToCoords, zoomToSite, sceneView, webScene]);

    return (
        <Item className="w-full bg-panel flex items-start h-[210px] pointer-events-auto">
            <Dialog>
                <div className="p-3 bg-panel-title rounded-lg">
                    <Settings2Icon />
                    <span className="text-lg text-white font-semibold tracking-wide [writing-mode:vertical-rl] rotate-180 mx-2">
                        Configurator
                    </span>
                </div>
                <ItemMedia />
                <ItemContent className="h-full">
                    <Tabs value={state.activeConfigMode}>
                        {/* CONFIGURATOR PANEL TABS */}
                        <div className="inline-flex gap-4 justify-between">
                            <TabsList className="w-full">
                                {/* Site configurator has a map background and the GPU and Power Configurator have a stream background */}
                                <TabsTrigger value="site" onClick={() => handleConfigTabClick("site")}><MapPinIcon className="text-[#76B900]" />Site</TabsTrigger>
                                <TabsTrigger value="gpu" onClick={() => handleConfigTabClick("gpu")}><GpuIcon className="text-[#76B900]" />GPU</TabsTrigger>
                                <TabsTrigger value="power" onClick={() => handleConfigTabClick("power")}><ZapIcon className="text-[#76B900]" />Power</TabsTrigger>
                            </TabsList>
                            <ButtonGroup>
                                {/* SAVE CONFIGURATION BUTTON */}
                                <DialogTrigger asChild>
                                    <IconButtonNative icon={Save} size={18}></IconButtonNative>
                                </DialogTrigger>
                            </ButtonGroup>
                        </div>
                        {/* LOCATION CONFIGURATOR */}
                        <TabsContent value="site">
                            <div className="flex gap-5 mt-10">
                                {/* Country Selector */}
                                <Select
                                    value={selectedCountry ?? ""}
                                    onValueChange={(country: Country) => handleCountrySelect(country)}
                                >
                                    <SelectTrigger className="w-[50%]">
                                        <SelectValue placeholder="Country" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.keys(SITE_OPTIONS).map(option => {
                                            return <SelectItem key={option} value={option}>{option}</SelectItem>
                                        })}
                                    </SelectContent>
                                </Select>
                                {/* State/Region Selector */}
                                {selectedCountry && selectedCountry !== "Sweden" && <Select
                                    value={selectedRegion ?? ""}
                                    onValueChange={(region: Region) => handleRegionSelect(region)}
                                >
                                    <SelectTrigger className="w-[50%]">
                                        <SelectValue placeholder="State/Region" />
                                    </SelectTrigger>
                                        <SelectContent>
                                            {SITE_OPTIONS[selectedCountry].map(option => {
                                                return <SelectItem key={option} value={option}>{option}</SelectItem>
                                            })}
                                        </SelectContent>
                                </Select>
                                }
                            </div>
                        </TabsContent>
                        {/* GPU CONFIGURATOR */}
                        <TabsContent value="gpu">
                            <div className="flex justify-between items-center ml-8">
                                <Select
                                    value={selectedGpu ?? ""}
                                    onValueChange={(gpu: Gpu) => handleGpuSelect(gpu)}
                                >
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CONFIGURATOR_OPTIONS.gpuOptions.map(option => {
                                            return <SelectItem key={option} value={option}>{option}</SelectItem>
                                        })}
                                    </SelectContent>
                                </Select>
                                <img style={{ "marginLeft": "12px", width: "auto" }} src={site} />
                            </div>
                        </TabsContent>
                        {/* POWER CONFIGURATOR */}
                        <TabsContent value="power">
                            <div className="flex justify-between items-center ml-8">
                                <Select
                                    value={selectedPower ?? ""}
                                    onValueChange={(power: Power) => handlePowerSelect(power)}
                                >
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CONFIGURATOR_OPTIONS.powerOptions.map(option => {
                                            return <SelectItem key={option} value={option}>{option}</SelectItem>
                                        })}
                                    </SelectContent>
                                </Select>
                                <img style={{ "marginLeft": "12px", width: "auto" }} src={site} />
                            </div>
                        </TabsContent>
                    </Tabs>
                </ItemContent>
                <SaveConfigDialog />
            </Dialog>
        </Item>
    )
}

export default ConfiguratorPanel;