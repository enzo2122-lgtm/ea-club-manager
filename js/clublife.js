/* Club life: meetings, tournaments, lunches (each coach answers « je viens / je ne viens pas »), and reports of
   lost or broken things or organisation problems (photos, comments, status).
   Everything is kept in the shared « reports » collection (field `life`), so the club server shares it as it is.
   Answers and comments are items of their own: two coaches answering at the same time never erase each other. */
const ClubLife = (() => {
  const { esc, $, $$, toast, modal, confirmBox } = UI;
  const S = () => Store.state;
  const EV = { reunion: ['🗣️', 'Réunion'], tournoi: ['🏆', 'Tournoi'], repas: ['🍽️', 'Déjeuner / repas'], autre: ['🎉', 'Autre événement'] };
  const IS = { perdu: ['🔍', 'Objet perdu'], casse: ['💥', 'Matériel cassé'], orga: ['⚠️', 'Problème d\'organisation'], autre: ['💡', 'Autre'] };
  const ST = { open: ['Ouvert', 'st-open'], doing: ['En cours', 'st-doing'], done: ['Résolu', 'st-done'] };
  const MAX_PHOTOS = 3;
  const life = k => (S().reports || []).filter(x => x.life === k);
  const me = () => Auth.current();
  const who = id => { const s = id && Store.get('staff', id); return s ? Messages.coachName(s) : 'Un coach'; };
  const canEdit = x => Auth.isAdmin() || !!(me() && x.by === me().id);
  const today = () => UI.today();
  const fmt = d => UI.fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' });
  const short = t => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const rsvps = evId => life('rsvp').filter(r => r.eventId === evId);
  const myRsvp = evId => { const r = rsvps(evId).find(x => x.staffId === (me() || {}).id); return r ? r.v : ''; };
  const comments = id => life('comment').filter(c => c.issueId === id).sort((a, b) => a.at - b.at);
  const forWhom = x => (x.teamIds || []).length ? x.teamIds.map(id => (Store.get('teams', id) || {}).name).filter(Boolean).join(', ') : 'Tout le club';
  const when = x => `${fmt(x.date)}${x.start ? ' · ' + x.start + (x.end ? '–' + x.end : '') : ''}`;
  const byDate = (a, b) => (a.date + (a.start || '')).localeCompare(b.date + (b.start || ''));
  // Photos travel with the report: resized so they stay light on every phone
  async function photoData(file) {
    const url = URL.createObjectURL(file);
    try { const img = await Media.loadImage(url); return Media.drawScaled(img, img.naturalWidth, img.naturalHeight, 900).toDataURL('image/jpeg', .68); }
    finally { URL.revokeObjectURL(url); }
  }
  const announce = text => { if (Cloud.ready()) Cloud.post('general', text).catch(() => {}); };

  /* ---------- page ---------- */
  function page(root, tabParam) {
    const vol = Auth.volView(), tab = vol ? 'events' : tabParam === 'signalements' ? 'issues' : tabParam === 'evenements' ? 'events' : (S().ui.lifeTab || 'events');
    S().ui.lifeTab = tab;
    const openN = life('issue').filter(x => x.status !== 'done').length;
    root.innerHTML = `<header class="page-head"><div><h1>Vie du club</h1><p class="sub">Réunions, tournois, repas et signalements</p></div>
      <div class="head-actions"><a class="btn" href="#/benevoles">🙋<span>Bénévoles</span></a><a class="btn" href="#/arbitres">🟨<span>Arbitres</span></a>${vol ? '' : `<button class="btn primary" data-l="new">${I.plus}<span>${tab === 'events' ? 'Organiser' : 'Signaler'}</span></button>`}</div></header>
      <div class="seg" role="tablist" ${vol ? 'hidden' : ''}><button class="seg-b ${tab === 'events' ? 'on' : ''}" data-tab="events" role="tab">📅 Événements</button>
        <button class="seg-b ${tab === 'issues' ? 'on' : ''}" data-tab="issues" role="tab">🛠️ Signalements${openN ? ` <i class="seg-n">${openN}</i>` : ''}</button></div>
      <div class="life-list">${tab === 'events' ? eventsHtml() : issuesHtml()}</div>`;
    const again = () => page(root);
    root.onclick = e => {
      const b = e.target.closest('[data-rsvp],[data-tab],[data-l],[data-ev],[data-is]'); if (!b) return;
      if (b.dataset.rsvp) { setRsvp(b.dataset.for, b.dataset.rsvp, true); return again(); }
      if (b.dataset.tab) { S().ui.lifeTab = b.dataset.tab; Store.persistNow(); return again(); }
      if (b.dataset.l === 'new') return tab === 'events' ? editEvent(null, again) : editIssue(null, again);
      if (b.dataset.ev) return showEvent(b.dataset.ev, again);
      if (b.dataset.is) return showIssue(b.dataset.is, again);
    };
  }

  /* ---------- events ---------- */
  function eventCard(x) {
    const [ic, lab] = EV[x.kind] || EV.autre, rs = rsvps(x.id), yes = rs.filter(r => r.v === 'yes').length, no = rs.filter(r => r.v === 'no').length;
    const mine = myRsvp(x.id), past = x.date < today();
    return `<article class="life-card ${past ? 'past' : ''}" data-ev="${x.id}">
      <div class="life-ic">${ic}</div>
      <div class="life-main"><b>${esc(x.title || lab)}</b>
        <span>${esc(when(x))}${x.place ? ' · 📍 ' + esc(x.place) : ''}</span>
        <span class="muted small">${esc(lab)} · ${esc(forWhom(x))} · par ${esc(who(x.by))}</span>
        ${past ? `<span class="small">✅ ${yes} présent${yes > 1 ? 's' : ''}</span>` : `<div class="rsvp">
          <button class="chip ${mine === 'yes' ? 'on' : ''}" data-rsvp="yes" data-for="${x.id}">✅ Je viens${yes ? ' · ' + yes : ''}</button>
          <button class="chip ${mine === 'no' ? 'on no' : ''}" data-rsvp="no" data-for="${x.id}">❌ Je ne viens pas${no ? ' · ' + no : ''}</button></div>`}
      </div></article>`;
  }
  function eventsHtml() {
    const all = life('event').sort(byDate), next = all.filter(x => x.date >= today()), past = all.filter(x => x.date < today()).reverse().slice(0, 20);
    return (next.length ? next.map(eventCard).join('') : '<div class="empty"><p>Aucun événement prévu. Touche « Organiser » pour proposer une réunion, un tournoi ou un déjeuner.</p></div>')
      + (past.length ? `<details class="life-past"><summary>Événements passés (${past.length})</summary>${past.map(eventCard).join('')}</details>` : '');
  }
  // One answer per coach and per event; touching the same answer again removes it
  function setRsvp(evId, v, toggle) {
    const u = me(); if (!u) return;
    const id = 'rsvp-' + evId + '-' + u.id, cur = Store.get('reports', id);
    if (toggle && cur && cur.v === v) { Store.remove('reports', id); toast('Réponse retirée'); return; }
    Store.upsert('reports', { id, life: 'rsvp', eventId: evId, staffId: u.id, v, at: Date.now() });
    toast(v === 'yes' ? 'Noté : tu viens 👍' : 'Noté : tu ne viens pas');
  }
  async function bookPitch(x) {
    if (!Cloud.ready()) return toast('Serveur non connecté : terrain non réservé', 'err');
    if (!x.start || !x.end) return toast('Indique le début et la fin pour réserver le terrain', 'err');
    const m = t => +t.slice(0, 2) * 60 + +t.slice(3, 5), u = me();
    try {
      await Cloud.book({ date: x.date, start_min: m(x.start), end_min: m(x.end), field: 'T1', part: 'full', kind: 'autre', team_id: null, team_name: x.title, author_id: u.id, author_name: Store.fullName(u), note: EV[x.kind][1], series: null });
      toast('Grand terrain réservé');
    } catch (e) { toast('Terrain non réservé : ' + e.message, 'err'); }
  }
  function editEvent(x, done) {
    const isNew = !x;
    x = x || { id: Store.uid(), life: 'event', kind: 'reunion', title: '', date: today(), start: '19:00', end: '', place: '', teamIds: [], text: '', by: me().id, at: Date.now() };
    const cats = S().teams.filter(t => !/\s[A-Z]$/.test(String(t.name || '').trim())); // categories, not their teams A / B
    modal({ title: isNew ? 'Organiser un événement' : 'Modifier l\'événement', body: `
      <div class="lbl">Quoi ?</div><div class="chips" id="evKind">${Object.entries(EV).map(([k, [ic, l]]) => `<button type="button" class="chip ${k === x.kind ? 'on' : ''}" data-v="${k}">${ic} ${l}</button>`).join('')}</div>
      <label class="fld"><span>Titre</span><input id="evTitle" value="${esc(x.title)}" maxlength="80" placeholder="Ex : Réunion des éducateurs, Tournoi U11, Repas de fin de saison"></label>
      <div class="row3"><label class="fld"><span>Date</span><input type="date" id="evDate" value="${esc(x.date)}"></label>
        <label class="fld"><span>Début</span><input type="time" id="evStart" value="${esc(x.start || '')}"></label>
        <label class="fld"><span>Fin</span><input type="time" id="evEnd" value="${esc(x.end || '')}"></label></div>
      <label class="fld"><span>Lieu</span><input id="evPlace" value="${esc(x.place || '')}" maxlength="80" placeholder="Ex : club-house, stade, restaurant…"></label>
      <div class="lbl">Pour qui ? <span class="muted small">(rien de coché = tout le club)</span></div>
      <div class="chips team-pick" id="evTeams">${cats.map(t => `<button type="button" class="chip ${(x.teamIds || []).includes(t.id) ? 'on' : ''}" data-t="${t.id}">${esc(t.name)}</button>`).join('')}</div>
      <label class="fld"><span>Détails</span><textarea id="evText" rows="3" placeholder="Ordre du jour, ce qu'il faut apporter, prix du repas…">${esc(x.text || '')}</textarea></label>
      ${isNew ? `<label class="switch"><input type="checkbox" id="evBook"><span>Réserver aussi le grand terrain (tournoi au stade)</span></label>
        <label class="switch"><input type="checkbox" id="evTell" checked><span>Prévenir tous les coachs dans la messagerie</span></label>` : ''}`,
      onOpen: r => {
        $$('#evKind .chip', r).forEach(b => b.onclick = () => { $$('#evKind .chip', r).forEach(c => c.classList.toggle('on', c === b)); });
        $$('#evTeams .chip', r).forEach(b => b.onclick = () => b.classList.toggle('on'));
      },
      actions: [
        ...(isNew ? [] : [{ label: 'Supprimer', kind: 'danger', icon: I.trash, onClick: () => { setTimeout(async () => { if (await confirmBox('Supprimer cet événement ?')) { rsvps(x.id).forEach(r => Store.remove('reports', r.id)); Store.remove('reports', x.id); toast('Événement supprimé'); done && done(); } }, 60); } }]),
        { label: 'Annuler' },
        { label: isNew ? 'Publier' : 'Enregistrer', kind: 'primary', onClick: (close, r) => {
          const v = id => $('#' + id, r).value.trim(), on = $('#evKind .on', r), kind = on ? on.dataset.v : 'autre';
          if (!v('evDate')) { toast('Choisis la date', 'err'); return false; }
          if (v('evStart') && v('evEnd') && v('evEnd') <= v('evStart')) { toast('La fin doit être après le début', 'err'); return false; }
          Object.assign(x, { kind, title: v('evTitle') || EV[kind][1], date: v('evDate'), start: v('evStart'), end: v('evEnd'), place: v('evPlace'), text: $('#evText', r).value.trim(), teamIds: $$('#evTeams .chip.on', r).map(b => b.dataset.t) });
          Store.upsert('reports', x); toast(isNew ? 'Événement publié' : 'Enregistré');
          if (isNew) {
            const book = $('#evBook', r).checked, tell = $('#evTell', r).checked;
            (async () => {
              if (book) await bookPitch(x);
              if (tell) announce(`${EV[kind][0]} ${x.title} · ${when(x)}${x.place ? ' · ' + x.place : ''}. Réponds dans « Vie du club » : je viens ou je ne viens pas.`);
            })();
          }
          done && done();
        } }] });
  }
  function showEvent(id, done) {
    const x = Store.get('reports', id); if (!x) return;
    const [ic, lab] = EV[x.kind] || EV.autre, rs = rsvps(id), names = v => rs.filter(r => r.v === v).map(r => who(r.staffId));
    const yes = names('yes'), no = names('no'), future = x.date >= today();
    modal({ title: `${ic} ${x.title || lab}`, noFocus: true, body: `<p class="lead">${esc(when(x))}</p>
      ${x.place ? `<p>📍 ${esc(x.place)}</p>` : ''}<p class="muted small">${esc(lab)} · ${esc(forWhom(x))} · organisé par ${esc(who(x.by))}</p>
      ${x.text ? `<p class="life-text">${esc(x.text).replace(/\n/g, '<br>')}</p>` : ''}
      <h3 class="sub-h">✅ Viennent (${yes.length})</h3><p>${yes.length ? esc(yes.join(', ')) : '<span class="muted">Personne pour l\'instant.</span>'}</p>
      ${no.length ? `<h3 class="sub-h">❌ Ne viennent pas (${no.length})</h3><p>${esc(no.join(', '))}</p>` : ''}`,
      actions: [
        ...(canEdit(x) ? [{ label: 'Modifier', icon: I.edit, onClick: () => { setTimeout(() => editEvent(x, done), 60); } }] : []),
        ...(future ? [{ label: '❌ Je ne viens pas', onClick: () => { setRsvp(id, 'no'); done && done(); } }, { label: '✅ Je viens', kind: 'primary', onClick: () => { setRsvp(id, 'yes'); done && done(); } }] : [{ label: 'Fermer', kind: 'primary' }]),
      ] });
  }

  /* ---------- reports: lost, broken, organisation ---------- */
  function issueCard(x) {
    const [ic, lab] = IS[x.kind] || IS.autre, [sl, sc] = ST[x.status] || ST.open, n = comments(x.id).length;
    return `<article class="life-card ${x.status === 'done' ? 'past' : ''}" data-is="${x.id}">
      ${x.photos && x.photos.length ? `<img class="life-thumb" alt="" src="${x.photos[0]}">` : `<div class="life-ic">${ic}</div>`}
      <div class="life-main"><b>${esc(x.title || lab)}</b>
        ${x.where ? `<span>📍 ${esc(x.where)}</span>` : ''}
        <span class="muted small">${ic} ${esc(lab)} · par ${esc(who(x.by))} · ${esc(short(x.at))}</span>
        <span><i class="st-pill ${sc}">${sl}</i>${n ? ` <span class="muted small">💬 ${n}</span>` : ''}${x.photos && x.photos.length > 1 ? ` <span class="muted small">📷 ${x.photos.length}</span>` : ''}</span></div></article>`;
  }
  function issuesHtml() {
    const all = life('issue').sort((a, b) => b.at - a.at), open = all.filter(x => x.status !== 'done'), fixed = all.filter(x => x.status === 'done').slice(0, 30);
    return (open.length ? open.map(issueCard).join('') : '<div class="empty"><p>Rien à signaler 👍 Objet perdu, matériel cassé, souci d\'organisation : touche « Signaler » et ajoute une photo.</p></div>')
      + (fixed.length ? `<details class="life-past"><summary>Résolus (${fixed.length})</summary>${fixed.map(issueCard).join('')}</details>` : '');
  }
  function editIssue(x, done) {
    const isNew = !x;
    x = x || { id: Store.uid(), life: 'issue', kind: 'perdu', title: '', where: '', text: '', photos: [], status: 'open', by: me().id, at: Date.now() };
    const photos = (x.photos || []).slice();
    const drawPhotos = r => {
      const box = $('#isPhotos', r);
      box.innerHTML = photos.map((p, i) => `<span class="ph"><img alt="Photo ${i + 1}" src="${p}"><button type="button" class="ph-rm" data-rmph="${i}" aria-label="Retirer la photo">${I.x}</button></span>`).join('')
        + (photos.length < MAX_PHOTOS ? `<button type="button" class="ph-add" id="phAdd">${I.image}<span>Ajouter une photo</span></button>` : '');
      $$('[data-rmph]', box).forEach(b => b.onclick = () => { photos.splice(+b.dataset.rmph, 1); drawPhotos(r); });
      const add = $('#phAdd', box);
      if (add) add.onclick = async () => {
        const files = (await UI.pickFiles({ accept: 'image/*', multiple: true })).filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|heic|webp)$/i.test(f.name));
        for (const f of files.slice(0, MAX_PHOTOS - photos.length)) { try { photos.push(await photoData(f)); } catch (e) { toast('Photo illisible', 'err'); } }
        drawPhotos(r);
      };
    };
    modal({ title: isNew ? 'Signaler' : 'Modifier le signalement', body: `
      <div class="lbl">Quoi ?</div><div class="chips" id="isKind">${Object.entries(IS).map(([k, [ic, l]]) => `<button type="button" class="chip ${k === x.kind ? 'on' : ''}" data-v="${k}">${ic} ${l}</button>`).join('')}</div>
      <label class="fld"><span>En quelques mots</span><input id="isTitle" value="${esc(x.title)}" maxlength="80" placeholder="Ex : sac de ballons oublié, filet de but déchiré, pas d'arbitre samedi"></label>
      <label class="fld"><span>Où et quand ?</span><input id="isWhere" value="${esc(x.where || '')}" maxlength="80" placeholder="Ex : vestiaire 2, samedi matin"></label>
      <label class="fld"><span>Détails</span><textarea id="isText" rows="3" placeholder="Ce qui s'est passé, ce qu'il faudrait faire…">${esc(x.text || '')}</textarea></label>
      <div class="lbl">Photos <span class="muted small">(${MAX_PHOTOS} au plus)</span></div><div class="ph-row" id="isPhotos"></div>
      ${isNew ? '<label class="switch"><input type="checkbox" id="isTell" checked><span>Prévenir tous les coachs dans la messagerie</span></label>' : ''}`,
      onOpen: r => {
        $$('#isKind .chip', r).forEach(b => b.onclick = () => { $$('#isKind .chip', r).forEach(c => c.classList.toggle('on', c === b)); });
        drawPhotos(r);
      },
      actions: [
        { label: 'Annuler' },
        { label: isNew ? 'Envoyer' : 'Enregistrer', kind: 'primary', onClick: (close, r) => {
          const v = id => $('#' + id, r).value.trim(), on = $('#isKind .on', r), kind = on ? on.dataset.v : 'autre';
          if (!v('isTitle') && !v('isText') && !photos.length) { toast('Écris ce qui se passe ou ajoute une photo', 'err'); return false; }
          Object.assign(x, { kind, title: v('isTitle') || IS[kind][1], where: v('isWhere'), text: $('#isText', r).value.trim(), photos });
          Store.upsert('reports', x); toast(isNew ? 'Signalement envoyé' : 'Enregistré');
          if (isNew && $('#isTell', r).checked) announce(`${IS[kind][0]} ${IS[kind][1]} : ${x.title}${x.where ? ' (' + x.where + ')' : ''}. Détails et photos dans « Vie du club ».`);
          done && done();
        } }] });
  }
  const comHtml = id => { const l = comments(id);
    return l.length ? l.map(c => `<div class="com"><b>${esc(who(c.by))}</b> <span class="muted small">${esc(short(c.at))}</span><p>${esc(c.text).replace(/\n/g, '<br>')}</p></div>`).join('') : '<p class="muted small">Pas encore de commentaire.</p>'; };
  function showIssue(id, done) {
    const x = Store.get('reports', id); if (!x) return;
    const [ic, lab] = IS[x.kind] || IS.autre, st = x.status || 'open';
    modal({ title: `${ic} ${x.title || lab}`, noFocus: true, body: `
      <p><i class="st-pill ${ST[st][1]}">${ST[st][0]}</i> <span class="muted small">${esc(lab)} · signalé par ${esc(who(x.by))} le ${esc(short(x.at))}</span></p>
      ${x.where ? `<p>📍 ${esc(x.where)}</p>` : ''}${x.text ? `<p class="life-text">${esc(x.text).replace(/\n/g, '<br>')}</p>` : ''}
      ${(x.photos || []).map((p, i) => `<img class="life-photo" alt="Photo ${i + 1}" src="${p}">`).join('')}
      ${canEdit(x) ? `<div class="lbl">Où en est-on ?</div><div class="chips" id="isSt">${Object.entries(ST).map(([k, [l]]) => `<button type="button" class="chip ${k === st ? 'on' : ''}" data-v="${k}">${l}</button>`).join('')}</div>` : ''}
      <h3 class="sub-h">💬 Commentaires</h3><div id="isCom">${comHtml(id)}</div>
      <div class="composer life-composer"><textarea id="comText" rows="1" maxlength="500" placeholder="Ex : je l'ai retrouvé, il est au club-house"></textarea><button class="btn primary" id="comSend" aria-label="Envoyer le commentaire">${I.upload}</button></div>`,
      onOpen: r => {
        $$('#isSt .chip', r).forEach(b => b.onclick = () => {
          x.status = b.dataset.v; Store.upsert('reports', x);
          $$('#isSt .chip', r).forEach(c => c.classList.toggle('on', c === b)); toast('Statut : ' + ST[x.status][0]); done && done();
        });
        $('#comSend', r).onclick = () => {
          const t = $('#comText', r).value.trim(); if (!t) return;
          Store.upsert('reports', { id: Store.uid(), life: 'comment', issueId: id, by: me().id, text: t, at: Date.now() });
          $('#comText', r).value = ''; $('#isCom', r).innerHTML = comHtml(id); done && done();
        };
      },
      actions: [
        ...(canEdit(x) ? [{ label: 'Supprimer', kind: 'danger', icon: I.trash, onClick: () => { setTimeout(async () => { if (await confirmBox('Supprimer ce signalement ?')) { comments(id).forEach(c => Store.remove('reports', c.id)); Store.remove('reports', id); toast('Supprimé'); done && done(); } }, 60); } },
          { label: 'Modifier', icon: I.edit, onClick: () => { setTimeout(() => editIssue(x, done), 60); } }] : []),
        { label: 'Fermer', kind: 'primary' }] });
  }

  /* ---------- cheering a team after its match (every coach, every category) ---------- */
  const resultOf = m => !m.played ? null : m.gf > m.ga ? 'V' : m.gf < m.ga ? 'D' : 'N';
  // [emoji, button, button once done, verb for the message, reason]
  const CHEER = { V: ['👏', 'Féliciter', 'Félicité', 'félicite', 'pour la victoire'], N: ['👍', 'Bravo', 'Bravo envoyé', 'salue', 'pour le match nul'], D: ['💪', 'Encourager', 'Encouragé', 'encourage', 'après la défaite'] };
  const cheersOf = mid => life('cheer').filter(c => c.matchId === mid).sort((a, b) => a.at - b.at);
  function cheerBar(m) {
    const r = resultOf(m); if (!r || m.exempt || !me()) return '';
    const [emo, verb, done] = CHEER[r], list = cheersOf(m.id), mine = list.some(c => c.by === me().id);
    return `<div class="cheer"><button type="button" class="btn ${mine ? 'primary' : 'soft'} cheer-btn" data-cheer="${m.id}">${emo}<span>${mine ? done : verb}${list.length ? ' · ' + list.length : ''}</span></button>
      ${list.length ? `<span class="cheer-who">${esc(list.map(c => who(c.by)).join(', '))}</span>` : `<span class="muted small">${r === 'D' ? 'Un mot d\'encouragement fait du bien !' : 'Sois le premier à féliciter l\'équipe !'}</span>`}</div>`;
  }
  // One per coach and per match; the team's channel gets a message the first time
  function cheer(mid) {
    const m = Store.get('matches', mid), u = me(); if (!m || !u || !resultOf(m)) return;
    const id = 'cheer-' + mid + '-' + u.id;
    if (Store.get('reports', id)) { Store.remove('reports', id); toast('Retiré'); return; }
    Store.upsert('reports', { id, life: 'cheer', matchId: mid, by: u.id, at: Date.now() });
    const r = resultOf(m), [emo, , , verb, why] = CHEER[r], t = Store.get('teams', m.teamId);
    const text = `${emo} ${who(u.id)} ${verb} les ${t ? t.name : 'joueurs'} ${why} (${m.gf}-${m.ga}) ${m.home ? 'contre' : 'chez'} ${m.opponent || '?'} !${r === 'D' ? ' On se relève ensemble 💪' : ''}`;
    if (Cloud.ready() && t) Cloud.post('team:' + t.id, text).catch(() => {});
    toast(r === 'D' ? 'Encouragement envoyé 💪' : 'Message envoyé à l\'équipe 👏');
  }

  /* ---------- home card ---------- */
  function homeCard() {
    const next = life('event').filter(x => x.date >= today()).sort(byDate).slice(0, 3), open = life('issue').filter(x => x.status !== 'done').length;
    const ans = x => { const m = myRsvp(x.id); return m === 'yes' ? '✅ tu viens' : m === 'no' ? '❌ tu ne viens pas' : '👉 réponds'; };
    return `<section class="card"><h2>🎉 Vie du club</h2>
      ${next.length ? next.map(x => `<a class="rowlink" href="#/club/evenements"><div><b>${(EV[x.kind] || EV.autre)[0]} ${esc(x.title)}</b><span>${esc(when(x))} · ${ans(x)}</span></div>${I.next}</a>`).join('') : '<p class="muted">Aucun événement prévu.</p>'}
      <div class="chips" style="margin-top:8px"><a class="btn soft" href="#/club/evenements">📅<span>Organiser</span></a>
      <a class="btn soft" href="#/club/signalements">🛠️<span>${open ? `${open} signalement${open > 1 ? 's' : ''} en cours` : 'Signaler'}</span></a></div></section>`;
  }

  return { page, homeCard, cheerBar, cheer };
})();
