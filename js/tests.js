/* Tests: the physical tests of the players (VMA, VIFT of the 30-15, sprints, jump, agility, Yo-Yo, jongles…).
   A test session per team (the whole team typed in one table), the history and the ranking, the running speeds worked out
   from the VMA / VIFT, and the import of an Excel or CSV file (another platform, a GPS, a tablet) with the columns chosen by the coach.
   The results are kept on the player (p.tests = [{ id, test, date, value }]), shared with the club. */
const Tests = (() => {
  const { esc, $, $$, toast, modal, confirmBox } = UI;
  const S = () => Store.state;
  // key, name, unit, higher is better, decimals, help
  const LIST = [
    ['vma', 'VMA', 'km/h', true, 1, 'Vitesse maximale aérobie (VAMEVAL, 45-15, Luc Léger, Gacon…)'],
    ['vift', 'VIFT (30-15)', 'km/h', true, 1, 'Vitesse du dernier palier du test intermittent 30-15 IFT'],
    ['yoyo', 'Yo-Yo IR1', 'm', true, 0, 'Distance totale du Yo-Yo intermittent recovery niveau 1'],
    ['cooper', 'Cooper (12 min)', 'm', true, 0, 'Distance courue en 12 minutes'],
    ['sp10', 'Sprint 10 m', 's', false, 2, 'Départ arrêté'], ['sp20', 'Sprint 20 m', 's', false, 2, ''], ['sp30', 'Sprint 30 m', 's', false, 2, ''],
    ['cmj', 'Détente (CMJ)', 'cm', true, 0, 'Saut en contre-mouvement'], ['sl', 'Saut en longueur', 'cm', true, 0, 'Pieds joints, sans élan'],
    ['illinois', 'Agilité (Illinois)', 's', false, 2, ''], ['ttest', 'T-test', 's', false, 2, ''],
    ['jongles', 'Jongles', 'nb', true, 0, 'Pied fort + pied faible'], ['conduite', 'Conduite slalom', 's', false, 2, ''],
  ];
  const def = k => LIST.find(t => t[0] === k) || [k, k, '', true, 1, ''];
  const fmtV = (k, v) => v == null || v === '' ? '–' : (+v).toFixed(def(k)[4]).replace('.', ',');
  const results = (p, k) => (p.tests || []).filter(r => r.test === k).sort((a, b) => a.date.localeCompare(b.date));
  const last = (p, k) => { const r = results(p, k); return r[r.length - 1]; };
  const better = (k, a, b) => def(k)[3] ? a > b : a < b;
  const num = s => { const n = parseFloat(String(s).replace(',', '.').replace(/[^\d.\-]/g, '')); return isFinite(n) ? n : null; };
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  // the running speeds of a player from his VMA (or VIFT): distances for the classic intermittent and continuous runs
  function zones(vma, vift) {
    const d = (kmh, s) => Math.round(kmh / 3.6 * s);
    return [vma && ['15-15 à 100 % VMA', d(vma, 15) + ' m'], vma && ['15-15 à 110 % VMA', d(vma * 1.1, 15) + ' m'], vma && ['30-30 à 100 % VMA', d(vma, 30) + ' m'],
      vma && ['Course de 6 min à 90 % VMA', d(vma * .9, 360) + ' m'], vma && ['Footing 70 % VMA', (vma * .7).toFixed(1).replace('.', ',') + ' km/h'],
      vift && ['15-15 à 95 % VIFT', d(vift * .95, 15) + ' m'], vift && ['Jeu réduit intense : ~ 90 % VIFT', (vift * .9).toFixed(1).replace('.', ',') + ' km/h']].filter(Boolean);
  }

  /* ---------- the team page ---------- */
  function page(root, teamId) {
    const teams = Auth.teams(), t = Store.get('teams', teamId) || Store.get('teams', S().ui.teamId) || teams[0];
    if (!t) { root.innerHTML = '<div class="empty"><p>Crée d\'abord une équipe.</p></div>'; return; }
    const ui = S().ui.tests = S().ui.tests || { test: 'vma' }, k = ui.test, [, name, unit, up] = def(k);
    const ps = (Store.playersOf(t.id).length ? Store.playersOf(t.id) : Store.rosterOf(t.id)).slice().sort(Store.byName);
    const rows = ps.map(p => { const r = results(p, k), l = r[r.length - 1], pr = r[r.length - 2]; return { p, l, pr }; });
    const ranked = rows.filter(x => x.l).sort((a, b) => up ? b.l.value - a.l.value : a.l.value - b.l.value);
    const vals = ranked.map(x => +x.l.value), avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    root.innerHTML = `<header class="page-head"><div><h1>🏃 Tests physiques</h1><p class="sub">${esc(t.name)} · ${esc(name)}${avg != null ? ` · moyenne ${fmtV(k, avg)} ${esc(unit)}` : ''}</p></div>
      <div class="head-actions"><a class="btn" href="#/equipes">${I.back}<span>Équipes</span></a><button class="btn" data-tt="import">${I.upload}<span>Importer (Excel, CSV)</span></button><button class="btn primary" data-tt="new">${I.plus}<span>Nouvelle séance de tests</span></button></div></header>
      <div class="row2"><label class="fld"><span>Équipe</span><select id="ttTeam">${teams.map(x => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${esc(Store.teamLabel(x))}</option>`).join('')}</select></label>
        <label class="fld"><span>Test</span><select id="ttTest">${LIST.map(([key, n, u]) => `<option value="${key}" ${key === k ? 'selected' : ''}>${esc(n)} (${u})</option>`).join('')}</select></label></div>
      <p class="muted small">${esc(def(k)[5])}</p>
      <section class="card"><h2>Classement</h2>${ranked.length ? `<div class="tt-rank">${ranked.map((x, i) => { const d = x.pr ? x.l.value - x.pr.value : null;
        return `<a href="#/joueur/${x.p.id}" class="${i < 3 ? 'top' : ''}"><span>${i + 1}. ${esc(Store.fullName(x.p))}</span><b>${fmtV(k, x.l.value)} ${esc(unit)}</b>${d ? `<i class="${better(k, x.l.value, x.pr.value) ? 'up' : 'down'}">${d > 0 ? '+' : ''}${fmtV(k, d)}</i>` : '<i></i>'}<em>${esc(UI.fmtDate(x.l.date, { day: 'numeric', month: 'short' }))}</em></a>`; }).join('')}</div>`
        : '<p class="muted">Pas encore de résultat pour ce test : « Nouvelle séance de tests » ou « Importer ».</p>'}</section>
      ${(k === 'vma' || k === 'vift') && ranked.length ? `<section class="card"><h2>⚡ Les allures de course (d'après le dernier test)</h2><p class="muted small">Pour préparer les exercices de course : chaque joueur court à son allure.</p>
        <div class="ss-table"><table><thead><tr><th>Joueur</th>${zones(k === 'vma' ? 15 : null, k === 'vift' ? 18 : null).map(z => `<th>${esc(z[0])}</th>`).join('')}</tr></thead>
        <tbody>${ranked.map(x => `<tr><td>${esc(Store.fullName(x.p))}</td>${zones(k === 'vma' ? +x.l.value : null, k === 'vift' ? +x.l.value : null).map(z => `<td>${esc(z[1])}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>` : ''}`;
    const redraw = () => page(root, t.id);
    $('#ttTeam', root).onchange = e => { location.hash = '#/tests/' + e.target.value; };
    $('#ttTest', root).onchange = e => { ui.test = e.target.value; Store.persistNow(); redraw(); };
    root.onclick = e => { const b = e.target.closest('[data-tt]'); if (!b) return;
      if (b.dataset.tt === 'new') return entry(t, k, ps, redraw);
      if (b.dataset.tt === 'import') return importFile(t, ps, redraw); };
  }
  // the whole team in one table: a value per player (empty = absent)
  function entry(t, k, ps, done) {
    const [, name, unit] = def(k);
    modal({ title: `${name} · ${t.name}`, noFocus: true, body: `<div class="row2"><label class="fld"><span>Test</span><select id="teK">${LIST.map(([key, n, u]) => `<option value="${key}" ${key === k ? 'selected' : ''}>${esc(n)} (${u})</option>`).join('')}</select></label>
      <label class="fld"><span>Date</span><input type="date" id="teD" value="${UI.today()}"></label></div>
      <p class="muted small">Laisse vide pour un joueur absent. Virgule ou point pour les décimales.</p>
      <div class="tt-entry">${ps.map(p => `<label><span>${esc(Store.fullName(p))}</span><input inputmode="decimal" data-pid="${p.id}" placeholder="${esc(unit)}"></label>`).join('')}</div>`,
      actions: [{ label: 'Annuler' }, { label: 'Enregistrer', kind: 'primary', onClick: (c, r) => {
        const kk = $('#teK', r).value, date = $('#teD', r).value || UI.today(); let n = 0;
        $$('[data-pid]', r).forEach(i => { const v = num(i.value); if (v == null) return; const p = Store.get('players', i.dataset.pid);
          p.tests = [...(p.tests || []).filter(x => !(x.test === kk && x.date === date)), { id: Store.uid(), test: kk, date, value: v }]; Store.upsert('players', p); n++; });
        if (!n) { toast('Aucun résultat saisi', 'err'); return false; }
        S().ui.tests.test = kk; toast(`${n} résultat${n > 1 ? 's' : ''} enregistré${n > 1 ? 's' : ''}`); done && done(); } }] });
  }

  /* ---------- import: Excel (.xlsx, .xls) or CSV, from another platform ---------- */
  let xlsxP = null;
  const loadXlsx = () => xlsxP || (xlsxP = new Promise((res, rej) => { if (window.XLSX) return res(); const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'; s.onload = res; s.onerror = () => { xlsxP = null; rej(new Error('Lecture Excel indisponible (connexion ?)')); }; document.head.appendChild(s); }));
  async function readTable(file) {
    if (/\.(csv|txt|tsv)$/i.test(file.name)) {
      const txt = await file.text(), sep = (txt.split('\n')[0].match(/;/g) || []).length > (txt.split('\n')[0].match(/,/g) || []).length ? ';' : txt.includes('\t') ? '\t' : ',';
      return txt.split(/\r?\n/).filter(l => l.trim()).map(l => l.split(sep).map(c => c.replace(/^"|"$/g, '').trim()));
    }
    await loadXlsx();
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' }).filter(r => r.some(c => String(c).trim()));
  }
  // a column name → the test it probably is
  const guess = h => { const x = norm(h);
    return /vma|vameval|45 ?15|leger|gacon/.test(x) ? 'vma' : /vift|30 ?15|ift/.test(x) ? 'vift' : /yo ?yo/.test(x) ? 'yoyo' : /cooper/.test(x) ? 'cooper'
      : /10 ?m/.test(x) && /sprint|vit|10 ?m/.test(x) ? 'sp10' : /20 ?m/.test(x) ? 'sp20' : /30 ?m/.test(x) ? 'sp30' : /cmj|detente|saut vert/.test(x) ? 'cmj'
      : /longueur/.test(x) ? 'sl' : /illinois|agilit/.test(x) ? 'illinois' : /t ?test/.test(x) ? 'ttest' : /jongl/.test(x) ? 'jongles' : /slalom|conduite/.test(x) ? 'conduite' : ''; };
  function findPlayer(ps, full, first, lastN) {
    const n = norm(full || `${first || ''} ${lastN || ''}`); if (!n) return null;
    const words = n.split(' ');
    return ps.find(p => norm(`${p.firstName} ${p.lastName}`) === n || norm(`${p.lastName} ${p.firstName}`) === n)
      || ps.find(p => words.includes(norm(p.lastName)) && words.includes(norm(p.firstName).split(' ')[0]))
      || null;
  }
  async function importFile(t, ps, done) {
    const f = (await UI.pickFiles({ accept: '.xlsx,.xls,.csv,.txt,.tsv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', multiple: false }))[0]; if (!f) return;
    let rows; const b = UI.busy('Lecture du fichier…'); try { rows = await readTable(f); } catch (e) { return toast(e.message || 'Fichier illisible', 'err'); } finally { b.done(); }
    if (rows.length < 2) return toast('Le fichier ne contient pas de lignes', 'err');
    const head = rows[0].map(String), body = rows.slice(1), allPs = S().players.filter(Auth.seesPerson);
    const col = re => head.findIndex(h => re.test(norm(h)));
    const map = { name: col(/^(nom complet|joueur|joueuse|nom et prenom|prenom nom|athlete|player|name)$/), last: col(/^(nom|last ?name)$/), first: col(/^(prenom|first ?name)$/), date: col(/date/) };
    const cols = head.map((h, i) => ({ i, h, test: guess(h) }));
    const body2 = () => { const mapped = body.map(r => findPlayer(allPs, map.name >= 0 ? r[map.name] : '', map.first >= 0 ? r[map.first] : '', map.last >= 0 ? r[map.last] : '')), ok = mapped.filter(Boolean).length;
      return `<p class="muted small">${esc(f.name)} · ${body.length} ligne${body.length > 1 ? 's' : ''}. Indique quelle colonne correspond à quoi, puis importe.</p>
      <div class="row2"><label class="fld"><span>Nom complet</span>${sel('name')}</label><label class="fld"><span>ou Nom</span>${sel('last')}</label><label class="fld"><span>et Prénom</span>${sel('first')}</label><label class="fld"><span>Date (sinon aujourd'hui)</span>${sel('date')}</label></div>
      <div class="lbl">Les colonnes de résultats</div><div class="tt-cols">${cols.filter(c => ![map.name, map.last, map.first, map.date].includes(c.i)).map(c => `<label><span>${esc(c.h || 'Colonne ' + (c.i + 1))}</span><select data-col="${c.i}"><option value="">(ignorer)</option>${LIST.map(([key, n, u]) => `<option value="${key}" ${c.test === key ? 'selected' : ''}>${esc(n)} (${u})</option>`).join('')}</select></label>`).join('')}</div>
      <p class="tt-match ${ok < body.length ? 'warn' : ''}">👥 ${ok} joueur${ok > 1 ? 's' : ''} reconnu${ok > 1 ? 's' : ''} sur ${body.length}${ok < body.length ? ` · pas trouvés : ${body.map((r, i) => mapped[i] ? null : esc((map.name >= 0 ? r[map.name] : `${r[map.first] || ''} ${r[map.last] || ''}`).trim() || '?')).filter(Boolean).slice(0, 8).join(', ')}` : ''}</p>`; };
    const sel = key => `<select data-map="${key}"><option value="-1">—</option>${head.map((h, i) => `<option value="${i}" ${map[key] === i ? 'selected' : ''}>${esc(h || 'Colonne ' + (i + 1))}</option>`).join('')}</select>`;
    modal({ title: 'Importer des résultats de tests', noFocus: true, body: `<div id="ttImp">${body2()}</div>`,
      onOpen: r => { r.querySelector('#ttImp').onchange = e => { if (e.target.dataset.map) { map[e.target.dataset.map] = +e.target.value; r.querySelector('#ttImp').innerHTML = body2(); } else if (e.target.dataset.col) { cols.find(c => c.i === +e.target.dataset.col).test = e.target.value; } }; },
      actions: [{ label: 'Annuler' }, { label: 'Importer', kind: 'primary', onClick: () => {
        const use = cols.filter(c => c.test && ![map.name, map.last, map.first, map.date].includes(c.i)); if (!use.length) { toast('Choisis au moins une colonne de résultats', 'err'); return false; }
        let n = 0, players = 0;
        body.forEach(row => {
          const p = findPlayer(allPs, map.name >= 0 ? row[map.name] : '', map.first >= 0 ? row[map.first] : '', map.last >= 0 ? row[map.last] : ''); if (!p) return;
          const dv = map.date >= 0 ? String(row[map.date] || '') : '', dm = dv.match(/(\d{4})-(\d{2})-(\d{2})/) || dv.match(/(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/);
          const date = dm ? (dm[1].length === 4 ? `${dm[1]}-${dm[2]}-${dm[3]}` : `${dm[3].length === 2 ? '20' + dm[3] : dm[3]}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`) : UI.today();
          let any = false;
          use.forEach(c => { const v = num(row[c.i]); if (v == null) return; p.tests = [...(p.tests || []).filter(x => !(x.test === c.test && x.date === date)), { id: Store.uid(), test: c.test, date, value: v, src: f.name.slice(0, 40) }]; n++; any = true; });
          if (any) { Store.upsert('players', p); players++; }
        });
        toast(`${n} résultat${n > 1 ? 's' : ''} importé${n > 1 ? 's' : ''} pour ${players} joueur${players > 1 ? 's' : ''}`); done && done(); } }] });
  }

  // the card on the player's page
  function card(p) {
    const ks = LIST.filter(t => results(p, t[0]).length); if (!ks.length) return '';
    const vma = last(p, 'vma'), vift = last(p, 'vift');
    return `<section class="card"><h2>🏃 Tests physiques</h2><div class="tt-cards">${ks.map(([k, n, u]) => { const r = results(p, k), l = r[r.length - 1], pr = r[r.length - 2];
      return `<div><span>${esc(n)}</span><b>${fmtV(k, l.value)} <small>${esc(u)}</small></b>${pr ? `<i class="${better(k, l.value, pr.value) ? 'up' : l.value === pr.value ? '' : 'down'}">${fmtV(k, pr.value)} avant</i>` : ''}<em>${esc(UI.fmtDate(l.date, { day: 'numeric', month: 'short', year: '2-digit' }))}</em></div>`; }).join('')}</div>
      ${vma || vift ? `<details><summary class="muted small">⚡ Ses allures de course</summary><div class="grid2x">${zones(vma && +vma.value, vift && +vift.value).map(z => `<span>${esc(z[0])}</span><b>${esc(z[1])}</b>`).join('')}</div></details>` : ''}
      ${(p.teamIds || [])[0] ? `<a class="linkish" href="#/tests/${p.teamIds[0]}">Tous les tests de l'équipe</a>` : ''}</section>`;
  }
  return { page, card, LIST, zones };
})();
