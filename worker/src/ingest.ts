import { Env, PortalRow, LicenceStatus } from './types';
import { SEED_PORTALS } from './portals';
import { normaliseName, normaliseAddress, generateSlug } from './normalise';
import { deriveStatus } from './status';

export async function ensurePortalsSeeded(env: Env): Promise<void> {
  for (const portal of SEED_PORTALS) {
    await env.DB.prepare(`
      INSERT INTO portal (
        portal_id, domain, resource_id, jurisdiction, field_map,
        closure_method, status_map, licensed_categories, stale
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(portal_id) DO UPDATE SET
        domain = excluded.domain,
        resource_id = excluded.resource_id,
        jurisdiction = excluded.jurisdiction,
        field_map = excluded.field_map,
        closure_method = excluded.closure_method,
        status_map = excluded.status_map,
        licensed_categories = excluded.licensed_categories
    `).bind(
      portal.portal_id,
      portal.domain,
      portal.resource_id,
      portal.jurisdiction,
      portal.field_map,
      portal.closure_method,
      portal.status_map || null,
      portal.licensed_categories || null,
      portal.stale
    ).run();
  }
}

const PAGE_LIMIT = 5000;
const BATCH_CHUNK = 50;
const BACKFILL_CAP = 100000;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchPrevStatuses(env: Env, uids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const group of chunk(uids, 100)) {
    if (group.length === 0) continue;
    const placeholders = group.map(() => '?').join(',');
    const res = await env.DB.prepare(
      `SELECT licence_uid, status_derived FROM licence WHERE licence_uid IN (${placeholders})`
    ).bind(...group).all();
    for (const row of (res.results as any[])) {
      map.set(row.licence_uid, row.status_derived);
    }
  }
  return map;
}

async function ingestOnePage(
  env: Env,
  portal: PortalRow,
  today: string
): Promise<{ rowsSeen: number; rowsChanged: number; hasMore: boolean }> {
  const fieldMap = JSON.parse(portal.field_map || '{}');
  const statusMap = portal.status_map ? JSON.parse(portal.status_map) : null;
  const offset = portal.sync_cursor || 0;

  const url = `https://${portal.domain}/resource/${portal.resource_id}.json?$limit=${PAGE_LIMIT}&$offset=${offset}&$order=:id`;
  const headers: Record<string, string> = {};
  if (env.SOCRATA_APP_TOKEN) headers['X-App-Token'] = env.SOCRATA_APP_TOKEN;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Socrata fetch failed HTTP ${res.status}: ${res.statusText}`);
  const rawRecords: any[] = await res.json();

  if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
    return { rowsSeen: 0, rowsChanged: 0, hasMore: false };
  }

  const parsed = rawRecords.map(row => {
    const sourcePk = row[fieldMap.source_pk] || row['id'];
    if (!sourcePk) return null;

    const licenceUid = `${portal.portal_id}:${sourcePk}`;
    const legalName = row[fieldMap.legal_name] || null;
    const dbaName = row[fieldMap.dba_name] || null;
    const nameNorm = normaliseName(dbaName || legalName || '');

    let rawAddr = row[fieldMap.address];
    if (!rawAddr && fieldMap.address_building && fieldMap.address_street) {
      rawAddr = `${row[fieldMap.address_building]} ${row[fieldMap.address_street]}`;
    }
    const { house_number, street_norm, unit } = normaliseAddress(rawAddr || '');

    const city = row[fieldMap.city] || null;
    const state = row[fieldMap.state] || null;
    const zip5 = (row[fieldMap.zip5] || '').toString().slice(0, 5) || null;
    const categoryRaw = row[fieldMap.category_raw] || null;
    const statusRaw = row[fieldMap.status_raw] || null;
    const issuedDate = row[fieldMap.issued_date] || null;
    const startDate = row[fieldMap.start_date] || null;
    const expiryDate = row[fieldMap.expiry_date] || null;
    const endDate = row[fieldMap.end_date] || null;

    const statusDerived: LicenceStatus = deriveStatus(
      { status_raw: statusRaw, end_date: endDate, expiry_date: expiryDate },
      portal.closure_method,
      statusMap,
      today
    );

    const sourceUrl = `https://${portal.domain}/resource/${portal.resource_id}.json?${fieldMap.source_pk}=${encodeURIComponent(sourcePk)}`;
    const slug = generateSlug(nameNorm, street_norm, zip5 || '00000');

    return {
      licenceUid, portal_id: portal.portal_id, sourcePk,
      licenceNumber: row[fieldMap.licence_number] || sourcePk,
      legalName, dbaName, nameNorm, rawAddr: rawAddr || null,
      house_number, street_norm, unit, city, state, zip5,
      categoryRaw, statusRaw, statusDerived, issuedDate, startDate,
      expiryDate, endDate, sourceUrl, slug
    };
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  const prevMap = await fetchPrevStatuses(env, parsed.map(p => p.licenceUid));

  const statements: any[] = [];
  let rowsChanged = 0;

  for (const r of parsed) {
    const prevStatus = prevMap.get(r.licenceUid);

    if (prevStatus === undefined) {
      statements.push(env.DB.prepare(`
        INSERT INTO licence (
          licence_uid, portal_id, source_pk, licence_number, legal_name, dba_name,
          name_norm, addr_raw, house_number, street_norm, unit, city, state, zip5,
          category_raw, category_norm, status_raw, status_derived, issued_date,
          start_date, expiry_date, end_date, first_seen, last_seen, missing_streak,
          source_url, slug, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
        ON CONFLICT(licence_uid) DO NOTHING
      `).bind(
        r.licenceUid, r.portal_id, r.sourcePk, r.licenceNumber, r.legalName, r.dbaName,
        r.nameNorm, r.rawAddr, r.house_number, r.street_norm, r.unit, r.city, r.state, r.zip5,
        r.categoryRaw, r.categoryRaw, r.statusRaw, r.statusDerived, r.issuedDate,
        r.startDate, r.expiryDate, r.endDate, today, today, r.sourceUrl, r.slug, today
      ));
      statements.push(env.DB.prepare(`
        INSERT OR IGNORE INTO status_event (licence_uid, observed_on, from_status, to_status, evidence)
        VALUES (?, ?, NULL, ?, 'Initial ingestion observed')
      `).bind(r.licenceUid, today, r.statusDerived));
      rowsChanged++;
    } else {
      statements.push(env.DB.prepare(`
        UPDATE licence SET
          last_seen = ?, missing_streak = 0, status_derived = ?, status_raw = ?, updated_at = ?
        WHERE licence_uid = ?
      `).bind(today, r.statusDerived, r.statusRaw, today, r.licenceUid));

      if (prevStatus !== r.statusDerived) {
        statements.push(env.DB.prepare(`
          INSERT OR IGNORE INTO status_event (licence_uid, observed_on, from_status, to_status, evidence)
          VALUES (?, ?, ?, ?, 'Status transition detected during sync')
        `).bind(r.licenceUid, today, prevStatus, r.statusDerived));
        rowsChanged++;
      }
    }
  }

  for (const group of chunk(statements, BATCH_CHUNK)) {
    if (group.length > 0) await env.DB.batch(group);
  }

  if (env.SNAPSHOTS && rawRecords.length > 0) {
    const ndjson = rawRecords.map(r => JSON.stringify(r)).join('\n');
    await env.SNAPSHOTS.put(`snapshots/${portal.portal_id}/${today}-offset${offset}.ndjson`, ndjson);
  }

  const hasMore = rawRecords.length === PAGE_LIMIT && (offset + PAGE_LIMIT) < BACKFILL_CAP;
  return { rowsSeen: rawRecords.length, rowsChanged, hasMore };
}

async function finalizePortalSync(env: Env, portal: PortalRow, today: string): Promise<void> {
  if (portal.closure_method === 'delta') {
    const missingStreakLimit = parseInt(env.MISSING_STREAK_CLOSED || '3');

    await env.DB.prepare(`
      UPDATE licence SET missing_streak = missing_streak + 1
      WHERE portal_id = ? AND last_seen < ?
    `).bind(portal.portal_id, today).run();

    const closingRows: any[] = (await env.DB.prepare(`
      SELECT licence_uid, status_derived FROM licence
      WHERE portal_id = ? AND missing_streak >= ? AND status_derived != 'CLOSED'
    `).bind(portal.portal_id, missingStreakLimit).all()).results as any;

    const stmts: any[] = [];
    for (const cRow of closingRows) {
      stmts.push(env.DB.prepare(`
        UPDATE licence SET status_derived = 'CLOSED', updated_at = ? WHERE licence_uid = ?
      `).bind(today, cRow.licence_uid));
      stmts.push(env.DB.prepare(`
        INSERT OR IGNORE INTO status_event (licence_uid, observed_on, from_status, to_status, evidence)
        VALUES (?, ?, ?, 'CLOSED', ?)
      `).bind(cRow.licence_uid, today, cRow.status_derived, `Absent from ${missingStreakLimit} consecutive snapshots`));
    }
    for (const group of chunk(stmts, BATCH_CHUNK)) {
      if (group.length > 0) await env.DB.batch(group);
    }
  }

  const countRow: any = await env.DB.prepare(
    `SELECT count(*) as total FROM licence WHERE portal_id = ?`
  ).bind(portal.portal_id).first();

  await env.DB.prepare(`
    UPDATE portal SET last_sync_at = ?, last_sync_row_count = ?, data_as_of = ?, stale = 0, sync_cursor = 0
    WHERE portal_id = ?
  `).bind(new Date().toISOString(), countRow?.total || 0, today, portal.portal_id).run();
}

/**
 * Processes pages across portals until either everything is caught up for `today`
 * or `budgetMs` is spent — remaining work resumes next call via the persisted
 * `sync_cursor`, so a single free-tier invocation never needs to finish a whole city.
 */
export async function runIngestBudgeted(
  env: Env,
  budgetMs = 20000,
  onlyPortalId?: string
): Promise<{ totalSeen: number; totalChanged: number; portalsTouched: string[]; portalsCompleted: string[]; timedOut: boolean }> {
  await ensurePortalsSeeded(env);

  const today = new Date().toISOString().slice(0, 10);
  const startedAt = Date.now();

  let portals: PortalRow[] = (await env.DB.prepare(`SELECT * FROM portal`).all()).results as any;
  if (onlyPortalId) portals = portals.filter(p => p.portal_id === onlyPortalId);

  let totalSeen = 0;
  let totalChanged = 0;
  const portalsTouched = new Set<string>();
  const portalsCompleted: string[] = [];
  let timedOut = false;

  for (const portal of portals) {
    if (portal.data_as_of === today) continue; // already fully synced today

    let current = portal;
    while (true) {
      if (Date.now() - startedAt > budgetMs) {
        timedOut = true;
        break;
      }

      portalsTouched.add(current.portal_id);
      let pageResult;
      try {
        pageResult = await ingestOnePage(env, current, today);
      } catch (err: any) {
        console.error(`Portal sync error for ${current.portal_id}:`, err);
        await env.DB.prepare(`UPDATE portal SET stale = 1 WHERE portal_id = ?`).bind(current.portal_id).run();
        await env.DB.prepare(`
          INSERT INTO snapshot_run (portal_id, started_at, finished_at, rows_seen, rows_changed, ok, note)
          VALUES (?, ?, ?, 0, 0, 0, ?)
        `).bind(current.portal_id, new Date(startedAt).toISOString(), new Date().toISOString(), `Sync error: ${err.message}`).run();
        break;
      }

      totalSeen += pageResult.rowsSeen;
      totalChanged += pageResult.rowsChanged;

      const nextOffset = (current.sync_cursor || 0) + PAGE_LIMIT;
      await env.DB.prepare(`UPDATE portal SET sync_cursor = ? WHERE portal_id = ?`)
        .bind(pageResult.hasMore ? nextOffset : current.sync_cursor, current.portal_id).run();

      await env.DB.prepare(`
        INSERT INTO snapshot_run (portal_id, started_at, finished_at, rows_seen, rows_changed, ok, note)
        VALUES (?, ?, ?, ?, ?, 1, 'Chunk synced')
      `).bind(current.portal_id, new Date(startedAt).toISOString(), new Date().toISOString(), pageResult.rowsSeen, pageResult.rowsChanged).run();

      if (!pageResult.hasMore) {
        await finalizePortalSync(env, current, today);
        portalsCompleted.push(current.portal_id);
        break;
      }

      const refreshed: any = await env.DB.prepare(`SELECT * FROM portal WHERE portal_id = ?`).bind(current.portal_id).first();
      current = refreshed;
    }

    if (timedOut) break;
  }

  return { totalSeen, totalChanged, portalsTouched: Array.from(portalsTouched), portalsCompleted, timedOut };
}
