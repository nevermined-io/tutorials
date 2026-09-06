// The merchant's catalog. Prices live here on the SERVER side so the browser
// never gets to name its own amount — the chat only sends a `packageId`, and
// `/api/orders` looks up the price. This is the whole anti-tampering story.

export type TravelPackage = {
  id: string
  name: string
  /** Price in USD cents (minor units). Nevermined Orders require 100..99_999_999. */
  amountMinor: number
  nights: number
  blurb: string
  emoji: string
}

export const PACKAGES: TravelPackage[] = [
  {
    id: 'barcelona',
    name: 'Barcelona City Break',
    amountMinor: 343795, // $3,437.95
    nights: 3,
    blurb: 'Flights + boutique hotel steps from La Rambla.',
    emoji: '🏖️',
  },
  {
    id: 'tokyo',
    name: 'Tokyo Explorer',
    amountMinor: 1289900, // $12,899.00
    nights: 7,
    blurb: 'Round-trip flights, ryokan stay, and a bullet-train pass.',
    emoji: '🗼',
  },
  {
    id: 'safari',
    name: 'Kenya Safari',
    amountMinor: 875000, // $8,750.00
    nights: 5,
    blurb: 'Guided Maasai Mara game drives, all-inclusive lodge.',
    emoji: '🦁',
  },
]

export function getPackage(id: string): TravelPackage | undefined {
  return PACKAGES.find((p) => p.id === id)
}

/** Best-effort match of free-typed chat text to a package (city / name / id). */
export function matchPackage(text: string): TravelPackage | undefined {
  const t = text.toLowerCase()
  return PACKAGES.find(
    (p) => t.includes(p.id) || t.includes(p.name.toLowerCase().split(' ')[0]),
  )
}

export function formatUsd(amountMinor: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amountMinor / 100)
}

// ponytail: fail-fast money-path guard, runs at import (server boot). Ceiling:
// static catalog; move to a DB + zod row schema when packages become dynamic.
const ids = new Set<string>()
for (const p of PACKAGES) {
  if (!Number.isInteger(p.amountMinor) || p.amountMinor < 100 || p.amountMinor > 99_999_999) {
    throw new Error(`Package "${p.id}" has an out-of-range amountMinor: ${p.amountMinor}`)
  }
  if (ids.has(p.id)) throw new Error(`Duplicate package id: ${p.id}`)
  ids.add(p.id)
}
