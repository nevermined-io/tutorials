"""
Buyer-side: acquire an x402 access token, invoke the agent, print the
settlement receipt.

Run with: ``poetry run buyer``
"""

import os

from dotenv import load_dotenv

from payments_py import Payments, PaymentOptions
from payments_py.x402.types import DelegationConfig, X402TokenOptions

from .agent import LAST_SETTLEMENT, create_agent

load_dotenv()

NVM_API_KEY = os.environ["NVM_API_KEY"]
NVM_ENVIRONMENT = os.getenv("NVM_ENVIRONMENT", "sandbox")
NVM_PLAN_ID = os.environ["NVM_PLAN_ID"]
# Provider of the enrolled payment method to use. Must match the provider
# the plan was created against (the SDK call to Stripe will 404 otherwise).
PAYMENT_PROVIDER = os.getenv("NVM_PAYMENT_PROVIDER", "stripe")

QUERY = os.getenv("QUERY", "What's the market insight on electric vehicles?")


def main() -> None:
    # The buyer uses the same Nevermined account as the seller in this demo;
    # the account has subscribed to its own plan to acquire x402 tokens.
    payments = Payments.get_instance(
        PaymentOptions(nvm_api_key=NVM_API_KEY, environment=NVM_ENVIRONMENT)
    )

    print(f"[1/4] Acquiring x402 access token for plan {NVM_PLAN_ID}...")
    methods = payments.delegation.list_payment_methods()
    if not methods:
        print(
            "      No payment methods enrolled. Add a card/PayPal at "
            "https://nevermined.app and re-run."
        )
        return

    pm = next((m for m in methods if getattr(m, "provider", None) == PAYMENT_PROVIDER), None)
    if pm is None:
        available = ", ".join(sorted({getattr(m, "provider", "unknown") for m in methods})) or "<none>"
        print(
            f"      No {PAYMENT_PROVIDER!r} payment method enrolled. "
            f"Available providers on this account: {available}. "
            f"Set NVM_PAYMENT_PROVIDER in .env to match your plan's provider."
        )
        return
    print(f"      payment method: {pm.brand} *{pm.last4} (provider: {pm.provider})")

    token_result = payments.x402.get_x402_access_token(
        NVM_PLAN_ID,
        token_options=X402TokenOptions(
            scheme="nvm:card-delegation",
            delegation_config=DelegationConfig(
                provider_payment_method_id=pm.id,
                spending_limit_cents=10000,  # $100 cap per delegation
                duration_secs=604800,        # 1 week TTL
                currency="usd",
            ),
        ),
    )
    access_token = token_result["accessToken"]
    print(f"      token = {access_token[:24]}...  (truncated)\n")

    print("[2/4] Building the LangGraph agent...")
    agent = create_agent()
    print()

    print(f"[3/4] Invoking the agent with query: {QUERY!r}")
    configurable = {"payment_token": access_token}
    result = agent.invoke(
        {"messages": [("human", QUERY)]},
        config={"configurable": configurable},
    )
    final_message = result["messages"][-1]
    print(f"\n      Agent answer: {final_message.content}\n")

    print("[4/4] Settlement receipt:")
    settlement = LAST_SETTLEMENT["value"]
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
