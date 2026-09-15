# Flight disruption plan

A travel operations developer can give a passenger a single snapshot of flight status, arrival-airport weather, and ground travel time. The input is a flight number, an arrival airport, and coordinates for an airport-to-destination road route. The output is a timestamped, redacted JSON and HTML brief. This combines three independently paid MPP services rather than duplicating the Catalog's existing ten example workflows.

**Status: blocked.** Neither available flight-status wrapper delivered a paid flight record in the bounded Live probes. The fixture only demonstrates rendering.

The sample discovers the exact slugs in the live Nevermined Catalog before paying:

| Service | Endpoint | Purpose | Listed price on 2026-09-15 |
| --- | --- | --- | --- |
| `goflightlabs-mpp` | `GET /flight-info-by-flight-number` | flight status and delay | $0.005 |
| `aviationstack-mpp` | `GET /v1/flights` | alternate flight status; runner default | $0.005 |
| `openweather-mpp` | `POST /openweather/current-weather` | weather at arrival airport | $0.006 |
| `mapbox-mpp` | `POST /mapbox/directions` | road time to destination | $0.005 |

Those are **listed estimates**, not a live quote or observed spend. The script requires a delivered body, a Settled Router payment signal, and a matching Settled ledger record before treating a call as successful. Prices and availability can change; the merchant's 402 and Router receipt are authoritative. The script reserves $0.02 per call against a $0.10, 15-minute delegation to leave room for fees. If the flight-status seed fails, it stops before paying weather or routing, writes a brief labeled **PARTIAL**, and exits nonzero. It also stops if the ledger is unreadable or the guard cannot reserve the next call. A transient HTTP 429/502/503/504 uses the same request ID after checking the ledger; timeouts are ambiguous and are never retried automatically.

## Prerequisites and setup

- Python 3.9+; no packages to install.
- A funded Nevermined Live buyer API key able to create an `erc4337` USDC delegation. This is a **real-money** opt-in run.
- A private `~/.nvm-router-buyer.json` file, like `{"apiBase":"https://api.live.nevermined.app","apiKey":"live:..."}`. Run `chmod 600 ~/.nvm-router-buyer.json`. Do not commit it.
- A Router deployment with the opaque slug broker (`/api/v1/router/svc/<slug>` and `{slug,path}` at `/api/v1/router/route`). On 2026-09-15 the Live Catalog publishes `/router/svc` invoke URLs and unauthenticated `/router/proxy` responds 401, indicating the broker surface is deployed. OpenWeather and Mapbox POSTs settled in bounded Live probes; flight GET invocation did not return data or settle.

From this folder, discover the services for free:

```bash
python3 run-demo.py
```

For a paid run, choose a real flight and coordinates. The default `--flight-service aviationstack-mpp` uses `flight_iata` and `arr_iata`; select `--flight-service goflightlabs-mpp` to try its unverified `flight_number` query. Neither wrapper has completed this journey. The defaults are illustrative and may not describe the same journey; supply values that match your actual use case:

```bash
python3 run-demo.py --pay --flight LH811 --airport JFK \
  --airport-lat 40.6413 --airport-lon -73.7781 \
  --destination-lat 40.7580 --destination-lon -73.9855
```

The output is `out/flight-disruption-<UTC timestamp>.json` and `.html`. It contains selected status, weather, route and spend fields; it omits keys, delegation IDs, Router transaction identifiers, raw provider data and personal details. The delegation ID is saved separately in private `out/delegation.json` for ledger lookup after a failure. Review the brief before sharing. The HTML has no external dependencies. The free discovery command makes no paid call and creates no delegation or artifact.

Render a **synthetic fixture** offline to inspect both artifact formats without credentials or payment:

```bash
python3 run-demo.py --fixture --out /tmp/flight-disruption-fixture
```

The fixture JSON includes `"fixture": true`, `"spendUsd": 0.0`, and a note that no service was contacted. It is a renderer check, not a representative live result.

## Service schemas and decisions

The OpenWeather [MPP service guide](https://paywithlocus.com/mpp/openweather.md) and [OpenAPI](https://openweather.mpp.paywithlocus.com/openapi.json) confirm `lat`, `lon` and optional `units` in a JSON POST. The Mapbox [MPP service guide](https://paywithlocus.com/mpp/mapbox.md) and [OpenAPI](https://mapbox.mpp.paywithlocus.com/openapi.json) confirm `profile` and semicolon-separated `coordinates` (`lon,lat;lon,lat`) in a JSON POST. The sample uses `mapbox/driving`; ground time is a useful fallback for a disrupted arrival.

GoFlightLabs lists `/flight-info-by-flight-number` as a GET in the [MPP registry](https://mpp.dev/api/services). Its MPP host did not expose `/openapi.json` or `/llms.txt` when checked on 2026-09-15. The `flightIata` query parameter is inferred from [GoFlightLabs' own MCP page](https://www.goflightlabs.com/mcp), which discusses flight-by-number and says `flightIata` is a useful parameter. **The wrapper's exact query and response schema remain unverified.** A bounded Live call using `flightIata=BA117` returned HTTP 403 without payment. The runner currently sends `flight_number=…` when GoFlightLabs is selected; that alternative has not been validated. Confirm the wrapper schema through Catalog MCP or a free published OpenAPI document before presenting a paid run as validated.

For a GET with query parameters the script uses the slug-native invoke path and `X-Router-Delegation-Id` / `X-Router-Request-Id` headers. The `{slug,path}` body route cannot carry a query string correctly, so the POST services use that route instead. Exact slugs are checked at runtime to prevent a shuffled search result from selecting a different paid merchant.

## Troubleshooting and current validation

| Symptom | Meaning / action |
| --- | --- |
| Catalog lookup fails | The slug or endpoint is absent. Discover a current equivalent before editing the sample. |
| Paid call returns 404 or 409 | Check endpoint, credentials and Router logs; do not switch a cataloged service to a raw merchant URL. |
| Delegation creation fails | Check Live key, funding, and `erc4337` USDC eligibility. |
| Flight result is empty or 403 | The flight wrapper query or upstream access may differ; inspect its schema and 403 details. GoFlightLabs `flight_number` is currently sent but unverified. |
| HTTP timeout | Check `/api/v1/router/payments` for the delegation before deciding whether to retry manually. |
| Budget guard stops | The observed or uncertain spend is too high for the next reservation. Start a new explicitly authorized run if needed. |

The earlier two bounded Live partial probes paid OpenWeather and Mapbox after flight GET failures, settling **$0.006 + $0.005 = $0.011 per probe**. The corrected runner now stops on that flight failure before buying downstream data; this correction has only been syntax and fixture checked, not paid-run validated. GoFlightLabs `GET /flight-info-by-flight-number?flightIata=BA117` returned 403 with **no payment**. An AviationStack substitution, `GET /v1/flights` with `flight_iata` and `arr_iata`, also returned 403 with **no payment**; a browser-user-agent diagnostic request returned 404 with **no payment**. Neither probe yielded flight status, so neither produced a complete disruption plan. Live artifact quality and time to first complete result remain unverified. Do not publish the fixture as a live result or claim the journey complete until a funded builder obtains flight data, reviews the receipt and output, and records any substitution.

## DevEx friction log

| Step | Expected | Observed / reproduction | Impact | Proposed fix |
| --- | --- | --- | --- | --- |
| Discover GoFlightLabs schema | Catalog or merchant links a query/response schema | Catalog lists endpoints only; `GET https://goflightlabs.mpp.tempo.xyz/openapi.json` and `/llms.txt` returned 404 on 2026-09-15 | A builder must guess `flightIata` mapping and cannot safely validate a paid call in advance | Add an OpenAPI/usage recipe link in Catalog metadata, or publish wrapper OpenAPI at the MPP host |
| Obtain flight status | A documented query returns a usable flight record | Live `GET /flight-info-by-flight-number?flightIata=BA117` returned 403, no payment; `flight_number` is now sent by the corrected runner but remains unverified | Weather and routing settle but the brief cannot establish disruption | Document required wrapper parameter and response shape; verify an alternate query with one capped call and ledger check |
| Substitute AviationStack | A second flight source can restore the missing status | Live `GET /v1/flights` with `flight_iata` and `arr_iata` returned 403, no payment; browser-UA diagnostic returned 404, no payment | Substitution did not unblock a complete artifact | Publish a working invocation recipe and distinguish upstream authorization errors from Router errors |
| Verify Router invocation | Catalog `invokeUrl` works with a funded delegation | Live Catalog publishes `/router/svc` URLs and unauthenticated `/router/proxy` returns 401; OpenWeather and Mapbox POSTs settled, while flight GETs failed unpaid | The broker surface works for those POSTs; flight GET behavior remains unresolved | Verify a documented flight GET through the slug invoke path and compare body with ledger receipt |

The code does not claim either friction is fixed. Repeat this journey after those changes and log actual calls, costs, and first-success timing before using it as a published outcome.
