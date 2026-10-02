/* SPIN button: two states, SPIN (idle) and STOP (reels running). Reacts on
 * touch-down so start/stop are instant. renderer.js only calls start /
 * stopped / finish / idle and recentPointer(). */
(function () {
  'use strict';

  const SPIN_MS = 2300;
  const LEARN_KEY = 'lxa-spin-stop-learned-v1';
  const COACH_SPINS = 3;
  const LABEL = { spin: 'SPIN', stop: 'STOP' };

  let btn, main, sub, hint, state = 'idle', lastPointerFire = 0, lastResult = null;

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
      btn.style.setProperty('--spin-ms', SPIN_MS + 'ms');
      btn.classList.remove('run');
      void btn.offsetWidth;
      btn.classList.add('run');
      paint();
      buzz(8);
    },
    stopped() {
      if (state !== 'spinning') return;
      setLearned(COACH_SPINS);
      btn.classList.add('snapped');
      buzz(16);
    },
    finish(payout) {
      btn.classList.remove('run', 'snapped');
      setLearned(Math.min(COACH_SPINS, learned() + 1));
      state = 'idle';
      paint();
      if ((Number(payout) || 0) > 0) buzz([12, 40, 12]);
    },
    idle() {
      btn.classList.remove('run', 'snapped');
      state = 'idle';
      paint();
    }
  };
  window.LXASpinButton = api;

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
