"""Unit tests for omni.ai.aiq.dsx.utils.config_utils — markdown file reference replacement."""

from pathlib import Path
from unittest.mock import MagicMock, patch

import omni.kit.test

from omni.ai.aiq.dsx.utils.config_utils import replace_md_file_references
import omni.ai.aiq.dsx.utils.config_utils as _cfg_mod


class TestReplaceMdFileReferences(omni.kit.test.AsyncTestCase):
    async def test_plain_string_unchanged(self):
        result = replace_md_file_references("hello world", Path("/ext"))
        self.assertEqual(result, "hello world")

    async def test_non_reference_braces_unchanged(self):
        result = replace_md_file_references("{not a file ref", Path("/ext"))
        self.assertEqual(result, "{not a file ref")

    async def test_replaces_file_reference(self):
        mock_path = MagicMock()
        mock_path.__truediv__ = lambda self, other: MagicMock(
            exists=MagicMock(return_value=True),
            is_file=MagicMock(return_value=True),
            read_text=MagicMock(return_value="# File Content"),
        )
        result = replace_md_file_references("{docs/readme.md}", mock_path)
        self.assertEqual(result, "# File Content")

    async def test_missing_file_returns_original(self):
        mock_path = MagicMock()
        child = MagicMock()
        child.exists.return_value = False
        child.is_file.return_value = False
        mock_path.__truediv__ = lambda self, other: child
        result = replace_md_file_references("{missing.md}", mock_path)
        self.assertEqual(result, "{missing.md}")

    async def test_recurses_into_dict(self):
        config = {"key": "value", "ref": "{file.md}"}
        mock_path = MagicMock()
        child = MagicMock()
        child.exists.return_value = True
        child.is_file.return_value = True
        child.read_text.return_value = "replaced"
        mock_path.__truediv__ = lambda self, other: child
        result = replace_md_file_references(config, mock_path)
        self.assertEqual(result["key"], "value")
        self.assertEqual(result["ref"], "replaced")

    async def test_recurses_into_list(self):
        config = ["plain", "{file.md}"]
        mock_path = MagicMock()
        child = MagicMock()
        child.exists.return_value = True
        child.is_file.return_value = True
        child.read_text.return_value = "content"
        mock_path.__truediv__ = lambda self, other: child
        result = replace_md_file_references(config, mock_path)
        self.assertEqual(result, ["plain", "content"])

    async def test_nested_structure(self):
        config = {"outer": [{"inner": "{deep.md}"}]}
        mock_path = MagicMock()
        child = MagicMock()
        child.exists.return_value = True
        child.is_file.return_value = True
        child.read_text.return_value = "deep content"
        mock_path.__truediv__ = lambda self, other: child
        result = replace_md_file_references(config, mock_path)
        self.assertEqual(result["outer"][0]["inner"], "deep content")

    async def test_non_string_non_dict_non_list_passthrough(self):
        self.assertEqual(replace_md_file_references(42, Path("/ext")), 42)
        self.assertIsNone(replace_md_file_references(None, Path("/ext")))
        self.assertEqual(replace_md_file_references(3.14, Path("/ext")), 3.14)

    async def test_empty_dict(self):
        self.assertEqual(replace_md_file_references({}, Path("/ext")), {})

    async def test_empty_list(self):
        self.assertEqual(replace_md_file_references([], Path("/ext")), [])

    async def test_read_text_exception(self):
        """If read_text raises, the original reference string is returned."""
        mock_path = MagicMock()
        child = MagicMock()
        child.exists.return_value = True
        child.is_file.return_value = True
        child.read_text.side_effect = IOError("disk error")
        mock_path.__truediv__ = lambda self, other: child
        # Suppress carb.log_error so Kit runner doesn't flag the output
        with patch.object(_cfg_mod.carb, "log_error"):
            result = replace_md_file_references("{broken.md}", mock_path)
        # On read failure the function logs an error and returns the original
        self.assertEqual(result, "{broken.md}")
