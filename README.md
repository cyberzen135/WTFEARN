# LicenceCheck — Official Operating-Status Verifier for Local Business Lists

> **Doctrine**: BRAIN AI Economic Gap Discovery Engine  
> **Candidate ID**: L4-license-status-archive | **Score**: 91/100  
> **Document Date**: 2026-08-14  

---

## 📌 Executive Summary

**LicenceCheck** is an automated, zero-touch business licence operating-status verifier and delta archive engine. It takes input local business lists (`name`, `address`, `city`, `state`, `zip`) or directly chains onto Apify Google Maps scrapers via `datasetId`, verifying each entry against official municipal government licence registries (Chicago, NYC, San Francisco, Los Angeles).

Unlike current-state scrapers, **LicenceCheck maintains a historical status timeline (`status_event`) and missing streak tracking (`missing_streak`)**, providing a unique defensible archive of closures, revocations, and status transitions that cannot be backfilled by competitors.

---

## 📁 Repository Structure

```
.
├── .agents/
│   └── rules/
│       └── licencecheck.md          # Custom agent rules & code standards
├── docs/
│   ├── ARCHITECTURE.md              # Ingest, resolution, D1 schema & moat details
│   ├── OPERATIONAL_GUIDE.md         # Deployment, free tier limits, & maintenance
│   └── subagent-instructions.md     # Guidelines for autonomous subagents
├── scripts/
│   └── kill_test.ts                 # §19.1 Kill test diagnostic runner
├── worker/
│   ├── wrangler.toml                # Cloudflare Worker & D1/R2 bindings
│   ├── migrations/
│   │   └── 0001_init.sql            # D1 database schema & indexes
│   └── src/
│       ├── types.ts                 # Shared TypeScript interfaces
│       ├── portals.ts               # Municipal portal seed configurations
│       ├── normalise.ts             # Name & address normaliser logic
│       ├── status.ts                # Status derivation engine
│       ├── llm.ts                   # Gemini API LLM adjudication & map engine
│       ├── resolve.ts               # Entity resolution algorithm & scoring
│       ├── ingest.ts                # Socrata SoDA API ingester & snapshot diffing
│       ├── api.ts                   # HTTP endpoints (/v1/verify, /coverage, etc.)
│       └── index.ts                 # Worker entrypoint (Cron & Fetch handlers)
├── actor/
│   ├── .actor/
│   │   ├── actor.json               # Apify Actor spec
│   │   └── input_schema.json        # Actor input options & dataset chaining
│   ├── Dockerfile                   # Node 20 environment
│   ├── package.json                 # Apify SDK dependencies
│   ├── main.js                      # Actor runner & PPE charging rail
│   └── README.md                    # Apify Store marketing & SEO page
└── site/
    ├── build.mjs                    # Programmatic SEO static HTML generator
    └── .github/workflows/
        └── build.yml                # Automated GitHub Actions deployment to Pages
```

---

## ⚡ Quickstart

### 1. Run Diagnostic Kill Test (§19.1)
```bash
cmd /c npm run kill-test
```

### 2. Run Local Worker & Database
```bash
cd worker
cmd /c npm install
cmd /c npx wrangler d1 execute licencecheck --local --file=migrations/0001_init.sql
cmd /c npm run dev
```

### 3. Run Actor
```bash
cd actor
cmd /c npm install
cmd /c npm start
```

### 4. Build pSEO Site
```bash
cd site
node build.mjs
```

---

## 🛡️ The Three-State Honesty Rule (§2.5)

The output is **never wrong, only sometimes uninformative**. A business with no licence record is reported as `NOT_IN_LICENSED_CATEGORY` or `NO_COVERAGE` with an explicit `reason`, and **it is not billed**. 

Only matched records with definitive statuses (`ACTIVE`, `LAPSED`, `REVOKED`, `CLOSED`) trigger a `billable: true` state and an Apify `business-verified` event charge ($0.05).
