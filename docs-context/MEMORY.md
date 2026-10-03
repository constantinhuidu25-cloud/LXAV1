# LXAV1 — MEMORY (permanent, verified knowledge)

LXAV1 = LEONXOXANA reskin of Drollyv3 (virtual credits only, no real money). Project: `C:\Users\leon4\Desktop\LXAV1`,
repo github.com/leoxoxana/LXAV1 (git remote name `leo`, branch `main`). Older sibling notes: `ClauBack\CONTEXT\*` (Drollyv3).

## User + standing rules (never ask again, never relax)
- User is a Romanian speaker; long explanations overwhelm them. Answer SHORT, NUMBERED, in Romanian. "brainstorm" = explain with
  concrete numbers in a table, no code.
- ONLY THE USER DEPLOYS ("doar eu dau deploy mereu"): `vercel --prod` from the LXAV1 folder. I never deploy, never push to GitHub unless asked.
  Always end a work round with "rulează `vercel --prod` din folderul LXAV1". ~20 commits are local-only (leo/main is at 8c385e2).
- Never type API keys / service-account JSON / tokens anywhere. If a tool/classifier blocks something (secret-store writes, `git remote`
  changes, deletions), give the user the exact command; do not work around the denial.
- Every visible text change goes into ALL 3 languages (de = default, ro, en), including hard-coded CSS `content:` strings, and is verified
  by switching through the real language menu.
- Verify measurably (headless Edge via CDP: phone/PC/landscape/PWA) before saying "done". Say plainly what could NOT be verified
  (real iPhone / real Android / Safari / Firefox engines).
- No PWA/"Install" button without a new explicit request (asked + cancelled several times in the Drolly days; same here).
- User authorised: "if you find other problems, fix them directly regardless of subject" — still report them.
- Backups: user pre-authorised new backups in ClauBack without asking (see NOTES.md for the vN convention).
- Commits: trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; message in a scratchpad file, `git commit -F`.
  (PowerShell shows "Exit code 255" only because git's LF->CRLF warning goes to stderr; the commit still succeeds.)

## Game rules (client game-engine.js, mirrored on the server in functions/lxa-account.js) — all VERIFIED
- 5 lines x 10 columns, target word LEONXOXANA. PAYTABLE x line stake (bet/5): 3/10 .50, 4/10 .75, 5/10 1, 6/10 1.5, 7/10 2, 8/10 3, 9/10 5, 10/10 8.
- Jackpot mission: complete 5 DIFFERENT lines at 10/10; tier multipliers [1,2,3,4,5] x the stake. 5/5 pays 5x the stake (NOT 15x: 15x is the
  whole-cycle total; I once said 5/5 = 15x and the user corrected me). One jackpot line per spin; after 5/5 the cycle restarts.
- WILD: natural chance 50% + 0.2% per level (cap level 50); extra WILDs from the level (78/20/2% bands, capped by the level). A WILD fills the missing
  letter of its line. LXAV1 rule (differs from Drolly's "wildAssistedTen"): ANY line that shows a WILD cell is excluded from the jackpot mission and
  from record hits; it still pays its normal line payout. "WILD x1 · 50%" in the round summary = number of WILD cells + the game's WILD chance;
  it is NOT a payout multiplier (the user asked; consider rewording).
- WILD price ladder (wildUpgradeCost = price of the NEXT level, x admin cost multiplier): level1 2.5M, 2-3 3.5M, 4-5 4.5M, from 6: n x 1M, ending 50M.
- MAX STAKE (user-defined, final): the "+" button raises the stake up to the WHOLE balance but never above the WILD cap
  `maxBetForWildLevel(level) = max(5, floor(price of level+1 / 2))`: WILD 0 -> 1,250,000; 1 -> 1,750,000; 10 -> 5,500,000; 37 -> 19,000,000;
  40 -> 20,500,000; 48 -> 24,500,000; 49 -> 25,000,000; 50 -> 25,500,000 (no level 51 exists, so the ladder simply continues).
  The 50% button = half of the balance, then cut to the same cap (2M @WILD40 -> 1M; 120M @WILD40 -> 20.5M; 120M @WILD0 -> 1.25M).
  A "MAX ..." line under the stake shows the effective ceiling (min of balance and cap). BANK does not count. Enforced in 3 places: engine
  resolveSpin, server `spin` (HTTP 400 "Bet exceeds the maximum..."), UI (`setLocalBet`/`normalizeLocalBet`, renderer.js ~L1023-1040).
  WRONG TURN to remember: I once enforced "max half of the balance" for "+" (option A); the user wanted "+" up to the whole balance, only WILD-limited.
  Reverted before committing. Do not re-add a half-balance cap for "+".
- Why the cap exists: jackpot tiers pay a multiple of the stake, so an unlimited stake would be a money multiplier.

## Accounts / storage / server
- Static client + Vercel serverless: `api/lxa-account.js` -> `functions/lxa-account.js` (logic), `functions/firebase-storage.js` (firebase-admin Realtime DB),
  `functions/security.js` (validateBet, rate limits, idempotency cache). `middleware.js` = Vercel Edge Middleware that 404s sensitive root files.
- Firebase Realtime Database `lxav1-a5cfd` (europe-west1), default URL fallback in firebase-storage.js (env value sanitised/validated).
  Env var NAMES (values live only in Vercel, never in repo): FIREBASE_DATABASE_URL, FIREBASE_SERVICE_ACCOUNT, LXA_PEPPER.
  Login "Server temporarily unavailable" earlier = env vars added AFTER the deploy -> needs a redeploy.
- Account nodes live under `accounts/` keyed `"<id> : <name>"` (e.g. `25 : ANA`, no zero padding). The server finds accounts by the `id` FIELD,
  so a hand-edited node still works; the key is renamed on the next save or when the admin opens the PLAYERS list (legacy `account:N` nodes
  are normalised). The Firebase console sorts keys as text. Admin = `role:"admin"` on the account (no id constraint); `lxaRestoreSession`
  never trusts a cached role.
- Old settings (`rtpSettings`) and old accounts were NOT migrated from the previous Firebase; production `settings:{}` = code defaults.
- Production Firebase still holds test accounts (zzprobe*, lxatest*, lxaspd*, ids 14-19): the user deletes them (console -> Export/Import JSON or manual).

## Deployment (Vercel)
Project lxa3/lxa. Domains: lxoxa.vercel.app (primary, user-added), lxav1.vercel.app, lxa-lxa3.vercel.app. `vercel.json`: outputDirectory ".", no-cache headers,
CSP (`default-src 'self'`, connect-src firebasedatabase.app), HSTS, X-Frame-Options DENY. Cron jobs / demo bots / legacy build script were removed
(commit a9fcfed). Cache-bust: `?v=NNN` on style.css / layout-fix.css / responsive-compact.css / renderer.js / game-engine.js / spin-button.js in index.html —
bump on EVERY edit (current: layout-fix 431, renderer 399, game-engine 376, spin-button 7). sw.js: network-first, cache name `lxa-v2-cache`.

## UI / CSS system (PERMANENT lessons)
- `layout-fix.css` (~5200 lines, 384 KB) is patched by appended blocks. Override pattern: `html body:not(#_):not(#__):not(#___)` + `!important`,
  later block wins. When something "doesn't change", the first suspect is a later, equal/higher-specificity rule: read the COMPUTED style
  (CDP) instead of reading the CSS by eye.
- `.machine` is a CSS Grid with `grid-template-areas`; every direct child needs an explicit grid-area (a phantom `resultstrip` area once
  doubled a gap: 2px -> 4px). Gaps between main containers are 1px (vertical and horizontal) — user decision.
- One card style everywhere: radius 14px, 1px soft border, 2px magenta top border, 145deg blue->violet gradient.
- Header: transparent animated WebP `assets/lxa-header.webp` (luminance-keyed alpha) + CSS `::after` light sweep/glow + rails. Two root causes of the
  "visible rectangle" the user kept seeing: (1) the `::after` glow layer had no edge fade (hard step at box top/bottom), (2) `.brand` had
  overflow:hidden and clipped the 1.22x-scaled image before its own mask reached 0. Fix = fade mask on `::after` + `.brand/.topbar{overflow:visible}`.
  Measured: luminance step at box edge +17/-21 -> smooth ramp. Letters scale via `--lxa-art-scale:1.22`.
- Page background lives on `<html>` (root canvas), colour #272079 = theme-color/manifest colour. iOS/Android overscroll paints the root
  background-COLOUR, so every gradient layer must die out to exactly that colour at the top and bottom edges (radial glows centred at least one
  radius away from the edges; linear base gradient starts and ends on #272079). Verified: top/bottom rows = rgb(39,32,121) at all sampled x.
- Floating lock + Ko-fi park 1px inside the right edge of `.hero`, measured by the visible glyph (inline script `updateLockKofiFloat`);
  the lock blocks scroll only on touch screens (`(pointer:coarse)`), wheel is NOT blocked on desktop (user complaint).
- Reels: `startReelSpin()` returns {land(grid), fastForward(), abort()}; looping strip at 130 ms/cell starts the same frame as the tap;
  on result it re-lays out at the same offset and slides once (cubic-bezier .25,.6,.35,1, initial slope 2.4 -> ~2.5 s). The spin promise resolves when
  the last reel really stops (animation.finished), timer is only a safety net.
- SPIN button (spin-button.js): SPIN/STOP only, reacts on pointerdown. Progress ring (CSS `@property --spin-p`): creeps to 12% while the server answers,
  then `LXASpinButton.landing(ms)` restarts it from the current fill to 100% over the REAL slide time (alternating keyframes a/b); STOP snaps in 180 ms.
  Needs @property support (iOS >= 16.4). Previously a fixed 4.2 s fill, which vanished at ~60% (user: "not synchronized").
- Lesson: `vw` units mis-size variable-length content; prefer container queries (`cqw`) or JS measure-then-shrink (fitMissionTitle, fitMilestoneAmounts,
  fitWinBoardRow). A `display:none` flex child between siblings can still perturb spacing: remove it from the DOM.
- Lesson: all user-visible strings sit in the renderer `tx118` table (de/ro/en) and in `data-i` markup; CSS `content:` strings are a separate place.

## PWA / install
- Manifest (name LXA, standalone, icons 192/512/512-maskable, ?v=2), `sw.js` with install/activate/fetch handlers, apple meta tags + apple-touch-icon.
- Chromium `Page.getInstallabilityErrors` on https://lxoxa.vercel.app AND local = [] (no errors); live manifest/icons/sw return 200 with right types.
- User report (Android): "Install app" does nothing, "Add to home screen" makes a plain shortcut that opens as a browser page with the URL visible;
  iOS "Add to Home Screen" behaves like an app. Probable cause is on the phone (Chrome could not mint a WebAPK: Play Services/network/other browser).
  NOT confirmed — need phone model + browser. Do not add an install button unless asked.

- Icons (2026-10-03): manifest icons = `assets/icons/lxa-icon-192.png`, `lxa-icon-512.png`, `lxa-icon-512-maskable.png` (palette-compressed, 32/171/110 KB, no query strings); old `icon-*.png` files
  still in the folder (unused). Drollyv3 had the same icon set; its files were ~5x smaller. A shortcut on the home screen stores its icon bitmap when created: after changing icons the user must
  remove and re-add it. An Android icon on a white tile = launcher-made shortcut (no WebAPK).
- `#message` (live status text) is `display:none` in this layout: never rely on it to show errors. Use the SPIN subtitle (`LXASpinButton.fail(text)`) or the account panel notice.
- Session facts: spin needs only the cached token; RESET/WILD/GELD/update/admin need the real password in memory (asked again after reopening, by design).

## Testing / tooling (what works here)
- Jest: 56 tests pass (game-engine, account-keys, idempotency, renderer-money-routing, spin-grid-letters). ESLint: 0 errors, 18 pre-existing warnings.
- Headless Edge via CDP (scripts live in the session scratchpad, recreate when needed): screenshot at a viewport, `Runtime.evaluate` to click/measure.
  Local server `local-server.js` (PORT patched to 8890 in a wrapper) talks to the PRODUCTION Firebase — only use guest mode for tests.
  Viewport audit = 13 viewports x 3 languages for overflow/clip/overlap. Known benign findings: `#headerActions` container box overlaps the cards
  (the floating lock/Ko-fi park there on purpose); one TEXT-OVERLAP at 320px de on the jackpot goal text.
- CDP full-page screenshot with `captureBeyondViewport:true` + PIL pixel sampling = how edge colours/steps are measured.
- REAL STANDALONE (PWA) EMULATION (found 2026-10-03): launch Edge headless with `--app=http://127.0.0.1:8890/` -> `matchMedia('(display-mode: standalone)')` is true and the
  `@media (display-mode:standalone)` CSS applies (`Emulation.setEmulatedMedia` display-mode does NOT work). Add `Emulation.setSafeAreaInsetsOverride {insets:{top:59,bottom:34,left:0,right:0}}`
  (works: env(safe-area-inset-top) = 59px). Phone browser tab = normal launch, 390 wide, insets 0. Real touch: `Emulation.setTouchEmulationEnabled` + `Input.dispatchTouchEvent`.
  Scripts: cdp_lib.js (helper with per-call timeout), cdp_parity2.js (rects + gaps + tap on SPIN in browser/pwa/pc), cdp_cmp.js (layout diff browser vs pwa). Recreate them from this description.
- PARITY RULE: below the header the browser tab and the standalone app have IDENTICAL layout (verified, <=1px); the only intended difference is the header spacer for the status bar
  (safe-area-inset-top). The gap between the animated art and the cards must be the same everywhere (6px measured in browser, PWA and PC).
- STALE PWA TRAP: an installed iOS PWA keeps the old page alive for days. A screenshot from the user without the "MAX ..." line under the stake means the PWA runs a build older than
  commit 5800313; ask the user to close it completely (swipe away) and reopen before judging any "fix did not work" report from the PWA.
- TRAP: never rewrite UTF-8 files with PowerShell 5.1 `Get-Content -Raw | Set-Content` (turns diacritics/euro into mojibake, adds a BOM); I did it once to
  index.html and had to `git checkout` it. Patch with Python (`open(..., encoding='utf-8', newline='')`) or the Edit tool; keep CRLF when the file has it.
- TRAP: `Start-Sleep` followed by a read is blocked by the harness; use background commands (run_in_background) and wait for the notification.
- A headless sample taken right after a page switch can be throttled (a 4.6 s outlier once); rerun before trusting a timing.

## Known unused / leftovers (not deleted, not user-approved)
assets: lxa-header.gif, wild.webp, wild-line.webp, wild-tall.webp, two "ChatGPT Image ..." PNGs, "ezgif...gif", "Litere cristaline ... .png";
`scripts/build.js` (build is not used by Vercel); `responsive-compact.css` is still linked; `audit-simulations.js` + `deployment-check.js` = dev tools.

## NOT VERIFIED (honest list)
Real iPhone Safari (safe areas, theme-color, rubber-band at the page edges), real Android Chrome, Firefox/Safari desktop engines, an installed PWA on a
real phone, the animated header while actually running (only static captures + numeric edge measurements), live behaviour of the newest commits
(not deployed), `@property` ring on iOS < 16.4 (would not animate).
