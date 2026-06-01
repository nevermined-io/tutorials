"""Freemium market-research agent gated by Nevermined x402.

In-graph payment gating via the ``payments_py.x402.langchain.requires_payment``
decorator. The graph itself is a freely callable LangChain ReAct agent —
anyone can chat with it to ask what it does. The single paid capability
(``market_research``) is wrapped by the decorator, which runs the
canonical x402 lifecycle::

    verify_permissions -> tool body -> settle_permissions

against the buyer's access token (read from
``config["configurable"]["payment_token"]``). The decorator also emits
``nvm:verify`` / ``nvm:settle`` LangSmith spans automatically.

Why in-tool gating instead of route-level middleware:
  - Route-level middleware (``payments_py.langsmith.PaymentMiddleware``)
    gates the whole HTTP route, so any message would require payment
    up-front. Buyers cannot ask the agent what it does without paying.
  - Tool-layer gating lets the LLM act as the front-of-house concierge —
    it answers introspection questions for free and routes only paid
    capabilities through verify/settle.

The graph deploys to LangSmith Deployment as a vanilla LangGraph
application (no ``http.app`` required). The buyer-side proxy is
responsible for injecting the x402 access token into
``config["configurable"]["payment_token"]`` on the run; both the CLI
buyer (``src/buyer.py``) and the chat UI proxy in
``../langchain-chat-ui-nvm/`` do this.
"""

import logging
import os

from dotenv import load_dotenv
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from payments_py import PaymentOptions, Payments
from payments_py.x402.langchain import (
    PaymentRequiredError,
    last_settlement,
    requires_payment,
)

load_dotenv()

NVM_API_KEY = os.environ["NVM_API_KEY"]
NVM_ENVIRONMENT = os.environ.get("NVM_ENVIRONMENT", "sandbox")
NVM_PLAN_ID = os.environ["NVM_PLAN_ID"]
NVM_AGENT_ID = os.environ.get("NVM_AGENT_ID") or None

OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

logger = logging.getLogger(__name__)

_payments = Payments.get_instance(
    PaymentOptions(nvm_api_key=NVM_API_KEY, environment=NVM_ENVIRONMENT)
)


def _resolve_plan_price() -> int:
    """Fetch the per-call credit price from the plan.

    The plan's ``registry.credits.maxAmount`` is the authoritative
    fixed-price-redemption cost; for range plans it is the upper bound.
    Falling back to 1 if the field is missing keeps the agent bootable
    against unconfigured plans without surfacing operator-confusing
    errors at import time.
    """
    try:
        plan = _payments.plans.get_plan(NVM_PLAN_ID) or {}
        credits = (plan.get("registry") or {}).get("credits") or {}
        raw = credits.get("maxAmount") or credits.get("amount")
        if raw is not None:
            return int(raw)
    except Exception as error:
        logger.warning(
            "Could not resolve plan price for %s, defaulting to 1: %s",
            NVM_PLAN_ID,
            error,
        )
    return 1


PLAN_CREDITS_PER_CALL = _resolve_plan_price()

_PAYMENT_REQUIRED_NOTICE = (
    "PAYMENT_REQUIRED: This capability charges {credits} credit(s) per call "
    "via Nevermined plan `{plan_id_short}`. The buyer must include a valid "
    "x402 access token under `config.configurable.payment_token` — in the "
    "browser chat UI that happens automatically once the user clicks the "
    "**Authorize** button at the top and creates a card delegation. "
    "Please authorize and ask again."
)

SYSTEM_PROMPT = (
    "You are a market research agent published on the Nevermined Payments "
    "network. Your behaviour:\n\n"
    "1. When asked what you can do, who you are, how you work, what you "
    "cost, or anything else introspective: answer conversationally. This "
    "is free.\n"
    "2. You have exactly one paid capability — `market_research(topic)` — "
    "which produces a concise market analysis on any topic. Each call "
    f"charges {PLAN_CREDITS_PER_CALL} credit(s) via the Nevermined x402 "
    "protocol.\n"
    "3. When the user asks you to actually perform research on a topic, "
    "**always** call the `market_research` tool — even if a previous "
    "call in this conversation returned `PAYMENT_REQUIRED:`. The user may "
    "have authorized between attempts and a fresh call is the only way to "
    "know. NEVER fabricate research from your own memory and NEVER reuse "
    "the text of a prior tool result as your answer.\n"
    "4. When the tool returns text, present it to the user **verbatim** — "
    "do not paraphrase, re-structure markdown, or trim the settlement "
    "receipt footer the tool appends. You may add at most one short "
    "introductory sentence (e.g. 'Here you go:') before pasting.\n"
    "5. If the tool's response starts with `PAYMENT_REQUIRED:`, relay it "
    "verbatim and invite the user to click the **Authorize** button at the "
    "top of the chat.\n"
    "6. Decline politely if asked for anything unrelated (writing code, "
    "doing math, general chit-chat). You are research-only.\n"
)


def _run_analyst(topic: str) -> str:
    """Generate a market analysis using a research-analyst LLM persona."""
    analyst = ChatOpenAI(model=OPENAI_MODEL, temperature=0.4)
    prompt = (
        "You are a senior market research analyst. Write a concise market "
        f"analysis on: {topic}\n\n"
        "Structure with these markdown sections:\n"
        "  ## Market Size\n"
        "  ## Key Players\n"
        "  ## Trends\n"
        "  ## Opportunities\n\n"
        "Keep it factual and structured. 300–400 words total."
    )
    response = analyst.invoke(prompt)
    content = response.content
    return content if isinstance(content, str) else str(content)


@requires_payment(
    payments=_payments,
    plan_id=NVM_PLAN_ID,
    credits=PLAN_CREDITS_PER_CALL,
    agent_id=NVM_AGENT_ID,
)
def _market_research_paid(topic: str, config: RunnableConfig) -> str:
    """Inner, payment-protected implementation.

    The decorator runs verify_permissions before this body executes and
    settle_permissions after a successful return. The settlement receipt
    lands in ``last_settlement()`` so the outer ``@tool`` wrapper can
    append it to the user-facing reply.
    """
    return _run_analyst(topic)


@tool
def market_research(topic: str, config: RunnableConfig) -> str:
    """Produce a market analysis on the given topic.

    PAID capability. Each call charges credits via Nevermined x402. The
    buyer must supply a valid x402 access token under
    ``config.configurable.payment_token``. If the token is missing or
    invalid the tool returns a ``PAYMENT_REQUIRED:`` notice for the LLM
    to relay back to the user.
    """
    plan_id_short = f"{NVM_PLAN_ID[:24]}..." if len(NVM_PLAN_ID) > 24 else NVM_PLAN_ID

    try:
        analysis = _market_research_paid(topic, config=config)
    except PaymentRequiredError as error:
        logger.info("payment required: %s", error)
        return _PAYMENT_REQUIRED_NOTICE.format(
            credits=PLAN_CREDITS_PER_CALL,
            plan_id_short=plan_id_short,
        )

    settlement = last_settlement()
    if settlement and getattr(settlement, "success", False):
        return (
            f"{analysis}\n\n---\n"
            f"_💳 Settled {settlement.credits_redeemed} credit(s). "
            f"Remaining balance: {settlement.remaining_balance}._"
        )
    if settlement is not None:
        # Decorator caught the settlement failure and logged a warning;
        # surface it inline so the buyer is aware credits may not have
        # been burned even though they received the value.
        return (
            f"{analysis}\n\n---\n"
            f"_⚠️ Settlement reported failure: "
            f"{getattr(settlement, 'error_reason', 'unknown') or 'unknown'}._"
        )
    return analysis


_llm = ChatOpenAI(model=OPENAI_MODEL, temperature=0.2)

graph = create_react_agent(
    _llm,
    tools=[market_research],
    prompt=SYSTEM_PROMPT,
    name="market-research-agent",
)
