/* SeanceChrono (3.39): the timer of a training session, on the pitch.
   « Lancer la séance » runs the exercises one after the other, each with its own minutes: a big countdown, the name of the exercise
   and the next one, a whistle (the sounds of « Chrono et score ») and a vibration at each change, 3-2-1 before, the screen kept on.
   Pause, +1 min, skip, back; an exercise without minutes counts up until « Suivant ». The coach can start from any exercise (▶️ on its card).
   Nothing is saved: the plan is the session as it is. The « back » gesture of the phone closes it (class .sc-view, see appcfg). */
const SeanceChrono = (() => {
  const { esc } = UI;
  let st = null; // { tr, i, left, up, total, last, paused, timer, wake, ticked, pre }
  const mmss = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const play = k => { try { Terrain.play(k); } catch (e) {} };
  const buzz = p => { if (navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} };
  let css = false;
  function style() {
    if (css) return; css = true;
    const s = document.createElement('style'); s.id = 'scCss';
    s.textContent = '.sc-view{position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;background:#0e1d45;color:#fff;padding:calc(env(safe-area-inset-top) + 10px) 16px calc(env(safe-area-inset-bottom) + 14px);overflow:hidden}'
      + '.sc-top{display:flex;align-items:center;justify-content:space-between;gap:10px}.sc-top b{font-size:15px;opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sc-x{border:0;background:rgba(255,255,255,.14);color:#fff;border-radius:999px;min-height:40px;padding:0 14px;font:inherit;font-weight:700}'
      + '.sc-mid{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:6px;min-height:0}.sc-step{font-size:14px;opacity:.75}.sc-name{font:800 clamp(22px,6vw,34px)/1.15 var(--round,inherit);max-width:100%;overflow-wrap:anywhere}'
      + '.sc-time{font:800 clamp(72px,24vw,150px)/1 ui-rounded,-apple-system,system-ui,sans-serif;letter-spacing:-.02em;font-variant-numeric:tabular-nums;margin:6px 0}.sc-time.pre{color:#e2c27d}.sc-time.over{color:#fca5a5}'
      + '.sc-bar{width:min(100%,520px);height:10px;border-radius:999px;background:rgba(255,255,255,.18);overflow:hidden}.sc-bar i{display:block;height:100%;background:#c9a45c;transition:width .25s linear}'
      + '.sc-next{font-size:15px;opacity:.8;margin-top:8px}.sc-next b{opacity:1}.sc-cons{font-size:15px;line-height:1.35;opacity:.9;max-width:520px;margin-top:6px;max-height:4.2em;overflow:hidden}'
      + '.sc-ctl{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:min(100%,520px);margin:12px auto 0}.sc-ctl button{border:0;border-radius:16px;min-height:60px;font:inherit;font-size:18px;font-weight:800;background:rgba(255,255,255,.14);color:#fff}.sc-ctl .main{grid-column:1/-1;background:#8c1024;min-height:72px;font-size:22px}'
      + '.sc-tot{text-align:center;font-size:13px;opacity:.7;margin-top:8px}.sc-done .sc-name{color:#e2c27d}';
    document.head.appendChild(s);
  }
  const exs = () => (st && st.tr.exercises) || [];
  const cur = () => exs()[st.i];
  function setStep(i, withPre) {
    const e = exs()[i]; if (!e) return finish();
    st.i = i; st.up = !(+e.duration > 0); st.left = st.up ? 0 : +e.duration * 60; st.pre = withPre ? 3 : 0; st.ticked = -1; st.last = performance.now();
    if (!st.pre) { play('go'); buzz(300); }
    draw();
  }
  function finish() {
    if (!st) return; st.done = true; clearInterval(st.timer); play('end'); buzz([300, 120, 300, 120, 600]); wake(false); draw();
  }
  async function wake(on) {
    try { if (on && 'wakeLock' in navigator && st && !st.wake) st.wake = await navigator.wakeLock.request('screen'); else if (!on && st && st.wake) { await st.wake.release(); st.wake = null; } } catch (e) {}
  }
  function tick() {
    if (!st || st.paused || st.done) return;
    const now = performance.now(), dt = (now - st.last) / 1000; st.last = now; st.total += dt;
    if (st.pre > 0) { st.pre -= dt; const n = Math.ceil(st.pre); if (n !== st.ticked && n > 0) { st.ticked = n; play('tick'); buzz(80); } if (st.pre <= 0) { st.pre = 0; play('go'); buzz(300); } return draw(); }
    if (st.up) { st.left += dt; return draw(); }
    st.left -= dt;
    const n = Math.ceil(st.left); if (n <= 3 && n > 0 && n !== st.ticked) { st.ticked = n; play('tick'); buzz(80); }
    if (st.left <= 0) { const nx = st.i + 1; if (nx >= exs().length) return finish(); play('stop'); buzz([250, 100, 250]); return setStep(nx, true); }
    draw();
  }
  function draw() {
    const v = document.querySelector('.sc-view'); if (!v || !st) return;
    const e = cur(), n = exs().length, next = exs()[st.i + 1], d = +e.duration * 60 || 0;
    const cons = String(e.consignes || '').split('\n').map(x => x.trim()).filter(Boolean).slice(0, 3).join(' · ');
    v.classList.toggle('sc-done', !!st.done);
    v.innerHTML = `<div class="sc-top"><b>${esc(st.tr.title || 'Séance')}</b><button class="sc-x" data-sc="close">✕ Fermer</button></div>
      <div class="sc-mid">
        ${st.done ? `<div class="sc-step">Séance terminée</div><div class="sc-name">🏁 Bien joué !</div><div class="sc-time">${mmss(st.total)}</div><div class="sc-next">${n} exercice${n > 1 ? 's' : ''}, ${Math.round(st.total / 60)} min en tout</div>`
        : `<div class="sc-step">Exercice ${st.i + 1} / ${n}${d ? ` · ${Math.round(d / 60)} min` : ' · sans durée'}</div><div class="sc-name">${esc(e.title || 'Exercice ' + (st.i + 1))}</div>
          <div class="sc-time ${st.pre > 0 ? 'pre' : st.up ? 'over' : ''}">${st.pre > 0 ? Math.ceil(st.pre) : mmss(st.left)}</div>
          ${d ? `<div class="sc-bar"><i style="width:${Math.max(0, Math.min(100, 100 - st.left / d * 100))}%"></i></div>` : '<div class="sc-step">Le temps monte : touche « Suivant » quand c\'est fini</div>'}
          ${cons ? `<div class="sc-cons">${esc(cons)}</div>` : ''}
          <div class="sc-next">${next ? `Ensuite : <b>${esc(next.title || 'Exercice ' + (st.i + 2))}</b>${+next.duration ? ` · ${next.duration} min` : ''}` : 'Dernier exercice'}</div>`}
      </div>
      <div class="sc-ctl">${st.done ? `<button class="main" data-sc="close">Fermer</button>` : `<button class="main" data-sc="pause">${st.paused ? '▶️ Reprendre' : '⏸️ Pause'}</button>
        <button data-sc="prev" ${st.i ? '' : 'disabled'}>⏮️ Précédent</button><button data-sc="next">⏭️ Suivant</button>
        <button data-sc="plus">＋ 1 min</button><button data-sc="restart">↩️ Recommencer</button>`}</div>
      <div class="sc-tot">Temps total : ${mmss(st.total)}</div>`;
  }
  function close() {
    if (!st) return; clearInterval(st.timer); wake(false); st = null;
    const v = document.querySelector('.sc-view'); if (v) v.remove();
    document.body.classList.remove('sc-on'); window.removeEventListener('hashchange', close);
  }
  function open(tr, from = 0) {
    if (!tr || !(tr.exercises || []).length) return UI.toast('Ajoute d\'abord un exercice à la séance', 'err');
    close(); style();
    const v = document.createElement('div'); v.className = 'sc-view'; v.setAttribute('role', 'dialog'); v.setAttribute('aria-label', 'Chrono de la séance');
    document.body.appendChild(v); document.body.classList.add('sc-on');
    st = { tr, i: 0, left: 0, up: false, total: 0, last: performance.now(), paused: false, timer: 0, wake: null, ticked: -1, pre: 0, done: false };
    play('tick'); // the sound is allowed by this touch (iPhone)
    v.onclick = e => {
      const b = e.target.closest('[data-sc]'); if (!b || !st) return; const a = b.dataset.sc;
      if (a === 'close') return close();
      if (a === 'pause') { st.paused = !st.paused; st.last = performance.now(); return draw(); }
      if (a === 'next') { const nx = st.i + 1; if (nx >= exs().length) return finish(); play('stop'); return setStep(nx, false); }
      if (a === 'prev') { if (st.i) return setStep(st.i - 1, false); }
      if (a === 'plus') { if (!st.up) st.left += 60; return draw(); }
      if (a === 'restart') { st.done = false; st.paused = false; return setStep(st.i, false); }
    };
    window.addEventListener('hashchange', close);
    setStep(Math.max(0, Math.min(from, tr.exercises.length - 1)), true);
    st.timer = setInterval(tick, 200); wake(true);
  }
  return { open, close, running: () => !!st };
})();
