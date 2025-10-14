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
- **Multiple Protocols**: Support for HTTP REST, A2A (Agent2Agent), and MCP (Model Context Protocol)

## Tutorials Overview

### 1. Agent-to-Agent (A2A) Payments Example

**Location**: `a2a-examples/a2a-agent-client-example/`

Demonstrates the Agent2Agent (A2A) protocol with Nevermined payments integration, including bearer token authentication, asynchronous task management, and push notifications.

**Technologies**:
- TypeScript
- Node.js & Express
- Nevermined Payments SDK (`@nevermined-io/payments`)
- A2A Protocol

**Key Features**:
- Bearer token authentication with credit validation
- Asynchronous task handling with streaming support
- Push notification configuration and delivery
- Credit burning on successful execution

---

### 2. Financial Agent Tutorial

**Location**: `financial-agent/`

A step-by-step tutorial showing how to transform an unprotected financial advice agent into a paid service using Nevermined Payments.

**Technologies**:
- TypeScript
- Node.js & Express
- LangChain
- OpenAI GPT-4
- Nevermined Payments SDK

**What You'll Learn**:
- Convert a free API endpoint to a paid service
- Implement credit-based access control
- Handle authorization and token validation
- Redeem credits on successful requests
- Build a client that purchases plans and obtains access tokens

**Includes**: Both unprotected and protected versions for comparison

---

### 3. Medical Agent Tutorial

**Location**: `medical-agent/`

Similar to the financial agent, this tutorial demonstrates protecting a medical advice agent with Nevermined Payments.

**Technologies**:
- TypeScript
- Node.js & Express
- LangChain
- OpenAI GPT-4
- Nevermined Payments SDK

**What You'll Learn**:
- Add Nevermined authorization to existing agents
- Implement session-based conversation memory
- Handle payment-required scenarios (HTTP 402)
- Build subscriber clients with plan management

**Includes**: Side-by-side unprotected and protected implementations

---

### 4. Weather MCP Server (TypeScript)

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

### 5. Weather MCP Server (Python)

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

- [Nevermined Documentation](https://docs.nevermined.app)
- [A2A Protocol Specification](https://a2aproject.github.io/A2A/latest)
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