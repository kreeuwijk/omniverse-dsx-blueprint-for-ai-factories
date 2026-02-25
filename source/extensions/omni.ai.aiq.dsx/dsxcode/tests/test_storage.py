"""Unit tests for dsxcode.storage — shared agent storage."""

import omni.kit.test
from dsxcode.storage import set_storage, get_storage, clear_storage, list_storage_keys, _storage


class TestSetAndGet(omni.kit.test.AsyncTestCase):
    async def setUp(self):
        _storage.clear()

    async def test_set_and_get(self):
        set_storage("key", "value")
        self.assertEqual(get_storage("key"), "value")

    async def test_set_overwrites(self):
        set_storage("key", "first")
        set_storage("key", "second")
        self.assertEqual(get_storage("key"), "second")

    async def test_get_missing_returns_none(self):
        self.assertIsNone(get_storage("missing"))

    async def test_get_missing_returns_custom_default(self):
        self.assertEqual(get_storage("missing", "fallback"), "fallback")

    async def test_stores_various_types(self):
        set_storage("int", 42)
        set_storage("list", [1, 2, 3])
        set_storage("dict", {"a": 1})
        set_storage("none", None)
        self.assertEqual(get_storage("int"), 42)
        self.assertEqual(get_storage("list"), [1, 2, 3])
        self.assertEqual(get_storage("dict"), {"a": 1})
        self.assertIsNone(get_storage("none"))
        # Distinguish "stored None" from "missing key" via default sentinel
        sentinel = object()
        self.assertIsNone(get_storage("none", sentinel))


class TestClearStorage(omni.kit.test.AsyncTestCase):
    async def setUp(self):
        _storage.clear()

    async def test_clear_single_key(self):
        set_storage("a", 1)
        set_storage("b", 2)
        clear_storage("a")
        self.assertIsNone(get_storage("a"))
        self.assertEqual(get_storage("b"), 2)

    async def test_clear_all(self):
        set_storage("a", 1)
        set_storage("b", 2)
        clear_storage()
        self.assertEqual(list_storage_keys(), [])

    async def test_clear_nonexistent_key(self):
        clear_storage("nonexistent")


class TestListStorageKeys(omni.kit.test.AsyncTestCase):
    async def setUp(self):
        _storage.clear()

    async def test_empty(self):
        self.assertEqual(list_storage_keys(), [])

    async def test_returns_all_keys(self):
        set_storage("x", 1)
        set_storage("y", 2)
        set_storage("z", 3)
        self.assertEqual(sorted(list_storage_keys()), ["x", "y", "z"])

    async def test_returns_list_copy(self):
        set_storage("a", 1)
        keys = list_storage_keys()
        keys.append("fake")
        self.assertNotIn("fake", list_storage_keys())
