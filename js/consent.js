/* Consent (2.66): the authorisations of a player, given in the app by the family (or the adult player) instead of on paper:
   image rights, emergency care, transport by the coaches or other parents, going home alone, the club keeping the data.
   Each answer keeps who gave it and when. Families: « Moi » tab of the players' and parents' pages. Coaches: player's page,
   and the table of a team (#/autorisations). A coach may also note an answer given on paper. */
const Consent = (() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ITEMS = [
    ['photo', '📸', 'Droit à l\'image', 'Le club peut publier des photos et vidéos où l\'on voit le joueur (site, réseaux, journal du club).'],
    ['care', '🚑', 'Soins d\'urgence', 'En cas d\'urgence, les éducateurs peuvent appeler les secours et faire soigner le joueur, si on ne peut pas joindre la famille à temps.'],
    ['transport', '🚗', 'Transport', 'Le joueur peut monter dans la voiture d\'un éducateur ou d\'un autre parent pour aller aux matchs et en revenir.'],
    ['alone', '🚶', 'Partir seul', 'Le joueur peut rentrer seul après l\'entraînement ou le match.'],
    ['data', '🔒', 'Données dans l\'appli', 'Le club garde dans l\'appli les informations utiles à l\'activité (contacts, présence, matchs, fiche urgence), comme expliqué dans la page Confidentialité.']];
  const KEYS = ITEMS.map(x => x[0]);
  const fdate = at => { const d = new Date(at); return isNaN(d) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); };
  const clean = c => { const o = {}; if (!c || typeof c !== 'object') return o;
    KEYS.forEach(k => { const x = c[k]; if (x && typeof x === 'object' && typeof x.v === 'boolean') o[k] = { v: x.v, at: x.at || '', by: String(x.by || '').slice(0, 60) }; }); return o; };
  const answered = c => KEYS.filter(k => c && c[k]).length;
  const mark = x => !x ? '<span class="cs-q" title="Pas de réponse">–</span>' : x.v ? '<span class="cs-y" title="Oui">✅</span>' : '<span class="cs-n" title="Non">❌</span>';

  const CSS = '.cs-card .cs-row{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-top:1px solid var(--line,#e5e7eb)}.cs-card .cs-row:first-of-type{border-top:0}'
    + '.cs-row .cs-ic{font-size:20px;line-height:1.2}.cs-row .cs-txt{flex:1;min-width:0}.cs-row .cs-txt b{display:block}.cs-row .cs-txt p{margin:2px 0 0;font-size:13px;color:#6b7280}'
    + '.cs-row .cs-by{font-size:12px;color:#6b7280;margin-top:3px}.cs-yn{display:flex;gap:6px;flex-shrink:0}.cs-yn button{min-width:52px}'
    + '.cs-yn button.cs-on-y{background:#16a34a;color:#fff;border-color:#16a34a}.cs-yn button.cs-on-n{background:#dc2626;color:#fff;border-color:#dc2626}'
    + '.cs-sign{display:flex;flex-direction:column;gap:4px;margin-top:10px}.cs-sign input{width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:10px;padding:8px 10px;font:inherit;font-size:16px;background:#fff;color:#111}'
    + '.cs-y,.cs-n,.cs-q{font-weight:800}.cs-q{color:#9ca3af}.cs-tbl td,.cs-tbl th{text-align:center;padding-left:6px;padding-right:6px}.cs-tbl td:first-child,.cs-tbl th:first-child{text-align:left}';
  function css() { if (document.getElementById('csCss')) return; const s = document.createElement('style'); s.id = 'csCss'; s.textContent = CSS; document.head.appendChild(s); }

  // the list with yes / no (family: buttons; coach: read, or buttons in his modal)
  function rows(c, o = {}) {
    return ITEMS.filter(([k]) => !(o.adult && k === 'alone')).map(([k, ic, l, d]) => { const x = c[k];
      return `<div class="cs-row"><span class="cs-ic">${ic}</span><div class="cs-txt"><b>${esc(l)}</b><p>${esc(d)}</p>${x && x.at ? `<div class="cs-by">${x.v ? 'Oui' : 'Non'} · ${esc(fdate(x.at))}${x.by ? ' · ' + esc(x.by) : ''}</div>` : ''}</div>
        ${o.edit ? `<div class="cs-yn"><button type="button" class="${o.btn || 'b'} ${x && x.v ? 'cs-on-y' : ''}" data-cs="${k}:1">Oui</button><button type="button" class="${o.btn || 'b'} ${x && !x.v ? 'cs-on-n' : ''}" data-cs="${k}:0">Non</button></div>` : `<div class="cs-yn">${mark(x)}</div>`}</div>`; }).join('');
  }

  /* ---------- the family (o: key, load, save(answers), toast, who, adult, intro) ---------- */
  let memo = { key: null, c: null, at: 0, busy: false };
  function mount(el, o) {
    if (!el) return; css();
    const key = o.key || 'x';
    if (memo.key !== key) memo = { key, c: null, at: 0, busy: false };
    const draw = () => {
      const c = memo.c, n = c ? answered(c) : 0, tot = ITEMS.length - (o.adult ? 1 : 0);
      el.innerHTML = `<div class="card cs-card"><h3>✍️ Autorisations ${c ? `<small class="muted">· ${n}/${tot}</small>` : ''}</h3>
        <p class="info">${esc(o.intro || 'Tes réponses remplacent les autorisations sur papier. Tu peux les changer quand tu veux ; le club voit la date et le nom de qui a répondu.')}</p>
        ${c == null ? '<p class="urg-none">Chargement…</p>' : o.view ? rows(c, { adult: o.adult }) : `${rows(c, { edit: true, adult: o.adult })}
        <label class="cs-sign"><span><b>Ton nom</b> (il est noté avec chaque réponse)</span><input id="csWho" maxlength="60" value="${esc(memo.who != null ? memo.who : (o.who || ''))}" placeholder="ex : Karim B. (papa)" autocomplete="off"></label>`}</div>`;
    };
    el.oninput = e => { if (e.target.id === 'csWho') memo.who = e.target.value; };
    el.onclick = async e => {
      const b = e.target.closest('[data-cs]'); if (!b || memo.busy || !memo.c) return;
      const [k, v] = b.dataset.cs.split(':'), who = String(memo.who != null ? memo.who : (o.who || '')).trim();
      if (!who) { (o.toast || alert)('Écris d\'abord ton nom, en bas', true); const i = el.querySelector('#csWho'); if (i) i.focus(); return; }
      memo.busy = true;
      try { memo.c = clean(await o.save({ [k]: { v: v === '1', by: who } })); memo.at = Date.now(); draw(); (o.toast || (() => {}))('Réponse enregistrée ✓'); }
      catch (err) { (o.toast || alert)((err && err.message) || 'Pas enregistrée, réessaie.', true); }
      memo.busy = false;
    };
    draw();
    if (memo.c == null || Date.now() - memo.at > 60000)
      Promise.resolve().then(() => o.load()).then(r => { if (memo.key !== key) return; memo.c = clean(r); memo.at = Date.now(); if (document.body.contains(el)) draw(); })
        .catch(() => { if (memo.c == null) { memo.c = {}; if (document.body.contains(el)) draw(); } });
  }

  /* ---------- the coach: card on the player's page, modal to note a paper answer, the table of a team ---------- */
  const adultOf = p => { if (!p || !p.birth) return false; const b = new Date(p.birth), n = new Date(); return (n - b) / 31557600000 >= 18; };
  function card(p) {
    css(); const c = clean(p.consent), tot = ITEMS.length - (adultOf(p) ? 1 : 0);
    return `<section class="card cs-card"><h2>✍️ Autorisations <span class="muted small">· ${answered(c)}/${tot}</span></h2>
      ${answered(c) ? rows(c, { adult: adultOf(p) }) : '<p class="muted">Pas encore de réponse. La famille répond dans son espace (onglet « Moi »), ou tu notes ici une autorisation donnée sur papier.</p>'}
      <div class="urg-acts"><button class="btn small" data-cscoach>📝 Noter une réponse papier</button>${(p.teamIds || [])[0] ? `<a class="btn small" href="#/autorisations/${esc(p.teamIds[0])}">✍️ Toute l'équipe</a>` : ''}</div></section>`;
  }
  function click(e, p, redraw) {
    if (!e.target.closest('[data-cscoach]')) return false;
    const c = clean(p.consent);
    UI.modal({ title: `✍️ Autorisations · ${Store.fullName(p)}`, noFocus: true, body: `<p class="muted small">Pour une autorisation signée sur papier : la réponse est notée « papier » avec ton nom et la date du jour.</p>${rows(c, { edit: true, btn: 'btn small', adult: adultOf(p) })}`,
      onOpen: r => r.addEventListener('click', ev => { const b = ev.target.closest('[data-cs]'); if (!b) return; const [k, v] = b.dataset.cs.split(':');
        b.parentNode.querySelectorAll('button').forEach(x => x.classList.remove('cs-on-y', 'cs-on-n')); b.classList.add(v === '1' ? 'cs-on-y' : 'cs-on-n'); b.dataset.picked = '1';
        b.parentNode.querySelectorAll('button').forEach(x => { if (x !== b) delete x.dataset.picked; }); }),
      actions: [{ label: 'Annuler' }, { label: 'Enregistrer', kind: 'primary', onClick: (close, root) => {
        const me = Auth.current(), by = `papier · noté par ${me ? Store.shortName(Store.get('staff', me.id) || me) : 'un coach'}`, at = new Date().toISOString();
        root.querySelectorAll('[data-picked="1"]').forEach(b => { const [k, v] = b.dataset.cs.split(':'); c[k] = { v: v === '1', at, by }; });
        if (answered(c)) p.consent = c; else delete p.consent;
        Store.upsert('players', p); UI.toast('Autorisations enregistrées ✓'); setTimeout(redraw, 0); } }] });
    return true;
  }
  // #/autorisations/teamId: who said yes / no / nothing, for each authorisation
  function page(root, teamId) {
    css();
    const teams = Auth.teams() || [], cur = teamId || (Store.state.ui || {}).teamId, t = (cur && Auth.sees(cur) && Store.get('teams', cur)) || teams[0];
    if (!t) { root.innerHTML = '<p class="muted">Aucune équipe.</p>'; return; }
    const ps = Store.playersOf(t.id).filter(p => !p.archived).slice().sort(Store.byName);
    const count = k => ({ y: ps.filter(p => (clean(p.consent)[k] || {}).v === true).length, n: ps.filter(p => (clean(p.consent)[k] || {}).v === false).length });
    root.innerHTML = `<header class="page-head"><div><h1>✍️ Autorisations · ${esc(t.name)}</h1><p class="sub">${ps.filter(p => answered(clean(p.consent))).length}/${ps.length} familles ont répondu</p></div>
      <div class="head-actions"><button class="btn" data-act="back">${I.back}<span>Retour</span></button>${teams.length > 1 ? `<select class="cs-sel" aria-label="Équipe">${teams.map(x => `<option value="${esc(x.id)}" ${x.id === t.id ? 'selected' : ''}>${esc(Store.teamLabel(x))}</option>`).join('')}</select>` : ''}</div></header>
      <p class="muted small">Les familles répondent dans leur espace (onglet « Moi »). ❌ = la famille a dit non : à respecter (photos à ne pas publier, pas de covoiturage…).</p>
      <div class="tiles">${ITEMS.map(([k, ic, l]) => { const c = count(k); return `<div class="tile ${c.n ? 'd' : ''}"><b>${c.y}/${ps.length}</b><span>${ic} ${esc(l)}${c.n ? ` · ${c.n} non` : ''}</span></div>`; }).join('')}</div>
      <div class="table-wrap"><table class="tbl cs-tbl"><thead><tr><th>Joueur</th>${ITEMS.map(([k, ic, l]) => `<th title="${esc(l)}">${ic}</th>`).join('')}</tr></thead>
        <tbody>${ps.map(p => { const c = clean(p.consent); return `<tr><td><a href="#/joueur/${esc(p.id)}">${esc(Store.fullName(p))}</a></td>${ITEMS.map(([k]) => `<td>${k === 'alone' && adultOf(p) ? '' : mark(c[k])}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div>
      <p class="muted small">${ITEMS.map(([, ic, l]) => `${ic} ${esc(l)}`).join(' · ')}</p>`;
    root.onclick = e => { if (e.target.closest('[data-act="back"]')) history.length > 1 ? history.back() : (location.hash = '#/equipes'); };
    const sel = root.querySelector('.cs-sel'); if (sel) sel.onchange = () => { location.hash = '#/autorisations/' + sel.value; };
  }
  // a player whose family said no to the photos (to warn before sharing a picture)
  const noPhoto = p => (clean(p && p.consent).photo || {}).v === false;
  return { ITEMS, clean, answered, mount, card, click, page, noPhoto };
})();
