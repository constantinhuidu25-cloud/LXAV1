// Netlify Function care menține functions-urile active
// Se apelează automat din exterior pentru a preveni cold starts

const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  try {
    // Apelează propriul API pentru a-l menține activ
    const baseUrl = process.env.URL || 'http://localhost:8888';

    // Ping la leaderboard (read-only, safe)
    const response = await fetch(`${baseUrl}/.netlify/functions/drolly-account?action=leaderboard&difficulty=1`);
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
