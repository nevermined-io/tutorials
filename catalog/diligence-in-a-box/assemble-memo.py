#!/usr/bin/env python3
"""Build a cautious, shareable memo from the saved Router responses; no network calls."""

import json
import os
import re
from pathlib import Path

OUT = Path(__file__).resolve().parent / "out"
DOMAIN = os.environ.get("DOMAIN", "perplexity.ai")
COMPANY_NAME = os.environ.get("COMPANY_NAME", "Perplexity")


def load(name):
    try:
        return json.loads((OUT / name).read_text())
    except (OSError, json.JSONDecodeError):
        return {}


def unwrap(value):
    if not isinstance(value, dict):
        return {}
    body = value.get("body", value)
    return body if isinstance(body, dict) else {}


def clean(value, limit=220):
    """Keep short public facts; remove contact details and control characters."""
    if not isinstance(value, (str, int, float)):
        return "unavailable"
    text = re.sub(r"[\r\n\t]+", " ", str(value))
    text = re.sub(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", "[email redacted]", text)
    text = re.sub(r"(?<!\w)(?:\+?\d[\d ().-]{8,}\d)(?!\w)", "[phone redacted]", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit] if text else "unavailable"


company = unwrap(load("company.json"))
founders = unwrap(load("founders.json"))
dossier = unwrap(load("founder-dossier.json"))
hiring = unwrap(load("hiring.json"))
news = unwrap(load("news.json"))
filings = unwrap(load("filings.json"))
web = unwrap(load("web.json"))

founder_list = founders.get("founders", []) if isinstance(founders, dict) else []
founder_names = [clean(f.get("fullName"), 80) for f in founder_list[:5] if isinstance(f, dict)]
jobs_data = hiring.get("data", []) if isinstance(hiring, dict) else []
news_items = news.get("included", []) if isinstance(news, dict) else []
news_titles = [clean(item.get("attributes", {}).get("title"), 120)
               for item in news_items[:5] if isinstance(item, dict)
               and item.get("type") == "news_article"
               and isinstance(item.get("attributes"), dict)]
filing_data = filings.get("data", {}) if isinstance(filings, dict) else {}
hits = filing_data.get("hits", {}) if isinstance(filing_data, dict) else {}
total = hits.get("total", {}) if isinstance(hits, dict) else {}
filing_count = total.get("value", "unavailable") if isinstance(total, dict) else total
web_text = web.get("text", "") if isinstance(web, dict) else ""

lines = [
    f"# Investment research memo: {clean(COMPANY_NAME, 80)}",
    "",
    f"Target website: {clean(DOMAIN, 100)}",
    "",
    "## Company and funding",
    f"- Catalog data identifies the company as **{clean(company.get('name') or company.get('legalName'), 120)}**.",
    f"- Reported total funding: {clean(company.get('totalFunding') or company.get('totalRaised'))}. Units and recency require verification with the source.",
    "",
    "## Founders",
    f"- Listed founders: {', '.join(founder_names) if founder_names else 'unavailable'}.",
    f"- Person-research result: {'received' if dossier.get('result') else 'pending or unavailable'}. Raw dossier and contact fields are excluded from this shareable memo.",
    "",
    "## Hiring and news momentum",
    f"- Job-opening records returned: {len(jobs_data) if isinstance(jobs_data, list) else 'unavailable'}.",
    f"- Recent article titles: {', '.join(news_titles) if news_titles else 'unavailable'}.",
    "",
    "## SEC filing search",
    f"- Full-text keyword hits: {clean(filing_count)}. A hit may mention the company without being its own filing; review individual filings before drawing a conclusion.",
    "",
    "## Website and product",
    f"- Scraped page text length: {len(web_text) if isinstance(web_text, str) else 'unavailable'} characters. Raw page text is excluded from this memo.",
    "",
    "## Limits",
    "This is an automated synthesis of third-party responses, not an investment recommendation. Missing responses remain marked unavailable. Verify figures, dates, and source attribution before using this memo for a decision.",
    "",
]

OUT.mkdir(exist_ok=True)
(OUT / "memo.md").write_text("\n".join(lines))
print(f"  saved redacted memo to {OUT / 'memo.md'}")
