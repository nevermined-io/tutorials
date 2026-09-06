[![banner](https://raw.githubusercontent.com/nevermined-io/assets/main/images/logo/banner_logo.png)](https://nevermined.io)

# Nevermined Tutorials

A collection of practical tutorials demonstrating how to integrate **Nevermined Payments** into AI agents and services. These examples showcase how to add authentication, credit management, and monetization to various types of agents using different protocols and technologies.

## Live Examples

🚀 **Try the live demos**: [https://examples.nevermined.app/](https://examples.nevermined.app/)

💻 **Frontend repository**: [https://github.com/nevermined-io/demo-ui-monorepo/](https://github.com/nevermined-io/demo-ui-monorepo/)

## What is Nevermined Payments?

Nevermined Payments is a platform that enables developers to monetize AI agents and services through blockchain-based credit systems with Stripe checkout integration. It provides:

- **Authentication & Authorization**: Secure access control with API keys and access tokens
- **Credit Management**: Blockchain-based credit purchases and consumption tracking
- **Payment Integration**: Seamless Stripe checkout for credit purchases
- **Multiple Protocols**: Support for HTTP REST (x402) and MCP (Model Context Protocol)

## Tutorials Overview

### 1. LangChain Paid Agent (Python)

**Location**: `langchain-paid-agent-py/`

A deliberately minimal LangChain + LangGraph tutorial showing how to gate a single tool with Nevermined payments via the `@requires_payment` decorator. No HTTP layer, no 402 round-trip — the buyer threads an x402 access token through `RunnableConfig.configurable` and the tool verifies + settles in-process.

**Technologies**:
- Python 3.10+
- LangChain (`langchain-core`, `langchain-openai`)
- LangGraph (`create_react_agent`)
- Nevermined Payments SDK (`payments-py[langchain]`)
- OpenAI GPT-4o-mini

**What You'll Learn**:
- Protect a LangChain `@tool` with `@requires_payment`
- Acquire an x402 access token with `payments.x402.get_x402_access_token(plan_id=...)`
- Thread the token through `agent.invoke(..., config={"configurable": {"payment_token": ...}})`
- Read the settlement receipt back from `configurable["payment_settlement"]`

---

### 2. Weather MCP Server (TypeScript)

**Location**: `mcp-examples/weather-mcp/`

A reference implementation of the Model Context Protocol (MCP) with Nevermined paywall integration, featuring both high-level (SDK-based) and low-level (manual JSON-RPC) server implementations.

**Technologies**:
- TypeScript
- Node.js & Express
- Model Context Protocol (MCP)
- Streamable HTTP Transport
- Nevermined Payments SDK

**What You'll Learn**:
- Protect MCP tools, resources, and prompts with paywalls
- Implement both high-level (McpServer SDK) and low-level JSON-RPC servers
- Use the `withPaywall` wrapper for automatic authorization and credit burning
- Handle MCP-specific authentication flows

**Features**:
- `weather.today(city)` tool
- `weather://today/{city}` resource
- `weather.ensureCity` prompt
- Dynamic credit calculation
- Comprehensive tutorial documentation

---

### 3. Weather MCP Server (Python)

**Location**: `mcp-examples/weather-mcp-py/`

Python implementation of the Weather MCP server, demonstrating Nevermined Payments integration using the `payments-py` SDK.

**Technologies**:
- Python 3.10+
- FastMCP
- Poetry
- Model Context Protocol (MCP)
- Nevermined Payments SDK (`payments-py`)

**What You'll Learn**:
- Protect Python MCP servers with Nevermined
- Use FastMCP for high-level implementations
- Build low-level JSON-RPC servers manually
- Handle context extraction in different server modes
- Implement dynamic credit calculations in Python

**Features**:
- FastMCP-based high-level server
- Manual JSON-RPC low-level server
- Automatic context resolution via `getContext`
- Compatible with MCP Inspector

---

### 4. Deep Agents Market Research (Python)

**Location**: `langchain-deep-agent-py/`

A freemium market-research agent on LangChain's [Deep Agents](https://docs.langchain.com/oss/python/deepagents/overview) harness, where the paid capability lives **inside a subagent**. Users chat with the supervisor for free; only the delegated research tool charges credits. Demonstrates that the x402 token a buyer puts on the run survives the `task()` delegation hop, so `@requires_payment` needs no changes.

**Technologies**:
- Python 3.11+
- Deep Agents (`create_deep_agent`) on the LangChain v1 stack
- Nevermined Payments SDK (`payments-py[langsmith]`)
- OpenAI GPT-4o-mini

**What You'll Learn**:
- Put a paid tool behind a `task()` delegation and keep the payment lifecycle intact
- Cap paid calls per run — a deep agent decides for itself how many subagent hops a request warrants
- Guard against the supervisor answering a paid question from its own knowledge
- Compare harnesses side by side with the sibling `langchain-research-agent-py`

---

### 5. Fiat Checkout Chat (TypeScript)

**Location**: `fiat-checkout-chat/`

A Next.js chat UI + thin merchant backend demonstrating the Nevermined **Orders** flow (epic [#3238](https://github.com/nevermined-io/nvm-monorepo/issues/3238), Phase 1): a web consumer with **no Nevermined account and no API key** pays a merchant an arbitrary **fiat** amount by **card via Stripe**, entirely in the browser. The merchant is an **organization** that creates the order server-side; the buyer just pays a hosted checkout embedded inline as a chat card — no login, no wallet, no crypto.

**Technologies**:
- TypeScript
- Next.js (App Router) + React 19
- Nevermined Orders API (`POST/GET /api/v1/orders`)
- Nevermined hosted embed checkout (Stripe)

**What You'll Learn**:
- Create a payable order server-side with an organization's API key — kept out of the browser bundle
- Embed the Nevermined hosted Stripe checkout as a plain iframe and verify its `nvm:success` `postMessage` by `event.origin`
- Let the server own prices so a client can't name its own amount
- Take a buyer from "I want to book X" to a confirmed fiat payment with no account

> **Note**: tracks the in-progress Orders feature and currently requires running the Nevermined API + embed from the feature branch. See the tutorial's [README](fiat-checkout-chat/README.md).

---

## Quick Start

Each tutorial includes detailed instructions for:

1. **Environment Setup**: Required API keys and configuration
2. **Installation**: Dependencies and package management
3. **Running the Agent**: Starting the server with proper credentials
4. **Running the Client**: Testing the protected endpoints
5. **Troubleshooting**: Common issues and solutions

## Common Environment Variables

Most tutorials require:

**Server-side (Agent/Builder)**:
```bash
NVM_API_KEY=your-builder-api-key        # or BUILDER_NVM_API_KEY
NVM_AGENT_ID=your-agent-id
NVM_ENVIRONMENT=sandbox                 # or live
```

**Client-side (Subscriber)**:
```bash
SUBSCRIBER_NVM_API_KEY=your-subscriber-key
NVM_PLAN_ID=your-plan-id
NVM_AGENT_ID=your-agent-id
```

**Additional**:
```bash
OPENAI_API_KEY=sk-...                   # For LangChain tutorials
PORT=3000                               # Server port
```

## Testing with Stripe

For development and testing, use Stripe's test card:

- **Card Number**: `4242 4242 4242 4242`
- **Expiry**: Any future date
- **CVC**: Any 3-digit number

## Documentation

- [Nevermined Documentation](https://nevermined.ai/docs)
- [Model Context Protocol (MCP)](https://modelcontextprotocol.io)
- [Nevermined Payments SDK](https://github.com/nevermined-io/payments)

## License

```
Apache License 2.0

(C) 2025 Nevermined AG

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at:

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions
and limitations under the License.
```