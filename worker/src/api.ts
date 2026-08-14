import { Env, InputRecord, StatusEventRow } from './types';
import { resolveRecords } from './resolve';

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    }
  });
}

export async function handleVerifyRequest(req: Request, env: Env): Promise<Response> {
  const apiKey = req.headers.get('X-Api-Key');
  if (env.API_KEY && apiKey !== env.API_KEY) {
    return jsonResponse({ error: 'unauthorised' }, 401);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const records: InputRecord[] = body?.records;
  if (!Array.isArray(records) || records.length === 0 || records.length > 200) {
    return jsonResponse({ error: 'records must be a non-empty array of up to 200 items' }, 400);
  }

  try {
    const results = await resolveRecords(records, env);
    const billableCount = results.filter(r => r.billable).length;

    return jsonResponse({
      results,
      billable_count: billableCount
    });
  } catch (err: any) {
    console.error('Verify error:', err);
    return jsonResponse({
      error: 'internal_error',
      message: err.message
    }, 500);
  }
}

export async function handleBusinessSlugRequest(url: URL, env: Env): Promise<Response> {
  const parts = url.pathname.split('/');
  const slug = parts[parts.length - 1];

  if (!slug) {
    return jsonResponse({ error: 'slug parameter required' }, 400);
  }

  const lic: any = await env.DB.prepare(
    `SELECT * FROM licence WHERE slug = ?`
  ).bind(slug).first();

  if (!lic) {
    return jsonResponse({ error: 'Business licence record not found' }, 404);
  }

  const portal: any = await env.DB.prepare(
    `SELECT jurisdiction, data_as_of, stale FROM portal WHERE portal_id = ?`
  ).bind(lic.portal_id).first();

  const events: StatusEventRow[] = (await env.DB.prepare(
    `SELECT observed_on, from_status, to_status, evidence FROM status_event WHERE licence_uid = ? ORDER BY event_id ASC`
  ).bind(lic.licence_uid).all()).results as any;

  return jsonResponse({
    licence: {
      slug: lic.slug,
      legal_name: lic.legal_name,
      dba_name: lic.dba_name,
      licence_number: lic.licence_number,
      jurisdiction: portal?.jurisdiction || lic.city,
      status_derived: lic.status_derived,
      status_raw: lic.status_raw,
      category: lic.category_norm || lic.category_raw,
      address: lic.addr_raw,
      city: lic.city,
      state: lic.state,
      zip5: lic.zip5,
      issued_date: lic.issued_date,
      start_date: lic.start_date,
      expiry_date: lic.expiry_date,
      end_date: lic.end_date,
      first_seen: lic.first_seen,
      last_seen: lic.last_seen,
      source_url: lic.source_url
    },
    history: events,
    coverage: {
      data_as_of: portal?.data_as_of || lic.last_seen,
      stale: Boolean(portal?.stale)
    }
  });
}

export async function handleCoverageRequest(env: Env): Promise<Response> {
  const portals: any[] = (await env.DB.prepare(`SELECT * FROM portal`).all()).results as any;
  const countRow: any = await env.DB.prepare(`SELECT count(*) as total FROM licence`).first();

  const jurisdictions = portals.map(p => ({
    portal_id: p.portal_id,
    jurisdiction: p.jurisdiction,
    domain: p.domain,
    closure_method: p.closure_method,
    data_as_of: p.data_as_of,
    last_sync_at: p.last_sync_at,
    row_count: p.last_sync_row_count || 0,
    stale: Boolean(p.stale),
    categories_in_scope: p.licensed_categories ? JSON.parse(p.licensed_categories) : "ALL"
  }));

  return jsonResponse({
    total_licences_indexed: countRow?.total || 0,
    jurisdictions
  });
}

export async function handleRollupRequest(env: Env): Promise<Response> {
  // Rebuild city_month_rollup aggregates from status_event
  await env.DB.prepare(`
    INSERT INTO city_month_rollup (portal_id, month, category_norm, opened, closed, lapsed, revoked)
    SELECT 
      l.portal_id,
      strftime('%Y-%m', se.observed_on) as month,
      COALESCE(l.category_norm, 'GENERAL') as category_norm,
      SUM(CASE WHEN se.to_status = 'ACTIVE' THEN 1 ELSE 0 END) as opened,
      SUM(CASE WHEN se.to_status = 'CLOSED' THEN 1 ELSE 0 END) as closed,
      SUM(CASE WHEN se.to_status = 'LAPSED' THEN 1 ELSE 0 END) as lapsed,
      SUM(CASE WHEN se.to_status = 'REVOKED' THEN 1 ELSE 0 END) as revoked
    FROM status_event se
    JOIN licence l ON se.licence_uid = l.licence_uid
    GROUP BY l.portal_id, month, category_norm
    ON CONFLICT(portal_id, month, category_norm) DO UPDATE SET
      opened = excluded.opened,
      closed = excluded.closed,
      lapsed = excluded.lapsed,
      revoked = excluded.revoked
  `).run();

  return jsonResponse({ ok: true, message: "pSEO aggregates rollup refreshed" });
}
