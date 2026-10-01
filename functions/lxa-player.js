// Keep-alive players ca Netlify Scheduled Function.
// Foloseste exact 3 conturi FIXE, cate unul per dificultate (1, 2, 3),
// ca sa previna cold-start / stergerea datelor de catre Netlify,
// fara sa creeze conturi noi la fiecare rulare si fara sa polueze leaderboard-ul.

const fetch = require('node-fetch');

const SPIN_COUNT = 2; // spinuri per cont, per rulare

// Cate un cont fix per nivel de dificultate (backend suporta doar 1-3).
// Parolele vin din env vars (Netlify > Site settings > Environment variables)
// ca sa nu stea in clar in sursa; fallback-urile de mai jos exista doar ca sa
// nu se rupa rularea daca env vars nu au fost inca setate, si trebuie
// rotite/setate ca env vars cat mai rapid.
const BOTS = [
  { name: 'LXA', safeWord: process.env.DROLLY_BOT_LXA_PW || 'Br1dgeApple7', difficulty: 1 },
  { name: 'AXL', safeWord: process.env.DROLLY_BOT_AXL_PW || 'C0baltRiver4', difficulty: 2 },
  { name: 'WOW', safeWord: process.env.DROLLY_BOT_WOW_PW || 'Ember0akTide9', difficulty: 3 }
];

async function drollRequest(action, data = {}) {
  const baseUrl = process.env.URL || 'http://localhost:8888';
  const response = await fetch(`${baseUrl}/.netlify/functions/drolly-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...data })
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error || `${action} failed`);
    error.statusCode = response.status;
    throw error;
  }
  return result;
}

// Login direct cu nume+parola fixe (backend-ul accepta acum login si prin
// name, nu doar prin id). Daca contul nu exista inca (prima rulare
// vreodata, backend-ul raspunde 401 "Name or password is incorrect"),
// creeaza contul o singura data si ii seteaza parola fixa. Orice alta
// eroare (500, timeout, retea) e propagata ca atare, ca sa nu incercam sa
// re-creem un cont care de fapt exista deja (ceea ce ar da 409 si ar rata
// rularea curenta pentru acest bot fara motiv).
async function getOrCreateBot(bot) {
  try {
    const result = await drollRequest('login', { name: bot.name, safeWord: bot.safeWord });
    return { account: result.account, safeWord: bot.safeWord };
  } catch (loginError) {
    if (loginError.statusCode !== 401 && loginError.statusCode !== 404) throw loginError;
    const result = await drollRequest('create', { name: bot.name });
    // Contul e creat cu o parola random; o setam pe cea fixa ca sa poata fi
    // gasit prin login-cu-nume la rularile viitoare.
    const updated = await drollRequest('update', { id: result.account.id, safeWord: result.safeWord, newSafeWord: bot.safeWord });
    return { account: updated.account, safeWord: bot.safeWord };
  }
}

async function runBot(bot) {
  const { account: initialAccount, safeWord } = await getOrCreateBot(bot);
  let account = initialAccount;
  const spins = [];

  for (let i = 0; i < SPIN_COUNT; i++) {
    if (account.balance < 5) {
      const reset = await drollRequest('reset-geld', { id: account.id, safeWord });
      account = reset.account;
    }
    const bet = Math.max(5, Math.min(100, Math.floor(account.balance)));
    const spinResult = await drollRequest('spin', {
      id: account.id,
      safeWord,
      bet,
      difficulty: bot.difficulty
    });
    account = spinResult.account;
    // netResult e in interiorul obiectului spin.netResult, nu la nivelul
    // radacina al raspunsului (asa e structurat de drolly-account.js) -
    // inainte cauta spinResult.netResult, care nu exista niciodata, deci
    // logul arata mereu net:0 chiar cand boti castigau/pierdeau real.
    spins.push({ net: spinResult.spin?.netResult ?? spinResult.gross - bet, balance: account.balance });
  }

  return {
    name: bot.name,
    difficulty: bot.difficulty,
    accountId: account.id,
    spins,
    finalBalance: account.balance,
    finalBank: account.bank
  };
}

exports.handler = async function (event, context) {
  try {
    const results = [];
    for (const bot of BOTS) {
      try {
        results.push(await runBot(bot));
      } catch (botError) {
        results.push({ name: bot.name, difficulty: bot.difficulty, error: botError.message });
      }
    }

    // Log explicit, pentru ca valoarea de retur a unei scheduled function nu
    // e garantat vizibila in Netlify (functiile programate nu trimit un
    // response body real cand ruleaza pe cron in productie). Fara acest
    // console.log, singurul semnal din logs era Duration/Memory Usage, fara
    // nicio confirmare daca boti au facut spin-uri cu succes sau au picat.
    console.log('[lxa-player] result:', JSON.stringify({ status: 'success', bots: results }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'success',
        bots: results,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('[lxa-player] fatal error:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message, timestamp: new Date().toISOString() })
    };
  }
};
