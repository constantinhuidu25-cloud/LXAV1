// Vercel Edge Middleware - replaces netlify.toml's [[redirects]] "block with
// 404" rules. Netlify could do this with simple to/status redirects because
// its redirects support a literal "respond 404" action; Vercel's redirects
// are 3xx-only, so an outright block needs middleware instead.
//
// SECURITY: this project's root is served as-is (no separate "public/"
// output directory), so without this, anything sitting in the repo root -
// business logic in functions/ (rate-limit internals, the SAFEWORD_PEPPER
// fallback), package.json/package-lock.json, test files, dev-only tooling
// (local-server.js, bot-player.js, audit-simulations.js, deployment-check.js),
// docs - would otherwise be publicly fetchable. This is a safety net, not a
// substitute for keeping real secrets out of the deployed tree entirely.
const BLOCKED = [
  /^\/functions\//,
  /^\/package(-lock)?\.json$/,
  /\.test\.js$/,
  /^\/local-server\.js$/,
  /^\/bot-player\.js$/,
  /^\/audit-simulations\.js$/,
  /^\/deployment-check\.js$/,
  /\.md$/,
  /\.bak$/,
  /^\/data\//,
  /^\/\.local-data\//,
  /^\/node_modules\//
];

export default function middleware(request) {
  const { pathname } = new URL(request.url);
  if (BLOCKED.some(pattern => pattern.test(pathname))) {
    return new Response('Not found', { status: 404 });
  }
}

export const config = {
  matcher: [
    '/functions/:path*',
    '/package.json',
    '/package-lock.json',
    '/:path*.test.js',
    '/local-server.js',
    '/bot-player.js',
    '/audit-simulations.js',
    '/deployment-check.js',
    '/:path*.md',
    '/:path*.bak',
    '/data/:path*',
    '/.local-data/:path*',
    '/node_modules/:path*'
  ]
};
