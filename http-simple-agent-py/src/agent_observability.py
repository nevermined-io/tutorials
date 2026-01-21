"""
HTTP Agent with Observability - FastAPI server with Nevermined payment middleware and observability logging.

This demonstrates how to:
1. Protect an endpoint using the x402 protocol with the standard PaymentMiddleware
2. Access agentRequestId from the payment context for observability
3. Route OpenAI calls through Nevermined observability for logging and analytics

The payment context (available via request.state.payment_context) contains:
- agent_request_id: Unique identifier for this request (for observability tracking)
- token: The x402 access token
- payment_required: The payment required object
- credits_to_settle: Number of credits being charged
- verified: Whether verification was successful
"""

import os
import sys
import uuid

# IMPORTANT: Load environment variables BEFORE importing payments_py
# so that HELICONE_API_KEY and other env vars are available during SDK initialization
from dotenv import load_dotenv

load_dotenv()

import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from openai import OpenAI
from pydantic import BaseModel

from payments_py import Payments, PaymentOptions
from payments_py.x402.fastapi import PaymentMiddleware, X402_HEADERS
from payments_py.x402.types import VerifyResponse, X402PaymentRequired

# Configuration
PORT = int(os.getenv("PORT", "3000"))
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
NVM_API_KEY = os.getenv("NVM_API_KEY", "")
NVM_ENVIRONMENT = os.getenv("NVM_ENVIRONMENT", "sandbox")
NVM_PLAN_ID = os.getenv("NVM_PLAN_ID", "")
NVM_AGENT_ID = os.getenv("NVM_AGENT_ID", "")

# Validate required environment variables
if not OPENAI_API_KEY:
    print("OPENAI_API_KEY is required. Set it in .env file.")
    sys.exit(1)

if not NVM_API_KEY or not NVM_PLAN_ID:
    print("NVM_API_KEY and NVM_PLAN_ID are required for payment protection.")
    sys.exit(1)

# Initialize Nevermined Payments SDK
payments = Payments.get_instance(
    PaymentOptions(nvm_api_key=NVM_API_KEY, environment=NVM_ENVIRONMENT)
)

# Create FastAPI app
app = FastAPI(
    title="HTTP Simple Agent with Observability (Python)",
    description="FastAPI server with x402 payment middleware and Nevermined observability",
)


# Request model
class AskRequest(BaseModel):
    query: str


# Observability hooks
async def on_after_verify(request: Request, verification: VerifyResponse):
    """Log observability info after verification."""
    if verification.agent_request_id:
        print("[Observability] Verification successful")
        print(f"  Request ID: {verification.agent_request_id}")


async def on_after_settle(request: Request, credits_used: int, result):
    """Log settlement info."""
    print(f"[Payment] Settled {credits_used} credits")


# Add payment middleware with observability hooks
from payments_py.x402.fastapi import PaymentMiddlewareOptions

app.add_middleware(
    PaymentMiddleware,
    payments=payments,
    routes={
        "POST /ask": {
            "plan_id": NVM_PLAN_ID,
            "agent_id": NVM_AGENT_ID if NVM_AGENT_ID else None,
            "credits": 1,
        },
    },
    options=PaymentMiddlewareOptions(
        on_after_verify=on_after_verify,
        on_after_settle=on_after_settle,
    ),
)


@app.post("/ask")
async def ask(request: Request, body: AskRequest) -> JSONResponse:
    """
    Send a query to the AI with Nevermined observability.

    When agent_request_id is available from payment verification, OpenAI calls
    can be routed through Nevermined observability for:
    - Cost tracking per agent/plan
    - Usage analytics
    - Request tracing
    """
    try:
        if not body.query or not isinstance(body.query, str):
            return JSONResponse(
                status_code=400,
                content={"error": "Missing or invalid 'query' field"},
            )

        # Get payment context from middleware
        payment_context = getattr(request.state, "payment_context", None)
        agent_request = payment_context.agent_request if payment_context else None
        agent_request_id = payment_context.agent_request_id if payment_context else None

        openai_client: OpenAI

        if agent_request:
            # With observability - route OpenAI calls through Nevermined/Helicone
            from payments_py.common.types import StartAgentRequest

            # Convert dict to StartAgentRequest if needed
            if isinstance(agent_request, dict):
                start_agent_request = StartAgentRequest.model_validate(agent_request)
            else:
                start_agent_request = agent_request

            # Get OpenAI config with Helicone headers
            openai_config = payments.observability.with_openai(
                api_key=OPENAI_API_KEY,
                start_agent_request=start_agent_request,
                custom_properties={"sessionid": str(uuid.uuid4())},
            )

            # Create OpenAI client with observability config
            openai_client = OpenAI(
                api_key=openai_config.api_key,
                base_url=openai_config.base_url,
                default_headers=openai_config.default_headers,
            )
        else:
            # Fallback without observability
            openai_client = OpenAI(api_key=OPENAI_API_KEY)

        completion = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant. Be concise and informative.",
                },
                {"role": "user", "content": body.query},
            ],
            max_tokens=500,
        )

        response_text = (
            completion.choices[0].message.content
            if completion.choices
            else "No response generated"
        )

        # Settlement happens automatically via middleware after response is sent
        return JSONResponse(
            content={
                "response": response_text,
                "observability": (
                    {
                        "agent_request_id": agent_request_id,
                    }
                    if agent_request_id
                    else None
                ),
            }
        )

    except Exception as error:
        print(f"Error in /ask: {error}")
        return JSONResponse(
            status_code=500,
            content={"error": "Internal server error"},
        )


@app.get("/health")
async def health() -> JSONResponse:
    """Health check endpoint (unprotected)."""
    return JSONResponse(content={"status": "ok", "observability": "enabled"})


def main():
    """Run the FastAPI server with observability."""
    print(f"HTTP Agent with Observability running on http://localhost:{PORT}")
    print(f"\nPayment protection enabled for POST /ask")
    print(f"Plan ID: {NVM_PLAN_ID}")
    if NVM_AGENT_ID:
        print(f"Agent ID: {NVM_AGENT_ID}")
    print(
        f"\nObservability: OpenAI calls are logged to Nevermined when agentRequestId is available."
    )
    print(
        f"\nTo test, send requests with x402 token in '{X402_HEADERS['PAYMENT_SIGNATURE']}' header."
    )

    uvicorn.run(app, host="0.0.0.0", port=PORT)


if __name__ == "__main__":
    main()
