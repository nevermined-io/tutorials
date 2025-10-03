"""
Minimal client (free) that sends three questions to the free agent
without Nevermined protection, storing and reusing sessionId.
"""
import os
import sys
import time
import asyncio
import httpx
from typing import Dict, Any, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration: Agent URL from environment or default
AGENT_URL = os.getenv("AGENT_URL", "http://localhost:8001")

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

async def ask_agent(input_text: str, session_id: Optional[str] = None) -> Dict[str, Any]:
    """Send a question to the financial agent"""

    # Start loading animation
    loading = LoadingAnimation()
    loading_task = asyncio.create_task(loading.start())

    try:
        # Prepare request payload
        request_body = {
            "input_query": input_text,
            "sessionId": session_id
        }

        async with httpx.AsyncClient() as client:
            # Make HTTP request to agent
            response = await client.post(
                f"{AGENT_URL}/ask",
                json=request_body,
                headers={"Content-Type": "application/json"},
                timeout=30.0
            )

            # Handle HTTP errors
            if response.status_code != 200:
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
    Run the unprotected demo client.
    Sends predefined financial questions to the agent and reuses sessionId to preserve context.
    """
    print("🚀 Starting Financial Agent Demo (Unprotected)\n")

    # Track session across multiple questions
    session_id: Optional[str] = None

    # Send each demo question and maintain conversation context
    for i, question in enumerate(DEMO_CONVERSATION_QUESTIONS):
        print(f"📝 Question {i + 1}: {question}")

        try:
            # Send question to agent (reusing sessionId for context)
            result = await ask_agent(question, session_id)

            # Update sessionId for next question
            session_id = result["sessionId"]

            # Display agent response
            print(f"🤖 FinGuide (Session: {session_id}):")
            print(result["output"])
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