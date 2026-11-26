/**
 * Yorumi TMDB Edge Proxy (Cloudflare Worker)
 *
 * Deploy steps:
 *   1. cd cloudflare/tmdb-proxy
 *   2. npx wrangler secret put TMDB_READ_ACCESS_TOKEN
 *   3. npx wrangler deploy
 *   4. Bind custom domain (e.g. tmdb.yorumi.cloud) in Cloudflare Dashboard
 *   5. Set VITE_TMDB_PROXY_URL=https://tmdb.yorumi.cloud/3 in your app build env
 */

const TMDB_ORIGIN = 'https://api.themoviedb.org';
const CACHE_TTL_SECONDS = 60 * 60 * 24; // 24 hours edge cache

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Accept, Content-Type',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    if (!url.pathname.startsWith('/3/')) {
      return new Response('Not Found', { status: 404, headers: CORS_HEADERS });
    }

    const token = (env.TMDB_READ_ACCESS_TOKEN || '').trim();
    if (!token) {
      return new Response('TMDB proxy token not configured', { status: 503, headers: CORS_HEADERS });
    }

    const cache = caches.default;
    const cacheKey = new Request(url.toString(), { method: 'GET' });
    const cached = await cache.match(cacheKey);
    if (cached) {
      return cached;
    }

    const upstreamUrl = `${TMDB_ORIGIN}${url.pathname}${url.search}`;
    const upstream = await fetch(upstreamUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    const headers = new Headers(upstream.headers);
    Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));
    headers.delete('set-cookie');

    if (upstream.ok) {
      headers.set('Cache-Control', `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}`);
    } else {
      headers.set('Cache-Control', 'no-store');
    }

    const response = new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });

    if (upstream.ok) {
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    }

    return response;
  },
};
