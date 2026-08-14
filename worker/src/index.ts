import { Env } from './types';
import { handleVerifyRequest, handleBusinessSlugRequest, handleCoverageRequest, handleRollupRequest } from './api';
import { runIngest } from './ingest';

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
      const apiKey = req.headers.get('X-Api-Key');
      if (env.API_KEY && apiKey !== env.API_KEY) {
        return new Response(JSON.stringify({ error: 'unauthorised' }), { status: 401 });
      }
      return handleRollupRequest(env);
    }

    return new Response(JSON.stringify({ error: 'not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  },

  async scheduled(_evt: ScheduledController, env: Env): Promise<void> {
    console.log('Starting daily scheduled municipal registry ingest cron...');
    try {
      const stats = await runIngest(env);
      console.log(`Ingest finished cleanly. Processed ${stats.totalSeen} records, ${stats.totalChanged} status events.`);
      await handleRollupRequest(env);
    } catch (err: any) {
      console.error('Scheduled ingest error:', err);
    }
  }
};
