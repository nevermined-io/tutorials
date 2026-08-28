"""CLI buyer for the Deep Agents x402 gating demo.

Mirrors ``../langchain-research-agent-py/src/buyer.py`` — the buyer-side
contract is identical, which is the point: swapping the agent harness
does not change how a buyer pays. The x402 access token goes on
``config.configurable.payment_token`` and the agent's tool reads it,
whether that tool sits on the main agent or one delegation hop away
inside a subagent.

Exercises both paths in sequence:

  1. Free path - ask "what can you do?" with no token. The supervisor
     answers from its system prompt without delegating; no credits move.
  2. Paid path - mint an x402 access token from ``NVM_PLAN_ID``, attach
     it to the run, and ask for research. The supervisor delegates to
     `research-sub`, whose `market_research` tool verifies, analyses,
     and settles.

Run with: `poetry run buyer`
"""

import asyncio
import os
import re

import httpx
from dotenv import load_dotenv
from payments_py import PaymentOptions, Payments
from payments_py.x402.resolve_scheme import resolve_network, resolve_scheme
from payments_py.x402.types import (
    CreateDelegationPayload,
    DelegationConfig,
    X402TokenOptions,
)

load_dotenv()

DEPLOYMENT_URL = os.environ.get("LANGSMITH_DEPLOYMENT_URL", "http://127.0.0.1:2024")
NVM_API_KEY = os.environ["NVM_API_KEY"]
NVM_PLAN_ID = os.environ["NVM_PLAN_ID"]
ASSISTANT_ID = os.environ.get("ASSISTANT_ID", "deep_research")
RESEARCH_TOPIC = os.environ.get("INPUT", "Research the electric vehicle market")


def pick_payment_method(payments: Payments, provider: str):
    """Return the first enrolled payment method whose provider matches.

    Returns None and prints actionable guidance if no match exists.
    """
    methods = payments.delegation.list_payment_methods()
    pm = next((m for m in methods if getattr(m, "provider", None) == provider), None)
    if pm is None:
        available = (
            ", ".join(sorted({getattr(m, "provider", "unknown") for m in methods}))
            or "<none>"
        )
        print(
            f"      No {provider!r} payment method enrolled. "
            f"Available on this account: {available}. "
            f"Enroll a matching method at https://nevermined.app and re-run."
        )
    return pm


def _flatten(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return " ".join(
            block.get("text", "") if isinstance(block, dict) else str(block)
            for block in content
        )
    return str(content)


def _last_ai_text(state: dict) -> str:
    """Pull the last AI message text out of a LangGraph run-wait state."""
    ai = next(
        (m for m in reversed(state.get("messages", []) or []) if m.get("type") == "ai"),
        None,
    )
    return (
        _flatten(ai.get("content", "")) if ai else f"<no AI message in state: {state}>"
    )


def _last_tool_text(state: dict) -> str | None:
    """Pull the last ToolMessage content.

    On a deep agent this is the `task` tool's return value — i.e. the
    subagent's final answer, which should carry the paid tool's output
    verbatim. It is closer to the source of truth than the supervisor's
    own reply, which may paraphrase.
    """
    tool = next(
        (
            m
            for m in reversed(state.get("messages", []) or [])
            if m.get("type") == "tool"
        ),
        None,
    )
    return _flatten(tool.get("content", "")) if tool else None


def _strip_settlement_footer(text: str) -> str:
    """Trim the settlement-receipt footer we render at the end of paid replies."""
    return re.sub(r"\n+---\n+_💳.*?_\s*$", "", text, flags=re.DOTALL)


async def _create_thread(client: httpx.AsyncClient) -> str:
    response = await client.post("/threads", json={})
    response.raise_for_status()
    return response.json()["thread_id"]


async def _run(
    client: httpx.AsyncClient,
    thread_id: str,
    user_text: str,
    payment_token: str | None,
) -> dict:
    """Submit one run to the agent.

    Putting the token on `config.configurable.payment_token` is the whole
    contract. LangGraph propagates `configurable` into the subagent, so
    the paid tool sees it without the buyer knowing the agent's internal
    topology.
    """
    body: dict = {
        "assistant_id": ASSISTANT_ID,
        "input": {"messages": [{"type": "human", "content": user_text}]},
    }
    if payment_token:
        body["config"] = {"configurable": {"payment_token": payment_token}}

    response = await client.post(f"/threads/{thread_id}/runs/wait", json=body)
    response.raise_for_status()
    return response.json()


async def main() -> None:
    print(f"Connecting to LangSmith Deployment at {DEPLOYMENT_URL}\n")
    # `environment` is derived from the API-key prefix since payments-py 1.16.
    payments = Payments.get_instance(PaymentOptions(nvm_api_key=NVM_API_KEY))

    async with httpx.AsyncClient(base_url=DEPLOYMENT_URL, timeout=300.0) as client:
        # --- Free path -------------------------------------------------------
        print("[1/4] Asking the agent what it can do (free, no token)...")
        thread_id = await _create_thread(client)
        free_state = await _run(
            client, thread_id, "What can you do?", payment_token=None
        )
        print(f"      Agent reply:\n      {_last_ai_text(free_state)}\n")

        # --- Acquire token ---------------------------------------------------
        # Same scheme/network resolution the agent uses, so we mint the
        # correct token kind for whichever plan you configured.
        scheme = resolve_scheme(payments, NVM_PLAN_ID)
        network = resolve_network(payments, NVM_PLAN_ID) or "erc4337"
        print(f"[2/4] Plan resolves to scheme={scheme}, provider={network}")
        pm = pick_payment_method(payments, network)
        if pm is None:
            return
        print(f"      Using payment method: {pm.brand} *{pm.last4}\n")

        # Two steps, on purpose. Passing spending limits / a payment method
        # straight to `get_x402_access_token` (inline "create-on-the-fly"
        # delegation) is deprecated and emits a FutureWarning: create the
        # delegation first, then reference it by id.
        print("[3/4] Creating a spending delegation...")
        delegation = payments.delegation.create_delegation(
            CreateDelegationPayload(
                provider=network,
                provider_payment_method_id=pm.id,
                spending_limit_cents=10000,
                duration_secs=3600,
                currency="usd",
            )
        )
        print(f"      delegation = {delegation.delegation_id}")

        print("      Acquiring x402 access token from the plan...")
        token_result = payments.x402.get_x402_access_token(
            NVM_PLAN_ID,
            token_options=X402TokenOptions(
                scheme=scheme,
                delegation_config=DelegationConfig(
                    delegation_id=delegation.delegation_id
                ),
            ),
        )
        access_token = token_result["accessToken"]
        print(f"      token = {access_token[:24]}...  (truncated)\n")

        # --- Paid path -------------------------------------------------------
        print(f"[4/4] Running research request with token: {RESEARCH_TOPIC!r}")
        print("      (supervisor -> task() -> research-sub -> market_research)\n")
        paid_state = await _run(
            client, thread_id, RESEARCH_TOPIC, payment_token=access_token
        )
        # Prefer the raw ToolMessage: two LLM layers sit between the paid
        # tool and the final reply, and either may paraphrase.
        tool_text = _last_tool_text(paid_state)
        if tool_text:
            print("Agent reply (raw subagent output):\n")
            print(_strip_settlement_footer(tool_text))
            match = re.search(r"_💳[^_]*_", tool_text)
            if match:
                print(f"\n{match.group()}")
        else:
            print("Agent reply:\n")
            print(_last_ai_text(paid_state))


def cli() -> None:
    """Sync entry point for the poetry script."""
    asyncio.run(main())


if __name__ == "__main__":
    cli()
