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
import carb.eventdispatcher
from pxr import Usd, UsdGeom
from omni.kit.viewport.utility import get_active_viewport_camera_string

from .visibility import set_visibility_for_item
from .variant import switch_variant_architecture
from .camera import set_active_camera
from .attribute import set_prim_attribute
from .whip_color import update_whip_colors, reset_whip_colors, set_rpp_whip_visibility

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
    _RECEIVE_EVENT = "omni.kit.livestream.receive_message"

    def on_startup(self, _ext_id):
        """This is called every time the extension is activated."""
        print("[manager] Extension startup")

        # Register an event alias so carb.eventdispatcher can observe events
        # originally fired on the old carb.events message bus by the WebRTC
        # streaming layer.  This is the same alias that
        # omni.kit.livestream.messaging would have registered.
        self._registered_alias = False
        event_type = carb.events.type_from_string(self._RECEIVE_EVENT)
        if omni.kit.app.register_event_alias(event_type, self._RECEIVE_EVENT):
            self._registered_alias = True

        # Subscribe directly to raw WebRTC messages so we don't need the
        # omni.kit.livestream.messaging extension (which is only on the
        # internal NVIDIA registry and breaks off-VPN builds).
        self._webrtc_sub = carb.eventdispatcher.get_eventdispatcher().observe_event(
            event_name=self._RECEIVE_EVENT,
            on_event=self._on_webrtc_message,
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
        if hasattr(self, "_webrtc_sub") and self._webrtc_sub:
            self._webrtc_sub.reset()
            self._webrtc_sub = None
        if self._registered_alias:
            event_type = carb.events.type_from_string(self._RECEIVE_EVENT)
            carb.events.unregister_event_alias(
                event_type, f"{self._RECEIVE_EVENT}:immediate", self._RECEIVE_EVENT
            )
            self._registered_alias = False

    def _on_stage_event(self, event):
        """Handle stage events — disable pickability and capture camera attrs."""
        if event.type in (self._EVT_OPENED, self._EVT_ASSETS_LOADED):
            ctx = omni.usd.get_context()
            stage = ctx.get_stage()
            stage_url = stage.GetRootLayer().identifier if stage else ''

            if stage_url:
                ctx.set_pickable("/", False)

                # Build camera map and variant cache on stage open,
                # and hide mesh geometry under camera prims so the camera
                # models don't render (the viewport "scene.cameras.visible"
                # setting only controls the wireframe gizmo, not authored meshes).
                self._camera_map = {}
                self._variant_cache = {}
                for prim in stage.Traverse():
                    if prim.IsA(UsdGeom.Camera):
                        self._camera_map[prim.GetName()] = str(prim.GetPath())
                        for desc in Usd.PrimRange(prim):
                            if desc != prim and desc.IsA(UsdGeom.Gprim):
                                UsdGeom.Imageable(desc).MakeInvisible()
                    vs_names = prim.GetVariantSets().GetNames()
                    if vs_names:
                        self._variant_cache[str(prim.GetPath())] = vs_names

                # Only capture camera attrs on initial stage open
                if event.type == self._EVT_OPENED:
                    self._camera_attrs.clear()
                    if (prim := stage.GetPrimAtPath(get_active_viewport_camera_string())):
                        for attr in prim.GetAttributes():
                            self._camera_attrs[attr.GetName()] = attr.Get()

    def _on_webrtc_message(self, event):
        """Bridge raw WebRTC messages into the command router.

        Replaces the omni.kit.livestream.messaging extension: parses the JSON
        envelope from the WebRTC data channel and dispatches the inner payload
        to _route_command().
        """
        if "message" not in event.payload:
            return
        try:
            event_dict = json.loads(event.payload["message"])
        except (json.JSONDecodeError, TypeError):
            return
        if event_dict.get("event_type") != "send_message_from_event":
            return
        payload = event_dict.get("payload")
        if payload:
            self._route_command(payload)

    def _route_command(self, payload):
        """Route a command payload from the frontend to the appropriate handler."""
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
        elif command_name == "powerFailure":
            data = _parse_json_message(message)
            playing = data.get("playing", False)
            if playing:
                power_a = float(data.get("powerA", 0))
                power_b = float(data.get("powerB", 0))
                power_c = float(data.get("powerC", 0))
                power_d = float(data.get("powerD", 0))
                rpp_wattage = float(data.get("rppWattage", 500))
                print(f"[manager] Power failure: A={power_a}, B={power_b}, C={power_c}, D={power_d}, RPP={rpp_wattage}")
                update_whip_colors(power_a, power_b, power_c, power_d, rpp_wattage)
            else:
                print("[manager] Power failure test stopped, resetting whip colors.")
                reset_whip_colors()
        elif command_name == "rppWhipVisibility":
            data = _parse_json_message(message)
            rpp_visible = {int(k): bool(v) for k, v in data.items()}
            print(f"[manager] RPP whip visibility: {rpp_visible}")
            set_rpp_whip_visibility(rpp_visible)
        else:
            print(f"[manager] Unknown command: {command_name}")
