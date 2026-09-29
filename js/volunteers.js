/* Vol: the volunteers of match days. For each match: buvette, arbitre de touche, délégué, table de marque, lavage des maillots,
   accueil, photos… Each task has a number of people; the coaches sign up in one tap (or write the name of a parent who said yes),
   the parents sign up from their page. The day before, the coaches on duty get a notification (club server).
   The sign-ups are kept on the match (m.vol = { task: [{ id, name, staffId?, parent? }] }), the list of tasks with the club. */
const Vol = (() => {
  const { esc, $, $$, toast, modal, confirmBox } = UI;
  const S = () => Store.state;
  const DEFAULT = [
    { key: 'buvette', icon: '🥤', label: 'Buvette', need: 2, when: 'home', on: true },
    { key: 'touche', icon: '🚩', label: 'Arbitre de touche', need: 1, when: 'all', on: true },
    { key: 'delegue', icon: '📋', label: 'Délégué', need: 1, when: 'home', on: true },
    { key: 'table', icon: '🧾', label: 'Table de marque / FMI', need: 1, when: 'home', on: true },
    { key: 'lavage', icon: '🧺', label: 'Lavage des maillots', need: 1, when: 'all', on: true },
    { key: 'accueil', icon: '🤝', label: 'Accueil de l\'adversaire', need: 1, when: 'home', on: false },
    { key: 'photos', icon: '📸', label: 'Photos', need: 1, when: 'all', on: false },
  ];
  const tasks = () => { const c = S().club.volTasks; return Array.isArray(c) && c.length ? c : DEFAULT; };
  const tasksFor = m => tasks().filter(t => t.on !== false && (t.when === 'all' || (t.when === 'home' && m.home) || (t.when === 'away' && !m.home)));
  const me = () => Auth.current();
  const list = (m, k) => ((m.vol || {})[k] || []);
  const filled = m => tasksFor(m).reduce((a, t) => a + Math.min(t.need, list(m, t.key).length), 0);
  const needed = m => tasksFor(m).reduce((a, t) => a + t.need, 0);
  const title = m => `${esc((Store.get('teams', m.teamId) || {}).name || '')} ${m.home ? 'contre' : 'chez'} ${esc(m.opponent || '?')}`;
  const upcoming = (days = 28) => { const t = UI.today(), end = new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
    return S().matches.filter(m => !m.exempt && !m.played && m.date >= t && m.date <= end && (Auth.isAdmin() || Auth.sees(m.teamId))).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))); };
  // my duties (today / tomorrow / soon), for the home page
  function mine(days = 7) {
    const u = me(); if (!u) return [];
    return upcoming(days).flatMap(m => tasksFor(m).filter(t => list(m, t.key).some(p => p.staffId === u.id)).map(t => ({ m, t })));
  }

  function taskRow(m, t) {
    const people = list(m, t.key), u = me(), inMe = u && people.some(p => p.staffId === u.id), full = people.length >= t.need;
    return `<div class="vol-task ${full ? 'full' : ''}"><div class="vol-head"><b>${t.icon} ${esc(t.label)}</b><span class="vol-count">${people.length}/${t.need}</span></div>
      <div class="vol-people">${people.map(p => `<span class="vol-p ${p.parent ? 'par' : ''}">${esc(p.name)}${p.parent ? ' <i>(parent)</i>' : ''}${!Auth.volView() || (u && p.staffId === u.id) ? `<button class="vol-x" data-vrm="${m.id}|${t.key}|${p.id}" aria-label="Retirer ${esc(p.name)}">×</button>` : ''}</span>`).join('')}
        ${Array.from({ length: Math.max(0, t.need - people.length) }, () => '<span class="vol-free">place libre</span>').join('')}</div>
      <div class="chips">${u && !inMe ? `<button class="btn ${full ? 'soft' : 'primary'} vol-btn" data-vme="${m.id}|${t.key}">🙋 Je m'inscris</button>` : ''}${Auth.volView() ? '' : `<button class="btn soft vol-btn" data-vadd="${m.id}|${t.key}">${I.plus}<span>Inscrire quelqu'un</span></button>`}</div></div>`;
  }
  function matchBlock(m) {
    const f = filled(m), n = needed(m);
    return `<section class="card vol-match" data-vm="${m.id}"><div class="row-head"><div><h2>${esc(UI.fmtDate(m.date, { weekday: 'long', day: 'numeric', month: 'long' }))}${m.time ? ' · ' + esc(m.time.replace(':', 'h')) : ''}</h2>
      <p class="muted small">${title(m)} · ${m.home ? '🏠 à domicile' : '🚌 à l\'extérieur'}</p></div><b class="vol-score ${f >= n ? 'ok' : ''}">${f}/${n}</b></div>
      <div class="vol-grid">${tasksFor(m).map(t => taskRow(m, t)).join('')}</div></section>`;
  }

  /* ---------- the page ---------- */
  function page(root) {
    const ui = S().ui.vol = S().ui.vol || { only: '' }, ms = upcoming().filter(m => !ui.only || (ui.only === 'mine' ? tasksFor(m).some(t => list(m, t.key).some(p => p.staffId === (me() || {}).id)) : filled(m) < needed(m)));
    const my = mine(28);
    root.innerHTML = `<header class="page-head"><div><h1>🙋 Bénévoles</h1><p class="sub">Qui fait quoi les jours de match (4 semaines)</p></div>
      <div class="head-actions">${Auth.isAdmin() ? `<button class="btn" data-vset>${I.settings}<span>Les tâches</span></button>` : ''}</div></header>
      ${my.length ? `<div class="vol-mine">🙋 Tu es inscrit : ${my.map(({ m, t }) => `<b>${t.icon} ${esc(t.label)}</b> le ${esc(UI.fmtDate(m.date))}`).join(' · ')}</div>` : ''}
      <div class="chips"><button class="chip ${!ui.only ? 'on' : ''}" data-vf="">Tous les matchs</button><button class="chip ${ui.only === 'missing' ? 'on' : ''}" data-vf="missing">Il manque du monde</button><button class="chip ${ui.only === 'mine' ? 'on' : ''}" data-vf="mine">Mes inscriptions</button></div>
      ${ms.map(matchBlock).join('') || '<p class="muted">Aucun match dans les 4 semaines.</p>'}
      <p class="muted small">Les parents peuvent aussi s'inscrire depuis la page des parents de leur catégorie. La veille, les coachs inscrits reçoivent un rappel.</p>`;
    root.onclick = e => click(e, () => page(root)) || filter(e, root);
  }
  function filter(e, root) { const b = e.target.closest('[data-vf]'); if (!b) return false; S().ui.vol.only = b.dataset.vf; Store.persistNow(); page(root); return true; }
  // the actions, from the page or from the card of a match
  function click(e, redraw) {
    const b = e.target.closest('[data-vme], [data-vadd], [data-vrm], [data-vset]'); if (!b) return false;
    if (b.hasAttribute('data-vset')) { settings(redraw); return true; }
    const [mid, key, pid] = (b.dataset.vme || b.dataset.vadd || b.dataset.vrm).split('|'), m = Store.get('matches', mid), t = tasks().find(x => x.key === key); if (!m || !t) return true;
    const save = () => { m.vol = m.vol || {}; Store.upsert('matches', m); redraw && redraw(); };
    if (b.dataset.vme) { const u = me(); (m.vol = m.vol || {})[key] = [...list(m, key), { id: Store.uid(), name: Messages.coachName(u), staffId: u.id }]; save(); toast(`Merci ! ${t.icon} ${t.label} le ${UI.fmtDate(m.date)}`); }
    if (b.dataset.vadd) {
      modal({ title: `${t.icon} ${t.label} · ${UI.fmtDate(m.date)}`, body: `<label class="fld"><span>Nom (un parent, un joueur, un dirigeant)</span><input id="vName" maxlength="40" placeholder="ex : Maman de Noah"></label>
        <div class="chips">${S().staff.filter(s => !list(m, key).some(p => p.staffId === s.id) && (s.teamIds || []).includes(m.teamId)).slice(0, 12).map(s => `<button class="chip" data-vst="${s.id}">${esc(Store.fullName(s))}</button>`).join('')}</div>`,
        onOpen: r => $$('[data-vst]', r).forEach(x => x.onclick = () => { const s = Store.get('staff', x.dataset.vst); $('#vName', r).value = Store.fullName(s); $('#vName', r).dataset.staff = s.id; }),
        actions: [{ label: 'Annuler' }, { label: 'Inscrire', kind: 'primary', onClick: (c, r) => { const i = $('#vName', r), n = i.value.trim(); if (!n) { toast('Écris un nom', 'err'); return false; }
          (m.vol = m.vol || {})[key] = [...list(m, key), { id: Store.uid(), name: n, staffId: i.dataset.staff || null }]; save(); } }] });
    }
    if (b.dataset.vrm) confirmBox('Retirer cette personne ?', 'Retirer').then(ok => { if (!ok) return; m.vol[key] = list(m, key).filter(p => p.id !== pid); save(); });
    return true;
  }
  function settings(redraw) {
    const ts = tasks().map(t => Object.assign({}, t));
    const body = () => `<p class="muted small">Les tâches proposées à chaque match, et le nombre de personnes pour chacune.</p>${ts.map((t, i) => `<div class="vol-set">
      <label class="prep-check"><input type="checkbox" data-i="${i}" data-f="on" ${t.on !== false ? 'checked' : ''}><span>${t.icon} ${esc(t.label)}</span></label>
      <select data-i="${i}" data-f="need">${[1, 2, 3, 4].map(n => `<option ${n === t.need ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <select data-i="${i}" data-f="when">${[['home', 'à domicile'], ['all', 'tous les matchs'], ['away', 'à l\'extérieur']].map(([v, l]) => `<option value="${v}" ${v === t.when ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`).join('')}
      <label class="fld"><span>Ajouter une tâche</span><input id="vNew" maxlength="30" placeholder="ex : Traçage du terrain"></label>`;
    modal({ title: 'Les tâches des bénévoles', noFocus: true, body: `<div id="vsBody">${body()}</div>`,
      onOpen: r => { r.querySelector('#vsBody').onchange = e => { const i = +e.target.dataset.i, f = e.target.dataset.f; if (f === 'on') ts[i].on = e.target.checked; if (f === 'need') ts[i].need = +e.target.value; if (f === 'when') ts[i].when = e.target.value; }; },
      actions: [{ label: 'Annuler' }, { label: 'Enregistrer', kind: 'primary', onClick: (c, r) => { const n = $('#vNew', r).value.trim();
        if (n) ts.push({ key: 'x' + Store.uid().slice(-6), icon: '🙋', label: n, need: 1, when: 'home', on: true });
        S().club.volTasks = ts; Store.save(); toast('Tâches enregistrées'); redraw && redraw(); } }] });
  }

  // the card on the match page
  function card(m) {
    if (m.played || m.exempt || !tasksFor(m).length) return '';
    const f = filled(m), n = needed(m);
    return `<a class="card vol-card ${f >= n ? 'ok' : ''}" href="#/benevoles"><b>🙋 Bénévoles ${f}/${n}</b><span class="muted small">${tasksFor(m).map(t => `${t.icon} ${list(m, t.key).length}/${t.need}`).join(' · ')}</span></a>`;
  }
  return { page, card, mine, click, tasks, DEFAULT };
})();
