# LXAV1 — CHANGELOG

Rewritten from scratch 2026-10-03 (65 commits at that time; the hash is the authoritative detail). Newest first. Format per entry: what the user asked / cause / change / how it was verified / limits.
"Verified" = measured in headless Edge or Jest unless it says otherwise; nothing here was verified on a real phone.

## 2026-10-03 (late) — DEEP audit round 2 (started at 98% of the 5-hour usage window, so only the cheap, high-value part ran)
- Read-only live checks: `/functions/..`, `/package.json`, `/readme.md`, docs, tests, dev tools, `/.env.local`, `/.vercel/..`, `/scripts/build.js` all return 404; HSTS/CSP/XFO/nosniff/Referrer present;
  Permissions-Policy and Cross-Origin-Opener-Policy were MISSING -> added to vercel.json (invisible hardening; needs the deploy).
- Server invariants against the REAL handler with in-memory storage (audit_deep_a.js recipe): 300 spins -> 0 conservation violations, no non-cent values; cap at WILD 50 / 900M: 25,500,000 accepted, 25,500,005 -> 400;
  20 parallel spins on one account -> no lost update; password lockout after 5 wrong attempts (token restore still works); no-credential spin/deposit/list-players rejected.
- FOUND AND FIXED: 5 parallel `create` calls all received id 12 (id = max(existing)+1 from a read) -> duplicate ids (a probable cause of "session expired"). Now `reserveAccountId` (Firebase transaction on
  `meta/lastAccountId`, floor = highest existing id) in functions/firebase-storage.js, used by `create` (falls back to the old rule only when the storage module has no counter, i.e. in older test mocks).
  New regression test account-id-counter.test.js. Tests 64/64, ESLint 0 errors. Name uniqueness has the same race (two simultaneous creates with the same name) — NOT fixed.
- Static sweeps: no real innerHTML sink with unescaped server/user text (4 flagged lines are escaped or numeric); git history has no secrets (pickaxe: BEGIN PRIVATE KEY, private_key, AIzaSy, ghp_); no tracked
  secret-looking files; language tables tx118 and the second table have identical key sets (parser artefact only on the label).
- Not run in this round (usage): browser matrix re-run, offline/service-worker test, first-load LCP/CLS numbers, keyboard + contrast scan, `data-i` key check against the right table.

## 2026-10-03 (late) — Prompts and one finding
- Prompts written in `ClauBack\LXAV1\PROMPTS\` (mirrored in `docs-context/prompts/`): UNIVERSAL_PROMPT (any chat/model/session, capability ladder, CHANGE_POLICY, DECISION LIST, baseline pixel diff, BUDGET), MASTER_AUDIT_v2, MASTER_AUDIT_LITE.
- Running `audit-simulations.js` (a tool the prompt now prescribes) showed RTP about 164/137/107% for difficulty 1/2/3 and a stale RTP check in `renderer.js` (`reportBalance`, old Drolly targets). Game math untouched; waiting for the user to confirm it is intended (see CONTEXT.md open items).

## 2026-10-03 (late) — Hand-off preparation
- Merged the cloud session's branch `main-hsvmm0` (commit 2c36593: no "WILD xN - %" tag) locally as `239c766` (index.html conflict = version numbers only; renderer.js -> v=403). Docs refreshed (`c82da19`).
- ClauBack: CONTEXT folder rewritten from scratch; `.env.local` removed from the FULL snapshot (it must never be copied into backups).

## 2026-10-03 — Master audit (9acb861)
Scope: user's master prompt (audit -> root cause -> minimal repair -> verify; keep the LXA design; no deploy).
- Data integrity: `getAccounts()` returned {} on a failed Firebase read -> login "ID not found", `create` reused an id, duplicate ids -> "session expired"; whole-node saves could wipe boards/settings. Now it
  throws (HTTP 500); `getLeaderboard/getRtpSettings({strict:true})` for read-modify-write callers. Tests: storage-failure.test.js, storage-contract.test.js.
- Rate-limit bypass: per-IP limits used the Netlify-only `x-nf-client-connection-ip` header (spoofable on Vercel) -> now x-vercel-forwarded-for / x-real-ip / x-forwarded-for.
- LXA_PEPPER missing in production now logs a warning (default pepper kept; changing it would lock accounts out).
- `.vercelignore` (docs, tests, dev tools, ~14 MB unreferenced art, old icons). Netlify leftovers were comments only (two texts fixed).
- Performance: reel letters 135 -> 34 KB each, Ko-fi mug GIF 533 -> 126 KB (120 px; shown at 26-32 px). a11y: `#chance` slider named via aria-labelledby.
- Checked OK: admin role from the DB (no hardcoded id), guards on every action, idempotency, CSP/HSTS, XSS escaping, no tracked secrets, anonymous Firebase read/write = 401 (a PUT probe was sent and denied),
  npm audit (2 moderate, transitive, unreachable), deployment-check in sync, layout audit 33 viewport x language combos + 4 orientation switches = 0 findings, parity gap 6 px in browser/PWA/PC.
- Not done: `vercel build` (would pull secrets), id counter for simultaneous `create`, rate limits are per instance, Firebase rules not in the repo.
- Incident: C: at 0 GB because 27 Edge test profiles took 8.6 GB; removed; repo verified (git fsck, node --check, images decode).

## 2026-10-03 — Android icons, mission card, visible spin errors (37fae14)
- Icons: the user's Android shows LXA on a white tile (launcher-made shortcut) while DROLLY fills its tile (real WebAPK). Drollyv3 had the SAME icon set; differences = file size (14/52/41 KB vs 79/454/352 KB)
  and `?v=2` URLs. New palette PNGs `lxa-icon-192/512/512-maskable` (32/171/110 KB), manifest + sw (cache lxa-v3) updated, `?v=2` removed from manifest/icon URLs, apple-touch-icon untouched.
  Installability errors []. NOT verified that Chrome now creates a WebAPK; the old shortcut must be removed and re-added.
- Mission card: heading/goal smaller, `#missionList` gap 2 -> 6 px (progress bars sit on the cell bottom), light frame around `.mission-line-grid` removed; checked 320-1280 px x de/ro/en.
- Spin errors: `#message` is display:none, so rejected spins looked like "nothing happens". Reason now shows under SPIN (red; de/ro/en keys spinErrSession/Busy/Net/Fail, MAX BET) and an expired
  session opens the login panel. Tested with faked 401/429/500/400 answers. Protected actions that need the in-memory password are listed in MEMORY.md section 4.

## 2026-10-03 — Installed-app header haze (a74b4cc)
- Cause: in standalone the `.brand` box (112 px = 62 spacer + 50) also holds the status-bar spacer; the animated `::after` glow (sized in %) bloomed into it -> purple haze above the LXA that the browser did not have.
  Fix: `@media (display-mode:standalone){.brand::after{inset:env(safe-area-inset-top) 0 8px 0}}`. Measured: colour range above the art 31/25/41 -> 7/2/5; art brightness within 2% of the browser.

## 2026-10-03 — `?debug=1` log (4b47b47, a1e9303)
- SPIN reported dead in the phone browser; not reproducible. Opt-in on-screen log (taps + element on top, errors, handler decisions). Inert without the parameter.

## 2026-10-03 — Header parity browser / PWA / PC (0cf92c8)
- Measured gap art -> cards: browser -1 px, PC -2 px (overlap), PWA +6 px. Cause: my earlier `overflow:visible`. Fix: topbar margin-bottom `calc(var(--lxa-logo-h)*.1 + 3px)` outside standalone -> 6 px everywhere.
  Layout below the header identical browser vs PWA (18 elements, <= 1 px). Found the user's PWA was stale (no "MAX ..." line).

## 2026-10-03 — Stake can be changed during AUTO (6617547)
- Cause: `+/-/50%` returned early while `spinning` and AUTO leaves only 0.26 s between rounds; also the landing overwrote the stake with `result.state`. Now the change is shown at once, queued (`queuedBet`),
  re-applied after landing with balance + WILD caps. Verified: 100 -> +,+ -> 120; stakes used per round 100 then 120; 50% at 100k -> 50,000; `+` x30 at 120M WILD 0 stays 1,250,000; manual spins stay locked.

## 2026-10-03 — Overscroll edges (116ffd8) and header edges (1ecf410)
- Root background ends exactly on #272079 at top/bottom (glows centred a full radius from the edges); first/last rows = rgb(39,32,121).
- Header: the `::after` glow had no edge fade (luminance step +17/-21) and `.brand{overflow:hidden}` clipped the 1.22x art; fixed with 4-side mask + `overflow:visible`.

## 2026-10-03 — SPIN ring synced with the reels (937c527)
- Old fixed 4.2 s fill vanished at ~60% (reels stop at ~2.5 s). Now creep to 12% while the server answers, `landing(ms)` runs to 100% over the real slide, STOP snaps in 180 ms; the reel promise resolves on
  `animation.finished`. Sampled every 40 ms: ring 1 -> 95% linear, button idle at ~2.5 s (natural) / ~1.27 s (stop at 1.2 s).

## 2026-10-03 — Max stake rule (a90c4b9, b590e52, 5800313, 3d41b01)
- Cap = half the price of the NEXT WILD level (WILD 50 = 25.5M, ladder continues); "+" up to the whole balance, capped; 50% = half balance, clamped (old sqrt formula above 4M removed); "MAX ..." line;
  enforced in engine, server (400) and UI. Verified on 6 balance/WILD combinations. Wrong turn: half-balance cap for "+" (reverted before committing).

## 2026-10-03 — Earlier same morning (eb0c373)
- Single continuous reel motion, floating lock aligned by visible glyph, cleaner taller header art.

## 2026-10-02 — Visual system and rules (many iterations; see `git log`)
- Header: GIF -> panoramic registered GIF -> transparent animated WebP + CSS light (1650219, 346d688, f5e47b6, 6c2b00f, 768e35d, 8ec34bd, ed987eb). Brighter magenta theme (f5e47b6). One card style, styled
  control buttons, 1 px gaps (3ee7a14, 9e510dc, 8ec34bd). JACKPOT MISSION joined to WILD BANK (33aaf1f). WILD image fills its cell (8c385e2). PWA edge-to-edge banner + safe-area (a3c48af).
  Page background on the root canvas (094115c). Floating lock/Ko-fi parked at the card edge (3380381). State-driven SPIN/STOP with the net result under the label (e1d8a7d, 30ea5b4, b318482).
  Touch-down SPIN/STOP and full-bleed app icons (9f719fc). Reels start instantly on SPIN (0c58cd7).
- Rules/server: a line showing a WILD cell no longer counts for the mission or records (74af7e5); Firebase nodes keyed `<id> : <name>`, lookup by the id field (3b5efa3, 0d6bd49); session restore never trusts a
  cached admin role (87e88a8); Firebase fallback -> LXAV1 DB and env URL sanitised (20055f6); `.vercel`/`.env*` ignored (6e322c2).
- Rename/reskin: LEONXOXANA letters (e551eb7), per-letter badge images (7914165), all Drolly/Drollinger identifiers -> LXA (471be89), cron jobs/demo bots/legacy build script removed + service worker rewritten (a9fcfed).

## 2026-10-01 — Fork and migration (21cd7b7 ... ba56070)
- Initial import of the Drollyv3 security/bug fixes, LXA cyber-neon palette, rebrand to LXA, new brand assets, UTF-16 fix in .gitignore, migration from Netlify to Vercel (ba56070), animated LXA wordmark GIF as header.
- First deploy returned 500 "Server temporarily unavailable" because the env vars were added after the deploy -> redeploy.
