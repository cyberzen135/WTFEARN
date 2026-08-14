# LicenceCheck — Architecture & System Design Specification

## 1. Overview & Moat Philosophy

LicenceCheck is designed around a single defensible asset: **elapsed time observation of status changes**.

While municipal portals (Socrata APIs) publish current state records, they regularly overwrite expired licences or purge non-active records (e.g. Los Angeles publishes active businesses with start dates but no end dates). By running a daily delta ingest cycle on Cloudflare Workers, LicenceCheck captures:

1. **`status_event` Archive**: A historical ledger of every observed status change (`from_status` -> `to_status` on `observed_on` date).
2. **`missing_streak` Deltas**: Detection of missing records across consecutive snapshots to identify closures in active-only datasets.
3. **`match_cache` Decision Cache**: Permanent hash storage of normalized query resolutions (including LLM adjudications).

---

## 2. Ingest Architecture & Data Flow

```
+-------------------------------------------------------------------------+
| Socrata Open Data APIs                                                  |
| - Chicago (r5kz-chrr) | NYC (w7w3-xahh) | SF (g8m3-pdis) | LA (6rrh-rzua) |
+-------------------------------------------------------------------------+
                                     |
                                     v Daily Cron (07:00 UTC)
+-------------------------------------------------------------------------+
| Cloudflare Worker: src/ingest.ts                                        |
| 1. Fetch paged SoDA JSON ($limit=50000) with X-App-Token                |
| 2. Apply field_map to normalize schema                                  |
| 3. Compute licence_uid (portal_id:source_pk)                            |
| 4. Compare status & write status_event diffs                            |
| 5. Increment missing_streak for absent rows in delta portals            |
| 6. Save raw NDJSON.gz snapshots to R2                                   |
+-------------------------------------------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
| Cloudflare D1 Database (SQLite engine)                                  |
| Tables: portal, licence, status_event, match_cache, city_month_rollup  |
+-------------------------------------------------------------------------+
```

---

## 3. Entity Resolution Pipeline

When a user submits records via `POST /v1/verify` or the Apify Actor:

1. **Normalized Key Generation**:
   - `name_norm` = Strip diacritics, uppercase, replace `&` with `AND`, remove branch noise (`#2`, `STORE 1`), remove legal suffixes (`INC`, `LLC`, `CORP`).
   - `house_number` = Extract leading digits/letter from address body.
   - `street_norm` = Normalize street types (`STREET` -> `ST`, `AVENUE` -> `AVE`) and directionals (`NORTH` -> `N`).
   - `query_hash` = `sha256(name_norm | house_number | street_norm | zip5)`.

2. **Resolution Stages**:
   - **Stage 1 (Cache Check)**: Look up `query_hash` in `match_cache`. Return `method: "cached"` on hit.
   - **Stage 2 (Coverage Check)**: Ensure `city`/`zip` falls within an ingested portal. Return `NO_COVERAGE` if unhandled.
   - **Stage 3 (House-Number & Zip/Street Blocking)**: Query D1 for candidate licences sharing `(zip5, house_number)` OR `(city, street_norm, house_number)`.
   - **Stage 4 (Similarity Scoring)**:
     - `addr_score` = `house_number` exact match required (hard gate).
     - `street_score` = Dice coefficient of street bigrams.
     - `name_score` = `max(JaroWinkler(name_in, name_cand), TokenSetRatio(name_in, name_cand))`.
     - `composite_score` = `0.15 * street_score + 0.85 * name_score`.
   - **Stage 5 (Thresholding & Adjudication)**:
     - `score >= 0.88`: Immediate match (`method: "deterministic"`).
     - `0.72 <= score < 0.88`: Send candidate pair to Gemini LLM for strict adjudication (`method: "llm_adjudicated"`).
     - `score < 0.72`: Return `NOT_IN_LICENSED_CATEGORY` or `AMBIGUOUS`.

---

## 4. Financial & Monetization Model

- **Model**: Pay Per Event (PPE) on Apify Store.
- **Unit Charge**: `$0.05` per `business-verified` event (`billable: true` only).
- **Non-Billable Statuses**: `NOT_IN_LICENSED_CATEGORY`, `NO_COVERAGE`, `AMBIGUOUS`, `TEMPORARILY_UNAVAILABLE`.
- **Apify Revenue Share**: 80% developer share, 20% Apify commission.
- **Gross Margin**: >99% before commission, >79% after commission.
