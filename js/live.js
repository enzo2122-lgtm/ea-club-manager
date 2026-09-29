/* Live: the match followed live on the phone. Kick-off, half-time, second half, final whistle; one tap per event
   (goal, goal against, substitution, cards, chance, injury, note), the minute is taken by itself.
   The clock is kept as the time of day of each kick-off (it survives closing the app and is the same on every coach's phone).
   At the end: score, scorers and assists, and each player's playing time are filled in on the match by themselves.
   Each event keeps its time of day: the match video can then make its sequences by itself (Analyse). */
const Live = (() => {
  const { esc, $, $$, toast, modal, confirmBox } = UI;
  const S = () => Store.state;
  const EV = {
    goal: ['⚽', 'But pour nous', '#15803d'], against: ['🥅', 'But encaissé', '#be123c'], sub: ['🔁', 'Changement', '#2563eb'],
    yellow: ['🟨', 'Carton jaune', '#ca8a04'], red: ['🟥', 'Carton rouge', '#dc2626'], chance: ['🎯', 'Occasion', '#0891b2'],
    injury: ['🚑', 'Blessure', '#9333ea'], note: ['📝', 'Note', '#475569'] };
  const halfDefault = m => { const f = ((Store.get('teams', m.teamId) || {}).format) || '11'; return m.duration ? Math.round(m.duration / 2) : f === '5' ? 20 : f === '8' ? 30 : 45; };
  const L = m => (m.live = m.live || { status: 'pre', periods: [], events: [], starters: [], halfLen: halfDefault(m) });
  const players = m => (m.convoked || []).map(id => Store.get('players', id)).filter(Boolean).sort((a, b) => (a.number || 99) - (b.number || 99) || Store.byName(a, b));
  const pname = id => { const p = Store.get('players', id); return p ? `${p.number ? p.number + '. ' : ''}${Store.shortName(p)}` : '?'; };
  const size = m => +(((Store.get('teams', m.teamId) || {}).format) || 11);

  /* ---------- the clock ---------- */
  function periodAt(l, wall) { let p = 0; l.periods.forEach((x, i) => { if (wall >= x.start) p = i + 1; }); return p; }
  // « 23' », « 45+2' » (added time), « Mi-temps »
  function minuteOf(l, wall) {
    const p = periodAt(l, wall); if (!p) return "0'";
    const per = l.periods[p - 1], s = Math.max(0, ((per.end && wall > per.end ? per.end : wall) - per.start) / 1000), len = l.halfLen * 60;
    if (s > len) return `${l.halfLen * p}+${Math.ceil((s - len) / 60)}'`;
    return `${Math.floor(s / 60) + 1 + l.halfLen * (p - 1)}'`;
  }
  function clock(l) {
    const now = Date.now();
    if (l.status === 'pre') return ['Avant le match', '00:00'];
    if (l.status === 'ht') return ['Mi-temps', mmss((l.periods[0].end - l.periods[0].start) / 1000)];
    if (l.status === 'end') return ['Match terminé', ''];
    const p = l.periods.length, s = (now - l.periods[p - 1].start) / 1000, base = (p - 1) * l.halfLen * 60;
    return [p === 1 ? '1re période' : '2e période', mmss(base + s) + (s > l.halfLen * 60 ? ` (+${Math.ceil((s - l.halfLen * 60) / 60)})` : '')];
  }
  const mmss = s => { s = Math.max(0, Math.floor(s)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

  /* ---------- who is on the pitch, the minutes played ---------- */
  function onField(l, until = Date.now()) {
    const on = new Set(l.starters);
    l.events.filter(e => e.wall <= until).sort((a, b) => a.wall - b.wall).forEach(e => {
      if (e.type === 'sub') { if (e.out) on.delete(e.out); if (e.in) on.add(e.in); }
      if (e.type === 'red' && e.player) on.delete(e.player);
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
        if (e.type === 'red') leave(e.player);
      });
      on.forEach(id => { if (since[id] != null) { secs[id] = (secs[id] || 0) + (pe - since[id]); delete since[id]; } });
    });
    const out = {}; Object.keys(secs).forEach(id => { out[id] = Math.round(secs[id] / 60000); }); return out;
  }
  // the match page gets the score, the scorers, the assists and the minutes
  function write(m) {
    const l = L(m);
    m.gf = l.events.filter(e => e.type === 'goal').length; m.ga = l.events.filter(e => e.type === 'against').length;
    const st = {}; l.events.filter(e => e.type === 'goal').forEach(e => {
      if (e.player && e.player !== 'csc') (st[e.player] = st[e.player] || {}).g = ((st[e.player] || {}).g || 0) + 1;
      if (e.assist) (st[e.assist] = st[e.assist] || {}).a = ((st[e.assist] || {}).a || 0) + 1; });
    m.stats = st;
    if (l.status === 'end') {
      const mins = minutes(l); m.minutes = {}; (m.convoked || []).forEach(id => { m.minutes[id] = mins[id] || 0; });
      m.duration = l.halfLen * 2; m.played = true;
    }
  }

  /* ---------- the page ---------- */
  let tick = null, wake = null;
  async function keepAwake(on) {
    try { if (on && !wake && navigator.wakeLock) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } if (!on && wake) { await wake.release(); wake = null; } } catch (e) {}
  }
  function page(root, id) {
    const m = Store.get('matches', id); if (!m) { location.hash = '#/matchs'; return; }
    const l = L(m), all = players(m), save = () => { m.editedBy = (Auth.current() || {}).id; Store.upsert('matches', m); };
    const us = (Store.get('teams', m.teamId) || {}).name || S().club.name, live = l.status === 'h1' || l.status === 'h2';
    const on = onField(l), bench = all.filter(p => !on.has(p.id));
    const [plabel, ptime] = clock(l);
    root.innerHTML = `<header class="page-head"><div><h1>📱 Match en direct</h1><p class="sub">${esc(UI.fmtDate(m.date, { weekday: 'long', day: 'numeric', month: 'long' }))}${m.time ? ' · ' + esc(m.time.replace(':', 'h')) : ''}</p></div>
      <div class="head-actions"><a class="btn" href="#/match/${m.id}">${I.back}<span>Le match</span></a></div></header>
      <section class="lv-board ${live ? 'on' : ''}">
        <div class="lv-teams"><span>${esc(m.home ? us : m.opponent || '?')}</span><b>${m.home ? l.events.filter(e => e.type === 'goal').length : l.events.filter(e => e.type === 'against').length} – ${m.home ? l.events.filter(e => e.type === 'against').length : l.events.filter(e => e.type === 'goal').length}</b><span>${esc(m.home ? m.opponent || '?' : us)}</span></div>
        <div class="lv-clock"><span id="lvLabel">${plabel}</span><b id="lvTime">${ptime}</b></div>
        <div class="lv-ctl">${({ pre: `<button class="btn primary lv-big" data-lv="ko">▶ Coup d'envoi</button>`, h1: `<button class="btn lv-big" data-lv="ht">⏸ Mi-temps</button>`,
          ht: `<button class="btn primary lv-big" data-lv="h2">▶ Reprise · 2e période</button>`, h2: `<button class="btn lv-big" data-lv="end">🏁 Fin du match</button>`,
          end: `<span class="lv-done">✅ Score, buteurs et temps de jeu sont sur la page du match</span><button class="linkish" data-lv="reopen">Rouvrir</button>` })[l.status]}</div>
      </section>
      ${l.status === 'pre' ? `<section class="card"><div class="row-head"><h2>Les titulaires</h2><b class="lv-count ${l.starters.length === size(m) ? 'ok' : ''}">${l.starters.length} / ${size(m)}</b></div>
        ${all.length ? `<div class="chips lv-pick">${all.map(p => `<button class="chip ${l.starters.includes(p.id) ? 'on' : ''}" data-start="${p.id}">${esc(pname(p.id))}</button>`).join('')}</div>`
          : `<p class="muted">Coche d'abord les convoqués sur la page du match.</p>`}
        <label class="fld inline"><span>Durée d'une période</span><select id="lvHalf">${[15, 20, 25, 30, 35, 40, 45].map(n => `<option ${n === l.halfLen ? 'selected' : ''}>${n}</option>`).join('')}</select><span class="muted small">min</span></label>
        <p class="muted small">Garde l'appli ouverte pendant le match : l'écran reste allumé. Si tu la fermes, le chrono continue quand même.</p></section>` : ''}
      ${l.status !== 'pre' ? `<section class="lv-actions">${Object.entries(EV).map(([k, [ic, lab, c]]) => `<button class="lv-act" data-ev="${k}" style="--c:${c}" ${l.status === 'end' ? 'disabled' : ''}><b>${ic}</b><span>${lab}</span></button>`).join('')}</section>` : ''}
      ${l.status !== 'pre' ? `<div class="lv-field"><div><h3>Sur le terrain (${on.size})</h3><p>${[...on].map(id => `<span>${esc(pname(id))}</span>`).join('') || '<span class="muted">—</span>'}</p></div>
        <div><h3>Remplaçants (${bench.length})</h3><p>${bench.map(p => `<span>${esc(pname(p.id))}</span>`).join('') || '<span class="muted">—</span>'}</p></div></div>` : ''}
      <h2 class="section">Le fil du match</h2>
      <div class="lv-feed">${l.events.slice().sort((a, b) => b.wall - a.wall).map(e => `<div class="lv-ev" style="--c:${EV[e.type][2]}"><b>${e.min}</b><span>${EV[e.type][0]} ${esc(desc(e))}</span>
        <button class="icon-btn" data-edit="${e.id}" aria-label="Modifier">${I.edit}</button><button class="icon-btn danger" data-del="${e.id}" aria-label="Supprimer">${I.trash}</button></div>`).join('') || '<p class="muted">Rien pour l\'instant.</p>'}</div>
      ${l.status !== 'pre' ? `<details class="card lv-mins"><summary>⏱️ Temps de jeu en direct</summary>${(() => { const mins = minutes(l); return `<div class="lv-mintable">${all.map(p => `<span>${esc(pname(p.id))}</span><b>${mins[p.id] || 0}'</b>`).join('')}</div>`; })()}</details>` : ''}`;
    // the clock turns every second (only on this page)
    clearInterval(tick); tick = setInterval(() => { const a = $('#lvTime'), b = $('#lvLabel'); if (!a || !document.body.contains(a)) { clearInterval(tick); keepAwake(false); return; } const [x, y] = clock(L(Store.get('matches', id) || m)); b.textContent = x; a.textContent = y; }, 1000);
    keepAwake(live);
    const redraw = () => page(root, id);
    const hs = $('#lvHalf', root); if (hs) hs.onchange = () => { l.halfLen = +hs.value; save(); };
    root.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.start) { const x = b.dataset.start; l.starters = l.starters.includes(x) ? l.starters.filter(y => y !== x) : [...l.starters, x]; save(); return redraw(); }
      const a = b.dataset.lv;
      if (a === 'ko') {
        if (!l.starters.length && !(await confirmBox('Aucun titulaire choisi : le temps de jeu ne pourra pas être calculé. Commencer quand même ?', 'Commencer'))) return;
        l.periods = [{ start: Date.now() }]; l.status = 'h1'; save(); toast(`C'est parti ! Allez ${Store.state.club.short || 'le club'} !`); return redraw();
      }
      if (a === 'ht') { l.periods[0].end = Date.now(); l.status = 'ht'; save(); return redraw(); }
      if (a === 'h2') { l.periods.push({ start: Date.now() }); l.status = 'h2'; save(); return redraw(); }
      if (a === 'end') { if (!(await confirmBox('Siffler la fin du match ? Le score, les buteurs et le temps de jeu seront mis sur la page du match.', 'Fin du match'))) return;
        l.periods[l.periods.length - 1].end = Date.now(); l.status = 'end'; write(m); save(); keepAwake(false); const before = Ratings.result(m); if (before === 'V') Ratings.celebrate(); return redraw(); }
      if (a === 'reopen') { if (!(await confirmBox('Rouvrir le match ? Le chrono reprend là où il s\'était arrêté.', 'Rouvrir'))) return; l.status = 'h2'; delete l.periods[l.periods.length - 1].end; save(); return redraw(); }
      if (b.dataset.ev) return addEvent(m, b.dataset.ev, redraw);
      if (b.dataset.del) { if (await confirmBox('Supprimer cet événement ?', 'Supprimer')) { l.events = l.events.filter(x => x.id !== b.dataset.del); write(m); save(); redraw(); } return; }
      if (b.dataset.edit) { const ev = l.events.find(x => x.id === b.dataset.edit); if (ev) return details(m, ev, redraw); }
    };
  }
  const desc = e => {
    if (e.type === 'goal') return `But${e.player === 'csc' ? ' (contre son camp adverse)' : e.player ? ' de ' + pname(e.player) : ''}${e.assist ? ', passe de ' + pname(e.assist) : ''}${e.text ? ' · ' + e.text : ''}`;
    if (e.type === 'sub') return `${e.out ? pname(e.out) : '?'} ➜ ${e.in ? pname(e.in) : '?'}`;
    return `${EV[e.type][1]}${e.player ? ' · ' + pname(e.player) : ''}${e.text ? ' · ' + e.text : ''}`;
  };
  // the event is written at once (the minute is the right one), then the players are chosen; everything can be changed later
  function addEvent(m, type, redraw) {
    const l = L(m), now = Date.now(), ev = { id: Store.uid(), type, wall: now, min: minuteOf(l, now), period: periodAt(l, now) || 1 };
    l.events.push(ev); write(m); Store.upsert('matches', m);
    if (type === 'goal' || type === 'against') toast(type === 'goal' ? `⚽ BUT ! ${ev.min}` : `🥅 But encaissé ${ev.min}`);
    details(m, ev, redraw);
  }
  function details(m, ev, redraw) {
    const l = L(m), on = [...onField(l, ev.wall - 1)], all = players(m), benchIds = all.map(p => p.id).filter(id => !on.includes(id));
    const pick = (key, ids, extra = '') => `<div class="chips lv-pick">${extra}${ids.map(id => `<button class="chip ${ev[key] === id ? 'on' : ''}" data-k="${key}" data-v="${id}">${esc(pname(id))}</button>`).join('')}</div>`;
    let body = '';
    if (ev.type === 'goal') body = `<div class="lbl">Buteur</div>${pick('player', on.length ? on : all.map(p => p.id), `<button class="chip ${ev.player === 'csc' ? 'on' : ''}" data-k="player" data-v="csc">CSC adverse</button>`)}<div class="lbl">Passe décisive</div>${pick('assist', on.length ? on : all.map(p => p.id), `<button class="chip ${!ev.assist ? 'on' : ''}" data-k="assist" data-v="">Sans passe</button>`)}`;
    else if (ev.type === 'sub') body = `<div class="lbl">Sort</div>${pick('out', on.length ? on : all.map(p => p.id))}<div class="lbl">Entre</div>${pick('in', benchIds.length ? benchIds : all.map(p => p.id))}`;
    else if (ev.type !== 'note' && ev.type !== 'against') body = `<div class="lbl">Joueur ${ev.type === 'chance' || ev.type === 'injury' ? '(facultatif)' : ''}</div>${pick('player', ev.type === 'chance' || ev.type === 'injury' ? all.map(p => p.id) : on.length ? on : all.map(p => p.id))}`;
    body += `<label class="fld"><span>${ev.type === 'note' ? 'Note' : 'Précision (facultatif)'}</span><input id="lvText" value="${esc(ev.text || '')}" maxlength="120" placeholder="${ev.type === 'against' ? 'ex : sur corner, erreur de relance' : 'ex : frappe du gauche, sur corner'}"></label>
      <label class="fld inline"><span>Minute</span><input id="lvMin" value="${esc(ev.min)}" maxlength="8" style="max-width:90px"></label>`;
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
    if (st === 'h1' || st === 'h2' || st === 'ht') return `<a class="card lv-card on" href="#/direct/${m.id}"><b>🔴 En direct</b><span>${esc(clock(l)[0])} · ${l.events.filter(e => e.type === 'goal').length} – ${l.events.filter(e => e.type === 'against').length}</span><span class="btn primary">Reprendre</span></a>`;
    if (m.played && st !== 'end') return '';
    return `<a class="card lv-card" href="#/direct/${m.id}"><b>📱 ${st === 'end' ? 'Le fil du match' : 'Suivre le match en direct'}</b><span class="muted small">${st === 'end' ? `${l.events.length} événement${l.events.length > 1 ? 's' : ''}` : 'Buts, changements, cartons : la minute se note toute seule, le temps de jeu se calcule tout seul.'}</span></a>`;
  }

  /* ---------- the match video: sequences from the live events ----------
     kick-off (and start of the 2nd half) located in the video → each event at its moment */
  const TAG = { goal: 'but', against: 'encaisse', chance: 'occasion', yellow: 'erreur', red: 'erreur', injury: 'autre', note: 'autre' };
  function videoClips(m, rec, ko1, ko2) {
    const l = m.live; if (!l || !l.periods.length) return [];
    const p1 = l.periods[0].start, p2 = l.periods[1] && l.periods[1].start;
    if (ko2 == null && p2) ko2 = ko1 + (p2 - p1) / 1000;
    return l.events.filter(e => TAG[e.type]).map(e => {
      const t = (e.period === 2 && p2 != null ? ko2 + (e.wall - p2) / 1000 : ko1 + (e.wall - p1) / 1000);
      // the coach taps a few seconds after the action: the sequence starts well before
      return { id: Store.uid(), liveId: e.id, tag: TAG[e.type], start: Math.max(0, t - 20), end: t + 5, at: Math.max(0, t - 6), note: `${e.min} ${desc(e)}`, players: [e.player, e.assist].filter(x => x && x !== 'csc') };
    }).filter(c => !(rec.clips || []).some(x => x.liveId === c.liveId));
  }

  return { page, card, minutes, minuteOf, videoClips, EV };
})();
