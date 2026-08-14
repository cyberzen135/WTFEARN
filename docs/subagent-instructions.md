# Operational & Subagent Guide — LicenceCheck

> **Primary Objective**: Maintain zero-touch passive revenue operations ($100+/week net) while protecting the status timeline moat and zero-support guarantees.

---

## 1. Core Operating Principles for Autonomous Agents

Any subagent working on this repository MUST strictly follow these rules:

1. **Revenue First**: All functionality serves to deliver accurate operating status verifications billed at `$0.05` per matched record.
2. **Zero False Billing**: If a record cannot be matched to an official government licence with confidence $\ge 0.88$ (or confirmed by LLM adjudication), it MUST be assigned `billable: false` and cost the user `$0.00`.
3. **Zero Support Overhead**: Never create a contact form, email address, or support webhook. Return clear, structured `reason` attributes on all non-billable outputs.
4. **Preserve the Moat**: The `status_event` ledger and `missing_streak` counts are append-only. Never overwrite or delete historical status change observations.
5. **Strict Budget Cap**: Keep total infrastructure cost $\le \$10.00/mo$. Utilize free tiers of Cloudflare, Socrata, Gemini, and GitHub Actions.

---

## 2. Risk Mitigation Protocols

### Risk 1: Marketplace Discovery & Distribution Ramp
- **Subagent Directive**: Keep `actor/README.md` and `site/build.mjs` synchronized with target marketplace keywords (`business licence status`, `verify business open`, `clean google maps leads`, `business list hygiene`).
- Ensure every business page in `site/build.mjs` carries a clear Call To Action ("Verify a whole list →") linking directly to the Apify Store listing.

### Risk 2: Schema Drift & Data Source Quality
- **Subagent Directive**: When onboarding a new municipal portal or handling API schema shifts:
  1. Always run a SoQL `$group` query first to enumerate distinct raw status codes and category descriptions.
  2. Generate candidate `field_map` and `status_map` JSON objects.
  3. Store mappings in the `portal` table in D1.
  4. If a portal errors or changes columns unexpectedly, set `portal.stale = 1` so the API degrades gracefully for that city while other cities continue serving uninterrupted.

### Risk 3: Matching Rate Precision
- **Subagent Directive**: Run `cmd /c npm run kill-test` before modifying normalisation or scoring logic. The true-match rate on Chicago dataset MUST remain $\ge 60\%$ and false-match rate $\le 2\%$.
