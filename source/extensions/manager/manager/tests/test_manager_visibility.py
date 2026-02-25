"""Unit tests for manager.visibility — USD prim visibility toggling.

Uses real USD stages with Imageable prims. No mocks.
"""

import omni.kit.test
from pxr import Usd, UsdGeom

from manager.visibility import set_visibility_for_item


class TestSetVisibilityForItem(omni.kit.test.AsyncTestCase):
    async def setUp(self):
        self.stage = Usd.Stage.CreateInMemory()
        self.stage.DefinePrim("/World/Cube", "Cube")
        self.stage.DefinePrim("/World/Xform", "Xform")

    async def test_make_invisible(self):
        result = set_visibility_for_item(self.stage, "/World/Cube", False)
        self.assertEqual(result, {"path": "/World/Cube", "ok": True})
        img = UsdGeom.Imageable(self.stage.GetPrimAtPath("/World/Cube"))
        self.assertEqual(img.GetVisibilityAttr().Get(), "invisible")

    async def test_make_visible(self):
        # First hide it, then show it
        set_visibility_for_item(self.stage, "/World/Cube", False)
        result = set_visibility_for_item(self.stage, "/World/Cube", True)
        self.assertEqual(result, {"path": "/World/Cube", "ok": True})
        img = UsdGeom.Imageable(self.stage.GetPrimAtPath("/World/Cube"))
        self.assertEqual(img.GetVisibilityAttr().Get(), "inherited")

    async def test_xform_prim(self):
        """Xform prims are also Imageable."""
        result = set_visibility_for_item(self.stage, "/World/Xform", False)
        self.assertTrue(result["ok"])
        img = UsdGeom.Imageable(self.stage.GetPrimAtPath("/World/Xform"))
        self.assertEqual(img.GetVisibilityAttr().Get(), "invisible")

    async def test_prim_not_found(self):
        result = set_visibility_for_item(self.stage, "/World/Missing", True)
        self.assertFalse(result["ok"])
        self.assertEqual(result["error"], "prim_not_found")

    async def test_double_hide_is_idempotent(self):
        set_visibility_for_item(self.stage, "/World/Cube", False)
        result = set_visibility_for_item(self.stage, "/World/Cube", False)
        self.assertTrue(result["ok"])
        img = UsdGeom.Imageable(self.stage.GetPrimAtPath("/World/Cube"))
        self.assertEqual(img.GetVisibilityAttr().Get(), "invisible")
