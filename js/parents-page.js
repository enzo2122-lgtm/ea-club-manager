/* Page for the parents (parents.html): opened with their child's personal code (see member.js), no account.
   The matches of the child's category (time, place, his convocation, car sharing), the next sessions, and « présent » or
   « absent » for their child. A parent with several children switches from one to the other.
   Nothing about the other players or the other families: the club server (member_view) only sends this child's information. */
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hh = x => String(x || '').replace(':', 'h');
  const fmt = (d, o = { weekday: 'long', day: 'numeric', month: 'long' }) => d ? new Date(d + 'T12:00').toLocaleDateString('fr-FR', o) : '';
  let lead = null; // (2.04) rankings of the category, badges
  let code = Member.current(), data = null, tips = []; // tips (1.65): the coach's suggestions for the child
  if (!code) { location.replace('moi.html' + location.hash); return; }

  let tt;
  function toast(msg, err) { const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (err ? ' err' : ''); clearTimeout(tt); tt = setTimeout(() => { t.className = 'toast'; }, 2600); }
  const rpc = Member.rpc;
  const kid = () => (data.me && (data.me.firstName || data.me.name)) || 'ton enfant';

  /* ---------- volunteers: buvette, arbitre de touche… (the club's list, or the app's) ---------- */
  const VOL = [{ key: 'buvette', icon: '🥤', label: 'Buvette', need: 2, when: 'home' }, { key: 'touche', icon: '🚩', label: 'Arbitre de touche', need: 1, when: 'all' },
    { key: 'delegue', icon: '📋', label: 'Délégué', need: 1, when: 'home' }, { key: 'table', icon: '🧾', label: 'Table de marque / FMI', need: 1, when: 'home' },
    { key: 'lavage', icon: '🧺', label: 'Lavage des maillots', need: 1, when: 'all' }];
  const NAME = AppCfg.key('parent-name');
  const myName = () => { try { return localStorage.getItem(NAME) || ''; } catch (e) { return ''; } };
  const volTasks = m => ((data.volTasks && data.volTasks.length) ? data.volTasks : VOL).filter(t => t.on !== false && (t.when === 'all' || (t.when === 'home' && m.home) || (t.when === 'away' && !m.home)));
  function volBox(m) {
    const ts = volTasks(m); if (!ts.length || m.played || m.exempt || !m.open) return '';
    return `<div class="vol"><p class="info"><b>🙋 Coup de main</b> · le club a besoin de vous ce jour-là</p>${ts.map(t => { const ppl = (m.vol || {})[t.key] || [], mine = ppl.some(x => x.mine);
      return `<div class="vol-row"><span class="vt">${t.icon} ${esc(t.label)} <b class="${ppl.length >= t.need ? 'ok' : ''}">${ppl.length}/${t.need}</b></span><span class="vn">${mine ? '✓ Tu es inscrit' : ppl.length ? `${ppl.length} inscrit${ppl.length > 1 ? 's' : ''}` : '<i class="muted">personne pour l\'instant</i>'}</span>
        ${mine ? `<button class="b small" data-vol="${esc(t.key)}" data-rm="1">Me retirer</button>` : ppl.length < t.need + 2 ? `<button class="b small yes on" data-vol="${esc(t.key)}" data-label="${esc(t.label)}">Je m'inscris</button>` : ''}</div>`; }).join('')}</div>`;
  }
  const busy = new Set(); // (2.01) one tap = one sending
  async function volunteer(matchId, task, label, remove) {
    const key = matchId + ':' + task; if (busy.has(key)) return;
    let nm = myName();
    if (!nm && !remove) { nm = (await Member.askText('Ton prénom', 'Pour que le club sache qui vient aider.', `ex : Sarah, maman de ${kid()}`) || '').trim(); if (!nm) return; try { localStorage.setItem(NAME, nm.slice(0, 40)); } catch (e) {} }
    busy.add(key); document.querySelectorAll(`[data-m="${matchId}"] [data-vol="${task}"]`).forEach(b => { b.disabled = true; b.textContent = 'Envoi…'; });
    try { await volunteer2(matchId, task, label, remove, nm); } finally { busy.delete(key); }
  }
  async function volunteer2(matchId, task, label, remove, nm) {
    try { const lst = await rpc('member_volunteer', { p_code: code, p_match: matchId, p_task: task, p_label: label || '', p_name: nm || '-', p_remove: !!remove });
      const m = data.matches.find(x => x.id === matchId); m.vol = Object.assign({}, m.vol || {}, { [task]: lst || [] }); render(); loadPhotos();
      toast(remove ? 'Tu es retiré.' : 'Merci pour ton aide ! 🙏'); }
    catch (e) { toast(e.message, true); }
  }

  const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }; // (2.01) the day in France, not in London
  const result = m => !m.played ? '' : +m.gf > +m.ga ? 'V' : +m.gf < +m.ga ? 'D' : 'N';
  const RES = { V: 'Gagné', D: 'Perdu', N: 'Nul' };
  const mapLink = place => `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}" target="_blank" rel="noopener noreferrer">${esc(place)}</a>`;

  // A calendar file (.ics) for one match or all of them: the phone offers to add it to its agenda
  const icsDate = (d, t) => d.replace(/-/g, '') + 'T' + (t || '10:00').replace(':', '') + '00';
  function ics(list) {
    const club = (data.club && data.club.name) || 'Le club', esc2 = s => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
    const ev = m => { const start = m.rdv || m.time || '10:00', [h, mi] = (m.time || start).split(':').map(Number), end = String(Math.min(23, h + 2)).padStart(2, '0') + ':' + String(mi || 0).padStart(2, '0');
      return ['BEGIN:VEVENT', 'UID:raincy-' + m.id + '@raincy-coach', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z', 'DTSTART:' + icsDate(m.date, start), 'DTEND:' + icsDate(m.date, end),
        'SUMMARY:' + esc2(`⚽ ${kid()} · ${m.home ? club + ' – ' + (m.opponent || '?') : (m.opponent || '?') + ' – ' + club}`),
        'LOCATION:' + esc2(m.place || (m.home ? (data.club && data.club.fieldName) || '' : '')),
        'DESCRIPTION:' + esc2(`${m.home ? 'À domicile' : 'À l\'extérieur'}${m.rdv ? ' · rendez-vous ' + hh(m.rdv) : ''}${m.time ? ' · coup d\'envoi ' + hh(m.time) : ''}`),
        'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:Match', 'END:VALARM', 'END:VEVENT'].join('\r\n'); };
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//' + AppCfg.name + '//Parents//FR', 'CALSCALE:GREGORIAN', ...list.map(ev), 'END:VCALENDAR'].join('\r\n');
  }
  function download(text, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 20000);
  }
  // photos shared by the coach (loaded when the card is shown)
  const photoData = {}, photoAsk = {};
  const isImg = v => typeof v === 'string' && /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v);
  // (2.01) each photo asked once (even when the page is drawn again meanwhile), and only a real image is shown
  const photo = id => photoAsk[id] || (photoAsk[id] = rpc('member_photo', { p_code: code, p_id: id }).then(v => (photoData[id] = isImg(v) ? v : null)).catch(() => { delete photoAsk[id]; return null; }));
  async function loadPhotos() {
    for (const el of document.querySelectorAll('[data-photo]')) {
      const id = el.dataset.photo, v = await photo(id);
      const now = document.querySelector(`[data-photo="${id}"]`); if (v && now) now.innerHTML = `<img alt="Photo du match" src="${v}" loading="lazy">`;
    }
  }

  function matchCard(m) {
    const club = (data.club && data.club.name) || 'Le club', us = `<b>${esc(club)}</b>`, them = esc(m.opponent || '?');
    if (m.exempt) return `<article class="card"><div class="m-date">${esc(fmt(m.date))}</div><div class="m-title">Exempt · pas de match</div></article>`;
    const place = m.place || (m.home ? (data.club && data.club.fieldName) || '' : ''), r = result(m);
    const seatSel = m.home ? '' : `<select class="seats" data-seats aria-label="Places libres dans ma voiture">${[0, 1, 2, 3, 4, 5, 6].map(n => `<option value="${n}" ${+m.seats === n ? 'selected' : ''}>${n ? `🚗 ${n} place${n > 1 ? 's' : ''} libre${n > 1 ? 's' : ''}` : '🚗 pas de place'}</option>`).join('')}</select>`;
    const cars = (m.carpool || []).filter(c => c.mine);
    return `<article class="card ${m.home ? 'home' : 'away'} ${Member.kindCls(m)}" data-m="${esc(m.id)}">${Member.kindBadge(m)}
      <div class="m-date">${esc(fmt(m.date))}</div>
      <div class="m-title">${m.home ? `${us} <i>contre</i> ${them}` : `${them} <i>contre</i> ${us}`}</div>
      <span class="tag">${m.home ? '🏠 À domicile' : '🚌 À l\'extérieur'}</span>
      ${m.played ? `<p><span class="score">${m.home ? `${esc(m.gf)} – ${esc(m.ga)}` : `${esc(m.ga)} – ${esc(m.gf)}`}</span>${r ? `<span class="res ${r}">${RES[r]}</span>` : ''}</p>
        ${m.my ? `<p class="me-line">${esc(kid())} : <b>${+m.my.min ? esc(m.my.min) + "'" : 'pas joué'}</b>${+m.my.g ? ` · ⚽ ${esc(m.my.g)}` : ''}${+m.my.a ? ` · 🅿️ ${esc(m.my.a)}` : ''}</p>` : ''}${typeof Share !== 'undefined' ? `<p><button class="b small" data-shm="${esc(m.id)}">📣 Partager le résultat</button></p>` : ''}` : `
        <p class="info">${m.rdv ? `🕘 Rendez-vous <b>${esc(hh(m.rdv))}</b>` : ''}${m.rdv && m.time ? ' · ' : ''}${m.time ? `coup d'envoi <b>${esc(hh(m.time))}</b>` : ''}${!m.rdv && !m.time ? '🕘 Horaire à confirmer' : ''}</p>
        ${place ? `<p class="info">📍 ${mapLink(place)}</p>` : ''}`}
      ${m.open && m.convoked ? `<div class="kid mine"><span class="nm">${esc(kid())} est convoqué</span>
          <span class="st ${esc(m.answer || '')}">${m.answer === 'oui' ? '✓ présent' : m.answer === 'non' ? '✗ absent' + (m.reason ? ' · ' + esc(m.reason) : '') : 'pas de réponse'}</span>
          <span class="btns"><button class="b yes ${m.answer === 'oui' ? 'on' : ''}" data-ans="oui">Présent</button><button class="b no ${m.answer === 'non' ? 'on' : ''}" data-ans="non">Absent</button>${m.answer === 'oui' ? seatSel : ''}</span></div>`
        : m.open ? `<div class="kid mine"><span class="nm">${esc(kid())} est disponible ?</span>
          <span class="st ${esc(m.answer || '')}">${m.answer === 'oui' ? '✓ dispo' : m.answer === 'non' ? '✗ pas dispo' + (m.reason ? ' · ' + esc(m.reason) : '') : 'pas de réponse'}</span>
          <span class="btns"><button class="b yes ${m.answer === 'oui' ? 'on' : ''}" data-ans="oui">Dispo</button><button class="b no ${m.answer === 'non' ? 'on' : ''}" data-ans="non">Pas dispo</button></span></div>
          <p class="info small">Le coach choisit les convoqués, puis envoie la convocation.</p>` : ''}
      ${!m.played && !m.exempt && m.date >= localDay() ? `<p><button class="b cal" data-cal="${esc(m.id)}">📅 Ajouter à mon agenda</button></p>` : ''}
      ${(m.photos || []).length ? `<div class="photos">${m.photos.map(id => `<a class="ph" data-photo="${esc(id)}" href="#" role="button" aria-label="Voir la photo"><span class="muted small">Photo…</span></a>`).join('')}</div>` : ''}
      ${!m.home && cars.length && !m.played ? `<div class="car-list"><p class="info"><b>🚗 Covoiturage de ${esc(kid())}</b></p>${cars.map(c => `<div class="car"><b>${esc(c.driver || 'Voiture')}</b>
        <span class="muted small">${c.time ? `départ ${esc(hh(c.time))}` : ''}${c.from ? ` · ${esc(c.from)}` : ''} · ${esc(c.n)}/${esc(c.seats || '?')} places</span></div>`).join('')}</div>` : ''}
    </article>`;
  }

  // a session: présent / absent for the child (when the club's server gives the sessions with their id)
  function trRow(t) {
    return `<div class="tr tr-ans" ${t.id ? `data-t="${esc(t.id)}"` : ''}><span class="d">${esc(fmt(t.date, { weekday: 'short', day: 'numeric', month: 'short' }))}</span><span>${Member.trBadge}${t.group ? `<b class="grp">${esc(t.group)}</b> · ` : ''}${t.time ? esc(hh(t.time)) + ' · ' : ''}${esc(t.title || 'Entraînement')}
      ${t.answer === 'non' && t.reason ? `<span class="why">Absent · ${esc(t.reason)}</span>` : ''}</span>
      ${t.id ? `<span class="btns"><button class="b small yes ${t.answer === 'oui' ? 'on' : ''}" data-tans="oui">Présent</button><button class="b small no ${t.answer === 'non' ? 'on' : ''}" data-tans="non">Absent</button></span>` : ''}</div>`;
  }
  function render() {
    const d = new Date(), now = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const club = (data.club && data.club.name) || 'Le club';
    document.title = `${kid()} · ${club} · Parents`;
    $('#club').textContent = `${club} · Espace parents`; $('#team').textContent = data.team || 'Équipe';
    const ms = data.matches || [], up = ms.filter(m => !m.played && m.date >= now), past = ms.filter(m => m.played || m.date < now).reverse().slice(0, 8);
    const trs = data.trainings || [], prog = Member.programme(trs, data.matches, trRow);
    // (1.64) in tabs: matches (présent / absent, covoiturage, coup de main), sessions, results, coaches, settings
    $('#page').innerHTML = `${Member.bar(data, 'parents')}
      ${Member.tabs('parents', [
        { id: 'matchs', icon: '⚽', label: 'Matchs', html: `${Member.bday(data, 'parents')}${Member.installCard('parents')}${Injury.card(kid(), Injury.events(data))}<div id="abBox"></div><h2>Prochains matchs</h2>${up.length > 1 ? '<p><button class="b cal" data-calall>📅 Ajouter tous les matchs à mon agenda</button></p>' : ''}${up.length ? up.map(matchCard).join('') : '<p class="tip">Pas de match prévu pour l\'instant.</p>'}` },
        { id: 'benevoles', icon: '🙋', label: 'Bénévoles', html: (() => { const l = up.filter(m => volBox(m)); return l.length ? `<h2>Coup de main les jours de match</h2><p class="info">Buvette, arbitre de touche, délégué, lavage des maillots… Inscris-toi en un geste.</p>${l.map(m => `<article class="card ${m.home ? 'home' : 'away'} ${Member.kindCls(m)}" data-m="${esc(m.id)}">${Member.kindBadge(m)}<div class="m-date">${esc(fmt(m.date))}${m.time ? ' · ' + esc(String(m.time).replace(':', 'h')) : ''}</div><div class="m-title">${m.home ? '🏠 contre' : '🚌 chez'} ${esc(m.opponent || '?')}</div>${volBox(m)}</article>`).join('')}` : ''; })(), empty: 'Pas de besoin de bénévoles pour les prochains matchs.' },
        { id: 'seances', icon: '🏃', label: 'Séances', html: `${Member.tipsHtml(tips, (data.me || {}).firstName || kid())}
          ${prog ? `<h2>Entraînements et matchs à venir</h2>${prog}` : '<h2>Entraînements et matchs</h2><p class="tip">Rien de prévu pour l\'instant.</p>'}
          <div class="card perso-card"><h3>🏃 Mon entraînement perso</h3><p class="info">Pour ${esc(kid())} : physique, technique ou tactique, seul ou à plusieurs. Ses footings (temps, distance) et l'envoi au coach.</p><button class="b yes on" data-perso>Créer ma séance · noter mes footings</button></div>` },
        { id: 'resultats', icon: '🏆', label: 'Résultats', html: `${Member.leaders(lead, kid())}${past.length ? `<h2>Derniers résultats</h2>${past.map(matchCard).join('')}` : ''}`, empty: 'Pas encore de résultat.' }, // (2.04) badges and rankings
        { id: 'chat', icon: '🗨️', label: 'Chat', html: '<div id="chatBox"></div>' }, // (1.97) the chat of the category, here too (under 16 the family opens this page)
        { id: 'coachs', icon: '📞', label: 'Coachs', html: (data.coaches || []).length ? `<h2>Les coachs</h2><div class="card">${data.coaches.map(c => `<div class="tr"><span class="d">${esc(c.name)}</span><span>${c.role ? esc(c.role) + ' · ' : ''}<a href="tel:${esc(String(c.phone).replace(/[^\d+]/g, ''))}">📞 ${esc(c.phone)}</a></span></div>`).join('')}</div>` : '', empty: 'Les coachs de la catégorie ne sont pas encore indiqués.' },
        { id: 'moi', icon: '👤', label: 'Moi', html: `<div id="urgBox"></div><h2>Réglages</h2>${Member.notifyCard('parents')}${Member.tabPosCard()}${Member.optoutCard(lead)}
          ${Member.updateCard()}
          <p class="tip">Ajoute cette page à ton écran d'accueil (Partager → « Sur l'écran d'accueil ») pour la retrouver. Le code de ton enfant est personnel : ne le donne à personne. Une question ? Écris au coach.</p>
          ${Member.privacy()}` },
      ])}
      <div id="phView" class="ph-view" hidden></div>`;
    // (2.50) « Prévenir le coach »: an absence of several days, a problem for the next session or match
    if (typeof Absence !== 'undefined' && $('#abBox')) Absence.mount($('#abBox'), { key: code, toast,
      events: [...(data.matches || []).filter(m => !m.played).map(m => ({ id: m.id, date: m.date, time: m.time, label: 'Match ' + (m.home ? 'contre ' : 'chez ') + (m.opponent || '?') })),
        ...(data.trainings || []).map(t => ({ id: t.id, date: t.date, time: t.time, label: t.title || 'Entraînement' }))].filter(e => e.id && e.date).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))),
      load: () => rpc('member_absence', { p_code: code, p_parent: true }), add: d => rpc('member_absence', { p_code: code, p_action: 'add', p_data: d, p_parent: true }),
      del: id => rpc('member_absence', { p_code: code, p_action: 'del', p_data: { id }, p_parent: true }),
      alert: (k, ev, note) => rpc('member_alert', { p_code: code, p_kind: k, p_event: ev, p_note: note, p_parent: true }) });
    // (2.42) the emergency sheet of the child, filled by the parents
    if (typeof Urgent !== 'undefined' && $('#urgBox')) Urgent.mount($('#urgBox'), { key: code, toast, intro: `Ce que les coachs doivent savoir sur ${kid()} et qui appeler s'il arrive quelque chose (allergies, traitements, conduite à tenir…). Seuls les coachs la voient.`,
      load: () => rpc('member_urgent', { p_code: code }), save: d => rpc('member_urgent', { p_code: code, p_data: d }) });
    if (typeof Chat !== 'undefined') Chat.mount($('#chatBox'), { key: 'p:' + code, kind: 'player', king: Member.isBday((data.me || {}).birth), note: `👪 Le chat des parents de la catégorie, avec les coachs. Les coachs peuvent mettre les parents en sourdine.`, toast, load: (c, after) => rpc('member_chat', { p_code: code, p_cat: c, p_after: after || 0, p_room: 'all' }).catch(e => { if (/pas encore prêt/.test(e.message)) return rpc('member_chat', { p_code: code, p_cat: c, p_after: after || 0 }); throw e; }),
      post: (c, b, r) => rpc('member_chat_post', Object.assign({ p_code: code, p_cat: c, p_body: b }, r ? { p_reply: r } : {})), edit: (c, id, b) => rpc('member_chat_edit', { p_code: code, p_cat: c, p_id: id, p_body: b }), del: (c, id) => rpc('member_chat_del', { p_code: code, p_id: id }),
      poll: (c, q, opts, multi) => rpc('member_chat_poll', { p_code: code, p_cat: c, p_q: q, p_opts: opts, p_multi: multi }), vote: (c, id, i) => rpc('member_chat_vote', { p_code: code, p_cat: c, p_id: id, p_opt: i }),
      pollClose: (c, id, closed) => rpc('member_chat_poll_close', { p_code: code, p_cat: c, p_id: id, p_closed: closed }),
      react: (c, id, e) => rpc('member_chat_react', { p_code: code, p_cat: c, p_id: id, p_emo: e }), report: (c, id) => rpc('member_chat_report', { p_code: code, p_cat: c, p_id: id }),
      mute: on => rpc('member_chat_mute', { p_code: code, p_on: on }),
      photo: (c, img, b) => rpc('member_chat_photo', { p_code: code, p_cat: c, p_img: img, p_body: b || null }), img: (c, id) => rpc('member_chat_img', { p_code: code, p_cat: c, p_id: id }) });
  }

  // (2.01) everything asked at the same time, the page drawn twice; another child: nothing of the one before
  let loadTok = 0, lastLoad = 0;
  async function load(quiet) {
    const tok = ++loadTok, c = Member.current(); lastLoad = Date.now();
    if (c !== code) { code = c; data = null; tips = []; lead = null; Object.keys(photoData).forEach(k => delete photoData[k]); Object.keys(photoAsk).forEach(k => delete photoAsk[k]); }
    try {
      const d = await rpc('member_view', { p_code: code }); if (tok !== loadTok) return;
      if (!Member.family(d)) { Member.remember(code, d); location.replace('joueurs.html' + location.hash); return; } // (2.07) no families' space above U15
      data = d; window.CLUB_SPORT = (data.club || {}).sport; Member.remember(code, data); Member.crest(data); render(); loadPhotos();
      const [, t, ld] = await Promise.all([Member.replies(code, data), Member.tips(code), Injury.load(code).catch(() => null).then(() => rpc('member_leaders', { p_code: code })).catch(() => null)]);
      if (tok !== loadTok) return;
      tips = t || []; lead = ld || null; render(); loadPhotos();
    }
    catch (e) {
      if (tok !== loadTok) return;
      if (e.code === 'CODE') { Member.forget(code); location.replace('moi.html'); return; }
      if (quiet && data) return;
      $('#team').textContent = 'Espace parents'; $('#page').innerHTML = `<p class="tip">${esc(e.message)}</p><p><button class="b" id="again">Réessayer</button></p>`;
      const a = $('#again'); if (a) a.onclick = () => load();
    }
  }

  // présent / absent to a match or a session; absent: the reason first
  const answering = new Set();
  async function answer(matchId, status, seats, kind = 'match') {
    if (answering.has(matchId)) return; // (2.01) the answer before is still on its way
    answering.add(matchId); try { await answer2(matchId, status, seats, kind); } finally { answering.delete(matchId); }
  }
  async function answer2(matchId, status, seats, kind) {
    const m = (kind === 'match' ? data.matches : data.trainings || []).find(x => x.id === matchId); if (!m) return;
    let reason = '';
    if (status === 'non') { reason = await Member.askReason(`${kid()} sera absent${kind === 'match' ? ' pour ce match' : ' à cet entraînement'}`); if (reason == null) return; }
    const before = { answer: m.answer, seats: m.seats, reason: m.reason };
    Object.assign(m, { answer: status, seats: seats || 0, reason }); render(); loadPhotos();
    try { await Member.reply(code, kind, matchId, status, seats || 0, reason); toast(status === 'oui' ? `Merci ! ${kid()} est noté présent.` : `Merci ! ${kid()} est noté absent. Le coach voit la raison.`); }
    catch (e) { Object.assign(m, before); render(); toast(e.message, true); }
  }

  document.addEventListener('click', e => {
    if (Member.onBar(e, () => load())) return;
    if (Injury.onClick(e, code, true, kid(), msg => { toast(msg); render(); loadPhotos(); })) return;
    if (e.target.closest('[data-perso]')) return Perso.open({ key: 'perso-' + ((data.me || {}).id || code), who: kid(), toast, send: text => rpc('member_message', { p_code: code, p_body: text, p_parent: true }) });
    const c = e.target.closest('[data-cal], [data-calall]');
    if (c) { const now = localDay(), list = c.dataset.cal ? data.matches.filter(m => m.id === c.dataset.cal) : data.matches.filter(m => !m.played && !m.exempt && m.date >= now);
      download(ics(list), c.dataset.cal ? `match-${list[0].date}.ics` : `matchs-${kid()}.ics`); return; }
    const ph = e.target.closest('[data-photo]');
    if (ph) { e.preventDefault(); const v = $('#phView'); v.innerHTML = '<p>Chargement de la photo…</p>'; v.hidden = false;
      photo(ph.dataset.photo).then(src => { v.innerHTML = src ? `<img alt="Photo du match" src="${src}"><p>Touche pour fermer</p>` : '<p>Photo indisponible. Touche pour fermer</p>'; }); return; }
    if (e.target.closest('#phView')) { $('#phView').hidden = true; return; }
    const shm = e.target.closest('[data-shm]'); if (shm) { const m = (data.matches || []).find(x => x.id === shm.dataset.shm); if (m) Member.shareMatch(data, m, kid()); return; } // (2.06)
    const oo = e.target.closest('[data-optout]'); if (oo) { (async () => { oo.disabled = true; try { await rpc('member_leader_optout', { p_code: code, p_on: oo.dataset.optout === '1' }); lead = await rpc('member_leaders', { p_code: code }); render(); toast(oo.dataset.optout === '1' ? `${kid()} n'apparaît plus dans les classements.` : `${kid()} apparaît dans les classements.`); } catch (err) { oo.disabled = false; toast(err.message, true); } })(); return; } // (2.05)
    const v = e.target.closest('[data-vol]'); if (v) { volunteer(v.closest('[data-m]').dataset.m, v.dataset.vol, v.dataset.label, !!v.dataset.rm); return; }
    const tb = e.target.closest('[data-tans]'); if (tb) { answer(tb.closest('[data-t]').dataset.t, tb.dataset.tans, 0, 'training'); return; }
    const b = e.target.closest('[data-ans]'); if (!b) return;
    const m = data.matches.find(x => x.id === b.closest('[data-m]').dataset.m);
    answer(m.id, b.dataset.ans, b.dataset.ans === 'oui' ? m.seats || 0 : 0);
  });
  document.addEventListener('change', e => {
    const s = e.target.closest('[data-seats]'); if (!s) return;
    answer(s.closest('[data-m]').dataset.m, 'oui', +s.value);
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && data && Date.now() - lastLoad > 60000) load(true); }); // (2.01) at most once a minute
  document.addEventListener('member-redraw', () => { if (data) { render(); loadPhotos(); } });
  load();
})();
