#!/usr/bin/env python3
"""One-off sourced product teardown. Default is synthetic; --live can spend funds."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import html
import ipaddress
import json
import os
import re
import sys
import time
from decimal import Decimal
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit, urlunsplit
from urllib.request import Request, urlopen

HERE = Path(__file__).resolve().parent
API = os.getenv("NVM_API_BASE", "https://api.live.nevermined.app").rstrip("/")
ALLOWED_APIS = {"https://api.live.nevermined.app", "https://api.live.nevermined.dev"}
SERVICES = {
    "brave": ("brave-search-via-mpp", "/brave/web-search", Decimal("0.035")),
    "serper": ("serper-scrape", "/", Decimal("0.02")),
    "deepseek": ("deepseek", "/deepseek/chat", Decimal("0.10")),  # planning reserve, not a quote
}
FEE_HEADROOM = Decimal("1.20")
EMAIL = re.compile(r"(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b")
PHONE = re.compile(r"(?<!\w)(?:\+?\d{1,3}[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}(?!\w)")
TOKEN = re.compile(r"(?i)\b(?:sk-[A-Za-z0-9_-]{12,}|(?:live|sandbox|nvm):[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._-]{16,}|(?:api[_-]?key|token)\s*[:=]\s*[A-Za-z0-9._-]{16,})")


def safe_url(raw: str, *, fixture: bool = False) -> str:
    parsed = urlsplit(raw)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Use a public HTTPS URL with no credentials")
    host = parsed.hostname.lower()
    if not fixture and (host in {"localhost", "127.0.0.1"} or host.endswith((".local", ".invalid", ".test", ".internal", ".localhost"))):
        raise ValueError("Input URL must be a public site")
    try:
        ipaddress.ip_address(host)
    except ValueError:
        pass
    else:
        raise ValueError("Input URL must use a public hostname, not an IP address")
    if parsed.port not in (None, 443):
        raise ValueError("Use standard HTTPS port 443")
    return urlunsplit(("https", parsed.netloc.lower(), parsed.path or "/", "", ""))


def redact(value: str) -> str:
    value = EMAIL.sub("[redacted email]", value)
    value = PHONE.sub("[redacted phone]", value)
    return TOKEN.sub("[redacted credential]", value)


def clean_excerpt(value: str) -> str:
    """Make search snippets plain text before placing them in Markdown/JSON."""
    return redact(html.unescape(re.sub(r"<[^>]*>", "", value)))


def get_json(url: str, key: str | None = None) -> Any:
    headers = {"Accept": "application/json"}
    if key:
        headers["Authorization"] = f"Bearer {key}"
    with urlopen(Request(url, headers=headers), timeout=20) as response:
        return json.load(response)


def private_buyer_key() -> str:
    path = Path.home() / ".nvm-router-buyer.json"
    if not path.is_file() or path.stat().st_mode & 0o077:
        raise ValueError(f"Credential file {path} is missing or not private (chmod 600)")
    config = json.loads(path.read_text())
    key = config.get("apiKey") or config.get("KEY")
    if not key or (config.get("apiBase") or config.get("API_BASE") or API).rstrip("/") != API:
        raise ValueError("Private buyer file must contain a key for the selected Live API host")
    return key


def private_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    os.chmod(path, 0o600)
    with os.fdopen(fd, "w") as handle:
        json.dump(value, handle, indent=2)
        handle.write("\n")


def post_json(url: str, payload: dict[str, Any], key: str,
              extra: dict[str, str] | None = None,
              private_path: Path | None = None) -> tuple[dict[str, Any], dict[str, str]]:
    headers = {"Accept": "application/json", "Content-Type": "application/json",
               "Authorization": f"Bearer {key}", **(extra or {})}
    request = Request(url, data=json.dumps(payload).encode(), headers=headers, method="POST")
    try:
        with urlopen(request, timeout=70) as response:
            raw = response.read()
            if private_path is not None:
                try:
                    raw_envelope: Any = json.loads(raw) if raw else None
                except json.JSONDecodeError:
                    raw_envelope = raw.decode("utf-8", errors="replace")
                private_json(private_path, {
                    "http_status": response.status,
                    "response_headers": {
                        "Nevermined-Version": response.headers.get("Nevermined-Version"),
                        "X-Correlation-Id": response.headers.get("X-Correlation-Id"),
                    },
                    "router_envelope": raw_envelope,
                })
            if not raw:
                raise RuntimeError("Router returned an empty body; inspect ledger before retry")
            body = json.loads(raw)
            if not isinstance(body, dict):
                raise RuntimeError("Delivered body is not a JSON object")
            return body, dict(response.headers)
    except HTTPError as exc:
        detail = exc.read(5000).decode(errors="replace")
        if private_path is not None:
            private_json(private_path, {"http_status": exc.code, "error_body": detail})
        raise RuntimeError(f"HTTP {exc.code}; inspect private Router response and ledger before retry") from exc
    except (URLError, TimeoutError) as exc:
        raise RuntimeError("Network outcome indeterminate; inspect ledger before retry") from exc


def check_contract(with_llm: bool) -> None:
    contract = json.loads((HERE / "wrapper-contract.json").read_text())
    for key in ("brave", "serper") + (("deepseek",) if with_llm else ()):
        slug, path, _ = SERVICES[key]
        item = contract[key]
        if item.get("confirmed_by_paid_smoke_test") is not True or not item.get("confirmation_date"):
            raise RuntimeError(f"Payable {key} wrapper shape is unconfirmed; stop before spending")
        if (item.get("slug"), item.get("path"), item.get("method")) != (slug, path, "POST"):
            raise RuntimeError(f"Confirmed wrapper contract for {key} does not match this code")


def check_catalog(with_llm: bool) -> None:
    if API not in ALLOWED_APIS:
        raise ValueError("NVM_API_BASE must be an exact live Nevermined API host")
    for key in ("brave", "serper") + (("deepseek",) if with_llm else ()):
        slug, path, _ = SERVICES[key]
        listing = get_json(f"{API}/api/v1/catalog/services/{slug}")
        endpoints = {(e["method"], e["path"]) for e in listing.get("endpoints", [])}
        if listing.get("slug") != slug or listing.get("protocol") != "mpp" or (
            listing.get("healthStatus") != "operational"
        ) or ("POST", path) not in endpoints:
            raise RuntimeError(f"Catalog listing changed for {slug}; stop before spending")


def create_10min_delegation(key: str, cap_cents: int) -> str:
    body, _ = post_json(f"{API}/api/v1/delegation/create", {
        "provider": "erc4337",
        "spendingLimitCents": cap_cents,
        "durationSecs": 600,
        "currency": "usdc",
        "maxTransactions": 3,
    }, key)
    delegation_id = body.get("delegationId") or body.get("id")
    if not isinstance(delegation_id, str) or not delegation_id:
        raise RuntimeError("Delegation creation did not return delegationId")
    return delegation_id


def stable_id(run_id: str, service: str) -> str:
    return "teardown-" + hashlib.sha256(f"{run_id}:{service}".encode()).hexdigest()[:32]


def paid_post(key: str, delegation: str, run_id: str, name: str,
              body: dict[str, Any]) -> tuple[dict[str, Any], str]:
    slug, path, _ = SERVICES[name]
    envelope, _ = post_json(f"{API}/api/v1/router/route", {
        "slug": slug,
        "path": path,
        "method": "POST",
        "body": body,
        "delegationId": delegation,
        "requestId": stable_id(run_id, name),
    }, key, private_path=HERE / "out" / f"private-{stable_id(run_id, name)}-router.json")
    payment = envelope.get("payment") or {}
    result = envelope.get("body")
    if envelope.get("paid") is not True or not isinstance(result, dict) or not result:
        raise RuntimeError(f"{name} had no paid, nonempty delivered body; inspect ledger")
    payment_id = payment.get("paymentId")
    status = payment.get("status")
    if not payment_id or status not in ("Issued", "Settled"):
        raise RuntimeError(f"{name} has no verifiable Router payment signal ({status!r}); inspect ledger")
    return result, payment_id


def receipt_usd(key: str, delegation: str, payment_id: str) -> tuple[Decimal, str, bool]:
    row = None
    for attempt in range(4):
        records = get_json(f"{API}/api/v1/router/payments?delegationId={delegation}", key)
        row = next((r for r in records if r.get("id") == payment_id), None)
        if row and row.get("feeStatus") not in (None, "Accrued", "Submitted"):
            break
        if attempt < 3:
            time.sleep(2)
    if not row:
        raise RuntimeError(f"Payment {payment_id} absent from ledger")
    if row.get("status") != "Settled":
        raise RuntimeError(f"Merchant payment {payment_id} not settled; inspect ledger")
    if row.get("assetSymbol") not in ("USDC", "USDC.e", "pathUSD", "PathUSD"):
        raise RuntimeError(f"Payment {payment_id} is not in a USD-like asset")
    decimals = row.get("assetDecimals")
    if decimals is None:
        raise RuntimeError(f"Payment {payment_id} has unknown asset scale")
    merchant = Decimal(str(row["amount"])) / (Decimal(10) ** int(decimals))
    fee_status = row.get("feeStatus")
    if fee_status is None:
        raise RuntimeError(f"Payment {payment_id} has unknown fee status; inspect ledger")
    fee = Decimal("0") if fee_status == "Released" else Decimal(str(row.get("feeCents") or "0")) / Decimal("100")
    if fee_status in ("Failed",):
        raise RuntimeError(f"Payment {payment_id} fee failed; inspect ledger")
    pending_fee = fee_status in ("Accrued", "Submitted")
    if fee_status not in ("None", "Settled", "Released", "Accrued", "Submitted"):
        raise RuntimeError(f"Payment {payment_id} has unhandled fee status {fee_status}")
    if merchant <= 0 or (fee_status == "None" and fee != 0):
        raise RuntimeError(f"Payment {payment_id} has inconsistent amount/fee")
    return merchant + fee, fee_status, pending_fee


def remaining_cents(key: str, delegation: str, cap_cents: int) -> int:
    record = get_json(f"{API}/api/v1/delegation/{delegation}", key)
    remaining = record.get("remainingBudgetCents")
    spent = record.get("amountSpentCents")
    if remaining is None or spent is None:
        raise RuntimeError("Delegation readback lacks remaining/spent cents; stop")
    remaining = int(remaining)
    spent = int(spent)
    if remaining < 0 or spent < 0 or remaining + spent > cap_cents:
        raise RuntimeError("Delegation budget counters are inconsistent; stop")
    return remaining


def search_sources(body: dict[str, Any], fixture: bool) -> list[dict[str, str]]:
    results = ((body.get("data") or {}).get("web") or {}).get("results")
    if not isinstance(results, list) or not results:
        raise RuntimeError("Brave wrapper did not deliver web.results")
    sources: list[dict[str, str]] = []
    for result in results[:5]:
        if not isinstance(result, dict):
            continue
        url = result.get("url")
        if not isinstance(url, str):
            continue
        try:
            public_url = safe_url(url, fixture=fixture)
        except ValueError:
            continue
        sources.append({
            "url": public_url,
            "title": clean_excerpt(str(result.get("title") or ""))[:160],
            "excerpt": clean_excerpt(str(result.get("description") or ""))[:400],
        })
    if not sources:
        raise RuntimeError("Brave delivered no usable public sources")
    return sources


def scrape_excerpt(body: dict[str, Any]) -> str:
    value = body.get("text")
    if not isinstance(value, str) or not value.strip():
        raise RuntimeError("Serper wrapper did not deliver nonempty text")
    return "\n".join(line.rstrip() for line in redact(value)[:1600].splitlines())


def shape(value: Any, depth: int = 3) -> Any:
    """Reveal field names/types for a smoke test without exposing source content."""
    if depth <= 0:
        return type(value).__name__
    if isinstance(value, dict):
        return {k: shape(v, depth - 1) for k, v in value.items()}
    if isinstance(value, list):
        return [shape(value[0], depth - 1)] if value else []
    return type(value).__name__


def assemble(company_url: str, rival_query: str, sources: list[dict[str, str]],
             company_excerpt: str, model_note: str | None,
             *, fixture: bool, spend: Decimal | None,
             pending_fees: list[dict[str, Any]],
             first_delivered_at: str | None,
             time_to_first_delivered_seconds: float | None) -> tuple[dict[str, Any], str]:
    first_company_line = next(
        (line.strip() for line in company_excerpt.splitlines()
         if line.strip() and not line.lstrip().startswith("#")),
        company_excerpt[:200],
    )[:300]
    first_rival_excerpt = sources[0]["excerpt"][:300]
    comparison = {
        "company_public_claim_excerpt": first_company_line,
        "rival_search_claim_excerpt": first_rival_excerpt,
        "interpretation": "Potential positioning difference; validate against full cited pages",
        "evidence_urls": [company_url, sources[0]["url"]],
    }
    artifact = {
        "synthetic": fixture,
        "verified_paid_run": not fixture,
        "audience": "product marketing and strategy builders",
        "purpose": "one-off sourced positioning teardown",
        "company_url": company_url,
        "rival_query": redact(rival_query),
        "company_excerpt": company_excerpt,
        "rival_sources": sources,
        "positioning_comparison": comparison,
        "model_hypothesis_unverified": model_note,
        "actual_spend_usd": str(spend) if spend is not None else None,
        "buyer_fee_reconciliation_pending": pending_fees,
        "first_delivered_at_utc": first_delivered_at,
        "time_to_first_delivered_seconds": time_to_first_delivered_seconds,
        "review_action": "Check the cited pages and validate each positioning hypothesis",
    }
    label = "SYNTHETIC FIXTURE" if fixture else "VERIFIED ROUTER RECEIPTS; CHECK CLAIMS"
    lines = [
        f"# Competitive product teardown — {label}", "",
        f"Company source: {company_url}",
        f"Rival research query: {redact(rival_query)}", "",
        "## Company positioning evidence", "",
        company_excerpt, "", "## Rival positioning evidence", "",
    ]
    for source in sources:
        lines.append(f"- [{source['title']}]({source['url']}): {source['excerpt']}")
    lines += [
        "", "## One-off positioning comparison", "",
        "| Company page claim | Rival search claim | Decision |",
        "| --- | --- | --- |",
        f"| {first_company_line.replace('|', '/')} | {first_rival_excerpt.replace('|', '/')} "
        "| Test whether this is a real differentiator using the full cited pages. |",
        "", "The comparison quotes bounded source excerpts and flags the interpretation "
        "for validation; it does not assert market superiority.",
    ]
    if model_note:
        lines += ["", "Model draft (unverified; validate against cited sources):", "", model_note]
    lines += ["", "No personal data, credentials, or full scraped pages are included.",
              f"Recorded Router merchant-plus-fee charge: {spend if spend is not None else 'not observed'} USD.",
              f"First delivered result: {first_delivered_at or 'not observed'} UTC; "
              f"{time_to_first_delivered_seconds if time_to_first_delivered_seconds is not None else 'not observed'} seconds from command start.",
              f"Buyer fee statuses still pending: {len(pending_fees)}.", ""]
    return artifact, "\n".join(lines)


def main() -> int:
    command_started = time.monotonic()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true", help="Create delegation and make paid calls")
    parser.add_argument("--run-id", help="Stable ID for exactly one intended paid run")
    parser.add_argument("--company-url", help="Safe public HTTPS product page")
    parser.add_argument("--rival-query", help="Public product/rival research query")
    parser.add_argument("--with-llm", action="store_true", help="Add dynamic-priced DeepSeek draft")
    parser.add_argument("--smoke-service", choices=("brave", "serper", "deepseek"),
                        help="One bounded paid shape check; no teardown artifact")
    parser.add_argument("--out", type=Path, default=HERE / "out")
    args = parser.parse_args()
    if not args.live:
        sample = json.loads((HERE / "fixtures" / "synthetic.json").read_text())
        company_url = safe_url(sample["company_url"], fixture=True)
        query = sample["rival_query"]
        sources = search_sources(sample["search"], fixture=True)
        excerpt = scrape_excerpt(sample["scrape"])
        note = None
        spend = None
        pending_fees: list[dict[str, Any]] = []
        first_delivered_at = None
        time_to_first_delivered_seconds = None
    else:
        if not args.run_id or not args.company_url or not args.rival_query:
            parser.error("--live requires --run-id, --company-url, --rival-query")
        key = private_buyer_key()
        company_url = safe_url(args.company_url)
        query = args.rival_query.strip()
        if not query or len(query) > 200 or EMAIL.search(query) or TOKEN.search(query):
            parser.error("Use a short public rival query with no personal data or credentials")
        if not args.smoke_service:
            check_contract(args.with_llm)  # full run requires measured wrapper shapes
        check_catalog(args.with_llm or args.smoke_service == "deepseek")
        planned = (SERVICES["brave"][2] + SERVICES["serper"][2]
                   + (SERVICES["deepseek"][2] if args.with_llm else Decimal("0"))) * FEE_HEADROOM
        if planned > Decimal("0.25"):
            parser.error("Planning reserve exceeds 25-cent delegation cap")
        cap_cents = 10 if args.smoke_service else 25
        delegation = create_10min_delegation(key, cap_cents)
        private_state = HERE / "out" / f"private-{stable_id(args.run_id, 'run-state')}.json"
        private_json(private_state, {"run_id_hash": stable_id(args.run_id, "run-state"),
                                     "delegation_id": delegation,
                                     "delegation_cap_cents": cap_cents})
        print(f"Created capped delegation: {cap_cents} cents, 600 seconds, at most 3 selected calls", file=sys.stderr)
        spend = Decimal("0")
        pending_fees = []
        first_delivered_at = None
        time_to_first_delivered_seconds = None
        if args.smoke_service:
            name = args.smoke_service
            payload = (
                {"q": query, "count": 5}
                if name == "brave" else
                {"url": company_url} if name == "serper" else
                {"model": "deepseek-v4-flash", "messages": [
                    {"role": "user", "content": "Reply with one short sentence."}
                ], "max_tokens": 128, "stream": False}
            )
            smoke_body, smoke_payment = paid_post(key, delegation, args.run_id, name, payload)
            smoke_charge, smoke_fee, smoke_pending = receipt_usd(key, delegation, smoke_payment)
            if smoke_charge > Decimal(cap_cents) / Decimal("100"):
                raise RuntimeError("Smoke charge exceeded delegation cap; stop")
            remaining = remaining_cents(key, delegation, cap_cents)
            print(json.dumps({
                "service": name,
                "payment_id": smoke_payment,
                "recorded_spend_usd": str(smoke_charge),
                "fee_status": smoke_fee,
                "buyer_fee_terminal": not smoke_pending,
                "delegation_remaining_cents": remaining,
                "response_shape": shape(smoke_body),
                "contract_confirmed": False,
                "note": "Inspect redacted body locally before confirming wrapper-contract.json",
            }, indent=2))
            return 0
        search, payment = paid_post(key, delegation, args.run_id, "brave", {
            "q": query, "count": 5,
        })
        charge, fee_status, fee_pending = receipt_usd(key, delegation, payment)
        spend += charge
        if fee_pending:
            pending_fees.append({"service": "brave", "payment_id": payment, "fee_status": fee_status})
        if spend > Decimal("0.25"):
            raise RuntimeError("Recorded spend exceeds local 25-cent cap; stop")
        remaining = remaining_cents(key, delegation, 25)
        sources = search_sources(search, fixture=False)
        first_delivered_at = datetime.now(timezone.utc).isoformat()
        time_to_first_delivered_seconds = round(time.monotonic() - command_started, 2)
        private_json(private_state, {
            "run_id_hash": stable_id(args.run_id, "run-state"),
            "delegation_id": delegation,
            "delegation_cap_cents": cap_cents,
            "first_delivered_at_utc": first_delivered_at,
            "time_to_first_delivered_seconds": time_to_first_delivered_seconds,
            "first_service": "brave",
            "first_payment_id": payment,
            "recorded_charge_after_first_usd": str(spend),
        })
        if Decimal(remaining) / Decimal("100") < SERVICES["serper"][2] * FEE_HEADROOM:
            raise RuntimeError("Insufficient local budget reserve for Serper")
        scrape, payment = paid_post(key, delegation, args.run_id, "serper", {"url": company_url})
        charge, fee_status, fee_pending = receipt_usd(key, delegation, payment)
        spend += charge
        if fee_pending:
            pending_fees.append({"service": "serper", "payment_id": payment, "fee_status": fee_status})
        if spend > Decimal("0.25"):
            raise RuntimeError("Recorded spend exceeds local 25-cent cap; stop")
        remaining = remaining_cents(key, delegation, 25)
        excerpt = scrape_excerpt(scrape)
        note = None
        if args.with_llm:
            if Decimal(remaining) / Decimal("100") < SERVICES["deepseek"][2] * FEE_HEADROOM:
                raise RuntimeError("Insufficient local budget reserve for DeepSeek")
            prompt = (
                "Write two short sentences: a tentative positioning contrast and one "
                "question to verify. Use only these excerpts; do not add facts.\n"
                f"Company ({company_url}): {excerpt[:350].replace(chr(10), ' ')}\n"
                f"Rival ({sources[0]['url']}): {sources[0]['excerpt'][:250]}"
            )
            completion, payment = paid_post(key, delegation, args.run_id, "deepseek", {
                "model": "deepseek-v4-flash",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 1024,
                "stream": False,
            })
            charge, fee_status, fee_pending = receipt_usd(key, delegation, payment)
            spend += charge
            if fee_pending:
                pending_fees.append({"service": "deepseek", "payment_id": payment, "fee_status": fee_status})
            if spend > Decimal("0.25"):
                raise RuntimeError("Recorded spend exceeds local 25-cent cap; stop")
            remaining_cents(key, delegation, 25)
            data = completion.get("data") or {}
            choices = data.get("choices")
            if not isinstance(choices, list) or not choices or not isinstance(choices[0], dict):
                raise RuntimeError("DeepSeek wrapper did not deliver choices")
            value = (choices[0].get("message") or {}).get("content")
            finish_reason = choices[0].get("finish_reason")
            usage = data.get("usage")
            if not isinstance(value, str) or not value.strip():
                raise RuntimeError(
                    f"DeepSeek paid response had no model content; finish_reason={finish_reason!r}, "
                    f"usage={usage!r}. Inspect ignored private Router envelope. "
                    "Do not retry with a new request ID; shorten the prompt or adjust "
                    "max_tokens in a new, separately capped run."
                )
            note = redact(value)[:1000]
    public_pending_fees = [
        {"service": item["service"], "fee_status": item["fee_status"]}
        for item in pending_fees
    ]
    artifact, markdown = assemble(company_url, query, sources, excerpt, note,
                                  fixture=not args.live, spend=spend,
                                  pending_fees=public_pending_fees,
                                  first_delivered_at=first_delivered_at,
                                  time_to_first_delivered_seconds=time_to_first_delivered_seconds)
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "teardown.json").write_text(json.dumps(artifact, indent=2) + "\n")
    (args.out / "teardown.md").write_text(markdown)
    print(f"Wrote {args.out / 'teardown.json'} and {args.out / 'teardown.md'}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RuntimeError, ValueError, HTTPError, URLError) as exc:
        print(f"Stopped: {exc}", file=sys.stderr)
        raise SystemExit(1)
