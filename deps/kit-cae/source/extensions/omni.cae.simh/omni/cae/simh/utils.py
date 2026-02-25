# SPDX-FileCopyrightText: Copyright (c) 2025 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: LicenseRef-NvidiaProprietary
#
# NVIDIA CORPORATION, its affiliates and licensors retain all intellectual
# property and proprietary rights in and to this material, related
# documentation and any modifications thereto. Any use, reproduction,
# disclosure or distribution of this material and related documentation
# without an express license agreement from NVIDIA CORPORATION or
# its affiliates is strictly prohibited.

from logging import getLogger
from typing import Any

import numpy as np
import warp as wp
from omni.cae.data import array_utils, usd_utils
from omni.cae.schema import simh
from pxr import Usd

logger = getLogger(__name__)


def compute_offsets(lengths) -> np.ndarray:
    lengths = array_utils.as_numpy_array(lengths)
    offsets = np.empty(len(lengths) + 1, dtype=np.uint32)
    offsets[0] = 0
    offsets[1:] = np.cumsum(lengths)
    return offsets


@wp.kernel
def kernel_cell_2_vtx_boundary(
    vtx_list_offsets: wp.array(dtype=wp.uint32),
    vtx_list: wp.array(dtype=wp.uint32),
    face_cell_index: wp.array(ndim=2, dtype=wp.uint32),
    counts: wp.array(dtype=wp.int32),
    cell_data0: wp.array(dtype=wp.float32),
    vtx_data0: wp.array(dtype=wp.float32),
):
    face_id = wp.tid()
    start_offset = wp.int32(vtx_list_offsets[face_id])
    end_offset = wp.int32(vtx_list_offsets[face_id + 1])
    cell_id_plus = face_cell_index[face_id][0]

    for i in range(start_offset, end_offset):
        vtx_id = wp.int32(vtx_list[i])
        wp.atomic_add(vtx_data0, vtx_id, cell_data0[cell_id_plus])
        wp.atomic_add(counts, vtx_id, wp.int32(1))


@wp.kernel
def kernel_cell_2_vtx_internal(
    vtx_list_offsets: wp.array(dtype=wp.uint32),
    vtx_list: wp.array(dtype=wp.uint32),
    face_cell_index: wp.array(ndim=2, dtype=wp.uint32),
    counts: wp.array(dtype=wp.int32),
    cell_data0: wp.array(dtype=wp.float32),
    vtx_data0: wp.array(dtype=wp.float32),
):
    face_id = wp.tid()
    start_offset = wp.int32(vtx_list_offsets[face_id])
    end_offset = wp.int32(vtx_list_offsets[face_id + 1])
    cell_id = face_cell_index[face_id]

    for i in range(start_offset, end_offset):
        vtx_id = wp.int32(vtx_list[i])
        wp.atomic_add(vtx_data0, vtx_id, cell_data0[cell_id[0]])
        wp.atomic_add(vtx_data0, vtx_id, cell_data0[cell_id[1]])
        wp.atomic_add(counts, vtx_id, wp.int32(2))


@wp.kernel
def reduce_1d(point_array: wp.array(dtype=wp.float32), counts: wp.array(dtype=wp.int32)):
    tid = wp.tid()
    count = wp.float32(counts[tid])
    if count > 0.0:
        point_array[tid] = point_array[tid] / count


async def get_cell_field_as_point(
    regionPrim: Usd.Prim, fieldPrims: list[Usd.Prim], nb_verts: int, timeCode: Usd.TimeCode
) -> list[wp.array]:

    fieldPrims = list(fieldPrims)
    if len(fieldPrims) == 0:
        return []

    assert len(fieldPrims) == 1, "only one field is supported currently"

    # read the field data
    cell_data = []
    for fieldPrim in fieldPrims:
        logger.warning("reading %s", fieldPrim)
        cell_data.append(wp.array(await usd_utils.get_array(fieldPrim, timeCode), copy=False))

    vtx_data = [wp.zeros(nb_verts, dtype=array.dtype) for array in cell_data]
    counts = wp.zeros(nb_verts, dtype=wp.int32)

    boundaryPrims = usd_utils.get_target_prims(regionPrim, simh.Tokens.caeSimhBoundaries)

    for prim in [regionPrim] + boundaryPrims:
        logger.warning("processing %s", prim)
        vtx_list = await usd_utils.get_array_from_relationship(prim, simh.Tokens.caeSimhVertexList, timeCode)
        vtx_list_lengths = await usd_utils.get_array_from_relationship(
            prim, simh.Tokens.caeSimhVertexListLengths, timeCode
        )
        face_cell_index = await usd_utils.get_array_from_relationship(prim, simh.Tokens.caeSimhFaceCellIndex, timeCode)
        vtx_list_offsets = compute_offsets(vtx_list_lengths)
        assert vtx_list_lengths.shape[0] == face_cell_index.shape[0]
        assert vtx_list_offsets.shape[0] == vtx_list_lengths.shape[0] + 1
        assert vtx_list_offsets[-1] == vtx_list.shape[0]

        if prim.IsA(simh.BoundaryAPI):
            wp.launch(
                kernel_cell_2_vtx_boundary,
                dim=vtx_list_lengths.shape[0],
                inputs=[
                    wp.array(vtx_list_offsets, copy=False),
                    wp.array(vtx_list, copy=False),
                    wp.array(face_cell_index, copy=False),
                    counts,
                    *cell_data,
                    *vtx_data,
                ],
            )
        else:
            wp.launch(
                kernel_cell_2_vtx_internal,
                dim=vtx_list_lengths.shape[0],
                inputs=[
                    wp.array(vtx_list_offsets, copy=False),
                    wp.array(vtx_list, copy=False),
                    wp.array(face_cell_index, copy=False),
                    counts,
                    *cell_data,
                    *vtx_data,
                ],
            )
    assert counts.shape[0] == vtx_data[0].shape[0]
    wp.launch(reduce_1d, dim=counts.shape[0], inputs=[vtx_data[0], counts])
    return vtx_data[:1]
