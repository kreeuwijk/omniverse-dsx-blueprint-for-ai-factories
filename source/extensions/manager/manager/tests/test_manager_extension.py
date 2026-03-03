"""Unit tests for manager.extension — message routing in ManagerExtension.

Mock event payloads (external WebRTC format). Use real USD stages so
handlers execute real SDK operations. Verify actual state changes.
"""

import json
from unittest.mock import MagicMock, patch

import omni.kit.test
from pxr import Usd, UsdGeom, Sdf

import manager.extension as _ext_mod


def _make_event(payload_dict):
    """Create a mock carb event with the given payload dict."""
    event = MagicMock()
    event.payload = MagicMock()
    event.payload.get_dict.return_value = payload_dict
    return event


def _make_context(stage):
    """Return a patcher for omni.usd.get_context() wrapping a real stage."""
    ctx = MagicMock()
    ctx.get_stage.return_value = stage
    return patch.object(_ext_mod.omni.usd, "get_context", return_value=ctx)


def _new_ext():
    """Create a bare ManagerExtension instance (skip on_startup)."""
    ext = _ext_mod.ManagerExtension.__new__(_ext_mod.ManagerExtension)
    ext._camera_map = None
    ext._variant_cache = None
    return ext


class TestRouteChangeGpu(omni.kit.test.AsyncTestCase):
    async def test_switches_variant(self):
        stage = Usd.Stage.CreateInMemory()
        prim = stage.DefinePrim("/World/Rack", "Xform")
        vset = prim.GetVariantSets().AddVariantSet("rackVariant")
        vset.AddVariant("GB200")
        vset.AddVariant("GB300")
        with _make_context(stage):
            _new_ext()._on_message_received(_make_event({
                "command_name": "changeGpu", "message": "GB300",
            }))
        self.assertEqual(vset.GetVariantSelection(), "GB300")


class TestRouteChangeCamera(omni.kit.test.AsyncTestCase):
    async def test_sets_viewport_camera(self):
        stage = Usd.Stage.CreateInMemory()
        UsdGeom.Camera.Define(stage, "/World/cam1")
        vp = MagicMock()
        with _make_context(stage), \
             patch.object(_ext_mod, "set_active_camera", wraps=_ext_mod.set_active_camera), \
             patch("manager.camera.get_active_viewport", return_value=vp):
            _new_ext()._on_message_received(_make_event({
                "command_name": "changeCamera", "message": "cam1",
            }))
        self.assertEqual(str(vp.camera_path), "/World/cam1")


class TestRouteChangeVisibility(omni.kit.test.AsyncTestCase):
    async def test_hides_prim(self):
        stage = Usd.Stage.CreateInMemory()
        stage.DefinePrim("/World/Cube", "Cube")
        vis_data = json.dumps({"prim_path": "/World/Cube", "visible": False})
        with _make_context(stage):
            _new_ext()._on_message_received(_make_event({
                "command_name": "changeVisibility", "message": vis_data,
            }))
        img = UsdGeom.Imageable(stage.GetPrimAtPath("/World/Cube"))
        self.assertEqual(img.GetVisibilityAttr().Get(), "invisible")

    async def test_shows_prim(self):
        stage = Usd.Stage.CreateInMemory()
        stage.DefinePrim("/World/Cube", "Cube")
        # First hide
        UsdGeom.Imageable(stage.GetPrimAtPath("/World/Cube")).MakeInvisible()
        vis_data = json.dumps({"prim_path": "/World/Cube", "visible": True})
        with _make_context(stage):
            _new_ext()._on_message_received(_make_event({
                "command_name": "changeVisibility", "message": vis_data,
            }))
        img = UsdGeom.Imageable(stage.GetPrimAtPath("/World/Cube"))
        self.assertEqual(img.GetVisibilityAttr().Get(), "inherited")


class TestRouteSetAttribute(omni.kit.test.AsyncTestCase):
    async def test_sets_attribute_value(self):
        stage = Usd.Stage.CreateInMemory()
        prim = stage.DefinePrim("/Prim", "Xform")
        prim.CreateAttribute("inputs:x", Sdf.ValueTypeNames.Double)
        attr_data = json.dumps({"prim_path": "/Prim", "attr_name": "inputs:x", "value": 42})
        with _make_context(stage):
            _new_ext()._on_message_received(_make_event({
                "command_name": "setAttribute", "message": attr_data,
            }))
        self.assertEqual(prim.GetAttribute("inputs:x").Get(), 42.0)


class TestEdgeCases(omni.kit.test.AsyncTestCase):
    async def test_no_stage(self):
        """When no stage is loaded, handlers should not be called."""
        ctx = MagicMock()
        ctx.get_stage.return_value = None
        with patch.object(_ext_mod.omni.usd, "get_context", return_value=ctx), \
             patch.object(_ext_mod, "switch_variant_architecture") as mock_sva:
            _new_ext()._on_message_received(_make_event({
                "command_name": "changeGpu", "message": "GB300",
            }))
        mock_sva.assert_not_called()

    async def test_unknown_command(self):
        """Unknown commands should not raise."""
        stage = Usd.Stage.CreateInMemory()
        with _make_context(stage):
            _new_ext()._on_message_received(_make_event({
                "command_name": "unknownCmd", "message": "",
            }))

    async def test_visibility_bad_json(self):
        """Malformed JSON in changeVisibility should not raise."""
        stage = Usd.Stage.CreateInMemory()
        with _make_context(stage):
            _new_ext()._on_message_received(_make_event({
                "command_name": "changeVisibility", "message": "NOT-JSON{{{",
            }))

    async def test_set_attribute_bad_json(self):
        """Malformed JSON in setAttribute should not raise."""
        stage = Usd.Stage.CreateInMemory()
        with _make_context(stage):
            _new_ext()._on_message_received(_make_event({
                "command_name": "setAttribute", "message": "{{bad",
            }))

    async def test_payload_as_plain_dict(self):
        """Event payload may be a plain dict (no get_dict method)."""
        stage = Usd.Stage.CreateInMemory()
        UsdGeom.Camera.Define(stage, "/World/cam2")
        vp = MagicMock()
        event = MagicMock(spec=[])
        event.payload = {"command_name": "changeCamera", "message": "cam2"}
        with _make_context(stage), \
             patch("manager.camera.get_active_viewport", return_value=vp):
            _new_ext()._on_message_received(event)
        self.assertEqual(str(vp.camera_path), "/World/cam2")

    async def test_empty_payload(self):
        """Event with no recognizable payload should not raise."""
        stage = Usd.Stage.CreateInMemory()
        event = MagicMock(spec=[])  # no payload attribute
        with _make_context(stage):
            _new_ext()._on_message_received(event)
