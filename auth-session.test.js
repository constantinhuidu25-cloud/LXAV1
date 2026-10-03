// Persistent login without storing passwords: a session token (issued only after a REAL password login) authorises normal play,
// closing the browser is not a logout, ID + name alone never log anyone in, logout / password change revoke sessions.
jest.mock('./functions/firebase-storage.js', () => {
  let accounts = {};
  return {
    getAccounts: async () => accounts,
    saveAccounts: async next => { accounts = next; },
    updateAccount: async (key, mutate) => { const next = mutate(accounts[key]); if (next === undefined) throw new Error('no commit'); if (next === null) delete accounts[key]; else accounts[key] = next; },
    getLeaderboard: async () => ({}), saveLeaderboard: async () => {}, getRtpSettings: async () => ({}), saveRtpSettings: async () => {},
    __put: (key, account) => { accounts[key] = account; }, __accounts: () => accounts
  };
});

let ip = 0;
function setup() {
  jest.resetModules();
  const storage = require('./functions/firebase-storage.js');
  const { handler } = require('./functions/lxa-account.js');
  const call = async (action, data) => { const r = await handler({ httpMethod: 'POST', headers: { 'x-vercel-forwarded-for': '10.7.' + (ip >> 8) + '.' + (ip++ & 255) }, body: JSON.stringify({ action, ...data }) }); return { status: r.statusCode, body: JSON.parse(r.body) }; };
  return { storage, call };
}
async function fresh() {
  const { storage, call } = setup();
  const made = await call('create', { name: 'Persist' + (ip++) });
  return { storage, call, id: made.body.account.id, name: made.body.account.name, password: made.body.safeWord, token: made.body.token };
}

describe('session token authorises normal play (no password after a browser restart)', () => {
  test('deposit, buy-wild, GELD and RESET work with the token alone', async () => {
    const a = await fresh();
    const acc = () => Object.values(a.storage.__accounts())[0];   // saves replace the stored object, so look it up each time
    expect((await a.call('deposit', { id: a.id, token: a.token, amount: 50 })).status).toBe(200);
    acc().balance = 5000000;   // enough for the first WILD level (2.5M)
    expect((await a.call('buy-wild', { id: a.id, token: a.token })).status).toBe(200);
    acc().balance = 100;       // GELD only refills a low balance
    expect((await a.call('reset-geld', { id: a.id, token: a.token })).status).toBe(200);
    expect((await a.call('reset-new-game', { id: a.id, token: a.token })).status).toBe(200);
  });
  test('a wrong or missing token is refused (password path still works)', async () => {
    const a = await fresh();
    expect((await a.call('deposit', { id: a.id, token: 'nope', amount: 5 })).status).toBeGreaterThanOrEqual(401);
    expect((await a.call('reset-geld', { id: a.id })).status).toBeGreaterThanOrEqual(401);
    expect((await a.call('deposit', { id: a.id, safeWord: a.password, amount: 5 })).status).toBe(200);
  });
  test('the stored session is a hash, never the plain token', async () => {
    const a = await fresh();
    const stored = JSON.stringify(Object.values(a.storage.__accounts()));
    expect(stored).not.toContain(a.token);
    expect(stored).toContain('"sessions"');
  });
});

describe('ID and name are not proof', () => {
  test('login with id + name but no password is refused and returns no token', async () => {
    const a = await fresh();
    const r = await a.call('login', { id: a.id, name: a.name });
    expect(r.status).toBe(401);
    expect(r.body.token).toBeUndefined();
  });
  test('login with the password works and issues a NEW token per device', async () => {
    const a = await fresh();
    const one = await a.call('login', { id: a.id, safeWord: a.password });
    const two = await a.call('login', { name: a.name, safeWord: a.password });
    expect(one.status).toBe(200); expect(two.status).toBe(200);
    expect(new Set([a.token, one.body.token, two.body.token]).size).toBe(3);
    expect((await a.call('login', { id: a.id, silent: true, token: one.body.token })).status).toBe(200);
  });
  test('silent restore with a stale or foreign token is "Session expired"', async () => {
    const a = await fresh();
    const r = await a.call('login', { id: a.id, silent: true, token: 'stale' });
    expect(r.status).toBe(401); expect(r.body.error).toMatch(/expired/i);
  });
});

describe('logout and password change', () => {
  test('logout revokes only that device', async () => {
    const a = await fresh();
    const other = (await a.call('login', { id: a.id, safeWord: a.password })).body.token;
    expect((await a.call('logout', { id: a.id, token: a.token })).status).toBe(200);
    expect((await a.call('login', { id: a.id, silent: true, token: a.token })).status).toBe(401);
    expect((await a.call('login', { id: a.id, silent: true, token: other })).status).toBe(200);
    expect((await a.call('deposit', { id: a.id, token: a.token, amount: 5 })).status).toBeGreaterThanOrEqual(401);
  });
  test('logout with a bad token changes nothing and leaks nothing', async () => {
    const a = await fresh();
    expect((await a.call('logout', { id: a.id, token: 'bad' })).status).toBe(200);
    expect((await a.call('login', { id: a.id, silent: true, token: a.token })).status).toBe(200);
  });
  test('a legacy single sessionToken still works and is revoked by logout', async () => {
    const { storage, call } = setup();
    storage.__put('30 : Old', { id: 30, name: 'Old', safeWord: 'plain-pw', sessionToken: 'legacy-token-123', balance: 500, bank: 0, wildLevel: 0, difficulty: 2, createdAt: 1 });
    expect((await call('login', { id: 30, silent: true, token: 'legacy-token-123' })).status).toBe(200);
    await call('logout', { id: 30, token: 'legacy-token-123' });
    expect((await call('login', { id: 30, silent: true, token: 'legacy-token-123' })).status).toBe(401);
  });
  test('changing the password needs the password (the token is not enough) and kills every other session', async () => {
    const a = await fresh();
    const other = (await a.call('login', { id: a.id, safeWord: a.password })).body.token;
    expect((await a.call('update', { id: a.id, token: a.token, newSafeWord: 'brandnew' })).status).toBeGreaterThanOrEqual(401);
    const ok = await a.call('update', { id: a.id, safeWord: a.password, token: a.token, newSafeWord: 'brandnew' });
    expect(ok.status).toBe(200);
    expect((await a.call('login', { id: a.id, silent: true, token: other })).status).toBe(401);
    expect((await a.call('login', { id: a.id, silent: true, token: a.token })).status).toBe(401);
    expect((await a.call('login', { id: a.id, silent: true, token: ok.body.token })).status).toBe(200);
    expect((await a.call('login', { id: a.id, safeWord: 'brandnew' })).status).toBe(200);
  });
  test('admin actions still need the password even with a valid token', async () => {
    const a = await fresh();
    Object.values(a.storage.__accounts())[0].role = 'admin';
    expect((await a.call('list-players', { id: a.id, token: a.token })).status).toBeGreaterThanOrEqual(401);
    expect((await a.call('list-players', { id: a.id, safeWord: a.password })).status).toBe(200);
  });
});

describe('no unauthenticated state change', () => {
  test('GELD (reset-geld) used to need nothing: now it needs the token or the password', async () => {
    const a = await fresh();
    expect((await a.call('reset-geld', { id: a.id })).status).toBeGreaterThanOrEqual(401);
  });
});
