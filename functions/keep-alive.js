// Scheduled function (Vercel Cron Job via api/keep-alive.js) care menține
// API-ul activ. Se apelează automat din exterior pentru a preveni cold starts.

const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  try {
    // Apelează propriul API pentru a-l menține activ. VERCEL_URL e injectat
    // automat de Vercel (doar host, fără protocol) - spre deosebire de
    // Netlify's `URL`, care includea deja https://.
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';

    // Ping la leaderboard (read-only, safe)
    const response = await fetch(`${baseUrl}/api/drolly-account?action=leaderboard&difficulty=1`);
    const data = await response.json();

    console.log('[Keep-Alive] Pinged drolly-account successfully');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: 'alive',
        timestamp: new Date().toISOString(),
        leaderboardSize: data.records?.length || 0
      })
    };

  } catch (error) {
    console.error('[Keep-Alive] Error:', error.message);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};
