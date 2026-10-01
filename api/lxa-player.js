// Vercel Cron Job adapter - see api/drolly-account.js for why this wraps
// rather than rewrites the existing Netlify-style handler.
// See api/keep-alive.js for the CRON_SECRET check.
const { handler } = require('../functions/lxa-player.js');

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
