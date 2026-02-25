"""AIQ function type registration for DSX custom agents.

Registers DsxCodeInteractive, DsxInfo, and DsxMultiAgent function types
so workflow.yaml can reference them via _type.
"""

import logging
from typing import List, Optional, Type

from aiq.builder.builder import Builder
from aiq.builder.framework_enum import LLMFrameworkEnum
from aiq.cli.register_workflow import register_function
from aiq.data_models.component_ref import FunctionRef, LLMRef
from aiq.data_models.function import FunctionBaseConfig
from pydantic import Field

try:
    from lc_agent_nat import LCAgentFunction, MultiAgentNetworkFunction
except ImportError:
    LCAgentFunction = None
    MultiAgentNetworkFunction = None

logger = logging.getLogger(__name__)


def create_gen_class_with_system_message(base_class: Type, system_message: Optional[str]) -> Type:
    """Create a Gen class with system_message pre-configured (Pydantic-compatible)."""

    class GenWithSystemMessage(base_class):
        def __init__(self, **kwargs):
            if "system_message" not in kwargs:
                kwargs["system_message"] = system_message
            super().__init__(**kwargs)

    GenWithSystemMessage.__name__ = base_class.__name__
    GenWithSystemMessage.__qualname__ = base_class.__qualname__
    GenWithSystemMessage.__module__ = base_class.__module__
    return GenWithSystemMessage


# ── Config classes (name= is the _type value in workflow.yaml) ──────────────


class DsxCodeInteractiveConfig(FunctionBaseConfig, name="DsxCodeInteractive"):
    """Configuration for DSX Code Interactive function."""
    llm_name: Optional[LLMRef] = Field(default=None, description="LLM model for the code agent")
    system_message: Optional[str] = Field(default=None, description="System message for the code agent")


class DsxInfoConfig(FunctionBaseConfig, name="DsxInfo"):
    """Configuration for DSX Info function."""
    llm_name: Optional[LLMRef] = Field(default=None, description="LLM model for the info agent")
    system_message: Optional[str] = Field(default=None, description="System message for the info agent")


class DsxMultiAgentConfig(FunctionBaseConfig, name="DsxMultiAgent"):
    """Configuration for DSX MultiAgent supervisor."""
    llm_name: Optional[LLMRef] = Field(default=None, description="LLM model for the supervisor")
    tool_names: List[FunctionRef] = Field(default_factory=list, description="Sub-agent tools")
    system_message: str = Field(default="", description="Supervisor system message")
    multishot: bool = Field(default=False, description="Multi-step conversations")
    function_calling: bool = Field(default=False, description="Use function calling for routing")
    classification_node: bool = Field(default=True, description="Use classification node for routing")
    generate_prompt_per_agent: bool = Field(default=True, description="Generate prompt per agent")
    first_routing_instruction: str = Field(default="", description="First routing instruction")
    subsequent_routing_instruction: str = Field(default="", description="Subsequent routing instructions")


# ── Registration functions ──────────────────────────────────────────────────


@register_function(config_type=DsxCodeInteractiveConfig, framework_wrappers=[LLMFrameworkEnum.LANGCHAIN])
async def dsx_code_interactive_function(config: DsxCodeInteractiveConfig, builder: Builder):
    """Register the DsxCodeInteractive function."""
    if LCAgentFunction is None:
        logger.warning("lc_agent_nat not available, skipping DsxCodeInteractive registration")
        return
    from .nodes import DsxCodeInteractiveGen, DsxCodeInteractiveNetworkNode

    gen_type = create_gen_class_with_system_message(DsxCodeInteractiveGen, config.system_message)
    yield LCAgentFunction(
        config=config,
        builder=builder,
        lc_agent_node_type=DsxCodeInteractiveNetworkNode,
        lc_agent_node_gen_type=gen_type,
    )


@register_function(config_type=DsxInfoConfig, framework_wrappers=[LLMFrameworkEnum.LANGCHAIN])
async def dsx_info_function(config: DsxInfoConfig, builder: Builder):
    """Register the DsxInfo function."""
    if LCAgentFunction is None:
        logger.warning("lc_agent_nat not available, skipping DsxInfo registration")
        return
    from .nodes import DsxInfoGen, DsxInfoNetworkNode

    gen_type = create_gen_class_with_system_message(DsxInfoGen, config.system_message)
    yield LCAgentFunction(
        config=config,
        builder=builder,
        lc_agent_node_type=DsxInfoNetworkNode,
        lc_agent_node_gen_type=gen_type,
    )


@register_function(config_type=DsxMultiAgentConfig, framework_wrappers=[LLMFrameworkEnum.LANGCHAIN])
async def dsx_multi_agent_function(config: DsxMultiAgentConfig, builder: Builder):
    """Register the DsxMultiAgent supervisor function."""
    if MultiAgentNetworkFunction is None:
        raise ImportError("MultiAgentNetworkFunction not available")

    from lc_agent import RunnableNode, RunnableSystemAppend
    from lc_agent.multi_agent_network_node import MultiAgentNetworkNode
    from lc_agent_nat import replace_md_file_references

    system_message = replace_md_file_references(config.system_message)

    class DsxSupervisorNode(RunnableNode):
        def __init__(self, **kwargs):
            super().__init__(**kwargs)
            if system_message:
                self.inputs.append(RunnableSystemAppend(system_message=system_message))

    yield MultiAgentNetworkFunction(
        config=config,
        builder=builder,
        lc_agent_node_type=MultiAgentNetworkNode,
        lc_agent_node_gen_type=DsxSupervisorNode,
        multishot=config.multishot,
        function_calling=config.function_calling,
        classification_node=config.classification_node,
        generate_prompt_per_agent=config.generate_prompt_per_agent,
        first_routing_instruction=config.first_routing_instruction,
        subsequent_routing_instruction=config.subsequent_routing_instruction,
    )
