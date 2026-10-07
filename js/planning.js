/* Planning: the pitch timetable shared by every coach (trainings, matches, other).
   A full pitch blocks the whole pitch; a half pitch leaves the other half free. The server refuses any overlap. */
const Planning = (() => {
  const { esc, $, $$, toast, modal, confirmBox } = UI;
  const S = () => Store.state;
  const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const KINDS = { entrainement: ['Entraînement', 'training'], match: ['Match', 'match'], autre: ['Autre', 'calendar'] };
  const PART = { full: 'Grand terrain', A: 'Demi-terrain A', B: 'Demi-terrain B' };
  const PX = 0.8; // pixels per minute in the grid
  let px = PX;     // on a phone, the week is squeezed to fit the screen height
  const phone = () => matchMedia('(max-width: 760px)').matches;
  let slots = [], bookings = [], loaded = '';

  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const monday = s => { const d = parse(s), wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return iso(d); };
  const hm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const toMin = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };
  const fieldName = () => S().club.fieldName || 'Terrain';
  const myTeams = () => { const u = Auth.current(); return u ? (u.teamIds || []) : []; };
  // One colour per category, close colours for close ages (U6-U9 greens, U10-U13 blues, U14-U17 purples/pinks)
  // (key order = legend order: Seniors and Vétérans first, then U6 … U17)
  const CAT_COLORS = { SENIORS: '#7a1f2b', VETERANS: '#455a64', VETERANSLOISIRS: '#78909c', ECOLEDEFOOT: '#689f38', U6: '#2e7d32', U7: '#43a047', U8: '#00897b', U9: '#00838f', U10: '#1e88e5', U11: '#1565c0', U12: '#3949ab', U13: '#283593',
    U14: '#8e24aa', U15: '#6a1b9a', U16: '#d81b60', U17: '#ad1457' };
  const ckey = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, '');
  function catOfBooking(b) {
    const t = b.team_id && Store.get('teams', b.team_id);
    const k = [t && t.category, t && t.name, b.team_name].map(ckey).find(x => CAT_COLORS[x] || CAT_COLORS[x.replace(/[^A-Z0-9].*$/, '')]);
    return k ? (CAT_COLORS[k] ? k : k.replace(/[^A-Z0-9].*$/, '')) : '';
  }
  const colorOf = b => CAT_COLORS[catOfBooking(b)] || '';
  const catLabel = k => ({ SENIORS: 'Seniors', VETERANS: 'Vétérans', VETERANSLOISIRS: 'Vétérans loisirs', ECOLEDEFOOT: 'École de foot' })[k] || k;
  // Short name for the narrow week columns on a phone
  const shortOf = b => { const k = catOfBooking(b); return k ? ({ SENIORS: 'SEN', VETERANS: 'VÉT', VETERANSLOISIRS: 'LOIS', ECOLEDEFOOT: 'EDF' })[k] || k : String(b.team_name || KINDS[b.kind][0]).slice(0, 4); };
  /* ---------- the club's matches in the planning ----------
     Home: a block on the pitch (dotted until the pitch is booked for it). Away: a 🚌 badge on top of the day. */
  const matchLen = m => { const f = (Store.get('teams', m.teamId) || {}).format; return f === '5' ? 60 : f === '8' ? 90 : 120; };
  const matchStart = m => /^\d{1,2}:\d{2}/.test(m.time || '') ? toMin(m.time) : null;
  const teamNameOf = m => (Store.get('teams', m.teamId) || {}).name || 'Match';
  const matchesOf = days => S().matches.filter(m => m.date && days.includes(m.date) && !m.exempt);
  // the booking that reserves the pitch for this home match (same day, same category, a match, overlapping)
  function bookingFor(m) {
    const s = matchStart(m); if (s === null) return null;
    return bookings.find(b => b.date === m.date && b.kind === 'match' && (b.team_id === m.teamId || ckey(b.team_name) === ckey(teamNameOf(m))) && b.start_min < s + matchLen(m) && s < b.end_min) || null;
  }
  const matchFor = b => b.kind === 'match' ? S().matches.find(m => m.date === b.date && m.home && (m.teamId === b.team_id || ckey(teamNameOf(m)) === ckey(b.team_name)) && matchStart(m) !== null && matchStart(m) < b.end_min && b.start_min < matchStart(m) + matchLen(m)) : null;
  const unbookedHome = days => matchesOf(days).filter(m => m.home && !m.played && matchStart(m) !== null && !bookingFor(m) && m.date >= iso(new Date()));
  function bookMatch(m) {
    const u = Auth.current(), s = matchStart(m), t = Store.get('teams', m.teamId);
    return Cloud.book({ date: m.date, start_min: s, end_min: Math.min(24 * 60 - 15, s + matchLen(m)), field: 'T1', part: 'full', kind: 'match', team_id: m.teamId || null, team_name: t ? t.name : '', author_id: u.id, author_name: Store.fullName(u), note: 'contre ' + (m.opponent || '?') });
  }
  function matchDetail(m, done) {
    const s = matchStart(m), bk = m.home ? bookingFor(m) : null, acts = [];
    if (Auth.sees(m.teamId)) acts.push({ label: 'Ouvrir la fiche match', icon: I.match, onClick: () => { location.hash = '#/match/' + m.id; } });
    if (m.home && !bk && s !== null && !m.played) acts.push({ label: 'Réserver le terrain', kind: 'primary', icon: I.calendar, onClick: () => { (async () => { const b = UI.busy('Réservation…'); try { await bookMatch(m); toast('Terrain réservé pour le match'); done && done(); } catch (e) { toast(e.message, 'err'); } finally { b.done(); } })(); } });
    acts.push({ label: 'Fermer' });
    modal({ title: `Match · ${teamNameOf(m)}`, noFocus: true, body: `
      <dl class="bk-detail"><div><dt>Match</dt><dd>${m.home ? `<b>${esc(S().club.name)}</b> contre ${esc(m.opponent || '?')}` : `${esc(m.opponent || '?')} contre <b>${esc(S().club.name)}</b>`}</dd></div>
      <div><dt>Quand</dt><dd>${esc(parse(m.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))}${s !== null ? ', ' + hm(s) : ' · heure à préciser'}</dd></div>
      <div><dt>Où</dt><dd>${m.home ? esc(fieldName()) + ' (domicile)' : '🚌 À l\'extérieur' + (m.place ? ' · ' + esc(m.place) : '')}</dd></div>
      ${m.competition ? `<div><dt>Compétition</dt><dd>${esc(m.competition)}</dd></div>` : ''}
      ${m.home ? `<div><dt>Terrain</dt><dd>${bk ? `✓ Réservé ${hm(bk.start_min)}–${hm(bk.end_min)}` : s === null ? 'Heure du match à préciser avant de réserver' : '<b>Pas encore réservé</b> : le terrain peut être pris par une autre équipe'}</dd></div>` : ''}</dl>`, actions: acts });
  }

  const canDelete = b => Auth.isAdmin() || (Auth.current() && b.author_id === Auth.current().id);

  function notReady(root) {
    root.innerHTML = `<header class="page-head"><div><h1>Planning du terrain</h1><p class="sub">Entraînements et matchs de toutes les catégories</p></div></header>
      <div class="empty"><p>Le planning est partagé par tous les éducateurs grâce au serveur du club, qui n'est pas encore connecté sur cet appareil.</p>
      ${Auth.isAdmin() ? `<a class="btn primary" href="#/reglages">${I.settings}<span>Se reconnecter</span></a>` : '<p class="muted">Déconnecte-toi puis reconnecte-toi avec ton nom et ton mot de passe. Si ça ne marche pas, préviens le responsable.</p>'}</div>`;
  }

  async function load(from, to) {
    [slots, bookings] = await Promise.all([Cloud.slots(), Cloud.bookings(from, to)]);
    slots = slots.filter(s => onPitch(s)); bookings = bookings.filter(onPitch);
    loaded = from;
  }
  const onPitch = b => !b.field || b.field === 'T1'; // T1 = the pitch; V1, V2, VK1, VK2 = the locker rooms (js/vestiaires.js)
  const slotsOf = dateStr => slots.filter(s => s.weekday === parse(dateStr).getDay());
  function range(days) {
    // Phone, week view: only the hours that are used this week (at least 4 hours), so the whole week fits on the screen
    if (days && phone() && S().ui.planView !== 'day') {
      const used = [...bookings.filter(b => days.includes(b.date)).map(b => [b.start_min, b.end_min]), ...matchesOf(days).filter(m => m.home && matchStart(m) !== null).map(m => [matchStart(m), matchStart(m) + matchLen(m)]), ...(slots.length ? slots.map(s => [s.start_min, s.end_min]) : [[17 * 60, 21 * 60]])];
      let lo = Math.floor(Math.min(...used.map(x => x[0])) / 60) * 60, hi = Math.ceil(Math.max(...used.map(x => x[1])) / 60) * 60;
      if (hi - lo < 240) hi = lo + 240;
      return [lo, hi];
    }
    const all = slots.length ? slots : [{ start_min: 17 * 60, end_min: 22 * 60 }];
    const bs = [...bookings.map(b => [b.start_min, b.end_min]), ...matchesOf(days || []).filter(m => m.home && matchStart(m) !== null).map(m => [matchStart(m), matchStart(m) + matchLen(m)])];
    const lo = Math.min(...all.map(s => s.start_min), ...bs.map(x => x[0]), 9 * 60), hi = Math.max(...all.map(s => s.end_min), ...bs.map(x => x[1]), 20 * 60);
    return [Math.floor(lo / 60) * 60, Math.ceil(hi / 60) * 60];
  }

  /* ---------- page ---------- */
  async function page(root) {
    if (!Cloud.ready()) return notReady(root);
    const ui = S().ui, today = iso(new Date());
    ui.planWeek = ui.planWeek || monday(today);
    ui.planDay = ui.planDay || today;
    const week = ui.planWeek, days = Array.from({ length: 7 }, (_, i) => addDays(week, i)), wk = ui.planView !== 'day';
    if (!days.includes(ui.planDay)) ui.planDay = days[0];
    root.innerHTML = `${placeTabs('pitch')}<header class="page-head"><div><h1>Planning · ${esc(fieldName())}</h1><p class="sub">Grand terrain ou demi-terrain, sans chevauchement</p></div>
      <div class="head-actions plan-actions"><a class="btn" href="#/encadrement" aria-label="Qui encadre ?">${I.whistle}<span>Qui encadre ?</span></a>${Auth.isAdmin() ? `<button class="btn" data-p="slots" aria-label="Créneaux disponibles">${I.clock}<span>Créneaux disponibles</span></button>` : ''}
      <button class="btn" data-p="bookHome" id="bookHome" hidden aria-label="Réserver les matchs à domicile">${I.match}<span>Réserver les matchs à domicile</span></button>
      <button class="btn" data-p="recur" aria-label="Chaque semaine">${I.rotate}<span>Chaque semaine</span></button>
      <button class="btn primary" data-p="new">${I.plus}<span>Réserver</span></button></div></header>
      <div class="plan-nav"><button class="icon-btn" data-p="prev" aria-label="Semaine précédente">${I.back}</button>
        <b><span class="lg">Semaine du ${esc(parse(week).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }))}</span><span class="sh">${parse(week).getDate()} – ${esc(parse(days[6]).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }))}</span></b>
        <button class="icon-btn" data-p="next" aria-label="Semaine suivante">${I.next}</button><button class="btn soft" data-p="today"><span class="lg">Aujourd'hui</span><span class="sh">Auj.</span></button>
        <span class="plan-view chips"><button class="chip ${wk ? '' : 'on'}" data-p="vday">Jour</button><button class="chip ${wk ? 'on' : ''}" data-p="vweek">Semaine</button></span>
        <span class="grow"></span><span class="plan-legend" id="planLegend"></span></div>
      <label class="day-select ${wk ? 'wk' : ''}"><span>Jour</span><select data-daysel aria-label="Jour">${days.map(d => `<option value="${d}" ${d === ui.planDay ? 'selected' : ''}>${DAYS[parse(d).getDay()]} ${parse(d).getDate()} ${parse(d).toLocaleDateString('fr-FR', { month: 'long' })}</option>`).join('')}</select></label>
      <div class="day-chips ${wk ? 'wk' : ''}">${days.map(d => `<button class="chip ${d === ui.planDay ? 'on' : ''}" data-day="${d}">${DAYS[parse(d).getDay()].slice(0, 3)} ${parse(d).getDate()}</button>`).join('')}</div>
      <div class="plan-wrap ${wk ? 'wk' : ''}" id="planGrid"><p class="muted">Chargement du planning…</p></div>`;
    // the chosen day in the middle of its row, sideways only (scrollIntoView also moved the whole page up: a jump on phones)
    const chipRow = $('.day-chips', root), onChip = $('.day-chips .chip.on', root);
    if (chipRow && onChip) chipRow.scrollLeft = onChip.offsetLeft - (chipRow.clientWidth - onChip.offsetWidth) / 2;
    // Same week already loaded (page redrawn after a sync): the grid is shown at once, then refreshed, so the page keeps its height
    const gen = ++pageGen, cached = loaded === days[0];
    if (cached) { renderGrid(root, days); bind(root); }
    try { await load(days[0], days[6]); }
    catch (e) { if (gen !== pageGen || cached || !$('#planGrid', root)) return; $('#planGrid', root).innerHTML = `<div class="empty"><p>${esc(e.message)}</p><button class="btn" data-p="retry">Réessayer</button></div>`; bind(root); return; }
    if (gen !== pageGen || !$('#planGrid', root)) return; // another page (or week) was opened meanwhile
    renderGrid(root, days);
    bind(root);
  }
  let pageGen = 0;
  function renderGrid(root, days) {
    const [lo, hi] = range(days), ui = S().ui, mine = new Set(myTeams());
    const ms = matchesOf(days), away = d => ms.filter(m => m.date === d && (!m.home || matchStart(m) === null));
    const awayRows = Math.max(0, ...days.map(d => away(d).length));
    if (phone() && ui.planView !== 'day') {
      const top = $('#planGrid', root).getBoundingClientRect().top + window.scrollY, room = innerHeight - top - 175 - awayRows * 24; // day names, away matches, bottom tab bar
      px = Math.max(0.35, Math.min(PX, room / (hi - lo)));
    } else px = PX;
    const H = (hi - lo) * px;
    const hours = []; for (let m = lo; m <= hi; m += 60) hours.push(m);
    const col = d => {
      const free = slotsOf(d), list = bookings.filter(b => b.date === d);
      const ghosts = ms.filter(m => m.date === d && m.home && matchStart(m) !== null && !bookingFor(m));
      return `<div class="plan-day ${d === ui.planDay ? 'sel' : ''} ${d === iso(new Date()) ? 'today' : ''}" data-col="${d}">
        <button class="plan-head" data-openday="${d}">${DAYS[parse(d).getDay()].slice(0, 3)} <b>${parse(d).getDate()}</b></button>
        ${awayRows ? `<div class="plan-away" style="height:${awayRows * 24}px">${away(d).map(m => `<button class="mt-away ${m.home ? 'notime' : ''} ${mine.has(m.teamId) ? 'mine' : ''}" data-mt="${m.id}" style="background:${colorOf({ team_id: m.teamId }) || '#0e1d45'}" title="${esc(teamNameOf(m))} ${m.home ? 'à domicile, heure à préciser' : 'à l\'extérieur'} contre ${esc(m.opponent || '?')}"><i class="ic">${m.home ? '⏱' : '🚌'}</i><b>${esc(shortOf({ team_id: m.teamId, team_name: teamNameOf(m), kind: 'match' }))}</b></button>`).join('')}</div>` : ''}
        <div class="plan-body" style="height:${H}px" data-date="${d}">
          ${hours.map(m => `<i class="hline" style="top:${(m - lo) * px}px"></i>`).join('')}
          ${(slots.length ? free : [{ start_min: lo, end_min: hi }]).map(s => `<div class="avail" style="top:${(s.start_min - lo) * px}px;height:${(s.end_min - s.start_min) * px}px"></div>`).join('')}
          ${list.map(b => { const c = colorOf(b); return `<button class="bk k-${esc(b.kind)} part-${b.part} ${mine.has(b.team_id) ? 'mine' : ''}" data-bk="${b.id}" style="top:${(b.start_min - lo) * px}px;height:${Math.max(phone() ? 16 : 22, (b.end_min - b.start_min) * px - 2)}px${c ? ';background-color:' + c + ';color:#fff' : ''}">
            <b>${esc(b.team_name || KINDS[b.kind][0])}</b><i class="bk-s">${esc(b.part === 'full' ? shortOf(b) : shortOf(b).replace(/^U(?=\d)/, '').replace(/^SEN$/, 'S').replace(/^VÉT$/, 'V'))}</i><span>${b.kind === 'match' ? 'Match · ' : ''}${hm(b.start_min)}–${hm(b.end_min)}${b.part === 'full' ? '' : ' · ½ ' + b.part}</span></button>`; }).join('')}
          ${ghosts.map(m => { const s = matchStart(m), c = colorOf({ team_id: m.teamId }) || '#0e1d45'; return `<button class="bk k-match mt-home part-full ${mine.has(m.teamId) ? 'mine' : ''}" data-mt="${m.id}" style="top:${(s - lo) * px}px;height:${Math.max(phone() ? 16 : 22, matchLen(m) * px - 2)}px;--mc:${c}" title="Match à domicile, terrain pas encore réservé">
            <b>${esc(teamNameOf(m))}</b><i class="bk-s">${esc(shortOf({ team_id: m.teamId, team_name: teamNameOf(m), kind: 'match' }))}</i><span>Match · ${hm(s)} · à réserver</span></button>`; }).join('')}
        </div></div>`;
    };
    $('#planGrid', root).innerHTML = `<div class="plan-grid">
      <div class="plan-hours"><div class="plan-head">&nbsp;</div>${awayRows ? `<div class="plan-away" style="height:${awayRows * 24}px"></div>` : ''}<div style="position:relative;height:${H}px">${hours.map(m => `<span style="top:${(m - lo) * px}px">${hm(m)}</span>`).join('')}</div></div>
      ${days.map(col).join('')}</div>
      ${!slots.length ? '<p class="tip">Aucun créneau défini : le terrain est réservable à toute heure. Le responsable peut fixer les créneaux disponibles.</p>' : ''}`;
    $('#planGrid', root).dataset.lo = lo;
    // Legend: the categories on the pitch this week, then how a match looks
    const cats = [...new Set([...bookings.filter(b => days.includes(b.date)), ...ms.map(m => ({ team_id: m.teamId, team_name: teamNameOf(m) }))].map(catOfBooking).filter(Boolean))].sort((a, b) => Object.keys(CAT_COLORS).indexOf(a) - Object.keys(CAT_COLORS).indexOf(b));
    const lg = $('#planLegend', root);
    if (lg) lg.innerHTML = cats.map(k => `<span><i style="background:${CAT_COLORS[k]}"></i>${esc(catLabel(k))}</span>`).join('') + `<span><i class="lg-match"></i>Match (rayé)</span><span><i class="lg-home"></i>Domicile</span>` + (ms.some(m => m.home && !bookingFor(m)) ? `<span><i class="lg-todo"></i>Match à réserver</span>` : '') + (ms.some(m => !m.home) ? `<span><i class="lg-away"></i>🚌 Extérieur</span>` : '');
    const todo = unbookedHome(days).filter(m => Auth.sees(m.teamId)), bb = $('#bookHome', root);
    if (bb) { bb.hidden = !todo.length; bb.querySelector('span').textContent = `Réserver ${todo.length > 1 ? 'les ' + todo.length + ' matchs' : 'le match'} à domicile`; }
  }
  function bind(root) {
    const ds = $('[data-daysel]', root);
    if (ds) ds.onchange = () => { const ui = S().ui; ui.planDay = ds.value; $$('.day-chips .chip', root).forEach(x => x.classList.toggle('on', x.dataset.day === ui.planDay)); $$('.plan-day', root).forEach(c => c.classList.toggle('sel', c.dataset.col === ui.planDay)); };
    root.onclick = async e => {
      const b = e.target.closest('button');
      const ui = S().ui;
      if (b && b.dataset.p) {
        const p = b.dataset.p;
        if (p === 'prev' || p === 'next') { ui.planWeek = addDays(ui.planWeek, p === 'prev' ? -7 : 7); ui.planDay = ui.planWeek; return page(root); }
        if (p === 'today') { ui.planWeek = monday(iso(new Date())); ui.planDay = iso(new Date()); return page(root); }
        if (p === 'retry') return page(root);
        if (p === 'vday' || p === 'vweek') { ui.planView = p === 'vweek' ? 'week' : 'day'; Store.save(); return page(root); }
        if (p === 'new') return bookForm({ date: ui.planDay, start: 18 * 60 }, () => page(root));
        if (p === 'slots') return slotsForm(() => page(root));
        if (p === 'recur') return recurForm(() => page(root));
        if (p === 'bookHome') {
          const days = Array.from({ length: 7 }, (_, i) => addDays(ui.planWeek, i)), todo = unbookedHome(days).filter(m => Auth.sees(m.teamId));
          if (!todo.length) return;
          const bz = UI.busy('Réservation des matchs…'), ko = [];
          for (const m of todo) { try { await bookMatch(m); } catch (e) { ko.push(`${teamNameOf(m)} (${parse(m.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}) : ${e.message.replace(/ Choisis.*$/, '')}`); } }
          bz.done();
          if (ko.length) UI.modal({ title: 'Matchs non réservés', body: `<ul class="help-list">${ko.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`, actions: [{ label: 'OK', kind: 'primary' }] });
          else toast(`${todo.length} match${todo.length > 1 ? 's' : ''} réservé${todo.length > 1 ? 's' : ''} sur le terrain`);
          return page(root);
        }
      }
      if (b && b.dataset.day) { ui.planDay = b.dataset.day; $$('.day-chips .chip', root).forEach(x => x.classList.toggle('on', x === b)); $$('.plan-day', root).forEach(c => c.classList.toggle('sel', c.dataset.col === ui.planDay)); return; }
      if (b && b.dataset.openday) { ui.planDay = b.dataset.openday; ui.planView = 'day'; Store.save(); return page(root); }
      if (b && b.dataset.mt) return matchDetail(Store.get('matches', b.dataset.mt), () => page(root));
      if (b && b.dataset.bk) return detail(bookings.find(x => x.id === b.dataset.bk), () => page(root));
      const body = e.target.closest('.plan-body');
      if (body) {
        const lo = +$('#planGrid', root).dataset.lo, y = e.clientY - body.getBoundingClientRect().top;
        const start = Math.round((lo + y / px) / 15) * 15;
        bookForm({ date: body.dataset.date, start }, () => page(root));
      }
    };
  }

  /* ---------- booking ---------- */
  function conflicts(date, s, e, part) {
    return bookings.filter(b => b.date === date && b.start_min < e && s < b.end_min && (b.part === 'full' || part === 'full' || (part !== 'half' && b.part === part)));
  }
  function status(date, s, e, part) {
    if (e <= s) return ['bad', 'L\'heure de fin doit être après le début.'];
    const fr = slotsOf(date);
    if (slots.length && !fr.some(x => x.start_min <= s && x.end_min >= e)) return ['bad', fr.length ? `En dehors des créneaux du ${DAYS[parse(date).getDay()].toLowerCase()} : ${fr.map(x => hm(x.start_min) + '–' + hm(x.end_min)).join(', ')}.` : `Pas de créneau disponible le ${DAYS[parse(date).getDay()].toLowerCase()}.`];
    const c = conflicts(date, s, e, part);
    if (part === 'half') {
      const taken = new Set(c.map(b => b.part));
      if (taken.has('full') || (taken.has('A') && taken.has('B'))) return ['bad', 'Les deux moitiés sont déjà prises : ' + c.map(b => `${b.team_name || ''} ${hm(b.start_min)}–${hm(b.end_min)}`).join(', ')];
      return ['ok', `Libre : tu auras le demi-terrain ${taken.has('A') ? 'B' : 'A'}.`];
    }
    return c.length ? ['bad', 'Déjà pris : ' + c.map(b => `${b.team_name || KINDS[b.kind][0]} ${hm(b.start_min)}–${hm(b.end_min)} (${PART[b.part]})`).join(', ')] : ['ok', 'Libre : le grand terrain est à toi.'];
  }
  function timeOptions(sel) { let o = ''; for (let m = 6 * 60; m <= 23 * 60 + 45; m += 15) o += `<option value="${m}" ${m === sel ? 'selected' : ''}>${hm(m)}</option>`; return o; }
  function bookForm(pre, done) {
    const start = pre.start || 18 * 60, mine = myTeams(), teams = S().teams;
    modal({ title: 'Réserver le terrain', body: `
      <label class="fld"><span>Date</span><input type="date" id="bDate" value="${pre.date}"></label>
      <div class="row2"><label class="fld"><span>Début</span><select id="bStart">${timeOptions(start)}</select></label>
      <label class="fld"><span>Fin</span><select id="bEnd">${timeOptions(start + 90)}</select></label></div>
      <div class="lbl">Terrain</div><div class="chips" id="bPart"><button class="chip on" data-v="full">Grand terrain</button><button class="chip" data-v="half">Demi-terrain</button></div>
      <div class="lbl">Pour</div><div class="chips" id="bKind">${Object.entries(KINDS).map(([k, [l]], i) => `<button class="chip ${i ? '' : 'on'}" data-v="${k}">${l}</button>`).join('')}</div>
      <label class="fld" style="margin-top:12px"><span>Catégorie</span><select id="bTeam">${teams.map(t => `<option value="${t.id}" ${t.id === (mine[0] || S().ui.teamId) ? 'selected' : ''}>${esc(Store.teamLabel(t))}</option>`).join('')}<option value="">Autre / sans catégorie</option></select></label>
      <label class="fld"><span>Note (facultatif)</span><input id="bNote" maxlength="80" placeholder="ex : séance vitesse, plateau…"></label>
      <p class="plan-status" id="bStatus"></p>`,
      onOpen: r => {
        const pick = id => $$(`#${id} .chip`, r).forEach(b => b.onclick = () => { $$(`#${id} .chip`, r).forEach(x => x.classList.remove('on')); b.classList.add('on'); check(); });
        const check = async () => {
          const d = $('#bDate', r).value;
          if (d && !bookings.some(b => b.date === d) && (d < loaded || d > addDays(loaded, 6))) { try { bookings = bookings.concat((await Cloud.bookings(d, d)).filter(onPitch)); } catch (e) {} }
          const [k, t] = status(d, +$('#bStart', r).value, +$('#bEnd', r).value, $('#bPart .on', r).dataset.v);
          const el = $('#bStatus', r); el.className = 'plan-status ' + k; el.textContent = (k === 'ok' ? '✓ ' : '✗ ') + t;
        };
        pick('bPart'); pick('bKind');
        ['bDate', 'bStart', 'bEnd'].forEach(id => $('#' + id, r).onchange = () => { if (id === 'bStart' && +$('#bEnd', r).value <= +$('#bStart', r).value) $('#bEnd', r).value = String(Math.min(23 * 60 + 45, +$('#bStart', r).value + 90)); check(); });
        check();
      },
      actions: [{ label: 'Annuler' }, { label: 'Réserver', kind: 'primary', onClick: (close, r) => {
        const u = Auth.current(), team = Store.get('teams', $('#bTeam', r).value);
        const p = { date: $('#bDate', r).value, start_min: +$('#bStart', r).value, end_min: +$('#bEnd', r).value, field: 'T1', part: $('#bPart .on', r).dataset.v,
          kind: $('#bKind .on', r).dataset.v, team_id: team ? team.id : null, team_name: team ? team.name : '', author_id: u.id, author_name: Store.fullName(u), note: $('#bNote', r).value.trim() };
        (async () => {
          const b = UI.busy('Réservation…');
          try { const res = await Cloud.book(p); close(); toast(`Réservé : ${PART[res.part]} le ${parse(res.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })} ${hm(res.start_min)}–${hm(res.end_min)}`); S().ui.planWeek = monday(res.date); S().ui.planDay = res.date; done && done(); }
          catch (e) { toast(e.message, 'err'); }
          finally { b.done(); }
        })();
        return false;
      } }] });
  }
  function detail(b, done) {
    if (!b) return;
    const k = KINDS[b.kind] || KINDS.autre;
    const acts = [];
    if (b.series && canDelete(b)) acts.push({ label: 'Libérer toute la série', kind: 'danger', icon: I.rotate, onClick: () => { setTimeout(async () => { if (!(await confirmBox('Libérer ce créneau et tous les suivants de la série (jusqu\'au 30 juin) ?', 'Libérer la série'))) return; try { const n = await Cloud.unbookSeries(b.series); toast(`${n} créneau${n > 1 ? 'x' : ''} libéré${n > 1 ? 's' : ''}`); done && done(); } catch (e) { toast(e.message, 'err'); } }, 60); } });
    if (canDelete(b)) acts.push({ label: 'Libérer le créneau', kind: 'danger', icon: I.trash, onClick: () => { setTimeout(async () => { if (!(await confirmBox('Libérer ce créneau ?', 'Libérer'))) return; try { await Cloud.unbook(b.id); toast('Créneau libéré'); done && done(); } catch (e) { toast(e.message, 'err'); } }, 60); } });
    if (b.kind === 'entrainement') acts.push({ label: 'Préparer la séance', icon: I.training, onClick: () => { const tr = Store.upsert('trainings', { id: Store.uid(), title: b.note || 'Entraînement', date: b.date, time: hm(b.start_min), teamId: b.team_id || null, goal: '', exercises: [], presents: [] }); location.hash = '#/entrainement/' + tr.id; } });
    const mt = matchFor(b);
    if (mt && Auth.sees(mt.teamId)) acts.push({ label: 'Ouvrir la fiche match', icon: I.match, onClick: () => { location.hash = '#/match/' + mt.id; } });
    else if (b.kind === 'match' && !mt) acts.push({ label: 'Créer la fiche match', icon: I.match, onClick: () => { const m = Store.upsert('matches', { id: Store.uid(), teamId: b.team_id || (S().teams[0] || {}).id, opponent: '', date: b.date, time: hm(b.start_min), home: true, competition: 'Championnat', place: fieldName(), rdv: '', played: false, gf: 0, ga: 0, convoked: [], stats: {}, notes: b.note || '' }); location.hash = '#/match/' + m.id; } });
    acts.push({ label: 'Fermer', kind: 'primary' });
    modal({ title: `${k[0]} · ${b.team_name || 'sans catégorie'}`, noFocus: true, body: `
      <dl class="bk-detail"><div><dt>Quand</dt><dd>${esc(parse(b.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))}, ${hm(b.start_min)}–${hm(b.end_min)}</dd></div>
      <div><dt>Où</dt><dd>${esc(fieldName())} · ${PART[b.part]}</dd></div>
      <div><dt>Réservé par</dt><dd>${esc(b.author_name || '?')}${b.series ? ' · créneau répété chaque semaine' : ''}</dd></div>${b.note ? `<div><dt>Note</dt><dd>${esc(b.note)}</dd></div>` : ''}</dl>`, actions: acts });
  }

  /* ---------- weekly training slot until the end of the season (30 June) ---------- */
  const seasonEnd = () => { const d = new Date(), y = d.getMonth() >= 6 ? d.getFullYear() + 1 : d.getFullYear(); return `${y}-06-30`; };
  function recurForm(done) {
    const mine = myTeams(), teams = S().teams, order = [1, 2, 3, 4, 5, 6, 0];
    modal({ title: 'Entraînement chaque semaine', body: `
      <p class="tip">Réserve le même créneau toutes les semaines jusqu'à la fin de la saison. Les semaines où le terrain est déjà pris sont listées à la fin : rien n'est écrasé.</p>
      <div class="lbl">Jours</div><div class="chips" id="rDays">${order.map(d => `<button class="chip" data-v="${d}">${DAYS[d].slice(0, 3)}</button>`).join('')}</div>
      <div class="row2" style="margin-top:12px"><label class="fld"><span>Début</span><select id="rStart">${timeOptions(18 * 60)}</select></label>
      <label class="fld"><span>Fin</span><select id="rEnd">${timeOptions(19 * 60 + 30)}</select></label></div>
      <div class="lbl">Terrain</div><div class="chips" id="rPart"><button class="chip" data-v="full">Grand terrain</button><button class="chip on" data-v="half">Demi-terrain</button></div>
      <label class="fld" style="margin-top:12px"><span>Catégorie</span><select id="rTeam">${teams.map(t => `<option value="${t.id}" ${t.id === (mine[0] || S().ui.teamId) ? 'selected' : ''}>${esc(Store.teamLabel(t))}</option>`).join('')}</select></label>
      <div class="row2"><label class="fld"><span>À partir du</span><input type="date" id="rFrom" value="${iso(new Date())}"></label>
      <label class="fld"><span>Jusqu'au</span><input type="date" id="rTo" value="${seasonEnd()}"></label></div>`,
      onOpen: r => {
        $$('#rDays .chip', r).forEach(b => b.onclick = () => b.classList.toggle('on'));
        $$('#rPart .chip', r).forEach(b => b.onclick = () => { $$('#rPart .chip', r).forEach(x => x.classList.remove('on')); b.classList.add('on'); });
      },
      actions: [{ label: 'Annuler' }, { label: 'Réserver toute la saison', kind: 'primary', onClick: (close, r) => {
        const days = $$('#rDays .chip.on', r).map(b => +b.dataset.v), s0 = +$('#rStart', r).value, e0 = +$('#rEnd', r).value, from = $('#rFrom', r).value, to = $('#rTo', r).value;
        if (!days.length) { toast('Choisis au moins un jour', 'err'); return false; }
        if (e0 <= s0) { toast('L\'heure de fin doit être après le début', 'err'); return false; }
        if (!from || !to || to < from) { toast('Vérifie les dates', 'err'); return false; }
        const dates = []; for (let d = from; d <= to; d = addDays(d, 1)) if (days.includes(parse(d).getDay())) dates.push(d);
        if (dates.length > 120) { toast('Trop de dates : réduis la période', 'err'); return false; }
        const u = Auth.current(), team = Store.get('teams', $('#rTeam', r).value), part = $('#rPart .on', r).dataset.v, series = Store.uid();
        close();
        (async () => {
          const b = UI.busy(`Réservation de ${dates.length} créneaux…`), ok = [], ko = [];
          for (let i = 0; i < dates.length; i++) {
            b.progress(i / dates.length);
            try { await Cloud.book({ date: dates[i], start_min: s0, end_min: e0, field: 'T1', part, kind: 'entrainement', team_id: team ? team.id : null, team_name: team ? team.name : '', author_id: u.id, author_name: Store.fullName(u), note: '', series }); ok.push(dates[i]); }
            catch (e) { ko.push([dates[i], e.message]); if (/internet|serveur/i.test(e.message)) break; }
          }
          b.done();
          modal({ title: 'Créneaux réservés', noFocus: true, body: `<p class="lead">✓ ${ok.length} créneau${ok.length > 1 ? 'x' : ''} réservé${ok.length > 1 ? 's' : ''} pour ${esc(team ? team.name : '')}, ${hm(s0)}–${hm(e0)}.</p>
            ${ko.length ? `<p><b>${ko.length} date${ko.length > 1 ? 's' : ''} non réservée${ko.length > 1 ? 's' : ''} :</b></p><ul class="help-list">${ko.map(([d, m]) => `<li>${esc(parse(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))} : ${esc(m.replace(/ Choisis.*$/, ''))}</li>`).join('')}</ul>` : ''}`,
            actions: [{ label: 'OK', kind: 'primary' }] });
          done && done();
        })();
      } }] });
  }

  /* ---------- available slots (responsable) ---------- */
  function slotsForm(done) {
    let rows = slots.map(s => ({ weekday: s.weekday, start_min: s.start_min, end_min: s.end_min }));
    const order = [1, 2, 3, 4, 5, 6, 0];
    const render = r => {
      $('#slotRows', r).innerHTML = rows.map((s, i) => `<div class="slot-row" data-i="${i}">
        <select data-f="weekday">${order.map(d => `<option value="${d}" ${d === s.weekday ? 'selected' : ''}>${DAYS[d]}</option>`).join('')}</select>
        <select data-f="start_min">${timeOptions(s.start_min)}</select><span>→</span><select data-f="end_min">${timeOptions(s.end_min)}</select>
        <button class="icon-btn danger" data-del="${i}" aria-label="Supprimer">${I.trash}</button></div>`).join('') || '<p class="muted">Aucun créneau : le terrain est réservable à toute heure.</p>';
    };
    if (!Cloud.adminKey()) return toast('Réservé à un responsable du club', 'err');
    modal({ title: 'Créneaux disponibles', body: `
      <label class="fld"><span>Nom du terrain</span><input id="fName" value="${esc(fieldName())}" maxlength="40"></label>
      <p class="muted small">Les éducateurs ne peuvent réserver qu'à l'intérieur de ces créneaux, chaque semaine.</p>
      <div id="slotRows" class="slot-rows"></div>
      <button class="btn soft" id="addSlot">${I.plus}<span>Ajouter un créneau</span></button>`,
      onOpen: r => {
        render(r);
        $('#addSlot', r).onclick = () => { const last = rows[rows.length - 1]; rows.push({ weekday: last ? (last.weekday + 1) % 7 : 1, start_min: last ? last.start_min : 17 * 60, end_min: last ? last.end_min : 22 * 60 }); render(r); };
        const box = $('#slotRows', r); // (2.01) the list is new at each opening: its handlers do not pile up on the shared #modal
        box.addEventListener('change', e => { const row = e.target.closest('[data-i]'); if (row && e.target.dataset.f) rows[+row.dataset.i][e.target.dataset.f] = +e.target.value; });
        box.addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (b) { rows.splice(+b.dataset.del, 1); render(r); } });
      },
      actions: [{ label: 'Annuler' }, { label: 'Enregistrer', kind: 'primary', onClick: (close, r) => {
        if (rows.some(s => s.end_min <= s.start_min)) { toast('Chaque créneau doit finir après son début', 'err'); return false; }
        S().club.fieldName = $('#fName', r).value.trim() || 'Terrain'; Store.save();
        (async () => { try { await Cloud.setSlots(rows.map(s => Object.assign({ field: 'T1' }, s))); close(); toast('Créneaux enregistrés'); done && done(); } catch (e) { toast(e.message, 'err'); } })();
        return false;
      } }] });
  }

  /* ---------- home card ---------- */
  async function upcoming(el) {
    if (!el) return;
    if (!Cloud.ready()) { el.innerHTML = '<p class="muted">Le planning partagé n\'est pas encore connecté.</p>'; return; }
    const today = iso(new Date());
    try {
      const list = (await Cloud.bookings(today, addDays(today, 7))).filter(b => onPitch(b) && (!myTeams().length || myTeams().includes(b.team_id))).slice(0, 4);
      el.innerHTML = list.length ? `<ul class="res-list plan-mini">${list.map(b => `<li><a href="#/planning"><span class="d">${esc(parse(b.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }))}</span><span class="o">${esc(b.team_name || '')} · ${KINDS[b.kind][0]}</span><span class="s">${hm(b.start_min)}</span></a></li>`).join('')}</ul>`
        : '<p class="muted">Rien de réservé pour tes catégories cette semaine.</p>';
    } catch (e) { el.innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
  }

  // Pitch or locker rooms: the two plannings share the same look
  const placeTabs = cur => `<div class="seg place-tabs"><a class="seg-b ${cur === 'pitch' ? 'on' : ''}" href="#/planning">⚽ Terrain</a><a class="seg-b ${cur === 'rooms' ? 'on' : ''}" href="#/vestiaires">🚪 Vestiaires</a></div>`;
  // Colour of a category (results page, legend…)
  const teamColor = teamId => colorOf({ team_id: teamId }) || '#0e1d45';
  return { page, upcoming, teamColor, colorOf, placeTabs };
})();
