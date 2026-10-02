// v158 (user request): the spin grid must never show a letter outside
// LEONXOXANA (L/E/O/N/X/A) - no fallback-alphabet letters like B/H/C/F/J/K.
// Was broken: the server's makeGrid() sent a literal 'X' for every miss
// cell, and renderer.js mapped that 'X' to an ad-hoc fallback alphabet
// client-side that included several letters outside the target word. Fixed
// at the source (makeGrid now picks a random target-word letter, excluding
// the "correct" one for that column, same approach game-engine.js's
// makeBoard already used for guest play) and the now-unnecessary client
// substitution was removed. This test exercises the REAL server handler
// (mocked storage only, no network) across many spins/wild levels to catch
// any letter outside the allowed set.
jest.mock('./functions/firebase-storage.js', () => {
  let accounts = {};
  return {
    getAccounts: async () => accounts,
    saveAccounts: async next => { accounts = next; },
    updateAccount: async (key, mutate) => { accounts[key] = mutate(accounts[key]); },
    getLeaderboard: async () => ({}),
    saveLeaderboard: async () => {},
    getRtpSettings: async () => ({}),
    saveRtpSettings: async () => {},
    __seed: account => { accounts[`account:${account.id}`] = account; }
  };
});

const ALLOWED = new Set(['L', 'E', 'O', 'N', 'X', 'A']);

test('spin grid only ever contains LEONXOXANA letters or the Wild marker, never any other letter', async () => {
  const storage = require('./functions/firebase-storage.js');
  storage.__seed({ id: 1, name: 'Tester', safeWord: 'testpass', balance: 10000000, bank: 0, wildLevel: 50, difficulty: 2 });
  const { handler } = require('./functions/lxa-account.js');
  const call = async data => JSON.parse((await handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify(data) })).body);

  for (let i = 0; i < 40; i++) {
    const body = await call({ action: 'spin', id: 1, safeWord: 'testpass', bet: 10 });
    for (const row of body.grid) {
      for (const cell of row) {
        if (cell === '__BONUS_WILD__') continue;
        expect(ALLOWED.has(cell)).toBe(true);
      }
    }
  }
});
