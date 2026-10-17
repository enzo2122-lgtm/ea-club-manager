/* Tablet: the « mode tablette » (iPad on the bench, in the locker room): a few big tiles, readable by a 10-year-old,
   to open at once the tactical board (11, 8 or 5 a side), today's session, the next match and its lineup, the clock, the results.
   Full screen in one touch. Nothing new behind: the app's own pages, reached without menus. */
const Tablet = (() => {
  const { esc } = UI;
  const S = () => Store.state;
  const tablet = () => matchMedia('(min-width: 700px) and (pointer: coarse)').matches;
  function page(root) {
    const now = UI.today(), team = S().ui.teamId, mine = x => !team || x.teamId === team;
    const trs = S().trainings.filter(t => !t.model && t.date && Auth.sees(t.teamId) && mine(t)), ms = S().matches.filter(m => m.date && Auth.sees(m.teamId) && mine(m) && !m.exempt);
    const tr = trs.filter(t => t.date === now)[0] || trs.filter(t => t.date > now).sort((a, b) => a.date.localeCompare(b.date))[0];
    const m = ms.filter(x => !x.played && x.date >= now).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))[0];
    const fmts = typeof Sport !== 'undefined' && Sport.id && Sport.id() !== 'foot' ? [] : [['11', 'à 11'], ['8', 'à 8'], ['5', 'à 5']];
    const tile = (href, icon, title, sub, cls = '') => `<a class="tb-tile ${cls}" href="${href}"><span class="tb-ic">${icon}</span><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</a>`;
    root.innerHTML = `<header class="page-head"><div><h1>📱 Mode tablette</h1><p class="sub">Tout en grand, sans menu : pour le banc, le vestiaire ou montrer aux joueurs</p></div>
      <div class="head-actions"><button class="btn primary" data-tbfull>⛶<span>Plein écran</span></button></div></header>
      <div class="tb-grid">
        ${fmts.length ? fmts.map(([f, l]) => tile(`#/tableau/${f}`, '🟩', `Tableau ${l}`, 'Dessiner, déplacer les joueurs, flèches et zones', 'board')).join('') : tile('#/tableau', '🟩', 'Tableau tactique', 'Dessiner, déplacer les joueurs', 'board')}
        ${tile(tr ? `#/entrainement/${tr.id}` : '#/entrainements', '🏃', tr ? (tr.date === now ? 'La séance du jour' : 'La prochaine séance') : 'Les séances', tr ? esc(tr.title || 'Entraînement') + ' · ' + esc(UI.fmtDate(tr.date, { weekday: 'long', day: 'numeric' })) : 'Aucune séance prévue')}
        ${tile(m ? `#/match/${m.id}` : '#/matchs', '⚽', m ? 'Le prochain match' : 'Les matchs', m ? `${m.home ? 'contre' : 'chez'} ${esc(m.opponent || '?')} · ${esc(UI.fmtDate(m.date, { weekday: 'long', day: 'numeric' }))}` : 'Aucun match prévu')}
        ${m ? tile(`#/prepa/${m.id}/causerie`, '🗣️', 'La causerie', 'Objectif, 3 clés, plan de jeu') : ''}
        <button type="button" class="tb-tile board" data-tbq="${m ? m.id : ''}"><span class="tb-ic">✍️</span><b>${m ? 'Tableau du match' : 'Tableau rapide'}</b><span>Ton onze sur le terrain : glisse un joueur, dessine les courses et les passes</span></button>
        ${tile('#/terrain', '⏱️', 'Chrono et score', 'Chrono d\'exercice sonore, score par chasubles')}
        ${tile('#/schemas', '🎬', 'Schémas animés', 'Les exercices et les systèmes de jeu')}
        ${tile('#/stats', '🏆', 'Résultats et classement', 'Les scores de la saison')}
      </div>
      ${tablet() ? '' : '<p class="tip">Fait pour une tablette (iPad) : sur un ordinateur, les tuiles marchent pareil.</p>'}`;
    root.onclick = e => {
      const q = e.target.closest('[data-tbq]'); if (q) return QuickBoard.open(q.dataset.tbq ? { matchId: q.dataset.tbq } : { teamId: team });
      if (!e.target.closest('[data-tbfull]')) return;
      const d = document.documentElement;
      try { if (document.fullscreenElement) document.exitFullscreen(); else { const p = (d.requestFullscreen || d.webkitRequestFullscreen || (() => {})).call(d); if (p && p.catch) p.catch(() => UI.toast('Sur iPad : Partager → « Sur l\'écran d\'accueil » ouvre l\'appli en plein écran')); } }
      catch (x) { UI.toast('Sur iPad : Partager → « Sur l\'écran d\'accueil » ouvre l\'appli en plein écran'); }
    };
  }
  return { page, tablet };
})();
