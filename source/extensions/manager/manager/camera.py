# manager/camera.py
from typing import Optional

from pxr import Usd, UsdGeom, Sdf
from omni.kit.viewport.utility import get_active_viewport


def find_camera_path_by_name(stage: Usd.Stage, name: str, camera_map=None) -> Optional[str]:
    """
    Find a camera prim path by name or return the path if already valid.

    Args:
        stage: The USD stage to search
        name: Camera name or full path
        camera_map: Optional dict mapping camera names to paths for fast lookup

    Returns:
        Optional[str]: Camera path if found, None otherwise
    """
    if not name:
        return None

    # Direct path lookup
    if name.startswith("/"):
        prim = stage.GetPrimAtPath(name)
        if prim and prim.IsValid() and prim.IsA(UsdGeom.Camera):
            return name
        return None

    # Use cache if available
    if camera_map is not None:
        return camera_map.get(name)

    # Fallback: traverse (original behavior)
    for prim in stage.Traverse():
        if prim.GetName() == name:
            if prim.IsA(UsdGeom.Camera) or prim.GetTypeName() == "Camera":
                return str(prim.GetPath())

    return None


def set_active_camera(stage: Usd.Stage, camera_name_or_path: str, camera_map=None):
    """
    Set the active viewport camera.

    NOTE: This works when called from Kit's event bus (e.g. WebRTC message
    handler) but will DEADLOCK if called from a coroutine on Kit's asyncio
    event loop (e.g. the agent code interpreter).  For agent-driven camera
    changes, use the ``actions`` mechanism in ``_extract_actions`` which
    sends a WebRTC message through the frontend.

    Args:
        stage: The USD stage
        camera_name_or_path: Camera name or full USD path
        camera_map: Optional dict mapping camera names to paths for fast lookup

    Returns:
        bool: True if camera was successfully set, False otherwise
    """
    if not stage:
        print("[camera] No stage loaded.")
        return False

    # Find the camera path
    cam_path = find_camera_path_by_name(stage, camera_name_or_path, camera_map=camera_map)
    if not cam_path:
        print(f"[camera] Camera not found: {camera_name_or_path}")
        return False

    # Get active viewport
    vp = get_active_viewport()
    if not vp:
        print("[camera] No active viewport found.")
        return False

    # Switch the active viewport to this camera
    print(f"[camera] Switching to camera: {cam_path}")
    vp.camera_path = Sdf.Path(cam_path)
    return True
