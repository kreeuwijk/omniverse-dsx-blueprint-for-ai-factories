####
# USD helper functions to be imported by extension.py
####


# code plan
# 1. toggle visibility of prim using prim path
# 2. bulk toggle visibility of prims from a list of prim paths

import carb.settings
from pxr import Usd, UsdGeom

RTX_TRANSIENT_POST_URL = "rtx-transient/post/dlss/forceParamReset"
SETTINGS = carb.settings.get_settings()


def set_visibility_for_item(stage: Usd.Stage, path: str, visible: bool):
    prim = stage.GetPrimAtPath(path)
    if not prim or not prim.IsValid():
        return {"path": path, "ok": False, "error": "prim_not_found"}
    img = UsdGeom.Imageable(prim)
    if not img:
        return {"path": path, "ok": False, "error": "not_imageable"}

    vis_attr = img.GetVisibilityAttr()
    target = "inherited" if visible else "invisible"
    current = vis_attr.Get()
    if current == target:
        return {"path": path, "ok": True}

    if visible:
        img.MakeVisible()
    else:
        img.MakeInvisible()

    SETTINGS.set_bool(RTX_TRANSIENT_POST_URL, True)  # Force DLSS to regenerate immediately.
    return {"path": path, "ok": True}
