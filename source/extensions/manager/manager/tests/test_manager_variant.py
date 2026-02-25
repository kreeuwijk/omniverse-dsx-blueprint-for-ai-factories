"""Unit tests for manager.variant — USD variant set switching.

Uses real USD stages with variant sets. No mocks.
"""

import omni.kit.test
from pxr import Usd, Sdf

from manager.variant import (
    find_variantset_authoring_layer,
    switch_variant_selection,
    switch_variant_architecture,
)


def _make_stage_with_variants(variant_set_name="rackVariant", variants=None):
    """Create an in-memory stage with a prim that has a variant set."""
    variants = variants or ["GB200", "GB300"]
    stage = Usd.Stage.CreateInMemory()
    prim = stage.DefinePrim("/World/Rack", "Xform")
    vsets = prim.GetVariantSets()
    vset = vsets.AddVariantSet(variant_set_name)
    for v in variants:
        vset.AddVariant(v)
    return stage, prim, vset


class TestSwitchVariantSelection(omni.kit.test.AsyncTestCase):
    async def test_successful_switch(self):
        stage, prim, vset = _make_stage_with_variants()
        result = switch_variant_selection(prim, vset, ["GB200", "GB300"], "GB200")
        self.assertTrue(result)
        self.assertEqual(vset.GetVariantSelection(), "GB200")

    async def test_switch_to_second_variant(self):
        stage, prim, vset = _make_stage_with_variants()
        switch_variant_selection(prim, vset, ["GB200", "GB300"], "GB200")
        result = switch_variant_selection(prim, vset, ["GB200", "GB300"], "GB300")
        self.assertTrue(result)
        self.assertEqual(vset.GetVariantSelection(), "GB300")

    async def test_variant_not_in_list(self):
        stage, prim, vset = _make_stage_with_variants()
        result = switch_variant_selection(prim, vset, ["GB200", "GB300"], "GB400")
        self.assertFalse(result)

    async def test_empty_variants_list(self):
        stage, prim, vset = _make_stage_with_variants()
        result = switch_variant_selection(prim, vset, [], "GB200")
        self.assertFalse(result)


class TestFindVariantsetAuthoringLayer(omni.kit.test.AsyncTestCase):
    async def test_finds_root_layer(self):
        stage, prim, _ = _make_stage_with_variants()
        layer = find_variantset_authoring_layer(prim, "rackVariant")
        self.assertIsNotNone(layer)
        self.assertEqual(layer, stage.GetRootLayer())

    async def test_variant_set_not_found(self):
        stage, prim, _ = _make_stage_with_variants()
        layer = find_variantset_authoring_layer(prim, "nonexistentVariant")
        self.assertIsNone(layer)

    async def test_prim_without_variants(self):
        stage = Usd.Stage.CreateInMemory()
        prim = stage.DefinePrim("/World/Plain", "Xform")
        layer = find_variantset_authoring_layer(prim, "rackVariant")
        self.assertIsNone(layer)


class TestSwitchVariantArchitecture(omni.kit.test.AsyncTestCase):
    async def test_successful_switch(self):
        stage, prim, vset = _make_stage_with_variants()
        result = switch_variant_architecture(stage, "rackVariant", "GB200")
        self.assertTrue(result)
        self.assertEqual(vset.GetVariantSelection(), "GB200")

    async def test_switch_updates_selection(self):
        stage, prim, vset = _make_stage_with_variants()
        switch_variant_architecture(stage, "rackVariant", "GB200")
        switch_variant_architecture(stage, "rackVariant", "GB300")
        self.assertEqual(vset.GetVariantSelection(), "GB300")

    async def test_no_stage(self):
        result = switch_variant_architecture(None, "rackVariant", "GB200")
        self.assertFalse(result)

    async def test_no_matching_variant_set(self):
        stage, _, _ = _make_stage_with_variants()
        result = switch_variant_architecture(stage, "nonexistent", "GB200")
        self.assertFalse(result)

    async def test_variant_name_not_found(self):
        stage, _, _ = _make_stage_with_variants()
        result = switch_variant_architecture(stage, "rackVariant", "GB999")
        self.assertFalse(result)

    async def test_multiple_prims_with_variant_set(self):
        stage = Usd.Stage.CreateInMemory()
        for name in ["/World/Rack1", "/World/Rack2"]:
            prim = stage.DefinePrim(name, "Xform")
            vset = prim.GetVariantSets().AddVariantSet("rackVariant")
            vset.AddVariant("GB200")
            vset.AddVariant("GB300")
        result = switch_variant_architecture(stage, "rackVariant", "GB300")
        self.assertTrue(result)
        for name in ["/World/Rack1", "/World/Rack2"]:
            prim = stage.GetPrimAtPath(name)
            sel = prim.GetVariantSets().GetVariantSet("rackVariant").GetVariantSelection()
            self.assertEqual(sel, "GB300")

    async def test_empty_stage(self):
        stage = Usd.Stage.CreateInMemory()
        result = switch_variant_architecture(stage, "rackVariant", "GB200")
        self.assertFalse(result)
