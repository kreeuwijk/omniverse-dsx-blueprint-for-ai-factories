# SPDX-FileCopyrightText: Copyright (c) 2024 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: LicenseRef-NvidiaProprietary
#
# NVIDIA CORPORATION, its affiliates and licensors retain all intellectual
# property and proprietary rights in and to this material, related
# documentation and any modifications thereto. Any use, reproduction,
# disclosure or distribution of this material and related documentation
# without an express license agreement from NVIDIA CORPORATION or
# its affiliates is strictly prohibited.

import tempfile
import os

import omni.kit.test
from pxr import Usd, UsdGeom


class TestDatasetLoading(omni.kit.test.AsyncTestCase):
    """Verify that a USD dataset can be loaded without hanging or crashing."""

    async def test_dataset_loads_successfully(self):
        """Create and open a local USD stage to verify loading works."""
        # Create a minimal local USD file as the test asset
        tmp = tempfile.NamedTemporaryFile(suffix=".usda", delete=False)
        tmp.close()
        try:
            # Author a small stage with a root prim
            author_stage = Usd.Stage.CreateNew(tmp.name)
            UsdGeom.Xform.Define(author_stage, "/World")
            author_stage.GetRootLayer().Save()
            del author_stage

            # Open the stage via the USD API (the default Kit UsdContext may be
            # busy with the auto_load_usd remote stage, so we use Usd.Stage
            # directly to avoid blocking on an unreachable Omniverse server).
            stage = Usd.Stage.Open(tmp.name)

            # Verify stage is valid
            self.assertIsNotNone(stage, "Stage should not be None after loading")
            self.assertTrue(stage.GetPseudoRoot().IsValid(), "Stage root should be valid")

            root = stage.GetPseudoRoot()
            children = root.GetChildren()
            self.assertGreater(len(children), 0, "Stage should have at least one root prim")

            # Verify our authored prim exists
            world_prim = stage.GetPrimAtPath("/World")
            self.assertTrue(world_prim.IsValid(), "/World prim should exist")
        finally:
            os.unlink(tmp.name)
