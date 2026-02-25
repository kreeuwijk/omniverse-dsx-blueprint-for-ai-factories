"""DSX Code Interactive Gen Node — loads system message from markdown."""

from pathlib import Path
from typing import Optional

from lc_agent import RunnableNode, RunnableSystemAppend


class DsxCodeInteractiveGen(RunnableNode):
    """Generation node that injects the DSX code system message."""

    def __init__(self, system_message: Optional[str] = None, **kwargs):
        super().__init__(**kwargs)

        if system_message is None:
            md_path = (
                Path(__file__).parent / ".." / ".." / ".." / ".." / ".."
                / "messages" / "dsx_kit_code_system_message.md"
            )
            if md_path.exists():
                system_message = md_path.read_text(encoding="utf-8")

        if system_message:
            self.inputs.append(RunnableSystemAppend(system_message=system_message))
