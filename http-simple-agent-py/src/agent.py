"""
Protected HTTP Agent - FastAPI server with Nevermined payment middleware.

This demonstrates how to protect an endpoint using the x402 protocol.
The /ask endpoint requires a valid x402 access token and burns credits.

x402 HTTP Transport Headers:
- Client sends token in: `payment-signature` header
- Server returns 402 with: `payment-required` header (base64-encoded)
"""

import os
import sys

# IMPORTANT: Load environment variables BEFORE importing payments_py
# so that env vars are available during SDK initialization
from dotenv import load_dotenv

load_dotenv()

import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from openai import OpenAI
from pydantic import BaseModel

from payments_py import Payments, PaymentOptions
from payments_py.x402.fastapi import PaymentMiddleware, X402_HEADERS

# Configuration
PORT = int(os.getenv("PORT", "3000"))
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
NVM_API_KEY = os.getenv("NVM_API_KEY", "")
NVM_ENVIRONMENT = os.getenv("NVM_ENVIRONMENT", "sandbox")
NVM_PLAN_ID = os.getenv("NVM_PLAN_ID", "")

# Validate required environment variables
if not OPENAI_API_KEY:
    print("OPENAI_API_KEY is required. Set it in .env file.")
    sys.exit(1)

if not NVM_API_KEY or not NVM_PLAN_ID:
    print("NVM_API_KEY and NVM_PLAN_ID are required for payment protection.")
    sys.exit(1)

# Initialize OpenAI client
openai_client = OpenAI(api_key=OPENAI_API_KEY)

# Initialize Nevermined Payments SDK
payments = Payments.get_instance(
    PaymentOptions(nvm_api_key=NVM_API_KEY, environment=NVM_ENVIRONMENT)
)

# Create FastAPI app
app = FastAPI(
    title="HTTP Simple Agent (Python)",
    description="FastAPI server with x402 payment middleware",
)


# Request model
class AskRequest(BaseModel):
    query: str


# Add payment middleware
app.add_middleware(
    PaymentMiddleware,
    payments=payments,
    routes={
        "POST /ask": {
            "plan_id": NVM_PLAN_ID,
            "credits": 1,
        },
    },
)


@app.post("/ask")
async def ask(request: Request, body: AskRequest) -> JSONResponse:
    """Send a query to the AI (protected by payment middleware)."""
    try:
        if not body.query or not isinstance(body.query, str):
            return JSONResponse(
                status_code=400,
                content={"error": "Missing or invalid 'query' field"},
            )

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

        return JSONResponse(content={"response": response_text})

    except Exception as error:
        print(f"Error in /ask: {error}")
        return JSONResponse(
            status_code=500,
            content={"error": "Internal server error"},
        )


@app.get("/health")
async def health() -> JSONResponse:
    """Health check endpoint (unprotected)."""
    return JSONResponse(content={"status": "ok"})


def main():
    """Run the FastAPI server."""
    print(f"Protected HTTP Agent running on http://localhost:{PORT}")
    print(f"\nPayment protection enabled for POST /ask")
    print(f"Plan ID: {NVM_PLAN_ID}")
    print(
        f"\nTo test, send requests with x402 token in '{X402_HEADERS['PAYMENT_SIGNATURE']}' header."
    )

    uvicorn.run(app, host="0.0.0.0", port=PORT)


if __name__ == "__main__":
    main()
