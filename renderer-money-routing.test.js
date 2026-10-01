// Cheap, dependency-free regression guard for the exact bug class found
// 2026-09-30: a newer, capture-phase click handler (added for guest play)
// fully blocked an older, correct handler from ever running, so a
// logged-in account's WILD purchase / BANK deposit silently did LOCAL-ONLY
// math and never reached the server. A full DOM/event-order test would
// catch this more rigorously, but needs jest-environment-jsdom, which
// isn't installed in this project - not added here without confirming
// first, since it's a new dependency. This static check can't verify
// runtime event ordering, but it DOES verify the thing that was actually
// missing: that each money/Wild-affecting action's source still contains
// a real server call, gated on drollAccount, near where the action is
// triggered. It would have failed before today's fix (buyWildDirectly/
// the deposit submit handler had no drollRequest call at all).
const fs = require('fs');
const path = require('path');
const source = fs.readFileSync(path.join(__dirname, 'renderer.js'), 'utf8');

function sliceNear(marker, windowSize = 1200) {
  const start = source.indexOf(marker);
  if (start === -1) return null;
  return source.slice(start, start + windowSize);
}

describe('Money/Wild actions reach the server for logged-in accounts', () => {
  test('buyWildDirectly() calls the real buy-wild action when drollAccount is set', () => {
    const body = sliceNear('function buyWildDirectly()');
    expect(body).not.toBeNull();
    expect(body).toMatch(/drollAccount/);
    expect(body).toMatch(/drollRequest\(\s*'buy-wild'/);
  });

  test('the BANK deposit form submit calls the real deposit action when drollAccount is set', () => {
    const body = sliceNear("localDepositForm').onsubmit");
    expect(body).not.toBeNull();
    expect(body).toMatch(/drollAccount/);
    expect(body).toMatch(/drollRequest\(\s*'deposit'/);
  });

  test('RESET calls the real reset-new-game action when drollAccount is set', () => {
    const body = sliceNear("drollRequest\('reset-new-game'");
    // reset-new-game only exists inside the real server call itself; this
    // just confirms it's still present and wired to a live call, not that
    // it's the ONLY listener on #reset (can't verify event ordering
    // statically - see file header comment).
    expect(source).toMatch(/drollRequest\(\s*'reset-new-game'/);
  });

  test('the account-aware spin path (drollAccountResolveSpin) calls the real spin action with a token', () => {
    const body = sliceNear('async function drollAccountResolveSpin');
    expect(body).not.toBeNull();
    expect(body).toMatch(/drollRequest\(\s*'spin'/);
    expect(body).toMatch(/token:\s*drollToken/);
  });

  test('no dead duplicate handler remains for #buyWild/#deposit (the actual root cause)', () => {
    // The old, correctly-written-but-unreachable handlers (drollBuyWild,
    // drollOpenDeposit) were removed as part of today's fix. If either
    // name reappears, it's a sign the same shadowing bug may have been
    // reintroduced (a second handler added without checking who wins).
    expect(source).not.toMatch(/function drollBuyWild\(/);
    expect(source).not.toMatch(/function drollOpenDeposit\(/);
  });
});
