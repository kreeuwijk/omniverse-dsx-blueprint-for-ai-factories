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

import omni.repo.ci
import omni.repo.man


def build(extra_args=None):
    if extra_args is None:
        extra_args = []

    # First, build schemas for both configs
    build_schema_cmd_release = ["${root}/repo${shell_ext}", "schema", "--clean"]
    omni.repo.ci.launch(build_schema_cmd_release)

    build_schema_cmd_release = ["${root}/repo${shell_ext}", "schema", "-c", "release"]
    omni.repo.ci.launch(build_schema_cmd_release)

    # build_schema_cmd_debug = ["${root}/repo${shell_ext}", "schema", "-c", "debug"]
    # omni.repo.ci.launch(build_schema_cmd_debug)

    # Full rebuild both configs
    # build_cmd = ["${root}/repo${shell_ext}", "build", "-x", "-rd"] + extra_args
    build_cmd = ["${root}/repo${shell_ext}", "build", "-x", "-r"] + extra_args
    omni.repo.ci.launch(build_cmd)

    pip_install_cmd = [
        "${root}/repo${shell_ext}",
        "pip_download",
        "--dest",
        "_build/packages/pip",
        "-r",
        "${root}/tools/deps/requirements.txt",
    ]
    omni.repo.ci.launch(pip_install_cmd)

    # Extensions verification for publishing (if publishing enabled)
    if omni.repo.ci.get_repo_config().get("repo_publish_exts", {}).get("enabled", True):
        omni.repo.ci.launch(["${root}/repo${shell_ext}", "publish_exts", "--verify"])

    # Tool to promote extensions to the public registry pipeline, if enabled (for apps)
    if omni.repo.ci.get_repo_config().get("repo_deploy_exts", {}).get("enabled", False):
        omni.repo.ci.launch(["${root}/repo${shell_ext}", "deploy_exts"])

    # Use repo_docs.enabled as indicator for whether to build docs
    # docs are also windows only on CI
    repo_docs_enabled = omni.repo.ci.get_repo_config().get("repo_docs", {}).get("enabled", True)
    repo_docs_enabled = repo_docs_enabled and omni.repo.ci.is_windows()

    # Docs (windows only)
    if repo_docs_enabled:
        omni.repo.ci.launch(["${root}/repo${shell_ext}", "docs", "--config", "release"])

    # # Symstore tool call to store debug symbols on the server
    # repo_symstore_enabled = omni.repo.ci.get_repo_config().get("repo_symstore", {}).get("enabled", True)
    # if repo_symstore_enabled:
    #     omni.repo.ci.launch(["${root}/repo${shell_ext}", "symstore"])

    # Package all
    omni.repo.ci.launch(["${root}/repo${shell_ext}", "package", "--thin", "-c", "release"])
    # omni.repo.ci.launch(["${root}/repo${shell_ext}", "package", "--thin", "-c", "debug"])

    # if repo_docs_enabled:
    #     omni.repo.ci.launch(["${root}/repo${shell_ext}", "package", "-m", "docs", "-c", "debug"])

    # publish artifacts to teamcity
    omni.repo.man.utils.ci_message("publishArtifacts", "_build/packages")
    omni.repo.man.utils.ci_message("publishArtifacts", "_build/**/*.log")


build()
