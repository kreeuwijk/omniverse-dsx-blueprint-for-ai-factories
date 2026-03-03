"""DSX scene query helpers for the KitInfo agent.

Read-only functions for querying datacenter scene structure, finding prims,
and retrieving component information.
"""

from typing import List, Optional, Dict
import omni.usd

# ── Component search aliases ──────────────────────────────────────────────────
# Maps friendly names → list of prim-name substrings to search for.
# Aligned with DSX_BP scene (Assembly_HAC_GPU_BLDG_SR_Interactive hierarchy).
_COMPONENT_ALIASES: Dict[str, List[str]] = {
    # Hot Aisle Containment
    "hot_aisle":      ["hall_hacs", "hac"],
    "containment":    ["hall_hacs", "hac"],
    "hac":            ["hall_hacs", "hac"],
    # Racks / GPUs — two groups: hall_GPUs_GB200 and hall_GPUs_GB300_standin
    "rack":           ["hall_GPUs_GB200", "hall_GPUs_GB300"],
    "gpu":            ["hall_GPUs_GB200", "hall_GPUs_GB300"],
    "deployment_unit":["hall_GPUs_GB200", "hall_GPUs_GB300"],
    # Power
    "rpp":            ["hall_remotepowerpanels", "remotepowerpanel"],
    "power_panel":    ["hall_remotepowerpanels", "remotepowerpanel"],
    "power_cable":    ["hall_powercables", "powercable"],
    "cable_tray":     ["hall_trays_power", "trays_power"],
    "tray":           ["hall_trays_power", "trays_power"],
    "whip":           ["interactive_whips"],
    "whips":          ["interactive_whips"],
    # Cooling / piping
    "piping":         ["hall_mech_cooling", "mech_cooling"],
    "pipe":           ["hall_mech_cooling", "mech_cooling"],
    "cooling":        ["hall_mech_cooling", "mech_cooling"],
    "cooling_gb300":  ["hall_mech_cooling_gb300"],
    "cooling_tower":  ["CoolingTowers", "cooling_tower"],
    # CFD
    "cfd":            ["cfd", "CFD_Layer"],
    "simulation":     ["cfd", "CFD_Layer", "SinglePOD"],
    # CDU / Networking
    "cdu":            ["cdu", "CDU", "VCDU"],
    "networking":     ["networking"],
    # Building
    "building":       ["Assembly_Building_Internal", "Building"],
    "building_internal": ["Assembly_Building_Internal"],
    "building_exterior": ["Bldg_Exterior"],
    # Site
    "site":           ["assembly_Site"],
    "site_equipment": ["Site_Equipement", "SITE_EQUIPMENT"],
}

# ── Scene cache ──────────────────────────────────────────────────────────────
# Single-pass traversal cache, invalidated when the stage object changes.
_scene_cache: Dict = {"stage_id": None, "components": {}, "cameras": []}


def _invalidate_cache() -> None:
    """Force the cache to rebuild on next access."""
    _scene_cache["stage_id"] = None


def _ensure_cache():
    """Rebuild the cache with a single stage traversal if the stage has changed.

    Returns:
        The current stage, or ``None`` if no stage is loaded.
    """
    stage = omni.usd.get_context().get_stage()
    if not stage:
        return None

    stage_id = id(stage)
    if _scene_cache["stage_id"] == stage_id:
        return stage

    # Rebuild via a single traversal
    from pxr import UsdGeom

    _scene_cache["stage_id"] = stage_id
    _scene_cache["cameras"] = []
    _scene_cache["components"] = {}

    for prim in stage.Traverse():
        # Cameras
        if prim.IsA(UsdGeom.Camera):
            _scene_cache["cameras"].append(str(prim.GetPath()))

        # Component categories — each prim counts for at most one key
        name = prim.GetName().lower()
        for key, patterns in _COMPONENT_ALIASES.items():
            if any(p.lower() in name for p in patterns):
                _scene_cache["components"].setdefault(key, []).append(
                    str(prim.GetPath())
                )
                break

    return stage


def find_datacenter_components(component_type: str) -> List[str]:
    """Find all prims of a given datacenter component type.

    Args:
        component_type: Type to search for.  Accepts friendly names like
            'rack', 'gpu', 'rpp', 'hot_aisle', 'hac', 'containment',
            'piping', 'cooling', 'cooling_gb300',
            'power_cable', 'cable_tray', 'cfd', 'cdu', 'networking',
            'building', 'site', or any raw substring.

    Returns:
        List of prim paths matching the component type.
    """
    stage = _ensure_cache()
    if not stage:
        return []

    key = component_type.lower().replace(" ", "_").replace("-", "_")

    # If the key is a known alias, return from the cache directly
    if key in _COMPONENT_ALIASES:
        return list(_scene_cache["components"].get(key, []))

    # Fallback for raw substrings not in _COMPONENT_ALIASES: search the
    # cached prim paths to avoid a fresh traversal where possible, but fall
    # back to a real traversal when the substring doesn't match any cached key.
    patterns = [key]
    results = []
    for prim in stage.Traverse():
        prim_name = prim.GetName().lower()
        if any(p.lower() in prim_name for p in patterns):
            results.append(str(prim.GetPath()))
    return results


def list_cameras() -> List[str]:
    """List all camera prims in the scene.

    Returns:
        List of full prim paths for every Camera in the stage.
    """
    stage = _ensure_cache()
    if not stage:
        return []

    return list(_scene_cache["cameras"])


def get_prim_info(prim_path: str) -> dict:
    """Get basic information about a prim (type, visibility, children count, variant sets)."""
    stage = omni.usd.get_context().get_stage()
    if not stage:
        return {"error": "No stage loaded"}

    prim = stage.GetPrimAtPath(prim_path)
    if not prim.IsValid():
        return {"error": f"Prim not found: {prim_path}"}

    from pxr import UsdGeom

    imageable = UsdGeom.Imageable(prim)

    # Variant sets
    variant_info = {}
    vs_names = prim.GetVariantSets().GetNames()
    for vs_name in vs_names:
        vs = prim.GetVariantSets().GetVariantSet(vs_name)
        variant_info[vs_name] = {
            "current": vs.GetVariantSelection(),
            "options": vs.GetVariantNames(),
        }

    return {
        "path": str(prim.GetPath()),
        "type": str(prim.GetTypeName()),
        "name": prim.GetName(),
        "visible": imageable.ComputeVisibility() != UsdGeom.Tokens.invisible if imageable else None,
        "children_count": len(prim.GetChildren()),
        "variant_sets": variant_info if variant_info else None,
    }


def find_variant_prims(variant_set_name: str = "rackVariant") -> List[dict]:
    """Find all prims that have a specific variant set.

    Args:
        variant_set_name: Name of the variant set to search for (default: 'rackVariant').

    Returns:
        List of dicts with 'path', 'current_variant', and 'available_variants'.
    """
    stage = omni.usd.get_context().get_stage()
    if not stage:
        return []

    results = []
    for prim in stage.Traverse():
        vs = prim.GetVariantSets()
        if vs.HasVariantSet(variant_set_name):
            variant_set = vs.GetVariantSet(variant_set_name)
            results.append({
                "path": str(prim.GetPath()),
                "current_variant": variant_set.GetVariantSelection(),
                "available_variants": variant_set.GetVariantNames(),
            })
    return results


def get_scene_summary() -> dict:
    """Get a high-level summary of the datacenter scene.

    Returns:
        Dict with counts per component type and camera count.
    """
    stage = _ensure_cache()
    if not stage:
        return {}

    summary = {}
    for comp_type in _COMPONENT_ALIASES:
        summary[comp_type] = len(_scene_cache["components"].get(comp_type, []))
    summary["cameras"] = len(_scene_cache["cameras"])
    return summary
