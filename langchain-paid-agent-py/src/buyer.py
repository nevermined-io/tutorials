"""
Buyer-side: acquire an x402 access token, invoke the agent, print the
settlement receipt.

Run with: ``poetry run buyer``
"""

import os

from dotenv import load_dotenv

from payments_py import Payments, PaymentOptions

from .agent import create_agent

load_dotenv()

NVM_SUBSCRIBER_API_KEY = os.environ["NVM_SUBSCRIBER_API_KEY"]
NVM_ENVIRONMENT = os.getenv("NVM_ENVIRONMENT", "sandbox")
NVM_PLAN_ID = os.environ["NVM_PLAN_ID"]

QUERY = os.getenv("QUERY", "What's the market insight on electric vehicles?")


def main() -> None:
    buyer_payments = Payments.get_instance(
        PaymentOptions(nvm_api_key=NVM_SUBSCRIBER_API_KEY, environment=NVM_ENVIRONMENT)
    )

    print(f"[1/4] Acquiring x402 access token for plan {NVM_PLAN_ID}...")
    token_result = buyer_payments.x402.get_x402_access_token(NVM_PLAN_ID)
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

    print("[4/4] Settlement receipt (from configurable.payment_settlement):")
    settlement = configurable.get("payment_settlement")
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
