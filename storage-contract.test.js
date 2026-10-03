// firebase-storage.js read contract: getAccounts fails closed; the leaderboard / RTP readers are forgiving for display but strict
// for read-modify-write callers. firebase-admin is replaced entirely (no real app, no network).
let mockReadFails;
jest.mock('firebase-admin/app', () => ({ getApps: () => [], initializeApp: () => ({}), cert: x => x }));
jest.mock('firebase-admin/database', () => ({
  getDatabase: () => ({ ref: () => ({ once: async () => { if (mockReadFails) throw new Error('network down'); return { val: () => null }; } }) })
}));

const load = () => { jest.resetModules(); return require('./functions/firebase-storage.js'); };

describe('firebase-storage reads', () => {
  beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); jest.spyOn(console, 'log').mockImplementation(() => {}); });
  afterEach(() => jest.restoreAllMocks());

  test('a healthy empty database reads as {}', async () => {
    mockReadFails = false;
    const s = load();
    expect(await s.getAccounts()).toEqual({});
    expect(await s.getLeaderboard()).toEqual({});
  });

  test('getAccounts rejects when the read fails (never "empty")', async () => {
    mockReadFails = true;
    await expect(load().getAccounts()).rejects.toThrow('network down');
  });

  test('display readers stay forgiving, strict readers reject', async () => {
    mockReadFails = true;
    const s = load();
    expect(await s.getLeaderboard()).toEqual({});
    expect(await s.getRtpSettings()).toEqual({});
    await expect(s.getLeaderboard({ strict: true })).rejects.toThrow('network down');
    await expect(s.getRtpSettings({ strict: true })).rejects.toThrow('network down');
  });
});
