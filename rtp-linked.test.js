// Connected RTP: the exact total-RTP model (lines + WILD + jackpot) matches long simulations, the solver lands on a TOTAL target,
// applyAdminSettings is deterministic, and the server returns/applies the new switch.
const game = require('./game-engine.js');

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// chained state on purpose: the jackpot cycle (tiers 1..5, five different lines) only shows up when progress is carried between spins
function simulate(difficulty, level, spins, seed) {
  const rng = mulberry32(seed); let state = game.initialState({ credits: 1e12, bet: 1000, difficulty, wildLevel: level }), stake = 0, pay = 0, squares = 0;
  for (let i = 0; i < spins; i++) { state = { ...state, credits: 1e12 }; const r = game.resolveSpin(state, rng); stake += r.spin.totalStake; pay += r.spin.totalPayout; const x = r.spin.totalPayout / r.spin.totalStake; squares += x * x; state = r.state; }
  const mean = pay / stake; return { rtp: mean * 100, se: Math.sqrt(squares / spins - mean * mean) / Math.sqrt(spins) * 100 };
}
beforeEach(() => { game.applyAdminSettings({}); });
afterAll(() => { game.applyAdminSettings({}); });

describe('exact total RTP model', () => {
  jest.setTimeout(120000);
  test('matches a 200k-spin simulation at the defaults (difficulty 1, WILD 0)', () => {
    const sim = simulate(1, 0, 200000, 11), analytic = game.expectedTotalRtp(1, 0);
    expect(Math.abs(analytic - sim.rtp)).toBeLessThan(Math.max(0.6, 3.5 * sim.se));
  });
  test('matches under a stress mix: WILD 25, extra-WILD x2, cap 3, jackpot x2, payout x1.5, difficulty 3', () => {
    game.applyAdminSettings({ extraWildFreq: 2, wildCap: 3, jackpotFreq: { 3: 2 }, payoutMult: 1.5 });
    const sim = simulate(3, 25, 200000, 29), analytic = game.expectedTotalRtp(3, 25);
    expect(Math.abs(analytic - sim.rtp)).toBeLessThan(Math.max(0.8, 3.5 * sim.se));
  });
  test('WILD levels raise the return and the line return alone is lower than the total', () => {
    for (const d of [1, 2, 3]) {
      expect(game.expectedTotalRtp(d, 0)).toBeGreaterThan(game.expectedLineMultiplier(d) * 100);
      expect(game.expectedTotalRtp(d, 25)).toBeGreaterThan(game.expectedTotalRtp(d, 0));
      expect(game.expectedTotalRtp(d, 50)).toBeGreaterThan(game.expectedTotalRtp(d, 25));
    }
  });
});

describe('no rounding: the same return at every stake (guest engine = server)', () => {
  jest.setTimeout(120000);
  test('stake 5 and stake 10 pay what the model says (they used to pay up to 18 points more)', () => {
    for (const [bet, seed] of [[5, 41], [10, 43]]) {
      const rng = mulberry32(seed); let state = game.initialState({ credits: 1e12, bet, difficulty: 1, wildLevel: 0 }), stake = 0, pay = 0, squares = 0; const N = 150000;
      for (let i = 0; i < N; i++) { state = { ...state, credits: 1e12 }; const r = game.resolveSpin(state, rng); stake += r.spin.totalStake; pay += r.spin.totalPayout; const x = r.spin.totalPayout / r.spin.totalStake; squares += x * x; state = r.state; }
      const mean = pay / stake, se = Math.sqrt(squares / N - mean * mean) / Math.sqrt(N) * 100;
      expect(Math.abs(mean * 100 - game.expectedTotalRtp(1, 0))).toBeLessThan(Math.max(0.8, 3.5 * se));
    }
  });
  test('balances and payouts keep at most two decimals', () => {
    let state = game.initialState({ credits: 1000, bet: 5, difficulty: 2 }); const rng = mulberry32(3);
    for (let i = 0; i < 400; i++) { state = game.resolveSpin({ ...state, credits: Math.max(state.credits, 50) }, rng).state; expect(Math.abs(state.credits * 100 - Math.round(state.credits * 100))).toBeLessThan(1e-6); }
  });
});

describe('connected mode solves for the TOTAL', () => {
  test('130 / 110 / 95 as total targets land within 0.2 points (exact model) and the line targets drop', () => {
    const results = [1, 2, 3].map((d, i) => game.setDifficultyTotalRtp(d, [130, 110, 95][i], 0));
    results.forEach((r, i) => { expect(Math.abs(r.totalRtp - [130, 110, 95][i])).toBeLessThan(0.2); expect(r.clamped).toBe(false); expect(r.lineRtp).toBeLessThan(r.totalRtp); });
  });
  test('a simulation agrees with the connected 110 target (difficulty 2, WILD 0)', () => {
    jest.setTimeout(120000);
    game.setDifficultyTotalRtp(2, 110, 0);
    const sim = simulate(2, 0, 200000, 5);
    expect(Math.abs(sim.rtp - 110)).toBeLessThan(Math.max(0.8, 3.5 * sim.se));
  });
  test('an unreachable total is clamped and reported, not silently wrong', () => {
    const r = game.setDifficultyTotalRtp(3, 299, 0);
    expect(r.clamped).toBe(true);
    expect(r.totalRtp).toBeLessThan(299);
  });
  test('a custom win-chance table keeps its precedence (connected mode skips that difficulty)', () => {
    game.applyAdminSettings({ rtpLinked: true, 2: 110, customDistribution: { 2: { 0: 20, 3: 20, 4: 20, 5: 20, 6: 10, 7: 5, 8: 3, 9: 1, 10: 1 } } });
    expect(game.getCustomDistribution(2)).not.toBeNull();
    expect(game.setDifficultyTotalRtp(2, 110, 0).skipped).toBe('custom');
  });
});

describe('applyAdminSettings is deterministic', () => {
  test('applying the same settings twice, or after a different set, gives identical distributions', () => {
    const settings = { 1: 130, 2: 110, 3: 95, jackpotFreq: { 1: 1.5 }, payoutMult: 1.25, wildChance: 40, rtpLinked: true, rtpRefLevel: 5 };
    game.applyAdminSettings(settings); const first = JSON.stringify(game.DIFFICULTY_DISTRIBUTIONS) + game.getPayoutMultiplier() + game.NATURAL_WILD_CHANCE;
    game.applyAdminSettings({ 1: 160, payoutMult: 2, rtpLinked: false });
    game.applyAdminSettings(settings); const second = JSON.stringify(game.DIFFICULTY_DISTRIBUTIONS) + game.getPayoutMultiplier() + game.NATURAL_WILD_CHANCE;
    expect(second).toBe(first);
  });
  test('empty settings restore the shipped defaults (150 / 125 / 100 line targets)', () => {
    game.applyAdminSettings({ 1: 90, rtpLinked: true }); game.applyAdminSettings({});
    expect([1, 2, 3].map(d => Math.round(game.expectedLineMultiplier(d) * 100))).toEqual([150, 125, 100]);
  });
  test('linked mode off leaves the line targets exactly as typed (disconnected = today)', () => {
    game.applyAdminSettings({ 1: 130, 2: 110, 3: 95, rtpLinked: false });
    expect([1, 2, 3].map(d => Math.round(game.expectedLineMultiplier(d) * 100))).toEqual([130, 110, 95]);
  });
});
