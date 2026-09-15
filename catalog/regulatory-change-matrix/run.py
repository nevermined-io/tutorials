#!/usr/bin/env python3
"""Reproducible GovLaws outcome. Dry-run is the default; --live spends real funds."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from decimal import Decimal
from pathlib import Path
from typing import Any, TypedDict
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

HERE = Path(__file__).resolve().parent
CATALOG = os.getenv("NVM_API_BASE", "https://api.live.nevermined.app").rstrip("/")
SPEC = "https://govlaws.ai/openapi.json"
SLUG = "govlaws-mpp"
# Current official MPP prices, checked against https://govlaws.ai/mpp on 2026-09-15.
# They are planning ceilings, NOT an authoritative in-band quote.
PLANNED_CHANGES = Decimal("0.06")
PLANNED_RESOLVE = Decimal("0.05")
FEE_HEADROOM = Decimal("1.20")
MAX_BUDGET = Decimal("0.25")


class Change(TypedDict, total=False):
    citation: str | None
    title: str
    change_type: str
    effective_date: str | None
    detected_at: str
    agency: str | None
    url: str | None
    summary: str | None
    provenance: dict[str, Any]


class Resolution(TypedDict, total=False):
    citation: str
    title: str
    text: str
    source: dict[str, Any]
    freshness: dict[str, Any]
    provenance: dict[str, Any]


def request_json(url: str, *, key: str | None = None) -> Any:
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
    if not key or (config.get("apiBase") or config.get("API_BASE") or CATALOG).rstrip("/") != CATALOG:
        raise ValueError("Private buyer file must contain a key for the selected Live API host")
    return key


def create_delegation(key: str, cap_cents: int, max_transactions: int) -> str:
    body = {"provider": "erc4337", "currency": "usdc", "spendingLimitCents": cap_cents,
            "durationSecs": 600, "maxTransactions": max_transactions}
    req = Request(f"{CATALOG}/api/v1/delegation/create",
                  data=json.dumps(body).encode(), method="POST",
                  headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    with urlopen(req, timeout=30) as response:
        record = json.load(response)
    delegation = record.get("delegationId") or record.get("id")
    if not isinstance(delegation, str) or not delegation:
        raise RuntimeError("Delegation creation returned no identifier")
    return delegation


def check_contract(days: int, citation: str | None) -> str:
    spec = request_json(SPEC)
    version = spec["info"]["x-api-version"]
    paths = spec["paths"]
    for path, verb in (("/api/mpp/changes", "get"), ("/api/mpp/resolve", "get")):
        if verb not in paths[path]:
            raise ValueError(f"GovLaws OpenAPI no longer has {verb.upper()} {path}")
    for path, expected in (
        ("/api/mpp/changes", {"changes", "period", "total"}),
        ("/api/mpp/resolve", {"citation", "title", "text", "provenance"}),
    ):
        schema = paths[path]["get"]["responses"]["200"]["content"]["application/json"]["schema"]
        if not expected.issubset(set(schema["required"])):
            raise ValueError(f"GovLaws response contract changed for {path}")
    properties = spec["components"]["schemas"]["ChangesQueryInput"]["properties"]
    bounds = properties["days"]
    if not (bounds["minimum"] <= days <= bounds["maximum"]):
        raise ValueError(f"--days must be {bounds['minimum']}..{bounds['maximum']}")
    required = spec["components"]["schemas"]["ResolveCitationInput"]["required"]
    if citation is not None and ("citation" not in required or not citation.strip()):
        raise ValueError("ResolveCitationInput requires a nonempty citation")
    return version


def check_listing() -> dict[str, Any]:
    if CATALOG not in ("https://api.live.nevermined.app", "https://api.live.nevermined.dev"):
        raise ValueError("NVM_API_BASE must be a supported live Nevermined API host")
    service = request_json(f"{CATALOG}/api/v1/catalog/services/{SLUG}")
    if service.get("slug") != SLUG or service.get("protocol") != "mpp":
        raise ValueError("GovLaws listing changed; stop before payment")
    if service.get("healthStatus") != "operational":
        raise ValueError(f"GovLaws health is {service.get('healthStatus')}; stop before payment")
    paths = {(e["method"], e["path"]) for e in service.get("endpoints", [])}
    for endpoint in (("GET", "/api/mpp/changes"), ("GET", "/api/mpp/resolve")):
        if endpoint not in paths:
            raise ValueError(f"Catalog no longer advertises {endpoint}")
    return service


def stable_id(run_id: str, operation: str) -> str:
    digest = hashlib.sha256(f"{run_id}:{operation}".encode()).hexdigest()[:32]
    return f"regulatory-matrix-{digest}"


def paid_get(path: str, query: dict[str, str], *, key: str, delegation: str,
             request_id: str) -> tuple[dict[str, Any], str]:
    url = f"{CATALOG}/api/v1/router/svc/{SLUG}/{path.lstrip('/')}?{urlencode(query)}"
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {key}",
        "X-Router-Delegation-Id": delegation,
        "X-Router-Request-Id": request_id,
    }
    try:
        with urlopen(Request(url, headers=headers, method="GET"), timeout=60) as response:
            payment_id = response.headers.get("X-Router-Payment-Id")
            if not payment_id:
                raise RuntimeError("Router returned no payment ID; inspect ledger before proceeding")
            payment_status = response.headers.get("X-Router-Payment-Status")
            if payment_status not in ("Settled", "Issued"):
                raise RuntimeError(f"Router payment status {payment_status!r} is not a successful payment state; inspect ledger")
            body = json.load(response)
            if not isinstance(body, dict):
                raise ValueError("GovLaws response was not a JSON object")
            return body, payment_id
    except HTTPError as exc:
        detail = exc.read(1000).decode("utf-8", errors="replace")
        if exc.code == 409:
            raise RuntimeError(f"Idempotent request already paid ({request_id}); inspect ledger, do not reissue: {detail}") from exc
        raise RuntimeError(f"Router HTTP {exc.code} for {request_id}; inspect ledger before retry: {detail}") from exc
    except (URLError, TimeoutError) as exc:
        raise RuntimeError(f"Network state indeterminate for {request_id}; inspect ledger before retry") from exc


def ledger_charge(key: str, delegation: str, payment_id: str) -> tuple[Decimal, str | None]:
    query = urlencode({"delegationId": delegation})
    record = None
    for attempt in range(4):
        records = request_json(f"{CATALOG}/api/v1/router/payments?{query}", key=key)
        record = next((r for r in records if r.get("id") == payment_id), None)
        if record and record.get("feeStatus") not in (None, "Accrued", "Submitted"):
            break
        if attempt < 3:
            time.sleep(2)
    if record is None:
        raise RuntimeError(f"Payment {payment_id} missing from Router ledger; stop")
    decimals = record.get("assetDecimals")
    if decimals is None:
        raise RuntimeError(f"Payment {payment_id} has unknown asset scale; stop")
    if record.get("status") != "Settled":
        raise RuntimeError(f"Payment {payment_id} ledger status is {record.get('status')}; stop before claiming verified result")
    fee_status = record.get("feeStatus")
    if fee_status is None or fee_status not in ("None", "Settled", "Released", "Accrued", "Submitted"):
        raise RuntimeError(f"Payment {payment_id} fee status is {fee_status}; stop before claiming verified spend")
    merchant = Decimal(str(record["amount"])) / (Decimal(10) ** int(decimals))
    fee = Decimal("0") if fee_status == "Released" else Decimal(str(record.get("feeCents") or "0")) / Decimal("100")
    if fee_status == "None" and fee != 0:
        raise RuntimeError(f"Payment {payment_id} has fee cents but fee status None; stop")
    if merchant <= 0:
        raise RuntimeError(f"Payment {payment_id} has no recorded amount; stop")
    if record.get("assetSymbol") not in ("pathUSD", "PathUSD", "USDC", "USDC.e"):
        raise RuntimeError(f"Payment {payment_id} asset {record.get('assetSymbol')} is not USD-like; stop")
    return merchant + fee, fee_status if fee_status in ("Accrued", "Submitted") else None


def text(value: Any) -> str:
    return str(value if value is not None else "unknown").replace("|", "\\|").replace("\n", " ")


def assemble(changes: list[Change], resolutions: dict[str, Resolution],
             *, synthetic: bool, contract_version: str, spend: Decimal | None,
             pending_fees: list[dict[str, str]] | None = None) -> tuple[dict[str, Any], str]:
    rows: list[dict[str, Any]] = []
    for change in changes:
        citation = change.get("citation") or ""
        resolved = resolutions.get(citation) or {}
        prov = change.get("provenance") or {}
        source = resolved.get("source") or {}
        trust = (resolved.get("provenance") or {}).get("trust") or {}
        rows.append({
            "citation": citation,
            "title": change.get("title"),
            "change_type": change.get("change_type"),
            "agency": change.get("agency"),
            "effective_date": change.get("effective_date"),
            "detected_at": change.get("detected_at"),
            "notice_url": change.get("url"),
            "current_text_url": source.get("url"),
            "current_text_as_of": (resolved.get("freshness") or {}).get("up_to_date_as_of"),
            "source_system": (resolved.get("provenance") or prov).get("source_system"),
            "citation_suitability": trust.get("citation_suitability", []),
            "summary": change.get("summary"),
            "review_action": "Review cited source and applicability with a qualified owner",
            "resolved": bool(resolved),
        })
    artifact = {
        "synthetic": synthetic,
        "verified_paid_run": not synthetic,
        "govlaws_contract_version": contract_version,
        "actual_spend_usd": str(spend) if spend is not None else None,
        "buyer_fee_reconciliation_pending": pending_fees or [],
        "items": rows,
    }
    label = "SYNTHETIC FORMAT DEMO" if synthetic else "PAID RUN — VERIFY SOURCES"
    lines = [
        f"# Regulatory change impact matrix — {label}",
        "",
        f"GovLaws contract: {contract_version}. Router spend: "
        + (f"${spend} observed" if spend is not None else "not observed"),
        "",
        "| Citation | Change | Effective | Source notice | Current text | Review action |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for row in rows:
        lines.append("| " + " | ".join(text(row[k]) for k in (
            "citation", "change_type", "effective_date", "notice_url",
            "current_text_url", "review_action")) + " |")
    lines += [
        "",
        "This is a source-backed research artifact, not a legal determination.",
        "Check provenance, freshness, and citation suitability before relying on any row.",
    ]
    return artifact, "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true", help="Make paid Router calls")
    parser.add_argument("--run-id", help="Unique stable ID for this live run")
    parser.add_argument("--agency", default="CFPB")
    parser.add_argument("--citation", default="12 CFR 1026")
    parser.add_argument("--days", type=int, default=30)
    parser.add_argument("--max-resolves", type=int, default=2)
    parser.add_argument("--budget-usd", type=Decimal, default=Decimal("0.25"))
    parser.add_argument("--output", type=Path, default=HERE / "output")
    args = parser.parse_args()
    if args.max_resolves < 0 or not (Decimal("0") < args.budget_usd <= MAX_BUDGET) or args.budget_usd * 100 != int(args.budget_usd * 100):
        parser.error("max-resolves must be nonnegative and budget-usd must be a positive whole-cent cap of at most $0.25")
    if not args.live:
        sample = json.loads((HERE / "fixtures" / "synthetic.json").read_text())
        version = "2026-04-27 (fixture; no live contract check)"
        artifact, markdown = assemble(sample["changes"]["changes"], sample["resolutions"],
                                      synthetic=True, contract_version=version, spend=None)
    else:
        if not args.run_id:
            parser.error("--live requires --run-id")
        key = private_buyer_key()
        version = check_contract(args.days, args.citation)
        listing = check_listing()
        planned = (PLANNED_CHANGES + PLANNED_RESOLVE * args.max_resolves) * FEE_HEADROOM
        if planned > args.budget_usd:
            parser.error(f"planned ceiling ${planned} exceeds local budget ${args.budget_usd}")
        delegation = create_delegation(key, int(args.budget_usd * 100), 1 + args.max_resolves)
        args.output.mkdir(parents=True, exist_ok=True)
        args.output.chmod(0o700)
        private_id = args.output / "private-delegation.json"
        private_id.write_text(json.dumps({"delegationId": delegation}) + "\n")
        private_id.chmod(0o600)
        print(f"Catalog {listing['slug']} {listing['healthStatus']}; OpenAPI {version}. "
              f"Planned ceiling ${planned}; Router may quote differently in-band.", file=sys.stderr)
        spend = Decimal("0")
        pending_fees: list[dict[str, str]] = []
        changes, payment_id = paid_get(
            "/api/mpp/changes",
            {"agency": args.agency, "citation": args.citation, "days": str(args.days)},
            key=key, delegation=delegation,
            request_id=stable_id(args.run_id, "changes"),
        )
        charge, pending = ledger_charge(key, delegation, payment_id)
        spend += charge
        if pending:
            pending_fees.append({"service": "changes", "fee_status": pending})
        if spend > args.budget_usd:
            raise RuntimeError("Observed spend exceeded local budget; stop")
        events = changes.get("changes")
        if not isinstance(events, list):
            raise ValueError("GovLaws changes response has no changes array")
        citations = list(dict.fromkeys(
            e["citation"] for e in events if isinstance(e, dict) and e.get("citation")
        ))[:args.max_resolves]
        resolutions: dict[str, Resolution] = {}
        for citation in citations:
            if spend + PLANNED_RESOLVE * FEE_HEADROOM > args.budget_usd:
                print(f"Skipping resolve {citation}: local budget guard", file=sys.stderr)
                break
            result, payment_id = paid_get(
                "/api/mpp/resolve", {"citation": citation},
                key=key, delegation=delegation,
                request_id=stable_id(args.run_id, f"resolve:{citation}"),
            )
            charge, pending = ledger_charge(key, delegation, payment_id)
            spend += charge
            if pending:
                pending_fees.append({"service": "resolve", "fee_status": pending})
            if spend > args.budget_usd:
                raise RuntimeError("Observed spend exceeded local budget; stop")
            if not {"citation", "title", "text", "provenance"}.issubset(result):
                raise ValueError(f"GovLaws resolve response missing OpenAPI-required fields for {citation}")
            resolutions[citation] = result
        artifact, markdown = assemble(events, resolutions, synthetic=False,
                                      contract_version=version, spend=spend,
                                      pending_fees=pending_fees)
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "matrix.json").write_text(json.dumps(artifact, indent=2) + "\n")
    (args.output / "matrix.md").write_text(markdown)
    print(f"Wrote {args.output / 'matrix.json'} and {args.output / 'matrix.md'}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, RuntimeError, HTTPError, URLError) as exc:
        print(f"Stopped: {exc}", file=sys.stderr)
        raise SystemExit(1)
