const crypto = require('crypto');
const { checkRateLimit, checkGlobalRateLimit, auditAction, detectFraud, sanitizeInput, validateBet, idempotencyCache } = require('./security.js');
const { getAccounts, saveAccounts, getLeaderboard, saveLeaderboard, updateAccount, getRtpSettings, saveRtpSettings } = require('./firebase-storage');
const game = require('../game-engine.js');
// v143: admin status lives on the account record itself (accounts/{id}/role
// in Firebase), never on the id. There is no hardcoded admin id anywhere -
// set role:"admin" on the desired account directly in the Firebase Console
// to grant it, or role:"user" (or just delete the field) to revoke it. This
// check always runs against the account object freshly read from Firebase
// server-side, never against anything the client claims, so it can't be
// spoofed by editing client-side state.
const isAdminAccount = account => Boolean(account) && account.role === 'admin';

const MAX_WILD_LEVEL = 50, RESET_LIMIT = 25000, RESET_AMOUNT = 250000, TARGET = 'LEONXOXANA'.split('');
// GELD LIMITER (v135) — scaffolding only, OFF by default.
// enabled:false => behavior is unchanged from before: GELD is usable any time
// balance <= RESET_LIMIT, with no cooldown and no per-day cap.
// To turn it on later: set enabled:true and tune the two numbers below.
// cooldownHours: minimum time between two GELD uses.
// maxUsesPerDay: max GELD activations counted in a rolling 24h window.
// Both are enforced together (a use must satisfy both) using a timestamp
// history stored per-account, so this is authoritative server-side and
// cannot be bypassed by clearing local storage in the browser.
const GELD_LIMITS = Object.freeze({ enabled: false, cooldownHours: 24, maxUsesPerDay: 1 });
// v148: PAYTABLE, JACKPOT_TIER_MULTIPLIERS and PAYTABLE_WILD_CAP used to be
// separate hardcoded copies here too (same drift risk as the v142 note
// below already caught once for the odds table) - now all three, plus
// wildChance()/wildUpgradeCost(), are read live from game-engine.js so an
// admin's payout/jackpot-value/wild-cap/wild-chance changes actually reach
// logged-in players, not just guests.
// v142: the per-difficulty bucket table used to live here as its own
// hardcoded copy, separate from game-engine.js's - they drifted out of sync
// (this copy silently kept the pre-RTP-redesign numbers). Now sourced live
// from game-engine.js (see applyRtpSettings below), so there is exactly one
// place the odds are defined, whether an admin has customized them or not.
const json = (body, statusCode = 200) => ({ statusCode, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'Content-Type' }, body: JSON.stringify(body) });
// eslint-disable-next-line no-control-regex
const cleanName = value => sanitizeInput(String(value || '').trim().replace(/\s+/g, ' '), 30), nameKey = value => cleanName(value).toLocaleLowerCase('en-US'), safeKey = value => String(value || '').trim().toLocaleLowerCase('en-US'), slugName = value => String(value || '').trim().replace(/[.$#[\]/\u0000-\u001f\u007f]/g, '-').replace(/\s+/g, ' ').slice(0, 40), accountKey = (id, name) => `${Math.floor(Number(id)) || 0}${slugName(name) ? ' : ' + slugName(name) : ''}`;
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback, money = value => Math.round(number(value) * 100) / 100, difficulty = value => Math.min(3, Math.max(1, Math.floor(number(value, 2))));
const DIFFICULTY_PROFILE_VERSION = 3;
const words = ['Tiger','Panda','Wolf','Eagle','Fox','Lion','Bear','Rocket','Key','Crown','Coin','Star','Pizza','Apple','Cookie','Coffee','Banana','Moon','Ocean','Galaxy','Thunder','Fire','Forest','Falcon','Otter','Badger','Beaver','Bison','Camel','Cobra','Coyote','Dolphin','Donkey','Dragon','Ferret','Gecko','Giraffe','Gorilla','Hamster','Hawk','Hippo','Jaguar','Koala','Lemur','Leopard','Lizard','Llama','Lobster','Lynx','Moose','Octopus','Owl','Parrot','Pelican','Penguin','Puma','Rabbit','Raven','Rhino','Salmon','Shark','Sparrow','Squid','Swan','Turtle','Walrus','Whale','Zebra','Anchor','Arrow','Barrel','Basket','Bell','Blanket','Bottle','Bridge','Bucket','Candle','Castle','Chair','Clock','Compass','Diamond','Drum','Engine','Feather','Flag','Garden','Guitar','Hammer','Harbor','Helmet','Island','Jacket','Kettle','Ladder','Lantern','Magnet','Mirror','Needle','Paddle','Pencil','Piano','Pillow','Planet','Pocket','Pyramid','Ribbon','Saddle','Shield','Silver','Socket','Spoon','Statue','Tower','Trumpet','Tunnel','Violin','Wagon','Window','Almond','Bagel','Berry','Butter','Carrot','Cherry','Cocoa','Honey','Lemon','Mango','Melon','Muffin','Olive','Onion','Peach','Pepper','Pretzel','Tomato','Waffle','Canyon','Cloud','Comet','Desert','Glacier','Meadow','River','Summit','Valley','Volcano','Breeze','Frost','Rainbow','Sunset','Meteor'];
const makeSafeWord = () => `${words[Math.floor(Math.random() * words.length)]}${words[Math.floor(Math.random() * words.length)]}`;
const blankDifficulty = () => Object.fromEntries([1, 2, 3].map(level => [String(level), { score: 0, spins: 0, wins: 0, lastPlayed: 0 }]));
// v137 SECURITY: the password (internal name kept: safeWord) is stored ONLY as
// a salted+peppered SHA-256 hash in the same `safeWord` field, format
// `sha256$<salt>$<hex>`. Fast hash on purpose: brute force is stopped by the
// per-account attempt limiter below, not by a slow hash. Legacy plaintext
// values are accepted once and re-hashed on the next successful check.
// LXA_PEPPER must never change once accounts exist (changing it
// invalidates every stored password).
const SAFEWORD_PEPPER = process.env.LXA_PEPPER || 'drolly-v137-default-pepper';
if (!process.env.LXA_PEPPER && process.env.VERCEL_ENV === 'production') console.warn('LXA_PEPPER is not set in this production environment: the built-in default pepper is in use.');
const SAFEWORD_MAX_FAILS = 5, SAFEWORD_LOCK_MS = 15 * 60 * 1000;
const hashSafeWord = (plain, salt = crypto.randomBytes(16).toString('hex')) => `sha256$${salt}$${crypto.createHash('sha256').update(`${SAFEWORD_PEPPER}:${salt}:${safeKey(plain)}`).digest('hex')}`;
const safeWordMatches = (stored, plain) => { const given = safeKey(plain); if (!stored || !given) return false; const text = String(stored); if (!text.startsWith('sha256$')) return safeKey(text) === given; const salt = text.split('$')[1] || '', a = Buffer.from(hashSafeWord(given, salt)), b = Buffer.from(text); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const safeWordLocked = account => number(account.safeWordLockUntil) > Date.now();
const lockedResponse = account => json({ error: `Too many wrong password attempts. Try again in ${Math.ceil((number(account.safeWordLockUntil) - Date.now()) / 60000)} min.` }, 429);
// Checks the password for `account`. Returns null on success (counter reset,
// legacy plaintext migrated to hash — caller saves), or an error response.
// Wrong attempts are counted per account on the server and persisted here.
async function checkSafeWord(account, plain) {
  if (safeWordLocked(account)) return lockedResponse(account);
  if (!String(plain ?? '').trim()) return json({ error: 'Password required.' }, 401);
  if (!safeWordMatches(account.safeWord, plain)) {
    account.safeWordFails = number(account.safeWordFails) + 1;
    if (account.safeWordFails >= SAFEWORD_MAX_FAILS) { account.safeWordFails = 0; account.safeWordLockUntil = Date.now() + SAFEWORD_LOCK_MS; }
    await save(account); return json({ error: 'Wrong password.' }, 401);
  }
  account.safeWordFails = 0; account.safeWordLockUntil = 0;
  if (!String(account.safeWord).startsWith('sha256$')) account.safeWord = hashSafeWord(plain);
  return null;
}
const publicAccount = account => { if (!account) return null; const { safeWord, sessionToken, ...safe } = account; return safe; };
// v151: per-device "remember me" credential, separate from the real
// password. Issued at account creation and on every real (password-based)
// login/password change; the client caches it locally and sends it back to
// silently restore a session or to spin without re-typing the password. A
// device that never proved the real password never gets one, so guessing an
// id alone no longer grants read or spin access to someone else's account.
const makeSessionToken = () => crypto.randomBytes(24).toString('hex');
const tokenMatches = (account, given) => { const stored = String(account?.sessionToken || ''), token = String(given || ''); if (!stored || !token) return false; const a = Buffer.from(stored), b = Buffer.from(token); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const defaults = account => {
  const needsOriginalScaleMigration = number(account.difficultyProfileVersion, 1) < 2;
  account.balance = money(account.balance ?? 250); account.bank = money(account.bank ?? 0); account.wildLevel = Math.max(0, Math.min(MAX_WILD_LEVEL, Math.floor(number(account.wildLevel ?? account.wildInventory)))); account.wildInventory = account.wildLevel; account.difficulty = needsOriginalScaleMigration ? ({ 1: 2, 2: 3, 3: 3 }[difficulty(account.difficulty ?? 2)] || 2) : difficulty(account.difficulty ?? 2); account.difficultyProfileVersion = DIFFICULTY_PROFILE_VERSION;
  account.records = Array.isArray(account.records) ? account.records.slice(0, 5).map(v => Math.max(0, Math.min(10, Math.floor(number(v))))) : [0, 0, 0, 0, 0]; while (account.records.length < 5) account.records.push(0);
  const savedCompletedLines = Array.isArray(account.completedLines) ? Array.from({ length: 5 }, (_, index) => Boolean(account.completedLines[index])) : null; account.completedLines = savedCompletedLines || Array.from({ length: 5 }, (_, index) => index < Math.max(0, Math.min(5, Math.floor(number(account.jackpotProgress, 0))))); account.jackpotProgress = account.completedLines.filter(Boolean).length;
  account.jackpotFinished = false; account.stats = { spins: 0, wins: 0, totalWon: 0, ...(account.stats || {}) }; account.history = Array.isArray(account.history) ? account.history.slice(0, 20) : []; account.difficultyData = { ...blankDifficulty(), ...(account.difficultyData || {}) };
  // GELD LIMITER (v135): timestamps (ms) of past GELD uses, newest first.
  // Only ever read/written when GELD_LIMITS.enabled is true; harmless no-op otherwise.
  account.geldHistory = Array.isArray(account.geldHistory) ? account.geldHistory.slice(0, 50) : [];
  return account;
};
function findEntryById(accounts, id) { const wanted = Number(id); if (!Number.isFinite(wanted)) return null; return Object.entries(accounts || {}).find(([, acc]) => acc && Number(acc.id) === wanted) || null; }
const rememberKey = (account, key) => Object.defineProperty(account, '__key', { value: key, enumerable: false, writable: true, configurable: true });
async function read(id) { const accounts = await getAccounts(); const entry = findEntryById(accounts, id); if (!entry) return null; return rememberKey(defaults(entry[1]), entry[0]); }
// v325 SECURITY FIX: was a plain read-ALL-accounts -> mutate one -> overwrite
// the WHOLE collection (`ref.set(accounts)`). Two concurrent requests for
// TWO DIFFERENT accounts could each read the same collection snapshot and
// the second save() would silently discard the first request's entire
// account (lost update across unrelated accounts). Scoping the write to a
// single `accounts/{accountKey}` transaction removes that cross-account
// race entirely. Note this does not add full serialization for two
// concurrent requests on the SAME account (rare: needs two tabs/devices
// firing in the same instant) - the client already guards against the
// common case (double-click/double-tap) by disabling the spin button for
// the duration of a request (see renderer.js lxaAccountSpinV76).
// Node key = "<id> : <name>" (e.g. "25 : ANA") and is refreshed whenever the ID or name changes (or a hand-edited / legacy `account:N` node is saved).
async function save(account, keepStamp) {
  if (!keepStamp) account.updatedAt = Date.now();
  const plain = () => JSON.parse(JSON.stringify(account));
  const newKey = accountKey(account.id, account.name), oldKey = account.__key;
  if (oldKey && oldKey !== newKey) {
    let moved = false;
    try { await updateAccount(newKey, current => (current && current.createdAt !== account.createdAt) ? undefined : plain()); moved = true; } catch (error) { /* target key busy: keep the node where it is */ }
    if (moved) { await updateAccount(oldKey, () => null); rememberKey(account, newKey); return; }
    await updateAccount(oldKey, () => plain());
    return;
  }
  await updateAccount(newKey, () => plain());
  rememberKey(account, newKey);
}
const LEADERBOARD_EXCLUDED_NAMES = new Set(['LXA', 'AXL', 'WOW']);
async function leaderboard(account) { const level = String(account.difficulty), boardKey = `leaderboard:profile-${DIFFICULTY_PROFILE_VERSION}:${level}`, boards = await getLeaderboard({ strict: true }), board = boards[boardKey] || [], next = board.filter(row => Number(row.id) !== Number(account.id)); if (!LEADERBOARD_EXCLUDED_NAMES.has(String(account.name || '').toUpperCase())) { next.push({ id: account.id, name: account.name, score: number(account.difficultyData[level]?.score), updatedAt: account.updatedAt }); } next.sort((a, b) => number(b.score) - number(a.score) || number(a.updatedAt) - number(b.updatedAt)); boards[boardKey] = next.slice(0, 100); await saveLeaderboard(boards); }
// v148: reads ALL admin-set game settings from Firebase (falls back to
// game-engine.js's defaults for anything not stored) and applies them to
// game-engine.js's live state before a spin is resolved - RTP per
// difficulty (existing), jackpot frequency per difficulty, wild
// chance/per-level/cap, and the payout/jackpot-value multipliers. Every
// field is independently optional; a missing one just means "use default"
// for that one knob, not for the whole settings object.
async function applyRtpSettings() {
  let settings = {};
  try { settings = (await getRtpSettings()) || {}; } catch { settings = {}; }
  [1, 2, 3].forEach(d => {
    const raw = settings[d] ?? settings[String(d)];
    if (raw !== undefined && Number.isFinite(Number(raw))) game.setDifficultyRtp(d, Number(raw));
    else game.resetDifficultyRtp(d);
  });
  const customDistribution = settings.customDistribution || {};
  [1, 2, 3].forEach(d => {
    const buckets = customDistribution[d] ?? customDistribution[String(d)];
    if (buckets) game.setCustomDistribution(d, buckets);
    else game.resetCustomDistribution(d);
  });
  const jackpotFreq = settings.jackpotFreq || {};
  [1, 2, 3].forEach(d => {
    const raw = jackpotFreq[d] ?? jackpotFreq[String(d)];
    if (raw !== undefined && Number.isFinite(Number(raw))) game.setJackpotFrequency(d, Number(raw));
    else game.resetJackpotFrequency(d);
  });
  if (settings.wildChance !== undefined && Number.isFinite(Number(settings.wildChance))) game.setWildChancePercent(Number(settings.wildChance));
  else game.resetWildChancePercent();
  if (settings.wildPerLevel !== undefined && Number.isFinite(Number(settings.wildPerLevel))) game.setWildPerLevelPercent(Number(settings.wildPerLevel));
  else game.resetWildPerLevelPercent();
  if (settings.wildCap !== undefined && Number.isFinite(Number(settings.wildCap))) game.setWildCap(Number(settings.wildCap));
  else game.resetWildCap();
  if (settings.wildCostMult !== undefined && Number.isFinite(Number(settings.wildCostMult))) game.setWildCostMultiplier(Number(settings.wildCostMult));
  else game.resetWildCostMultiplier();
  if (settings.extraWildFreq !== undefined && Number.isFinite(Number(settings.extraWildFreq))) game.setExtraWildFrequency(Number(settings.extraWildFreq));
  else game.resetExtraWildFrequency();
  if (settings.payoutMult !== undefined && Number.isFinite(Number(settings.payoutMult))) game.setPayoutMultiplier(Number(settings.payoutMult));
  else game.resetPayoutMultiplier();
  if (settings.jackpotValueMult !== undefined && Number.isFinite(Number(settings.jackpotValueMult))) game.setJackpotValueMultiplier(Number(settings.jackpotValueMult));
  else game.resetJackpotValueMultiplier();
  return settings;
}
function applyWild(results, level) { const wildLevel = Math.max(0, Math.min(MAX_WILD_LEVEL, Math.floor(number(level)))); const chance = game.wildChance(wildLevel), naturalCount = Math.random() < chance ? 1 : 0, maximumExtra = Math.min(wildLevel, 50 - naturalCount); let levelCount = 0; const pick = (low, high) => low + Math.floor(Math.random() * (high - low + 1)); if (maximumExtra <= 2) levelCount = pick(0, maximumExtra); else { const roll = Math.random(); if (roll < .78) levelCount = pick(0, Math.min(2, maximumExtra)); else if (roll < .98) levelCount = pick(3, Math.min(8, maximumExtra)); else levelCount = pick(Math.min(9, maximumExtra), maximumExtra); } levelCount = Math.max(0, Math.min(maximumExtra, Math.round(levelCount * game.EXTRA_WILD_FREQUENCY))); const totalCount = naturalCount + levelCount, cells = Array.from({ length: 50 }, (_, index) => ({ line: Math.floor(index / 10), column: index % 10 })), wilds = []; for (let index = 0; index < totalCount; index++) { const swapIndex = index + Math.floor(Math.random() * (cells.length - index)); [cells[index], cells[swapIndex]] = [cells[swapIndex], cells[index]]; wilds.push({ ...cells[index], source: index === 0 && naturalCount ? 'natural' : 'level' }); } const perLine = [0, 0, 0, 0, 0]; wilds.forEach(wild => { perLine[wild.line]++; }); return { results: results.map((hits, line) => Math.min(10, hits + perLine[line])), paytableResults: results.map((hits, line) => Math.min(10, hits + Math.min(perLine[line], game.PAYTABLE_WILD_CAP))), wildAssistedTen: results.map((hits, line) => hits < 10 && Math.min(10, hits + perLine[line]) === 10), lineHasWild: perLine.map(count => count > 0), wilds, chance, naturalCount, levelCount, totalCount }; }
// v158 (user request): miss cells must only ever show a LXA letter
// - never 'X' or any character outside D/R/O/L/I/N/G/E. Was sending a
// literal 'X' placeholder for every miss cell, which renderer.js then
// mapped to an ad-hoc fallback alphabet (A,B,C,F,H,J,K - NOT in
// LXA) purely client-side; the guest-only path (game-engine.js's
// makeBoard) already did this correctly (a random LXA letter,
// never the correct one for that column, never 'X'). Matches that same
// logic here so both paths render identically and only real LXA
// letters ever appear.
const ALT_LETTERS = [...new Set(TARGET)];
function makeGrid(results, wilds) { const grid = results.map(hits => TARGET.map((letter, column) => { if (column < hits) return letter; const options = ALT_LETTERS.filter(candidate => candidate !== letter); return options[Math.floor(Math.random() * options.length)]; })); wilds.forEach(wild => { grid[wild.line][wild.column] = '__BONUS_WILD__'; }); return grid; }

exports.handler = async event => {
  // Handle OPTIONS preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'Content-Type'
      },
      body: ''
    };
  }
  try {
    const input = event.httpMethod === 'GET' ? (event.queryStringParameters || {}) : JSON.parse(event.body || '{}'), action = input.action || 'leaderboard';
    // v138 SECURITY: wire up the previously-unused rate limiter (security.js
    // was imported but never called). Global cap first, then a per-action
    // cap for abuse-prone actions. 'login' is only rate-limited on real
    // (non-silent) attempts - lxaRestoreSession() calls action:'login'
    // with silent:true on every page load, so counting those against the
    // limit would log real users out just for reloading the page.
    if (!checkGlobalRateLimit()) return json({ error: 'Server is busy. Please try again in a moment.' }, 429);
    // Vercel overwrites x-forwarded-for / x-vercel-forwarded-for / x-real-ip with the real client address. The old Netlify-only
    // x-nf-client-connection-ip header is NOT set by Vercel, so honouring it let any caller pick their own "IP" and dodge the
    // per-IP login / account-creation limits.
    const reqHeaders = event.headers || {};
    const clientIp = String(reqHeaders['x-vercel-forwarded-for'] || reqHeaders['x-real-ip'] || (reqHeaders['x-forwarded-for'] || '').split(',')[0] || '').trim() || 'unknown';
    const RATE_LIMITED_ACTIONS = { create: 'CREATE_ACCOUNT', spin: 'SPIN', 'buy-wild': 'BUY_WILD' };
    if (RATE_LIMITED_ACTIONS[action]) {
      const rlType = RATE_LIMITED_ACTIONS[action], rlKey = `${rlType}:${action === 'create' ? clientIp : (input.id ?? clientIp)}`;
      if (!checkRateLimit(rlType, rlKey)) return json({ error: 'Too many requests. Please slow down and try again shortly.' }, 429);
    } else if (action === 'login' && input.silent !== true) {
      if (!checkRateLimit('LOGIN_ATTEMPT', `LOGIN_ATTEMPT:${clientIp}`)) return json({ error: 'Too many login attempts. Please try again later.' }, 429);
    }
    if (action === 'create') { const name = cleanName(input.name); if (name.length < 2) return json({ error: 'Name must contain at least 2 characters.' }, 400); const accounts = await getAccounts(); const nameExists = Object.values(accounts).some(acc => nameKey(acc.name) === nameKey(name)); if (nameExists) return json({ error: 'This name is already in use.' }, 409); const existingIds = Object.values(accounts).map(acc => Number(acc && acc.id)).filter(id => id >= 11); let id = Math.max(11, ...existingIds, 10) + 1; const plainSafeWord = makeSafeWord(), token = makeSessionToken(); const account = defaults({ id, name, safeWord: hashSafeWord(plainSafeWord), sessionToken: token, role: 'user', balance: 250, bank: 0, wildLevel: 0, difficulty: 2, difficultyProfileVersion: DIFFICULTY_PROFILE_VERSION, records: [0, 0, 0, 0, 0], jackpotProgress: 0, jackpotFinished: false, stats: {}, history: [], difficultyData: blankDifficulty(), createdAt: Date.now() }); await save(account); return json({ account: publicAccount(account), safeWord: plainSafeWord, token }); }
    if (action === 'login') {
      let account = null;
      if (input.id !== undefined && input.id !== null && String(input.id).trim() !== '') {
        account = await read(input.id);
        if (!account) return json({ error: 'ID not found.' }, 404);
        // v151: "silent" restore lets the browser re-open a session on page
        // load using only the cached id, with no password - used ONLY by
        // lxaRestoreSession() right after a fresh page load, never from a
        // user-facing login form. It used to skip authentication entirely
        // (any guessed id could silently read the full account) - now it
        // requires the per-device sessionToken issued at the last real
        // (password-based) login instead of the real password, so a device
        // that never actually logged in can't restore anything, but the
        // legitimate device never has to re-type the password either.
        if (input.silent === true) {
          if (!tokenMatches(account, input.token)) return json({ error: 'Session expired.' }, 401);
          await save(account);
          return json({ account: publicAccount(account) });
        }
        // v158 (user request): ID+Name (no password) is now a third valid
        // login combination - any 2 of {id, name, password} works. Accepted
        // residual risk: ids are small sequential integers (never displayed
        // anywhere, but guessable within a narrow range) and names ARE
        // shown on the leaderboard, so this is weaker than a real password -
        // but the existing LOGIN_ATTEMPT rate limit (10/hour per IP, see
        // above) already bounds how many ids an attacker can try per hour,
        // and this demo has no real money at stake. Falls through to the
        // normal password check if the provided name doesn't match this
        // id's account (or no name was provided at all).
        const idNameMatch = input.name !== undefined && String(input.name).trim() !== '' && nameKey(account.name) === nameKey(input.name);
        if (!idNameMatch) {
          const denied = await checkSafeWord(account, input.safeWord); if (denied) return denied;
        }
        if (!account.sessionToken) account.sessionToken = makeSessionToken();
        await save(account);
      } else if (input.name !== undefined && String(input.name).trim() !== '') {
        const accounts = await getAccounts();
        account = Object.values(accounts).find(acc => nameKey(acc.name) === nameKey(input.name));
        if (!account) return json({ error: 'Name or password is incorrect.' }, 401);
        account = defaults(account);
        const denied = await checkSafeWord(account, input.safeWord);
        if (denied) return denied.statusCode === 429 ? denied : json({ error: 'Name or password is incorrect.' }, 401);
        if (!account.sessionToken) account.sessionToken = makeSessionToken();
        await save(account);
      } else {
        return json({ error: 'ID or name required.' }, 400);
      }
      return json({ account: publicAccount(account), token: account.sessionToken });
    }
    // v151: self-service "recover with id+name, no password" was removed.
    // It was exactly as strong as a full login (it handed back a brand-new
    // working password), so it was really a fourth login method wearing a
    // "recovery" label - and unlike the real id+password / name+password
    // logins, its two proof values (a small guessable sequential id, a name
    // publicly visible on the leaderboard) are both guessable/visible to
    // other players. Keeping it meant a real password added no protection
    // beyond what id+name alone already gave away. A genuinely forgotten
    // password now has to go through the site admin (Admin Panel > PLAYERS
    // > edit), who resets it manually after confirming identity out of band.
    if (action === 'update') { const account = await read(input.id); if (!account) return json({ error: 'ID not found.' }, 404); { const denied = await checkSafeWord(account, input.safeWord); if (denied) return denied; } const next = input.name === undefined ? account.name : cleanName(input.name); if (next.length < 2) return json({ error: 'Name must contain at least 2 characters.' }, 400); if (nameKey(next) !== nameKey(account.name)) { const accounts = await getAccounts(); const nameExists = Object.values(accounts).some(acc => acc.id !== account.id && nameKey(acc.name) === nameKey(next)); if (nameExists) return json({ error: 'This name is already in use.' }, 409); } account.name = next; if (input.newSafeWord !== undefined && String(input.newSafeWord).trim()) { account.safeWord = hashSafeWord(String(input.newSafeWord).trim().slice(0, 40)); account.sessionToken = makeSessionToken(); } await save(account); return json({ account: publicAccount(account), token: account.sessionToken }); }
    // v159 SECURITY FIX: this was the only mutating action with no auth check
    // at all - anyone who knew (or guessed, ids are small sequential ints)
    // an account's id could change ITS difficulty with no token and no
    // password. Gated the same way 'spin' already is: the device's session
    // token first (so the normal in-game difficulty picker keeps working
    // silently), falling back to the real password for callers without one.
    if (action === 'set-difficulty') { const account = await read(input.id); if (!account) return json({ error: 'ID not found.' }, 404); if (!tokenMatches(account, input.token)) { const denied = await checkSafeWord(account, input.safeWord); if (denied) return denied; } account.difficulty = difficulty(input.difficulty); await save(account); return json({ account: publicAccount(account) }); }
    if (action === 'deposit') { const account = await read(input.id); if (!account) return json({ error: 'ID not found.' }, 404); { const denied = await checkSafeWord(account, input.safeWord); if (denied) return denied; } const idemKey = input.requestId ? `deposit:${account.id}:${input.requestId}` : null; if (idemKey) { const cached = idempotencyCache.get(idemKey); if (cached) return json(cached); } const amount = money(input.amount); if (!Number.isFinite(amount) || amount <= 0 || amount > account.balance) return json({ error: 'Invalid amount or insufficient GUTHABEN.' }, 400); account.balance = money(account.balance - amount); account.bank = money(account.bank + amount); await save(account); const depositResponseBody = { account: publicAccount(account) }; if (idemKey) idempotencyCache.set(idemKey, depositResponseBody); return json(depositResponseBody); }
    if (action === 'reset-geld') {
      const account = await read(input.id); if (!account) return json({ error: 'ID not found.' }, 404);
      if (account.balance > RESET_LIMIT) return json({ error: 'GELD ist verfügbar, wenn GUTHABEN höchstens 25.000 € beträgt.' }, 400);
      if (GELD_LIMITS.enabled) {
        const now = Date.now(), dayMs = 24 * 60 * 60 * 1000, cooldownMs = GELD_LIMITS.cooldownHours * 60 * 60 * 1000;
        account.geldHistory = (account.geldHistory || []).filter(ts => now - number(ts) < dayMs);
        const lastUse = account.geldHistory[0];
        if (lastUse !== undefined && now - lastUse < cooldownMs) return json({ error: `GELD cooldown active. Try again in ${Math.ceil((cooldownMs - (now - lastUse)) / 60000)} min.` }, 429);
        if (account.geldHistory.length >= GELD_LIMITS.maxUsesPerDay) return json({ error: 'GELD daily limit reached. Try again later.' }, 429);
        account.geldHistory.unshift(now); account.geldHistory = account.geldHistory.slice(0, 50);
      }
      account.balance = RESET_AMOUNT; await save(account); return json({ account: publicAccount(account) });
    }
    if (action === 'reset-new-game') { const account = await read(input.id); if (!account) return json({ error: 'ID not found.' }, 404); { const denied = await checkSafeWord(account, input.safeWord); if (denied) return denied; } account.balance = 250; account.bank = 0; account.wildLevel = 0; account.wildInventory = 0; account.difficulty = 2; account.records = [0, 0, 0, 0, 0]; account.jackpotProgress = 0; account.completedLines = [false, false, false, false, false]; account.jackpotFinished = false; account.lastWin = 0; account.stats = { spins: 0, wins: 0, totalWon: 0 }; account.history = []; account.difficultyData = blankDifficulty(); await save(account); return json({ account: publicAccount(account) }); }
    if (action === 'buy-wild') { const account = await read(input.id); if (!account) return json({ error: 'ID not found.' }, 404); { const denied = await checkSafeWord(account, input.safeWord); if (denied) return denied; } const idemKey = input.requestId ? `buy-wild:${account.id}:${input.requestId}` : null; if (idemKey) { const cached = idempotencyCache.get(idemKey); if (cached) return json(cached); } if (account.wildLevel >= MAX_WILD_LEVEL) return json({ error: 'MAX WILD LEVEL' }, 409); const cost = game.wildUpgradeCost(account.wildLevel), fromBank = Math.min(number(account.bank), cost), fromBalance = cost - fromBank; if (number(account.balance) < fromBalance) return json({ error: 'BANK + GUTHABEN contains insufficient funds.' }, 400); account.bank = money(number(account.bank) - fromBank); account.balance = money(number(account.balance) - fromBalance); account.wildLevel++; account.wildInventory = account.wildLevel; await save(account); const wildResponseBody = { account: publicAccount(account), cost }; if (idemKey) idempotencyCache.set(idemKey, wildResponseBody); return json(wildResponseBody); }
    if (action === 'spin') { const account = await read(input.id); if (!account) return json({ error: 'ID not found.' }, 404); if (!tokenMatches(account, input.token)) { const denied = await checkSafeWord(account, input.safeWord); if (denied) return denied; } const idemKey = input.requestId ? `spin:${account.id}:${input.requestId}` : null; if (idemKey) { const cached = idempotencyCache.get(idemKey); if (cached) return json(cached); } const bet = money(input.bet); if (!validateBet(bet, account.balance)) return json({ error: 'Invalid bet or insufficient GUTHABEN.' }, 400); const level = difficulty(input.difficulty || account.difficulty); account.difficulty = level; await applyRtpSettings(); if (bet > game.maxBetForWildLevel(account.wildLevel)) return json({ error: 'Bet exceeds the maximum for your WILD level.' }, 400); const baseResults = Array.from({ length: 5 }, () => game.selectLineResult(level)), wild = applyWild(baseResults, account.wildLevel), results = wild.results, lineStake = money(bet / 5), linePayouts = wild.paytableResults.map(hits => money(lineStake * (game.PAYTABLE[hits] || 0))), normalPayout = money(linePayouts.reduce((sum, value) => sum + value, 0)), beforeProgress = account.jackpotProgress, completedBefore = Array.from({ length: 5 }, (_, index) => Boolean(account.completedLines[index])), jackpotLine = results.findIndex((hits, line) => hits === 10 && !completedBefore[line] && !wild.wildAssistedTen[line] && !wild.lineHasWild[line]), jackpotAwards = jackpotLine < 0 ? [] : [{ line: jackpotLine, tierIndex: beforeProgress, amount: money(game.JACKPOT_TIER_MULTIPLIERS[beforeProgress] * bet) }], jackpotPayout = money(jackpotAwards.reduce((sum, award) => sum + award.amount, 0)), completedAfter = completedBefore.slice(), cycleComplete = jackpotLine >= 0 && (completedAfter[jackpotLine] = true, completedAfter.every(Boolean)), progressAfter = completedAfter.filter(Boolean).length, persistedCompletedLines = cycleComplete ? [false, false, false, false, false] : completedAfter, gross = money(normalPayout + jackpotPayout); account.balance = money(account.balance - bet + gross); account.jackpotProgress = cycleComplete ? 0 : progressAfter; account.completedLines = persistedCompletedLines; account.jackpotFinished = false; account.records = cycleComplete ? [0, 0, 0, 0, 0] : account.records.map((record, index) => wild.lineHasWild[index] ? record : Math.max(record, results[index])); account.lastWin = gross; account.stats.spins++; account.stats.wins += gross > 0 ? 1 : 0; account.stats.totalWon = money(account.stats.totalWon + gross); const levelKey = String(level), stats = account.difficultyData[levelKey] || { score: 0, spins: 0, wins: 0 }; account.difficultyData[levelKey] = { score: money(number(stats.score) + gross - bet), spins: number(stats.spins) + 1, wins: number(stats.wins) + (gross > 0 ? 1 : 0), lastPlayed: Date.now() }; const spin = { id: `account-${account.id}-${Date.now()}`, timestamp: new Date().toISOString(), difficulty: level, totalStake: bet, lineStake, baseResults, finalResults: results, linePayouts, normalPayout, wild: { appeared: wild.wilds.length > 0, positions: wild.wilds, naturalCount: wild.naturalCount, levelCount: wild.levelCount, totalCount: wild.totalCount }, wildLevel: account.wildLevel, wildChance: wild.chance, jackpotProgressBefore: beforeProgress, jackpotProgressAfter: account.jackpotProgress, jackpotAwards, jackpotPayout, jackpotCycleCompleted: cycleComplete, totalPayout: gross, netResult: money(gross - bet) }; account.history = [spin, ...account.history].slice(0, 20); await save(account); await leaderboard(account); const spinResponseBody = { account: publicAccount(account), grid: makeGrid(results, wild.wilds), results, wilds: wild.wilds, details: results.map((hits, line) => ({ line, hits, mult: game.PAYTABLE[hits] || 0, amount: linePayouts[line] })), bonus: 0, missionBonus: jackpotPayout, seriesBonus: 0, gross, bet, spin }; if (idemKey) idempotencyCache.set(idemKey, spinResponseBody); return json(spinResponseBody); }
    // v143/v148: admin-only game-settings panel (RTP per difficulty, jackpot
    // frequency per difficulty, wild chance/per-level/cap, payout and
    // jackpot-value multipliers). 'get-rtp-settings' is public (guests need
    // it too, to mirror the same odds locally); the other two require the
    // caller's account to have role:"admin" in Firebase (set manually via
    // the Firebase Console - see isAdminAccount above) plus its safeWord,
    // same as other mutating account actions. Kept as one Firebase node and
    // one set of action names (not five) - each field is independently
    // optional on save, and reset takes a `scope` so each admin-panel
    // section's own RESET button only clears that section, not everything.
    if (action === 'get-rtp-settings') {
      // v157 BUG FIX: this read Firebase's saved `settings` but never
      // applied them to the live game-engine state before reporting
      // `currentDistribution`/defaults back - on a cold serverless
      // instance (or any moment before the first 'spin' call, which is
      // the only other action that calls applyRtpSettings), the admin
      // panel would show the module's fresh-load defaults instead of
      // what's actually saved in Firebase, for every admin-configurable
      // value including the new Custom Win Chances. Root cause: config
      // saved to Firebase but not re-synced to runtime before being read.
      const settings = await applyRtpSettings();
      const defaults = {
        rtp: { 1: game.getDefaultRtpPercent(1), 2: game.getDefaultRtpPercent(2), 3: game.getDefaultRtpPercent(3) },
        jackpotFreq: 1,
        wildChance: game.getDefaultWildChancePercent(),
        wildPerLevel: game.getDefaultWildPerLevelPercent(),
        wildCap: game.DEFAULT_PAYTABLE_WILD_CAP,
        wildCostMult: game.DEFAULT_WILD_COST_MULTIPLIER,
        extraWildFreq: game.DEFAULT_EXTRA_WILD_FREQUENCY,
        payoutMult: 1,
        jackpotValueMult: 1
      };
      const bounds = {
        rtp: { min: game.RTP_MIN_PERCENT, max: game.RTP_MAX_PERCENT },
        jackpotFreq: { min: game.JACKPOT_FREQ_MIN, max: game.JACKPOT_FREQ_MAX },
        payoutMult: { min: game.PAYOUT_MULTIPLIER_MIN, max: game.PAYOUT_MULTIPLIER_MAX },
        jackpotValueMult: { min: game.JACKPOT_VALUE_MULTIPLIER_MIN, max: game.JACKPOT_VALUE_MULTIPLIER_MAX },
        wildCap: { min: 1, max: 10 },
        wildCostMult: { min: game.WILD_COST_MULTIPLIER_MIN, max: game.WILD_COST_MULTIPLIER_MAX },
        extraWildFreq: { min: game.EXTRA_WILD_FREQ_MIN, max: game.EXTRA_WILD_FREQ_MAX }
      };
      return json({ settings, defaults, bounds, customDistribution: { 1: game.getCustomDistribution(1), 2: game.getCustomDistribution(2), 3: game.getCustomDistribution(3) }, currentDistribution: { 1: game.DIFFICULTY_DISTRIBUTIONS[0], 2: game.DIFFICULTY_DISTRIBUTIONS[1], 3: game.DIFFICULTY_DISTRIBUTIONS[2] } });
    }
    // v156/v158: explicit per-bucket win-chance override, independent
    // action (different shape than set-rtp-settings' flat numeric fields:
    // a per-bucket object, auto-normalized, with a `normalized` preview
    // returned so the admin sees exactly what was applied). Takes
    // PRECEDENCE over the RTP-target bisection for that difficulty (see
    // game-engine.js recomputeDistribution) - the one deterministic
    // precedence rule here, not two sources racing at runtime. ALL buckets
    // (0,3-10, including 9/10) are admin-editable - no locked bucket.
    if (action === 'set-custom-distribution') {
      const account = await read(input.id); if (!account) return json({ error: 'ID not found.' }, 404);
      if (!isAdminAccount(account)) return json({ error: 'Not authorized.' }, 403);
      { const denied = await checkSafeWord(account, input.safeWord); if (denied) return denied; }
      const d = difficulty(input.difficulty);
      const result = game.setCustomDistribution(d, input.buckets || {});
      if (result.error) return json({ error: result.error }, 400);
      const current = (await getRtpSettings({ strict: true })) || {};
      const next = { ...current, customDistribution: { ...(current.customDistribution || {}) } };
      next.customDistribution[d] = result.normalized;
      await saveRtpSettings(next);
      await applyRtpSettings();
      return json({ normalized: result.normalized, actual: game.expectedLineMultiplier(d) * 100 });
    }
    if (action === 'set-rtp-settings') {
      const account = await read(input.id); if (!account) return json({ error: 'ID not found.' }, 404);
      if (!isAdminAccount(account)) return json({ error: 'Not authorized.' }, 403);
      { const denied = await checkSafeWord(account, input.safeWord); if (denied) return denied; }
      const current = (await getRtpSettings({ strict: true })) || {};
      const next = { ...current, jackpotFreq: { ...(current.jackpotFreq || {}) } };
      for (const d of [1, 2, 3]) {
        const raw = input[String(d)];
        if (raw === undefined || raw === '') continue;
        const percent = Number(raw);
        if (!Number.isFinite(percent)) return json({ error: `Invalid RTP percent for difficulty ${d}.` }, 400);
        next[d] = Math.max(game.RTP_MIN_PERCENT, Math.min(game.RTP_MAX_PERCENT, percent));
      }
      for (const d of [1, 2, 3]) {
        const raw = input[`jackpotFreq${d}`];
        if (raw === undefined || raw === '') continue;
        const mult = Number(raw);
        if (!Number.isFinite(mult)) return json({ error: `Invalid jackpot frequency for difficulty ${d}.` }, 400);
        next.jackpotFreq[d] = Math.max(game.JACKPOT_FREQ_MIN, Math.min(game.JACKPOT_FREQ_MAX, mult));
      }
      const simpleFields = { wildChance: [0, 100], wildPerLevel: [0, 5], wildCap: [1, 10], wildCostMult: [game.WILD_COST_MULTIPLIER_MIN, game.WILD_COST_MULTIPLIER_MAX], extraWildFreq: [game.EXTRA_WILD_FREQ_MIN, game.EXTRA_WILD_FREQ_MAX], payoutMult: [game.PAYOUT_MULTIPLIER_MIN, game.PAYOUT_MULTIPLIER_MAX], jackpotValueMult: [game.JACKPOT_VALUE_MULTIPLIER_MIN, game.JACKPOT_VALUE_MULTIPLIER_MAX] };
      for (const [field, [min, max]] of Object.entries(simpleFields)) {
        const raw = input[field];
        if (raw === undefined || raw === '') continue;
        const value = Number(raw);
        if (!Number.isFinite(value)) return json({ error: `Invalid value for ${field}.` }, 400);
        next[field] = Math.max(min, Math.min(max, value));
      }
      await saveRtpSettings(next);
      await applyRtpSettings();
      return json({ settings: next, actual: { 1: game.expectedLineMultiplier(1) * 100, 2: game.expectedLineMultiplier(2) * 100, 3: game.expectedLineMultiplier(3) * 100 } });
    }
    if (action === 'reset-rtp-settings') {
      const account = await read(input.id); if (!account) return json({ error: 'ID not found.' }, 404);
      if (!isAdminAccount(account)) return json({ error: 'Not authorized.' }, 403);
      { const denied = await checkSafeWord(account, input.safeWord); if (denied) return denied; }
      const scope = input.scope || 'all';
      if (scope === 'all') {
        await saveRtpSettings({});
      } else {
        const current = (await getRtpSettings({ strict: true })) || {};
        const next = { ...current };
        if (scope === 'rtp') { delete next[1]; delete next[2]; delete next[3]; if (next.customDistribution) delete next.customDistribution; }
        else if (scope === 'customDistribution') { const d = difficulty(input.scopeDifficulty); if (next.customDistribution) delete next.customDistribution[d]; }
        else if (scope === 'jackpotFreq') { delete next.jackpotFreq; }
        else if (scope === 'wild') { delete next.wildChance; delete next.wildPerLevel; delete next.wildCap; delete next.wildCostMult; delete next.extraWildFreq; }
        else if (scope === 'payout') { delete next.payoutMult; delete next.jackpotValueMult; }
        await saveRtpSettings(next);
      }
      await applyRtpSettings();
      return json({ settings: (await getRtpSettings({ strict: true })) || {} });
    }
    // v149: admin-only, wipes every difficulty's leaderboard entirely
    // (all `leaderboard:profile-*` keys) - same admin gate + safeWord as
    // the RTP settings actions above.
    if (action === 'reset-leaderboard') {
      const account = await read(input.id); if (!account) return json({ error: 'ID not found.' }, 404);
      if (!isAdminAccount(account)) return json({ error: 'Not authorized.' }, 403);
      { const denied = await checkSafeWord(account, input.safeWord); if (denied) return denied; }
      await saveLeaderboard({});
      return json({ ok: true });
    }
    if (action === 'leaderboard') { const level = difficulty(input.difficulty || 1), boards = await getLeaderboard(), records = boards[`leaderboard:profile-${DIFFICULTY_PROFILE_VERSION}:${level}`] || []; records.sort((a, b) => number(b.score) - number(a.score) || number(a.updatedAt) - number(b.updatedAt)); const position = input.id ? records.findIndex(row => Number(row.id) === Number(input.id)) + 1 : 0; return json({ difficulty: level, records: records.slice(0, 10).map(({ name, score }) => ({ name, score })), yourPosition: position || null }); }
    // v150: admin-only player management (USERS, deferred from v143). Every
    // action here re-reads the CALLER's account fresh from Firebase and
    // requires role:"admin" + safeWord, exactly like the RTP/leaderboard
    // admin actions above - the caller's id/safeWord always identify the
    // ADMIN, never the target player (that's the separate `playerId` field).
    if (action === 'list-players') {
      const admin = await read(input.id); if (!admin) return json({ error: 'ID not found.' }, 404);
      if (!isAdminAccount(admin)) return json({ error: 'Not authorized.' }, 403);
      { const denied = await checkSafeWord(admin, input.safeWord); if (denied) return denied; }
      let accounts = await getAccounts();
      for (const [key, acc] of Object.entries(accounts)) {
        if (!acc || !Number.isFinite(Number(acc.id))) continue;
        const wanted = accountKey(acc.id, acc.name);
        if (key === wanted) continue;
        try { const node = rememberKey(defaults(acc), key); await save(node, true); } catch (error) { /* leave as is */ }
      }
      accounts = await getAccounts();
      const players = Object.values(accounts).map(acc => ({ id: acc.id, name: acc.name, lastActive: acc.updatedAt || 0 })).sort((a, b) => number(b.lastActive) - number(a.lastActive));
      return json({ players });
    }
    // Renaming/re-IDing/re-passwording a player never touches its balance,
    // history, stats, wild level etc. - only the three edited fields change,
    // the rest of the record is carried over untouched via {...target,...}.
    // Changing the id/name moves the record to a new `{id}_{name}` node (see save())
    // key (old key deleted) since the id IS the Firebase key, so any cached
    // leaderboard rows under the old id are patched in place to the new id
    // instead of being silently orphaned/duplicated.
    if (action === 'admin-update-player') {
      const admin = await read(input.id); if (!admin) return json({ error: 'ID not found.' }, 404);
      if (!isAdminAccount(admin)) return json({ error: 'Not authorized.' }, 403);
      { const denied = await checkSafeWord(admin, input.safeWord); if (denied) return denied; }
      const target = await read(input.playerId); if (!target) return json({ error: 'Player not found.' }, 404);
      const accounts = await getAccounts();
      let name = target.name;
      if (input.newName !== undefined && String(input.newName).trim()) {
        const nextName = cleanName(input.newName);
        if (nextName.length < 2) return json({ error: 'Name must contain at least 2 characters.' }, 400);
        if (Object.values(accounts).some(acc => Number(acc.id) !== Number(target.id) && nameKey(acc.name) === nameKey(nextName))) return json({ error: 'This name is already in use.' }, 409);
        name = nextName;
      }
      let safeWord = target.safeWord, sessionToken = target.sessionToken;
      // Rotating the token together with an admin-set password invalidates
      // any device that silently restored/span using the OLD password's
      // token - the same "kill old sessions on password change" behavior as
      // a player resetting their own password via account settings.
      if (input.newSafeWord !== undefined && String(input.newSafeWord).trim()) { safeWord = hashSafeWord(String(input.newSafeWord).trim().slice(0, 40)); sessionToken = makeSessionToken(); }
      let newId = Number(target.id);
      if (input.newId !== undefined && String(input.newId).trim() !== '' && Number(input.newId) !== Number(target.id)) {
        newId = Math.floor(Number(input.newId));
        if (!Number.isFinite(newId) || newId <= 0) return json({ error: 'Invalid new ID.' }, 400);
        if (findEntryById(accounts, newId)) return json({ error: 'This ID is already in use.' }, 409);
      }
      const updated = rememberKey({ ...target, id: newId, name, safeWord, sessionToken }, target.__key);
      await save(updated);
      if (newId !== Number(target.id)) {
        const boards = await getLeaderboard({ strict: true });
        let changed = false;
        for (const key of Object.keys(boards)) {
          const board = boards[key]; if (!Array.isArray(board)) continue;
          const row = board.find(r => Number(r.id) === Number(target.id));
          if (row) { row.id = newId; changed = true; }
        }
        if (changed) await saveLeaderboard(boards);
      }
      return json({ player: { id: updated.id, name: updated.name, lastActive: updated.updatedAt } });
    }
    if (action === 'admin-delete-player') {
      const admin = await read(input.id); if (!admin) return json({ error: 'ID not found.' }, 404);
      if (!isAdminAccount(admin)) return json({ error: 'Not authorized.' }, 403);
      { const denied = await checkSafeWord(admin, input.safeWord); if (denied) return denied; }
      const target = await read(input.playerId); if (!target) return json({ error: 'Player not found.' }, 404);
      if (Number(target.id) === Number(admin.id)) return json({ error: 'Cannot delete your own account.' }, 400);
      await updateAccount(target.__key || accountKey(target.id, target.name), () => null);
      const boards = await getLeaderboard({ strict: true });
      let changed = false;
      for (const key of Object.keys(boards)) {
        const board = boards[key]; if (!Array.isArray(board)) continue;
        const next = board.filter(r => Number(r.id) !== Number(target.id));
        if (next.length !== board.length) { boards[key] = next; changed = true; }
      }
      if (changed) await saveLeaderboard(boards);
      return json({ ok: true });
    }
    return json({ error: 'Unknown action.' }, 400);
  } catch (error) { console.error(error); return json({ error: 'Server temporarily unavailable.' }, 500); }
};
