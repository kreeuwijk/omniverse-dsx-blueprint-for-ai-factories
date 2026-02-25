# SPDX-FileCopyrightText: Copyright (c) 2025 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: LicenseRef-NvidiaProprietary
#
# NVIDIA CORPORATION, its affiliates and licensors retain all intellectual
# property and proprietary rights in and to this material, related
# documentation and any modifications thereto. Any use, reproduction,
# disclosure or distribution of this material and related documentation
# without an express license agreement from NVIDIA CORPORATION or
# its affiliates is strictly prohibited.

import os
from logging import getLogger

import h5py
from omni.cae.schema import cae
from omni.client.utils import make_file_url_if_possible
from pxr import Tf, Usd, UsdGeom

logger = getLogger(__name__)


def populate_stage(path: str, stage: Usd.Stage):
    world = UsdGeom.Xform.Define(stage, "/World")
    stage.SetDefaultPrim(world.GetPrim())
    UsdGeom.SetStageUpAxis(stage, "Z")

    root = UsdGeom.Scope.Define(stage, world.GetPath().AppendChild(Tf.MakeValidIdentifier(os.path.basename(path))))
    rootPath = root.GetPath()

    caeFieldArrayClass = cae.FieldArray(stage.CreateClassPrim(rootPath.AppendChild("FieldArrayClass")))
    caeFieldArrayClass.CreateFileNamesAttr().Set([make_file_url_if_possible(path)])
    caeFieldArrayClass.CreateFieldAssociationAttr().Set(cae.Tokens.none)

    with h5py.File(path, "r") as f:
        states = read_states(f)
        state_default: SimhState = states[-1]

        nb_particles = len(state_default.group["Parts/Parcels"])
        nb_sections = len(state_default.group["Parts/Derived"])
        nb_surfaces = len(state_default.group["Parts/Surfaces"])
        nb_volumes = len(state_default.group["Regions"])

        if nb_particles > 0:
            populate_particles(f, root.GetPrim(), caeFieldArrayClass, states)
        if nb_sections > 0:
            populate_sections(f, root.GetPrim(), caeFieldArrayClass, states)
        if nb_volumes > 0:
            populate_regions(f, root.GetPrim(), caeFieldArrayClass, states)
        if nb_surfaces > 0:
            populate_surfaces(f, root.GetPrim(), caeFieldArrayClass, states)

        if nb_particles == 0 and nb_sections == 0 and nb_volumes == 0 and nb_surfaces == 0:
            raise RuntimeError("No supported data found in file %s", path)


class SimhState:
    name: str = None
    group: h5py.Group = None
    regions: dict[str, h5py.Group] = None
    iteration: int = None
    timestep: int = None
    physical_time: float = None


def read_states(f) -> list[SimhState]:
    states = []
    for name, group in filter(lambda tup: isinstance(tup[1], h5py.Group), f["/States"].items()):
        state = SimhState()
        state.name = name
        state.group = group
        state.iteration = int(group.attrs["Iteration"])
        state.timestep = int(group.attrs["TimeStep"])
        state.physical_time = float(group.attrs["PhysicalTime"])
        state.regions = {}

        # process nested regions
        for rname, rgroup in filter(lambda tup: isinstance(tup[1], h5py.Group), group["Regions"].items()):
            state.regions[rname] = rgroup

        states.append(state)

    # sort using iteration
    states.sort(key=lambda s: s.iteration)
    return states


def populate_particles(f: h5py.File, root: Usd.Prim, caeFieldArrayClass: cae.FieldArray, states: list[SimhState]):
    stage = root.GetStage()
    rootPath = root.GetPath()

    state_default: SimhState = states[-1]
    parcels = filter(lambda tup: isinstance(tup[1], h5py.Group), state_default.group["Parts/Parcels"].items())
    for name, _ in parcels:
        dataset = cae.DataSet.Define(stage, rootPath.AppendChild(Tf.MakeValidIdentifier(name)))
        cae.PointCloudAPI.Apply(dataset.GetPrim())
        pcAPI = cae.PointCloudAPI(dataset)
        pcAPI.CreateCoordinatesRel().SetTargets([])

        pd_path = f"/States/{state_default.name}/Parts/Parcels/{name}/PointData"
        for ds_name, _ in filter(lambda tup: isinstance(tup[1], h5py.Dataset), f[pd_path].items()):
            farray = cae.Hdf5FieldArray.Define(stage, dataset.GetPath().AppendChild(Tf.MakeValidIdentifier(ds_name)))
            farray.GetPrim().GetSpecializes().SetSpecializes([caeFieldArrayClass.GetPath()])
            farray.CreateFieldAssociationAttr().Set(cae.Tokens.vertex)
            hdf5_path_attr = farray.CreateHdf5PathAttr()
            hdf5_path_attr.Set(f"{pd_path}/{ds_name}")

            # now add timesamples for all states
            for state in states:
                pdt_path = f"/States/{state.name}/Parts/Parcels/{name}/PointData"
                hdf5_path_attr.Set(f"{pdt_path}/{ds_name}", state.timestep)

            if ds_name == "ParcelCentroidFieldFunction":
                pcAPI.CreateCoordinatesRel().SetTargets([farray.GetPath()])
            else:
                pcAPI.GetPrim().CreateRelationship(f"field:{ds_name}").SetTargets([farray.GetPath()])


def populate_sections(f: h5py.File, root: Usd.Prim, caeFieldArrayClass: cae.FieldArray, states: list[SimhState]):
    stage = root.GetStage()
    rootPath = root.GetPath()

    state_default: SimhState = states[-1]
    derived_parts = filter(lambda tup: isinstance(tup[1], h5py.Group), state_default.group["Parts/Derived"].items())
    # now, each part has pieces which are individual datasets
    for part_name, part_group in derived_parts:
        for piece_name, piece_group in filter(lambda tup: isinstance(tup[1], h5py.Group), part_group.items()):
            if piece_group.attrs.get("Vertices", [0])[0] == 0:
                logger.info("Skipping %s/%s because piece has no vertices", part_name, piece_name)
                continue

            dataset = cae.DataSet.Define(stage, rootPath.AppendChild(Tf.MakeValidIdentifier(piece_name)))
            cae.MeshAPI.Apply(dataset.GetPrim())
            meshAPI = cae.MeshAPI(dataset)

            coord = cae.Hdf5FieldArray.Define(stage, dataset.GetPath().AppendChild("Coord"))
            coord.GetPrim().GetSpecializes().SetSpecializes([caeFieldArrayClass.GetPath()])
            attr = coord.CreateHdf5PathAttr()

            # now add timesamples for all states (we're assuming all exist)
            for state in states:
                attr.Set(f"/States/{state.name}/Parts/Derived/{part_name}/{piece_name}/Coord", state.timestep)

            meshAPI.CreatePointsRel().SetTargets([coord.GetPath()])

            vertexListArray = cae.Hdf5FieldArray.Define(stage, dataset.GetPath().AppendChild("VertexList"))
            vertexListArray.GetPrim().GetSpecializes().SetSpecializes([caeFieldArrayClass.GetPath()])
            attr = vertexListArray.CreateHdf5PathAttr()

            # now add timesamples for all states (we're assuming all exist)
            for state in states:
                attr.Set(
                    f"/States/{state.name}/Parts/Derived/{part_name}/{piece_name}/VertexList/VertexList", state.timestep
                )

            meshAPI.CreateFaceVertexIndicesRel().SetTargets([vertexListArray.GetPath()])

            vertexListLengthsArray = cae.Hdf5FieldArray.Define(
                stage, dataset.GetPath().AppendChild("VertexList_lengths")
            )
            vertexListLengthsArray.GetPrim().GetSpecializes().SetSpecializes([caeFieldArrayClass.GetPath()])
            attr = vertexListLengthsArray.CreateHdf5PathAttr()

            # now add timesamples for all states (we're assuming all exist)
            for state in states:
                attr.Set(
                    f"/States/{state.name}/Parts/Derived/{part_name}/{piece_name}/VertexList/VertexList_lengths",
                    state.timestep,
                )

            meshAPI.CreateFaceVertexCountsRel().SetTargets([vertexListLengthsArray.GetPath()])

            # now add face data
            for face_data_name, face_dataset in filter(
                lambda tup: isinstance(tup[1], h5py.Dataset), piece_group["FaceData"].items()
            ):
                clean_face_data_name = Tf.MakeValidIdentifier(face_data_name)
                faceArray = cae.Hdf5FieldArray.Define(stage, dataset.GetPath().AppendChild(clean_face_data_name))
                faceArray.GetPrim().GetSpecializes().SetSpecializes([caeFieldArrayClass.GetPath()])
                attr = faceArray.CreateHdf5PathAttr()

                # now add timesamples for all states (we're assuming all exist)
                for state in states:
                    attr.Set(
                        f"/States/{state.name}/Parts/Derived/{part_name}/{piece_name}/FaceData/{face_data_name}",
                        state.timestep,
                    )

                dataset.GetPrim().CreateRelationship(f"field:{clean_face_data_name}").SetTargets([faceArray.GetPath()])


def read_meshes(f) -> list[tuple[str, h5py.Group]]:
    meshes = []
    for name, group in filter(lambda tup: isinstance(tup[1], h5py.Group), f["/Meshes"].items()):
        meshes.append((name, group))
    return meshes


def populate_regions(f: h5py.File, root: Usd.Prim, caeFieldArrayClass: cae.FieldArray, states: list[SimhState]):
    stage = root.GetStage()
    rootPath = root.GetPath()
    meshes = read_meshes(f)

    # for each state, lets determine the mesh it is associated with.
    # seems the states can be associated with same or different meshes over time, so we handle this.

    # we use first mesh to build regions.
    regions = filter(lambda tup: isinstance(tup[1], h5py.Group), f[f"/Meshes/{meshes[0][0]}/Regions"].items())
    primRegions = stage.DefinePrim(rootPath.AppendChild("Regions"), "SimhRegions")
    for region_name, region in regions:
        dataset = cae.DataSet.Define(stage, primRegions.GetPath().AppendChild(Tf.MakeValidIdentifier(region_name)))
        datasetPrim: Usd.Prim = dataset.GetPrim()
        datasetPrim.AddAppliedSchema("CaeSimhRegionAPI")

        coord = cae.Hdf5FieldArray.Define(stage, dataset.GetPath().AppendChild("Coord"))
        coord.GetPrim().GetSpecializes().SetSpecializes([caeFieldArrayClass.GetPath()])
        datasetPrim.CreateRelationship("cae:simh:coord").SetTargets([coord.GetPath()])

        vertexList = cae.Hdf5FieldArray.Define(stage, dataset.GetPath().AppendChild("VertexList"))
        vertexList.GetPrim().GetSpecializes().SetSpecializes([caeFieldArrayClass.GetPath()])
        datasetPrim.CreateRelationship("cae:simh:vertexList").SetTargets([vertexList.GetPath()])

        vertexListLengths = cae.Hdf5FieldArray.Define(stage, dataset.GetPath().AppendChild("VertexList_lengths"))
        vertexListLengths.GetPrim().GetSpecializes().SetSpecializes([caeFieldArrayClass.GetPath()])
        datasetPrim.CreateRelationship("cae:simh:vertexListLengths").SetTargets([vertexListLengths.GetPath()])

        faceCellIndex = cae.Hdf5FieldArray.Define(stage, dataset.GetPath().AppendChild("FaceCellIndex"))
        faceCellIndex.GetPrim().GetSpecializes().SetSpecializes([caeFieldArrayClass.GetPath()])
        datasetPrim.CreateRelationship("cae:simh:faceCellIndex").SetTargets([faceCellIndex.GetPath()])

        mesh_region_paths = {}
        last_ref = None
        for state in states:
            if region_name not in state.regions:
                logger.warning("Skipping region %s because it is missing in state %s", region_name, state.name)
                continue

            state_region = state.regions[region_name]
            coord_ref = state_region["Coord_Ref"]
            assert coord_ref.dtype == h5py.special_dtype(ref=h5py.Reference)

            target_coord = f[coord_ref[0]]
            if last_ref != target_coord:
                last_ref = target_coord
                target_mesh_region = target_coord.parent
                mesh_region_paths[state.timestep] = target_mesh_region.name

        for timestep, target_mesh_region_name in mesh_region_paths.items():
            coord.CreateHdf5PathAttr().Set(f"{target_mesh_region_name}/Coord", timestep)
            vertexList.CreateHdf5PathAttr().Set(f"{target_mesh_region_name}/VertexList/VertexList", timestep)
            vertexListLengths.CreateHdf5PathAttr().Set(
                f"{target_mesh_region_name}/VertexList/VertexList_lengths", timestep
            )
            faceCellIndex.CreateHdf5PathAttr().Set(f"{target_mesh_region_name}/FaceCellIndex", timestep)

        # handle boundaries for this region
        boundaries = filter(lambda tup: isinstance(tup[1], h5py.Group), region["Boundaries"].items())
        primBoundaries = stage.DefinePrim(dataset.GetPath().AppendChild("Boundaries"), "SimhBoundaries")
        boundary_prims = []
        for boundary_name, boundary in boundaries:
            if "FaceCellIndex" not in boundary:
                logger.warning("Skipping boundary %s because it is missing required datasets", boundary_name)
                continue

            boundary_dataset = cae.DataSet.Define(
                stage, primBoundaries.GetPath().AppendChild(Tf.MakeValidIdentifier(boundary_name))
            )
            boundary_dataset_prim: Usd.Prim = boundary_dataset.GetPrim()
            boundary_dataset_prim.AddAppliedSchema("CaeSimhBoundaryAPI")

            coord = cae.Hdf5FieldArray.Define(stage, dataset.GetPath().AppendChild("Coord"))
            coord.GetPrim().GetSpecializes().SetSpecializes([caeFieldArrayClass.GetPath()])
            boundary_dataset_prim.CreateRelationship("cae:simh:coord").SetTargets([coord.GetPath()])

            vertexList = cae.Hdf5FieldArray.Define(stage, boundary_dataset.GetPath().AppendChild("VertexList"))
            vertexList.GetPrim().GetSpecializes().SetSpecializes([caeFieldArrayClass.GetPath()])
            # vertexList.CreateHdf5PathAttr().Set(f"/Meshes/{meshes[0][0]}/Regions/{region_name}/Boundaries/{boundary_name}/VertexList/VertexList")
            boundary_dataset_prim.CreateRelationship("cae:simh:vertexList").SetTargets([vertexList.GetPath()])

            vertexListLengths = cae.Hdf5FieldArray.Define(
                stage, boundary_dataset.GetPath().AppendChild("VertexList_lengths")
            )
            vertexListLengths.GetPrim().GetSpecializes().SetSpecializes([caeFieldArrayClass.GetPath()])
            # vertexListLengths.CreateHdf5PathAttr().Set(f"/Meshes/{meshes[0][0]}/Regions/{region_name}/Boundaries/{boundary_name}/VertexList/VertexList_lengths")
            boundary_dataset_prim.CreateRelationship("cae:simh:vertexListLengths").SetTargets(
                [vertexListLengths.GetPath()]
            )

            faceCellIndex = cae.Hdf5FieldArray.Define(stage, boundary_dataset.GetPath().AppendChild("FaceCellIndex"))
            faceCellIndex.GetPrim().GetSpecializes().SetSpecializes([caeFieldArrayClass.GetPath()])
            # faceCellIndex.CreateHdf5PathAttr().Set(f"/Meshes/{meshes[0][0]}/Regions/{region_name}/Boundaries/{boundary_name}/FaceCellIndex")
            boundary_dataset_prim.CreateRelationship("cae:simh:faceCellIndex").SetTargets([faceCellIndex.GetPath()])

            boundary_prims.append(boundary_dataset_prim)

            for timestep, target_mesh_region_name in mesh_region_paths.items():
                # coords are shared across all boundaries
                coord.CreateHdf5PathAttr().Set(f"{target_mesh_region_name}/Coord", timestep)
                vertexList.CreateHdf5PathAttr().Set(
                    f"{target_mesh_region_name}/Boundaries/{boundary_name}/VertexList/VertexList", timestep
                )
                vertexListLengths.CreateHdf5PathAttr().Set(
                    f"{target_mesh_region_name}/Boundaries/{boundary_name}/VertexList/VertexList_lengths", timestep
                )
                faceCellIndex.CreateHdf5PathAttr().Set(
                    f"{target_mesh_region_name}/Boundaries/{boundary_name}/FaceCellIndex", timestep
                )

        # update region with relationships to boundaries
        datasetPrim.CreateRelationship("cae:simh:boundaries").SetTargets([p.GetPath() for p in boundary_prims])

        # handle cell data and vertex data
        state_default: SimhState = states[0]
        state_default_region = state_default.regions[region_name]
        if "CellData" in state_default_region:
            scope = UsdGeom.Scope.Define(stage, dataset.GetPath().AppendChild("CellData"))

            for ds_name, ds in state_default_region["CellData"].items():
                farray = cae.Hdf5FieldArray.Define(stage, scope.GetPath().AppendChild(Tf.MakeValidIdentifier(ds_name)))
                farray.GetPrim().GetSpecializes().SetSpecializes([caeFieldArrayClass.GetPath()])
                farray.CreateFieldAssociationAttr().Set(cae.Tokens.cell)
                hdf5_path_attr = farray.CreateHdf5PathAttr()

                # now add timesamples for all states
                for state in states:
                    hdf5_path_attr.Set(f"{state.group.name}/Regions/{region_name}/CellData/{ds_name}", state.timestep)

                dataset.GetPrim().CreateRelationship(f"field:cell:{ds_name}").SetTargets([farray.GetPath()])
                for boundary_prim in boundary_prims:
                    boundary_prim.CreateRelationship(f"field:cell:{ds_name}").SetTargets([farray.GetPath()])

        if "VertexData" in state_default_region:
            scope = UsdGeom.Scope.Define(stage, dataset.GetPath().AppendChild("VertexData"))

            for ds_name, ds in state_default_region["VertexData"].items():
                farray = cae.Hdf5FieldArray.Define(stage, scope.GetPath().AppendChild(Tf.MakeValidIdentifier(ds_name)))
                farray.GetPrim().GetSpecializes().SetSpecializes([caeFieldArrayClass.GetPath()])
                farray.CreateFieldAssociationAttr().Set(cae.Tokens.vertex)
                hdf5_path_attr = farray.CreateHdf5PathAttr()

                # now add timesamples for all states
                for state in states:
                    hdf5_path_attr.Set(f"{state.group.name}/Regions/{region_name}/VertexData/{ds_name}", state.timestep)

                dataset.GetPrim().CreateRelationship(f"field:vertex:{ds_name}").SetTargets([farray.GetPath()])
                for boundary_prim in boundary_prims:
                    boundary_prim.CreateRelationship(f"field:vertex:{ds_name}").SetTargets([farray.GetPath()])


def populate_surfaces(f: h5py.File, root: Usd.Prim, caeFieldArrayClass: cae.FieldArray, states: list[SimhState]):
    stage = root.GetStage()
    rootPath = root.GetPath()
    meshes = read_meshes(f)

    # for each state, lets determine the mesh it is associated with
    # (similar to regions)
    surfaces = filter(lambda tup: isinstance(tup[1], h5py.Group), f[f"/Meshes/{meshes[0][0]}/Parts/Surfaces"].items())
    primSurfaces = stage.DefinePrim(rootPath.AppendChild("Surfaces"), "SimhSurfaces")
    for region_name, region in surfaces:
        scope = UsdGeom.Scope.Define(stage, primSurfaces.GetPath().AppendChild(Tf.MakeValidIdentifier(region_name)))

        for surface_name, surface in filter(lambda tup: isinstance(tup[1], h5py.Group), region.items()):
            dataset = cae.DataSet.Define(stage, scope.GetPath().AppendChild(Tf.MakeValidIdentifier(surface_name)))

            cae.MeshAPI.Apply(dataset.GetPrim())
            meshAPI = cae.MeshAPI(dataset.GetPrim())

            coord = cae.Hdf5FieldArray.Define(stage, dataset.GetPath().AppendChild("Coord"))
            coord.GetPrim().GetSpecializes().SetSpecializes([caeFieldArrayClass.GetPath()])
            meshAPI.CreatePointsRel().SetTargets([coord.GetPath()])

            vertexList = cae.Hdf5FieldArray.Define(stage, dataset.GetPath().AppendChild("VertexList"))
            vertexList.GetPrim().GetSpecializes().SetSpecializes([caeFieldArrayClass.GetPath()])
            meshAPI.CreateFaceVertexIndicesRel().SetTargets([vertexList.GetPath()])

            vertexListLengths = cae.Hdf5FieldArray.Define(stage, dataset.GetPath().AppendChild("VertexList_lengths"))
            vertexListLengths.GetPrim().GetSpecializes().SetSpecializes([caeFieldArrayClass.GetPath()])
            meshAPI.CreateFaceVertexCountsRel().SetTargets([vertexListLengths.GetPath()])

            mesh_surface_paths = {}
            last_ref = None
            for state in states:
                if surface_name not in state.group[f"Parts/Surfaces/{region_name}"]:
                    logger.warning("Skipping surface %s because it is missing in state %s", surface_name, state.name)
                    continue

                state_surface = state.group[f"Parts/Surfaces/{region_name}/{surface_name}"]
                if "Coord_Ref" not in state_surface:
                    logger.debug(
                        "Step over surface %s because it is missing 'Coord_Ref' in state %s", surface_name, state.name
                    )
                    continue

                coord_ref = state_surface["Coord_Ref"]
                assert coord_ref.dtype == h5py.special_dtype(ref=h5py.Reference)

                target_coord = f[coord_ref[0]]
                if last_ref != target_coord:
                    last_ref = target_coord
                    target_mesh_surface = target_coord.parent
                    mesh_surface_paths[state.timestep] = target_mesh_surface.name

            for timestep, target_mesh_surface_name in mesh_surface_paths.items():
                coord.CreateHdf5PathAttr().Set(f"{target_mesh_surface_name}/Coord", timestep)
                vertexList.CreateHdf5PathAttr().Set(f"{target_mesh_surface_name}/VertexList/VertexList", timestep)
                vertexListLengths.CreateHdf5PathAttr().Set(
                    f"{target_mesh_surface_name}/VertexList/VertexList_lengths", timestep
                )

            # handle face and vertex data
            state_default: SimhState = states[0]
            state_default_surface = state_default.group[f"Parts/Surfaces/{region_name}/{surface_name}"]
            if "FaceData" in state_default_surface:
                scope = UsdGeom.Scope.Define(stage, dataset.GetPath().AppendChild("FaceData"))

                for ds_name, ds in state_default_surface["FaceData"].items():
                    farray = cae.Hdf5FieldArray.Define(
                        stage, scope.GetPath().AppendChild(Tf.MakeValidIdentifier(ds_name))
                    )
                    farray.GetPrim().GetSpecializes().SetSpecializes([caeFieldArrayClass.GetPath()])
                    farray.CreateFieldAssociationAttr().Set(cae.Tokens.cell)
                    hdf5_path_attr = farray.CreateHdf5PathAttr()

                    # now add timesamples for all states
                    for state in states:
                        hdf5_path_attr.Set(
                            f"{state.group.name}/Parts/Surfaces/{region_name}/{surface_name}/FaceData/{ds_name}",
                            state.timestep,
                        )

                    dataset.GetPrim().CreateRelationship(f"field:face:{ds_name}").SetTargets([farray.GetPath()])
            if "VertexData" in state_default_surface:
                scope = UsdGeom.Scope.Define(stage, dataset.GetPath().AppendChild("VertexData"))

                for ds_name, ds in state_default_surface["VertexData"].items():
                    farray = cae.Hdf5FieldArray.Define(
                        stage, scope.GetPath().AppendChild(Tf.MakeValidIdentifier(ds_name))
                    )
                    farray.GetPrim().GetSpecializes().SetSpecializes([caeFieldArrayClass.GetPath()])
                    farray.CreateFieldAssociationAttr().Set(cae.Tokens.vertex)
                    hdf5_path_attr = farray.CreateHdf5PathAttr()

                    # now add timesamples for all states
                    for state in states:
                        hdf5_path_attr.Set(
                            f"{state.group.name}/Parts/Surfaces/{region_name}/{surface_name}/VertexData/{ds_name}",
                            state.timestep,
                        )

                    dataset.GetPrim().CreateRelationship(f"field:vertex:{ds_name}").SetTargets([farray.GetPath()])
