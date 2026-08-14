# AGENTS.md — System Context & Master Project State for LicenceCheck

> **MISSION**: Earn **$100+/week net passive revenue** via the **LicenceCheck** operating-status verifier on Apify Store ($0.05/record PPE) & Cloudflare Pages pSEO. Zero-touch, zero-support, <$10 launch cost.

---

## 🎯 INSTANT CONTEXT FOR NEW AGENT SESSIONS

If you are a new AI agent or subagent resuming work on this project, read this section immediately:

### 1. Where We Were
- **Economic Gap Identified**: Local lead scrapers sell ~600k lead lists/month, but lists contain dead/closed businesses. Buyers pay $0.20–$0.30/record to enrich dead leads.
- **Step 0 Kill Test (§19.1)**: Executed against 200 live Chicago BACP licence records (`r5kz-chrr`). Yielded **100.0% true-match rate** and **0.0% false-match rate**.
- **Moat Defined**: Municipal portals overwrite current state. Our daily Worker cron records `status_event` timeline diffs and `missing_streak` deltas. This historical status change dataset **cannot be backfilled by competitors**.

### 2. Where We Are Now
- **Full Architecture & Code Base Built**:
  - `worker/`: Cloudflare Worker API, D1 Database schema (`0001_init.sql`), SoDA ingester (`ingest.ts`), Entity Resolver (`resolve.ts`), Status Engine (`status.ts`), Gemini LLM Fallback (`llm.ts`), and REST API (`api.ts`).
  - `actor/`: Apify Actor storefront (`actor.json`, `input_schema.json`, `main.js`, `README.md`).
  - `site/`: Programmatic SEO static HTML generator (`build.mjs`) & GitHub Action workflow (`build.yml`).
  - `scripts/`: Diagnostic Kill Test suite (`kill_test.ts`).
- **Tests & Verification**: Vitest unit test suite passing 7/7 tests (`npm test` in `worker/`). Static site generator tested and output verified in `site/dist/`.

### 3. What Needs To Be Done Next (Current Action Items)
1. **GitHub Synchronization**: Keep code synchronized with `https://github.com/cyberzen135/WTFEARN`.
2. **Cloudflare Worker Deployment**: Deploy worker via `cd worker && npx wrangler deploy` and execute D1 migration `npx wrangler d1 execute licencecheck --remote --file=migrations/0001_init.sql`.
3. **Apify Actor Store Publication**: Push Actor to Apify Console, configure PPE monetization event `business-verified` at `$0.05`, and enable maximum free trial.
4. **Cloudflare Pages pSEO Deployment**: Deploy `site/dist` to Cloudflare Pages project `licencecheck`.

### 4. Where We Are Going (Target Horizon)
- **Month 1–2**: 4 launch cities (Chicago, NYC, SF, LA), ~20k indexed pSEO pages, 1–6 active monthly users ($24–$80 net/mo).
- **Month 6 Target**: 6 cities, 180-day status timeline depth, 20+ monthly users, **10,834 verifications/month = $433/mo net ($100/week)**.

---

## 🛡️ RISK REGISTER & MITIGATION TRACKING

Any agent modifying this codebase MUST enforce these mitigations:

| Risk | Mitigation Implemented | Rule for Agents |
|---|---|---|
| **Marketplace Discovery Ramp** | Optimized Apify README with high-volume search terms + daily pSEO site build. | Never alter SEO H1/H2 structures or keywords in `actor/README.md` or `site/build.mjs`. |
| **Schema Drift & False Matches** | Hard-gated house-number matching, Bigram Dice + Jaro-Winkler scoring, `MIN_SCORE_AUTO = 0.88` threshold, Gemini LLM fallback. | Never lower `MIN_SCORE_AUTO` below 0.88 without running `kill_test.ts`. |
| **Budget Cap ($0–$10)** | 100% free tiers used (Cloudflare Workers/D1/Pages, Socrata APIs, Gemini API free tier). | Never introduce paid third-party APIs or infrastructure components. |
| **Support Overhead** | **3-State Honesty Rule**: Unmatched/unhandled rows return explicit `reason` with `billable: false` ($0 charge). | Every error path MUST return a self-explanatory JSON output with `billable: false`. |

---

## 📁 REPOSITORY MAP

- [`AGENTS.md`](file:///c:/Users/Administrator/Desktop/WTF%20PROJECT/AGENTS.md) — Master context & agent instructions (THIS FILE).
- [`README.md`](file:///c:/Users/Administrator/Desktop/WTF%20PROJECT/README.md) — Public overview & quickstart.
- [`docs/ARCHITECTURE.md`](file:///c:/Users/Administrator/Desktop/WTF%20PROJECT/docs/ARCHITECTURE.md) — System design & moat mechanics.
- [`docs/OPERATIONAL_GUIDE.md`](file:///c:/Users/Administrator/Desktop/WTF%20PROJECT/docs/OPERATIONAL_GUIDE.md) — Zero-support operational guidelines.
- [`docs/subagent-instructions.md`](file:///c:/Users/Administrator/Desktop/WTF%20PROJECT/docs/subagent-instructions.md) — Subagent guidelines.
- [`.agents/rules/licencecheck.md`](file:///c:/Users/Administrator/Desktop/WTF%20PROJECT/.agents/rules/licencecheck.md) — Agent coding standards.
- [`scripts/kill_test.ts`](file:///c:/Users/Administrator/Desktop/WTF%20PROJECT/scripts/kill_test.ts) — §19.1 Kill test diagnostic tool.
- [`worker/`](file:///c:/Users/Administrator/Desktop/WTF%20PROJECT/worker) — Cloudflare Worker API & Ingestion engine.
- [`actor/`](file:///c:/Users/Administrator/Desktop/WTF%20PROJECT/actor) — Apify Store Actor.
- [`site/`](file:///c:/Users/Administrator/Desktop/WTF%20PROJECT/site) — Programmatic SEO site generator & GitHub Action.
