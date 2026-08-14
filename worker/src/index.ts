import { Env } from './types';
import { handleVerifyRequest, handleBusinessSlugRequest, handleCoverageRequest, handleRollupRequest } from './api';
import { runIngestBudgeted } from './ingest';

function checkApiKey(req: Request, env: Env): boolean {
  const apiKey = req.headers.get('X-Api-Key');
  return !env.API_KEY || apiKey === env.API_KEY;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key'
        }
      });
    }

    if (url.pathname === '/v1/verify' && req.method === 'POST') {
      return handleVerifyRequest(req, env);
    }

    if (url.pathname.startsWith('/v1/business/') && req.method === 'GET') {
      return handleBusinessSlugRequest(url, env);
    }

    if (url.pathname === '/v1/coverage' && req.method === 'GET') {
      return handleCoverageRequest(env);
    }

    if (url.pathname === '/internal/rollup') {
      if (!checkApiKey(req, env)) {
        return new Response(JSON.stringify({ error: 'unauthorised' }), { status: 401 });
      }
      return handleRollupRequest(env);
    }

    if (url.pathname === '/internal/ingest' && req.method === 'POST') {
      if (!checkApiKey(req, env)) {
        return new Response(JSON.stringify({ error: 'unauthorised' }), { status: 401 });
      }
      try {
        const budgetMs = parseInt(url.searchParams.get('budget_ms') || '20000');
        const onlyPortal = url.searchParams.get('portal') || undefined;
        const stats = await runIngestBudgeted(env, budgetMs, onlyPortal);
        if (stats.portalsCompleted.length > 0) await handleRollupRequest(env);
        return new Response(JSON.stringify({ ok: true, stats }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ ok: false, error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({ error: 'not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  },

  async scheduled(_evt: ScheduledController, env: Env): Promise<void> {
    console.log('Starting daily scheduled municipal registry ingest cron...');
    try {
      const stats = await runIngestBudgeted(env, 25000);
      console.log(`Ingest tick finished. Seen ${stats.totalSeen}, changed ${stats.totalChanged}, completed [${stats.portalsCompleted.join(', ')}], timedOut=${stats.timedOut}.`);
      if (stats.portalsCompleted.length > 0) await handleRollupRequest(env);
    } catch (err: any) {
      console.error('Scheduled ingest error:', err);
    }
  }
};
