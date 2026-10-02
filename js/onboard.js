/* Onboard: the club's own settings on Clubbo — name, short name, crest, colours, town (weather), FFF name, slogan,
   and its categories. Shown once after the club is created (then Réglages → Le club), followed by the import of the club's data. */
const Onboard = (() => {
  const { esc, $, $$, toast, modal } = UI;
  const S = () => Store.state;
  const FOOT_CATS = ['École de foot', 'U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'U19', 'U20', 'Seniors', 'Vétérans', 'Féminines'];
  const catKey = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, '');
  const has = cat => S().teams.some(t => catKey(t.name) === catKey(cat) || catKey(t.category) === catKey(cat) && !/ [A-Z]$/.test(t.name));
  const CATS = () => Sport.isFoot() ? FOOT_CATS : [Sport.cur().school, ...Sport.cur().cats, 'Féminines'];
  const formatOf = cat => { if (!Sport.isFoot()) return Sport.cur().formatOfCat(cat); if (/^[ÉE]cole|^U[6-9]$/.test(cat)) return '5'; const n = +String(cat).slice(1); return cat[0] !== 'U' ? '11' : n <= 13 ? '8' : '11'; };

  // the crest: resized to 256 px (PNG, transparent background kept), about 30 KB, so it travels with the club's settings
  async function crestFrom(file) {
    const url = URL.createObjectURL(file), im = new Image(); im.src = url; await im.decode();
    const k = Math.min(1, 256 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
    c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
    let d = c.toDataURL('image/png'); if (d.length > 120000) d = c.toDataURL('image/jpeg', .85);
    return d;
  }
  async function geocode(city) {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=fr&countryCode=FR`);
    const x = ((await r.json()).results || [])[0]; return x ? { city: x.name, lat: x.latitude, lon: x.longitude } : null;
  }
  function form() {
    const c = S().club;
    return `<div class="ob-form"><div class="ob-s" data-obs="1"><div class="lbl">Le sport du club</div><div class="chips" id="obSport">${Sport.KEYS.map(k => `<button type="button" class="chip ${k === Sport.id() ? 'on' : ''}" data-sport="${k}">${Sport.SPORTS[k].icon} ${Sport.SPORTS[k].label}</button>`).join('')}</div>
      <div class="ob-crest"><img src="${esc(Supporters.crest())}" alt="Blason" id="obCrestImg"><label class="btn">🖼️<span>${c.crest ? 'Changer le blason' : 'Ajouter le blason'}</span><input type="file" accept="image/*" id="obCrest" hidden></label>
        ${c.crest ? '<button class="btn soft" id="obCrestDel">Retirer</button>' : ''}</div>
      <label class="fld"><span>Nom du club</span><input id="obName" value="${esc(c.name || '')}" maxlength="60"></label>
      <div class="row2"><label class="fld"><span>Nom court (« Allez … ! »)</span><input id="obShort" value="${esc(c.short || '')}" maxlength="20" placeholder="ex : Le FC"></label>
      <label class="fld"><span>Ville (météo des séances)</span><input id="obCity" value="${esc(c.city || '')}" maxlength="60" placeholder="ex : Montreuil"></label></div>
      <div class="row2"><label class="fld"><span>Couleur principale</span><input type="color" id="obC1" value="${esc(c.color1 || '#8c1024')}"></label>
      <label class="fld"><span>Couleur secondaire</span><input type="color" id="obC2" value="${esc(c.color2 || '#0e1d45')}"></label></div>
      <label class="fld"><span>Devise du club (facultatif, au dos du blason et sur le drapeau)</span><input id="obSlogan" value="${esc(c.slogan || '')}" maxlength="120" placeholder="ex : Un club, une famille"></label>
      <details ${Sport.isFoot() ? '' : 'hidden'}><summary class="muted small">Pour l'import des calendriers FFF (facultatif)</summary>
        <label class="fld"><span>Nom du club sur la FFF (tel qu'il apparaît dans les calendriers)</span><input id="obFff" value="${esc(c.fffName || '')}" placeholder="ex : FC EXEMPLE"></label>
        <label class="fld"><span>Page du club sur epreuves.fff.fr</span><input id="obFffUrl" value="${esc(c.fffUrl || '')}" placeholder="https://epreuves.fff.fr/competition/club/…"></label></details></div>
      <div class="ob-s" data-obs="2"><div class="lbl">Les catégories du club</div>
      <div class="chips" id="obCats">${CATS().map(k => `<button type="button" class="chip ${has(k) ? 'on' : ''}" data-cat="${esc(k)}" ${has(k) ? 'disabled title="Déjà créée"' : ''}>${esc(k)}</button>`).join('')}</div>
      <label class="switch"><input type="checkbox" id="obAB"><span>Créer aussi des équipes A et B dans les catégories choisies</span></label></div></div>`;
  }
  function bind(r) {
    let crest = S().club.crest || '';
    $('#obCrest', r).onchange = async e => { const f = e.target.files[0]; if (!f) return; try { crest = await crestFrom(f); $('#obCrestImg', r).src = crest; } catch (x) { toast('Image illisible', 'err'); } };
    const del = $('#obCrestDel', r); if (del) del.onclick = () => { crest = ''; $('#obCrestImg', r).src = 'icons/ea-logo.png'; };
    $$('#obCats .chip:not([disabled])', r).forEach(b => b.onclick = () => b.classList.toggle('on'));
    // another sport: the courts, positions and categories change at once (the categories already created stay)
    $$('#obSport [data-sport]', r).forEach(b => b.onclick = async () => {
      const k = b.dataset.sport; if (k === Sport.id()) return;
      setSport(k); const keep = { name: $('#obName', r).value, short: $('#obShort', r).value, city: $('#obCity', r).value, slogan: $('#obSlogan', r).value };
      const host = $('#obSport', r).closest('.ob-form'); host.outerHTML = form(); if (r._obStep) r._obStep();
      $('#obName', r).value = keep.name; $('#obShort', r).value = keep.short; $('#obCity', r).value = keep.city; $('#obSlogan', r).value = keep.slogan;
      const again = bind(r); r._obSave = again; toast(`${Sport.cur().icon} Club de ${Sport.cur().label.toLowerCase()} : terrains, postes, catégories et scores changent (joueurs et matchs restent). Touche l'ancien sport pour revenir.`);
    });
    return async () => {
      const c = S().club, name = $('#obName', r).value.trim();
      if (name.length < 2) { toast('Écris le nom du club', 'err'); return false; }
      Object.assign(c, { name, short: $('#obShort', r).value.trim(), color1: $('#obC1', r).value, color2: $('#obC2', r).value, slogan: $('#obSlogan', r).value.trim(),
        fffName: $('#obFff', r).value.trim(), fffUrl: $('#obFffUrl', r).value.trim(), crest });
      const city = $('#obCity', r).value.trim();
      if (city && city !== c.city) { try { const g = await geocode(city); if (g) Object.assign(c, g); else { c.city = city; delete c.lat; delete c.lon; toast('Ville introuvable pour la météo', 'err'); } } catch (e) { c.city = city; } }
      if (!city) { delete c.city; delete c.lat; delete c.lon; }
      const ab = $('#obAB', r).checked;
      $$('#obCats .chip.on:not([disabled])', r).forEach(b => {
        const cat = b.dataset.cat, t = People.ageTeam(cat); if (!t.format) { t.format = formatOf(cat); Store.upsert('teams', t); }
        if (ab && cat !== Sport.cur().school && cat !== 'École de foot') ['A', 'B'].forEach(l => { const nm = cat + ' ' + l; if (!S().teams.some(x => catKey(x.name) === catKey(nm))) Store.upsert('teams', { id: 'cat-' + catKey(nm), name: nm, category: cat, format: formatOf(cat) }); });
      });
      Store.sortTeams(); Store.save(); App.refreshChrome();
      return true;
    };
  }
  function setSport(k) {
    const c = S().club; c.sport = k; Sport.apply();
    if (k !== 'foot') ['teams', 'schemas', 'trainings', 'matches', 'players'].forEach(col => S()[col].filter(x => x.example).forEach(x => Store.remove(col, x.id)));
    S().teams.forEach(t => { if (Sport.sportOfFormat(t.format) !== k || !t.format) { t.format = formatOf(t.category || t.name); Store.upsert('teams', t); } });
    Store.save(); App.refreshChrome();
  }
  // the whole club, in one window (Réglages → Le club)
  function edit(done) {
    let save;
    modal({ title: '🏟️ Le club', noFocus: true, body: form(), onOpen: r => { save = bind(r); r._obSave = save; },
      actions: [{ label: 'Annuler' }, { label: 'Enregistrer', kind: 'primary', onClick: (close, r) => { (r._obSave || save)().then(ok => { if (ok) { close(); toast('Club enregistré'); done && done(); App.route(true); } }); return false; } }] });
  }
  // just after the club is created: 3 steps — the club, its teams, its coaches (everything can be changed later in Réglages → Le club)
  function start() {
    let n = 1;
    const LEAD = { 1: () => `Le nom, le sport et les couleurs de <b>${esc(S().club.name || 'ton club')}</b>.`, 2: () => 'Coche les catégories du club : elles sont créées tout de suite. Les joueurs viendront ensuite.',
      3: () => 'Invite les coachs : ils reçoivent un lien, choisissent leur nom et créent leur mot de passe. Tu peux aussi importer tes joueurs et tes matchs.' };
    const close = modal({ title: 'Bienvenue sur Clubbo 👋', noFocus: true,
      body: `<div class="ob-prog"><span data-p="1">1 · Le club</span><span data-p="2">2 · Les équipes</span><span data-p="3">3 · Les coachs</span></div>
        <p class="lead" id="obLead"></p>${form()}
        <div class="ob-s" data-obs="3"><div class="ob-three">
          <button class="quick-item" data-ob3="invite"><b>📲</b><span>Inviter les coachs</span><small>Un lien à envoyer sur WhatsApp</small></button>
          <button class="quick-item" data-ob3="players"><b>👥</b><span>Mes joueurs</span><small>Photo d'une liste, PDF, Excel</small></button>
          <button class="quick-item" data-ob3="matches"><b>${Sport.cur().icon}</b><span>Mes matchs</span><small>Le calendrier de la saison</small></button>
          <button class="quick-item" data-ob3="staff"><b>🧢</b><span>Mes éducateurs</span><small>La liste des coachs</small></button></div>
          <p class="muted small">Tout se retrouve plus tard dans Réglages.</p></div>
        <div class="ob-nav"><button class="btn" id="obBack" type="button">Retour</button><button class="btn primary" id="obNext" type="button">Suivant</button></div>`,
      onOpen: r => {
        r._obSave = bind(r);
        const show = () => {
          r.querySelectorAll('[data-obs]').forEach(x => { x.hidden = +x.dataset.obs !== n; });
          r.querySelectorAll('[data-p]').forEach(x => { x.classList.toggle('on', +x.dataset.p === n); x.classList.toggle('done', +x.dataset.p < n); });
          $('#obLead', r).innerHTML = LEAD[n](); $('#obBack', r).hidden = n === 1; $('#obNext', r).textContent = n === 3 ? 'Terminer' : 'Suivant';
          const sc = r.closest('.modal-card') || r; sc.scrollTop = 0;
        };
        r._obStep = show; show();
        $('#obBack', r).onclick = () => { n = Math.max(1, n - 1); show(); };
        $('#obNext', r).onclick = async () => {
          if (n === 1) { if ($('#obName', r).value.trim().length < 2) return toast('Écris le nom du club', 'err'); n = 2; return show(); }
          if (n === 2) { if (!(await r._obSave())) return; App.route(true); n = 3; return show(); }
          close(); App.route(true); toast('Ton club est prêt 🎉');
        };
        r.querySelectorAll('[data-ob3]').forEach(b => b.onclick = () => {
          const k = b.dataset.ob3; close(); App.route(true);
          setTimeout(() => k === 'invite' ? Cloud.shareInvite(false) : Imports.open(k, () => setTimeout(importStep, 300)), 200);
        });
      },
      actions: [{ label: 'Plus tard' }] });
  }
  function importStep() {
    modal({ title: '📥 Les données du club', noFocus: true,
      body: `<p>Importe tes <b>joueurs</b>, tes <b>matchs</b> et tes <b>éducateurs</b> : une photo ou une capture d'écran d'une liste, un PDF (${Sport.isFoot() ? 'Footclubs, calendrier du district' : 'liste de la fédération, calendrier'}), un fichier Excel ou CSV, ou un texte copié.</p>
        <div class="chips"><button class="btn primary" data-ob="players">👥<span>Mes joueurs</span></button><button class="btn" data-ob="matches">${Sport.cur().icon}<span>Mes matchs</span></button><button class="btn" data-ob="staff">🧢<span>Mes éducateurs</span></button></div>
        <p class="muted small">Ensuite : Réglages → Inviter les éducateurs, et Codes personnels pour les joueurs et les parents.</p>`,
      onOpen: r => $$('[data-ob]', r).forEach(b => b.onclick = () => { const k = b.dataset.ob; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); setTimeout(() => Imports.open(k, () => setTimeout(importStep, 300)), 150); }),
      actions: [{ label: 'Terminer' }] });
  }
  // Réglages: the club's card
  function card() {
    const c = S().club;
    return `<section class="card ob-card"><h2>🏟️ Le club</h2>
      <div class="ob-sum"><img src="${esc(Supporters.crest())}" alt=""><div><b>${esc(c.name || 'Mon club')}</b><span class="muted small">${[Sport.cur().icon + ' ' + Sport.cur().label, c.city, c.slogan].filter(Boolean).map(esc).join(' · ') || 'Blason, couleurs, ville, catégories…'}</span></div></div>
      <div class="chips"><button class="btn primary" data-ob="edit">${I.edit}<span>Modifier le club</span></button><button class="btn" data-ob="import">📥<span>Importer des données</span></button></div></section>`;
  }
  function onClick(e, redraw) {
    const b = e.target.closest('[data-ob]'); if (!b) return false;
    if (b.dataset.ob === 'edit') edit(redraw);
    if (b.dataset.ob === 'import') Imports.open('players', redraw);
    return true;
  }
  return { start, edit, card, onClick, importStep, setSport };
})();
