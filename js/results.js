/* Results: every match of every category, weekend by weekend, for the whole season.
   Everybody sees it (a coach only opens the match sheets of his own categories). The data is the club's matches,
   shared by the server, so it stays all season long on every device. */
const Results = (() => {
  const { esc, $, $$, toast, fmtDate } = UI;
  const S = () => Store.state;
  const seasonOf = iso => { const [y, m] = iso.split('-').map(Number); return m >= 7 ? y : y - 1; };
  const curSeason = () => seasonOf(UI.today());
  const label = y => `${y}-${y + 1}`;
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  // A match belongs to the weekend of its week (Monday → Sunday), named after its Saturday and Sunday
  const monday = s => { const d = parse(s); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return iso(d); };
  function weekendName(mon) {
    const sat = parse(mon); sat.setDate(sat.getDate() + 5); const sun = parse(mon); sun.setDate(sun.getDate() + 6);
    const m = d => d.toLocaleDateString('fr-FR', { month: 'long' });
    return sat.getMonth() === sun.getMonth() ? `Week-end du ${sat.getDate()} au ${sun.getDate()} ${m(sun)}` : `Week-end du ${sat.getDate()} ${m(sat)} au ${sun.getDate()} ${m(sun)}`;
  }
  const result = m => !m.played ? null : +m.gf > +m.ga ? 'V' : +m.gf < +m.ga ? 'D' : 'N';
  const RES = { V: ['Gagné', '✅'], N: ['Nul', '🟰'], D: ['Perdu', '❌'] };
  const teamName = m => (Store.get('teams', m.teamId) || {}).name || 'Équipe';
  const club = () => S().club.name || 'Nous';
  // Score written home team first
  const score = m => m.home ? `${m.gf} – ${m.ga}` : `${m.ga} – ${m.gf}`;
  // In the rows, the club's short name (« FA Le Raincy » → « Raincy ») so both teams fit on a phone
  const us = () => club().replace(/^(FA|AS|US|FC|ES|CS|SC|JS|RC)\s+/i, '').replace(/^(Le|La|Les|L')\s*/i, '') || club();
  const sides = (m, full) => { const c = full ? club() : us(); return m.home ? [c, m.opponent || '?'] : [m.opponent || '?', c]; };
  const rank = m => { const t = Store.get('teams', m.teamId); const i = S().teams.indexOf(t); return i < 0 ? 99 : i; };

  function page(root) {
    const ui = S().ui, seasons = [...new Set([curSeason(), ...S().matches.filter(m => m.date).map(m => seasonOf(m.date))])].sort((a, b) => b - a);
    const season = seasons.includes(ui.resSeason) ? ui.resSeason : curSeason();
    const all0 = S().matches.filter(m => m.date && !m.exempt && seasonOf(m.date) === season), all = all0.filter(Store.kindOk);
    const played = all.filter(m => m.played), now = UI.today();
    const upcoming = all.filter(m => !m.played && m.date >= now);
    const count = r => played.filter(m => result(m) === r).length;
    const bp = played.reduce((a, m) => a + (+m.gf || 0), 0), bc = played.reduce((a, m) => a + (+m.ga || 0), 0);
    // next weekend with matches still to play
    const nextMon = upcoming.length ? upcoming.map(m => monday(m.date)).sort()[0] : '';
    const nextList = upcoming.filter(m => monday(m.date) === nextMon).sort((a, b) => rank(a) - rank(b) || (a.date + a.time).localeCompare(b.date + b.time));
    const weeks = new Map();
    played.forEach(m => { const k = monday(m.date); if (!weeks.has(k)) weeks.set(k, []); weeks.get(k).push(m); });
    const weekKeys = [...weeks.keys()].sort().reverse();

    // Every coach opens every match (the other categories' ones to follow and cheer them)
    const row = m => {
      const r = result(m), [h, a] = sides(m);
      return `<a class="rs-row ${m.exempt ? '' : m.home ? 'side-home' : 'side-away'}" href="#/match/${m.id}" title="${m.home ? 'À domicile' : 'À l\'extérieur'}">
        <span class="rs-cat" style="background:${Planning.teamColor(m.teamId)}">${esc(teamName(m))}</span>
        <span class="rs-teams"><b class="${m.home ? 'us' : ''}">${esc(h)}</b><span class="rs-score">${m.played ? esc(score(m)) : esc(m.time || '–')}</span><b class="${m.home ? '' : 'us'}">${esc(a)}</b></span>
        ${r ? `<span class="res res-${r}">${RES[r][0]}</span>` : `<span class="muted small">${esc(fmtDate(m.date))}</span>`}
      </a>${m.played ? ClubLife.cheerBar(m) : ''}`;
    };
    const WORD = { V: 'victoire', N: 'nul', D: 'défaite' };
    const tally = list => ['V', 'N', 'D'].map(r => [r, list.filter(m => result(m) === r).length]).filter(x => x[1]).map(([r, n]) => `<span class="res res-${r}">${n} ${WORD[r]}${n > 1 ? 's' : ''}</span>`).join(' ');

    root.innerHTML = `<header class="page-head"><div><h1>Résultats du club</h1><p class="sub">Tous les matchs de toutes les catégories · saison ${label(season)}</p></div>
      <div class="head-actions">${weekKeys.length ? `<button class="btn primary" data-act="share">${I.share}<span>Partager le dernier week-end</span></button>` : ''}</div></header>
      ${seasons.length > 1 ? `<div class="chips filter">${seasons.map(y => `<button class="chip ${y === season ? 'on' : ''}" data-season="${y}">${label(y)}</button>`).join('')}</div>` : ''}
      ${UI.kindSeg({ off: all0.filter(m => m.played && !Store.isFriendly(m)).length, ami: all0.filter(m => m.played && Store.isFriendly(m)).length })}
      <section class="card rs-season">
        <div class="rs-tiles">
          <div class="tile"><b>${played.length}</b><span>matchs joués</span></div>
          <div class="tile t-V"><b>${count('V')}</b><span>victoires</span></div>
          <div class="tile t-N"><b>${count('N')}</b><span>nuls</span></div>
          <div class="tile t-D"><b>${count('D')}</b><span>défaites</span></div>
          <div class="tile"><b>${bp} – ${bc}</b><span>buts pour – contre</span></div>
        </div>
      </section>
      <div class="side-legend"><span class="side-home">🏠 Domicile</span><span class="side-away">🚌 Extérieur</span></div>
      ${nextList.length ? `<section class="card"><h2>${I.calendar}À venir · ${esc(weekendName(nextMon))}</h2><div class="rs-list">${nextList.map(row).join('')}</div></section>` : ''}
      ${weekKeys.length ? weekKeys.map(k => { const list = weeks.get(k).sort((a, b) => rank(a) - rank(b) || a.date.localeCompare(b.date));
        return `<section class="card"><div class="row-head"><h2>${I.medal}${esc(weekendName(k))}</h2><div class="rs-tally">${tally(list)}</div></div><div class="rs-list">${list.map(row).join('')}</div></section>`; }).join('')
        : `<div class="empty"><p>Pas encore de résultat cette saison. Dès qu'un éducateur note le score d'un match (Matchs → le match → score), il apparaît ici pour tout le club.</p></div>`}`;

    root.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.cheer) { ClubLife.cheer(b.dataset.cheer); return page(root); }
      if (b.dataset.season) { ui.resSeason = +b.dataset.season; Store.save(); return page(root); }
      if (b.dataset.act === 'share') return share(weekKeys[0], weeks.get(weekKeys[0]));
    };
  }

  // Text for WhatsApp: one line per category
  function share(mon, list) {
    const lines = list.slice().sort((a, b) => rank(a) - rank(b)).map(m => { const [h, a] = sides(m, true), r = result(m); return `${RES[r][1]} ${teamName(m)} : ${h} ${score(m)} ${a}`; });
    const text = `⚽ ${club()} · ${weekendName(mon)}\n\n${lines.join('\n')}\n\n${list.filter(m => result(m) === 'V').length} victoire(s), ${list.filter(m => result(m) === 'N').length} nul(s), ${list.filter(m => result(m) === 'D').length} défaite(s)`;
    if (navigator.share) return navigator.share({ title: 'Résultats du week-end', text }).catch(() => {});
    navigator.clipboard.writeText(text).then(() => toast('Récapitulatif copié : colle-le dans WhatsApp')).catch(() => UI.modal({ title: 'Récapitulatif', body: `<textarea rows="10" readonly>${esc(text)}</textarea>`, actions: [{ label: 'OK', kind: 'primary' }] }));
  }

  // Small card for the home page: the last weekend with results
  function homeCard() {
    const played = S().matches.filter(m => m.played && m.date && !m.exempt && seasonOf(m.date) === curSeason());
    if (!played.length) return '';
    const last = played.map(m => monday(m.date)).sort().reverse()[0], list = played.filter(m => monday(m.date) === last).sort((a, b) => rank(a) - rank(b));
    return `<section class="card"><h2>${I.medal}Résultats du club · ${esc(weekendName(last).replace('Week-end du ', ''))}</h2>
      <div class="rs-mini">${list.slice(0, 6).map(m => { const r = result(m); return `<span class="rs-chip ${m.home ? 'side-home' : 'side-away'}"><i style="background:${Planning.teamColor(m.teamId)}">${esc(teamName(m))}</i>${esc(score(m))}<span class="res res-${r}">${RES[r][0]}</span></span>`; }).join('')}</div>
      <a class="btn soft" href="#/resultats" style="margin-top:8px">${I.medal}<span>Tous les résultats de la saison</span></a></section>`;
  }

  return { page, homeCard };
})();
