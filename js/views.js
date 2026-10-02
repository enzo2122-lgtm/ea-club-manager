/* Views: every screen of the app except the board editor. */
const Views = (() => {
  const { esc, $, $$, toast, modal, confirmBox, fmtDate, today } = UI;
  const S = () => Store.state;
  const teamOf = id => Store.get('teams', id);
  const fmtLabel = f => Sport.formatLabel(f || Sport.defFormat());
  const formats = () => Sport.cur().formats.map(x => [x[0], x[1]]);
  const pName = Store.fullName;
  const pLabel = p => `${p.number ? p.number + ' · ' : ''}${pName(p)}`;
  // name on a roster chip, with the positions in short (« DC/LD »)
  const chipLabel = p => { const pb = ClubAdmin.problem(p); return `${pb ? `<span class="lic-warn" title="${esc(pb)}" aria-label="${esc(pb)}">⚠️</span>` : ''}${esc(pLabel(p))}${People.postsLabel(p, true) ? ` <i class="post-tag">${esc(People.postsLabel(p, true))}</i>` : ''}`; };
  // The team's own players (all of its category when nobody is put in the team yet, e.g. « Seniors A »)
  const squad = teamId => { const own = Store.playersOf(teamId); return own.length ? own : Store.rosterOf(teamId); };
  // Chips of a team's players, then « Autres joueurs de la catégorie » (a team A / B can call up any player of its category)
  function rosterChips(teamId, chip) {
    const mode = S().ui.rosterSort || 'name', all = Store.rosterOf(teamId), own = new Set(Store.playersOf(teamId).map(p => p.id));
    const mine = all.filter(p => own.has(p.id)), others = all.filter(p => !own.has(p.id)), t = teamOf(teamId);
    // sorted by position: one row of chips per line (goalkeepers, defenders, midfielders, forwards)
    const block = list => mode === 'post' ? People.byLine(list).map(([lab, ps]) => `<div class="lbl line-lbl">${esc(lab)} (${ps.length})</div><div class="chips roster">${ps.map(chip).join('')}</div>`).join('') : `<div class="chips roster">${People.sortPlayers(list, mode).map(chip).join('')}</div>`;
    const warn = all.filter(p => ClubAdmin.problem(p));
    return (all.length > 1 ? People.sortBar(mode, 'rsort') : '') + (warn.length ? `<p class="muted small">⚠️ = pas en règle (${warn.length}) : licence en attente ou certificat médical à fournir. Voir avec le responsable.</p>` : '') + (mine.length ? block(mine) : '') +
      (others.length ? `${mine.length ? `<div class="lbl">Autres joueurs de la catégorie ${esc((t && t.category) || '')} (${others.length})</div>` : ''}${block(others)}` : '') +
      (!all.length ? '<p class="muted">Aucun joueur dans cette catégorie : ajoute-les dans Équipes.</p>' : '');
  }
  const POS = [['GB', 'Gardien'], ['DEF', 'Défenseur'], ['MIL', 'Milieu'], ['ATT', 'Attaquant']];
  const COMPS = ['Championnat', 'Coupe', 'Amical', 'Plateau', 'Tournoi'];
  const activeTeam = () => S().ui.teamId && teamOf(S().ui.teamId) && Auth.sees(S().ui.teamId) ? S().ui.teamId : '';
  const byTeam = list => { const t = activeTeam(); return t ? list.filter(x => x.teamId === t) : list.filter(x => Auth.sees(x.teamId)); };
  const result = m => !m.played ? null : m.gf > m.ga ? 'V' : m.gf < m.ga ? 'D' : 'N';
  const resPill = m => { const r = result(m); return r ? `<span class="res-smiley" aria-hidden="true">${Ratings.smiley(m)}</span><span class="res res-${r}">${r === 'V' ? 'Gagné' : r === 'D' ? 'Perdu' : 'Nul'}</span>` : ''; };
  const scoreTxt = m => m.home ? `${m.gf} – ${m.ga}` : `${m.ga} – ${m.gf}`;
  const matchTitle = m => m.exempt ? `${esc(S().club.name)} <i>exempt · pas de match</i>` : m.home ? `${esc(S().club.name)} <i>contre</i> ${esc(m.opponent || '?')}` : `${esc(m.opponent || '?')} <i>contre</i> ${esc(S().club.name)}`;
  // « U13 · Raincy – Aulnaysienne » : our category, then the two teams in the order of the score (home first)
  const usShort = () => String(S().club.name || 'Nous').replace(/^(FA|AS|US|FC|ES|CS|SC|JS|RC)\s+/i, '').replace(/^(Le|La|Les|L')\s*/i, '') || S().club.name;
  // Home (green) or away (blue) tint of a match, the same everywhere in the app
  const side = m => m.exempt ? '' : m.home ? 'side-home' : 'side-away';
  const sideTag = m => m.exempt ? '' : `<i class="side-tag">${m.home ? '🏠 Dom.' : '🚌 Ext.'}</i>`;
  function lastTeams(m) {
    const t = teamOf(m.teamId), us = `<b class="us">${esc(usShort())}</b>`, them = `<span>${esc(m.opponent || '?')}</span>`;
    return `${t ? `<i class="rl-cat" style="background:${Planning.teamColor(t.id)}">${esc(t.name)}</i>` : ''}<span class="rl-teams">${m.home ? us + ' – ' + them : them + ' – ' + us}</span>`;
  }
  const empty = (txt, btn) => `<div class="empty"><p>${txt}</p>${btn || ''}</div>`;

  function teamSwitch() {
    const t = activeTeam();
    return `<div class="team-switch" role="tablist" aria-label="Équipe">
      <button class="chip ${!t ? 'on' : ''}" data-team="">${Auth.isAdmin() ? 'Toutes les équipes' : Auth.teams().length > 1 ? 'Mes équipes' : 'Tout'}</button>
      ${Store.teamGroups(Auth.teams()).map(g => `<span class="team-fam">${g.map(x => `<button class="chip ${Store.isSub(x) ? 'sub' : ''} ${x.id === t ? 'on' : ''}" data-team="${x.id}">${esc(x.name)}</button>`).join('')}</span>`).join('')}
    </div>
    <label class="team-select"><span>Catégorie</span><select data-teamsel aria-label="Catégorie">
      <option value="">${Auth.isAdmin() ? 'Toutes les équipes' : Auth.teams().length > 1 ? 'Mes équipes' : 'Tout'}</option>
      ${Auth.teams().map(x => `<option value="${x.id}" ${x.id === t ? 'selected' : ''}>${esc(Store.teamLabel(x))}</option>`).join('')}</select></label>`;
  }
  // Chips on a computer, a drop-down list on phones and tablets (nothing to slide sideways)
  function bindTeamSwitch(root, rerender) {
    $$('[data-team]', root).forEach(b => b.onclick = () => { S().ui.teamId = b.dataset.team; Store.save(); rerender(); });
    $$('[data-teamsel]', root).forEach(s => s.onchange = () => { S().ui.teamId = s.value; Store.save(); rerender(); });
  }
  const header = (title, sub, actions = '') => `<header class="page-head"><div><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div><div class="head-actions">${actions}</div></header>`;

  /* ================= Accueil ================= */
  // Getting the club ready: shown to responsables until every step is done
  function serverBanner() {
    if (!Auth.localOnly()) return '';
    return `<section class="card server-banner"><h2>${I.share}Connecte-toi au serveur du club</h2>
      <p>Tu es connecté avec un ancien compte gardé seulement sur ce téléphone. Pour retrouver les dirigeants, le planning et les messages du club, connecte-toi au serveur${Auth.isAdmin() ? ' avec ton <b>code responsable</b> (ou « J\'ai perdu le code responsable »)' : ' avec le lien d\'invitation'}. Tes données de ce téléphone sont gardées et envoyées au serveur.</p>
      <button class="btn primary" data-connect>${I.check}<span>Me connecter au serveur</span></button></section>`;
  }
  function setupCard() {
    if (!Auth.isAdmin() || S().club.demo) return ''; // the demo club is already set up
    const st = S(), steps = [
      [!!(st.club.crest || st.club.city), 'Personnaliser le club', 'Réglages → Le club : blason, couleurs, ville, catégories', '#/reglages'],
      [st.players.length > 0, 'Importer les joueurs', 'Réglages → Le club → Importer des données (photo, PDF, Excel…)', '#/reglages'],
      [st.matches.length > 0, 'Importer les matchs', 'Réglages → Le club → Importer des données → Mes matchs', '#/reglages'],
      [st.staff.length > 1, 'Ajouter les éducateurs et dirigeants', 'Importer une liste, ou Équipes → Dirigeants → Nouveau dirigeant', '#/dirigeants'],
      [!!st.ui.invited, 'Inviter les éducateurs', 'Réglages → Inviter les éducateurs (lien à envoyer par WhatsApp)', '#/reglages'],
    ];
    if (steps.every(s => s[0])) return '';
    return `<section class="card setup-card"><h2>${I.check}Mise en route du club</h2><ol class="setup-steps">${steps.map(([ok, t, how, href]) =>
      `<li class="${ok ? 'ok' : ''}"><a href="${href}"><span class="tick">${ok ? '✓' : ''}</span><span><b>${esc(t)}</b><span class="muted small">${esc(how)}</span></span></a></li>`).join('')}</ol></section>`;
  }
  // The connected coach's categories (all of them for a responsable without categories)
  function myScope() {
    const me = Auth.current(), pv = Auth.preview();
    const myIds = pv ? pv.teamIds : ((me && me.teamIds) || []), mine = myIds.map(id => Store.get('teams', id)).filter(Boolean);
    // a category goes with its teams A / B (« U15 » ↔ « U15 A », « U15 B »)
    const fam = t => String((t && (t.category || t.name)) || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, '');
    const keys = new Set(mine.map(fam));
    return { mine, isMine: tid => !mine.length || myIds.includes(tid) || keys.has(fam(Store.get('teams', tid))) };
  }
  const addDays = (d, n) => { const x = new Date(d + 'T12:00'); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  const tName = id => teamOf(id) ? ' ' + teamOf(id).name : '';
  const matchLabel = m => `Match${tName(m.teamId)} ${m.home ? 'contre' : 'chez'} ${m.opponent || '?'}`;
  // Top of the home page, made for the coach who is connected: his name, his sentence, his categories, his day
  function hero(now) {
    const me = Auth.current(), club = esc(S().club.name);
    if (!me) return `<header class="hero">${Supporters.coin('hero-crest')}<div><p class="eyebrow">Espace éducateurs</p><h1>${club}</h1></div></header>`;
    const h = new Date().getHours(), hello = h < 5 ? 'Bonsoir' : h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
    const coach = Messages.coachName(me), { mine, isMine } = myScope();
    const matchesOn = d => S().matches.filter(m => m.date === d && !m.exempt && isMine(m.teamId)).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    const todayM = matchesOn(now), todayT = S().trainings.filter(t => t.date === now && isMine(t.teamId)).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    const tomorrowM = matchesOn(addDays(now, 1));
    // The greeting follows the coach's day: match, session, eve of a match, or an ordinary day
    let title = `${hello} ${esc(coach)} 👋`, box = '';
    const items = [...todayM.map(m => `${Sport.W().icon} ${esc(matchLabel(m))}${m.time ? ' à ' + esc(m.time) : ''}`), ...todayT.map(t => `🏃 Séance${esc(tName(t.teamId))}${t.time ? ' à ' + esc(t.time) : ''}`)].slice(0, 2);
    const firstTime = (todayM[0] || todayT[0] || {}).time || '';
    if (todayM.length) { title = `Bon match, ${esc(coach)} ${Sport.W().icon}`; box = `<b>Aujourd'hui</b> · ${items.join(' · ')}<span class="hero-wx" id="heroWx"></span><i class="hero-wish">Tout le club est derrière vous. Allez ${esc(S().club.short || 'le club')} !</i>`; }
    else if (todayT.length) { title = `Bonne séance, ${esc(coach)} 💪`; box = `<b>Aujourd'hui</b> · ${items.join(' · ')}<span class="hero-wx" id="heroWx"></span><i class="hero-wish">En espérant un entraînement bénéfique pour tes joueurs !</i>`; }
    else if (tomorrowM.length) box = `<b>Demain</b> · ${Sport.W().icon} ${esc(matchLabel(tomorrowM[0]))}${tomorrowM[0].time ? ' à ' + esc(tomorrowM[0].time) : ''}<i class="hero-wish">Bonne préparation, et repose bien tes troupes !</i>`;
    // the next match of the day or of tomorrow: straight to its preparation
    const refW = Refs.waiting(); if (refW) box += `<a class="hero-prep hero-vol" href="#/arbitres">🟨 ${refW} match${refW > 1 ? 's' : ''} à domicile attend${refW > 1 ? 'ent' : ''} ta réponse (arbitre)</a> `;
    const duty = Vol.mine(2); if (duty.length) box += `<a class="hero-prep hero-vol" href="#/benevoles">🙋 ${duty.map(({ m, t }) => `${t.icon} ${esc(t.label)} ${m.date === now ? 'aujourd\'hui' : 'demain'}`).join(' · ')}</a> `;
    const prepM = todayM[0] || tomorrowM[0]; if (todayM[0]) box += `<a class="hero-prep hero-live" href="#/direct/${todayM[0].id}">📱 Match en direct</a> `; if (prepM) box += `<a class="hero-prep" href="#/jourj/${prepM.id}">🏟️ Jour de match : tout préparer${Prepa.score(prepM) ? ' · ' + Prepa.score(prepM) + ' %' : ''}</a>`;
    const redraw = () => { if (/^#?\/?$/.test(location.hash.replace('#/', '#'))) App.route(true); };
    return `<header class="hero hero-me" data-wx-time="${esc(firstTime)}">
      ${Supporters.coin('hero-crest')}
      <div class="hero-main">
        <p class="eyebrow">Espace de ${esc(coach)}<span class="eb-club"> · ${club}</span></p>
        <h1>${title}</h1>
        <p class="hero-line">${me.motto ? `« ${esc(me.motto)} »` : (Auth.isAdmin() ? 'Tout le club est entre tes mains aujourd\'hui.' : 'Prêt pour la prochaine séance ?')}</p>
        <div class="hero-chips">${mine.length ? mine.map(t => `<a class="hero-chip" href="#/equipe/${t.id}">${esc(t.name)}</a>`).join('') : Auth.isAdmin() ? '<span class="hero-chip">Responsable du club</span>' : ''}</div>
        ${box ? `<p class="hero-today">${box}</p>` : ''}
      </div>
      <div class="hero-flag">${Supporters.flag()}</div>
      ${me.club ? `<a class="hero-heart" href="#/reglages" title="Mon club de cœur : ${esc(Clubs.name(me.club))}">${Clubs.crest(me.club, 44, redraw)}<span>Mon club de cœur</span></a>` : ''}
    </header>`;
  }
  // Weather of the coach's week (sessions and matches in Le Raincy) and of his next away match
  function homeWeather(root, now) {
    const { isMine } = myScope(), end = addDays(now, 6);
    const events = [
      ...S().matches.filter(m => !m.exempt && m.date >= now && m.date <= end && isMine(m.teamId)).map(m => ({ date: m.date, time: m.time, kind: 'match', label: matchLabel(m), away: !m.home })),
      ...S().trainings.filter(t => t.date >= now && t.date <= end && isMine(t.teamId)).map(t => ({ date: t.date, time: t.time, kind: 'training', label: 'Séance' + tName(t.teamId) })),
    ];
    const trip = S().matches.filter(m => !m.home && !m.exempt && !m.played && m.date >= now && isMine(m.teamId)).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))[0];
    Weather.mount(root, events, trip);
    const hw = $('#heroWx', root);
    if (hw) Weather.todayShort($('.hero-me', root).dataset.wxTime).then(t => { if (t && hw.isConnected) hw.textContent = ' · ' + t; });
  }
  function home(root) {
    const now = today();
    const matches = byTeam(S().matches), trainings = byTeam(S().trainings);
    const next = matches.filter(m => !m.played && m.date >= now).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
    const nextTr = trainings.filter(t => t.date >= now).sort((a, b) => a.date.localeCompare(b.date))[0];
    const last = matches.filter(m => m.played).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
    const schemas = S().schemas.filter(s => Auth.sees(s.teamId)).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 4);
    root.innerHTML = `${hero(now)}
      ${serverBanner()}
      ${teamSwitch()}
      ${setupCard()}
      ${Quick.matchDayCard()}
      ${Quick.tomorrowCard()}
      ${Quick.backupCard()}
      ${President.homeReminder()}
      ${Weather.placeholder()}
      <div class="quick">
        <button class="quick-btn" data-go="new-schema">${I.board}<b>Dessiner un exercice</b><span>Joueurs, flèches, zones</span></button>
        <button class="quick-btn" data-go="new-training">${I.training}<b>Préparer un entraînement</b><span>Exercices et PDF</span></button>
        <button class="quick-btn" data-go="new-match">${I.match}<b>Ajouter un match</b><span>Convocation et score</span></button>
        <a class="quick-btn" href="#/bibliotheque">${I.upload}<b>Importer vidéo ou PDF</b><span>Dessiner dessus, créer une séance</span></a>
      </div>
      <div class="cards2">
        ${ClubLife.homeCard()}
        <section class="card">
          <h2>${I.match}Prochain match</h2>
          ${next ? `<a class="rowlink ${side(next)}" href="#/match/${next.id}"><div><b>${matchTitle(next)}</b><span>${esc(fmtDate(next.date, { weekday: 'long', day: 'numeric', month: 'long' }))} · ${esc(next.time || '')} · ${next.home ? 'Domicile' : 'Extérieur'}</span></div>${I.next}</a>` : `<p class="muted">Aucun match prévu.</p>`}
        </section>
        <section class="card">
          <h2>${I.training}Prochain entraînement</h2>
          ${nextTr ? `<a class="rowlink" href="#/entrainement/${nextTr.id}"><div><b>${esc(nextTr.title || 'Entraînement')}</b><span>${esc(fmtDate(nextTr.date, { weekday: 'long', day: 'numeric', month: 'long' }))} · ${nextTr.exercises.length} exercice${nextTr.exercises.length > 1 ? 's' : ''}</span></div>${I.next}</a>` : `<p class="muted">Aucun entraînement prévu.</p>`}
        </section>
        <section class="card">
          <h2>${I.calendar}Mes créneaux (7 jours)</h2>
          <div id="planMini"><p class="muted">Chargement…</p></div>
          <a class="btn soft" href="#/planning" style="margin-top:8px">${I.calendar}<span>Ouvrir le planning</span></a>
        </section>
        ${Results.homeCard()}
        <section class="card">
          <h2>${I.stats}Derniers résultats</h2>
          ${last.length ? `<ul class="res-list">${last.map(m => `<li><a class="${side(m)}" href="#/match/${m.id}"><span class="d">${esc(fmtDate(m.date))}</span><span class="o">${lastTeams(m)}</span><span class="s">${scoreTxt(m)}</span>${resPill(m)}</a></li>`).join('')}</ul>` : `<p class="muted">Pas encore de résultat.</p>`}
        </section>
        <section class="card">
          <h2>${I.board}Derniers schémas</h2>
          ${schemas.length ? `<div class="mini-grid">${schemas.map(s => `<a href="#/schema/${s.id}" class="mini"><img alt="" src="${UI.thumb(s, 320, 208)}"><span>${esc(s.name)}</span></a>`).join('')}</div>` : `<p class="muted">Aucun schéma.</p>`}
        </section>
      </div>`;
    bindTeamSwitch(root, () => home(root));
    Planning.upcoming($('#planMini', root));
    homeWeather(root, now);
    const cb = $('[data-connect]', root); if (cb) cb.onclick = () => Auth.connectServer();
    const bk = $('[data-backup]', root); if (bk) bk.onclick = () => President.saveNow();
    $$('[data-qbackup]', root).forEach(b => b.onclick = () => Quick.backupClick(b));
    President.checkAuto();
    $$('[data-go]', root).forEach(b => b.onclick = () => ({ 'new-schema': newSchema, 'new-training': newTraining, 'new-match': newMatch })[b.dataset.go]());
  }

  /* ================= Équipes ================= */
  function teams(root) {
    const count = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;
    root.innerHTML = `${header('Équipes', 'Les catégories du club, leurs joueurs et leurs dirigeants',
      `<a class="btn" href="#/joueurs">${I.team}<span>${Auth.isAdmin() ? 'Tous les joueurs' : 'Mes joueurs'} (${S().players.filter(Auth.seesPerson).length})</span></a>
       <a class="btn" href="#/dirigeants">${I.whistle}<span>Dirigeants (${S().staff.filter(Auth.seesPerson).length})</span></a>
       <a class="btn" href="#/progression">📈<span>Progression</span></a>
       <a class="btn" href="#/tests">🏃<span>Tests physiques</span></a>
       <a class="btn" href="#/infirmerie">🚑<span>Infirmerie${Health.count() ? ' (' + Health.count() + ')' : ''}</span></a>
       ${Auth.isAdmin() ? `<button class="btn" data-act="bybirth">${I.calendar}<span>Ranger par année de naissance</span></button>` : ''}
       ${Auth.isAdmin() ? `<button class="btn primary" data-act="new">${I.plus}<span>Nouvelle catégorie</span></button>` : ''}`)}
      ${Auth.teams().length ? `<div class="grid">${Store.teamGroups(Auth.teams()).map(g => {
        const nums = t => `${count(Store.playersOf(t.id).length, 'joueur')} · ${count(Store.staffOf(t.id).length, 'dirigeant')}`;
        const [main, ...subs] = Store.isMain(g[0]) ? g : [null, ...g];
        // the category card, with its teams A / B inside
        return `<div class="card team-card team-fam-card">${main ? `<a class="team-main" href="#/equipe/${main.id}"><span class="badge">${fmtLabel(main.format)}</span><h2>${esc(main.name)}</h2><p class="muted">${nums(main)}</p></a>` : ''}
          ${subs.map(t => `<a class="team-sub" href="#/equipe/${t.id}"><b>${main ? '↳ ' : ''}${esc(t.name)}</b><span class="muted">${nums(t)}</span></a>`).join('')}</div>`; }).join('')}</div>`
        : empty('Crée ta première catégorie pour ajouter tes joueurs.')}`;
    const nb = $('[data-act="new"]', root); if (nb) nb.onclick = newTeam;
    const bb = $('[data-act="bybirth"]', root); if (bb) bb.onclick = () => People.sortByBirthDialog(() => teams(root));
  }
  function newTeam() {
    modal({ title: 'Nouvelle catégorie', body: `
      <label class="fld"><span>Nom</span><input id="tName" placeholder="ex : U11 A" maxlength="40"></label>
      <label class="fld"><span>Catégorie</span><input id="tCat" placeholder="ex : U11, Seniors" maxlength="20"></label>
      <div class="lbl">Format</div><div class="chips" id="tFmt">${formats().map(([v, l], i) => `<button class="chip ${i ? '' : 'on'}" data-v="${v}">${l}</button>`).join('')}</div>`,
      onOpen: r => $$('#tFmt .chip', r).forEach(b => b.onclick = () => { $$('#tFmt .chip', r).forEach(x => x.classList.remove('on')); b.classList.add('on'); }),
      actions: [{ label: 'Annuler' }, { label: 'Créer', kind: 'primary', onClick: (c, r) => {
        const name = $('#tName', r).value.trim(); if (!name) { toast('Donne un nom à la catégorie', 'err'); return false; }
        const t = Store.upsert('teams', { id: Store.uid(), name, category: $('#tCat', r).value.trim() || name, format: $('#tFmt .on', r).dataset.v });
        S().ui.teamId = t.id; location.hash = '#/equipe/' + t.id;
      } }] });
  }
  function team(root, id) {
    const t = teamOf(id); if (!t || !Auth.sees(t.id)) return (location.hash = '#/equipes');
    const save = () => Store.upsert('teams', t);
    const render = () => {
      root.innerHTML = `${header(`<input class="h1-input" id="tName" value="${esc(t.name)}" aria-label="Nom de la catégorie">`, `${fmtLabel(t.format)} · ${Store.playersOf(t.id).length} joueurs`,
        `<a class="btn" href="#/equipes">${I.back}<span>Équipes</span></a>`)}
        <section class="card">
          <div class="row-head"><label class="fld inline"><span>Catégorie</span><input id="tCat" value="${esc(t.category || '')}" maxlength="20"></label>
          <div class="chips">${formats().map(([v, l]) => `<button class="chip ${t.format === v ? 'on' : ''}" data-fmt="${v}">${l}</button>`).join('')}</div></div>
          ${Auth.isAdmin() && Importer.letterNo(t) ? `<label class="fld" style="margin-top:12px"><span>Nom au District (pour ranger les matchs importés)</span><select id="tDistrict">${[1, 2, 3, 4].map(n => `<option value="${n}" ${Importer.districtNo(t) === n ? 'selected' : ''}>${esc(S().club.name)}${n > 1 ? ' ' + n : ''}</option>`).join('')}</select></label>` : ''}
        </section>
        <div id="teamPeople"></div>
        ${Cloud.ready() ? Parents.teamCard(t) : ''}
        ${Auth.isAdmin() ? `<div class="danger-zone"><button class="btn danger" data-act="delete">${I.trash}<span>Supprimer la catégorie</span></button></div>` : ''}`;
      const box = $('#teamPeople', root);
      const people = () => { box.innerHTML = People.teamSections(t); $('.sub', root).textContent = `${fmtLabel(t.format)} · ${Store.playersOf(t.id).length} joueurs`; };
      people(); People.bindTeamSections(box, t, people);
    };
    render();
    root.onchange = e => {
      if (e.target.id !== 'tDistrict') return;
      t.districtNo = +e.target.value; save();
      // the other team of the category takes the other number, then the imported matches are put back in the right team
      const others = S().teams.filter(x => x.id !== t.id && Importer.letterNo(x) && (x.category || '') === (t.category || ''));
      const clash = others.find(x => Importer.districtNo(x) === t.districtNo); if (clash) { const free = [1, 2, 3, 4].find(n => ![t, ...others].some(x => x !== clash && Importer.districtNo(x) === n)); clash.districtNo = free; Store.upsert('teams', clash); }
      const n = Importer.reassignImported(t.category || t.name);
      toast(n ? `${n} match${n > 1 ? 's' : ''} rangé${n > 1 ? 's' : ''} dans la bonne équipe` : 'Numéro enregistré');
    };
    root.oninput = e => {
      if (e.target.id === 'tName') { t.name = e.target.value; save(); }
      if (e.target.id === 'tCat') { t.category = e.target.value; save(); }
    };
    root.onclick = async e => {
      const b = e.target.closest('button'); if (!b || b.closest('#teamPeople')) return;
      if (b.dataset.parents) return Parents.shareDialog(b.dataset.parents);
      if (b.dataset.players) return Parents.sharePlayers(b.dataset.players);
      if (b.dataset.fmt) { t.format = b.dataset.fmt; save(); return render(); }
      if (b.dataset.act === 'delete' && await confirmBox(`Supprimer la catégorie ${t.name} ? Les joueurs et dirigeants restent dans le club.`)) {
        [...S().players, ...S().staff].forEach(p => p.teamIds = (p.teamIds || []).filter(x => x !== t.id));
        Store.remove('teams', t.id); location.hash = '#/equipes';
      }
    };
  }

  /* ================= Schémas ================= */
  function schemas(root) {
    const filt = S().ui.schemaFilter || '';
    const list = S().schemas.filter(s => Auth.sees(s.teamId) && (!filt || s.field.format === filt)).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    root.innerHTML = `${header('Schémas', 'Exercices et tactiques animés', `<a class="btn" href="#/bibliotheque">${I.video}<span>Bibliothèque</span></a><button class="btn" data-act="import">${I.upload}<span>Recevoir</span></button><button class="btn" data-act="fromFile">${I.pdf}<span>Depuis un fichier (PDF, image, vidéo)</span></button><button class="btn" data-act="board">${I.edit}<span>Tableau blanc</span></button><button class="btn" data-act="models">${I.layers}<span>Modèles</span></button><button class="btn primary" data-act="new">${I.plus}<span>Nouveau schéma</span></button>`)}
      <div class="chips filter">${[['', 'Tous'], ...formats(), ['zone', 'Zones libres']].map(([v, l]) => `<button class="chip ${v === filt ? 'on' : ''}" data-f="${v}">${l}</button>`).join('')}</div>
      ${list.length ? `<div class="grid">${list.map(s => `<article class="card schema-card">
          <a href="#/schema/${s.id}" class="thumb"><img alt="" src="${UI.thumb(s)}"></a>
          <div class="sc-meta"><a href="#/schema/${s.id}"><b>${esc(s.name)}</b></a><span class="muted">${s.field.format === 'zone' ? `Zone ${s.field.w}×${s.field.h} m` : fmtLabel(s.field.format)} · ${s.steps.length} étape${s.steps.length > 1 ? 's' : ''}</span></div>
          <div class="sc-actions"><button class="icon-btn" data-dup="${s.id}" aria-label="Dupliquer">${I.copy}</button><button class="icon-btn danger" data-del="${s.id}" aria-label="Supprimer">${I.trash}</button></div>
        </article>`).join('')}</div>` : empty('Aucun schéma ici.', `<button class="btn primary" data-act="new">${I.plus}<span>Dessiner un schéma</span></button>`)}`;
    root.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.f !== undefined && b.classList.contains('chip')) { S().ui.schemaFilter = b.dataset.f; Store.save(); return schemas(root); }
      if (b.dataset.act === 'new') return newSchema();
      if (b.dataset.act === 'models') return pickTemplate();
      if (b.dataset.act === 'board') return whiteboard();
      if (b.dataset.act === 'import') return importFile();
      if (b.dataset.act === 'fromFile') return Library.schemasFromFiles();
      if (b.dataset.dup) { const s = JSON.parse(JSON.stringify(Store.get('schemas', b.dataset.dup))); s.id = Store.uid(); s.name += ' (copie)'; Store.upsert('schemas', s); return schemas(root); }
      if (b.dataset.del) { const s = Store.get('schemas', b.dataset.del); if (await confirmBox(`Supprimer « ${s.name} » ?`)) { Store.remove('schemas', s.id); schemas(root); } }
    };
  }
  function blankSchema(name, field, teamId) {
    return { id: Store.uid(), name, teamId: teamId || null, field, overlays: {}, objects: [], zones: [], steps: [{ pos: {}, arrows: [], moves: {}, note: '', dur: 2 }] };
  }
  // Ready-made exercises: the coach picks one, it becomes his own schema (animated, with notes) that he adapts
  let tplThumbs = null;
  function pickTemplate(opts = {}) {
    // the other sports: their base exercises, already animated by the app
    if (!Sport.isFoot()) {
      const list = Exos.all().filter(e => e.base);
      const close = modal({ title: `Modèles · ${Sport.cur().icon} ${Sport.cur().label}`, noFocus: true,
        body: `<p class="muted small">Chaque modèle est animé : touche-le pour en faire ton schéma, puis change ce que tu veux.</p><div class="pick-grid">${list.map(e => `<button class="pick" data-atpl="${esc(e.id)}"><img alt="" src="${UI.thumb(AutoSchema.preview(e), 320, 208)}"><span><b>${esc(e.title)}</b><span class="muted small">${e.duration} min</span></span></button>`).join('')}</div>`,
        onOpen: r => $$('[data-atpl]', r).forEach(b => b.onclick = () => { const e = list.find(x => x.id === b.dataset.atpl); const sc = AutoSchema.save(e, opts.teamId || activeTeam()); close(); if (opts.onCreate) opts.onCreate(sc); location.hash = '#/schema/' + sc.id; }) });
      return;
    }
    const t = teamOf(opts.teamId || activeTeam());
    if (!tplThumbs) tplThumbs = Object.fromEntries(Templates.LIST.map(x => [x.key, UI.thumb(x.build(), 320, 208)]));
    const close = modal({ title: 'Partir d\'un modèle', noFocus: true,
      body: `<p class="muted small">Le modèle devient ton schéma : déplace les joueurs, change les consignes, ajoute des étapes. Touche « Jouer » pour voir l'animation.</p>
        <div class="pick-grid">${Templates.LIST.map(x => `<button class="pick" data-tpl="${x.key}"><img alt="" src="${tplThumbs[x.key]}"><span><b>${esc(x.name)}</b><br><i class="muted small">${esc(x.desc)}</i></span></button>`).join('')}</div>`,
      onOpen: r => $$('[data-tpl]', r).forEach(b => b.onclick = () => {
        close(); const sc = Templates.create(b.dataset.tpl, t ? t.id : null);
        if (opts.onCreate) opts.onCreate(sc);
        location.hash = '#/schema/' + sc.id;
      }) });
  }
  // Whiteboard: a blank pitch, full screen, nothing saved (to explain something at half-time or in the changing room)
  function whiteboard() {
    const t = teamOf(activeTeam()), fmt = t ? t.format : Sport.defFormat();
    const close = modal({ title: 'Tableau blanc', noFocus: true,
      body: `<p>Un terrain vierge en plein écran pour expliquer une idée tout de suite (mi-temps, vestiaire, causerie). <b>Rien n'est enregistré</b> : en quittant, le dessin disparaît, sauf si tu touches « Garder ».</p>
        <div class="lbl">Terrain</div><div class="chips">${[...formats(), ['zone', 'Zone libre']].map(([v, l]) => `<button class="chip ${v === fmt ? 'on' : ''}" data-wb="${v}">${l}</button>`).join('')}</div>`,
      onOpen: r => $$('[data-wb]', r).forEach(b => b.onclick = () => {
        close();
        // the tap itself asks for full screen (browsers only allow it right after a touch)
        const d = document.documentElement, fs = d.requestFullscreen || d.webkitRequestFullscreen;
        if (fs) { try { const p = fs.call(d); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
        location.hash = '#/tableau/' + b.dataset.wb;
      }) });
  }
  function newSchema(opts = {}) {
    const t = teamOf(opts.teamId || activeTeam());
    modal({ title: 'Nouveau schéma', body: `
      <button class="btn soft wide" id="sTpl" type="button">${I.layers}<span>Partir d'un modèle (rondo, 3 contre 2, conservation…)</span></button>
      <label class="fld"><span>Nom</span><input id="sName" value="${esc(opts.name || '')}" placeholder="ex : Conservation 5 contre 5" maxlength="80"></label>
      <div class="lbl">Terrain</div>
      <div class="chips" id="sFmt">${[...formats(), ['zone', 'Zone libre']].map(([v, l]) => `<button class="chip ${v === (t ? t.format : Sport.defFormat()) ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}</div>
      <div class="chips" id="sView"><button class="chip on" data-v="full">Terrain entier</button><button class="chip" data-v="half">Demi-terrain</button></div>
      <div class="row2" id="sDims" hidden><label class="fld"><span>Longueur (m)</span><input type="number" id="sW" value="30" min="5" max="110"></label><label class="fld"><span>Largeur (m)</span><input type="number" id="sH" value="20" min="5" max="75"></label></div>`,
      onOpen: (r, close) => {
        $('#sTpl', r).onclick = () => { close(); setTimeout(() => pickTemplate(opts), 60); };
        const pick = id => $$(`#${id} .chip`, r).forEach(b => b.onclick = () => { $$(`#${id} .chip`, r).forEach(x => x.classList.remove('on')); b.classList.add('on'); sync(); });
        const sync = () => { const z = $('#sFmt .on', r).dataset.v === 'zone'; $('#sDims', r).hidden = !z; $('#sView', r).hidden = z; };
        pick('sFmt'); pick('sView'); sync();
      },
      actions: [{ label: 'Annuler' }, { label: 'Créer', kind: 'primary', onClick: (c, r) => {
        const format = $('#sFmt .on', r).dataset.v;
        const field = format === 'zone' ? { format, view: 'full', w: Board.clamp(+$('#sW', r).value || 30, 5, 110), h: Board.clamp(+$('#sH', r).value || 20, 5, 75) } : { format, view: $('#sView .on', r).dataset.v };
        const s = Store.upsert('schemas', blankSchema($('#sName', r).value.trim() || 'Nouveau schéma', field, t && t.format === format ? t.id : null));
        if (opts.onCreate) opts.onCreate(s);
        location.hash = '#/schema/' + s.id;
      } }] });
  }

  /* ================= Entraînements ================= */
  function trainings(root) {
    const now = today(), list = byTeam(S().trainings).filter(t => !t.model), models = S().trainings.filter(t => t.model).sort((a, b) => String(a.title).localeCompare(String(b.title), 'fr'));
    const up = list.filter(t => t.date >= now).sort((a, b) => a.date.localeCompare(b.date)), past = list.filter(t => t.date < now).sort((a, b) => b.date.localeCompare(a.date));
    const item = t => { const tm = teamOf(t.teamId), dur = t.exercises.reduce((a, e) => a + (+e.duration || 0), 0);
      return `<a class="list-item" href="#/entrainement/${t.id}"><div class="date-box"><b>${new Date(t.date + 'T12:00').getDate()}</b><span>${esc(fmtDate(t.date, { month: 'short' }))}</span></div>
        <div class="li-main"><b>${esc(t.title || 'Entraînement')}</b><span class="muted">${tm ? esc(tm.name) + ' · ' : ''}${t.exercises.length} exercice${t.exercises.length > 1 ? 's' : ''} · ${dur} min</span></div>${I.next}</a>`; };
    root.innerHTML = `${header('Entraînements', 'Séances, exercices et présences', `<a class="btn primary" href="#/systemes">📚<span>Séances par système de jeu</span></a><button class="btn" data-act="import">${I.upload}<span>Recevoir</span></button><button class="btn" data-act="ics">${I.calendar}<span>Agenda (.ics)</span></button><a class="btn" href="#/bibliotheque">${I.pdf}<span>Importer une fiche PDF</span></a><a class="btn" href="#/exercices">📚<span>Exercices du club</span></a><button class="btn" data-exgen>✨<span>Générer une séance</span></button><button class="btn primary" data-act="new">${I.plus}<span>Nouvel entraînement</span></button>`)}
      ${teamSwitch()}
      <details class="card models-card" ${S().ui.modelsOpen ? 'open' : ''}><summary><b>📚 Séances types du club (${models.length})</b><span class="muted small"> · des séances prêtes, pour toutes les catégories</span></summary>
        ${models.length ? `<div class="list">${models.map(t => `<div class="list-item model-item"><a class="li-main" href="#/entrainement/${t.id}"><b>${esc(t.title || 'Séance type')}</b><span class="muted">${t.exercises.length} exercice${t.exercises.length > 1 ? 's' : ''} · ${t.exercises.reduce((a, e) => a + (+e.duration || 0), 0)} min${t.goal ? ' · ' + esc(String(t.goal).slice(0, 60)) : ''}</span></a><button class="btn primary" data-use="${t.id}">${I.plus}<span>Utiliser</span></button></div>`).join('')}</div>`
          : '<p class="muted small">Pas encore de séance type. Dans une séance réussie, touche « Enregistrer comme séance type » (en bas) : elle servira à tous les coachs.</p>'}</details>
      <h2 class="section">À venir</h2>${up.length ? `<div class="list">${up.map(item).join('')}</div>` : '<p class="muted">Aucun entraînement prévu.</p>'}
      <h2 class="section">Passés</h2>${past.length ? `<div class="list">${past.map(item).join('')}</div>` : '<p class="muted">Rien pour l\'instant.</p>'}`;
    bindTeamSwitch(root, () => trainings(root));
    $('[data-act="new"]', root).onclick = newTraining;
    $('[data-act="import"]', root).onclick = importFile;
    $('[data-act="ics"]', root).onclick = () => Importer.trainingsFromICS(() => trainings(root));
    $('.models-card', root).ontoggle = e => { S().ui.modelsOpen = e.target.open; Store.persistNow(); };
    $$('[data-use]', root).forEach(b => b.onclick = () => copyTraining(Store.get('trainings', b.dataset.use), 'use'));
  }
  // A session copied for a category and a date (from a template session, or « Dupliquer » towards another category)
  function copyTraining(tr, how) {
    const t = how === 'use' ? activeTeam() : tr.teamId;
    modal({ title: how === 'use' ? `Utiliser « ${tr.title} »` : 'Dupliquer la séance', body: `
      <label class="fld"><span>Pour la catégorie</span><select id="cpTeam"><option value="">Aucune</option>${Auth.teams().map(x => `<option value="${x.id}" ${x.id === t ? 'selected' : ''}>${esc(Store.teamLabel(x))}</option>`).join('')}</select></label>
      <div class="row2"><label class="fld"><span>Date</span><input type="date" id="cpDate" value="${today()}"></label><label class="fld"><span>Heure</span><input type="time" id="cpTime" value="${esc(tr.time || '18:00')}"></label></div>
      <p class="muted small">Les exercices, consignes et schémas${how === 'use' ? ' et documents' : ''} sont copiés. Les présences et les notes repartent à zéro.</p>`,
      actions: [{ label: 'Annuler' }, { label: 'Créer la séance', kind: 'primary', onClick: (c, r) => {
        const n = JSON.parse(JSON.stringify(tr)); n.id = Store.uid(); delete n.model; delete n.ratings; if (how !== 'use') delete n.docIds;
        Object.assign(n, { teamId: $('#cpTeam', r).value || null, date: $('#cpDate', r).value || today(), time: $('#cpTime', r).value, presents: [], staffIds: [] });
        if (how !== 'use') n.title = tr.title + (n.teamId === tr.teamId ? ' (copie)' : '');
        n.exercises.forEach(x => x.id = Store.uid()); Store.upsert('trainings', n); toast('Séance créée'); location.hash = '#/entrainement/' + n.id;
      } }] });
  }
  function newTraining() {
    const t = activeTeam();
    modal({ title: 'Nouvel entraînement', body: `
      <label class="fld"><span>Thème</span><input id="trTitle" placeholder="ex : Sortie de balle à 3" maxlength="80"></label>
      <div class="row2"><label class="fld"><span>Date</span><input type="date" id="trDate" value="${today()}"></label><label class="fld"><span>Heure</span><input type="time" id="trTime" value="18:00"></label></div>
      <label class="fld"><span>Équipe</span><select id="trTeam"><option value="">Aucune</option>${Auth.teams().map(x => `<option value="${x.id}" ${x.id === t ? 'selected' : ''}>${esc(Store.teamLabel(x))}</option>`).join('')}</select></label>`,
      actions: [{ label: 'Annuler' }, { label: 'Créer', kind: 'primary', onClick: (c, r) => {
        const tr = Store.upsert('trainings', { id: Store.uid(), title: $('#trTitle', r).value.trim() || 'Entraînement', date: $('#trDate', r).value || today(), time: $('#trTime', r).value, teamId: $('#trTeam', r).value || null, goal: '', exercises: [], presents: [] });
        location.hash = '#/entrainement/' + tr.id;
      } }] });
  }
  function training(root, id) {
    const tr = Store.get('trainings', id); if (!tr || !Auth.sees(tr.teamId)) return (location.hash = '#/entrainements');
    const save = () => Store.upsert('trainings', tr);
    const render = () => {
      const tm = teamOf(tr.teamId), total = tr.exercises.reduce((a, e) => a + (+e.duration || 0), 0);
      if (tr.model) return renderModel(total);
      root.innerHTML = `${header(`<input class="h1-input" id="trTitle" value="${esc(tr.title)}" aria-label="Thème">`, `${total} min au total`,
        `<button class="btn" data-act="share">${I.share}<span>Envoyer</span></button><button class="btn primary" data-act="pdf">${I.pdf}<span>PDF</span></button>`)}
        <section class="card">
          <div class="row3">
            <label class="fld"><span>Date</span><input type="date" id="trDate" value="${esc(tr.date)}"></label>
            <label class="fld"><span>Heure</span><input type="time" id="trTime" value="${esc(tr.time || '')}"></label>
            <label class="fld"><span>Équipe</span><select id="trTeam"><option value="">Aucune</option>${Auth.teams().map(x => `<option value="${x.id}" ${x.id === tr.teamId ? 'selected' : ''}>${esc(Store.teamLabel(x))}</option>`).join('')}</select></label>
          </div>
          <label class="fld"><span>Objectif de la séance</span><textarea id="trGoal" rows="2" placeholder="ex : jouer vers l'avant après la récupération">${esc(tr.goal || '')}</textarea></label>
        </section>
        <h2 class="section">Exercices</h2>
        <div class="ex-list">${tr.exercises.map((e, i) => exerciseCard(e, i, tr.exercises.length)).join('') || '<p class="muted">Ajoute ton premier exercice.</p>'}</div>
        <div class="chips"><button class="btn primary" data-act="addEx">${I.plus}<span>Ajouter un exercice</span></button><button class="btn" data-act="exClub">📚<span>Exercices du club</span></button><button class="btn" data-act="exFile">📥<span>Depuis un fichier (PDF, photo)</span></button></div>
        <h2 class="section">Encadrants</h2><div class="staff-pick">${People.staffPicker(tr.teamId, tr.staffIds)}</div>
        ${tm ? `<div class="row-head"><h2 class="section" id="presH">Présents (${(tr.presents || []).length}/${squad(tm.id).length})</h2>
          <div class="chips"><button class="btn soft" data-allpres="1">${I.check}<span>Tous présents</span></button><button class="btn soft" data-allpres="0">${I.x}<span>Personne</span></button></div></div>
          <p class="muted small">Un toucher par joueur. Le % est sa présence sur la saison (séances où l'appel a été fait).</p>
          ${rosterChips(tm.id, p => `<button class="chip ${(tr.presents || []).includes(p.id) ? 'on' : ''}" data-present="${p.id}">${presChip(p, tm.id)}</button>`)}` : ''}
        <div id="trAnsBox"></div>
        <div id="rateBox"></div>
        <div id="rpeBox"></div>
        <div id="docsBox">${Library.docsPlaceholder()}</div>
        ${Media.placeholder('training:' + tr.id, 'Photos et vidéos de la séance')}
        <div class="danger-zone"><button class="btn" data-act="dup">${I.copy}<span>Dupliquer (autre date ou catégorie)</span></button><button class="btn" data-act="model">📚<span>Enregistrer comme séance type</span></button><button class="btn danger" data-act="delete">${I.trash}<span>Supprimer</span></button></div>`;
      const box = $('#rateBox', root); if (box) Ratings.bind(box, tr, save);
      rateTr(); Media.mount(root); Library.mountDocs($('#docsBox', root), tr, save);
      Parents.mountTraining($('#trAnsBox', root), tr, ids => { tr.presents = [...new Set([...(tr.presents || []), ...ids])]; save(); render(); toast('Présents annoncés cochés'); });
    };
    const renderModel = total => {
      root.innerHTML = `${header(`<input class="h1-input" id="trTitle" value="${esc(tr.title)}" aria-label="Thème">`, `📚 Séance type du club · ${total} min`,
        `<a class="btn" href="#/entrainements">${I.back}<span>Séances</span></a><button class="btn" data-act="pdf">${I.pdf}<span>PDF</span></button><button class="btn primary" data-act="use">${I.plus}<span>Utiliser pour une séance</span></button>`)}
        <p class="tip">Une séance type sert de modèle à tous les coachs du club : « Utiliser » la copie pour une catégorie et une date. Ce que tu changes ici change le modèle.</p>
        <section class="card"><label class="fld"><span>Objectif de la séance</span><textarea id="trGoal" rows="2">${esc(tr.goal || '')}</textarea></label></section>
        <h2 class="section">Exercices</h2>
        <div class="ex-list">${tr.exercises.map((e, i) => exerciseCard(e, i, tr.exercises.length)).join('') || '<p class="muted">Ajoute ton premier exercice.</p>'}</div>
        <div class="chips"><button class="btn primary" data-act="addEx">${I.plus}<span>Ajouter un exercice</span></button><button class="btn" data-act="exClub">📚<span>Exercices du club</span></button><button class="btn" data-act="exFile">📥<span>Depuis un fichier (PDF, photo)</span></button></div>
        <div id="docsBox">${Library.docsPlaceholder()}</div>
        <div class="danger-zone"><button class="btn danger" data-act="delete">${I.trash}<span>Supprimer la séance type</span></button></div>`;
      Library.mountDocs($('#docsBox', root), tr, save);
    };
    const presChip = (p, teamId) => `${Health.flag(p, tr.date)}<span>${chipLabel(p)}</span>${People.pctBadge(People.attendance(p, teamId))}`;
    const rateTr = () => { const box = $('#rateBox', root); if (box) box.innerHTML = Ratings.section(tr, Store.rosterOf(tr.teamId || '').filter(p => (tr.presents || []).includes(p.id)), 'training'); rpeTr(); };
    // the effort of the players present (RPE), for the training load
    const rpeTr = () => { const box = $('#rpeBox', root); if (box) box.innerHTML = Health.rpeBox(tr, Store.rosterOf(tr.teamId || '').filter(p => (tr.presents || []).includes(p.id)).map(p => p.id), 'training'); };
    const exerciseCard = (e, i, n) => {
      const sc = e.schemaId && Store.get('schemas', e.schemaId);
      return `<article class="card ex" data-ex="${e.id}">
        <div class="ex-head"><span class="ex-num">${i + 1}</span><input class="ex-title" data-f="title" value="${esc(e.title)}" placeholder="Nom de l'exercice">
          <label class="dur"><input type="number" min="0" max="180" data-f="duration" value="${esc(e.duration)}" aria-label="Durée en minutes"><span>min</span></label>
          <button class="icon-btn" data-mv="-1" ${i === 0 ? 'disabled' : ''} aria-label="Monter">${I.up}</button><button class="icon-btn" data-mv="1" ${i === n - 1 ? 'disabled' : ''} aria-label="Descendre">${I.down}</button>
          <button class="icon-btn danger" data-delex aria-label="Supprimer l'exercice">${I.trash}</button></div>
        <div class="ex-body">
          <div class="ex-fields">
            <label class="fld"><span>Organisation</span><textarea rows="2" data-f="org" placeholder="Taille du terrain, nombre de joueurs, déroulement">${esc(e.org || '')}</textarea></label>
            <label class="fld"><span>Consignes (une par ligne)</span><textarea rows="3" data-f="consignes" placeholder="Passe au sol&#10;Je regarde avant de recevoir">${esc(e.consignes || '')}</textarea></label>
            <label class="fld"><span>Matériel</span><input data-f="materiel" value="${esc(e.materiel || '')}" placeholder="plots, chasubles, ballons"></label>
          </div>
          <div class="ex-schema">${sc ? `<a href="#/schema/${sc.id}" class="thumb"><img alt="" src="${UI.thumb(sc)}"></a><div class="chips"><a class="btn soft" href="#/schema/${sc.id}">${I.edit}<span>Modifier le schéma</span></a><button class="btn soft" data-pick>${I.layers}<span>Changer</span></button></div>`
            : `<button type="button" class="thumb auto-thumb" data-big title="Voir en grand"><img alt="" src="${UI.thumb(AutoSchema.preview(e))}"><span class="auto-tag">✨ Schéma proposé</span></button><div class="chips"><button class="btn primary" data-auto>✨<span>Utiliser ce schéma animé</span></button><button class="btn soft" data-draw>${I.board}<span>Dessiner moi-même</span></button><button class="btn soft" data-pick>${I.layers}<span>Choisir</span></button></div>`}
            <button type="button" class="btn soft ex-bigbtn" data-big>🔍<span>Voir en grand (à montrer aux joueurs)</span></button></div>
        </div></article>`;
    };
    render();
    root.oninput = e => {
      const t = e.target, card = t.closest('[data-ex]');
      if (card) { const ex = tr.exercises.find(x => x.id === card.dataset.ex); ex[t.dataset.f] = t.dataset.f === 'duration' ? +t.value : t.value; save(); if (t.dataset.f === 'duration') $('.sub', root).textContent = tr.exercises.reduce((a, x) => a + (+x.duration || 0), 0) + ' min au total'; return; }
      const map = { trTitle: 'title', trDate: 'date', trTime: 'time', trGoal: 'goal' };
      if (map[t.id]) { tr[map[t.id]] = t.value; save(); }
    };
    root.onchange = e => {
      if (e.target.id === 'trTeam') { tr.teamId = e.target.value || null; save(); render(); }
      if (e.target.hasAttribute('data-staffpick') && e.target.value) { tr.staffIds = [...new Set([...(tr.staffIds || []), e.target.value])]; save(); render(); }
    };
    root.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (Health.rpeClick(e, tr, tr.presents || [], () => { save(); rpeTr(); })) return;
      const card = b.closest('[data-ex]'), ex = card && tr.exercises.find(x => x.id === card.dataset.ex);
      if (b.dataset.present) {
        const p = tr.presents = tr.presents || [], i = p.indexOf(b.dataset.present); i < 0 ? p.push(b.dataset.present) : p.splice(i, 1); save();
        // the season % of every chip moves too (this session now counts, or no longer counts)
        $$('[data-present]', root).forEach(c => { const pl = Store.get('players', c.dataset.present); c.classList.toggle('on', p.includes(c.dataset.present)); if (pl) c.innerHTML = presChip(pl, tr.teamId); });
        $('#presH', root).textContent = `Présents (${p.length}/${squad(tr.teamId).length})`; rateTr(); return;
      }
      if (b.dataset.rsort) { S().ui.rosterSort = b.dataset.rsort; Store.persistNow(); return render(); }
      if (b.dataset.allpres) {
        if (b.dataset.allpres === '0' && (tr.presents || []).length && !(await confirmBox('Décocher tous les présents de cette séance ?', 'Décocher'))) return;
        tr.presents =b.dataset.allpres === '1' ? squad(tr.teamId).map(p => p.id) : []; save(); return render(); }
      if (b.dataset.unstaff) { tr.staffIds = (tr.staffIds || []).filter(x => x !== b.dataset.unstaff); save(); return render(); }
      if (b.dataset.mv) { const i = tr.exercises.indexOf(ex), j = i + +b.dataset.mv; [tr.exercises[i], tr.exercises[j]] = [tr.exercises[j], tr.exercises[i]]; save(); return render(); }
      if (b.hasAttribute('data-delex')) { if (await confirmBox(`Retirer l'exercice « ${ex.title || 'sans nom'} » ?`, 'Retirer')) { tr.exercises = tr.exercises.filter(x => x !== ex); save(); render(); } return; }
      if (b.hasAttribute('data-big')) return AutoSchema.big(ex, ex.schemaId && Store.get('schemas', ex.schemaId));
      if (b.hasAttribute('data-auto')) { const s = AutoSchema.save(ex, tr.teamId); ex.schemaId = s.id; save(); toast('Schéma animé ajouté : touche-le pour le modifier'); return render(); }
      if (b.hasAttribute('data-draw')) return newSchema({ name: ex.title, teamId: tr.teamId, onCreate: s => { ex.schemaId = s.id; save(); } });
      if (b.hasAttribute('data-pick')) return pickSchema(s => { ex.schemaId = s.id; save(); render(); });
      switch (b.dataset.act) {
        case 'exClub': return Exos.pick(tr.teamId, ex => { tr.exercises.push(ex); save(); render(); toast('Exercice ajouté à la séance'); });
        case 'exFile': return Library.schemasFromFiles({ trId: tr.id });
        case 'addEx': tr.exercises.push({ id: Store.uid(), title: '', duration: 15, org: '', consignes: '', materiel: '', schemaId: null }); save(); render(); { const l = $$('.ex-title', root).pop(); if (l && UI.finePointer()) l.focus(); } return; // no keyboard popping up on phones (the page jumped)
        case 'pdf': return runExport('Création du PDF…', () => Exporter.pdfTraining(tr, teamOf(tr.teamId), S().club, { homeBib: S().club.homeBib }));
        case 'share': return runExport('Préparation du fichier…', async () => Exporter.json(await Library.withBackgrounds(Store.exportTraining(tr)), tr.title || 'entrainement'));
        case 'dup': return copyTraining(tr, 'dup');
        case 'use': return copyTraining(tr, 'use');
        case 'model': {
          const n = JSON.parse(JSON.stringify(tr)); n.id = Store.uid(); n.model = true;
          Object.assign(n, { date: '', teamId: null, presents: [], staffIds: [], by: (Auth.current() || {}).id || null }); delete n.ratings; delete n.docIds;
          n.exercises.forEach(x => x.id = Store.uid()); Store.upsert('trainings', n); S().ui.modelsOpen = true;
          toast('Séance type enregistrée : tous les coachs la trouvent dans Séances'); return;
        }
        case 'delete': if (await confirmBox(`Supprimer ${tr.model ? 'la séance type' : 'l\'entraînement'} « ${tr.title} » ? Les schémas restent dans la liste des schémas.`)) { Store.remove('trainings', tr.id); Media.removeRef('training:' + tr.id); location.hash = '#/entrainements'; } return;
      }
    };
  }
  function pickSchema(cb) {
    const list = S().schemas.filter(s => Auth.sees(s.teamId)).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const close = modal({ title: 'Choisir un schéma', noFocus: true,
      body: list.length ? `<div class="pick-grid">${list.map(s => `<button class="pick" data-id="${s.id}"><img alt="" src="${UI.thumb(s, 320, 208)}"><span>${esc(s.name)}</span></button>`).join('')}</div>` : '<p class="muted">Aucun schéma pour l\'instant.</p>',
      onOpen: r => $$('.pick', r).forEach(b => b.onclick = () => { close(); cb(Store.get('schemas', b.dataset.id)); }) });
  }

  /* ================= Matchs ================= */
  // The agenda and results of the whole club are open to every coach (« Tout le club »), or only his teams (« Mes équipes »)
  function matches(root) {
    // its own category filter (the home page's one follows the coach's category and would hide the rest of the club)
    const now = today(), ui = S().ui, t = ui.matchTeam && teamOf(ui.matchTeam) ? ui.matchTeam : '', coach = !Auth.isAdmin();
    const scope = coach && ui.matchScope === 'mine' ? 'mine' : 'club';
    const list = t ? S().matches.filter(x => x.teamId === t) : scope === 'mine' ? byTeam(S().matches) : S().matches;
    const up = list.filter(m => !m.played && m.date >= now).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
    const done = list.filter(m => m.played || m.date < now).sort((a, b) => b.date.localeCompare(a.date));
    const shown = ui.matchMore ? up : up.slice(0, 20);
    const item = m => { const tm = teamOf(m.teamId);
      return `<a class="list-item ${side(m)}" href="#/match/${m.id}"><div class="date-box"><b>${new Date(m.date + 'T12:00').getDate()}</b><span>${esc(fmtDate(m.date, { month: 'short' }))}</span></div>
      <div class="li-main"><b>${matchTitle(m)}</b><span class="muted">${tm ? `<i class="li-cat" style="background:${Planning.teamColor(tm.id)}">${esc(tm.name)}</i> ` : ''}${m.exempt ? '' : sideTag(m) + (m.time ? ' · ' + esc(m.time) : '')}</span></div>
      ${m.played ? `<span class="score">${scoreTxt(m)}</span>${resPill(m)}` : ''}${I.next}</a>`; };
    root.innerHTML = `${header('Matchs', 'Agenda et résultats de tout le club', `<button class="btn" data-act="imp">${I.upload}<span>Importer (FFF, agenda…)</span></button><button class="btn primary" data-act="new">${I.plus}<span>Nouveau match</span></button>`)}
      ${coach && !t ? `<div class="seg"><button class="seg-b ${scope === 'club' ? 'on' : ''}" data-scope="club">🏟️ Tout le club</button><button class="seg-b ${scope === 'mine' ? 'on' : ''}" data-scope="mine">⭐ Mes équipes</button></div>` : ''}
      <label class="team-select all-sizes"><span>Catégorie</span><select data-mteam aria-label="Catégorie"><option value="">Toutes les catégories</option>
        ${S().teams.map(x => `<option value="${x.id}" ${x.id === t ? 'selected' : ''}>${esc(Store.teamLabel(x))}</option>`).join('')}</select></label>
      <div class="side-legend"><span class="side-home">🏠 Domicile</span><span class="side-away">🚌 Extérieur</span></div>
      <h2 class="section">À venir (${up.length})</h2>${up.length ? `<div class="list">${shown.map(item).join('')}</div>${up.length > shown.length ? `<button class="btn soft wide" data-act="more">Voir les ${up.length - shown.length} matchs suivants</button>` : ''}` : '<p class="muted">Aucun match prévu.</p>'}
      <h2 class="section">Résultats</h2>${done.length ? `<div class="list">${done.map(item).join('')}</div>` : '<p class="muted">Pas encore de résultat.</p>'}`;
    $$('[data-mteam]', root).forEach(s => s.onchange = () => { ui.matchTeam = s.value; ui.matchMore = 0; Store.persistNow(); matches(root); });
    $$('[data-scope]', root).forEach(b => b.onclick = () => { ui.matchScope = b.dataset.scope; Store.persistNow(); matches(root); });
    const more = $('[data-act="more"]', root); if (more) more.onclick = () => { ui.matchMore = 1; matches(root); };
    $('[data-act="new"]', root).onclick = newMatch;
    $('[data-act="imp"]', root).onclick = () => Importer.matchesDialog(() => matches(root));
  }
  function newMatch() {
    const t = activeTeam() || (Auth.teams()[0] && Auth.teams()[0].id) || '';
    modal({ title: 'Nouveau match', body: `
      <label class="fld"><span>Adversaire</span><input id="mOpp" placeholder="ex : AS Bondy" maxlength="40"></label>
      <div class="row2"><label class="fld"><span>Date</span><input type="date" id="mDate" value="${today()}"></label><label class="fld"><span>Coup d'envoi</span><input type="time" id="mTime" value="10:00"></label></div>
      <div class="chips" id="mHome"><button class="chip on" data-v="1">Domicile</button><button class="chip" data-v="0">Extérieur</button></div>
      <div class="row2"><label class="fld"><span>Compétition</span><select id="mComp">${COMPS.map(c => `<option>${c}</option>`).join('')}</select></label>
      <label class="fld"><span>Équipe</span><select id="mTeam">${Auth.teams().map(x => `<option value="${x.id}" ${x.id === t ? 'selected' : ''}>${esc(Store.teamLabel(x))}</option>`).join('')}</select></label></div>`,
      onOpen: r => $$('#mHome .chip', r).forEach(b => b.onclick = () => { $$('#mHome .chip', r).forEach(x => x.classList.remove('on')); b.classList.add('on'); }),
      actions: [{ label: 'Annuler' }, { label: 'Créer', kind: 'primary', onClick: (c, r) => {
        if (!S().teams.length) { toast('Crée d\'abord une équipe', 'err'); return false; }
        const m = Store.upsert('matches', { id: Store.uid(), teamId: $('#mTeam', r).value, opponent: $('#mOpp', r).value.trim() || 'Adversaire', date: $('#mDate', r).value || today(), time: $('#mTime', r).value, home: $('#mHome .on', r).dataset.v === '1', competition: $('#mComp', r).value, place: '', rdv: '', played: false, gf: 0, ga: 0, convoked: [], stats: {}, notes: '' });
        location.hash = '#/match/' + m.id;
      } }] });
  }
  /* ---------- convocation to send on WhatsApp (to the parents' group) ---------- */
  function convocationText(m) {
    const t = teamOf(m.teamId), conv = (t ? Store.rosterOf(t.id) : []).filter(p => (m.convoked || []).includes(p.id)), club = S().club.name || 'Le club';
    const hh = x => String(x || '').replace(':', 'h'), me = Auth.current();
    return [`${Sport.W().icon} *${club}${t ? ' · ' + t.name : ''}*`, `*Convocation – ${fmtDate(m.date, { weekday: 'long', day: 'numeric', month: 'long' })}*`, '',
      `Match ${m.home ? 'à domicile' : 'à l\'extérieur'} contre *${m.opponent || '?'}*${m.competition ? ' (' + m.competition + ')' : ''}`,
      m.place || m.home ? `📍 ${m.place || S().club.fieldName || 'Stade du club'}` : '',
      m.rdv || m.time ? `🕘 ${m.rdv ? 'Rendez-vous ' + hh(m.rdv) : ''}${m.rdv && m.time ? ' · ' : ''}${m.time ? 'coup d\'envoi ' + hh(m.time) : ''}` : '🕘 Horaire à confirmer', '',
      `*Joueurs convoqués (${conv.length}) :*`, ...conv.map((p, i) => `${i + 1}. ${p.firstName || ''} ${p.lastName || ''}`.trim()), '',
      '🎒 Prévoir : tenue du club, protège-tibias, gourde.', 'Merci de confirmer la présence de votre enfant en répondant à ce message.',
      me ? `${Messages.coachName(me)}` : ''].filter((l, i, a) => l !== '' || (a[i - 1] !== '' && i > 0)).join('\n').replace(/\n+$/, '');
  }
  function sendConvocation(m) {
    const text = convocationText(m);
    modal({ title: 'Envoyer la convocation', noFocus: true, body: `<p class="muted small">Le message est prêt : choisis où l'envoyer (le groupe WhatsApp des parents, par exemple).</p>
      ${Cloud.ready() ? `<button class="btn soft wide" id="convLink" type="button">${I.check}<span>Ajouter le lien pour répondre présent / absent</span></button>` : ''}
      <textarea id="convTxt" rows="12">${esc(text)}</textarea>`,
      onOpen: r => { const lb = $('#convLink', r); if (lb) lb.onclick = async () => {
        lb.disabled = true;
        try {
          const t = Store.get('teams', m.teamId), url = Codes.catUrl(Parents.familyName ? Parents.familyName(m.teamId) : (t || {}).name || ''), ta = $('#convTxt', r); // the category's page: each family types its personal code
          ta.value = ta.value.replace('Merci de confirmer la présence de votre enfant en répondant à ce message.', `👉 Répondez présent ou absent pour votre enfant ici (avec son code personnel) : ${url}`);
          if (!ta.value.includes(url)) ta.value += `\n👉 Présent ou absent : ${url}`;
          lb.hidden = true; toast('Lien ajouté au message');
        } catch (e) { lb.disabled = false; toast(e.code === 'MISE_A_JOUR' ? 'Le serveur doit être mis à jour par le responsable (Réglages → Serveur du club)' : e.message, 'err'); }
      }; },
      actions: [
        { label: 'WhatsApp', kind: 'primary', icon: I.share, onClick: (c, r) => { window.open('https://wa.me/?text=' + encodeURIComponent($('#convTxt', r).value), '_blank'); return false; } },
        ...(navigator.share ? [{ label: 'Autre appli', icon: I.share, onClick: (c, r) => { navigator.share({ title: 'Convocation', text: $('#convTxt', r).value }).catch(() => {}); return false; } }] : []),
        ...(Cloud.ready() ? [{ label: 'Messagerie du club', icon: I.chat, onClick: (c, r) => { Cloud.post('team:' + m.teamId, $('#convTxt', r).value).then(() => toast('Convocation publiée dans le canal ' + ((teamOf(m.teamId) || {}).name || ''))).catch(e => toast(e.message, 'err')); } }] : []),
        { label: 'Copier', icon: I.copy, onClick: (c, r) => { navigator.clipboard.writeText($('#convTxt', r).value).then(() => toast('Convocation copiée')).catch(() => toast('Sélectionne le texte et copie-le')); return false; } }] });
  }
  // Playing time of each convoked player (minutes); the season total is on the player's page and in Stats
  function minutesCard(m, conv) {
    const mins = m.minutes || {}, full = People.matchLength(m), total = conv.reduce((a, p) => a + (+mins[p.id] || 0), 0);
    return `<h2 class="section">Temps de jeu</h2><section class="card">
      <div class="row-head"><label class="fld inline"><span>Durée du match (min)</span><input type="number" id="mDur" min="10" max="150" inputmode="numeric" value="${full}"></label>
        <button class="btn soft" data-act="allmin">${I.clock}<span>Match complet pour les autres</span></button></div>
      <div class="minutes">${conv.map(p => `<div class="min-row"><span class="nm">${esc(pLabel(p))}</span>
        <span class="min-in"><input type="number" min="0" max="150" inputmode="numeric" data-min="${p.id}" value="${mins[p.id] == null ? '' : esc(mins[p.id])}" placeholder="–" aria-label="Minutes jouées par ${esc(pName(p))}"><span>min</span></span>
        <span class="min-q"><button class="chip" data-minset="${p.id}" data-v="full">Tout</button><button class="chip" data-minset="${p.id}" data-v="half">½</button><button class="chip" data-minset="${p.id}" data-v="zero">0</button></span></div>`).join('')}</div>
      <p class="muted small">« Match complet pour les autres » met ${full} min à ceux qui n'ont pas encore de temps. ${total ? `Total saisi : ${total} min.` : ''}</p></section>`;
  }
  function match(root, id) {
    const m = Store.get('matches', id); if (!m) return (location.hash = '#/matchs');
    if (!Auth.sees(m.teamId)) return matchView(root, m);
    const save = () => Store.upsert('matches', m);
    const stepper = (key, val, lab) => `<div class="stepper"><span>${lab}</span><button class="icon-btn" data-sc="${key}" data-d="-1" aria-label="Moins">${I.minus}</button><b>${val}</b><button class="icon-btn" data-sc="${key}" data-d="1" aria-label="Plus">${I.plus}</button></div>`;
    const render = () => {
      const t = teamOf(m.teamId), roster = t ? Store.rosterOf(t.id) : [], conv = roster.filter(p => (m.convoked || []).includes(p.id));
      const lineup = m.lineupId && Store.get('schemas', m.lineupId);
      root.innerHTML = `${header(matchTitle(m), `${esc(fmtDate(m.date, { weekday: 'long', day: 'numeric', month: 'long' }))}${t ? ' · ' + esc(t.name) : ''}`,
        `${!m.exempt && !(m.played && m.summarySent) ? `<a class="btn primary" href="#/jourj/${m.id}">🏟️<span>Jour de match</span></a>` : ''}<button class="btn" data-act="pdf">${I.pdf}<span>Feuille de match</span></button>`)}
        <section class="card ${side(m)}">
          <div class="row3">
            <label class="fld"><span>Équipe</span><select data-f="teamId">${Auth.teams().map(x => `<option value="${x.id}" ${x.id === m.teamId ? 'selected' : ''}>${esc(Store.teamLabel(x))}</option>`).join('')}</select></label>
            <label class="fld"><span>Adversaire</span><input data-f="opponent" value="${esc(m.opponent)}"></label>
            <label class="fld"><span>Date</span><input type="date" data-f="date" value="${esc(m.date)}"></label>
            <label class="fld"><span>Coup d'envoi</span><input type="time" data-f="time" value="${esc(m.time || '')}"></label>
            <label class="fld"><span>Rendez-vous</span><input type="time" data-f="rdv" value="${esc(m.rdv || '')}"></label>
            <label class="fld"><span>Compétition</span><select data-f="competition">${COMPS.map(c => `<option ${c === m.competition ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
            <label class="fld"><span>Lieu</span><input data-f="place" value="${esc(m.place || '')}" placeholder="Stade, adresse"></label>
          </div>
          <div class="chips"><button class="chip ch-home ${m.home ? 'on' : ''}" data-home="1">🏠 Domicile</button><button class="chip ch-away ${!m.home ? 'on' : ''}" data-home="0">🚌 Extérieur</button></div>
        </section>
        ${!m.exempt ? Live.card(m) + Prepa.card(m) + Vol.card(m) : ''}
        ${m.home && !m.exempt && Cloud.ready() ? '<div id="roomsBox"></div>' : ''}
        <div class="row-head"><h2 class="section">Convoqués (${conv.length})</h2>${conv.length ? `<button class="btn primary" data-act="convoc">${I.share}<span>Envoyer la convocation</span></button>` : ''}</div>
        ${t ? rosterChips(t.id, p => `<button class="chip ${(m.convoked || []).includes(p.id) ? 'on' : ''} ${Health.on(p, m.date) ? 'unav' : ''}" data-conv="${p.id}">${Health.flag(p, m.date)}${chipLabel(p)}</button>`) : '<p class="muted">Choisis une équipe.</p>'}
        ${!m.played && t ? (() => { const low = People.lowPlaytime(t.id); return low.length ? `<p class="tip playtime-tip">⏱️ Peu de temps de jeu cette saison : ${low.slice(0, 8).map(x => `<b>${esc(Store.shortName(x.p))}</b> (${x.min}')`).join(', ')}${low.length > 8 ? '…' : ''} · moyenne de l'équipe ${low[0].avg}'.</p>` : ''; })() : ''}
        <div id="answersBox"></div>
        ${!m.home && !m.exempt ? '<div id="carpoolBox"></div>' : ''}
        <h2 class="section">Encadrants</h2><div class="staff-pick">${People.staffPicker(m.teamId, m.staffIds)}</div>
        <h2 class="section">Composition</h2>
        <section class="card lineup">${lineup ? `<a href="#/schema/${lineup.id}" class="thumb"><img alt="" src="${UI.thumb(lineup)}"></a><a class="btn soft" href="#/schema/${lineup.id}">${I.edit}<span>Modifier la composition</span></a>`
          : `<p class="muted">Place tes joueurs convoqués sur le terrain.</p><button class="btn primary" data-act="lineup">${I.formation}<span>Faire la composition</span></button>`}</section>
        <h2 class="section">Score</h2>
        <section class="card">
          <label class="switch"><input type="checkbox" id="mPlayed" ${m.played ? 'checked' : ''}><span>Le match est joué</span></label>
          ${Ratings.smileyPicker(m)}
          ${m.played ? `<div class="score-board">${stepper('gf', m.gf, esc(S().club.name))}${stepper('ga', m.ga, esc(m.opponent))}</div>${Sport.cur().sets ? `<p class="muted small" style="text-align:center">Sets gagnés${(m.sets || []).length ? ' · ' + m.sets.map(s => s.join('-')).join(', ') : ''}</p>` : ''}
            ${ClubLife.cheerBar(m)}
            ${conv.length ? `<div class="lbl">${Sport.W().Scorers} et passeurs${Sport.isFoot() || Sport.id() === 'hand' ? '' : ' (' + Sport.W().units + ' de chaque joueur)'}</div><div class="scorers">${conv.map(p => { const st = (m.stats || {})[p.id] || {};
              return `<div class="scorer"><span class="nm">${esc(pLabel(p))}</span>
                <span class="mini-step" title="${Sport.W().Units}">${Sport.isFoot() ? I.ball : Sport.W().icon}<button data-pl="${p.id}" data-k="g" data-d="-1" aria-label="Moins de ${Sport.W().units}">−</button><b>${st.g || 0}</b><button data-pl="${p.id}" data-k="g" data-d="1" aria-label="Plus de ${Sport.W().units}">+</button></span>
                <span class="mini-step" title="Passes décisives"><em>P</em><button data-pl="${p.id}" data-k="a" data-d="-1" aria-label="Moins de passes">−</button><b>${st.a || 0}</b><button data-pl="${p.id}" data-k="a" data-d="1" aria-label="Plus de passes">+</button></span></div>`; }).join('')}</div>` : `<p class="tip">Coche les convoqués pour noter les ${Sport.W().scorers}.</p>`}` : ''}
          <label class="fld"><span>Notes</span><textarea data-f="notes" rows="3" placeholder="Ce qui a marché, ce qu'on travaille la semaine prochaine">${esc(m.notes || '')}</textarea></label>
        </section>
        ${m.played && conv.length ? minutesCard(m, conv) + Season.detailCard(m) + Health.rpeBox(m, conv.map(p => p.id), 'match') : ''}
        <div id="rateBox"></div>
        <div id="docsBox">${Library.docsPlaceholder()}</div>
        ${Media.placeholder('match:' + m.id, 'Photos et vidéos du match')}
        ${Cloud.ready() ? '<div id="parentPhotos"></div>' : ''}
        <div class="danger-zone"><button class="btn danger" data-act="delete">${I.trash}<span>Supprimer le match</span></button></div>`;
      Parents.mountMatch(root, m, conv); Rooms.matchBox($('#roomsBox', root), m);
      const box = $('#rateBox', root); box.innerHTML = Ratings.section(m, conv, 'match'); Ratings.bind(box, m, save);
      Media.mount(root); Library.mountDocs($('#docsBox', root), m, save);
    };
    const cheer = before => { if (Ratings.result(m) === 'V' && before !== 'V') Ratings.celebrate(); };
    const setMin = (pid, v) => { const mm = m.minutes = m.minutes || {}; if (v === '' || v == null) delete mm[pid]; else mm[pid] = Math.max(0, Math.min(150, Math.round(+v) || 0)); };
    render();
    root.oninput = e => {
      const t = e.target;
      if (t.dataset.min) { setMin(t.dataset.min, t.value); save(); return; }
      if (t.id === 'mDur') { m.duration = Math.max(10, Math.min(150, +t.value || 0)) || ''; save(); return; }
      const f = t.dataset.f; if (f) { m[f] = t.value; if (f === 'teamId') m.teamManual = true; save(); }
    };
    root.onchange = e => {
      if (e.target.dataset.f === 'teamId') { m.teamId = e.target.value; m.teamManual = true; save(); toast('Match rangé dans ' + (teamOf(m.teamId) || {}).name); return render(); }
      if (e.target.id === 'mPlayed') { const before = Ratings.result(m); m.played = e.target.checked; save(); render(); return cheer(before); }
      if (e.target.hasAttribute('data-staffpick') && e.target.value) { m.staffIds = [...new Set([...(m.staffIds || []), e.target.value])]; save(); return render(); }
      root.oninput(e);
    };
    root.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.act === 'convoc') { m.convSent = Date.now(); save(); return sendConvocation(m); }
      if (b.dataset.rsort) { S().ui.rosterSort = b.dataset.rsort; Store.persistNow(); return render(); }
      if (b.dataset.minset) {
        const full = People.matchLength(m), v = { full, half: Math.round(full / 2), zero: 0 }[b.dataset.v];
        setMin(b.dataset.minset, v); save(); const inp = $(`[data-min="${b.dataset.minset}"]`, root); if (inp) inp.value = v; return;
      }
      if (b.dataset.act === 'allmin') {
        const full = People.matchLength(m), conv = (m.convoked || []);
        conv.forEach(pid => { if ((m.minutes || {})[pid] == null) setMin(pid, full); }); save(); return render();
      }
      if (Health.rpeClick(e, m, m.convoked || [], () => { save(); render(); })) return;
      if (b.dataset.cheer) { ClubLife.cheer(b.dataset.cheer); return render(); }
      if (b.dataset.home) { m.home = b.dataset.home === '1'; save(); return render(); }
      if (b.dataset.unstaff) { m.staffIds = (m.staffIds || []).filter(x => x !== b.dataset.unstaff); save(); return render(); }
      if (b.dataset.conv) { const c = m.convoked = m.convoked || [], i = c.indexOf(b.dataset.conv); i < 0 ? c.push(b.dataset.conv) : c.splice(i, 1);
        const pl = Store.get('players', b.dataset.conv), u = i < 0 && Health.on(pl, m.date); if (u) toast(`Attention : ${Store.shortName(pl)} est indisponible ce jour-là (${Health.label(u)})`, 'err');
        save(); return render(); }
      if (b.dataset.sc) { const before = Ratings.result(m); m[b.dataset.sc] = Math.max(0, (+m[b.dataset.sc] || 0) + +b.dataset.d); if (Ratings.result(m) !== before) delete m.smiley; save(); render(); return cheer(before); }
      if (b.dataset.smiley) { m.smiley = b.dataset.smiley; save(); return render(); }
      if (b.dataset.pl) { const st = (m.stats = m.stats || {})[b.dataset.pl] = m.stats[b.dataset.pl] || {}; st[b.dataset.k] = Math.max(0, (st[b.dataset.k] || 0) + +b.dataset.d); save(); return render(); }
      switch (b.dataset.act) {
        case 'pdf': return runExport('Création de la feuille de match…', () => Exporter.pdfMatch(m, teamOf(m.teamId), S().club, { homeBib: S().club.homeBib }));
        case 'lineup': return makeLineup(m);
        case 'delete': if (await confirmBox('Supprimer ce match ?')) { Store.remove('matches', m.id); Media.removeRef('match:' + m.id); location.hash = '#/matchs'; } return;
      }
    };
  }
  // Another category's match: every coach can follow it and cheer the team; only its own coaches change it
  function matchView(root, m) {
    const t = teamOf(m.teamId);
    const draw = () => {
      root.innerHTML = `${header(matchTitle(m), `${esc(fmtDate(m.date, { weekday: 'long', day: 'numeric', month: 'long' }))}${t ? ' · ' + esc(t.name) : ''}`, `<a class="btn" href="#/matchs">${I.back}<span>Matchs</span></a>`)}
        <section class="card match-view ${side(m)}">
          ${m.exempt ? '<p class="lead">Exempt : pas de match ce week-end.</p>' : `
          <div class="mv-score">${m.played ? `<b>${esc(scoreTxt(m))}</b>${resPill(m)}` : `<span>${m.time ? 'Coup d\'envoi à ' + esc(m.time) : 'Horaire à venir'}</span>`}</div>
          <p><i class="side-tag big">${m.home ? '🏠 À domicile' : '🚌 À l\'extérieur'}</i>${m.place ? ' · 📍 ' + esc(m.place) : ''}${m.rdv ? ' · rendez-vous ' + esc(m.rdv) : ''}</p>
          <p class="muted small">${esc(m.competition || '')}${m.notes ? ' · ' + esc(String(m.notes).split('\n')[0]) : ''}</p>
          ${ClubLife.cheerBar(m)}`}
          <p class="tip">Match des ${esc(t ? t.name : 'autres catégories')} : tu peux le suivre et encourager l'équipe. Seuls ses coachs le modifient.</p>
        </section>`;
    };
    draw();
    root.oninput = root.onchange = null;
    root.onclick = e => { const b = e.target.closest('[data-cheer]'); if (b) { ClubLife.cheer(b.dataset.cheer); draw(); } };
  }
  function makeLineup(m) {
    const t = teamOf(m.teamId); if (!t) return toast('Choisis une équipe', 'err');
    const fmt = Formations[t.format] ? t.format : Sport.defFormat(), forms = Object.keys(Formations[fmt] || Formations['11']); // a team without a known format plays at 11
    const nConv = Store.rosterOf(t.id).filter(p => (m.convoked || []).includes(p.id)).length;
    modal({ title: 'Composition', body: `<label class="fld"><span>Système</span><select id="lf">${formationOptions(Formations[t.format] ? t.format : fmt)}</select></label>
      ${nConv ? `<p class="tip">Les ${nConv} convoqués sont placés selon leur poste (le DC dans l'axe, le LD à droite, l'AG à gauche…). Les autres sont notés comme remplaçants. Tu pourras tout déplacer.</p>`
        : '<p class="tip">⚠️ Aucun joueur convoqué pour ce match : les postes seront placés sans prénoms. Pour avoir les prénoms, coche d\'abord les convoqués (liste « Convoqués » du match), puis refais la composition.</p>'}`,
      actions: [{ label: 'Annuler' }, { label: 'Créer', kind: 'primary', onClick: (c, r) => {
        const sc = blankSchema(`Compo contre ${m.opponent}`, { format: fmt, view: 'full' }, t.id);
        const { L, W } = Board.dims(sc.field), players = Store.rosterOf(t.id).filter(p => (m.convoked || []).includes(p.id));
        const rows = Formations[fmt][$('#lf', r).value], { out, bench } = People.assignSlots(players, rows);
        rows.forEach(([lab, x, y, gk], j) => {
          const who = out[j], id = Store.uid();
          sc.objects.push({ id, type: 'player', color: gk ? 'jaune' : S().club.homeBib, gk: !!gk, label: who && who.number ? String(who.number) : lab, name: who ? Store.shortName(who) : '', playerId: who ? who.id : undefined });
          sc.steps[0].pos[id] = [Math.min(x * 1.9, .94) * L, y * W]; // spread our half over the whole pitch
        });
        sc.overlays.names = true;
        if (bench.length) sc.notes = 'Remplaçants : ' + bench.map(p => Store.shortName(p) + (People.postsLabel(p, true) ? ' (' + People.postsLabel(p, true) + ')' : '')).join(', ');
        Store.upsert('schemas', sc); m.lineupId = sc.id; Store.upsert('matches', m);
        location.hash = '#/schema/' + sc.id;
      } }] });
  }

  /* ================= Stats ================= */
  function stats(root) {
    const tid = activeTeam() || (Auth.teams()[0] && Auth.teams()[0].id);
    const t = teamOf(tid);
    if (!t) { root.innerHTML = header('Statistiques') + empty('Crée une équipe pour voir ses statistiques.'); return; }
    S().ui.teamId = tid;
    const ms0 = S().matches.filter(m => m.teamId === t.id && m.played), ms = ms0.filter(Store.kindOk).sort((a, b) => b.date.localeCompare(a.date));
    const trs = S().trainings.filter(x => x.teamId === t.id && (x.presents || []).length);
    const V = ms.filter(m => result(m) === 'V').length, N = ms.filter(m => result(m) === 'N').length, D = ms.filter(m => result(m) === 'D').length;
    const bp = ms.reduce((a, m) => a + (+m.gf || 0), 0), bc = ms.reduce((a, m) => a + (+m.ga || 0), 0);
    const sortKey = S().ui.statSort || 'g';
    // the team's players, plus the category's players who played or trained with it (team A / B)
    const ownIds = new Set(Store.playersOf(t.id).map(p => p.id));
    const rows = Store.rosterOf(t.id).map(p => {
      const played = ms.filter(m => (m.convoked || []).includes(p.id)).length;
      const g = ms.reduce((a, m) => a + (((m.stats || {})[p.id] || {}).g || 0), 0), as = ms.reduce((a, m) => a + (((m.stats || {})[p.id] || {}).a || 0), 0);
      const pr = trs.filter(x => x.presents.includes(p.id)).length;
      const min = ms.reduce((a, m) => a + (+((m.minutes || {})[p.id]) || 0), 0);
      return { p, post: People.postsLabel(p, true), played, g, a: as, pr, min, rate:trs.length ? Math.round(pr / trs.length * 100) : null, nm: Ratings.average(p.id, 'match') || 0, nt: Ratings.average(p.id, 'training') || 0 };
    }).filter(r => ownIds.has(r.p.id) || !ownIds.size || r.played || r.pr).sort((a, b) => sortKey === 'post' ? People.sortPlayers([a.p, b.p], 'post')[0] === a.p ? -1 : 1 : sortKey === 'name' ? Store.byName(a.p, b.p) : sortKey === 'num' ? (+a.p.number || 99) - (+b.p.number || 99) : (b[sortKey] || 0) - (a[sortKey] || 0));
    const th = (k, l) => `<th><button class="th ${sortKey === k ? 'on' : ''}" data-sort="${k}">${l}</button></th>`;
    root.innerHTML = `${header('Statistiques', esc(t.name), `<a class="btn" href="#/bilan/${t.id}">🏆<span>Bilan de saison</span></a><button class="btn" data-act="excel">${I.download}<span>Excel</span></button>`)}
      ${teamSwitch()}
      ${UI.kindSeg({ off: ms0.filter(m => m.played && !Store.isFriendly(m)).length, ami: ms0.filter(m => m.played && Store.isFriendly(m)).length })}
      ${Store.matchKind() === 'ami' ? '' : Season.leagueCard(t)}
      ${Season.advanced(t)}
      <div class="tiles">
        <div class="tile"><b>${ms.length}</b><span>Matchs</span></div>
        <div class="tile v"><b>${V}</b><span>Gagnés</span></div>
        <div class="tile n"><b>${N}</b><span>Nuls</span></div>
        <div class="tile d"><b>${D}</b><span>Perdus</span></div>
        <div class="tile"><b>${bp}</b><span>${Sport.W().Units} marqués</span></div>
        <div class="tile"><b>${bc}</b><span>${Sport.W().Units} encaissés</span></div>
        <div class="tile"><b>${Sport.leaguePts(V, N, D)}</b><span>Points au classement</span></div>
      </div>
      ${(() => { const low = People.lowPlaytime(t.id); return low.length ? `<section class="card playtime-card"><h2>⏱️ Temps de jeu à surveiller</h2><p class="muted small">Joueurs qui ont joué moins de la moitié de la moyenne de l'équipe (${low[0].avg} min) sur les matchs où le temps de jeu est noté.</p><ul class="alerts">${low.map(x => `<li><a href="#/joueur/${x.p.id}"><b>${esc(pName(x.p))}</b></a> : ${x.min} min${x.conv ? ` · ${x.conv} convocation${x.conv > 1 ? 's' : ''}` : ' · jamais convoqué'}</li>`).join('')}</ul></section>` : ''; })()}
      <h2 class="section">Joueurs</h2>
      <div class="table-wrap"><table class="tbl">
        <thead><tr>${th('num', 'N°')}${th('name', 'Joueur')}${th('post', 'Poste')}${th('played', 'Matchs')}${th('min', 'Minutes')}${th('g', Sport.W().Units)}${th('a', Sport.W().Assists)}${th('pr', 'Entraînements')}${th('nm', 'Note matchs')}${th('nt', 'Note entr.')}</tr></thead>
        <tbody>${rows.map(r => `<tr><td class="num">${esc(r.p.number)}</td><td><a href="#/joueur/${r.p.id}">${esc(pName(r.p))}</a></td><td class="muted">${esc(r.post) || '–'}</td><td>${r.played}</td><td>${r.min ? r.min + "'" : '–'}</td><td><b>${r.g}</b></td><td>${r.a}</td><td>${r.rate === null ? '–' : `${r.pr} <span class="muted">(${r.rate} %)</span>`}</td><td>${r.nm ? '⭐ ' + Ratings.fr(r.nm) : '–'}</td><td>${r.nt ? '⭐ ' + Ratings.fr(r.nt) : '–'}</td></tr>`).join('')}</tbody>
      </table></div>
      <h2 class="section">Résultats</h2>
      ${ms.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Match</th><th>Score</th><th>Résultat</th></tr></thead>
        <tbody>${ms.map(m => `<tr><td>${esc(fmtDate(m.date))}</td><td><a href="#/match/${m.id}">${matchTitle(m)}</a></td><td class="num">${scoreTxt(m)}</td><td>${resPill(m)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Pas encore de match joué.</p>'}`;
    bindTeamSwitch(root, () => stats(root));
    $$('[data-sort]', root).forEach(b => b.onclick = () => { S().ui.statSort = b.dataset.sort; Store.save(); stats(root); });
    $('[data-act="excel"]', root).onclick = () => ClubAdmin.csvSeason([t.id]);
  }

  /* ================= Réglages ================= */
  function settings(root) {
    const c = S().club;
    const bibs = (key, cur) => `<div class="chips">${Object.entries(Board.BIBS).map(([k, v]) => `<button class="chip bib ${k === cur ? 'on' : ''}" data-${key}="${k}" aria-label="${k}"><i class="sw" style="background:${v[0]}"></i>${k}</button>`).join('')}</div>`;
    root.innerHTML = `${header('Réglages', '')}
      ${Auth.settingsSection()}
      ${Cloud.settingsSection()}
      ${Help.settingsSection()}
      ${Auth.isAdmin() ? Onboard.card() : ''}
      ${Auth.isAdmin() ? `<section class="card">
        <h2>${I.team}Tableau tactique</h2>
        <div class="lbl">Couleur de nos maillots</div>${bibs('home', c.homeBib)}
        <div class="lbl">Couleur des adversaires</div>${bibs('away', c.awayBib)}
      </section>` : ''}
      <section class="card">
        <h2>${I.share}Fichiers du club</h2>
        <p>${Cloud.ready() ? 'Les équipes, joueurs, dirigeants, schémas, entraînements et matchs se partagent tout seuls entre les éducateurs par le serveur du club. Les photos et vidéos restent sur l\'appareil qui les a prises.' : 'Chaque éducateur a l\'appli sur son appareil. Pour partager, envoie un fichier (AirDrop, WhatsApp, mail) : l\'autre éducateur l\'ouvre avec « Recevoir un fichier ».'}</p>
        <p class="muted small">« Recevoir un fichier » sert aussi à charger la liste des licenciés ou une sauvegarde. Les listes de joueurs contiennent des numéros de téléphone : envoie-les seulement aux éducateurs du club.</p>
        <div class="chips">${Auth.isAdmin() ? `<button class="btn primary" data-act="exportAll">${I.download}<span>Envoyer toutes mes données</span></button><button class="btn" data-act="backups">${I.shield}<span>Sauvegardes du club</span></button>` : ''}
        <button class="btn" data-act="import">${I.upload}<span>Recevoir un fichier</span></button></div>
      </section>
      <section class="card">
        <h2>${I.help}Installer l'appli sur l'iPad ou l'iPhone</h2>
        <ol class="steps-help"><li>Ouvre cette page dans <b>Safari</b>.</li><li>Touche le bouton <b>Partager</b> (le carré avec une flèche vers le haut).</li><li>Choisis <b>Sur l'écran d'accueil</b>, puis <b>Ajouter</b>.</li><li>Lance l'appli depuis son icône : elle marche ensuite sans internet.</li></ol>
      </section>
      ${Auth.isAdmin() && (S().teams.some(t => t.example) || S().schemas.some(s => s.example)) ? `<section class="card">
        <h2>${I.layers}Exemples</h2>
        <p class="muted">L'appli contient des équipes, schémas, entraînements et matchs d'exemple.</p>
        <button class="btn" data-act="noExamples">${I.trash}<span>Supprimer les exemples</span></button>
      </section>` : ''}
      ${Auth.isAdmin() ? `<section class="card">
        <h2>${I.trash}Effacer</h2>
        <p class="muted">${Cloud.ready() ? 'Efface les données de cet appareil seulement (elles restent sur le serveur du club et reviennent à la prochaine connexion).' : 'Les données sont enregistrées sur cet appareil uniquement. Pense à envoyer une copie avant d\'effacer.'}</p>
        <button class="btn danger" data-act="reset">${I.trash}<span>Effacer les données de cet appareil</span></button>
      </section>` : ''}
      <p class="muted small">Clubbo · créée par <b>Coach Enzo</b> · version ${Help.VERSION} · <button class="linkish" onclick="App.checkUpdate(true)">Mettre à jour l'appli</button> · <a href="confidentialite.html">Confidentialité</a></p>`;
    Help.onSettings(root, () => settings(root));
    Auth.mountSettings(root); Notify.mountAccount(root); Notify.mountAdmin(root);
    root.onchange = e => { if (e.target.dataset.notifpref) return Notify.onChange(e.target); Auth.onSettingsChange(e.target); };
    root.onclick = async e => {
      if (Onboard.onClick(e, () => settings(root))) return;
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.home) { c.homeBib = b.dataset.home; Store.save(); App.refreshChrome(); return settings(root); }
      if (b.dataset.away) { c.awayBib = b.dataset.away; Store.save(); return settings(root); }
      if (b.dataset.act === 'exportAll') return runExport('Préparation du fichier…', async () => { S().ui.clubFileSent = true; Store.save(); return Exporter.json(await Library.withBackgrounds(Store.exportAll()), `${c.name}-${today()}`); });
      if (b.dataset.notif) return Notify.onClick(b, () => settings(root));
      if (b.dataset.auth || b.dataset.reset) return Auth.onSettingsClick(b, () => settings(root));
      if (b.dataset.cloud) return Cloud.onSettingsClick(b, () => settings(root));
      if (b.dataset.act === 'import') return importFile();
      if (b.dataset.act === 'backups') return President.backupDialog();
      if (b.dataset.act === 'noExamples' && await confirmBox('Supprimer toutes les données d\'exemple ?')) { Store.removeExamples(); toast('Exemples supprimés'); return settings(root); }
      if (b.dataset.act === 'reset' && await confirmBox('Effacer toutes les équipes, schémas, entraînements et matchs de cet appareil ?', 'Tout effacer')
        && await Auth.askPassword('Pour éviter une erreur, confirme avec ton mot de passe : toutes les données de cet appareil seront effacées.', 'Tout effacer')) { Store.reset(); toast('Données effacées'); Auth.logout(); }
    };
  }

  /* ================= shared ================= */
  async function runExport(label, fn) {
    const b = UI.busy(label);
    try { const r = await fn(b.progress); if (r === 'downloaded') toast('Fichier enregistré dans Téléchargements'); }
    catch (err) { console.error(err); toast(err.message || 'Export impossible', 'err'); }
    finally { b.done(); }
  }
  // Receive a .raincy.json file (players, staff, sessions, matches…) from another coach or from the club
  async function receiveText(txt) {
    txt = String(txt).replace(/^\uFEFF/, '');
    // a team exported from AssistCoachAI
    if (/"planning"/.test(txt.slice(0, 200000)) && await ACImport.fromText(txt)) return true;
    if (People.isClubList(txt)) {
      const r = People.importClubList(txt), p = r.players, s = r.staff;
      App.route();
      modal({ title: 'Liste reçue', noFocus: true, body: `<p class="lead">Joueurs : ${p.added} ajouté${p.added > 1 ? 's' : ''}, ${p.updated} mis à jour. Dirigeants : ${s.added} ajouté${s.added > 1 ? 's' : ''}, ${s.updated} mis à jour.</p>
        <p class="muted">Chaque joueur est rangé dans sa catégorie selon son année de naissance. Retrouve-les dans Équipes.</p>`, actions: [{ label: 'OK', kind: 'primary' }] });
      return true;
    }
    try {
      const r = Store.importText(String(txt).replace(/^﻿/, '').trim());
      await Library.restoreBackgrounds();
      const d = r.byCol || {}, names = [['players', 'joueur'], ['staff', 'dirigeant'], ['teams', 'catégorie'], ['trainings', 'séance'], ['matches', 'match'], ['schemas', 'schéma']];
      const parts = names.filter(([c]) => d[c]).map(([c, w]) => `${d[c]} ${w}${d[c] > 1 ? 's' : ''}`);
      App.route();
      modal({ title: 'Fichier reçu', noFocus: true, body: `<p class="lead">${parts.length ? 'Ajouté ou mis à jour : ' + esc(parts.join(', ')) + '.' : 'Tout était déjà à jour sur cet appareil.'}</p>
        <p class="muted">${r.added} nouveauté${r.added > 1 ? 's' : ''} · ${r.updated} mise${r.updated > 1 ? 's' : ''} à jour. Retrouve les joueurs dans Équipes.</p>`, actions: [{ label: 'OK', kind: 'primary' }] });
      return true;
    } catch (err) { toast(err.message || 'Fichier illisible', 'err'); return false; }
  }
  function importFile() {
    modal({ title: 'Recevoir un fichier', noFocus: true,
      body: `<p>Choisis le fichier <b>.raincy.json</b> ou la liste <b>.txt</b> des licenciés et dirigeants (liste des licenciés, données d'un autre éducateur…). Sur iPhone ou iPad, il doit d'abord être enregistré dans l'app <b>Fichiers</b> ; sur PC ou Android, dans Téléchargements.</p>
        <button class="btn primary wide" id="rcvPick">${I.upload}<span>Choisir le fichier</span></button>
        <details class="paste-box"><summary>Le fichier ne se sélectionne pas ?</summary>
          <p class="muted small">Ouvre le fichier dans une autre appli (Fichiers, Mail, Notes…), copie tout son texte, puis colle-le ici.</p>
          <textarea id="rcvText" rows="5" placeholder='{"app":"raincy-coach", …}'></textarea>
          <button class="btn wide" id="rcvPaste">${I.paste}<span>Importer le texte collé</span></button></details>`,
      onOpen: (r, close) => {
        $('#rcvPick', r).onclick = async () => {
          const [f] = await UI.pickFiles(); if (!f) return;
          const txt = await f.text(); close();
          const b = UI.busy('Lecture du fichier…');
          try { await receiveText(txt); } finally { b.done(); }
        };
        $('#rcvPaste', r).onclick = async () => {
          const t = $('#rcvText', r).value; if (!t.trim()) return toast('Colle d\'abord le texte du fichier', 'err');
          close(); await receiveText(t);
        };
      } });
  }

  return { home, teams, team, schemas, trainings, training, matches, match, stats, settings, newSchema, newMatch, newTraining, sendConvocation, makeLineup };
})();
