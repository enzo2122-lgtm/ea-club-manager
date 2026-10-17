/* Club admin: licences, medical certificates, fees and image rights of the players (responsables),
   Excel exports (attendance and playing time), and who supervises what each week, with the dirigeants' absences. */
const ClubAdmin = (() => {
  const { esc, $, $$, toast, modal, confirmBox, fmtDate, today } = UI;
  const S = () => Store.state;
  const addDays = (d, n) => { const x = new Date(d + 'T12:00'); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  const monday = d => { const x = new Date(d + 'T12:00'), k = (x.getDay() + 6) % 7; return addDays(d, -k); };

  /* ---------- the player's paperwork: p.adm = { lic, certif, cotis, paid, image } ---------- */
  // each field: [key, column title, the values in the order a touch goes through them: [value, label, tone]]
  const FIELDS = [
    ['lic', 'Licence', [['', '–', ''], ['ok', '✓ Validée', 'good'], ['attente', '⏳ En attente', 'mid']]],
    ['certif', 'Certificat / questionnaire santé', [['', '–', ''], ['ok', '✓ OK', 'good'], ['manque', '✗ À fournir', 'bad']]],
    ['cotis', 'Cotisation', [['', '✗ Non payée', 'bad'], ['ok', '✓ Payée', 'good'], ['partiel', '½ En partie', 'mid']]],
    ['image', 'Droit à l\'image', [['', '–', ''], ['oui', '✓ Accepté', 'good'], ['non', '✗ Refusé', 'bad']]],
  ];
  const adm = p => p.adm || {};
  const val = (p, k) => adm(p)[k] || '';
  const cell = (p, [k, , vals]) => { const v = vals.find(x => x[0] === val(p, k)) || vals[0]; return `<button class="adm-b ${v[2]}" data-adm="${k}" data-p="${p.id}">${esc(v[1])}</button>`; };
  // Not allowed to play: licence still pending, or certificate to provide (a box not filled in yet gives no warning)
  const tracking = () => S().players.some(p => p.adm && (p.adm.lic || p.adm.certif));
  function problem(p) {
    if (!tracking()) return '';
    const a = adm(p), out = [];
    if (a.lic === 'attente') out.push('licence en attente');
    if (a.certif === 'manque') out.push('certificat à fournir');
    return out.join(', ');
  }
  const noImage = p => val(p, 'image') === 'non';

  /* ---------- (3.14) the licence: its number, its real state in Footclubs, and its price ----------
     club.fees = { town, local, ext, mute }: the price for the players living in the club's town, the others, the transferred ones (mutés).
     A licence read in Footclubs is paid (the club only registers it once paid): the fee is marked « payée » at the import. */
  const fees = () => S().club.fees || {};
  const normTown = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');
  const isMute = p => !!p.mute && /^mute/.test(p.mute);
  const local = p => { const f = fees(); return !f.town || !p.town ? null : normTown(p.town) === normTown(f.town) || normTown(p.town).includes(normTown(f.town)); };
  // [price, why] — null when the club has no prices or the town is unknown
  function fee(p) {
    const f = fees(); if (!f.local && !f.ext && !f.mute) return null;
    if (isMute(p) && f.mute) return [+f.mute, 'muté'];
    const l = local(p); if (l == null) return null;
    return l ? [+f.local, f.town ? 'habite ' + f.town : 'tarif local'] : [+f.ext, 'hors ' + (f.town || 'commune')];
  }
  const LICS = { ok: ['✓ Validée', 'good'], attente: ['⏳ En attente', 'mid'] };
  /* (3.43) the end of a licence: p.adm.licTo, put at the end of the season (30 June) when it is validated (by a touch or from Footclubs).
     An old validated licence without it ends with the season it was read in Footclubs, or this season. */
  const seasonEndOf = d => { const x = new Date((d || today()) + 'T12:00'); return `${x.getMonth() >= 6 ? x.getFullYear() + 1 : x.getFullYear()}-06-30`; };
  const licTo = p => adm(p).licTo || (adm(p).lic === 'ok' ? seasonEndOf(p.fc && p.fc.at) : '');
  // its state: 'valide', 'expiree', 'attente', or '' (not filled in)
  const licState = p => { const a = adm(p), to = licTo(p); return a.lic === 'attente' ? 'attente' : to && to < today() ? 'expiree' : a.lic === 'ok' ? 'valide' : ''; };
  const STATES = { valide: ['Valide', 'good', [22, 120, 60]], expiree: ['Expirée', 'bad', [176, 30, 40]], attente: ['En attente', 'mid', [180, 100, 0]], '': ['Non renseigné', '', [120, 130, 125]] };
  const fmtDay = d => d ? d.split('-').reverse().join('/') : '';
  // the card on the player's page (coaches and responsables)
  function licenceCard(p) {
    if (!Auth.current() || Auth.limited()) return '';
    const a = adm(p), fc = p.fc || null, fe = fee(p), st = LICS[a.lic], paid = a.cotis === 'ok', part = a.cotis === 'partiel';
    return `<section class="card lic-card"><h2>🪪 Licence</h2>
      <dl class="lic-dl">
        <div><dt>Numéro</dt><dd>${p.licence ? `<b>${esc(p.licence)}</b>` : '<span class="muted">pas encore renseigné</span>'}</dd></div>
        <div><dt>Dans Footclubs</dt><dd>${fc ? `<b>${esc(fc.etat || 'présente')}</b><span class="muted small"> · lu le ${esc(fmtDate(fc.at))}</span>` : '<span class="muted">pas lue (Gestion → Sources → Footclubs)</span>'}</dd></div>
        <div><dt>État</dt><dd>${st ? `<span class="adm-b ${st[1]}">${st[0]}</span>` : '<span class="muted">–</span>'}${isMute(p) ? ' <span class="badge">muté</span>' : ''}</dd></div>
        ${licTo(p) ? `<div><dt>Expire le</dt><dd>${esc(fmtDay(licTo(p)))}${licState(p) === 'expiree' ? ' <span class="adm-b bad">Expirée</span>' : ''}</dd></div>` : ''}
        ${Auth.isAdmin() ? `<div><dt>Scan</dt><dd>${a.scan ? `<button class="btn small soft" data-licscan="view">📎<span>Voir le scan</span></button> <button class="linkish" data-licscan="del">retirer</button>` : `<button class="btn small soft" data-licscan="add">${I.upload}<span>Ajouter le scan</span></button><span class="muted small"> image ou PDF, gardé sur cet appareil</span>`}</dd></div>` : ''}
        <div><dt>Cotisation</dt><dd>${paid ? '<span class="adm-b good">✓ Payée</span>' : part ? '<span class="adm-b mid">½ En partie</span>' : '<span class="adm-b bad">✗ Non payée</span>'}${a.paid != null && a.paid !== '' ? ` · ${esc(a.paid)} €` : ''}${fc && paid && a.paidBy === 'footclubs' ? '<span class="muted small"> (licence présente sur Footclubs)</span>' : ''}</dd></div>
        ${Auth.isAdmin() ? `<div><dt>Paiements</dt><dd>${paySummary(p) ? `${esc(paySummary(p))} ` : ''}<button class="btn small soft" data-licpay="1">💶<span>${pays(p).length ? 'Voir / modifier' : 'Noter un paiement'}</span></button></dd></div>` : ''}
        <div><dt>Tarif</dt><dd>${fe ? `<b>${fe[0]} €</b> <span class="muted small">(${esc(fe[1])})</span>` : `<span class="muted">${fees().local || fees().ext ? 'commune inconnue : « Modifier » → Commune' : 'tarifs non réglés (Licences et cotisations)'}</span>`}</dd></div>
        ${p.town ? `<div><dt>Commune</dt><dd>${esc(p.town)}</dd></div>` : ''}
      </dl>${Auth.isAdmin() ? '<p><a class="btn soft" href="#/licences">🧾<span>Licences et cotisations du club</span></a></p>' : ''}</section>`;
  }
  // the Footclubs import: what it tells about one player (his state, and the licence there = paid)
  function fromFootclubs(p, etat) {
    p.fc = { etat: String(etat || '').slice(0, 60), at: today() };
    const a = Object.assign({}, p.adm);
    if (a.lic === 'ok' && (!a.licTo || a.licTo < seasonEndOf())) a.licTo = seasonEndOf(); // validated this season: until 30 June
    if (a.cotis !== 'ok' && !(a.pays || []).length) { a.cotis = 'ok'; a.paidBy = 'footclubs'; const fe = fee(p); if ((a.paid == null || a.paid === '') && fe) a.paid = fe[0]; }
    p.adm = a;
  }

  function licencesPage(root) {
    if (!Auth.isAdmin()) { location.hash = '#/'; return; }
    const ui = S().ui, cat = ui.admCat || '', only = ui.admOnly || '', q = (ui.admQ || '').toLowerCase();
    const inCat = p => !cat || (p.teamIds || []).includes(cat);
    const all = S().players.filter(inCat);
    const bad = p => { const a = adm(p); return a.lic !== 'ok' || a.certif === 'manque' || a.cotis !== 'ok'; };
    const list = all.filter(p => (!only || bad(p)) && (!q || Store.fullName(p).toLowerCase().includes(q))).sort(Store.byName);
    const n = (k, v) => all.filter(p => val(p, k) === v).length, total = all.reduce((a, p) => a + (+adm(p).paid || 0), 0);
    const tile = (v, l, cls = '') => `<div class="tile ${cls}"><b>${v}</b><span>${l}</span></div>`;
    root.innerHTML = `<header class="page-head"><div><h1>Licences et cotisations</h1><p class="sub">Saison ${esc(People.seasonLabel())} · ${all.length} joueur${all.length > 1 ? 's' : ''}${cat ? ' · ' + esc((Store.get('teams', cat) || {}).name || '') : ''}</p></div>
      <div class="head-actions"><a class="btn" href="#/president">${I.back}<span>Tableau de bord</span></a><button class="btn" data-act="csv">${I.download}<span>Excel</span></button><button class="btn" data-act="pdf">${I.pdf}<span>Exporter en PDF</span></button></div></header>
      <div class="tiles">${tile(`${n('lic', 'ok')}/${all.length}`, 'Licences validées', 'v')}${tile(n('certif', 'manque'), 'Certificats à fournir', n('certif', 'manque') ? 'd' : '')}
        ${tile(`${n('cotis', 'ok')}/${all.length}`, 'Cotisations payées', 'v')}${tile(n('cotis', 'partiel'), 'Payées en partie', 'n')}${tile(total ? total.toLocaleString('fr-FR') + ' €' : '–', 'Encaissé')}${tile(n('image', 'non'), 'Refus droit à l\'image', n('image', 'non') ? 'd' : '')}${cheques().length ? tile(late().length, 'Chèques à déposer maintenant', late().length ? 'd' : '') : ''}</div>
      ${depositCard()}
      <div class="filters">
        <label class="search">${I.search}<input id="admQ" type="search" placeholder="Chercher un nom" value="${esc(ui.admQ || '')}"></label>
        <select id="admCat" aria-label="Catégorie"><option value="">Toutes les catégories</option>${S().teams.map(t => `<option value="${t.id}" ${t.id === cat ? 'selected' : ''}>${esc(Store.teamLabel(t))}</option>`).join('')}</select>
        <label class="switch"><input type="checkbox" id="admOnly" ${only ? 'checked' : ''}><span>Seulement ceux qui ne sont pas en règle</span></label>
      </div>
      <details class="card fees-card" ${fees().local || fees().ext ? '' : 'open'}><summary><b>💶 Tarifs des licences</b><span class="muted small"> · ${fees().local || fees().ext ? `${esc(fees().town || 'commune')} ${esc(fees().local || '?')} € · autres ${esc(fees().ext || '?')} € · mutés ${esc(fees().mute || '?')} €` : 'à régler'}</span></summary>
        <div class="row2"><label class="fld"><span>Commune du club</span><input id="feeTown" value="${esc(fees().town || '')}" placeholder="ex : Le Raincy"></label>
          <label class="fld"><span>Habitants de la commune (€)</span><input id="feeLocal" type="number" min="0" inputmode="decimal" value="${esc(fees().local || '')}"></label>
          <label class="fld"><span>Hors commune (€)</span><input id="feeExt" type="number" min="0" inputmode="decimal" value="${esc(fees().ext || '')}"></label>
          <label class="fld"><span>Mutés (€)</span><input id="feeMute" type="number" min="0" inputmode="decimal" value="${esc(fees().mute || '')}"></label></div>
        <p class="muted small">La commune de chaque joueur se met sur sa fiche (« Modifier » → Commune). Une licence lue dans Footclubs compte comme payée, au tarif du joueur.</p></details>
      <p class="muted small">Touche une case pour changer son état. Les coachs voient ⚠️ à côté d'un joueur dont la licence est en attente ou le certificat à fournir (dans les convocations), et savent qui refuse le droit à l'image. Les cotisations restent entre responsables.</p>
      <div class="table-wrap"><table class="tbl adm-tbl"><thead><tr><th>Joueur</th>${FIELDS.map(f => `<th>${esc(f[1])}</th>`).join('')}<th>Expire le</th><th>Tarif</th><th>Payé (€)</th></tr></thead>
        <tbody>${list.map(p => `<tr><td><a href="#/joueur/${p.id}"><b>${esc(Store.fullName(p))}</b></a><br><span class="muted small">${esc((p.teamIds || []).map(id => (Store.get('teams', id) || {}).name).filter(Boolean).join(', '))}</span></td>
          ${FIELDS.map(f => `<td>${cell(p, f)}</td>`).join('')}<td><input class="adm-to ${licState(p) === 'expiree' ? 'bad' : ''}" type="date" data-licto="${p.id}" value="${esc(licTo(p))}" aria-label="Fin de la licence de ${esc(Store.fullName(p))}"></td><td>${(fe => fe ? `${fe[0]} €` : '<span class="muted">?</span>')(fee(p))}</td><td class="pay-cell">${pays(p).length ? `<button class="btn small soft" data-pay="${p.id}"><b>${eur(+adm(p).paid || 0)}</b></button><span class="muted small">${esc(paySummary(p))}</span>`
            : `<input class="adm-paid" type="number" min="0" step="1" inputmode="decimal" data-paid="${p.id}" value="${adm(p).paid == null ? '' : esc(adm(p).paid)}" aria-label="Montant payé par ${esc(Store.fullName(p))}"><button class="icon-btn" data-pay="${p.id}" aria-label="Chèques et paiements de ${esc(Store.fullName(p))}" title="Chèques et paiements">💶</button>`}</td></tr>`).join('') || `<tr><td colspan="8" class="muted">Personne ici.</td></tr>`}</tbody></table></div>`;
    const again = () => { const y = window.scrollY; licencesPage(root); window.scrollTo(0, y); };
    $('#admQ', root).oninput = e => { ui.admQ = e.target.value; clearTimeout(licencesPage.t); licencesPage.t = setTimeout(() => { again(); const i = $('#admQ', root); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 400); };
    $('#admCat', root).onchange = e => { ui.admCat = e.target.value; Store.persistNow(); again(); };
    $('#admOnly', root).onchange = e => { ui.admOnly = e.target.checked ? 1 : 0; Store.persistNow(); again(); };
    root.onchange = e => {
      if (/^fee/.test(e.target.id || '')) { const v = id => $('#' + id, root).value.trim(); S().club.fees = { town: v('feeTown'), local: +v('feeLocal') || 0, ext: +v('feeExt') || 0, mute: +v('feeMute') || 0 }; Store.save(); toast('Tarifs enregistrés'); return; }
      const d = e.target.closest('[data-licto]');
      if (d) { const p = Store.get('players', d.dataset.licto); p.adm = Object.assign({}, p.adm, { licTo: d.value || '' }); Store.upsert('players', p); return again(); }
      const i = e.target.closest('[data-paid]'); if (!i) return;
      const p = Store.get('players', i.dataset.paid); p.adm = Object.assign({}, p.adm, { paid: i.value === '' ? null : Math.max(0, +i.value) }); Store.upsert('players', p);
    };
    root.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.act === 'csv') return csvLicences(list);
      if (b.dataset.act === 'pdf') return pdfDialog();
      if (b.dataset.act === 'chqcsv') return csvCheques();
      if (b.dataset.pay) return payDialog(Store.get('players', b.dataset.pay), again);
      if (b.dataset.depos) { const [pid, cid] = b.dataset.depos.split('|'); deposit(pid, cid); return again(); }
      if (b.dataset.adm) {
        const p = Store.get('players', b.dataset.p), f = FIELDS.find(x => x[0] === b.dataset.adm), vals = f[2];
        const i = vals.findIndex(x => x[0] === val(p, f[0])), next = vals[(i + 1) % vals.length];
        p.adm = Object.assign({}, p.adm, { [f[0]]: next[0] });
        if (f[0] === 'lic' && next[0] === 'ok' && !(p.adm.licTo >= today())) p.adm.licTo = seasonEndOf(); // validated now: until the end of the season
        Store.upsert('players', p);
        const y = window.scrollY; licencesPage(root); window.scrollTo(0, y); // counters at the top follow
      }
    };
  }

  /* ---------- (3.43) the licences in a PDF (made on the device with jsPDF, like the other PDFs of the app) ----------
     Filters: categories (U13 and its teams A / B), groups (the teams A / B) and sub-categories (p.subcat). Several choices in a filter
     add up (U13 or U15); the filters combine (U13 and sub-category U12). Nothing chosen: all the licences. */
  const fams = () => Store.teamGroups(S().teams.slice()).map(g => ({ key: g[0].id, name: (g.find(Store.isMain) || {}).name || g[0].category || g[0].name, ids: g.map(t => t.id) }));
  const groupsList = () => S().teams.filter(t => !Store.isMain(t));
  const licPlayers = () => S().players.filter(p => !p.archived && !p.anon && !p.example);
  const NONE = '_';
  // what a player is in: his categories (in the order of the club), his groups, his sub-category
  const catsOf = (p, F) => { const c = F.filter(f => (p.teamIds || []).some(id => f.ids.includes(id))).map(f => f.key); return c.length ? c : [NONE]; };
  const groupsOf = p => (p.teamIds || []).map(id => Store.get('teams', id)).filter(t => t && !Store.isMain(t));
  function licSelect(sel) {
    const F = fams(), ok = p => (!sel.cats.length || catsOf(p, F).some(k => sel.cats.includes(k)))
      && (!sel.groups.length || groupsOf(p).some(t => sel.groups.includes(t.id))) && (!sel.subs.length || sel.subs.includes(p.subcat || NONE));
    const list = licPlayers().filter(ok), catName = k => k === NONE ? 'Sans catégorie' : (F.find(f => f.key === k) || {}).name || '';
    // sections: by group when groups are chosen (a player in two chosen groups is in both), otherwise by category (his first chosen one)
    let sections;
    if (sel.groups.length) sections = groupsList().filter(t => sel.groups.includes(t.id)).map(t => ({ title: t.name, list: list.filter(p => (p.teamIds || []).includes(t.id)) }));
    else sections = [...F.map(f => f.key), NONE].map(k => ({ title: catName(k), chosen: sel.cats.includes(k), list: list.filter(p => catsOf(p, F).filter(c => !sel.cats.length || sel.cats.includes(c))[0] === k) }));
    // a group or a category chosen but empty keeps its title, with « Aucune licence »
    sections = sections.filter(x => x.list.length || sel.groups.length || x.chosen).map(x => Object.assign(x, { list: x.list.slice().sort(Store.byName) }));
    const short = arr => arr.length > 3 ? arr.slice(0, 3).join(', ') + ' +' + (arr.length - 3) : arr.join(', ');
    const label = [short(sel.cats.map(catName)), short(groupsList().filter(t => sel.groups.includes(t.id)).map(t => t.name)), short(sel.subs.map(s => s === NONE ? 'sans sous-catégorie' : s))].filter(Boolean).join(' · ') || 'toutes';
    return { list, sections, label, catName: p => catName(catsOf(p, F)[0]) };
  }

  function pdfDialog() {
    const F = fams(), all = licPlayers(), sel = { cats: [], groups: [], subs: [] };
    const subs = [...new Set(all.map(p => p.subcat || NONE))].sort((a, b) => a === NONE ? 1 : b === NONE ? -1 : a.localeCompare(b, 'fr', { numeric: true }));
    const nCat = k => all.filter(p => catsOf(p, F).includes(k)).length, nGroup = t => all.filter(p => (p.teamIds || []).includes(t.id)).length;
    const chip = (kind, v, l, n) => `<button type="button" class="chip" data-lp="${kind}" data-v="${esc(v)}">${esc(l)} <span class="muted small">${n}</span></button>`;
    const cats = [...F.filter(f => nCat(f.key)), ...(nCat(NONE) ? [{ key: NONE, name: 'Sans catégorie' }] : [])];
    const scans = all.filter(p => adm(p).scan).length;
    modal({ title: '📄 Exporter les licences en PDF', noFocus: true, body: `
      <p class="muted small">Sans choix, toutes les licences. Plusieurs choix dans un filtre s'ajoutent (U13 ou U15) ; les filtres se combinent (U13 et sous-catégorie U12).</p>
      <div class="chips"><button type="button" class="chip on" data-lp="all">Toutes les licences <span class="muted small">${all.length}</span></button></div>
      <h3 class="sub-h">Par catégorie</h3><div class="chips">${cats.map(f => chip('cats', f.key, f.name, nCat(f.key))).join('') || '<span class="muted small">Aucune catégorie</span>'}</div>
      <h3 class="sub-h">Par groupe</h3><div class="chips">${groupsList().map(t => chip('groups', t.id, t.name, nGroup(t))).join('') || '<span class="muted small">Aucun groupe (équipes A, B…) dans le club</span>'}</div>
      <h3 class="sub-h">Par sous-catégorie</h3><div class="chips">${subs.map(s => chip('subs', s, s === NONE ? 'Sans sous-catégorie' : s, all.filter(p => (p.subcat || NONE) === s).length)).join('') || '<span class="muted small">Aucune sous-catégorie</span>'}</div>
      <label class="chk lp-scans"><input type="checkbox" id="lpScans" ${scans ? '' : 'disabled'}> Inclure les scans des licences <span class="muted small">(${scans ? `${scans} téléversé${scans > 1 ? 's' : ''} sur cet appareil` : 'aucun scan sur cet appareil : « Ajouter le scan » sur la fiche du joueur'})</span></label>
      <p class="tip lp-count" id="lpCount" aria-live="polite"></p>`,
      onOpen: r => {
        const count = () => {
          const s = licSelect(sel), n = s.list.length;
          $$('[data-lp]', r).forEach(b => b.classList.toggle('on', b.dataset.lp === 'all' ? !sel.cats.length && !sel.groups.length && !sel.subs.length : sel[b.dataset.lp].includes(b.dataset.v)));
          $('#lpCount', r).innerHTML = n ? `<b>${n} licence${n > 1 ? 's' : ''}</b> · Licences – ${esc(s.label)}` : '⚠️ <b>Aucune licence</b> pour ce choix : change les filtres.';
          $('#lpCount', r).classList.toggle('warn', !n);
        };
        r.addEventListener('click', e => {
          const b = e.target.closest('[data-lp]'); if (!b) return;
          if (b.dataset.lp === 'all') { sel.cats = []; sel.groups = []; sel.subs = []; }
          else { const a = sel[b.dataset.lp], v = b.dataset.v; sel[b.dataset.lp] = a.includes(v) ? a.filter(x => x !== v) : [...a, v]; }
          count();
        });
        count();
      },
      actions: [{ label: 'Annuler' }, { label: 'Exporter en PDF', kind: 'primary', icon: I.pdf, onClick: (c, r) => {
        const s = licSelect(sel); if (!s.list.length) { toast('Aucune licence pour ce choix', 'err'); return false; }
        const withScans = $('#lpScans', r).checked, b = UI.busy('Préparation du PDF…');
        Exporter.loadPdf().then(() => pdfLicences(s, withScans)).then(res => { if (res === 'downloaded') toast('PDF enregistré dans Téléchargements'); })
          .catch(e => { console.error(e); toast(e.message || 'PDF impossible', 'err'); }).finally(() => b.done());
      } }] });
  }

  async function pdfLicences(s, withScans) {
    // always A4 portrait, even when Réglages → Impression asks A3 for the bench sheets
    const club = S().club, ui = S().ui, fmt = ui.pdfFormat; ui.pdfFormat = 'a4'; let P; try { P = Exporter.pdfDoc(club); } finally { ui.pdfFormat = fmt; }
    const doc = P.doc, L = Exporter.latin, M = P.M, CW = P.CW, BOTTOM = P.PH - 16;
    let title = 'Licences - ' + s.label; doc.setFont('helvetica', 'bold'); doc.setFontSize(17);
    while (title.length > 12 && doc.getTextWidth(L(title)) > CW - 24) title = title.slice(0, -4).replace(/[\s,·+]+$/, '') + '...'; // one line in the banner
    P.header(title, `Exporté le ${fmtDay(today())} · saison ${People.seasonLabel()}`);
    const COLS = [['Nom', .145], ['Prénom', .125], ['Né(e) le', .095], ['Catégorie', .1], ['Sous-cat.', .09], ['Groupe', .1], ['N° de licence', .125], ['Statut', .125], ['Expire le', .095]];
    const RH = 6.2, FS = 8;
    const fit = (t, w) => { t = L(t); if (doc.getTextWidth(t) <= w) return t; while (t.length > 1 && doc.getTextWidth(t + '...') > w) t = t.slice(0, -1); return t + '...'; };
    const row = (cells, o = {}) => {
      if (o.fill) { doc.setFillColor(...o.fill); doc.rect(M, P.y, CW, RH, 'F'); }
      doc.setFontSize(FS); let x = M;
      cells.forEach((c, i) => { const w = COLS[i][1] * CW; doc.setFont('helvetica', o.bold || (o.boldCol === i) ? 'bold' : 'normal'); doc.setTextColor(...(o.colors && o.colors[i] || [20, 30, 25])); doc.text(fit(c, w - 2.4), x + 1.2, P.y + 4.2); x += w; });
      doc.setTextColor(20, 30, 25); P.y += RH;
    };
    const head = () => row(COLS.map(c => c[0]), { bold: true, fill: [226, 233, 226] });
    const room = (h, again) => { if (P.y + h > BOTTOM) { doc.addPage(); P.y = M; if (again) head(); } };
    s.sections.forEach(sec => {
      room(10 + RH * 3); // the title of a section never stays alone at the bottom of a page
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.setTextColor(140, 16, 36); doc.text(L(sec.title), M, P.y + 4.5); doc.setTextColor(20, 30, 25); P.y += 8;
      if (!sec.list.length) { doc.setFont('helvetica', 'italic'); doc.setFontSize(9.5); doc.setTextColor(110, 120, 115); doc.text('Aucune licence', M, P.y + 4); doc.setTextColor(20, 30, 25); P.y += 12; return; }
      head();
      sec.list.forEach((p, i) => {
        room(RH, true);
        const st = STATES[licState(p)];
        row([String(p.lastName || '').toUpperCase(), p.firstName || '', fmtDay(p.birth), s.catName(p), p.subcat || '-', groupsOf(p).map(t => t.name).join(', ') || '-', p.licence || '-', st[0], fmtDay(licTo(p)) || '-'],
          { fill: i % 2 ? [246, 248, 246] : null, boldCol: 0, colors: { 7: st[2] } });
      });
      room(RH + 2);
      doc.setDrawColor(200, 210, 200); doc.line(M, P.y, M + CW, P.y);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text(L(`Total ${sec.title} : ${sec.list.length} licence${sec.list.length > 1 ? 's' : ''}`), M + CW, P.y + 4.6, { align: 'right' }); P.y += 11;
    });
    // the end of the document: the total, and how many in each state
    const n = s.list.length, by = k => s.list.filter(p => licState(p) === k).length, twice = s.sections.reduce((a, x) => a + x.list.length, 0) > n;
    room(16);
    if (Exporter.eco()) { doc.setDrawColor(14, 29, 69); doc.setLineWidth(.5); doc.rect(M, P.y, CW, 9); doc.setTextColor(14, 29, 69); } else { doc.setFillColor(14, 29, 69); doc.rect(M, P.y, CW, 9, 'F'); doc.setTextColor(255, 255, 255); } doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text(L(`Total : ${n} licence${n > 1 ? 's' : ''}${twice ? ' (un joueur de deux groupes compte une fois)' : ''}`), M + 3, P.y + 6.2);
    doc.setTextColor(20, 30, 25); P.y += 13;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(L(['valide', 'expiree', 'attente', ''].filter(by).map(k => `${STATES[k][0]} : ${by(k)}`).join('   ·   ')), M, P.y + 3); P.y += 8;

    // (option) the scans, after the table: the picture or the pages of each licence uploaded on this device
    if (withScans) {
      const seen = new Set(), order = []; s.sections.forEach(x => x.list.forEach(p => { if (!seen.has(p.id)) { seen.add(p.id); order.push(p); } }));
      const have = order.filter(p => adm(p).scan), missing = order.filter(p => !adm(p).scan);
      doc.addPage(); P.y = M; P.h2(`Scans des licences (${have.length})`);
      for (const p of have) {
        const d = (await Library.docImages([adm(p).scan]))[0];
        if (!d || !d.images) { P.para(`${Store.fullName(p)} : scan introuvable sur cet appareil.`, 9); continue; }
        for (let k = 0; k < d.images.length; k++) {
          const img = await Media.loadImage(d.images[k]), c = document.createElement('canvas'), z = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
          c.width = Math.round(img.naturalWidth * z); c.height = Math.round(img.naturalHeight * z);
          const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
          let w = CW, h = w * c.height / c.width; if (h > 200) { h = 200; w = h * c.width / c.height; }
          room(h + 9);
          doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(L(`${Store.fullName(p)} · ${s.catName(p)}${p.licence ? ' · n° ' + p.licence : ''}${d.images.length > 1 ? ` · page ${k + 1}/${d.images.length}` : ''}`), M, P.y + 4); P.y += 6;
          doc.addImage(c.toDataURL('image/jpeg', .85), 'JPEG', M + (CW - w) / 2, P.y, w, h, undefined, 'FAST'); P.y += h + 6;
        }
      }
      if (missing.length) { room(14); P.label(`Sans scan sur cet appareil (${missing.length})`); P.para(missing.map(Store.fullName).join(', '), 9); }
    }
    // « page X / Y » at the bottom of every page
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(110, 120, 115);
      doc.text(L(club.name || ''), M, P.PH - 8); doc.text(L(`Licences - ${fmtDay(today())}`), M + CW / 2, P.PH - 8, { align: 'center' }); doc.text(`Page ${i} / ${pages}`, M + CW, P.PH - 8, { align: 'right' });
    }
    return Exporter.deliver(P.blob(), `Licences-${String(s.label).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 50)}-${today()}.pdf`);
  }

  // the scan of a licence, on the player's card (responsables): an image or a PDF, kept on this device like the Bibliothèque's files
  function licClick(e, p, refresh) {
    if (e.target.closest('[data-licpay]') && Auth.isAdmin()) { payDialog(p, refresh); return true; }
    const b = e.target.closest('[data-licscan]'); if (!b || !Auth.isAdmin()) return false;
    const set = id => { p.adm = Object.assign({}, p.adm, { scan: id || undefined }); if (!id) delete p.adm.scan; Store.upsert('players', p); refresh(); };
    const kind = b.dataset.licscan, old = adm(p).scan;
    if (kind === 'add') UI.chooseFiles({ accept: 'image/*,application/pdf', multiple: false }).then(async files => {
      if (!files.length) return; const bz = UI.busy('Enregistrement du scan…');
      try { const ids = await Library.importFiles([files[0]], () => {}, 'lic'); if (ids[0]) { set(ids[0]); toast('Scan de la licence enregistré'); } }
      catch (er) { toast(er.message || 'Scan impossible à enregistrer', 'err'); } finally { bz.done(); }
    });
    if (kind === 'view') Library.docImages([old]).then(d => {
      if (!d[0] || !d[0].images) return toast('Scan introuvable sur cet appareil', 'err');
      modal({ title: `🪪 Licence de ${Store.fullName(p)}`, body: d[0].images.map(u => `<img class="lic-scan" alt="Scan de la licence" src="${u}">`).join(''), actions: [{ label: 'Fermer' }] });
    });
    if (kind === 'del') confirmBox(`Retirer le scan de la licence de ${Store.fullName(p)} ?`, 'Retirer').then(ok => { if (!ok) return; if (old) Media.del(old); set(''); });
    return true;
  }

  /* ---------- (3.44) the payments of a licence, up to 5 cheques: p.adm.pays = [{ id, mode, amount, no, bank, holder, due, dep }]
     due = the day the cheque is to be deposited, dep = the day it was (empty: still in the club's hands).
     p.adm.total = the price asked (the tariff by default). With payments, « payé » is their sum and the fee follows: paid / in part. ---------- */
  const MAX_CHQ = 5;
  const MODES = [['cheque', 'Chèque'], ['especes', 'Espèces'], ['virement', 'Virement'], ['cb', 'Carte bancaire'], ['aide', 'Pass\'Sport / aide']];
  const modeLabel = m => (MODES.find(x => x[0] === m) || MODES[0])[1];
  const pays = p => (adm(p).pays || []).filter(x => x && +x.amount > 0);
  const due = p => { const a = adm(p); return a.total != null && a.total !== '' ? +a.total : (fee(p) || [])[0] || 0; };
  const eur = n => (Math.round(n * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €';
  // the fee state from the payments (nothing changes for a player without payments written)
  function applyPays(a) {
    const list = (a.pays || []).filter(x => +x.amount > 0); if (!list.length) return a;
    const sum = list.reduce((s, x) => s + +x.amount, 0), total = a.total != null && a.total !== '' ? +a.total : 0;
    a.paid = Math.round(sum * 100) / 100; a.cotis = total ? (sum >= total - .005 ? 'ok' : 'partiel') : 'ok'; delete a.paidBy;
    return a;
  }
  // every cheque of the club: [{ p, c }] (deposited or not)
  const cheques = () => licPlayers().flatMap(p => pays(p).filter(c => c.mode === 'cheque').map(c => ({ p, c })));
  const toDeposit = () => cheques().filter(x => !x.c.dep).sort((a, b) => String(a.c.due || '9').localeCompare(String(b.c.due || '9')) || Store.byName(a.p, b.p));
  const late = () => toDeposit().filter(x => x.c.due && x.c.due <= today());
  const monthsLater = (d, k) => { const [y, m, j] = d.split('-').map(Number), x = new Date(y, m - 1 + k, 1), last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(Math.min(j, last)).padStart(2, '0')}`; };

  function payDialog(p, done) {
    const a = adm(p), list = (a.pays || []).map(x => Object.assign({}, x)), fe = fee(p);
    const total0 = a.total != null && a.total !== '' ? a.total : fe ? fe[0] : '';
    const row = (x, i) => `<div class="pay-row ${x.dep ? 'dep' : ''}" data-row="${i}">
      <div class="pay-top"><b>${i + 1}.</b><select data-f="mode" aria-label="Moyen de paiement">${MODES.map(([k, l]) => `<option value="${k}" ${k === (x.mode || 'cheque') ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <label class="pay-amt"><input data-f="amount" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(x.amount == null ? '' : x.amount)}" aria-label="Montant"> €</label>
        <button type="button" class="icon-btn" data-delrow="${i}" aria-label="Retirer ce paiement">${I.x}</button></div>
      ${(x.mode || 'cheque') === 'cheque' ? `<div class="row2"><label class="fld"><span>N° du chèque</span><input data-f="no" value="${esc(x.no || '')}" inputmode="numeric" maxlength="20"></label>
        <label class="fld"><span>Banque</span><input data-f="bank" value="${esc(x.bank || '')}" maxlength="40" placeholder="ex : Crédit Agricole"></label></div>
        <div class="row2"><label class="fld"><span>Nom sur le chèque</span><input data-f="holder" value="${esc(x.holder || '')}" maxlength="60" placeholder="ex : le parent"></label>
        <label class="fld"><span>À déposer le</span><input data-f="due" type="date" value="${esc(x.due || '')}"></label></div>
        <label class="chk"><input type="checkbox" data-f="dep" ${x.dep ? 'checked' : ''}> Déposé à la banque${x.dep ? ` <span class="muted small">le ${esc(fmtDay(x.dep))}</span>` : ''}</label>`
      : `<label class="fld"><span>Reçu le</span><input data-f="due" type="date" value="${esc(x.due || '')}"></label>`}</div>`;
    modal({ title: `💶 Paiement de ${Store.fullName(p)}`, noFocus: true, body: `
      <label class="fld"><span>Montant de la cotisation (€)${fe ? ` <span class="muted small">tarif : ${fe[0]} € (${esc(fe[1])})</span>` : ''}</span><input id="payTotal" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(total0)}"></label>
      <details class="card pay-plan" ${list.length ? '' : 'open'}><summary><b>📅 Payer en plusieurs chèques</b></summary>
        <div class="row2"><label class="fld"><span>Nombre de chèques</span><select id="planN">${[1, 2, 3, 4, 5].map(n => `<option ${n === 3 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <label class="fld"><span>1er dépôt le</span><input id="planFrom" type="date" value="${today()}"></label></div>
        <label class="fld"><span>Nom sur les chèques</span><input id="planHolder" maxlength="60" value="${esc(((p.parents || [])[0] || {}).name || '')}"></label>
        <p class="muted small">Un chèque par mois à partir de cette date, le même montant chacun (les centimes en plus sur le premier). Les numéros et la banque s'écrivent ensuite.</p>
        <button type="button" class="btn soft" data-act="plan">Préparer les chèques</button></details>
      <div id="payRows"></div>
      <div class="chips"><button type="button" class="btn soft" data-act="addpay">${I.plus}<span>Ajouter un paiement</span></button></div>
      <p class="tip" id="paySum" aria-live="polite"></p>`,
      onOpen: r => {
        const read = () => $$('.pay-row', r).forEach(el => { const x = list[+el.dataset.row]; $$('[data-f]', el).forEach(i => {
          const f = i.dataset.f; if (f === 'dep') x.dep = i.checked ? (x.dep || today()) : ''; else if (f === 'amount') x.amount = i.value === '' ? '' : Math.max(0, +i.value); else x[f] = i.value.trim(); }); });
        const sum = () => { const t = +$('#payTotal', r).value || 0, s = list.reduce((a, x) => a + (+x.amount || 0), 0), nq = list.filter(x => (x.mode || 'cheque') === 'cheque').length;
          $('#paySum', r).innerHTML = `Payé <b>${eur(s)}</b>${t ? ` sur ${eur(t)} · ${s >= t - .005 ? (s > t + .005 ? `<b class="bad-t">${eur(s - t)} de trop</b>` : '<b class="good-t">✓ tout est payé</b>') : `reste <b>${eur(t - s)}</b>`}` : ''}${nq ? ` · ${nq} chèque${nq > 1 ? 's' : ''} sur ${MAX_CHQ} possibles` : ''}`; };
        const draw = () => { $('#payRows', r).innerHTML = list.map(row).join('') || '<p class="muted small">Aucun paiement noté.</p>'; sum(); };
        r.addEventListener('input', e => { if (e.target.closest('.pay-row')) read(); sum(); });
        r.addEventListener('change', e => { if (e.target.closest('.pay-row')) { read(); if (/^(mode|dep)$/.test(e.target.dataset.f)) draw(); } });
        r.addEventListener('click', e => {
          const b = e.target.closest('button'); if (!b || !r.contains(b) || b.closest('.sheet-foot')) return; read();
          const nq = list.filter(x => (x.mode || 'cheque') === 'cheque').length;
          if (b.dataset.delrow) { list.splice(+b.dataset.delrow, 1); draw(); }
          if (b.dataset.act === 'addpay') { if (nq >= MAX_CHQ && !list.some(x => x.mode && x.mode !== 'cheque')) { list.push({ id: Store.uid(), mode: 'especes', amount: '', due: today() }); toast(`${MAX_CHQ} chèques au plus : un autre moyen de paiement est ajouté`); }
            else { const last = list.filter(x => x.due).slice(-1)[0]; list.push({ id: Store.uid(), mode: nq >= MAX_CHQ ? 'especes' : 'cheque', amount: '', due: last ? monthsLater(last.due, 1) : today(), holder: (last || {}).holder || '', bank: (last || {}).bank || '' }); }
            draw(); }
          if (b.dataset.act === 'plan') {
            const n = +$('#planN', r).value, from = $('#planFrom', r).value || today(), t = +$('#payTotal', r).value || 0, paidOther = list.filter(x => x.dep || (x.mode && x.mode !== 'cheque')).reduce((s, x) => s + (+x.amount || 0), 0);
            if (!t) { toast('Écris d\'abord le montant de la cotisation', 'err'); return; }
            const rest = Math.round((t - paidOther) * 100), keep = list.filter(x => x.dep || (x.mode && x.mode !== 'cheque'));
            if (rest <= 0) { toast('Tout est déjà payé'); return; }
            const n2 = Math.min(n, MAX_CHQ - keep.filter(x => (x.mode || 'cheque') === 'cheque').length); if (n2 < 1) { toast(`Déjà ${MAX_CHQ} chèques`, 'err'); return; }
            const part = Math.floor(rest / n2 / 100) * 100, first = rest - part * (n2 - 1), holder = $('#planHolder', r).value.trim();
            list.length = 0; list.push(...keep, ...Array.from({ length: n2 }, (_, k) => ({ id: Store.uid(), mode: 'cheque', amount: (k ? part : first) / 100, due: monthsLater(from, k), holder, no: '', bank: '' })));
            r.querySelector('.pay-plan').open = false; draw();
          }
        });
        draw();
      },
      actions: [{ label: 'Annuler' }, { label: 'Enregistrer', kind: 'primary', onClick: (c, r) => {
        $$('.pay-row', r).forEach(el => { const x = list[+el.dataset.row]; $$('[data-f]', el).forEach(i => { const f = i.dataset.f; if (f === 'dep') x.dep = i.checked ? (x.dep || today()) : ''; else if (f === 'amount') x.amount = i.value === '' ? '' : Math.max(0, +i.value); else x[f] = i.value.trim(); }); });
        const kept = list.filter(x => +x.amount > 0);
        if (kept.filter(x => (x.mode || 'cheque') === 'cheque').length > MAX_CHQ) { toast(`${MAX_CHQ} chèques au plus`, 'err'); return false; }
        const t = $('#payTotal', r).value, na = Object.assign({}, p.adm, { pays: kept.map(x => Object.assign(x, { mode: x.mode || 'cheque' })), total: t === '' ? '' : Math.max(0, +t) });
        if (!kept.length) { delete na.pays; } else applyPays(na);
        p.adm = na; Store.upsert('players', p); toast('Paiement enregistré'); done && done();
      } }] });
  }
  // one line in the lists: « 3 chèques · 2 déposés · prochain le 15/11 »
  function paySummary(p) {
    const l = pays(p); if (!l.length) return '';
    const q = l.filter(x => x.mode === 'cheque'), left = q.filter(x => !x.dep).sort((a, b) => String(a.due).localeCompare(String(b.due)));
    return [q.length ? `${q.length} chèque${q.length > 1 ? 's' : ''}` : '', q.length && q.length - left.length ? `${q.length - left.length} déposé${q.length - left.length > 1 ? 's' : ''}` : '',
      left[0] && left[0].due ? `prochain dépôt le ${fmtDay(left[0].due)}` : '', l.some(x => x.mode !== 'cheque') ? l.filter(x => x.mode !== 'cheque').map(x => modeLabel(x.mode).toLowerCase()).join(', ') : ''].filter(Boolean).join(' · ');
  }
  // the card « Chèques à déposer » at the top of the licences page
  function depositCard() {
    const all = toDeposit(); if (!cheques().length) return '';
    const lim = addDays(today(), 31), now = all.filter(x => !x.c.due || x.c.due <= lim), later = all.length - now.length, lt = late();
    const line = ({ p, c }) => `<li class="${c.due && c.due <= today() ? 'late' : ''}"><span class="d">${c.due ? esc(fmtDay(c.due)) : 'sans date'}</span><span class="o"><a href="#/joueur/${p.id}"><b>${esc(Store.fullName(p))}</b></a><span class="muted small">${[c.holder, c.bank, c.no ? 'n° ' + c.no : ''].filter(Boolean).map(esc).join(' · ')}</span></span><b class="s">${eur(+c.amount)}</b><button class="btn small soft" data-depos="${p.id}|${c.id}">✓ Déposé</button></li>`;
    return `<section class="card dep-card"><h2>🏦 Chèques à déposer</h2>
      <p class="muted small">${lt.length ? `<b class="bad-t">${lt.length} à déposer maintenant (${eur(lt.reduce((s, x) => s + +x.c.amount, 0))})</b> · ` : ''}${all.length} chèque${all.length > 1 ? 's' : ''} en attente pour ${eur(all.reduce((s, x) => s + +x.c.amount, 0))}${later ? ` · ${later} après le ${fmtDay(lim)}` : ''}</p>
      ${now.length ? `<ul class="dep-list">${now.map(line).join('')}</ul>` : '<p class="muted">Rien à déposer dans le mois.</p>'}
      <p><button class="btn soft" data-act="chqcsv">${I.download}<span>Bordereau des chèques (Excel)</span></button></p></section>`;
  }
  function csvCheques() {
    const rows = cheques().sort((a, b) => String(a.c.due || '9').localeCompare(String(b.c.due || '9')) || Store.byName(a.p, b.p));
    return csv([['À déposer le', 'Déposé le', 'Joueur', 'Catégories', 'Nom sur le chèque', 'Banque', 'N° du chèque', 'Montant (€)'],
      ...rows.map(({ p, c }) => [fmtDay(c.due), fmtDay(c.dep), Store.fullName(p), (p.teamIds || []).map(id => (Store.get('teams', id) || {}).name).filter(Boolean).join(', '), c.holder || '', c.bank || '', c.no || '', +c.amount])],
      `Cheques-${S().club.name}-${today()}`);
  }
  function deposit(pid, cid) { const p = Store.get('players', pid), a = Object.assign({}, p.adm); a.pays = (a.pays || []).map(x => x.id === cid ? Object.assign({}, x, { dep: today() }) : x); p.adm = a; Store.upsert('players', p); toast('Chèque noté déposé'); }

  /* ---------- Excel (a .csv file that Excel opens with the French accents and columns) ---------- */
  function csv(rows, name) {
    const cellOf = v => { const s = v == null ? '' : typeof v === 'number' ? String(v).replace('.', ',') : String(v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const text = '﻿' + rows.map(r => r.map(cellOf).join(';')).join('\r\n');
    return Exporter.deliver(new Blob([text], { type: 'text/csv;charset=utf-8' }), `${name}.csv`).then(r => { if (r === 'downloaded') toast('Fichier Excel enregistré dans Téléchargements'); });
  }
  const labelOf = (k, v) => ((FIELDS.find(f => f[0] === k)[2].find(x => x[0] === (v || '')) || [])[1] || '').replace(/^[✓✗⏳½] /, '');
  function csvLicences(list) {
    csv([['Nom', 'Prénom', 'Né(e) le', 'Catégories', 'N° de licence', ...FIELDS.map(f => f[1]), 'Statut', 'Expire le', 'Payé (€)', 'Paiements'],
      ...list.map(p => [p.lastName, p.firstName, People.fmtBirth(p.birth), (p.teamIds || []).map(id => (Store.get('teams', id) || {}).name).filter(Boolean).join(', '), p.licence || '', ...FIELDS.map(f => labelOf(f[0], val(p, f[0]))), STATES[licState(p)][0], fmtDay(licTo(p)), adm(p).paid == null ? '' : +adm(p).paid, paySummary(p)])],
      `Licences-${S().club.name}-${today()}`);
  }
  // Attendance and playing time of the season, one line per player (one category, or the whole club)
  function csvSeason(teamIds) {
    const from = People.seasonFrom(), now = today(), rows = [['Catégorie', 'Nom', 'Prénom', 'Postes', 'Séances (appel fait)', 'Présences', 'Présence (%)', 'Convocations', 'Matchs joués', 'Minutes', 'Moyenne (min/match)', 'Buts', 'Passes déc.']];
    const teams = (teamIds || S().teams.map(t => t.id)).map(id => Store.get('teams', id)).filter(Boolean);
    teams.forEach(t => {
      const trs = S().trainings.filter(x => !x.model && x.teamId === t.id && x.date >= from && x.date <= now && (x.presents || []).length);
      const ms = S().matches.filter(m => m.teamId === t.id && m.date >= from && !m.exempt && Store.kindOk(m));
      Store.playersOf(t.id).forEach(p => {
        const pr = trs.filter(x => x.presents.includes(p.id)).length, conv = ms.filter(m => (m.convoked || []).includes(p.id)), pl = conv.filter(m => m.played);
        const min = pl.reduce((a, m) => a + (+((m.minutes || {})[p.id]) || 0), 0), withMin = pl.filter(m => (m.minutes || {})[p.id] != null).length;
        const st = k => pl.reduce((a, m) => a + (((m.stats || {})[p.id] || {})[k] || 0), 0);
        rows.push([t.name, p.lastName, p.firstName, People.postsLabel(p, true), trs.length, pr, trs.length ? Math.round(pr / trs.length * 100) : '', conv.length, pl.length, min, withMin ? Math.round(min / withMin) : '', st('g'), st('a')]);
      });
    });
    return csv(rows, `Presences-temps-de-jeu-${teamIds && teamIds.length === 1 ? (Store.get('teams', teamIds[0]) || {}).name : S().club.name}-${today()}`);
  }

  /* ---------- who supervises what (week) and the dirigeants' absences: staff.absences = [{ id, from, to, note }] ---------- */
  const absentOn = (s, d) => (s.absences || []).find(a => a.from <= d && d <= (a.to || a.from));
  function staffingPage(root) {
    const ui0 = S().ui; if (!root.querySelector('[data-pg="enc"]')) ui0.encWeek = monday(today()); // (3.14) opened from another page: this week
    const ui = S().ui, me = Auth.current(), wk = ui.encWeek = ui.encWeek || monday(today()), days = Array.from({ length: 7 }, (_, i) => addDays(wk, i));
    const mine = ui.encMine && !Auth.isAdmin();
    const evs = [...S().matches.filter(m => !m.exempt && days.includes(m.date)).map(m => ({ kind: 'match', x: m, date: m.date, time: m.rdv || m.time || '', title: `⚽ ${(Store.get('teams', m.teamId) || {}).name || ''} ${m.home ? 'contre' : 'chez'} ${m.opponent || '?'}`, href: '#/match/' + m.id })),
      ...S().trainings.filter(t => !t.model && days.includes(t.date)).map(t => ({ kind: 'training', x: t, date: t.date, time: t.time || '', title: `🏃 ${(Store.get('teams', t.teamId) || {}).name || 'Séance'} · ${t.title || 'Entraînement'}`, href: '#/entrainement/' + t.id }))]
      .filter(e => !mine || Auth.sees(e.x.teamId)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const nobody = evs.filter(e => !(e.x.staffIds || []).length).length;
    const absents = S().staff.map(s => ({ s, a: (s.absences || []).filter(a => a.from <= days[6] && (a.to || a.from) >= days[0]) })).filter(x => x.a.length);
    root.innerHTML = `<header class="page-head" data-pg="enc"><div><h1>Qui encadre ?</h1><p class="sub">Matchs et séances de la semaine, leurs encadrants, et les absences</p></div>
      <div class="head-actions"><a class="btn" href="#/planning">${I.calendar}<span>Planning</span></a><button class="btn primary" data-act="absence">${I.plus}<span>Déclarer une absence</span></button></div></header>
      <div class="plan-nav"><button class="icon-btn" data-wk="-7" aria-label="Semaine précédente">${I.back}</button><b>Semaine du ${esc(fmtDate(wk, { day: 'numeric', month: 'long' }))}</b><button class="icon-btn" data-wk="7" aria-label="Semaine suivante">${I.next}</button><button class="btn soft" data-wk="0">Cette semaine</button>
        ${Auth.isAdmin() ? '' : `<span class="grow"></span><label class="switch small"><input type="checkbox" id="encMine" ${mine ? 'checked' : ''}><span>Mes catégories</span></label>`}</div>
      ${nobody ? `<p class="tip">⚠️ ${nobody} match${nobody > 1 ? 's' : ''} ou séance${nobody > 1 ? 's' : ''} sans encadrant cette semaine.</p>` : ''}
      ${absents.length ? `<section class="card"><h2>🏖️ Absents cette semaine</h2><ul class="alerts">${absents.map(({ s, a }) => a.map(x => `<li><b>${esc(Store.fullName(s))}</b> : ${esc(fmtDate(x.from, { weekday: 'short', day: 'numeric', month: 'short' }))}${x.to && x.to !== x.from ? ' → ' + esc(fmtDate(x.to, { weekday: 'short', day: 'numeric', month: 'short' })) : ''}${x.note ? ' · ' + esc(x.note) : ''}
        ${Auth.isAdmin() || (me && me.id === s.id) ? `<button class="linkish" data-delabs="${s.id}|${x.id}">retirer</button>` : ''}</li>`).join('')).join('')}</ul></section>` : ''}
      ${days.map(d => { const list = evs.filter(e => e.date === d); if (!list.length) return '';
        return `<h2 class="section">${esc(fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' }))}</h2><div class="list">${list.map(e => { const ids = e.x.staffIds || [], st = ids.map(id => Store.get('staff', id)).filter(Boolean);
          const away = st.filter(s => absentOn(s, d));
          return `<div class="list-item enc-item ${!st.length ? 'enc-none' : ''}"><a class="li-main" href="${e.href}"><b>${esc(e.title)}</b><span class="muted">${e.time ? esc(e.time.replace(':', 'h')) + ' · ' : ''}${st.length ? st.map(s => esc(Store.shortName(s)) + (absentOn(s, d) ? ' ⚠️ absent' : '')).join(', ') : '⚠️ Personne'}</span>${away.length ? `<span class="muted small">Absent ce jour-là : ${away.map(s => esc(Store.shortName(s))).join(', ')}</span>` : ''}</a>
            ${me && !ids.includes(me.id) ? `<button class="btn soft" data-take="${e.kind}|${e.x.id}">${I.whistle}<span>J'y serai</span></button>` : me && ids.includes(me.id) ? `<button class="btn soft" data-drop="${e.kind}|${e.x.id}">Je n'y serai pas</button>` : ''}</div>`; }).join('')}</div>`; }).join('') || '<p class="muted">Aucun match ni séance cette semaine.</p>'}`;
    const again = () => { const y = window.scrollY; staffingPage(root); window.scrollTo(0, y); };
    const mc = $('#encMine', root); if (mc) mc.onchange = () => { ui.encMine = mc.checked ? 1 : 0; Store.persistNow(); again(); };
    root.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.wk) { ui.encWeek = b.dataset.wk === '0' ? monday(today()) : addDays(wk, +b.dataset.wk); Store.persistNow(); return staffingPage(root); }
      if (b.dataset.act === 'absence') return absenceDialog(null, again);
      if (b.dataset.take || b.dataset.drop) {
        const [kind, id] = (b.dataset.take || b.dataset.drop).split('|'), col = kind === 'match' ? 'matches' : 'trainings', x = Store.get(col, id);
        x.staffIds = b.dataset.take ? [...new Set([...(x.staffIds || []), me.id])] : (x.staffIds || []).filter(s => s !== me.id);
        Store.upsert(col, x); toast(b.dataset.take ? 'Noté : tu encadres' : 'Retiré'); return again();
      }
      if (b.dataset.delabs) {
        const [sid, aid] = b.dataset.delabs.split('|'), s = Store.get('staff', sid);
        s.absences = (s.absences || []).filter(a => a.id !== aid); Store.upsert('staff', s); return again();
      }
    };
  }
  // An absence: a responsable can declare one for any dirigeant, a coach for himself
  function absenceDialog(staffId, done) {
    const me = Auth.current(); if (!me) return;
    modal({ title: 'Déclarer une absence', body: `
      ${Auth.isAdmin() ? `<label class="fld"><span>Dirigeant</span><select id="abWho">${S().staff.slice().sort(Store.byName).map(s => `<option value="${s.id}" ${s.id === (staffId || me.id) ? 'selected' : ''}>${esc(Store.fullName(s))}</option>`).join('')}</select></label>` : ''}
      <div class="row2"><label class="fld"><span>Du</span><input type="date" id="abFrom" value="${today()}"></label><label class="fld"><span>Au (inclus)</span><input type="date" id="abTo" value="${today()}"></label></div>
      <label class="fld"><span>Motif (facultatif, visible par les autres dirigeants)</span><input id="abNote" maxlength="60" placeholder="ex : vacances, travail"></label>`,
      actions: [{ label: 'Annuler' }, { label: 'Enregistrer', kind: 'primary', onClick: (c, r) => {
        const s = Store.get('staff', Auth.isAdmin() ? $('#abWho', r).value : me.id), from = $('#abFrom', r).value, to = $('#abTo', r).value || from;
        if (!s || !from) { toast('Choisis une date', 'err'); return false; }
        if (to < from) { toast('La date de fin est avant le début', 'err'); return false; }
        s.absences = [...(s.absences || []).filter(a => (a.to || a.from) >= addDays(today(), -60)), { id: Store.uid(), from, to, note: $('#abNote', r).value.trim() }];
        Store.upsert('staff', s); toast('Absence enregistrée'); done && done();
      } }] });
  }

  return { licenceCard, licClick, payDialog, applyPays, toDeposit, late, deposit, csvCheques, licState, licSelect, pdfDialog, pdfLicences, fromFootclubs, fee, licencesPage, staffingPage, absenceDialog, problem, noImage, csv, csvSeason, tracking };
})();
