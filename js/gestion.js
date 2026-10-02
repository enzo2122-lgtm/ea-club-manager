/* Gestion: the page of the responsable to run the club. What needs to be done in the next two weeks, then every tool
   of the club in one place (people, organisation, sport, communication, data), and « Mes rôles » to switch to the app of a
   coach, a volunteer, a referee, a player or a parent. Only for the responsables. */
const Gestion = (() => {
  const { esc } = UI;
  const S = () => Store.state;
  const pl = (n, w, ws) => `${n} ${n > 1 ? (ws || w + 's') : w}`;
  const addDays = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

  function todo() {
    const now = UI.today(), soon = addDays(14), next = S().matches.filter(m => !m.played && m.date >= now && m.date <= soon);
    const noRef = next.filter(m => m.home && !Store.isFriendly(m) && !m.refId);
    // volunteers: places still free on the tasks of the coming matches
    const tasks = Vol.tasks().filter(t => t.on !== false);
    const volFree = next.reduce((a, m) => a + tasks.filter(t => t.when === 'all' || (t.when === 'home' && m.home) || (t.when === 'away' && !m.home))
      .reduce((b, t) => b + Math.max(0, (+t.need || 1) - (((m.vol || {})[t.key]) || []).length), 0), 0);
    const noCoach = S().teams.filter(t => !Store.staffOf(t.id).length);
    const noScore = S().matches.filter(m => !m.played && !m.exempt && m.date < now && m.date >= People.seasonFrom());
    const noConv = next.filter(m => m.date <= addDays(4) && !(m.convoked || []).length);
    return [
      noRef.length && ['🟨', `${pl(noRef.length, 'match officiel', 'matchs officiels')} à domicile sans arbitre du club`, '#/arbitres'],
      volFree && ['🙋', `${pl(volFree, 'place')} de bénévole à prendre (2 semaines)`, '#/benevoles'],
      noConv.length && ['📋', `${pl(noConv.length, 'match', 'matchs')} dans 4 jours sans convocation`, '#/matchs'],
      noCoach.length && ['🧢', `${pl(noCoach.length, 'catégorie')} sans éducateur : ${noCoach.slice(0, 5).map(t => t.name).join(', ')}`, '#/encadrement'],
      noScore.length && ['⚽', `${pl(noScore.length, 'match', 'matchs')} passé${noScore.length > 1 ? 's' : ''} sans score`, '#/resultats'],
    ].filter(Boolean);
  }

  function page(root) {
    if (!Auth.isAdmin()) { location.hash = '#/'; return; }
    const t = todo(), nRef = Refs.refs().length;
    const tile = (href, ic, label, sub, act) => `<${act ? `button data-g="${act}"` : `a href="${href}"`} class="g-tile"><span class="g-ic">${ic}</span><span><b>${esc(label)}</b>${sub ? `<span class="muted small">${esc(sub)}</span>` : ''}</span></${act ? 'button' : 'a'}>`;
    const group = (title, tiles) => `<h2 class="section">${title}</h2><div class="g-grid">${tiles.join('')}</div>`;
    root.innerHTML = `<header class="page-head"><div><h1>🏛️ Gestion du club</h1><p class="sub">${esc(S().club.name || 'Le club')} · ${pl(S().teams.length, 'catégorie')} · ${pl(S().players.length, 'joueur')} · ${pl(S().staff.length, 'dirigeant')}</p></div>
      <div class="head-actions"><button class="btn primary" data-g="roles">🔀<span>Mes rôles</span></button></div></header>
      <section class="card"><h2>À faire</h2>${t.length ? `<div class="list">${t.map(([ic, txt, href]) => `<a class="list-item" href="${href}"><span class="li-main"><b>${ic} ${esc(txt)}</b></span>${I.back.replace('<svg', '<svg style="transform:rotate(180deg)"')}</a>`).join('')}</div>` : '<p class="muted">Rien d\'urgent : tout est en ordre pour les deux semaines à venir. 👍</p>'}</section>
      ${group('👥 Les personnes', [tile('#/joueurs', '⚽', 'Joueurs', pl(S().players.length, 'licencié')), tile('#/dirigeants', '🧢', 'Dirigeants et comptes', pl(S().staff.length, 'dirigeant')),
        tile('#/codes', '🔑', 'Codes personnels', 'Familles et joueurs : codes, QR, relances'), tile('#/licences', '🧾', 'Licences et cotisations', 'Suivi des dossiers'),
        tile('#/arbitres', '🟨', 'Arbitres', pl(nRef, 'arbitre') + ' du club'), tile('#/benevoles', '🙋', 'Bénévoles', 'Tâches des jours de match')])}
      ${group('🏟️ L\'organisation', [tile('#/equipes', '👕', 'Catégories et équipes', pl(S().teams.length, 'catégorie')), tile('#/encadrement', '📋', 'Qui encadre ?', 'Éducateurs par catégorie'),
        tile('#/planning', '📅', 'Planning des terrains', 'Créneaux et réservations'), tile('#/vestiaires', '🚿', 'Vestiaires', 'Attribution par match'), tile('#/club', '📌', 'Vie du club', 'Événements et signalements')])}
      ${group('⚽ Le sportif', [tile('#/president', '📊', 'Tableau de bord', 'Chiffres de la saison par catégorie'), tile('#/matchs', '🏆', 'Matchs', 'Officiels et amicaux'), tile('#/resultats', '🥇', 'Résultats', 'Toutes les catégories'),
        tile('#/stats', '📈', 'Stats', 'Buts, temps de jeu, présences'), tile('#/bilan', '📘', 'Bilan de saison', 'Par catégorie'), tile('#/exercices', '📚', 'Exercices du club', 'Bibliothèque des coachs')])}
      ${group('📣 La communication', [tile('#/messages', '💬', 'Messagerie', 'Tout le club, catégories, privés'), tile('', '📣', 'Message à tout le club', 'Les dirigeants reçoivent une notification', 'announce')])}
      ${group('🛠️ Les données', [tile('', '📥', 'Importer', 'Joueurs, matchs, dirigeants (photo, PDF, Excel)', 'import'), tile('', '🛟', 'Sauvegardes', 'Automatique chaque lundi, ou à la main', 'backup'),
        tile('#/reglages', '⚙️', 'Réglages du club', 'Couleurs, serveur, notifications, saison')])}`;
    root.onclick = e => {
      const b = e.target.closest('[data-g]'); if (!b) return;
      const g = b.dataset.g;
      if (g === 'roles') return Roles.open();
      if (g === 'backup') return President.backupDialog();
      if (g === 'announce') return announce();
      if (g === 'import') return UI.modal({ title: 'Importer', body: '<p class="muted small">Depuis une photo, une capture d\'écran, un PDF, un fichier Excel / CSV ou un texte copié. Tu vérifies le tableau avant d\'importer : rien n\'est créé en double.</p>',
        actions: [{ label: 'Annuler' }, ...[['players', '👥 Joueurs'], ['matches', '⚽ Matchs'], ['staff', '🧢 Dirigeants']].map(([k, l]) => ({ label: l, onClick: () => { setTimeout(() => Imports.open(k, () => page(root)), 60); } }))] });
    };
  }
  function announce() {
    if (!Cloud.ready()) return UI.toast('Il faut être connecté au serveur du club', 'err');
    UI.modal({ title: '📣 Message à tout le club', body: '<label class="fld"><span>Message</span><textarea id="anTxt" rows="4" maxlength="2000" placeholder="ex : Assemblée générale vendredi 19h au club-house"></textarea></label><p class="muted small">Il part dans « Tout le club » de la messagerie : chaque dirigeant le voit et reçoit une notification.</p>',
      actions: [{ label: 'Annuler' }, { label: 'Envoyer', kind: 'primary', onClick: (c, r) => {
        const txt = r.querySelector('#anTxt').value.trim(); if (!txt) { UI.toast('Écris le message', 'err'); return false; }
        Cloud.post('general', '📣 ' + txt).then(() => UI.toast('Message envoyé à tout le club')).catch(e => UI.toast(e.message || 'Envoi impossible', 'err'));
      } }] });
  }
  return { page, todo };
})();
