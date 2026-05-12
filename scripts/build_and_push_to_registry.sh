#!/usr/bin/env bash
# Build and push DSX images + Helm chart to Harbor.
#
# Prerequisites (one-time):
#   - Linux x86_64 build host with NVIDIA toolchain (Kit cannot cross-build)
#
# Usage:
#   ./build_and_push_to_registry.sh               # full pipeline
#   STEP=login ./build_and_push_to_registry.sh    # only registry login
#   STEP=images ./build_and_push_to_registry.sh   # only build+push images
#   STEP=chart ./build_and_push_to_registry.sh    # only push helm chart
#   STEP=local ./build_and_push_to_registry.sh    # build kit + web locally, no login, no push

set -euo pipefail

# ============================================================================
# Configuration — EDIT THESE
# ============================================================================
: "${HARBOR:=harbor.dreamworx.nl}"
: "${TAG:=v1.0.0}"
: "${WEB_DOCKERFILE:=web/Dockerfile}"   # lightweight variant. For the heavy one: Dockerfile
: "${WEB_BUILD_CONTEXT:=web}"            # for the heavy variant change to "."

REGISTRY="${HARBOR}/library"
REGISTRY_USER="admin"
KIT_REPO="dsx-kit"
WEB_REPO="dsx-web"
CHART_REPO="helm-charts"   # helm OCI namespace; final reference: oci://$REGISTRY/helm-charts/dsx

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "============================================================"
echo "Registry:     $REGISTRY"
echo "Kit repo:     $REGISTRY/$KIT_REPO:$TAG"
echo "Web repo:     $REGISTRY/$WEB_REPO:$TAG"
echo "Chart repo:   oci://$REGISTRY/$CHART_REPO/dsx"
echo "Web build:    $WEB_DOCKERFILE (context: $WEB_BUILD_CONTEXT)"
echo "============================================================"

if [ -d ./deps/kit-cae/_build ]; then
  echo "Previous build found, cleaning up previous artifacts first..."
  for i in . deps/kit-cae deps/kit-usd-agents; do
    rm -rf $i/_build
    rm -rf $i/_compiler
    rm -rf $i/_repo
  done
  echo "Resetting kit-cae and kit-usd-agents repos to original state..."
  for i in deps/kit-cae deps/kit-usd-agents; do
    cd $i
    git reset --hard
    cd ../..
  done
  echo "Done."
fi

# ============================================================================
# Step 1 — Login to Registry (Docker + Helm)
# ============================================================================
step_login() {
  echo -n "Enter registry password: "
  read -s REGISTRY_PASSWORD
  echo ""

  echo ">>> Logging Docker into Registry"
  echo "$REGISTRY_PASSWORD" | docker login --username "$REGISTRY_USER" --password-stdin "$REGISTRY"

  echo ">>> Logging Helm into Registry"
  echo "$REGISTRY_PASSWORD" | helm registry login --username "$REGISTRY_USER" --password-stdin "$REGISTRY"
}

# ============================================================================
# Step 2 — Build the Kit application (Premake5 + Packman + submodules)
# ============================================================================
step_build_kit_app() {
  echo ">>> Building Kit application via repo.sh"
  pwd
  PATH=${PATH} LD_LIBRARY_PATH=${LD_LIBRARY_PATH:-} ./repo.sh build --release
}

# ============================================================================
# Step 3 — Package the Kit application into a container image
#   This invokes the repo_kit_package_container target defined in repo.toml.
#   It produces a local image tagged "dsx_nvcf:<version>" by default.
#   See repo.toml [repo_kit_package_container] section.
# ============================================================================
step_package_kit_container() {
  echo ">>> Packaging Kit container (this builds the dsx_nvcf image)"

  # Remove broken symlinks in build exts/ — some kit-cae extensions
  # (VTK, EnSight, testing, UI widgets) are not built but leave dangling
  # symlinks that cause repo package_container to fail.
  find "${REPO_ROOT}/_build/linux-x86_64/release/exts/" -maxdepth 1 -xtype l -delete 2>/dev/null || true

  # The container target is defined in repo.toml [repo_kit_package_container].
  # --app selects the Kit app (dsx_nvcf.kit) to containerize.
  PATH=${PATH} LD_LIBRARY_PATH=${LD_LIBRARY_PATH:-} ./repo.sh package_container \
    --app dsx_nvcf.kit \
    --image-tag "${KIT_REPO}:${TAG}"

  # Apply the typing_extensions PEP 728 fix on top of the produced image.
  # See scripts/Dockerfile.kit-patch for details.
  echo ">>> Patching typing_extensions in pip_archive (PEP 728 fix)"
  docker build \
    --build-arg BASE_IMAGE="${KIT_REPO}:${TAG}" \
    -f "${REPO_ROOT}/scripts/Dockerfile.kit-patch" \
    -t "${KIT_REPO}:${TAG}" \
    "${REPO_ROOT}/scripts"
}

# ============================================================================
# Step 4 — Tag and push Kit image
# ============================================================================
step_push_kit() {
  echo ">>> Tagging Kit image for Registry"
  docker tag "${KIT_REPO}:${TAG}" "${REGISTRY}/${KIT_REPO}:${TAG}"
  docker tag "${KIT_REPO}:${TAG}" "${REGISTRY}/${KIT_REPO}:latest"

  echo ">>> Pushing Kit image to Registry"
  docker push "${REGISTRY}/${KIT_REPO}:${TAG}"
  docker push "${REGISTRY}/${KIT_REPO}:latest"
}

# ============================================================================
# Step 5 — Build and push Web image
# ============================================================================
step_build_web() {
  echo ">>> Building Web image from $WEB_DOCKERFILE"
  local npmrc="${NPMRC:-${REPO_ROOT}/web/.npmrc}"
  if [ ! -f "$npmrc" ]; then
    echo "ERROR: npmrc not found at $npmrc — set NPMRC=/path/to/.npmrc or create web/.npmrc"
    exit 1
  fi
  docker build \
    --secret id=npmrc,src="$npmrc" \
    -f "$WEB_DOCKERFILE" \
    -t "${WEB_REPO}:${TAG}" \
    "$WEB_BUILD_CONTEXT"
}

step_build_push_web() {
  step_build_web

  echo ">>> Tagging Web image for Registry"
  docker tag "${WEB_REPO}:${TAG}" "${REGISTRY}/${WEB_REPO}:${TAG}"
  docker tag "${WEB_REPO}:${TAG}" "${REGISTRY}/${WEB_REPO}:latest"

  echo ">>> Pushing Web image to Registry"
  docker push "${REGISTRY}/${WEB_REPO}:${TAG}"
  docker push "${REGISTRY}/${WEB_REPO}:latest"
}

# ============================================================================
# Step 6 — Package and push Helm chart as OCI artifact
# ============================================================================
step_push_chart() {
  echo ">>> Packaging Helm chart"
  local pkg_dir
  pkg_dir="$(mktemp -d)"
  helm package ./helm/dsx --destination "$pkg_dir"

  local pkg_file
  pkg_file="$(ls "$pkg_dir"/dsx-*.tgz | head -n1)"
  echo ">>> Packaged: $pkg_file"

  echo ">>> Pushing chart to oci://${REGISTRY}/${CHART_REPO}"
  helm push "$pkg_file" "oci://${REGISTRY}/${CHART_REPO}"

  rm -rf "$pkg_dir"
}

# ============================================================================
# Dispatch
# ============================================================================
case "${STEP:-all}" in
  login)   step_login ;;
  kit)     step_login && step_build_kit_app && step_package_kit_container && step_push_kit ;;
  web)     step_login && step_build_push_web ;;
  images)  step_login && step_build_kit_app && step_package_kit_container && step_push_kit && step_build_push_web ;;
  chart)   step_login && step_push_chart ;;
  all)     step_login && step_build_kit_app && step_package_kit_container && step_push_kit && step_build_push_web && step_push_chart ;;
  local)   step_build_kit_app && step_package_kit_container && step_build_web ;;
  *)       echo "Unknown STEP=$STEP. Valid: login|kit|web|images|chart|all|local"; exit 1 ;;
esac

echo ""
echo "============================================================"
if [ "${STEP:-all}" = "local" ]; then
  echo "Local build done. Images available:"
  echo "  ${KIT_REPO}:${TAG}"
  echo "  ${WEB_REPO}:${TAG}"
  echo ""
  echo "Verify with: docker images | grep -E '${KIT_REPO}|${WEB_REPO}'"
else
  echo "Done. To install with helm:"
  echo ""
  echo "  helm install dsx oci://${REGISTRY}/${CHART_REPO}/dsx \\"
  echo "    --version \$(helm show chart oci://${REGISTRY}/${CHART_REPO}/dsx | grep '^version:' | awk '{print \$2}') \\"
  echo "    --set kit.image.repository=${REGISTRY}/${KIT_REPO} \\"
  echo "    --set kit.image.tag=${TAG} \\"
  echo "    --set web.image.repository=${REGISTRY}/${WEB_REPO} \\"
  echo "    --set web.image.tag=${TAG}"
fi
echo "============================================================"