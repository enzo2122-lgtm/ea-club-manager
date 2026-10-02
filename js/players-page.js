/* Page for a player (joueurs.html): opened with his personal code (see member.js), no account.
   His next match with the coach's team talk (objective, 3 keys, last word, video), his convocation (présent / absent),
   his well-being questionnaire, his season (playing time, goals, assists), the sessions and results of his category.
   Nothing about the other players: the club server (member_view) only sends his own information. */
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hh = x => String(x || '').replace(':', 'h');
  const fmt = (d, o = { weekday: 'long', day: 'numeric', month: 'long' }) => d ? new Date(d + 'T12:00').toLocaleDateString('fr-FR', o) : '';
  let code = Member.current(), data = null;
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
  function season() {
    const r = { mp: 0, min: 0, g: 0, a: 0, conv: 0 };
    const ami = m => /amical|tournoi|pr[ée]pa|friendly/i.test(m.competition || '');
    r.f = { mp: 0, min: 0, g: 0, a: 0 };
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
      ${m.convoked ? `<div class="mine-box"><b>Tu es convoqué 💪</b><div class="btns"><button class="b yes ${m.answer === 'oui' ? 'on' : ''}" data-ans="oui">Je suis présent</button><button class="b no ${m.answer === 'non' ? 'on' : ''}" data-ans="non">Absent</button></div></div>`
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
  function render() {
    const now = today();
    document.title = `${(data.me || {}).name || 'Joueur'} · ${club()}`;
    $('#club').textContent = `${club()} · Espace joueur`; $('#team').textContent = data.team || 'Équipe';
    const ms = data.matches || [], up = ms.filter(m => !m.played && m.date >= now && !m.exempt), past = ms.filter(m => m.played).reverse();
    const my = season();
    $('#page').innerHTML = `${Member.bar(data, 'joueurs')}
      ${wbCard(now)}
      ${my.conv || my.f.mp ? `<h2>Ma saison</h2><div class="tiles"><div><b>${my.mp}</b><span>matchs joués</span></div><div><b>${my.min}'</b><span>temps de jeu</span></div><div><b>${my.mp ? Math.round(my.min / my.mp) : 0}'</b><span>par match</span></div><div><b>${my.g}</b><span>buts</span></div><div><b>${my.a}</b><span>passes déc.</span></div></div><p class="info">Matchs officiels (championnat, coupe).${my.f.mp ? ` Matchs amicaux : <b>${my.f.mp}</b> joué${my.f.mp > 1 ? 's' : ''}, <b>${my.f.min}'</b>${my.f.g ? `, ⚽ ${my.f.g}` : ''}${my.f.a ? `, 🅿️ ${my.f.a}` : ''}.` : ''}</p>` : ''}
      <h2>Prochain match</h2>${up.length ? nextCard(up[0]) : '<p class="tip">Pas de match prévu pour l\'instant.</p>'}
      ${up.length > 1 ? `<h2>Ensuite</h2><div class="card">${up.slice(1, 6).map(m => `<div class="tr"><span class="d">${esc(fmt(m.date, { weekday: 'short', day: 'numeric', month: 'short' }))}</span><span>${m.home ? 'contre' : 'chez'} ${esc(m.opponent || '?')}${m.time ? ' · ' + esc(hh(m.time)) : ''}</span></div>`).join('')}</div>` : ''}
      ${(data.trainings || []).length ? `<h2>Entraînements (2 semaines)</h2><div class="card">${data.trainings.map(t => `<div class="tr"><span class="d">${esc(fmt(t.date, { weekday: 'short', day: 'numeric', month: 'short' }))}</span><span>${t.time ? esc(hh(t.time)) + ' · ' : ''}${esc(t.title || 'Entraînement')}</span></div>`).join('')}</div>` : ''}
      ${past.length ? `<h2>Résultats</h2>${past.slice(0, 12).map(pastCard).join('')}` : ''}
      ${(data.coaches || []).length ? `<h2>Les coachs</h2><div class="card">${data.coaches.map(c => `<div class="tr"><span class="d">${esc(c.name)}</span><span>${c.role ? esc(c.role) + ' · ' : ''}<a href="tel:${esc(String(c.phone).replace(/[^\d+]/g, ''))}">📞 ${esc(c.phone)}</a></span></div>`).join('')}</div>` : ''}
      <p class="tip">Ajoute cette page à ton écran d'accueil (Partager → « Sur l'écran d'accueil »). Ton code est personnel : ne le donne à personne.</p>`;
  }

  async function load(quiet) {
    code = Member.current();
    try { data = await rpc('member_view', { p_code: code }); window.CLUB_SPORT = (data.club || {}).sport; Member.remember(code, data); Member.crest(data); render(); }
    catch (e) {
      if (e.code === 'CODE') { Member.forget(code); location.replace('moi.html'); return; }
      if (quiet && data) return;
      $('#team').textContent = 'Espace joueur'; $('#page').innerHTML = `<p class="tip">${esc(e.message)}</p><p><button class="b" id="again">Réessayer</button></p>`;
      const a = $('#again'); if (a) a.onclick = () => load();
    }
  }
  async function answer(matchId, status) {
    const m = data.matches.find(x => x.id === matchId); if (!m) return;
    const before = m.answer; m.answer = status; render();
    try { await rpc('member_answer', { p_code: code, p_match: matchId, p_status: status, p_seats: 0 }); toast(status === 'oui' ? 'C\'est noté : présent 💪' : 'C\'est noté : absent. Préviens le coach si besoin.'); }
    catch (e) { m.answer = before; render(); toast(e.message, true); }
  }
  const icsDate = (d, t) => d.replace(/-/g, '') + 'T' + (t || '10:00').replace(':', '') + '00';
  function ics(m) {
    const e2 = s => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n'), start = m.rdv || m.time || '10:00', [h, mi] = (m.time || start).split(':').map(Number);
    const end = String(Math.min(23, h + 2)).padStart(2, '0') + ':' + String(mi || 0).padStart(2, '0');
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//EA Club Manager//Joueurs//FR', 'BEGIN:VEVENT', 'UID:raincy-j-' + m.id + '@raincy-coach', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
      'DTSTART:' + icsDate(m.date, start), 'DTEND:' + icsDate(m.date, end), 'SUMMARY:' + e2(`⚽ ${m.team || data.team} ${m.home ? 'contre' : 'chez'} ${m.opponent || '?'}`),
      'LOCATION:' + e2(m.place || (m.home ? (data.club && data.club.fieldName) || '' : '')), 'DESCRIPTION:' + e2(`${m.rdv ? 'Rendez-vous ' + hh(m.rdv) : ''}${m.time ? ' · coup d\'envoi ' + hh(m.time) : ''}`),
      'BEGIN:VALARM', 'TRIGGER:-PT3H', 'ACTION:DISPLAY', 'DESCRIPTION:Match', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  }
  document.addEventListener('click', e => {
    if (Member.onBar(e, () => load())) return;
    const c = e.target.closest('[data-cal]');
    if (c) { const m = data.matches.find(x => x.id === c.dataset.cal); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics(m)], { type: 'text/calendar;charset=utf-8' })); a.download = `match-${m.date}.ics`; document.body.appendChild(a); a.click(); a.remove(); return; }
    const wb = e.target.closest('[data-wb]'); if (wb) { wbVals[wb.dataset.wb] = +wb.dataset.v; document.querySelectorAll(`[data-wb="${wb.dataset.wb}"]`).forEach(x => x.classList.toggle('on', x === wb)); return; }
    if (e.target.closest('[data-wbsend]')) { wbSend(); return; }
    const b = e.target.closest('[data-ans]'); if (!b) return;
    answer(b.closest('[data-m]').dataset.m, b.dataset.ans);
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && data) load(true); });
  load();
})();
