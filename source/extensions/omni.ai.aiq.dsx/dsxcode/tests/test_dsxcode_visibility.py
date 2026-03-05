"""Unit tests for dsxcode.visibility — datacenter component visibility controls.

Uses real USD stages with prims at the paths referenced by TOP_LEVEL_PATHS.
Patches omni.usd.get_context() to return a mock context wrapping our real
in-memory stage (avoids global side effects).
"""

from unittest.mock import MagicMock, patch

import omni.kit.test
from pxr import Usd, UsdGeom

import dsxcode.visibility as _vis_mod

# Use the same ASSEMBLY_BASE that the source module uses for TOP_LEVEL_PATHS
_AB = _vis_mod.ASSEMBLY_BASE


def _make_context(stage):
    """Return a patcher for omni.usd.get_context() wrapping a real stage."""
    ctx = MagicMock()
    ctx.get_stage.return_value = stage
    return patch.object(_vis_mod.omni.usd, "get_context", return_value=ctx)


def _get_visibility(stage, path):
    """Read the visibility attribute value from a prim."""
    prim = stage.GetPrimAtPath(path)
    if not prim.IsValid():
        return None
    img = UsdGeom.Imageable(prim)
    attr = img.GetVisibilityAttr()
    return attr.Get() if attr else None


# ── show_hot_aisle / show_containment ──────────────────────────────────────


class TestShowHotAisle(omni.kit.test.AsyncTestCase):
    async def test_show_and_hide(self):
        stage = Usd.Stage.CreateInMemory()
        hac_path = f"{_AB}/hall_hacs"
        stage.DefinePrim(hac_path, "Xform")
        with _make_context(stage):
            result_hide = _vis_mod.show_hot_aisle(False)
            self.assertIn("hidden", result_hide)
            self.assertEqual(_get_visibility(stage, hac_path), "invisible")

            result_show = _vis_mod.show_hot_aisle(True)
            self.assertIn("shown", result_show)
            self.assertEqual(_get_visibility(stage, hac_path), "inherited")


class TestShowContainment(omni.kit.test.AsyncTestCase):
    async def test_show(self):
        stage = Usd.Stage.CreateInMemory()
        stage.DefinePrim(f"{_AB}/hall_hacs", "Xform")
        with _make_context(stage):
            result = _vis_mod.show_containment(True)
        self.assertIn("shown", result)


# ── show_component ─────────────────────────────────────────────────────────


class TestShowComponent(omni.kit.test.AsyncTestCase):
    async def test_known_component_by_top_level_path(self):
        stage = Usd.Stage.CreateInMemory()
        hac_path = f"{_AB}/hall_hacs"
        stage.DefinePrim(hac_path, "Xform")
        with _make_context(stage):
            result = _vis_mod.show_component("hot_aisle", False)
        self.assertIn("hidden", result)
        self.assertEqual(_get_visibility(stage, hac_path), "invisible")

    async def test_unknown_component_skips(self):
        stage = Usd.Stage.CreateInMemory()
        stage.DefinePrim("/World/my_widget", "Xform")
        with _make_context(stage):
            result = _vis_mod.show_component("my_widget", False)
        self.assertIn("0 prims", result)

    async def test_exception_returns_error_string(self):
        with patch.object(_vis_mod, "_set_visibility", side_effect=RuntimeError("boom")), \
             patch("builtins.print"):
            result = _vis_mod.show_component("gpu", True)
        self.assertIn("boom", result)


# ── stub functions ─────────────────────────────────────────────────────────


class TestIsolationFunctions(omni.kit.test.AsyncTestCase):
    async def test_isolate_pod_rpps_sets_flag(self):
        result = _vis_mod.isolate_pod_rpps()
        self.assertIn("Isolating", result)
        action = _vis_mod.get_and_clear_isolation_action()
        self.assertIsNotNone(action)
        self.assertTrue(action["isolate"])
        self.assertGreater(len(action["hide"]), 0)
        self.assertGreater(len(action["show"]), 0)

    async def test_restore_pod_visibility_sets_flag(self):
        result = _vis_mod.restore_pod_visibility()
        self.assertIn("Restoring", result)
        action = _vis_mod.get_and_clear_isolation_action()
        self.assertIsNotNone(action)
        self.assertFalse(action["isolate"])


# ── visualize_cfd ──────────────────────────────────────────────────────────


class TestVisualizeCfd(omni.kit.test.AsyncTestCase):
    async def test_show_sets_flag(self):
        result = _vis_mod.visualize_cfd(True)
        self.assertIn("started", result)
        action = _vis_mod.get_and_clear_cfd_action()
        self.assertTrue(action)

    async def test_hide_sets_flag(self):
        result = _vis_mod.visualize_cfd(False)
        self.assertIn("stopped", result)
        action = _vis_mod.get_and_clear_cfd_action()
        self.assertFalse(action)


# ── _set_visibility ────────────────────────────────────────────────────────


class TestSetVisibility(omni.kit.test.AsyncTestCase):
    async def test_uses_top_level_path(self):
        stage = Usd.Stage.CreateInMemory()
        stage.DefinePrim(f"{_AB}/hall_hacs", "Xform")
        with _make_context(stage):
            count = _vis_mod._set_visibility("hot_aisle", True)
        self.assertGreaterEqual(count, 0)

    async def test_single_top_level_path_piping(self):
        """'piping' maps to a single path (hall_mech_cooling_gb300)."""
        stage = Usd.Stage.CreateInMemory()
        cooling_path = f"{_AB}/hall_mech_cooling_gb300"
        stage.DefinePrim(cooling_path, "Xform")
        with _make_context(stage):
            count = _vis_mod._set_visibility("piping", False)
        self.assertEqual(count, 1)
        self.assertEqual(_get_visibility(stage, cooling_path), "invisible")

    async def test_normalizes_key(self):
        stage = Usd.Stage.CreateInMemory()
        stage.DefinePrim(f"{_AB}/hall_hacs", "Xform")
        with _make_context(stage):
            count = _vis_mod._set_visibility("Hot-Aisle", False)
        self.assertEqual(count, 1)

    async def test_unknown_key_returns_zero(self):
        stage = Usd.Stage.CreateInMemory()
        stage.DefinePrim("/World/custom_thing", "Xform")
        with _make_context(stage):
            count = _vis_mod._set_visibility("custom_thing", False)
        self.assertEqual(count, 0)


# ── _set_prim_visible_by_path ──────────────────────────────────────────────


class TestSetPrimVisibleByPath(omni.kit.test.AsyncTestCase):
    async def test_no_stage(self):
        ctx = MagicMock()
        ctx.get_stage.return_value = None
        with patch.object(_vis_mod.omni.usd, "get_context", return_value=ctx):
            result = _vis_mod._set_prim_visible_by_path("/World/X", True)
        self.assertEqual(result, 0)

    async def test_prim_not_found(self):
        stage = Usd.Stage.CreateInMemory()
        with _make_context(stage):
            result = _vis_mod._set_prim_visible_by_path("/World/Missing", True)
        self.assertEqual(result, 0)

    async def test_sets_invisible(self):
        stage = Usd.Stage.CreateInMemory()
        stage.DefinePrim("/World/X", "Xform")
        with _make_context(stage):
            result = _vis_mod._set_prim_visible_by_path("/World/X", False)
        self.assertEqual(result, 1)
        self.assertEqual(_get_visibility(stage, "/World/X"), "invisible")

    async def test_sets_inherited(self):
        stage = Usd.Stage.CreateInMemory()
        stage.DefinePrim("/World/X", "Xform")
        # First hide, then show
        with _make_context(stage):
            _vis_mod._set_prim_visible_by_path("/World/X", False)
            result = _vis_mod._set_prim_visible_by_path("/World/X", True)
        self.assertEqual(result, 1)
        self.assertEqual(_get_visibility(stage, "/World/X"), "inherited")

    async def test_already_correct_value_skips(self):
        stage = Usd.Stage.CreateInMemory()
        stage.DefinePrim("/World/X", "Xform")
        with _make_context(stage):
            _vis_mod._set_prim_visible_by_path("/World/X", False)
            result = _vis_mod._set_prim_visible_by_path("/World/X", False)
        self.assertEqual(result, 0)  # no-op since already invisible


# ── switch_rack_variant (actual switch goes through WebRTC via deterministic flag)


class TestSwitchRackVariant(omni.kit.test.AsyncTestCase):
    async def test_valid_variant_gb200(self):
        result = _vis_mod.switch_rack_variant("GB200")
        self.assertIn("GB200", result)

    async def test_valid_variant_gb300(self):
        result = _vis_mod.switch_rack_variant("GB300")
        self.assertIn("GB300", result)

    async def test_case_insensitive(self):
        result = _vis_mod.switch_rack_variant("gb300")
        self.assertIn("GB300", result)

    async def test_unknown_variant(self):
        result = _vis_mod.switch_rack_variant("GB999")
        self.assertIn("Unknown", result)

    async def test_prim_paths_ignored(self):
        result = _vis_mod.switch_rack_variant("GB200", prim_paths=["/World/rack1"])
        self.assertIn("GB200", result)
