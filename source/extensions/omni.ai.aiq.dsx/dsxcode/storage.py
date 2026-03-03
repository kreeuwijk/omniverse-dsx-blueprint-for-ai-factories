"""Shared storage between agents for passing data (prim paths, state, etc.)."""

import threading
from typing import Any, Optional

_storage: dict = {}
_storage_lock = threading.Lock()


def set_storage(key: str, value: Any) -> None:
    """Store a value that can be accessed by other agents."""
    with _storage_lock:
        _storage[key] = value


def get_storage(key: str, default: Optional[Any] = None) -> Any:
    """Retrieve a stored value."""
    with _storage_lock:
        return _storage.get(key, default)


def clear_storage(key: Optional[str] = None) -> None:
    """Clear one or all stored values."""
    with _storage_lock:
        if key:
            _storage.pop(key, None)
        else:
            _storage.clear()


def list_storage_keys() -> list:
    """List all storage keys."""
    with _storage_lock:
        return list(_storage.keys())
