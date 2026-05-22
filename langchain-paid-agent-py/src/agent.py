"""
Seller-side: one Nevermined-protected LangChain tool plus a minimal
LangGraph ReAct agent that uses it.

The tool is the only thing in this file that touches the Nevermined SDK.
Wrapping it with ``@requires_payment`` makes the function gated on an x402
access token threaded through ``RunnableConfig.configurable.payment_token``.
"""

import os

from dotenv import load_dotenv
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent

from payments_py import Payments, PaymentOptions
from payments_py.x402.langchain import requires_payment

load_dotenv()

NVM_API_KEY = os.environ["NVM_API_KEY"]
NVM_ENVIRONMENT = os.getenv("NVM_ENVIRONMENT", "sandbox")
NVM_PLAN_ID = os.environ["NVM_PLAN_ID"]

payments = Payments.get_instance(
    PaymentOptions(nvm_api_key=NVM_API_KEY, environment=NVM_ENVIRONMENT)
)


@tool
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
    """Build a one-tool LangGraph ReAct agent."""
    model = ChatOpenAI(model=os.getenv("MODEL_ID", "gpt-4o-mini"), temperature=0)
    prompt = (
        "You are a market data assistant. When the user asks about a topic, "
        "call the get_market_insight tool to fetch a short insight, then "
        "reply with what you found."
    )
    return create_react_agent(model, [get_market_insight], prompt=prompt)
