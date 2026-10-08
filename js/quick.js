/* Quick: what simplifies the app everywhere.
   - the « + » button, on every page: a session, a match, an exercise to draw, a message, a search;
   - the search of the whole app (players, sessions, matches, exercises, diagrams, pages);
   - the match day page: convocation → composition → team talk → live match → summary for the parents, in one place;
   - the « saved » light: saved on the device, sent to the club, or no network (sent as soon as it comes back);
   - « Demain » on the home page: tomorrow's sessions and matches, what is missing, the equipment to take;
   - the monthly reminder of a backup file for the coaches (the responsables have their weekly one). */
const Quick = (() => {
  const { esc, $, $$, toast, modal } = UI;
  const S = () => Store.state;
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const sp = () => typeof Sport !== 'undefined' ? Sport : null;
  const ball = () => (sp() && sp().cur().icon) || '⚽';
  const scorersWord = () => (sp() && sp().W().Scorers) || 'Buteurs';
  const addDays = (d, n) => { const x = new Date(d + 'T12:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  const teamName = id => (Store.get('teams', id) || {}).name || '';
  const hh = t => String(t || '').replace(':', 'h');
  const mine = () => { const ids = new Set(Auth.teams().map(t => t.id)); return x => !x.teamId || ids.has(x.teamId); };
  const matchName = m => `${teamName(m.teamId) || S().club.name} ${m.home ? 'contre' : 'chez'} ${m.opponent || '?'}`;

  /* ---------- the « + » button ---------- */
  function fab() {
    let b = document.getElementById('quickFab');
    if (!b) { b = document.createElement('button'); b.id = 'quickFab'; b.className = 'quick-fab'; b.setAttribute('aria-label', 'Créer ou chercher'); b.innerHTML = I.plus; b.onclick = menu; document.body.appendChild(b); }
    const pv = Auth.preview();
    b.hidden = document.body.classList.contains('editing') || !Auth.current() || (pv && pv.role === 'benevole') || location.hash.startsWith('#/messages/') || location.hash.startsWith('#/direct/');
  }
  // the next match of my teams in the 2 days to come (or today's, even if it is finished)
  function matchSoon() {
    const now = UI.today(), end = addDays(now, 2), is = mine();
    return S().matches.filter(m => !m.exempt && is(m) && m.date >= now && m.date <= end && (!m.played || m.date === now))
      .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))[0];
  }
  function menu() {
    const soon = matchSoon();
    const items = [
      ['training', '📝', 'Une séance', 'Générer ou écrire une séance'],
      ['match', ball(), 'Un match', 'Date, adversaire, convocation'],
      ['schema', '✏️', 'Un exercice', 'Dessiner sur le terrain'],
      ['message', '💬', 'Un message', 'Aux coachs, aux parents'],
      ['search', '🔎', 'Chercher', 'Un joueur, une séance, un match…'],
      ...(soon ? [['matchday', '🏟️', 'Jour de match', esc(matchName(soon))]] : []),
    ];
    const close = modal({ title: 'Que veux-tu faire ?', noFocus: true,
      body: `<div class="quick-menu">${items.map(([k, ic, l, s]) => `<button class="quick-item" data-q="${k}"><b>${ic}</b><span>${l}</span><small>${s}</small></button>`).join('')}</div>`,
      onOpen: r => $$('[data-q]', r).forEach(x => x.onclick = () => {
        close();
        const k = x.dataset.q;
        setTimeout(() => {
          if (k === 'training') { location.hash = '#/entrainements'; setTimeout(trainingChoice, 60); }
          else if (k === 'match') Views.newMatch();
          else if (k === 'schema') Views.newSchema();
          else if (k === 'message') location.hash = '#/messages';
          else if (k === 'search') search();
          else if (k === 'matchday') location.hash = '#/jourj/' + soon.id;
        }, 30);
      }) });
  }
  // a session: generated in one tap, or written by hand
  function trainingChoice() {
    const close = modal({ title: 'Une séance', noFocus: true,
      body: `<div class="quick-menu">
        <button class="quick-item" data-t="gen"><b>✨</b><span>Générer une séance</span><small>Un thème, une durée : c'est prêt</small></button>
        <button class="quick-item" data-t="sys"><b>🧩</b><span>Par système de jeu</span><small>Des séances toutes faites</small></button>
        <button class="quick-item" data-t="new"><b>✍️</b><span>L'écrire moi-même</span><small>Un thème, une date, puis les exercices</small></button></div>`,
      onOpen: r => $$('[data-t]', r).forEach(x => x.onclick = () => { close(); setTimeout(() => {
        if (x.dataset.t === 'gen') Exos.generator(); else if (x.dataset.t === 'sys') location.hash = '#/systemes'; else Views.newTraining(); }, 30); }) });
  }

  /* ---------- search ---------- */
  const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const PAGES = [['', 'Accueil'], ['entrainements', 'Séances (entraînements)'], ['matchs', 'Matchs'], ['equipes', 'Équipes et joueurs'], ['messages', 'Messages'],
    ['planning', 'Planning des terrains'], ['club', 'Vie du club'], ['resultats', 'Résultats du club'], ['schemas', 'Schémas et exercices dessinés'], ['bibliotheque', 'Bibliothèque (vidéos, PDF)'],
    ['stats', 'Stats de la saison'], ['reglages', 'Réglages et mon compte'], ['exercices', 'Exercices du club'], ['systemes', 'Séances par système de jeu'], ['progression', 'Progression des joueurs'],
    ['infirmerie', 'Infirmerie (blessés)'], ['tests', 'Tests physiques'], ['benevoles', 'Bénévoles'], ['arbitres', 'Arbitres'], ['vestiaires', 'Vestiaires'], ['bilan', 'Bilan de la saison']];
  function results(q) {
    const n = norm(q).trim(); if (n.length < 2) return [];
    const words = n.split(/\s+/), has = t => { const x = norm(t); return words.every(w => x.includes(w)); };
    const day = DAYS.indexOf(n), now = UI.today(), fd = d => UI.fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' });
    const dayOf = d => d ? new Date(d + 'T12:00').getDay() : -1;
    const soonFirst = (a, b) => { const fa = a.date >= now, fb = b.date >= now; return fa !== fb ? (fa ? -1 : 1) : fa ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date); };
    const out = [];
    const players = S().players.filter(p => Auth.seesPerson(p) && has(`${p.firstName} ${p.lastName} ${p.lastName} ${p.firstName}`)).slice(0, 6);
    if (players.length) out.push(['Joueurs', players.map(p => [`#/joueur/${p.id}`, `${p.firstName || ''} ${p.lastName || ''}`, (p.teamIds || []).map(teamName).filter(Boolean).join(', ')])]);
    const staff = S().staff.filter(p => Auth.seesPerson(p) && has(`${p.firstName} ${p.lastName}`)).slice(0, 4);
    if (staff.length) out.push(['Dirigeants', staff.map(p => ['#/dirigeants', `${p.firstName || ''} ${p.lastName || ''}`, p.role || ''])]);
    const teams = Auth.teams().filter(t => has(`${t.name} ${t.category}`)).slice(0, 4);
    if (teams.length) out.push(['Équipes', teams.map(t => [`#/equipe/${t.id}`, t.name, `${Store.playersOf(t.id).length} joueurs`])]);
    const ms = S().matches.filter(m => Auth.sees(m.teamId) && (day >= 0 ? dayOf(m.date) === day && m.date >= addDays(now, -7) : has(`${m.opponent} ${m.competition} ${teamName(m.teamId)} ${m.place} ${fd(m.date)}`))).sort(soonFirst).slice(0, 6);
    if (ms.length) out.push(['Matchs', ms.map(m => [`#/match/${m.id}`, matchName(m), `${fd(m.date)}${m.played ? ' · ' + m.gf + ' – ' + m.ga : m.time ? ' · ' + hh(m.time) : ''}`])]);
    const trs = S().trainings.filter(t => !t.model && Auth.sees(t.teamId) && (day >= 0 ? dayOf(t.date) === day && t.date >= addDays(now, -7) : has(`${t.title} ${teamName(t.teamId)} ${fd(t.date)} ${(t.exercises || []).map(e => e.title).join(' ')}`))).sort(soonFirst).slice(0, 6);
    if (trs.length) out.push(['Séances', trs.map(t => [`#/entrainement/${t.id}`, t.title || 'Entraînement', `${fd(t.date)}${t.teamId ? ' · ' + teamName(t.teamId) : ''}`])]);
    if (day < 0) {
      const ex = Exos.all().filter(e => has(`${e.title} ${e.org}`)).slice(0, 6);
      if (ex.length) out.push(['Exercices', ex.map(e => [`exo:${e.title}`, e.title, `${e.duration} min${e.club ? ' · du club' : ''}`])]);
      const sc = S().schemas.filter(s => Auth.sees(s.teamId) && has(s.name)).slice(0, 4);
      if (sc.length) out.push(['Schémas', sc.map(s => [`#/schema/${s.id}`, s.name, 'Schéma dessiné'])]);
      const pg = PAGES.filter(([, l]) => has(l)).slice(0, 4);
      if (pg.length) out.push(['Pages', pg.map(([h, l]) => [`#/${h}`, l, 'Ouvrir la page'])]);
    }
    return out;
  }
  function search() {
    const close = modal({ title: '🔎 Chercher', body: `<input id="qSearch" type="search" placeholder="Un prénom, une équipe, « rondo », « samedi »…" autocomplete="off" enterkeyhint="search">
      <div id="qRes" class="q-res"><p class="muted small">Tape au moins 2 lettres. Exemples : un prénom, un adversaire, un exercice, un jour de la semaine.</p></div>`,
      onOpen: r => {
        const inp = $('#qSearch', r), box = $('#qRes', r);
        const draw = () => {
          const res = results(inp.value);
          box.innerHTML = res.length ? res.map(([g, rows]) => `<div class="q-group"><div class="lbl">${esc(g)}</div>${rows.map(([h, t, s]) => `<a class="q-row" href="${esc(h.startsWith('exo:') ? '#/exercices' : h)}" ${h.startsWith('exo:') ? `data-exo="${esc(h.slice(4))}"` : ''}><b>${esc(t)}</b><span>${esc(s)}</span></a>`).join('')}</div>`).join('')
            : inp.value.trim().length >= 2 ? '<p class="muted">Rien trouvé. Essaie un autre mot (sans les accents, ça marche aussi).</p>' : box.innerHTML;
        };
        inp.oninput = draw;
        box.onclick = e => { const a = e.target.closest('a'); if (!a) return; if (a.dataset.exo) { const st = S().ui.exos = S().ui.exos || {}; st.q = a.dataset.exo; st.theme = ''; st.fmt = ''; } close(); };
        setTimeout(() => inp.focus(), 60);
      } });
  }

  /* ---------- the match day page ---------- */
  function summaryText(m) {
    const t = Store.get('teams', m.teamId), club = S().club.name, us = t ? t.name : club;
    const sc = m.home ? `${us} ${m.gf} – ${m.ga} ${m.opponent || '?'}` : `${m.opponent || '?'} ${m.ga} – ${m.gf} ${us}`;
    const st = m.stats || {}, pn = id => { const p = Store.get('players', id); return p ? Store.shortName(p) : ''; };
    const goals = Object.entries(st).filter(([, x]) => x.g).map(([id, x]) => `${pn(id)}${x.g > 1 ? ' (' + x.g + ')' : ''}`).filter(Boolean);
    const assists = Object.entries(st).filter(([, x]) => x.a).map(([id, x]) => `${pn(id)}${x.a > 1 ? ' (' + x.a + ')' : ''}`).filter(Boolean);
    const res = m.gf > m.ga ? 'Victoire ! Bravo à tous 👏' : m.gf === m.ga ? 'Match nul, on continue de travailler 💪' : 'Défaite, on relève la tête et on apprend 💪';
    const nextM = S().matches.filter(x => x.teamId === m.teamId && x.id !== m.id && !x.exempt && x.date > m.date).sort((a, b) => a.date.localeCompare(b.date))[0];
    const nextT = S().trainings.filter(x => !x.model && x.teamId === m.teamId && x.date > m.date).sort((a, b) => a.date.localeCompare(b.date))[0];
    const fd = d => UI.fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' }), me = Auth.current();
    return [`${ball()} *${club}${t ? ' · ' + t.name : ''}*`, `*${sc}*`, res, '',
      goals.length ? `${scorersWord()} : ${goals.join(', ')}` : '', assists.length ? `Passes : ${assists.join(', ')}` : '', goals.length || assists.length ? '' : null,
      'Le mot du coach : ', '',
      nextT ? `📅 Prochaine séance : ${fd(nextT.date)}${nextT.time ? ' à ' + hh(nextT.time) : ''}` : '', nextM ? `📅 Prochain match : ${fd(nextM.date)} ${nextM.home ? 'contre' : 'chez'} ${nextM.opponent || '?'}` : '',
      me ? Messages.coachName(me) : ''].filter(l => l !== null).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  function sendSummary(m) {
    modal({ title: 'Résumé pour les parents', noFocus: true, body: `<p class="muted small">Le message est prêt. Écris ton mot après « Le mot du coach », puis envoie-le.</p><textarea id="sumTxt" rows="13">${esc(summaryText(m))}</textarea>`,
      actions: [
        { label: 'WhatsApp', kind: 'primary', icon: I.share, onClick: (c, r) => { window.open('https://wa.me/?text=' + encodeURIComponent($('#sumTxt', r).value), '_blank'); m.summarySent = Date.now(); Store.upsert('matches', m); return false; } },
        ...(navigator.share ? [{ label: 'Autre appli', icon: I.share, onClick: (c, r) => { navigator.share({ title: 'Résumé du match', text: $('#sumTxt', r).value }).catch(() => {}); m.summarySent = Date.now(); Store.upsert('matches', m); return false; } }] : []),
        ...(Cloud.ready() ? [{ label: 'Messagerie du club', icon: I.chat, onClick: (c, r) => { Cloud.post('team:' + m.teamId, $('#sumTxt', r).value).then(() => { m.summarySent = Date.now(); Store.upsert('matches', m); toast('Résumé publié'); }).catch(e => toast(e.message, 'err')); } }] : []),
        { label: 'Copier', icon: I.copy, onClick: (c, r) => { navigator.clipboard.writeText($('#sumTxt', r).value).then(() => toast('Résumé copié')).catch(() => toast('Sélectionne le texte et copie-le')); return false; } }] });
  }
  function matchDay(root, id) {
    const m = Store.get('matches', id); if (!m) { location.hash = '#/matchs'; return; }
    if (!Auth.sees(m.teamId)) { location.hash = '#/match/' + id; return; }
    const t = Store.get('teams', m.teamId), roster = t ? Store.rosterOf(t.id) : [], conv = roster.filter(p => (m.convoked || []).includes(p.id));
    const lineup = m.lineupId && Store.get('schemas', m.lineupId), d = Prepa.done(m), l = m.live || {}, st = l.status || 'pre';
    const step = (n, ok, title, body) => `<section class="card md-step ${ok ? 'ok' : ''}"><div class="md-head"><b class="md-n">${ok ? '✓' : n}</b><h2>${title}</h2></div>${body}</section>`;
    root.innerHTML = `<header class="page-head"><div><h1>🏟️ Jour de match</h1><p class="sub">${esc(matchName(m))} · ${esc(UI.fmtDate(m.date, { weekday: 'long', day: 'numeric', month: 'long' }))}${m.time ? ' · ' + esc(hh(m.time)) : ''}</p></div>
      <div class="head-actions"><a class="btn" href="#/match/${m.id}">${I.back}<span>Fiche du match</span></a></div></header>
      ${step(1, conv.length && m.convSent, 'Les convoqués', `
        ${t ? `<div class="chips md-conv">${roster.map(p => `<button class="chip ${(m.convoked || []).includes(p.id) ? 'on' : ''}" data-conv="${p.id}">${esc(Store.shortName(p))}</button>`).join('') || '<span class="muted">Aucun joueur dans cette équipe.</span>'}</div>` : '<p class="muted">Choisis l\'équipe sur la fiche du match.</p>'}
        <p class="muted small">Touche un prénom pour le convoquer (${conv.length} convoqué${conv.length > 1 ? 's' : ''}).${m.convSent ? ' Convocation envoyée ✓' : ''}</p>
        ${conv.length ? `<button class="btn primary" data-md="convoc">${I.share}<span>Envoyer la convocation</span></button>` : ''}`)}
      ${step(2, !!lineup, 'La composition', lineup ? `<a href="#/schema/${lineup.id}" class="thumb md-thumb"><img alt="" src="${UI.thumb(lineup)}"></a><a class="btn soft" href="#/schema/${lineup.id}">${I.edit}<span>Modifier</span></a>`
        : `<p class="muted small">Les convoqués sont placés tout seuls selon leur poste.</p><button class="btn primary" data-md="lineup">${I.formation}<span>Faire la composition</span></button>`)}
      ${step(3, d.causerie, 'La causerie', `<p class="muted small">${d.causerie ? 'Prête : l\'objectif et les clés du match sont écrits.' : 'Un objectif et 3 clés, en 5 minutes.'}</p>
        <div class="chips"><a class="btn ${d.causerie ? 'soft' : 'primary'}" href="#/prepa/${m.id}/causerie">${I.edit}<span>${d.causerie ? 'Modifier' : 'Préparer'}</span></a>${d.causerie ? `<button class="btn primary" data-md="talk">${I.play}<span>Lancer la causerie</span></button>` : ''}</div>`)}
      ${step(4, st === 'end' || m.played, 'Le match', `${Live.card(m) || `<p class="muted small">Score : ${m.gf} – ${m.ga}</p>`}<p class="muted small">Chrono, buts, changements : la minute et le temps de jeu se notent tout seuls. Ça marche aussi sans réseau.</p>`)}
      ${step(5, !!m.summarySent, 'Après le match', m.played ? `<p><b class="md-score">${esc(m.home ? `${m.gf} – ${m.ga}` : `${m.ga} – ${m.gf}`)}</b> ${m.gf > m.ga ? '🎉 Victoire' : m.gf === m.ga ? 'Match nul' : 'Défaite'}</p>
        <div class="chips"><button class="btn primary" data-md="summary">${I.share}<span>Envoyer le résumé aux parents</span></button><a class="btn soft" href="#/match/${m.id}">${I.clock}<span>Temps de jeu et notes</span></a></div>`
        : '<p class="muted small">À la fin du match : le score et les buteurs arrivent tout seuls, puis un résumé prêt à envoyer aux parents.</p>')}`;
    const redraw = () => matchDay(root, id);
    root.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.conv) { const c = m.convoked = m.convoked || [], i = c.indexOf(b.dataset.conv); i < 0 ? c.push(b.dataset.conv) : c.splice(i, 1); Store.upsert('matches', m); return redraw(); }
      if (b.dataset.md === 'convoc') { m.convSent = Date.now(); Store.upsert('matches', m); Views.sendConvocation(m); return; }
      if (b.dataset.md === 'lineup') return Views.makeLineup(m);
      if (b.dataset.md === 'talk') return Prepa.show(m);
      if (b.dataset.md === 'summary') return sendSummary(m);
    };
  }
  // the card at the top of the home page on the day before and the day of a match
  function matchDayCard() {
    const m = matchSoon(), now = UI.today();
    // today's and tomorrow's match are already in the greeting at the top (« Jour de match : tout préparer »)
    if (!m || m.date <= addDays(now, 1)) return '';
    return `<a class="card md-card" href="#/jourj/${m.id}"><b>🏟️ ${esc(UI.fmtDate(m.date, { weekday: 'long' }).replace(/^./, c => c.toUpperCase()))} : jour de match</b><span>${esc(matchName(m))}${m.time ? ' · ' + esc(hh(m.time)) : ''}</span><span class="btn primary">Tout préparer</span></a>`;
  }

  /* ---------- « Demain » : what is coming, what is missing ---------- */
  function tomorrowCard() {
    // a coach without any category yet: who gives them
    if (Auth.current() && !Auth.isAdmin() && !Auth.preview() && !Auth.teams().length) return `<section class="card tm-card"><h2>🧢 Tu n'as pas encore de catégorie</h2>
      <p class="muted">Le responsable du club te les donne : Réglages → Comptes des dirigeants → « Catégories ». Ensuite tu vois les joueurs, les séances et les matchs de tes équipes.</p></section>`;
    const now = UI.today(), tm = addDays(now, 1), is = mine(), rows = [];
    const trs = S().trainings.filter(t => !t.model && is(t) && t.teamId && (t.date === tm || t.date === now)).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
    trs.forEach(t => {
      const ex = t.exercises || [], kit = [...new Set(ex.map(e => e.materiel).filter(Boolean).join(', ').split(/\s*,\s*/).map(x => x.trim()).filter(Boolean))].slice(0, 6);
      const miss = [!ex.length && 'pas encore d\'exercice'].filter(Boolean);
      rows.push(`<a class="tm-row" href="#/entrainement/${t.id}"><b>${t.date === now ? 'Aujourd\'hui' : 'Demain'}${t.time ? ' ' + esc(hh(t.time)) : ''} · séance ${esc(teamName(t.teamId))}</b>
        <span>${miss.length ? '⚠️ ' + miss.join(', ') : `${ex.length} exercice${ex.length > 1 ? 's' : ''}`}${kit.length ? ' · 🎒 ' + esc(kit.join(', ')) : ''}</span></a>`);
    });
    S().matches.filter(m => !m.exempt && !m.played && is(m) && m.date === tm).forEach(m => {
      const miss = [!(m.convoked || []).length && 'personne n\'est convoqué', (m.convoked || []).length && !m.convSent && 'convocation pas encore envoyée', !m.lineupId && 'composition à faire'].filter(Boolean);
      rows.push(`<a class="tm-row" href="#/jourj/${m.id}"><b>Demain${m.time ? ' ' + esc(hh(m.time)) : ''} · match ${esc(matchName(m))}</b><span>${miss.length ? '⚠️ ' + miss.join(', ') : '✓ Tout est prêt'}</span></a>`);
    });
    return rows.length ? `<section class="card tm-card"><h2>${I.clock}À ne pas oublier</h2>${rows.join('')}</section>` : '';
  }

  /* ---------- a backup file once a month (coaches) ---------- */
  const BK = 'coach-backup-at';
  function backupCard() {
    if (Auth.isAdmin() || !Auth.current() || !S().trainings.length) return '';
    let at = 0; try { at = +localStorage.getItem(BK) || 0; } catch (e) {}
    if (!at) { try { localStorage.setItem(BK, String(Date.now())); } catch (e) {} return ''; }
    const days = Math.floor((Date.now() - at) / 864e5); if (days < 30) return '';
    return `<section class="card backup-remind"><h2>${I.shield}Ma sauvegarde du mois</h2><p class="muted">${Cloud.ready() ? 'Tes séances sont déjà gardées sur le serveur du club. ' : ''}Une copie de tes séances, matchs et schémas dans un fichier, à garder chez toi (dernière il y a ${days} jours).</p>
      <div class="chips"><button class="btn primary" data-qbackup="1">${I.download}<span>Télécharger ma sauvegarde</span></button><button class="btn soft" data-qbackup="0">Plus tard</button></div></section>`;
  }
  async function backupClick(b) {
    try { localStorage.setItem(BK, String(Date.now())); } catch (e) {}
    if (b.dataset.qbackup === '1') {
      const bz = UI.busy('Préparation de la sauvegarde…');
      try { const r = await Exporter.json(Store.exportAll(), `Sauvegarde-${S().club.name}-${UI.today()}`); if (r !== 'cancel') toast(r === 'downloaded' ? 'Sauvegarde enregistrée dans Téléchargements' : 'Sauvegarde prête'); }
      catch (e) { toast(e.message || 'Sauvegarde impossible', 'err'); } finally { bz.done(); }
    }
    const c = b.closest('.card'); if (c) c.remove();
  }

  /* ---------- the « saved » light ---------- */
  let pill = null, hideT = null, dirty = false;
  function light(kind, text, stay) {
    if (!pill) { pill = document.createElement('div'); pill.id = 'savePill'; pill.setAttribute('role', 'status'); document.body.appendChild(pill); }
    clearTimeout(hideT);
    pill.className = 'save-pill show ' + kind; pill.textContent = text;
    if (!stay) hideT = setTimeout(() => pill.classList.remove('show'), 2200);
  }
  // (2.32) saving is silent: no « Enregistrement… » / « Enregistré » at each letter typed. Only a problem is shown, once:
  // no network (it stays on the phone and leaves when the network is back) or a failed sending to the club
  const showing = t => pill && pill.classList.contains('show') && pill.textContent === t;
  const OFF = '📴 Pas de réseau : c\'est gardé sur le téléphone, envoi dès le retour du réseau', ERR = '⚠️ Pas encore envoyé au club : nouvel essai dans un instant';
  function onChange() {
    dirty = true;
    if (!navigator.onLine && !showing(OFF)) light('off', OFF, true);
  }
  function syncDone(err) {
    if (!dirty) return;
    if (!navigator.onLine) { if (!showing(OFF)) light('off', OFF, true); return; }
    if (err) { if (!showing(ERR)) light('err', ERR, true); return; }
    dirty = false; if (pill) pill.classList.remove('show');
  }
  function start() {
    Store.on(onChange);
    window.addEventListener('offline', () => { if (dirty) onChange(); });
    window.addEventListener('online', () => { if (pill) pill.classList.remove('show'); });
  }

  return { fab, menu, search, matchDay, matchDayCard, tomorrowCard, backupCard, backupClick, summaryText, start, syncDone };
})();
