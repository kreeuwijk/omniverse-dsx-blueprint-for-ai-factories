# SPDX-FileCopyrightText: Copyright (c) 2024 NVIDIA CORPORATION & AFFILIATES.
# All rights reserved.
# SPDX-License-Identifier: LicenseRef-NvidiaProprietary
#
# NVIDIA CORPORATION, its affiliates and licensors retain all intellectual
# property and proprietary rights in and to this material, related
# documentation and any modifications thereto. Any use, reproduction,
# disclosure or distribution of this material and related documentation
# without an express license agreement from NVIDIA CORPORATION or
# its affiliates is strictly prohibited.

import json

import omni.ext
import omni.usd
import carb.events
from pxr import UsdGeom
from omni.kit.viewport.utility import get_active_viewport_camera_string

from .visibility import set_visibility_for_item
from .variant import switch_variant_architecture
from .camera import set_active_camera
from .attribute import set_prim_attribute

__all__ = ["ManagerExtension"]


def _parse_json_message(message):
    """Parse a JSON message string, returning an empty dict on failure."""
    if not message:
        return {}
    try:
        return json.loads(message)
    except (json.JSONDecodeError, TypeError):
        return {}


# Any class derived from `omni.ext.IExt` in the top level module (defined in
# `python.modules` of `extension.toml`) will be instantiated when the extension
# gets enabled, and `on_startup(ext_id)` will be called. Later when the
# extension gets disabled on_shutdown() is called.
class ManagerExtension(omni.ext.IExt):
    """Extension that routes incoming messages from the frontend to appropriate
    handler functions for camera switching, GPU variant changes, and visibility."""
    # ext_id is the current extension id. It can be used with the extension
    # manager to query additional information, like where this extension is
    # located on the filesystem.
    def on_startup(self, _ext_id):
        """This is called every time the extension is activated."""
        print("[manager] Extension startup")
        self.message_bus = omni.kit.app.get_app().get_message_bus_event_stream()
        self.subscription = self.message_bus.create_subscription_to_pop_by_type(
            carb.events.type_from_string("send_message_from_event"),
            self._on_message_received
        )

        # Subscribe to stage events for pickability and camera-state capture
        self._camera_attrs = {}
        self._camera_map = {}
        self._variant_cache = {}

        # Precompute stage event type constants
        self._EVT_OPENED = int(omni.usd.StageEventType.OPENED)
        self._EVT_ASSETS_LOADED = int(omni.usd.StageEventType.ASSETS_LOADED)

        event_stream = omni.usd.get_context().get_stage_event_stream()
        self._stage_event_sub = event_stream.create_subscription_to_pop(
            self._on_stage_event
        )

    def on_shutdown(self):
        """This is called every time the extension is deactivated. It is used
        to clean up the extension state."""
        print("[manager] Extension shutdown")
        if hasattr(self, "_stage_event_sub") and self._stage_event_sub:
            self._stage_event_sub = None
        if hasattr(self, "subscription") and self.subscription:
            self.subscription = None
        if hasattr(self, "message_bus"):
            self.message_bus = None

    def _on_stage_event(self, event):
        """Handle stage events — disable pickability and capture camera attrs."""
        if event.type in (self._EVT_OPENED, self._EVT_ASSETS_LOADED):
            ctx = omni.usd.get_context()
            stage = ctx.get_stage()
            stage_url = stage.GetRootLayer().identifier if stage else ''

            if stage_url:
                ctx.set_pickable("/", False)

                # Build camera map and variant cache on stage open
                self._camera_map = {}
                self._variant_cache = {}
                for prim in stage.Traverse():
                    if prim.IsA(UsdGeom.Camera):
                        self._camera_map[prim.GetName()] = str(prim.GetPath())
                    vs_names = prim.GetVariantSets().GetNames()
                    if vs_names:
                        self._variant_cache[str(prim.GetPath())] = vs_names

                # Only capture camera attrs on initial stage open
                if event.type == self._EVT_OPENED:
                    self._camera_attrs.clear()
                    if (prim := stage.GetPrimAtPath(get_active_viewport_camera_string())):
                        for attr in prim.GetAttributes():
                            self._camera_attrs[attr.GetName()] = attr.Get()

    def _on_message_received(self, event):
        """Route incoming messages from frontend to appropriate handler functions."""
        # Extract payload from event
        payload = {}
        if hasattr(event, 'payload'):
            if hasattr(event.payload, 'get_dict'):
                payload = event.payload.get_dict()
            elif isinstance(event.payload, dict):
                payload = event.payload

        command_name = payload.get("command_name", "")
        message = payload.get("message", "")

        print(f"[manager] Received command: {command_name}, message: {message}")
        ctx = omni.usd.get_context()
        stage = ctx.get_stage()
        if not stage:
            print("[manager] No stage loaded.")
            return
        # Route to appropriate handler based on command_name
        if command_name == "changeGpu":
            switch_variant_architecture(stage, "rackVariant", message, variant_cache=self._variant_cache)
        elif command_name == "changeCamera":
            set_active_camera(stage, message, camera_map=self._camera_map)
        elif command_name == "changeVisibility":
            # message is a JSON string: {"prim_path": "...", "visible": true/false}
            data = _parse_json_message(message)
            prim_path = data.get("prim_path", "")
            if not prim_path:
                print("[manager] changeVisibility: empty prim_path, skipping.")
                return
            visible = data.get("visible", True)
            print(f"[manager] Visibility: {prim_path} -> {'visible' if visible else 'hidden'}")
            set_visibility_for_item(stage, prim_path, bool(visible))
        elif command_name == "setAttribute":
            # message is a JSON string: {"prim_path": "...", "attr_name": "...", "value": ...}
            data = _parse_json_message(message)
            prim_path = data.get("prim_path", "")
            if not prim_path:
                print("[manager] setAttribute: empty prim_path, skipping.")
                return
            attr_name = data.get("attr_name", "")
            value = data.get("value")
            print(f"[manager] SetAttribute: {prim_path}.{attr_name} = {value}")
            set_prim_attribute(stage, prim_path, attr_name, value)
        else:
            print(f"[manager] Unknown command: {command_name}")
