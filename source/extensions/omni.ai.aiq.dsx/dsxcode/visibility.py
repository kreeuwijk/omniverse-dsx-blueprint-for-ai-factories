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

# ── Component search patterns ─────────────────────────────────────────────────
# Maps friendly component names to one or more search patterns.
# _set_prims_visible_by_name matches prim names that *contain* any pattern.
COMPONENT_PATTERNS = {
    "hot_aisle":           ["hall_hacs", "hac"],  # HAC = Hot Aisle Containment
    "containment":         ["hall_hacs", "hac"],
    "hac":                 ["hall_hacs", "hac"],
    "cfd":                 ["cfd", "CFD_Layer"],
    "gpu":                 ["hall_GPUs_GB200", "hall_GPUs_GB300"],
    "rack":                ["hall_GPUs_GB200", "hall_GPUs_GB300"],
    "rpp":                 ["hall_remotepowerpanels"],
    "power_panel":         ["hall_remotepowerpanels"],
    "power_cable":         ["hall_powercables"],
    "cable_tray":          ["hall_trays_power"],
    "tray":                ["hall_trays_power"],
    "cooling_gb300":       ["hall_mech_cooling_gb300"],
    "piping":              ["hall_mech_cooling_gb300"],
    "pipe":                ["hall_mech_cooling_gb300"],
    "cooling":             ["hall_mech_cooling_gb300"],
    "cooling_tower":       ["CoolingTowers", "cooling_tower"],
    "whip":                ["interactive_whips"],
    "whips":               ["interactive_whips"],
    "building_internal":   ["Assembly_Building_Internal"],
    "building_exterior":   ["Bldg_Exterior"],
}

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
GPU_GB300_PATH = f"{ASSEMBLY_BASE}/hall_GPUs_GB300_standin"


def show_hot_aisle(visible: bool = True) -> str:
    """Show or hide the hot aisle containment (HAC) in the datacenter."""
    count = _set_visibility("hot_aisle", visible)
    return f"Hot aisle {'shown' if visible else 'hidden'} ({count} prims affected)"


def show_containment(visible: bool = True) -> str:
    """Show or hide the hot aisle containment (HAC)."""
    count = _set_visibility("containment", visible)
    return f"Containment {'shown' if visible else 'hidden'} ({count} prims affected)"


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
    """Show CFD simulation results AND navigate to the dedicated CFD camera.

    This is the recommended single-call function for "Visualize the CFD results"
    prompts.  It makes the CFD layer visible and moves the camera to the
    ``cfd_camera`` viewpoint where the thermal/airflow heatmap is visible.
    """
    cfd_msg = show_cfd_results(visible)
    if visible:
        from dsxcode.camera_utils import navigate_to_waypoint
        cam_msg = navigate_to_waypoint("cfd")
        return f"{cfd_msg}. {cam_msg}"
    return cfd_msg



def isolate_pod_rpps() -> str:
    """Isolate the POD and show the RPPs (Remote Power Panels).

    TODO: Not yet implemented — multi-prim visibility changes freeze Kit's
    renderer.  See prompt_status.md Prompt 10 and skill.md for details on
    approaches tried (direct Set, Sdf.ChangeBlock, staggered deferred,
    async next_update_async, fire-and-forget with frame gaps).
    """
    return "TODO — isolate_pod_rpps is not yet implemented."


def restore_pod_visibility() -> str:
    """Undo isolation — restore all hidden components to visible.

    TODO: Not yet implemented — see isolate_pod_rpps().
    """
    return "TODO — restore_pod_visibility is not yet implemented."


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

    The component_name is matched against COMPONENT_PATTERNS first, then
    falls back to a raw substring search on prim names.
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

    This is a lightweight stub — the actual visibility switch is performed by
    the ``_extract_actions`` → ``gpu_change`` action path.  The frontend handles
    it via WebRTC ``switchVisibility()`` on the two GPU group prims, the same
    approach as the configurator panel.

    Args:
        variant_name: Target GPU type, e.g. 'GB200' or 'GB300'.
        prim_paths:   Ignored (kept for API compatibility).

    Returns:
        Status message.
    """
    variant_name = variant_name.upper().strip()
    if variant_name not in ("GB200", "GB300"):
        return f"Unknown variant '{variant_name}'. Expected 'GB200' or 'GB300'."
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
    print(f"[visibility] Falling back to name search (SLOW) for '{name_pattern}'")
    return _set_prims_visible_by_name(name_pattern, visible)


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


def _set_prims_visible_by_name(name_pattern: str, visible: bool) -> int:
    """Find prims matching a name pattern and set their visibility.

    Returns the number of prims affected.
    """
    stage = omni.usd.get_context().get_stage()
    if not stage:
        return 0

    from pxr import UsdGeom

    # Resolve search patterns
    key = name_pattern.lower().replace(" ", "_").replace("-", "_")
    patterns = COMPONENT_PATTERNS.get(key, [key])

    count = 0
    for prim in stage.Traverse():
        prim_name = prim.GetName().lower()
        if any(p.lower() in prim_name for p in patterns):
            imageable = UsdGeom.Imageable(prim)
            if imageable:
                if visible:
                    imageable.MakeVisible()
                else:
                    imageable.MakeInvisible()
                count += 1
    return count
