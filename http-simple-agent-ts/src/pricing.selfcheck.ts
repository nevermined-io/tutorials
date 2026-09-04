import { priceForRequest } from "./pricing.js";

const assert = (c: boolean, m: string) => { if (!c) throw new Error("FAIL: " + m); };

assert(priceForRequest({ city: "Lisbon" }) === 1, "no days → 1 credit");
assert(priceForRequest({ city: "Lisbon", days: 1 }) === 1, "1 day → 1 credit");
assert(priceForRequest({ city: "Lisbon", days: 7 }) === 7, "7 days → 7 credits");
assert(priceForRequest({ city: "Lisbon", days: 99 }) === 7, "days capped at 7");
assert(priceForRequest({ city: "Lisbon", days: 0 }) === 1, "days floored at 1");
assert(priceForRequest({ city: "Lisbon", days: "3" as any }) === 3, "numeric string coerced");
assert(priceForRequest({}) === 1, "empty body → 1 credit");
console.log("✓ pricing self-check passed");
