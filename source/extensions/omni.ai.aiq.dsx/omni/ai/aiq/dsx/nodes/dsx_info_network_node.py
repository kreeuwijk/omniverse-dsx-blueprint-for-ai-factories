"""DSX Info Network Node — extends BaseInteractiveNetworkNode with dsxinfo support."""

from lc_agent_interactive import BaseInteractiveNetworkNode

PREPEND_CODE = """
from typing import List
import dsxinfo
import dsxcode
import omni.usd
import usdcode

context = omni.usd.get_context()
stage = context.get_stage()

"""


class DsxInfoNetworkNode(BaseInteractiveNetworkNode):
    """
    DSX datacenter scene information agent.

    Queries the scene to find prim paths, list cameras, inspect components,
    and store results for the code agent to use.
    """

    def __init__(self, **kwargs):
        if "prepend_code" not in kwargs:
            kwargs["prepend_code"] = PREPEND_CODE

        super().__init__(
            helper_module="dsxinfo",
            retriever_names=[],
            system_message=None,
            **kwargs,
        )

        self.metadata["description"] = (
            "DSX datacenter scene query agent: find prims, list cameras, inspect components"
        )
        self.metadata["examples"] = [
            "Find all rack prims in the datahall",
            "List available cameras",
            "Get info about cooling components",
            "Find prims with rackVariant",
        ]
