// A session issued by one device must survive a request of another device that read the account a moment earlier. save() used to replace the whole account with the
// snapshot read at the start of the request, so a silent restore / spin / logout of one device could erase the session a second device had just created, and that
// second device was "logged out" the next time it was opened.
jest.mock('./functions/firebase-storage.js', () => {
  let accounts = {};
  const copy = value => (value === null || value === undefined ? value : JSON.parse(JSON.stringify(value)));
  return {
    // the first caller after `global.__gate` is set reads its snapshot NOW but only returns it once the gate opens (= a slow read)
    getAccounts: async () => { const snapshot = copy(accounts); const gate = global.__gate; global.__gate = null; if (gate) await gate; return snapshot; },
    saveAccounts: async next => { accounts = copy(next); },
    updateAccount: async (key, mutate) => { const next = mutate(copy(accounts[key]) || null); if (next === undefined) throw new Error('no commit'); if (next === null) delete accounts[key]; else accounts[key] = copy(next); },
    reserveAccountId: async floor => floor + 1,
    getLeaderboard: async () => ({}), saveLeaderboard: async () => {}, getRtpSettings: async () => ({}), saveRtpSettings: async () => {},
    __accounts: () => accounts
  };
});

let ip = 0;
async function setup() {
  jest.resetModules();
  const { handler } = require('./functions/lxa-account.js');
  const call = async (action, data) => { const r = await handler({ httpMethod: 'POST', headers: { 'x-vercel-forwarded-for': '10.11.0.' + (ip++ & 255) }, body: JSON.stringify({ action, ...data }) }); return { status: r.statusCode, body: JSON.parse(r.body) }; };
  const made = await call('create', { name: 'Race' + ip });
  return { call, id: made.body.account.id, password: made.body.safeWord, token1: made.body.token };
}
const slowRead = () => { let open; global.__gate = new Promise(resolve => { open = resolve; }); return open; };

test('a silent restore on one device does not erase the session another device creates meanwhile', async () => {
  const t = await setup();
  const release = slowRead();
  const restore = t.call('login', { id: t.id, silent: true, token: t.token1 });       // device A: read the account, waits
  const login = await t.call('login', { id: t.id, safeWord: t.password });             // device B: a real login (token 2) completes in the meantime
  expect(login.status).toBe(200); const token2 = login.body.token; expect(token2).toBeTruthy();
  release(); expect((await restore).status).toBe(200);                                  // device A saves its stale snapshot
  expect((await t.call('login', { id: t.id, silent: true, token: token2 })).status).toBe(200);   // B is still logged in
  expect((await t.call('login', { id: t.id, silent: true, token: t.token1 })).status).toBe(200); // and so is A
});

test('a logout revokes only its own session, even when another device logged in meanwhile', async () => {
  const t = await setup();
  const release = slowRead();
  const logout = t.call('logout', { id: t.id, token: t.token1 });
  const login = await t.call('login', { id: t.id, safeWord: t.password }); const token2 = login.body.token;
  release(); await logout;
  expect((await t.call('login', { id: t.id, silent: true, token: t.token1 })).status).toBe(401);  // the logged-out device is out
  expect((await t.call('login', { id: t.id, silent: true, token: token2 })).status).toBe(200);     // the other one stays in
});

test('a password change still revokes every older session', async () => {
  const t = await setup();
  const login = await t.call('login', { id: t.id, safeWord: t.password }); const token2 = login.body.token;
  const changed = await t.call('update', { id: t.id, safeWord: t.password, newSafeWord: 'brandnewpw1' });
  expect(changed.status).toBe(200);
  expect((await t.call('login', { id: t.id, silent: true, token: t.token1 })).status).toBe(401);
  expect((await t.call('login', { id: t.id, silent: true, token: token2 })).status).toBe(401);
});

test('a device that logged in earlier is still logged in after many other logins', async () => {
  const t = await setup();
  for (let i = 0; i < 12; i++) expect((await t.call('login', { id: t.id, safeWord: t.password })).status).toBe(200);
  expect((await t.call('login', { id: t.id, silent: true, token: t.token1 })).status).toBe(200);
});
