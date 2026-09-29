/* Progress: the progression of the players (for the young ones above all).
   Two or three short evaluations a season (4 areas × 3 criteria, from 1 to 5), 1 to 3 personal objectives,
   a radar (now against the last time), a curve over the seasons, and a report card in PDF for the player or his parents.
   Everything is kept on the player (shared with the coaches of the club). */
const Progress = (() => {
  const { esc, $, $$, toast, modal, confirmBox } = UI;
  const S = () => Store.state;
  const AREAS = [
    ['tech', '⚽ Technique', '#2563eb', [['ctrl', 'Contrôle et passe'], ['drib', 'Conduite et dribble'], ['shot', 'Frappe et jeu de tête']]],
    ['phys', '🏃 Physique', '#16a34a', [['speed', 'Vitesse'], ['endu', 'Endurance'], ['duel', 'Puissance et duels']]],
    ['ment', '🧠 Mental', '#9333ea', [['focus', 'Concentration'], ['conf', 'Confiance'], ['react', 'Réaction après une erreur']]],
    ['beh', '🤝 Comportement', '#ea580c', [['assid', 'Assiduité et ponctualité'], ['resp', 'Respect et fair-play'], ['team', 'Esprit d\'équipe']]]];
  const LEVEL = ['', 'À travailler', 'En progrès', 'Correct', 'Bien', 'Point fort'];
  const today = () => UI.today();
  const period = d => { const m = +d.slice(5, 7); return m >= 8 && m <= 11 ? 'Début de saison' : (m === 12 || m <= 3) ? 'Mi-saison' : 'Fin de saison'; };
  const areaScore = (ev, a) => { const v = a[3].map(([k]) => (ev.scores || {})[k]).filter(Boolean); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null; };
  const global = ev => { const v = AREAS.map(a => areaScore(ev, a)).filter(x => x != null); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null; };
  const evals = p => (p.evals || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const fr = n => n == null ? '–' : n.toFixed(1).replace('.', ',');

  /* ---------- the charts (canvas: the same drawing on the page and in the PDF) ---------- */
  function radar(cv, cur, prev, bg) {
    const W = cv.width, H = cv.height, c = cv.getContext('2d'), cx = W / 2, cy = H / 2 + 4, R = (Math.min(W, H) / 2 - 18) / 1.25; // the names of the areas (at 1.22 × R) stay inside
    c.clearRect(0, 0, W, H); if (bg) { c.fillStyle = bg; c.fillRect(0, 0, W, H); } c.font = `700 ${Math.round(W / 26)}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const ang = i => -Math.PI / 2 + i * Math.PI * 2 / AREAS.length, pt = (i, v) => [cx + Math.cos(ang(i)) * R * v / 5, cy + Math.sin(ang(i)) * R * v / 5];
    for (let r = 1; r <= 5; r++) { c.beginPath(); AREAS.forEach((a, i) => { const [x, y] = pt(i, r); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.closePath(); c.strokeStyle = r === 5 ? '#94a3b8' : '#e2e8f0'; c.lineWidth = 1; c.stroke(); }
    AREAS.forEach((a, i) => { const [x, y] = pt(i, 5); c.beginPath(); c.moveTo(cx, cy); c.lineTo(x, y); c.strokeStyle = '#e2e8f0'; c.stroke();
      const [lx, ly] = pt(i, 6.1), txt = a[1].replace(/^\S+\s/, ''), tw = c.measureText(txt).width; c.fillStyle = a[2]; c.fillText(txt, Math.max(tw / 2 + 4, Math.min(W - tw / 2 - 4, lx)), ly); });
    const shape = (ev, fill, stroke, dash) => { if (!ev) return; c.beginPath(); AREAS.forEach((a, i) => { const [x, y] = pt(i, areaScore(ev, a) || 0); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.closePath();
      c.fillStyle = fill; c.fill(); c.setLineDash(dash || []); c.strokeStyle = stroke; c.lineWidth = 2.5; c.stroke(); c.setLineDash([]); };
    shape(prev, 'rgba(148,163,184,.18)', '#94a3b8', [6, 5]); shape(cur, 'rgba(140,16,36,.22)', '#8c1024');
  }
  function curve(cv, list, bg) {
    const W = cv.width, H = cv.height, c = cv.getContext('2d'), L = 40, B = 34, T = 16, Rt = 40, w = W - L - Rt, h = H - T - B;
    c.clearRect(0, 0, W, H); if (bg) { c.fillStyle = bg; c.fillRect(0, 0, W, H); } c.font = `600 ${Math.round(W / 42)}px system-ui, sans-serif`;
    for (let v = 1; v <= 5; v++) { const y = T + h - (v - 1) / 4 * h; c.strokeStyle = '#e2e8f0'; c.beginPath(); c.moveTo(L, y); c.lineTo(W - Rt, y); c.stroke(); c.fillStyle = '#64748b'; c.textAlign = 'right'; c.fillText(v, L - 8, y + 4); }
    if (!list.length) return;
    const x = i => L + (list.length === 1 ? w / 2 : i / (list.length - 1) * w), y = v => T + h - (v - 1) / 4 * h;
    [...AREAS.map(a => [a[2], ev => areaScore(ev, a), 2]), ['#8c1024', global, 4]].forEach(([col, f, lw]) => {
      c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); let started = false;
      list.forEach((ev, i) => { const v = f(ev); if (v == null) return; started ? c.lineTo(x(i), y(v)) : c.moveTo(x(i), y(v)); started = true; }); c.stroke();
      list.forEach((ev, i) => { const v = f(ev); if (v == null) return; c.fillStyle = col; c.beginPath(); c.arc(x(i), y(v), lw + 1, 0, Math.PI * 2); c.fill(); });
    });
    c.fillStyle = '#475569'; c.textAlign = 'center';
    list.forEach((ev, i) => c.fillText(UI.fmtDate(ev.date, { month: 'short', year: '2-digit' }), x(i), H - 12));
  }
  const legend = () => `<div class="pg-legend">${AREAS.map(a => `<span style="--c:${a[2]}">${esc(a[1])}</span>`).join('')}<span style="--c:#8c1024"><b>Moyenne</b></span></div>`;

  /* ---------- the player's card ---------- */
  function card(p) {
    const list = evals(p), cur = list[list.length - 1], prev = list[list.length - 2], goals = p.goals || [], act = goals.filter(g => g.status === 'open');
    return `<section class="card pg-card"><div class="row-head"><h2>📈 Progression</h2><div class="chips"><button class="btn primary" data-pg="eval">${I.plus}<span>Évaluer</span></button>${list.length ? `<button class="btn soft" data-pg="pdf">${I.pdf}<span>Bulletin</span></button>` : ''}</div></div>
      ${cur ? `<div class="pg-top"><canvas class="pg-radar" width="420" height="360" aria-label="Radar des 4 domaines"></canvas>
        <div class="pg-scores">${AREAS.map(a => { const v = areaScore(cur, a), pv = prev && areaScore(prev, a), d = v != null && pv != null ? v - pv : null;
          return `<p style="--c:${a[2]}"><span>${esc(a[1])}</span><b>${fr(v)}</b>${d ? `<i class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${fr(Math.abs(d))}</i>` : ''}</p>`; }).join('')}
          <p class="pg-glob"><span>Moyenne</span><b>${fr(global(cur))} / 5</b></p>
          <span class="muted small">${esc(period(cur.date))} · ${esc(UI.fmtDate(cur.date))}${prev ? ` · en pointillés : ${esc(UI.fmtDate(prev.date))}` : ''}</span></div></div>
        ${cur.comment ? `<p class="pg-comment">« ${esc(cur.comment)} »</p>` : ''}
        ${list.length > 1 ? `<details><summary class="muted small">Courbe de progression (${list.length} évaluations)</summary><canvas class="pg-curve" width="640" height="260"></canvas>${legend()}</details>` : ''}
        <div class="pg-hist">${list.slice().reverse().map(ev => `<button class="chip" data-pg="open" data-ev="${ev.id}">${esc(UI.fmtDate(ev.date, { day: 'numeric', month: 'short', year: '2-digit' }))} · ${fr(global(ev))}</button>`).join('')}</div>`
        : '<p class="muted">Pas encore évalué. Deux ou trois fois par saison suffisent : début, milieu et fin de saison.</p>'}
      <h3 class="sub-h">🎯 Objectifs personnels ${act.length ? `(${act.length}/3)` : ''}</h3>
      <div class="pg-goals">${goals.slice().sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || b.created.localeCompare(a.created)).slice(0, 8).map(g => `<div class="pg-goal ${g.status}">
        <span>${g.status === 'done' ? '✅' : g.status === 'drop' ? '⏹️' : '🎯'} ${esc(g.text)}<i class="muted small">${g.status === 'done' ? ' · atteint le ' + esc(UI.fmtDate(g.doneAt)) : ' · depuis le ' + esc(UI.fmtDate(g.created))}</i></span>
        ${g.status === 'open' ? `<button class="btn soft" data-pg="done" data-g="${g.id}">✅ Atteint</button>` : ''}<button class="icon-btn danger" data-pg="delgoal" data-g="${g.id}" aria-label="Supprimer">${I.x}</button></div>`).join('') || '<p class="muted small">Aucun objectif pour l\'instant.</p>'}</div>
      ${act.length < 3 ? `<button class="btn soft" data-pg="goal">${I.plus}<span>Ajouter un objectif</span></button>` : ''}</section>`;
  }
  function mount(root, p) {
    const list = evals(p), rv = $('.pg-radar', root), cu = $('.pg-curve', root);
    if (rv) radar(rv, list[list.length - 1], list[list.length - 2]);
    if (cu) curve(cu, list);
  }

  /* ---------- evaluating ---------- */
  function evalDialog(p, done, ev, next) {
    const e = ev ? JSON.parse(JSON.stringify(ev)) : { id: Store.uid(), date: today(), scores: Object.assign({}, (evals(p).pop() || {}).scores || {}), comment: '' };
    const body = () => `<p class="muted small">1 = à travailler · 3 = correct · 5 = point fort. ${ev ? '' : 'Les notes de la dernière évaluation sont reprises : change seulement ce qui a bougé.'}</p>
      ${AREAS.map(a => `<div class="pg-area" style="--c:${a[2]}"><h3>${esc(a[1])}</h3>${a[3].map(([k, l]) => `<div class="pg-row"><span>${esc(l)}</span><span class="pg-stars">${[1, 2, 3, 4, 5].map(n => `<button class="${(e.scores[k] || 0) >= n ? 'on' : ''}" data-k="${k}" data-v="${n}" title="${LEVEL[n]}" aria-label="${esc(l)} : ${n}">★</button>`).join('')}</span></div>`).join('')}</div>`).join('')}
      <label class="fld"><span>Le mot du coach (visible sur le bulletin)</span><textarea id="pgCom" rows="2" maxlength="300" placeholder="ex : très bon état d'esprit, doit oser davantage devant le but">${esc(e.comment || '')}</textarea></label>
      <label class="fld inline"><span>Date</span><input type="date" id="pgDate" value="${esc(e.date)}"></label>`;
    modal({ title: `${ev ? 'Évaluation' : 'Évaluer'} · ${Store.fullName(p)}`, noFocus: true, body: `<div id="pgBody">${body()}</div>`,
      onOpen: r => { r.querySelector('#pgBody').onclick = x => { const b = x.target.closest('[data-k]'); if (!b) return; const k = b.dataset.k, v = +b.dataset.v; e.scores[k] = e.scores[k] === v ? v - 1 || undefined : v;
        $$(`[data-k="${k}"]`, r).forEach(y => y.classList.toggle('on', (e.scores[k] || 0) >= +y.dataset.v)); }; },
      actions: [...(ev ? [{ label: 'Supprimer', kind: 'danger', onClick: () => { setTimeout(async () => { if (await confirmBox('Supprimer cette évaluation ?')) { p.evals = (p.evals || []).filter(x => x.id !== ev.id); Store.upsert('players', p); done && done(); } }, 60); } }] : []),
        { label: 'Annuler' },
        ...(next ? [{ label: 'Enregistrer et suivant', onClick: (c, r) => { if (!keep(r)) return false; setTimeout(next, 60); } }] : []),
        { label: 'Enregistrer', kind: 'primary', onClick: (c, r) => keep(r) }] });
    function keep(r) {
      e.comment = $('#pgCom', r).value.trim(); e.date = $('#pgDate', r).value || today();
      if (!Object.values(e.scores).some(Boolean)) { toast('Mets au moins une note', 'err'); return false; }
      e.by = (Auth.current() || {}).id || null; p.evals = [...(p.evals || []).filter(x => x.id !== e.id), e];
      Store.upsert('players', p); toast(`${Store.shortName(p)} évalué : ${fr(global(e))} / 5`); done && done(); return true;
    }
  }
  function goalDialog(p, done) {
    const sugg = ['Utiliser son mauvais pied', 'Parler et se faire entendre', 'Être à l\'heure à chaque séance', 'Oser frapper au but', 'Se replacer après la perte', 'Lever la tête avant de recevoir', 'Garder son calme après une erreur', 'Gagner plus de duels'];
    modal({ title: `Objectif · ${Store.fullName(p)}`, noFocus: true, body: `<label class="fld"><span>L'objectif (court, concret)</span><input id="pgGoal" maxlength="100" placeholder="ex : utiliser son pied gauche en match"></label>
      <div class="chips">${sugg.map(s => `<button class="chip" data-s="${esc(s)}">${esc(s)}</button>`).join('')}</div>`,
      onOpen: r => $$('[data-s]', r).forEach(b => b.onclick = () => { $('#pgGoal', r).value = b.dataset.s; }),
      actions: [{ label: 'Annuler' }, { label: 'Ajouter', kind: 'primary', onClick: (c, r) => { const t = $('#pgGoal', r).value.trim(); if (!t) { toast('Écris l\'objectif', 'err'); return false; }
        p.goals = [...(p.goals || []), { id: Store.uid(), text: t, status: 'open', created: today(), by: (Auth.current() || {}).id || null }]; Store.upsert('players', p); done && done(); } }] });
  }
  function click(e, p, done) {
    const b = e.target.closest('[data-pg]'); if (!b) return false;
    const a = b.dataset.pg, g = (p.goals || []).find(x => x.id === b.dataset.g);
    if (a === 'eval') evalDialog(p, done);
    if (a === 'open') evalDialog(p, done, (p.evals || []).find(x => x.id === b.dataset.ev));
    if (a === 'goal') goalDialog(p, done);
    if (a === 'done' && g) { g.status = 'done'; g.doneAt = today(); Store.upsert('players', p); toast('Objectif atteint, bravo ! 🎉'); done && done(); }
    if (a === 'delgoal' && g) { confirmBox('Supprimer cet objectif ?').then(ok => { if (ok) { p.goals = p.goals.filter(x => x !== g); Store.upsert('players', p); done && done(); } }); }
    if (a === 'pdf') bulletin(p);
    return true;
  }

  /* ---------- the report card (PDF) ---------- */
  async function bulletin(p) {
    const b = UI.busy('Création du bulletin…');
    try {
      const club = S().club, P = Exporter.pdfDoc(club), list = evals(p), cur = list[list.length - 1], prev = list[list.length - 2], s = People.playerSeason(p);
      P.header('Bulletin de progression', `Saison ${People.seasonLabel()}`);
      P.h2(Store.fullName(p));
      P.facts([['Équipe', (p.teamIds || []).map(id => (Store.get('teams', id) || {}).name).filter(Boolean).join(', ') || '-'], ['Poste', People.postsLabel(p) || '-'], ['Présence', s.att.pct == null ? '-' : s.att.pct + ' %'], ['Matchs', `${s.played.length} · ${s.minutes} min`]]);
      if (cur) {
        const rc = document.createElement('canvas'); rc.width = 840; rc.height = 720; radar(rc, cur, prev, '#ffffff');
        P.label(`Évaluation · ${period(cur.date)} (${UI.fmtDate(cur.date)})${prev ? ' · en pointillés : la précédente' : ''}`); P.image(rc, P.CW * .62);
        P.table(['Domaine', 'Note', prev ? 'Avant' : '', 'Niveau'], AREAS.map(a => { const v = areaScore(cur, a), pv = prev && areaScore(prev, a); return [a[1].replace(/^\S+\s/, ''), fr(v) + ' / 5', prev ? fr(pv) : '', v ? LEVEL[Math.round(v)] : '-']; }), [.4, .2, .15, .25]);
        P.label('Détail'); P.table(['Critère', 'Note', 'Niveau'], AREAS.flatMap(a => a[3].map(([k, l]) => [l, cur.scores[k] ? cur.scores[k] + ' / 5' : '-', LEVEL[cur.scores[k] || 0] || '-'])), [.55, .15, .3]);
        if (cur.comment) { P.label('Le mot du coach'); P.para(cur.comment, 11.5); }
        if (list.length > 1) { const cc = document.createElement('canvas'); cc.width = 1280; cc.height = 520; curve(cc, list, '#ffffff'); P.label('Progression (moyenne en bordeaux)'); P.image(cc, P.CW); }
      }
      const goals = p.goals || [];
      if (goals.length) { P.label('Objectifs personnels'); P.table(['Objectif', 'Depuis', 'État'], goals.map(g => [g.text, UI.fmtDate(g.created), g.status === 'done' ? 'Atteint (' + UI.fmtDate(g.doneAt) + ')' : g.status === 'drop' ? 'Abandonné' : 'En cours']), [.6, .18, .22]); }
      P.label('Buts et passes'); P.para(`${s.g} but${s.g > 1 ? 's' : ''} · ${s.a} passe${s.a > 1 ? 's' : ''} décisive${s.a > 1 ? 's' : ''}`);
      P.ensure(30); P.label('Signatures'); P.para('Le coach :                                                    Le joueur / les parents :');
      const res = await Exporter.deliver(P.blob(), `bulletin-${String(Store.fullName(p)).replace(/[^\wÀ-ÿ-]+/g, '-')}.pdf`);
      if (res === 'downloaded') toast('Bulletin enregistré dans Téléchargements');
    } catch (e) { console.error(e); toast('Bulletin impossible : ' + (e.message || e), 'err'); } finally { b.done(); }
  }

  /* ---------- the team page: who to evaluate, one after the other ---------- */
  function page(root, teamId) {
    const teams = Auth.teams(), t = Store.get('teams', teamId) || teams[0];
    if (!t) { root.innerHTML = '<div class="empty"><p>Crée d\'abord une équipe.</p></div>'; return; }
    const ps = Store.playersOf(t.id).length ? Store.playersOf(t.id) : Store.rosterOf(t.id), per = period(today()), since = today().slice(0, 4) + '-' + (+today().slice(5, 7) >= 8 ? '08' : '01') + '-01';
    const last = p => evals(p).pop(), todo = ps.filter(p => !last(p) || last(p).date < since);
    root.innerHTML = `<header class="page-head"><div><h1>📈 Progression</h1><p class="sub">${esc(t.name)} · ${esc(per)} · ${ps.length - todo.length}/${ps.length} évalués</p></div>
      <div class="head-actions"><a class="btn" href="#/equipes">${I.back}<span>Équipes</span></a>${todo.length ? `<button class="btn primary" data-pgrun>${I.play}<span>Évaluer les ${todo.length} restants</span></button>` : ''}</div></header>
      <label class="fld inline"><span>Équipe</span><select id="pgTeam">${teams.map(x => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${esc(Store.teamLabel(x))}</option>`).join('')}</select></label>
      <div class="list">${ps.map(p => { const ev = last(p), g = ev && global(ev), goals = (p.goals || []).filter(x => x.status === 'open').length;
        return `<div class="list-item"><a class="li-main" href="#/joueur/${p.id}"><b>${esc(Store.fullName(p))}</b><span class="muted">${ev ? `${esc(UI.fmtDate(ev.date))} · ${fr(g)} / 5` : 'Pas encore évalué'}${goals ? ` · 🎯 ${goals}` : ''}</span></a>
          ${ev && ev.date >= since ? '<span class="pg-ok">✅</span>' : ''}<button class="btn soft" data-pgeval="${p.id}">${I.edit}<span>Évaluer</span></button></div>`; }).join('') || '<p class="muted">Pas de joueur dans cette équipe.</p>'}</div>`;
    const redraw = () => page(root, t.id);
    $('#pgTeam', root).onchange = e => { location.hash = '#/progression/' + e.target.value; };
    const run = (queue) => { const [p, ...rest] = queue; if (!p) { toast('Toute l\'équipe est évaluée 💪'); return redraw(); } evalDialog(p, redraw, null, rest.length ? () => run(rest) : null); };
    root.onclick = e => { const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.pgeval) return evalDialog(Store.get('players', b.dataset.pgeval), redraw);
      if (b.hasAttribute('data-pgrun')) return run(todo); };
  }

  return { card, mount, click, page, bulletin, global, evals };
})();
