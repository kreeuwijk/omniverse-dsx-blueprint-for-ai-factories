-- Shared build scripts from repo_build package.
repo_build = require("omni/repo/build")

-- Repo root
root = repo_build.get_abs_path(".")

-- Run repo_kit_tools premake5-kit that includes a bunch of Kit-friendly tooling configuration.
kit = require("_repo/deps/repo_kit_tools/kit-template/premake5-kit")
kit.setup_all({ cppdialect = "C++17" })


-- Option: --rebuild-deps forces a clean rebuild of submodule dependencies (kit-cae, kit-usd-agents).
-- By default, submodule deps are only built automatically on first build (when their _build/ doesn't exist).
-- Usage: ./repo.sh build --rebuild-deps (Linux) or repo.bat build --rebuild-deps (Windows)
newoption {
    trigger = "rebuild-deps",
    description = "Force rebuild of submodule dependencies (kit-cae, kit-usd-agents). " ..
                  "Normally they are only built once on first build. Use this after " ..
                  "updating a submodule or to do a clean rebuild of dependencies."
}

local force_rebuild = _OPTIONS["rebuild-deps"] ~= nil

local function repo_exec(dir, args)
    if os.host() == "windows" then
        return os.execute("cd /d \"" .. dir .. "\" && call repo.bat " .. args)
    else
        return os.execute("cd \"" .. dir .. "\" && chmod +x repo.sh tools/packman/*.sh 2>/dev/null && bash repo.sh " .. args)
    end
end

-- Build kit-cae submodule (schema + extensions).
-- kit-cae provides omni.cae.* extensions required by the DSX .kit apps.
-- Without this, `repo.sh build` fails with "No versions of omni.cae.algorithms.core".
local kit_cae_dir = root .. "/deps/kit-cae"
local kit_cae_build = kit_cae_dir .. "/_build"

if os.isdir(kit_cae_dir) then
    local need_build = force_rebuild or not os.isdir(kit_cae_build)
    if need_build then
        if force_rebuild then
            print("[DSX] --rebuild-deps: Rebuilding kit-cae submodule...")
        else
            print("[DSX] Building kit-cae submodule (first time)...")
        end
        local schema_args = "schema"
        local build_args = "build"
        if os.host() == "windows" then
            local vs2022_path = "C:/Program Files/Microsoft Visual Studio/2022"
            if os.isdir(vs2022_path) then
                schema_args = "schema --vs2022"
                build_args = "--set-token vs_version:vs2022 build"
            end
        end
        local schema_ok = repo_exec(kit_cae_dir, schema_args)
        if schema_ok then
            repo_exec(kit_cae_dir, build_args)
        else
            print("[DSX] WARNING: kit-cae schema step failed; skipping kit-cae build.")
        end
    end
end

-- Build kit-usd-agents submodule
local kit_agents_dir = root .. "/deps/kit-usd-agents"
local kit_agents_build = kit_agents_dir .. "/_build"

if os.isdir(kit_agents_dir) then
    if force_rebuild then
        print("[DSX] --rebuild-deps: Rebuilding kit-usd-agents submodule...")
        repo_exec(kit_agents_dir, "build")
    elseif not os.isdir(kit_agents_build) then
        print("[DSX] Building kit-usd-agents submodule (first time)...")
        repo_exec(kit_agents_dir, "build")
    end
end

-- Registries config for testing
repo_build.prebuild_copy {
    { "%{root}/tools/deps/user.toml", "%{root}/_build/deps/user.toml" },
}

-- Symlink kit-cae built extensions into our build output so they are found during precache and at runtime.
-- We have to do this manually here because kit-cae's premake doesn't know about our repo structure and build output folders.
local platform_target = _OPTIONS["platform-target"]
for something, ext in ipairs(os.matchdirs(root.."/deps/kit-cae/_build/"..platform_target.."/release/exts/*")) do
    local ext_name = path.getname(ext)
    for _, config in ipairs(ALL_CONFIGS) do
        local from = root.."/deps/kit-cae/_build/"..platform_target.."/"..config.."/exts/" .. ext_name
        local to = root.."/_build/"..platform_target.."/"..config.."/exts/" .. ext_name
        if os.isdir(from) then
            repo_build.prebuild_link {
            { from, to }
        }
        end
    end
end

-- Symlink kit-usd-agents source extensions into our build output.
-- kit-usd-agents' own build doesn't produce an exts/ directory, so we replicate what
-- each extension's premake5.lua does: symlink subdirs from source, then overlay the
-- pip prebundle dirs from kit-usd-agents' _build/target-deps/.
local kit_agents_src = root.."/deps/kit-usd-agents/source/extensions"
local kit_agents_deps = root.."/deps/kit-usd-agents/_build/target-deps"

for _, ext_path in ipairs(os.matchdirs(kit_agents_src.."/*")) do
    local ext_name = path.getname(ext_path)
    for _, config in ipairs(ALL_CONFIGS) do
        local target = root.."/_build/"..platform_target.."/"..config.."/exts/"..ext_name
        for _, subdir in ipairs(os.matchdirs(ext_path.."/*")) do
            local subdir_name = path.getname(subdir)
            repo_build.prebuild_link {
                { subdir, target.."/"..subdir_name }
            }
        end
    end
end

if os.isdir(kit_agents_deps) then
    for _, config in ipairs(ALL_CONFIGS) do
        local exts_base = root.."/_build/"..platform_target.."/"..config.."/exts"
        if os.isdir(kit_agents_deps.."/pip_core_prebundle") then
            repo_build.prebuild_link {
                { kit_agents_deps.."/pip_core_prebundle", exts_base.."/omni.ai.langchain.core/pip_core_prebundle" }
            }
        end
        if os.isdir(kit_agents_deps.."/pip_nat_prebundle") then
            repo_build.prebuild_link {
                { kit_agents_deps.."/pip_nat_prebundle", exts_base.."/omni.ai.langchain.nat/pip_nat_prebundle" }
            }
        end
    end
end

-- Symlink kit-cae build outputs into the main build directory
-- repo_build.prebuild_link {
--     { "%{root}/deps/kit-cae/_build/%{platform}/%{config}/apps", "%{root}/_build/%{platform}/%{config}/kit-cae/apps"},
--     { "%{root}/deps/kit-cae/_build/%{platform}/%{config}/exts", "%{root}/_build/%{platform}/%{config}/kit-cae/exts"}
-- }

-- Apps: for each app generate batch files and a project based on kit files (e.g. my_name.my_app.kit)

define_app("dsx.kit")
define_app("dsx_streaming.kit")
define_app("dsx_nvcf.kit")