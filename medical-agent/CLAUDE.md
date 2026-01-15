# CLAUDE.md

This file provides context for Claude Code when working with this repository.

## Project Overview

This is a **Medical Agent Tutorial** demonstrating how to build an AI-powered medical advice agent with paid access protection using the **Nevermined x402 payment protocol**.

The project includes:
- An unprotected version for learning basics
- A protected version implementing the x402 payment flow

## Tech Stack

- **Runtime**: Node.js 18+ with TypeScript (ESM)
- **AI**: LangChain with OpenAI GPT-4o-mini for medical advice
- **Web Framework**: Express.js
- **Payment Protocol**: Nevermined x402 (HTTP 402 Payment Required)
- **Package Manager**: npm or yarn

## Project Structure

```
agent/
  index_unprotected.ts   # Simple Express agent without payment protection
  index_nevermined.ts    # x402-protected agent with Nevermined integration
client/
  index_unprotected.ts   # Simple client for the unprotected agent
  index_nevermined.ts    # x402 client implementing full payment flow
```

## Key Concepts

### x402 Payment Protocol

The x402 protocol is a standard for HTTP-based payments:

1. Client makes request without payment
2. Server returns **HTTP 402** with `PAYMENT-REQUIRED` header (base64-encoded JSON)
3. Client obtains x402 access token from Nevermined
4. Client retries with `PAYMENT-SIGNATURE` header
5. Server verifies, executes, settles credits
6. Server returns response with `PAYMENT-RESPONSE` header

### Nevermined Payments SDK

Key classes and methods:

```typescript
// Initialize
const payments = Payments.getInstance({ nvmApiKey, environment });

// Agent-side (facilitator role)
await payments.facilitator.verifyPermissions({ paymentRequired, x402AccessToken, maxAmount });
await payments.facilitator.settlePermissions({ paymentRequired, x402AccessToken, maxAmount });

// Client-side
await payments.x402.getX402AccessToken(planId, agentId);
await payments.plans.getPlanBalance(planId);
await payments.plans.orderPlan(planId);
```

### Environment Variables

**Agent (server)**:
- `OPENAI_API_KEY` - OpenAI API key
- `BUILDER_NVM_API_KEY` - Nevermined builder/publisher API key
- `NVM_ENVIRONMENT` - `staging_sandbox` or `live`
- `NVM_AGENT_ID` - Registered agent ID in Nevermined
- `NVM_PLAN_ID` - Plan ID linked to the agent
- `AGENT_URL` - Public URL of the agent (shared with client)

**Client**:
- `SUBSCRIBER_NVM_API_KEY` - Nevermined subscriber API key
- `NVM_ENVIRONMENT` - Must match agent environment
- `AGENT_URL` - URL of the agent to call

## Common Commands

```bash
# Install dependencies
npm install

# Run unprotected agent
PORT=3001 OPENAI_API_KEY=sk-... npm run dev:agent:unprotected

# Run unprotected client
AGENT_URL=http://localhost:3001 npm run dev:client:unprotected

# Run x402-protected agent
PORT=3000 npm run dev:agent

# Run x402 client
npm run dev:client

# Build TypeScript
npm run build
```

## Code Patterns

### LangChain with Session Memory

The agent uses LangChain's RunnableWithMessageHistory for conversation memory:
```typescript
const runnable = new RunnableWithMessageHistory({
  runnable: chain,
  getMessageHistory: async (sessionId: string) => sessionStore.getHistory(sessionId),
  inputMessagesKey: "input",
  historyMessagesKey: "history",
});
```

### Session Management

Conversations are tracked via `sessionId` (UUID) with in-memory storage:
```typescript
class SessionStore {
  private sessions: Map<string, InMemoryChatMessageHistory> = new Map();
  getHistory(sessionId: string): InMemoryChatMessageHistory { ... }
}
```

### Error Handling

The agent returns:
- **402** - Payment required (missing/invalid token, insufficient credits)
- **400** - Bad request (missing input)
- **500** - Internal server error

## Dependencies

Key packages:
- `@nevermined-io/payments` - Nevermined SDK for x402 payments
- `@langchain/openai` - LangChain OpenAI integration
- `@langchain/core` - LangChain core utilities
- `express` - Web server
- `dotenv` - Environment configuration

## Testing

To test the full flow:
1. Start the protected agent with valid Nevermined credentials
2. Run the client - it will demonstrate the x402 payment flow
3. Watch console output for payment negotiation steps

## Important Notes

- The protected agent uses LangChain for AI processing with session history
- Tokens are cached on the client side to avoid repeated token requests
- The `PAYMENT-REQUIRED` header contains all info needed by clients (planId, agentId)
- Settlement happens after successful response generation (pay-per-use model)
- Fixed 1 credit per request for medical advice
