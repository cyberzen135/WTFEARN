# Business Licence Verifier — is this business still operating?

Paste a list of local businesses (or chain this Actor onto any Google Maps scraper) and get each one's official government licence status: **active, lapsed, revoked or closed** — with licence type, issue and expiry dates, the date the status changed, and a link to the government record.

**You are charged $0.05 only for records matched to an official licence. Unmatched records cost nothing.**

---

## What problem this solves

Scraped local-business lists contain businesses that no longer operate. You pay to scrape them, pay to enrich them, then pay again in wasted outreach (bounced mail, cold calls to disconnected lines, polluted CRMs). This checks them against official city licence registries before you spend anything else.

---

## Which cities are covered

- **Chicago, IL**: Official Department of Business Affairs and Consumer Protection registry.
- **New York City, NY**: Official DCA & DOB licence datasets.
- **San Francisco, CA**: Official Treasurer & Tax Collector business registration database.
- **Los Angeles, CA**: Official Office of Finance active register delta archive.

Live coverage and data freshness metrics:  
👉 [https://licencecheck.pages.dev/coverage/](https://licencecheck.pages.dev/coverage/)

---

## Output Contract

```json
{
  "id": "row-1",
  "input": { "name": "Joe's Pizza #2", "address": "123 N Main St Ste B", "city": "Chicago", "zip": "60601" },

  "status": "ACTIVE",              // ACTIVE | LAPSED | REVOKED | CLOSED
                                   // | NOT_IN_LICENSED_CATEGORY | NO_COVERAGE | AMBIGUOUS
  "billable": true,                // true only for ACTIVE | LAPSED | REVOKED | CLOSED
  "confidence": 0.94,
  "match_method": "deterministic", // deterministic | llm_adjudicated | cached

  "licence": {
    "jurisdiction": "Chicago, IL",
    "licence_number": "2701234",
    "legal_name": "JOES PIZZA INC",
    "dba_name": "JOE'S PIZZA",
    "category": "Retail Food Establishment",
    "status_raw": "AAI",
    "issued_date": "2021-04-02",
    "start_date": "2021-05-16",
    "expiry_date": "2027-05-15",
    "end_date": null,
    "address": "123 N MAIN ST",
    "source_url": "https://data.cityofchicago.org/resource/r5kz-chrr.json?license_number=2701234"
  },

  "history": [                     // THE ACCUMULATED STATUS TIMELINE
    { "observed_on": "2026-03-14", "from": "ACTIVE", "to": "LAPSED",  "evidence": "expiry_date passed" },
    { "observed_on": "2026-04-02", "from": "LAPSED", "to": "ACTIVE",  "evidence": "renewal observed" }
  ],

  "coverage": { "city_supported": true, "data_as_of": "2026-08-14", "stale": false },
  "reason": null
}
```

---

## Status meanings & Billing

| Status | Meaning | Billed |
|---|---|---|
| **ACTIVE** | Current active licence on file | **yes** ($0.05) |
| **LAPSED** | Licence expired and not renewed | **yes** ($0.05) |
| **REVOKED** | Licence revoked or cancelled by the city | **yes** ($0.05) |
| **CLOSED** | End date recorded, or absent from 3 consecutive registry snapshots | **yes** ($0.05) |
| **NOT_IN_LICENSED_CATEGORY** | This business type does not require a city licence here | **no** ($0.00) |
| **NO_COVERAGE** | City not yet ingested in registry database | **no** ($0.00) |
| **AMBIGUOUS** | More than one plausible record; we will not guess | **no** ($0.00) |
| **TEMPORARILY_UNAVAILABLE** | Upstream registry temporarily unreachable | **no** ($0.00) |

---

## How to chain onto a Google Maps scraper

1. Run any Google Maps scraper on Apify Store. Copy its **Dataset ID**.
2. Open **Business Licence Verifier**.
3. Paste the dataset ID into `datasetId`. Leave `fieldMap` at the default.
4. Click **Start**. The Actor will verify each business line-by-line and output clean operating status records.

---

## What this Actor does NOT do

It does not generate new leads, scrape personal emails, or make guesses. It verifies operating status against official government records for a list you already possess.
