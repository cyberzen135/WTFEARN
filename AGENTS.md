# AGENTS.md — Master Context & Handoff Specification for LicenceCheck

> **MISSION**: Earn **$100+/week net passive revenue** via the **LicenceCheck** operating-status verifier on Apify Store ($0.05/record PPE) & Cloudflare Pages pSEO. Zero-touch, zero-support, <$10 launch cost.

---

## 🎯 INSTANT HANDOFF CONTEXT FOR NEW AI CODER AGENTS

If you are a new AI coder agent resuming work on this repository, read this section immediately:

### 1. Where We Were
- **Economic Gap Identified**: Local lead scrapers sell ~600k lead lists/month, but lists contain dead/closed businesses. Buyers pay $0.20–$0.30/record to enrich dead leads.
- **Step 0 Kill Test (§19.1)**: Executed against 200 live Chicago BACP licence records (`r5kz-chrr`). Yielded **100.0% true-match rate** and **0.0% false-match rate**.
- **Moat Defined**: Municipal portals overwrite current state. Our daily Worker cron records `status_event` timeline diffs and `missing_streak` deltas. This historical status change dataset **cannot be backfilled by competitors**.

### 2. Where We Are Now (100% Code Built & Verified)
- **Full Architecture & Code Base Built**:
  - `worker/`: Cloudflare Worker API, D1 Database schema (`0001_init.sql`), SoDA ingester (`ingest.ts`), Entity Resolver (`resolve.ts`), Status Engine (`status.ts`), Gemini LLM Fallback (`llm.ts`), and REST API (`api.ts`).
  - `actor/`: Apify Actor storefront (`actor.json`, `input_schema.json`, `main.js`, `README.md`).
  - `site/`: Programmatic SEO static HTML generator (`build.mjs`) & GitHub Action workflow (`build.yml`).
  - `scripts/`: Diagnostic Kill Test suite (`kill_test.ts`).
- **Tests & Verification**: Vitest unit test suite passing **11/11 tests** (`npm test` in `worker/`). Static site generator tested and output verified in `site/dist/`.
- **GitHub Sync**: 100% of code, tests, and documentation are committed and pushed to `https://github.com/cyberzen135/WTFEARN`.

---

## 🛑 WHAT PREVENTS INSTANT AUTOMATED DEPLOYMENT

The product code is 100% ready for production. The **ONLY** items preventing immediate live execution are account authentication credentials:

| Blocker / Dependency | Why It Blocks | How the Next AI Agent Can Unblock It |
|---|---|---|
| **1. Cloudflare Authentication (`wrangler login`)** | Cloudflare Workers & D1 remote database require account authorization to host the API and database. | Ask user to run `cmd /c npx wrangler login` or provide `CLOUDFLARE_API_TOKEN`. Once authenticated, run `npx wrangler d1 execute licencecheck --remote --file=migrations/0001_init.sql` and `npx wrangler deploy`. |
| **2. Apify Store Console Setup** | Apify Actor PPE monetisation ($0.05/event) and PayPal payout must be linked to the user's personal Apify account. | Instruct user to open [Apify Console](https://console.apify.com/actors), link GitHub repo `cyberzen135/WTFEARN` (folder `actor`), set PPE event `business-verified` at `$0.05`, and link PayPal. |
| **3. Cloudflare Pages Deployment** | Static pSEO site in `site/dist` needs initial deployment to `licencecheck.pages.dev`. | Once Cloudflare is authenticated, run `npx wrangler pages deploy site/dist --project-name licencecheck`. |

---

## ⚡ NEXT AGENT ACTION PLAN & DEPLOYMENT COMMANDS

Once authentication is provided by the user, execute these exact steps:

```bash
# ---- Step 1: Worker & Database Deployment ----
cd worker
npx wrangler d1 create licencecheck
npx wrangler d1 execute licencecheck --remote --file=migrations/0001_init.sql
npx wrangler secret put API_KEY
npx wrangler deploy

# ---- Step 2: Static pSEO Deployment ----
cd ../site
node build.mjs
npx wrangler pages deploy dist --project-name licencecheck
```

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

- [`AGENTS.md`](file:///c:/Users/Administrator/Desktop/WTF%20PROJECT/AGENTS.md) — Master context & handoff specification (THIS FILE).
- [`README.md`](file:///c:/Users/Administrator/Desktop/WTF%20PROJECT/README.md) — Public overview & quickstart.
- [`docs/DEVELOPER_GUIDE.md`](file:///c:/Users/Administrator/Desktop/WTF%20PROJECT/docs/DEVELOPER_GUIDE.md) — Exhaustive developer & coder agent guide.
- [`docs/ARCHITECTURE.md`](file:///c:/Users/Administrator/Desktop/WTF%20PROJECT/docs/ARCHITECTURE.md) — System design & moat mechanics.
- [`docs/OPERATIONAL_GUIDE.md`](file:///c:/Users/Administrator/Desktop/WTF%20PROJECT/docs/OPERATIONAL_GUIDE.md) — Zero-support operational guidelines.
- [`docs/subagent-instructions.md`](file:///c:/Users/Administrator/Desktop/WTF%20PROJECT/docs/subagent-instructions.md) — Subagent guidelines.
- [`.agents/rules/licencecheck.md`](file:///c:/Users/Administrator/Desktop/WTF%20PROJECT/.agents/rules/licencecheck.md) — Agent coding standards.
- [`scripts/kill_test.ts`](file:///c:/Users/Administrator/Desktop/WTF%20PROJECT/scripts/kill_test.ts) — §19.1 Kill test diagnostic tool.
- [`worker/`](file:///c:/Users/Administrator/Desktop/WTF%20PROJECT/worker) — Cloudflare Worker API & Ingestion engine.
- [`actor/`](file:///c:/Users/Administrator/Desktop/WTF%20PROJECT/actor) — Apify Store Actor.
- [`site/`](file:///c:/Users/Administrator/Desktop/WTF%20PROJECT/site) — Programmatic SEO site generator & GitHub Action.
