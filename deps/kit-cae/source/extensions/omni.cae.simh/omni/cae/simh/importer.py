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

import omni.client.utils as clientutils
import omni.kit.tool.asset_importer as ai
from pxr import Usd, UsdUtils

logger = getLogger(__name__)


class SimhImporter(ai.AbstractImporterDelegate):

    def name(self) -> str:
        return "SimH Importer"

    @property
    def filter_regexes(self) -> list[str]:
        return [r".*\.simh$"]

    @property
    def filter_descriptions(self) -> list[str]:
        return ["SimHFiles (*.simh)"]

    def show_destination_frame(self):
        return True

    def supports_usd_stage_cache(self):
        return True

    def build_options(self, paths: list[str]) -> None:
        pass

    async def convert_assets(self, paths: list[str], **kwargs):
        result = {}
        # we only support local assets for now.
        for path in filter(lambda uri: clientutils.is_local_url(uri), paths):
            normalized_path = clientutils.normalize_url(path)
            if converted_path := await self._convert_asset(
                normalized_path, kwargs.get("import_as_reference"), kwargs.get("export_folder")
            ):
                result[path] = converted_path
        return result

    async def _convert_asset(self, path: str, import_as_reference: bool, export_folder: str):
        from . import importer_utils

        if import_as_reference:
            # when importing as reference, create a new stage file and then return that.
            output_dir = export_folder if export_folder else os.path.dirname(path)
            name, _ = os.path.splitext(os.path.basename(path))
            usd_path = os.path.join(output_dir, f"{name}.usda")
            # TODO: if file exists, warn!!!
            stage = Usd.Stage.CreateNew(usd_path)
            importer_utils.populate_stage(path, stage)
            stage.Save()
            return usd_path
        else:
            # when adding directly to stage, just create an in memory stage
            # and return its id
            stage = Usd.Stage.CreateInMemory()
            importer_utils.populate_stage(path, stage)
            stage_id = UsdUtils.StageCache.Get().Insert(stage)
            return stage_id.ToString()
