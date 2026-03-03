"""DSX Info Gen Node — loads system message from markdown."""

from pathlib import Path
from typing import Optional

from lc_agent import RunnableNode, RunnableSystemAppend

_MESSAGES_DIR = (Path(__file__).parent / ".." / ".." / ".." / ".." / ".." / "messages").resolve()
_INFO_SYSTEM_MSG_PATH = _MESSAGES_DIR / "dsx_kit_info_system_message.md"
_CACHED_INFO_SYSTEM_MSG = None


class DsxInfoGen(RunnableNode):
    """Generation node that injects the DSX info system message."""

    def __init__(self, system_message: Optional[str] = None, **kwargs):
        super().__init__(**kwargs)

        if system_message is None:
            global _CACHED_INFO_SYSTEM_MSG
            if _CACHED_INFO_SYSTEM_MSG is None:
                if _INFO_SYSTEM_MSG_PATH.exists():
                    _CACHED_INFO_SYSTEM_MSG = _INFO_SYSTEM_MSG_PATH.read_text(encoding="utf-8")
            system_message = _CACHED_INFO_SYSTEM_MSG

        if system_message:
            self.inputs.append(RunnableSystemAppend(system_message=system_message))
