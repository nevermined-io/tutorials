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

export function getNvmApiKey(): string {
  return required("NVM_API_KEY");
}

export function getNvmOrgId(): string {
  return required("NVM_ORG_ID");
}

export function getNvmPlanId(): string {
  return required("NVM_PLAN_ID");
}

export function getLanggraphApiUrl(): string {
  return required("LANGGRAPH_API_URL").replace(/\/$/, "");
}
