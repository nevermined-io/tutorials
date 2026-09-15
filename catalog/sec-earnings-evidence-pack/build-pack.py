#!/usr/bin/env python3
"""Offline pack builder. Reads paid Router envelopes; never invents missing evidence."""

import json
import os
from datetime import date
from decimal import Decimal
from pathlib import Path

OUT = Path(__file__).resolve().parent / "out"
CIK = os.environ.get("CIK", "320193")
SYMBOL = os.environ.get("SYMBOL", "AAPL")
COMPANY = os.environ.get("COMPANY", "Apple")
SOURCES = {
    "submissions": ("edgar-sec-mpp", "/edgar/company-submissions"),
    "facts": ("edgar-sec-mpp", "/edgar/company-facts"),
    "search": ("edgar-search", ""),
    "earnings": ("alpha-vantage-mpp", "/alphavantage/earnings"),
    "income": ("alpha-vantage-mpp", "/alphavantage/income-statement"),
}


def cost_summary():
    try:
        payments = json.loads((OUT / "payments.json").read_text())
        budget = json.loads((OUT / "budget-summary.json").read_text())
        timing = json.loads((OUT / "run-summary.json").read_text())
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"Payment, budget or timing record is unreadable: {exc}") from exc
    if not isinstance(payments, list) or not all(p.get("status") == "Settled" for p in payments):
        raise SystemExit("Payment ledger is incomplete or has non-settled rows")
    merchant_total = Decimal("0")
    buyer_fees = Decimal("0")
    for payment in payments:
        if payment.get("assetSymbol") not in ("USDC", "USDC.e") or payment.get("assetDecimals") is None:
            raise SystemExit("Cannot safely display payment amount in USD")
        merchant_total += Decimal(str(payment["amount"])) / (Decimal(10) ** int(payment["assetDecimals"]))
        buyer_fees += Decimal(str(payment.get("feeCents") or "0")) / Decimal("100")
    return {"observedMerchantUsd": str(merchant_total),
            "observedBuyerFeesUsd": str(buyer_fees),
            "budgetConsumedCents": budget.get("budgetSpentCents"),
            "timeToFirstSuccessSeconds": timing.get("timeToFirstSuccessSeconds"),
            "paymentCount": len(payments),
            "note": "Sub-cent purchases may each consume a whole cent of delegation cap."}


def load(name):
    path = OUT / f"{name}.router.json"
    try:
        envelope = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"Missing or invalid paid response {path}: {exc}") from exc
    if not isinstance(envelope, dict) or envelope.get("paid") is not True or envelope.get("body") is None:
        raise SystemExit(f"{path} has no delivered paid body")
    return envelope


def body_of(envelope):
    """Router .body is verified by broker docs; nested merchant wrappers remain unverified."""
    body = envelope["body"]
    # Some provider wrappers may nest their upstream payload in data. Prefer recognizable
    # upstream keys instead of blindly unwrapping an object named data.
    if isinstance(body, dict) and isinstance(body.get("data"), dict):
        data = body["data"]
        if any(k in data for k in ("facts", "filings", "quarterlyEarnings", "quarterlyReports", "hits")):
            return data, "body.data (detected)"
    return body, "body (direct upstream detected)"


def safe(value):
    if isinstance(value, (str, int, float)):
        return str(value).replace("\n", " ").replace("\r", " ")[:160]
    return None


def recent_filing(doc):
    recent = doc.get("filings", {}).get("recent", {}) if isinstance(doc, dict) else {}
    if not isinstance(recent, dict):
        return None
    forms, dates, accessions = (recent.get(k, []) for k in ("form", "filingDate", "accessionNumber"))
    if not all(isinstance(x, list) for x in (forms, dates, accessions)):
        return None
    for i, form in enumerate(forms):
        if form in ("10-K", "10-Q") and i < len(dates) and i < len(accessions):
            return {"form": form, "filingDate": dates[i], "accessionNumber": accessions[i]}
    return None


def xbrl_fact(doc, tags):
    gaap = doc.get("facts", {}).get("us-gaap", {}) if isinstance(doc, dict) else {}
    for tag in tags:
        concept = gaap.get(tag, {}) if isinstance(gaap, dict) else {}
        units = concept.get("units", {}) if isinstance(concept, dict) else {}
        usd = units.get("USD", []) if isinstance(units, dict) else []
        candidates = [v for v in usd if isinstance(v, dict) and v.get("form") in ("10-K", "10-Q")
                      and isinstance(v.get("val"), (int, float))]
        if candidates:
            def quarter(v):
                try:
                    days = (date.fromisoformat(v["end"]) - date.fromisoformat(v["start"])).days
                    return 70 <= days <= 115
                except (KeyError, TypeError, ValueError):
                    return False
            item = max(candidates, key=lambda v: (
                str(v.get("filed", "")), str(v.get("end", "")), quarter(v)))
            return {"tag": tag, "value": item["val"], "unit": "USD", "start": item.get("start"),
                    "end": item.get("end"), "filed": item.get("filed"), "form": item.get("form"),
                    "fiscalPeriod": item.get("fp"), "fiscalYear": item.get("fy"),
                    "accession": item.get("accn")}
    return None


envelopes = {name: load(name) for name in SOURCES}
docs = {}
mapping = {}
for name, envelope in envelopes.items():
    docs[name], mapping[name] = body_of(envelope)
    required = {"submissions": "filings", "facts": "facts", "search": "hits",
                "earnings": "quarterlyEarnings", "income": "quarterlyReports"}[name]
    if not isinstance(docs[name], dict) or required not in docs[name]:
        raise SystemExit(f"{name} paid response lacks expected {required} field")

routes = {}
for name, (slug, expected_path) in SOURCES.items():
    try:
        sent = json.loads((OUT / f"{name}.request.json").read_text())
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"Missing or invalid saved {name} request: {exc}") from exc
    if sent.get("slug") != slug or sent.get("path", "") != expected_path:
        raise SystemExit(f"Saved {name} route differs from verified runner route")
    routes[name] = {"slug": sent["slug"], "path": sent.get("path", "")}

submission = docs["submissions"] if isinstance(docs["submissions"], dict) else {}
facts = docs["facts"] if isinstance(docs["facts"], dict) else {}
search = docs["search"] if isinstance(docs["search"], dict) else {}
earnings = docs["earnings"] if isinstance(docs["earnings"], dict) else {}
income = docs["income"] if isinstance(docs["income"], dict) else {}

filing = recent_filing(submission)
revenue = xbrl_fact(facts, ("RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet"))
net_income = xbrl_fact(facts, ("NetIncomeLoss",))
search_data = search.get("data") if isinstance(search, dict) else None
hits = search.get("hits") or (search_data.get("hits") if isinstance(search_data, dict) else None)
if isinstance(hits, dict):
    total = hits.get("total")
    search_count = total.get("value") if isinstance(total, dict) else total
    search_relation = total.get("relation") if isinstance(total, dict) else None
else:
    search_count = None
    search_relation = None
quarterly = earnings.get("quarterlyEarnings", []) if isinstance(earnings, dict) else []
quarterly = [x for x in quarterly if isinstance(x, dict)] if isinstance(quarterly, list) else []
quarterly.sort(key=lambda x: str(x.get("fiscalDateEnding", "")), reverse=True)
eps = quarterly[0] if quarterly else None
reports = income.get("quarterlyReports", []) if isinstance(income, dict) else []
reports = [x for x in reports if isinstance(x, dict)] if isinstance(reports, list) else []
reports.sort(key=lambda x: str(x.get("fiscalDateEnding", "")), reverse=True)
income_report = reports[0] if reports else None
if not any((filing, revenue, net_income, search_count, eps, income_report)):
    raise SystemExit("All paid responses lack usable evidence; refusing an empty pack")

pack = {
    "target": {"companyKeyword": COMPANY, "symbol": SYMBOL, "cik": CIK},
    "cost": cost_summary(),
    "publicSourceUrls": {
        "secSubmissions": f"https://data.sec.gov/submissions/CIK{int(CIK):010d}.json",
        "secCompanyFacts": f"https://data.sec.gov/api/xbrl/companyfacts/CIK{int(CIK):010d}.json",
        "catalogEdgarSearch": "https://nevermined.app/catalog/edgar-search",
        "catalogAlphaVantage": "https://nevermined.app/catalog/alpha-vantage-mpp",
    },
    "sources": {name: {"slug": routes[name]["slug"], "path": routes[name]["path"], "responseFile": f"{name}.router.json",
                        "bodyMapping": mapping[name], "paymentStatus": envelopes[name].get("payment", {}).get("status")}
                for name, (slug, path) in SOURCES.items()},
    "evidence": {
        "latest10KOr10Q": filing,
        "revenueXbrl": revenue,
        "netIncomeXbrl": net_income,
        "edgarSearchHitCount": search_count,
        "edgarSearchHitRelation": search_relation,
        "latestQuarterlyEps": {k: eps.get(k) for k in ("fiscalDateEnding", "reportedEPS", "estimatedEPS", "surprisePercentage")} if eps else None,
        "latestQuarterlyIncome": {k: income_report.get(k) for k in ("fiscalDateEnding", "totalRevenue", "netIncome")} if income_report else None,
    },
    "limitations": [
        "The body mapping was detected in saved paid responses; other runs may use different wrappers.",
        "A full-text EDGAR hit can be a third-party mention, not a company filing.",
        "EDGAR hit totals with relation gte are lower bounds, not exact totals.",
        "XBRL facts may refer to different periods or amendments; compare end and accession before interpreting them.",
        "Alpha Vantage fields are secondary data and may lag SEC filings.",
    ],
}
OUT.mkdir(exist_ok=True)
(OUT / "evidence.json").write_text(json.dumps(pack, indent=2) + "\n")

def row(label, value, source):
    return f"| {label} | {safe(value) or 'unavailable'} | `{source}.router.json` |"

lines = [f"# SEC earnings evidence pack: {SYMBOL}", "",
         f"Company keyword: {COMPANY}; CIK: {CIK}. Raw paid responses remain private in `out/`.", "",
         f"Observed merchant spend: {pack['cost']['observedMerchantUsd'] or 'unavailable'} USD; delegation cap consumed: {pack['cost']['budgetConsumedCents'] or 'unavailable'}¢.", "",
         f"Public sources: [SEC submissions]({pack['publicSourceUrls']['secSubmissions']}), [SEC company facts]({pack['publicSourceUrls']['secCompanyFacts']}), [EDGAR search service]({pack['publicSourceUrls']['catalogEdgarSearch']}), [Alpha Vantage service]({pack['publicSourceUrls']['catalogAlphaVantage']}).", "",
         "| Evidence | Value | Paid response |", "|---|---|---|",
         row("Latest 10-K/10-Q", f"{filing['form']} filed {filing['filingDate']} accession {filing['accessionNumber']}" if filing else None, "submissions"),
         row("Revenue XBRL", f"{revenue['value']} USD; period {revenue.get('start')} to {revenue.get('end')}; filed {revenue.get('filed')}" if revenue else None, "facts"),
         row("Net income XBRL", f"{net_income['value']} USD; period {net_income.get('start')} to {net_income.get('end')}; filed {net_income.get('filed')}" if net_income else None, "facts"),
         row("EDGAR keyword hits", f"at least {search_count}" if search_relation == "gte" else search_count, "search"),
         row("Quarterly reported EPS", f"{eps.get('reportedEPS')} for {eps.get('fiscalDateEnding')}" if eps else None, "earnings"),
         row("Quarterly total revenue", f"{income_report.get('totalRevenue')} for {income_report.get('fiscalDateEnding')}" if income_report else None, "income"),
         "", "## Mapping and limits", ""]
lines += [f"- `{name}`: {mapping[name]}." for name in SOURCES]
lines += [f"- {item}" for item in pack["limitations"]]
lines += ["", "This pack records source evidence; it is not an investment recommendation.", ""]
(OUT / "evidence.md").write_text("\n".join(lines))
print(f"Evidence pack saved in {OUT}")
