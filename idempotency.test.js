// v157: covers the "ECONOMY: debit, payout, balance, retry, duplicate
// request" test gap - until now, replay-safety for 'spin' (idempotency added
// 2026-09/30) and the newly-added 'buy-wild'/'deposit' idempotency was only
// ever checked with throwaway, deleted-after-use scripts. This makes that
// coverage permanent.
//
// IMPORTANT: firebase-storage.js initializes a real firebase-admin app
// against the project's actual database URL even with no credentials
// ("test mode"), so it must be fully replaced with jest.mock - never
// required for real here. jest.resetModules() before each test gives a
// fresh module instance (fresh in-memory store via the factory below, fresh
// idempotencyCache singleton in security.js) so requestId values can be
// reused freely across tests without colliding with a previous test's cache.
jest.mock('./functions/firebase-storage.js', () => {
  let accounts = {}, leaderboards = {}, rtpSettings = {};
  return {
    getAccounts: async () => accounts,
    saveAccounts: async next => { accounts = next; },
    updateAccount: async (key, mutate) => { accounts[key] = mutate(accounts[key]); },
    getLeaderboard: async () => leaderboards,
    saveLeaderboard: async next => { leaderboards = next; },
    getRtpSettings: async () => rtpSettings,
    saveRtpSettings: async next => { rtpSettings = next; },
    __seed: account => { accounts[`account:${account.id}`] = account; },
    __accounts: () => accounts
  };
});

function freshHandler() {
  jest.resetModules();
  const storage = require('./functions/firebase-storage.js');
  // Legacy plaintext safeWord path (safeWordMatches() accepts it directly,
  // no need to replicate the sha256$salt$hex hashing here).
  // Wild-level upgrades cost real millions on the actual price ladder
  // (wildUpgradeCost in game-engine.js) - a large balance is needed here so
  // the buy-wild tests exercise a genuine successful purchase, not just the
  // "insufficient funds" rejection path.
  storage.__seed({ id: 1, name: 'Tester', safeWord: 'testpass', balance: 10000000, bank: 0, wildLevel: 0, difficulty: 2 });
  const { handler } = require('./functions/lxa-account.js');
  const call = async (action, data) => JSON.parse((await handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ action, ...data }) })).body);
  return { call, accounts: () => storage.__accounts() };
}

describe('Replay-safety (requestId idempotency) for money-moving actions', () => {
  test('buy-wild: replaying the same requestId does not charge or upgrade twice', async () => {
    const { call, accounts } = freshHandler();
    const first = await call('buy-wild', { id: 1, safeWord: 'testpass', requestId: 'req-A' });
    expect(first.account.wildLevel).toBe(1);
    const balanceAfterFirst = accounts()['account:1'].balance, bankAfterFirst = accounts()['account:1'].bank;
    const second = await call('buy-wild', { id: 1, safeWord: 'testpass', requestId: 'req-A' });
    expect(second).toEqual(first);
    expect(accounts()['account:1'].wildLevel).toBe(1);
    expect(accounts()['account:1'].balance).toBe(balanceAfterFirst);
    expect(accounts()['account:1'].bank).toBe(bankAfterFirst);
  });

  test('buy-wild: a DIFFERENT requestId is a genuine second purchase', async () => {
    const { call, accounts } = freshHandler();
    await call('buy-wild', { id: 1, safeWord: 'testpass', requestId: 'req-A' });
    await call('buy-wild', { id: 1, safeWord: 'testpass', requestId: 'req-B' });
    expect(accounts()['account:1'].wildLevel).toBe(2);
  });

  test('deposit: replaying the same requestId does not move money twice', async () => {
    const { call, accounts } = freshHandler();
    const first = await call('deposit', { id: 1, safeWord: 'testpass', amount: 50, requestId: 'req-C' });
    expect(first.account.balance).toBe(9999950);
    expect(first.account.bank).toBe(50);
    const second = await call('deposit', { id: 1, safeWord: 'testpass', amount: 50, requestId: 'req-C' });
    expect(second).toEqual(first);
    expect(accounts()['account:1'].balance).toBe(9999950);
    expect(accounts()['account:1'].bank).toBe(50);
  });

  test('spin: replaying the same requestId returns the identical cached result, not a second spin', async () => {
    const { call, accounts } = freshHandler();
    const first = await call('spin', { id: 1, safeWord: 'testpass', bet: 10, requestId: 'req-D' });
    const spinsAfterFirst = accounts()['account:1'].stats.spins;
    const second = await call('spin', { id: 1, safeWord: 'testpass', bet: 10, requestId: 'req-D' });
    expect(second).toEqual(first);
    expect(accounts()['account:1'].stats.spins).toBe(spinsAfterFirst);
  });
});
