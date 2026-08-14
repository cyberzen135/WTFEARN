# LicenceCheck Agent Rules & Guidelines

1. **Strict Budget Cap**: Total launch cost must remain <= $10.00. Use Cloudflare Workers, Cloudflare D1, R2, Pages, Gemini free tier, and Apify Store free tier.
2. **Zero Support**: Maintain 3-state honesty rule. Every non-billable row must have `billable: false` and a clear `reason`.
3. **Immutability of Event Ledger**: `status_event` records must never be modified or overwritten once written.
4. **Preserve API Contract**: The response output structure from `/v1/verify` and `main.js` must strictly follow §2.4 of `FULL.md5`.
5. **No Placeholders**: All code implementations must be production-ready with real error handling, retries, and types.
