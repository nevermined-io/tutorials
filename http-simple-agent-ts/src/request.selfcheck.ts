import { parseWeatherRequest, BadRequestError } from "./request.js";

const assert = (c: boolean, m: string) => { if (!c) throw new Error("FAIL: " + m); };
const assertThrows = (fn: () => unknown, m: string) => {
  try {
    fn();
    throw new Error("FAIL: " + m + " (did not throw)");
  } catch (err) {
    if (!(err instanceof BadRequestError)) throw new Error("FAIL: " + m + " (wrong error type)");
  }
};

assert(parseWeatherRequest({ city: "Lisbon" }).city === "Lisbon", "valid city passes through");
assert(parseWeatherRequest({ city: "Lisbon", days: "7" }).days === 7, "numeric string days coerced");
assertThrows(() => parseWeatherRequest({}), "missing city throws");
assertThrows(() => parseWeatherRequest({ city: "x" }), "too-short city throws");
assertThrows(() => parseWeatherRequest({ city: 123 }), "non-string city throws");
assertThrows(() => parseWeatherRequest({ city: "Lisbon", days: "abc" }), "non-numeric days throws");

console.log("✓ request self-check passed");
