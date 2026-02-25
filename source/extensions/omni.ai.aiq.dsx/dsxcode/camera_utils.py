"""DSX datacenter camera utilities — waypoint navigation and camera presets."""

from typing import Optional, List
import omni.usd

# ── Camera inventory ──────────────────────────────────────────────────────────
# Camera prim *names* (not full paths).  manager.camera.set_active_camera()
# searches the stage by name, so full paths are not required.
# NOTE: Cameras live under /World/interactive_cameras/ in the DSX scene.
CAMERAS = {
    # Interior — datahall  (positions from scene survey)
    "camera_int_datahall_01": "Default datahall view — looking down the row of 22 deployment units (far end, ground level)",
    "camera_int_datahall_02": "Close-up ground level inside a deployment unit — compute tray details",
    "camera_int_datahall_03": "Elevated view inside the Hot Aisle Containment — cooling pipes visible between racks",
    "camera_int_datahall_04": "Inside the Hot Aisle Containment — power cables and infrastructure visible",
    # Exterior
    "camera_ext_default_01": "High aerial view of entire campus from the front (far away)",
    "camera_ext_default_02": "View from the back side — near power yard",
    "camera_ext_default_03": "Aerial view of cooling towers and CUB",
    "camera_ext_default_04": "Very high aerial view from the front entrance (far away)",
    # CFD / simulation
    "cfd_camera": "Interior datahall view — hot aisle containment and overhead infrastructure",
    # CDU (Coolant Distribution Units)
    "cdu_camera": "View of CDUs (Coolant Distribution Units) inside the building",
    # Networking
    "networking_camera": "View of the networking module",
}

# Full prim path prefix for cameras in the new scene.
CAMERA_PATH_PREFIX = "/World/interactive_cameras/"

# ── Waypoint mapping ──────────────────────────────────────────────────────────
# Maps natural-language waypoint names → camera prim names.
# Multiple aliases can point to the same camera.
# Only uses cameras verified to exist in the DSX scene.
#
# Scene structure (DSX_BP/Assembly/DSX_Main.usda):
#   /World/assembly_Bldg_Equipment/.../Assembly_HAC_GPU_BLDG_SR_Interactive/
#     hall_hacs                — 22 Hot Aisle Containment structures
#     hall_GPUs_GB200          — 22 GPU racks (GB200)
#     hall_GPUs_GB300_standin  — 22 GPU racks (GB300)
#     hall_mech_cooling_gb300  — cooling piping
#     hall_trays_power         — power cable trays (overhead)
#     hall_remotepowerpanels   — remote power panels
#     hall_powercables         — power cables
#     interactive_whips        — whip power connections
#     HAC_Lighting             — HAC lighting
#   /World/Assembly_Building_Internal     — building internals (structure, arch, electrical, telecom)
#   /World/Building                       — building exterior
#   /World/assembly_Site                  — site (cooling towers, landscape)
#   /World/CFD_Layer                      — CFD simulation overlay
#   /World/interactive_cameras/           — all interactive cameras (11 total)
#   GPU switching: visibility toggle between hall_GPUs_GB200 / hall_GPUs_GB300_standin
WAYPOINTS = {
    # Datahall
    "data_hall":           "camera_int_datahall_01",
    "datahall":            "camera_int_datahall_01",
    # Hot aisle / containment — cfd_camera has the best view of the hot aisle
    "hot_aisle":           "cfd_camera",
    "hot_aisle_cooling":   "cfd_camera",
    "hot_aisle_power":     "camera_int_datahall_04",
    "containment":         "cfd_camera",
    # Racks / GPUs — datahall_01 shows the row of deployment units
    "racks":               "camera_int_datahall_01",
    "gpu":                 "camera_int_datahall_01",
    "deployment_unit":     "camera_int_datahall_01",
    # Piping / cooling — elevated view (datahall_03) shows pipes between racks
    "piping":              "camera_int_datahall_03",
    "pipes":               "camera_int_datahall_03",
    "cooling_pipes":       "camera_int_datahall_03",
    # Power / RPP
    "power":               "camera_int_datahall_04",
    "power_infrastructure":"camera_int_datahall_04",
    "power_cables":        "camera_int_datahall_04",
    "rpp":                 "camera_int_datahall_04",
    # CDU (Coolant Distribution Units)
    "cdu":                 "cdu_camera",
    "cdus":                "cdu_camera",
    "coolant_distribution":"cdu_camera",
    # Networking module
    "networking":          "networking_camera",
    "networking_module":   "networking_camera",
    "network":             "networking_camera",
    # Compute tray
    "compute_tray":        "camera_int_datahall_02",
    "compute":             "camera_int_datahall_02",
    # CFD / simulation — dedicated cfd_camera positioned for thermal/airflow view
    "cfd":                 "cfd_camera",
    "cfd_view":            "cfd_camera",
    "simulation":          "cfd_camera",
    "thermal":             "cfd_camera",
    "airflow":             "cfd_camera",
    # Exterior
    "cooling_towers":      "camera_ext_default_03",
    "cooling":             "camera_ext_default_03",
    "site_top":            "camera_ext_default_04",
    "site_overview":       "camera_ext_default_04",
    "campus":              "camera_ext_default_01",
    "overview":            "camera_ext_default_04",
    "front_entrance":      "camera_ext_default_01",
    "back":                "camera_ext_default_02",
    "power_yard":          "camera_ext_default_02",
}


def navigate_to_waypoint(waypoint_name: str) -> str:
    """Resolve a waypoint to a camera and switch to it immediately.

    Fires a ``changeCamera`` carb event so the streaming camera updates
    instantly (no waiting for the LLM to finish generating the response).
    The frontend also receives the camera action via SSE and syncs its
    tracking state to prevent snap-back.

    Args:
        waypoint_name: One of the predefined waypoint names
            (e.g., 'data_hall', 'cooling_towers', 'site_top', 'hot_aisle').

    Returns:
        Status message including the camera name (parsed by _extract_actions).
    """
    # Strip full prim path prefix if the LLM passed one
    if "/" in waypoint_name:
        waypoint_name = waypoint_name.rsplit("/", 1)[-1]
    key = waypoint_name.lower().replace(" ", "_").replace("-", "_")

    # Accept direct camera names (e.g. "camera_int_datahall_01") as well as waypoint aliases
    camera_name = WAYPOINTS.get(key)
    if not camera_name:
        if key in CAMERAS:
            camera_name = key
        else:
            available = ", ".join(sorted(WAYPOINTS.keys()))
            camera_names = ", ".join(sorted(CAMERAS.keys()))
            return f"Unknown waypoint '{waypoint_name}'. Available waypoints: {available}. Or use a camera name directly: {camera_names}"

    # Fire carb event on next Kit update so the streaming camera updates
    # quickly, but not in the middle of a USD visibility change (which can
    # crash Kit if the renderer is processing heavy prims like IndeX volumes).
    try:
        import omni.kit.app
        import carb.events

        _sub_holder = [None]

        def _fire_camera_once(*_):
            try:
                bus = omni.kit.app.get_app().get_message_bus_event_stream()
                event_type = carb.events.type_from_string("send_message_from_event")
                bus.push(event_type, payload={
                    "command_name": "changeCamera",
                    "message": camera_name,
                })
            except Exception:
                pass
            # Unsubscribe after one fire
            _sub_holder[0] = None

        _sub_holder[0] = omni.kit.app.get_app().get_update_event_stream().create_subscription_to_pop(
            _fire_camera_once, name="dsx_deferred_camera", order=0
        )
    except Exception:
        pass  # Non-critical — SSE action will still handle it

    desc = CAMERAS.get(camera_name, "")
    return f"Navigated to '{waypoint_name}' → camera {camera_name} ({desc})"


def get_waypoint_names() -> list:
    """Return list of available waypoint names."""
    return sorted(WAYPOINTS.keys())


def get_camera_descriptions() -> dict:
    """Return dict of camera_name → description for all known cameras."""
    return dict(CAMERAS)
