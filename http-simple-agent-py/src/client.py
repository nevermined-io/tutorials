"""
x402 Client - Demonstrates the full payment flow.

This client shows the complete x402 HTTP protocol flow:
1. Request without token -> 402 Payment Required
2. Decode payment requirements from header
3. Resolve scheme (auto-detect crypto vs fiat plan)
4. Generate x402 access token (with card-delegation config if fiat)
5. Request with token -> Success
6. Decode settlement response from header
"""

import base64
import json
import os
import sys

# IMPORTANT: Load environment variables BEFORE importing payments_py
# so that env vars are available during SDK initialization
from dotenv import load_dotenv

load_dotenv()

import httpx

from payments_py import Payments, PaymentOptions
from payments_py.x402.fastapi import X402_HEADERS
from payments_py.x402.resolve_scheme import resolve_scheme
from payments_py.x402.types import DelegationConfig, X402TokenOptions

# Configuration
SERVER_URL = os.getenv("SERVER_URL", "http://localhost:3000")
NVM_API_KEY = os.getenv("NVM_API_KEY", "")
NVM_ENVIRONMENT = os.getenv("NVM_ENVIRONMENT", "sandbox")
NVM_PLAN_ID = os.getenv("NVM_PLAN_ID", "")

# Validate required environment variables
if not NVM_API_KEY or not NVM_PLAN_ID:
    print("NVM_API_KEY and NVM_PLAN_ID are required.")
    sys.exit(1)

# Initialize Nevermined Payments SDK
payments = Payments.get_instance(
    PaymentOptions(nvm_api_key=NVM_API_KEY, environment=NVM_ENVIRONMENT)
)


def decode_base64_json(base64_str: str) -> dict:
    """Helper to decode base64 JSON from headers."""
    json_str = base64.b64decode(base64_str).decode("utf-8")
    return json.loads(json_str)


def pretty_json(obj: dict) -> str:
    """Helper to format JSON for console output."""
    return json.dumps(obj, indent=2)


def main():
    """Run the x402 payment flow demo."""
    print("=" * 60)
    print("x402 Payment Flow Demo (Python)")
    print("=" * 60)
    print(f"\nServer: {SERVER_URL}")
    print(f"Plan ID: {NVM_PLAN_ID}")

    with httpx.Client(timeout=60.0) as client:  # Longer timeout for payment settlement
        # ============================================================
        # Step 1: Request without token -> Expect 402
        # ============================================================
        print("\n" + "=" * 60)
        print("STEP 1: Request without payment token")
        print("=" * 60)

        response1 = client.post(
            f"{SERVER_URL}/ask",
            headers={"Content-Type": "application/json"},
            json={"query": "What is 2+2?"},
        )

        print(f"\nStatus: {response1.status_code} {response1.reason_phrase}")

        if response1.status_code != 402:
            print(f"Expected 402 Payment Required, got: {response1.status_code}")
            sys.exit(1)

        # ============================================================
        # Step 2: Decode payment requirements from header
        # ============================================================
        print("\n" + "=" * 60)
        print("STEP 2: Decode payment requirements from header")
        print("=" * 60)

        payment_required_header = response1.headers.get(
            X402_HEADERS["PAYMENT_REQUIRED"]
        )

        if not payment_required_header:
            print(
                f"Missing '{X402_HEADERS['PAYMENT_REQUIRED']}' header in 402 response"
            )
            sys.exit(1)

        print(f"\nHeader '{X402_HEADERS['PAYMENT_REQUIRED']}' (base64):")
        print(payment_required_header[:80] + "...")

        payment_required = decode_base64_json(payment_required_header)
        print("\nDecoded Payment Requirements:")
        print(pretty_json(payment_required))

        # Also print the JSON body
        body1 = response1.json()
        print("\nResponse body:")
        print(pretty_json(body1))

        # ============================================================
        # Step 3: Resolve scheme and generate x402 access token
        # ============================================================
        print("\n" + "=" * 60)
        print("STEP 3: Resolve scheme and generate x402 access token")
        print("=" * 60)

        # Extract scheme and network from server's payment requirements
        accepts = payment_required.get("accepts", [])
        accepted = accepts[0] if accepts else {}
        scheme = accepted.get("scheme", resolve_scheme(payments, NVM_PLAN_ID))
        network = accepted.get("network")
        print(f"\nResolved scheme: {scheme}, network: {network}")

        # Build token options based on scheme
        token_options = X402TokenOptions(scheme=scheme)

        if scheme == "nvm:card-delegation":
            print("\nFiat plan detected - setting up card delegation...")
            # List payment methods and find one matching the server's accepted network
            methods = payments.delegation.list_payment_methods()
            if not methods:
                print("No payment methods enrolled. Please add a card/PayPal at https://nevermined.app")
                sys.exit(1)

            # Match payment method provider to server's accepted network
            pm = None
            if network:
                pm = next((m for m in methods if getattr(m, "provider", None) == network), None)
                if pm:
                    print(f"Matched payment method for network '{network}': {pm.brand} *{pm.last4}")
            if not pm:
                pm = methods[0]
                print(f"Using payment method: {pm.brand} *{pm.last4} (provider: {getattr(pm, 'provider', 'unknown')})")

            token_options = X402TokenOptions(
                scheme=scheme,
                network=network,
                delegation_config=DelegationConfig(
                    provider_payment_method_id=pm.id,
                    spending_limit_cents=10000,
                    duration_secs=604800,
                    currency="usd",
                ),
            )
        else:
            print("\nCrypto plan detected - using ERC-4337 scheme")
            # nvm:erc4337 also requires a delegation_config so the API can
            # auto-create the ERC-4337 delegation that backs the payment
            # signature. Same shape as the fiat branch above, but currency
            # is the on-chain ERC-20 (usdc on Base / Base Sepolia).
            token_options = X402TokenOptions(
                scheme=scheme,
                network=network,
                delegation_config=DelegationConfig(
                    spending_limit_cents=10000,
                    duration_secs=604800,
                    currency="usdc",
                ),
            )

        print("\nCalling payments.x402.get_x402_access_token()...")

        token_result = payments.x402.get_x402_access_token(
            NVM_PLAN_ID, token_options=token_options
        )
        access_token = token_result["accessToken"]

        print("\nToken generated successfully!")
        print(f"Token length: {len(access_token)} characters")
        print(f"Token preview: {access_token[:50]}...")

        # Decode and show token structure (it's base64-encoded JSON)
        try:
            decoded_token = decode_base64_json(access_token)
            print("\nDecoded token structure:")
            print(pretty_json(decoded_token))
        except Exception:
            print("\n(Token is not base64 JSON - showing raw)")

        # ============================================================
        # Step 4: Request with token -> Expect success
        # ============================================================
        print("\n" + "=" * 60)
        print("STEP 4: Request with payment token")
        print("=" * 60)

        print(f"\nSending request with '{X402_HEADERS['PAYMENT_SIGNATURE']}' header...")

        response2 = client.post(
            f"{SERVER_URL}/ask",
            headers={
                "Content-Type": "application/json",
                X402_HEADERS["PAYMENT_SIGNATURE"]: access_token,
            },
            json={"query": "What is 2+2?"},
        )

        print(f"\nStatus: {response2.status_code} {response2.reason_phrase}")

        if response2.status_code != 200:
            print(f"Expected 200 OK, got: {response2.status_code}")
            print(f"Response: {response2.text}")
            sys.exit(1)

        body2 = response2.json()
        print("\nResponse body:")
        print(pretty_json(body2))

        # ============================================================
        # Step 5: Check for settlement response header
        # ============================================================
        print("\n" + "=" * 60)
        print("STEP 5: Check settlement response header")
        print("=" * 60)

        payment_response_header = response2.headers.get(
            X402_HEADERS["PAYMENT_RESPONSE"]
        )

        if payment_response_header:
            print(f"\nHeader '{X402_HEADERS['PAYMENT_RESPONSE']}' found!")
            print(f"(base64): {payment_response_header[:80]}...")

            try:
                settlement_response = decode_base64_json(payment_response_header)
                print("\nDecoded Settlement Response:")
                print(pretty_json(settlement_response))
            except Exception:
                print("\n(Could not decode as JSON)")
                print(payment_response_header)
        else:
            print(f"\nNo '{X402_HEADERS['PAYMENT_RESPONSE']}' header in response.")
            print("(Settlement happens asynchronously after response is sent)")

        # ============================================================
        # Summary
        # ============================================================
        print("\n" + "=" * 60)
        print("FLOW COMPLETE!")
        print("=" * 60)
        print(
            f"""
x402 Payment Flow Summary:
1. Request without token    -> 402 Payment Required
2. Decoded payment-required -> Plan ID, scheme, network
3. Resolved scheme          -> {scheme}
4. Generated access token   -> Using Nevermined SDK
5. Request with token       -> 200 OK + AI response
6. Settlement              -> Credits burned asynchronously
"""
        )


if __name__ == "__main__":
    main()
