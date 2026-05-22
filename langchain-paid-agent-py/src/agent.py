"""
Seller-side: one Nevermined-protected LangChain tool plus a minimal
LangGraph ReAct agent that uses it.

The tool is the only thing in this file that touches the Nevermined SDK.
Wrapping it with ``@requires_payment`` makes the function gated on an x402
access token threaded through ``RunnableConfig.configurable.payment_token``.
"""

import functools
import os

from dotenv import load_dotenv
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import ToolNode, create_react_agent

from payments_py import Payments, PaymentOptions
from payments_py.x402.langchain import requires_payment

load_dotenv()

NVM_API_KEY = os.environ["NVM_API_KEY"]
NVM_ENVIRONMENT = os.getenv("NVM_ENVIRONMENT", "sandbox")
NVM_PLAN_ID = os.environ["NVM_PLAN_ID"]

payments = Payments.get_instance(
    PaymentOptions(nvm_api_key=NVM_API_KEY, environment=NVM_ENVIRONMENT)
)


# Holder for the most recent settlement receipt so the buyer can read it
# after agent.invoke() returns. LangGraph copies RunnableConfig.configurable
# per node, so the SDK's in-place mutation lives only inside the tool node;
# this wrapper hoists the receipt back to module scope.
LAST_SETTLEMENT = {"value": None}


def _capture_settlement(func):
    """Read payment_settlement after @requires_payment has settled.

    Must sit OUTSIDE @requires_payment so it runs after the settle phase.
    """

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        result = func(*args, **kwargs)
        config = kwargs.get("config")
        if isinstance(config, dict):
            settlement = config.get("configurable", {}).get("payment_settlement")
            if settlement is not None:
                LAST_SETTLEMENT["value"] = settlement
        return result

    return wrapper


@tool
@_capture_settlement
@requires_payment(payments=payments, plan_id=NVM_PLAN_ID, credits=1)
def get_market_insight(topic: str, config: RunnableConfig = None) -> str:
    """Return a short market insight for the requested topic.

    Costs 1 Nevermined credit per call.

    Args:
        topic: The topic the user wants an insight about.
    """
    return (
        f"Market insight for '{topic}': demand is up 12% quarter-on-quarter "
        f"and three new entrants joined the segment last month."
    )


def create_agent():
    """Build a one-tool LangGraph ReAct agent.

    The tool is wrapped in a ToolNode with ``handle_tool_errors=False`` so the
    ``PaymentRequiredError`` raised by ``@requires_payment`` (when no token is
    threaded through ``RunnableConfig.configurable``) propagates up to the
    caller intact, with the full ``X402PaymentRequired`` payload on it. That
    is how the buyer discovers what to pay for without knowing the plan id,
    scheme, or provider up front.

    Default ``ToolNode`` behaviour would catch the exception and surface it
    as a ``ToolMessage`` to the LLM, losing the payload.
    """
    model = ChatOpenAI(model=os.getenv("MODEL_ID", "gpt-4o-mini"), temperature=0)
    prompt = (
        "You are a market data assistant. When the user asks about a topic, "
        "call the get_market_insight tool to fetch a short insight, then "
        "reply with what you found."
    )
    tool_node = ToolNode([get_market_insight], handle_tool_errors=False)
    return create_react_agent(model, tool_node, prompt=prompt)
