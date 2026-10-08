/* Live: the match followed live on the phone, for every sport. Start, the periods (halves, quarters, sets), the end;
   one tap per event (points for us or against, substitution, the actions of the sport, injury, note), the minute is taken by itself.
   The clock is kept as the time of day of each start (it survives closing the app and is the same on every coach's phone).
   At the end: score (sets in volley), scorers and assists, and each player's playing time are filled in on the match by themselves.
   Each event keeps its time of day: the match video can then make its sequences by itself (Analyse). */
const Live = (() => {
  const { esc, $, $$, toast, modal, confirmBox } = UI;
  const S = () => Store.state;
  const SP = () => Sport.cur();
  // the buttons of the live match: the scoring actions of the sport, then the other ones
  function EVS() {
    const o = {};
    SP().score.forEach(e => { o[e.k] = [e.ic, e.l, e.us ? '#15803d' : '#be123c']; });
    o.sub = ['🔁', 'Changement', '#2563eb'];
    SP().extra.forEach(([k, ic, l, c]) => { o[k] = [ic, l, c]; });
    if (!SP().sets) { o.chance = ['🎯', 'Occasion', '#0891b2']; o.chanceThem = ['⚠️', 'Occasion adverse', '#b45309']; o.post = ['🥅', 'Poteau / barre', '#0e7490']; } // (1.88) both teams, for the automatic highlights
    o.injury = ['🚑', 'Blessure', '#9333ea']; o.note = ['📝', 'Note', '#475569'];
    return o;
  }
  const EV = new Proxy({}, { get: (t, k) => EVS()[k] || (Sport.scoreOf(k) ? [Sport.scoreOf(k).ic, Sport.scoreOf(k).l, Sport.scoreOf(k).us ? '#15803d' : '#be123c'] : ['•', String(k), '#475569']), ownKeys: () => Object.keys(EVS()), getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) });
  const pts = e => { const s = Sport.scoreOf(e.type); return s ? s.pts : 0; };
  const isUs = e => { const s = Sport.scoreOf(e.type); return !!(s && s.us); };
  const isThem = e => { const s = Sport.scoreOf(e.type); return !!(s && !s.us); };
  const OUT = new Set(['red']); // sent off: no longer on the pitch
  const fmtOf = m => ((Store.get('teams', m.teamId) || {}).format) || Sport.defFormat();
  const halfDefault = m => { const n = SP().periods; return m.duration && !SP().sets ? Math.round(m.duration / n) : SP().periodLen(fmtOf(m)); };
  const L = m => (m.live = m.live || { status: 'pre', periods: [], events: [], starters: [], halfLen: halfDefault(m) });
  const players = m => (m.convoked || []).map(id => Store.get('players', id)).filter(Boolean).sort((a, b) => (+Store.numOf(a, m) || 99) - (+Store.numOf(b, m) || 99) || Store.byName(a, b));
  const pname = id => { const p = Store.get('players', id); return p ? `${p.number ? p.number + '. ' : ''}${Store.shortName(p)}` : '?'; };
  const size = m => Sport.players(fmtOf(m));
  // statuses: pre, p (a period is played), brk (between two periods), end — h1 / ht / h2 are the old football ones
  const playing = st => st === 'p' || st === 'h1' || st === 'h2';
  const pause = st => st === 'brk' || st === 'ht';
  // « la 1re période », « le 1er quart-temps »
  const masc = () => /quart|set/.test(SP().periodWord);
  const nth = k => k === 1 ? (masc() ? '1er' : '1re') : k + 'e';
  const theP = k => `${masc() ? 'le' : 'la'} ${nth(k)} ${SP().periodWord}`;

  /* ---------- the score ---------- */
  // points of one period (a set), or of the match
  const sum = (l, f, p) => l.events.filter(e => f(e) && (!p || (e.period || 1) === p)).reduce((a, e) => a + pts(e), 0);
  function sets(l) { return l.periods.map((x, i) => [sum(l, isUs, i + 1), sum(l, isThem, i + 1), !!x.end]); }
  function score(l) {
    if (!SP().sets) return [sum(l, isUs), sum(l, isThem)];
    const done = sets(l).filter(s => s[2]); return [done.filter(s => s[0] > s[1]).length, done.filter(s => s[1] > s[0]).length];
  }

  /* ---------- the clock ---------- */
  function periodAt(l, wall) { let p = 0; l.periods.forEach((x, i) => { if (wall >= x.start) p = i + 1; }); return p; }
  // « 23' », « 45+2' » (added time); in volley, the set
  function minuteOf(l, wall) {
    const p = periodAt(l, wall); if (!p) return SP().sets ? 'Set 1' : "0'";
    if (SP().sets) return `Set ${p}`;
    const per = l.periods[p - 1], s = Math.max(0, ((per.end && wall > per.end ? per.end : wall) - per.start) / 1000), len = l.halfLen * 60;
    if (s > len) return `${l.halfLen * p}+${Math.ceil((s - len) / 60)}'`;
    return `${Math.floor(s / 60) + 1 + l.halfLen * (p - 1)}'`;
  }
  function clock(l) {
    const now = Date.now(), k = l.periods.length;
    if (l.status === 'pre') return ['Avant le match', SP().sets ? '' : '00:00'];
    if (l.status === 'end') return ['Match terminé', SP().sets ? sets(l).map(s => `${s[0]}-${s[1]}`).join(' · ') : ''];
    if (SP().sets) { const s = sets(l)[k - 1] || [0, 0]; return pause(l.status) ? [`Après le set ${k}`, sets(l).map(x => `${x[0]}-${x[1]}`).join(' · ')] : [`Set ${k}`, `${s[0]} – ${s[1]}`]; }
    if (pause(l.status)) return [SP().periods === 2 && k === 1 ? 'Mi-temps' : `Pause après ${theP(k)}`, mmss((l.periods[k - 1].end - l.periods[k - 1].start) / 1000)];
    const s = (now - l.periods[k - 1].start) / 1000, base = (k - 1) * l.halfLen * 60;
    return [`${nth(k)} ${SP().periodWord}`, mmss(base + s) + (s > l.halfLen * 60 ? ` (+${Math.ceil((s - l.halfLen * 60) / 60)})` : '')];
  }
  const mmss = s => { s = Math.max(0, Math.floor(s)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

  /* ---------- who is on the pitch, the minutes played ---------- */
  function onField(l, until = Date.now()) {
    const on = new Set(l.starters);
    l.events.filter(e => e.wall <= until).sort((a, b) => a.wall - b.wall).forEach(e => {
      if (e.type === 'sub') { if (e.out) on.delete(e.out); if (e.in) on.add(e.in); }
      if (OUT.has(e.type) && e.player) on.delete(e.player);
    });
    return on;
  }
  function minutes(l, now = Date.now()) {
    const secs = {}, since = {}, on = new Set(l.starters);
    const evs = l.events.slice().sort((a, b) => a.wall - b.wall);
    l.periods.forEach((per, i) => {
      const ps = per.start, pe = per.end || now, prevEnd = i ? (l.periods[i - 1].end || ps) : -Infinity;
      on.forEach(id => { since[id] = ps; });
      evs.filter(e => e.wall > prevEnd && (i === l.periods.length - 1 || e.wall <= pe)).forEach(e => {
        const t = Math.min(pe, Math.max(ps, e.wall));
        const leave = id => { if (id && since[id] != null) { secs[id] = (secs[id] || 0) + (t - since[id]); delete since[id]; } on.delete(id); };
        if (e.type === 'sub') { leave(e.out); if (e.in) { on.add(e.in); since[e.in] = t; } }
        if (OUT.has(e.type)) leave(e.player);
      });
      on.forEach(id => { if (since[id] != null) { secs[id] = (secs[id] || 0) + (pe - since[id]); delete since[id]; } });
    });
    const out = {}; Object.keys(secs).forEach(id => { out[id] = Math.round(secs[id] / 60000); }); return out;
  }
  // the match page gets the score, the scorers (points of each player), the assists and the minutes
  function write(m) {
    const l = L(m), [us, them] = score(l);
    m.gf = us; m.ga = them;
    if (SP().sets) m.sets = sets(l).filter(s => s[2]).map(s => [s[0], s[1]]);
    // (1.47) the live match completes what is already known (FFF sheet, AssistCoachAI, typed by hand) instead of replacing it:
    // goals and assists come from the live match once it has some with a player; cards: the most found by either
    const st = {}; l.events.filter(isUs).forEach(e => {
      if (e.player && e.player !== 'csc') (st[e.player] = st[e.player] || {}).g = ((st[e.player] || {}).g || 0) + pts(e);
      if (e.assist) (st[e.assist] = st[e.assist] || {}).a = ((st[e.assist] || {}).a || 0) + 1; });
    const liveGoals = Object.keys(st).length > 0, old = m.stats || {}, out = {};
    [...new Set([...Object.keys(old), ...Object.keys(st)])].forEach(id => {
      const o = Object.assign({}, old[id]); if (liveGoals) { delete o.g; delete o.a; Object.assign(o, st[id]); }
      if (Object.keys(o).length) out[id] = o; });
    l.events.forEach(e => { const k = e.type === 'yellow' ? 'yc' : e.type === 'red' ? 'rc' : ''; if (!k || !e.player) return;
      const n = l.events.filter(x => x.type === e.type && x.player === e.player).length; out[e.player] = Object.assign({}, out[e.player]); out[e.player][k] = Math.max(+out[e.player][k] || 0, n); });
    m.stats = out;
    if (l.status === 'end') {
      // minutes: the live match's for the players it followed, the ones already known (FFF sheet…) for the others
      // (a player the FFF sheet takes off earlier — a change or a red card not noted live — gets the sheet's time)
      const mins = minutes(l), had = m.minutes || {}, fm = (m.fffSheet || {}).minutes || {}; m.minutes = {};
      (m.convoked || []).forEach(id => { const v = mins[id] || 0, f = fm[id]; m.minutes[id] = f != null ? (v > 0 ? Math.min(v, f) : f) : (v || +had[id] || 0); });
      if (m.handFix && m.handFix.min) Object.assign(m.minutes, m.handFix.min); // (2.11) the playing time corrected by hand stays
      if (!SP().sets) m.duration = l.halfLen * Math.max(SP().periods, l.periods.length);
      m.played = true;
    }
  }

  /* ---------- the page ---------- */
  let tick = null, wake = null;
  async function keepAwake(on) {
    try { if (on && !wake && navigator.wakeLock) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } if (!on && wake) { await wake.release(); wake = null; } } catch (e) {}
  }
  function controls(l) {
    const k = l.periods.length, N = SP().periods;
    if (l.status === 'pre') return `<button class="btn primary lv-big" data-lv="ko">▶ ${Sport.isFoot() ? 'Coup d\'envoi' : SP().sets ? 'Début du 1er set' : 'Début du match'}</button>`;
    if (l.status === 'end') return `<span class="lv-done">✅ Score, ${SP().scorer[1].toLowerCase()} et temps de jeu sont sur la page du match</span><button class="linkish" data-lv="reopen">Rouvrir</button>`;
    if (pause(l.status)) return `<button class="btn primary lv-big" data-lv="next">▶ ${SP().sets ? 'Set ' + (k + 1) : `Reprise · ${nth(k + 1)} ${SP().periodWord}`}</button>${SP().sets ? '<button class="btn lv-big" data-lv="end">🏁 Fin du match</button>' : ''}`;
    if (SP().sets) return `<button class="btn lv-big" data-lv="brk">🏁 Fin du set ${k}</button>`;
    return k < N ? `<button class="btn lv-big" data-lv="brk">⏸ ${N === 2 ? 'Mi-temps' : `Fin ${masc() ? 'du' : 'de la'} ${nth(k)} ${SP().periodWord}`}</button><button class="linkish" data-lv="end">Fin du match</button>`
      : `<button class="btn lv-big" data-lv="end">🏁 Fin du match</button><button class="linkish" data-lv="brk">Prolongation</button>`;
  }
  function page(root, id) {
    const m = Store.get('matches', id); if (!m) { location.hash = '#/matchs'; return; }
    const l = L(m), all = players(m), save = () => { m.editedBy = (Auth.current() || {}).id; Store.upsert('matches', m); };
    const us = (Store.get('teams', m.teamId) || {}).name || S().club.name, live = playing(l.status);
    const on = onField(l), bench = all.filter(p => !on.has(p.id)), [a, b] = score(l), evs = EVS();
    const [plabel, ptime] = clock(l);
    root.innerHTML = `<header class="page-head"><div><h1>📱 Match en direct</h1><p class="sub">${esc(UI.fmtDate(m.date, { weekday: 'long', day: 'numeric', month: 'long' }))}${m.time ? ' · ' + esc(m.time.replace(':', 'h')) : ''}</p></div>
      <div class="head-actions"><a class="btn" href="#/match/${m.id}">${I.back}<span>Le match</span></a></div></header>
      <section class="lv-board ${live ? 'on' : ''}">
        <div class="lv-teams"><span>${esc(m.home ? us : m.opponent || '?')}</span><b>${m.home ? a : b} – ${m.home ? b : a}</b><span>${esc(m.home ? m.opponent || '?' : us)}</span></div>
        ${SP().sets ? '<div class="muted small" style="text-align:center">sets gagnés</div>' : ''}
        <div class="lv-clock"><span id="lvLabel">${plabel}</span><b id="lvTime">${ptime}</b></div>
        <div class="lv-ctl">${controls(l)}</div>
      </section>
      ${l.status === 'pre' ? `<section class="card"><div class="row-head"><h2>Les titulaires</h2><b class="lv-count ${l.starters.length === size(m) ? 'ok' : ''}">${l.starters.length} / ${size(m)}</b></div>
        ${all.length ? `<div class="chips lv-pick">${all.map(p => `<button class="chip ${l.starters.includes(p.id) ? 'on' : ''}" data-start="${p.id}">${esc(pname(p.id))}</button>`).join('')}</div>`
          : `<p class="muted">Coche d'abord les convoqués sur la page du match.</p>`}
        ${SP().sets ? '' : `<label class="fld inline"><span>Durée d'une ${SP().periodWord === 'quart-temps' ? 'période (quart-temps)' : 'période'}</span><select id="lvHalf">${[5, 7, 8, 10, 12, 15, 20, 25, 30, 35, 40, 45].map(n => `<option ${n === l.halfLen ? 'selected' : ''}>${n}</option>`).join('')}</select><span class="muted small">min</span></label>`}
        <p class="muted small">Garde l'appli ouverte pendant le match : l'écran reste allumé. Si tu la fermes, le chrono continue quand même.</p></section>` : ''}
      ${l.status !== 'pre' ? `<section class="lv-actions">${Object.entries(evs).map(([k, [ic, lab, c]]) => `<button class="lv-act" data-ev="${k}" style="--c:${c}" ${l.status === 'end' ? 'disabled' : ''}><b>${ic}</b><span>${lab}</span></button>`).join('')}</section>` : ''}
      ${l.status !== 'pre' ? `<div class="lv-field"><div><h3>Sur le terrain (${on.size})</h3><p>${[...on].map(id => `<span>${esc(pname(id))}</span>`).join('') || '<span class="muted">—</span>'}</p></div>
        <div><h3>Remplaçants (${bench.length})</h3><p>${bench.map(p => `<span>${esc(pname(p.id))}</span>`).join('') || '<span class="muted">—</span>'}</p></div></div>` : ''}
      <h2 class="section">Le fil du match</h2>
      <div class="lv-feed">${l.events.slice().sort((x, y) => y.wall - x.wall).map(e => `<div class="lv-ev" style="--c:${EV[e.type][2]}"><b>${e.min}</b><span>${EV[e.type][0]} ${esc(desc(e))}</span>
        <button class="icon-btn" data-edit="${e.id}" aria-label="Modifier">${I.edit}</button><button class="icon-btn danger" data-del="${e.id}" aria-label="Supprimer">${I.trash}</button></div>`).join('') || '<p class="muted">Rien pour l\'instant.</p>'}</div>
      ${l.status !== 'pre' ? `<details class="card lv-mins"><summary>⏱️ Temps de jeu en direct</summary>${(() => { const mins = minutes(l); return `<div class="lv-mintable">${all.map(p => `<span>${esc(pname(p.id))}</span><b>${mins[p.id] || 0}'</b>`).join('')}</div>`; })()}</details>` : ''}`;
    // the clock turns every second (only on this page)
    clearInterval(tick); tick = setInterval(() => { const x = $('#lvTime'), y = $('#lvLabel'); if (!x || !document.body.contains(x)) { clearInterval(tick); keepAwake(false); return; } const [p, q] = clock(L(Store.get('matches', id) || m)); y.textContent = p; x.textContent = q; }, 1000);
    keepAwake(live);
    const redraw = () => page(root, id);
    const hs = $('#lvHalf', root); if (hs) hs.onchange = () => { l.halfLen = +hs.value; save(); };
    root.onclick = async e => {
      const btn = e.target.closest('button'); if (!btn) return;
      if (btn.dataset.start) { const x = btn.dataset.start; l.starters = l.starters.includes(x) ? l.starters.filter(y => y !== x) : [...l.starters, x]; save(); return redraw(); }
      const act = btn.dataset.lv;
      if (act === 'ko') {
        if (!l.starters.length && !(await confirmBox('Aucun titulaire choisi : le temps de jeu ne pourra pas être calculé. Commencer quand même ?', 'Commencer'))) return;
        l.periods = [{ start: Date.now() }]; l.status = 'p'; save(); toast(`C'est parti ! Allez ${Store.state.club.short || 'le club'} !`); return redraw();
      }
      if (act === 'brk') {
        l.periods[l.periods.length - 1].end = Date.now(); l.status = 'brk';
        // volley: the set is over; the match too when a team has won enough sets
        if (SP().sets) { const [x, y] = score(l), need = SP().setsToWin(fmtOf(m)); if (x >= need || y >= need) { l.status = 'end'; write(m); save(); keepAwake(false); if (x > y) Ratings.celebrate(); toast(x > y ? 'Match gagné !' : 'Match terminé'); return redraw(); } }
        write(m); save(); return redraw();
      }
      if (act === 'next') { l.periods.push({ start: Date.now() }); l.status = 'p'; save(); return redraw(); }
      if (act === 'end') { if (!(await confirmBox(`Fin du match ? Le score, les ${SP().scorer[1].toLowerCase()} et le temps de jeu seront mis sur la page du match.`, 'Fin du match'))) return;
        const last = l.periods[l.periods.length - 1]; if (last && !last.end) last.end = Date.now(); l.status = 'end'; write(m); save(); keepAwake(false); if (Ratings.result(m) === 'V') Ratings.celebrate(); return redraw(); }
      if (act === 'reopen') { if (!(await confirmBox('Rouvrir le match ? Le chrono reprend là où il s\'était arrêté.', 'Rouvrir'))) return; l.status = 'p'; delete l.periods[l.periods.length - 1].end; save(); return redraw(); }
      if (btn.dataset.ev) return addEvent(m, btn.dataset.ev, redraw);
      if (btn.dataset.del) { if (await confirmBox('Supprimer cet événement ?', 'Supprimer')) { l.events = l.events.filter(x => x.id !== btn.dataset.del); write(m); save(); redraw(); } return; }
      if (btn.dataset.edit) { const ev = l.events.find(x => x.id === btn.dataset.edit); if (ev) return details(m, ev, redraw); }
    };
  }
  const desc = e => {
    if (isUs(e)) return `${EV[e.type][1]}${e.player === 'csc' ? ' (contre son camp adverse)' : e.player ? ' · ' + pname(e.player) : ''}${e.assist ? ', ' + SP().assist.toLowerCase() + ' de ' + pname(e.assist) : ''}${e.text ? ' · ' + e.text : ''}`;
    if (e.type === 'sub') return `${e.out ? pname(e.out) : '?'} ➜ ${e.in ? pname(e.in) : '?'}`;
    return `${EV[e.type][1]}${e.player ? ' · ' + pname(e.player) : ''}${e.text ? ' · ' + e.text : ''}`;
  };
  // the event is written at once (the minute is the right one), then the players are chosen; everything can be changed later
  function addEvent(m, type, redraw) {
    const l = L(m), now = Date.now(), ev = { id: Store.uid(), type, wall: now, min: minuteOf(l, now), period: periodAt(l, now) || 1 };
    l.events.push(ev); write(m); Store.upsert('matches', m);
    if (isUs(ev)) toast(`${EV[type][0]} ${EV[type][1]} ! ${ev.min}`); else if (isThem(ev)) toast(`${EV[type][0]} ${EV[type][1]} · ${ev.min}`);
    // volley: a point is one tap, no window
    if (SP().sets && (isUs(ev) || isThem(ev))) return redraw();
    details(m, ev, redraw);
  }
  function details(m, ev, redraw) {
    const l = L(m), on = [...onField(l, ev.wall - 1)], all = players(m), benchIds = all.map(p => p.id).filter(id => !on.includes(id));
    const pick = (key, ids, extra = '') => `<div class="chips lv-pick">${extra}${ids.map(id => `<button class="chip ${ev[key] === id ? 'on' : ''}" data-k="${key}" data-v="${id}">${esc(pname(id))}</button>`).join('')}</div>`;
    const csc = Sport.isFoot() || Sport.id() === 'hand';
    let body = '';
    if (isUs(ev)) body = `<div class="lbl">${SP().scorer[0]}</div>${pick('player', on.length ? on : all.map(p => p.id), csc ? `<button class="chip ${ev.player === 'csc' ? 'on' : ''}" data-k="player" data-v="csc">CSC adverse</button>` : '')}<div class="lbl">${SP().assist}</div>${pick('assist', on.length ? on : all.map(p => p.id), `<button class="chip ${!ev.assist ? 'on' : ''}" data-k="assist" data-v="">Aucune</button>`)}`;
    else if (ev.type === 'sub') body = `<div class="lbl">Sort</div>${pick('out', on.length ? on : all.map(p => p.id))}<div class="lbl">Entre</div>${pick('in', benchIds.length ? benchIds : all.map(p => p.id))}`;
    else if (ev.type !== 'note' && ev.type !== 'chanceThem' && !isThem(ev)) body = `<div class="lbl">Joueur ${ev.type === 'chance' || ev.type === 'post' || ev.type === 'injury' ? '(facultatif)' : ''}</div>${pick('player', ev.type === 'chance' || ev.type === 'post' || ev.type === 'injury' ? all.map(p => p.id) : on.length ? on : all.map(p => p.id))}`;
    body += `<label class="fld"><span>${ev.type === 'note' ? 'Note' : 'Précision (facultatif)'}</span><input id="lvText" value="${esc(ev.text || '')}" maxlength="120" placeholder="${isThem(ev) ? 'ex : sur contre-attaque, erreur de placement' : 'ex : après une belle combinaison'}"></label>
      <label class="fld inline"><span>${SP().sets ? 'Set' : 'Minute'}</span><input id="lvMin" value="${esc(ev.min)}" maxlength="8" style="max-width:90px"></label>`;
    modal({ title: `${EV[ev.type][0]} ${EV[ev.type][1]} · ${ev.min}`, noFocus: true, body,
      onOpen: r => $$('[data-k]', r).forEach(x => x.onclick = () => { ev[x.dataset.k] = x.dataset.v || null; $$(`[data-k="${x.dataset.k}"]`, r).forEach(y => y.classList.toggle('on', y === x)); }),
      actions: [{ label: 'Plus tard' }, { label: 'Enregistrer', kind: 'primary', onClick: (c, r) => {
        ev.text = $('#lvText', r).value.trim(); ev.min = $('#lvMin', r).value.trim() || ev.min;
        if (ev.type === 'sub' && ev.in && ev.in === ev.out) { toast('Le même joueur ne peut pas sortir et entrer', 'err'); return false; }
        write(m); Store.upsert('matches', m);
      } }] });
    // the page behind shows the event as soon as the sheet is closed
    const obs = new MutationObserver(() => { if (document.getElementById('modal').hidden) { obs.disconnect(); if (/^#\/direct\//.test(location.hash)) redraw(); } });
    obs.observe(document.getElementById('modal'), { attributes: true });
  }

  // the card on the match page
  function card(m) {
    const l = m.live, st = l && l.status;
    if (playing(st) || pause(st)) { const [a, b] = score(l); return `<a class="card lv-card on" href="#/direct/${m.id}"><b>🔴 En direct</b><span>${esc(clock(l)[0])} · ${a} – ${b}</span><span class="btn primary">Reprendre</span></a>`; }
    if (m.played && st !== 'end') return '';
    return `<a class="card lv-card" href="#/direct/${m.id}"><b>📱 ${st === 'end' ? 'Le fil du match' : 'Suivre le match en direct'}</b><span class="muted small">${st === 'end' ? `${l.events.length} événement${l.events.length > 1 ? 's' : ''}` : `${SP().score.filter(e => e.us).map(e => e.l).slice(0, 2).join(', ')}, changements… : ${SP().sets ? 'le score des sets se tient tout seul' : 'la minute se note toute seule, le temps de jeu se calcule tout seul'}.`}</span></a>`;
  }

  /* ---------- the match video: sequences from the live events ----------
     kick-off (and start of the 2nd half) located in the video → each event at its moment */
  const tagOf = e => isUs(e) ? 'but' : isThem(e) ? 'encaisse' : ({ chance: 'occasion', post: 'occasion', chanceThem: 'autre', yellow: 'erreur', red: 'erreur', two: 'erreur', foul: 'erreur', err: 'erreur', save: 'autre', reb: 'autre', stl: 'autre', ace: 'but', block: 'autre', injury: 'autre', note: 'autre' })[e.type];
  function videoClips(m, rec, ko1, ko2) {
    const l = m.live; if (!l || !l.periods.length) return [];
    const p1 = l.periods[0].start, p2 = l.periods[1] && l.periods[1].start;
    if (ko2 == null && p2) ko2 = ko1 + (p2 - p1) / 1000;
    return l.events.filter(tagOf).map(e => {
      const t = (e.period === 2 && p2 != null ? ko2 + (e.wall - p2) / 1000 : ko1 + (e.wall - p1) / 1000);
      // the coach taps a few seconds after the action: the sequence starts well before
      return { id: Store.uid(), liveId: e.id, tag: tagOf(e), start: Math.max(0, t - 20), end: t + 5, at: Math.max(0, t - 6), note: `${e.min} ${desc(e)}`, players: [e.player, e.assist].filter(x => x && x !== 'csc') };
    }).filter(c => !(rec.clips || []).some(x => x.liveId === c.liveId));
  }

  return { page, card, minutes, minuteOf, videoClips, EV, desc, write };
})();
