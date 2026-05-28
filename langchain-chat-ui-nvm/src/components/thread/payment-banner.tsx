/**
 * Status banner for the Nevermined x402 card-delegation flow.
 *
 * Lives above the chat surface. Always visible, three states:
 *
 *   - **Loading** — init in flight, no actions.
 *   - **Unauthorized** — no token cookie yet. The "Authorize" button opens
 *     the white-label popup; on success the banner flips to authorized.
 *   - **Authorized** — token cookie present, the proxy will inject
 *     `payment-signature` on outgoing requests until the on-chain budget
 *     runs out. A "Reset" link clears the cookie so the user can swap
 *     delegations without restarting the server.
 *
 * For the MVP we render this preemptively (so the user knows what to do
 * before sending their first message) rather than detecting a 402 in the
 * stream error. Auto-retry-on-402 is tracked as a follow-up.
 */

"use client";

import { CreditCard, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useNvmPayment } from "@/hooks/useNvmPayment";

export function PaymentBanner() {
  const { init, hasToken, flowState, error, triggerPay, reset } =
    useNvmPayment();

  if (!init) {
    return (
      <div className="flex items-center gap-3 border-b bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        <span>Loading payment configuration…</span>
      </div>
    );
  }

  const isAuthorizing = flowState === "running";

  return (
    <div
      className={[
        "flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2 text-sm",
        hasToken ? "bg-emerald-50" : "bg-amber-50",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        {hasToken ? (
          <ShieldCheck className="size-4 text-emerald-700" />
        ) : (
          <CreditCard className="size-4 text-amber-700" />
        )}
        <span
          className={hasToken ? "text-emerald-900" : "text-amber-900"}
        >
          {hasToken
            ? "Card delegation active — agent will be paid per request until your budget runs out."
            : "Authorize a card delegation to chat with this paid agent."}
        </span>
        {error ? (
          <span className="ml-2 text-xs text-rose-700" title={error}>
            ⚠ {error.length > 80 ? `${error.slice(0, 80)}…` : error}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {hasToken ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              reset().catch(() => {
                // useNvmPayment already surfaces the error via state
              });
            }}
            disabled={isAuthorizing}
          >
            Reset delegation
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={() => {
              triggerPay().catch(() => {
                // useNvmPayment already surfaces the error via state
              });
            }}
            disabled={isAuthorizing}
          >
            {isAuthorizing ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Authorizing…
              </>
            ) : (
              "Authorize"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
