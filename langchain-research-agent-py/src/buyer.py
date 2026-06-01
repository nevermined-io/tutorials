"""CLI buyer for the in-tool x402 gating demo.

The agent's `market_research` tool gates itself: it reads an x402 access
token from `config.configurable.payment_token`, runs verify ->
analyse -> settle, and returns either a market analysis (paid path) or
a `PAYMENT_REQUIRED:` notice (free path) that the LLM relays back.

This buyer exercises both paths in sequence:

  1. Free path  - ask "what can you do?" without any payment signature.
     The agent describes its capabilities; no credits charged.
  2. Pay path   - mint an x402 access token from `NVM_PLAN_ID`, attach
     it to `config.configurable.payment_token`, ask the agent to
     research a topic. The tool verifies the token, generates the
     analysis, and settles credits on the way out.

Run with: `poetry run buyer`
"""

import asyncio
import os
import re

import httpx
from dotenv import load_dotenv
from payments_py import PaymentOptions, Payments
from payments_py.x402.resolve_scheme import resolve_network, resolve_scheme
from payments_py.x402.types import DelegationConfig, X402TokenOptions

load_dotenv()

DEPLOYMENT_URL = os.environ.get("LANGSMITH_DEPLOYMENT_URL", "http://127.0.0.1:2024")
NVM_API_KEY = os.environ["NVM_API_KEY"]
NVM_ENVIRONMENT = os.environ.get("NVM_ENVIRONMENT", "sandbox")
NVM_PLAN_ID = os.environ["NVM_PLAN_ID"]
ASSISTANT_ID = os.environ.get("ASSISTANT_ID", "research")
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
    """Pull the last ToolMessage content - this is the raw tool output."""
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

    Putting the payment signature on `config.configurable.payment_token`
    is the contract the tool reads from. The header form used by the
    route-level middleware is not used here; the HTTP route is ungated.
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
    payments = Payments.get_instance(
        PaymentOptions(nvm_api_key=NVM_API_KEY, environment=NVM_ENVIRONMENT)
    )

    async with httpx.AsyncClient(base_url=DEPLOYMENT_URL, timeout=120.0) as client:
        # --- Free path -------------------------------------------------------
        print("[1/4] Asking the agent what it can do (free, no token)...")
        thread_id = await _create_thread(client)
        free_state = await _run(
            client, thread_id, "What can you do?", payment_token=None
        )
        print(f"      Agent reply:\n      {_last_ai_text(free_state)}\n")

        # --- Acquire token ---------------------------------------------------
        # Use the same scheme/network resolution the agent uses so we mint
        # the correct token kind for whichever plan you configured.
        scheme = resolve_scheme(payments, NVM_PLAN_ID)
        network = resolve_network(payments, NVM_PLAN_ID) or "erc4337"
        print(f"[2/4] Plan resolves to scheme={scheme}, provider={network}")
        pm = pick_payment_method(payments, network)
        if pm is None:
            return
        print(f"      Using payment method: {pm.brand} *{pm.last4}\n")

        print("[3/4] Acquiring x402 access token from the plan...")
        token_result = payments.x402.get_x402_access_token(
            NVM_PLAN_ID,
            token_options=X402TokenOptions(
                scheme=scheme,
                delegation_config=DelegationConfig(
                    provider_payment_method_id=pm.id,
                    spending_limit_cents=10000,
                    duration_secs=3600,
                    currency="usd",
                ),
            ),
        )
        access_token = token_result["accessToken"]
        print(f"      token = {access_token[:24]}...  (truncated)\n")

        # --- Paid path -------------------------------------------------------
        print(f"[4/4] Running research request with token: {RESEARCH_TOPIC!r}\n")
        paid_state = await _run(
            client, thread_id, RESEARCH_TOPIC, payment_token=access_token
        )
        # Prefer the raw ToolMessage if available — the outer LLM may
        # paraphrase and drop the settlement footer; the tool's own
        # output is the source of truth.
        tool_text = _last_tool_text(paid_state)
        if tool_text:
            print("Agent reply (raw tool output):\n")
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
