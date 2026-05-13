# This Dockerfile is used as the base for containerizing applications rendered out via repo_kit_template.

# --- Stage 1: fetch a newer libstdc++6 ---------------------------------------------------------
# We can't run apt-get install in the NVIDIA base (its apt is locked to urm.nvidia.com which
# isn't externally resolvable, so `software-properties-common` isn't available). Use a plain
# ubuntu:22.04 image which has working apt to pull libstdc++6 from ubuntu-toolchain-r/test
# (built against jammy glibc 2.35, so no GLIBC_2.38 problem when copied into ov-base-ubuntu-22).
FROM ubuntu:22.04 AS libstdcxx-source
RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        software-properties-common gnupg ca-certificates \
 && add-apt-repository -y ppa:ubuntu-toolchain-r/test \
 && apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends libstdc++6 \
 && rm -rf /var/lib/apt/lists/*

# --- Stage 2: the actual Kit container, on top of ov-base-ubuntu-22 ---------------------------
# This is the base image for the container. It is based on Ubuntu 22.04.
FROM nvcr.io/nvidia/omniverse/ov-base-ubuntu-22:2025.2.0

# root user to bootstrap the container
USER root

# Create local user
RUN useradd --create-home --shell /bin/bash ubuntu || echo "User already exists."

# Create the 'ubuntu' user and add it to the 'sudo' group
RUN usermod -aG sudo ubuntu

# nopasswd sudo
RUN mkdir -p /etc/sudoers.d/
RUN echo "ubuntu ALL=(ALL:ALL) NOPASSWD: ALL" | tee /etc/sudoers.d/ubuntu

# --- libstdc++ runtime upgrade ---------------------------------------------------------------------
# kit-cae C++ extensions (omni.cae.*) are compiled with the build host's system g++ (Ubuntu 24.04
# ships GCC 13.x), so their .so files require GLIBCXX_3.4.32, which the GCC-12 libstdc++ in this
# ov-base-ubuntu-22 base image does not provide. Pull a newer libstdc++6 from the libstdcxx-source
# stage above (built against jammy's glibc 2.35 — no GLIBC_2.38 breakage) and re-point the symlink.
# Remove this block if kit-cae is instead built on a 22.04 host / with g++-12.
COPY --from=libstdcxx-source /usr/lib/x86_64-linux-gnu/libstdc++.so.6.0.* /usr/lib/x86_64-linux-gnu/
RUN set -ex \
 && cd /usr/lib/x86_64-linux-gnu \
 && NEWEST=$(ls -1 libstdc++.so.6.0.* | sort -V | tail -1) \
 && rm -f libstdc++.so.6 \
 && ln -s "$NEWEST" libstdc++.so.6 \
 && ls -l libstdc++.so.6 libstdc++.so.6.0.*
# --------------------------------------------------------------------------------------------------

# repo package_container tool splits build dir in 2:
# - base layer: kit kernel + exts cache
# - app layer: everything else
# Thus larger and rarely changed files go in a separate base layer to optimize build, pull and push time.
ARG BASE_LAYER
ARG APP_LAYER

WORKDIR /app
# Set StreamSDK extended timeout config file
RUN mkdir -p /home/ubuntu/.config
RUN echo "SenderTimeout=1000000" > /home/ubuntu/.config/regkeys.txt && \
    chown root:root /home/ubuntu/.config/regkeys.txt && \
    chmod 555 /home/ubuntu/.config/regkeys.txt

COPY --chown=root:root --chmod=555 ${BASE_LAYER} /app/
COPY --chown=root:root --chmod=555 ${APP_LAYER} /app/

USER ubuntu
WORKDIR /app

# Create Kit expected caching directories that we'll map a volume onto.
RUN mkdir -p /home/ubuntu/.cache/ov
RUN mkdir -p /home/ubuntu/.local/share/ov
RUN mkdir -p /home/ubuntu/.nvidia-omniverse/config

# Create StreamSDK extended timeout config file
RUN mkdir -p /home/ubuntu/.config
RUN if [ -f stream_sdk.txt ]; then \
        cp stream_sdk.txt /home/ubuntu/.config/regkeys.txt && \
        chown root:root /home/ubuntu/.config/regkeys.txt && \
        chmod 555 /home/ubuntu/.config/regkeys.txt; \
    fi

# Create isolated venv for artifact collection (uses Kit's bundled Python as base)
# Supports Azure Blob Storage, AWS S3, and Google Cloud Storage via cloudpathlib.
# See ARTIFACT_COLLECTION.md for configuration details.
RUN /app/kit/python/bin/python3 -m venv /home/ubuntu/.artifact_collector_venv && \
    /home/ubuntu/.artifact_collector_venv/bin/pip install --quiet "cloudpathlib[azure]" "cloudpathlib[gs]" "cloudpathlib[s3]"

# Copy extra files from build context (artifact collector scripts and docs)
# These are copied by package_container.py based on extra_files config (default: *.py)
COPY --chown=root:root --chmod=555 *.py /app/
COPY --chown=root:root --chmod=444 *.md /app/

# Label for discovering kit_app_template built images within the docker registry.
LABEL kit_app_template=${kit_app}

# Open ports for live streaming
EXPOSE 47995-48012/udp \
       47995-48012/tcp \
       49000-49007/udp \
       49000-49007/tcp \
       8011/tcp \
       8111/tcp \
       49100/tcp

# This specifies the container's default entrypoint that will be called by "> docker run".
# Uncomment to simply launch the Kit app.
# ENTRYPOINT ["/app/${kit_app_whole}.sh"]

# Otherwise use the entrypoint script that supports passing extra arguments to the Kit App via environment variable injection along with some standard Kit args for containerized execution.
ENTRYPOINT ["/app/${entrypoint}"]
