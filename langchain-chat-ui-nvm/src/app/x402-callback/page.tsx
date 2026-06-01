/**
 * Popup target for the Nevermined white-label card-delegation flow.
 *
 * The chat UI opens
 *
 *   `{NVM_EMBED_URL}/cards/setup?sessionToken=...&returnUrl=.../x402-callback&state=...`
 *
 * in a popup. The user enrols a card, picks a budget, and on success
 * Nevermined redirects the popup back here with the resulting IDs as
 * query parameters. We round-trip them to `window.opener` via
 * `postMessage` and close ourselves so the chat surface can continue.
 *
 * Security model:
 *  - The `state` nonce was generated and stored in `sessionStorage` by
 *    the chat UI before opening the popup. We re-read it from the SAME
 *    `window.opener.sessionStorage` (same origin) and compare. A mismatch
 *    surfaces an error to the opener; we do NOT mint a token from a
 *    forged callback.
 *  - `postMessage` is sent to `window.location.origin` only — never the
 *    Nevermined origin — so a malicious page hosting our callback path
 *    cannot trick the opener.
 *  - If `window.opener` is null (user opened the URL directly), we render
 *    a fallback message instead of silently failing.
 */

"use client";

import { useEffect, useState } from "react";

import { POSTMESSAGE_TYPE_DELEGATION_CREATED, X402_STATE_KEY } from "@/lib/x402-client";

type Status = "checking" | "matched" | "mismatch" | "error" | "no-opener";

export default function X402CallbackPage() {
  const [status, setStatus] = useState<Status>("checking");
  const [detail, setDetail] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const opener = window.opener as Window | null;
    if (!opener) {
      setStatus("no-opener");
      setDetail(
        "This page is the redirect target for the Nevermined card-delegation popup. Open the chat UI and start the payment flow from there.",
      );
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const callbackError = params.get("error");
    if (callbackError) {
      const message = params.get("error_description") ?? callbackError;
      opener.postMessage(
        {
          type: POSTMESSAGE_TYPE_DELEGATION_CREATED,
          error: message,
        },
        window.location.origin,
      );
      setStatus("error");
      setDetail(message);
      window.close();
      return;
    }

    const paymentMethodId = params.get("paymentMethodId");
    const delegationId = params.get("delegationId");
    const incomingState = params.get("state");

    if (!paymentMethodId || !delegationId || !incomingState) {
      setStatus("error");
      setDetail("Callback is missing paymentMethodId, delegationId, or state.");
      opener.postMessage(
        {
          type: POSTMESSAGE_TYPE_DELEGATION_CREATED,
          error: "incomplete_callback",
        },
        window.location.origin,
      );
      window.close();
      return;
    }

    // `sessionStorage` is per-tab; the chat UI and this popup share the
    // same origin, but the popup has its own session storage. Read the
    // opener's storage instead — both windows are same-origin so it's
    // accessible.
    let expectedState: string | null = null;
    try {
      expectedState = opener.sessionStorage.getItem(X402_STATE_KEY);
    } catch {
      // SecurityError if opener is cross-origin — should not happen here
      // but fail safely if it does.
      expectedState = null;
    }

    if (!expectedState || expectedState !== incomingState) {
      setStatus("mismatch");
      setDetail(
        "The CSRF state nonce returned by Nevermined did not match the one this tab opened. Refusing to complete the flow.",
      );
      opener.postMessage(
        {
          type: POSTMESSAGE_TYPE_DELEGATION_CREATED,
          error: "state_mismatch",
        },
        window.location.origin,
      );
      window.close();
      return;
    }

    try {
      opener.sessionStorage.removeItem(X402_STATE_KEY);
    } catch {
      // best-effort cleanup
    }

    opener.postMessage(
      {
        type: POSTMESSAGE_TYPE_DELEGATION_CREATED,
        paymentMethodId,
        delegationId,
      },
      window.location.origin,
    );
    setStatus("matched");
    setDetail("Delegation created. You can close this window.");
    window.close();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-md rounded-lg border bg-background p-6 shadow-sm">
        <h1 className="mb-2 text-lg font-semibold tracking-tight">
          Nevermined payment authorization
        </h1>
        <p className="text-sm text-muted-foreground">
          {status === "checking" && "Returning to chat…"}
          {status === "matched" && "Delegation created. You can close this window."}
          {status === "mismatch" && detail}
          {status === "error" && detail}
          {status === "no-opener" && detail}
        </p>
      </div>
    </main>
  );
}
