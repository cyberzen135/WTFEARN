import { Actor } from 'apify';

const API   = process.env.LICENCECHECK_API ?? 'https://licencecheck.workers.dev';
const KEY   = process.env.LICENCECHECK_KEY;          // Apify secret env var
const BATCH = 200;

await Actor.init();

const {
  records = [],
  datasetId,
  fieldMap = { name: 'title', address: 'street', city: 'city', state: 'state', zip: 'postalCode' },
  includeHistory = true,
  minScore = 0.88,
} = (await Actor.getInput()) ?? {};

// ---- 1. assemble the work list -------------------------------------------------
let work = records.map((r, i) => ({ id: r.id ?? `in-${i}`, ...r }));

if (datasetId) {
  const ds = await Actor.openDataset(datasetId, { forceCloud: true });
  const { items } = await ds.getData();
  work = work.concat(items.map((it, i) => ({
    id: it.id ?? `ds-${i}`,
    name:    it[fieldMap.name],
    address: it[fieldMap.address],
    city:    it[fieldMap.city],
    state:   it[fieldMap.state],
    zip:     it[fieldMap.zip],
  })));
}

work = work.filter(w => w.name && (w.address || w.zip));
Actor.log.info(`Verifying ${work.length} businesses`);
if (work.length === 0) {
  await Actor.pushData({ status: 'NO_INPUT', reason: 'Provide `records` or a `datasetId` with a matching fieldMap.' });
  await Actor.exit();
}

// ---- 2. batch, verify, charge --------------------------------------------------
let billed = 0, matched = 0;

for (let i = 0; i < work.length; i += BATCH) {
  const batch = work.slice(i, i + BATCH);
  let payload = null;

  for (let attempt = 1; attempt <= 4 && !payload; attempt++) {
    try {
      const res = await fetch(`${API}/v1/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': KEY || '' },
        body: JSON.stringify({ records: batch, includeHistory, minScore }),
      });
      if (res.status === 429 || res.status >= 500) throw new Error(`upstream ${res.status}`);
      if (!res.ok) throw new Error(`upstream ${res.status}`);
      payload = await res.json();
    } catch (e) {
      Actor.log.warning(`batch ${i / BATCH} attempt ${attempt}: ${e.message}`);
      if (attempt === 4) break;
      await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
    }
  }

  // Never fail the run. Emit an explicit, non-billed row per record instead.
  if (!payload) {
    await Actor.pushData(batch.map(b => ({
      id: b.id, input: b, status: 'TEMPORARILY_UNAVAILABLE', billable: false,
      reason: 'Registry service did not respond. Re-run this batch; you were not charged.',
    })));
    continue;
  }

  await Actor.pushData(payload.results);

  // CHARGE ONLY FOR DELIVERED VALUE
  if (payload.billable_count > 0) {
    await Actor.charge({ eventName: 'business-verified', count: payload.billable_count });
    billed  += payload.billable_count;
  }
  matched += payload.results.filter(r => r.billable).length;
  Actor.log.info(`batch ${i / BATCH + 1}: ${payload.results.length} rows, ${payload.billable_count} billable`);
}

Actor.log.info(`Done. ${work.length} submitted, ${matched} matched to an official licence, ${billed} charged.`);
await Actor.exit();
