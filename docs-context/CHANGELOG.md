# LXAV1 — CHANGELOG

(Format as in the Drolly changelog: Task / Files / Changes / Reason / How / Result / Remaining. Entries before 2026-10-03 were reconstructed from
`git log` on 2026-10-03 and are summaries; the commit hash is the authoritative detail. Anything marked NOT VERIFIED was not checked on a real device.)

## 2026-10-02 — Reskin to LEONXOXANA, move to Vercel/Firebase LXAV1 (reconstructed from git)
Task: turn Drollyv3 into LXAV1 (LEONXOXANA), deployed on Vercel with Firebase project `lxav1-a5cfd`.
Commits: e551eb7 (letter reskin + visual fixes), 48488b8 (vercel.json outputDirectory), a9fcfed (cron jobs, demo bots, legacy build script removed;
service worker rewritten), 7914165 / 9f719fc (per-letter badge images, full-bleed app icons), 471be89 (all Drolly/Drollinger identifiers renamed to LXA),
20055f6 (Firebase URL fallback -> LXAV1 DB, env URL sanitised), 6e322c2 (.vercel/.env* ignored).
Result: site up on lxoxa.vercel.app. Login first returned 500 "Server temporarily unavailable" because the env vars had been added after the deploy -> redeploy.

## 2026-10-02 — Game/server rule changes (reconstructed)
- 74af7e5: a line that shows a WILD cell no longer counts for the jackpot mission or for records (still pays its normal line payout). Engine + server.
- 3b5efa3 / 0d6bd49: Firebase account nodes keyed `"<id> : <name>"` (first `<id>_<name>` with zero padding, then the user's exact format, no padding);
  lookup by the `id` field; legacy `account:N` nodes renamed on save or when the admin opens PLAYERS.
- 87e88a8: session restore never trusts a cached admin role (role is re-read from the server).
- 0c58cd7: reels start instantly on SPIN (no wait for the server) — user: "why wait 1-2 s after pressing spin".
Tests: Jest grew to 56 (account-keys, spin-grid-letters, idempotency, engine).

## 2026-10-02 — Visual system (reconstructed, many iterations)
Header image: GIF -> panoramic registered GIF -> transparent animated WebP + CSS light (1650219, 346d688, f5e47b6, 6c2b00f, 768e35d, 8ec34bd, ed987eb).
Brighter magenta theme (f5e47b6); one card style everywhere, styled control buttons, 1px gaps (3ee7a14, 9e510dc, 8ec34bd); JACKPOT MISSION info joined to WILD BANK
(33aaf1f, user praised the joined card); WILD bonus image fills its cell corner to corner, `wild-wide.webp` (>700px) / `wild-stack.webp` (portrait) (8c385e2);
PWA edge-to-edge banner + safe-area (a3c48af); page background on the root canvas (094115c); floating lock/Ko-fi parked at the card edge (3380381, eb0c373);
SPIN/STOP-only state-driven button with the net result under the label (e1d8a7d, 30ea5b4, b318482); lock blocks scroll only on touch screens (3ee7a14).

## 2026-10-03 — Max stake = half the price of the next WILD level (a90c4b9, b590e52, 5800313, 3d41b01)
Task: user wanted a ceiling so a huge stake cannot act as a money multiplier (jackpot tiers pay a multiple of the stake), while the 50% button keeps meaning
half the balance, capped.
Files: game-engine.js, functions/lxa-account.js, renderer.js, index.html (asset versions), readme.md ("Maximum stake"), game-engine.test.js, account-keys.test.js.
Changes: `maxBetForWildLevel(level) = max(5, floor(wildUpgradeCost(level)/2))` (WILD 50 continues the ladder: (50+1) x 1M / 2 = 25.5M instead of repeating 25M);
engine `resolveSpin` and server `spin` reject a stake above it; UI `normalizeLocalBet`/`setLocalBet` clamp to balance AND cap and show "MAX. EINSATZ / MIZĂ MAXIMĂ / MAX BET: <cap>";
50% button = `balance * 0.5` then clamped (old sqrt formula above 4M removed); `#betMax` line "MAX <min(balance, cap)>" under the stake.
How / verification: jest (cap tests, server 400 test); real page, headless Edge, pressing "+" until it stops rising: 2M@WILD40 -> 2,000,000 (50% = 1,000,000);
120M@WILD40 -> 20,500,000; 800k@0 -> 800,000; 3k@0 -> 3,000; 900M@50 -> 25,500,000; 120M@0 -> 1,250,000; labels checked in de/ro/en; 320px label fits.
Mistakes/lessons: (1) I stated 5/5 jackpot = 15x; it is 5x (tier multipliers [1,2,3,4,5]; 15x is the cycle total). (2) My table said "level 6 -> 3,000,000": the cap uses the
NEXT level's price, so the table row was for level 5. (3) I implemented "+ stops at half the balance" (option A) after a misreading; the user then said "+ must reach the
whole balance, only the WILD level limits it" -> reverted before committing. Ask one precise question when a rule has two readings, and show concrete numbers.
Result: done, verified in the real page; NOT deployed.
Remaining: none.

## 2026-10-03 — SPIN button ring synced with the real reel timing (937c527)
Task: user: the button animation is not synchronised with the spin timing (~2.3-2.5 s).
Root cause: fixed 4.2 s CSS fill vs reels stopping after ~2.5 s -> the ring vanished at ~60%.
Files: spin-button.js, layout-fix.css, renderer.js, index.html.
Changes: ring creeps to 12% while the server answers; `LXASpinButton.landing(ms)` (called from `startReelSpin().land`) restarts it from the current fill to 100% over the real slide
duration (keyframes a/b alternate); STOP snaps from the current fill in 180 ms; the reel promise resolves on `animation.finished` (was +150 ms timer).
Verification: sampled every 40 ms on phone (390) and PC (1280): ring 1% -> 95% linear, reels at rest and button idle at ~2.5 s (natural) / ~1.27 s (stop at 1.2 s).
Lesson: restarting a CSS animation with the same name needs a reflow; alternating two identical keyframes avoids it.
Result: done; NOT verified on iOS < 16.4 (no @property animation).

## 2026-10-03 — Header: no hard edges around the animated LXA (1ecf410)
Task: user: "the header does not blend with the background". Root causes found by contrast-boosting a screenshot and by measuring pixel rows:
(1) the animated `::after` light layer had no edge fade (luminance +17 at the top, -21 at the bottom of the box); (2) `.brand{overflow:hidden}` clipped the 1.22x scaled image
~6px before its own mask reached zero (flat cut across the letters).
Files: layout-fix.css, index.html (v=429, 430). Changes: 4-side mask on `::after` and a glow that dies inside the box; `.brand`/`.topbar` overflow visible.
Verification: row luminance profile before/after (ramp 46->48->54->61->69->78 instead of a step), zoomed boosted crops, layout audit identical, 56 tests.
Result: done on phone + PC captures; NOT verified on a real device.

## 2026-10-03 — Seamless page edges for overscroll / force scrolling (116ffd8)
Task: user: pulling past the page edge shows a background of another colour.
Root cause: the bounce area shows the root background-COLOUR (#272079) but the gradient was lighter at the top (rgb 53-67,36-44,158-166) and different at the bottom.
Fix: html background layers now die out inside the page (glows positioned a full radius away from the edges) and the base gradient starts/ends on #272079.
Verification: full-page CDP screenshot, first/last rows = rgb(39,32,121) at 5 x positions on phone and PC; page looks coherent.
Result: done; NOT verified on a real iPhone/Android rubber-band.

## 2026-10-03 — Android "Install app" investigation (no code change)
Findings: Chromium reports 0 installability errors on https://lxoxa.vercel.app and local; manifest/sw/icons OK (sizes 192/512/512-maskable correct, HTTP 200).
User: "Install app" does nothing on Android, "Add to home screen" makes a browser-style shortcut; iOS gives a real app look. Probable device-side WebAPK minting failure.
Result: no change made (no install button without an explicit request). Remaining: phone model + browser needed.

## 2026-10-03 — Misc answers / findings
- "WILD x1 · 50%" in the round summary (renderer.js showSpinV79, ~L678) = number of WILD cells + the game's WILD chance, not a payout multiplier. Not changed; user not yet decided.
- Process incident: rewrote index.html through PowerShell Get-Content/Set-Content -> mojibake + BOM; restored with `git checkout`, re-applied with Python. See MEMORY.md TRAP.
- ClauBack/LXAV1 created (full snapshot FULL_2026-10-03_116ffd8 + these docs) after the user pointed me at the old CONTEXT design.
