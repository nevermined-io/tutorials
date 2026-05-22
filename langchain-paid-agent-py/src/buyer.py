"""
Buyer-side: discover payment requirements from the protocol error,
acquire an x402 access token against the discovered plan, invoke the
agent, print the settlement receipt.

Run with: ``poetry run buyer``
"""

import os

from dotenv import load_dotenv

from payments_py import Payments, PaymentOptions
from payments_py.x402.langchain import PaymentRequiredError, last_settlement
from payments_py.x402.types import DelegationConfig, X402TokenOptions

from .agent import create_agent

load_dotenv()

NVM_API_KEY = os.environ["NVM_API_KEY"]
NVM_ENVIRONMENT = os.getenv("NVM_ENVIRONMENT", "sandbox")

QUERY = os.getenv("QUERY", "What's the market insight on electric vehicles?")


def pick_payment_method(payments: Payments, provider: str):
    """Return the first enrolled payment method whose ``provider`` matches.

    Returns ``None`` and prints an actionable error if no match exists.
    The error message lists the providers that ARE enrolled on the account
    so the reader knows what to enroll (or which env var to flip if the
    plan was created against a different provider).

    A backend-side filter is being requested via nevermined-io/nvm-monorepo#1715
    — once that lands the SDK can pass ``provider=...`` to ``list_payment_methods``
    and skip this client-side filter.
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


def main() -> None:
    # The buyer uses the same Nevermined account as the seller in this demo;
    # the account has subscribed to its own plan to acquire x402 tokens.
    payments = Payments.get_instance(
        PaymentOptions(nvm_api_key=NVM_API_KEY, environment=NVM_ENVIRONMENT)
    )
    agent = create_agent()

    print("[1/5] Asking the agent without paying (discovering requirements)...")
    try:
        agent.invoke(
            {"messages": [("human", QUERY)]},
            config={"configurable": {}},  # no payment_token
        )
    except PaymentRequiredError as err:
        requirements = err.payment_required
    else:
        # Defensive: if the agent answered without calling the protected tool
        # we have nothing to pay for. Bail out instead of hiding the surprise.
        print("      Unexpected: agent answered without calling the paid tool. Aborting.")
        return

    accept = requirements.accepts[0]
    print(f"      scheme:  {accept.scheme}")
    print(f"      network: {accept.network}")
    print(f"      plan_id: {accept.plan_id[:24]}...\n")

    print(f"[2/5] Picking an enrolled payment method matching {accept.network!r}...")
    pm = pick_payment_method(payments, accept.network)
    if pm is None:
        return
    print(f"      {pm.brand} *{pm.last4}\n")

    print("[3/5] Acquiring x402 access token from the discovered plan...")
    token_result = payments.x402.get_x402_access_token(
        accept.plan_id,
        token_options=X402TokenOptions(
            scheme=accept.scheme,
            delegation_config=DelegationConfig(
                provider_payment_method_id=pm.id,
                spending_limit_cents=10000,  # $100 cap per delegation
                duration_secs=3600,          # 1 hour TTL
                currency="usd",
            ),
        ),
    )
    access_token = token_result["accessToken"]
    print(f"      token = {access_token[:24]}...  (truncated)\n")

    print(f"[4/5] Asking the agent again with the token: {QUERY!r}")
    result = agent.invoke(
        {"messages": [("human", QUERY)]},
        config={"configurable": {"payment_token": access_token}},
    )
    final_message = result["messages"][-1]
    print(f"\n      Agent answer: {final_message.content}\n")

    print("[5/5] Settlement receipt:")
    settlement = last_settlement()
    if settlement is None:
        print("      (no settlement recorded — the tool may not have been called)")
        return

    receipt_fields = {
        "credits_redeemed": getattr(settlement, "credits_redeemed", None),
        "remaining_balance": getattr(settlement, "remaining_balance", None),
        "transaction": getattr(settlement, "transaction", None),
        "network": getattr(settlement, "network", None),
        "payer": getattr(settlement, "payer", None),
    }
    for k, v in receipt_fields.items():
        if v is not None:
            print(f"      {k}: {v}")


if __name__ == "__main__":
    main()
