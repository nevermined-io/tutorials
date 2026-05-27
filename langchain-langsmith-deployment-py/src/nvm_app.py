"""LangSmith Deployment app for the Sprint 3 Nevermined x402 tutorial.

Wires PaymentMiddleware (via build_payment_app) around the LangGraph
agent's built-in routes so POST /threads/{thread_id}/runs/wait is gated
by Nevermined x402 payment verification. Other built-in routes
(/threads creation, /assistants/search, /ok) pass through ungated.

Uses FastAPI for the http.app wrapper rather than a plain Starlette app -
langgraph-api 0.5.42 has an OpenAPI generation bug that crashes on plain
Starlette wrappers (server.py:107-122 falls through to a YAML schema
generator that chokes on internal endpoint docstrings). FastAPI takes a
clean path through app.openapi(). The build_payment_app factory returns
a FastAPI instance so users do not need to know about this upstream bug.
"""

import os

from dotenv import load_dotenv
from payments_py import PaymentOptions, Payments
from payments_py.langsmith import RouteConfig, build_payment_app

load_dotenv()

NVM_API_KEY = os.environ.get("NVM_API_KEY")
NVM_ENVIRONMENT = os.environ.get("NVM_ENVIRONMENT", "sandbox")
NVM_PLAN_ID = os.environ.get("NVM_PLAN_ID")
NVM_CREDITS_PER_INVOKE = int(os.environ.get("NVM_CREDITS_PER_INVOKE", "1"))

if not NVM_API_KEY or not NVM_PLAN_ID:
    raise RuntimeError(
        "NVM_API_KEY and NVM_PLAN_ID must be set in .env. See .env.example."
    )

payments = Payments.get_instance(
    PaymentOptions(nvm_api_key=NVM_API_KEY, environment=NVM_ENVIRONMENT)
)

app = build_payment_app(
    payments=payments,
    routes={
        "POST /threads/{thread_id}/runs/wait": RouteConfig(
            plan_id=NVM_PLAN_ID,
            credits=NVM_CREDITS_PER_INVOKE,
        ),
    },
)
