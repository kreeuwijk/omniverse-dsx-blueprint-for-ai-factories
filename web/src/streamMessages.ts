import { AppStreamer } from "@nvidia/omniverse-webrtc-streaming-library";
import { AGENT_STATE_URL } from "@/config/api";

// ── Agent state sync (best-effort POST to keep backend aware of UI changes) ─
export const syncAgentState = async (state: Record<string, unknown>) => {
    try {
        await fetch(AGENT_STATE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(state),
        });
    } catch { /* best-effort, don't block UI */ }
};

// ── GPU constants (shared by ConfiguratorPanel, AgentPanel, etc.) ───────────
const GPU_PRIM_BASE = "/World/assembly_Bldg_Equipment/assembly_Bldg_Equipment/DSX_Bldg_Equipement/DS9_Z0S0_BLDG_EQUIPMENT/Assembly_HAC_GPU_BLDG_SR_Interactive";
export const GPU_PRIM_MAP: Record<string, string> = {
    "GB200": `${GPU_PRIM_BASE}/hall_GPUs_GB200`,
    "GB300": `${GPU_PRIM_BASE}/hall_GPUs_GB300`,
};

/**
 * Switch GPU visibility in the scene.  Hides the non-selected variant first,
 * waits briefly, then shows the selected one — avoids both being loaded at
 * the same time.  This is the single source of truth for GPU switching;
 * ConfiguratorPanel and AgentPanel both call this.
 *
 * @param variant "GB200" or "GB300"
 */
export const switchGpuVisibility = async (variant: string) => {
    for (const [key, primPath] of Object.entries(GPU_PRIM_MAP)) {
        if (key !== variant) await switchVisibility(primPath, false);
    }
    await new Promise(r => setTimeout(r, 500));
    for (const [key, primPath] of Object.entries(GPU_PRIM_MAP)) {
        if (key === variant) await switchVisibility(primPath, true);
    }
};

// VISIBILITY CHANGE
// Data is JSON-encoded into the `message` field (only command_name + message
// are reliably forwarded through the WebRTC → carb-event bridge).
export const switchVisibility = async (primPath: string, visible: boolean) => {
    try {
        const message = {
            event_type: "send_message_from_event",
            payload: {
                command_name: "changeVisibility",
                message: JSON.stringify({ prim_path: primPath, visible: visible })
            }
        };
        // v5.17.0: sendMessage takes an ApplicationMessage object, not a string.
        await AppStreamer.sendMessage(message);
    } catch (error) {
        console.error("Error changing visibility:", error);
    }
};

// SET PRIM ATTRIBUTE
// Data is JSON-encoded into the `message` field for the same reason as above.
export const setPrimAttribute = async (primPath: string, attrName: string, value: number) => {
    try {
        const message = {
            event_type: "send_message_from_event",
            payload: {
                command_name: "setAttribute",
                message: JSON.stringify({ prim_path: primPath, attr_name: attrName, value: value })
            }
        };
        // v5.17.0: sendMessage takes an ApplicationMessage object, not a string.
        await AppStreamer.sendMessage(message);
    } catch (error) {
        console.error("Error setting attribute:", error);
    }
};

// POWER FAILURE TEST
export const sendPowerFailureData = async (data: {
    playing: boolean
    powerA: number
    powerB: number
    powerC: number
    powerD: number
    rppWattage: number
    failedBusways: number
}) => {
    try {
        const message = {
            event_type: "send_message_from_event",
            payload: {
                command_name: "powerFailure",
                message: JSON.stringify(data)
            }
        };
        await AppStreamer.sendMessage(message);
    } catch (error) {
        console.error("Error sending power failure data:", error);
    }
};

// RPP WHIP VISIBILITY (per-RPP show/hide for electrical simulation)
export const sendRppWhipVisibility = async (rppVisible: Record<number, boolean>) => {
    try {
        const message = {
            event_type: "send_message_from_event",
            payload: {
                command_name: "rppWhipVisibility",
                message: JSON.stringify(rppVisible)
            }
        };
        await AppStreamer.sendMessage(message);
    } catch (error) {
        console.error("Error setting RPP whip visibility:", error);
    }
};

// CAMERA CHANGE
export const switchCamera = async (camera: string) => {
    // Strip prim path prefix — carb dictionary interprets '/' as nested key
    // separators, so full paths like "/World/interactive_cameras/camera_name"
    // break the WebRTC → carb event bridge.  Send only the camera name.
    const cameraName = camera.includes('/') ? camera.split('/').pop()! : camera;
    try {
        const message = {
            event_type: "send_message_from_event",
            payload: {
                command_name: "changeCamera",
                message: cameraName
            }
        };
        // v5.17.0: sendMessage takes an ApplicationMessage object, not a string.
        await AppStreamer.sendMessage(message);
    } catch (error) {
        console.error("Error selecting camera:", error);
    }
};
