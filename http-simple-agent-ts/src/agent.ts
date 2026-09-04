/**
 * Weather HTTP Agent - Express server with dual-protocol Nevermined payment middleware.
 *
 * Three plans, three routes, both protocols. `mpp: true` on every paid route makes
 * each 402 advertise x402 AND MPP, so either buyer works against the same URL.
 *
 * x402 HTTP Transport Headers:
 * - Client sends token in: `payment-signature` header
 * - Server returns 402 with: `payment-required` header (base64-encoded)
 *
 * MPP HTTP Transport Headers:
 * - Client sends credential in: `authorization` header
 * - Server returns 402 with: `www-authenticate` header
 */
import "dotenv/config";
import express, { Request, Response, RequestHandler } from "express";
import { Payments, EnvironmentName } from "@nevermined-io/payments";
import { paymentMiddleware, X402_HEADERS, MPP_HEADERS } from "@nevermined-io/payments/express";
import { getTodayWeather, getForecast, CityNotFoundError } from "./services/weather.service.js";
import { priceForRequest } from "./pricing.js";
import { parseWeatherRequest, BadRequestError } from "./request.js";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const NVM_API_KEY = process.env.NVM_API_KEY ?? "";
const NVM_ENVIRONMENT = (process.env.NVM_ENVIRONMENT || "sandbox") as EnvironmentName;
const PLAN_ID_CREDITS = process.env.PLAN_ID_CREDITS ?? "";
const PLAN_ID_TIME = process.env.PLAN_ID_TIME ?? "";
const PLAN_ID_PAYG = process.env.PLAN_ID_PAYG ?? "";

if (!NVM_API_KEY || !PLAN_ID_CREDITS || !PLAN_ID_TIME || !PLAN_ID_PAYG) {
  console.error("NVM_API_KEY, PLAN_ID_CREDITS, PLAN_ID_TIME and PLAN_ID_PAYG are required.");
  process.exit(1);
}

const payments = Payments.getInstance({ nvmApiKey: NVM_API_KEY, environment: NVM_ENVIRONMENT });

const app = express();
app.use(express.json());

// /health stays unprotected — mount it before the paywall.
app.get("/health", (_req: Request, res: Response) => res.json({ ok: true }));

// One middleware, three plans, both protocols. `mpp: true` makes each 402 advertise
// x402 AND MPP, so either buyer works against the same URL.
app.use(
  paymentMiddleware(
    payments,
    {
      "POST /weather/credits": { planId: PLAN_ID_CREDITS, credits: 1, mpp: true },
      "POST /weather/subscription": { planId: PLAN_ID_TIME, credits: 1, mpp: true },
      "POST /weather/payg": {
        planId: PLAN_ID_PAYG,
        credits: (req: Request) => priceForRequest(req.body),
        mpp: true,
      },
    },
    {
      onBeforeVerify: (req) => console.log(`[pay] verify ${req.method} ${req.path}`),
      onAfterSettle: (req, credits) => console.log(`[pay] settled ${credits} on ${req.path}`),
    },
  ) as RequestHandler,
);

async function handleToday(req: Request, res: Response) {
  try {
    const { city } = parseWeatherRequest(req.body);
    return res.json(await getTodayWeather(city));
  } catch (err) {
    if (err instanceof BadRequestError) return res.status(400).json({ error: err.message });
    if (err instanceof CityNotFoundError) return res.status(404).json({ error: err.message });
    console.error(err);
    return res.status(502).json({ error: "weather upstream failed" });
  }
}

app.post("/weather/credits", handleToday);
app.post("/weather/subscription", handleToday);

app.post("/weather/payg", async (req: Request, res: Response) => {
  try {
    const { city, days } = parseWeatherRequest(req.body);
    return res.json(days && days > 1 ? await getForecast(city, days) : await getTodayWeather(city));
  } catch (err) {
    if (err instanceof BadRequestError) return res.status(400).json({ error: err.message });
    if (err instanceof CityNotFoundError) return res.status(404).json({ error: err.message });
    console.error(err);
    return res.status(502).json({ error: "weather upstream failed" });
  }
});

app.listen(PORT, () => {
  console.log(`weather-x402 agent on http://localhost:${PORT}`);
  console.log(`x402 header: ${X402_HEADERS.PAYMENT_SIGNATURE} · MPP header: ${MPP_HEADERS.CREDENTIAL}`);
});
