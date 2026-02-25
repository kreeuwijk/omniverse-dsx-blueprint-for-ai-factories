"""Unit tests for manager.attribute — USD prim attribute setting.

Uses real USD stages with typed attributes. No mocks.
"""

import omni.kit.test
from pxr import Usd, Sdf

from manager.attribute import set_prim_attribute


class TestSetPrimAttribute(omni.kit.test.AsyncTestCase):
    async def setUp(self):
        self.stage = Usd.Stage.CreateInMemory()
        prim = self.stage.DefinePrim("/Prim", "Xform")
        prim.CreateAttribute("inputs:level", Sdf.ValueTypeNames.Double)
        prim.CreateAttribute("inputs:count", Sdf.ValueTypeNames.Double)
        prim.CreateAttribute("inputs:name", Sdf.ValueTypeNames.String)
        prim.CreateAttribute("inputs:token", Sdf.ValueTypeNames.Token)

    async def test_set_numeric_string(self):
        result = set_prim_attribute(self.stage, "/Prim", "inputs:level", "3.14")
        self.assertTrue(result)
        attr = self.stage.GetPrimAtPath("/Prim").GetAttribute("inputs:level")
        self.assertAlmostEqual(attr.Get(), 3.14)

    async def test_set_int_value(self):
        result = set_prim_attribute(self.stage, "/Prim", "inputs:count", 7)
        self.assertTrue(result)
        attr = self.stage.GetPrimAtPath("/Prim").GetAttribute("inputs:count")
        self.assertEqual(attr.Get(), 7.0)

    async def test_set_float_value(self):
        result = set_prim_attribute(self.stage, "/Prim", "inputs:level", 2.5)
        self.assertTrue(result)
        attr = self.stage.GetPrimAtPath("/Prim").GetAttribute("inputs:level")
        self.assertEqual(attr.Get(), 2.5)

    async def test_set_non_numeric_string(self):
        result = set_prim_attribute(self.stage, "/Prim", "inputs:name", "hello")
        self.assertTrue(result)
        attr = self.stage.GetPrimAtPath("/Prim").GetAttribute("inputs:name")
        self.assertEqual(attr.Get(), "hello")

    async def test_prim_not_found(self):
        result = set_prim_attribute(self.stage, "/Missing", "attr", 1)
        self.assertFalse(result)

    async def test_attribute_not_found(self):
        result = set_prim_attribute(self.stage, "/Prim", "nonexistent", 1)
        self.assertFalse(result)

    async def test_overwrite_attribute(self):
        set_prim_attribute(self.stage, "/Prim", "inputs:level", 1.0)
        set_prim_attribute(self.stage, "/Prim", "inputs:level", 99.0)
        attr = self.stage.GetPrimAtPath("/Prim").GetAttribute("inputs:level")
        self.assertEqual(attr.Get(), 99.0)
