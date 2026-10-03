/* SPIN button: two states, SPIN (idle) and STOP (reels running). Reacts on
 * touch-down so start/stop are instant. renderer.js only calls start /
 * stopped / finish / idle and recentPointer(). */
(function () {
  'use strict';

  const SNAP_MS = 180;
  const LEARN_KEY = 'lxa-spin-stop-learned-v1';
  const COACH_SPINS = 3;
  const LABEL = { spin: 'SPIN', stop: 'STOP' };

  let btn, main, sub, hint, state = 'idle', lastPointerFire = 0, lastResult = null, snapped = false;

  // Progress ring: while the server is answering it creeps forward (CSS .run); ringTo() then restarts it from the
  // current fill to 100% over `ms`. Two identical keyframes (a/b) are alternated so each call restarts the animation.
  function ringTo(ms) {
    const ring = btn.querySelector('.spin-ring');
    const filled = ring ? parseFloat(getComputedStyle(ring).getPropertyValue('--spin-p')) : 0;
    btn.style.setProperty('--spin-from', (Number.isFinite(filled) ? filled : 0) + '%');
    btn.style.setProperty('--spin-ms', Math.max(1, Math.round(ms)) + 'ms');
    btn.dataset.ring = btn.dataset.ring === 'a' ? 'b' : 'a';
  }
  function resetRing() {
    btn.classList.remove('run', 'snapped');
    delete btn.dataset.ring;
    snapped = false;
  }

  const digits = id => {
    const el = document.getElementById(id);
    const n = parseInt(((el && el.textContent) || '').replace(/[^\d]/g, ''), 10);
    return Number.isFinite(n) ? n : null;
  };
  const learned = () => { try { return Number(localStorage.getItem(LEARN_KEY) || 0); } catch (e) { return 0; } };
  const setLearned = n => { try { localStorage.setItem(LEARN_KEY, String(n)); } catch (e) { /* storage unavailable */ } };
  const buzz = pattern => { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* unsupported */ } };

  function paint() {
    btn.dataset.state = state;
    btn.classList.toggle('coach', state === 'spinning' && learned() < COACH_SPINS);
    main.textContent = state === 'spinning' ? LABEL.stop : LABEL.spin;
    sub.textContent = state === 'idle' && lastResult ? lastResult.text : '';
    btn.dataset.net = state === 'idle' && lastResult ? lastResult.sign : '';
    hint.textContent = '';
    const bet = digits('bet'), credits = digits('credits');
    btn.dataset.funds = state === 'idle' && bet !== null && credits !== null && credits < bet ? 'low' : 'ok';
    btn.setAttribute('aria-label', [main.textContent, sub.textContent].filter(Boolean).join(' '));
  }

  const api = {
    recentPointer() { return performance.now() - lastPointerFire < 900; },
    setResult(text, net) {
      const value = Number(net) || 0;
      lastResult = { text: String(text || ''), sign: value > 0 ? 'win' : value < 0 ? 'loss' : 'even' };
      if (state === 'idle' && btn) paint();
    },
    start() {
      state = 'spinning';
      snapped = false;
      delete btn.dataset.ring;
      btn.classList.remove('run');
      void btn.offsetWidth;
      btn.classList.add('run');
      paint();
      buzz(8);
    },
    // The result arrived and the reels begin their final slide: the ring now runs from wherever it is to 100% in
    // exactly that slide time, so it is full at the instant the reels stop (renderer.js passes the real duration).
    landing(ms) {
      if (state !== 'spinning') return;
      ringTo(snapped ? SNAP_MS : ms);
    },
    stopped() {
      if (state !== 'spinning') return;
      setLearned(COACH_SPINS);
      snapped = true;
      btn.classList.add('snapped');
      ringTo(SNAP_MS);
      buzz(16);
    },
    finish(payout) {
      resetRing();
      setLearned(Math.min(COACH_SPINS, learned() + 1));
      state = 'idle';
      paint();
      if ((Number(payout) || 0) > 0) buzz([12, 40, 12]);
    },
    idle() {
      resetRing();
      state = 'idle';
      paint();
    }
  };
  window.LXASpinButton = api;

  // Opt-in diagnostics for phones without dev tools: open the site with ?debug=1 and an on-screen log shows taps, errors and
  // what the SPIN handler decided. Off (and invisible) in normal use; nothing is stored or sent anywhere.
  let trace = () => {};
  if (/[?&]debug=1\b/.test(location.search)) {
    const box = document.createElement('pre');
    box.style.cssText = 'position:fixed;left:0;right:0;top:0;max-height:38vh;overflow:hidden;margin:0;padding:4px 6px;font:10px/1.25 monospace;color:#9ff;background:rgba(0,0,0,.82);z-index:2147483647;pointer-events:none;white-space:pre-wrap;word-break:break-all';
    const lines = [];
    const show = () => { box.textContent = lines.slice(-14).join('\n'); };
    trace = msg => { lines.push((performance.now() / 1000).toFixed(1) + 's ' + msg); show(); };
    api.trace = trace;
    const describe = el => el ? (el.id ? '#' + el.id : el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : '')) : 'null';
    const attach = () => { if (!box.isConnected) document.body.appendChild(box); trace('debug on, ' + innerWidth + 'x' + innerHeight + ' standalone=' + matchMedia('(display-mode: standalone)').matches + ' touch=' + (navigator.maxTouchPoints || 0)); };
    if (document.body) attach(); else document.addEventListener('DOMContentLoaded', attach);
    window.addEventListener('error', e => trace('ERROR ' + e.message + ' @' + String(e.filename || '').split('/').pop() + ':' + e.lineno));
    window.addEventListener('unhandledrejection', e => trace('REJECT ' + (e.reason && e.reason.message || e.reason)));
    ['pointerdown', 'touchstart', 'click'].forEach(type => document.addEventListener(type, e => {
      const p = e.touches ? e.touches[0] : e;
      const top = p ? document.elementFromPoint(p.clientX, p.clientY) : null;
      trace(type + ' target=' + describe(e.target) + ' top=' + describe(top) + ' @' + (p ? Math.round(p.clientX) + ',' + Math.round(p.clientY) : '-'));
    }, true));
  }

  function init() {
    btn = document.getElementById('spin');
    if (!btn) return;
    main = btn.querySelector('b');
    sub = btn.querySelector('.spin-subtitle');
    hint = btn.querySelector('small');
    if (!main || !sub || !hint) return;
    [main, sub, hint].forEach(el => el.removeAttribute('data-i'));
    paint();

    // React on touch-down, not on release. The click that follows from the
    // same touch is dropped by renderer.js via recentPointer(); keyboard
    // clicks (detail 0) still work.
    btn.addEventListener('pointerdown', event => {
      if (event.button !== undefined && event.button !== 0) return;
      if (btn.disabled) return;
      lastPointerFire = performance.now();
      event.preventDefault();
      btn.classList.add('pressed');
      trace('spin pointerdown, onclick=' + typeof btn.onclick + ' state=' + state);
      if (typeof btn.onclick === 'function') btn.onclick(event);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => btn.addEventListener(type, () => btn.classList.remove('pressed')));

    ['bet', 'credits'].forEach(id => {
      const el = document.getElementById(id);
      if (el) new MutationObserver(() => { if (state === 'idle') paint(); }).observe(el, { childList: true, characterData: true, subtree: true });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
