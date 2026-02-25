# SPDX-FileCopyrightText: Copyright (c) 2025 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: LicenseRef-NvidiaProprietary
#
# NVIDIA CORPORATION, its affiliates and licensors retain all intellectual
# property and proprietary rights in and to this material, related
# documentation and any modifications thereto. Any use, reproduction,
# disclosure or distribution of this material and related documentation
# without an express license agreement from NVIDIA CORPORATION or
# its affiliates is strictly prohibited.

import asyncio
from logging import getLogger

import numpy as np
import warp as wp
from omni.cae.data import array_utils, cache, progress, usd_utils
from omni.cae.data.commands import ComputeBounds, ConvertToPointCloud, PointCloud
from omni.cae.schema import cae
from pxr import Gf

from . import utils

logger = getLogger(__name__)


class CaeSimhRegionConvertToPointCloud(ConvertToPointCloud):

    async def do(self):
        logger.info("executing %s.do()", self.__class__.__name__)

        timeCode = self.timeCode
        # logger.error("timeCode: %s", timeCode)

        if not self.dataset.HasAPI("CaeSimhRegionAPI"):
            raise usd_utils.QuietableException("Dataset (%s) does not support CaeSimhRegionAPI!" % self.dataset)

        cell_field_prims = {}
        point_field_prims = {}

        for fieldName in self.fields:
            fieldPrim = usd_utils.get_target_prim(self.dataset, f"field:{fieldName}")
            if not fieldPrim.IsA(cae.FieldArray):
                raise usd_utils.QuietableException("Invalid field prim " % fieldPrim)

            assc = usd_utils.get_attribute(fieldPrim, cae.Tokens.fieldAssociation, timeCode)
            if assc == cae.Tokens.cell:
                cell_field_prims[fieldName] = fieldPrim
            elif assc == cae.Tokens.vertex:
                point_field_prims[fieldName] = fieldPrim
            else:
                raise usd_utils.QuietableException("Invalid field association (%s) detected for %s" % (assc, fieldPrim))

        result = PointCloud()

        with progress.ProgressContext("Reading coordinates", scale=0.2):
            result.points = await usd_utils.get_vecN_from_relationship(self.dataset, "cae:simh:coord", 3, timeCode)

        with progress.ProgressContext("Reading point fields", shift=0.1, scale=0.4):
            for fieldName, fieldPrim in point_field_prims.items():
                fieldData = await usd_utils.get_array(fieldPrim, timeCode)
                assert fieldData.shape[0] == result.points.shape[0]
                result.fields[fieldName] = fieldData

        with progress.ProgressContext("Reading cell fields", shift=0.6, scale=0.4) and wp.ScopedDevice("cpu"):
            cell_fields = await utils.get_cell_field_as_point(
                self.dataset, cell_field_prims.values(), result.points.shape[0], timeCode
            )
            for fieldName, fieldData in zip(cell_field_prims.keys(), cell_fields):
                result.fields[fieldName] = fieldData

        return result


class CaeSimhBoundaryConvertToPointCloud(ConvertToPointCloud):

    async def do(self):
        logger.info("executing %s.do()", self.__class__.__name__)

        timeCode = self.timeCode
        # logger.error("timeCode: %s", timeCode)

        if not self.dataset.HasAPI("CaeSimhBoundaryAPI"):
            raise usd_utils.QuietableException("Dataset (%s) does not support simh.BoundaryAPI!" % self.dataset)

        cell_field_prims = {}
        point_field_prims = {}

        for fieldName in self.fields:
            fieldPrim = usd_utils.get_target_prim(self.dataset, f"field:{fieldName}")
            if not fieldPrim.IsA(cae.FieldArray):
                raise usd_utils.QuietableException("Invalid field prim " % fieldPrim)

            assc = usd_utils.get_attribute(fieldPrim, cae.Tokens.fieldAssociation, timeCode)
            if assc == cae.Tokens.cell:
                cell_field_prims[fieldName] = fieldPrim
            elif assc == cae.Tokens.vertex:
                point_field_prims[fieldName] = fieldPrim
            else:
                raise usd_utils.QuietableException("Invalid field association (%s) detected for %s" % (assc, fieldPrim))

        result = PointCloud()

        # get vertex list, that's what we need to determine vertex ids used by this boundary
        vertex_list: np.ndarray = array_utils.as_numpy_array(
            await usd_utils.get_array_from_relationship(self.dataset, "cae:simh:vertexList", timeCode)
        )
        vertex_list = np.unique(vertex_list)

        coords: np.ndarray = array_utils.as_numpy_array(
            await usd_utils.get_vecN_from_relationship(self.dataset, "cae:simh:coord", 3, timeCode)
        )
        result.points = coords[vertex_list]

        if len(cell_field_prims) > 0:
            raise usd_utils.QuietableException("Cell fields are not supported for boundary datasets")

        for fieldName, fieldPrim in point_field_prims.items():
            fieldData = array_utils.as_numpy_array(await usd_utils.get_array(fieldPrim, timeCode))[vertex_list]
            assert fieldData.shape[0] == result.points.shape[0]
            result.fields[fieldName] = fieldData

        return result


class CaeSimhComputeBounds(ComputeBounds):

    async def do(self):
        logger.info("executing %s.do()", self.__class__.__name__)

        timeCode = self.timeCode
        # logger.error("timeCode: %s", timeCode)

        with progress.ProgressContext("Reading coordinates", scale=0.8):
            pc = await ConvertToPointCloud.invoke(self.dataset, fields=[], timeCode=timeCode)

        with progress.ProgressContext("Computing bounds", shift=0.8, scale=0.2):
            min, max = await asyncio.gather(
                asyncio.to_thread(np.min, pc.points, axis=0), asyncio.to_thread(np.max, pc.points, axis=0)
            )

        return Gf.Range3d(Gf.Vec3d(min.tolist()), Gf.Vec3d(max.tolist()))


class CaeSimhBoundaryComputeBounds(CaeSimhComputeBounds):
    pass


class CaeSimhRegionComputeBounds(CaeSimhComputeBounds):
    pass
