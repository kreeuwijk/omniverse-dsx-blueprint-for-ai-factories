#!/usr/bin/bash

# SPDX-FileCopyrightText: Copyright (c) 2025 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: LicenseRef-NvidiaProprietary
#
# NVIDIA CORPORATION, its affiliates and licensors retain all intellectual
# property and proprietary rights in and to this material, related
# documentation and any modifications thereto. Any use, reproduction,
# disclosure or distribution of this material and related documentation
# without an express license agreement from NVIDIA CORPORATION or
# its affiliates is strictly prohibited.

set -ex

rm -rf _stage

build_number=$(./repo.sh build_number | grep -oP "[^:]*: '\K[^']*")

folder_name=kit-cae-simh-$build_number
./repo.sh stage_for_github _stage/$folder_name

pushd _stage/

# need to explicitly remove the .git folder
rm -rf $folder_name/.git

# create the tarball
tar cvfJ $folder_name.tar.xz $folder_name

# now, do non-simh archive
mv $folder_name kit-cae-$build_number
folder_name=kit-cae-$build_number

# remove simh folder
rm -rf $folder_name/source/extensions/*.simh*

# create the tarball
tar cvfJ $folder_name.tar.xz $folder_name

popd