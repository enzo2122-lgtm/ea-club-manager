/* Game (1.61): « Jeu des pronos », free predictions on the Champions League matches between the players and the coaches of a
   category (teams A and B together). No money, no stake: points, a ranking, and a little forfeit (« gage ») for the last of the
   week at the next session. Matches and results: TheSportsDB (free, open to web apps). Predictions: the club server
   (member_game* for the players' page, club_game* for the coaches' app). Used by joueurs.html and by the app (#/jeu). */
const Game = (() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const API = 'https://www.thesportsdb.com/api/v1/json/123/', LEAGUE = 4480; // UEFA Champions League
  const GAGES = ['10 pompes', '20 abdos', '15 squats', 'Gainage 45 secondes', 'Ranger les plots à la fin de la séance', 'Porter le sac de ballons', '20 jongles sans faire tomber le ballon', 'Un tour de terrain en petites foulées'];
  const FAVS = ['PSG', 'OM', 'OL', 'LOSC', 'AS Monaco', 'RC Lens', 'Stade Rennais', 'OGC Nice', 'Real Madrid', 'FC Barcelone', 'Atlético Madrid', 'Manchester City', 'Manchester United', 'Liverpool', 'Arsenal', 'Chelsea', 'Bayern Munich', 'Borussia Dortmund', 'Juventus', 'AC Milan', 'Inter Milan', 'Naples', 'Benfica', 'Porto', 'Ajax'];
  const season = () => { const d = new Date(), y = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-${y + 1}`; };
  const sKey = 'game-fx-' + LEAGUE;
  const get = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const j = async u => { const r = await fetch(API + u); if (!r.ok) throw new Error('Matchs indisponibles pour l\'instant'); return r.json(); };

  /* ---------- the matches (cached 2 hours on the device) ---------- */
  async function fixtures(force) {
    const c = get(sKey); if (!force && c && Date.now() - c.at < 2 * 3600e3) return c.list;
    const s = season(), from = s.slice(0, 4) + '-09-01';
    let r = 0; try { r = +((((await j(`eventsnextleague.php?id=${LEAGUE}`)).events || [])[0] || {}).intRound) || 0; } catch (e) {}
    if (!r) try { r = +((((await j(`eventspastleague.php?id=${LEAGUE}`)).events || [])[0] || {}).intRound) || 0; } catch (e) {}
    const seen = {}, list = [];
    for (let k = Math.max(1, r - 8); k <= r + 1 && r; k++) {
      try { ((await j(`eventsround.php?id=${LEAGUE}&r=${k}&s=${s}`)).events || []).forEach(e => {
        if (seen[e.idEvent] || !e.strTimestamp || e.dateEvent < from) return; seen[e.idEvent] = 1;
        const ko = Date.parse(e.strTimestamp + (/Z|[+-]\d\d:?\d\d$/.test(e.strTimestamp) ? '' : 'Z')), hs = e.intHomeScore == null || e.intHomeScore === '' ? null : +e.intHomeScore, as = e.intAwayScore == null || e.intAwayScore === '' ? null : +e.intAwayScore;
        list.push({ id: String(e.idEvent), home: e.strHomeTeam, away: e.strAwayTeam, hb: e.strHomeTeamBadge || '', ab: e.strAwayTeamBadge || '', ko, hs, as,
          done: hs != null && as != null && (/FT|AET|PEN|Match Finished/i.test(e.strStatus || '') || ko < Date.now() - 3 * 3600e3) });
      }); } catch (e) {}
    }
    list.sort((a, b) => a.ko - b.ko);
    if (list.length) put(sKey, { at: Date.now(), list });
    return list.length ? list : (c ? c.list : []);
  }
  // the week of a match (Monday), to group the matchdays
  const weekOf = t => { const d = new Date(t); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d.toISOString().slice(0, 10); };
  const pts = (b, e) => !b || !e.done ? null : (b.h === e.hs && b.a === e.as) ? 3 : Math.sign(b.h - b.a) === Math.sign(e.hs - e.as) ? 1 : 0;
  const hash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

  /* ---------- the computation: ranking and forfeits ---------- */
  function compute(view, fx) {
    const people = view.people || [], byId = {}; people.forEach(p => { byId[p.id] = Object.assign({ pts: 0, exact: 0, n: 0, good: 0, adv: 0, advN: 0 }, p); });
    const bets = {}; (view.bets || []).forEach(b => { (bets[b.e] = bets[b.e] || {})[b.p] = b; });
    fx.forEach(e => Object.values(bets[e.id] || {}).forEach(b => { const x = byId[b.p], q = pts(b, e); if (!x || q == null) return; x.pts += q; x.n++; if (q > 0) x.good++; if (q === 3) x.exact++;
      const at = Date.parse(b.at || ''); if (at && at < e.ko) { x.adv += (e.ko - at) / 3600e3; x.advN++; } }));
    // (1.62) tie-breaks: points, then the success rate (% of predictions that scored), then the speed (hours before the kick-off, on average)
    Object.values(byId).forEach(x => { x.pct = x.n ? Math.round(x.good / x.n * 100) : 0; x.speed = x.advN ? x.adv / x.advN : null; });
    const ranking = Object.values(byId).filter(x => x.n).sort((a, b) => b.pts - a.pts || b.pct - a.pct || (b.speed || 0) - (a.speed || 0) || b.exact - a.exact || a.name.localeCompare(b.name));
    // the last week whose matches are all over: the last one(s) get a forfeit for the next session
    const weeks = {}; fx.forEach(e => (weeks[weekOf(e.ko)] = weeks[weekOf(e.ko)] || []).push(e));
    const done = Object.keys(weeks).sort().reverse().find(w => weeks[w].every(e => e.done) && weeks[w].some(e => bets[e.id]));
    let gages = null;
    if (done) {
      const sc = {}; weeks[done].forEach(e => Object.values(bets[e.id] || {}).forEach(b => { if (byId[b.p]) sc[b.p] = (sc[b.p] || 0) + pts(b, e); }));
      const ids = Object.keys(sc), list = ((view.settings || {}).gages || []).filter(Boolean), pool = list.length ? list : GAGES;
      if (ids.length >= 2) {
        const min = Math.min(...ids.map(i => sc[i])), max = Math.max(...ids.map(i => sc[i]));
        gages = { week: done, tie: min === max, who: min === max ? [] : ids.filter(i => sc[i] === min).map(i => ({ p: byId[i], pts: sc[i], gage: pool[hash(done + i) % pool.length] })) };
      }
    }
    return { ranking, bets, weeks, gages, byId };
  }

  /* ---------- the page ---------- */
  const fmtD = t => new Date(t).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtT = t => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const badge = u => u ? `<img class="gm-b" src="${esc(u)}/tiny" alt="" loading="lazy" onerror="this.remove()">` : '';
  const adv = h => h >= 48 ? Math.round(h / 24) + ' j' : h >= 1 ? Math.round(h) + ' h' : Math.max(1, Math.round(h * 60)) + ' min';
  const favTag = f => f ? ` <span class="gm-fav">❤️ ${esc(f)}</span>` : '';
  let state = { view: null, fx: null, err: '' };
  async function load(o, force) {
    if (!force && state.view && Date.now() - (state.at || 0) < 60000) return;
    try { const [view, fx] = await Promise.all([o.load(), fixtures(force)]); state = { view, fx, err: '', at: Date.now() }; }
    catch (e) { state.err = e.message || 'Jeu indisponible'; }
  }
  function html(o) {
    const { view, fx, err } = state;
    if (!view && err && o.quiet) return ''; // (the player's page: nothing until the club server has the game)
    if (!view || !fx) return `<div class="gm"><h2>🎲 Jeu des pronos</h2><p class="gm-info">${err ? esc(err) : 'Chargement des matchs de Ligue des champions…'}</p></div>`;
    const set = view.settings || {}, me = (view.people || []).find(p => p.me) || {}, c = compute(view, fx), now = Date.now();
    const mine = id => ((c.bets[id] || {})[me.id]) || null;
    const open = fx.filter(e => e.ko > now).slice(0, 18), live = fx.filter(e => e.ko <= now && !e.done);
    const lastWeek = Object.keys(c.weeks).sort().reverse().find(w => c.weeks[w].some(e => e.done));
    const row = e => { const b = mine(e.id), started = e.ko <= now, others = Object.values(c.bets[e.id] || {}).filter(x => x.p !== me.id);
      return `<div class="gm-m" data-ev="${esc(e.id)}" data-ko="${e.ko}"><div class="gm-t">${badge(e.hb)}<span>${esc(e.home)}</span></div>
        ${started || set.off ? `<div class="gm-s">${e.done ? `<b>${e.hs} - ${e.as}</b>` : '<i>en cours</i>'}${b ? `<small>ton prono ${b.h}-${b.a}${e.done ? ` · <b>+${pts(b, e)}</b>` : ''}</small>` : '<small>pas de prono</small>'}${others.length ? `<small class="gm-oth">${others.slice(0, 6).map(x => `${esc((c.byId[x.p] || {}).name || '?')} ${x.h}-${x.a}`).join(' · ')}${others.length > 6 ? '…' : ''}</small>` : ''}</div>`
          : `<div class="gm-s"><span class="gm-in"><input type="number" min="0" max="20" inputmode="numeric" data-h value="${b ? b.h : ''}" aria-label="Buts ${esc(e.home)}">-<input type="number" min="0" max="20" inputmode="numeric" data-a value="${b ? b.a : ''}" aria-label="Buts ${esc(e.away)}"></span><small>${esc(fmtD(e.ko))} · ${esc(fmtT(e.ko))}${b ? ' · ✓ enregistré' : ''}</small></div>`}
        <div class="gm-t r"><span>${esc(e.away)}</span>${badge(e.ab)}</div></div>`; };
    const gg = c.gages;
    return `<div class="gm">
      <h2>🎲 Jeu des pronos <span class="gm-sub">Ligue des champions · ${esc(view.category || '')}</span></h2>
      <p class="gm-info">Pronostique le score des matchs (gratuit, sans argent). Score exact : <b>3 pts</b> · bon résultat : <b>1 pt</b>. Les pronos des autres apparaissent au coup d'envoi. Le dernier de la semaine a un gage à la séance suivante 😈</p>
      <div class="gm-favbox"><label>❤️ Mon club de cœur <input list="gm-favs" id="gmFav" maxlength="40" value="${esc(me.fav || '')}" placeholder="PSG, OM, Real Madrid…"></label><button class="gm-btn" data-gm-fav>OK</button>
        <datalist id="gm-favs">${FAVS.map(f => `<option value="${esc(f)}">`).join('')}</datalist></div>
      ${set.off ? '<p class="gm-warn">⏸️ Le jeu est en pause (décision des coachs).</p>' : ''}
      ${gg && gg.who.length ? `<div class="gm-gage"><b>🏋️ Gages pour la prochaine séance</b> <small>(semaine du ${esc(fmtD(gg.week))})</small><ul>${gg.who.map(x => `<li><b>${esc(x.p.name)}</b> (${x.pts} pt${x.pts > 1 ? 's' : ''}) → ${esc(x.gage)}</li>`).join('')}</ul></div>` : gg && gg.tie ? '<p class="gm-info">🤝 Égalité parfaite la semaine dernière : pas de gage.</p>' : ''}
      ${live.length ? `<h3>⚡ En cours</h3>${live.map(row).join('')}` : ''}
      ${open.length ? `<h3>📝 À pronostiquer</h3>${open.map(row).join('')}<p class="gm-info">Ton prono s'enregistre dès que les deux scores sont remplis. Modifiable jusqu'au coup d'envoi.</p>` : '<p class="gm-info">Pas de match à venir pour l\'instant.</p>'}
      <h3>🏆 Classement</h3>${c.ranking.length ? `<table class="gm-rank"><tbody>${c.ranking.map((x, i) => `<tr class="${x.me ? 'me' : ''}"><td>${i + 1}</td><td>${x.kind === 'coach' ? '🧢 ' : ''}${esc(x.name)}${favTag(x.fav)}</td><td><b>${x.pts}</b> pt${x.pts > 1 ? 's' : ''}</td><td class="gm-x" title="Réussite : pronos qui ont rapporté des points">🎯 ${x.pct} %</td><td class="gm-x" title="Rapidité : avance moyenne avant le coup d'envoi">${x.speed == null ? '' : '⚡ ' + adv(x.speed)}</td></tr>`).join('')}</tbody></table><p class="gm-info">À égalité de points : la meilleure réussite (🎯 % de pronos qui rapportent), puis le plus rapide (⚡ avance moyenne avant le match).</p>` : '<p class="gm-info">Le classement apparaîtra après les premiers matchs.</p>'}
      ${lastWeek ? `<details class="gm-past"><summary>Résultats de la semaine du ${esc(fmtD(lastWeek))}</summary>${c.weeks[lastWeek].filter(e => e.done).map(row).join('')}</details>` : ''}
      ${o.settings ? `<details class="gm-set"><summary>⚙️ Réglages du jeu (coachs)</summary>
        <label class="gm-chk"><input type="checkbox" id="gmOff" ${set.off ? 'checked' : ''}> Mettre le jeu en pause</label>
        <label>Liste des gages (un par ligne) <textarea id="gmGages" rows="6">${esc(((set.gages || []).length ? set.gages : GAGES).join('\n'))}</textarea></label>
        <button class="gm-btn" data-gm-set>Enregistrer les réglages</button></details>` : ''}
      <p class="gm-info gm-src">Matchs et résultats : TheSportsDB.</p></div>`;
  }
  /* mount the game into an element; o = { load, bet(ev, h, a, ko), fav(f), settings?: { save(s) }, toast } */
  function mount(el, o) {
    if (!el) return;
    const draw = () => { el.innerHTML = html(o); };
    draw();
    if (!el.dataset.gmBound) {
      el.dataset.gmBound = 1;
      let tmr = null;
      el.addEventListener('input', e => {
        const m = e.target.closest('[data-ev]'); if (!m || !e.target.matches('[data-h],[data-a]')) return;
        clearTimeout(tmr); tmr = setTimeout(async () => {
          const h = m.querySelector('[data-h]').value, a = m.querySelector('[data-a]').value; if (h === '' || a === '') return;
          try { await o.bet(m.dataset.ev, +h, +a, new Date(+m.dataset.ko).toISOString()); const v = state.view; v.bets = (v.bets || []).filter(b => !(b.e === m.dataset.ev && (v.people.find(p => p.me) || {}).id === b.p)); v.bets.push({ p: (v.people.find(p => p.me) || {}).id, e: m.dataset.ev, h: +h, a: +a }); (o.toast || (() => {}))('Prono enregistré ✓'); const sm = m.querySelector('small'); if (sm && !/enregistré/.test(sm.textContent)) sm.textContent += ' · ✓ enregistré'; }
          catch (err) { (o.toast || alert)(/TROP_TARD/.test(err.message) ? 'Trop tard : le match a commencé.' : err.message, true); }
        }, 700);
      });
      el.addEventListener('click', async e => {
        if (e.target.closest('[data-gm-fav]')) { const f = (el.querySelector('#gmFav') || {}).value || ''; try { await o.fav(f); const me = state.view.people.find(p => p.me); if (me) me.fav = f.trim(); draw(); (o.toast || (() => {}))('Club de cœur enregistré ❤️'); } catch (err) { (o.toast || alert)(err.message, true); } }
        if (e.target.closest('[data-gm-set]') && o.settings) { const s = { off: el.querySelector('#gmOff').checked, gages: el.querySelector('#gmGages').value.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 30) }; await o.settings.save(s); state.view.settings = s; draw(); (o.toast || (() => {}))('Réglages du jeu enregistrés'); }
      });
    }
    load(o).then(draw);
  }
  // the forfeits of the week for a category (the coaches' session page): [{ name, gage }]
  return { mount, fixtures, compute, GAGES };
})();
