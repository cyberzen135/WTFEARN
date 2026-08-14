import { Env, InputRecord, VerificationResult, LicenceRow, StatusEventRow, OutputStatus } from './types';
import { normaliseName, normaliseAddress } from './normalise';
import { adjudicatePairsWithLLM } from './llm';

function getBigrams(str: string): Set<string> {
  const s = str.replace(/\s+/g, "");
  const bg = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) {
    bg.add(s.slice(i, i + 2));
  }
  return bg;
}

export function diceCoefficient(a: string, b: string): number {
  if (!a || !b) return a === b ? 1 : 0;
  const bgA = getBigrams(a);
  const bgB = getBigrams(b);
  if (bgA.size === 0 && bgB.size === 0) return 1;
  let intersect = 0;
  for (const item of bgA) {
    if (bgB.has(item)) intersect++;
  }
  return (2 * intersect) / (bgA.size + bgB.size);
}

export function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0.0;
  const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);
  let matches = 0;
  let trans = 0;

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j]) continue;
      if (s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0.0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) trans++;
    k++;
  }
  const jaro = (matches / len1 + matches / len2 + (matches - trans / 2) / matches) / 3.0;
  let prefix = 0;
  for (let i = 0; i < Math.min(4, len1, len2); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

export function tokenSetRatio(s1: string, s2: string): number {
  const t1 = Array.from(new Set(s1.split(" "))).sort();
  const t2 = Array.from(new Set(s2.split(" "))).sort();
  const intersection = t1.filter(x => t2.includes(x)).join(" ");
  if (!intersection) return 0;
  const s1Sorted = t1.join(" ");
  const s2Sorted = t2.join(" ");
  const r1 = jaroWinkler(intersection, s1Sorted);
  const r2 = jaroWinkler(intersection, s2Sorted);
  const r3 = jaroWinkler(s1Sorted, s2Sorted);
  return Math.max(r1, r2, r3);
}

async function sha256Hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function resolveRecords(
  records: InputRecord[],
  env: Env
): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];
  const minScoreAuto = parseFloat(env.MIN_SCORE_AUTO || '0.88');
  const minScoreLLM = parseFloat(env.MIN_SCORE_LLM || '0.72');

  for (let idx = 0; idx < records.length; idx++) {
    const rec = records[idx];
    const recId = rec.id ?? `row-${idx + 1}`;

    const nameNorm = normaliseName(rec.name);
    const { house_number, street_norm } = normaliseAddress(rec.address || '');
    const zip5 = (rec.zip || '').slice(0, 5);
    const city = (rec.city || '').trim();

    const queryHash = await sha256Hex(`${nameNorm}|${house_number || ''}|${street_norm}|${zip5}`);
    const todayStr = new Date().toISOString().slice(0, 10);

    // 1. Stage 1: Check match_cache
    const cacheRow: any = await env.DB.prepare(
      `SELECT licence_uid, score, method FROM match_cache WHERE query_hash = ?`
    ).bind(queryHash).first();

    if (cacheRow) {
      if (cacheRow.licence_uid) {
        const lic: LicenceRow | null = await env.DB.prepare(
          `SELECT * FROM licence WHERE licence_uid = ?`
        ).bind(cacheRow.licence_uid).first();

        if (lic) {
          const events: StatusEventRow[] = (await env.DB.prepare(
            `SELECT observed_on, from_status, to_status, evidence FROM status_event WHERE licence_uid = ? ORDER BY event_id ASC`
          ).bind(lic.licence_uid).all()).results as any;

          const portal: any = await env.DB.prepare(
            `SELECT jurisdiction, data_as_of, stale FROM portal WHERE portal_id = ?`
          ).bind(lic.portal_id).first();

          results.push({
            id: recId,
            input: rec,
            status: lic.status_derived,
            billable: true,
            confidence: cacheRow.score ?? 0.95,
            match_method: 'cached',
            licence: {
              jurisdiction: portal?.jurisdiction || lic.city || '',
              licence_number: lic.licence_number || '',
              legal_name: lic.legal_name,
              dba_name: lic.dba_name,
              category: lic.category_norm || lic.category_raw,
              status_raw: lic.status_raw,
              issued_date: lic.issued_date,
              start_date: lic.start_date,
              expiry_date: lic.expiry_date,
              end_date: lic.end_date,
              address: lic.addr_raw,
              source_url: lic.source_url
            },
            history: events.map(e => ({
              observed_on: e.observed_on,
              from: e.from_status || null,
              to: e.to_status,
              evidence: e.evidence || null
            })),
            coverage: {
              city_supported: true,
              data_as_of: portal?.data_as_of || todayStr,
              stale: Boolean(portal?.stale)
            },
            reason: null
          });
          continue;
        }
      }
    }

    // 2. Stage 2: Coverage Check
    const portalRow: any = await env.DB.prepare(
      `SELECT * FROM portal WHERE LOWER(jurisdiction) LIKE ? OR portal_id = ?`
    ).bind(`%${city.toLowerCase()}%`, city.toLowerCase()).first();

    if (!portalRow && city) {
      results.push({
        id: recId,
        input: rec,
        status: 'NO_COVERAGE',
        billable: false,
        confidence: 0,
        match_method: null,
        licence: null,
        history: [],
        coverage: { city_supported: false, data_as_of: null, stale: false },
        reason: `Jurisdiction '${city}' is not currently ingested in official registries.`
      });

      await env.DB.prepare(
        `INSERT OR REPLACE INTO match_cache (query_hash, licence_uid, score, method, decided_at) VALUES (?, NULL, 0, 'confirmed_none', ?)`
      ).bind(queryHash, todayStr).run();
      continue;
    }

    // 3. Stage 3: Blocking Query (House Number & Zip/Street)
    let candidates: LicenceRow[] = [];
    if (house_number && zip5) {
      candidates = (await env.DB.prepare(
        `SELECT * FROM licence WHERE zip5 = ? AND house_number = ?`
      ).bind(zip5, house_number).all()).results as any;
    }

    if (candidates.length === 0 && house_number && street_norm) {
      candidates = (await env.DB.prepare(
        `SELECT * FROM licence WHERE street_norm = ? AND house_number = ?`
      ).bind(street_norm, house_number).all()).results as any;
    }

    if (candidates.length === 0) {
      results.push({
        id: recId,
        input: rec,
        status: 'NOT_IN_LICENSED_CATEGORY',
        billable: false,
        confidence: 0,
        match_method: null,
        licence: null,
        history: [],
        coverage: {
          city_supported: true,
          data_as_of: portalRow?.data_as_of || todayStr,
          stale: Boolean(portalRow?.stale)
        },
        reason: `No municipal licence record found matching address '${rec.address}'. Business category may not require a city licence.`
      });

      await env.DB.prepare(
        `INSERT OR REPLACE INTO match_cache (query_hash, licence_uid, score, method, decided_at) VALUES (?, NULL, 0, 'confirmed_none', ?)`
      ).bind(queryHash, todayStr).run();
      continue;
    }

    // 4. Stage 4: Candidate Scoring
    let bestCand: LicenceRow | null = null;
    let bestScore = 0;

    for (const cand of candidates) {
      if (house_number && cand.house_number !== house_number) continue;

      const streetSim = diceCoefficient(street_norm, cand.street_norm || '');
      const nameSim = Math.max(
        jaroWinkler(nameNorm, cand.name_norm),
        tokenSetRatio(nameNorm, cand.name_norm)
      );

      const score = 0.15 * streetSim + 0.85 * nameSim;
      if (score > bestScore) {
        bestScore = score;
        bestCand = cand;
      }
    }

    // 5. Stage 5: Thresholding & LLM Fallback
    if (bestScore >= minScoreAuto && bestCand) {
      const events: StatusEventRow[] = (await env.DB.prepare(
        `SELECT observed_on, from_status, to_status, evidence FROM status_event WHERE licence_uid = ? ORDER BY event_id ASC`
      ).bind(bestCand.licence_uid).all()).results as any;

      await env.DB.prepare(
        `INSERT OR REPLACE INTO match_cache (query_hash, licence_uid, score, method, decided_at) VALUES (?, ?, ?, 'deterministic', ?)`
      ).bind(queryHash, bestCand.licence_uid, bestScore, todayStr).run();

      results.push({
        id: recId,
        input: rec,
        status: bestCand.status_derived,
        billable: true,
        confidence: parseFloat(bestScore.toFixed(4)),
        match_method: 'deterministic',
        licence: {
          jurisdiction: portalRow?.jurisdiction || bestCand.city || '',
          licence_number: bestCand.licence_number || '',
          legal_name: bestCand.legal_name,
          dba_name: bestCand.dba_name,
          category: bestCand.category_norm || bestCand.category_raw,
          status_raw: bestCand.status_raw,
          issued_date: bestCand.issued_date,
          start_date: bestCand.start_date,
          expiry_date: bestCand.expiry_date,
          end_date: bestCand.end_date,
          address: bestCand.addr_raw,
          source_url: bestCand.source_url
        },
        history: events.map(e => ({
          observed_on: e.observed_on,
          from: e.from_status || null,
          to: e.to_status,
          evidence: e.evidence || null
        })),
        coverage: {
          city_supported: true,
          data_as_of: portalRow?.data_as_of || todayStr,
          stale: Boolean(portalRow?.stale)
        },
        reason: null
      });
    } else if (bestScore >= minScoreLLM && bestCand) {
      // Send to LLM Adjudication
      const decisions = await adjudicatePairsWithLLM([
        {
          i: 0,
          input: { name: rec.name, addr: rec.address || '' },
          candidate: { name: bestCand.dba_name || bestCand.legal_name || '', addr: bestCand.addr_raw || '', category: bestCand.category_raw || '' }
        }
      ], env);

      const decision = decisions[0];
      if (decision && decision.same && decision.confidence >= 0.75) {
        const events: StatusEventRow[] = (await env.DB.prepare(
          `SELECT observed_on, from_status, to_status, evidence FROM status_event WHERE licence_uid = ? ORDER BY event_id ASC`
        ).bind(bestCand.licence_uid).all()).results as any;

        await env.DB.prepare(
          `INSERT OR REPLACE INTO match_cache (query_hash, licence_uid, score, method, decided_at) VALUES (?, ?, ?, 'llm_adjudicated', ?)`
        ).bind(queryHash, bestCand.licence_uid, decision.confidence, todayStr).run();

        results.push({
          id: recId,
          input: rec,
          status: bestCand.status_derived,
          billable: true,
          confidence: parseFloat(decision.confidence.toFixed(4)),
          match_method: 'llm_adjudicated',
          licence: {
            jurisdiction: portalRow?.jurisdiction || bestCand.city || '',
            licence_number: bestCand.licence_number || '',
            legal_name: bestCand.legal_name,
            dba_name: bestCand.dba_name,
            category: bestCand.category_norm || bestCand.category_raw,
            status_raw: bestCand.status_raw,
            issued_date: bestCand.issued_date,
            start_date: bestCand.start_date,
            expiry_date: bestCand.expiry_date,
            end_date: bestCand.end_date,
            address: bestCand.addr_raw,
            source_url: bestCand.source_url
          },
          history: events.map(e => ({
            observed_on: e.observed_on,
            from: e.from_status || null,
            to: e.to_status,
            evidence: e.evidence || null
          })),
          coverage: {
            city_supported: true,
            data_as_of: portalRow?.data_as_of || todayStr,
            stale: Boolean(portalRow?.stale)
          },
          reason: null
        });
      } else {
        results.push({
          id: recId,
          input: rec,
          status: 'AMBIGUOUS',
          billable: false,
          confidence: parseFloat(bestScore.toFixed(4)),
          match_method: null,
          licence: null,
          history: [],
          coverage: {
            city_supported: true,
            data_as_of: portalRow?.data_as_of || todayStr,
            stale: Boolean(portalRow?.stale)
          },
          reason: `Match confidence (${bestScore.toFixed(2)}) below automatic threshold and unconfirmed by entity adjudication.`
        });
      }
    } else {
      results.push({
        id: recId,
        input: rec,
        status: 'NOT_IN_LICENSED_CATEGORY',
        billable: false,
        confidence: parseFloat(bestScore.toFixed(4)),
        match_method: null,
        licence: null,
        history: [],
        coverage: {
          city_supported: true,
          data_as_of: portalRow?.data_as_of || todayStr,
          stale: Boolean(portalRow?.stale)
        },
        reason: `No matching active or historical licence record found for input '${rec.name}' at specified address.`
      });

      await env.DB.prepare(
        `INSERT OR REPLACE INTO match_cache (query_hash, licence_uid, score, method, decided_at) VALUES (?, NULL, 0, 'confirmed_none', ?)`
      ).bind(queryHash, todayStr).run();
    }
  }

  return results;
}
