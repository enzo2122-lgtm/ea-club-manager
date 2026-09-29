/* Page for the parents (parents.html): opened with their child's personal code (see member.js), no account.
   The matches of the child's category (time, place, his convocation, car sharing), the next sessions, and « présent » or
   « absent » for their child. A parent with several children switches from one to the other.
   Nothing about the other players or the other families: the club server (member_view) only sends this child's information. */
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
  const kid = () => (data.me && (data.me.firstName || data.me.name)) || 'ton enfant';

  /* ---------- volunteers: buvette, arbitre de touche… (the club's list, or the app's) ---------- */
  const VOL = [{ key: 'buvette', icon: '🥤', label: 'Buvette', need: 2, when: 'home' }, { key: 'touche', icon: '🚩', label: 'Arbitre de touche', need: 1, when: 'all' },
    { key: 'delegue', icon: '📋', label: 'Délégué', need: 1, when: 'home' }, { key: 'table', icon: '🧾', label: 'Table de marque / FMI', need: 1, when: 'home' },
    { key: 'lavage', icon: '🧺', label: 'Lavage des maillots', need: 1, when: 'all' }];
  const NAME = 'ea-parent-name';
  const myName = () => { try { return localStorage.getItem(NAME) || ''; } catch (e) { return ''; } };
  const volTasks = m => ((data.volTasks && data.volTasks.length) ? data.volTasks : VOL).filter(t => t.on !== false && (t.when === 'all' || (t.when === 'home' && m.home) || (t.when === 'away' && !m.home)));
  function volBox(m) {
    const ts = volTasks(m); if (!ts.length || m.played || m.exempt || !m.open) return '';
    return `<div class="vol"><p class="info"><b>🙋 Coup de main</b> · le club a besoin de vous ce jour-là</p>${ts.map(t => { const ppl = (m.vol || {})[t.key] || [], mine = ppl.some(x => x.mine);
      return `<div class="vol-row"><span class="vt">${t.icon} ${esc(t.label)} <b class="${ppl.length >= t.need ? 'ok' : ''}">${ppl.length}/${t.need}</b></span><span class="vn">${mine ? '✓ Tu es inscrit' : ppl.length ? `${ppl.length} inscrit${ppl.length > 1 ? 's' : ''}` : '<i class="muted">personne pour l\'instant</i>'}</span>
        ${mine ? `<button class="b small" data-vol="${esc(t.key)}" data-rm="1">Me retirer</button>` : ppl.length < t.need + 2 ? `<button class="b small yes on" data-vol="${esc(t.key)}" data-label="${esc(t.label)}">Je m'inscris</button>` : ''}</div>`; }).join('')}</div>`;
  }
  async function volunteer(matchId, task, label, remove) {
    let nm = myName();
    if (!nm && !remove) { nm = (prompt(`Ton prénom (ex : Sarah, maman de ${kid()})`) || '').trim(); if (!nm) return; try { localStorage.setItem(NAME, nm.slice(0, 40)); } catch (e) {} }
    try { const lst = await rpc('member_volunteer', { p_code: code, p_match: matchId, p_task: task, p_label: label || '', p_name: nm || '-', p_remove: !!remove });
      const m = data.matches.find(x => x.id === matchId); m.vol = Object.assign({}, m.vol || {}, { [task]: lst || [] }); render(); loadPhotos();
      toast(remove ? 'Tu es retiré.' : 'Merci pour ton aide ! 🙏'); }
    catch (e) { toast(e.message, true); }
  }

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
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//EA Club Manager//Parents//FR', 'CALSCALE:GREGORIAN', ...list.map(ev), 'END:VCALENDAR'].join('\r\n');
  }
  function download(text, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 20000);
  }
  // photos shared by the coach (loaded when the card is shown)
  const photoData = {};
  async function loadPhotos() {
    for (const el of document.querySelectorAll('[data-photo]')) {
      const id = el.dataset.photo;
      if (!photoData[id]) { try { photoData[id] = await rpc('member_photo', { p_code: code, p_id: id }); } catch (e) { continue; } }
      if (photoData[id]) el.innerHTML = `<img alt="Photo du match" src="${photoData[id]}" loading="lazy">`;
    }
  }

  function matchCard(m) {
    const club = (data.club && data.club.name) || 'Le club', us = `<b>${esc(club)}</b>`, them = esc(m.opponent || '?');
    if (m.exempt) return `<article class="card"><div class="m-date">${esc(fmt(m.date))}</div><div class="m-title">Exempt · pas de match</div></article>`;
    const place = m.place || (m.home ? (data.club && data.club.fieldName) || '' : ''), r = result(m);
    const seatSel = m.home ? '' : `<select class="seats" data-seats aria-label="Places libres dans ma voiture">${[0, 1, 2, 3, 4, 5, 6].map(n => `<option value="${n}" ${+m.seats === n ? 'selected' : ''}>${n ? `🚗 ${n} place${n > 1 ? 's' : ''} libre${n > 1 ? 's' : ''}` : '🚗 pas de place'}</option>`).join('')}</select>`;
    const cars = (m.carpool || []).filter(c => c.mine);
    return `<article class="card ${m.home ? 'home' : 'away'}" data-m="${esc(m.id)}">
      <div class="m-date">${esc(fmt(m.date))}${m.team && m.team !== data.team ? ` · ${esc(m.team)}` : ''}</div>
      <div class="m-title">${m.home ? `${us} <i>contre</i> ${them}` : `${them} <i>contre</i> ${us}`}</div>
      <span class="tag">${m.home ? '🏠 À domicile' : '🚌 À l\'extérieur'}</span>${m.competition ? `<span class="tag">${esc(m.competition)}</span>` : ''}
      ${m.played ? `<p><span class="score">${m.home ? `${esc(m.gf)} – ${esc(m.ga)}` : `${esc(m.ga)} – ${esc(m.gf)}`}</span>${r ? `<span class="res ${r}">${RES[r]}</span>` : ''}</p>
        ${m.my ? `<p class="me-line">${esc(kid())} : <b>${+m.my.min ? esc(m.my.min) + "'" : 'pas joué'}</b>${+m.my.g ? ` · ⚽ ${esc(m.my.g)}` : ''}${+m.my.a ? ` · 🅿️ ${esc(m.my.a)}` : ''}</p>` : ''}` : `
        <p class="info">${m.rdv ? `🕘 Rendez-vous <b>${esc(hh(m.rdv))}</b>` : ''}${m.rdv && m.time ? ' · ' : ''}${m.time ? `coup d'envoi <b>${esc(hh(m.time))}</b>` : ''}${!m.rdv && !m.time ? '🕘 Horaire à confirmer' : ''}</p>
        ${place ? `<p class="info">📍 ${mapLink(place)}</p>` : ''}`}
      ${m.open && m.convoked ? `<div class="kid mine"><span class="nm">${esc(kid())} est convoqué</span>
          <span class="st ${esc(m.answer || '')}">${m.answer === 'oui' ? '✓ présent' : m.answer === 'non' ? '✗ absent' : 'pas de réponse'}</span>
          <span class="btns"><button class="b yes ${m.answer === 'oui' ? 'on' : ''}" data-ans="oui">Présent</button><button class="b no ${m.answer === 'non' ? 'on' : ''}" data-ans="non">Absent</button>${m.answer === 'oui' ? seatSel : ''}</span></div>`
        : m.open && m.published ? `<p class="info">${esc(kid())} n'est pas convoqué pour ce match.</p>` : m.open ? '<p class="info">La liste des convoqués n\'est pas encore publiée.</p>' : ''}
      ${volBox(m)}
      ${!m.played && !m.exempt && m.date >= new Date().toISOString().slice(0, 10) ? `<p><button class="b cal" data-cal="${esc(m.id)}">📅 Ajouter à mon agenda</button></p>` : ''}
      ${(m.photos || []).length ? `<div class="photos">${m.photos.map(id => `<a class="ph" data-photo="${esc(id)}" href="#" role="button" aria-label="Voir la photo"><span class="muted small">Photo…</span></a>`).join('')}</div>` : ''}
      ${!m.home && cars.length && !m.played ? `<div class="car-list"><p class="info"><b>🚗 Covoiturage de ${esc(kid())}</b></p>${cars.map(c => `<div class="car"><b>${esc(c.driver || 'Voiture')}</b>
        <span class="muted small">${c.time ? `départ ${esc(hh(c.time))}` : ''}${c.from ? ` · ${esc(c.from)}` : ''} · ${esc(c.n)}/${esc(c.seats || '?')} places</span></div>`).join('')}</div>` : ''}
    </article>`;
  }

  function render() {
    const d = new Date(), now = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const club = (data.club && data.club.name) || 'Le club';
    document.title = `${kid()} · ${club} · Parents`;
    $('#club').textContent = `${club} · Espace parents`; $('#team').textContent = data.team || 'Équipe';
    const ms = data.matches || [], up = ms.filter(m => !m.played && m.date >= now), past = ms.filter(m => m.played || m.date < now).reverse().slice(0, 8);
    const trs = data.trainings || [];
    $('#page').innerHTML = `${Member.bar(data, 'parents')}
      ${(data.coaches || []).length ? `<h2>Les coachs</h2><div class="card">${data.coaches.map(c => `<div class="tr"><span class="d">${esc(c.name)}</span><span>${c.role ? esc(c.role) + ' · ' : ''}<a href="tel:${esc(String(c.phone).replace(/[^\d+]/g, ''))}">📞 ${esc(c.phone)}</a></span></div>`).join('')}</div>` : ''}
      <h2>Prochains matchs</h2>${up.length > 1 ? '<p><button class="b cal" data-calall>📅 Ajouter tous les matchs à mon agenda</button></p>' : ''}${up.length ? up.map(matchCard).join('') : '<p class="tip">Pas de match prévu pour l\'instant.</p>'}
      ${trs.length ? `<h2>Entraînements (2 semaines)</h2><div class="card">${trs.map(t => `<div class="tr"><span class="d">${esc(fmt(t.date, { weekday: 'short', day: 'numeric', month: 'short' }))}</span><span>${t.time ? esc(hh(t.time)) + ' · ' : ''}${esc(t.title || 'Entraînement')}</span></div>`).join('')}</div>` : ''}
      ${past.length ? `<h2>Derniers résultats</h2>${past.map(matchCard).join('')}` : ''}
      <div id="phView" class="ph-view" hidden></div>
      <p class="tip">Ajoute cette page à ton écran d'accueil (Partager → « Sur l'écran d'accueil ») pour la retrouver. Le code de ton enfant est personnel : ne le donne à personne. Une question ? Écris au coach.</p>`;
  }

  async function load(quiet) {
    code = Member.current();
    try { data = await rpc('member_view', { p_code: code }); Member.remember(code, data); Member.crest(data); render(); loadPhotos(); }
    catch (e) {
      if (e.code === 'CODE') { Member.forget(code); location.replace('moi.html'); return; }
      if (quiet && data) return;
      $('#team').textContent = 'Espace parents'; $('#page').innerHTML = `<p class="tip">${esc(e.message)}</p><p><button class="b" id="again">Réessayer</button></p>`;
      const a = $('#again'); if (a) a.onclick = () => load();
    }
  }

  async function answer(matchId, status, seats) {
    const m = data.matches.find(x => x.id === matchId); if (!m) return;
    const before = { answer: m.answer, seats: m.seats };
    Object.assign(m, { answer: status, seats: seats || 0 }); render(); loadPhotos();
    try { await rpc('member_answer', { p_code: code, p_match: matchId, p_status: status, p_seats: seats || 0 }); toast(status === 'oui' ? `Merci ! ${kid()} est noté présent.` : `Merci ! ${kid()} est noté absent.`); }
    catch (e) { Object.assign(m, before); render(); toast(e.message, true); }
  }

  document.addEventListener('click', e => {
    if (Member.onBar(e, () => load())) return;
    const c = e.target.closest('[data-cal], [data-calall]');
    if (c) { const now = new Date().toISOString().slice(0, 10), list = c.dataset.cal ? data.matches.filter(m => m.id === c.dataset.cal) : data.matches.filter(m => !m.played && !m.exempt && m.date >= now);
      download(ics(list), c.dataset.cal ? `match-${list[0].date}.ics` : `matchs-${kid()}.ics`); return; }
    const ph = e.target.closest('[data-photo]');
    if (ph) { e.preventDefault(); const v = $('#phView'), src = photoData[ph.dataset.photo]; if (src) { v.innerHTML = `<img alt="Photo du match" src="${src}"><p>Touche pour fermer</p>`; v.hidden = false; } return; }
    if (e.target.closest('#phView')) { $('#phView').hidden = true; return; }
    const v = e.target.closest('[data-vol]'); if (v) { volunteer(v.closest('[data-m]').dataset.m, v.dataset.vol, v.dataset.label, !!v.dataset.rm); return; }
    const b = e.target.closest('[data-ans]'); if (!b) return;
    const m = data.matches.find(x => x.id === b.closest('[data-m]').dataset.m);
    answer(m.id, b.dataset.ans, b.dataset.ans === 'oui' ? m.seats || 0 : 0);
  });
  document.addEventListener('change', e => {
    const s = e.target.closest('[data-seats]'); if (!s) return;
    answer(s.closest('[data-m]').dataset.m, 'oui', +s.value);
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && data) load(true); });
  load();
})();
