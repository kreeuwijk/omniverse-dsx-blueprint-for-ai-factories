"""Shared storage between agents for passing data (prim paths, state, etc.)."""

from typing import Any, Optional

_storage: dict = {}


def set_storage(key: str, value: Any) -> None:
    """Store a value that can be accessed by other agents."""
    _storage[key] = value


def get_storage(key: str, default: Optional[Any] = None) -> Any:
    """Retrieve a stored value."""
    return _storage.get(key, default)


def clear_storage(key: Optional[str] = None) -> None:
    """Clear one or all stored values."""
    if key:
        _storage.pop(key, None)
    else:
        _storage.clear()


def list_storage_keys() -> list:
    """List all storage keys."""
    return list(_storage.keys())
