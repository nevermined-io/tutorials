"""
Free-access HTTP server for the financial-advice agent (no Nevermined protection).
Provides a `/ask` endpoint with per-session conversational memory.
"""
import os
import uuid
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import openai

# Load environment variables
load_dotenv()

# Configuration
PORT = int(os.getenv("PORT", 8001))
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

if not OPENAI_API_KEY:
    print("OPENAI_API_KEY is required to run the agent.")
    exit(1)

# Initialize OpenAI client with API key
client = openai.OpenAI(api_key=OPENAI_API_KEY)

app = FastAPI(title="FinGuide Unprotected", version="1.0.0")

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

# Store conversation history for each session
sessions: Dict[str, List[Dict[str, str]]] = {}

# Request/Response models
class AskRequest(BaseModel):
    input_query: str
    sessionId: Optional[str] = None

class AskResponse(BaseModel):
    output: str
    sessionId: str

# Handle financial advice requests with session-based conversation memory
@app.post("/ask", response_model=AskResponse)
async def ask_financial_advice(request: AskRequest):
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

    try:
        # Call OpenAI API to generate response
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.3,
            max_tokens=max_tokens,
        )

        # Extract the AI's response
        response = completion.choices[0].message.content or "No response generated"

        # Save the AI's response to conversation history
        messages.append({"role": "assistant", "content": response})
        sessions[session_id] = messages

        # Return response to the client
        return AskResponse(output=response, sessionId=session_id)

    except Exception as error:
        print(f"Agent /ask error: {error}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "ok"}

# Start the server
if __name__ == "__main__":
    import uvicorn
    print(f"Financial Agent listening on http://localhost:{PORT}")
    uvicorn.run(app, host="0.0.0.0", port=PORT)