# LXAV1 — CHANGELOG

Rewritten from scratch 2026-10-03 (65 commits at that time; the hash is the authoritative detail). Newest first. Format per entry: what the user asked / cause / change / how it was verified / limits.
"Verified" = measured in headless Edge or Jest unless it says otherwise; nothing here was verified on a real phone.

## 2026-10-03 (latest) - Installed app: banner 10 px lower, floating lock below the status bar (commit 54116ea; layout-fix v=464)
- Owner (iPhone screenshots, standalone): the LXA banner is too close to the top edge and the floating lock sits at the top (on the clock row); the distance to the right edge is fine.
- Cause 1: in standalone the top bar has a spacer row of env(safe-area-inset-top) and the banner image starts exactly at that line (top: env(...)), with no extra space. Cause 2: safeTop() in index.html cached its first measurement; iOS can report 0 at load, so the floating lock pinned at 14 px instead of 14 px + inset.
- Now: --lxa-top-gap: 10px (@media (display-mode:standalone) and html.lxa-standalone) added to every safe-area term of the top bar height / rows, banner height and image offset (10 rules in layout-fix.css); safeTop() measured on every call.
- Measured with emulated insets (59, 20, 0) + the lxa-standalone class: logo and content 10 px lower, floating lock top = 14 + inset (73 / 34 / 14), unchanged on a normal browser tab and on desktop. NOT verified on a real iPhone. NOT deployed.
- Background observation (no change made): lxa-header.webp is a 1280x80 transparent animated WebP (42 frames) whose outer 15 % on each side is fully transparent, so the pink / violet "smoke" seen around the logo comes from the page background and from the portrait banner's own dark navy fill (<700 px), not from the image.
## 2026-10-03 (latest) - Whole icon row aligned with the cards (commit 7219599; layout-fix v=463)
- Owner: "and the whole row, why is it not at the same distance?" (accepted: align everything with the card edge, same at rest and floating).
- Measured before: the header row stopped 6-11 px short of the cards' right edge (lock glyph 11 / 9 / 6 / 6 px inside at 390 / 844 / 1000 / 1280 wide); only the floating pair reached the edge (drift code).
- Now: updateLockKofiFloat() shifts #headerActions with left (inline, !important, 	ransition:none because the container has transition:all) by (card right - 1 + lock glyph gap) - the lock's right edge, so the lock glyph is 1 px inside the card edge at rest and floating; the floating lock/Ko-fi use the shifted column right edge, so there is no drift code any more. Recomputed on load, fonts.ready, +500 ms / +1500 ms, resize / orientation, ResizeObserver on body and the card (the card edge settles after load; the first version overshot by 5 px until this was added).
- Measured: glyph-to-card 0 px at rest and floating on 4 viewports and after 6 live resizes (390, 844, 1280, 768, 360, 1920), no horizontal overflow, 0 px sideways movement while scrolling, ID / flag / lock spacing unchanged, slide consistency unchanged. NOT verified on a real phone / Safari / Firefox. NOT deployed.
## 2026-10-03 (latest) - Floating lock + Ko-fi back at the card edge (commit 6dabb86; layout-fix v=461)
- Owner: "very good, only the gap to the right edge got bigger; before it was about 1 px". Since v25 the floating pair used the header column x (13 / 13 / 23 / 35 px); before that it sat with the lock glyph 1 px inside the right edge of the content cards (lock box 2 / 4 / 17 / 29 px).
- Now: edge is computed live (card right edge - 1 + glyph gap of the lock emoji box); floating lock right = edge, Ko-fi centred under it (+ cup nudge), 4 px gap. Before the pin the static pair gets 	ranslate: drift (drift = (header column x - edge) * min(1, scrollY / sticky distance)), so the pin / unpin never jumps sideways. At rest the pair stays in the header column.
- Measured on 4 viewports: floating lock 2 / 4 / 17 / 29 px from the right edge, glyph-to-card distance 0, Ko-fi centre 2.6-3.2 px right of the lock centre (nudge), gap 4 px, max sideways step 1.5-3.6 px per 2 px of scroll, exact return to rest. NOT verified on a real phone. NOT deployed.
## 2026-10-03 (latest) - Header slide 5 px later (commit e715a02; layout-fix v=460)
- Owner asked for 5 more pixels (chose option A: the slide point). SLIDE_LATER = 5 in the inline script of index.html: point = lock top + 0.65 x flag height - 5; the slide-back point moves with it (SLIDE_HYST 4 unchanged).
- Measured (3 viewports): slide in at scrollY 24-30 (was 18-24); same state for the four ways of arriving at a position; ~5 px less overlap. NOT deployed.
## 2026-10-03 (latest) - Header slide: position-only trigger (commit afbb303; layout-fix v=459)
- Owner: "mostly very good but sometimes it does not respect these values, sometimes it differs".
- Cause (measured on v28): the slide state depended on the scroll direction; between ~24 and ~60 px of scroll the same position gave different results depending on how you arrived (down: slid from 24; up / jump from below: slid only at 66), and scrolling up inside that band snapped the flag back instantly (lxa-snap).
- Now: SLIDE_AT = 0.65 (slide in when the flag's bottom < lock top + 0.65 x flag height), SLIDE_HYST = 4 px (slide back above that point + 4); no goingDown / lastY / snap. Same 0.45 s in / 0.18 s back.
- Measured (3 viewports, 4 ways of arriving at each position): identical state everywhere except inside the 4 px hysteresis; sliding animates (max ~14 px / 30 ms). Trade-off accepted: the flag passes behind the lock for ~20 px of scroll in both directions (lock drawn above, tappable); an overlap-free slide needs direction memory = the inconsistency removed here. Fallbacks: v28, v26. NOT verified on a real phone / Safari / Firefox. NOT deployed.
## 2026-10-03 (latest) - Header slide: geometry-based trigger (commit ee7a503; layout-fix v=458)
- Owner liked the 20 px test on some screens only; accepted the adaptive version (same moment everywhere).
- Constants in the inline script of index.html: SLIDE_DOWN_OVERLAP = 0.65 (slide in when flag bottom < lock top + 0.65 * flag height), SLIDE_BACK_MARGIN = 20 (slide back when scrolling up while flag bottom > lock top - 20). CSS: .45 s in, .18 s back (.lxa-back), .lxa-snap = no transition for flicks.
- Measured on 9 viewports (320x568 ... 1920x1080): slide in at scrollY 18-24 with flag bottom 35-38 px on every screen; 0 overlaps on slow scroll up and all flicks; ~18 px of scroll with the flag behind the lock while sliding in (accepted for this test). Overlap-free fallback = v26. NOT verified on a real phone / Safari / Firefox. NOT deployed.
## 2026-10-03 (latest) - Header slide TEST: 20px / 20px / 0.30 s (commit 5a39649; layout-fix v=457)
- Owner asked to lower the slide trigger to 20 px of scroll (down), return when the flag is 20 px above the lock zone (was 44), duration 0.30 s (was 0.32), "de test". Constants SLIDE_DOWN_AT / SLIDE_BACK_MARGIN in the inline script of index.html.
- Measured: scrolling down slowly, the flag overlaps the lock for ~18 px of scroll (scrollY 21-39; the flag is still level with the pinned lock when the slide starts); slow scroll up and flicks: no overlap (flicks snap back). The overlap-free version is v26 (45 px / 44 px / .32 s). NOT verified on a real phone. NOT deployed.
## 2026-10-03 (latest) - Header: safe-moment slide (commit 548071d; layout-fix v=456, inline script in index.html)
- Owner clarified: "rocada = alunecare" - the ID + flag slide into the lock's column must stay, without the flag/lock overlap of v23, and without anything disappearing, fading, shrinking, moving or jumping. Chose option A (slide at a safe moment); fallback v23 slightly improved.
- Constraint stated to the owner: a lock that never moves + a slide into its column cannot both be visible at once; the only overlap-free moment is when the flag's bottom is above the lock's top, i.e. the flag is leaving the screen.
- Now: lock + Ko-fi sticky in their column (v25 logic, 4px gap, z-index 2100); .lxa-slid (ID + flag translateX one column, .32 s) is set when scrolling down and the flag bottom < lock top - 4px; removed when scrolling up and the flag bottom > lock top - 44px (slides back early); a flick that leaves the slid state while the flag is inside the lock zone adds .lxa-snap (no transition) so there is never an overlap.
- Measured (headless Edge, 3 viewports): 0 overlaps in slow scrolls (3px / 120 ms) down and up and in flicks 0->150, 150->0, 120->30, 30->120; lock x constant; slide toggles at scrollY ~45-48 (flag bottom ~8px) down and ~81-84 (flag bottom ~-27px) up; end state identical to the start. The slide is therefore only just visible (~8px strip at the top edge). NOT verified on a real phone / iPhone notch. NOT deployed.
## 2026-10-03 (latest) - Header: order always [ID][flag][lock], sticky lock + Ko-fi (commit 02859b3; layout-fix v=455, inline script in index.html)
- Owner (final, after the slide / castling / dock / scroll-linked / rotation attempts v16-v24): "nu vreau asemenea rocade, vreau sa pastreze mereu ordinea corecta [ID][steag][lacat], cu lacatul si Ko-fi floating pastrandu-si locul mereu".
- Now: ID and flag never move. updateLockKofiFloat(): when the ID button's top (= where the lock would be in the grid) passes 14px + safe area, the lock + Ko-fi become position:fixed in the same header column (right = right edge of #headerActions, Ko-fi centred under the lock, 4px gap, top 14px / 14+lock+4px); before that they simply scroll with the page, so the switch is seamless. CSS: .lock-kofi-floating neutralises the old ID/flag translateX rules (transform:none), #headerActions{row-gap:4px}, Ko-fi margin 0, z-index 2100 for the floating pair.
- Measured (headless Edge, 3 viewports, scroll 0-200 in 4px steps, flicks, 400): order ID < flag < lock at every position, no overlap, lock x constant, max vertical step 4px per 4px of scroll, gap 4px, end state identical to the start. NOT verified on a real phone / iPhone notch. NOT deployed.
- Lesson: when the owner says the order must stay [ID][flag][lock], do not look for a "smart" animation; the first plain answer (sticky lock, no slide) was the right one. Fallback variants: v23 (original + lock above flag), v24 (rotation).
## 2026-10-03 (latest) - Header rotation: no overlap, lock always visible (commit 9f96b1d; layout-fix v=453, inline script in index.html)
- Owner: with the original behaviour the lock was drawn OVER the flag (or the flag over the lock) - "nu vreau peste steag". Geometry: the pinned lock and the flag cannot occupy the corner at the same time, so one of (lock hidden / lock elsewhere / flag not sliding) is needed; the owner wants the slide and a visible lock -> lock elsewhere.
- Now: scroll > 8px -> ID + flag slide one column right (as before), the lock + Ko-fi translate to the far-left column (CSS 	ranslate, .46 s, hop over the others, lock above via z-index 2100). Result [lock][ID][flag]; the row keeps scrolling away together, aligned (nothing pinned). When the flag bottom is 22px above the pinned spot the pair (already off the top of the screen) is docked in the header column (position:fixed, top 14px + safe area, Ko-fi 4px under the lock, drop-in); scrolling up it fades out (.15 s) and the rotated row takes over; at the top everything slides back.
- Measured (headless Edge, 3 viewports): no overlap at any settled position; lock visible at every scroll position except a ~6px window (portrait 56-62, desktop 56-62) while it leaves the screen and docks; only the ~0.5 s crossing during the swap overlaps (inherent to a swap). The v23 variant (original + lock above the flag) is the fallback. NOT verified on a real phone / iPhone notch. NOT deployed.
## 2026-10-03 (latest) - Header: back to the original behaviour + lock above the flag (commit 30d493f; layout-fix v=452)
- Owner chose "D: go back, as it was, but improved so it is seen". My castling / dock reveal / scroll-linked dock (v19, v21, v22) and the single-column rules (v16) were over-engineered and made the lock disappear: all removed.
- index.html floating script = the one from fdc391d again (git show fdc391d:index.html). Measured identical to the old behaviour: floating lock 2 / 4 / 17 / 29 px and Ko-fi 9 / 9 / 24 / 36 px from the right edge, lock top 14px, Ko-fi 8px under it. ID + flag slide one column right (0.28 s).
- Only addition: .lock-kofi-floating lock + Ko-fi get z-index 2100 (the flag has z-index 2000), so the lock is drawn above the sliding flag and stays fully visible and tappable (checked with elementFromPoint). The flag still passes behind the lock between ~8 and ~47 px of scroll.
- Kept from earlier requests: flag 2.5px lower, Ko-fi cup nudge (translateX 10%). Lesson: when the owner says "go back", restore first and add the smallest possible improvement. NOT verified on a real phone. NOT deployed.
## 2026-10-03 (latest) - Header dock driven by scrollY (commit 401af75; layout-fix v=450, inline script in index.html)
- Owner: the timer-based dock reveal "disappears or jumps too fast"; chose option 1 (same look, scroll-linked).
- Now updateLockKofiFloat() computes everything from the scroll position: stage 1 (scrollY 8..20) lock + Ko-fi fade out in the grid; stage 2 (26..50) ID + flag slide one column right (inline transform, !important beats the old class rules); stage 3 (flag bottom 14..38 px above the pinned spot) the pair is position:fixed in the header column (top 14px + safe area, Ko-fi 4px under the lock) and rises 10px / scales .9->1 while fading in. Same motion in both directions; short transitions (.08-.2 s, fade-out faster than fade-in) only smooth flicks.
- Exit from the docked state forces opacity 0 without a transition before returning to the grid; the fade-in at the top waits .3 s for the flag to slide out. Result: no visible overlap at settled positions, in slow scrolls (4px/40ms) down and up, and in flicks 0->120 / 120->0 (3 viewports). The pair is invisible between roughly 20 and 55-60 px of scroll (by design). Reduced-motion = no transitions. NOT verified on a real phone / iPhone notch. NOT deployed.
## 2026-10-03 (latest) - Header: old look + dock reveal instead of the castling (commit 4649848; layout-fix v=446, inline script in index.html)
- Owner: the castling looked chaotic before docking (lock stranded in the middle column, cup over a card) -> chose "D: go back, but improved".
- Checked the pre-change behaviour in a temp worktree of fdc391d: ID + flag slide right into the lock's column, lock + Ko-fi pinned at top 14px; flag and lock overlapped for scroll 8..~47px.
- Now: scroll > 8px: ID + flag slide one column right (0.46 s, after a 0.14 s delay) while the lock + Ko-fi fade out in place (.lxa-dock-hidden); when the flag has scrolled 22px above the pinned spot the pair drops into the header column (.lock-kofi-floating + .lxa-dock-in, top 14px + safe-area, Ko-fi 4px under the lock); scrolling up, it fades out (.lxa-dock-out, exit threshold 14px above the lock) before the flag returns; at the top it fades back in at its grid spot. Reduced-motion = no transitions.
- Measured (headless Edge, 3 viewports): no visible overlap at any settled position and during slow scrolls (5px steps / 50 ms) down and up; end state identical to the start. The pair is invisible for roughly the first 65px of scroll (by design). NOT verified on a real phone / iPhone notch. NOT deployed.
## 2026-10-03 (latest) - SPIN profit: mint-green word + opaque gold burst (commit 94595bd; layout-fix v=444)
- Owner: drop the yellow word, use a nice green that fits the site, and bring back the strong gold burst without transparency (it was made translucent only so a gold word stayed readable).
- Now: profit word + icon #3dffa8 (site mint, same family as the lock glow / win lines) with a dark green outline; gold burst fully opaque again (rgba(...,1)). Loss (pink-red #ff7a90) unchanged. Checked in headless Edge: the green word is readable on the opaque gold from the first frame. Jest 91/91, ESLint 0 errors. NOT verified on a real phone. NOT deployed.
## 2026-10-03 (latest) - Header castling: lock/flag swap without overlap (commit 9573c34; layout-fix v=443, inline script in index.html)
- Owner: kept the slide animation (flag takes the lock's place) but wanted it overlap-free and more professional.
- Why the old slide collided: since the floating lock sits in the header column, the flag slid onto it. A swap needs the lock to be elsewhere while the flag arrives.
- Now (state machine in updateLockKofiFloat(), body classes lock-kofi-floating / lxa-swapped / lxa-dock-corner / lxa-returning / lxa-swapping): scroll > 8px -> the lock + Ko-fi slide one column left (hop over the flag, flag dips) while the flag slides into the lock's old column; ID stays. When the flag has scrolled up above the pinned lock (measured live, with hysteresis) the pair glides back to the header column. Scrolling back reverses it; at the top the pair glides to its exact resting spot (top transition) before the grid takes over, so nothing jumps. 0.46 s, cubic-bezier(.3,.7,.2,1); reduced-motion = instant; without CSS 	ranslate support the header simply stays still.
- Measured (headless Edge, 3 viewports, scroll 12..400 px, jumps back to 40, return to 0): no overlap at any settled position, final state identical to the initial one; only the intended ~200 ms crossing during the swap. NOT verified on a real phone / iPhone notch. NOT deployed.
## 2026-10-03 (latest) - SPIN result colour instantly + AUTO pause after profit (commit 93af522; renderer v=409, layout-fix v=442)
- Owner: the coloured word appeared late (white SPIN first) and in AUTO no change was visible.
- Cause 1: I forced the word white during the burst (1.2-2.4 s). Cause 2: in AUTO the next round starts ~0.3 s after finish() and start() clears the result.
- Now: word + icon coloured from the first frame (gold / pink-red), burst overlay strong at the edges and light in the middle, dark outline on the word. AUTO_PROFIT_PAUSE_MS = 1000 in renderer.js (profit only; 260 ms otherwise). Measured in real guest AUTO: gap after profit 1.32 s, after a payout below the stake 0.58 s.
- Open: the lock/flag overlap when floating starts (options A+B proposed; owner asked whether the flag can take the lock's place safely - answered: not at the same spot at the same time; awaiting decision). NOT verified on a real phone. NOT deployed.
## 2026-10-03 (latest) - SPIN result shown on the word, not a ring (commit 6f48557; layout-fix v=441)
- Owner disliked the orange/coral frame after a loss and proposed colouring the text instead (chose variant A).
- Now: after the burst, word + icon are gold (profit) or soft pink-red #ff7a90 with a dark outline (payout below stake) until the next round starts (data-result); nothing paid = white. The ring rules were removed. Idle / AUTO icons are CSS masks painted with currentColor so they follow the word colour; the STOP square is a plain white square. During the burst the word is white (it would vanish on the gold / coral flash). STOP state unchanged (owner agreed).
- Verified in headless Edge (frames portrait + landscape). Jest 91/91, ESLint 0 errors. NOT verified on a real phone. NOT deployed.
## 2026-10-03 (latest) - Lock + floating Ko-fi: one column, one gap (commit eff2d16; layout-fix v=440, inline script in index.html)
- Owner: "chaos" in the distances. Measured before: floating lock 2/4/17/29 px from the right edge vs 13/13/23/35 at rest; Ko-fi 9/9/24/36 vs 15.4/11.8/23.8/35.8; gap lock->Ko-fi 1/4/4/4 at rest and 8 floating.
- Cause: updateLockKofiFloat() parked the floating pair on the content-card edge and used 	op = lock + 8, while at rest the header grid decided the x and a margin decided the gap.
- Now: floating lock keeps the x of the header column (right edge of #headerActions), Ko-fi is centred under it (+ the existing 10% cup nudge), gap 4 px in both states (#headerActions{row-gap:4px} at rest, top offset 4 px floating). Measured: x identical at rest and floating in 4 viewports, gap 4 px everywhere, floating Ko-fi top 52/52/56/56 px; floating top still includes the safe-area inset.
- Verified in headless Edge (measurements + crops). NOT verified on a real iPhone (notch / Dynamic Island, emoji metrics). NOT deployed.
## 2026-10-03 (latest) - SPIN button v3 (commit 7af0380; spin-button.js v=11, layout-fix v=439)
- Owner: v2 effects were poor, vanished too fast, profit vs loss unclear; wanted a play icon and a double play for AUTO.
- Causes: the light-blue loss pulse was invisible on the blue button; the burst peaked at 16% of ~1 s; and renderer.js calls LXASpinButton.idle() right after finish() when the round animations end, which removed the effect class (idle() no longer touches it).
- Now: profit = ~2.2 s gold burst (glow, pop via the scale property, two light sweeps, sparkles); paid but net <= 0 = ~1.1 s coral burst; nothing paid = nothing. After it, a gold (breathing) or coral ring stays on the button until the next round starts (data-result, reuses .spin-ring). No tiers by win size (owner: too complicated).
- Icons: play triangle idle; double play when #autoSpin has aria-pressed=true (idle between AUTO rounds); white square while running. AUTO rounds restart ~0.3 s after a round, so on AUTO the effect is cut short by the next round (by design, not changed).
- Verified in headless Edge: frames at 0.15/0.45/0.9/2 s + ring at 3.5 s, coral, none, AUTO, portrait + landscape; real guest rounds fire both. Jest 91/91, ESLint 0 errors. NOT verified on a real phone. NOT deployed.
## 2026-10-03 (latest) - SPIN button v2 (commit 1f747fb; spin-button.js v=10, renderer v=408, layout-fix v=438)
- Owner: SPIN and STOP words sat at different heights (the last-win line under SPIN pushed the word up) -> amount removed from the button (the "last win" card shows it); word bigger (clamp 16px..42px) and identical in both states, centred to within 0.7 px in 4 viewports.
- Icon hangs left of the word (arrow idle, white square running); error text (rejected round) sits at the bottom edge, 2 lines max. Idle: breathing glow. Round end: gold flash if net > 0, short cool pulse if paid but net <= 0, nothing if nothing paid (called from finish(payout, net) only, so a language switch or reload never replays it). Not enough credit: muted button.
- Finding: the older `box-shadow !important` rules beat an animated box-shadow, so the STOP pulse added earlier today was not animating; all effects now animate `filter`. prefers-reduced-motion: static colour only.
- Verified in headless Edge (screenshots of idle/STOP/profit/part/error/low in portrait + landscape; real guest rounds fire both flashes). Jest 91/91, ESLint 0 errors. NOT verified on a real phone. NOT deployed. aria-label is now just "SPIN".
## 2026-10-03 (latest) - UI round: admin popup scroll, stake centred, SPIN STOP, flag/Ko-fi (commit 40b7cc0; renderer v=407, layout-fix v=437)
- Owner: admin popup could not be scrolled (portrait and landscape); stake lower/centred between +/-; Ko-fi under the lock; flag lower; nicer SPIN while running, no extra text.
- Cause (popup): height limit existed only below 641 px wide, and the global page-lock touchmove/wheel handlers in renderer.js blocked scrolling inside the popup. Fix: card limited to the viewport at every width with its own scroll, handlers exempt .account-panel, page behind locked while open.
- Stake: #bet on grid row 2 with align-self:center -> centre equals the +/- button centre (0.0 px in 5 viewports). SPIN [data-state=spinning]: neon magenta, glow pulse, light sheen, white stop square, white ring; reduced-motion respected.
- Flag +2.5 px lower. Ko-fi moved RIGHT (translateX 10%), not left: the cup's visible centre sat ~3 px left of the lock centre; owner can ask to flip.
- Verified in headless Edge: wheel + real touch-drag scrolling (lock on/off). Jest 91/91, ESLint 0 errors. NOT verified: real iPhone/Android (emoji glyph metrics differ per platform). NOT deployed.
## 2026-10-03 (latest) — No rounding: same return at every stake (game-engine v=378)
- Owner: RTP must be the same for everyone, no rounding. Measured first: the REAL SERVER path (logged-in players) is already exact - difficulty 1 = 163.0 / 162.7 / 163.5 / 163.6% at stakes 5 / 10 / 50 / 1000 (model 163.2%);
  my earlier "stake 5 pays +18 points more" finding was about the GUEST engine only (whole-euro `cents()`), not a general problem - I stated it too broadly.
- Fix: engine `cents()` now rounds to 2 decimals (same as the server `money()`); guest return at stakes 5 / 50 / 1000 = 163.2 / 136.7 / 107.7% (model 163.2 / 136.7 / 107.6). Regression tests (stake 5 and 10 within the model, balances keep <= 2 decimals).
- Jest 91/91, ESLint 0 errors. A guest session of 8 rounds plays normally (amounts displayed in whole euros). NOT deployed (needs `vercel --prod`).

## 2026-10-03 (latest) — Deployed by the owner; live verified; Firebase rules recorded
- Owner ran `vercel --prod` (deployment lxa-jap8guh9a-lxa3, alias lxoxa.vercel.app). Read-only checks: HTTP 200 on the alias, live assets game-engine 377 / layout-fix 436 / renderer 406 / spin-button 9 / style 376,
  Permissions-Policy + Cross-Origin-Opener-Policy present, `get-rtp-settings` answers with the new `computed` figures, `/functions/..`, `/docs-context/..`, tests -> 404, manifest + new icons + sw -> 200.
- Production RTP settings are now 130 / 110 / 95 in line mode (switch off): totals 142.0 / 120.8 / 102.3 at WILD 0.
- Firebase Realtime Database rules pasted by the owner: `.read:false`, `.write:false` (matches the earlier anonymous-access probe: 401). Stored as `database.rules.json` (documentation + for the Firebase CLI; not uploaded: `.vercelignore`).
- NOT verified live: login, restore, AUTO and the admin switch against the real Firebase (needs the owner's credentials - never entered by me).

## 2026-10-03 (latest) — Connected RTP switch + exact total-RTP model (game-engine v=377, renderer v=406, layout-fix v=436)
- Owner request: an admin switch "RTP connected with the rest" vs "disconnected", covering the casino spin (WILD, jackpot) and the 3 difficulties.
- ENGINE: `expectedTotalRtp(difficulty, wildLevel)` = exact long-run return of lines + WILD + jackpot from the real rules (WILD count law with bands and extra-WILD frequency, hypergeometric WILD placement, paytable + WILD cap,
  jackpot cycle by inclusion-exclusion over WILD-free open lines and the 5-tier cycle). Validated against seeded 300k-spin CHAINED simulations: diff 0.13 / 0.10 / 0.04 / 0.01 points (<= 0.8 SE). `setDifficultyTotalRtp`
  (bisection, 48 steps, ~17 ms for three difficulties), `computeDistribution` (pure helper extracted from `recomputeDistribution`), `applyAdminSettings` (single deterministic application order; fixes the old order dependence
  where a warm server instance calibrated line targets against a previous request's payout multiplier).
- SERVER: `applyRtpSettings` now just reads the settings and calls `game.applyAdminSettings`; `set-rtp-settings` accepts `rtpLinked` + `rtpRefLevel` (0-50, validated); `get-rtp-settings` / save responses carry `computed`
  (line, total at the reference level, total at WILD 0 and 50); the RTP reset scope clears the switch.
- CLIENT: admin RTP panel gets the switch, the reference WILD level field and the computed lines (de/ro/en: rtpHintLinked, rtpLinkLabel, rtpRefLabel, rtpLines, rtpTotal); the guest mirror calls `applyAdminSettings` (guests now also
  get jackpot frequency and the payout / jackpot multipliers, which were silently ignored before).
- TESTS: Jest 89/89 (rtp-linked.test.js: model vs simulation incl. a stress mix, solver, clamp, custom precedence, determinism; rtp-linked-server.test.js). End-to-end (real Edge -> real handler): 9/9 (panel opens, switch/ref/values,
  computed lines equal the targets, de/ro/en labels, switch OFF saves and changes the meaning, no script errors after the mirror).
- CORRECTION of my earlier chat numbers: fresh-state simulations under-counted the jackpot cycle; true totals at the shipped targets are 163.2 / 136.7 / 107.6 (not 162 / 135 / 107).
- FINDING (game math, NOT changed): integer rounding of line payouts makes the stake-5 RTP 181.6 / 156.5 / 129.5% (see MEMORY).
- NOT VERIFIED: the live deployment, real Firebase persistence of the new fields, real-phone rendering of the new panel rows.

## 2026-10-03 (latest) — DEEP audit round 3 (remaining checks, EMULATED, usage window had reset) + accessibility fixes (layout-fix v=435, renderer v=405)
- First load (cache off, CPU x4 slower): 1738 KB in 26 requests (stylesheet 440, images 1033, script 184, fonts 22); LCP 484 ms, CLS 0.000, total blocking time 348 ms. Top: layout-fix.css 386 KB (uncompressed here; the host
  compresses), lxa-header.webp 326 KB, kofi-support-me-2.gif 313 KB, renderer.js 136 KB, kofi-rainbow-mug.gif 123 KB. Under the 2 MB budget.
- Service worker: second visit 20 of 25 requests answered by the SW, cache `lxa-v3-cache`, offline reload shows the full app and a guest round still plays.
- Layout matrix after all of today's changes: 33 viewport x language combinations + 4 live orientation switches, 0 findings.
- Keyboard: Tab reaches 17 controls in a sensible order; Enter on SPIN starts a round; Space/Enter on + and - change the stake. FOUND: the lock and the win-chance slider showed no focus ring -> one `:focus-visible` rule
  (invisible to mouse/touch). FOUND: three landmark names were German-only (`aria-label` on the slot machine, rules, win-chance section) -> follow the language now (slot: Spielautomat / Aparat de joc / Slot machine; rules:
  Spielregeln / Regulile jocului / Game rules; win-chance section labelled by its visible title). Verified in de/ro/en; focus ring on all 17 stops.
- Contrast (68 visible text elements vs the pixels behind): 3 below AA - the loss amount under SPIN (3.69:1 at 17 px), `#lineStake` (3.84:1 at 7 px), `#boardTitle` (3.84:1 at 10 px). Design decision, not changed.
- Language keys: every `data-i` key resolves in tx118 or the older table; the section texts switch correctly in de/ro/en.

## 2026-10-03 (latest) — Persistent login, logout, AUTO/bet synchronisation (user's master prompt; renderer v=404)
- The prompt assumed Netlify + Firebase Authentication; the real stack is Vercel + a custom per-device token (no Firebase Auth, no SDK on the client). Same goals, applied to the real architecture.
- ROOT CAUSES: (1) "password asked again" = RESET / WILD / BANK required the password held only in memory (gone after a restart) while spin used the token; (2) `login` with id + NAME (no password) issued a full token
  (anyone knowing a public leaderboard name + small id); (3) `reset-geld` had NO authentication; (4) one shared plain `sessionToken` per account (logout could not revoke a device; stored in the DB in clear);
  (5) a failed silent restore showed the cached account as if logged in; (6) AUTO started the next round 260 ms after the previous one regardless of PLUS/MINUS activity.
- SERVER (functions/lxa-account.js): sessions = hashed per-device tokens (`issueSession`, `revokeSession`, `revokeAllSessions`, legacy field honoured), `authorize` (token OR password) for deposit / buy-wild / reset-new-game / reset-geld,
  id+name-only login removed, new `logout` action, password change and admin reset revoke all sessions, `publicAccount` strips `sessions`.
- CLIENT (renderer.js): token added to every request, password only for update/admin, `lxaSessionLost()` (401 on a token action or a failed restore -> clear token + cache, drop the game session, open the login panel),
  logout = server revoke + `lxaInvalidateGame()` (AUTO stopped, `spinToken++`, reel animation aborted, `queuedBet` cleared; a result arriving later is discarded before any animation/credit change), `lxaAuthGeneration`
  checked by the AUTO loop, hint texts + new `resetConfirm` in de/ro/en, RESET confirmation, id+name branch removed from the login form.
- AUTO/BET: PLUS/MINUS only change `gameState.bet` (the NEXT round); the round in flight keeps its own stake; AUTO waits (`BET_SETTLE_MS` = 800 ms after the last change, and while a button is held) before starting the next round,
  then uses the final bet; AUTO is never disabled.
- Tests: Jest 76/76 (auth-session.test.js: 12 server tests incl. legacy token, revoke, password change, admin still password-only, unauthenticated GELD). End-to-end (real Edge page -> intercepted /api -> the REAL handler with
  in-memory storage; recipe in MEMORY.md): 21/21 PASS — login, no password in storage, refresh, full browser restart, BANK/GELD without password, id+name refused, AUTO+bet (round 1 keeps its stake, round 2 the new one, no spin
  inside the settle window, burst + + + - -> one spin with the final bet, hold + -> no spin while held, AUTO still on, balance = start + sum(payout - stake) = displayed balance), logout during a pending spin (state cleared,
  AUTO stopped, no new spin, pending result dropped, server revoked the token, stays logged out after refresh), stale token -> unauthenticated + login panel, no game operation while unauthenticated, RESET confirmation.
- NOT VERIFIED: real iPhone/Android/Safari behaviour of the restored session, `confirm()` inside an installed iOS PWA, the live deployment (nothing deployed), real Firebase transactions for `reserveAccountId`/saves.
- Consequence to tell the user: after the deploy nobody can log in with id + name alone; the owner needs a known password (or the database `safeWord` edit).

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
