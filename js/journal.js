/* (3.14) Journal: every change made in the app (players, matches, sessions, teams, drawings, dirigeants, settings, pitch and room bookings),
   with the date, the time and who made it. Kept by the club server (18 months); the responsables read it. */
const Journal = (() => {
  const { esc, $, toast } = UI;
  const COLS = [['', 'Tout'], ['players', 'Joueurs'], ['matches', 'Matchs'], ['trainings', 'Séances'], ['bookings', 'Créneaux'], ['teams', 'Équipes'], ['staff', 'Dirigeants'], ['schemas', 'Schémas'], ['club', 'Réglages']];
  const ICON = { players: '⚽', matches: '🏆', trainings: '🏃', bookings: '📅', teams: '👕', staff: '🧢', schemas: '🧩', club: '⚙️', reports: '🚩' };
  const ACT = { ajout: ['ajouté', 'good'], modification: ['modifié', ''], suppression: ['supprimé', 'bad'] };
  // the names of the fields, in words (the others: as they are)
  const FIELD = { firstName: 'prénom', lastName: 'nom', number: 'numéro', posts: 'postes', pos: 'poste', birth: 'naissance', phone: 'téléphone', email: 'e-mail', teamIds: 'équipes',
    licence: 'licence', adm: 'licence / cotisation', mute: 'mutation', notes: 'notes', photo: 'photo', parents: 'parents', urgent: 'fiche urgence', date: 'date', time: 'heure', rdv: 'rendez-vous',
    opponent: 'adversaire', place: 'lieu', home: 'domicile', competition: 'compétition', convoked: 'convoqués', convSent: 'convocation envoyée', convMsg: 'message de convocation',
    lineupId: 'composition', numbers: 'numéros du match', gf: 'score', ga: 'score', played: 'joué', stats: 'buts / passes', minutes: 'temps de jeu', live: 'match en direct', prep: 'préparation',
    presents: 'présences', exercises: 'exercices', title: 'titre', goal: 'objectif', name: 'nom', objects: 'dessin', steps: 'dessin', category: 'catégorie', format: 'format', role: 'rôle', access: 'accès',
    absents: 'absents', captain: 'capitaine', trial: 'essai', height: 'taille', weight: 'poids', notesCoach: 'notes du coach', cancelled: 'annulée' };
  let rows = [], col = '', who = '', done = false, busy = false;

  const fmt = at => { const d = new Date(at); return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); };
  const dayOf = at => new Date(at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const link = r => ({ players: '#/joueur/', matches: '#/match/', trainings: '#/entrainement/', teams: '#/equipe/', schemas: '#/schema/' }[r.col] || '') + (['players', 'matches', 'trainings', 'teams', 'schemas'].includes(r.col) ? r.item : '');
  const nameOf = r => r.name || ((Store.get('staff', r.who) || null) && Store.fullName(Store.get('staff', r.who))) || (r.who && r.who !== '?' ? 'Quelqu\'un (compte ' + r.who.slice(0, 6) + ')' : 'Quelqu\'un');

  async function more(root) {
    if (busy || done) return; busy = true;
    try {
      const last = rows.length ? rows[rows.length - 1].id : null, list = await Cloud.journal(last, col || null, who || null);
      rows = rows.concat(list || []); if (!list || list.length < 100) done = true;
    } catch (e) { toast(e.message, 'err'); done = true; }
    finally { busy = false; draw(root); }
  }
  function draw(root) {
    const box = $('#jrList', root); if (!box) return;
    let lastDay = '';
    box.innerHTML = rows.length ? rows.map(r => {
      const d = dayOf(r.at), head = d !== lastDay ? `<h3 class="sub-h">${esc(d)}</h3>` : ''; lastDay = d;
      const a = ACT[r.action] || [r.action, ''], fl = (r.fields || []).map(f => FIELD[f] || f).filter((x, i, l) => l.indexOf(x) === i), href = link(r);
      return `${head}<div class="list-item jr-row"><span class="jr-ic">${ICON[r.col] || '•'}</span><div class="li-main">
        <b>${href && r.action !== 'suppression' ? `<a href="${href}">${esc(r.label || '?')}</a>` : esc(r.label || '?')}</b>
        <span class="small"><span class="jr-act ${a[1]}">${esc(a[0])}</span> par <b>${esc(nameOf(r))}</b> · ${esc(fmt(r.at))}</span>
        ${fl.length ? `<span class="muted small">${esc(fl.join(', '))}</span>` : ''}</div></div>`;
    }).join('') : (busy ? '<p class="muted">Chargement…</p>' : '<p class="muted">Rien dans le journal pour l\'instant. Chaque modification faite à partir de maintenant y sera notée.</p>');
    const mb = $('#jrMore', root); if (mb) mb.hidden = done;
  }
  function page(root) {
    if (!Auth.isAdmin()) { location.hash = '#/'; return; }
    rows = []; done = false; busy = false;
    const staff = Store.state.staff.slice().sort(Store.byName);
    root.innerHTML = `<header class="page-head"><div><h1>📜 Journal des modifications</h1><p class="sub">Qui a changé quoi, et quand · gardé 18 mois</p></div>
      <div class="head-actions"><a class="btn" href="#/gestion">${I.back}<span>Gestion</span></a></div></header>
      <div class="filters"><select id="jrCol" aria-label="Quoi">${COLS.map(([v, l]) => `<option value="${v}" ${v === col ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <select id="jrWho" aria-label="Qui"><option value="">Tout le monde</option>${staff.map(s => `<option value="${esc(s.id)}" ${s.id === who ? 'selected' : ''}>${esc(Store.fullName(s))}</option>`).join('')}</select></div>
      <section class="card"><div id="jrList" class="list"></div><p><button class="btn soft wide" id="jrMore" hidden>Voir plus ancien</button></p></section>
      <p class="muted small">Les modifications d'une même personne sur le même élément pendant 10 minutes forment une seule ligne. Les libérations de créneaux indiquent qui les a libérés.</p>`;
    draw(root);
    if (!Cloud.ready()) { $('#jrList', root).innerHTML = '<p class="muted">Le journal est tenu par le serveur du club : connecte l\'appli au serveur (Réglages).</p>'; return; }
    const reset = () => { rows = []; done = false; draw(root); more(root); };
    $('#jrCol', root).onchange = e => { col = e.target.value; reset(); };
    $('#jrWho', root).onchange = e => { who = e.target.value; reset(); };
    $('#jrMore', root).onclick = () => more(root);
    more(root);
  }
  return { page };
})();
