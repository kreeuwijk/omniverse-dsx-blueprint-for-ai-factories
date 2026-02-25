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

import omni.ext
import omni.kit.tool.asset_importer as ai
from omni.cae.pipapi import pip_install

from .importer import SimhImporter

logger = getLogger(__name__)


class Extension(omni.ext.IExt):

    def on_startup(self, ext_id):
        if pip_install(package="h5py", version="3.13", module="h5py", required=True):
            from omni.kit.commands import register_all_commands_in_module

            self._importer = SimhImporter()
            ai.register_importer(self._importer)

            from . import commands

            self._modules = [commands]
            register_all_commands_in_module(commands)
            self._inited = True
        else:
            self._inited = False

    def on_shutdown(self):
        if self._inited is False:
            return

        from omni.kit.commands import unregister_module_commands

        ai.remove_importer(self._importer)
        del self._importer

        for m in self._modules:
            unregister_module_commands(m)
            del m
        del self._modules
