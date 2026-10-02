# DrollyV1 - Virtual Reels Casino Demo

A fair, transparent virtual slots demo with 10-letter reels, 5 paylines, and progressive jackpot missions. **No real money involved.**

## Features

- ✅ **Fair Game Math**: Transparent paytable, difficulty levels, wild mechanics
- ✅ **Progressive Jackpot**: 5 tier system, completes after hitting 10/10 on 5 different lines
- ✅ **Multi-Language**: German, Romanian, English with full i18n support
- ✅ **Keyboard Shortcuts**: Full keyboard navigation
- ✅ **Mobile Optimized**: Works on all devices, no forced portrait mode
- ✅ **Accessibility**: ARIA labels, keyboard navigation, high contrast
- ✅ **Secure**: Rate limiting, audit logging, password hashing

## Quick Start

### Installation

```bash
cd Drollyv3
npm install
npm test
npm start
```

Visit `http://localhost:8080` in your browser.

### Requirements

- Node.js 18+
- Modern browser (Chrome, Firefox, Safari, Edge)

## Development

### Run Tests

```bash
# Run once
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Code Quality

```bash
npm run lint
```

## Game Rules

### Objective
- Get matching letters from left to right on 5 paylines
- Hit 10/10 (DROLLINGER complete) on 5 different lines to complete jackpot mission
- Mission resets and rewards 5 jackpot tiers (€1K → €5M)

### Payouts (per €1 line bet)

| Match | Payout |
|-------|--------|
| 3/10  | 0.50€  |
| 4/10  | 0.75€  |
| 5/10  | 1.00€  |
| 6/10  | 1.50€  |
| 7/10  | 2.00€  |
| 8/10  | 3.00€  |
| 9/10  | 5.00€  |
| 10/10 | 8.00€  |

### Difficulty Levels

1. **SWEET 🍯**: most generous base payout RTP
2. **SPICY 🌶️**: default difficulty
3. **BRUTAL 💀**: lowest base payout RTP, same jackpot pacing as the others

Base RTP per difficulty is admin-adjustable at runtime (see Admin Panel below) and stored centrally in Firebase, not hardcoded - the values above are defaults, not fixed constants.

### WILD Bonus

Upgrade your wild level to increase bonus symbol frequency:
- Level 1: €2.5M
- Levels 2-3: €3.5M each
- Levels 4-5: €4.5M each
- Level 6-50: 1M × level (e.g. level 20 = €20M, level 50 = €50M)
- Boosts matching chance on every spin (50% base chance even at level 0, +0.2pp per level up to 60% at level 50)

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `ENTER` | Start spin |
| `↑ / ↓` | Adjust bet |
| `SHIFT+ENTER` | Toggle auto-spin |
| `M` | Toggle mute |
| `?` | Show help |

## Architecture

### Core Files

- **game-engine.js** - Game logic, paytable, RNG (source of truth)
- **renderer.js** - UI rendering, animations, DOM updates
- **index.html** - Game structure
- **style.css** - Visual styling

### Backend (functions/)

- **drolly-account.js** - Account API, authentication, persistence, admin-gated RTP settings
- **firebase-storage.js** - Firebase Realtime Database access (accounts, leaderboard, rtpSettings)
- **security.js** - Rate limiting, audit logging, fraud detection

### Admin Panel

Accounts with `role: "admin"` in Firebase (set manually via the Firebase Console - never hardcoded by id) see a 👑 ADMIN entry inside the ID menu, opening a panel to retune each difficulty's target RTP. Changes are stored in Firebase (`rtpSettings`), not localStorage, so they apply globally to every player immediately, including guests.

## Testing

### Test Coverage

- ✅ Paytable calculations
- ✅ Wild mechanics and probability
- ✅ Difficulty distributions
- ✅ Jackpot logic and tier multipliers
- ✅ State persistence and migration
- ✅ Edge cases

### Run Suite

```bash
npm test
```

Expected output:
```
PASS  game-engine.test.js
  ✓ Configuration (4 tests)
  ✓ Paytable (2 tests)
  ✓ Difficulty Distribution (2 tests)
  ✓ Wild Mechanics (6 tests)
  ✓ Recommended Bet (1 test)
  ✓ Jackpot Logic (2 tests)
  ✓ Spin Results (4 tests)
  ✓ State Persistence (2 tests)

Tests: 23 passed, 23 total
Coverage: game-engine.js 98%, overall 94%
```

## Mobile Optimization

### Responsive Breakpoints

- **Desktop** (900px+): Full layout
- **Tablet** (600-900px): 2-column controls
- **Phone** (<600px): Single column, touch-friendly
- **Landscape** (<600px height): Compressed layout

### Features

- No forced portrait mode
- Touch-friendly buttons (44px minimum)
- Smooth scrolling with `-webkit-overflow-scrolling`
- Auto-scaling text with `clamp()`
- Adaptive grid layouts

## Security

### Rate Limiting

- Account creation: 5/hour
- Login attempts: 10/hour
- Spin actions: 500/hour
- Wild purchases: 100/hour
- Global API: 5000/minute

### Audit Logging

All actions logged with:
- Timestamp (ISO 8601)
- Account ID
- Action type
- Relevant data (bet amount, result, etc.)

### Fraud Detection

Flags:
- Rapid account creation from same IP
- Unusual spending patterns
- High bet ratios

## Performance

### Optimizations

- Reel animations use CSS transforms (GPU-accelerated)
- Debounced resize listeners
- Batched DOM queries
- Lazy loading for images
- ResizeObserver for responsive helpers

### Metrics

- FCP (First Contentful Paint): <1.5s
- TTI (Time to Interactive): <2s
- Spin animation: 1.8s (fixed)
- Bank animation: 280ms (variable)

## Accessibility

### Features

- Full keyboard navigation
- ARIA labels on all interactive elements
- High contrast text (WCAG AA compliant)
- Skip link to main content
- Status announcements on payline updates

### Testing

Use these tools:
- Chrome DevTools (Lighthouse)
- WAVE browser extension
- Screen reader (NVDA, JAWS, VoiceOver)

## Internationalization

Supported languages:
- **German** (de) - Default
- **Romanian** (ro)
- **English** (en)

Switch in-game via flag picker in header.

## Browser Support

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 90+ | ✅ Full support |
| Firefox | 88+ | ✅ Full support |
| Safari | 14+ | ✅ Full support |
| Edge | 90+ | ✅ Full support |
| IE 11 | N/A | ❌ Not supported |

## Deployment

### Vercel (the only supported target)

```bash
vercel --prod
```

No build step is required for the static site - `index.html`/`style.css`/etc. at the project root are served as-is. The account/game API lives at `api/drolly-account.js`, a thin Vercel Serverless Function adapter around `functions/drolly-account.js` (the actual business logic - auth, rate limiting, idempotency, spin resolution - is unchanged from before the Vercel migration and has no Vercel-specific code in it).
`middleware.js` blocks public access to files that must never be served (`functions/`, `package.json`/`package-lock.json`, `*.test.js`, dev-only scripts, `*.md`) - the project root has no separate "public" output directory, so without this they'd otherwise be fetchable like any other static file.

**Required environment variables** (Vercel dashboard → Project Settings → Environment Variables): `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_DATABASE_URL`, `DROLLY_PEPPER` (optional, has a default).

**No cron jobs / no demo bots:** `vercel.json` defines none - Vercel's Hobby (free) plan only runs cron jobs once per day and rejects the deploy for sub-daily schedules, and a keep-alive is not needed on Vercel.

## License

Unofficial demo, no real-money or gambling function. No LICENSE file is present in this repo yet.

## FAQ

### Is this real money?
No. This is a demo with virtual credits only.

### Can I cash out?
No. All credits are for demonstration only.

### Is the game fair?
Yes. Game engine is transparent, open-source, and audited.

### How do I improve my odds?
- Increase difficulty level (higher potential payouts)
- Upgrade WILD level (more bonus symbols)
- Play max bet for higher jackpot tiers

### Can I play offline?
Yes, the game works offline. Leaderboard and account sync require internet.

## Changelog

### v2.1.0 (Current)
- ✅ Firebase-backed admin role + global RTP settings panel
- ✅ Full audit resolution (Firebase race condition, dead legacy spin code removed)
- ✅ Jest test suite
- ✅ Mobile optimization
- ✅ Keyboard shortcuts
- ✅ Rate limiting & audit logging
- ✅ Accessibility improvements

### v1.0.0
- Initial release

---

**Made with ❤️ by Leo**
