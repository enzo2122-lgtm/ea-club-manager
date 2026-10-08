/* Parents: the public page of a category (secret link, read only), the parents' answers to a convocation,
   and the car sharing for away matches. The page for the parents is parents.html (js/parents-page.js).
   Only first names and the initial of the last name leave the club's data: never a birth date, a phone or an address. */
const Parents = (() => {
  const { esc, $, $$, toast, modal, fmtDate, today } = UI;
  const S = () => Store.state;
  const short = p => p ? (p.firstName || '') + (p.lastName ? ' ' + p.lastName[0].toUpperCase() + '.' : '') : '';
  const catKey = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, '');
  const hh = x => String(x || '').replace(':', 'h');

  /* ---------- the link of a category (the category and its teams A / B share one page) ---------- */
  function family(teamId) {
    const t = Store.get('teams', teamId); if (!t) return null;
    const key = catKey(t.category || t.name), ids = S().teams.filter(x => catKey(x.category || x.name) === key).map(x => x.id);
    const base = S().teams.find(x => catKey(x.name) === key);
    return { key, ids: ids.length ? ids : [t.id], name: base ? base.name : (t.category || t.name) };
  }
  const familyName = id => (family(id) || {}).name || '';
  // Explanation shown when the server has not been updated yet (3.8 functions missing)
  const needUpdate = e => e && e.code === 'MISE_A_JOUR'
    ? 'Le serveur Clubbo est en cours de mise à jour : réessaie dans quelques minutes.' : (e && e.message) || 'Erreur';
  // (3.42) The pages of the players and of the parents are opened with each licensee's personal code: the category has a QR code
  // that leads to the page where the code is typed, and the codes are handed out from « Codes personnels ».
  function shareDialog(teamId) {
    if (!Cloud.ready()) return toast('Il faut être connecté au serveur du club', 'err');
    const t = Store.get('teams', teamId); if (!t) return;
    Codes.qrDialog('cat', t);
  }
  const sharePlayers = shareDialog;
  // Card on a category page
  function teamCard(t) {
    return `<section class="card parents-card"><div class="row-head"><h2>${I.team}Espace joueurs et parents</h2>
      <div class="chips"><a class="btn primary" href="#/codes/${t.id}">🔑<span>Codes personnels</span></a><button class="btn soft" data-parents="${t.id}">📱<span>QR code de la catégorie</span></button></div></div>
      <p class="muted small">Chaque licencié a son code : il ouvre sa page (convocations, présent / absent, temps de jeu, covoiturage, causerie du match) et seulement la sienne. Remets les codes, coche « Remis », et suis qui a activé son espace.</p></section>`;
  }

  /* ---------- answers to a convocation (on the match page) ---------- */
  const cache = {}; // matchId → { at, rows: { playerId: row } }
  async function loadAnswers(m, force) {
    const c = cache[m.id];
    if (!force && c && Date.now() - c.at < 15000) return c;
    const rows = await Cloud.answers([m.id]) || [];
    return (cache[m.id] = { at: Date.now(), rows: Object.fromEntries(rows.map(r => [r.player_id, r])) });
  }
  const isOpen = m => !m.played && !m.exempt && m.date >= today();
  /* ---------- (2.26) who saw the convocation or the session: answered / seen without answering / app not opened / code never used ---------- */
  const seenCache = {};
  async function fetchSeen(ids, then) {
    if (!Cloud.ready() || !Cloud.seen) return;
    try { const d = await Cloud.seen(ids) || {}; ids.forEach(id => { seenCache[id] = { who: (d.seen || {})[id] || {}, codes: d.codes || {} }; }); then && then(); } catch (e) { /* an old server: no line */ }
  }
  function seenHtml(ids, players, answered) {
    const c = ids.map(id => seenCache[id]).filter(Boolean); if (!c.length || !players.length) return '';
    const who = Object.assign({}, ...c.map(x => x.who)), codes = c[0].codes, ok = [], vu = [], pasLu = [], sans = [];
    players.forEach(p => { if (answered.has(p.id)) ok.push(p); else if (who[p.id]) vu.push(p); else if ((codes[p.id] || {}).first) pasLu.push(p); else sans.push(p); });
    const names = l => l.map(p => esc(Store.shortName(p))).join(', ') || '–';
    return `<details class="seen"><summary>👁️ Qui a vu : <b class="ans-yes">✅ ${ok.length} ont répondu</b> · 👀 ${vu.length} vu sans répondre · 😴 ${pasLu.length} pas ouvert · 📵 ${sans.length} sans l'appli</summary>
      <p class="small">👀 <b>Vu, pas répondu :</b> ${names(vu)}<br>😴 <b>Pas ouvert l'appli :</b> ${names(pasLu)}${pasLu.length ? ' → une relance WhatsApp' : ''}<br>📵 <b>Jamais utilisé leur code :</b> ${names(sans)}${sans.length ? ' → leur remettre le code (page Codes)' : ''}</p></details>`;
  }
  function drawAnswers(box, m, conv, err) {
    const c = cache[m.id], rows = (c && c.rows) || {};
    // (1.73) the players not (yet) called up who said « dispo / pas dispo »: the coach chooses who is called up
    const convIds = new Set(conv.map(p => p.id)), dispo = Object.values(rows).filter(r => !convIds.has(r.player_id) && Store.get('players', r.player_id));
    const dy = dispo.filter(r => r.status === 'oui').map(r => Store.get('players', r.player_id)), dn = dispo.filter(r => r.status === 'non');
    if (m.exempt || !conv.length || (!isOpen(m) && !Object.keys(rows).length)) { box.innerHTML = ''; return; }
    const dispoHtml = dispo.length ? `<div class="dispo-box"><h4>🙋 Disponibilités annoncées${conv.length ? ' (pas convoqués)' : ''}</h4>
      <p class="ans-sum"><span class="ans-yes">✓ ${dy.length} dispo</span> · <span class="ans-no">✗ ${dn.length} pas dispo</span></p>
      ${dy.length ? `<div class="chips">${dy.map(p => `<span class="chip ans-chip ans-oui"><b class="ans ans-yes">✓</b><span>${esc(Store.shortName(p))}</span></span>`).join('')}</div>` : ''}
      ${dn.length ? `<p class="small ans-why">${dn.map(r => `✗ <b>${esc(Store.shortName(Store.get('players', r.player_id)))}</b>${r.note ? ' · ' + esc(r.note) : ''}`).join('<br>')}</p>` : ''}
      ${isOpen(m) && dy.length ? `<button class="btn primary" data-convoke>${I.check}<span>Convoquer ${dy.length > 1 ? 'les ' + dy.length + ' disponibles' : 'le disponible'}</span></button>
        <p class="muted small">Ils sont ajoutés aux convoqués ; ensuite, « Envoyer la convocation » comme d'habitude.</p>` : ''}</div>` : '';
    const yes = conv.filter(p => (rows[p.id] || {}).status === 'oui'), no = conv.filter(p => (rows[p.id] || {}).status === 'non');
    const mark = p => { const r = rows[p.id]; return r ? (r.status === 'oui' ? '<b class="ans ans-yes">✓</b>' : '<b class="ans ans-no">✗</b>') : '<b class="ans">?</b>'; };
    box.innerHTML = `<section class="card answers">
      <div class="row-head"><h3>Réponses des joueurs et des parents</h3><button class="btn soft" data-parents="${m.teamId}">${I.share}<span>Lien des parents</span></button></div>
      ${err ? `<p class="tip">${esc(err)}</p>` : !Cloud.ready() ? '<p class="muted small">Les réponses arrivent quand l\'appli est connectée au serveur du club.</p>' : `
      ${!conv.length ? '' : `
      <p class="ans-sum"><span class="ans-yes">✓ ${yes.length} présent${yes.length > 1 ? 's' : ''}</span> · <span class="ans-no">✗ ${no.length} absent${no.length > 1 ? 's' : ''}</span> · <span>? ${conv.length - yes.length - no.length} sans réponse</span></p>
      <div class="chips ans-list">${conv.map(p => { const r = rows[p.id];
        return `<button class="chip ans-chip ${r ? 'ans-' + r.status : ''}" data-ans="${p.id}" ${isOpen(m) ? '' : 'disabled'} title="${r ? (r.by_coach ? 'Noté par un coach' : 'Réponse du parent') : 'Pas de réponse'}">${mark(p)}<span>${esc(Store.shortName(p))}</span>${r && r.seats && r.status === 'oui' && !m.home ? ` <i class="muted">🚗 ${r.seats}</i>` : ''}${r && r.note ? ` <i class="muted">« ${esc(r.note)} »</i>` : ''}</button>`; }).join('')}</div>
      ${no.length ? `<p class="small ans-why">${no.map(p => `✗ <b>${esc(Store.shortName(p))}</b>${rows[p.id].note ? ' · ' + esc(rows[p.id].note) : ''}`).join('<br>')}</p>` : ''}
      ${seenHtml([m.id], conv, new Set(Object.keys(rows)))}
      ${isOpen(m) && conv.length - yes.length - no.length > 0 ? `<button class="btn soft" data-remind>${I.chat}<span>Relancer les ${conv.length - yes.length - no.length} sans réponse</span></button>` : ''}
      <p class="muted small">${isOpen(m) ? 'Un parent a répondu par téléphone ? Touche le prénom : présent → absent → pas de réponse.' : 'Match passé : les réponses sont fermées.'}</p>`}`}</section>`;
  }

  // A ready WhatsApp message for the parents who haven't answered yet
  async function remind(m, conv) {
    const rows = (cache[m.id] || {}).rows || {}, missing = conv.filter(p => !rows[p.id]);
    if (!missing.length) return toast('Tout le monde a répondu 👍');
    const url = Codes.catUrl(familyName(m.teamId)); // the category's page: each family types its personal code
    const t = Store.get('teams', m.teamId);
    const text = [`⚽ *${S().club.name}${t ? ' · ' + t.name : ''}* – match ${m.home ? 'contre' : 'chez'} ${m.opponent || '?'}, ${fmtDate(m.date, { weekday: 'long', day: 'numeric', month: 'long' })}`, '',
      `Nous attendons encore la réponse pour : ${missing.map(short).join(', ').replace(/\.?$/, '.')}`, url ? `Merci de répondre présent ou absent ici (avec votre code personnel) : ${url}` : 'Merci de répondre présent ou absent au coach.'].join('\n');
    modal({ title: `Relancer (${missing.length})`, noFocus: true, body: `<p class="muted small">Message prêt pour le groupe WhatsApp des parents.</p><textarea id="rmTxt" rows="8">${esc(text)}</textarea>`,
      actions: [{ label: 'Copier', icon: I.copy, onClick: (c, r) => { navigator.clipboard.writeText($('#rmTxt', r).value).then(() => toast('Message copié')).catch(() => toast('Sélectionne le texte et copie-le')); return false; } },
        { label: 'WhatsApp', kind: 'primary', icon: I.share, onClick: (c, r) => { window.open('https://wa.me/?text=' + encodeURIComponent($('#rmTxt', r).value), '_blank'); return false; } }] });
  }

  /* ---------- car sharing (away matches) ---------- */
  function carText(m) {
    const t = Store.get('teams', m.teamId), cars = m.carpool || [], kids = (m.convoked || []).map(id => Store.get('players', id)).filter(Boolean);
    const inCar = new Set(cars.flatMap(c => c.kids || []));
    const alone = kids.filter(p => !inCar.has(p.id));
    return [`🚗 *Covoiturage${t ? ' ' + t.name : ''}* – match à ${m.opponent || '?'}, ${fmtDate(m.date, { weekday: 'long', day: 'numeric', month: 'long' })}`, '',
      ...cars.map(c => `• *${c.driver || 'Voiture'}*${c.time ? ' – départ ' + hh(c.time) : ''}${c.from ? ' (' + c.from + ')' : ''} : ${(c.kids || []).map(id => short(Store.get('players', id))).filter(Boolean).join(', ') || 'places libres'} (${(c.kids || []).length}/${c.seats || '?'})`),
      ...(alone.length ? ['', `Sans voiture pour l'instant : ${alone.map(short).join(', ')}`] : []), '', 'Merci aux parents conducteurs ! 🙏'].join('\n');
  }
  function drawCarpool(box, m, conv) {
    const cars = m.carpool || [], c = cache[m.id], rows = (c && c.rows) || {};
    const inCar = new Set(cars.flatMap(x => x.kids || [])), alone = conv.filter(p => !inCar.has(p.id));
    const offers = conv.filter(p => rows[p.id] && rows[p.id].status === 'oui' && rows[p.id].seats > 0 && !cars.some(x => x.fromPlayer === p.id));
    box.innerHTML = `<h2 class="section">${I.car}Covoiturage</h2><section class="card carpool">
      ${offers.length ? `<p class="tip">Proposent de conduire : ${offers.map(p => `<button class="linkish" data-cpoffer="${p.id}">Parent de ${esc(short(p))} (${rows[p.id].seats} place${rows[p.id].seats > 1 ? 's' : ''})</button>`).join(' · ')}<br><span class="muted small">Touche un nom pour créer sa voiture.</span></p>` : ''}
      ${cars.length ? cars.map(car => { const n = (car.kids || []).length, full = car.seats && n >= car.seats;
        return `<div class="car" data-car="${car.id}"><div class="car-head">${I.car}<b>${esc(car.driver || 'Voiture')}</b><span class="muted">${n}/${esc(car.seats || '?')} place${car.seats > 1 ? 's' : ''}${car.time ? ' · départ ' + esc(hh(car.time)) : ''}${car.from ? ' · ' + esc(car.from) : ''}</span>
          <span class="grow"></span><button class="icon-btn" data-cpedit="${car.id}" aria-label="Modifier la voiture">${I.edit}</button><button class="icon-btn danger" data-cpdel="${car.id}" aria-label="Supprimer la voiture">${I.trash}</button></div>
          <div class="chips">${(car.kids || []).map(id => Store.get('players', id)).filter(Boolean).map(p => `<span class="chip on">${esc(Store.shortName(p))}<button class="x" data-cpout="${car.id}|${p.id}" aria-label="Sortir ${esc(Store.shortName(p))} de la voiture">${I.x}</button></span>`).join('')}
          ${!full && alone.length ? `<select class="add-select" data-cpin="${car.id}" aria-label="Ajouter un enfant"><option value="">+ Ajouter un enfant…</option>${alone.map(p => `<option value="${p.id}">${esc(Store.shortName(p))}</option>`).join('')}</select>` : ''}</div></div>`; }).join('')
        : '<p class="muted">Pas encore de voiture. Ajoute les parents qui conduisent, puis range les enfants dans les voitures.</p>'}
      ${cars.length && alone.length ? `<p class="muted small">Sans voiture : ${alone.map(p => esc(Store.shortName(p))).join(', ')}</p>` : ''}
      <div class="chips"><button class="btn" data-cpnew>${I.plus}<span>Ajouter une voiture</span></button>${cars.length ? `<button class="btn primary" data-cpshare>${I.share}<span>Envoyer sur WhatsApp</span></button>` : ''}</div>
      <p class="muted small">Les voitures s'affichent aussi sur la page des parents.</p></section>`;
    const save = () => { Store.upsert('matches', m); drawCarpool(box, m, conv); };
    box.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-cpnew')) return editCar(m, null, save);
      if (b.dataset.cpedit) return editCar(m, cars.find(x => x.id === b.dataset.cpedit), save);
      if (b.dataset.cpdel) return UI.confirmBox('Supprimer cette voiture ? Les enfants redeviennent sans voiture.', 'Supprimer').then(ok => { if (ok) { m.carpool = cars.filter(x => x.id !== b.dataset.cpdel); save(); } });
      if (b.dataset.cpout) { const [cid, pid] = b.dataset.cpout.split('|'), car = cars.find(x => x.id === cid); if (car) { car.kids = (car.kids || []).filter(x => x !== pid); save(); } return; }
      if (b.dataset.cpoffer) {
        const p = Store.get('players', b.dataset.cpoffer), r = rows[b.dataset.cpoffer];
        m.carpool = [...cars, { id: Store.uid(), driver: 'Parent de ' + short(p), seats: r.seats, from: S().club.fieldName || '', time: defTime(m), kids: [p.id], fromPlayer: p.id }];
        return save();
      }
      if (b.hasAttribute('data-cpshare')) {
        const text = carText(m);
        return modal({ title: 'Envoyer le covoiturage', noFocus: true, body: `<textarea id="cpTxt" rows="10">${esc(text)}</textarea>`,
          actions: [{ label: 'Copier', icon: I.copy, onClick: (c, r) => { navigator.clipboard.writeText($('#cpTxt', r).value).then(() => toast('Copié')).catch(() => toast('Sélectionne le texte et copie-le')); return false; } },
            { label: 'WhatsApp', kind: 'primary', icon: I.share, onClick: (c, r) => { window.open('https://wa.me/?text=' + encodeURIComponent($('#cpTxt', r).value), '_blank'); return false; } }] });
      }
    };
    box.onchange = e => {
      const s = e.target.closest('[data-cpin]'); if (!s || !s.value) return;
      const car = cars.find(x => x.id === s.dataset.cpin); if (!car) return;
      m.carpool.forEach(x => { x.kids = (x.kids || []).filter(id => id !== s.value); });
      car.kids = [...(car.kids || []), s.value]; save();
    };
  }
  // Departure: 45 minutes before the meeting time (or the kick-off)
  function defTime(m) {
    const t = m.rdv || m.time; if (!t) return '';
    const [h, mi] = t.split(':').map(Number), d = h * 60 + mi - 45;
    return d > 0 ? `${String(Math.floor(d / 60)).padStart(2, '0')}:${String(d % 60).padStart(2, '0')}` : t;
  }
  function editCar(m, car, done) {
    const isNew = !car;
    car = car || { id: Store.uid(), driver: '', seats: 3, from: S().club.fieldName || '', time: defTime(m), kids: [] };
    modal({ title: isNew ? 'Nouvelle voiture' : 'Voiture', body: `
      <label class="fld"><span>Conducteur (visible par les parents)</span><input id="cDriver" value="${esc(car.driver)}" placeholder="ex : Maman de Lucas" maxlength="40"></label>
      <div class="row3"><label class="fld"><span>Places pour les enfants</span><input id="cSeats" type="number" min="1" max="8" inputmode="numeric" value="${esc(car.seats)}"></label>
      <label class="fld"><span>Départ</span><input id="cTime" type="time" value="${esc(car.time || '')}"></label>
      <label class="fld"><span>Lieu de départ</span><input id="cFrom" value="${esc(car.from || '')}" placeholder="ex : parking du stade" maxlength="60"></label></div>
      <p class="muted small">N'écris pas de numéro de téléphone ici : cette information s'affiche sur la page des parents.</p>`,
      actions: [{ label: 'Annuler' }, { label: 'Enregistrer', kind: 'primary', onClick: (c, r) => {
        const v = id => $('#' + id, r).value.trim();
        if (!v('cDriver')) { toast('Écris le nom du conducteur', 'err'); return false; }
        Object.assign(car, { driver: v('cDriver'), seats: Math.max(1, Math.min(8, +v('cSeats') || 1)), time: v('cTime'), from: v('cFrom') });
        if (isNew) m.carpool = [...(m.carpool || []), car];
        done();
      } }] });
  }

  /* ---------- photos of the match for the parents' page ---------- */
  const phCache = {}; // photo id → data URL (miniature)
  async function drawPhotos(box, m) {
    let list;
    try { list = await Cloud.photos(m.id) || []; }
    catch (e) { box.innerHTML = e.code === 'MISE_A_JOUR' ? '' : `<p class="muted small">${esc(e.message)}</p>`; return; }
    if (!box.isConnected) return;
    const noImg = (m.convoked || []).map(id => Store.get('players', id)).filter(p => p && ClubAdmin.noImage(p));
    box.innerHTML = `<section class="card"><div class="row-head"><h2>${I.image}Photos pour les parents (${list.length})</h2><button class="btn" data-phadd>${I.plus}<span>Choisir des photos</span></button></div>
      <p class="muted small">Ces photos apparaissent sur la page des parents de la catégorie. Elles sont effacées du serveur au bout de 90 jours.</p>
      ${noImg.length ? `<p class="tip">📵 Droit à l'image refusé : <b>${noImg.map(p => esc(Store.shortName(p))).join(', ')}</b>. Ne partage pas de photo où on les reconnaît.</p>` : ''}
      <div class="gallery">${list.map(x => `<button class="thumb-btn" data-phdel="${x.id}" aria-label="Retirer cette photo">${phCache[x.id] ? `<img alt="" src="${phCache[x.id]}">` : `<span class="no-thumb">${I.image}</span>`}<span class="play-badge">${I.x}</span></button>`).join('') || '<p class="muted">Aucune photo partagée.</p>'}</div></section>`;
    list.filter(x => !phCache[x.id]).forEach(async x => { try { phCache[x.id] = await Cloud.photoGet(x.id); const b = box.querySelector(`[data-phdel="${x.id}"]`); if (b && phCache[x.id]) b.firstElementChild.outerHTML = `<img alt="" src="${phCache[x.id]}">`; } catch (e) {} });
    box.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.phdel) { if (await UI.confirmBox('Retirer cette photo de la page des parents ?', 'Retirer')) { try { await Cloud.photoDel(b.dataset.phdel); drawPhotos(box, m); } catch (err) { toast(err.message, 'err'); } } return; }
      if (b.hasAttribute('data-phadd')) return pickPhotos(box, m, list);
    };
  }
  async function pickPhotos(box, m, shared) {
    const mine = (await Media.list('match:' + m.id)).filter(x => x.kind === 'image'), done = new Set(shared.map(x => x.src));
    if (!mine.length) return toast('Ajoute d\'abord des photos dans « Photos et vidéos du match » (plus haut)', 'err');
    const close = modal({ title: 'Photos pour les parents', noFocus: true,
      body: `<p class="muted small">Touche les photos à montrer aux parents, puis « Partager ».</p><div class="gallery pick-photos">${mine.map(x => `<button class="thumb-btn ${done.has(x.id) ? 'on' : ''}" data-ph="${x.id}" ${done.has(x.id) ? 'disabled' : ''}><img alt="" src="${x.thumb}">${done.has(x.id) ? '<span class="play-badge">✓</span>' : ''}</button>`).join('')}</div>
        <label class="switch"><input type="checkbox" id="phOk"><span>Les enfants reconnaissables ont l'accord de leurs parents (droit à l'image)</span></label>`,
      onOpen: r => r.querySelectorAll('[data-ph]').forEach(b => b.onclick = () => b.classList.toggle('sel')),
      actions: [{ label: 'Annuler' }, { label: 'Partager', kind: 'primary', icon: I.share, onClick: (c, r) => {
        const ids = [...r.querySelectorAll('[data-ph].sel')].map(b => b.dataset.ph);
        if (!ids.length) { toast('Touche au moins une photo', 'err'); return false; }
        if (!r.querySelector('#phOk').checked) { toast('Coche la case sur le droit à l\'image', 'err'); return false; }
        (async () => {
          const bz = UI.busy('Envoi des photos…'); let n = 0;
          try {
            for (const id of ids) {
              const rec = await Media.get(id); if (!rec || !rec.blob) continue;
              const img = await Media.loadImage(URL.createObjectURL(rec.blob));
              let q = .72, data = Media.drawScaled(img, img.naturalWidth, img.naturalHeight, 1280).toDataURL('image/jpeg', q);
              while (data.length > 400000 && q > .35) { q -= .12; data = Media.drawScaled(img, img.naturalWidth, img.naturalHeight, 1024).toDataURL('image/jpeg', q); }
              await Cloud.photoAdd(m.id, id, data); n++;
            }
            toast(`${n} photo${n > 1 ? 's' : ''} partagée${n > 1 ? 's' : ''} avec les parents`);
          } catch (e) { toast(needUpdate(e), 'err'); } finally { bz.done(); close(); drawPhotos(box, m); }
        })();
        return false;
      } }] });
  }

  /* ---------- the match page ---------- */
  function mountMatch(root, m, conv) {
    const ab = $('#answersBox', root), cb = $('#carpoolBox', root), pb = $('#parentPhotos', root);
    if (cb) drawCarpool(cb, m, conv);
    if (pb) drawPhotos(pb, m);
    if (!ab) return;
    drawAnswers(ab, m, conv);
    ab.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.parents) return shareDialog(b.dataset.parents);
      if (b.dataset.players) return sharePlayers(b.dataset.players);
      if (b.hasAttribute('data-remind')) return remind(m, conv);
      if (b.hasAttribute('data-convoke')) {
        const rows = (cache[m.id] || {}).rows || {}, ids = Object.values(rows).filter(r => r.status === 'oui' && Store.get('players', r.player_id)).map(r => r.player_id);
        m.convoked = [...new Set([...(m.convoked || []), ...ids])]; Store.upsert('matches', m);
        toast('Ajoutés aux convoqués : envoie la convocation quand tu es prêt'); return App.route(true);
      }
      if (b.dataset.ans) {
        const c = cache[m.id] = cache[m.id] || { at: 0, rows: {} }, cur = c.rows[b.dataset.ans], next = !cur ? 'oui' : cur.status === 'oui' ? 'non' : '';
        try {
          await Cloud.setAnswer(m.id, b.dataset.ans, next);
          if (next) c.rows[b.dataset.ans] = Object.assign({}, cur, { status: next, by_coach: true }); else delete c.rows[b.dataset.ans];
          drawAnswers(ab, m, conv);
        } catch (err) { toast(needUpdate(err), 'err'); }
      }
    };
    if (!Cloud.ready() || m.exempt) return;
    fetchSeen([m.id], () => { if (ab.isConnected) drawAnswers(ab, m, conv); });
    loadAnswers(m).then(() => {
      if (ab.isConnected) drawAnswers(ab, m, conv);
      if (cb && cb.isConnected) drawCarpool(cb, m, conv);
    }).catch(e => { if (ab.isConnected) drawAnswers(ab, m, conv, e.code === 'MISE_A_JOUR' ? needUpdate(e) : ''); });
  }

  /* ---------- (3.65) the answers of the players and parents to a session (présent / absent and why) ---------- */
  // (1.68) the training group of a session (« Groupe Gianni »): written by the coach, or the first name of its first coach (or of who made it)
  const trGroup = t => { if (t.group && t.group.trim()) return t.group.trim(); const st = Store.get('staff', (t.staffIds || [])[0] || t.by || ''); return st ? 'Groupe ' + (st.firstName || st.lastName || '') : ''; };
  // (1.69) the day of a session: its sessions (one per training group), the answers of the day (one per player, the latest), the squad
  const daySessions = t => Store.state.trainings.filter(x => !x.model && x.teamId === t.teamId && x.date === t.date);
  const squadOf = teamId => { const own = Store.playersOf(teamId); return own.length ? own : Store.rosterOf(teamId); };
  const latest = rows => { const last = {}; (rows || []).forEach(r => { if (!last[r.player_id] || String(r.at || '') > String(last[r.player_id].at || '')) last[r.player_id] = r; }); return Object.values(last); };
  function dayStats(t, rows) {
    const ids = new Set(daySessions(t).map(x => x.id).concat(t.id)), sq = squadOf(t.teamId), inSq = new Set(sq.map(p => p.id));
    const l = latest(rows.filter(r => ids.has(r.match_id) && inSq.has(r.player_id)));
    const yes = l.filter(r => r.status === 'oui').length, no = l.filter(r => r.status === 'non').length, total = sq.length;
    return { yes, no, none: Math.max(0, total - yes - no), total, pct: total ? Math.round(yes * 100 / total) : 0 };
  }
  const statsLine = s => `<span class="ans-yes">✓ ${s.yes} présent${s.yes > 1 ? 's' : ''}</span> · <span class="ans-no">✗ ${s.no} absent${s.no > 1 ? 's' : ''}</span> · <span class="muted">${s.none} sans réponse</span> · <b>${s.pct} % de présence</b>`;
  // the list of the sessions: the answers of each day on its sessions (one request for all)
  async function dayBadges(root, list) {
    if (!Cloud.ready() || !list.length) return;
    const ids = [...new Set(list.flatMap(t => daySessions(t).map(x => x.id).concat(t.id)))].slice(0, 200);
    let rows = []; try { rows = await Cloud.answers(ids) || []; } catch (e) { return; }
    list.forEach(t => { const el = root.querySelector(`[data-trans="${t.id}"]`); if (!el || !t.teamId) return; const s = dayStats(t, rows);
      if (s.yes || s.no) el.innerHTML = `✓ ${s.yes} · ✗ ${s.no} · ${s.pct} %`; });
  }
  /* (1.75) who said « dispo » (match) or « présent » (training day): the coach sees them as they answer.
     null without the club server (then every player is shown); { ready: false, wait } while loading. */
  const dcache = {};
  function dispoOf(key, ids) {
    if (!Cloud.ready()) return null;
    const c = dcache[key] = dcache[key] || {};
    if (!c.p && (!c.v || Date.now() - c.at > 20000)) c.p = Cloud.answers(ids).then(rows => {
      const l = latest(rows || []); c.v = { ready: true, yes: new Set(l.filter(r => r.status === 'oui').map(r => r.player_id)), no: new Map(l.filter(r => r.status === 'non').map(r => [r.player_id, r.note || ''])) };
    }).catch(() => { c.v = c.v || { ready: true, yes: new Set(), no: new Map() }; }).then(() => { c.at = Date.now(); c.p = null; });
    return c.v || { ready: false, wait: c.p };
  }
  const matchDispo = m => m.exempt ? null : dispoOf('m:' + m.id, [m.id]);
  const trainingDispo = t => !t.teamId || t.model ? null : dispoOf('d:' + t.teamId + ':' + t.date, daySessions(t).map(x => x.id).concat(t.id));
  // a phone number for WhatsApp: 06… → 336…
  const waNum = s => { let d = String(s || '').replace(/[^\d+]/g, ''); if (d.startsWith('+')) d = d.slice(1); else if (d.startsWith('00')) d = d.slice(2); else if (/^0\d{9}$/.test(d)) d = '33' + d.slice(1); return d.length >= 10 ? d : ''; };
  const phoneOf = p => [p.phone, ...(p.parents || []).map(x => x.phone)].map(waNum).find(Boolean) || '';
  // once the choice is made: a message for all the players not called up (a group) or one by one (WhatsApp, with his first name)
  function nonConvDialog(m, roster) {
    const D = matchDispo(m) || { yes: new Set(), no: new Map() }, conv = new Set(m.convoked || []), u = Auth.current && Auth.current();
    const list = roster.filter(p => !conv.has(p.id)).sort((a, b) => (D.yes.has(b.id) ? 1 : 0) - (D.yes.has(a.id) ? 1 : 0));
    const def = `Bonjour, pour le match ${m.home ? 'contre' : 'chez'} ${m.opponent || '?'} (${UI.fmtDate(m.date)}), tu n'es pas retenu cette fois. Continue à bien t'entraîner, ta chance va venir 💪${u ? ' Coach ' + (u.firstName || '') : ''}`;
    modal({ title: '📣 Prévenir les non-convoqués', noFocus: true,
      body: `<label class="fld"><span>Le message (modifie-le si tu veux)</span><textarea id="ncTxt" rows="4">${esc(def)}</textarea></label>
        <div class="chips">${Cloud.ready() ? `<button class="btn primary" data-ncnotif>🔔<span>Notifier tous dans l'appli</span></button>` : ''}<button class="btn soft" data-ncall>${I.share}<span>Groupe WhatsApp…</span></button><button class="btn soft" data-nccopy>Copier</button></div>
        <p class="muted small">La notification arrive sur le téléphone des joueurs et des parents qui l'ont activée dans leur espace. Pour les autres : WhatsApp.</p>
        <h3 class="sub-h">Joueur par joueur (${list.length})</h3>
        <div class="list">${list.map(p => { const tel = phoneOf(p); return `<div class="list-item" data-ncp="${esc(p.id)}"><div class="li-main"><b>${esc(Store.fullName(p))}</b><span class="muted small nc-st">${D.yes.has(p.id) ? '✓ était dispo' : D.no.has(p.id) ? '✗ pas dispo' : 'pas de réponse'}</span></div>
          <span class="chips">${Cloud.ready() ? `<button class="btn soft" data-ncone="${esc(p.id)}" data-fn="${esc(p.firstName || '')}" aria-label="Notifier dans l'appli">🔔</button>` : ''}${tel ? `<button class="btn soft" data-ncwa="${tel}" data-fn="${esc(p.firstName || '')}">WhatsApp</button>` : '<span class="muted small">pas de numéro</span>'}</span></div>`; }).join('') || '<p class="muted">Tout le monde est convoqué.</p>'}</div>`,
      onOpen: r => {
        const txt = () => r.querySelector('#ncTxt').value;
        // (1.76) the notification of the app; the result says who has it on (the others: WhatsApp)
        const t0 = Store.get('teams', m.teamId), title = `📣 ${t0 ? t0.name + ' · ' : ''}match ${m.home ? 'contre' : 'chez'} ${m.opponent || '?'}`;
        const mark = (ids, sent) => ids.forEach(id => { const row = r.querySelector(`[data-ncp="${id}"] .nc-st`); if (row) row.innerHTML = sent.includes(id) ? '<b class="ans-yes">🔔 prévenu dans l\'appli</b>' : '<b class="ans-no">notifications pas activées : WhatsApp</b>'; });
        const notify = async (ids, text, btn) => { btn.disabled = true;
          try { const res = await Cloud.memberNote(ids, title, text), sent = (res && res.sent) || []; mark(ids, sent); toast(`${sent.length} prévenu${sent.length > 1 ? 's' : ''} dans l'appli${ids.length - sent.length ? ` · ${ids.length - sent.length} sans notification (WhatsApp)` : ''}`); }
          catch (e) { toast(needUpdate(e), 'err'); } finally { btn.disabled = false; } };
        const nb = r.querySelector('[data-ncnotif]'); if (nb) nb.onclick = () => notify(list.map(p => p.id), txt(), nb);
        r.querySelectorAll('[data-ncone]').forEach(b => b.onclick = () => notify([b.dataset.ncone], b.dataset.fn ? txt().replace(/^Bonjour\b/, 'Bonjour ' + b.dataset.fn) : txt(), b));
        r.querySelector('[data-ncall]').onclick = () => { const t = txt(); if (navigator.share) navigator.share({ text: t }).catch(() => {}); else window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank'); };
        r.querySelector('[data-nccopy]').onclick = () => navigator.clipboard.writeText(txt()).then(() => toast('Message copié : colle-le dans WhatsApp ou un SMS')).catch(() => {});
        r.querySelectorAll('[data-ncwa]').forEach(b => b.onclick = () => { const t = b.dataset.fn ? txt().replace(/^Bonjour\b/, 'Bonjour ' + b.dataset.fn) : txt(); window.open('https://wa.me/' + b.dataset.ncwa + '?text=' + encodeURIComponent(t), '_blank'); b.textContent = '✓ Envoyé'; });
      },
      actions: [{ label: 'Fermer' }] });
  }
  async function mountTraining(box, tr, onPresent) {
    if (!box || !Cloud.ready() || !tr.teamId || tr.model) return;
    // (1.68) several sessions the same day for the same team (one per training group): the player answers once for the day,
    // the coaches put each player in his group (kept on the player: p.trGroup)
    const twins = Store.state.trainings.filter(t => t.id !== tr.id && !t.model && t.teamId === tr.teamId && t.date === tr.date);
    let rows = [];
    try { rows = await Cloud.answers([tr.id, ...twins.map(t => t.id)]) || []; } catch (e) { return; }
    if (!box.isConnected || !rows.length) return;
    const rowsAll = rows; rows = latest(rows);
    const pl = id => Store.get('players', id);
    const groups = twins.length ? [...new Set([tr, ...twins].map(trGroup).filter(Boolean))] : [], mine = trGroup(tr);
    const inMine = r => !groups.length || (pl(r.player_id).trGroup || '') === mine;
    const yesAll = rows.filter(r => r.status === 'oui' && pl(r.player_id)), yes = yesAll.filter(inMine), no = rows.filter(r => r.status === 'non' && pl(r.player_id));
    const draw = () => {
    const day = dayStats(tr, rowsAll);
    box.innerHTML = `<section class="card answers"><h3>Réponses des joueurs et des parents</h3>
      <p class="ans-day">${twins.length ? `Journée du ${esc(UI.fmtDate(tr.date))} (toutes les séances)` : 'Effectif'} : ${day.total} joueurs<br>${statsLine(day)}</p>
      ${groups.length ? `<p class="small">${groups.map(g => `<b>${esc(g)}</b> : ${yesAll.filter(r => (pl(r.player_id).trGroup || '') === g).length}`).join(' · ')} · <span class="muted">sans groupe : ${yesAll.filter(r => !groups.includes(pl(r.player_id).trGroup || '')).length}</span></p>` : ''}
      ${groups.length ? `<p class="small muted">${twins.length + 1} séances ce jour-là : chaque joueur répond une fois, et vous choisissez son groupe (il le garde les semaines suivantes).</p>
        <div class="ans-groups">${yesAll.map(r => { const p = pl(r.player_id), g = p.trGroup || ''; return `<div class="ans-grp-row"><b>${esc(Store.shortName(p))}</b><span class="chips">${groups.map(x => `<button class="chip small ${g === x ? 'on' : ''}" data-setgrp="${esc(x)}" data-p="${esc(p.id)}">${esc(x)}</button>`).join('')}</span></div>`; }).join('')}</div>` : ''}
      <p class="ans-sum"><span class="ans-yes">✓ ${yes.length} présent${yes.length > 1 ? 's' : ''} annoncé${yes.length > 1 ? 's' : ''}${groups.length ? ` (${esc(mine)})` : ''}</span> · <span class="ans-no">✗ ${no.length} absent${no.length > 1 ? 's' : ''}</span></p>
      ${no.length ? `<p class="small ans-why">${no.map(r => `✗ <b>${esc(Store.shortName(pl(r.player_id)))}</b>${r.note ? ' · ' + esc(r.note) : ''}`).join('<br>')}</p>` : ''}
      ${seenHtml([tr.id, ...twins.map(t => t.id)], Store.rosterOf(tr.teamId), new Set(rowsAll.map(r => r.player_id)))}
      ${yes.length ? `<button class="btn soft" data-ansfill>${I.check}<span>Cocher les ${yes.length} présents annoncés</span></button>` : ''}</section>`;
    const f = box.querySelector('[data-ansfill]'); if (f) f.onclick = () => onPresent(yes.map(r => r.player_id));
    box.querySelectorAll('[data-setgrp]').forEach(b => b.onclick = () => {
      const p = pl(b.dataset.p); p.trGroup = p.trGroup === b.dataset.setgrp ? '' : b.dataset.setgrp; Store.upsert('players', p);
      yes.length = 0; yesAll.filter(inMine).forEach(r => yes.push(r)); draw();
    });
    };
    draw();
    fetchSeen([tr.id, ...twins.map(t => t.id)], () => { if (box.isConnected) draw(); });
  }
  return { mountTraining, trGroup, dayBadges, matchDispo, trainingDispo, nonConvDialog, shareDialog, sharePlayers, teamCard, familyName, mountMatch, carText };
})();
