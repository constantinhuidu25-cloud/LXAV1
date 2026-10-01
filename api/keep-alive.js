// Vercel Cron Job adapter - see api/drolly-account.js for why this wraps
// rather than rewrites the existing Netlify-style handler.
//
// Vercel signs its own cron invocations with an "Authorization: Bearer
// <CRON_SECRET>" header when a CRON_SECRET env var is configured for the
// project (a Vercel-documented convention, not an invented one) - checked
// here so this isn't a fully public, freely-triggerable endpoint. Left
// open (same as the previous Netlify behavior, which had no such check)
// when CRON_SECRET isn't set, so this doesn't break before it's configured.
const { handler } = require('../functions/keep-alive.js');

module.exports = async (req, res) => {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const result = await handler({ httpMethod: req.method, headers: req.headers || {} });

  res.status(result.statusCode || 200);
  for (const [key, value] of Object.entries(result.headers || {})) {
    res.setHeader(key, value);
  }
  res.send(result.body ?? '');
};
