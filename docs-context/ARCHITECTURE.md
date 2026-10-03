# LXAV1 — ARCHITECTURE

(Facts below were read/measured on 2026-10-03; "NEEDS VERIFICATION" marks anything not re-read in detail. Older Drolly equivalent: ClauBack\CONTEXT\ARCHITECTURE.md.)

## 1. Application structure
Static site, repo root served as-is by Vercel (`vercel.json` outputDirectory "."; no build step). Client files:
`index.html` (markup + inline scripts: language/header helpers, `updateLockKofiFloat`, service-worker registration), stylesheets
`style.css` (41 KB, `--lxa-*` tokens), `layout-fix.css` (384 KB, ~5200 lines of appended override blocks), `responsive-compact.css` (still linked),
scripts `game-engine.js` (pure math, UMD, also required by Jest), `renderer.js` (131 KB: UI, i18n tables, account panel, reels, spin loop),
`spin-button.js` (SPIN/STOP button + progress ring). PWA: `manifest.webmanifest`, `sw.js`, `assets/icons/*`.
Server (Vercel functions): `api/lxa-account.js` (entry) -> `functions/lxa-account.js` (all actions), `functions/firebase-storage.js`, `functions/security.js`.
`middleware.js` = Edge middleware that returns 404 for sensitive repo-root files (functions/, tests, package files, dev tools).
Dev tools in root: `local-server.js` (dev server, uses real Firebase), `audit-simulations.js`, `deployment-check.js`. Tests: 5 `*.test.js` files.

## 2. Game engine (game-engine.js)
UMD module with a frozen API. LINE_COUNT 5, COLUMN_COUNT 10, WILD marker. `resolveSpin(state, rng, now)` is the single source of truth for one spin
(guest/local path): selectLineResult per line -> applyWild -> payouts from PAYTABLE x line stake -> jackpot award -> credits = credits - stake + payout.
It throws "Insufficient credits." and "Bet exceeds the maximum for this WILD level." (maxBetForWildLevel).
`maxBetForWildLevel(level)`, `wildUpgradeCost(level)` (price of the NEXT level), `wildChance(level)`, `recommendedBet(credits)`, admin knobs
(RTP target per difficulty, custom distribution, WILD chance/per-level/cap/cost multiplier/extra-WILD frequency, payout and jackpot multipliers) are
getters/setters on the same module, mirrored from Firebase `rtpSettings` into the client for guests (renderer.js startup fetch).
Client and server each keep their OWN copy of the Wild-placement/payout code, kept in sync by hand (NEEDS VERIFICATION after any change to either).

## 3. Server (functions/lxa-account.js)
`exports.handler`: parses `action`, rate-limits, then dispatches: create, login (id+password / name+password / silent restore with session token),
spin, buy-wild, deposit, geld, set-difficulty, leaderboard, admin actions (RTP settings, list-players, admin-update-player, admin-delete-player, custom
distribution ...) — list taken from the Drolly design, NEEDS VERIFICATION for LXAV1 specifics.
`spin`: validateBet (min 5, <= balance) -> difficulty -> applyRtpSettings -> WILD cap check (`game.maxBetForWildLevel(account.wildLevel)`, 400 if exceeded) ->
makeGrid (only LXA letters, WILD marker `__BONUS_WILD__`) -> payouts -> jackpot/records (lines with a WILD cell are skipped) -> save + leaderboard.
Account storage: `accountKey(id,name) = "<id> : <name>"` (slugName), `findEntryById`, `rememberKey`, `save(account, keepStamp)` migrates the node key;
`list-players` normalises legacy `account:N` keys. Passwords: salted+peppered SHA-256 (env LXA_PEPPER), lockout after repeated failures.
Idempotency: client sends a requestId for spin/buy-wild/deposit (reused on a timeout retry); `IdempotencyCache` in security.js replays the response.

## 4. Client spin flow (renderer.js)
`$('#spin').onclick`: (a) if a round is running -> STOP: `LXASpinButton.stopped()` + `activeSpinHandle.fastForward()` (or remember `stopRequested`);
(b) else normalise the stake (`normalizeLocalBet`), `spinning=true`, `LXASpinButton.start()`, `startReelSpin()` (reels roll immediately), then
`lxaAccountResolveSpin` (server) or `game.resolveSpin` (guest) -> `reels.land(board)` (single eased slide) -> `LXASpinButton.landing(ms)` ->
await reel stop -> update state, `render`, `showSpinV79`, `LXASpinButton.finish`, balance count-up, `scheduleRankRefresh` (quiet leaderboard refresh).
Stake controls (renderer.js ~L1019-1095): `stakeStep` (5 / 500 / 2500 / 10000 by balance), `normalizeLocalBet`, `setLocalBet` (clamps to balance and WILD cap and
shows "MAX. EINSATZ/MIZĂ MAXIMĂ/MAX BET: <cap>" when the wish exceeded it), hold-to-repeat `bindHoldBet`, 50% button (`fiftyPercentBet` = balance x 0.5, then setLocalBet).
During AUTO the stake buttons stay active: `setLocalBet` stores the wish in `queuedBet` when `spinning && autoSpinEnabled`; the spin landing re-applies it (clamped) right after
`gameState = result.state`, and `queuedBet` is cleared at each round start. Manual spins keep the stake locked while `spinning`.
Display: `#bet`, `#betMax` ("MAX <effective ceiling>"), `#lineStake`; set in `renderGameV79` (~L579-581).

## 5. Persistence
Guest: localStorage game-state key (persist on every change). Account: cached account + session token in localStorage, `lxaRestoreSession` re-reads the
server on every load (never trusts a cached role). Server: Firebase Realtime DB (firebase-admin), nodes under `accounts/`, `leaderboard`, `settings`/`rtpSettings`.

## 6. UI / layout
`.machine` CSS Grid with `grid-template-areas`: topbar, hero (payout card + jackpot mission), console (reels), controls (balance | last win | stake | WILD/BANK/GELD/RESET),
SPIN, winboard, chance slider, leaderboard, quick-info (Jackpot mission + Wild bank joined card), history, Ko-fi bar, footer. 1px gaps. Header = animated WebP + CSS glow.
Root `<html>` carries the page background (#272079 canvas). PWA standalone: `@media (display-mode:standalone)` + `html.lxa-standalone`, safe-area spacer row.
Languages: de (default), ro, en via `tx118` tables + `data-i` attributes + a few CSS `content:` strings.

## 7. Deployment
Vercel project lxa3/lxa; domains lxoxa.vercel.app (primary), lxav1.vercel.app, lxa-lxa3.vercel.app. Env var names: FIREBASE_DATABASE_URL, FIREBASE_SERVICE_ACCOUNT, LXA_PEPPER.
Headers/CSP/HSTS in vercel.json. The user runs `vercel --prod`. A change to env vars needs a redeploy to take effect.

## 8. Known technical dependencies
- Every edit to a linked asset needs its `?v=NNN` bumped in index.html (users keep stale files otherwise; sw.js is network-first).
- The floating lock/Ko-fi (inline script) depends on `.hero` geometry; the SPIN ring depends on `@property` + `LXASpinButton.landing()` being called from `startReelSpin().land()`.
- `game-engine.js` and `functions/lxa-account.js` must agree on `maxBetForWildLevel` (server calls the shared module) and on the WILD-line jackpot exclusion.
- Root background colour (#272079) must match `theme-color`, manifest colours and the top/bottom of the gradient (overscroll), see MEMORY.md.
