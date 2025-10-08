# Async Logger Tutorial

This tutorial demonstrates how to use the **Nevermined Payments** library's async logger to automatically track and log LLM API calls for observability and cost monitoring.

## Overview

The async logger is a powerful feature of the Nevermined Payments SDK that automatically intercepts and logs API calls to LLM providers (like OpenAI, Anthropic, etc.) without requiring manual instrumentation. This enables:

- **Automatic tracking** of LLM API usage
- **Cost monitoring** and attribution to specific users/agents
- **Observability** into your AI agent's behavior

## What This Tutorial Does

This is a **simple example** that showcases the core async logger functionality. It:

1. Initializes the Nevermined Payments SDK
2. Checks if the user has an active subscription and credits
3. Validates an incoming request and starts processing
4. **Initializes the async logger** to automatically track OpenAI calls
5. Makes a simple OpenAI API call (which gets logged automatically)
6. Redeems credits based on the request

The async logger automatically captures all OpenAI API calls made within the agent function without any additional code required!

## Prerequisites

- Node.js (v18 or higher)
- A Nevermined account with API credentials
- An OpenAI API key
- A Nevermined plan and agent configured

## Setup

1. **Install dependencies:**

```bash
yarn install
```

2. **Configure environment variables:**

Create a `.env` file in the root directory with the following variables:

```env
# Nevermined Configuration
NVM_API_KEY=your_nevermined_api_key
NVM_AGENT_ID=your_agent_id
NVM_PLAN_ID=your_plan_id
NVM_ENVIRONMENT=sanbox

# LLM Provider API Key
OPENAI_API_KEY=your_openai_api_key
```

## Running the Tutorial

Execute the agent script:

```bash
yarn agent
```

### Expected Output

You should see output similar to:

```
Getting access token...
Validating request is authorized...
Making OpenAI LLM call...
Redeeming credits...
Hello! How can I assist you today?
```

The async logger will automatically capture the OpenAI API call details, including:

- Request parameters (model, messages, temperature, etc.)
- Response content
- Token usage
- Latency
- Cost information

This data is sent to the Nevermined observability platform for analysis and monitoring.

## Key Code Highlights

### Initializing the Async Logger

```typescript
const logger = payments.observability.withAsyncLogger(
  {
    openAI: OpenAI,
  },
  agentRequest
);
logger.init();
```

Once initialized, the logger automatically intercepts all API calls.

### Making LLM Calls

After initialization, you can use the OpenAI SDK normally:

```typescript
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});
const completion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hello, world!" }],
});
```

All calls are automatically logged—no additional code required!

## Important Note

⚠️ **This is a simplified tutorial** designed to demonstrate the async logger feature in isolation. For a **complete, production-ready agent implementation** that includes:

- Advanced request handling
- Error management
- Streaming responses
- Complex agent logic
- Full integration patterns

Please refer to the **[financial-agent tutorial](../financial-agent)**, which provides a comprehensive example of a fully-fledged AI agent.

## Learn More

- [Nevermined Payments SDK Documentation](https://docs.nevermined.app)
- [Observability Guide](https://docs.nevermined.app/docs/development-guide/observability)
- [Financial Agent Tutorial](../financial-agent) - Full agent example
