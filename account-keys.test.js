// Account nodes are keyed "<zero-padded id>_<name>" (e.g. 001_Tester) so the Firebase console lists
// them by ID; lookups use the id FIELD, so legacy `account:N` and hand-edited nodes still work, and
// every save refreshes the node key after an ID/name edit.
jest.mock('./functions/firebase-storage.js', () => {
  let accounts = {}, leaderboards = {}, rtpSettings = {};
  return {
    getAccounts: async () => accounts,
    saveAccounts: async next => { accounts = next; },
    updateAccount: async (key, mutate) => {
      const next = mutate(accounts[key]);
      if (next === undefined) throw new Error('Account update did not commit');
      if (next === null) delete accounts[key]; else accounts[key] = next;
    },
    getLeaderboard: async () => leaderboards,
    saveLeaderboard: async next => { leaderboards = next; },
    getRtpSettings: async () => rtpSettings,
    saveRtpSettings: async next => { rtpSettings = next; },
    __put: (key, account) => { accounts[key] = account; },
    __accounts: () => accounts
  };
});

function setup() {
  jest.resetModules();
  const storage = require('./functions/firebase-storage.js');
  const { handler } = require('./functions/lxa-account.js');
  const call = async (action, data) => JSON.parse((await handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ action, ...data }) })).body);
  return { storage, call };
}
const player = (id, name, extra = {}) => ({ id, name, safeWord: 'pw', balance: 1000, bank: 0, wildLevel: 0, difficulty: 2, createdAt: 1000 + id, ...extra });

describe('account node keys', () => {
  test('a new account is stored under a zero-padded id + name key', async () => {
    const { storage, call } = setup();
    const created = await call('create', { name: 'Anna' });
    const id = created.account.id;
    expect(Object.keys(storage.__accounts())).toEqual([`${String(id).padStart(3, '0')}_Anna`]);
  });

  test('a legacy account:N node is found by id and renamed on the next save', async () => {
    const { storage, call } = setup();
    storage.__put('account:13', player(13, 'Leo'));
    const res = await call('spin', { id: 13, safeWord: 'pw', bet: 5, difficulty: 2 });
    expect(res.account).toBeDefined();
    expect(Object.keys(storage.__accounts())).toEqual(['013_Leo']);
  });

  test('a node whose id field was edited by hand is found by the new id', async () => {
    const { storage, call } = setup();
    storage.__put('account:13', player(3, 'Leo'));
    const login = await call('login', { id: 3, safeWord: 'pw' });
    expect(login.account.id).toBe(3);
    expect((await call('login', { id: 13, safeWord: 'pw' })).error).toBeDefined();
  });

  test('admin edit of id and name moves the node to the refreshed key and drops the old one', async () => {
    const { storage, call } = setup();
    storage.__put('001_Admin', player(1, 'Admin', { role: 'admin' }));
    storage.__put('012_Bob', player(12, 'Bob'));
    const res = await call('admin-update-player', { id: 1, safeWord: 'pw', playerId: 12, newId: 40, newName: 'Bobby' });
    expect(res.error).toBeUndefined();
    expect(Object.keys(storage.__accounts()).sort()).toEqual(['001_Admin', '040_Bobby']);
  });

  test('opening the admin players list normalises every legacy key once', async () => {
    const { storage, call } = setup();
    storage.__put('001_Admin', player(1, 'Admin', { role: 'admin', updatedAt: 5 }));
    storage.__put('account:12', player(12, 'Bob', { updatedAt: 7 }));
    storage.__put('account:13', player(13, 'Cleo', { updatedAt: 9 }));
    const res = await call('list-players', { id: 1, safeWord: 'pw' });
    expect(res.players.map(p => p.id).sort((a, b) => a - b)).toEqual([1, 12, 13]);
    expect(Object.keys(storage.__accounts()).sort()).toEqual(['001_Admin', '012_Bob', '013_Cleo']);
    expect(storage.__accounts()['012_Bob'].updatedAt).toBe(7);
  });
});
