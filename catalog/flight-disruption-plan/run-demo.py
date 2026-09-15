#!/usr/bin/env python3
"""Build a redacted flight disruption brief from three paid Catalog services.

Discovery is free. Payment requires --pay, a funded Live buyer, and a delegation.
"""
import argparse
import datetime as dt
import html
import json
import os
import pathlib
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

SERVICES = {
    "goflightlabs-mpp": ("/flight-info-by-flight-number", "GET", 0.005),
    "aviationstack-mpp": ("/v1/flights", "GET", 0.005),
    "openweather-mpp": ("/openweather/current-weather", "POST", 0.006),
    "mapbox-mpp": ("/mapbox/directions", "POST", 0.005),
}
CAP_CENTS = 10
RESERVE_DOLLARS = 0.02  # conservative reservation per call, including unknown Router fee


def request(url, *, key=None, method="GET", body=None, headers=None, timeout=120):
    h = dict(headers or {})
    if key:
        h["Authorization"] = "Bearer " + key
    data = None if body is None else json.dumps(body).encode()
    if data is not None:
        h["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as err:
        raw = err.read()
        try:
            payload = json.loads(raw)
        except (ValueError, UnicodeDecodeError):
            payload = {"error": raw[:300].decode(errors="replace")}
        return err.code, payload


def catalog(api, slug):
    code, item = request(f"{api}/api/v1/catalog/services/{slug}")
    if code != 200 or item.get("slug") != slug or item.get("protocol") != "mpp":
        raise RuntimeError(f"{slug}: Catalog lookup failed (HTTP {code})")
    path, method, _ = SERVICES[slug]
    if not any(e.get("path") == path and e.get("method") == method for e in item.get("endpoints", [])):
        raise RuntimeError(f"{slug}: required {method} {path} is absent from live Catalog")
    return item


def ledger(api, key, delegation):
    query = urllib.parse.urlencode({"delegationId": delegation})
    code, rows = request(f"{api}/api/v1/router/payments?{query}", key=key)
    if code != 200 or not isinstance(rows, list):
        raise RuntimeError(f"Router payment ledger unavailable (HTTP {code}); stop to protect budget")
    return rows


def spent(rows):
    # Router amount is token micro-units; include all non-failed entries as a conservative ceiling.
    total = 0.0
    for row in rows:
        if str(row.get("status", "")).lower() in {"failed", "rejected", "cancelled"}:
            continue
        amount = row.get("amount")
        try:
            total += int(amount) / 1_000_000
        except (TypeError, ValueError):
            raise RuntimeError("Router ledger has an unreadable amount; stop to protect budget")
    return total


def paid_call(api, key, delegation, slug, path, method, payload, rows, run_id):
    before = spent(rows)
    if before + RESERVE_DOLLARS > CAP_CENTS / 100:
        raise RuntimeError(f"Budget guard: ${before:.4f} recorded, cannot reserve ${RESERVE_DOLLARS:.2f}")
    call_id = f"fd-{run_id}-{slug.split('-')[0]}"
    # Retry only explicit transient HTTP failures. A timeout is ambiguous and is never retried.
    for attempt in range(3):
        if method == "GET":
            query = urllib.parse.urlencode(payload)
            url = f"{api}/api/v1/router/svc/{slug}{path}?{query}"
            code, result = request(url, key=key, headers={
                "X-Router-Delegation-Id": delegation,
                "X-Router-Request-Id": call_id,
            })
        else:
            code, result = request(f"{api}/api/v1/router/route", key=key, method="POST", body={
                "delegationId": delegation, "slug": slug, "path": path,
                "method": method, "body": payload, "requestId": call_id,
            })
        if 200 <= code < 300:
            new_rows = ledger(api, key, delegation)
            return result, new_rows, call_id
        if code not in {429, 502, 503, 504} or attempt == 2:
            raise RuntimeError(f"{slug}{path}: HTTP {code}; {str(result)[:240]}")
        # The same request ID is preserved across attempts; inspect ledger before retrying.
        new_rows = ledger(api, key, delegation)
        if spent(new_rows) > before:
            raise RuntimeError(f"{slug}: transient response but ledger shows spend; manual reconciliation required")
        time.sleep(2 ** attempt)
    raise AssertionError("unreachable")


def first_record(data):
    if isinstance(data, list):
        return data[0] if data else {}
    if isinstance(data, dict):
        for key in ("data", "flights", "results"):
            child = data.get(key)
            if isinstance(child, list):
                return child[0] if child else {}
            if isinstance(child, dict):
                return child
        return data
    return {}


def pick(item, *paths):
    for path in paths:
        value = item
        for part in path.split("."):
            value = value.get(part) if isinstance(value, dict) else None
        if value not in (None, "", [], {}):
            return value
    return None


def brief(flight, weather, directions, args, timestamp, calls, cost):
    # Allowlist fields only: source payloads and credential identifiers never enter public artifacts.
    f = first_record(flight)
    w = first_record(weather)
    d = first_record(directions)
    route = first_record(d.get("routes", []) if isinstance(d, dict) else {})
    status = pick(f, "flight_status", "status", "flight.status", "STATUS")
    delay = pick(f, "departure.delay", "arrival.delay", "delay", "delay_minutes")
    description = pick(w, "weather.0.description", "description")
    if not description and isinstance(w.get("weather"), list) and w["weather"]:
        description = w["weather"][0].get("description")
    return {
        "generatedAt": timestamp,
        "kind": "flight-disruption-plan",
        "flight": args.flight.upper(),
        "airport": args.airport.upper(),
        "flightStatus": status or "unavailable",
        "delayMinutes": delay,
        "weather": {
            "description": description or "unavailable",
            "temperatureC": pick(w, "main.temp", "temperature") or "unavailable",
            "windSpeed": pick(w, "wind.speed") or "unavailable",
        },
        "groundRoute": {
            "durationMinutes": round(route.get("duration", 0) / 60, 1) if isinstance(route.get("duration"), (int, float)) else "unavailable",
            "distanceKm": round(route.get("distance", 0) / 1000, 1) if isinstance(route.get("distance"), (int, float)) else "unavailable",
        },
        "suggestedAction": "Check airline updates before leaving; allow extra time for ground travel." if status or delay else "Confirm flight status with the airline; flight data could not be verified.",
        "spendUsd": round(cost, 6),
        "calls": calls,
        "sourceNote": "Live service responses; selected fields only. This is an informational snapshot, not travel advice.",
    }


def save(out_dir, result):
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = result["generatedAt"].replace(":", "-")
    root = out_dir / f"flight-disruption-{stamp}"
    json_path = root.with_suffix(".json")
    html_path = root.with_suffix(".html")
    json_path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    rows = [("Flight", result["flight"]), ("Airport", result["airport"]),
            ("Status", result["flightStatus"]), ("Delay (min)", result["delayMinutes"]),
            ("Weather", result["weather"]["description"]),
            ("Temperature (°C)", result["weather"]["temperatureC"]),
            ("Ground route (min)", result["groundRoute"]["durationMinutes"]),
            ("Ground route (km)", result["groundRoute"]["distanceKm"]),
            ("Spend (USD)", result["spendUsd"])]
    table = "".join(f"<tr><th>{html.escape(k)}</th><td>{html.escape(str(v))}</td></tr>" for k, v in rows)
    html_path.write_text("<!doctype html><html lang='en'><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
                         "<title>Flight disruption brief</title><style>body{font:1rem system-ui;max-width:44rem;margin:2rem auto;padding:0 1rem;line-height:1.5}"
                         "table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #ddd;padding:.7rem;text-align:left}th{width:45%}</style>"
                         f"<h1>Flight disruption brief</h1><p>Generated {html.escape(result['generatedAt'])}</p><table>{table}</table>"
                         f"<h2>Next step</h2><p>{html.escape(result['suggestedAction'])}</p><p>{html.escape(result['sourceNote'])}</p></html>\n")
    return json_path, html_path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pay", action="store_true", help="opt in to a capped live paid run")
    parser.add_argument("--fixture", action="store_true", help="write a clearly synthetic artifact offline; no credentials or paid calls")
    parser.add_argument("--flight", default="LH811", help="IATA flight number")
    parser.add_argument("--flight-service", choices=("aviationstack-mpp", "goflightlabs-mpp"),
                        default="aviationstack-mpp", help="flight-status vendor")
    parser.add_argument("--airport", default="JFK", help="arrival airport IATA code")
    parser.add_argument("--airport-lat", type=float, default=40.6413)
    parser.add_argument("--airport-lon", type=float, default=-73.7781)
    parser.add_argument("--destination-lat", type=float, default=40.7580)
    parser.add_argument("--destination-lon", type=float, default=-73.9855)
    parser.add_argument("--credentials", type=pathlib.Path, default=pathlib.Path.home() / ".nvm-router-buyer.json")
    parser.add_argument("--out", type=pathlib.Path, default=pathlib.Path(__file__).resolve().parent / "out")
    args = parser.parse_args()
    if args.pay and args.fixture:
        parser.error("--pay and --fixture are mutually exclusive")
    if not re.fullmatch(r"[A-Za-z0-9]{2,8}", args.flight) or not re.fullmatch(r"[A-Za-z]{3}", args.airport):
        parser.error("flight and airport must be simple IATA identifiers")
    if not (-90 <= args.airport_lat <= 90 and -90 <= args.destination_lat <= 90 and
            -180 <= args.airport_lon <= 180 and -180 <= args.destination_lon <= 180):
        parser.error("coordinates are outside latitude/longitude bounds")
    if args.fixture:
        timestamp = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        result = brief(
            {"flight_status": "delayed", "departure": {"delay": 35}},
            {"weather": [{"description": "light rain"}], "main": {"temp": 17}, "wind": {"speed": 5}},
            {"routes": [{"duration": 2400, "distance": 28000}]},
            args, timestamp,
            [{"service": slug, "endpoint": SERVICES[slug][0], "result": "synthetic fixture"}
             for slug in (args.flight_service, "openweather-mpp", "mapbox-mpp")],
            0.0,
        )
        result["fixture"] = True
        result["sourceNote"] = "Synthetic fixture for artifact rendering only. No service was contacted or paid."
        result["elapsedSeconds"] = 0.0
        files = save(args.out, result)
        print("Wrote synthetic, redacted artifacts:", *files, sep="\n  ")
        return
    api = "https://api.live.nevermined.app"
    print("Discovering live Catalog services (free)…")
    for slug in (args.flight_service, "openweather-mpp", "mapbox-mpp"):
        item = catalog(api, slug)
        path, method, estimate = SERVICES[slug]
        print(f"  {slug}: {method} {path}; listed ${estimate:.4f}; {item.get('invokeUrl')}")
    if not args.pay:
        print("Discovery complete. Add --pay to create a capped delegation and make three paid calls.")
        return
    if args.credentials.stat().st_mode & 0o077:
        raise RuntimeError("Credentials file must be private (chmod 600)")
    creds = json.loads(args.credentials.read_text())
    key = creds.get("apiKey") or creds.get("KEY")
    if not key or (creds.get("apiBase") or creds.get("API_BASE") or api).rstrip("/") != api:
        raise RuntimeError("Credentials must contain a Live apiKey and apiBase")
    code, delegation_data = request(f"{api}/api/v1/delegation/create", key=key, method="POST", body={
        "provider": "erc4337", "currency": "usdc", "spendingLimitCents": CAP_CENTS,
        "durationSecs": 900, "consumerPrompt": "Flight disruption plan demo", "assuranceData": {},
    })
    delegation = delegation_data.get("id") or delegation_data.get("delegationId")
    if not (200 <= code < 300 and delegation):
        raise RuntimeError(f"Delegation creation failed (HTTP {code}): {str(delegation_data)[:240]}")
    print(f"Created a ${CAP_CENTS/100:.2f}, 15-minute delegation (ID withheld).")
    start = time.monotonic()
    run_id = uuid.uuid4().hex[:12]
    rows = ledger(api, key, delegation)
    calls = []
    responses = {}
    steps = [
        (args.flight_service,
         {"flight_iata": args.flight.upper(), "arr_iata": args.airport.upper()}
         if args.flight_service == "aviationstack-mpp"
         else {"flight_number": args.flight.upper()}),
        ("openweather-mpp", {"lat": args.airport_lat, "lon": args.airport_lon, "units": "metric"}),
        ("mapbox-mpp", {"profile": "mapbox/driving", "coordinates":
                         f"{args.airport_lon},{args.airport_lat};{args.destination_lon},{args.destination_lat}"}),
    ]
    for slug, body in steps:
        path, method, _ = SERVICES[slug]
        try:
            data, rows, _ = paid_call(api, key, delegation, slug, path, method, body, rows, run_id)
            if slug in ("goflightlabs-mpp", "aviationstack-mpp"):
                record = first_record(data)
                if not pick(record, "flight_status", "status", "flight.status", "STATUS", "flight.iata", "flight_number"):
                    raise RuntimeError(f"{slug} returned no recognizable flight fields; check wrapper query schema")
                returned_flight = pick(record, "flight.iata", "flightIata", "flight_number")
                if returned_flight and str(returned_flight).upper() != args.flight.upper():
                    raise RuntimeError(f"{slug} returned another flight; refusing an inaccurate status")
            responses[slug] = data.get("body", data) if method == "POST" and isinstance(data, dict) else data
            calls.append({"service": slug, "endpoint": path, "result": "ok"})
            print(f"  {slug}: successful; ledger total ${spent(rows):.4f}")
        except (RuntimeError, urllib.error.URLError, TimeoutError) as err:
            # Keep the published artifact free of upstream error bodies and identifiers.
            calls.append({"service": slug, "endpoint": path, "result": "failed",
                          "reason": "upstream or Router failure; inspect private terminal output"})
            print(f"  {slug}: {err}", file=sys.stderr)
            try:
                rows = ledger(api, key, delegation)
            except RuntimeError:
                print("Ledger unavailable; stopping further paid calls.", file=sys.stderr)
                break
            if "Budget guard" in str(err) or "manual reconciliation" in str(err):
                break
    timestamp = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    result = brief(responses.get(args.flight_service, {}), responses.get("openweather-mpp", {}),
                   responses.get("mapbox-mpp", {}), args, timestamp, calls, spent(rows))
    result["elapsedSeconds"] = round(time.monotonic() - start, 1)
    files = save(args.out, result)
    print("Wrote redacted artifacts:", *files, sep="\n  ")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, OSError, ValueError) as err:
        print(f"Error: {err}", file=sys.stderr)
        sys.exit(1)
