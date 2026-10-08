/* Terrain (2.53): the tools of the coach on the pitch.
   - Exercise timer: work / rest, repetitions, sets and rest between sets, 3-2-1 count, sounds (soft, loud, pitch, beep, horn),
     vibration, the screen kept on; presets (30-30, 15-15, 45-15, small games 4' / 1').
   - Score by bibs: 2 to 4 teams by the colour of their bibs, + / − in big buttons, kept on the phone. */
const Terrain = (() => {
  const { esc, toast } = UI;
  const S = () => Store.state;
  const SOUNDS = [['doux', '🔔 Doux'], ['fort', '📣 Fort'], ['terrain', '🏟️ Terrain'], ['bip', '📟 Bip'], ['klaxon', '🚨 Klaxon']];
  const PRESETS = [['30-30', 30, 30, 10, 1, 0], ['15-15', 15, 15, 16, 1, 0], ['45-15', 45, 15, 8, 2, 120], ['Jeu 4\' / 1\'', 240, 60, 4, 1, 0], ['Gainage 40-20', 40, 20, 6, 3, 90]];
  const BIBS = [['jaune', '#facc15', '#422006'], ['orange', '#f97316', '#fff'], ['rouge', '#dc2626', '#fff'], ['bleu', '#2563eb', '#fff'], ['vert', '#16a34a', '#fff'], ['blanc', '#f8fafc', '#0f172a'], ['noir', '#111827', '#fff'], ['rose', '#ec4899', '#fff']];
  const cfg = () => Object.assign({ work: 30, rest: 30, reps: 10, sets: 1, setRest: 0, count: true, sound: 'terrain', vibrate: true }, S().ui.chrono || {});
  const score = () => Object.assign({ teams: [{ c: 'jaune', s: 0 }, { c: 'bleu', s: 0 }] }, S().ui.bibScore || {});
  const mmss = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  /* ---------- sounds (made here: no file to load, works without network) ---------- */
  let ac = null;
  const audio = () => { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) { ac = null; } return ac; };
  function tone(freq, dur, type = 'sine', vol = .35, when = 0, slide) {
    const a = audio(); if (!a) return; const t = a.currentTime + when, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.linearRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .015); g.gain.setValueAtTime(vol, t + dur - .03); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + .02);
  }
  // kind: 'tick' (3-2-1), 'go' (start of work), 'stop' (start of rest), 'end'
  function play(kind, sound) {
    const s = sound || cfg().sound;
    if (kind === 'tick') return tone(s === 'doux' ? 660 : 880, .12, s === 'doux' ? 'sine' : 'square', s === 'doux' ? .2 : .3);
    if (s === 'doux') return kind === 'end' ? [0, .25, .5].forEach((w, i) => tone(523 * (1 + i * .25), .3, 'sine', .3, w)) : tone(kind === 'go' ? 784 : 523, .45, 'sine', .3);
    if (s === 'bip') return [0, .18].slice(0, kind === 'go' ? 1 : 2).forEach(w => tone(1000, kind === 'end' ? .6 : .15, 'square', .3, w));
    if (s === 'klaxon') return [0, .32].slice(0, kind === 'stop' ? 1 : 2).forEach(w => { tone(392, .28, 'sawtooth', .35, w); tone(494, .28, 'sawtooth', .25, w); });
    if (s === 'terrain') { // a whistle: high, with a trill
      const n = kind === 'end' ? 3 : kind === 'stop' ? 2 : 1; for (let i = 0; i < n; i++) { const w = i * .35; tone(2800, .28, 'sine', .4, w); tone(2950, .28, 'triangle', .15, w); }
      return;
    }
    return tone(kind === 'go' ? 1200 : 700, kind === 'end' ? .9 : .4, 'square', .4); // fort
  }
  const buzz = p => { if (cfg().vibrate && navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} };

  /* ---------- the timer ---------- */
  let run = null; // { plan: [{k:'work'|'rest'|'setrest', d, rep, set}], i, left, last, paused, wake }
  function plan(c) {
    const p = [];
    for (let s = 1; s <= c.sets; s++) {
      for (let r = 1; r <= c.reps; r++) { p.push({ k: 'work', d: c.work, rep: r, set: s }); if (r < c.reps && c.rest > 0) p.push({ k: 'rest', d: c.rest, rep: r, set: s }); }
      if (s < c.sets && c.setRest > 0) p.push({ k: 'setrest', d: c.setRest, rep: c.reps, set: s });
    }
    return p;
  }
  const total = c => plan(c).reduce((a, x) => a + x.d, 0);
  async function wake(on) {
    try { if (on && 'wakeLock' in navigator && !run.wake) run.wake = await navigator.wakeLock.request('screen'); else if (!on && run && run.wake) { await run.wake.release(); run.wake = null; } } catch (e) {}
  }
  function start(root) {
    const c = cfg(); audio(); // the sound is allowed by this touch (iPhone)
    run = { plan: plan(c), i: 0, left: c.count ? 3 : 0, pre: c.count, last: performance.now(), paused: false, wake: null, ticked: -1 };
    if (!run.plan.length) { run = null; return; }
    if (!run.pre) { run.left = run.plan[0].d; play('go'); buzz(300); }
    wake(true); loop(root);
  }
  function loop(root) {
    if (!run || run.paused) return;
    const now = performance.now(), dt = (now - run.last) / 1000; run.last = now;
    run.left -= dt;
    const c = cfg(), sec = Math.ceil(run.left);
    // 3-2-1 before the start and before each change
    if (sec !== run.ticked && sec <= 3 && sec >= 1 && (run.pre || c.count)) { run.ticked = sec; play('tick'); }
    if (run.left <= 0) {
      if (run.pre) { run.pre = false; run.left = run.plan[0].d; play('go'); buzz(300); run.ticked = -1; }
      else if (run.i >= run.plan.length - 1) { play('end'); buzz([300, 120, 300, 120, 500]); draw(root, true); wake(false); run = null; toast('🏁 Terminé, bravo !'); return; }
      else { run.i++; run.left += run.plan[run.i].d; run.ticked = -1; const k = run.plan[run.i].k; play(k === 'work' ? 'go' : 'stop'); buzz(k === 'work' ? 300 : [150, 80, 150]); }
    }
    draw(root);
    run.raf = requestAnimationFrame(() => loop(root));
  }
  function draw(root, done) {
    const big = root.querySelector('#chBig'); if (!big) { if (run) { cancelAnimationFrame(run.raf); wake(false); run = null; } return; }
    const c = cfg();
    if (!run) { big.className = 'ch-big idle'; big.innerHTML = done ? '<div class="ch-ph">🏁 Terminé</div><div class="ch-t">0:00</div>' : `<div class="ch-ph">Prêt</div><div class="ch-t">${mmss(c.work)}</div><div class="ch-sub">Durée totale ${mmss(total(c))}</div>`; return; }
    const st = run.plan[run.i], k = run.pre ? 'pre' : st.k;
    big.className = 'ch-big ' + k + (run.paused ? ' paused' : '');
    const left = run.plan.slice(run.i + 1).reduce((a, x) => a + x.d, 0) + Math.max(0, run.left) + (run.pre ? run.plan[0].d : 0);
    big.innerHTML = `<div class="ch-ph">${run.paused ? '⏸️ Pause' : k === 'pre' ? 'Prêts…' : k === 'work' ? '🔥 Effort' : k === 'setrest' ? '🧘 Récup entre les séries' : '😮‍💨 Récup'}</div>
      <div class="ch-t">${run.pre ? Math.max(1, Math.ceil(run.left)) : mmss(run.left)}</div>
      <div class="ch-sub">Répétition ${st.rep}/${c.reps}${c.sets > 1 ? ` · série ${st.set}/${c.sets}` : ''} · reste ${mmss(left)}</div>`;
  }

  /* ---------- the page ---------- */
  function page(root, sub) {
    const tab = sub === 'score' ? 'score' : 'chrono';
    const c = cfg(), sc = score();
    const num = (k, l, min, max, step = 5) => `<label class="fld ch-num"><span>${l}</span><span class="ch-step"><button type="button" data-chstep="${k}:-${step}">−</button><input type="number" inputmode="numeric" min="${min}" max="${max}" data-ch="${k}" value="${c[k]}"><button type="button" data-chstep="${k}:${step}">+</button></span></label>`;
    root.innerHTML = `<header class="page-head"><div><h1>⏱️ Chrono et score</h1><p class="sub">Les outils du terrain : chrono d'exercice sonore, score par chasubles</p></div></header>
      <div class="m-tabs" role="tablist"><button class="m-tab ${tab === 'chrono' ? 'on' : ''}" data-trtab="chrono">⏱️ Chrono d'exercice</button><button class="m-tab ${tab === 'score' ? 'on' : ''}" data-trtab="score">🎽 Score par chasubles</button></div>
      ${tab === 'chrono' ? `
      <div class="ch-big idle" id="chBig"></div>
      <div class="ch-ctl">${run ? `<button class="btn primary big" data-ch-act="pause">${run.paused ? '▶️ Reprendre' : '⏸️ Pause'}</button><button class="btn big" data-ch-act="skip">⏭️ Suivant</button><button class="btn danger big" data-ch-act="stop">⏹️ Arrêter</button>`
        : `<button class="btn primary big" data-ch-act="start">▶️ Démarrer</button><button class="btn big" data-ch-act="test">🔊 Tester le son</button>`}</div>
      <section class="card"><h2>Réglages</h2>
        <div class="chips ch-presets">${PRESETS.map(([n], i) => `<button class="chip" data-chpre="${i}">${esc(n)}</button>`).join('')}</div>
        <div class="ch-grid">${num('work', 'Effort (s)', 5, 3600)}${num('rest', 'Récup (s)', 0, 3600)}${num('reps', 'Répétitions', 1, 99, 1)}${num('sets', 'Séries', 1, 20, 1)}${num('setRest', 'Récup entre séries (s)', 0, 1800, 15)}</div>
        <div class="ch-grid2"><label class="fld"><span>Son</span><select data-ch="sound">${SOUNDS.map(([k, l]) => `<option value="${k}" ${c.sound === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="switch small"><input type="checkbox" data-ch="count" ${c.count ? 'checked' : ''}><span>Décompte 3-2-1 avant chaque changement</span></label>
          <label class="switch small"><input type="checkbox" data-ch="vibrate" ${c.vibrate ? 'checked' : ''}><span>Vibrer (Android)</span></label></div>
        <p class="muted small">Durée totale : <b>${mmss(total(c))}</b>. L'écran reste allumé pendant le chrono. Sur iPhone, le son passe même en mode silencieux si le volume est monté ; garde l'appli ouverte.</p></section>`
      : `
      <div class="bib-board n${sc.teams.length}">${sc.teams.map((t, i) => { const b = BIBS.find(x => x[0] === t.c) || BIBS[0];
        return `<div class="bib-team" style="--bg:${b[1]};--fg:${b[2]}"><div class="bib-name">${esc(b[0][0].toUpperCase() + b[0].slice(1))}</div><div class="bib-score">${t.s}</div>
          <div class="bib-btns"><button data-bib="${i}:-1" aria-label="Enlever un point">−</button><button data-bib="${i}:1" aria-label="Ajouter un point">+</button></div></div>`; }).join('')}</div>
      <div class="ch-ctl"><button class="btn big" data-bibreset>↩️ Remettre à 0</button>${sc.teams.length < 4 ? '<button class="btn big" data-bibadd>➕ Une équipe</button>' : ''}${sc.teams.length > 2 ? '<button class="btn big" data-bibdel>➖ Une équipe</button>' : ''}</div>
      <section class="card"><h2>Couleurs des chasubles</h2>${sc.teams.map((t, i) => `<div class="bib-pick"><b>Équipe ${i + 1}</b>${BIBS.map(([k, bg, fg]) => `<button class="bib-dot ${t.c === k ? 'on' : ''}" style="background:${bg};color:${fg}" data-bibcol="${i}:${k}" aria-label="${k}">${t.c === k ? '✓' : ''}</button>`).join('')}</div>`).join('')}</section>`}`;
    draw(root);
    if (run && !run.paused) { cancelAnimationFrame(run.raf); run.last = performance.now(); loop(root); }
    const setC = (k, v) => { S().ui.chrono = Object.assign(cfg(), { [k]: v }); Store.persistNow(); };
    const setS = f => { const s = score(); f(s); S().ui.bibScore = s; Store.persistNow(); page(root, 'score'); };
    root.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.trtab) { location.hash = '#/terrain' + (b.dataset.trtab === 'score' ? '/score' : ''); return; }
      const a = b.dataset.chAct;
      if (a === 'start') { start(root); return page(root); }
      if (a === 'test') { audio(); play('tick'); setTimeout(() => play('go'), 350); setTimeout(() => play('stop'), 1100); return; }
      if (a === 'pause' && run) { run.paused = !run.paused; if (!run.paused) { run.last = performance.now(); loop(root); } else cancelAnimationFrame(run.raf); return page(root); }
      if (a === 'skip' && run) { if (run.pre) run.left = 0; else run.left = 0.001; return; }
      if (a === 'stop' && run) { cancelAnimationFrame(run.raf); wake(false); run = null; return page(root); }
      if (b.dataset.chpre) { const [, w, r, n, s, sr] = PRESETS[+b.dataset.chpre]; S().ui.chrono = Object.assign(cfg(), { work: w, rest: r, reps: n, sets: s, setRest: sr }); Store.persistNow(); toast('Réglage ' + PRESETS[+b.dataset.chpre][0]); return page(root); }
      if (b.dataset.chstep) { const [k, d] = b.dataset.chstep.split(':'), lim = { work: [5, 3600], rest: [0, 3600], reps: [1, 99], sets: [1, 20], setRest: [0, 1800] }[k]; setC(k, Math.min(lim[1], Math.max(lim[0], (+cfg()[k] || 0) + +d))); return page(root); }
      if (b.dataset.bib) { const [i, d] = b.dataset.bib.split(':').map(Number); if (d > 0) { audio(); tone(1100, .08, 'square', .2); } return setS(s => { s.teams[i].s = Math.max(0, s.teams[i].s + d); }); }
      if (b.hasAttribute('data-bibreset')) return setS(s => s.teams.forEach(t => { t.s = 0; }));
      if (b.hasAttribute('data-bibadd')) return setS(s => { const used = s.teams.map(t => t.c); s.teams.push({ c: (BIBS.find(x => !used.includes(x[0])) || BIBS[0])[0], s: 0 }); });
      if (b.hasAttribute('data-bibdel')) return setS(s => { s.teams.pop(); });
      if (b.dataset.bibcol) { const [i, k] = b.dataset.bibcol.split(':'); return setS(s => { s.teams[+i].c = k; }); }
    };
    root.onchange = e => { const k = e.target.dataset.ch; if (!k) return; const v = e.target.type === 'checkbox' ? e.target.checked : k === 'sound' ? e.target.value : Math.max(0, Math.round(+e.target.value || 0)); setC(k, v); if (k === 'sound') { audio(); play('go', v); } page(root); };
  }
  return { page, play };
})();
