/* Page for a player (joueurs.html): opened with his personal code (see member.js), no account.
   His next match with the coach's team talk (objective, 3 keys, last word, video), his convocation (présent / absent),
   his well-being questionnaire, his season (playing time, goals, assists), the sessions and results of his category.
   Nothing about the other players: the club server (member_view) only sends his own information. */
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hh = x => String(x || '').replace(':', 'h');
  const fmt = (d, o = { weekday: 'long', day: 'numeric', month: 'long' }) => d ? new Date(d + 'T12:00').toLocaleDateString('fr-FR', o) : '';
  let code = Member.current(), data = null, extra = null; // extra (1.60): tables of the category + his whole season (member_standings)
  if (!code) { location.replace('moi.html' + location.hash); return; }

  let tt;
  function toast(msg, err) { const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (err ? ' err' : ''); clearTimeout(tt); tt = setTimeout(() => { t.className = 'toast'; }, 2600); }
  const rpc = Member.rpc;

  const result = m => !m.played ? '' : +m.gf > +m.ga ? 'V' : +m.gf < +m.ga ? 'D' : 'N';
  const RES = { V: 'Gagné', D: 'Perdu', N: 'Nul' };
  const mapLink = place => `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}" target="_blank" rel="noopener noreferrer">${esc(place)}</a>`;
  const club = () => (data.club && data.club.name) || 'Le club';
  const score = m => m.home ? `${esc(m.gf)} – ${esc(m.ga)}` : `${esc(m.ga)} – ${esc(m.gf)}`;
  const title = m => m.home ? `<b>${esc(club())}</b> <i>contre</i> ${esc(m.opponent || '?')}` : `${esc(m.opponent || '?')} <i>contre</i> <b>${esc(club())}</b>`;

  // his season, from the played matches where he was convoked: the official ones, the friendlies apart
  // (1.60) with the club server's member_standings: every team of the club (picked in A or B), cards and sessions too
  function season() {
    const r = { mp: 0, min: 0, g: 0, a: 0, conv: 0, yc: 0, rc: 0 };
    const ami = m => /amical|tournoi|pr[ée]pa|friendly/i.test(m.competition || '');
    r.f = { mp: 0, min: 0, g: 0, a: 0 };
    if (extra && Array.isArray(extra.played)) {
      const teams = {};
      extra.played.forEach(m => {
        const st = m.st || {}, det = m.det || {}, mn = +m.min || 0, g = +st.g || 0, a = +st.a || 0, o = ami(m) ? r.f : r;
        if (!ami(m)) { r.conv++; r.yc += Math.max(+st.yc || 0, +det.yc || 0); r.rc += Math.max(+st.rc || 0, +det.rc || 0); if (m.team && mn > 0) teams[m.team] = (teams[m.team] || 0) + 1; }
        if (mn > 0) { o.mp++; o.min += mn; } o.g += g; o.a += a;
      });
      r.teams = teams; r.sessions = extra.sessions || null;
      return r;
    }
    (data.matches || []).filter(m => m.played && m.my && ami(m)).forEach(m => { const mn = +m.my.min || 0; if (mn > 0) { r.f.mp++; r.f.min += mn; } r.f.g += +m.my.g || 0; r.f.a += +m.my.a || 0; });
    (data.matches || []).filter(m => m.played && m.my && !ami(m)).forEach(m => { r.conv++; const mn = +m.my.min || 0; if (mn > 0) { r.mp++; r.min += mn; } r.g += +m.my.g || 0; r.a += +m.my.a || 0; });
    return r;
  }

  function nextCard(m) {
    const t = m.talk || {}, keys = (t.keys || []).filter(Boolean), place = m.place || (m.home ? (data.club && data.club.fieldName) || '' : '');
    return `<article class="card next ${m.home ? 'home' : 'away'}" data-m="${esc(m.id)}">
      <div class="m-date">${esc(fmt(m.date))}${m.team && m.team !== data.team ? ` · ${esc(m.team)}` : ''}</div>
      <div class="m-title">${title(m)}</div>
      <span class="tag">${m.home ? '🏠 À domicile' : '🚌 À l\'extérieur'}</span>${m.competition ? `<span class="tag">${esc(m.competition)}</span>` : ''}
      <p class="info">${m.rdv ? `🕘 Rendez-vous <b>${esc(hh(m.rdv))}</b>` : ''}${m.rdv && m.time ? ' · ' : ''}${m.time ? `coup d'envoi <b>${esc(hh(m.time))}</b>` : ''}${!m.rdv && !m.time ? '🕘 Horaire à confirmer' : ''}</p>
      ${place ? `<p class="info">📍 ${mapLink(place)}</p>` : ''}
      ${m.convoked ? `<div class="mine-box"><b>Tu es convoqué 💪</b><div class="btns"><button class="b yes ${m.answer === 'oui' ? 'on' : ''}" data-ans="oui">Je suis présent</button><button class="b no ${m.answer === 'non' ? 'on' : ''}" data-ans="non">Absent</button></div>${m.answer === 'non' && m.reason ? `<span class="why">Raison : ${esc(m.reason)}</span>` : ''}</div>`
        : m.published ? '<div class="mine-box off">Tu n\'es pas convoqué pour ce match.</div>' : '<p class="info">La convocation n\'est pas encore publiée.</p>'}
      ${t.objective || keys.length || t.final || t.video ? `<div class="talk"><h3>🗣️ Le mot du coach</h3>
        ${t.objective ? `<p class="obj">🎯 ${esc(t.objective)}</p>` : ''}${t.system ? `<p class="info">Système : <b>${esc(t.system)}</b></p>` : ''}
        ${keys.length ? `<ol class="keys">${keys.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
        ${t.final ? `<p class="final">${esc(t.final)}</p>` : ''}
        ${t.video ? `<p><a class="b vid" href="${esc(t.video)}" target="_blank" rel="noopener noreferrer">▶ Voir la vidéo du coach</a></p>` : ''}</div>` : ''}
      <p><button class="b cal" data-cal="${esc(m.id)}">📅 Ajouter à mon agenda</button></p></article>`;
  }
  function pastCard(m) {
    const r = result(m), st = m.my;
    return `<article class="card past"><div class="m-date">${esc(fmt(m.date, { weekday: 'short', day: 'numeric', month: 'short' }))}${m.competition ? ' · ' + esc(m.competition) : ''}</div>
      <div class="m-title">${title(m)}</div><p><span class="score">${score(m)}</span>${r ? `<span class="res ${r}">${RES[r]}</span>` : ''}</p>
      ${st ? `<p class="me-line">Toi : <b>${+st.min ? esc(st.min) + "'" : 'pas joué'}</b>${+st.g ? ` · ${Sport.W().icon} ${esc(st.g)}` : ''}${+st.a ? ` · 🅿️ ${esc(st.a)}` : ''}</p>` : ''}</article>`;
  }

  // the well-being questionnaire of the day (1 to 10), sent to the coaches
  const WB = [['mood', '🙂', 'Ressenti général'], ['mental', '🧠', 'Mental'], ['sleep', '😴', 'Sommeil'], ['legs', '🦵', 'Jambes'], ['sore', '💪', 'Courbatures (10 = aucune)']];
  const wbVals = {};
  function wbCard(now) {
    if ((data.me || {}).wb === now) return '<div class="card wb-done">💚 Merci, ton questionnaire du jour est envoyé.</div>';
    return `<div class="card wb"><h3>💚 Comment tu te sens aujourd'hui ?</h3><p class="info">De 1 (très mal) à 10 (au top). Ton coach voit tes réponses.</p>
      ${WB.map(([k, ic, lab]) => `<div class="wb-row"><span>${ic} ${lab}</span><span class="wb-scale">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<button class="${wbVals[k] === n ? 'on' : ''} v${n}" data-wb="${k}" data-v="${n}">${n}</button>`).join('')}</span></div>`).join('')}
      <input id="wbNote" maxlength="200" placeholder="Un mot pour le coach (douleur, fatigue…)" class="wb-note">
      <button class="b yes on" data-wbsend>Envoyer</button></div>`;
  }
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  async function wbSend() {
    if (WB.some(([k]) => !wbVals[k])) return toast('Réponds aux 5 questions', true);
    try { await rpc('member_wellness', { p_code: code, p_mood: wbVals.mood, p_mental: wbVals.mental, p_sleep: wbVals.sleep, p_legs: wbVals.legs, p_sore: wbVals.sore, p_note: ($('#wbNote') || {}).value || '' });
      data.me.wb = today(); toast('Merci ! 💚'); render(); }
    catch (e) { toast(e.message, true); }
  }
  // a session: the answer (when the club's server gives the sessions with their id)
  /* (1.63) the session, shown once he answered « présent » (goal and exercises, from the club server) */
  const sess = {};
  async function loadSession(id, open) {
    try { sess[id] = { data: await rpc('member_session', { p_code: code, p_id: id }), open: open !== false }; }
    catch (e) { sess[id] = { err: /PRESENT_D_ABORD/.test(e.message) ? 'Réponds « Présent » pour voir la séance.' : e.message, open: true }; }
    render();
  }
  function sessBox(t) {
    const x = sess[t.id]; if (!x || !x.open) return '';
    if (x.err) return `<div class="sess"><p class="info">${esc(x.err)}</p></div>`;
    const d = x.data || {}, ex = d.exercises || [], total = ex.reduce((a, e) => a + (+e.duration || 0), 0);
    return `<div class="sess"><h4>📋 ${esc(d.title || 'Séance')}${total ? ` · ${total} min` : ''}</h4>${d.goal ? `<p class="obj">🎯 ${esc(d.goal)}</p>` : ''}
      ${ex.length ? `<ol class="sess-ex">${ex.map(e => `<li><b>${esc(e.title || 'Exercice')}</b>${+e.duration ? ` <span class="info">· ${esc(e.duration)} min</span>` : ''}${e.consignes ? `<div class="info">${esc(e.consignes).split('\n').join('<br>')}</div>` : ''}</li>`).join('')}</ol>` : `<p class="info">Le coach n'a pas encore détaillé la séance.</p>`}
      <p class="info">Prépare ta tenue et tes crampons, et sois à l'heure 💪</p></div>`;
  }
  function trRow(t) {
    return `<div class="tr tr-ans" ${t.id ? `data-t="${esc(t.id)}"` : ''}><span class="d">${esc(fmt(t.date, { weekday: 'short', day: 'numeric', month: 'short' }))}</span><span>${t.time ? esc(hh(t.time)) + ' · ' : ''}${esc(t.title || 'Entraînement')}
      ${t.answer === 'non' && t.reason ? `<span class="why">Absent · ${esc(t.reason)}</span>` : ''}</span>
      ${t.id ? `<span class="btns"><button class="b small yes ${t.answer === 'oui' ? 'on' : ''}" data-tans="oui">Présent</button><button class="b small no ${t.answer === 'non' ? 'on' : ''}" data-tans="non">Absent</button>${t.answer === 'oui' ? `<button class="b small" data-sess="${esc(t.id)}">${(sess[t.id] || {}).open ? 'Masquer' : '📋 Voir la séance'}</button>` : ''}</span>` : ''}</div>${t.answer === 'oui' ? sessBox(t) : ''}`;
  }
  /* (1.60) the tables of his category: every team (A, B…), because he can be picked in any of them */
  let stTeam = null;
  const okey = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  const cupR = R => !!R.cup || /coupe|cup/i.test(R.name || '');
  function standings() {
    const teams = ((extra || {}).teams || []).filter(t => Object.keys(t.tables || {}).length || Object.keys(t.poules || {}).length); if (!teams.length) return '';
    const cur = teams.find(t => t.id === stTeam) || teams.find(t => t.mine) || teams[0];
    const fd = d => fmt(d, { weekday: 'short', day: 'numeric', month: 'short' });
    const tabs = teams.length > 1 ? `<div class="st-tabs">${teams.map(t => `<button class="b small ${t.id === cur.id ? 'on' : ''}" data-st="${esc(t.id)}">${esc(t.name)}${t.mine ? ' ★' : ''}</button>`).join('')}</div>` : '';
    const tables = Object.values(cur.tables || {}).filter(F => (F.rows || []).length && !cupR(F)).map(F => { const our = okey(F.our);
      return `<h3>🏆 ${esc(F.name)}${F.computed ? ' <span class="info">(calculé)</span>' : ''}</h3><table class="st-table"><thead><tr><th>#</th><th>Équipe</th><th>Pts</th><th>J</th><th>Diff</th></tr></thead><tbody>${F.rows.map(r => `<tr class="${our && okey(r.name) === our ? 'own' : ''}"><td>${esc(r.rank)}</td><td>${esc(r.name)}</td><td><b>${esc(r.pts)}</b></td><td>${esc(r.j)}</td><td>${+r.diff > 0 ? '+' : ''}${esc(r.diff)}</td></tr>`).join('')}</tbody></table>`; }).join('');
    const pou = Object.values(cur.poules || {}).filter(R => !cupR(R)).map(R => { const our = okey(R.our), list = R.list || [], now = today();
      const played = list.filter(x => x.hs != null), lastD = played.length ? played[played.length - 1].date : null, next = list.filter(x => x.hs == null && x.date >= now), nextD = next.length ? next[0].date : null;
      const row = (x, sc) => `<tr class="${our && (okey(x.home) === our || okey(x.away) === our) ? 'own' : ''}"><td class="h">${esc(x.home)}</td><td class="s">${sc}</td><td>${esc(x.away)}</td></tr>`;
      return (lastD ? `<h3>📅 Derniers résultats · ${esc(fd(lastD))}</h3><table class="st-res">${played.filter(x => x.date === lastD).map(x => row(x, `${x.hs} - ${x.as}`)).join('')}</table>` : '')
        + (nextD ? `<h3>🗓️ Prochaine journée · ${esc(fd(nextD))}</h3><table class="st-res">${next.filter(x => x.date === nextD).map(x => row(x, esc(x.time || '-'))).join('')}</table>` : ''); }).join('');
    return `<h2>Classements de ma catégorie</h2><div class="card st-card">${tabs}${tables}${pou}<p class="info">Résultats officiels de la FFF${teams.length > 1 ? '. Tu peux être appelé dans chacune de ces équipes.' : '.'}</p></div>`;
  }
  function render() {
    const now = today();
    document.title = `${(data.me || {}).name || 'Joueur'} · ${club()}`;
    $('#club').textContent = `${club()} · Espace joueur`; $('#team').textContent = data.team || 'Équipe';
    const ms = data.matches || [], up = ms.filter(m => !m.played && m.date >= now && !m.exempt), past = ms.filter(m => m.played).reverse();
    const my = season();
    $('#page').innerHTML = `${Member.bar(data, 'joueurs')}
      ${Member.notifyCard('joueurs')}
      ${wbCard(now)}
      <div class="card perso-card"><h3>🏃 Mon entraînement perso</h3><p class="info">Physique, technique ou tactique, seul ou à plusieurs, en plus des entraînements du club. Note tes footings (temps, distance) et envoie-les à ton coach si tu veux.</p><button class="b yes on" data-perso>Créer ma séance · noter mes footings</button></div>
      ${my.conv || my.f.mp ? `<h2>Ma saison</h2><div class="tiles"><div><b>${my.mp}</b><span>matchs joués</span></div><div><b>${my.min}'</b><span>temps de jeu</span></div><div><b>${my.mp ? Math.round(my.min / my.mp) : 0}'</b><span>par match</span></div><div><b>${my.g}</b><span>buts</span></div><div><b>${my.a}</b><span>passes déc.</span></div>${my.yc || my.rc ? `<div><b>${my.yc ? '🟨' + my.yc : ''}${my.rc ? ' 🟥' + my.rc : ''}</b><span>cartons</span></div>` : ''}${my.sessions && my.sessions.total ? `<div><b>${Math.round(my.sessions.present / my.sessions.total * 100)} %</b><span>présence aux séances (${my.sessions.present}/${my.sessions.total})</span></div>` : ''}</div>${my.teams && Object.keys(my.teams).length > 1 ? `<p class="info">Joué avec : ${Object.entries(my.teams).map(([t, n]) => `<b>${esc(t)}</b> (${n})`).join(' · ')}</p>` : ''}<p class="info">Matchs officiels (championnat, coupe).${my.f.mp ? ` Matchs amicaux : <b>${my.f.mp}</b> joué${my.f.mp > 1 ? 's' : ''}, <b>${my.f.min}'</b>${my.f.g ? `, ⚽ ${my.f.g}` : ''}${my.f.a ? `, 🅿️ ${my.f.a}` : ''}.` : ''}</p>` : ''}
      <h2>Prochain match</h2>${up.length ? nextCard(up[0]) : '<p class="tip">Pas de match prévu pour l\'instant.</p>'}
      ${up.length > 1 ? `<h2>Ensuite</h2><div class="card">${up.slice(1, 6).map(m => `<div class="tr"><span class="d">${esc(fmt(m.date, { weekday: 'short', day: 'numeric', month: 'short' }))}</span><span>${m.home ? 'contre' : 'chez'} ${esc(m.opponent || '?')}${m.time ? ' · ' + esc(hh(m.time)) : ''}</span></div>`).join('')}</div>` : ''}
      ${(data.trainings || []).length ? `<h2>Entraînements (2 semaines)</h2><div class="card">${data.trainings.map(trRow).join('')}</div>` : ''}
      ${past.length ? `<h2>Résultats</h2>${past.slice(0, 12).map(pastCard).join('')}` : ''}
      ${standings()}
      <div class="card" id="gameBox"></div>
      ${(data.coaches || []).length ? `<h2>Les coachs</h2><div class="card">${data.coaches.map(c => `<div class="tr"><span class="d">${esc(c.name)}</span><span>${c.role ? esc(c.role) + ' · ' : ''}<a href="tel:${esc(String(c.phone).replace(/[^\d+]/g, ''))}">📞 ${esc(c.phone)}</a></span></div>`).join('')}</div>` : ''}
      <p class="tip">Ajoute cette page à ton écran d'accueil (Partager → « Sur l'écran d'accueil »). Ton code est personnel : ne le donne à personne.</p>
      ${Member.privacy()}`;
    // (1.61) the predictions game of his category (players and coaches)
    if (typeof Game !== 'undefined') Game.mount($('#gameBox'), { load: () => rpc('member_game', { p_code: code }), bet: (e, h, a, ko) => rpc('member_game_bet', { p_code: code, p_event: e, p_h: h, p_a: a, p_kickoff: ko }), fav: f => rpc('member_game_fav', { p_code: code, p_fav: f }), toast, quiet: true });
  }

  async function load(quiet) {
    code = Member.current();
    try { data = await rpc('member_view', { p_code: code }); window.CLUB_SPORT = (data.club || {}).sport; Member.remember(code, data); Member.crest(data); render(); await Member.replies(code, data); render();
      try { extra = await rpc('member_standings', { p_code: code }); render(); } catch (e) { /* a club server not yet updated: the page stays as before */ } }
    catch (e) {
      if (e.code === 'CODE') { Member.forget(code); location.replace('moi.html'); return; }
      if (quiet && data) return;
      $('#team').textContent = 'Espace joueur'; $('#page').innerHTML = `<p class="tip">${esc(e.message)}</p><p><button class="b" id="again">Réessayer</button></p>`;
      const a = $('#again'); if (a) a.onclick = () => load();
    }
  }
  // présent / absent to a match or a session; absent: the reason first
  async function answer(kind, id, status) {
    const x = (kind === 'match' ? data.matches : data.trainings || []).find(y => y.id === id); if (!x) return;
    let reason = '';
    if (status === 'non') { reason = await Member.askReason(kind === 'match' ? 'Absent pour ce match' : 'Absent à cet entraînement'); if (reason == null) return; }
    const before = { answer: x.answer, reason: x.reason }; x.answer = status; x.reason = reason; render();
    try { await Member.reply(code, kind, id, status, 0, reason); toast(status === 'oui' ? 'C\'est noté : présent 💪' : 'C\'est noté : absent. Le coach voit la raison.'); if (kind === 'training' && status === 'oui') loadSession(id); else if (kind === 'training') { delete sess[id]; render(); } }
    catch (e) { Object.assign(x, before); render(); toast(e.message, true); }
  }
  const icsDate = (d, t) => d.replace(/-/g, '') + 'T' + (t || '10:00').replace(':', '') + '00';
  function ics(m) {
    const e2 = s => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n'), start = m.rdv || m.time || '10:00', [h, mi] = (m.time || start).split(':').map(Number);
    const end = String(Math.min(23, h + 2)).padStart(2, '0') + ':' + String(mi || 0).padStart(2, '0');
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//' + AppCfg.name + '//Joueurs//FR', 'BEGIN:VEVENT', 'UID:raincy-j-' + m.id + '@raincy-coach', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
      'DTSTART:' + icsDate(m.date, start), 'DTEND:' + icsDate(m.date, end), 'SUMMARY:' + e2(`⚽ ${m.team || data.team} ${m.home ? 'contre' : 'chez'} ${m.opponent || '?'}`),
      'LOCATION:' + e2(m.place || (m.home ? (data.club && data.club.fieldName) || '' : '')), 'DESCRIPTION:' + e2(`${m.rdv ? 'Rendez-vous ' + hh(m.rdv) : ''}${m.time ? ' · coup d\'envoi ' + hh(m.time) : ''}`),
      'BEGIN:VALARM', 'TRIGGER:-PT3H', 'ACTION:DISPLAY', 'DESCRIPTION:Match', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  }
  document.addEventListener('click', e => {
    if (Member.onBar(e, () => load())) return;
    if (e.target.closest('[data-perso]')) return Perso.open({ key: 'perso-' + ((data.me || {}).id || code), who: (data.me || {}).name || 'un joueur', toast, send: text => rpc('member_message', { p_code: code, p_body: text, p_parent: false }) });
    const c = e.target.closest('[data-cal]');
    if (c) { const m = data.matches.find(x => x.id === c.dataset.cal); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics(m)], { type: 'text/calendar;charset=utf-8' })); a.download = `match-${m.date}.ics`; document.body.appendChild(a); a.click(); a.remove(); return; }
    const wb = e.target.closest('[data-wb]'); if (wb) { wbVals[wb.dataset.wb] = +wb.dataset.v; document.querySelectorAll(`[data-wb="${wb.dataset.wb}"]`).forEach(x => x.classList.toggle('on', x === wb)); return; }
    if (e.target.closest('[data-wbsend]')) { wbSend(); return; }
    const sb = e.target.closest('[data-sess]'); if (sb) { const x = sess[sb.dataset.sess]; if (x && x.data) { x.open = !x.open; render(); } else loadSession(sb.dataset.sess); return; }
    const stb = e.target.closest('[data-st]'); if (stb) { stTeam = stb.dataset.st; render(); return; }
    const tb = e.target.closest('[data-tans]'); if (tb) { answer('training', tb.closest('[data-t]').dataset.t, tb.dataset.tans); return; }
    const b = e.target.closest('[data-ans]'); if (!b) return;
    answer('match', b.closest('[data-m]').dataset.m, b.dataset.ans);
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && data) load(true); });
  document.addEventListener('member-redraw', () => { if (data) render(); });
  load();
})();
