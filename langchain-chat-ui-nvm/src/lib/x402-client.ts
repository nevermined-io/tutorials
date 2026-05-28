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

export interface X402Init {
  planId: string;
  scheme: string;
  network: string;
  frontendUrl: string;
  hasToken: boolean;
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
 * Build the `/embed/cards/setup` URL the popup navigates to.
 *
 * `provider` is intentionally omitted — for the MVP the embed page picks
 * the right provider from the plan; we don't need to hint.
 */
export function buildEmbedUrl(args: {
  frontendUrl: string;
  sessionToken: string;
  returnUrl: string;
  state: string;
}): string {
  const url = new URL("/embed/cards/setup", args.frontendUrl);
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
