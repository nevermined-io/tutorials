/**
 * Client-side helpers for the Nevermined x402 chat flow.
 *
 * Constants live here (rather than next to the hook or the callback page)
 * so both ends of the popup boundary import the same values — drift in
 * either the storage key or the postMessage type would silently break
 * the handoff.
 */

export const X402_STATE_KEY = "nvm:x402:state";

export const POSTMESSAGE_TYPE_DELEGATION_CREATED = "nvm:x402:delegation-created";

/**
 * Bootstrap payload from `/api/x402/init`. The chat UI no longer probes
 * the agent for a 402 envelope (gating moved into the tool), so plan
 * metadata is resolved server-side from the operator-configured
 * `NVM_PLAN_ID` and bundled into this single fetch.
 *
 * `embedUrl` is the standalone embed app's origin (e.g.
 * `https://embed.nevermined.dev`). The popup navigates there with
 * `/cards/setup` appended — the webapp's old `/embed/*` routes are
 * gone (nvm-monorepo#1787 / #1816).
 */
export interface X402Init {
  embedUrl: string;
  hasToken: boolean;
  accepts: X402PaymentAccepted[];
}

export interface X402PaymentAccepted {
  scheme: "nvm:erc4337" | "nvm:card-delegation";
  network: string;
  planId: string;
  extra?: { version?: string; agentId?: string; httpVerb?: string };
}

export interface DelegationCreatedMessage {
  type: typeof POSTMESSAGE_TYPE_DELEGATION_CREATED;
  paymentMethodId?: string;
  delegationId?: string;
  error?: string;
}

export function isDelegationCreatedMessage(
  value: unknown,
): value is DelegationCreatedMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === POSTMESSAGE_TYPE_DELEGATION_CREATED
  );
}

/**
 * Build the `/cards/setup` URL the popup navigates to on the standalone
 * embed app. The whole app *is* the embed surface, so the path has no
 * `/embed/` prefix — just `/cards/setup` on `https://embed.<tier-host>`.
 *
 * `provider` is intentionally omitted — for the MVP the embed page picks
 * the right provider from the plan; we don't need to hint.
 */
export function buildEmbedUrl(args: {
  embedUrl: string;
  sessionToken: string;
  returnUrl: string;
  state: string;
}): string {
  const url = new URL("/cards/setup", args.embedUrl);
  url.searchParams.set("sessionToken", args.sessionToken);
  url.searchParams.set("returnUrl", args.returnUrl);
  url.searchParams.set("state", args.state);
  return url.toString();
}

export function randomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
