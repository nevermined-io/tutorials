"""
Minimal client that sends three questions to the agent,
storing and reusing the returned sessionId to maintain conversation context.
"""
import os
import sys
import asyncio
import httpx
from typing import Dict, Any, Optional
from dotenv import load_dotenv
from payments_py import Payments, PaymentOptions

# Load environment variables
load_dotenv()

# Configuration: Load environment variables with defaults
AGENT_URL = os.getenv("AGENT_URL", "http://localhost:8000")
PLAN_ID = os.getenv("NVM_PLAN_ID", "")
AGENT_ID = os.getenv("NVM_AGENT_ID", "")
SUBSCRIBER_API_KEY = os.getenv("SUBSCRIBER_NVM_API_KEY", "")
NVM_ENVIRONMENT = os.getenv("NVM_ENVIRONMENT", "sandbox")

# Define demo conversation to show chatbot-style interaction
DEMO_CONVERSATION_QUESTIONS = [
    "Hi there! I'm new to investing and keep hearing about diversification. Can you explain what that means in simple terms?",
    "That makes sense! So if I want to start investing but only have $100 a month, what should I focus on first?",
    "I've been thinking about cryptocurrency. What should a beginner like me know before investing in crypto?",
]

# Simple loading animation frames
LOADING_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

class LoadingAnimation:
    def __init__(self, message: str = "FinGuide is thinking..."):
        self.message = message
        self.running = False
        self.frame_index = 0

    async def start(self):
        self.running = True
        while self.running:
            frame = LOADING_FRAMES[self.frame_index % len(LOADING_FRAMES)]
            print(f"\r{frame} {self.message}", end="", flush=True)
            self.frame_index += 1
            await asyncio.sleep(0.1)

    def stop(self):
        self.running = False
        print("\r", end="", flush=True)  # Clear the line

def validate_environment() -> None:
    """Validate required environment variables"""
    if not PLAN_ID or not AGENT_ID:
        raise Exception("NVM_PLAN_ID and NVM_AGENT_ID are required in environment")
    if not SUBSCRIBER_API_KEY:
        raise Exception("SUBSCRIBER_NVM_API_KEY is required in environment")

async def get_access_token() -> str:
    """Get or purchase access token for protected agent"""
    print("🔐 Setting up Nevermined access...")

    # Initialize Nevermined Payments SDK
    payments = Payments.get_instance(PaymentOptions(
        nvm_api_key=SUBSCRIBER_API_KEY,
        environment=NVM_ENVIRONMENT,
    ))

    # Check current plan balance and subscription status
    # NOTE: get_plan_balance raises PaymentsError if the plan doesn't exist or if there's an API error
    # The returned balance_info is a validated Pydantic object with proper types
    balance_info = payments.plans.get_plan_balance(PLAN_ID)

    # Access balance and subscription status directly from the Pydantic object
    has_credits = balance_info.balance > 0
    is_subscriber = balance_info.is_subscriber

    # Purchase plan if not subscribed and no credits
    if not is_subscriber and not has_credits:
        print("💳 No subscription or credits found. Purchasing plan...")
        payments.plans.order_plan(PLAN_ID)

    # Get access token for the agent
    credentials = payments.agents.get_agent_access_token(PLAN_ID, AGENT_ID)

    if not credentials or not credentials.get("accessToken"):
        raise Exception("Failed to obtain access token")

    print("✅ Access token obtained successfully")
    return credentials["accessToken"]

async def ask_agent(input_text: str, access_token: str, session_id: Optional[str] = None) -> Dict[str, Any]:
    """Send a question to the protected financial agent"""

    # Start loading animation
    loading = LoadingAnimation()
    loading_task = asyncio.create_task(loading.start())

    try:
        # Prepare request payload
        request_body = {
            "input_query": input_text,
            "sessionId": session_id
        }

        # Prepare headers with authorization
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {access_token}"
        }

        async with httpx.AsyncClient() as client:
            # Make HTTP request to protected agent
            response = await client.post(
                f"{AGENT_URL}/ask",
                json=request_body,
                headers=headers,
                timeout=30.0
            )

            # Handle HTTP errors (including payment required)
            if response.status_code == 402:
                raise Exception("Payment Required - insufficient credits or subscription")
            elif response.status_code != 200:
                error_text = response.text
                raise Exception(f"Agent request failed: {response.status_code} {response.reason_phrase} {error_text}")

            # Parse and return JSON response
            return response.json()

    finally:
        # Stop loading animation
        loading.stop()
        loading_task.cancel()
        try:
            await loading_task
        except asyncio.CancelledError:
            pass

async def run_demo() -> None:
    """
    Run the protected demo client.
    Sends predefined financial questions to the agent with Authorization and reuses sessionId to preserve context.
    """
    print("🚀 Starting Financial Agent Demo (Protected with Nevermined)\n")

    # Validate environment setup
    validate_environment()

    # Obtain access token for protected agent
    access_token = await get_access_token()

    # Track session across multiple questions
    session_id: Optional[str] = None

    # Send each demo question and maintain conversation context
    for i, question in enumerate(DEMO_CONVERSATION_QUESTIONS):
        print(f"📝 Question {i + 1}: {question}")

        try:
            # Send question to protected agent (reusing sessionId for context)
            result = await ask_agent(question, access_token, session_id)

            # Update sessionId for next question
            session_id = result["sessionId"]

            # Display agent response and payment info
            print(f"🤖 FinGuide (Session: {session_id}):")
            print(result["output"])

            if result.get("redemptionResult"):
                credits_redeemed = result["redemptionResult"].get("creditsRedeemed", 0)
                print(f"💰 Credits redeemed: {credits_redeemed}")

            print("\n" + "=" * 80 + "\n")

        except Exception as error:
            print(f"❌ Error processing question {i + 1}: {error}")
            break

    print("✅ Demo completed!")

# Run the demo and handle any errors
async def main():
    try:
        await run_demo()
    except Exception as error:
        print(f"💥 Demo failed: {error}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())