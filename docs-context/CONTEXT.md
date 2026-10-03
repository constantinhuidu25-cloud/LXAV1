# LXAV1 — CONTEXT (current state)

## Current state (as of 2026-10-03, git HEAD 116ffd8)
- LEONXOXANA reskin: complete. Core game/server rules: stable, 56/56 Jest tests, ESLint 0 errors.
- DEPLOY STATE: the user deploys by hand (`vercel --prod`). GitHub `leo/main` is at 8c385e2; 20 newer commits are local-only. Everything below
  (max stake, SPIN ring sync, header fade, seamless page edges) is committed locally and NOT live until the user deploys.
- Last round (2026-10-03), all committed, measured in headless Edge:
  1. Max stake: "+" up to the whole balance but never above half the next WILD level price; 50% = half the balance, same cap; "MAX ..." line
     under the stake (a90c4b9, b590e52, 5800313, 3d41b01). WILD 50 = 25.5M (ladder continues).
  2. SPIN progress ring synced with the real reel stop (~2.5 s) (937c527).
  3. Header LXA: no hard edges (glow layer fade + overflow visible) (1ecf410).
  4. Page edges for overscroll/force-scroll: top/bottom = exactly #272079 (116ffd8).
- ClauBack: full snapshot `FULL_2026-10-03_116ffd8` + these docs created this round.

## Files recently modified
game-engine.js (maxBetForWildLevel), functions/lxa-account.js (server cap), renderer.js (setLocalBet/normalizeLocalBet, #betMax, reel landing -> LXASpinButton.landing),
spin-button.js (ring), layout-fix.css (appended blocks: #betMax, ring keyframes, glow fade, overflow, root background), index.html (cache-bust v=431/399/376/7),
readme.md (Maximum stake section), game-engine.test.js + account-keys.test.js (cap tests).

## Tests / results
`npx jest` 56/56. `npx eslint .` 0 errors / 18 warnings (pre-existing, unused vars). Real-page checks of the stake rule on 6 balance/WILD combinations
(2M@40, 120M@40, 800k@0, 3k@0, 900M@50, 120M@0) all match MEMORY.md. Layout audit (13 viewports x 3 languages) unchanged.

## Current bugs / blockers
None known in code. Open questions / unverifiable here:
- Android: "Install app" does nothing on the user's phone (site passes Chromium installability on live + local). Need phone model + browser.
- iPhone real-device behaviour of the new page-edge background / header / ring is unverified.
- Wording of "WILD x1 · 50%" in the round summary confuses the user (looks like a multiplier). Options offered: drop the chance, or drop both. Waiting for a choice.

## Next recommended task
Wait for the user. If they ask: (1) deploy checklist (they run `vercel --prod`; re-test login/stake rule/header on a real phone), (2) resolve the
"WILD x1" wording (3 languages), (3) Android install diagnosis once phone + browser are known, (4) cleanup of unused assets/scripts (needs approval),
(5) user deletes test accounts in Firebase (zzprobe*, lxatest*, lxaspd*, ids 14-19).

On resume: read this file + MEMORY.md BEFORE scanning code; open ARCHITECTURE.md sections only for the task at hand; check `git status`/`git log -5`.
