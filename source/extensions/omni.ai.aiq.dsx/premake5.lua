local ext = get_current_extension_info()

project_ext (ext)
    repo_build.prebuild_link {
        { "data", ext.target_dir.."/data" },
        { "docs", ext.target_dir.."/docs" },
        { "messages", ext.target_dir.."/messages" },
        { "omni", ext.target_dir.."/omni" },
        { "dsxcode", ext.target_dir.."/dsxcode" },
        { "dsxinfo", ext.target_dir.."/dsxinfo" },
    }
