/**
 * Backend security improvements
 * Rate limiting, audit logging, and input validation
 */

// Rate limiting configuration
const RATE_LIMITS = {
  CREATE_ACCOUNT: { requests: 5, window: 3600000 }, // 5 per hour
  LOGIN_ATTEMPT: { requests: 10, window: 3600000 }, // 10 per hour
  SPIN: { requests: 500, window: 3600000 }, // 500 per hour
  BUY_WILD: { requests: 100, window: 3600000 }, // 100 per hour
  API_GLOBAL: { requests: 5000, window: 60000 } // 5000 per minute globally
};

// In-memory rate limiter (use Redis in production)
class RateLimiter {
  constructor() {
    this.attempts = new Map();
    this.cleanup();
  }

  cleanup() {
    // .unref() so this timer alone never keeps the Node process alive (a
    // warm Netlify Functions instance stays alive via its own invocation
    // handling regardless; this only matters for short-lived processes like
    // local scripts or `jest`, which would otherwise hang after all tests
    // finish - found while adding idempotency.test.js, the first test file
    // to actually require lxa-account.js/security.js).
    this.timer = setInterval(() => {
      const now = Date.now();
      for (const [key, timestamps] of this.attempts.entries()) {
        const recent = timestamps.filter(t => now - t < 3600000);
        if (recent.length === 0) {
          this.attempts.delete(key);
        } else {
          this.attempts.set(key, recent);
        }
      }
    }, 300000); // Cleanup every 5 minutes
    this.timer.unref?.();
  }

  isAllowed(key, limit) {
    const now = Date.now();
    const timestamps = this.attempts.get(key) || [];
    const recent = timestamps.filter(t => now - t < limit.window);

    if (recent.length >= limit.requests) {
      return false;
    }

    recent.push(now);
    this.attempts.set(key, recent);
    return true;
  }

  reset(key) {
    this.attempts.delete(key);
  }
}

const limiter = new RateLimiter();

// v155: idempotency cache for the 'spin' action - closes the residual gap
// from the lxaRequest() fetch-timeout fix (renderer.js): if a request
// merely runs slow (not truly hung) and the CLIENT times out at 20s while
// the SERVER finishes and commits the spin anyway, a naive retry would be
// a genuinely new spin. The client now resends the SAME requestId on a
// timeout-retry (only generating a fresh one after a clean success/error),
// so a repeat arriving here returns the cached first response verbatim -
// no second debit, no second payout, no second jackpot check.
// Same known limitation as RateLimiter above (per-instance, not
// cross-instance/cold-start-safe) - acceptable here because the window
// that matters is seconds (one client retry after one timeout), not the
// rate limiter's hour-long window.
class IdempotencyCache {
  constructor(maxAgeMs = 120000) {
    this.entries = new Map();
    this.maxAgeMs = maxAgeMs;
    // .unref() - see RateLimiter.cleanup() above for why.
    this.timer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.entries.entries()) {
        if (now - entry.timestamp > this.maxAgeMs) this.entries.delete(key);
      }
    }, 60000);
    this.timer.unref?.();
  }
  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp > this.maxAgeMs) { this.entries.delete(key); return undefined; }
    return entry.value;
  }
  set(key, value) { this.entries.set(key, { value, timestamp: Date.now() }); }
}
const idempotencyCache = new IdempotencyCache();

// Audit logging
class AuditLog {
  constructor() {
    this.logs = [];
  }

  log(event) {
    const entry = {
      timestamp: new Date().toISOString(),
      ...event
    };
    this.logs.push(entry);

    // Keep last 10000 entries
    if (this.logs.length > 10000) {
      this.logs.shift();
    }

    return entry;
  }

  getByAccount(accountId, limit = 100) {
    return this.logs
      .filter(log => log.accountId === accountId)
      .slice(-limit);
  }

  getByType(type, limit = 100) {
    return this.logs
      .filter(log => log.type === type)
      .slice(-limit);
  }
}

const auditLog = new AuditLog();

// Input sanitization
function sanitizeInput(value, maxLength = 255) {
  if (typeof value !== 'string') return '';
  // v139: was /[^\w\s\-@.]/g (ASCII-only \w), which silently stripped
  // Romanian/international diacritics (ă,â,î,ș,ț, etc.) from real player
  // names. \p{L}/\p{N} (Unicode letter/number, 'u' flag) keeps any-language
  // letters while still stripping HTML/injection-risky characters like <>{}$.
  return value
    .trim()
    .slice(0, maxLength)
    .replace(/[^\p{L}\p{N}\s\-@.']/gu, '');
}

function validateEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function validateBet(bet, balance, minBet = 5) {
  const amount = Number(bet);
  return Number.isFinite(amount) && amount >= minBet && amount <= balance;
}

// Middleware for rate limiting
function checkRateLimit(action, key) {
  const limit = RATE_LIMITS[action];
  if (!limit) return true;

  if (!limiter.isAllowed(key, limit)) {
    return false;
  }
  return true;
}

// Middleware for global rate limit
function checkGlobalRateLimit() {
  return limiter.isAllowed('global', RATE_LIMITS.API_GLOBAL);
}

// Audit middleware
function auditAction(accountId, action, data = {}) {
  return auditLog.log({
    type: action,
    accountId,
    ...data
  });
}

// Fraud detection
function detectFraud(account, action, details) {
  const flags = [];

  // Check for rapid account creation from same IP
  if (action === 'CREATE' && details.ipAddress) {
    const recentCreates = auditLog.logs.filter(
      log => log.type === 'CREATE' && log.ipAddress === details.ipAddress && Date.now() - new Date(log.timestamp) < 3600000
    );
    if (recentCreates.length > 5) {
      flags.push('rapid_account_creation');
    }
  }

  // Check for rapid deposits/wild purchases
  if ((action === 'DEPOSIT' || action === 'BUY_WILD') && account) {
    const recent = auditLog.getByAccount(account.id, 20).filter(
      log => (log.type === 'DEPOSIT' || log.type === 'BUY_WILD') && Date.now() - new Date(log.timestamp) < 300000
    );
    if (recent.length > 5) {
      flags.push('rapid_spending');
    }
  }

  // Check for unusual betting patterns
  if (action === 'SPIN' && details.bet) {
    if (details.bet > (account?.balance || 0) * 0.5) {
      flags.push('high_bet_ratio');
    }
  }

  return flags;
}

module.exports = {
  RateLimiter,
  AuditLog,
  limiter,
  auditLog,
  sanitizeInput,
  validateEmail,
  validateBet,
  checkRateLimit,
  checkGlobalRateLimit,
  auditAction,
  detectFraud,
  RATE_LIMITS,
  idempotencyCache
};
