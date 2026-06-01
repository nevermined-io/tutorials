/**
 * Server-only env loader for the Nevermined x402 chat UI demo.
 *
 * Throws clearly when a required variable is missing instead of surfacing
 * a confusing "fetch returned 401" downstream. All accessors must run on
 * the Next.js server runtime — never import this from a client component.
 */

import { Environments, type EnvironmentName } from "@nevermined-io/payments";

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        `Set it in .env.local — see .env.example for the full list.`,
    );
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== "" ? value : fallback;
}

export function getNvmEnvironment(): EnvironmentName {
  const name = optional("NVM_ENVIRONMENT", "sandbox");
  if (!(name in Environments)) {
    throw new Error(
      `Unknown NVM_ENVIRONMENT="${name}". Expected one of: ${Object.keys(Environments).join(", ")}.`,
    );
  }
  return name as EnvironmentName;
}

export function getNvmBackendUrl(): string {
  return Environments[getNvmEnvironment()].backend.replace(/\/$/, "");
}

export function getNvmFrontendUrl(): string {
  return Environments[getNvmEnvironment()].frontend.replace(/\/$/, "");
}

/**
 * Origin of the standalone embed app the popup opens against
 * (`https://embed.<tier-host>`). The webapp's `/embed/*` routes were
 * removed in nvm-monorepo#1787 / #1816 and replaced with a dedicated
 * embed app per tier. The TS SDK's `EnvironmentInfo` does not yet
 * carry an `embed` field, so we derive it from the frontend host:
 * prepend `embed.` to the second-level domain.
 *
 * Honors `NVM_EMBED_URL` if set — handy for `NVM_ENVIRONMENT=custom`
 * runs against a locally-hosted embed app or for staging overrides.
 */
export function getNvmEmbedUrl(): string {
  const override = process.env.NVM_EMBED_URL;
  if (override && override.trim() !== "") {
    return override.replace(/\/$/, "");
  }
  const frontend = new URL(getNvmFrontendUrl());
  frontend.hostname = `embed.${frontend.hostname.replace(/^(www\.|app\.)/, "")}`;
  return frontend.toString().replace(/\/$/, "");
}

export function getNvmApiKey(): string {
  return required("NVM_API_KEY");
}

export function getNvmOrgId(): string {
  return required("NVM_ORG_ID");
}

export function getLanggraphApiUrl(): string {
  return required("LANGGRAPH_API_URL").replace(/\/$/, "");
}

/**
 * The Nevermined plan id the agent's `market_research` tool charges
 * against. Same plan id configured on the agent (its `NVM_PLAN_ID`).
 *
 * We bake this into the chat UI rather than discovering it from the
 * agent because there is no longer a route-level middleware to probe —
 * gating happens inside the tool, so there is no 402 envelope to ask
 * the agent for. The trade-off is honest: the chat UI is now operator-
 * configured rather than fully self-describing.
 */
export function getNvmPlanId(): string {
  return required("NVM_PLAN_ID");
}

export function getNvmAgentId(): string | undefined {
  const value = process.env.NVM_AGENT_ID;
  return value && value.trim() !== "" ? value : undefined;
}

export function getAssistantId(): string {
  return optional("NEXT_PUBLIC_ASSISTANT_ID", "research");
}
