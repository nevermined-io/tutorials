/**
 * Drives the Nevermined x402 Pay flow from the chat UI:
 *
 *   1. On mount, fetch `/api/x402/init` to learn the planId + frontend host
 *      + whether a server-side token cookie is already present.
 *   2. `triggerPay()` opens the Nevermined white-label popup at
 *      `{frontendUrl}/embed/cards/setup` and resolves once `window.opener`
 *      receives the `delegation-created` postMessage from the callback
 *      page. The hook then asks the server to mint an x402 access token
 *      and store it in a httpOnly cookie.
 *   3. `reset()` clears the cookie so the user can re-authorize a new
 *      delegation without restarting the server.
 *
 * The hook never holds the access token itself — the proxy reads it from
 * the cookie on each request. Storing it client-side would make it
 * accessible to component-tree XSS.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  X402_STATE_KEY,
  buildEmbedUrl,
  isDelegationCreatedMessage,
  randomState,
  type X402Envelope,
  type X402Init,
} from "@/lib/x402-client";

const POPUP_FEATURES = "width=520,height=720,menubar=no,toolbar=no,location=no";
const POPUP_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export type PaymentFlowState = "idle" | "running";

export interface UseNvmPayment {
  init: X402Init | null;
  hasToken: boolean;
  flowState: PaymentFlowState;
  error: string | null;
  triggerPay(): Promise<void>;
  reset(): Promise<void>;
}

export function useNvmPayment(): UseNvmPayment {
  const [init, setInit] = useState<X402Init | null>(null);
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [flowState, setFlowState] = useState<PaymentFlowState>("idle");
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/x402/init")
      .then(async (res) => {
        if (!res.ok) throw new Error(`init failed: HTTP ${res.status}`);
        return (await res.json()) as X402Init;
      })
      .then((data) => {
        if (cancelled) return;
        setInit(data);
        setHasToken(data.hasToken);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const triggerPay = useCallback(async (): Promise<void> => {
    if (inFlightRef.current) return inFlightRef.current;
    if (!init) {
      throw new Error("x402 init not loaded yet — wait for the hook to mount.");
    }

    const run = (async () => {
      setFlowState("running");
      setError(null);
      try {
        // 1. Discover what the agent will charge — never assume scheme
        //    or network from env. The 402 envelope is the only source
        //    of truth (Stripe vs erc4337, plan id, network identifier).
        const probeRes = await fetch("/api/x402/probe");
        if (!probeRes.ok) {
          throw new Error(`Failed to probe agent: HTTP ${probeRes.status} — ${await probeRes.text()}`);
        }
        const envelope = (await probeRes.json()) as X402Envelope;
        const accept = envelope.accepts?.[0];
        if (!accept) {
          throw new Error("Agent envelope has no `accepts` entry.");
        }

        const returnUrl = `${window.location.origin}/x402-callback`;

        const sessionRes = await fetch("/api/x402/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ returnUrl }),
        });
        if (!sessionRes.ok) {
          throw new Error(`Failed to mint widget session: HTTP ${sessionRes.status} — ${await sessionRes.text()}`);
        }
        const { sessionToken } = (await sessionRes.json()) as {
          sessionToken: string;
        };

        const state = randomState();
        sessionStorage.setItem(X402_STATE_KEY, state);

        const popup = window.open(
          buildEmbedUrl({
            frontendUrl: init.frontendUrl,
            sessionToken,
            returnUrl,
            state,
          }),
          "nvm-x402",
          POPUP_FEATURES,
        );
        if (!popup) {
          throw new Error("Popup blocked — allow popups for this origin and retry.");
        }

        const { paymentMethodId: _pm, delegationId } = await waitForCallback(popup);

        // 2. Mint the access token using the scheme/network/planId from
        //    the agent's envelope, not server-side guesses. The agent
        //    is the source of truth for what it will accept.
        const tokenRes = await fetch("/api/x402/token", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            planId: accept.planId,
            scheme: accept.scheme,
            network: accept.network,
            // Only include agentId when the envelope actually carries
            // one — the server's Zod schema accepts null too, but
            // omitting the key is cleaner.
            ...(accept.extra?.agentId
              ? { agentId: accept.extra.agentId }
              : {}),
            delegationId,
          }),
        });
        if (!tokenRes.ok) {
          throw new Error(`Failed to mint x402 token: HTTP ${tokenRes.status} — ${await tokenRes.text()}`);
        }

        setHasToken(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      } finally {
        setFlowState("idle");
        inFlightRef.current = null;
      }
    })();

    inFlightRef.current = run;
    return run;
  }, [init]);

  const reset = useCallback(async (): Promise<void> => {
    setError(null);
    const res = await fetch("/api/x402/token", { method: "DELETE" });
    if (!res.ok) {
      throw new Error(`reset failed: HTTP ${res.status}`);
    }
    setHasToken(false);
  }, []);

  return useMemo<UseNvmPayment>(
    () => ({
      init,
      hasToken,
      flowState,
      error,
      triggerPay,
      reset,
    }),
    [init, hasToken, flowState, error, triggerPay, reset],
  );
}

/**
 * Resolves when the popup posts back a `delegation-created` message.
 * Rejects if the popup is closed without a message, if the message
 * carries an error, or after the timeout.
 */
function waitForCallback(popup: Window): Promise<{
  paymentMethodId: string;
  delegationId: string;
}> {
  return new Promise((resolve, reject) => {
    const expectedOrigin = window.location.origin;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let killTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (pollTimer) clearInterval(pollTimer);
      if (killTimer) clearTimeout(killTimer);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== expectedOrigin) return;
      if (!isDelegationCreatedMessage(event.data)) return;
      cleanup();
      if (event.data.error) {
        reject(new Error(`Callback reported error: ${event.data.error}`));
        return;
      }
      if (!event.data.paymentMethodId || !event.data.delegationId) {
        reject(new Error("Callback missing paymentMethodId or delegationId."));
        return;
      }
      resolve({
        paymentMethodId: event.data.paymentMethodId,
        delegationId: event.data.delegationId,
      });
    };

    window.addEventListener("message", onMessage);

    pollTimer = setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error("Popup closed before delegation was created."));
      }
    }, 500);

    killTimer = setTimeout(() => {
      cleanup();
      try {
        popup.close();
      } catch {
        // ignore — best effort
      }
      reject(new Error("Timed out waiting for delegation creation."));
    }, POPUP_TIMEOUT_MS);
  });
}
