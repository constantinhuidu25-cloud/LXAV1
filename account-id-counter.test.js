// Simultaneous account creation must never hand out the same id (the old max(existing)+1 read gave 5 parallel creates the same id).
jest.mock('./functions/firebase-storage.js', () => {
  let accounts = {}, counter = 0;
  return {
    getAccounts: async () => accounts,
    saveAccounts: async next => { accounts = next; },
    updateAccount: async (key, mutate) => { await new Promise(r => setImmediate(r)); const next = mutate(accounts[key]); if (next === undefined) throw new Error('no commit'); if (next === null) delete accounts[key]; else accounts[key] = next; },
    reserveAccountId: async floor => { counter = Math.max(counter, floor) + 1; return counter; },
    getLeaderboard: async () => ({}), saveLeaderboard: async () => {}, getRtpSettings: async () => ({}), saveRtpSettings: async () => {},
    __accounts: () => accounts
  };
});

test('5 parallel creates get 5 different ids, all above the existing highest id', async () => {
  jest.resetModules();
  const storage = require('./functions/firebase-storage.js');
  storage.__accounts()['40 : Old'] = { id: 40, name: 'Old', safeWord: 'x', balance: 1, createdAt: 1 };
  const { handler } = require('./functions/lxa-account.js');
  let ip = 0;
  const create = name => handler({ httpMethod: 'POST', headers: { 'x-vercel-forwarded-for': '10.1.0.' + (ip++) }, body: JSON.stringify({ action: 'create', name }) });
  const results = await Promise.all(['Anna1', 'Bella2', 'Carla3', 'Dana44', 'Elena5'].map(create));
  const ids = results.map(r => JSON.parse(r.body).account.id);
  expect(new Set(ids).size).toBe(5);
  expect(Math.min(...ids)).toBeGreaterThan(40);
});
