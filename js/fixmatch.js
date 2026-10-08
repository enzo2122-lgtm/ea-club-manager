/* FixMatch (2.11): « Corriger le match » — one screen to go back over a match already filled in (by hand, live, from AssistCoachAI
   or the FFF sheet) and fix it: the score, each goal (minute, scorer, assist), each player's playing time and cards, a player
   forgotten or one who did not play. Saved as one: the stats, the minutes, the live match's events (so the timeline, the report and
   the share image say the same) and a mark (m.handFix) that keeps the fix when AssistCoachAI or the FFF sheet are imported again. */
const FixMatch = (() => {
  const { esc, toast, modal } = UI;
  const S = () => Store.state;
  const SP = () => Sport.cur();
  const goalsMode = () => Sport.isFoot() || Sport.id() === 'hand'; // a list of goals; the other sports: points per player
  const usType = () => (SP().score.find(s => s.us && s.pts === 1) || SP().score.find(s => s.us) || { k: 'goal' }).k;
  const themType = () => (SP().score.find(s => !s.us && s.pts === 1) || SP().score.find(s => !s.us) || { k: 'against' }).k;
  const isUs = e => { const s = Sport.scoreOf(e.type); return !!(s && s.us); };
  const isThem = e => { const s = Sport.scoreOf(e.type); return !!(s && !s.us); };
  const minNum = v => { const n = parseInt(String(v == null ? '' : v), 10); return isNaN(n) ? null : n; };
  const label = p => `${p.number ? p.number + '. ' : ''}${Store.shortName(p)}`;
  let css = false;
  function addCss() {
    if (css) return; css = true;
    const st = document.createElement('style');
    st.textContent = ['.fx-score{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;margin:4px 0 10px}',
      '.fx-side{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:120px}.fx-side span{font-size:13px;font-weight:700;text-align:center;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.fx-step{display:flex;align-items:center;gap:6px}.fx-step b{font-size:28px;min-width:34px;text-align:center}.fx-step button,.fx-mini button{width:38px;height:38px;border-radius:10px;border:1px solid var(--line,#d0d4dc);background:var(--surface,#fff);color:inherit;font-size:20px;font-weight:700}',
      '.fx-h{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:14px 0 6px}.fx-h h3{margin:0;font-size:16px}',
      '.fx-goal{display:grid;grid-template-columns:62px 1fr 1fr 40px;gap:6px;align-items:center;margin-bottom:6px}.fx-goal input,.fx-goal select,.fx-pl input{width:100%;min-height:40px;font-size:15px}',
      '.fx-warn{padding:8px 10px;border-radius:10px;background:color-mix(in srgb,#b7791f 15%,transparent);font-size:13.5px;margin:6px 0;display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}',
      '.fx-pl{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;padding:7px 0;border-bottom:1px solid var(--line,#eceef2)}.fx-pl .nm{flex:1 1 130px;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.fx-minbox{display:flex;align-items:center;gap:4px}.fx-minbox input{width:62px !important;min-height:38px;text-align:center}.fx-pts{width:62px !important;min-height:38px;text-align:center}',
      '.fx-dur{display:flex;align-items:center;gap:6px;font-size:13px;white-space:nowrap}.fx-dur input{width:64px;min-height:36px;text-align:center}',
      '.fx-mini{display:flex;align-items:center;gap:4px}.fx-mini button{width:30px;height:32px;font-size:16px}.fx-mini b{min-width:16px;text-align:center}',
      '.fx-red{border:1px solid var(--line,#d0d4dc);background:var(--surface,#fff);border-radius:8px;min-height:34px;padding:0 6px;opacity:.45}.fx-red.on{opacity:1;border-color:#be123c}',
      '.fx-x{border:0;background:none;color:inherit;font-size:18px;opacity:.6;min-height:36px}',
      '.fx-quick{display:flex;gap:4px}.fx-quick button{border:1px solid var(--line,#d0d4dc);background:var(--surface,#fff);color:inherit;border-radius:999px;font-size:12px;padding:4px 8px;min-height:30px}',
      '@media (max-width:520px){.fx-goal{grid-template-columns:54px 1fr 40px}.fx-goal .fx-as{grid-column:2 / 3}.fx-pl .nm{flex-basis:100%}.fx-pl .fx-cards{margin-left:auto}}'].join('');
    document.head.appendChild(st);
  }

  // the state of the screen, copied from the match (nothing changes on the match until « Enregistrer »)
  function stateOf(m) {
    const l = m.live || {}, evs = (l.events || []).slice().sort((a, b) => (a.wall || 0) - (b.wall || 0));
    let goals = evs.filter(e => isUs(e)).map(e => ({ ev: e.id, min: minNum(e.min), player: e.player || '', assist: e.assist || '' }));
    const st = m.stats || {};
    // no live goals (typed by hand): one line per goal of each scorer, the assists given out in order
    if (!goals.length) {
      const sc = [], as = [];
      Object.entries(st).forEach(([id, o]) => { for (let i = 0; i < (+o.g || 0); i++) sc.push(id); for (let i = 0; i < (+o.a || 0); i++) as.push(id); });
      goals = sc.map((id, i) => ({ ev: null, min: null, player: id, assist: as[i] && as[i] !== id ? as[i] : '' }));
    }
    const ids = [...new Set([...(m.convoked || []), ...Object.keys(m.minutes || {}), ...Object.keys(st)])].filter(id => Store.get('players', id));
    const rows = {}; ids.forEach(id => { const o = st[id] || {}; rows[id] = { min: (m.minutes || {})[id] == null ? '' : String(m.minutes[id]), yc: +o.yc || 0, rc: +o.rc || 0, g: +o.g || 0, a: +o.a || 0 }; });
    return { gf: +m.gf || 0, ga: +m.ga || 0, goals, ids, rows, dur: People.matchLength(m) };
  }

  function open(m, done) {
    addCss();
    const F = stateOf(m), t = Store.get('teams', m.teamId), roster = t ? Store.rosterOf(t.id) : S().players;
    const club = (t && t.name) || S().club.name || 'Nous';
    const players = () => F.ids.map(id => Store.get('players', id)).filter(Boolean).sort((a, b) => (a.number || 99) - (b.number || 99) || Store.byName(a, b));
    const opt = (sel, list, extra) => `${extra || ''}${list.map(p => `<option value="${esc(p.id)}" ${p.id === sel ? 'selected' : ''}>${esc(label(p))}</option>`).join('')}`;
    function body() {
      const ps = players(), W = Sport.W(), goalsN = F.goals.length, others = roster.filter(p => !F.ids.includes(p.id)).sort(Store.byName);
      const gm = goalsMode();
      const warn = gm && goalsN !== F.gf ? `<div class="fx-warn"><span>⚠️ ${goalsN} ${goalsN > 1 ? W.units : W.unit} noté${goalsN > 1 ? 's' : ''} pour un score de ${F.gf}.</span><button class="btn soft" type="button" data-fx="sync">Mettre le score à ${goalsN}</button></div>` : '';
      return `<p class="muted small" style="margin-top:0">${esc(fmt(m))}. Corrige ce qui est faux, puis « Enregistrer » : les stats de la saison, le compte-rendu et l'espace des joueurs suivent.</p>
        <div class="fx-score">
          <div class="fx-side"><span>${esc(club)}</span><div class="fx-step"><button type="button" data-fx="gf" data-d="-1" aria-label="Moins">−</button><b>${F.gf}</b><button type="button" data-fx="gf" data-d="1" aria-label="Plus">+</button></div></div>
          <b style="font-size:22px">–</b>
          <div class="fx-side"><span>${esc(m.opponent || 'Adversaire')}</span><div class="fx-step"><button type="button" data-fx="ga" data-d="-1" aria-label="Moins">−</button><b>${F.ga}</b><button type="button" data-fx="ga" data-d="1" aria-label="Plus">+</button></div></div>
        </div>
        ${gm ? `<div class="fx-h"><h3>${Sport.isFoot() ? '⚽' : W.icon} ${W.Scorers} et passeurs (${goalsN})</h3><button class="btn soft" type="button" data-fx="addgoal">＋ Ajouter</button></div>
        ${F.goals.map((g, i) => `<div class="fx-goal" data-gi="${i}">
          <input type="number" min="0" max="150" inputmode="numeric" placeholder="min" value="${g.min == null ? '' : g.min}" data-g="min" aria-label="Minute">
          <select data-g="player" aria-label="${W.Scorer}">${opt(g.player, ps, `<option value="">${W.Scorer} ?</option><option value="csc" ${g.player === 'csc' ? 'selected' : ''}>Contre son camp (adversaire)</option>`)}</select>
          <select class="fx-as" data-g="assist" aria-label="Passeur">${opt(g.assist, ps, '<option value="">Pas de passe</option>')}</select>
          <button type="button" class="fx-x" data-fx="delgoal" aria-label="Supprimer ce ${W.unit}">🗑️</button></div>`).join('') || `<p class="muted small">Aucun ${W.unit} noté.</p>`}
        ${warn}` : ''}
        <div class="fx-h"><h3>⏱️ Temps de jeu${gm ? '' : ', ' + W.units} et cartons</h3><label class="fx-dur">Durée <input type="number" min="10" max="150" inputmode="numeric" data-fx-dur value="${F.dur}"> min</label></div>
        ${ps.map(p => { const r = F.rows[p.id]; return `<div class="fx-pl ${gm ? '' : 'pts'}" data-pid="${esc(p.id)}"><span class="nm">${esc(label(p))}</span>
          <span class="fx-minbox"><input type="number" min="0" max="150" inputmode="numeric" placeholder="min" value="${esc(r.min)}" data-r="min" aria-label="Minutes de ${esc(Store.shortName(p))}"><span class="fx-quick"><button type="button" data-fx="full">Tout</button><button type="button" data-fx="zero">0</button></span></span>
          ${gm ? '' : `<input class="fx-pts" type="number" min="0" max="200" inputmode="numeric" value="${r.g}" data-r="g" aria-label="${W.Units}" title="${W.Units}">`}
          <span class="fx-cards" style="display:flex;gap:6px;align-items:center"><span class="fx-mini" title="Cartons jaunes">🟨<button type="button" data-fx="yc" data-d="-1" aria-label="Moins de jaunes">−</button><b>${r.yc}</b><button type="button" data-fx="yc" data-d="1" aria-label="Plus de jaunes">+</button></span>
            <button type="button" class="fx-red ${r.rc ? 'on' : ''}" data-fx="rc" aria-pressed="${!!r.rc}" title="Carton rouge">🟥</button></span>
          <button type="button" class="fx-x" data-fx="rmpl" aria-label="Retirer ${esc(Store.shortName(p))} de la feuille">✕</button></div>`; }).join('') || '<p class="muted small">Personne sur la feuille : ajoute les joueurs qui ont joué.</p>'}
        ${others.length ? `<label class="fld" style="margin-top:10px"><span>➕ Ajouter un joueur qui a joué</span><select data-fx-add><option value="">Choisir…</option>${others.map(p => `<option value="${esc(p.id)}">${esc(Store.fullName(p))}</option>`).join('')}</select></label>` : ''}`;
    }
    const fmt = x => `${x.home ? 'Contre' : 'Chez'} ${x.opponent || '?'}, ${UI.fmtDate(x.date, { weekday: 'long', day: 'numeric', month: 'long' })}`;
    // what was typed, kept before each redraw
    function read(box) {
      box.querySelectorAll('[data-gi]').forEach(row => { const g = F.goals[+row.dataset.gi]; if (!g) return;
        g.min = minNum(row.querySelector('[data-g="min"]').value); g.player = row.querySelector('[data-g="player"]').value; g.assist = row.querySelector('[data-g="assist"]').value; if (g.assist === g.player) g.assist = ''; });
      box.querySelectorAll('[data-pid]').forEach(row => { const r = F.rows[row.dataset.pid]; if (!r) return;
        r.min = row.querySelector('[data-r="min"]').value; const g = row.querySelector('[data-r="g"]'); if (g) r.g = Math.max(0, +g.value || 0); });
      const d = box.querySelector('[data-fx-dur]'); if (d) F.dur = Math.max(10, Math.min(150, +d.value || F.dur));
    }
    let box = null;
    const draw = () => { const y = box.scrollTop; box.innerHTML = body(); box.scrollTop = y; };
    modal({ title: '✏️ Corriger le match', noFocus: true, body: '<div id="fxBox"></div>',
      onOpen: r => {
        box = r.querySelector('#fxBox'); draw();
        const sb = box.closest('.sheet-body') || box; // (not #modal itself: UI.modal handles its clicks)
        box.addEventListener('change', e => {
          if (e.target.matches('[data-fx-add]') && e.target.value) { read(box); const id = e.target.value; F.ids.push(id); F.rows[id] = F.rows[id] || { min: String(F.dur), yc: 0, rc: 0, g: 0, a: 0 }; draw(); }
        });
        box.addEventListener('click', e => {
          const b = e.target.closest('[data-fx]'); if (!b) return; read(box);
          const k = b.dataset.fx, row = b.closest('[data-pid]'), gr = b.closest('[data-gi]');
          if (k === 'gf' || k === 'ga') F[k] = Math.max(0, F[k] + +b.dataset.d);
          else if (k === 'sync') F.gf = F.goals.length;
          else if (k === 'addgoal') { F.goals.push({ ev: null, min: null, player: '', assist: '' }); if (F.goals.length > F.gf) F.gf = F.goals.length; }
          else if (k === 'delgoal' && gr) F.goals.splice(+gr.dataset.gi, 1);
          else if (row) {
            const pid = row.dataset.pid, rr = F.rows[pid];
            if (k === 'full') rr.min = String(F.dur); else if (k === 'zero') rr.min = '0';
            else if (k === 'yc') rr.yc = Math.max(0, Math.min(2, rr.yc + +b.dataset.d));
            else if (k === 'rc') rr.rc = rr.rc ? 0 : 1;
            else if (k === 'rmpl') { F.ids = F.ids.filter(x => x !== pid); F.goals.forEach(g => { if (g.player === pid) g.player = ''; if (g.assist === pid) g.assist = ''; }); }
          }
          draw();
        });
        void sb;
      },
      actions: [{ label: 'Annuler' }, { label: 'Enregistrer', kind: 'primary', onClick: () => {
        read(box);
        if (goalsMode() && F.goals.some(g => !g.player)) { if (!confirm(`Un ${Sport.W().unit} n'a pas de ${Sport.W().scorer}. Enregistrer quand même ?`)) return false; }
        save(m, F); toast('✅ Match corrigé'); if (done) done(m); return true;
      } }] });
  }

  /* ---------- saving: the match, its stats, its minutes, its live events ---------- */
  function save(m, F) {
    const gm = goalsMode(), ids = F.ids;
    m.played = true; m.gf = F.gf; m.ga = F.ga;
    if (!Sport.cur().sets) m.duration = F.dur;
    // stats: goals and assists from the list (or the points typed), the cards; the other figures (shots, saves…) stay
    const old = m.stats || {}, out = {};
    ids.forEach(id => { const o = Object.assign({}, old[id]); delete o.g; delete o.a; delete o.yc; delete o.rc; const r = F.rows[id];
      if (!gm && r.g) o.g = r.g; if (r.yc) o.yc = r.yc; if (r.rc) o.rc = r.rc; out[id] = o; });
    if (gm) F.goals.forEach(g => { if (g.player && g.player !== 'csc' && out[g.player]) out[g.player].g = (out[g.player].g || 0) + 1; if (g.assist && out[g.assist]) out[g.assist].a = (out[g.assist].a || 0) + 1; });
    Object.keys(out).forEach(id => { if (!Object.keys(out[id]).length) delete out[id]; });
    m.stats = out;
    // minutes and the sheet
    const mins = {}; ids.forEach(id => { const v = minNum(F.rows[id].min); if (v != null) mins[id] = Math.max(0, Math.min(150, v)); });
    m.minutes = mins; m.convoked = [...ids];
    if (m.detail) Object.keys(m.detail).forEach(id => { if (!ids.includes(id)) delete m.detail[id]; });
    // the live match's events: the goals as corrected (their minute, scorer, assist), the opponent's goals as many as the score,
    // the cards no more than counted — so the timeline, the report and a reopened live match say the same
    if (gm) syncLive(m, F);
    m.handFix = { at: Date.now(), by: (Auth.current() || {}).id || '', min: mins };
    Store.upsert('matches', m);
  }
  function syncLive(m, F) {
    const l = m.live, hasEv = l && (l.events || []).length, timed = F.goals.some(g => g.min != null);
    if (!hasEv && !timed) return; // typed by hand without minutes: the stats are enough
    const half = (l && l.halfLen) || Math.round(People.matchLength(m) / Math.max(1, SP().periods || 2));
    const base = new Date(m.date + 'T' + (m.time || '15:00') + ':00').getTime();
    const L = m.live = l && l.periods ? l : { status: 'end', imported: true, halfLen: half, starters: [], periods: [{ start: base, end: base + half * 60000 }, { start: base + (half + 15) * 60000, end: base + (2 * half + 15) * 60000 }], events: [] };
    L.events = L.events || [];
    const wallOf = min => { const ps = L.periods || []; if (!ps.length) return base + (min || 0) * 60000; const p = Math.min(ps.length, Math.max(1, Math.ceil(Math.max(1, min || 1) / half)));
      const per = ps[p - 1]; return per.start + (Math.max(1, min || 1) - (p - 1) * half - 0.5) * 60000; };
    const byId = Object.fromEntries(L.events.map(e => [e.id, e]));
    const ours = F.goals.map(g => { const e = Object.assign({}, g.ev && byId[g.ev] ? byId[g.ev] : { id: Store.uid(), type: usType() });
      e.player = g.player || null; e.assist = g.assist || null;
      if (g.min != null && minNum(e.min) !== g.min) { e.wall = wallOf(g.min); e.min = g.min + "'"; e.period = Math.min((L.periods || []).length || 2, Math.ceil(Math.max(1, g.min) / half)); }
      if (e.wall == null) { e.wall = wallOf(g.min); e.period = e.period || 1; }
      if (e.min == null) e.min = g.min != null ? g.min + "'" : ''; // a goal without its minute: no « undefined » in the timeline
      return e; });
    let them = L.events.filter(isThem); if (them.length > F.ga) them = them.slice(0, F.ga);
    while (them.length < F.ga) them.push({ id: Store.uid(), type: themType(), wall: (((L.periods || []).slice(-1)[0] || {}).end || base) - 1000, period: (L.periods || []).length || 1 });
    const count = {}, cards = L.events.filter(e => (e.type === 'yellow' || e.type === 'red') && e.player).filter(e => { const k = e.player + e.type, max = e.type === 'yellow' ? (F.rows[e.player] || {}).yc || 0 : (F.rows[e.player] || {}).rc || 0; count[k] = (count[k] || 0) + 1; return count[k] <= max; });
    L.events = [...L.events.filter(e => !isUs(e) && !isThem(e) && e.type !== 'yellow' && e.type !== 'red'), ...ours, ...them, ...cards].sort((a, b) => (a.wall || 0) - (b.wall || 0));
  }
  /* ---------- « Corriger un match »: the matches already played, newest first, to find one quickly ---------- */
  function pick(done, teamId) {
    addCss();
    const mine = Auth.isAdmin() ? S().teams : Auth.teams(), ui = S().ui;
    let tid = teamId || (ui.fixTeam && mine.some(x => x.id === ui.fixTeam) ? ui.fixTeam : ''), q = '';
    const list = () => S().matches.filter(m => m.played && !m.exempt && (tid ? m.teamId === tid : mine.some(x => x.id === m.teamId))
      && (!q || String(m.opponent || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q))).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 60);
    const row = m => { const t = Store.get('teams', m.teamId), sc = Object.values(m.stats || {}).reduce((a, o) => a + (+o.g || 0), 0), fixed = m.handFix ? ' · ✏️ corrigé' : '';
      return `<button type="button" class="list-item" data-fxm="${esc(m.id)}" style="width:100%;text-align:left"><div class="date-box"><b>${new Date(m.date + 'T12:00').getDate()}</b><span>${esc(UI.fmtDate(m.date, { month: 'short' }))}</span></div>
        <div class="li-main"><b>${m.home ? '' : 'Chez '}${esc(m.opponent || '?')} · ${+m.gf || 0}-${+m.ga || 0}</b><span class="muted small">${t ? esc(t.name) + ' · ' : ''}${Object.keys(m.minutes || {}).length ? '⏱️ temps de jeu' : '⏱️ pas de temps de jeu'} · ⚽ ${sc}/${+m.gf || 0}${fixed}</span></div><span aria-hidden="true">✏️</span></button>`; };
    const draw = r => { const b = r.querySelector('#fxList'); const l = list(); b.innerHTML = l.length ? `<div class="list">${l.map(row).join('')}</div>` : '<p class="muted">Aucun match joué ici.</p>'; };
    modal({ title: '✏️ Corriger un match', noFocus: true, body: `<p class="muted small" style="margin-top:0">Les matchs joués, du plus récent au plus ancien. Touche un match pour corriger son score, ses ${Sport.W().scorers}, ses passeurs, le temps de jeu et les cartons. « ⚽ 2/3 » : 2 ${Sport.W().units} attribués sur 3 marqués.</p>
      <div class="row2"><label class="fld"><span>Catégorie</span><select id="fxT"><option value="">${Auth.isAdmin() ? 'Toutes' : 'Mes équipes'}</option>${mine.map(x => `<option value="${esc(x.id)}" ${x.id === tid ? 'selected' : ''}>${esc(Store.teamLabel(x))}</option>`).join('')}</select></label>
      <label class="fld"><span>Adversaire</span><input id="fxQ" type="search" placeholder="Chercher…" autocomplete="off"></label></div><div id="fxList"></div>`,
      onOpen: r => { draw(r);
        r.querySelector('#fxT').onchange = e => { tid = e.target.value; ui.fixTeam = tid; Store.persistNow(); draw(r); };
        r.querySelector('#fxQ').oninput = e => { q = e.target.value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); draw(r); };
        r.querySelector('#fxList').addEventListener('click', e => { const b = e.target.closest('[data-fxm]'); if (!b) return; const m = Store.get('matches', b.dataset.fxm); if (m) open(m, x => { if (done) done(x); }); }); },
      actions: [{ label: 'Fermer' }] });
  }
  return { open, pick, stateOf, save };
})();
