/* Season: the review of the season of a team (results, scorers, playing time, attendance, progression, injuries),
   a word of the coach, a PDF to hand to the club or the parents, and the full backup of the season before starting the next one. */
const Season = (() => {
  const { esc, $, toast } = UI;
  const S = () => Store.state;
  const res = m => m.gf > m.ga ? 'V' : m.gf < m.ga ? 'D' : 'N';

  function data(t) {
    const from = People.seasonFrom(), now = UI.today();
    const ms = S().matches.filter(m => m.teamId === t.id && m.played && !m.exempt && m.date >= from && Store.kindOk(m)).sort((a, b) => a.date.localeCompare(b.date));
    const trs = S().trainings.filter(x => !x.model && x.teamId === t.id && x.date >= from && x.date <= now);
    const r = { V: 0, N: 0, D: 0 }; ms.forEach(m => r[res(m)]++);
    const gf = ms.reduce((a, m) => a + (+m.gf || 0), 0), ga = ms.reduce((a, m) => a + (+m.ga || 0), 0);
    const players = (Store.playersOf(t.id).length ? Store.playersOf(t.id) : Store.rosterOf(t.id)).map(p => {
      const mp = ms.filter(m => +((m.minutes || {})[p.id]) > 0 || (m.convoked || []).includes(p.id) && (m.minutes || {})[p.id] == null);
      const minutes = ms.reduce((a, m) => a + (+((m.minutes || {})[p.id]) || 0), 0);
      const g = ms.reduce((a, m) => a + (((m.stats || {})[p.id] || {}).g || 0), 0), as = ms.reduce((a, m) => a + (((m.stats || {})[p.id] || {}).a || 0), 0);
      const att = People.attendance(p, t.id), ev = Progress.evals(p).filter(e => e.date >= from), gl = ev.length ? Progress.global(ev[ev.length - 1]) : null;
      const inj = (p.unavail || []).filter(u => u.kind === 'injury' && (u.to || now) >= from).reduce((a, u) => a + Math.max(0, Math.round((new Date((u.to && u.to < now ? u.to : now) + 'T12:00') - new Date((u.from > from ? u.from : from) + 'T12:00')) / 864e5)), 0);
      return { p, mp: mp.length, minutes, g, a: as, att: att.pct, evalG: gl, evalN: ev.length, inj };
    }).sort((a, b) => b.minutes - a.minutes || Store.byName(a.p, b.p));
    return { ms, trs, r, gf, ga, players, trMin: trs.reduce((a, x) => a + (x.exercises || []).reduce((b, e) => b + (+e.duration || 0), 0), 0) };
  }

  function page(root, teamId) {
    const teams = Auth.teams(), t = Store.get('teams', teamId) || Store.get('teams', S().ui.teamId) || teams[0];
    if (!t) { root.innerHTML = '<div class="empty"><p>Crée d\'abord une équipe.</p></div>'; return; }
    const d = data(t), season = People.seasonLabel(), note = ((t.seasonNotes || {})[season]) || '';
    const top = k => d.players.filter(x => x[k] > 0).sort((a, b) => b[k] - a[k]).slice(0, 5);
    root.innerHTML = `<header class="page-head"><div><h1>🏆 Bilan de saison</h1><p class="sub">${esc(t.name)} · ${esc(season)} · ${Store.matchKind() === 'ami' ? 'matchs amicaux' : 'matchs officiels'}</p></div>
      <div class="head-actions"><a class="btn" href="#/stats">${I.back}<span>Statistiques</span></a><button class="btn" data-ss="save">${I.download}<span>Sauvegarder la saison</span></button><button class="btn primary" data-ss="pdf">${I.pdf}<span>Bilan PDF</span></button></div></header>
      <label class="fld inline"><span>Équipe</span><select id="ssTeam">${teams.map(x => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${esc(Store.teamLabel(x))}</option>`).join('')}</select></label>
      ${UI.kindSeg()}
      <div class="tiles"><div class="tile"><b>${d.ms.length}</b><span>Matchs</span></div><div class="tile v"><b>${d.r.V}</b><span>Victoires</span></div><div class="tile n"><b>${d.r.N}</b><span>Nuls</span></div><div class="tile d"><b>${d.r.D}</b><span>Défaites</span></div>
        <div class="tile"><b>${d.gf} – ${d.ga}</b><span>${Sport.W().Units} pour – contre</span></div><div class="tile"><b>${d.trs.length}</b><span>Séances (${Math.round(d.trMin / 60)} h)</span></div></div>
      <div class="cards2">
        <section class="card"><h2>${Sport.W().icon} ${Sport.W().Scorers}</h2>${top('g').map((x, i) => `<p class="ss-row"><span>${i + 1}. ${esc(Store.fullName(x.p))}</span><b>${x.g}</b></p>`).join('') || '<p class="muted">—</p>'}</section>
        <section class="card"><h2>🅿️ Passeurs</h2>${top('a').map((x, i) => `<p class="ss-row"><span>${i + 1}. ${esc(Store.fullName(x.p))}</span><b>${x.a}</b></p>`).join('') || '<p class="muted">—</p>'}</section>
      </div>
      <section class="card"><h2>👥 Les joueurs</h2><div class="ss-table"><table><thead><tr><th>Joueur</th><th>Matchs</th><th>Minutes</th><th>${Sport.W().Units}</th><th>Passes</th><th>Présence</th><th>Éval.</th><th>Blessé</th></tr></thead>
        <tbody>${d.players.map(x => `<tr><td><a href="#/joueur/${x.p.id}">${esc(Store.fullName(x.p))}</a></td><td>${x.mp}</td><td>${x.minutes}'</td><td>${x.g || ''}</td><td>${x.a || ''}</td><td>${x.att == null ? '–' : x.att + ' %'}</td><td>${x.evalG == null ? '–' : x.evalG.toFixed(1).replace('.', ',')}</td><td>${x.inj ? x.inj + ' j' : ''}</td></tr>`).join('')}</tbody></table></div></section>
      <section class="card"><h2>📋 Les résultats</h2><div class="ss-results">${d.ms.map(m => `<a href="#/match/${m.id}" class="res-${res(m)}"><span>${esc(UI.fmtDate(m.date, { day: 'numeric', month: 'short' }))}</span><span>${m.home ? 'contre' : 'chez'} ${esc(m.opponent || '?')}</span><b>${m.gf} – ${m.ga}</b></a>`).join('') || '<p class="muted">Pas encore de match joué.</p>'}</div></section>
      <section class="card"><h2>🗣️ Le mot du coach</h2><textarea id="ssNote" rows="4" placeholder="Ce qu'on retient de la saison, les progrès, les objectifs pour la suivante (apparaît dans le PDF)">${esc(note)}</textarea></section>`;
    $('#ssTeam', root).onchange = e => { location.hash = '#/bilan/' + e.target.value; };
    $('#ssNote', root).oninput = e => { t.seasonNotes = Object.assign({}, t.seasonNotes || {}, { [season]: e.target.value }); clearTimeout(page.t); page.t = setTimeout(() => Store.upsert('teams', t), 600); };
    root.onclick = async e => { const b = e.target.closest('[data-ss]'); if (!b) return;
      if (b.dataset.ss === 'pdf') return pdf(t);
      if (b.dataset.ss === 'save') { try { const r = await Exporter.json(Store.exportAll(), `saison-${season}`); if (r === 'downloaded') toast('Sauvegarde enregistrée dans Téléchargements'); } catch (err) { toast('Sauvegarde impossible', 'err'); } } };
  }

  async function pdf(t) {
    const b = UI.busy('Création du bilan…');
    try {
      const d = data(t), season = People.seasonLabel(), P = Exporter.pdfDoc(S().club), note = ((t.seasonNotes || {})[season]) || '';
      P.header('Bilan de saison', `${t.name} · ${season}`); P.h2(`${t.name} · saison ${season}`);
      P.facts([['Matchs', String(d.ms.length)], ['V / N / D', `${d.r.V} / ${d.r.N} / ${d.r.D}`], [Sport.W().Units, `${d.gf} pour · ${d.ga} contre`], ['Séances', `${d.trs.length} (${Math.round(d.trMin / 60)} h)`]]);
      if (note) { P.label('Le mot du coach'); P.para(note, 11.5); }
      const top = k => d.players.filter(x => x[k] > 0).sort((a, c) => c[k] - a[k]).slice(0, 5);
      if (top('g').length) { P.label('Meilleurs ' + Sport.W().scorers); P.table(['Joueur', Sport.W().Units], top('g').map(x => [Store.fullName(x.p), String(x.g)]), [.8, .2]); }
      if (top('a').length) { P.label('Meilleurs passeurs'); P.table(['Joueur', 'Passes'], top('a').map(x => [Store.fullName(x.p), String(x.a)]), [.8, .2]); }
      P.label('Les joueurs'); P.table(['Joueur', 'Matchs', 'Min.', Sport.W().Units, 'Passes', 'Présence', 'Éval.'], d.players.map(x => [Store.fullName(x.p), String(x.mp), String(x.minutes), String(x.g || ''), String(x.a || ''), x.att == null ? '-' : x.att + ' %', x.evalG == null ? '-' : x.evalG.toFixed(1)]), [.34, .1, .1, .1, .1, .13, .13]);
      if (d.ms.length) { P.label('Les résultats'); P.table(['Date', 'Adversaire', 'Score', ''], d.ms.map(m => [UI.fmtDate(m.date), `${m.home ? 'contre' : 'chez'} ${m.opponent || '?'}`, `${m.gf} - ${m.ga}`, { V: 'Victoire', N: 'Nul', D: 'Défaite' }[res(m)]]), [.25, .45, .15, .15]); }
      const r = await Exporter.deliver(P.blob(), `bilan-${String(t.name).replace(/[^\wÀ-ÿ-]+/g, '-')}-${season}.pdf`);
      if (r === 'downloaded') toast('Bilan enregistré dans Téléchargements');
    } catch (e) { console.error(e); toast('Bilan impossible : ' + (e.message || e), 'err'); } finally { b.done(); }
  }
  /* ---------- detailed statistics (Stats page): form, points, home / away, clean sheets, goals by period (live match) ---------- */
  function advanced(t) {
    const from = People.seasonFrom(), ms = S().matches.filter(m => m.teamId === t.id && m.played && !m.exempt && m.date >= from && Store.kindOk(m)).sort((a, b) => a.date.localeCompare(b.date));
    if (!ms.length) return '';
    const pts = m => ({ V: 3, N: 1, D: 0 })[res(m)], rec = l => { const r = { V: 0, N: 0, D: 0, gf: 0, ga: 0 }; l.forEach(m => { r[res(m)]++; r.gf += +m.gf || 0; r.ga += +m.ga || 0; }); return r; };
    const home = rec(ms.filter(m => m.home)), away = rec(ms.filter(m => !m.home)), total = ms.reduce((a, m) => a + pts(m), 0);
    const cs = ms.filter(m => !+m.ga).length, scored = ms.filter(m => +m.gf > 0).length, form = ms.slice(-5);
    const big = ms.slice().sort((a, b) => (b.gf - b.ga) - (a.gf - a.ga))[0], bad = ms.slice().sort((a, b) => (a.gf - a.ga) - (b.gf - b.ga))[0];
    // goals by period of 15 min, from the matches followed live
    const lives = ms.filter(m => m.live && (m.live.events || []).length), bands = {}, bandOf = min => { const n = parseInt(min, 10) || 0; const half = (m => m.live.halfLen)(lives[0] || { live: { halfLen: 45 } }); return Math.min(Math.floor((n - 1) / 15), Math.ceil(half * 2 / 15) - 1); };
    lives.forEach(m => m.live.events.forEach(e => { if (e.type !== 'goal' && e.type !== 'against') return; const b = bandOf(e.min); bands[b] = bands[b] || { f: 0, a: 0 }; bands[b][e.type === 'goal' ? 'f' : 'a']++; }));
    const firsts = lives.map(m => { const g = m.live.events.filter(e => e.type === 'goal' || e.type === 'against').sort((a, b) => a.wall - b.wall)[0]; return g ? { us: g.type === 'goal', r: res(m) } : null; }).filter(Boolean);
    const whenFirst = r => { const l = firsts.filter(x => x.us === r); return l.length ? `${l.filter(x => x.r === 'V').length} V · ${l.filter(x => x.r === 'N').length} N · ${l.filter(x => x.r === 'D').length} D` : '–'; };
    const maxB = Math.max(1, ...Object.values(bands).map(b => Math.max(b.f, b.a)));
    return `<section class="card adv"><h2>📊 Statistiques avancées</h2>
      <div class="adv-form">Forme : ${form.map(m => `<a href="#/match/${m.id}" class="f-${res(m)}" title="${esc(m.opponent || '')} ${m.gf}-${m.ga}">${res(m)}</a>`).join('')}<span class="muted small">${total} pts en ${ms.length} matchs · ${(total / ms.length).toFixed(2).replace('.', ',')} par match</span></div>
      <div class="adv-grid"><div><h3>🏠 À domicile</h3><p>${home.V} V · ${home.N} N · ${home.D} D</p><p class="muted small">${home.gf} – ${home.ga}</p></div>
        <div><h3>🚌 À l'extérieur</h3><p>${away.V} V · ${away.N} N · ${away.D} D</p><p class="muted small">${away.gf} – ${away.ga}</p></div>
        <div><h3>🧤 Sans encaisser</h3><p>${cs} match${cs > 1 ? 's' : ''}</p><p class="muted small">${Math.round(cs / ms.length * 100)} % des matchs</p></div>
        <div><h3>${Sport.W().icon} A marqué</h3><p>${scored} match${scored > 1 ? 's' : ''} sur ${ms.length}</p><p class="muted small">${(ms.reduce((a, m) => a + (+m.gf || 0), 0) / ms.length).toFixed(1).replace('.', ',')} but${ms.length ? 's' : ''} par match</p></div>
        ${big ? `<div><h3>🏆 Plus large victoire</h3><p>${big.gf} – ${big.ga}</p><p class="muted small">${big.home ? 'contre' : 'chez'} ${esc(big.opponent || '?')}</p></div>` : ''}
        ${bad && bad.gf < bad.ga ? `<div><h3>📉 Plus lourde défaite</h3><p>${bad.gf} – ${bad.ga}</p><p class="muted small">${bad.home ? 'contre' : 'chez'} ${esc(bad.opponent || '?')}</p></div>` : ''}</div>
      ${lives.length ? `<h3>⏱️ Buts par période de 15 min (${lives.length} match${lives.length > 1 ? 's' : ''} suivi${lives.length > 1 ? 's' : ''} en direct)</h3>
        <div class="adv-bands">${Object.keys(bands).map(Number).sort((a, b) => a - b).map(b => `<div><span>${b * 15 + 1}-${(b + 1) * 15}'</span><i class="f" style="width:${bands[b].f / maxB * 100}%">${bands[b].f || ''}</i><i class="a" style="width:${bands[b].a / maxB * 100}%">${bands[b].a || ''}</i></div>`).join('')}</div>
        <p class="muted small">En vert nos buts, en rouge les buts encaissés. Quand on marque le premier : ${whenFirst(true)} · quand on encaisse le premier : ${whenFirst(false)}.</p>`
        : '<p class="muted small">Suis tes matchs en direct (📱 sur la page du match) pour voir les buts par période et les résultats selon qui marque le premier.</p>'}</section>`;
  }
  /* ---------- the detailed stats of a match (shots, key passes, interceptions, crosses, corners, cards, saves) ---------- */
  const DET = [['g', '⚽', 'Buts / points'], ['a', '🅿️', 'Passes déc.'], ['sc', '🎯', 'Tirs cadrés'], ['snc', '↗️', 'Non cadrés'], ['d', '🔑', 'Passes clés'], ['iv', '✋', 'Interceptions'],
    ['cr', '📐', 'Centres'], ['co', '🚩', 'Corners'], ['yc', '🟨', 'Jaunes'], ['rc', '🟥', 'Rouges'], ['sv', '🧤', 'Arrêts']];
  function detailCard(m) {
    const det = m.detail || {}, st = m.stats || {}, ids = [...new Set([...Object.keys(det), ...Object.keys(st)])].filter(id => Store.get('players', id));
    if (!ids.length || !Object.keys(det).length) return '';
    const v = (id, k) => k === 'g' || k === 'a' ? ((st[id] || {})[k] || 0) : ((det[id] || {})[k] || 0);
    const cols = DET.filter(([k]) => ids.some(id => v(id, k)));
    const rows = ids.map(id => ({ p: Store.get('players', id), id })).sort((a, b) => cols.reduce((s, [k]) => s + v(b.id, k), 0) - cols.reduce((s, [k]) => s + v(a.id, k), 0));
    return `<section class="card"><h2>📊 Stats détaillées</h2><div class="ss-table"><table><thead><tr><th>Joueur</th>${cols.map(([, ic, l]) => `<th title="${esc(l)}">${ic}<br><small>${esc(l)}</small></th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr><td><a href="#/joueur/${r.id}">${esc(Store.shortName(r.p))}</a></td>${cols.map(([k]) => `<td>${v(r.id, k) || ''}</td>`).join('')}</tr>`).join('')}</tbody>
      <tfoot><tr><td><b>Équipe</b></td>${cols.map(([k]) => `<td><b>${ids.reduce((s, id) => s + v(id, k), 0)}</b></td>`).join('')}</tr></tfoot></table></div></section>`;
  }
  // a player's detailed stats over the season (player page)
  function playerDetail(p) {
    const from = People.seasonFrom(), ms = S().matches.filter(m => m.played && m.date >= from && Store.kindOk(m) && ((m.detail || {})[p.id] || ((m.stats || {})[p.id])));
    if (!ms.some(m => (m.detail || {})[p.id])) return '';
    const sum = k => ms.reduce((s, m) => s + (k === 'g' || k === 'a' ? (((m.stats || {})[p.id] || {})[k] || 0) : (((m.detail || {})[p.id] || {})[k] || 0)), 0);
    return `<section class="card"><h2>📊 Ses stats détaillées</h2><div class="tt-cards">${DET.filter(([k]) => sum(k)).map(([k, ic, l]) => `<div><span>${ic} ${esc(l)}</span><b>${sum(k)}</b></div>`).join('')}</div></section>`;
  }

  /* ---------- the league table (championships imported from AssistCoachAI, completed by our results) ---------- */
  function table(t) {
    const L = t.league; if (!L) return null;
    const pts = Object.assign({ win: 3, draw: 1, loss: 0 }, (L.config || {}).points || {}), T = {};
    L.teams.filter(x => !/^exempt$/i.test(String(x.name || '').trim())).forEach(x => { T[x.id] = { id: x.id, name: x.own ? `${S().club.name} · ${t.name}` : x.name, own: x.own, j: 0, v: 0, n: 0, d: 0, bp: 0, bc: 0, pts: -(x.pen || 0) }; });
    const own = L.teams.find(x => x.own), ours = S().matches.filter(m => m.teamId === t.id && m.played);
    L.fixtures.forEach(f => {
      let hs = f.hs, as = f.as;
      // our own matches: the score typed in the app wins (the league file may be older)
      if (own && (f.h === own.id || f.a === own.id)) { const opp = L.teams.find(x => x.id === (f.h === own.id ? f.a : f.h)); const m = opp && ours.find(x => x.date === f.d && ACImport.sameOpp(x.opponent, opp.name)); if (m) { hs = f.h === own.id ? m.gf : m.ga; as = f.h === own.id ? m.ga : m.gf; } }
      if (hs == null || as == null || !T[f.h] || !T[f.a]) return;
      const H = T[f.h], A = T[f.a]; H.j++; A.j++; H.bp += +hs; H.bc += +as; A.bp += +as; A.bc += +hs;
      if (+hs > +as) { H.v++; A.d++; H.pts += pts.win; A.pts += pts.loss; } else if (+hs < +as) { A.v++; H.d++; A.pts += pts.win; H.pts += pts.loss; } else { H.n++; A.n++; H.pts += pts.draw; A.pts += pts.draw; }
    });
    return Object.values(T).sort((a, b) => b.pts - a.pts || (b.bp - b.bc) - (a.bp - a.bc) || b.bp - a.bp || b.v - a.v || a.name.localeCompare(b.name));
  }
  // (1.40) the official table of the FFF / District (Résultats FFF bookmark)
  function officialCard(t, F = t.fffTable) {
    const ours = r => !!F.our && r.name.toUpperCase() === F.our.toUpperCase();
    const when = new Date(F.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    return `<section class="card"><h2>🏆 ${esc(F.name)} <span class="muted small">· classement officiel</span></h2><div class="ss-table"><table class="lg-table"><thead><tr><th>#</th><th>Équipe</th><th>Pts</th><th>J</th><th>V</th><th>N</th><th>D</th><th>Bp</th><th>Bc</th><th>Diff</th></tr></thead>
      <tbody>${F.rows.map(r => `<tr class="${ours(r) ? 'own' : ''}"><td>${r.rank}</td><td>${Clubs.oppLogo(r.name)}${esc(r.name)}</td><td><b>${r.pts}</b></td><td>${r.j}</td><td>${r.v}</td><td>${r.n}</td><td>${r.d}</td><td>${r.bp}</td><td>${r.bc}</td><td>${r.diff > 0 ? '+' : ''}${r.diff}</td></tr>`).join('')}</tbody></table></div>
      <p class="muted small">Site de la FFF, mis à jour le ${esc(when)} · sous réserve d'éventuelles procédures. <a href="${esc(F.url)}" target="_blank" rel="noopener">Voir sur le site</a></p></section>`;
  }
  // (1.48) the results of the whole poule (every opponent), the last weekend first; the older ones folded
  const okey = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  function pouleCard(R) {
    const played = R.list.filter(x => x.hs != null); if (!played.length) return '';
    const days = [...new Set(played.map(x => x.date))].sort().reverse(), our = okey(R.our);
    const fd = d => new Date(d + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
    const row = x => { const us = our && (okey(x.home) === our || okey(x.away) === our), w = x.hs > x.as ? 'h' : x.hs < x.as ? 'a' : '';
      return `<tr class="${us ? 'own' : ''}"><td class="pr-h ${w === 'h' ? 'win' : ''}">${esc(x.home)}${Clubs.oppLogo(x.home)}</td><td class="pr-s">${x.hs} - ${x.as}</td><td class="pr-a ${w === 'a' ? 'win' : ''}">${Clubs.oppLogo(x.away)}${esc(x.away)}</td></tr>`; };
    const day = d => `<div class="lbl">${esc(fd(d))}</div><table class="pr-table"><tbody>${played.filter(x => x.date === d).map(row).join('')}</tbody></table>`;
    return `<section class="card"><h2>📅 ${esc(R.name)} <span class="muted small">· tous les résultats de la poule</span></h2>${days.slice(0, 1).map(day).join('')}
      ${days.length > 1 ? `<details class="pr-more"><summary>${days.length > 2 ? `Les ${days.length - 1} journées d'avant` : 'La journée d\'avant'}</summary>${days.slice(1).map(day).join('')}</details>` : ''}
      <p class="muted small">${R.src ? `Championnat repris d'${esc(R.src)} (mis à jour à chaque import). Le favori « Résultats FFF » y ajoutera les résultats officiels.` : `${R.both ? 'Site de la FFF et AssistCoachAI réunis (le score officiel de la FFF passe en premier)' : 'Site de la FFF'}, gardés à chaque import. <a href="${esc(R.url)}" target="_blank" rel="noopener">Voir sur le site</a>`}</p></section>`;
  }
  // (1.50) the poule from AssistCoachAI (its championship has every match of the poule), until the FFF bookmark brings its own
  function leaguePoule(t) {
    const L = t.league; if (!L || !(L.fixtures || []).length) return null;
    const nm = id => { const x = L.teams.find(y => y.id === id); return x ? (x.own ? `${S().club.name} · ${t.name}` : x.name) : ''; };
    const list = L.fixtures.map(f => ({ date: f.d, time: '', home: nm(f.h), away: nm(f.a), hs: f.hs == null ? null : +f.hs, as: f.as == null ? null : +f.as }))
      .filter(x => x.date && x.home && x.away && !/^exempt$/i.test(x.home) && !/^exempt$/i.test(x.away));
    return { name: L.name, url: '', our: `${S().club.name} · ${t.name}`, list, src: 'AssistCoachAI' };
  }
  // (1.50) AssistCoachAI and the FFF together: the poule of the same level (« D4 ») gets the matches of both, each match once
  // (same day ±1, same two teams), the FFF score first (official), else AssistCoachAI's; a match only one of them knows is kept
  const lvl = s => ((okey(s).match(/\b[RD] ?\d\b/) || [''])[0]).replace(' ', '');
  function poules(t) {
    const F = Object.values(t.fffPoules || {}), L = leaguePoule(t);
    if (!L) return F; if (!F.length) return [L];
    const target = F.find(R => lvl(R.name) && lvl(R.name) === lvl(L.name)) || (F.length === 1 ? F[0] : null);
    if (!target) return [...F, L];
    const ourF = okey(target.our), ourL = okey(L.our), isOurs = n => okey(n) === ourF || okey(n) === ourL;
    const same = (a, b) => isOurs(a) || isOurs(b) ? isOurs(a) && isOurs(b) : okey(a) === okey(b) || ACImport.sameOpp(a, b) > 0;
    const near = (a, b) => Math.abs(new Date(a) - new Date(b)) <= 864e5;
    const list = target.list.map(x => Object.assign({}, x));
    L.list.forEach(a => {
      const x = list.find(y => near(y.date, a.date) && same(y.home, a.home) && same(y.away, a.away));
      if (x) { if (x.hs == null && a.hs != null) { x.hs = a.hs; x.as = a.as; } return; }
      list.push(Object.assign({}, a, { home: isOurs(a.home) && target.our ? target.our : a.home, away: isOurs(a.away) && target.our ? target.our : a.away }));
    });
    list.sort((a, b) => a.date.localeCompare(b.date) || String(a.time).localeCompare(String(b.time)));
    return F.map(R => R === target ? Object.assign({}, R, { list, both: true }) : R);
  }
  // the last results of a team of the poule (« forme du moment »): V / N / D, the most recent last
  function formOf(t, name) {
    const k = okey(name); if (!t || !k) return [];
    // « PLAINE 2 » (FFF) = « La Plaine 2 » (AssistCoachAI), never « La Plaine » (team 1)
    const is = n => okey(n) === k || ACImport.sameOpp(n, name) > 0, all = poules(t).flatMap(R => R.list).filter(x => x.hs != null && (is(x.home) || is(x.away)));
    return all.sort((a, b) => a.date.localeCompare(b.date)).slice(-5).map(x => { const home = is(x.home), f = home ? x.hs : x.as, a = home ? x.as : x.hs;
      return { r: f > a ? 'V' : f < a ? 'D' : 'N', x }; });
  }
  function leagueCard(t) {
    const tabs = Object.values(t.fffTables || {}).filter(F => (F.rows || []).length);
    const pr = poules(t).map(pouleCard).join('');
    if (tabs.length) return tabs.map(F => officialCard(t, F)).join('') + pr;
    if (t.fffTable && (t.fffTable.rows || []).length) return officialCard(t) + pr;
    const rows = table(t); if (!rows) return pr;
    const up = +((t.league.config || {}).promotion_slots || 0), down = +((t.league.config || {}).relegation_slots || 0);
    return `<section class="card"><h2>🏆 ${esc(t.league.name)}</h2><div class="ss-table"><table class="lg-table"><thead><tr><th>#</th><th>Équipe</th><th>Pts</th><th>J</th><th>V</th><th>N</th><th>D</th><th>Diff</th></tr></thead>
      <tbody>${rows.map((r, i) => `<tr class="${r.own ? 'own' : ''} ${i < up ? 'up' : ''} ${down && i >= rows.length - down ? 'down' : ''}"><td>${i + 1}</td><td>${esc(r.name)}</td><td><b>${r.pts}</b></td><td>${r.j}</td><td>${r.v}</td><td>${r.n}</td><td>${r.d}</td><td>${r.bp - r.bc > 0 ? '+' : ''}${r.bp - r.bc}</td></tr>`).join('')}</tbody></table></div>
      <p class="muted small">${up ? `En vert : ${up} place${up > 1 ? 's' : ''} de montée. ` : ''}Nos scores saisis dans l'appli sont pris en compte.</p></section>` + pr;
  }
  return { page, pdf, data, advanced, detailCard, playerDetail, table, leagueCard, formOf };
})();
