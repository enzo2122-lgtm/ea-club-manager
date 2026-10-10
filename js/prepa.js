/* Prepa: the preparation of a match, from the training week to the debrief, in 7 short steps saved with the match
   (so every coach of the category sees the same plan):
   1 Semaine (the sessions before the match, with their aim: J-1 activation + CPA, J-3 intensity…), 2 Adversaire, 3 Plan de jeu,
   4 Causerie (3 keys, a hook, a last word), 5 Jour J (times, warm-up, kit), 6 Mi-temps, 7 Après-match.
   « Lancer la causerie » shows it all full screen, one slide after the other; « Résumé aux joueurs » shares it on WhatsApp. */
const Prepa = (() => {
  const { esc, $, $$, toast, modal, confirmBox } = UI;
  const S = () => Store.state;
  const STEPS = [['semaine', '🗓️', 'Semaine'], ['adversaire', '🔎', 'Adversaire'], ['plan', '🧠', 'Plan de jeu'], ['causerie', '🗣️', 'Causerie'],
    ['jourj', '⏰', 'Jour J'], ['mitemps', '⏸️', 'Mi-temps'], ['apres', '📝', 'Après-match']];
  const MOMENTS = [['withBall', '⚽ Avec le ballon', ['Construire court depuis le gardien', 'Jouer vers l\'avant dès que possible', 'Écarter le jeu, changer de côté', 'Attaquer la profondeur', 'Centres en retrait', 'Frapper dès qu\'on peut', 'Patience, conserver']],
    ['withoutBall', '🛡️ Sans le ballon', ['Bloc compact, peu d\'espace entre les lignes', 'Pressing haut sur leur relance', 'Bloc médian, on attend au milieu', 'Fermer l\'axe, les pousser sur les côtés', 'Cadrer, ne pas se jeter', 'Parler, se couvrir']],
    ['transOff', '⚡ À la récupération', ['Première passe vers l\'avant', 'Attaquer vite, 3 joueurs qui partent', 'Si c\'est fermé : on conserve', 'Profiter de leur défense haute']],
    ['transDef', '🔥 À la perte du ballon', ['Contre-pressing 5 secondes', 'Faute tactique si nécessaire', 'Repli immédiat derrière le ballon', 'Fermer l\'axe d\'abord']]];
  const OPP_CHIPS = ['Jeu long', 'Rapides sur les côtés', 'Faibles dans les airs', 'Défense haute : attaquer la profondeur', 'Pressing haut', 'Bloc bas', 'Dangereux sur CPA', 'Fragiles sur CPA', 'Gardien fébrile', 'Physiques', 'Techniques', 'Fin de match difficile pour eux'];
  // (1.28) the words of football; the other sports get neutral ones (see below: OPP, KEYS, WARM, KITS, MODELS, systemsOf)
  const KEY_CHIPS = ['Gagner les duels et les deuxièmes ballons', 'Rester compacts', 'Presser ensemble', 'Jouer simple et vite', 'Attaquer la profondeur', 'Concentration sur les coups de pied arrêtés', 'Communiquer', 'Ne jamais lâcher', 'Les 10 premières minutes à fond', 'Respect de l\'arbitre et de l\'adversaire'];
  const SYSTEMS = { 11: ['4-4-2', '4-3-3', '4-2-3-1', '4-1-4-1', '3-5-2', '3-4-3', '5-3-2', '4-4-2 losange'], 8: ['3-3-1', '2-3-2', '3-2-2', '2-4-1', '3-1-3'], 5: ['2-2', '1-2-1', '2-1-1'] };
  const WARMUP = [['Activation : footing, mobilité articulaire', 5], ['Gammes athlétiques (montées de genoux, talons-fesses, pas chassés)', 5], ['Conservation / rondos à deux touches', 5], ['Jeu à thème ou finition', 5], ['Accélérations et sprints courts', 3], ['Retour au vestiaire, derniers mots', 2]];
  const KIT = ['Maillots, shorts, chaussettes', 'Brassard de capitaine', 'Ballons (1 pour 3 joueurs)', 'Plots et chasubles', 'Trousse de secours, glace', 'Gourdes / eau', 'Licences (tablette FMI / feuille de match)', 'Drapeaux de touche', 'Sifflet, chrono'];
  // what each day before the match is for (training week before a match, amateur club with 2 or 3 sessions)
  const DAYS = { 1: ['J-1', 'Activation + coups de pied arrêtés : court, intense, peu de volume', 'Veille de match : activation et CPA'],
    2: ['J-2', 'Mise en place du plan de jeu, intensité moyenne', 'Plan de jeu contre l\'adversaire'],
    3: ['J-3', 'Pic de la semaine : jeux réduits intenses, duels', 'Intensité : jeux réduits'],
    4: ['J-4', 'Technique, conservation, récupération des joueurs du match', 'Technique et conservation'] };
  const MODEL = {
    1: [['Activation et vivacité (échelle de rythme, appuis)', 10], ['Rondos 5c2 à deux touches', 10], ['CPA offensifs : corners et coups francs', 10], ['CPA défensifs : placement sur corners', 10], ['Jeu réduit court 6c6, 3 × 3 min', 10], ['Mise en place 11c0 du plan de jeu', 5]],
    2: [['Échauffement avec ballon', 15], ['Conservation et transitions', 15], ['Mise en place du plan de jeu contre l\'adversaire', 20], ['Finition : centres et frappes', 15], ['Match à thème', 15]],
    3: [['Échauffement athlétique', 15], ['Jeu réduit 4c4 intense, 4 × 4 min', 20], ['Exercice tactique (thème de la semaine)', 20], ['Match avec consignes', 20]],
    4: [['Échauffement technique', 15], ['Conservation, circulation du ballon', 20], ['Technique par poste', 20], ['Petit match libre', 15]] };
  const foot = () => typeof Sport === 'undefined' || Sport.isFoot();
  const MOMENTS_OTHER = [['withBall', '🎯 Avec le ballon', ['Monter le ballon calmement', 'Jouer vite vers l\'avant', 'Écarter le jeu, changer de côté', 'Chercher le meilleur tir', 'Utiliser notre point fort', 'Patience, faire circuler le ballon']],
    ['withoutBall', '🛡️ Sans le ballon', ['Défense serrée, se parler', 'Presser haut dès la remise en jeu', 'Défendre en reculant, fermer l\'axe', 'Pousser l\'adversaire vers les côtés', 'Rester entre son joueur et le but', 'Se couvrir les uns les autres']],
    ['transOff', '⚡ À la récupération', ['Première passe vers l\'avant', 'Contre-attaque à plusieurs', 'Si c\'est fermé : on reconstruit', 'Profiter de leur repli lent']],
    ['transDef', '🔥 À la perte du ballon', ['Gêner tout de suite le porteur', 'Repli immédiat', 'Revenir protéger le but d\'abord', 'Pas de faute inutile']]];
  const MOM = () => foot() ? MOMENTS : MOMENTS_OTHER;
  const OPP_OTHER = ['Jeu rapide', 'Défense agressive', 'Défense de zone', 'Très physiques', 'Très techniques', 'Dangereux sur phases arrêtées', 'Fragiles sur phases arrêtées', 'Un joueur clé', 'Peu de remplaçants', 'Fin de match difficile pour eux'];
  const KEY_OTHER = ['Gagner les duels', 'Défendre ensemble', 'Jouer simple et vite', 'Courir en contre-attaque', 'Concentration sur les phases arrêtées', 'Communiquer', 'Ne jamais lâcher', 'Les premières minutes à fond', 'Respect de l\'arbitre et de l\'adversaire'];
  const WARM_OTHER = [['Activation : trottinement, mobilité articulaire', 5], ['Gammes athlétiques (montées de genoux, pas chassés)', 5], ['Passes et manipulation du ballon', 5], ['Situations de jeu ou tirs', 5], ['Accélérations courtes', 3], ['Retour au vestiaire, derniers mots', 2]];
  const KIT_OTHER = ['Maillots, shorts, chaussettes', 'Brassard ou capitaine désigné', 'Ballons', 'Chasubles et plots', 'Trousse de secours, glace', 'Gourdes / eau', 'Licences et feuille de match', 'Sifflet, chrono'];
  const MODEL_OTHER = {
    1: [['Activation et vivacité (appuis, réactions)', 10], ['Jeu de passes à effectif réduit', 10], ['Phases arrêtées : nos combinaisons', 10], ['Phases arrêtées : défendre', 10], ['Petit match court et intense, 3 × 3 min', 10], ['Mise en place du plan de jeu sans opposition', 5]],
    2: [['Échauffement avec ballon', 15], ['Attaque et défense placées', 15], ['Mise en place du plan de jeu contre l\'adversaire', 20], ['Tirs et finitions', 15], ['Match à thème', 15]],
    3: [['Échauffement athlétique', 15], ['Petit match intense, 4 × 4 min', 20], ['Exercice tactique (thème de la semaine)', 20], ['Match avec consignes', 20]],
    4: [['Échauffement technique', 15], ['Passes et circulation du ballon', 20], ['Technique par poste', 20], ['Petit match libre', 15]] };
  const OPP = () => foot() ? OPP_CHIPS : OPP_OTHER, KEYS = () => foot() ? KEY_CHIPS : KEY_OTHER, WARM = () => foot() ? WARMUP : WARM_OTHER;
  const KITS = () => foot() ? KIT : KIT_OTHER, MODELS = () => foot() ? MODEL : MODEL_OTHER;
  // the systems of the team's sport and format (the session library's ones for the other sports)
  const systemsOf = teamId => { if (foot()) return SYSTEMS[fmt(teamId)] || SYSTEMS[11]; const f = fmt(teamId), l = (typeof SesLib !== 'undefined' ? SesLib.systems() : []).filter(x => x.fmt === f).map(x => x.sys); return l.length ? l : (typeof SesLib !== 'undefined' ? [...new Set(SesLib.systems().map(x => x.sys))] : []); };

  const P = m => { const p = m.prep = m.prep || {}; if (p.talk && p.talk.keys && !Array.isArray(p.talk.keys)) p.talk.keys = [0, 1, 2].map(i => String(p.talk.keys[i] || '')); return p; };
  // (2.98) dictate instead of typing: the phone's speech recognition writes in the field (nothing leaves the phone except what the system does)
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const mic = f => SR ? `<button type="button" class="mic-btn" data-mic="${f}" title="Dicter" aria-label="Dicter">🎤</button>` : '';
  let rec = null;
  function dictate(root, f) {
    const input = root.querySelector(`[data-p="${f}"]`); if (!input || !SR) return;
    if (rec) { try { rec.stop(); } catch (e) {} rec = null; }
    const r = rec = new SR(); r.lang = 'fr-FR'; r.interimResults = false; r.maxAlternatives = 1;
    const btn = root.querySelector(`[data-mic="${f}"]`); if (btn) btn.classList.add('on');
    r.onresult = ev => { const txt = [...ev.results].map(x => x[0].transcript).join(' ').trim(); if (!txt) return; input.value = (input.value ? input.value.trim() + ' ' : '') + txt; input.dispatchEvent(new Event('input', { bubbles: true })); };
    r.onend = r.onerror = () => { if (btn) btn.classList.remove('on'); rec = null; };
    try { r.start(); UI.toast('Parle, j\'écris…'); } catch (e) { if (btn) btn.classList.remove('on'); }
  }
  const get = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const set = (o, path, v) => { const ks = path.split('.'); let a = o; ks.slice(0, -1).forEach((k, i) => { a = a[k] = a[k] && typeof a[k] === 'object' ? a[k] : (k === 'keys' ? ['', '', ''] : {}); }); a[ks[ks.length - 1]] = v; };
  const lines = s => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);
  const hm = min => { min = ((min % 1440) + 1440) % 1440; return `${String(Math.floor(min / 60)).padStart(2, '0')}h${String(min % 60).padStart(2, '0')}`; };
  const toMin = t => { const x = /^(\d{1,2})[:h](\d{2})/.exec(t || ''); return x ? +x[1] * 60 + +x[2] : null; };
  const addDays = (d, n) => { const x = new Date(d + 'T12:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const teamOf = m => Store.get('teams', m.teamId);
  const fmt = t => (teamOf({ teamId: t }) || {}).format || Sport.defFormat();
  const title = m => `${esc((teamOf(m) || {}).name || S().club.name)} ${m.home ? 'contre' : 'chez'} ${esc(m.opponent || '?')}`;

  /* ---------- progress: what is ready ---------- */
  function done(m) {
    const p = P(m), o = p.opp || {}, pl = p.plan || {}, t = p.talk || {}, d = p.day || {};
    return {
      semaine: weekSessions(m).length > 0,
      adversaire: !!(o.system || o.strengths || o.weaknesses || o.players || o.notes),
      plan: !!(m.lineupId || MOMENTS.some(([k]) => lines(pl[k]).length)),
      causerie: !!(t.objective && (t.keys || []).some(Boolean)),
      jourj: Object.values(d.kit || {}).filter(Boolean).length >= 3 || Object.values(d.warm || {}).some(Boolean),
      mitemps: !!(p.half && (p.half.def || p.half.off || p.half.coll || p.half.notes)),
      apres: !!(p.after && (p.after.good || p.after.work || p.after.next)),
    };
  }
  const score = m => { const d = done(m), keys = m.played ? STEPS.map(s => s[0]) : STEPS.slice(0, 5).map(s => s[0]); return Math.round(keys.filter(k => d[k]).length / keys.length * 100); };

  // the card on the match page
  function card(m) {
    const d = done(m), pc = score(m);
    return `<section class="card prep-card"><div class="row-head"><h2>🎯 Préparation du match</h2><b class="prep-pc">${pc} %</b></div>
      <div class="prep-bar"><i style="width:${pc}%"></i></div>
      <div class="prep-steps-mini">${STEPS.map(([k, ic, l]) => `<a href="#/prepa/${m.id}/${k}" class="${d[k] ? 'ok' : ''}">${ic}<span>${l}</span></a>`).join('')}</div>
      <div class="chips"><a class="btn primary" href="#/prepa/${m.id}">${I.edit}<span>Préparer le match</span></a><button class="btn soft" data-prep-show="${m.id}">${I.play}<span>Lancer la causerie</span></button><button class="btn soft" data-prep-print="${m.id}">${I.pdf}<span>Imprimer</span></button></div></section>`;
  }

  /* ---------- the sessions of the week before the match ---------- */
  function weekSessions(m) {
    if (!m.date) return [];
    const prev = S().matches.filter(x => x.teamId === m.teamId && x.id !== m.id && x.date < m.date && !x.exempt).map(x => x.date).sort().pop();
    const from = prev && prev > addDays(m.date, -8) ? prev : addDays(m.date, -8);
    return S().trainings.filter(t => !t.model && t.teamId === m.teamId && t.date > from && t.date < m.date).sort((a, b) => a.date.localeCompare(b.date));
  }
  // the days the team usually trains (the last 6 weeks), to propose the sessions before the match
  function usualDays(teamId) {
    const since = addDays(UI.today(), -42), n = {};
    S().trainings.filter(t => !t.model && t.teamId === teamId && t.date >= since).forEach(t => { const d = new Date(t.date + 'T12:00').getDay(); n[d] = (n[d] || 0) + 1; });
    return Object.keys(n).filter(d => n[d] >= 2).map(Number);
  }
  const daysBefore = (m, date) => Math.round((new Date(m.date + 'T12:00') - new Date(date + 'T12:00')) / 864e5);

  /* ---------- the page ---------- */
  function page(root, id, step) {
    const m = Store.get('matches', id); if (!m) { location.hash = '#/matchs'; return; }
    const p = P(m); step = STEPS.some(s => s[0] === step) ? step : (Store.state.ui.prepStep && Store.state.ui.prepStep[id]) || 'semaine';
    let t = null;
    const save = (now) => { clearTimeout(t); m.editedBy = (Auth.current() || {}).id; if (now) Store.upsert('matches', m); else t = setTimeout(() => Store.upsert('matches', m), 500); };
    const d = done(m), pc = score(m), ix = STEPS.findIndex(s => s[0] === step);
    root.innerHTML = `<header class="page-head"><div><h1>🎯 Préparation</h1><p class="sub">${title(m)} · ${esc(UI.fmtDate(m.date, { weekday: 'long', day: 'numeric', month: 'long' }))}${m.time ? ' · ' + esc(m.time.replace(':', 'h')) : ''}</p></div>
      <div class="head-actions"><a class="btn" href="#/match/${m.id}">${I.back}<span>Le match</span></a><button class="btn" data-pa="share">${I.share}<span>Résumé aux joueurs</span></button><button class="btn" data-pa="print">${I.pdf}<span>Imprimer</span></button><button class="btn primary" data-pa="show">${I.play}<span>Lancer la causerie</span></button></div></header>
      <div class="prep-top"><div class="prep-bar"><i style="width:${pc}%"></i></div><b>${pc} %</b></div>
      <nav class="prep-steps" aria-label="Étapes">${STEPS.map(([k, ic, l], i) => `<a href="#/prepa/${m.id}/${k}" class="${k === step ? 'on' : ''} ${d[k] ? 'ok' : ''}" ${k === step ? 'aria-current="step"' : ''}><b>${d[k] ? '✓' : i + 1}</b><span>${ic} ${l}</span></a>`).join('')}</nav>
      <div id="prepBody">${({ semaine: stWeek, adversaire: stOpp, plan: stPlan, causerie: stTalk, jourj: stDay, mitemps: stHalf, apres: stAfter })[step](m)}</div>
      <div class="prep-nav">${ix > 0 ? `<a class="btn" href="#/prepa/${m.id}/${STEPS[ix - 1][0]}">${I.back}<span>${STEPS[ix - 1][2]}</span></a>` : '<span></span>'}
        ${ix < STEPS.length - 1 ? `<a class="btn primary" href="#/prepa/${m.id}/${STEPS[ix + 1][0]}"><span>${STEPS[ix + 1][2]}</span>${I.next}</a>` : `<button class="btn primary" data-pa="show">${I.play}<span>Lancer la causerie</span></button>`}</div>`;
    S().ui.prepStep = Object.assign(S().ui.prepStep || {}, { [id]: step });
    // every field is written in the plan as soon as it is typed
    root.oninput = e => { const f = e.target.dataset.p; if (!f) return; set(p, f, e.target.type === 'checkbox' ? e.target.checked : e.target.value); save(); };
    root.onchange = e => {
      const f = e.target.dataset.p; if (!f) return; set(p, f, e.target.type === 'checkbox' ? e.target.checked : e.target.value); save(true);
      if (e.target.dataset.redraw) page(root, id, step);
    };
    root.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.pa === 'show') return show(m);
      if (b.dataset.pa === 'share') return share(m);
      if (b.dataset.pa === 'print') return printDialog(m);
      if (b.dataset.players) return Parents.sharePlayers(b.dataset.players);
      // a proposition added as a new line of a text box, or put in the first empty key
      if (b.dataset.add) {
        const [path, txt] = [b.dataset.add, b.dataset.txt];
        if (path === 'talk.keys') { const k = (p.talk = p.talk || {}).keys = (p.talk.keys || ['', '', '']); const i = k.findIndex(x => !x); if (i < 0) return toast('Les 3 clés sont déjà remplies : 3, c\'est le bon nombre', 'err'); k[i] = txt; }
        else { const cur = lines(get(p, path)); if (cur.includes(txt)) return; set(p, path, [...cur, txt].join('\n')); }
        save(true); return page(root, id, step);
      }
      if (b.dataset.newtr) return newSession(m, b.dataset.newtr, +b.dataset.j);
      if (b.dataset.pa === 'lineup') { location.hash = '#/match/' + m.id; return; }
      if (b.dataset.pa === 'halftimer') return halfTimer();
      if (b.dataset.mic) return dictate(root, b.dataset.mic);
      if (b.dataset.pa === 'resetwarm') { p.day = Object.assign(p.day || {}, { warm: {} }); save(true); return page(root, id, step); }
      if (b.dataset.pa === 'allwarm') { const w = {}; WARM().forEach((x, i) => w[i] = true); p.day = Object.assign(p.day || {}, { warm: w }); save(true); return page(root, id, step); }
    };
  }

  const chipsAdd = (path, list) => `<div class="chips prep-sugg">${list.map(x => `<button class="chip" data-add="${path}" data-txt="${esc(x)}">+ ${esc(x)}</button>`).join('')}</div>`;
  const area = (path, val, ph, rows = 3) => `<textarea data-p="${path}" rows="${rows}" placeholder="${esc(ph)}">${esc(val || '')}</textarea>`;

  // 1 · the week
  function stWeek(m) {
    const list = weekSessions(m), days = usualDays(m.teamId), have = new Set(list.map(t => daysBefore(m, t.date)));
    // the days to propose: the team's usual days in the 4 days before the match, otherwise J-1 and J-3
    let prop = [1, 2, 3, 4].filter(j => days.includes(new Date(addDays(m.date, -j) + 'T12:00').getDay()));
    if (!prop.length) prop = [1, 3];
    // the eve of the match is always proposed (short activation + CPA session)
    prop = [...new Set([...prop, 1])].sort((a, b) => b - a).filter(j => !have.has(j) && addDays(m.date, -j) >= UI.today());
    return `<section class="card"><h2>🗓️ Les entraînements avant le match</h2>
      <p class="muted small">La semaine monte en intensité puis redescend : le plus dur 3 jours avant (J-3), la veille une séance courte et vive avec les coups de pied arrêtés (J-1).</p>
      <div class="prep-days">${list.map(t => { const j = daysBefore(m, t.date), info = DAYS[j]; return `<a class="prep-day ok" href="#/entrainement/${t.id}"><b>${info ? info[0] : 'J-' + j}</b><span><b>${esc(t.title || 'Entraînement')}</b><span class="muted small">${esc(UI.fmtDate(t.date))}${t.time ? ' · ' + esc(t.time) : ''}${info ? ' · ' + esc(info[1]) : ''}</span></span></a>`; }).join('')}
        ${prop.map(j => `<div class="prep-day"><b>${DAYS[j][0]}</b><span><b>${esc(DAYS[j][2])}</b><span class="muted small">${esc(UI.fmtDate(addDays(m.date, -j)))} · ${esc(DAYS[j][1])}</span></span><button class="btn soft" data-newtr="${addDays(m.date, -j)}" data-j="${j}">${I.plus}<span>Créer la séance</span></button></div>`).join('')}
        ${!list.length && !prop.length ? '<p class="muted">Pas d\'entraînement prévu avant ce match.</p>' : ''}</div></section>
      <section class="card"><h2>🎯 Thème de la semaine</h2>${area('week.theme', P(m).week && P(m).week.theme, 'ex : récupérer plus haut, mieux défendre les centres', 2)}
        ${chipsAdd('week.theme', ['Pressing et récupération haute', 'Défendre les centres', 'Transitions rapides', 'Coups de pied arrêtés', 'Conservation sous pression', 'Finition'])}</section>`;
  }
  async function newSession(m, date, j) {
    const ex = (MODELS()[j] || MODELS()[2]).map(([title, duration]) => ({ id: Store.uid(), title, duration, org: '', consignes: '', materiel: '', schemaId: null }));
    const theme = (P(m).week || {}).theme;
    const tr = Store.upsert('trainings', { id: Store.uid(), title: `${DAYS[j] ? DAYS[j][2] : 'Avant match'}${m.opponent ? ' (' + m.opponent + ')' : ''}`, date, time: '', teamId: m.teamId,
      goal: [DAYS[j] && DAYS[j][1], theme && 'Thème : ' + lines(theme).join(', ')].filter(Boolean).join('\n'), exercises: ex, presents: [] });
    toast('Séance créée : complète-la ou change les exercices');
    location.hash = '#/entrainement/' + tr.id;
  }

  // 2 · the opponent
  function stOpp(m) {
    const o = P(m).opp || {}, k = norm(m.opponent);
    const past = S().matches.filter(x => x.id !== m.id && x.played && k && norm(x.opponent) === k).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    return `<section class="card"><h2>🔎 ${esc(m.opponent || 'L\'adversaire')}</h2>
      ${past.length ? `<div class="prep-past">${past.map(x => { const r = x.gf > x.ga ? 'V' : x.gf < x.ga ? 'D' : 'N'; return `<span class="res-${r}"><b>${r}</b> ${x.gf}-${x.ga} · ${esc(UI.fmtDate(x.date, { day: 'numeric', month: 'short', year: '2-digit' }))}${(teamOf(x) || {}).name ? ' · ' + esc(teamOf(x).name) : ''}</span>`; }).join('')}</div>` : '<p class="muted small">Pas encore de match contre eux dans l\'appli.</p>'}
      <label class="fld"><span>Leur système</span><select data-p="opp.system"><option value="">Je ne sais pas</option>${systemsOf(m.teamId).map(s => `<option ${o.system === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
      <div class="row2"><label class="fld"><span>💪 Leurs forces</span>${area('opp.strengths', o.strengths, 'Une par ligne')}</label><label class="fld"><span>🎯 Leurs faiblesses</span>${area('opp.weaknesses', o.weaknesses, 'Une par ligne')}</label></div>
      <p class="lbl">Propositions : touche pour ajouter</p>
      <div class="prep-two"><div><span class="muted small">Forces</span>${chipsAdd('opp.strengths', OPP())}</div><div><span class="muted small">Faiblesses</span>${chipsAdd('opp.weaknesses', OPP())}</div></div>
      <label class="fld"><span>⭐ Joueurs à surveiller</span>${area('opp.players', o.players, 'ex : n°9, grand et fort de la tête\nn°7, très rapide, pied gauche')}</label>
      <label class="fld"><span>🚩 Leurs coups de pied arrêtés</span>${area('opp.cpa', o.cpa, 'ex : corners rentrants, un joueur sur le gardien', 2)}</label>
      <label class="fld"><span>Notes, vidéo, ce qu'on sait d'eux</span>${area('opp.notes', o.notes, 'Classement, derniers résultats, terrain…', 2)}</label></section>`;
  }

  // 3 · the game plan
  function stPlan(m) {
    const pl = P(m).plan || {}, lineup = m.lineupId && Store.get('schemas', m.lineupId), conv = (m.convoked || []).map(id => Store.get('players', id)).filter(Boolean).sort(Store.byName);
    return `<section class="card"><h2>🧠 Système et composition</h2>
      <div class="row2"><label class="fld"><span>Notre système</span><select data-p="plan.system"><option value="">—</option>${systemsOf(m.teamId).map(s => `<option ${pl.system === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
        <label class="fld"><span>Capitaine</span><select data-p="plan.captain"><option value="">—</option>${conv.map(x => `<option value="${x.id}" ${pl.captain === x.id ? 'selected' : ''}>${esc(Store.fullName(x))}</option>`).join('')}</select></label></div>
      ${lineup ? `<a class="prep-lineup" href="#/schema/${lineup.id}"><img alt="Composition" src="${UI.thumb(lineup)}"></a>` : `<p class="muted small">La composition se fait sur la page du match (convoqués puis « Faire la composition »).</p><button class="btn soft" data-pa="lineup">${I.formation}<span>Faire la composition</span></button>`}</section>
      ${pl.imported ? `<section class="card"><h2>📋 Plan de jeu (AssistCoachAI)</h2><p class="pre">${esc(pl.imported)}</p></section>` : ''}
      <section class="card"><h2>Les 4 moments du match</h2><p class="muted small">1 à 3 consignes par moment, des phrases courtes avec un verbe d'action.</p>
      ${MOM().map(([k, l, sug]) => `<div class="prep-moment"><label class="fld"><span>${l}</span>${area('plan.' + k, pl[k], 'Une consigne par ligne', 2)}</label>${chipsAdd('plan.' + k, sug)}</div>`).join('')}</section>
      <section class="card"><h2>🚩 Coups de pied arrêtés</h2>
        <div class="row2"><label class="fld"><span>Corners pour nous (tireur, placement)</span>${area('plan.cpaFor', pl.cpaFor, 'ex : tireur Adam, rentrant, 2 au premier poteau', 2)}</label>
          <label class="fld"><span>Corners contre nous</span>${area('plan.cpaAgainst', pl.cpaAgainst, 'ex : zone à 6, Karim sur leur n°9', 2)}</label>
          <label class="fld"><span>Coups francs</span>${area('plan.freeKicks', pl.freeKicks, 'Tireurs selon le côté', 2)}</label>
          <label class="fld"><span>Penalty</span><input data-p="plan.penalty" value="${esc(pl.penalty || '')}" placeholder="Tireur 1, tireur 2"></label></div></section>
      ${conv.length ? `<section class="card"><h2>👤 Rôles individuels</h2><p class="muted small">Une consigne courte pour ceux qui en ont besoin (facultatif).</p>
        <div class="prep-roles">${conv.map(x => `<label class="fld inline"><span>${esc(Store.shortName(x))}</span><input data-p="plan.roles.${x.id}" value="${esc((pl.roles || {})[x.id] || '')}" placeholder="ex : suivre leur n°10"></label>`).join('')}</div></section>` : ''}`;
  }

  // 4 · the team talk
  function stTalk(m) {
    const t = P(m).talk || {}, keys = t.keys || ['', '', ''], bs = (() => { try { return JSON.parse(localStorage.getItem(AppCfg.key('briefings'))) || []; } catch (e) { return []; } })();
    return `<section class="card"><h2>🗣️ La causerie</h2>
      <p class="muted small">5 à 10 minutes, en 3 temps : une accroche pour capter l'attention, le rappel tactique, puis le message de confiance. 3 clés maximum, des phrases courtes.</p>
      <label class="fld"><span>1 · L'accroche (les 30 premières secondes)</span>${area('talk.hook', t.hook, 'ex : Le match aller, on a perdu 2-1 à la dernière minute. Aujourd\'hui on écrit la suite.', 2)}</label>
      <label class="fld"><span>🎯 L'objectif du match ${mic('talk.objective')}</span><input data-p="talk.objective" value="${esc(t.objective || '')}" placeholder="ex : Gagner et garder la 3e place, ne pas encaisser sur CPA"></label>
      <div class="lbl">2 · Les 3 clés</div>
      ${[0, 1, 2].map(i => `<label class="fld inline prep-key"><b>${i + 1}</b><input data-p="talk.keys.${i}" value="${esc(keys[i] || '')}" placeholder="Clé n°${i + 1}">${mic('talk.keys.' + i)}</label>`).join('')}
      ${chipsAdd('talk.keys', KEYS())}
      <label class="fld"><span>3 · Le mot de la fin</span>${area('talk.final', t.final, Supporters.SLOGAN, 2)}</label>
      <label class="fld"><span>🔗 Lien vidéo pour les joueurs (YouTube, Drive…)</span><input data-p="talk.videoUrl" value="${esc(t.videoUrl || '')}" placeholder="https://youtu.be/…  (visible sur la page des joueurs)" inputmode="url"></label>
      <label class="fld"><span>🎬 Briefing vidéo à montrer (sur cet appareil)</span><select data-p="talk.briefing"><option value="">Aucun</option>${bs.map(b => `<option value="${b.id}" ${t.briefing === b.id ? 'selected' : ''}>${esc(b.name)} (${b.items.length})</option>`).join('')}</select></label>
      <label class="fld inline"><span>Durée visée</span><select data-p="talk.minutes">${[5, 8, 10, 12].map(n => `<option value="${n}" ${+(t.minutes || 8) === n ? 'selected' : ''}>${n} min</option>`).join('')}</select></label>
      <div class="chips"><button class="btn primary" data-pa="show">${I.play}<span>Lancer la causerie en plein écran</span></button>${Cloud.ready() ? `<button class="btn soft" data-players="${m.teamId}">${I.share}<span>Page des joueurs</span></button>` : ''}</div>
      <p class="muted small">L'objectif, les 3 clés, le mot de la fin et le lien vidéo apparaissent sur la page des joueurs (seniors, U17, U18).</p></section>`;
  }

  // 5 · match day: the times, the warm-up, the kit
  function timeline(m) {
    const ko = toMin(m.time); if (ko == null) return [];
    const warm = +((P(m).day || {}).warmMin || 25), rdv = toMin(m.rdv) != null ? toMin(m.rdv) : ko - (m.home ? 75 : 90);
    return [[rdv, m.home ? '📍 Rendez-vous au stade' : '🚌 Rendez-vous et départ'], [ko - warm - 20, '👕 Vestiaire, tenue, strapping'], [ko - warm - 12, '🗣️ Causerie'],
      [ko - warm, `🏃 Échauffement (${warm} min)`], [ko - 10, '🔙 Retour au vestiaire, derniers mots'], [ko - 3, '🤝 Sortie des joueurs'], [ko, Sport.isFoot() ? '⚽ Coup d\'envoi' : Sport.W().icon + ' Début du match']]
      .filter(([t]) => t >= rdv).sort((a, b) => a[0] - b[0]);
  }
  function stDay(m) {
    const dy = P(m).day || {}, tl = timeline(m), warm = dy.warm || {}, kit = dy.kit || {};
    return `<section class="card"><h2>⏰ Le déroulé du jour</h2>
      ${tl.length ? `<ol class="prep-tl">${tl.map(([t, l]) => `<li><b>${hm(t)}</b><span>${l}</span></li>`).join('')}</ol>` : '<p class="muted">Indique l\'heure du coup d\'envoi sur la page du match pour avoir le déroulé.</p>'}
      <label class="fld inline"><span>Échauffement</span><select data-p="day.warmMin" data-redraw="1">${[15, 20, 25, 30].map(n => `<option value="${n}" ${+(dy.warmMin || 25) === n ? 'selected' : ''}>${n} min</option>`).join('')}</select></label>
      <p class="muted small">20 à 25 minutes suffisent chez les adultes (moins pour les jeunes) : plus long, les joueurs arrivent fatigués au coup d'envoi.</p></section>
      <section class="card"><div class="row-head"><h2>🏃 L'échauffement</h2>${Object.values(warm).some(Boolean) ? '<button class="linkish" data-pa="resetwarm">Tout décocher</button>' : '<button class="linkish" data-pa="allwarm">Tout cocher</button>'}</div>
      <div class="prep-checks">${WARM().map(([l, n], i) => `<label class="prep-check"><input type="checkbox" data-p="day.warm.${i}" ${warm[i] ? 'checked' : ''}><span><b>${Math.max(1, Math.round(n * +(dy.warmMin || 25) / 25))} min</b> · ${esc(l)}</span></label>`).join('')}</div>
      <label class="fld"><span>Notes d'échauffement</span>${area('day.warmNotes', dy.warmNotes, 'ex : gardien avec l\'entraîneur des gardiens à part', 2)}</label></section>
      <section class="card"><h2>🎒 Le matériel</h2>
      <div class="prep-checks">${KITS().map((l, i) => `<label class="prep-check"><input type="checkbox" data-p="day.kit.${i}" ${kit[i] ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>
      <label class="fld"><span>Autre chose à ne pas oublier</span>${area('day.other', dy.other, 'ex : clés du vestiaire, feuille de covoiturage', 2)}</label></section>`;
  }

  // 6 · half-time
  function stHalf(m) {
    const h = P(m).half || {};
    return `<section class="card"><h2>⏸️ La mi-temps</h2>
      <p class="muted small">D'abord 2 ou 3 minutes de calme (s'hydrater, souffler), puis 3 points maximum : un défensif, un offensif, un collectif. Finir par un message positif.</p>
      <button class="btn soft" data-pa="halftimer">${I.clock}<span>Chrono de la mi-temps (15 min)</span></button>
      <label class="fld"><span>🛡️ Le point défensif</span><input data-p="half.def" value="${esc(h.def || '')}" placeholder="ex : on laisse trop d'espace entre milieu et défense"></label>
      <label class="fld"><span>⚽ Le point offensif</span><input data-p="half.off" value="${esc(h.off || '')}" placeholder="ex : leur côté droit est libre, on renverse"></label>
      <label class="fld"><span>🤝 Le point collectif</span><input data-p="half.coll" value="${esc(h.coll || '')}" placeholder="ex : on parle plus, on se replace ensemble"></label>
      <label class="fld"><span>🔁 Changements prévus</span><input data-p="half.subs" value="${esc(h.subs || '')}" placeholder="ex : Karim pour Ilyes à la 60e"></label>
      <label class="fld"><span>Notes du match (pendant la 1re période)</span>${area('half.notes', h.notes, 'Ce que tu vois, au fil du match', 3)}</label></section>`;
  }
  function halfTimer() {
    const end = Date.now() + 15 * 60000;
    const phase = s => s > 12 * 60 ? ['😮‍💨 Calme : s\'hydrater, souffler', 'Laisse les joueurs récupérer, pas de reproche à chaud.'] : s > 5 * 60 ? ['🗣️ Tes 3 points', 'Un défensif, un offensif, un collectif. Court et clair.'] : s > 2 * 60 ? ['💪 Message positif', 'Confiance, on y retourne ensemble.'] : ['🏃 Reprise', 'Petite activation, retour sur le terrain.'];
    let iv = null;
    const close = modal({ title: 'Mi-temps', noFocus: true, body: '<div class="prep-timer" id="htT"></div>', actions: [{ label: 'Fermer' }] });
    const tick = () => { const el = document.getElementById('htT'); if (!el) return clearInterval(iv); const s = Math.max(0, Math.round((end - Date.now()) / 1000)), [a, b] = phase(s);
      el.innerHTML = `<b>${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}</b><p>${a}</p><span class="muted small">${b}</span>`; if (!s) clearInterval(iv); };
    tick(); iv = setInterval(tick, 1000); void close;
  }

  // 7 · after the match
  function stAfter(m) {
    const a = P(m).after || {};
    return `<section class="card"><h2>📝 Après le match</h2>
      ${m.played ? `<p class="prep-score">${esc(S().club.name)} <b>${m.gf} - ${m.ga}</b> ${esc(m.opponent || '')}</p>` : '<p class="muted small">Le score se met sur la page du match (« Le match est joué »).</p>'}
      <p class="muted small">À chaud : un mot positif, pas d'analyse. Le vrai bilan au premier entraînement, avec la vidéo si tu l'as.</p>
      <label class="fld"><span>✅ Ce qui a marché</span>${area('after.good', a.good, 'Une idée par ligne')}</label>
      <label class="fld"><span>🔧 Ce qu'on travaille cette semaine</span>${area('after.work', a.work, 'Une idée par ligne')}</label>
      <label class="fld"><span>🎯 Thème du prochain entraînement</span><input data-p="after.next" value="${esc(a.next || '')}" placeholder="ex : défendre les centres"></label>
      <div id="prepVideos"></div></section>`;
  }

  /* ---------- the summary for the players (WhatsApp) ---------- */
  function summary(m) {
    const p = P(m), t = p.talk || {}, keys = (t.keys || []).filter(Boolean), tl = timeline(m), hh = s => String(s || '').replace(':', 'h');
    return [`${Sport.W().icon} ${(teamOf(m) || {}).name || S().club.name} ${m.home ? 'contre' : 'chez'} ${m.opponent || '?'} · ${UI.fmtDate(m.date, { weekday: 'long', day: 'numeric', month: 'long' })}`,
      `🕘 ${m.rdv ? 'Rendez-vous ' + hh(m.rdv) : tl.length ? 'Rendez-vous ' + hm(tl[0][0]) : ''}${m.time ? ' · coup d\'envoi ' + hh(m.time) : ''}${m.place ? ' · 📍 ' + m.place : ''}`,
      t.objective ? `🎯 Objectif : ${t.objective}` : '',
      keys.length ? `🔑 Nos clés :\n${keys.map((k, i) => `${i + 1}. ${k}`).join('\n')}` : '',
      p.plan && p.plan.system ? `🧠 Système : ${p.plan.system}` : '',
      `💬 ${lines(t.final).join(' ') || Supporters.SLOGAN}`].filter(Boolean).join('\n\n');
  }
  async function share(m) {
    const txt = summary(m);
    try { if (navigator.share && matchMedia('(pointer: coarse)').matches) { await navigator.share({ text: txt }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(txt); toast('Résumé copié : colle-le dans WhatsApp'); }
    catch (e) { modal({ title: 'Résumé aux joueurs', body: `<textarea rows="12" style="width:100%">${esc(txt)}</textarea>`, actions: [{ label: 'Fermer' }] }); }
  }

  /* ---------- the team talk, full screen ---------- */
  function show(m) {
    const p = P(m), t = p.talk || {}, o = p.opp || {}, pl = p.plan || {}, keys = (t.keys || []).filter(Boolean);
    const lineup = m.lineupId && Store.get('schemas', m.lineupId), cap = pl.captain && Store.get('players', pl.captain);
    const roles = Object.entries(pl.roles || {}).filter(([, v]) => v).map(([id, v]) => [Store.get('players', id), v]).filter(([x]) => x);
    const bl = (arr, cls = '') => `<ul class="pp-list ${cls}">${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
    const slides = [
      `<div class="pp-title">${Supporters.coin('pp-crest')}<p class="pp-eyebrow">${esc(UI.fmtDate(m.date, { weekday: 'long', day: 'numeric', month: 'long' }))}${m.time ? ' · ' + esc(m.time.replace(':', 'h')) : ''}${m.competition ? ' · ' + esc(m.competition) : ''}</p>
        <h1>${esc((teamOf(m) || {}).name || S().club.name)} <i>${m.home ? 'contre' : 'chez'}</i> ${esc(m.opponent || '?')}</h1>${t.hook ? `<p class="pp-hook">${esc(t.hook)}</p>` : ''}${t.objective ? `<p class="pp-obj">🎯 ${esc(t.objective)}</p>` : ''}</div>`,
      lineup || pl.system ? `<h2>🧠 Notre équipe${pl.system ? ' · ' + esc(pl.system) : ''}</h2>${lineup ? `<img class="pp-lineup" alt="" src="${UI.thumb(lineup, 1280, 832)}">` : ''}${cap ? `<p class="pp-cap">©️ Capitaine : <b>${esc(Store.fullName(cap))}</b></p>` : ''}` : '',
      o.system || o.strengths || o.weaknesses || o.players ? `<h2>🔎 ${esc(m.opponent || 'L\'adversaire')}${o.system ? ' · ' + esc(o.system) : ''}</h2><div class="pp-cols">
        ${lines(o.strengths).length ? `<div><h3>💪 Leurs forces</h3>${bl(lines(o.strengths), 'bad')}</div>` : ''}${lines(o.weaknesses).length ? `<div><h3>🎯 Leurs faiblesses</h3>${bl(lines(o.weaknesses), 'good')}</div>` : ''}
        ${lines(o.players).length ? `<div><h3>⭐ À surveiller</h3>${bl(lines(o.players))}</div>` : ''}${lines(o.cpa).length ? `<div><h3>🚩 Leurs CPA</h3>${bl(lines(o.cpa))}</div>` : ''}</div>` : '',
      MOMENTS.some(([k]) => lines(pl[k]).length) ? `<h2>Le plan de jeu</h2><div class="pp-grid">${MOM().map(([k, l]) => `<div><h3>${l}</h3>${bl(lines(pl[k]))}</div>`).join('')}</div>` : '',
      pl.cpaFor || pl.cpaAgainst || pl.freeKicks || pl.penalty ? `<h2>🚩 Coups de pied arrêtés</h2><div class="pp-grid">${[['Corners pour nous', pl.cpaFor], ['Corners contre nous', pl.cpaAgainst], ['Coups francs', pl.freeKicks], ['Penalty', pl.penalty]].filter(([, v]) => v).map(([l, v]) => `<div><h3>${l}</h3>${bl(lines(v))}</div>`).join('')}</div>` : '',
      roles.length ? `<h2>👤 Les rôles</h2><div class="pp-roles">${roles.map(([x, v]) => `<p><b>${esc(Store.shortName(x))}</b><span>${esc(v)}</span></p>`).join('')}</div>` : '',
      keys.length ? `<h2>🔑 Nos 3 clés</h2><div class="pp-keys">${keys.map((k, i) => `<p><b>${i + 1}</b><span>${esc(k)}</span></p>`).join('')}</div>` : '',
      t.briefing ? `<h2>🎬 La vidéo</h2><p class="pp-hook">Le briefing vidéo du match</p><button class="btn primary pp-big" data-pp="video">${I.play}<span>Lancer le briefing vidéo</span></button>` : '',
      `<div class="pp-final"><div class="pp-flag">${Supporters.flag()}</div><p class="pp-word">${esc(lines(t.final).join(' ') || Supporters.SLOGAN)}</p><p class="pp-go">Allez ${esc(S().club.short || 'le club')} !</p></div>`,
    ].filter(Boolean);
    const ov = document.createElement('div'); ov.className = 'pp-show'; document.body.appendChild(ov);
    const t0 = Date.now(), target = +(t.minutes || 8) * 60; let i = 0, iv = null;
    const end = () => { clearInterval(iv); ov.remove(); document.removeEventListener('keydown', key); try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch (e) {} };
    const go = n => { i = Math.max(0, Math.min(slides.length - 1, n));
      ov.innerHTML = `<div class="pp-slide">${slides[i]}</div>
        <div class="pp-bar"><button class="icon-btn" data-pp="prev" aria-label="Précédent" ${i ? '' : 'disabled'}>${I.back}</button><span class="pp-dots">${slides.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</span>
        <span class="pp-clock" id="ppClock"></span><button class="icon-btn" data-pp="next" aria-label="Suivant" ${i < slides.length - 1 ? '' : 'disabled'}>${I.next}</button><button class="icon-btn" data-pp="close" aria-label="Fermer">${I.x}</button></div>`; clock(); };
    // the time of the talk: green, orange near the aimed length, red beyond
    const clock = () => { const el = ov.querySelector('#ppClock'); if (!el) return; const s = Math.round((Date.now() - t0) / 1000); el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} / ${target / 60} min`; el.className = 'pp-clock ' + (s > target ? 'late' : s > target * .8 ? 'soon' : ''); };
    const key = e => { if (e.key === 'Escape') end(); if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(i + 1); } if (e.key === 'ArrowLeft') go(i - 1); };
    document.addEventListener('keydown', key);
    let sx = null; ov.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
    ov.addEventListener('touchend', e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1)); });
    ov.onclick = e => { const b = e.target.closest('[data-pp]'); if (!b) return; const x = b.dataset.pp;
      if (x === 'close') return end(); if (x === 'next') return go(i + 1); if (x === 'prev') return go(i - 1);
      if (x === 'video') { let bs = []; try { bs = JSON.parse(localStorage.getItem(AppCfg.key('briefings'))) || []; } catch (e) {} if (!bs.some(b2 => b2.id === t.briefing)) return toast('Ce briefing n\'est pas sur cet appareil', 'err'); end(); location.hash = '#/briefing/' + t.briefing; } };
    try { const d = document.documentElement, pr = (d.requestFullscreen || d.webkitRequestFullscreen || (() => {})).call(d); if (pr && pr.catch) pr.catch(() => {}); } catch (e) {}
    go(0); iv = setInterval(clock, 1000);
    if (!keys.length && !t.objective) toast('Astuce : remplis l\'étape « Causerie » (objectif et 3 clés) pour une causerie complète');
  }

  /* ---------- everything on paper (no screen in the locker room) ----------
     a poster in big letters to pin up, the coach's sheets, and the half-time / after-match sheets to fill in by hand */
  const PARTS = [['poster', 'Affiche du vestiaire (objectif, 3 clés, slogan en grand)'], ['talk', 'Causerie et plan de jeu (composition, 4 moments, CPA, rôles)'],
    ['opp', 'Fiche adversaire'], ['week', 'Semaine d\'entraînement'], ['day', 'Jour J : horaires, échauffement, matériel à cocher'],
    ['half', 'Feuille de mi-temps à remplir'], ['after', 'Feuille d\'après-match à remplir']];
  function printDialog(m) {
    const last = S().ui.prepPrint || PARTS.map(x => x[0]);
    modal({ title: 'Imprimer la préparation', body: `<p class="muted small">Un PDF à imprimer ou à garder sur le téléphone, pour tout avoir sur papier au stade.</p>
      <div class="prep-checks">${PARTS.map(([k, l]) => `<label class="prep-check"><input type="checkbox" data-part="${k}" ${last.includes(k) ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>`,
      actions: [{ label: 'Annuler' }, { label: 'Créer le PDF', kind: 'primary', icon: I.pdf, onClick: (c, r) => {
        const parts = $$('[data-part]', r).filter(x => x.checked).map(x => x.dataset.part);
        if (!parts.length) { toast('Choisis au moins une partie', 'err'); return false; }
        S().ui.prepPrint = parts; Store.persistNow();
        setTimeout(async () => { const b = UI.busy('Création du PDF…'); try { const res = await pdf(m, parts); if (res === 'downloaded') toast('PDF enregistré dans Téléchargements'); } catch (e) { console.error(e); toast('PDF impossible : ' + (e.message || e), 'err'); } finally { b.done(); } }, 60);
      } }] });
  }
  async function pdf(m, parts) {
    const club = S().club, P = Exporter.pdfDoc(club), doc = P.doc, L = Exporter.latin;
    const pp = P(m), t = pp.talk || {}, o = pp.opp || {}, pl = pp.plan || {}, dy = pp.day || {}, half = pp.half || {}, af = pp.after || {};
    const team = teamOf(m), who = `${(team || {}).name || club.name} ${m.home ? 'contre' : 'chez'} ${m.opponent || '?'}`;
    const date = UI.fmtDate(m.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), hh = s => String(s || '').replace(':', 'h');
    const keys = (t.keys || []).filter(Boolean), final = lines(t.final).join(' ') || Supporters.SLOGAN;
    let first = true;
    const page = (title) => { if (!first) doc.addPage(); first = false; P.header(title, `${(team || {}).name || ''} · ${UI.fmtDate(m.date)}`); };
    // lines to write on by hand
    const writeLines = (n, label) => { if (label) P.label(label); for (let i = 0; i < n; i++) { P.ensure(9); doc.setDrawColor(190, 196, 190); doc.setLineWidth(.2); doc.line(P.M, P.y + 7, P.M + P.CW, P.y + 7); P.y += 9; } P.y += 2; };
    // boxes to tick by hand
    const ticks = (items) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(11); items.forEach(it => { P.ensure(8); doc.setDrawColor(80, 90, 85); doc.setLineWidth(.35); doc.rect(P.M, P.y + .6, 4.6, 4.6); doc.text(L(it), P.M + 8, P.y + 4.4, { maxWidth: P.CW - 8 }); P.y += 7.5; }); P.y += 2; };
    const text = (label, v) => { if (!lines(v).length) return; P.label(label); P.bullets(lines(v)); };

    if (parts.includes('poster')) {
      // the poster: navy page, crest, the match, the objective, the 3 keys, the slogan, all in big letters
      if (!first) doc.addPage(); first = false;
      const W = 210, H = 297;
      doc.setFillColor(14, 29, 69); doc.rect(0, 0, W, H, 'F'); doc.setFillColor(140, 16, 36); doc.rect(0, H - 12, W, 12, 'F');
      const logo = Exporter.crestData(); if (logo) doc.addImage(logo, 'PNG', W / 2 - 22, 14, 44, 44);
      doc.setTextColor(226, 194, 125); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(L(`${date}${m.time ? ' · ' + hh(m.time) : ''}`.toUpperCase()), W / 2, 68, { align: 'center' });
      doc.setTextColor(255, 255, 255); doc.setFontSize(28); doc.text(doc.splitTextToSize(L(who), W - 30), W / 2, 81, { align: 'center' });
      let y = 100;
      if (t.objective) { doc.setDrawColor(226, 194, 125); doc.setLineWidth(.8); const ls = doc.splitTextToSize(L(t.objective), W - 50); doc.roundedRect(18, y - 7, W - 36, ls.length * 9 + 8, 3, 3); doc.setFontSize(19); doc.text(ls, W / 2, y, { align: 'center' }); y += ls.length * 9 + 14; }
      if (keys.length) {
        doc.setTextColor(226, 194, 125); doc.setFontSize(15); doc.text(L('NOS 3 CLÉS'), W / 2, y, { align: 'center' }); y += 11;
        keys.forEach((k, i) => { doc.setFillColor(140, 16, 36); doc.circle(26, y - 2.5, 6, 'F'); doc.setTextColor(255, 255, 255); doc.setFontSize(16); doc.text(String(i + 1), 26, y + .5, { align: 'center' });
          doc.setFontSize(18); const ls = doc.splitTextToSize(L(k), W - 54); doc.text(ls, 38, y); y += ls.length * 8.5 + 7; });
      }
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(15);
      const fl = doc.splitTextToSize(L(final), W - 40); doc.text(fl, W / 2, Math.max(y + 8, H - 52 - fl.length * 7), { align: 'center' });
      doc.setFont('helvetica', 'bold'); doc.setTextColor(226, 194, 125); doc.setFontSize(26); doc.text(L(`ALLEZ ${String(S().club.short || 'LE CLUB').toUpperCase()} !`), W / 2, H - 24, { align: 'center' });
      doc.setTextColor(20, 30, 25);
    }
    if (parts.includes('talk')) {
      page('Causerie et plan de jeu'); P.h2(who);
      P.facts([['Date', UI.fmtDate(m.date)], ['Coup d\'envoi', hh(m.time) || '-'], ['Rendez-vous', hh(m.rdv) || '-'], ['Système', pl.system || '-']]);
      if (m.place) { P.label('Lieu'); P.para(m.place); }
      if (t.hook) { P.label('1 · L\'accroche'); P.para(t.hook, 11.5); }
      if (t.objective) { P.label('Objectif du match'); P.para(t.objective, 13); }
      if (keys.length) { P.label('2 · Les 3 clés'); keys.forEach((k, i) => P.para(`${i + 1}.  ${k}`, 13)); }
      P.label('3 · Le mot de la fin'); P.para(final, 11.5);
      const lineup = m.lineupId && Store.get('schemas', m.lineupId), cap = pl.captain && Store.get('players', pl.captain);
      if (lineup) { await Board.ensureBg(lineup); P.label('Composition' + (cap ? ' · capitaine : ' + Store.fullName(cap) : '')); P.image(Exporter.frameCanvas(lineup, 0, 0, { w: 1500, h: 980, names: true, homeBib: club.homeBib }), P.CW * .85); }
      else if (cap) { P.label('Capitaine'); P.para(Store.fullName(cap)); }
      if (MOMENTS.some(([k]) => lines(pl[k]).length)) { P.h2('Les 4 moments du match'); MOM().forEach(([k, l]) => text(l.replace(/^\S+\s/, ''), pl[k])); }
      const cpa = [['Corners pour nous', pl.cpaFor], ['Corners contre nous', pl.cpaAgainst], ['Coups francs', pl.freeKicks], ['Penalty', pl.penalty]].filter(([, v]) => v);
      if (cpa.length) { P.h2('Coups de pied arrêtés'); cpa.forEach(([l, v]) => text(l, v)); }
      const roles = Object.entries(pl.roles || {}).filter(([, v]) => v).map(([id, v]) => [Store.get('players', id), v]).filter(([x]) => x);
      if (roles.length) { P.h2('Rôles individuels'); P.table(['Joueur', 'Consigne'], roles.map(([x, v]) => [Store.fullName(x), v]), [.35, .65]); }
    }
    if (parts.includes('opp')) {
      page('Adversaire : ' + (m.opponent || '?'));
      const k = norm(m.opponent), past = S().matches.filter(x => x.id !== m.id && x.played && k && norm(x.opponent) === k).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
      if (past.length) { P.label('Nos derniers matchs contre eux'); P.table(['Date', 'Équipe', 'Score'], past.map(x => [UI.fmtDate(x.date), (teamOf(x) || {}).name || '', `${x.gf} - ${x.ga}`]), [.35, .4, .25]); }
      P.facts([['Leur système', o.system || '?']]);
      text('Leurs forces', o.strengths); text('Leurs faiblesses', o.weaknesses); text('Joueurs à surveiller', o.players); text('Leurs coups de pied arrêtés', o.cpa); text('Notes', o.notes);
      writeLines(4, 'À compléter');
    }
    if (parts.includes('week')) {
      page('Semaine d\'entraînement');
      if (pp.week && pp.week.theme) { P.label('Thème de la semaine'); P.para(lines(pp.week.theme).join(' · '), 12); }
      const list = weekSessions(m);
      if (list.length) {
        P.table(['Jour', 'Date', 'Séance', 'Durée'], list.map(x => { const j = daysBefore(m, x.date); return [DAYS[j] ? DAYS[j][0] : 'J-' + j, UI.fmtDate(x.date) + (x.time ? ' ' + x.time : ''), x.title || 'Entraînement', x.exercises.reduce((a, e) => a + (+e.duration || 0), 0) + ' min']; }), [.12, .28, .45, .15]);
        list.forEach(x => { const j = daysBefore(m, x.date); P.h2(`${DAYS[j] ? DAYS[j][0] + ' · ' : ''}${x.title || 'Entraînement'}`); if (x.goal) P.para(x.goal); if (x.exercises.length) P.bullets(x.exercises.map(e => `${e.title || 'Exercice'} (${e.duration || 0} min)`)); });
      } else P.para('Pas de séance enregistrée avant ce match.');
      P.h2('Repères de la semaine'); P.bullets([1, 2, 3, 4].map(j => `${DAYS[j][0]} : ${DAYS[j][1]}`));
    }
    if (parts.includes('day')) {
      page('Jour J');
      const tl = timeline(m);
      if (tl.length) { P.label('Le déroulé'); P.table(['Heure', 'Moment'], tl.map(([mn, l]) => [hm(mn), l.replace(/^\S+\s/, '')]), [.2, .8]); }
      const k = +(dy.warmMin || 25) / 25;
      P.h2(`Échauffement (${dy.warmMin || 25} min)`); ticks(WARM().map(([l, n]) => `${Math.max(1, Math.round(n * k))} min · ${l}`)); if (dy.warmNotes) P.para(dy.warmNotes);
      P.h2('Matériel'); ticks([...KITS(), ...lines(dy.other)]);
      const conv = (m.convoked || []).map(id => Store.get('players', id)).filter(Boolean).sort((a, b) => (a.number || 99) - (b.number || 99));
      if (conv.length) { P.h2(`Joueurs convoqués (${conv.length}) · présents`); ticks(conv.map(x => `${x.number ? x.number + '. ' : ''}${Store.fullName(x)}`)); }
    }
    if (parts.includes('half')) {
      page('Mi-temps');
      P.para('0-3 min : calme, s\'hydrater, souffler  ·  3-10 min : 3 points maximum  ·  10-13 min : message positif  ·  13-15 min : reprise', 10);
      P.label('Score à la mi-temps'); writeLines(1);
      [['Le point défensif', half.def], ['Le point offensif', half.off], ['Le point collectif', half.coll], ['Changements', half.subs]].forEach(([l, v]) => { if (v) { P.label(l); P.para(v, 11.5); writeLines(1); } else writeLines(2, l); });
      if (half.notes) { P.label('Notes'); P.para(half.notes); }
      writeLines(8, 'Notes de la 1re période');
    }
    if (parts.includes('after')) {
      page('Après-match');
      P.label('Score final'); if (m.played) P.para(`${club.name}  ${m.gf} - ${m.ga}  ${m.opponent || ''}`, 13); else writeLines(1);
      [['Ce qui a marché', af.good], ['Ce qu\'on travaille cette semaine', af.work], ['Thème du prochain entraînement', af.next]].forEach(([l, v]) => { if (lines(v).length) { P.label(l); P.bullets(lines(v)); writeLines(1); } else writeLines(3, l); });
      writeLines(6, 'Notes');
    }
    return Exporter.deliver(P.blob(), `preparation-${norm(m.opponent || 'match').toLowerCase()}-${m.date || ''}.pdf`);
  }

  // after-match: the match videos, to analyse them
  async function mountAfter(root, m) {
    const box = $('#prepVideos', root); if (!box) return;
    const vids = (await Media.list('match:' + m.id)).filter(x => x.kind === 'video');
    box.innerHTML = vids.length ? `<div class="lbl">🎬 Vidéos du match</div><div class="chips">${vids.map(v => `<a class="btn soft" href="#/analyse/${v.id}">${I.video}<span>Analyser ${esc(v.name || 'la vidéo')}</span></a>`).join('')}</div>`
      : '<p class="muted small">Ajoute la vidéo du match sur sa page (Photos et vidéos) ou un lien YouTube dans la Bibliothèque pour l\'analyser.</p>';
  }
  function route(root, id, step) { page(root, id, step); if ((step || (S().ui.prepStep || {})[id]) === 'apres') mountAfter(root, Store.get('matches', id)); }

  // « Lancer la causerie » from the match page
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-prep-show], [data-prep-print]'); if (!b) return;
    const m = Store.get('matches', b.dataset.prepShow || b.dataset.prepPrint); if (!m) return;
    if (b.dataset.prepShow) show(m); else printDialog(m);
  });
  return { page: route, card, show, summary, done, score, pdf };
})();
