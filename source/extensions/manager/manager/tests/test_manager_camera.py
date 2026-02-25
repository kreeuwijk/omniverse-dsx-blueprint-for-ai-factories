"""Unit tests for manager.camera — camera lookup and viewport switching.

Uses real USD stages with Camera prims. Only the viewport is mocked
(no display in headless Kit).
"""

from unittest.mock import MagicMock, patch

import omni.kit.test
from pxr import Usd, UsdGeom, Sdf

from manager.camera import find_camera_path_by_name, set_active_camera
import manager.camera as _cam_mod


class TestFindCameraPathByName(omni.kit.test.AsyncTestCase):
    async def setUp(self):
        self.stage = Usd.Stage.CreateInMemory()
        UsdGeom.Camera.Define(self.stage, "/World/cam1")
        UsdGeom.Camera.Define(self.stage, "/World/A/cam")
        UsdGeom.Camera.Define(self.stage, "/World/B/cam")
        self.stage.DefinePrim("/World/cube", "Mesh")

    async def test_full_path_valid_camera(self):
        result = find_camera_path_by_name(self.stage, "/World/cam1")
        self.assertEqual(result, "/World/cam1")

    async def test_full_path_not_camera(self):
        result = find_camera_path_by_name(self.stage, "/World/cube")
        self.assertIsNone(result)

    async def test_full_path_invalid(self):
        result = find_camera_path_by_name(self.stage, "/World/nonexistent")
        self.assertIsNone(result)

    async def test_find_by_name(self):
        result = find_camera_path_by_name(self.stage, "cam1")
        self.assertEqual(result, "/World/cam1")

    async def test_name_not_found(self):
        result = find_camera_path_by_name(self.stage, "missing_cam")
        self.assertIsNone(result)

    async def test_name_matches_non_camera_prim(self):
        result = find_camera_path_by_name(self.stage, "cube")
        self.assertIsNone(result)

    async def test_first_camera_match_wins(self):
        """When two cameras share a name, the first in traversal order wins."""
        result = find_camera_path_by_name(self.stage, "cam")
        self.assertIn(result, ["/World/A/cam", "/World/B/cam"])


class TestSetActiveCamera(omni.kit.test.AsyncTestCase):
    def _patch_viewport(self, viewport_mock=None):
        return patch.object(_cam_mod, "get_active_viewport", return_value=viewport_mock)

    async def test_successful_switch(self):
        stage = Usd.Stage.CreateInMemory()
        UsdGeom.Camera.Define(stage, "/World/cam1")
        vp = MagicMock()
        with self._patch_viewport(vp):
            result = set_active_camera(stage, "cam1")
        self.assertTrue(result)
        self.assertEqual(str(vp.camera_path), "/World/cam1")

    async def test_no_stage(self):
        with self._patch_viewport(MagicMock()):
            result = set_active_camera(None, "cam1")
        self.assertFalse(result)

    async def test_camera_not_found(self):
        stage = Usd.Stage.CreateInMemory()
        with self._patch_viewport(MagicMock()):
            result = set_active_camera(stage, "nonexistent")
        self.assertFalse(result)

    async def test_no_active_viewport(self):
        stage = Usd.Stage.CreateInMemory()
        UsdGeom.Camera.Define(stage, "/World/cam1")
        with self._patch_viewport(None):
            result = set_active_camera(stage, "cam1")
        self.assertFalse(result)

    async def test_full_path_camera(self):
        stage = Usd.Stage.CreateInMemory()
        UsdGeom.Camera.Define(stage, "/World/cam1")
        vp = MagicMock()
        with self._patch_viewport(vp):
            result = set_active_camera(stage, "/World/cam1")
        self.assertTrue(result)
