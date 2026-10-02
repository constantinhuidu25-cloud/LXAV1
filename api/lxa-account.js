// Vercel Node.js Serverless Function adapter for the account/game API.
//
// All real logic (auth, rate limiting, idempotency, spin resolution, admin
// actions) lives unchanged in ../functions/lxa-account.js, which was
// written for Netlify Functions' AWS-Lambda-style contract:
//   exports.handler = async (event) => ({ statusCode, headers, body })
// Vercel's Node.js functions instead use (req, res) like a plain Node HTTP
// handler. Rather than rewrite the business logic for a different request
// shape (real regression risk for zero functional benefit), this adapter
// translates one calling convention to the other and delegates everything
// else - the migration brief explicitly calls for preserving API
// behavior/auth/idempotency/rate limiting/response formats as-is.
const { handler } = require('../functions/lxa-account.js');

module.exports = async (req, res) => {
  const event = {
    httpMethod: req.method,
    queryStringParameters: req.query || {},
    headers: req.headers || {},
    // The handler does JSON.parse(event.body || '{}') itself - Vercel may
    // have already parsed a JSON body into req.body (an object) or left it
    // as a raw string/undefined depending on content-type, so normalize
    // either shape back into the JSON string form the handler expects.
    body: req.body === undefined || req.body === null
      ? ''
      : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body))
  };

  const result = await handler(event);

  res.status(result.statusCode || 200);
  for (const [key, value] of Object.entries(result.headers || {})) {
    res.setHeader(key, value);
  }
  res.send(result.body ?? '');
};
