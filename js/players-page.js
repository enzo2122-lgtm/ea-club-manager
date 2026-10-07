/* Page for a player (joueurs.html): opened with his personal code (see member.js), no account.
   His next match with the coach's team talk (objective, 3 keys, last word, video), his convocation (présent / absent),
   his well-being questionnaire, his season (playing time, goals, assists), the sessions and results of his category.
   Nothing about the other players: the club server (member_view) only sends his own information. */
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hh = x => String(x || '').replace(':', 'h');
  const fmt = (d, o = { weekday: 'long', day: 'numeric', month: 'long' }) => d ? new Date(d + 'T12:00').toLocaleDateString('fr-FR', o) : '';
  let code = Member.current(), data = null, extra = null, tips = [], vids = [], prof = null; // vids, prof (1.81): highlights sent by the coaches, his profile; // tips (1.65): the coach's suggestions for him // extra (1.60): tables of the category + his whole season (member_standings)
  if (!code) { location.replace('moi.html' + location.hash); return; }

  let tt;
  function toast(msg, err) { const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (err ? ' err' : ''); clearTimeout(tt); tt = setTimeout(() => { t.className = 'toast'; }, 2600); }
  const rpc = Member.rpc;
  // (2.01) one tap = one sending: the button waits (« Envoi… ») until the club server has answered
  const busy = new Set();
  async function only(key, fn) {
    if (busy.has(key)) return; busy.add(key);
    const bs = [...document.querySelectorAll(`[data-${key}]`)]; bs.forEach(b => { b.disabled = true; b.dataset.was = b.textContent; b.textContent = 'Envoi…'; });
    try { await fn(); } finally { busy.delete(key); bs.forEach(b => { if (document.contains(b)) { b.disabled = false; b.textContent = b.dataset.was; } }); }
  }

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

  // (1.73) before the convocation: « dispo / pas dispo », the coach sees it and chooses who is called up
  const dispoBox = m => `<div class="mine-box"><b>Tu es dispo ?</b> <span class="info small">${m.answer === 'oui' ? '✓ dispo' : m.answer === 'non' ? '✗ pas dispo' : 'pas encore répondu'}</span>
      <div class="btns"><button class="b yes ${m.answer === 'oui' ? 'on' : ''}" data-ans="oui">Je suis dispo</button><button class="b no ${m.answer === 'non' ? 'on' : ''}" data-ans="non">Pas dispo</button></div>
      <p class="info small">Le coach choisit les convoqués, puis t'envoie la convocation.</p></div>`;
  // the other matches to come: short, with the same answer
  const upCard = m => `<article class="card ${m.home ? 'home' : 'away'} ${Member.kindCls(m)}" data-m="${esc(m.id)}">${Member.kindBadge(m)}<div class="m-date">${esc(fmt(m.date))}${m.time ? ' · ' + esc(hh(m.time)) : ''}</div>
      <div class="m-title">${title(m)}</div><span class="tag">${m.home ? '🏠 À domicile' : '🚌 À l\'extérieur'}</span>
      ${m.convoked ? `<div class="mine-box"><b>Tu es convoqué 💪</b><div class="btns"><button class="b yes ${m.answer === 'oui' ? 'on' : ''}" data-ans="oui">Je suis présent</button><button class="b no ${m.answer === 'non' ? 'on' : ''}" data-ans="non">Absent</button></div></div>`
        : dispoBox(m)}</article>`;
  function nextCard(m) {
    const t = m.talk || {}, keys = (t.keys || []).filter(Boolean), place = m.place || (m.home ? (data.club && data.club.fieldName) || '' : '');
    return `<article class="card next ${m.home ? 'home' : 'away'} ${Member.kindCls(m)}" data-m="${esc(m.id)}">${Member.kindBadge(m)}
      <div class="m-date">${esc(fmt(m.date))}</div>
      <div class="m-title">${title(m)}</div>
      <span class="tag">${m.home ? '🏠 À domicile' : '🚌 À l\'extérieur'}</span>
      <p class="info">${m.rdv ? `🕘 Rendez-vous <b>${esc(hh(m.rdv))}</b>` : ''}${m.rdv && m.time ? ' · ' : ''}${m.time ? `coup d'envoi <b>${esc(hh(m.time))}</b>` : ''}${!m.rdv && !m.time ? '🕘 Horaire à confirmer' : ''}</p>
      ${place ? `<p class="info">📍 ${mapLink(place)}</p>` : ''}
      ${m.convoked ? `<div class="mine-box"><b>Tu es convoqué 💪</b><div class="btns"><button class="b yes ${m.answer === 'oui' ? 'on' : ''}" data-ans="oui">Je suis présent</button><button class="b no ${m.answer === 'non' ? 'on' : ''}" data-ans="non">Absent</button></div>${m.answer === 'non' && m.reason ? `<span class="why">Raison : ${esc(m.reason)}</span>` : ''}</div>`
        : dispoBox(m)}
      ${t.objective || keys.length || t.final || t.video ? `<div class="talk"><h3>🗣️ Le mot du coach</h3>
        ${t.objective ? `<p class="obj">🎯 ${esc(t.objective)}</p>` : ''}${t.system ? `<p class="info">Système : <b>${esc(t.system)}</b></p>` : ''}
        ${keys.length ? `<ol class="keys">${keys.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
        ${t.final ? `<p class="final">${esc(t.final)}</p>` : ''}
        ${t.video ? `<p><a class="b vid" href="${esc(t.video)}" target="_blank" rel="noopener noreferrer">▶ Voir la vidéo du coach</a></p>` : ''}</div>` : ''}
      <p><button class="b cal" data-cal="${esc(m.id)}">📅 Ajouter à mon agenda</button></p></article>`;
  }
  function pastCard(m) {
    const r = result(m), st = m.my;
    return `<article class="card past ${Member.kindCls(m)}">${Member.kindBadge(m)}<div class="m-date">${esc(fmt(m.date, { weekday: 'short', day: 'numeric', month: 'short' }))}</div>
      <div class="m-title">${title(m)}</div><p><span class="score">${score(m)}</span>${r ? `<span class="res ${r}">${RES[r]}</span>` : ''}</p>
      ${st ? `<p class="me-line">Toi : <b>${+st.min ? esc(st.min) + "'" : 'pas joué'}</b>${+st.g ? ` · ${Sport.W().icon} ${esc(st.g)}` : ''}${+st.a ? ` · 🅿️ ${esc(st.a)}` : ''}</p>` : ''}</article>`;
  }

  // the well-being questionnaire of the day (1 to 10), sent to the coaches
  const WB = [['mood', '🙂', 'Ressenti général'], ['mental', '🧠', 'Mental'], ['sleep', '😴', 'Sommeil'], ['legs', '🦵', 'Jambes'], ['sore', '💪', 'Courbatures (10 = aucune)']];
  const wbVals = {}; let wbNote = ''; // (2.01) the note survives a redraw
  function wbCard(now) {
    if ((data.me || {}).wb === now) return '<div class="card wb-done">💚 Merci, ton questionnaire du jour est envoyé.</div>';
    return `<div class="card wb"><h3>💚 Comment tu te sens aujourd'hui ?</h3><p class="info">De 1 (très mal) à 10 (au top). Ton coach voit tes réponses.</p>
      ${WB.map(([k, ic, lab]) => `<div class="wb-row"><span>${ic} ${lab}</span><span class="wb-scale">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<button class="${wbVals[k] === n ? 'on' : ''} v${n}" data-wb="${k}" data-v="${n}">${n}</button>`).join('')}</span></div>`).join('')}
      <input id="wbNote" maxlength="200" placeholder="Un mot pour le coach (douleur, fatigue…)" class="wb-note" value="${esc(wbNote)}">
      <button class="b yes on" data-wbsend>Envoyer</button></div>`;
  }
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  async function wbSend() {
    if (WB.some(([k]) => !wbVals[k])) return toast('Réponds aux 5 questions', true);
    try { await rpc('member_wellness', { p_code: code, p_mood: wbVals.mood, p_mental: wbVals.mental, p_sleep: wbVals.sleep, p_legs: wbVals.legs, p_sore: wbVals.sore, p_note: ($('#wbNote') || {}).value || wbNote });
      (data.me = data.me || {}).wb = today(); wbNote = ''; toast('Merci ! 💚'); render(); }
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
    return `<div class="sess"><h4>📋 ${d.group ? esc(d.group) + ' · ' : ''}${esc(d.title || 'Séance')}${total ? ` · ${total} min` : ''}</h4>${d.goal ? `<p class="obj">🎯 ${esc(d.goal)}</p>` : ''}
      ${ex.length ? `<ol class="sess-ex">${ex.map(e => `<li><b>${esc(e.title || 'Exercice')}</b>${+e.duration ? ` <span class="info">· ${esc(e.duration)} min</span>` : ''}${e.consignes ? `<div class="info">${esc(e.consignes).split('\n').join('<br>')}</div>` : ''}</li>`).join('')}</ol>` : `<p class="info">Le coach n'a pas encore détaillé la séance.</p>`}
      <p class="info">Prépare ta tenue et tes crampons, et sois à l'heure 💪</p></div>`;
  }
  function trRow(t) {
    return `<div class="tr tr-ans" ${t.id ? `data-t="${esc(t.id)}"` : ''}><span class="d">${esc(fmt(t.date, { weekday: 'short', day: 'numeric', month: 'short' }))}</span><span>${Member.trBadge}${t.group ? `<b class="grp">${esc(t.group)}</b> · ` : ''}${t.time ? esc(hh(t.time)) + ' · ' : ''}${esc(t.title || 'Entraînement')}
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
  /* ---------- (1.81) videos sent by the coach: highlights of the matches, the video of the team talk, the videos of his tips ---------- */
  const vTitle = v => `${v.home ? 'contre' : 'chez'} ${v.opponent || '?'}${v.played && v.gf != null ? ` · ${v.home ? v.gf + ' – ' + v.ga : v.ga + ' – ' + v.gf}` : ''}`;
  function videosTab() {
    const hl = (vids || []).map(v => `<article class="card"><div class="m-date">${esc(fmt(v.date, { weekday: 'short', day: 'numeric', month: 'short' }))}${v.team ? ` <span class="kb kb-team">⚽ ${esc(v.team)}</span>` : ''}</div><div class="m-title">🎬 ${esc(vTitle(v))}</div>${VPlayer.list(v.clips)}</article>`).join('');
    const other = [...(data.matches || []).filter(m => m.talk && m.talk.video).map(m => ({ url: m.talk.video, title: 'Le mot du coach · ' + (m.opponent || 'match') })),
      ...(tips || []).flatMap(t => [...new Set([...(t.links || []), t.link].filter(x => /^https:\/\//.test(x || '')))].map(u => ({ url: u, title: t.title || 'Conseil du coach' })))];
    return (hl ? `<h2>🎬 Highlights des matchs</h2>${hl}` : '') + (other.length ? `<h2>📺 Vidéos du coach</h2><div class="card">${VPlayer.list(other)}</div>` : '')
      || '<h2>🎬 Vidéos</h2><p class="tip">Les highlights des matchs et les vidéos envoyées par ton coach arriveront ici. Elles se lisent directement dans l\'appli.</p>';
  }
  function homeVideos() { const v = (vids || [])[0]; return v ? `<h2>🎬 Dernières vidéos</h2><article class="card"><div class="m-title">${esc(vTitle(v))}</div>${VPlayer.list((v.clips || []).slice(0, 3))}${(v.clips || []).length > 3 ? '<p class="info">Les autres dans l\'onglet Vidéos.</p>' : ''}</article>` : ''; }
  // the team talk of his next match (Séances tab)
  function talkCard(m) {
    const t = (m && m.talk) || {}, keys = (t.keys || []).filter(Boolean); if (!t.objective && !keys.length && !t.final) return '';
    return `<div class="card talk"><h3>🗣️ Le mot du coach · ${esc(m.home ? 'contre ' : 'chez ')}${esc(m.opponent || '?')}</h3>${t.objective ? `<p class="obj">🎯 ${esc(t.objective)}</p>` : ''}${keys.length ? `<ol class="keys">${keys.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}${t.final ? `<p class="final">${esc(t.final)}</p>` : ''}${t.video ? VPlayer.list([{ url: t.video, title: 'La vidéo du coach' }]) : ''}</div>`;
  }
  /* ---------- (1.81) write to the coach: a message, an idea for the app, a bug (the coaches get a notification) ---------- */
  const MK = { msg: ['💬', 'Message', 'Ton message au coach…'], idee: ['💡', 'Une idée', 'Une nouveauté que tu aimerais dans l\'appli…'], bug: ['🐞', 'Un bug', 'Ce qui ne marche pas : où, quand, ce que tu as fait…'] };
  let msgKind = 'msg', msgDraft = '';
  const SENT = AppCfg.key('sent-msgs');
  const sentList = () => { try { return JSON.parse(localStorage.getItem(SENT)) || []; } catch (e) { return []; } };
  function msgCard(short) {
    if (short) return `<div class="card"><p class="info">💬 Une question, une idée pour l'appli, un bug ? <button class="b small" data-tab="coachs">Écrire au coach</button></p></div>`;
    const k = MK[msgKind], sent = sentList().filter(x => x.c === code).slice(-3).reverse();
    return `<h2>✉️ Écrire au coach</h2><div class="card msg-card"><div class="btns">${Object.entries(MK).map(([id, [ic, l]]) => `<button class="b small ${id === msgKind ? 'on' : ''}" data-mk="${id}">${ic} ${l}</button>`).join('')}</div>
      <textarea id="msgBody" class="wb-note" rows="4" maxlength="1000" placeholder="${esc(k[2])}">${esc(msgDraft)}</textarea>
      <button class="b yes on" data-msgsend>Envoyer</button><p class="info small">Tes coachs reçoivent une notification. Ils te répondent à l'entraînement ou par téléphone.</p>
      ${sent.length ? `<p class="info small">Envoyés : ${sent.map(x => `${MK[x.k] ? MK[x.k][0] : '💬'} « ${esc(x.b.slice(0, 40))}${x.b.length > 40 ? '…' : ''} » (${esc(fmt(x.d, { day: 'numeric', month: 'short' }))})`).join(' · ')}</p>` : ''}</div>`;
  }
  async function msgSend() {
    const ta = $('#msgBody'), b = ((ta || {}).value || '').trim(); msgDraft = b;
    if (b.length < 3) return toast('Écris ton message', true);
    const pre = msgKind === 'idee' ? '💡 Idée pour l\'appli : ' : msgKind === 'bug' ? '🐞 Bug dans l\'appli : ' : '';
    try { await rpc('member_message', { p_code: code, p_body: pre + b, p_parent: false });
      const l = sentList(); l.push({ c: code, k: msgKind, b, d: today() }); try { localStorage.setItem(SENT, JSON.stringify(l.slice(-20))); } catch (e) {}
      msgDraft = ''; toast('Envoyé au coach ✓'); render(); }
    catch (e) { toast(e.message, true); }
  }
  /* ---------- (1.81) his profile: weight, height, strong foot, strengths and weaknesses; the BMI is computed ---------- */
  let draft = null;
  const profDraft = () => (draft = draft || Object.assign({ weight: '', height: '', foot: '', strengths: '', weaknesses: '' }, prof || {}));
  function bmi(w, h) { w = +String(w || '').replace(',', '.'); h = +String(h || '').replace(',', '.'); if (!w || !h) return null; const v = w / Math.pow(h / 100, 2); return v > 8 && v < 60 ? Math.round(v * 10) / 10 : null; }
  const bmiLabel = v => v < 18.5 ? 'maigreur' : v < 25 ? 'corpulence normale' : v < 30 ? 'surpoids' : 'obésité';
  function profileCard() {
    if (prof === null) return '';
    const p = profDraft(), v = bmi(p.weight, p.height);
    return `<h2>🧍 Mon profil</h2><div class="card prof-card">
      <div class="prof-row"><label>Poids (kg)<input id="pfW" inputmode="decimal" maxlength="5" value="${esc(p.weight)}" placeholder="70"></label><label>Taille (cm)<input id="pfH" inputmode="numeric" maxlength="3" value="${esc(p.height)}" placeholder="178"></label>
        <div class="bmi"><b id="pfBmi">${v || '–'}</b><span id="pfBmiL">${v ? 'IMC · ' + bmiLabel(v) : 'IMC (auto)'}</span></div></div>
      <p class="info">Pied fort</p><div class="btns">${['Droit', 'Gauche', 'Les deux'].map(f => `<button class="b small ${p.foot === f ? 'on' : ''}" data-foot="${f}">🦶 ${f}</button>`).join('')}</div>
      <label class="prof-l">💪 Mes points forts<textarea id="pfS" class="wb-note" rows="2" maxlength="300" placeholder="Vitesse, jeu de tête, passes longues…">${esc(p.strengths)}</textarea></label>
      <label class="prof-l">🎯 Mes points à travailler<textarea id="pfK" class="wb-note" rows="2" maxlength="300" placeholder="Pied gauche, endurance, placement…">${esc(p.weaknesses)}</textarea></label>
      <button class="b yes on" data-profsave>Enregistrer</button><p class="info small">Ton coach voit ton profil. L'IMC est indicatif (chez les jeunes, il se lit avec les courbes de croissance).</p></div>`;
  }
  const readProf = () => { const p = profDraft(), g = id => ($(id) || {}).value || ''; if ($('#pfW')) Object.assign(p, { weight: g('#pfW').trim(), height: g('#pfH').trim(), strengths: g('#pfS'), weaknesses: g('#pfK') }); return p; };
  async function profSave() {
    const p = readProf(), w = String(p.weight).replace(',', '.'), h = String(p.height).replace(',', '.');
    if (w && !(+w >= 15 && +w <= 200)) return toast('Poids : entre 15 et 200 kg', true);
    if (h && !(+h >= 80 && +h <= 230)) return toast('Taille : en centimètres (ex : 178)', true);
    try { prof = await rpc('member_profile', { p_code: code, p_data: { weight: w, height: h, foot: p.foot, strengths: p.strengths, weaknesses: p.weaknesses } }) || {}; draft = null; toast('Profil enregistré ✓'); render(); }
    catch (e) { toast(e.message, true); }
  }
  // the BMI follows the typing; the drafts survive a redraw
  document.addEventListener('input', e => {
    if (e.target.id === 'msgBody') { msgDraft = e.target.value; return; }
    if (e.target.id === 'wbNote') { wbNote = e.target.value; return; }
    if (!/^pf/.test(e.target.id || '')) return;
    const p = readProf(), v = bmi(p.weight, p.height); $('#pfBmi').textContent = v || '–'; $('#pfBmiL').textContent = v ? 'IMC · ' + bmiLabel(v) : 'IMC (auto)';
  });
  function render() {
    if ($('#pfW')) readProf();
    const now = today();
    document.title = `${(data.me || {}).name || 'Joueur'} · ${club()}`;
    $('#club').textContent = `${club()} · Espace joueur`; $('#team').textContent = data.team || 'Équipe';
    const ms = data.matches || [], up = ms.filter(m => !m.played && m.date >= now && !m.exempt), past = ms.filter(m => m.played).reverse();
    const my = season(), prog = Member.programme(data.trainings, data.matches, trRow);
    // (1.64) in tabs: matches, sessions, my season (stats, results, standings), the predictions game, coaches, settings
    $('#page').innerHTML = `${Member.bar(data, 'joueurs')}
      ${Member.tabs('joueurs', [
        { id: 'matchs', icon: '🏠', label: 'Accueil', html: `${wbCard(now)}${Injury.card()}${homeVideos()}${msgCard(true)}` }, // (1.81) no matches here: they are in « Séances »
        { id: 'seances', icon: '🏃', label: 'Séances', html: `${talkCard(up.find(m => m.convoked) || up[0])}${Member.tipsHtml(tips, 'toi')}
          ${prog ? `<h2>Entraînements et matchs à venir</h2>${prog}` : '<h2>Entraînements et matchs</h2><p class="tip">Rien de prévu pour l\'instant.</p>'}
          <div class="card perso-card"><h3>🏃 Mon entraînement perso</h3><p class="info">Physique, technique ou tactique, seul ou à plusieurs, en plus des entraînements du club. Note tes footings (temps, distance) et envoie-les à ton coach si tu veux.</p><button class="b yes on" data-perso>Créer ma séance · noter mes footings</button></div>` },
        { id: 'chat', icon: '🗨️', label: 'Chat', html: '<div id="chatBox"></div>' }, // (1.96) the chat of his category (players and coaches)
        { id: 'saison', icon: '📊', label: 'Saison', html: `${my.conv || my.f.mp ? `<h2>Ma saison</h2><div class="tiles"><div><b>${my.mp}</b><span>matchs joués</span></div><div><b>${my.min}'</b><span>temps de jeu</span></div><div><b>${my.mp ? Math.round(my.min / my.mp) : 0}'</b><span>par match</span></div><div><b>${my.g}</b><span>buts</span></div><div><b>${my.a}</b><span>passes déc.</span></div>${my.yc || my.rc ? `<div><b>${my.yc ? '🟨' + my.yc : ''}${my.rc ? ' 🟥' + my.rc : ''}</b><span>cartons</span></div>` : ''}${my.sessions && my.sessions.total ? `<div><b>${Math.round(my.sessions.present / my.sessions.total * 100)} %</b><span>présence aux séances (${my.sessions.present}/${my.sessions.total})</span></div>` : ''}</div>${my.teams && Object.keys(my.teams).length > 1 ? `<p class="info">Joué avec : ${Object.entries(my.teams).map(([t, n]) => `<b>${esc(t)}</b> (${n})`).join(' · ')}</p>` : ''}<p class="info">Matchs officiels (championnat, coupe).${my.f.mp ? ` Matchs amicaux : <b>${my.f.mp}</b> joué${my.f.mp > 1 ? 's' : ''}, <b>${my.f.min}'</b>${my.f.g ? `, ⚽ ${my.f.g}` : ''}${my.f.a ? `, 🅿️ ${my.f.a}` : ''}.` : ''}</p>` : ''}
          ${past.length ? `<h2>Résultats</h2>${past.slice(0, 12).map(pastCard).join('')}` : ''}
          ${standings()}`, empty: 'Ta saison s\'affichera ici après tes premiers matchs.' },
        { id: 'videos', icon: '🎬', label: 'Vidéos', html: videosTab() },
        { id: 'pronos', icon: '🎯', label: 'Pronos', html: '<div class="card" id="gameBox"></div>' },
        { id: 'coachs', icon: '💬', label: 'Coach', html: `${msgCard()}${(data.coaches || []).length ? `<h2>Les coachs</h2><div class="card">${data.coaches.map(c => `<div class="tr"><span class="d">${esc(c.name)}</span><span>${c.role ? esc(c.role) + ' · ' : ''}<a href="tel:${esc(String(c.phone).replace(/[^\d+]/g, ''))}">📞 ${esc(c.phone)}</a></span></div>`).join('')}</div>` : ''}`, empty: 'Les coachs de la catégorie ne sont pas encore indiqués.' },
        { id: 'moi', icon: '👤', label: 'Moi', html: `${profileCard()}<h2>Réglages</h2>${Member.notifyCard('joueurs')}${Member.tabPosCard()}
          ${Member.updateCard()}
          <p class="tip">Ajoute cette page à ton écran d'accueil (Partager → « Sur l'écran d'accueil »). Ton code est personnel : ne le donne à personne.</p>
          ${Member.privacy()}` },
      ])}`;
    if (typeof Chat !== 'undefined') Chat.mount($('#chatBox'), { key: 'p:' + code, kind: 'player', toast, load: (c, after) => rpc('member_chat', { p_code: code, p_cat: c, p_after: after || 0 }),
      post: (c, b, r) => rpc('member_chat_post', Object.assign({ p_code: code, p_cat: c, p_body: b }, r ? { p_reply: r } : {})), del: (c, id) => rpc('member_chat_del', { p_code: code, p_id: id }),
      poll: (c, q, opts, multi) => rpc('member_chat_poll', { p_code: code, p_cat: c, p_q: q, p_opts: opts, p_multi: multi }), vote: (c, id, i) => rpc('member_chat_vote', { p_code: code, p_cat: c, p_id: id, p_opt: i }),
      pollClose: (c, id, closed) => rpc('member_chat_poll_close', { p_code: code, p_cat: c, p_id: id, p_closed: closed }),
      react: (c, id, e) => rpc('member_chat_react', { p_code: code, p_cat: c, p_id: id, p_emo: e }), report: (c, id) => rpc('member_chat_report', { p_code: code, p_cat: c, p_id: id }),
      mute: on => rpc('member_chat_mute', { p_code: code, p_on: on }) });
    // (1.61) the predictions game of his category (players and coaches)
    if (typeof Game !== 'undefined') Game.mount($('#gameBox'), { load: () => rpc('member_game', { p_code: code }), bet: (e, h, a, ko) => rpc('member_game_bet', { p_code: code, p_event: e, p_h: h, p_a: a, p_kickoff: ko }), fav: f => rpc('member_game_fav', { p_code: code, p_fav: f }), toast, quiet: true });
  }

  // (2.01) everything asked at the same time, the page drawn twice (at once, then complete); another code: nothing of the one before
  let loadTok = 0, lastLoad = 0;
  async function load(quiet) {
    const tok = ++loadTok, c = Member.current(); lastLoad = Date.now();
    if (c !== code) { code = c; data = null; extra = null; tips = []; vids = []; prof = null; draft = null; msgDraft = ''; wbNote = ''; Object.keys(wbVals).forEach(k => delete wbVals[k]); Object.keys(sess).forEach(k => delete sess[k]); }
    try {
      const d = await rpc('member_view', { p_code: code }); if (tok !== loadTok) return;
      data = d; window.CLUB_SPORT = (data.club || {}).sport; Member.remember(code, data); Member.crest(data); render();
      const soft = p => p.catch(() => undefined); // a club server not yet updated: that part stays empty
      const [, t, , v, pr, st] = await Promise.all([Member.replies(code, data), Member.tips(code), soft(Injury.load(code)),
        soft(rpc('member_videos', { p_code: code })), soft(rpc('member_profile', { p_code: code })), soft(rpc('member_standings', { p_code: code }))]);
      if (tok !== loadTok) return;
      tips = t || []; vids = v || []; if (pr !== undefined) prof = pr || {}; if (st) extra = st;
      render();
    }
    catch (e) {
      if (tok !== loadTok) return;
      if (e.code === 'CODE') { Member.forget(code); location.replace('moi.html'); return; }
      if (quiet && data) return;
      $('#team').textContent = 'Espace joueur'; $('#page').innerHTML = `<p class="tip">${esc(e.message)}</p><p><button class="b" id="again">Réessayer</button></p>`;
      const a = $('#again'); if (a) a.onclick = () => load();
    }
  }
  // présent / absent to a match or a session; absent: the reason first
  const answering = new Set();
  async function answer(kind, id, status) {
    if (answering.has(id)) return; // (2.01) the answer before is still on its way
    const x = (kind === 'match' ? data.matches : data.trainings || []).find(y => y.id === id); if (!x) return;
    answering.add(id); try { await answer2(kind, id, status, x); } finally { answering.delete(id); }
  }
  async function answer2(kind, id, status, x) {
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
    if (VPlayer.onClick(e)) return;
    if (Injury.onClick(e, code, false, '', msg => { toast(msg); render(); })) return;
    const mk = e.target.closest('[data-mk]'); if (mk) { msgKind = mk.dataset.mk; render(); const ta = $('#msgBody'); if (ta) ta.focus(); return; }
    if (e.target.closest('[data-msgsend]')) { only('msgsend', msgSend); return; }
    if (e.target.closest('[data-profsave]')) { only('profsave', profSave); return; }
    const ft = e.target.closest('[data-foot]'); if (ft) { readProf(); profDraft().foot = ft.dataset.foot === profDraft().foot ? '' : ft.dataset.foot; render(); return; }
    if (e.target.closest('[data-perso]')) return Perso.open({ key: 'perso-' + ((data.me || {}).id || code), who: (data.me || {}).name || 'un joueur', toast, send: text => rpc('member_message', { p_code: code, p_body: text, p_parent: false }) });
    const c = e.target.closest('[data-cal]');
    if (c) { const m = data.matches.find(x => x.id === c.dataset.cal); const a = document.createElement('a'); if (!m) return; a.href = URL.createObjectURL(new Blob([ics(m)], { type: 'text/calendar;charset=utf-8' })); setTimeout(() => URL.revokeObjectURL(a.href), 30000); a.download = `match-${m.date}.ics`; document.body.appendChild(a); a.click(); a.remove(); return; }
    const wb = e.target.closest('[data-wb]'); if (wb) { wbVals[wb.dataset.wb] = +wb.dataset.v; document.querySelectorAll(`[data-wb="${wb.dataset.wb}"]`).forEach(x => x.classList.toggle('on', x === wb)); return; }
    if (e.target.closest('[data-wbsend]')) { only('wbsend', wbSend); return; }
    const sb = e.target.closest('[data-sess]'); if (sb) { const x = sess[sb.dataset.sess]; if (x && x.data) { x.open = !x.open; render(); } else loadSession(sb.dataset.sess); return; }
    const stb = e.target.closest('[data-st]'); if (stb) { stTeam = stb.dataset.st; render(); return; }
    const tb = e.target.closest('[data-tans]'); if (tb) { answer('training', tb.closest('[data-t]').dataset.t, tb.dataset.tans); return; }
    const b = e.target.closest('[data-ans]'); if (!b) return;
    answer('match', b.closest('[data-m]').dataset.m, b.dataset.ans);
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && data && Date.now() - lastLoad > 60000) load(true); }); // (2.01) at most once a minute
  document.addEventListener('member-redraw', () => { if (data) render(); });
  load();
})();
