"""Buyer-side script for the Sprint 3 Nevermined x402 + LangSmith Deployment tutorial.

Drives the full 402 round-trip against a LangGraph agent deployed via
`langgraph dev` or `langgraph up`:

1. Create a thread (unprotected, free).
2. Submit a run via POST /threads/{id}/runs/wait WITHOUT payment-signature.
   Server returns 402 with the x402 envelope in the payment-required header.
3. Parse the envelope, pick an enrolled payment method, acquire an x402 token.
4. Retry with the payment-signature header. Server runs the agent, settles,
   and returns 200 with the settlement receipt in the payment-response header.

Run with: `poetry run buyer`
"""

import asyncio
import base64
import json
import os

import httpx
from dotenv import load_dotenv
from payments_py import PaymentOptions, Payments
from payments_py.x402.types import (
    DelegationConfig,
    X402PaymentRequired,
    X402TokenOptions,
)

load_dotenv()

DEPLOYMENT_URL = os.environ.get("LANGSMITH_DEPLOYMENT_URL", "http://127.0.0.1:2024")
NVM_API_KEY = os.environ["NVM_API_KEY"]
NVM_ENVIRONMENT = os.environ.get("NVM_ENVIRONMENT", "sandbox")
ASSISTANT_ID = os.environ.get("ASSISTANT_ID", "echo")
INPUT_VALUE = os.environ.get("INPUT", "hello from the buyer")


def derive_provider_from_plan(plan: dict) -> str:
    """Pick the payment-method provider key for a plan.

    Fiat plans carry fiatPaymentProvider (e.g. "stripe", "braintree", "visa")
    in metadata.plan. Crypto plans don't - for those we fall back to the
    last segment of the x402 scheme (e.g. nvm:erc4337 -> erc4337) which
    matches how erc4337 payment methods enroll.
    """
    plan_meta = plan.get("metadata", {}).get("plan", {})
    fiat = plan_meta.get("fiatPaymentProvider")
    if fiat:
        return fiat
    scheme = plan_meta.get("x402Scheme", "")
    return scheme.split(":")[-1] if ":" in scheme else scheme


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


async def main() -> None:
    print(f"Connecting to LangSmith Deployment at {DEPLOYMENT_URL}\n")

    payments = Payments.get_instance(
        PaymentOptions(nvm_api_key=NVM_API_KEY, environment=NVM_ENVIRONMENT)
    )

    async with httpx.AsyncClient(base_url=DEPLOYMENT_URL, timeout=60.0) as client:
        # 1. Create thread (unprotected).
        print("[1/5] Creating thread...")
        thread_resp = await client.post("/threads", json={})
        thread_resp.raise_for_status()
        thread_id = thread_resp.json()["thread_id"]
        print(f"      thread_id = {thread_id}\n")

        run_path = f"/threads/{thread_id}/runs/wait"
        run_body = {"assistant_id": ASSISTANT_ID, "input": {"input": INPUT_VALUE}}

        # 2. First attempt - no payment signature, expect 402 with envelope.
        print("[2/5] Submitting run without payment-signature -> expecting 402...")
        first = await client.post(run_path, json=run_body)
        if first.status_code != 402:
            print(f"      Unexpected status {first.status_code}: {first.text}")
            return
        envelope_b64 = first.headers.get("payment-required")
        if not envelope_b64:
            print("      Server returned 402 but no payment-required header. Aborting.")
            return
        envelope_json = base64.b64decode(envelope_b64).decode()
        requirements = X402PaymentRequired.model_validate_json(envelope_json)
        accept = requirements.accepts[0]
        print(
            f"      envelope: scheme={accept.scheme}, "
            f"network={accept.network}, plan_id={accept.plan_id[:24]}...\n"
        )

        # 3. Pick an enrolled payment method.
        # The envelope's network is the blockchain network ("eip155:84532"),
        # not the payment-method provider. Fetch the plan metadata to learn
        # whether this is a fiat plan (stripe/braintree/visa) or a crypto
        # plan (erc4337) and match against that.
        plan = payments.plans.get_plan(accept.plan_id)
        provider = derive_provider_from_plan(plan)
        print(f"[3/5] Picking enrolled payment method matching {provider!r}...")
        pm = pick_payment_method(payments, provider)
        if pm is None:
            return
        print(f"      {pm.brand} *{pm.last4}\n")

        # 4. Acquire an x402 access token from the plan.
        print("[4/5] Acquiring x402 access token...")
        token_result = payments.x402.get_x402_access_token(
            accept.plan_id,
            token_options=X402TokenOptions(
                scheme=accept.scheme,
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

        # 5. Retry with payment-signature -> expect 200 + settlement receipt.
        print("[5/5] Retrying run with payment-signature -> expecting 200...")
        second = await client.post(
            run_path,
            json=run_body,
            headers={"payment-signature": access_token},
        )
        second.raise_for_status()
        print(f"      Agent output: {second.json()}\n")

        settlement_b64 = second.headers.get("payment-response")
        if settlement_b64:
            settlement = json.loads(base64.b64decode(settlement_b64))
            print("Settlement receipt:")
            print(f"      transaction:       {settlement.get('transaction')}")
            print(f"      payer:             {settlement.get('payer')}")
            print(f"      credits_redeemed:  {settlement.get('credits_redeemed')}")
            print(f"      remaining_balance: {settlement.get('remaining_balance')}")
        else:
            print("      (no payment-response header - settle may have failed; check server logs)")


def cli() -> None:
    """Sync entry point for the poetry script."""
    asyncio.run(main())


if __name__ == "__main__":
    cli()
