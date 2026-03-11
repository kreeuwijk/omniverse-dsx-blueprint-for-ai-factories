/**
 * AgentPanel.tsx
 *
 * Main AI Assistant chat panel component for the Vertex Digital Twin application.
 * This panel allows users to interact with an AI agent that can:
 *   - Answer questions about the datacenter configuration
 *   - Execute actions like switching camera views in the 3D scene
 *
 * The panel communicates with a backend AI service and processes both
 * text responses (shown to user) and action commands (executed silently).
 *
 * Architecture:
 *   User Input → Backend AI API → Response + Actions
 *                                      ↓
 *                          Text displayed in chat
 *                          Actions executed via WebRTC
 */

import { useState } from 'react';
import { SparklesIcon, History, X } from 'lucide-react';
import { useAuth } from 'react-oidc-context';
import { useUI, CameraName } from '@/context/UIContext';
import {
  useConfig,
  VALID_COUNTRIES,
  VALID_POWER_SOURCES
} from '@/context/DS9Context';
import {
  useSimulation,
  SimulationPanel as SimulationPanelType,
  ThermalZone,
  ThermalOperation,
  ThermalVariable,
  ElectricalZone,
  ElectricalOperation,
  ElectricalVariable,
  EdpSetting,
  VALID_SIMULATION_PANELS,
  VALID_THERMAL_ZONES,
  VALID_THERMAL_OPERATIONS,
  VALID_THERMAL_VARIABLES,
  VALID_ELECTRICAL_ZONES,
  VALID_ELECTRICAL_OPERATIONS,
  VALID_ELECTRICAL_VARIABLES,
} from '@/context/SimulationContext';
import { gpuDisplayMap, Country, Region, Power, SITE_OPTIONS } from '@/data/options';
import { CHAT_API_URL, CHAT_STREAM_API_URL, PREFERENCES_API_URL } from '@/config/api';
import MessageList from './agent/MessageList';
import MessageInput from './agent/MessageInput';
import { ChatMessage } from './agent/ChatMessage';
import { switchCamera, switchVisibility, switchGpuVisibility, setPrimAttribute } from '@/streamMessages';

// ---------------------------------------------------------
// Configuration
// ---------------------------------------------------------

/**
 * List of valid camera names that the AI agent can switch to.
 * These must match the camera names defined in the Omniverse Kit scene.
 *
 * Interior cameras (datahall views):
 *   - camera_int_datahall_01: Inside the datahall looking down a row of deployment units
 *   - camera_int_datahall_02: Close-up of the racks and trays in a deployment unit
 *   - camera_int_datahall_03: View inside the Hot Aisle Containment showing cooling infrastructure
 *   - camera_int_datahall_04: View inside the Hot Aisle Containment showing power infrastructure
 *
 * Exterior cameras (default views):
 *   - camera_ext_default_01: Aerial view of entire campus from the front
 *   - camera_ext_default_02: View of the building from the back near power infrastructure yard
 *   - camera_ext_default_03: Aerial view of the cooling towers and CUB near the main building
 *   - camera_ext_default_04: View of the main building from the front entrance
 */
const VALID_CAMERA_NAMES: string[] = [
  '/World/interactive_cameras/camera_int_datahall_01',
  '/World/interactive_cameras/camera_int_datahall_02',
  '/World/interactive_cameras/camera_int_datahall_03',
  '/World/interactive_cameras/camera_int_datahall_04',
  '/World/interactive_cameras/camera_ext_default_01',
  '/World/interactive_cameras/camera_ext_default_02',
  '/World/interactive_cameras/camera_ext_default_03',
  '/World/interactive_cameras/camera_ext_default_04',
  '/World/interactive_cameras/cfd_camera',
  '/World/interactive_cameras/cdu_camera',
  '/World/interactive_cameras/networking_camera',
];

// ---------------------------------------------------------
// Types
// ---------------------------------------------------------

/**
 * Represents an action command returned by the AI Agent.
 * The agent can return multiple actions in a single response.
 *
 * Currently supported action types:
 *   - 'camera_change': Switch the 3D viewport to a different camera
 *   - 'gpu_change': Switch the GPU configuration (GB200 or GB300)
 *   - 'simulation_change': Change simulation panel settings (thermal/electrical)
 *   - 'site_change': Change the site configurator (country and optionally region)
 *   - 'power_change': Change the power source configuration
 *
 * @example
 * { type: 'camera_change', camera_name: 'camera_ext_default_01' }
 * { type: 'gpu_change', gpu_selection: 'GB200' }
 * { type: 'simulation_change', panel: 'thermal', zone: 'Data Hall', operation: 'Normal', variable: 'Temperature' }
 * { type: 'site_change', country: 'Sweden' }
 * { type: 'site_change', country: 'United States', region: 'Virginia' }
 * { type: 'power_change', power_source: 'Grid' }
 */
interface AgentAction {
  type: string;
  camera_name?: string;
  gpu_selection?: string;
  // Simulation change fields
  panel?: string;      // 'thermal' or 'electrical'
  zone?: string;       // Zone value (varies by panel)
  operation?: string;  // Operation value (varies by panel)
  variable?: string;   // Variable value (varies by panel)
  start_test?: boolean; // Start/stop thermal CFD test (same as "Begin Test" button)
  heat_load?: number;   // Thermal heat load percentage (40–100, same as slider)
  electrical_test?: {   // Electrical power failure test parameters
    playing?: boolean;
    failed_rpps?: number;
    load_percent?: number;
    edp_setting?: string;
  };
  // Per-RPP whip visibility
  rpp_visible?: Record<number, boolean>;
  // Isolation fields (isolate POD / restore)
  isolation?: {
    isolate?: boolean;
    hide?: string[];
    show?: string[];
  };
  // Site change fields
  country?: string;    // 'United States' or 'Sweden'
  region?: string;     // 'Virginia' or 'New Mexico' (only for United States)
  // Power change fields
  power_source?: string; // 'Grid', 'Hybrid', or 'On-Prem'
}

/**
 * Valid GPU selection values that the AI agent can use.
 * These must match the backend format (not the display format).
 */
const VALID_GPU_SELECTIONS = ['GB200', 'GB300'] as const;


// ---------------------------------------------------------
// Component
// ---------------------------------------------------------

/**
 * AgentPanel Component
 *
 * A floating chat panel that provides AI-powered assistance for the
 * datacenter visualization. Users can ask questions or give commands,
 * and the AI will respond with information or execute actions.
 *
 * State Management:
 *   - messages: Array of chat messages (user + assistant)
 *   - isLoading: True while waiting for AI response
 *   - Panel visibility controlled by UIContext (state.agent)
 *
 * @returns The chat panel UI, or null if panel is hidden
 */
const AgentPanel = () => {
  // Get UI state and dispatch from context
  const { state, dispatch } = useUI();
  const showAgent = state.agent;

  // Get config state for updating UI when AI changes GPU, site, or power
  const {
    setSelectedGpu,
    setSelectedCountry,
    setSelectedRegion,
    setSelectedPower,
  } = useConfig();

  // Get simulation state for updating UI when AI changes simulation settings
  const {
    activeSimulationTab,
    setActiveSimulationTab,
    setThermalZone,
    setThermalOperation,
    setThermalVariable,
    setThermalIsRunning,
    setThermalHeatLoad,
    setElectricalZone,
    setElectricalIsPlaying,
    setElectricalFailedRpps,
    setElectricalLoadPercent,
    setElectricalEdpSetting,
    setElectricalOperation,
    setElectricalVariable,
  } = useSimulation();

  // Get authenticated user info for user_id
  // Use 'sub' (subject) from OIDC token - this is the stable unique identifier
  // that matches what the backend uses for user_id in the database
  const auth = useAuth();
  const userId = auth.user?.profile?.sub || 'anonymous';

  // Local state for chat messages and loading indicator
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>('');

  // ---------------------------------------------------------
  // Helper Functions
  // ---------------------------------------------------------

  /** Toggle the agent panel visibility */
  const setShowAgent = () => dispatch({ type: "TOGGLE_AGENT" });

  /** Update the active camera in UI state (for toolbar sync) */
  const setActiveCamera = (camera: CameraName) => dispatch({ type: "SET_ACTIVE_CAMERA", camera });

  /**
   * Generate a unique ID for each message.
   * Uses timestamp + random string to ensure uniqueness.
   * @returns A unique string ID like "1702847123456-abc123def"
   */
  const generateId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  };

  // ---------------------------------------------------------
  // Action Processing
  // ---------------------------------------------------------

  /**
   * Helper function to save simulation preferences to backend.
   * Similar to how GPU preferences are saved.
   *
   * @param preferenceData - Object with preference fields to save
   */
  const saveSimulationPreference = async (preferenceData: Record<string, string>) => {
    // Direct Kit connections (no VITE_CHAT_API_URL override) skip auth
    const isLocalAgent = !import.meta.env.VITE_CHAT_API_URL;
    if (!isLocalAgent && (userId === 'anonymous' || !auth.user?.id_token)) {
      console.warn('[AgentPanel] Cannot save simulation preference: user not authenticated');
      return;
    }

    try {
      await fetch(PREFERENCES_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.user?.id_token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          user_id: userId,
          ...preferenceData
        }),
      });
      console.info(`[AgentPanel] Simulation preference saved:`, preferenceData, `for user ${userId}`);
    } catch (error) {
      console.error('[AgentPanel] Failed to save simulation preference:', error);
      // Settings were still changed in UI, just not persisted
    }
  };

  /**
   * Process action commands returned by the AI Agent.
   * Actions are executed silently (not shown in chat).
   *
   * Currently handles:
   *   - camera_change: Switches the 3D viewport camera via WebRTC
   *   - gpu_change: Switches the GPU configuration and updates UI + backend
   *   - simulation_change: Changes simulation panel settings (panel, zone, operation, variable)
   *
   * @param actions - Array of action objects from AI response
   */
  const processActions = async (actions: AgentAction[]) => {
    // Track if we've already opened panels during this batch
    // This prevents multiple toggles if backend sends multiple actions that affect the same panel
    let simulationsPanelOpened = state.simulations;
    let configuratorPanelOpened = state.configurator;

    for (const action of actions) {
      // Handle camera switch action
      if (action.type === 'camera_change' && action.camera_name) {
        const cameraPath = action.camera_name;

        // Validate camera path before switching
        if (VALID_CAMERA_NAMES.includes(cameraPath)) {
          // Send camera switch command to Kit app via WebRTC data channel (full prim path)
          await switchCamera(cameraPath);
          // Update UI state — extract short name for toolbar display
          const shortName = cameraPath.split('/').pop() || cameraPath;
          setActiveCamera(shortName as CameraName);
          console.info(`[AgentPanel] Camera switched to ${cameraPath}`);
        } else {
          console.warn(`[AgentPanel] Invalid camera_name: ${action.camera_name}`);
        }
      }

      // Handle GPU change action
      if (action.type === 'gpu_change' && action.gpu_selection) {
        const gpuSelection = action.gpu_selection;

        // Validate GPU selection before switching
        if (VALID_GPU_SELECTIONS.includes(gpuSelection as typeof VALID_GPU_SELECTIONS[number])) {
          // Open configurator panel and switch to GPU tab
          if (!configuratorPanelOpened) {
            dispatch({ type: "TOGGLE_CONFIGURATOR" });
            configuratorPanelOpened = true;
          }
          dispatch({ type: "SET_ACTIVE_CONFIG_MODE", activeConfigMode: "gpu" });

          await switchGpuVisibility(gpuSelection);

          // Update UI state so dropdown shows correct GPU selection
          const displayGpu = gpuDisplayMap[gpuSelection];
          if (displayGpu) {
            setSelectedGpu(displayGpu);
          }

          // Save GPU preference to backend for persistence
          // This ensures the preference is stored in the database
          // Only save if user is authenticated
          //
          // SECURITY NOTE: The backend MUST verify that the user_id in the request body
          // matches the authenticated user from the token (either from cookies or Authorization header).
          // This prevents unauthorized users from modifying other users' preferences.
          if (userId !== 'anonymous' && auth.user?.id_token) {
            try {
              await fetch(PREFERENCES_API_URL, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  // Include id_token in Authorization header for explicit authentication
                  // Backend should validate this token and ensure user_id matches the token's 'sub' claim
                  // If backend doesn't support header auth yet, it will fall back to cookie-based auth
                  'Authorization': `Bearer ${auth.user?.id_token}`,
                },
                credentials: 'include', // Ensure cookies (id_token) are sent as fallback
                body: JSON.stringify({
                  user_id: userId,
                  gpu_selection: gpuSelection
                }),
              });
              console.info(`[AgentPanel] GPU switched to ${gpuSelection} and saved for user ${userId}`);
            } catch (error) {
              console.error('[AgentPanel] Failed to save GPU preference:', error);
              // GPU was still switched in scene and UI, just not persisted
            }
          } else {
            console.warn('[AgentPanel] Cannot save GPU preference: user not authenticated');
          }
        } else {
          console.warn(`[AgentPanel] Invalid gpu_selection: ${action.gpu_selection}`);
        }
      }

      // Handle simulation change action
      if (action.type === 'simulation_change') {
        // Open the simulations panel if it's not already visible (only once per batch)
        if (!simulationsPanelOpened) {
          dispatch({ type: "TOGGLE_SIMULATIONS" });
          simulationsPanelOpened = true;
        }

        // Switch to the specified panel/tab if provided
        if (action.panel) {
          if (VALID_SIMULATION_PANELS.includes(action.panel as SimulationPanelType)) {
            setActiveSimulationTab(action.panel as SimulationPanelType);
            // Save panel preference to backend for persistence
            await saveSimulationPreference({ simulation_tab: action.panel });
            console.info(`[AgentPanel] Simulation panel switched to ${action.panel}`);
          } else {
            console.warn(`[AgentPanel] Invalid simulation panel: ${action.panel}`);
          }
        }

        // Handle thermal-specific settings
        // Only apply thermal settings if:
        // 1. action.panel is explicitly 'thermal', OR
        // 2. action.panel is undefined AND the current active tab is 'thermal'
        if (action.panel === 'thermal' || (!action.panel && activeSimulationTab === 'thermal')) {
          if (action.zone) {
            if (VALID_THERMAL_ZONES.includes(action.zone as ThermalZone)) {
              setThermalZone(action.zone as ThermalZone);
              // Save thermal zone preference to backend for persistence
              await saveSimulationPreference({ thermal_zone: action.zone });
              console.info(`[AgentPanel] Thermal zone set to ${action.zone}`);
            } else if (action.panel === 'thermal') {
              console.warn(`[AgentPanel] Invalid thermal zone: ${action.zone}`);
            }
          }

          if (action.operation) {
            if (VALID_THERMAL_OPERATIONS.includes(action.operation as ThermalOperation)) {
              setThermalOperation(action.operation as ThermalOperation);
              // Save thermal operation preference to backend for persistence
              await saveSimulationPreference({ thermal_operation: action.operation });
              console.info(`[AgentPanel] Thermal operation set to ${action.operation}`);
            } else if (action.panel === 'thermal') {
              console.warn(`[AgentPanel] Invalid thermal operation: ${action.operation}`);
            }
          }

          if (action.variable) {
            if (VALID_THERMAL_VARIABLES.includes(action.variable as ThermalVariable)) {
              setThermalVariable(action.variable as ThermalVariable);
              // Save thermal variable preference to backend for persistence
              await saveSimulationPreference({ thermal_variable: action.variable });
              console.info(`[AgentPanel] Thermal variable set to ${action.variable}`);
            } else if (action.panel === 'thermal') {
              console.warn(`[AgentPanel] Invalid thermal variable: ${action.variable}`);
            }
          }
        }

        // Handle start/stop thermal test (same as "Begin Test" button)
        if (action.start_test !== undefined && (action.panel === 'thermal' || (!action.panel && activeSimulationTab === 'thermal'))) {
          const CFD_LAYER_ROOT = "/World/CFD_Layer";
          const CFD_LAYER_PATH = "/World/CFD_Layer/NV_DC_DS9_GB300_SinglePOD/CAE/IndeXVolume_Elements";
          setThermalIsRunning(action.start_test);
          await switchVisibility(CFD_LAYER_ROOT, action.start_test);
          await switchVisibility(CFD_LAYER_PATH, action.start_test);
          if (action.start_test) {
            await switchCamera('/World/interactive_cameras/cfd_camera');
          }
          console.info(`[AgentPanel] Thermal test ${action.start_test ? 'started' : 'stopped'}`);
        }

        // Handle heat load change (same as the slider in SimulationPanel)
        if (action.heat_load !== undefined && (action.panel === 'thermal' || (!action.panel && activeSimulationTab === 'thermal'))) {
          const clamped = Math.max(40, Math.min(100, Math.round(action.heat_load)));
          setThermalHeatLoad(clamped);
          const LOAD_LEVEL_PRIM = "/World/CFD_Layer/NV_DC_DS9_GB300_SinglePOD/CAE/IndeXVolume_Elements/Materials/DCDTMaterial/VolumeShader";
          await setPrimAttribute(LOAD_LEVEL_PRIM, "inputs:load_level", clamped);
          console.info(`[AgentPanel] Heat load set to ${clamped}%`);
        }

        // Handle electrical-specific settings
        if (action.panel === 'electrical') {
          if (action.zone) {
            if (VALID_ELECTRICAL_ZONES.includes(action.zone as ElectricalZone)) {
              setElectricalZone(action.zone as ElectricalZone);
              // Save electrical zone preference to backend for persistence
              await saveSimulationPreference({ electrical_zone: action.zone });
              console.info(`[AgentPanel] Electrical zone set to ${action.zone}`);
            } else {
              console.warn(`[AgentPanel] Invalid electrical zone: ${action.zone}`);
            }
          }

          if (action.operation) {
            if (VALID_ELECTRICAL_OPERATIONS.includes(action.operation as ElectricalOperation)) {
              setElectricalOperation(action.operation as ElectricalOperation);
              // Save electrical operation preference to backend for persistence
              await saveSimulationPreference({ electrical_operation: action.operation });
              console.info(`[AgentPanel] Electrical operation set to ${action.operation}`);
            } else {
              console.warn(`[AgentPanel] Invalid electrical operation: ${action.operation}`);
            }
          }

          if (action.variable) {
            if (VALID_ELECTRICAL_VARIABLES.includes(action.variable as ElectricalVariable)) {
              setElectricalVariable(action.variable as ElectricalVariable);
              // Save electrical variable preference to backend for persistence
              await saveSimulationPreference({ electrical_variable: action.variable });
              console.info(`[AgentPanel] Electrical variable set to ${action.variable}`);
            } else {
              console.warn(`[AgentPanel] Invalid electrical variable: ${action.variable}`);
            }
          }

          // Handle electrical power failure test
          if (action.electrical_test) {
            const et = action.electrical_test;
            if (et.playing !== undefined) {
              setElectricalIsPlaying(et.playing);
              console.info(`[AgentPanel] Electrical test ${et.playing ? 'started' : 'stopped'}`);
            }
            if (et.failed_rpps !== undefined) {
              setElectricalFailedRpps(Math.max(0, Math.min(4, et.failed_rpps)));
            }
            if (et.load_percent !== undefined) {
              setElectricalLoadPercent(Math.max(0, Math.min(100, et.load_percent)));
            }
            if (et.edp_setting !== undefined && (et.edp_setting === '1.2' || et.edp_setting === '1.5')) {
              setElectricalEdpSetting(et.edp_setting as EdpSetting);
            }
          }
        }
      }

      // Handle per-RPP whip visibility
      if (action.type === 'rpp_whip_visibility' && action.rpp_visible) {
        const { sendRppWhipVisibility } = await import('@/streamMessages');
        await sendRppWhipVisibility(action.rpp_visible as Record<number, boolean>);
        console.info('[AgentPanel] RPP whip visibility updated:', action.rpp_visible);
      }

      // Handle isolation change (isolate POD / restore visibility)
      if (action.type === 'isolation_change' && action.isolation) {
        const iso = action.isolation as { isolate?: boolean; hide?: string[]; show?: string[] };
        if (iso.hide) {
          for (const path of iso.hide) {
            await switchVisibility(path, false);
            await new Promise(r => setTimeout(r, 200));
          }
        }
        if (iso.show) {
          for (const path of iso.show) {
            await switchVisibility(path, true);
            await new Promise(r => setTimeout(r, 200));
          }
        }
        console.info(`[AgentPanel] Isolation ${iso.isolate ? 'applied' : 'restored'}: hide=${iso.hide?.length ?? 0}, show=${iso.show?.length ?? 0}`);
      }

      // Handle site change action (country and region)
      if (action.type === 'site_change') {
        // Debug: Log the full action object to see what fields the backend sends
        console.log('[AgentPanel] site_change action received:', JSON.stringify(action, null, 2));

        // Open the configurator panel if not already visible (only once per batch)
        if (!configuratorPanelOpened) {
          dispatch({ type: "TOGGLE_CONFIGURATOR" });
          configuratorPanelOpened = true;
        }
        // Switch to site tab
        dispatch({ type: "SET_ACTIVE_CONFIG_MODE", activeConfigMode: "site" });

        if (action.country) {
          // Validate country
          if (VALID_COUNTRIES.includes(action.country as Country)) {
            const country = action.country as Country;

            // For Sweden, just set the country (no region needed)
            if (country === 'Sweden') {
              setSelectedCountry(country);
              setSelectedRegion(null);
              console.info(`[AgentPanel] Site changed to country: ${country}`);
            }
            // For United States, we need to handle region
            else if (country === 'United States') {
              setSelectedCountry(country);

              // If region is provided and valid for the country, set it
              if (action.region) {
                const validRegionsForCountry = SITE_OPTIONS[country];
                if (validRegionsForCountry.includes(action.region as Region)) {
                  setSelectedRegion(action.region as Region);
                  console.info(`[AgentPanel] Site changed to country: ${country}, region: ${action.region}`);
                } else {
                  console.warn(`[AgentPanel] Invalid region for ${country}: ${action.region}. Valid regions: ${validRegionsForCountry.join(', ')}`);
                  setSelectedRegion(null);
                }
              } else {
                // No region provided, just set country
                setSelectedRegion(null);
                console.info(`[AgentPanel] Site changed to country: ${country} (no region specified)`);
              }
            }
          } else {
            console.warn(`[AgentPanel] Invalid country: ${action.country}. Valid countries: ${VALID_COUNTRIES.join(', ')}`);
          }
        } else {
          console.warn('[AgentPanel] site_change action missing required "country" field');
        }
      }

      // Handle power change action
      if (action.type === 'power_change') {
        // Debug: Log the full action object to see what fields the backend sends
        console.log('[AgentPanel] power_change action received:', JSON.stringify(action, null, 2));

        // Open the configurator panel if not already visible (only once per batch)
        if (!configuratorPanelOpened) {
          dispatch({ type: "TOGGLE_CONFIGURATOR" });
          configuratorPanelOpened = true;
        }
        // Switch to power tab
        dispatch({ type: "SET_ACTIVE_CONFIG_MODE", activeConfigMode: "power" });

        if (action.power_source) {
          if (VALID_POWER_SOURCES.includes(action.power_source as Power)) {
            setSelectedPower(action.power_source as Power);
            console.info(`[AgentPanel] Power source changed to: ${action.power_source}`);
          } else {
            console.warn(`[AgentPanel] Invalid power_source: ${action.power_source}. Valid options: ${VALID_POWER_SOURCES.join(', ')}`);
          }
        } else {
          console.warn('[AgentPanel] power_change action missing required "power_source" field');
        }
      }
    }
  };

  // ---------------------------------------------------------
  // Message Handling
  // ---------------------------------------------------------

  /**
   * Send a user message to the AI Agent backend and process the response.
   *
   * Flow:
   *   1. Add user message to chat immediately (optimistic UI)
   *   2. Send POST request to AI backend with JWT authentication
   *   3. Add assistant response to chat
   *   4. Execute any actions from the response (camera changes, etc.)
   *   5. Handle errors gracefully with user-friendly message
   *
   * SECURITY: The request includes the user's id_token in the Authorization header.
   * The backend MUST validate this JWT token and ensure the user_id in the request
   * body matches the authenticated user from the token's 'sub' claim.
   *
   * @param content - The user's message text
   */
  const handleSendMessage = async (content: string) => {
    // Create and display user message immediately
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Direct Kit connections (no VITE_CHAT_API_URL override) skip auth
    const isLocalAgent = !import.meta.env.VITE_CHAT_API_URL;
    if (!isLocalAgent && (userId === 'anonymous' || !auth.user?.id_token)) {
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: "You must be logged in to chat with the AI assistant. Please sign in and try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsLoading(false);
      return;
    }

    // ID for the assistant message — created only when content arrives
    const assistantId = generateId();
    let assistantCreated = false;

    // Helper to create the assistant message on first content chunk
    const ensureAssistant = () => {
      if (!assistantCreated) {
        assistantCreated = true;
        setMessages((prev) => [...prev, {
          id: assistantId,
          role: 'assistant' as const,
          content: '',
          timestamp: new Date(),
        }]);
      }
    };

    // Helper to update the assistant message in-place
    const updateAssistant = (newContent: string) => {
      ensureAssistant();
      setMessages((prev) =>
        prev.map((m) => m.id === assistantId ? { ...m, content: newContent } : m)
      );
    };

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (!isLocalAgent && auth.user?.id_token) {
        headers['Authorization'] = `Bearer ${auth.user.id_token}`;
      }

      // Send conversation history so the agent has context from prior exchanges.
      // Only include user/assistant messages (not the placeholder we just added).
      // Cap to last 20 messages (~10 exchanges) to keep prompt size reasonable.
      const history = messages
        .filter((m) => m.content && !m.content.startsWith('*'))
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content }));

      const requestBody = JSON.stringify({
        message: content,
        user_id: userId,
        current_camera: state.activeCamera ?? state.savedCamera,
        history,
      });

      // Local Kit agent: use SSE streaming endpoint for progress updates
      // Remote/production: use standard JSON endpoint
      const useStreaming = isLocalAgent;
      const url = useStreaming ? CHAT_STREAM_API_URL : CHAT_API_URL;

      const response = await fetch(url, {
        method: 'POST',
        headers,
        ...(isLocalAgent ? {} : { credentials: 'include' as RequestCredentials }),
        body: requestBody,
      });

      if (!response.ok) {
        if (response.status === 401) throw new Error('Authentication failed. Please sign in again.');
        if (response.status === 403) throw new Error('You do not have permission to access this resource.');
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('Content-Type') || '';

      if (contentType.includes('text/event-stream') && response.body) {
        // --- SSE streaming: progress updates + final response ---
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finalContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith('data: ')) continue;

            try {
              const event = JSON.parse(line.slice(6));

              if (event.type === 'status') {
                // Update the loading indicator text (spinner + status)
                setLoadingStatus(event.message);
              } else if (event.type === 'content') {
                // Accumulate streamed content chunks (typing effect)
                finalContent += event.content;
                updateAssistant(finalContent);
              } else if (event.type === 'actions') {
                // Early actions — process camera/visibility changes immediately
                // before text streaming starts (prevents camera snap-back)
                if (event.actions && Array.isArray(event.actions)) {
                  await processActions(event.actions);
                }
              } else if (event.type === 'done') {
                if (event.actions && Array.isArray(event.actions)) {
                  await processActions(event.actions);
                }
              } else if (event.type === 'error') {
                updateAssistant(event.error || 'An error occurred.');
              }
            } catch {
              // Malformed JSON — skip
            }
          }
        }

        // Fallback if stream ended without any content
        if (!finalContent && !assistantCreated) {
          updateAssistant('Agent completed the task.');
        }
      } else {
        // --- Standard JSON response (non-local / fallback) ---
        const data = await response.json();
        updateAssistant(data.response || data.message || JSON.stringify(data));

        if (data.actions && Array.isArray(data.actions)) {
          await processActions(data.actions);
        }
      }
    } catch (error) {
      console.error('Error connecting to AI Agent:', error);
      updateAssistant("I'm having trouble connecting right now. Please try again later.");
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
    }
  };

  /** Clear all messages and reset chat to initial state */
  const handleClearChat = () => {
    setMessages([]);
  };

  /** Handle clicking a suggested prompt from the welcome screen */
  const handlePromptClick = (prompt: string) => {
    handleSendMessage(prompt);
  };

  /** Close the agent panel */
  const handleClose = () => {
    setShowAgent();
  };

  // ---------------------------------------------------------
  // Render
  // ---------------------------------------------------------

  // Don't render anything if panel is hidden
  if (!showAgent) return null;

  return (
    <div className="w-[480px] bg-black/70 backdrop-blur-xl rounded-2xl border border-white/10 flex flex-col overflow-hidden shadow-2xl pointer-events-auto">
      {/* Header with sparkle icon and action buttons */}
      <div className="flex items-center justify-between px-4 py-3">
        {/* AI sparkle icon */}
        <div className="p-2 rounded-lg bg-white/10">
          <SparklesIcon className="size-5 text-white" />
        </div>
        {/* Header action buttons */}
        <div className="flex items-center gap-1">
          {/* Clear chat history button */}
          <button
            onClick={handleClearChat}
            className="cursor-pointer p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Clear chat history"
          >
            <History className="size-5 text-white/70" />
          </button>
          {/* Close panel button */}
          <button
            onClick={handleClose}
            className="cursor-pointer p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X className="size-5 text-white/70" />
          </button>
        </div>
      </div>

      {/* Main content: message list and input */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <MessageList
          messages={messages}
          isLoading={isLoading}
          loadingStatus={loadingStatus}
          onPromptClick={handlePromptClick}
        />
        <MessageInput
          onSend={handleSendMessage}
          disabled={isLoading}
        />
      </div>
    </div>
  );
};

export default AgentPanel;
