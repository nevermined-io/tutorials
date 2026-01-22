# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This repository contains tutorials and examples demonstrating how to integrate **Nevermined Payments** into AI agents and services. Each tutorial showcases different protocols (HTTP/x402, A2A, MCP) and use cases.

## Repository Structure

```
tutorials/
├── http-simple-agent-ts/   # Express.js agent with x402 payment middleware (TypeScript)
├── http-simple-agent-py/   # FastAPI agent with x402 payment middleware (Python)
├── a2a-examples/           # Agent-to-Agent (A2A) protocol examples
├── mcp-examples/           # Model Context Protocol (MCP) examples
│   ├── weather-mcp/        # TypeScript MCP server (has CLAUDE.md)
│   └── weather-mcp-py/     # Python MCP server
├── financial-agent/        # LangChain financial advisor (has CLAUDE.md)
├── medical-agent/          # LangChain medical advisor (has CLAUDE.md)
├── pricing-simulation/     # Pricing model simulation (TypeScript)
├── pricing-simulation-py/  # Pricing model simulation (Python)
└── async-logger/           # Async logging utilities
```

## Common Commands

Most tutorials use similar commands:

```bash
# Install dependencies
yarn install          # or npm install

# Run the agent/server
yarn agent            # or yarn start, yarn dev

# Run the client
yarn client

# Build (TypeScript projects)
yarn build
```

## Environment Variables

Most tutorials require these environment variables in a `.env` file:

```bash
# Nevermined credentials (required)
NVM_API_KEY=nvm:your-api-key
NVM_ENVIRONMENT=sandbox          # or 'live', 'staging_sandbox'
NVM_PLAN_ID=your-plan-id
NVM_AGENT_ID=your-agent-id       # optional, for agent-specific plans

# OpenAI (for LLM-based agents)
OPENAI_API_KEY=sk-your-key

# Server config
PORT=3000
```

## Key Technologies

| Protocol | Description | Example Location |
|----------|-------------|------------------|
| **x402** | HTTP 402 payment protocol | `http-simple-agent-ts/` (TS), `http-simple-agent-py/` (Python) |
| **A2A** | Agent-to-Agent protocol | `a2a-examples/` |
| **MCP** | Model Context Protocol | `mcp-examples/` |

## x402 Protocol (v2)

The x402 tutorials use the `paymentMiddleware` from `@nevermined-io/payments/express`:

```typescript
import { paymentMiddleware } from '@nevermined-io/payments/express'

app.use(paymentMiddleware(payments, {
  'POST /ask': { planId: PLAN_ID, credits: 1 }
}))
```

**Headers (x402 v2 compliant):**
- `payment-signature` - Client sends x402 access token (the ONLY supported header)
- `payment-required` - Server sends payment requirements (402 response)
- `payment-response` - Server sends settlement receipt (200 response)

## Important Reminders

- **Always update README.md when modifying tutorials** - Keep documentation in sync with code
- **Test both agent and client** - Ensure the full payment flow works
- **Check subdirectory CLAUDE.md files** - Some tutorials have specific instructions

## Subdirectory CLAUDE.md Files

The following tutorials have their own CLAUDE.md with specific instructions:
- `financial-agent/CLAUDE.md`
- `medical-agent/CLAUDE.md`
- `mcp-examples/weather-mcp/CLAUDE.md`

Always check for a subdirectory CLAUDE.md when working on a specific tutorial.

## Related Repositories

- `payments/` - Nevermined Payments TypeScript SDK
- `payments-py/` - Nevermined Payments Python SDK
- `docs_mintlify/` - Documentation at nevermined.ai/docs
- `nvm-monorepo/` - Backend API
