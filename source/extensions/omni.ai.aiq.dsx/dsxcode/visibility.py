"""DSX datacenter visibility controls — show/hide datacenter components and switch GPU type."""

from typing import Union, List, Optional
import omni.usd

# ── Assembly base path (new DSX_BP scene) ────────────────────────────────────
# All datahall equipment lives under this deeply-nested assembly in the new scene.
ASSEMBLY_BASE = (
    "/World/assembly_Bldg_Equipment/assembly_Bldg_Equipment"
    "/DSX_Bldg_Equipement/DS9_Z0S0_BLDG_EQUIPMENT"
    "/Assembly_HAC_GPU_BLDG_SR_Interactive"
)

# For known top-level containers, toggle only the root prim (more efficient).
# MakeInvisible on a parent hides all children automatically.
TOP_LEVEL_PATHS = {
    # Datahall components (under assembly base)
    "hot_aisle":           f"{ASSEMBLY_BASE}/hall_hacs",
    "containment":         f"{ASSEMBLY_BASE}/hall_hacs",
    "hac":                 f"{ASSEMBLY_BASE}/hall_hacs",
    "gpu":                 f"{ASSEMBLY_BASE}/hall_GPUs_GB200",
    "rack":                f"{ASSEMBLY_BASE}/hall_GPUs_GB200",
    "rpp":                 f"{ASSEMBLY_BASE}/hall_remotepowerpanels",
    "power_panel":         f"{ASSEMBLY_BASE}/hall_remotepowerpanels",
    "power_cable":         f"{ASSEMBLY_BASE}/hall_powercables",
    "cable_tray":          f"{ASSEMBLY_BASE}/hall_trays_power",
    "tray":                f"{ASSEMBLY_BASE}/hall_trays_power",
    "cooling_gb300":       f"{ASSEMBLY_BASE}/hall_mech_cooling_gb300",
    "piping":              f"{ASSEMBLY_BASE}/hall_mech_cooling_gb300",
    "pipe":                f"{ASSEMBLY_BASE}/hall_mech_cooling_gb300",
    "cooling":             f"{ASSEMBLY_BASE}/hall_mech_cooling_gb300",
    "whip":                f"{ASSEMBLY_BASE}/interactive_whips",
    "whips":               f"{ASSEMBLY_BASE}/interactive_whips",
    "hac_lighting":        f"{ASSEMBLY_BASE}/HAC_Lighting",
    # CFD layer
    "cfd":                 "/World/CFD_Layer",
    # Building and site
    "building_internal":   "/World/Assembly_Building_Internal",
    "building_exterior":   "/World/Building",
    "site":                "/World/assembly_Site",
    "site_equipment":      "/World/assembly_Site_Equipment",
    "building_equipment":  "/World/assembly_Bldg_Equipment",
}

# ── GPU prim paths for visibility-based switching ─────────────────────────────
# The new scene uses two separate GPU groups. GPU switching toggles visibility.
GPU_GB200_PATH = f"{ASSEMBLY_BASE}/hall_GPUs_GB200"
GPU_GB300_PATH = f"{ASSEMBLY_BASE}/hall_GPUs_GB300"

# Deterministic tracking for GPU switches requested by the code interpreter.
# _extract_actions() reads this instead of relying on fragile keyword matching
# of the LLM's response text.
_pending_gpu_switch: str | None = None

# Local GPU state tracker.  The actual visibility change is asynchronous
# (SSE → frontend → WebRTC → manager → USD), so reading USD directly gives
# stale results on consecutive calls.  We track state here and only fall
# back to USD on the very first call.
_current_gpu: str | None = None

# Tracks which simulation type was last activated by the agent so that
# generic "begin test" / "stop test" commands route to the right one.
_active_simulation: str = "thermal"

# Tracked state from UI for context-aware agent responses
_thermal_is_running: bool = False
_electrical_is_running: bool = False
_electrical_failed_rpps: int = 0
_electrical_load_percent: int = 0
_electrical_edp_setting: str = "1.5"
_heat_load: int = 50
_current_camera: str = "camera_int_datahall_01"
_thermal_zone: str = "Data Hall"
_thermal_operation: str = "Normal"
_thermal_variable: str = "Temperature"
_site_country: str | None = None
_site_region: str | None = None
_power_source: str = "Grid"


def sync_ui_state(state: dict) -> None:
    """Update backend state from frontend UI changes (called via POST /api/agent/state)."""
    global _active_simulation, _current_gpu, _thermal_is_running, _electrical_is_running
    global _electrical_failed_rpps, _electrical_load_percent, _electrical_edp_setting
    global _heat_load, _current_camera, _thermal_zone, _thermal_operation, _thermal_variable
    global _site_country, _site_region, _power_source
    if "active_simulation" in state:
        _active_simulation = state["active_simulation"]
    if "current_gpu" in state:
        _current_gpu = state["current_gpu"]
    if "thermal_is_running" in state:
        _thermal_is_running = bool(state["thermal_is_running"])
    if "electrical_is_running" in state:
        _electrical_is_running = bool(state["electrical_is_running"])
    if "electrical_failed_rpps" in state:
        _electrical_failed_rpps = int(state["electrical_failed_rpps"])
    if "electrical_load_percent" in state:
        _electrical_load_percent = int(state["electrical_load_percent"])
    if "electrical_edp_setting" in state:
        _electrical_edp_setting = str(state["electrical_edp_setting"])
    if "heat_load" in state:
        _heat_load = int(state["heat_load"])
    if "current_camera" in state:
        _current_camera = str(state["current_camera"])
    if "thermal_zone" in state:
        _thermal_zone = str(state["thermal_zone"])
    if "thermal_operation" in state:
        _thermal_operation = str(state["thermal_operation"])
    if "thermal_variable" in state:
        _thermal_variable = str(state["thermal_variable"])
    if "site_country" in state:
        _site_country = state["site_country"]
    if "site_region" in state:
        _site_region = state["site_region"]
    if "power_source" in state:
        _power_source = str(state["power_source"])


def get_ui_state() -> dict:
    """Return the current UI state as a dict with units included.
    Use this when the user asks about the current configuration,
    simulation status, camera, GPU, etc."""
    return {
        "current_gpu": _current_gpu or "unknown",
        "current_camera": _current_camera,
        "active_simulation_tab": _active_simulation,
        "thermal_is_running": _thermal_is_running,
        "thermal_zone": _thermal_zone,
        "thermal_operation": _thermal_operation,
        "thermal_variable": _thermal_variable,
        "heat_load_percent": f"{_heat_load}%",
        "electrical_is_running": _electrical_is_running,
        "electrical_failed_rpps": f"{_electrical_failed_rpps} of 4",
        "electrical_load_percent": f"{_electrical_load_percent}%",
        "electrical_edp_setting": _electrical_edp_setting,
        "site_country": _site_country or "not set",
        "site_region": _site_region or "not set",
        "power_source": _power_source,
    }


def get_and_clear_gpu_switch() -> str | None:
    """Return the pending GPU switch variant and clear it. Thread-safe enough
    for the single-writer (code interpreter) / single-reader (http handler) case."""
    global _pending_gpu_switch
    result = _pending_gpu_switch
    _pending_gpu_switch = None
    return result


def _read_gpu_from_usd() -> str:
    """Read which GPU variant is currently visible from the USD stage."""
    stage = omni.usd.get_context().get_stage()
    if not stage:
        return "unknown"
    from pxr import UsdGeom
    gb200_vis = "invisible"
    gb300_vis = "invisible"
    prim200 = stage.GetPrimAtPath(GPU_GB200_PATH)
    if prim200.IsValid():
        attr = UsdGeom.Imageable(prim200).GetVisibilityAttr()
        if attr:
            gb200_vis = attr.Get() or "inherited"
    prim300 = stage.GetPrimAtPath(GPU_GB300_PATH)
    if prim300.IsValid():
        attr = UsdGeom.Imageable(prim300).GetVisibilityAttr()
        if attr:
            gb300_vis = attr.Get() or "inherited"
    if gb200_vis != "invisible" and gb300_vis == "invisible":
        return "GB200"
    if gb300_vis != "invisible" and gb200_vis == "invisible":
        return "GB300"
    return "unknown"


def get_current_gpu() -> str:
    """Return which GPU variant is currently active ('GB200', 'GB300', or 'unknown').

    Uses local tracking (updated by ``switch_rack_variant`` / ``toggle_gpu``).
    Falls back to reading USD on the first call to initialise.
    """
    global _current_gpu
    if _current_gpu is None:
        _current_gpu = _read_gpu_from_usd()
    return _current_gpu


def toggle_gpu() -> str:
    """Toggle the GPU variant: if GB200 is active switch to GB300, and vice versa.

    Use this when the user says "switch GPU" without specifying a target.
    """
    current = get_current_gpu()
    if current == "GB200":
        return switch_rack_variant("GB300")
    elif current == "GB300":
        return switch_rack_variant("GB200")
    else:
        return switch_rack_variant("GB300")


def show_hot_aisle(visible: bool = True) -> str:
    """Show or hide the hot aisle containment (HAC) in the datacenter."""
    count = _set_visibility("hot_aisle", visible)
    return f"Hot aisle {'shown' if visible else 'hidden'} ({count} prims affected)"


def show_containment(visible: bool = True) -> str:
    """Show or hide the hot aisle containment (HAC)."""
    count = _set_visibility("containment", visible)
    return f"Containment {'shown' if visible else 'hidden'} ({count} prims affected)"


# Deterministic tracking for CFD show/hide requested by the code interpreter.
# _extract_actions() reads this to emit a simulation_change action that goes
# through the frontend's Simulation panel flow (same as clicking "Begin Test").
_pending_cfd_action: bool | None = None


_pending_heat_load: int | None = None


def get_and_clear_cfd_action():
    """Return the pending CFD action (True=show, False=hide, None=none) and clear it."""
    global _pending_cfd_action
    result = _pending_cfd_action
    _pending_cfd_action = None
    return result


def get_and_clear_heat_load() -> int | None:
    """Return the pending heat load value and clear it."""
    global _pending_heat_load
    result = _pending_heat_load
    _pending_heat_load = None
    return result


def set_heat_load(percent: int) -> str:
    """Set the thermal simulation heat load percentage (40–100).

    Sets a flag that the frontend reads to update the slider and USD attribute,
    using the same code path as the UI slider.
    """
    global _pending_heat_load
    percent = max(40, min(100, int(percent)))
    _pending_heat_load = percent
    return f"Heat load set to {percent}%"


def show_cfd_results(visible: bool = True) -> str:
    """Show or hide CFD simulation results overlay.

    Uses the efficient top-level path ``/World/CFD_Layer`` and also ensures
    the specific IndeX volume prim is visible so the rainbow temperature
    colormap renders correctly.
    """
    count = _set_visibility("cfd", visible)
    # Also explicitly set the IndeX volume prim (what the UI toggles)
    idx_path = "/World/CFD_Layer/NV_DC_DS9_GB300_SinglePOD/CAE/IndeXVolume_Elements"
    stage = omni.usd.get_context().get_stage()
    if stage:
        prim = stage.GetPrimAtPath(idx_path)
        if prim.IsValid():
            from pxr import UsdGeom
            imageable = UsdGeom.Imageable(prim)
            if imageable:
                vis_attr = imageable.GetVisibilityAttr()
                vis_attr.Set("inherited" if visible else "invisible")
                count += 1
    return f"CFD results {'shown' if visible else 'hidden'} ({count} prims affected)"


def visualize_cfd(visible: bool = True) -> str:
    """Show or hide CFD simulation results through the Simulation panel flow.

    Sets a deterministic flag that ``_extract_actions()`` reads to emit a
    ``simulation_change`` action.  The frontend opens the Simulations panel,
    switches to the Thermal tab, and starts/stops the test — the same flow
    as clicking the "Begin Test" button.  This keeps the UI state in sync.
    """
    global _pending_cfd_action, _active_simulation
    _pending_cfd_action = visible
    _active_simulation = "thermal"
    if visible:
        return "CFD thermal simulation started. The Simulation panel will open with the thermal test running."
    return "CFD thermal simulation stopped."



# ── Electrical (Power Failure) simulation ─────────────────────────────────────

_pending_electrical_action: dict | None = None


def get_and_clear_electrical_action() -> dict | None:
    """Return the pending electrical test action and clear it."""
    global _pending_electrical_action
    result = _pending_electrical_action
    _pending_electrical_action = None
    return result


def start_electrical_test(
    failed_rpps: int = 0,
    load_percent: int = 50,
    edp_setting: str = "1.5",
) -> str:
    """Start the electrical power failure test with the given parameters.

    Args:
        failed_rpps:   Number of RPPs to fail (0–4).
        load_percent:  Load percentage (0–100).
        edp_setting:   EDP setting, either "1.2" or "1.5".
    """
    global _pending_electrical_action, _active_simulation
    failed_rpps = max(0, min(4, int(failed_rpps)))
    load_percent = max(0, min(100, int(load_percent)))
    if str(edp_setting) not in ("1.2", "1.5"):
        edp_setting = "1.5"
    _pending_electrical_action = {
        "playing": True,
        "failed_rpps": failed_rpps,
        "load_percent": load_percent,
        "edp_setting": str(edp_setting),
    }
    _active_simulation = "electrical"
    return (
        f"Electrical power failure test started: "
        f"{failed_rpps} failed RPP(s), {load_percent}% load, EDP {edp_setting}"
    )


def stop_electrical_test() -> str:
    """Stop the electrical power failure test."""
    global _pending_electrical_action, _active_simulation
    _pending_electrical_action = {"playing": False}
    _active_simulation = "electrical"
    return "Electrical power failure test stopped."


def set_electrical_params(
    failed_rpps: int | None = None,
    load_percent: int | None = None,
    edp_setting: str | None = None,
) -> str:
    """Update individual electrical test parameters without stopping the test.

    Only the provided parameters are changed; others keep their current values.
    """
    global _pending_electrical_action
    update: dict = {"playing": True}
    parts = []
    if failed_rpps is not None:
        update["failed_rpps"] = max(0, min(4, int(failed_rpps)))
        parts.append(f"{update['failed_rpps']} failed RPP(s)")
    if load_percent is not None:
        update["load_percent"] = max(0, min(100, int(load_percent)))
        parts.append(f"{update['load_percent']}% load")
    if edp_setting is not None:
        update["edp_setting"] = str(edp_setting) if str(edp_setting) in ("1.2", "1.5") else "1.5"
        parts.append(f"EDP {update['edp_setting']}")
    _pending_electrical_action = update
    return f"Electrical test parameters updated: {', '.join(parts)}" if parts else "No parameters changed."


# ── Site / Power configurator ─────────────────────────────────────────────────

_pending_site_action: dict | None = None
_pending_power_action: str | None = None


def get_and_clear_site_action() -> dict | None:
    """Return the pending site change and clear it."""
    global _pending_site_action
    result = _pending_site_action
    _pending_site_action = None
    return result


def get_and_clear_power_action() -> str | None:
    """Return the pending power source change and clear it."""
    global _pending_power_action
    result = _pending_power_action
    _pending_power_action = None
    return result


def set_site(country: str, region: str | None = None) -> str:
    """Set the datacenter site location.

    Args:
        country: "United States" or "Sweden"
        region:  "Virginia" or "New Mexico" (required for United States, ignored for Sweden)
    """
    global _pending_site_action
    country = country.strip()
    if country not in ("United States", "Sweden"):
        return f"Unknown country '{country}'. Expected 'United States' or 'Sweden'."
    action: dict = {"country": country}
    if country == "United States" and region:
        region = region.strip()
        if region not in ("Virginia", "New Mexico"):
            return f"Unknown region '{region}'. Expected 'Virginia' or 'New Mexico'."
        action["region"] = region
    _pending_site_action = action
    if region:
        return f"Site set to {country}, {region}."
    return f"Site set to {country}."


def set_power_source(power: str) -> str:
    """Set the power source configuration.

    Args:
        power: "Grid", "Hybrid", or "On-Prem"
    """
    global _pending_power_action
    power = power.strip()
    if power not in ("Grid", "Hybrid", "On-Prem"):
        return f"Unknown power source '{power}'. Expected 'Grid', 'Hybrid', or 'On-Prem'."
    _pending_power_action = power
    return f"Power source set to {power}."


# ── Per-RPP whip visibility ───────────────────────────────────────────────────

_pending_rpp_visibility: dict | None = None


def get_and_clear_rpp_visibility() -> dict | None:
    """Return the pending RPP visibility action and clear it."""
    global _pending_rpp_visibility
    result = _pending_rpp_visibility
    _pending_rpp_visibility = None
    return result


def hide_non_failing_rpps(failed_count: int) -> str:
    """Hide whip cables for RPPs that are NOT failing in the electrical simulation.

    RPPs are numbered 1–4. Failed RPPs (indices 1..failed_count) stay visible;
    non-failed RPPs are hidden. This highlights which RPPs are affected.

    Args:
        failed_count: Number of failed RPPs (0–4). RPPs fail in order A,B,C,D.
    """
    global _pending_rpp_visibility
    failed_count = max(0, min(4, int(failed_count)))
    rpp_visible = {}
    for rpp in range(1, 5):
        rpp_visible[rpp] = rpp <= failed_count  # failed RPPs stay visible
    _pending_rpp_visibility = rpp_visible
    if failed_count == 0:
        return "All RPP whips are now visible (no failures)."
    hidden = 4 - failed_count
    return f"Hiding {hidden} non-failing RPP whip(s). {failed_count} failed RPP(s) remain visible."


def show_all_rpp_whips() -> str:
    """Make all RPP whip cables visible again."""
    global _pending_rpp_visibility
    _pending_rpp_visibility = {1: True, 2: True, 3: True, 4: True}
    return "All RPP whips are now visible."


# ── Context-aware start/stop ─────────────────────────────────────────────────


def start_current_test() -> str:
    """Start whichever simulation is currently active (thermal or electrical).

    Use this when the user says "begin test" / "start test" without specifying
    which simulation.
    """
    if _active_simulation == "electrical":
        return start_electrical_test()
    return visualize_cfd(True)


def stop_current_test() -> str:
    """Stop whichever simulation is currently active (thermal or electrical)."""
    if _active_simulation == "electrical":
        return stop_electrical_test()
    return visualize_cfd(False)


# ── POD isolation ─────────────────────────────────────────────────────────────
# Components to HIDE when isolating the POD (everything except RPPs/whips)
_ISOLATION_HIDE = [
    "building_internal",  # /World/Assembly_Building_Internal
    "building_exterior",  # /World/Building
    "hot_aisle",          # hall_hacs
    "gpu",                # hall_GPUs_GB200
    "piping",             # hall_mech_cooling_gb300
    "cable_tray",         # hall_trays_power
    "power_cable",        # hall_powercables
    "hac_lighting",       # HAC_Lighting
]

_pending_isolation_action: dict | None = None


def get_and_clear_isolation_action() -> dict | None:
    """Return the pending isolation action and clear it."""
    global _pending_isolation_action
    result = _pending_isolation_action
    _pending_isolation_action = None
    return result


def isolate_pod_rpps() -> str:
    """Isolate the POD and show the RPPs (Remote Power Panels).

    Sets a flag that the frontend reads to hide surrounding components via
    WebRTC changeVisibility messages (same path as the UI). This avoids
    blocking Kit's event loop with direct USD writes.
    """
    global _pending_isolation_action
    hide_paths = [TOP_LEVEL_PATHS[k] for k in _ISOLATION_HIDE if k in TOP_LEVEL_PATHS]
    show_paths = [TOP_LEVEL_PATHS["rpp"], TOP_LEVEL_PATHS["whips"]]
    _pending_isolation_action = {
        "isolate": True,
        "hide": hide_paths,
        "show": show_paths,
    }
    return "Isolating POD — hiding building, HACs, racks, piping, cables. RPPs and whips remain visible."


def restore_pod_visibility() -> str:
    """Undo isolation — restore all hidden components to visible."""
    global _pending_isolation_action
    restore_paths = [TOP_LEVEL_PATHS[k] for k in _ISOLATION_HIDE if k in TOP_LEVEL_PATHS]
    _pending_isolation_action = {
        "isolate": False,
        "show": restore_paths,
    }
    return "Restoring all hidden components to visible."


def show_cdus() -> str:
    """Navigate to the CDU (Coolant Distribution Unit) camera view.

    There is no separate CDU prim to toggle visibility — CDUs are part of
    the building interior.  This function simply navigates to the CDU camera.
    """
    from .camera_utils import navigate_to_waypoint
    return navigate_to_waypoint("cdu")


def show_compute_tray() -> str:
    """Navigate to the compute tray camera view (camera_int_datahall_02)."""
    from .camera_utils import navigate_to_waypoint
    return navigate_to_waypoint("compute_tray")


def show_networking() -> str:
    """Navigate to the networking module camera view.

    There is no separate networking prim to toggle visibility — the networking
    module is part of the building interior.  This function simply navigates
    to the networking camera.
    """
    from .camera_utils import navigate_to_waypoint
    return navigate_to_waypoint("networking")


def show_component(component_name: str, visible: bool = True) -> str:
    """Show or hide a named datacenter component (CDU, RPP, cooling tower, etc.).

    The component_name is matched against TOP_LEVEL_PATHS for O(1) lookup.
    """
    try:
        print(f"[visibility] show_component('{component_name}', {visible}) called", flush=True)
        count = _set_visibility(component_name, visible)
        print(f"[visibility] show_component done: {count} prims affected", flush=True)
        return f"Component '{component_name}' {'shown' if visible else 'hidden'} ({count} prims affected)"
    except Exception as e:
        print(f"[visibility] ERROR in show_component: {e}", flush=True)
        return f"Error toggling '{component_name}': {e}"


def switch_rack_variant(variant_name: str, prim_paths: Optional[List[str]] = None) -> str:
    """Switch the GPU type between GB200 and GB300.

    Sets a deterministic flag that ``_extract_actions()`` reads to emit a
    ``gpu_change`` action.  The frontend applies the actual visibility change
    via the same ``switchGpuVisibility()`` function that the configurator
    panel's GPU dropdown uses — ensuring identical behaviour.

    For the non-stream (curl) endpoint, ``_handle_chat()`` fires the
    visibility change directly via the manager's carb message bus.

    Args:
        variant_name: Target GPU type, e.g. 'GB200' or 'GB300'.
        prim_paths:   Ignored (kept for API compatibility).

    Returns:
        Status message.
    """
    global _pending_gpu_switch, _current_gpu
    variant_name = variant_name.upper().strip()
    if variant_name not in ("GB200", "GB300"):
        return f"Unknown variant '{variant_name}'. Expected 'GB200' or 'GB300'."
    _pending_gpu_switch = variant_name
    _current_gpu = variant_name
    return f"Switched racks to GPU type '{variant_name}'"


# ── internal helpers ──────────────────────────────────────────────────────────



def _set_visibility(name_pattern: str, visible: bool) -> int:
    """Toggle visibility — uses efficient top-level path if available, else name search."""
    key = name_pattern.lower().replace(" ", "_").replace("-", "_")
    top_path = TOP_LEVEL_PATHS.get(key)
    print(f"[visibility] _set_visibility key='{key}' top_path={top_path}")
    if top_path:
        if isinstance(top_path, list):
            total = 0
            for p in top_path:
                print(f"[visibility] Setting path: {p}")
                total += _set_prim_visible_by_path(p, visible)
            return total
        return _set_prim_visible_by_path(top_path, visible)
    print(f"[visibility] Component '{name_pattern}' not in TOP_LEVEL_PATHS — skipping")
    return 0


def _set_prim_visible_by_path(prim_path: str, visible: bool) -> int:
    """Set visibility on a specific prim by path. Returns 1 if successful, 0 otherwise.

    Uses direct attribute setting instead of MakeInvisible/MakeVisible to avoid
    expensive hierarchy traversal that can block the Kit event loop for large prims.
    Skips the write if the value is already correct (prevents deadlock on re-call).
    """
    stage = omni.usd.get_context().get_stage()
    if not stage:
        return 0
    from pxr import UsdGeom
    prim = stage.GetPrimAtPath(prim_path)
    if not prim.IsValid():
        print(f"[visibility] Prim not found: {prim_path}")
        return 0
    imageable = UsdGeom.Imageable(prim)
    if imageable:
        vis_attr = imageable.GetVisibilityAttr()
        target = "inherited" if visible else "invisible"
        current = vis_attr.Get()
        if current == target:
            print(f"[visibility] SKIP (already {target}) {prim_path}")
            return 0
        vis_attr.Set(target)
        print(f"[visibility] {'Showed' if visible else 'Hid'} {prim_path}")
        return 1
    return 0
