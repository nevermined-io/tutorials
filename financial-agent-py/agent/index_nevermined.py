"""
HTTP server for a financial-advice agent using OpenAI.
Exposes a `/ask` endpoint with per-session conversational memory and Nevermined protection.
"""
import os
import uuid
import math
from dataclasses import asdict
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
import openai
from payments_py import Payments, PaymentOptions

# Load environment variables
load_dotenv()

# Configuration
PORT = int(os.getenv("PORT", 8000))
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
NVM_API_KEY = os.getenv("BUILDER_NVM_API_KEY", "")
NVM_ENVIRONMENT = os.getenv("NVM_ENVIRONMENT", "staging_sandbox")
NVM_AGENT_ID = os.getenv("NVM_AGENT_ID", "")
NVM_AGENT_HOST = os.getenv("NVM_AGENT_HOST", f"http://localhost:{PORT}")

if not OPENAI_API_KEY:
    print("OPENAI_API_KEY is required to run the agent.")
    exit(1)

if not NVM_API_KEY or not NVM_AGENT_ID:
    print("Nevermined environment is required: set NVM_API_KEY and NVM_AGENT_ID in .env")
    exit(1)

app = FastAPI(title="FinGuide Protected", version="1.0.0")

# Initialize Nevermined Payments SDK for access control and observability
payments = Payments.get_instance(PaymentOptions(
    nvm_api_key=NVM_API_KEY,
    environment=NVM_ENVIRONMENT,
))

# Define the AI's role and behavior
def get_system_prompt(max_tokens: int) -> str:
    return f"""You are FinGuide, a friendly financial education AI designed to help people learn about investing, personal finance, and market concepts.

Your role is to provide:

1. Financial education: Explain investing concepts, terminology, and strategies in simple, beginner-friendly language.
2. General market insights: Discuss historical trends, market principles, and how different asset classes typically behave.
3. Investment fundamentals: Teach about diversification, risk management, dollar-cost averaging, and long-term investing principles.
4. Personal finance guidance: Help with budgeting basics, emergency funds, debt management, and retirement planning concepts.

Response style:
Write in a natural, conversational tone as if you're chatting with a friend over coffee. Be encouraging and educational rather than giving specific investment advice. Use analogies and everyday examples to explain complex concepts in a way that feels relatable. Always focus on teaching principles rather than recommending specific investments. Be honest about not having access to real-time market data, and naturally encourage users to do their own research and consult professionals for personalized advice. Avoid using bullet points or formal lists - instead, weave information into flowing, natural sentences that feel like genuine conversation. Adjust your response length based on the complexity of the question - for simple questions, keep responses concise (50-100 words), but for complex topics that need thorough explanation, feel free to use up to {max_tokens} tokens to provide comprehensive educational value.

Important disclaimers:
Remember to naturally work into your conversations that you're an educational AI guide, not a licensed financial advisor. You don't have access to real-time market data or current prices. All the information you share is for educational purposes only, not personalized financial advice. Always encourage users to consult with qualified financial professionals for actual investment decisions. Naturally remind them that past performance never guarantees future results and all investments carry risk, including potential loss of principal.

When discussing investments:
Focus on general principles and educational concepts while explaining both potential benefits and risks in a conversational way. Naturally emphasize the importance of diversification and long-term thinking. Gently remind users to only invest what they can afford to lose and suggest they research thoroughly while considering their personal financial situation. Make these important points feel like natural parts of the conversation rather than formal warnings."""

# Calculate dynamic credit amount based on token usage
def calculate_credit_amount(tokens_used: int, max_tokens: int) -> int:
    """
    Formula: 10 * (actual_tokens / max_tokens)
    This rewards shorter responses with lower costs
    """
    token_utilization = min(tokens_used / max_tokens, 1.0)  # Cap at 1
    base_credit_amount = 10 * token_utilization
    credit_amount = max(math.ceil(base_credit_amount), 1)  # Minimum 1 credit

    print(f"Token usage: {tokens_used}/{max_tokens} ({token_utilization * 100:.1f}%) - Credits: {credit_amount}")

    return credit_amount

# Store conversation history for each session
sessions: Dict[str, List[Dict[str, str]]] = {}

# Request/Response models
class AskRequest(BaseModel):
    input_query: str
    sessionId: Optional[str] = None

class RedemptionResult(BaseModel):
    creditsRedeemed: int
    error: Optional[str] = None

class AskResponse(BaseModel):
    output: str
    sessionId: str
    redemptionResult: Optional[RedemptionResult] = None

# Handle financial advice requests with Nevermined payment protection and observability
@app.post("/ask", response_model=AskResponse)
async def ask_financial_advice(request: AskRequest, authorization: Optional[str] = Header(default=None)):
    try:
        # Extract authorization details from request headers
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Authorization header must be in format: Bearer <token>")
        auth_header = authorization
        requested_url = f"{NVM_AGENT_HOST}/ask"
        http_verb = "POST"

        # Check if user is authorized and has sufficient balance
        agent_request = payments.requests.start_processing_request(
            NVM_AGENT_ID,
            auth_header,
            requested_url,
            http_verb
        )

        # Reject request if user doesn't have credits or subscription
        if not agent_request.balance.is_subscriber or agent_request.balance.balance < 1:
            raise HTTPException(status_code=402, detail="Payment Required")

        # Extract access token for credit redemption
        request_access_token = auth_header.replace("Bearer ", "", 1)

        # Extract and validate the user's input
        input_text = request.input_query.strip()
        if not input_text:
            raise HTTPException(status_code=400, detail="Missing input")

        # Get or create a session ID for conversation continuity
        session_id = request.sessionId or str(uuid.uuid4())

        # Define the maximum number of tokens for the completion response
        max_tokens = 250

        # Retrieve existing conversation history or start fresh
        messages = sessions.get(session_id, [])

        # Add system prompt if this is a new conversation
        if len(messages) == 0:
            messages.append({
                "role": "system",
                "content": get_system_prompt(max_tokens)
            })

        # Add the user's question to the conversation
        messages.append({"role": "user", "content": input_text})

        # Set up observability metadata for tracking this operation
        custom_properties = {
            "agentid": NVM_AGENT_ID,
            "sessionid": session_id,
            "operation": "financial_advice",
        }

        # Create OpenAI client with Helicone observability integration
        openai_config = payments.observability.with_openai(
            OPENAI_API_KEY,
            agent_request,
            custom_properties
        )

        openai_client = openai.OpenAI(**asdict(openai_config))

        # Call OpenAI API to generate response
        completion = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.3,
            max_tokens=max_tokens,
        )

        # Extract the AI's response and token usage
        response = completion.choices[0].message.content or "No response generated"
        tokens_used = completion.usage.completion_tokens if completion.usage else 0

        # Save the AI's response to conversation history
        messages.append({"role": "assistant", "content": response})
        sessions[session_id] = messages

        # Calculate dynamic credit amount based on token usage
        credit_amount = calculate_credit_amount(tokens_used, max_tokens)

        # Redeem credits after successful API call
        redemption_result = None
        try:
            redemption_response = payments.requests.redeem_credits_from_request(
                agent_request.agent_request_id,
                request_access_token,
                credit_amount
            )

            # Extract credits redeemed from the response
            credits_redeemed = redemption_response.get("data", {}).get("amountOfCredits", 0)

            # Create redemption result
            redemption_result = RedemptionResult(creditsRedeemed=credits_redeemed)

        except Exception as redeem_err:
            print(f"Failed to redeem credits: {redeem_err}")
            redemption_result = RedemptionResult(
                creditsRedeemed=0,
                error=str(redeem_err)
            )

        # Return response with session info and payment details
        return AskResponse(
            output=response,
            sessionId=session_id,
            redemptionResult=redemption_result
        )

    except HTTPException:
        raise
    except Exception as error:
        print(f"Error handling /ask: {error}")
        status_code = 402 if "Payment Required" in str(error) else 500
        detail = "Payment Required" if status_code == 402 else "Internal server error"
        raise HTTPException(status_code=status_code, detail=detail)

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "ok"}

# Start the server
if __name__ == "__main__":
    import uvicorn
    print(f"Financial Agent listening on http://localhost:{PORT}")
    print(f"NVM_API_KEY: {NVM_API_KEY}")
    print(f"NVM_ENVIRONMENT: {NVM_ENVIRONMENT}")
    print(f"NVM_AGENT_ID: {NVM_AGENT_ID}")
    uvicorn.run(app, host="0.0.0.0", port=PORT)