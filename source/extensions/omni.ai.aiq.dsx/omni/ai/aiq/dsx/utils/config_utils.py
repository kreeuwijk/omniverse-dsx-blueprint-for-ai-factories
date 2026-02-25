## Copyright (c) 2025, NVIDIA CORPORATION.  All rights reserved.

from pathlib import Path
import carb


def replace_md_file_references(config: dict, extension_path: Path) -> dict:
    """Recursively scan config dict and replace {path/to/file.md} patterns with file contents."""
    if isinstance(config, dict):
        return {k: replace_md_file_references(v, extension_path) for k, v in config.items()}
    elif isinstance(config, list):
        return [replace_md_file_references(item, extension_path) for item in config]
    elif isinstance(config, str):
        # Check for {path/to/file.md} pattern
        if config.startswith("{") and config.endswith("}"):
            file_ref = config[1:-1]
            file_path = extension_path / file_ref
            if file_path.exists() and file_path.is_file():
                try:
                    content = file_path.read_text(encoding="utf-8")
                    carb.log_info(f"Replaced reference {config} with content from {file_path}")
                    return content
                except Exception as e:
                    carb.log_error(f"Failed to read {file_path}: {e}")
            else:
                carb.log_warn(f"Referenced file not found: {file_path}")
        return config
    return config
