export class BadRequestError extends Error {
  constructor(message: string) { super(message); this.name = "BadRequestError"; }
}

/** Validate the weather request body at the trust boundary. Throws BadRequestError on invalid input. */
export function parseWeatherRequest(body: unknown): { city: string; days?: number } {
  const b = (body ?? {}) as Record<string, unknown>;
  const city = b.city;
  if (typeof city !== "string" || city.trim().length < 2 || city.trim().length > 80) {
    throw new BadRequestError("'city' must be a string between 2 and 80 characters");
  }
  let days: number | undefined;
  if (b.days !== undefined) {
    const n = typeof b.days === "number" ? b.days : typeof b.days === "string" ? Number(b.days) : NaN;
    if (!Number.isFinite(n)) throw new BadRequestError("'days' must be a number");
    days = n; // getForecast already clamps to 1..7
  }
  return { city: city.trim(), days };
}
