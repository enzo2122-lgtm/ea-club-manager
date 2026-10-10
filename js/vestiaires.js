/* Rooms: the locker rooms' timetable (same bookings as the pitch planning, one « field » per room).
   A room is given to one of our teams (training, match) or to the visiting team of a home match (kind « adversaire »).
   The club server refuses two bookings of the same room at the same time. */
const Rooms = (() => {
  const { esc, $, $$, toast, modal, confirmBox } = UI;
  const S = () => Store.state;
  const ROOMS = [['V1', 'Vestiaire 1'], ['V2', 'Vestiaire 2'], ['VK1', 'Vestiaire Karaté 1'], ['VK2', 'Vestiaire Karaté 2']];
  const ROOM_IDS = ROOMS.map(r => r[0]);
  const roomName = id => (ROOMS.find(r => r[0] === id) || [id, id])[1];
  const KINDS = { entrainement: ['Entraînement', '🏃'], match: ['Match', '⚽'], adversaire: ['Adversaire', '🆚'], autre: ['Autre', '📌'] };
  const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const PX = 0.9;
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const monday = s => { const d = parse(s), wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return iso(d); };
  const hm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const toMin = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };
  const timeOptions = sel => { let o = ''; for (let m = 6 * 60; m <= 23 * 60 + 45; m += 15) o += `<option value="${m}" ${m === sel ? 'selected' : ''}>${hm(m)}</option>`; return o; };
  const myTeams = () => { const u = Auth.current(); return u ? (u.teamIds || []) : []; };
  const canDelete = b => Auth.isAdmin() || (Auth.current() && b.author_id === Auth.current().id);
  const teamName = id => (Store.get('teams', id) || {}).name || '';
  // how long a home match keeps its rooms: from the meeting time (or 1 h before) until 45 min after the end
  const matchLen = m => { const f = (Store.get('teams', m.teamId) || {}).format; return f === '5' ? 60 : f === '8' ? 90 : 120; };
  function matchWindow(m) {
    if (!/^\d{1,2}:\d{2}/.test(m.time || '')) return null;
    const k = toMin(m.time), s = /^\d{1,2}:\d{2}/.test(m.rdv || '') ? Math.min(toMin(m.rdv), k - 30) : k - 60;
    return [Math.max(6 * 60, Math.round(s / 15) * 15), Math.min(23 * 60 + 45, Math.round((k + matchLen(m) + 45) / 15) * 15)];
  }
  const homeMatchesOn = d => S().matches.filter(m => m.date === d && m.home && !m.exempt && !m.played).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  let bookings = [], loaded = '', gen = 0;
  async function load(from, to) { bookings = (await Cloud.bookings(from, to)).filter(b => ROOM_IDS.includes(b.field)); loaded = from; }
  const onRoom = (room, d) => bookings.filter(b => b.field === room && b.date === d);
  const onDay = d => bookings.filter(b => b.date === d).sort((a, b) => a.start_min - b.start_min); // (3.19)
  const conflicts = (room, d, s, e, except) => bookings.filter(b => b.field === room && b.date === d && b.start_min < e && s < b.end_min && b.id !== except);
  const label = b => b.kind === 'adversaire' ? `${b.team_name || 'Adversaire'}` : (b.team_name || KINDS[b.kind || 'autre'][0]);
  // the rooms already given for a match (ours and the visitors')
  const forMatch = m => bookings.filter(b => b.date === m.date && (b.note || '').includes('#m:' + m.id));

  /* ---------- page ---------- */
  async function page(root) {
    if (!Cloud.ready()) { root.innerHTML = `${Planning.placeTabs('rooms')}<div class="empty"><p>Le planning des vestiaires passe par le serveur du club, pas encore connecté sur cet appareil.</p></div>`; return; }
    const ui = S().ui, today = iso(new Date());
    // (3.14) opened from another page: today's week (unless a match asked for its own day)
    if (!root.querySelector('[data-pg="rooms"]')) { if (ui.roomPin) ui.roomPin = 0; else ui.roomDay = today; }
    ui.roomDay = ui.roomDay || today;
    const day = ui.roomDay, week = monday(day), days = Array.from({ length: 7 }, (_, i) => addDays(week, i)), wk = ui.roomView !== 'day';
    const my = gen = gen + 1;
    const wkLabel = `Semaine du ${parse(week).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
    root.innerHTML = `${Planning.placeTabs('rooms')}
      <header class="page-head" data-pg="rooms"><div><h1>Vestiaires</h1><p class="sub">Qui est dans quel vestiaire, sans chevauchement</p></div>
      <div class="head-actions plan-actions"><button class="btn" data-r="recur">${I.rotate}<span>Chaque semaine</span></button><button class="btn primary" data-r="new">${I.plus}<span>Attribuer</span></button></div></header>
      <div class="chips view-tog"><button class="chip ${wk ? '' : 'on'}" data-r="vday">Jour</button><button class="chip ${wk ? 'on' : ''}" data-r="vweek">Semaine</button></div>
      <div class="plan-nav"><button class="icon-btn" data-r="prev" aria-label="${wk ? 'Semaine précédente' : 'Jour précédent'}">${I.back}</button>
        <b>${esc(wk ? wkLabel : parse(day).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))}</b>
        <button class="icon-btn" data-r="next" aria-label="${wk ? 'Semaine suivante' : 'Jour suivant'}">${I.next}</button><button class="btn soft" data-r="today">Aujourd'hui</button></div>
      ${wk ? '' : `<div class="day-chips">${days.map(d => `<button class="chip ${d === day ? 'on' : ''} ${d === today ? 'today' : ''}" data-rday="${d}">${DAYS[parse(d).getDay()].slice(0, 3)} ${parse(d).getDate()}</button>`).join('')}</div>`}
      <div id="roomMatches"></div>
      <div class="plan-wrap ${wk ? 'wk' : ''}" id="roomGrid"><p class="muted">Chargement…</p></div>`;
    const cr = $('.day-chips', root), on = $('.day-chips .chip.on', root); if (cr && on) cr.scrollLeft = on.offsetLeft - (cr.clientWidth - on.offsetWidth) / 2;
    const cached = loaded === week;
    const show = () => wk ? drawWeek(root, days) : draw(root, day);
    if (cached) show();
    try { await load(week, addDays(week, 6)); } catch (e) { if (my === gen && !cached && $('#roomGrid', root)) $('#roomGrid', root).innerHTML = `<div class="empty"><p>${esc(e.message)}</p></div>`; return; }
    if (my !== gen || !$('#roomGrid', root)) return;
    show();
  }
  // (3.19) the week like the pitch's: a column per day, the hours down the side, each room in its lane (V1, V2, VK1, VK2 side by side)
  function drawWeek(root, days) {
    const today = iso(new Date()), mine = new Set(myTeams()), list = bookings.filter(b => days.includes(b.date));
    let lo = Math.min(9 * 60, ...list.map(b => b.start_min)), hi = Math.max(21 * 60, ...list.map(b => b.end_min));
    lo = Math.floor(lo / 60) * 60; hi = Math.ceil(hi / 60) * 60;
    const phone = matchMedia('(max-width: 760px)').matches, top = $('#roomGrid', root).getBoundingClientRect().top + window.scrollY;
    const px = phone ? Math.max(0.35, Math.min(PX, (innerHeight - top - 150) / (hi - lo))) : PX, H = (hi - lo) * px, hours = []; for (let m = lo; m <= hi; m += 60) hours.push(m);
    const lane = id => Math.max(0, ROOM_IDS.indexOf(id)), W = 100 / ROOM_IDS.length, short = id => id.replace(/^V/, '').replace(/^K/, 'K');
    const col = d => {
      const need = homeMatchesOn(d).filter(m => { const g = forMatch(m); return !(g.some(b => b.kind === 'match') && g.some(b => b.kind === 'adversaire')); }).length;
      return `<div class="plan-day ${d === today ? 'today' : ''}" data-col="${d}">
        <button class="plan-head" data-rday="${d}" data-open="1">${DAYS[parse(d).getDay()].slice(0, 3)} <b>${parse(d).getDate()}</b>${need ? ' <i class="rw-need" title="Match à domicile sans vestiaire">!</i>' : ''}</button>
        <div class="plan-body" style="height:${H}px" data-date="${d}">
          ${hours.map(m => `<i class="hline" style="top:${(m - lo) * px}px"></i>`).join('')}
          ${onDay(d).map(b => { const c = b.kind === 'adversaire' ? '#475569' : Planning.colorOf(b), l = lane(b.field);
            return `<button class="bk k-${esc(b.kind || 'autre')} ${mine.has(b.team_id) ? 'mine' : ''}" data-rbk="${b.id}" title="${esc(roomName(b.field) + ' · ' + label(b) + ' · ' + hm(b.start_min) + '–' + hm(b.end_min))}"
              style="top:${(b.start_min - lo) * px}px;height:${Math.max(phone ? 16 : 22, (b.end_min - b.start_min) * px - 2)}px;left:calc(${l * W}% + 1px);right:auto;width:calc(${W}% - 2px);padding:2px 3px${c ? ';background-color:' + c + ';color:#fff' : ''}">
              <b>${esc(short(b.field))} · ${esc(label(b))}</b><i class="bk-s">${esc(short(b.field))}</i></button>`; }).join('')}
        </div></div>`;
    };
    $('#roomMatches', root).innerHTML = '';
    $('#roomGrid', root).innerHTML = `<div class="plan-grid room-week-grid">
      <div class="plan-hours"><div class="plan-head">&nbsp;</div><div style="position:relative;height:${H}px">${hours.map(m => `<span style="top:${(m - lo) * px}px">${hm(m)}</span>`).join('')}</div></div>
      ${days.map(col).join('')}</div>
      <p class="muted small">Chaque jour, 4 couloirs : ${ROOMS.map(([id, n]) => `<b>${esc(short(id))}</b> ${esc(n.replace('Vestiaire ', 'Vest. '))}`).join(' · ')}. 🆚 = équipe adverse. Touche un jour pour l'ouvrir et attribuer.</p>`;
    bind(root, days[0]);
  }

  function draw(root, day) {
    // the day's home matches: their rooms, or a button to give them
    const ms = homeMatchesOn(day);
    $('#roomMatches', root).innerHTML = ms.length ? `<section class="card room-matches"><h2>${I.match}Matchs à domicile ce jour</h2>${ms.map(m => { const got = forMatch(m), us = got.find(b => b.kind === 'match'), them = got.find(b => b.kind === 'adversaire');
      return `<div class="rm-row"><span><b>${esc(teamName(m.teamId))}</b> contre ${esc(m.opponent || '?')}${m.time ? ' · ' + esc(m.time.replace(':', 'h')) : ' · heure à préciser'}<br>
        <span class="muted small">${us ? '🏠 ' + esc(roomName(us.field)) : '🏠 pas de vestiaire'} · ${them ? '🆚 ' + esc(roomName(them.field)) : '🆚 pas de vestiaire'}</span></span>
        ${us && them ? '<span class="rm-ok">✓</span>' : `<button class="btn soft" data-rmatch="${m.id}" ${matchWindow(m) ? '' : 'disabled'}>${I.plus}<span>Attribuer</span></button>`}</div>`; }).join('')}
      ${ms.some(m => { const g = forMatch(m); return !(g.some(b => b.kind === 'match') && g.some(b => b.kind === 'adversaire')) && matchWindow(m); }) ? `<button class="btn primary" data-r="allmatches">${I.check}<span>Attribuer les vestiaires de tous les matchs du jour</span></button>` : ''}</section>` : '';
    // one column per room
    const list = bookings.filter(b => b.date === day), mine = new Set(myTeams());
    let lo = Math.min(9 * 60, ...list.map(b => b.start_min)), hi = Math.max(21 * 60, ...list.map(b => b.end_min));
    lo = Math.floor(lo / 60) * 60; hi = Math.ceil(hi / 60) * 60;
    const H = (hi - lo) * PX, hours = []; for (let m = lo; m <= hi; m += 60) hours.push(m);
    $('#roomGrid', root).innerHTML = `<div class="room-grid">
      <div class="plan-hours"><div class="plan-head">&nbsp;</div><div style="position:relative;height:${H}px">${hours.map(m => `<span style="top:${(m - lo) * PX}px">${hm(m)}</span>`).join('')}</div></div>
      ${ROOMS.map(([id, name]) => `<div class="room-col"><div class="plan-head room-head" title="${esc(name)}">${esc(name.replace('Vestiaire ', 'Vest. '))}</div>
        <div class="plan-body room-body" style="height:${H}px" data-room="${id}" data-lo="${lo}">
          ${hours.map(m => `<i class="hline" style="top:${(m - lo) * PX}px"></i>`).join('')}
          ${onRoom(id, day).map(b => { const c = b.kind === 'adversaire' ? '#475569' : Planning.colorOf(b); return `<button class="bk k-${esc(b.kind || 'autre')} ${mine.has(b.team_id) ? 'mine' : ''}" data-rbk="${b.id}" style="top:${(b.start_min - lo) * PX}px;height:${Math.max(24, (b.end_min - b.start_min) * PX - 2)}px${c ? ';background-color:' + c + ';color:#fff' : ''}">
            <b>${KINDS[b.kind || 'autre'] ? KINDS[b.kind || 'autre'][1] + ' ' : ''}${esc(label(b))}</b><span>${hm(b.start_min)}–${hm(b.end_min)}${b.kind === 'adversaire' && b.team_name ? '' : ''}</span></button>`; }).join('')}
        </div></div>`).join('')}</div>
      <p class="muted small">Touche une case vide pour attribuer un vestiaire. 🆚 = équipe adverse. Couleur = catégorie.</p>`;
    bind(root, day);
  }
  function bind(root, day) {
    root.onclick = async e => {
      const b = e.target.closest('button'), ui = S().ui;
      if (b && b.dataset.r) {
        const r = b.dataset.r;
        if (r === 'prev' || r === 'next') { ui.roomDay = addDays(ui.roomDay || day, (r === 'prev' ? -1 : 1) * (ui.roomView !== 'day' ? 7 : 1)); return page(root); }
        if (r === 'today') { ui.roomDay = iso(new Date()); return page(root); }
        if (r === 'vday' || r === 'vweek') { ui.roomView = r === 'vweek' ? 'week' : 'day'; Store.save(); return page(root); }
        if (r === 'new') return form({ date: day, start: 18 * 60 }, () => page(root));
        if (r === 'recur') return recurForm(() => page(root));
        if (r === 'allmatches') return assignAll(homeMatchesOn(day).filter(m => matchWindow(m)), () => page(root));
      }
      if (b && b.dataset.rday) { ui.roomDay = b.dataset.rday; if (b.dataset.open) { ui.roomView = 'day'; Store.save(); } return page(root); }
      if (b && b.dataset.rmatch) return matchForm(Store.get('matches', b.dataset.rmatch), () => page(root));
      if (b && b.dataset.rbk) return detail(bookings.find(x => x.id === b.dataset.rbk), () => page(root));
      const body = e.target.closest('.room-body');
      if (body) {
        const y = e.clientY - body.getBoundingClientRect().top, start = Math.round((+body.dataset.lo + y / PX) / 15) * 15;
        form({ date: day, start, room: body.dataset.room }, () => page(root));
      }
    };
  }

  /* ---------- give a room ---------- */
  async function book(p) {
    const u = Auth.current();
    return Cloud.book(Object.assign({ part: 'full', author_id: u.id, author_name: Store.fullName(u), series: null }, p));
  }
  async function ensureDay(d) { if (d && !bookings.some(b => b.date === d) && (d < loaded || d > addDays(loaded, 6))) { try { bookings = bookings.concat((await Cloud.bookings(d, d)).filter(b => ROOM_IDS.includes(b.field))); } catch (e) {} } }
  function form(pre, done) {
    const mine = myTeams();
    modal({ title: 'Attribuer un vestiaire', body: `
      <label class="fld"><span>Vestiaire</span><select id="vRoom">${ROOMS.map(([id, n]) => `<option value="${id}" ${id === (pre.room || 'V1') ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <label class="fld"><span>Date</span><input type="date" id="vDate" value="${pre.date}"></label>
      <div class="row2"><label class="fld"><span>De</span><select id="vStart">${timeOptions(pre.start)}</select></label><label class="fld"><span>À</span><select id="vEnd">${timeOptions(Math.min(23 * 60 + 45, pre.start + 120))}</select></label></div>
      <div class="lbl">Pour</div><div class="chips" id="vKind">${Object.entries(KINDS).map(([k, [l, ic]], i) => `<button class="chip ${i ? '' : 'on'}" data-v="${k}">${ic} ${l}</button>`).join('')}</div>
      <label class="fld" style="margin-top:12px"><span>Notre catégorie</span><select id="vTeam">${S().teams.map(t => `<option value="${t.id}" ${t.id === (mine[0] || S().ui.teamId) ? 'selected' : ''}>${esc(Store.teamLabel(t))}</option>`).join('')}<option value="">Autre / sans catégorie</option></select></label>
      <label class="fld" id="vOppBox" hidden><span>Équipe adverse</span><input id="vOpp" maxlength="50" placeholder="ex : AS Bondy" list="vOppList"><datalist id="vOppList">${homeMatchesOn(pre.date).map(m => `<option value="${esc(m.opponent || '')}">`).join('')}</datalist></label>
      <label class="fld"><span>Note (facultatif)</span><input id="vNote" maxlength="60" placeholder="ex : arbitre, clés au club-house"></label>
      <p class="plan-status" id="vStatus"></p>`,
      onOpen: r => {
        const check = async () => {
          const d = $('#vDate', r).value; await ensureDay(d);
          const s = +$('#vStart', r).value, e = +$('#vEnd', r).value, c = conflicts($('#vRoom', r).value, d, s, e);
          const el = $('#vStatus', r);
          el.className = 'plan-status ' + (e <= s || c.length ? 'bad' : 'ok');
          el.textContent = e <= s ? '✗ L\'heure de fin doit être après le début.' : c.length ? '✗ Déjà pris : ' + c.map(b => `${label(b)} ${hm(b.start_min)}–${hm(b.end_min)}`).join(', ') : '✓ Libre';
        };
        $$('#vKind .chip', r).forEach(b => b.onclick = () => { $$('#vKind .chip', r).forEach(x => x.classList.remove('on')); b.classList.add('on'); $('#vOppBox', r).hidden = b.dataset.v !== 'adversaire'; });
        ['vRoom', 'vDate', 'vStart', 'vEnd'].forEach(id => $('#' + id, r).onchange = () => { if (id === 'vStart' && +$('#vEnd', r).value <= +$('#vStart', r).value) $('#vEnd', r).value = String(Math.min(23 * 60 + 45, +$('#vStart', r).value + 120)); check(); });
        check();
      },
      actions: [{ label: 'Annuler' }, { label: 'Attribuer', kind: 'primary', onClick: (close, r) => {
        const kind = $('#vKind .on', r).dataset.v, team = Store.get('teams', $('#vTeam', r).value), opp = $('#vOpp', r).value.trim();
        if (kind === 'adversaire' && !opp) { toast('Écris le nom de l\'équipe adverse', 'err'); return false; }
        // the visitors' room of a home match of that day is tied to the match
        const m = kind === 'adversaire' || kind === 'match' ? homeMatchesOn($('#vDate', r).value).find(x => x.teamId === (team && team.id) && (kind !== 'adversaire' || !opp || String(x.opponent || '').toLowerCase() === opp.toLowerCase())) : null;
        const p = { date: $('#vDate', r).value, start_min: +$('#vStart', r).value, end_min: +$('#vEnd', r).value, field: $('#vRoom', r).value, kind,
          team_id: team ? team.id : null, team_name: kind === 'adversaire' ? opp + ' (adversaire)' : (team ? team.name : ''), note: [$('#vNote', r).value.trim(), m ? '#m:' + m.id : ''].filter(Boolean).join(' ') };
        (async () => { const bz = UI.busy('Attribution…'); try { const res = await book(p); close(); toast(`${roomName(res.field)} : ${label(res)} ${hm(res.start_min)}–${hm(res.end_min)}`); S().ui.roomDay = res.date; done && done(); } catch (e) { toast(e.message.replace('sur cette partie du terrain', 'dans ce vestiaire'), 'err'); } finally { bz.done(); } })();
        return false;
      } }] });
  }
  // A home match: one room for our team, one for the visitors, during the match window
  const freeRoom = (d, s, e, taken = []) => ROOM_IDS.find(id => !taken.includes(id) && !conflicts(id, d, s, e).length);
  function matchForm(m, done) {
    const w = matchWindow(m); if (!w) return toast('Indique d\'abord l\'heure du match (fiche match)', 'err');
    const got = forMatch(m), us = got.find(b => b.kind === 'match'), them = got.find(b => b.kind === 'adversaire');
    const sugUs = us ? us.field : freeRoom(m.date, w[0], w[1]), sugThem = them ? them.field : freeRoom(m.date, w[0], w[1], [sugUs]);
    const sel = (id, cur, lock) => `<select id="${id}" ${lock ? 'disabled' : ''}>${ROOMS.map(([r, n]) => `<option value="${r}" ${r === cur ? 'selected' : ''}>${esc(n)}${!lock && conflicts(r, m.date, w[0], w[1]).length ? ' (occupé)' : ''}</option>`).join('')}</select>`;
    modal({ title: `Vestiaires · ${teamName(m.teamId)} contre ${m.opponent || '?'}`, body: `
      <p class="muted small">${esc(parse(m.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))} · coup d'envoi ${esc(m.time)}. Vestiaires réservés de ${hm(w[0])} à ${hm(w[1])} (rendez-vous, match, douches).</p>
      <label class="fld"><span>🏠 ${esc(teamName(m.teamId))} (nous)</span>${sel('mUs', sugUs, !!us)}</label>
      <label class="fld"><span>🆚 ${esc(m.opponent || 'Adversaire')}</span>${sel('mThem', sugThem, !!them)}</label>
      ${!sugUs || !sugThem ? '<p class="tip">⚠️ Pas assez de vestiaires libres sur ce créneau : choisis-les à la main ou libère un vestiaire.</p>' : ''}`,
      actions: [{ label: 'Annuler' }, { label: 'Attribuer', kind: 'primary', onClick: (close, r) => {
        const a = $('#mUs', r).value, b = $('#mThem', r).value;
        if (a === b) { toast('Choisis deux vestiaires différents', 'err'); return false; }
        (async () => {
          const bz = UI.busy('Attribution…'), ko = [];
          if (!us) { try { await book({ date: m.date, start_min: w[0], end_min: w[1], field: a, kind: 'match', team_id: m.teamId, team_name: teamName(m.teamId), note: 'contre ' + (m.opponent || '?') + ' #m:' + m.id }); } catch (e) { ko.push(roomName(a) + ' : ' + e.message); } }
          if (!them) { try { await book({ date: m.date, start_min: w[0], end_min: w[1], field: b, kind: 'adversaire', team_id: m.teamId, team_name: (m.opponent || 'Adversaire') + ' (adversaire)', note: 'match ' + teamName(m.teamId) + ' #m:' + m.id }); } catch (e) { ko.push(roomName(b) + ' : ' + e.message); } }
          bz.done(); close();
          ko.length ? toast(ko.join(' · ').replace(/sur cette partie du terrain/g, 'dans ce vestiaire'), 'err') : toast(`🏠 ${roomName(a)} · 🆚 ${roomName(b)}`);
          done && done();
        })();
        return false;
      } }] });
  }
  async function assignAll(ms, done) {
    const bz = UI.busy('Attribution des vestiaires…'), ok = [], ko = [];
    for (const m of ms) {
      const w = matchWindow(m), got = forMatch(m);
      try {
        let a = (got.find(b => b.kind === 'match') || {}).field;
        if (!a) { a = freeRoom(m.date, w[0], w[1]); if (!a) throw new Error('plus de vestiaire libre'); bookings.push(await book({ date: m.date, start_min: w[0], end_min: w[1], field: a, kind: 'match', team_id: m.teamId, team_name: teamName(m.teamId), note: 'contre ' + (m.opponent || '?') + ' #m:' + m.id })); }
        if (!got.some(b => b.kind === 'adversaire')) { const b = freeRoom(m.date, w[0], w[1], [a]); if (!b) throw new Error('plus de vestiaire libre pour l\'adversaire'); bookings.push(await book({ date: m.date, start_min: w[0], end_min: w[1], field: b, kind: 'adversaire', team_id: m.teamId, team_name: (m.opponent || 'Adversaire') + ' (adversaire)', note: 'match ' + teamName(m.teamId) + ' #m:' + m.id })); }
        ok.push(m);
      } catch (e) { ko.push(`${teamName(m.teamId)} contre ${m.opponent || '?'} : ${e.message}`); }
    }
    bz.done();
    if (ko.length) modal({ title: 'Vestiaires non attribués', body: `<ul class="help-list">${ko.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`, actions: [{ label: 'OK', kind: 'primary' }] });
    else toast(`Vestiaires attribués pour ${ok.length} match${ok.length > 1 ? 's' : ''}`);
    done && done();
  }
  function detail(b, done) {
    if (!b) return;
    const m = ((b.note || '').match(/#m:([\w-]+)/) || [])[1], match = m && Store.get('matches', m);
    const acts = [];
    if (b.series && canDelete(b)) acts.push({ label: 'Libérer toute la série', kind: 'danger', icon: I.rotate, onClick: () => { setTimeout(async () => { if (!(await confirmBox('Libérer ce vestiaire et toutes les semaines suivantes de la série ?', 'Libérer la série'))) return; try { const n = await Cloud.unbookSeries(b.series); toast(`${n} créneau${n > 1 ? 'x' : ''} libéré${n > 1 ? 's' : ''}`); done && done(); } catch (e) { toast(e.message, 'err'); } }, 60); } });
    if (canDelete(b)) acts.push({ label: 'Libérer', kind: 'danger', icon: I.trash, onClick: () => { setTimeout(async () => { if (!(await confirmBox(`Libérer ${roomName(b.field)} ?`, 'Libérer'))) return; try { await Cloud.unbook(b.id); toast('Vestiaire libéré'); done && done(); } catch (e) { toast(e.message, 'err'); } }, 60); } });
    if (match && Auth.sees(match.teamId)) acts.push({ label: 'Ouvrir la fiche match', icon: I.match, onClick: () => { location.hash = '#/match/' + match.id; } });
    acts.push({ label: 'Fermer', kind: 'primary' });
    modal({ title: `${roomName(b.field)} · ${label(b)}`, noFocus: true, body: `
      <dl class="bk-detail"><div><dt>Quand</dt><dd>${esc(parse(b.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))}, ${hm(b.start_min)}–${hm(b.end_min)}</dd></div>
      <div><dt>Pour</dt><dd>${KINDS[b.kind || 'autre'] ? KINDS[b.kind || 'autre'][1] + ' ' + KINDS[b.kind || 'autre'][0] : ''}${b.kind === 'adversaire' && b.team_id ? ' · match des ' + esc(teamName(b.team_id)) : ''}</dd></div>
      <div><dt>Attribué par</dt><dd>${esc(b.author_name || '?')}${b.series ? ' · chaque semaine' : ''}</dd></div>
      ${(b.note || '').replace(/#m:[\w-]+/, '').trim() ? `<div><dt>Note</dt><dd>${esc((b.note || '').replace(/#m:[\w-]+/, '').trim())}</dd></div>` : ''}</dl>`, actions: acts });
  }

  /* ---------- training: the same room every week ---------- */
  const seasonEnd = () => { const d = new Date(), y = d.getMonth() >= 6 ? d.getFullYear() + 1 : d.getFullYear(); return `${y}-06-30`; };
  function recurForm(done) {
    const mine = myTeams(), order = [1, 2, 3, 4, 5, 6, 0];
    modal({ title: 'Vestiaire chaque semaine', body: `
      <p class="tip">Le même vestiaire, toutes les semaines jusqu'à la fin de la saison, pour les entraînements d'une catégorie. Les semaines où il est déjà pris sont listées à la fin.</p>
      <label class="fld"><span>Vestiaire</span><select id="wRoom">${ROOMS.map(([id, n]) => `<option value="${id}">${esc(n)}</option>`).join('')}</select></label>
      <div class="lbl">Jours</div><div class="chips" id="wDays">${order.map(d => `<button class="chip" data-v="${d}">${DAYS[d].slice(0, 3)}</button>`).join('')}</div>
      <div class="row2" style="margin-top:12px"><label class="fld"><span>De</span><select id="wStart">${timeOptions(17 * 60 + 45)}</select></label><label class="fld"><span>À</span><select id="wEnd">${timeOptions(20 * 60)}</select></label></div>
      <label class="fld"><span>Catégorie</span><select id="wTeam">${S().teams.map(t => `<option value="${t.id}" ${t.id === (mine[0] || S().ui.teamId) ? 'selected' : ''}>${esc(Store.teamLabel(t))}</option>`).join('')}</select></label>
      <div class="row2"><label class="fld"><span>À partir du</span><input type="date" id="wFrom" value="${iso(new Date())}"></label><label class="fld"><span>Jusqu'au</span><input type="date" id="wTo" value="${seasonEnd()}"></label></div>`,
      onOpen: r => $$('#wDays .chip', r).forEach(b => b.onclick = () => b.classList.toggle('on')),
      actions: [{ label: 'Annuler' }, { label: 'Attribuer toute la saison', kind: 'primary', onClick: (close, r) => {
        const days = $$('#wDays .chip.on', r).map(b => +b.dataset.v), s0 = +$('#wStart', r).value, e0 = +$('#wEnd', r).value, from = $('#wFrom', r).value, to = $('#wTo', r).value;
        if (!days.length) { toast('Choisis au moins un jour', 'err'); return false; }
        if (e0 <= s0) { toast('L\'heure de fin doit être après le début', 'err'); return false; }
        if (!from || !to || to < from) { toast('Vérifie les dates', 'err'); return false; }
        const dates = []; for (let d = from; d <= to; d = addDays(d, 1)) if (days.includes(parse(d).getDay())) dates.push(d);
        if (dates.length > 120) { toast('Trop de dates : réduis la période', 'err'); return false; }
        const team = Store.get('teams', $('#wTeam', r).value), room = $('#wRoom', r).value, series = Store.uid();
        close();
        (async () => {
          const bz = UI.busy(`Attribution de ${dates.length} créneaux…`), ok = [], ko = [];
          for (let i = 0; i < dates.length; i++) {
            bz.progress(i / dates.length);
            try { await book({ date: dates[i], start_min: s0, end_min: e0, field: room, kind: 'entrainement', team_id: team ? team.id : null, team_name: team ? team.name : '', note: '', series }); ok.push(dates[i]); }
            catch (e) { ko.push([dates[i], e.message]); if (/internet|serveur/i.test(e.message)) break; }
          }
          bz.done();
          modal({ title: 'Vestiaire attribué', noFocus: true, body: `<p class="lead">✓ ${roomName(room)} : ${ok.length} séance${ok.length > 1 ? 's' : ''} pour ${esc(team ? team.name : '')}, ${hm(s0)}–${hm(e0)}.</p>
            ${ko.length ? `<p><b>${ko.length} date${ko.length > 1 ? 's' : ''} non attribuée${ko.length > 1 ? 's' : ''} :</b></p><ul class="help-list">${ko.map(([d, m]) => `<li>${esc(parse(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))} : ${esc(m.replace(/sur cette partie du terrain\.?.*$/, 'vestiaire déjà pris'))}</li>`).join('')}</ul>` : ''}`,
            actions: [{ label: 'OK', kind: 'primary' }] });
          done && done();
        })();
      } }] });
  }

  /* ---------- on the match page: the rooms of this home match ---------- */
  async function matchBox(el, m) {
    if (!el || !Cloud.ready() || !m.home || m.exempt) return;
    try { await load(monday(m.date), addDays(monday(m.date), 6)); } catch (e) { return; }
    if (!el.isConnected) return;
    const got = forMatch(m), us = got.find(b => b.kind === 'match'), them = got.find(b => b.kind === 'adversaire');
    el.innerHTML = `<p class="rooms-line">🚪 <b>Vestiaires</b> · 🏠 ${us ? esc(roomName(us.field)) : 'à attribuer'} · 🆚 ${them ? esc(roomName(them.field)) : 'à attribuer'}
      ${us && them ? '' : `<button class="linkish" data-roomfor="${m.id}">attribuer</button>`} <a class="linkish" href="#/vestiaires" data-roomday="${m.date}">planning des vestiaires</a></p>`;
    el.onclick = e => {
      const a = e.target.closest('[data-roomday]'); if (a) { S().ui.roomDay = a.dataset.roomday; S().ui.roomPin = 1; S().ui.roomView = 'day'; }
      const b = e.target.closest('[data-roomfor]'); if (b) matchForm(m, () => matchBox(el, m));
    };
  }

  return { page, matchBox, ROOMS, roomName };
})();
