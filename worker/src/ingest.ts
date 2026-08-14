import { Env, PortalRow, LicenceRow, LicenceStatus } from './types';
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

export async function runIngest(env: Env): Promise<{ totalSeen: number; totalChanged: number }> {
  await ensurePortalsSeeded(env);
  const portals: PortalRow[] = (await env.DB.prepare(`SELECT * FROM portal`).all()).results as any;

  const today = new Date().toISOString().slice(0, 10);
  let grandTotalSeen = 0;
  let grandTotalChanged = 0;

  for (const portal of portals) {
    const startedAt = new Date().toISOString();
    let rowsSeen = 0;
    let rowsChanged = 0;
    let ok = 1;
    let note = "Sync completed successfully";

    try {
      const fieldMap = JSON.parse(portal.field_map || '{}');
      const statusMap = portal.status_map ? JSON.parse(portal.status_map) : null;
      const seenUids = new Set<string>();

      const limit = 50000;
      let offset = 0;
      let hasMore = true;
      const rawRecords: any[] = [];

      while (hasMore) {
        let url = `https://${portal.domain}/resource/${portal.resource_id}.json?$limit=${limit}&$offset=${offset}&$order=:id`;
        const headers: Record<string, string> = {};
        if (env.SOCRATA_APP_TOKEN) {
          headers['X-App-Token'] = env.SOCRATA_APP_TOKEN;
        }

        const res = await fetch(url, { headers });
        if (!res.ok) {
          throw new Error(`Socrata fetch failed HTTP ${res.status}: ${res.statusText}`);
        }

        const batch: any[] = await res.json();
        if (!Array.isArray(batch) || batch.length === 0) {
          hasMore = false;
          break;
        }

        rawRecords.push(...batch);
        rowsSeen += batch.length;

        if (batch.length < limit) {
          hasMore = false;
        } else {
          offset += limit;
        }

        // Safety cap for initial free-tier D1 backfill
        if (offset >= 100000) break;
      }

      // Process batch rows
      for (const row of rawRecords) {
        const sourcePk = row[fieldMap.source_pk] || row['id'];
        if (!sourcePk) continue;

        const licenceUid = `${portal.portal_id}:${sourcePk}`;
        seenUids.add(licenceUid);

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

        // Check previous state
        const prev: any = await env.DB.prepare(
          `SELECT status_derived FROM licence WHERE licence_uid = ?`
        ).bind(licenceUid).first();

        if (!prev) {
          // New Licence record
          await env.DB.prepare(`
            INSERT INTO licence (
              licence_uid, portal_id, source_pk, licence_number, legal_name, dba_name,
              name_norm, addr_raw, house_number, street_norm, unit, city, state, zip5,
              category_raw, category_norm, status_raw, status_derived, issued_date,
              start_date, expiry_date, end_date, first_seen, last_seen, missing_streak,
              source_url, slug, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
          `).bind(
            licenceUid, portal.portal_id, sourcePk, row[fieldMap.licence_number] || sourcePk,
            legalName, dbaName, nameNorm, rawAddr || null, house_number, street_norm, unit,
            city, state, zip5, categoryRaw, categoryRaw, statusRaw, statusDerived,
            issuedDate, startDate, expiryDate, endDate, today, today, sourceUrl, slug, today
          ).run();

          await env.DB.prepare(`
            INSERT OR IGNORE INTO status_event (licence_uid, observed_on, from_status, to_status, evidence)
            VALUES (?, ?, NULL, ?, 'Initial ingestion observed')
          `).bind(licenceUid, today, statusDerived).run();

          rowsChanged++;
        } else {
          // Update last seen
          await env.DB.prepare(`
            UPDATE licence SET 
              last_seen = ?, missing_streak = 0, status_derived = ?, status_raw = ?, updated_at = ?
            WHERE licence_uid = ?
          `).bind(today, statusDerived, statusRaw, today, licenceUid).run();

          if (prev.status_derived !== statusDerived) {
            await env.DB.prepare(`
              INSERT OR IGNORE INTO status_event (licence_uid, observed_on, from_status, to_status, evidence)
              VALUES (?, ?, ?, ?, 'Status transition detected during sync')
            `).bind(licenceUid, today, prev.status_derived, statusDerived).run();
            rowsChanged++;
          }
        }
      }

      // Delta closure pass for 'delta' closure_method (e.g., Los Angeles)
      if (portal.closure_method === 'delta') {
        const missingStreakLimit = parseInt(env.MISSING_STREAK_CLOSED || '3');

        // Increment missing_streak for rows in this portal not seen today
        await env.DB.prepare(`
          UPDATE licence 
          SET missing_streak = missing_streak + 1 
          WHERE portal_id = ? AND last_seen < ?
        `).bind(portal.portal_id, today).run();

        // Flag as CLOSED for rows reaching missing_streak limit
        const closingRows: LicenceRow[] = (await env.DB.prepare(`
          SELECT * FROM licence 
          WHERE portal_id = ? AND missing_streak >= ? AND status_derived != 'CLOSED'
        `).bind(portal.portal_id, missingStreakLimit).all()).results as any;

        for (const cRow of closingRows) {
          await env.DB.prepare(`
            UPDATE licence SET status_derived = 'CLOSED', updated_at = ? WHERE licence_uid = ?
          `).bind(today, cRow.licence_uid).run();

          await env.DB.prepare(`
            INSERT OR IGNORE INTO status_event (licence_uid, observed_on, from_status, to_status, evidence)
            VALUES (?, ?, ?, 'CLOSED', ?)
          `).bind(cRow.licence_uid, today, cRow.status_derived, `Absent from ${missingStreakLimit} consecutive snapshots`).run();

          rowsChanged++;
        }
      }

      // Store raw NDJSON snapshot in R2 if bucket binding present
      if (env.SNAPSHOTS && rawRecords.length > 0) {
        const ndjson = rawRecords.map(r => JSON.stringify(r)).join('\n');
        await env.SNAPSHOTS.put(`snapshots/${portal.portal_id}/${today}.ndjson`, ndjson);
      }

      // Update portal status
      await env.DB.prepare(`
        UPDATE portal SET last_sync_at = ?, last_sync_row_count = ?, data_as_of = ?, stale = 0 WHERE portal_id = ?
      `).bind(startedAt, rowsSeen, today, portal.portal_id).run();

    } catch (err: any) {
      ok = 0;
      note = `Sync error: ${err.message}`;
      console.error(`Portal sync error for ${portal.portal_id}:`, err);

      // Flag portal as stale, keep API serving
      await env.DB.prepare(`UPDATE portal SET stale = 1 WHERE portal_id = ?`).bind(portal.portal_id).run();
    } finally {
      const finishedAt = new Date().toISOString();
      await env.DB.prepare(`
        INSERT INTO snapshot_run (portal_id, started_at, finished_at, rows_seen, rows_changed, ok, note)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(portal.portal_id, startedAt, finishedAt, rowsSeen, rowsChanged, ok, note).run();

      grandTotalSeen += rowsSeen;
      grandTotalChanged += rowsChanged;
    }
  }

  return { totalSeen: grandTotalSeen, totalChanged: grandTotalChanged };
}
