/** Pay-as-you-go price: 1 credit for current weather, `days` credits (1..7) for a forecast. */
export function priceForRequest(body: unknown): number {
  const raw = (body as { days?: unknown } | null | undefined)?.days;
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(7, Math.trunc(n)));
}
