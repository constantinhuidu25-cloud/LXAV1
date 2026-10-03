// A failed Firebase read must not look like an empty database (no "ID not found", no reused ids), and the per-IP limits must
// key on the address Vercel sets, not on a header the caller can choose.
jest.mock('./functions/firebase-storage.js', () => {
  let accounts = {}, leaderboards = {}, rtpSettings = {}, down = false;
  const guard = async fn => { if (down) throw new Error('read failed'); return fn(); };
  return {
    getAccounts: () => guard(() => accounts),
    saveAccounts: async next => { accounts = next; },
    updateAccount: jest.fn(async (key, mutate) => {
      const next = mutate(accounts[key]);
      if (next === undefined) throw new Error('Account update did not commit');
      if (next === null) delete accounts[key]; else accounts[key] = next;
    }),
    getLeaderboard: opts => guard(() => leaderboards),
    saveLeaderboard: async next => { leaderboards = next; },
    getRtpSettings: opts => guard(() => rtpSettings),
    saveRtpSettings: async next => { rtpSettings = next; },
    __put: (key, account) => { accounts[key] = account; },
    __accounts: () => accounts,
    __down: value => { down = value; }
  };
});

function setup() {
  jest.resetModules();
  const storage = require('./functions/firebase-storage.js');
  const { handler } = require('./functions/lxa-account.js');
  const call = async (action, data, headers = {}) => {
    const res = await handler({ httpMethod: 'POST', headers, body: JSON.stringify({ action, ...data }) });
    return { status: res.statusCode, body: JSON.parse(res.body) };
  };
  return { storage, call };
}
const player = (id, name, extra = {}) => ({ id, name, safeWord: 'pw', balance: 1000, bank: 0, wildLevel: 0, difficulty: 2, createdAt: 1000 + id, ...extra });

describe('Firebase read failure fails closed', () => {
  test('create does not hand out an id or write anything while the read is failing', async () => {
    const { storage, call } = setup();
    storage.__put('12 : Leon', player(12, 'Leon'));
    storage.__down(true);
    const res = await call('create', { name: 'Newcomer' });
    expect(res.status).toBe(500);
    expect(storage.updateAccount).not.toHaveBeenCalled();
    expect(Object.keys(storage.__accounts())).toEqual(['12 : Leon']);
  });

  test('login answers a server error, not "ID not found", while the read is failing', async () => {
    const { storage, call } = setup();
    storage.__put('12 : Leon', player(12, 'Leon', { sessionToken: 'tok' }));
    storage.__down(true);
    const res = await call('login', { id: 12, silent: true, token: 'tok' });
    expect(res.status).toBe(500);
    expect(res.body.error).not.toMatch(/not found/i);
  });

  test('the leaderboard writer stops instead of saving a board built from nothing', async () => {
    const { storage, call } = setup();
    storage.__put('12 : Leon', player(12, 'Leon', { sessionToken: 'tok' }));
    const ok = await call('spin', { id: 12, token: 'tok', bet: 5, difficulty: 2 });
    expect(ok.status).toBe(200);
    storage.__down(true);
    const res = await call('spin', { id: 12, token: 'tok', bet: 5, difficulty: 2 });
    expect(res.status).toBe(500);
  });
});

describe('per-IP limits key on the address Vercel sets', () => {
  test('a caller cannot dodge the account-creation limit by sending x-nf-client-connection-ip', async () => {
    const { call } = setup();
    let last;
    for (let i = 0; i < 7; i++) {
      last = await call('create', { name: `Spoof${i}x` }, { 'x-vercel-forwarded-for': '203.0.113.9', 'x-nf-client-connection-ip': `198.51.100.${i}` });
    }
    expect(last.status).toBe(429);
  });
});
