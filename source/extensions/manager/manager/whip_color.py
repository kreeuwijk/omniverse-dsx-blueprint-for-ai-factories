"""Whip color logic for the power failure simulation.

Colors are written to the **session layer** via Usd.EditContext so they don't
collide with the composed scene layers.  Changes are applied asynchronously
(one whip group per frame) to avoid overwhelming the Hydra renderer.
"""

import asyncio

import carb.settings
import omni.kit.app
import omni.usd
from pxr import Gf, Usd, Vt

INTERACTIVE_WHIPS_ROOT = (
    "/World/assembly_Bldg_Equipment/assembly_Bldg_Equipment"
    "/DSX_Bldg_Equipement/DS9_Z0S0_BLDG_EQUIPMENT"
    "/Assembly_HAC_GPU_BLDG_SR_Interactive/interactive_whips/Interactive"
)

WHIP_GROUP_NAMES = ["whips"] + [f"whips_{i:02d}" for i in range(1, 24)]

GREEN = [0.55, 1.0, 0.31]
PURPLE = [0.50, 0.28, 0.61]
DEFAULT_COLOR = [0.3372549, 0.3372549, 0.3372549]

RPP_CAGE_MAP: dict[int, list[str]] = {
    1: ["comp_2/whip_cage_87/whip_red", "comp_2/whip_cage_89/whip_red"],
    2: ["comp_2/whip_cage_88/whip_red", "comp_2/whip_cage_90/whip_red"],
    3: ["comp_4/whip_cage_88/whip_red", "comp_4/whip_cage_90/whip_red"],
    4: ["comp_4/whip_cage_91/whip_red", "comp_4/whip_cage_89/whip_red"],
}

RTX_TRANSIENT_POST_URL = "rtx-transient/post/dlss/forceParamReset"
SETTINGS = carb.settings.get_settings()

_active_task: asyncio.Task | None = None


def _compute_color(power_draw: float, rpp_wattage: float) -> list[float]:
    if power_draw < 0:
        return GREEN
    if power_draw > rpp_wattage:
        return PURPLE
    ratio = power_draw / rpp_wattage if rpp_wattage > 0 else 0.0
    return [1.0, 1.0 - ratio, 1.0 - ratio]


def _set_color(stage: Usd.Stage, prim_path: str, color: list[float]) -> None:
    prim = stage.GetPrimAtPath(prim_path)
    if not prim or not prim.IsValid():
        return
    attr = prim.GetAttribute("primvars:displayColor")
    if attr and attr.IsValid():
        attr.Set(Vt.Vec3fArray([Gf.Vec3f(color[0], color[1], color[2])]))


async def _apply_colors(rpp_colors: dict[int, list[float]]) -> None:
    """Apply colors one whip group per frame via session layer."""
    stage = omni.usd.get_context().get_stage()
    if not stage:
        return

    for group_name in WHIP_GROUP_NAMES:
        with Usd.EditContext(stage, stage.GetSessionLayer()):
            group_base = f"{INTERACTIVE_WHIPS_ROOT}/{group_name}"
            for rpp, cage_paths in RPP_CAGE_MAP.items():
                color = rpp_colors[rpp]
                for rel_path in cage_paths:
                    _set_color(stage, f"{group_base}/{rel_path}", color)
        await omni.kit.app.get_app().next_update_async()

    SETTINGS.set_bool(RTX_TRANSIENT_POST_URL, True)  # Force DLSS to regenerate immediately.
    print("[whip_color] Applied colors to all whips")


def update_whip_colors(
    power_a: float,
    power_b: float,
    power_c: float,
    power_d: float,
    rpp_wattage: float,
) -> None:
    """Compute per-RPP colors and schedule async application."""
    global _active_task
    if _active_task and not _active_task.done():
        _active_task.cancel()

    rpp_colors = {
        1: _compute_color(power_a, rpp_wattage),
        2: _compute_color(power_b, rpp_wattage),
        3: _compute_color(power_c, rpp_wattage),
        4: _compute_color(power_d, rpp_wattage),
    }
    _active_task = asyncio.ensure_future(_apply_colors(rpp_colors))


async def _reset_colors() -> None:
    """Reset all whip cages to default gray via session layer."""
    stage = omni.usd.get_context().get_stage()
    if not stage:
        return

    for group_name in WHIP_GROUP_NAMES:
        with Usd.EditContext(stage, stage.GetSessionLayer()):
            group_base = f"{INTERACTIVE_WHIPS_ROOT}/{group_name}"
            for cage_paths in RPP_CAGE_MAP.values():
                for rel_path in cage_paths:
                    _set_color(stage, f"{group_base}/{rel_path}", DEFAULT_COLOR)
        await omni.kit.app.get_app().next_update_async()

    SETTINGS.set_bool(RTX_TRANSIENT_POST_URL, True)  # Force DLSS to regenerate immediately.
    print("[whip_color] Reset all whip colors")


def reset_whip_colors() -> None:
    """Cancel any active coloring and schedule async reset."""
    global _active_task
    if _active_task and not _active_task.done():
        _active_task.cancel()
    _active_task = asyncio.ensure_future(_reset_colors())


# ── Per-RPP whip visibility ──────────────────────────────────────────────────

async def _set_rpp_whip_visibility(
    rpp_visible: dict[int, bool],
) -> None:
    """Show/hide whip cages per RPP across all whip groups (one group per frame)."""
    stage = omni.usd.get_context().get_stage()
    if not stage:
        return
    from pxr import UsdGeom

    for group_name in WHIP_GROUP_NAMES:
        with Usd.EditContext(stage, stage.GetSessionLayer()):
            group_base = f"{INTERACTIVE_WHIPS_ROOT}/{group_name}"
            for rpp, cage_paths in RPP_CAGE_MAP.items():
                visible = rpp_visible.get(rpp, True)
                target = "inherited" if visible else "invisible"
                for rel_path in cage_paths:
                    prim = stage.GetPrimAtPath(f"{group_base}/{rel_path}")
                    if prim and prim.IsValid():
                        img = UsdGeom.Imageable(prim)
                        if img:
                            img.GetVisibilityAttr().Set(target)
        await omni.kit.app.get_app().next_update_async()

    SETTINGS.set_bool(RTX_TRANSIENT_POST_URL, True)
    print(f"[whip_color] RPP whip visibility updated: {rpp_visible}")


_visibility_task: asyncio.Task | None = None


def set_rpp_whip_visibility(rpp_visible: dict[int, bool]) -> None:
    """Schedule per-RPP whip visibility change (async, one group per frame)."""
    global _visibility_task
    if _visibility_task and not _visibility_task.done():
        _visibility_task.cancel()
    _visibility_task = asyncio.ensure_future(_set_rpp_whip_visibility(rpp_visible))
