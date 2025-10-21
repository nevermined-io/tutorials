# Pricing Simulation Tutorial

This tutorial demonstrates how to use the **Nevermined Payments** library's pricing simulation feature to test and estimate costs for your AI agents without requiring user subscriptions, plans, or agent registration.

> 💡 **Python Version Available**: Looking for the Python version? Check out the [pricing-simulation-py](../pricing-simulation-py) tutorial.

## Overview

The pricing simulation feature allows you to quickly prototype and test your AI agent's cost structure before deploying it with real subscriptions. This is perfect for:

- **Development and testing** of new AI agents without setup overhead
- **Cost estimation** to understand pricing before going to production
- **Profit margin simulation** to test different pricing strategies
- **Quick prototyping** without needing to configure agents and plans

## What This Tutorial Does

This is a **simple example** that showcases the pricing simulation functionality. It:

1. Initializes the Nevermined Payments SDK (no agent or plan required!)
2. **Starts a simulation request** - creates a virtual request without subscriptions
3. Makes an OpenAI API call with observability tracking enabled
4. **Finishes the simulation** - calculates costs with a configurable profit margin (default 20%)

Unlike production agents, this requires **no prior setup** - no agent registration, no plans, no subscribers. Just start simulating!

## Prerequisites

- Node.js (v18 or higher)
- A Nevermined account with API credentials (just the API key!)
- An OpenAI API key (or other LLM provider)
- **No agent or plan setup required** ✨

## Setup

1. **Install dependencies:**

```bash
yarn install
```

2. **Configure environment variables:**

Create a `.env` file in the root directory with the following variables:

```env
# Nevermined Configuration (only API key needed!)
NVM_API_KEY=your_nevermined_api_key
NVM_ENVIRONMENT=staging

# LLM Provider API Key
OPENAI_API_KEY=your_openai_api_key
```

**Note:** Unlike production agents, you don't need `NVM_AGENT_ID` or `NVM_PLAN_ID` for simulations!

## Running the Tutorial

Execute the agent script:

```bash
yarn agent
```

### Expected Output

You should see output similar to:

```
Calling agent...
Starting simulation request...
Making OpenAI LLM call...
Redeeming credits...
Hello! How can I assist you today?
```

The simulation automatically captures the OpenAI API call details, including:

- Request parameters (model, messages, temperature, etc.)
- Response content
- Token usage and actual costs from the provider
- Calculated credits to redeem (with 20% margin by default)
- Simulated transaction information

This data is sent to the Nevermined observability platform, allowing you to see how your agent would perform in production.

## Key Code Highlights

### Starting a Simulation Request

```typescript
const agentRequest = await payments.requests.startSimulationRequest();
```

This creates a virtual agent request without needing any agent or plan configuration. You can optionally pass parameters:

```typescript
const agentRequest = await payments.requests.startSimulationRequest({
  pricePerCredit: 0.01, // USD per credit (default: 0.01)
  batch: false, // Batch mode (default: false)
  agentName: "My Test Agent", // Display name (default: "Simulated Agent")
  planName: "Test Plan", // Plan name (default: "Simulated Plan")
});
```

### Making LLM Calls with Observability

Wrap your OpenAI client with observability tracking:

```typescript
const openai = new OpenAI(
  payments.observability.withOpenAI(OPENAI_API_KEY, agentRequest, {})
);

const completion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hello, world!" }],
});
```

This automatically tracks the LLM usage and costs.

### Finishing the Simulation

```typescript
await payments.requests.finishSimulationRequest(agentRequest.agentRequestId);
```

This calculates the final cost with your profit margin. You can customize the margin:

```typescript
await payments.requests.finishSimulationRequest(
  agentRequest.agentRequestId,
  0.3, // 30% margin instead of default 20%
  false // batch mode
);
```

## Important Note

⚠️ **This is a simplified tutorial** designed to demonstrate the pricing simulation feature. For a **complete, production-ready agent implementation** that includes:

- Real agent and plan registration
- Actual user subscriptions and credit management
- Advanced request validation and authorization
- Error management and retry logic
- Streaming responses
- Complex agent logic
- Full integration patterns

Please refer to the **[financial-agent tutorial](../financial-agent)**, which provides a comprehensive example of a fully-fledged AI agent with real payment processing.

## Use Cases

The pricing simulation feature is ideal for:

- **Testing during development** - No need to set up agents and plans while coding
- **Cost estimation** - Understand your agent's economics before launching
- **Pricing strategy** - Experiment with different profit margins
- **Demo purposes** - Show agent capabilities without complex setup
- **CI/CD testing** - Validate agent logic without payment infrastructure

Once you're ready for production, transition to the full agent implementation with real subscriptions!

## Learn More

- [Nevermined Payments SDK Documentation](https://docs.nevermined.app)
- [Observability Guide](https://docs.nevermined.app/docs/development-guide/observability)
- [Financial Agent Tutorial](../financial-agent) - Full production agent example
