"""DSX Code Interactive Network Node — extends BaseInteractiveNetworkNode with dsxcode support."""

from lc_agent import NetworkModifier, RunnableNetwork, RunnableNode
from lc_agent_interactive import BaseInteractiveNetworkNode


PREPEND_CODE = """
from typing import List
import dsxcode
import dsxinfo
import omni.usd
import usdcode

context = omni.usd.get_context()
stage = context.get_stage()

# Expose key functions directly so they can be called without module prefix
navigate_to_waypoint = dsxcode.navigate_to_waypoint
get_waypoint_names = dsxcode.get_waypoint_names
show_hot_aisle = dsxcode.show_hot_aisle
show_containment = dsxcode.show_containment
show_cfd_results = dsxcode.show_cfd_results
visualize_cfd = dsxcode.visualize_cfd
show_component = dsxcode.show_component
switch_rack_variant = dsxcode.switch_rack_variant
isolate_pod_rpps = dsxcode.isolate_pod_rpps
restore_pod_visibility = dsxcode.restore_pod_visibility

"""


class DebugModifier(NetworkModifier):
    """Logs every node invocation inside the DsxCodeInteractive network for debugging."""

    async def on_post_invoke_async(self, network: "RunnableNetwork", node: "RunnableNode"):
        if node.invoked and hasattr(node, "outputs") and node.outputs:
            content = getattr(node.outputs, "content", str(node.outputs))
            node_type = type(node).__name__
            has_code = "```python" in content or "```py" in content
            print(f"[DSX DEBUG] Node={node_type} has_code={has_code} content_len={len(content)}")
            if len(content) < 1000:
                print(f"[DSX DEBUG] Content: {content}")
            else:
                print(f"[DSX DEBUG] Content (first 500): {content[:500]}")


class DsxCodeInteractiveNetworkNode(BaseInteractiveNetworkNode):
    """
    DSX datacenter code execution agent.

    Executes Python code to navigate cameras, toggle visibility,
    and switch rack variants in the DSX datacenter digital twin.
    """

    def __init__(self, **kwargs):
        if "prepend_code" not in kwargs:
            kwargs["prepend_code"] = PREPEND_CODE

        super().__init__(
            helper_module="dsxcode",
            retriever_names=[],
            system_message=None,
            **kwargs,
        )

        # Add debug modifier to trace LLM output
        self.add_modifier(DebugModifier())

        self.metadata["description"] = (
            "DSX datacenter code agent: camera navigation, visibility control, variant switching"
        )
        self.metadata["examples"] = [
            "Navigate to the data hall",
            "Show the hot aisle containment",
            "Switch racks to GB300",
            "Hide the piping infrastructure",
        ]
