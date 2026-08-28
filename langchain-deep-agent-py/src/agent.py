"""Deep Agents market-research agent gated by Nevermined x402.

Same payment pattern as the sibling ``../langchain-research-agent-py``
tutorial, but built on the **Deep Agents harness** (``create_deep_agent``)
instead of ``create_react_agent``. The point of interest is *where* the
paid capability sits:

    main agent  --task()-->  research-sub  --> market_research  [PAID]

The buyer attaches an x402 access token to the run at
``config.configurable.payment_token``. The main agent never touches that
token; it delegates via the built-in ``task`` tool, and LangGraph copies
``configurable`` down into the subagent's own tool calls. So the
``@requires_payment`` decorator works **unchanged** one delegation hop
away from where the token was supplied.

Why that matters: a deep agent's whole premise is that the supervisor
hands work to subagents. If the payment context did not survive that hop,
every paid tool would have to live on the main agent and the harness
would be useless for monetized capabilities. It does survive.

Two consequences worth understanding before you ship something like this:

  1. **A deep agent can bill several times per user turn.** The
     supervisor decides how many subagent calls a request warrants, so
     one "research X" message may settle credits more than once. This
     module caps that explicitly (``MAX_PAID_CALLS_PER_RUN``) rather
     than trusting the model to be frugal.
  2. **Two LLM layers can paraphrase the tool's output.** The subagent
     relays to the supervisor, which relays to the user. Both are asked
     to pass text through verbatim, but neither is guaranteed to. Treat
     the tool's return value as the source of truth, not the chat reply.
"""

import logging
import os
import threading

from deepagents import create_deep_agent
from dotenv import load_dotenv
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from payments_py import PaymentOptions, Payments
from payments_py.x402.langchain import (
    PaymentRequiredError,
    last_settlement,
    requires_payment,
)

load_dotenv()

NVM_API_KEY = os.environ["NVM_API_KEY"]
NVM_PLAN_ID = os.environ["NVM_PLAN_ID"]
NVM_AGENT_ID = os.environ.get("NVM_AGENT_ID") or None

OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

# A deep agent decides for itself how many subagent hops a request needs.
# Each hop that reaches `market_research` settles credits, so cap it.
MAX_PAID_CALLS_PER_RUN = int(os.environ.get("NVM_MAX_PAID_CALLS_PER_RUN", "3"))

logger = logging.getLogger(__name__)

# `environment` is intentionally omitted: since payments-py 1.16 it is
# derived from the API-key prefix and passing it emits a FutureWarning.
_payments = Payments.get_instance(PaymentOptions(nvm_api_key=NVM_API_KEY))


def _resolve_plan_price() -> int:
    """Fetch the per-call credit price from the plan.

    The plan's ``registry.credits.maxAmount`` is the authoritative
    fixed-price-redemption cost; for range plans it is the upper bound.
    Falling back to 1 keeps the agent bootable against an unconfigured
    plan instead of failing at import time.
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

_BUDGET_EXHAUSTED_NOTICE = (
    "BUDGET_EXHAUSTED: This run already performed {limit} paid research "
    "call(s), the per-run cap. Returning without charging again. Ask a "
    "follow-up question to start a new run, or raise "
    "NVM_MAX_PAID_CALLS_PER_RUN."
)


class _RunBudget:
    """Counts paid calls per run so one turn cannot bill without bound.

    Deep agents may fan out to several subagent calls for a single user
    message. The counter is keyed by the LangGraph thread/run so
    concurrent runs in the same process do not share a budget.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._counts: dict[str, int] = {}

    @staticmethod
    def _key(config: RunnableConfig | None) -> str:
        configurable = (config or {}).get("configurable") or {}
        return str(
            configurable.get("run_id")
            or configurable.get("thread_id")
            or "default"
        )

    def try_consume(self, config: RunnableConfig | None) -> bool:
        """Reserve one paid call. False when the run is already at its cap."""
        key = self._key(config)
        with self._lock:
            used = self._counts.get(key, 0)
            if used >= MAX_PAID_CALLS_PER_RUN:
                return False
            self._counts[key] = used + 1
            return True

    def refund(self, config: RunnableConfig | None) -> None:
        """Give the reservation back when the call did not settle."""
        key = self._key(config)
        with self._lock:
            self._counts[key] = max(0, self._counts.get(key, 0) - 1)


_budget = _RunBudget()


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
        "Keep it factual and structured. 300-400 words total."
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
    settle_permissions after a successful return. It reads the token from
    ``config["configurable"]["payment_token"]`` — which is why `config`
    must be forwarded explicitly by the caller below.
    """
    return _run_analyst(topic)


@tool
def market_research(topic: str, config: RunnableConfig) -> str:
    """Produce a market analysis on the given topic.

    PAID capability. Each call charges credits via Nevermined x402. The
    buyer must supply a valid x402 access token under
    ``config.configurable.payment_token``. If the token is missing or
    invalid the tool returns a ``PAYMENT_REQUIRED:`` notice for the agent
    to relay back to the user.
    """
    plan_id_short = f"{NVM_PLAN_ID[:24]}..." if len(NVM_PLAN_ID) > 24 else NVM_PLAN_ID

    if not _budget.try_consume(config):
        logger.info("per-run paid-call cap reached (%s)", MAX_PAID_CALLS_PER_RUN)
        return _BUDGET_EXHAUSTED_NOTICE.format(limit=MAX_PAID_CALLS_PER_RUN)

    try:
        analysis = _market_research_paid(topic, config=config)
    except PaymentRequiredError as error:
        # No settlement happened, so this attempt should not count against
        # the run's budget — otherwise a user who authorizes mid-run gets
        # fewer paid calls than they paid for.
        _budget.refund(config)
        logger.info("payment required: %s", error)
        return _PAYMENT_REQUIRED_NOTICE.format(
            credits=PLAN_CREDITS_PER_CALL,
            plan_id_short=plan_id_short,
        )
    except Exception:
        _budget.refund(config)
        raise

    settlement = last_settlement()
    if settlement and getattr(settlement, "success", False):
        return (
            f"{analysis}\n\n---\n"
            f"_💳 Settled {settlement.credits_redeemed} credit(s). "
            f"Remaining balance: {settlement.remaining_balance}._"
        )
    if settlement is not None:
        # The decorator caught the settlement failure and logged a warning;
        # surface it inline so the buyer knows credits may not have been
        # burned even though they received the value.
        return (
            f"{analysis}\n\n---\n"
            f"_⚠️ Settlement reported failure: "
            f"{getattr(settlement, 'error_reason', 'unknown') or 'unknown'}._"
        )
    return analysis


# The paid tool is given ONLY to the subagent. That is the whole point of
# this tutorial: the supervisor cannot call `market_research` itself, so
# every paid call crosses a `task()` delegation boundary — and the x402
# token still arrives.
RESEARCH_SUBAGENT = {
    "name": "research-sub",
    "description": (
        "Performs paid market research on a single topic. Delegate here "
        "whenever the user asks for actual research or analysis."
    ),
    "system_prompt": (
        "You are a market research specialist with exactly one tool, "
        "`market_research`.\n\n"
        "1. Call `market_research` ONCE with the requested topic.\n"
        "2. Return the tool's output **verbatim**. Do not summarise it, "
        "re-structure its markdown, or drop the settlement receipt "
        "footer on the final line.\n"
        "3. If the output starts with `PAYMENT_REQUIRED:` or "
        "`BUDGET_EXHAUSTED:`, return exactly that text and nothing else. "
        "Never answer the research question from your own knowledge — "
        "that would give away the paid capability for free."
    ),
    "tools": [market_research],
}

SYSTEM_PROMPT = (
    "You are a market research agent published on the Nevermined Payments "
    "network, running on the Deep Agents harness. Your behaviour:\n\n"
    "1. When asked what you can do, who you are, how you work, or what "
    "you cost: answer conversationally. This is free.\n"
    "2. You have exactly one paid capability, and you cannot invoke it "
    f"yourself. It costs {PLAN_CREDITS_PER_CALL} credit(s) per call via "
    "the Nevermined x402 protocol and lives on the `research-sub` "
    "subagent.\n"
    "3. When the user asks you to actually perform research, delegate to "
    "`research-sub` via the `task` tool — **always**, even if an earlier "
    "attempt in this conversation returned `PAYMENT_REQUIRED:`. The user "
    "may have authorized in between, and a fresh call is the only way to "
    "find out.\n"
    "4. NEVER answer a research question from your own knowledge, and "
    "never reuse a previous tool result as a new answer. If you cannot "
    "get a paid result, say so plainly.\n"
    "5. Relay the subagent's output to the user **verbatim**, including "
    "the settlement receipt footer. You may add at most one short "
    "introductory sentence before it.\n"
    "6. If the result starts with `PAYMENT_REQUIRED:`, relay it verbatim "
    "and invite the user to click the **Authorize** button at the top of "
    "the chat.\n"
    "7. Decline politely if asked for anything unrelated. You are "
    "research-only.\n"
)

graph = create_deep_agent(
    model=f"openai:{OPENAI_MODEL}",
    tools=[],
    subagents=[RESEARCH_SUBAGENT],
    system_prompt=SYSTEM_PROMPT,
    name="deep-market-research-agent",
)
