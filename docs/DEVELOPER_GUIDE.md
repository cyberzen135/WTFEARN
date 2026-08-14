# LicenceCheck — Developer & Coder Agent Technical Guide

> **Purpose**: This guide provides exhaustive technical specifications, API contracts, database schemas, extension protocols, and debugging workflows for senior developers and autonomous AI coding agents working on LicenceCheck.

---

## 1. High-Level Architecture & Component Map

LicenceCheck consists of three decoupled sub-projects inside a monorepo structure:

```
                          ┌──────────────────────────────────────────────┐
                          │  Municipal Open Data Portals (Socrata APIs)  │
                          │  Chicago, NYC, San Francisco, Los Angeles    │
                          └──────────────────────┬───────────────────────┘
                                                 │ Daily Scheduled Cron (07:00 UTC)
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ Cloudflare Worker API & Ingestion Engine (worker/)                                           │
│                                                                                             │
│   types.ts        ── Shared TypeScript interfaces & API contracts                           │
│   portals.ts      ── Seed configurations for municipal portals                          │
│   normalise.ts    ── Name diacritic/suffix stripping & house-number/street normalization    │
│   status.ts       ── Expiry, revocation, end-date, and delta status derivation             │
│   llm.ts          ── Gemini API prompt integration for 0.72–0.88 candidate adjudication    │
│   resolve.ts      ── Blocking, Dice street similarity, Jaro-Winkler name scoring & cache   │
│   ingest.ts       ── Socrata SoDA API pagination ($limit=50000), diffing, & R2 snapshots     │
│   api.ts          ── HTTP router (/v1/verify, /v1/business/:slug, /v1/coverage, /rollup)    │
│   index.ts        ── Worker entrypoint (cron & fetch event dispatchers)                     │
│                                                                                             │
│   migrations/0001_init.sql ── D1 SQLite Schema (portal, licence, status_event, etc.)       │
└───────────────────────────────┬──────────────────────────────────────────────┬──────────────┘
                                │ REST API (/v1/verify)                        │ Static Export
                                ▼                                              ▼
┌─────────────────────────────────────────────────────────────┐  ┌──────────────────────────┐
│ Apify Store Actor (actor/)                                  │  │ pSEO Site (site/)        │
│   main.js     ── Dataset chaining, 200-row batching, retries│  │   build.mjs ── HTML exporter│
│   README.md   ── Marketplace SEO & conversion engine        │  │   build.yml ── CI Pages deploy
└─────────────────────────────────────────────────────────────┘  └──────────────────────────┘
```

---

## 2. Onboarding a New Municipal Portal

To add a 5th city (e.g. Miami, Boston, Philadelphia, Delaware):

### Step 1: Discover Socrata Resource ID
Run a keyless search against the Socrata Catalog API:
```bash
curl -s "http://api.us.socrata.com/api/catalog/v1?q=business%20licenses&limit=5&only=dataset"
```

### Step 2: Enumerate Raw Status Codes & Categories
Run SoQL aggregation queries directly against the portal endpoint:
```bash
# Enumerate distinct status codes
curl -s "https://{domain}/resource/{resource_id}.json?\$select=license_status,count(1)&\$group=license_status"

# Enumerate top categories
curl -s "https://{domain}/resource/{resource_id}.json?\$select=license_description,count(1)&\$group=license_description&\$order=count_1%20DESC&\$limit=50"
```

### Step 3: Register in `worker/src/portals.ts`
Add a new `PortalRow` entry:
```ts
{
  portal_id: 'miami',
  domain: 'data.miamigov.com',
  resource_id: 'xxxx-yyyy',
  jurisdiction: 'Miami, FL',
  field_map: JSON.stringify({
    source_pk: 'lic_id',
    licence_number: 'lic_num',
    legal_name: 'legal_name',
    dba_name: 'dba_name',
    address: 'address',
    city: 'city',
    state: 'state',
    zip5: 'zip',
    category_raw: 'business_type',
    status_raw: 'status',
    issued_date: 'issue_date',
    start_date: 'start_date',
    expiry_date: 'expiration_date',
    end_date: null
  }),
  closure_method: 'status', // 'status' | 'end_date' | 'delta'
  status_map: JSON.stringify({ 'ACTIVE': 'ACTIVE', 'EXPIRED': 'LAPSED', 'REVOKED': 'REVOKED' }),
  licensed_categories: JSON.stringify(['Restaurant', 'Retail', 'Bar']),
  stale: 0
}
```

---

## 3. Resolution Scoring Math & Thresholding

The entity resolution engine in `worker/src/resolve.ts` executes a 5-stage algorithm:

$$\text{Query Hash} = \text{SHA256}(\text{name\_norm} \mid \text{house\_number} \mid \text{street\_norm} \mid \text{zip5})$$

1. **Stage 1 (Cache Check)**: Checks D1 `match_cache` for `query_hash`. On hit, returns `method: "cached"`.
2. **Stage 2 (Coverage Check)**: Verifies input `city`/`zip` falls within an ingested portal. Unhandled cities return `status: "NO_COVERAGE"`, `billable: false`.
3. **Stage 3 (Blocking)**: Queries D1 `licence` table where `(zip5 = input.zip5 AND house_number = input.house_number)` OR `(street_norm = input.street_norm AND house_number = input.house_number)`.
4. **Stage 4 (Similarity Calculation)**:
   - **House Number Gate**: `input.house_number === candidate.house_number` (Hard Requirement).
   - **Street Similarity**: Bigram Dice Coefficient $S_{\text{street}} = \frac{2 |B_{\text{input}} \cap B_{\text{cand}}|}{Ratio}$.
   - **Name Similarity**: $S_{\text{name}} = \max(\text{JaroWinkler}(N_{\text{in}}, N_{\text{cand}}), \text{TokenSetRatio}(N_{\text{in}}, N_{\text{cand}}))$.
   - **Composite Score**: $Score = 0.15 \cdot S_{\text{street}} + 0.85 \cdot S_{\text{name}}$.
5. **Stage 5 (Threshold Decision)**:
   - $Score \ge 0.88 \implies \mathbf{MATCH}$, `method: "deterministic"`.
   - $0.72 \le Score < 0.88 \implies$ Send candidate pair to Gemini LLM (`llm.ts`). If LLM returns $\text{same} = \text{true}$ and $\text{confidence} \ge 0.75$, match with `method: "llm_adjudicated"`. Else, return `status: "AMBIGUOUS"`, `billable: false`.
   - $Score < 0.72 \implies \mathbf{NO\ MATCH}$, return `status: "NOT_IN_LICENSED_CATEGORY"`, `billable: false`.

---

## 4. Operational Guardrails & Limits

| Constraint | Limit | Solution Implemented |
|---|---|---|
| **D1 Free Daily Write Cap** | ~100k rows/day | Ingest restricts categories via SoQL `$where` and limits backfill to records updated within last 36 months. |
| **Socrata API Rate Limit** | Keyless throttling | Ingest attaches `X-App-Token` header. |
| **Apify Actor Batch Limit** | 200 items / request | `main.js` slices input into 200-row chunks with exponential backoff retries. |
| **R2 Storage Cost** | 10 GB free allowance | Raw NDJSON snapshot files are saved per city per day; lifecycle rule prunes >180 days. |

---

## 5. Automated Testing & Verification Runbook

### Run Unit Tests
```bash
cd worker
cmd /c npm test
```

### Run Step 0 Diagnostic Kill Test
```bash
cmd /c npm run kill-test
```

### Test Static SEO Generator
```bash
cd site
node build.mjs
```

### Commit & Push to GitHub
```bash
git add .
git commit -m "feat: updates and documentation enhancement"
git push origin main
```
