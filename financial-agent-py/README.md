# Financial Agent (Python)

A Python implementation of the FinGuide financial education agent using FastAPI, OpenAI, and Nevermined Payments.

## Features

- **Two Agent Versions**:
  - `index_unprotected.py` - Free access financial education agent
  - `index_nevermined.py` - Protected agent with Nevermined payment integration

- **Dynamic Credit System** (Protected version only):
  - Credits charged based on actual token usage
  - Formula: `10 * (actual_tokens / max_tokens)`, minimum 1 credit
  - Rewards concise responses with lower costs

- **Session Management**: Maintains conversation context across multiple questions
- **Loading Animation**: Visual feedback during API calls
- **Educational Focus**: Provides financial education rather than investment advice

## Setup

1. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Environment Configuration**:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

3. **Required Environment Variables**:
   ```
   OPENAI_API_KEY=your_openai_api_key_here

   # For protected agent only:
   BUILDER_NVM_API_KEY=your_builder_api_key_here
   SUBSCRIBER_NVM_API_KEY=your_subscriber_api_key_here
   NVM_ENVIRONMENT=staging_sandbox
   NVM_AGENT_ID=your_agent_did_here
   NVM_PLAN_ID=your_plan_did_here
   ```

## Running the Agent

### Unprotected Agent (Free Access)
```bash
cd agent
python index_unprotected.py
# Server starts on http://localhost:8001
```

### Protected Agent (Nevermined Integration)
```bash
cd agent
python index_nevermined.py
# Server starts on http://localhost:8000
```

## Running the Client

### Test Unprotected Agent
```bash
cd client
python index_unprotected.py
```

### Test Protected Agent
```bash
cd client
python index_nevermined.py
```

## API Endpoints

### POST /ask
Send a financial question to FinGuide.

**Request Body**:
```json
{
  "input_query": "What is diversification?",
  "sessionId": "optional-session-id"
}
```

**Response** (Unprotected):
```json
{
  "output": "Diversification is like not putting all your eggs in one basket...",
  "sessionId": "generated-or-provided-session-id"
}
```

**Response** (Protected):
```json
{
  "output": "Diversification is like not putting all your eggs in one basket...",
  "sessionId": "generated-or-provided-session-id",
  "redemptionResult": {
    "creditsRedeemed": 3,
    "error": null
  }
}
```

### GET /health
Health check endpoint.

**Response**:
```json
{
  "status": "ok"
}
```

## Architecture

- **FastAPI**: Modern Python web framework with automatic OpenAPI docs
- **OpenAI**: GPT-4o-mini for natural language responses
- **Nevermined Payments**: Payment and observability integration (protected version)
- **Session Management**: In-memory conversation history
- **Async/Await**: Non-blocking request handling

## Key Differences from TypeScript Version

1. **FastAPI** instead of Express.js
2. **Pydantic models** for request/response validation
3. **Async/await** pattern throughout
4. **Python-style** naming conventions (snake_case)
5. **Local payments-py** library integration

## Development

The Python implementation maintains feature parity with the TypeScript version while following Python best practices and idioms.