import { useEffect, useRef } from "react";
import "@arcgis/core/assets/esri/themes/dark/main.css";
import SceneView from "@arcgis/core/views/SceneView";
import WebScene from "@arcgis/core/WebScene";

interface MapProps {
    setSceneView: (sceneView: SceneView) => void;
    setWebScene: (webScene: WebScene) => void;
}

const Map = ({ setSceneView, setWebScene }: MapProps) => {

    const mapDiv = useRef(null);

    useEffect(() => {
        if (!mapDiv.current) return;

        // Get the web scene from ArcGIS Online
        const webScene = new WebScene({
            portalItem: {
                id: "93c59ef5d5aa4a28addd70905ae21972"
            }
        })

        // Map UI buttons; remove all by default
        const mapButtons: any[] = [];

        // Create the 3d scene view
        const view = new SceneView({
            container: mapDiv.current,
            map: webScene,
            camera: {
                position: {
                    // Default to center of United States
                    x: -98.5795,
                    y: 39.8282,
                    z: 30000000
                },
                tilt: 0
            },
            ui: {
                components: mapButtons
            },
            qualityProfile: "high"
        })

        // Set the scene view and web scene
        setSceneView(view)
        setWebScene(webScene);

        return () => {
            if (view) {
                view.destroy();
            }
        }
    }, [setSceneView, setWebScene]);

    return (
        <div
            ref={mapDiv}
            style={{
                width: "100%",
                height: "100%",
                margin: 0,
                padding: 0,
                position: "absolute",
                zIndex: 9,
            }}
        >
        </div>
    )
}

export default Map;