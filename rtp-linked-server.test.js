// Server side of the connected-RTP switch: stored, applied before reads/spins, reported with exact figures, reset by the RTP scope.
jest.mock('./functions/firebase-storage.js', () => {
  let accounts = {}, settings = {};
  return {
    getAccounts: async () => accounts, saveAccounts: async next => { accounts = next; },
    updateAccount: async (key, mutate) => { const next = mutate(accounts[key]); if (next === undefined) throw new Error('no commit'); if (next === null) delete accounts[key]; else accounts[key] = next; },
    getLeaderboard: async () => ({}), saveLeaderboard: async () => {},
    getRtpSettings: async () => settings, saveRtpSettings: async next => { settings = next; },
    __accounts: () => accounts
  };
});

let ip = 0;
async function admin() {
  jest.resetModules();
  const storage = require('./functions/firebase-storage.js');
  const { handler } = require('./functions/lxa-account.js');
  const call = async (action, data) => { const r = await handler({ httpMethod: 'POST', headers: { 'x-vercel-forwarded-for': '10.6.0.' + (ip++ & 255) }, body: JSON.stringify({ action, ...data }) }); return { status: r.statusCode, body: JSON.parse(r.body) }; };
  const made = await call('create', { name: 'Boss' + ip });
  Object.values(storage.__accounts())[0].role = 'admin';
  return { call, id: made.body.account.id, pw: made.body.safeWord };
}

test('linked mode: the admin value becomes the TOTAL return and the response says so', async () => {
  const a = await admin();
  const saved = await a.call('set-rtp-settings', { id: a.id, safeWord: a.pw, 1: 130, 2: 110, 3: 95, rtpLinked: 'true', rtpRefLevel: '0' });
  expect(saved.status).toBe(200);
  expect(saved.body.settings.rtpLinked).toBe(true);
  [130, 110, 95].forEach((target, i) => { const c = saved.body.computed[i + 1]; expect(Math.abs(c.totalRtp - target)).toBeLessThan(0.3); expect(c.lineRtp).toBeLessThan(c.totalRtp); expect(c.totalRtpMax).toBeGreaterThan(c.totalRtp0); });
  const read = await a.call('get-rtp-settings', {});
  expect(read.body.settings.rtpLinked).toBe(true);
  expect(Math.abs(read.body.computed[2].totalRtp - 110)).toBeLessThan(0.3);
});

test('disconnected mode keeps today\'s meaning (the value is the line return) and the RTP reset scope clears the switch', async () => {
  const a = await admin();
  await a.call('set-rtp-settings', { id: a.id, safeWord: a.pw, 1: 130, 2: 110, 3: 95, rtpLinked: 'false' });
  const read = await a.call('get-rtp-settings', {});
  expect(Math.abs(read.body.computed[1].lineRtp - 130)).toBeLessThan(0.3);
  expect(read.body.computed[1].totalRtp).toBeGreaterThan(read.body.computed[1].lineRtp);
  await a.call('set-rtp-settings', { id: a.id, safeWord: a.pw, rtpLinked: 'true', rtpRefLevel: '10' });
  const reset = await a.call('reset-rtp-settings', { id: a.id, safeWord: a.pw, scope: 'rtp' });
  expect(reset.body.settings.rtpLinked).toBeUndefined();
  expect(reset.body.settings.rtpRefLevel).toBeUndefined();
});

test('an invalid reference level is refused and the switch needs the admin password', async () => {
  const a = await admin();
  expect((await a.call('set-rtp-settings', { id: a.id, safeWord: a.pw, rtpRefLevel: 'abc' })).status).toBe(400);
  expect((await a.call('set-rtp-settings', { id: a.id, rtpLinked: 'true' })).status).toBeGreaterThanOrEqual(401);
});
