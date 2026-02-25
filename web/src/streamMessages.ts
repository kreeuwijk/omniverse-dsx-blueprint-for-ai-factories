import { AppStreamer } from "@nvidia/omniverse-webrtc-streaming-library";

// GPU CHANGE
export const switchGpu = async (gpu: string) => {
    try {
        const message = {
            event_type: "send_message_from_event",
            payload: {
                command_name: "changeGpu",
                message: gpu
            }
        };
        // v5.17.0: sendMessage takes an ApplicationMessage object, not a string.
        await AppStreamer.sendMessage(message);
    } catch (error) {
        console.error("Error selecting variant:", error);
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
