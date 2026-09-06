'use client'

import { useEffect, useRef, useState } from 'react'
import { formatUsd, matchPackage, type TravelPackage } from '@/lib/packages'

type Msg =
  | { kind: 'text'; role: 'user' | 'assistant'; text: string }
  | { kind: 'packages' }
  | { kind: 'typing' }
  | { kind: 'checkout'; orderId: string; pkg: TravelPackage }
  | { kind: 'confirm'; pkg: TravelPackage; paymentIntent: string }

const GREETING =
  "Hi! I'm your Acme Travel concierge. Pick a trip and pay by card right here — no account, no login. Which one sounds good?"

export default function Chat({
  embedBase,
  packages,
}: {
  embedBase: string
  packages: TravelPackage[]
}) {
  const [msgs, setMsgs] = useState<Msg[]>([
    { kind: 'text', role: 'assistant', text: GREETING },
    { kind: 'packages' },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const threadRef = useRef<HTMLDivElement>(null)

  // Track which orders we've already confirmed so a re-posted message can't
  // double-fire a confirmation card.
  const confirmed = useRef<Set<string>>(new Set())
  // Map orderId -> package so the success handler can name the trip.
  const orderPkg = useRef<Map<string, TravelPackage>>(new Map())
  // Stable per-session nonce. Combined with the packageId it becomes the Order's
  // idempotencyKey, so a double-clicked or retried "Book" for the same trip
  // returns the same Order instead of minting orphan PaymentIntents.
  const sessionNonce = useRef<string>('')
  if (!sessionNonce.current) sessionNonce.current = crypto.randomUUID()

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' })
  }, [msgs])

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // Non-negotiable trust checks: only the embed origin, only nvm:success,
      // only the envelope version we understand. @nevermined-io/ui-widgets'
      // parseMessage rejects any other `version`; mirror that so a future v2
      // envelope can't be mis-parsed into a false "confirmed".
      if (event.origin !== embedBase) return
      if (event.data?.type !== 'nvm:success') return
      if (event.data?.version !== '1') return

      const { orderId, paymentIntent } = event.data.payload ?? {}
      if (!orderId || confirmed.current.has(orderId)) return
      const pkg = orderPkg.current.get(orderId)
      if (!pkg) return

      // NOTE: this message is a UX signal, not proof of settlement. A production
      // merchant fulfils on the `payment_intent.succeeded` webhook (or a
      // server-side status read), never on this browser event — see the README.
      confirmed.current.add(orderId)
      // Replace the (now-completed) checkout iframe with the confirmation so the
      // "booked!" moment lands where the buyer is looking, not below a tall form.
      setMsgs((m) => [
        ...m.filter((x) => !(x.kind === 'checkout' && x.orderId === orderId)),
        { kind: 'confirm', pkg, paymentIntent: paymentIntent ?? '' },
      ])
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [embedBase])

  async function startOrder(pkg: TravelPackage, userText: string) {
    if (busy) return
    setBusy(true)
    setMsgs((m) => [
      ...m.filter((x) => x.kind !== 'packages'),
      { kind: 'text', role: 'user', text: userText },
      { kind: 'typing' },
    ])

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: pkg.id,
          idempotencyKey: `${sessionNonce.current}:${pkg.id}`,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Order failed')

      orderPkg.current.set(data.orderId, pkg)
      setMsgs((m) => [
        ...m.filter((x) => x.kind !== 'typing'),
        {
          kind: 'text',
          role: 'assistant',
          text: `Great choice! Here's your secure checkout for the ${pkg.name} (${formatUsd(
            pkg.amountMinor,
          )}). Pay with any card — test with 4242 4242 4242 4242.`,
        },
        { kind: 'checkout', orderId: data.orderId, pkg },
      ])
    } catch (err) {
      setMsgs((m) => [
        ...m.filter((x) => x.kind !== 'typing'),
        {
          kind: 'text',
          role: 'assistant',
          text: `Sorry — I couldn't set up checkout (${
            err instanceof Error ? err.message : 'unknown error'
          }).`,
        },
      ])
    } finally {
      setBusy(false)
    }
  }

  function onSend() {
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    const pkg = matchPackage(text)
    if (pkg) {
      startOrder(pkg, text)
    } else {
      setMsgs((m) => [
        ...m,
        { kind: 'text', role: 'user', text },
        {
          kind: 'text',
          role: 'assistant',
          text: "I didn't catch a trip in that. Here's what I can book right now:",
        },
        { kind: 'packages' },
      ])
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="logo">✈️</div>
        <div>
          <h1>Acme Travel</h1>
          <p>Card checkout · powered by Nevermined</p>
        </div>
      </header>

      <div className="thread" ref={threadRef}>
        {msgs.map((m, i) => (
          <MessageView
            key={i}
            m={m}
            embedBase={embedBase}
            packages={packages}
            onPick={(p) => startOrder(p, `I'd like to book the ${p.name}.`)}
            busy={busy}
          />
        ))}
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault()
          onSend()
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. I want to book the Barcelona trip"
          aria-label="Message"
        />
        <button className="btn" type="submit" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  )
}

function MessageView({
  m,
  embedBase,
  packages,
  onPick,
  busy,
}: {
  m: Msg
  embedBase: string
  packages: TravelPackage[]
  onPick: (p: TravelPackage) => void
  busy: boolean
}) {
  if (m.kind === 'text') {
    return (
      <div className={`row ${m.role}`}>
        <div className={`bubble ${m.role}`}>{m.text}</div>
      </div>
    )
  }

  if (m.kind === 'typing') {
    return (
      <div className="row assistant">
        <div className="bubble assistant dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    )
  }

  if (m.kind === 'packages') {
    return (
      <div className="row assistant">
        <div className="packages">
          {packages.map((p) => (
            <div className="pkg" key={p.id}>
              <div className="emoji">{p.emoji}</div>
              <div className="body">
                <div className="name">{p.name}</div>
                <div className="blurb">
                  {p.nights} nights · {p.blurb}
                </div>
                <div className="price">{formatUsd(p.amountMinor)}</div>
              </div>
              <button className="btn" onClick={() => onPick(p)} disabled={busy}>
                Book
              </button>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (m.kind === 'checkout') {
    const src = `${embedBase}/checkout/order/${m.orderId}?parentOrigin=${encodeURIComponent(
      window.location.origin,
    )}`
    return (
      <div className="row assistant">
        <div className="checkout">
          <div className="cap">
            🔒 Secure Stripe checkout · {m.pkg.name} · {formatUsd(m.pkg.amountMinor)}
          </div>
          <iframe src={src} title="Nevermined checkout" allow="payment" />
        </div>
      </div>
    )
  }

  // confirm
  return (
    <div className="row assistant">
      <div className="confirm">
        <span style={{ fontSize: 20 }}>✅</span>
        <div>
          Payment confirmed — your <strong>{m.pkg.name}</strong> is booked! You'll get an
          itinerary by email shortly.
          {m.paymentIntent && <div className="pi">{m.paymentIntent}</div>}
        </div>
      </div>
    </div>
  )
}
