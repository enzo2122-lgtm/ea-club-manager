/* Level (2.20): the level of each player, for the coaches only — 5 criteria from 1 to 5 (technique, game intelligence, physique, attitude, mental).
   One current level per player (shared by the coaches of his categories and the responsables, never shown to the player or his parents),
   with a short history (one per day) to see what moved. On the player's page (stars to touch) and on a team page (#/niveau): table, sorting,
   and « Noter l'équipe » to rate everyone one after the other. */
const Level = (() => {
  const { esc, $, $$, toast, modal } = UI;
  const S = () => Store.state;
  const CRIT = [['tech', '⚽', 'Technique', '#2563eb'], ['iq', '🧠', 'Intelligence de jeu', '#9333ea'], ['phys', '🏃', 'Physique', '#16a34a'],
    ['att', '🤝', 'Attitude', '#ea580c'], ['ment', '🦁', 'Mental', '#db2777']];
  const WORD = ['', 'Faible', 'Moyen', 'Correct', 'Bon', 'Très bon'];
  const fr = n => n == null ? '–' : (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
  const cur = p => (p && p.level) || {};
  const avg = s => { const v = CRIT.map(([k]) => +(s || {})[k]).filter(Boolean); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  // the level before the current one (the last day of the history that differs)
  const prev = p => { const h = (p.levelHist || []).filter(x => x.date !== cur(p).date); return h.length ? h[h.length - 1].s : null; };
  const who = id => { const s = id && Store.get('staff', id); return s ? Store.shortName(s) : ''; };

  function set(p, k, v) {
    const s = Object.assign({}, cur(p)); delete s.date; delete s.by;
    if (v) s[k] = v; else delete s[k];
    const date = UI.today(), by = (Auth.current() || {}).id || null;
    p.level = Object.assign({}, s, { date, by });
    const scores = Object.fromEntries(CRIT.map(([c]) => [c, s[c]]).filter(x => x[1]));
    p.levelHist = [...(p.levelHist || []).filter(x => x.date !== date), { date, s: scores }].slice(-12);
    Store.upsert('players', p);
  }
  const stars = (p, k, small) => { const v = +cur(p)[k] || 0;
    return `<span class="lv-stars ${small ? 'sm' : ''}">${[1, 2, 3, 4, 5].map(n => `<button class="${v >= n ? 'on' : ''}" data-lv="${k}:${n}" aria-label="${n} sur 5 : ${WORD[n]}" title="${WORD[n]}">★</button>`).join('')}</span>`; };
  const chip = (v, col) => v ? `<b class="lv-chip" style="--c:${col};--a:${(0.12 + v * 0.14).toFixed(2)}">${v}</b>` : '<b class="lv-chip none">–</b>';

  /* ---------- the card on the player's page ---------- */
  function card(p) {
    const s = cur(p), a = avg(s), pv = prev(p);
    return `<section class="card lv-card"><h2>📊 Niveau <span class="lv-avg">${a == null ? '' : `${fr(a)} / 5`}</span></h2>
      <p class="muted small">🔒 Seulement pour les coachs et les responsables. Touche les étoiles (touche à nouveau la même pour l'enlever).</p>
      ${CRIT.map(([k, ic, l, col]) => { const v = +s[k] || 0, d = pv && pv[k] && v ? v - pv[k] : 0;
        return `<div class="lv-row" style="--c:${col}"><span class="lv-l">${ic} ${esc(l)}</span>${stars(p, k)}<span class="lv-w">${v ? esc(WORD[v]) : ''}${d ? ` <i class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'}${Math.abs(d)}</i>` : ''}</span></div>`; }).join('')}
      <p class="muted small">${s.date ? `Mis à jour le ${esc(UI.fmtDate(s.date, { day: 'numeric', month: 'long', year: 'numeric' }))}${who(s.by) ? ' par ' + esc(who(s.by)) : ''}` : 'Pas encore noté.'}
        ${(p.teamIds || [])[0] ? ` · <a class="linkish" href="#/niveau/${p.teamIds[0]}">Niveau de l'équipe</a>` : ''}</p></section>`;
  }
  // a star touched on the player's page (true: handled)
  function click(e, p, redraw) {
    const b = e.target.closest('[data-lv]'); if (!b || !b.closest('.lv-card')) return false;
    const [k, n] = b.dataset.lv.split(':'), v = +n === +cur(p)[k] ? 0 : +n; set(p, k, v);
    const y = window.scrollY; redraw(); window.scrollTo(0, y); return true;
  }

  /* ---------- rating one player after the other ---------- */
  function rate(list, i, done) {
    const p = list[i]; if (!p) { done(); return; }
    const body = () => `<p class="muted small">${i + 1} / ${list.length} · 1 = faible · 3 = correct · 5 = très bon</p>
      ${CRIT.map(([k, ic, l, col]) => `<div class="lv-row" style="--c:${col}"><span class="lv-l">${ic} ${esc(l)}</span>${stars(p, k)}</div>`).join('')}
      <p class="lv-tot">Moyenne : <b>${fr(avg(cur(p)))}</b> / 5</p>`;
    modal({ title: `${p.number ? '#' + p.number + ' ' : ''}${Store.fullName(p)}`, noFocus: true, body: `<div id="lvBody" class="lv-card">${body()}</div>`,
      onOpen: r => { r.querySelector('#lvBody').onclick = x => { const b = x.target.closest('[data-lv]'); if (!b) return; const [k, n] = b.dataset.lv.split(':');
        set(p, k, +n === +cur(p)[k] ? 0 : +n); r.querySelector('#lvBody').innerHTML = body(); }; },
      actions: [{ label: 'Terminer', onClick: () => { setTimeout(done, 60); } },
        ...(i + 1 < list.length ? [{ label: 'Joueur suivant →', kind: 'primary', onClick: () => { setTimeout(() => rate(list, i + 1, done), 60); } }] : [{ label: 'C\'est fini ✓', kind: 'primary', onClick: () => { setTimeout(done, 60); } }])] });
  }

  /* ---------- the team page ---------- */
  function page(root, teamId) {
    const teams = Auth.teams(), t = Store.get('teams', teamId) || Store.get('teams', S().ui.teamId) || teams[0];
    if (!t) { root.innerHTML = '<div class="empty"><p>Crée d\'abord une équipe.</p></div>'; return; }
    const ui = S().ui.level = S().ui.level || { sort: 'avg' };
    const ps = (Store.playersOf(t.id).length ? Store.playersOf(t.id) : Store.rosterOf(t.id)).slice().sort(Store.byName);
    const val = (p, k) => k === 'avg' ? avg(cur(p)) : +cur(p)[k] || null;
    const rows = ui.sort === 'name' ? ps : ps.slice().sort((a, b) => (val(b, ui.sort) || 0) - (val(a, ui.sort) || 0) || Store.byName(a, b));
    const rated = ps.filter(p => avg(cur(p)) != null);
    const teamAvg = k => { const v = rated.map(p => val(p, k)).filter(Boolean); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const th = (k, label, title) => `<th><button class="lv-sort ${ui.sort === k ? 'on' : ''}" data-lvs="${k}" title="${esc(title || label)}">${label}</button></th>`;
    root.innerHTML = `<header class="page-head"><div><h1>📊 Niveau des joueurs</h1><p class="sub">${esc(t.name)} · ${rated.length}/${ps.length} noté${rated.length > 1 ? 's' : ''}${teamAvg('avg') != null ? ` · moyenne ${fr(teamAvg('avg'))} / 5` : ''}</p></div>
      <div class="head-actions"><a class="btn" href="#/equipes">${I.back}<span>Équipes</span></a>${ps.length ? `<button class="btn primary" data-lva="all">⭐<span>Noter l'équipe</span></button>` : ''}</div></header>
      <div class="row2"><label class="fld"><span>Équipe</span><select id="lvTeam">${teams.map(x => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${esc(Store.teamLabel(x))}</option>`).join('')}</select></label></div>
      <p class="muted small">🔒 Seulement pour les coachs et les responsables : jamais montré aux joueurs ni aux parents. Touche un joueur pour le noter, un titre de colonne pour trier.</p>
      ${ps.length ? `<section class="card"><div class="ss-table lv-table"><table><thead><tr>${th('name', 'Joueur', 'Trier par nom')}${CRIT.map(([k, ic, l]) => th(k, ic, l)).join('')}${th('avg', 'Moy.', 'Moyenne des 5')}</tr></thead>
        <tbody>${rows.map(p => `<tr data-lvp="${p.id}"><td><b>${p.number ? `<span class="pnum">${esc(p.number)}</span> ` : ''}${esc(Store.fullName(p))}</b></td>${CRIT.map(([k, , , col]) => `<td>${chip(+cur(p)[k] || 0, col)}</td>`).join('')}<td><b class="lv-m">${fr(avg(cur(p)))}</b></td></tr>`).join('')}</tbody>
        ${rated.length ? `<tfoot><tr><td>Moyenne de l'équipe</td>${CRIT.map(([k]) => `<td>${fr(teamAvg(k))}</td>`).join('')}<td><b>${fr(teamAvg('avg'))}</b></td></tr></tfoot>` : ''}</table></div>
        <p class="lv-key">${CRIT.map(([, ic, l]) => `<span>${ic} ${esc(l)}</span>`).join('')}</p></section>`
        : '<p class="muted">Pas encore de joueur dans cette équipe.</p>'}
      ${rated.length ? `<section class="card"><h2>💪 Points forts et points à travailler de l'équipe</h2>${(() => { const l = CRIT.map(c => [c, teamAvg(c[0])]).filter(x => x[1] != null).sort((a, b) => b[1] - a[1]);
        return l.map(([[, ic, n, col], v]) => `<div class="lv-bar" style="--c:${col}"><span>${ic} ${esc(n)}</span><i style="width:${(v / 5 * 100).toFixed(0)}%"></i><b>${fr(v)}</b></div>`).join(''); })()}</section>` : ''}`;
    const redraw = () => { const y = window.scrollY; page(root, t.id); window.scrollTo(0, y); };
    $('#lvTeam', root).onchange = e => { location.hash = '#/niveau/' + e.target.value; };
    root.onclick = e => {
      const s = e.target.closest('[data-lvs]'); if (s) { ui.sort = s.dataset.lvs; Store.persistNow(); return redraw(); }
      if (e.target.closest('[data-lva="all"]')) { const todo = rows.filter(p => avg(cur(p)) == null), list = todo.length ? [...todo, ...rows.filter(p => !todo.includes(p))] : rows; return rate(list, 0, redraw); }
      const r = e.target.closest('[data-lvp]'); if (r) { const i = rows.findIndex(p => p.id === r.dataset.lvp); if (i >= 0) rate(rows, i, redraw); }
    };
  }

  return { card, click, page, avg, cur, CRIT };
})();
