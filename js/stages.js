/* Stages: the club's holiday camps (Toussaint, Noël, hiver, printemps, été) for the children.
   A camp: its weeks, its hours, its price per week, the places per week, the categories it is open to, the contact, the programme of a day.
   The families register their child week by week from their space (club server, supabase/stages.sql); a coach can register a child too.
   A responsable validates the registration once the payment is received (camp.paidIds = ['<child>:<week>', …]); the family sees it.
   A registration is kept on the child's own card (player.stageIds = ['<camp>:<week>', …]: merged like any list of ids by the sync),
   a child from outside the club in the camp (camp.guests). The camps themselves live with the club settings (club.stages). */
const Stages = (() => {
  const { esc, $, $$, toast, modal, confirmBox } = UI;
  const S = () => Store.state;
  const list = () => (S().club.stages || []).filter(s => s && s.id);
  const today = () => UI.today();
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const parse = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const nextMonday = () => { const d = new Date(); d.setHours(12); const add = (8 - d.getDay()) % 7 || 7; d.setDate(d.getDate() + add); return iso(d); };
  const day = (s, o) => parse(s).toLocaleDateString('fr-FR', o || { weekday: 'short', day: 'numeric', month: 'short' });
  const weekLabel = w => `du ${day(w.from, { weekday: 'long', day: 'numeric' })} au ${day(w.to, { weekday: 'long', day: 'numeric', month: 'long' })}`;
  const hh = t => String(t || '').replace(':', 'h');
  const lastDay = s => (s.weeks || []).reduce((a, w) => (w.to > a ? w.to : a), '');
  const firstDay = s => (s.weeks || []).reduce((a, w) => (!a || w.from < a ? w.from : a), '');
  const keyOf = (s, w) => s.id + ':' + w.id;
  const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  // the name of the holidays from the month of the first day
  const season = d => { const m = d ? parse(d).getMonth() : new Date().getMonth(); return m === 9 || m === 10 ? 'de la Toussaint' : m === 11 || m === 0 ? 'de Noël' : m === 1 || m === 2 ? "d'hiver" : m === 3 || m === 4 ? 'de printemps' : "d'été"; };
  const PROGRAMME = '08:00 - 09:30 Accueil du matin\n09:00 - 11:30 Entraînements\n11:30 - 12:00 Temps libre\n12:00 - 13:00 Repas\n13:00 - 14:00 Jeux, quiz\n14:00 - 16:00 Tournois, challenges\n16:30 - 17:00 Goûter et accueil du soir';
  const prog = s => String(s.programme || '').split('\n').map(x => x.trim()).filter(Boolean).map(x => { const m = /^(\d{1,2}[:h]\d{2}\s*[-–]\s*\d{1,2}[:h]\d{2}|\d{1,2}[:h]\d{2})\s*(.*)$/.exec(x); return m ? [m[1].replace(/\s+/g, ' '), m[2]] : ['', x]; });
  // who is registered for one week: the club's children (their card) and the children from outside
  const kids = (s, w) => S().players.filter(p => Array.isArray(p.stageIds) && p.stageIds.includes(keyOf(s, w))).sort(Store.byName);
  const guests = (s, w) => ((s.guests || {})[w.id] || []).filter(g => g && g.id);
  const count = (s, w) => kids(s, w).length + guests(s, w).length;
  const paid = (s, id, w) => (s.paidIds || []).includes(id + ':' + w.id);
  const teamName = p => (p.teamIds || []).map(id => Store.get('teams', id)).filter(Boolean).map(t => t.name).join(' · ');
  const canEdit = () => !Auth.readOnly();
  const canValidate = () => Auth.isAdmin(); // the responsable validates, once the payment is received
  const save = () => { list().forEach(s => { s.end = lastDay(s); s.begin = firstDay(s); }); Store.save(); };
  // the camps of a day (for the planning of the pitch)
  // no camp at the weekend: Saturday and Sunday are rest days, even inside the dates of a week
  const weekend = d => [0, 6].includes(parse(d).getDay());
  const onDay = d => weekend(d) ? [] : list().filter(s => (s.weeks || []).some(w => d >= w.from && d <= w.to));
  const ic = n => I[n] || I.plus;
  const youthTeams = () => S().teams.filter(t => !/senior|v[ée]t[ée]ran|loisir/i.test(t.name + ' ' + (t.category || ''))).sort((a, b) => String(a.name).localeCompare(String(b.name), 'fr', { numeric: true }));

  /* ---------- the page ---------- */
  function page(root, id) {
    if (id) { const s = list().find(x => x.id === id); if (s) return detail(root, s); }
    const now = today(), up = list().filter(s => (lastDay(s) || now) >= now).sort((a, b) => firstDay(a).localeCompare(firstDay(b))), past = list().filter(s => lastDay(s) && lastDay(s) < now).sort((a, b) => firstDay(b).localeCompare(firstDay(a)));
    const card = s => {
      const ws = s.weeks || [];
      return `<article class="card stage-card"><div class="row-head"><h2>🏕️ ${esc(s.title || 'Stage')}</h2>${s.open === false ? '<span class="pill">Inscriptions fermées</span>' : ''}</div>
        <p class="muted">${esc(hh(s.start) || '?')} – ${esc(hh(s.end_h) || '?')}${s.price ? ` · ${esc(s.price)} € la semaine` : ''}${+s.max ? ` · ${+s.max} places par semaine` : ''}</p>
        <div class="stage-weeks">${ws.map(w => { const n = count(s, w), v = kids(s, w).filter(p => paid(s, p.id, w)).length + guests(s, w).filter(g => paid(s, g.id, w)).length; return `<a class="stage-week" href="#/stages/${s.id}/${w.id}"><b>Semaine ${esc(weekLabel(w))}</b><span>${n} inscrit${n > 1 ? 's' : ''}${+s.max ? ' / ' + (+s.max) : ''}${n > v ? ` · <i class="stage-wait">${n - v} à valider</i>` : ''}</span></a>`; }).join('') || '<p class="muted small">Aucune semaine : touche « Modifier ».</p>'}</div>
        <div class="chips"><a class="btn primary" href="#/stages/${s.id}">${ic('team')}<span>Les inscrits</span></a><button class="btn" data-sshare="${s.id}">${ic('share')}<span>Message aux familles</span></button><button class="btn" data-simg="${s.id}">${ic('image')}<span>Affiche</span></button>${canEdit() ? `<button class="btn" data-sedit="${s.id}">${ic('edit')}<span>Modifier</span></button>` : ''}</div></article>`;
    };
    root.innerHTML = `<header class="page-head"><div><h1>🏕️ Stages vacances</h1><p class="sub">Les stages du club pendant les vacances scolaires : semaines, programme, inscriptions</p></div>
      <div class="head-actions">${canEdit() ? `<button class="btn primary" data-snew>${ic('plus')}<span>Nouveau stage</span></button>` : ''}</div></header>
      ${up.length ? up.map(card).join('') : `<div class="empty card"><p>Pas de stage prévu.</p>${canEdit() ? '<p class="muted small">« Nouveau stage » : les semaines, les horaires, le prix et le programme. Les familles inscrivent ensuite leur enfant depuis leur espace.</p>' : ''}</div>`}
      ${past.length ? `<details class="card fold-list"><summary><b>🗄️ Stages passés (${past.length})</b></summary>${past.map(card).join('')}</details>` : ''}
      <p class="tip">Les familles voient le stage dans leur espace (onglet Matchs) et inscrivent leur enfant semaine par semaine. Un responsable valide l'inscription quand le paiement est reçu : la famille le voit. Un coach peut aussi inscrire un enfant, ou un enfant extérieur au club.</p>`;
    root.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if ('snew' in b.dataset) return edit(null, () => page(root));
      if (b.dataset.sedit) return edit(list().find(x => x.id === b.dataset.sedit), () => page(root));
      if (b.dataset.sshare) return share(list().find(x => x.id === b.dataset.sshare));
      if (b.dataset.simg) return poster(list().find(x => x.id === b.dataset.simg));
    };
  }

  /* ---------- one camp: the registered children, week by week ---------- */
  function detail(root, s, wid) {
    const ws = s.weeks || []; wid = location.hash.split('/')[3] || wid || (S().ui.stageWeek || {})[s.id];
    const w = ws.find(x => x.id === wid) || ws.find(x => x.to >= today()) || ws[0];
    if (!w) { root.innerHTML = `<header class="page-head"><div><h1>🏕️ ${esc(s.title || 'Stage')}</h1></div><div class="head-actions"><a class="btn" href="#/stages">${ic('back')}<span>Les stages</span></a></div></header><p class="muted">Aucune semaine pour ce stage.</p>`; return; }
    S().ui.stageWeek = Object.assign(S().ui.stageWeek || {}, { [s.id]: w.id });
    const ks = kids(s, w), gs = guests(s, w), n = ks.length + gs.length, np = ks.filter(p => paid(s, p.id, w)).length + gs.filter(g => paid(s, g.id, w)).length;
    const tel = p => { const par = Array.isArray(p.parents) ? p.parents.find(x => x && x.phone) : null; return (par && par.phone) || p.phone || ''; };
    const state = id => paid(s, id, w) ? `<button class="chip on" data-spaid="${esc(id)}" ${canValidate() ? '' : 'disabled'}>✓ Validé</button>` : `<button class="chip stage-wait" data-spaid="${esc(id)}" ${canValidate() ? '' : 'disabled'}>${canValidate() ? 'Valider (payé)' : 'À valider'}</button>`;
    const row = (id, name, sub, ph) => `<div class="list-item stage-kid"><div class="li-main"><b>${esc(name)}</b><span class="muted">${esc(sub)}${ph ? ` · <a href="tel:${esc(ph)}">${esc(ph)}</a>` : ''}</span></div>
      ${state(id)}${canEdit() ? `<button class="icon-btn" data-sdel="${esc(id)}" aria-label="Retirer">${ic('x')}</button>` : ''}</div>`;
    // the registrations still to validate first
    const order = (a, b) => (paid(s, a.id, w) ? 1 : 0) - (paid(s, b.id, w) ? 1 : 0);
    root.innerHTML = `<header class="page-head"><div><h1>🏕️ ${esc(s.title || 'Stage')}</h1><p class="sub">${esc(hh(s.start))} – ${esc(hh(s.end_h))}${s.price ? ` · ${esc(s.price)} € la semaine` : ''}${s.contact ? ` · inscriptions : ${esc(s.contact)}` : ''}</p></div>
      <div class="head-actions"><a class="btn" href="#/stages">${ic('back')}<span>Les stages</span></a><button class="btn" data-spdf>${ic('pdf')}<span>Feuille d'appel</span></button><button class="btn" data-scopy>${ic('copy')}<span>Copier la liste</span></button></div></header>
      ${ws.length > 1 ? `<div class="chips stage-tabs">${ws.map(x => `<a class="chip ${x.id === w.id ? 'on' : ''}" href="#/stages/${s.id}/${x.id}">${esc(day(x.from, { day: 'numeric', month: 'short' }))} – ${esc(day(x.to, { day: 'numeric', month: 'short' }))} · ${count(s, x)}</a>`).join('')}</div>` : ''}
      <section class="card"><div class="row-head"><h2>Semaine ${esc(weekLabel(w))}</h2><b>${n}${+s.max ? ' / ' + (+s.max) : ''}</b></div>
        <p class="muted small">${np} validé${np > 1 ? 's' : ''} sur ${n}${s.price ? ` · ${np * (+s.price || 0)} € reçus sur ${n * (+s.price || 0)} €` : ''}${canValidate() ? ' · touche « Valider » quand le paiement est reçu : la famille le voit dans son espace' : ' · un responsable valide chaque inscription quand le paiement est reçu'}</p>
        ${n ? `<div class="list">${ks.slice().sort(order).map(p => row(p.id, Store.fullName(p), teamName(p), tel(p))).join('')}${gs.slice().sort(order).map(g => row(g.id, g.name, 'Extérieur au club', g.phone)).join('')}</div>` : '<p class="muted">Personne pour l\'instant.</p>'}
        ${canEdit() ? `<div class="chips"><button class="btn primary" data-sadd>${ic('plus')}<span>Inscrire un enfant du club</span></button><button class="btn" data-sguest>${ic('plus')}<span>Enfant extérieur</span></button></div>` : ''}</section>
      ${prog(s).length ? `<details class="card"><summary><b>🗓️ Le programme d'une journée</b></summary><ul class="stage-prog">${prog(s).map(([t, l]) => `<li><b>${esc(t)}</b> ${esc(l)}</li>`).join('')}</ul></details>` : ''}`;
    const redraw = () => detail(root, s, w.id);
    root.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.spaid) { if (!canValidate()) return toast('Un responsable du club valide les inscriptions', 'err'); const k = b.dataset.spaid + ':' + w.id, l = s.paidIds = s.paidIds || []; const i = l.indexOf(k); if (i < 0) l.push(k); else l.splice(i, 1); save(); toast(i < 0 ? 'Inscription validée' : 'Validation retirée'); return redraw(); }
      if (b.dataset.sdel) {
        const id = b.dataset.sdel, p = Store.get('players', id), g = guests(s, w).find(x => x.id === id);
        if (!(await confirmBox(`Retirer ${p ? Store.fullName(p) : g ? g.name : 'cet enfant'} de la semaine ${weekLabel(w)} ?`))) return;
        if (p) { p.stageIds = (p.stageIds || []).filter(x => x !== keyOf(s, w)); Store.upsert('players', p); }
        if (g) s.guests[w.id] = s.guests[w.id].filter(x => x.id !== id);
        s.paidIds = (s.paidIds || []).filter(x => x !== id + ':' + w.id); save(); toast('Retiré'); return redraw();
      }
      if ('sadd' in b.dataset) return addKid(s, w, redraw);
      if ('sguest' in b.dataset) return addGuest(s, w, redraw);
      if ('scopy' in b.dataset) {
        const txt = `${s.title} · semaine ${weekLabel(w)} (${n})\n` + [...ks.map(p => `- ${Store.fullName(p)} (${teamName(p)})${paid(s, p.id, w) ? ' ✓' : ' · à valider'}`), ...gs.map(g => `- ${g.name} (extérieur)${paid(s, g.id, w) ? ' ✓' : ' · à valider'}`)].join('\n');
        try { await navigator.clipboard.writeText(txt); toast('Liste copiée'); } catch (x) { modal({ title: 'La liste', body: `<textarea rows="12" style="width:100%">${esc(txt)}</textarea>`, actions: [{ label: 'Fermer' }] }); }
        return;
      }
      if ('spdf' in b.dataset) return callSheet(s, w, ks, gs);
    };
  }
  // a child of the club: the categories the camp is open to, a search box
  function addKid(s, w, done) {
    // the categories ticked for the camp, otherwise every youth category (no seniors, veterans, leisure)
    const open = new Set((s.teamIds || []).length ? s.teamIds : youthTeams().map(t => t.id)), have = new Set(kids(s, w).map(p => p.id));
    const pool = S().players.filter(p => !have.has(p.id) && (p.teamIds || []).some(t => open.has(t))).sort(Store.byName);
    let close = null;
    modal({ title: 'Inscrire un enfant', body: `<input id="skQ" placeholder="Nom ou prénom" autocomplete="off"><div class="list stage-pick" id="skL"></div>`,
      onOpen: (r, c) => {
        close = c;
        const draw = () => { const q = norm($('#skQ', r).value); const l = pool.filter(p => !q || norm(Store.fullName(p)).includes(q)).slice(0, 40);
          $('#skL', r).innerHTML = l.map(p => `<button class="list-item" data-skp="${p.id}"><div class="li-main"><b>${esc(Store.fullName(p))}</b><span class="muted">${esc(teamName(p))}</span></div></button>`).join('') || '<p class="muted">Personne.</p>'; };
        $('#skQ', r).oninput = draw; draw();
        $('#skL', r).onclick = e => { const b = e.target.closest('[data-skp]'); if (!b) return; const p = Store.get('players', b.dataset.skp); if (!p) return;
          if (+s.max && count(s, w) >= +s.max) { toast('La semaine est complète', 'err'); return; }
          p.stageIds = [...new Set([...(p.stageIds || []), keyOf(s, w)])]; Store.upsert('players', p); toast(`${Store.shortName(p)} inscrit`);
          b.remove(); done(); };
      }, actions: [{ label: 'Fermer' }] });
  }
  function addGuest(s, w, done) {
    modal({ title: 'Enfant extérieur au club', body: `<label class="fld"><span>Nom et prénom</span><input id="sgN" maxlength="60"></label><label class="fld"><span>Téléphone d'un parent (facultatif)</span><input id="sgT" maxlength="20" inputmode="tel"></label>`,
      actions: [{ label: 'Annuler' }, { label: 'Inscrire', kind: 'primary', onClick: (c, r) => {
        const name = $('#sgN', r).value.trim(); if (!name) { toast("Le nom de l'enfant", 'err'); return false; }
        if (+s.max && count(s, w) >= +s.max) { toast('La semaine est complète', 'err'); return false; }
        s.guests = s.guests || {}; (s.guests[w.id] = s.guests[w.id] || []).push({ id: Store.uid(), name, phone: $('#sgT', r).value.trim() }); save(); toast(`${name} inscrit`); done(); } }] });
  }

  /* ---------- create / change a camp ---------- */
  function edit(s, done) {
    const isNew = !s, m0 = nextMonday();
    const cur = s ? JSON.parse(JSON.stringify(s)) : { id: Store.uid(), title: 'Stage ' + season(m0), weeks: [{ id: Store.uid(), from: m0, to: addDays(m0, 4) }], start: '08:45', end_h: '16:30', price: 60, max: 0, teamIds: [], contact: '', programme: PROGRAMME, info: '', open: true };
    const youth = youthTeams();
    const weekRow = (w, i) => `<div class="row2 stage-wrow" data-wi="${i}"><label class="fld"><span>Du</span><input type="date" data-wf value="${esc(w.from)}"></label><label class="fld"><span>Au</span><input type="date" data-wt value="${esc(w.to)}"></label><button class="icon-btn" data-wdel="${i}" aria-label="Retirer la semaine">${ic('x')}</button></div>`;
    let read = () => cur.weeks;
    modal({ title: isNew ? 'Nouveau stage' : 'Modifier le stage', body: `
      <label class="fld"><span>Nom</span><input id="stT" value="${esc(cur.title)}" maxlength="60"></label>
      <div class="lbl">Les semaines</div><div id="stW">${cur.weeks.map(weekRow).join('')}</div><button class="btn soft" id="stWadd">${ic('plus')}<span>Une semaine de plus</span></button>
      <div class="row2"><label class="fld"><span>Arrivée</span><input type="time" id="stS" value="${esc(cur.start)}"></label><label class="fld"><span>Départ</span><input type="time" id="stE" value="${esc(cur.end_h)}"></label></div>
      <div class="row2"><label class="fld"><span>Prix par semaine (€)</span><input type="number" id="stP" min="0" value="${esc(cur.price)}"></label><label class="fld"><span>Places par semaine (0 : sans limite)</span><input type="number" id="stM" min="0" value="${esc(cur.max || 0)}"></label></div>
      <div class="lbl">Ouvert aux catégories <span class="muted small">(aucune cochée : toutes)</span></div><div class="chips" id="stC">${youth.map(t => `<button class="chip ${(cur.teamIds || []).includes(t.id) ? 'on' : ''}" data-tid="${t.id}">${esc(t.name)}</button>`).join('')}</div>
      <label class="fld"><span>Paiement et questions auprès de (facultatif)</span><input id="stK" value="${esc(cur.contact)}" maxlength="80" placeholder="ex : William, président"></label>
      <label class="fld"><span>Le programme d'une journée (une ligne par moment)</span><textarea id="stG" rows="7">${esc(cur.programme)}</textarea></label>
      <label class="fld"><span>À savoir (facultatif)</span><textarea id="stI" rows="3" placeholder="ex : prévoir le repas, une gourde, une tenue de rechange">${esc(cur.info || '')}</textarea></label>
      <label class="prep-check"><input type="checkbox" id="stO" ${cur.open !== false ? 'checked' : ''}><span>Inscriptions ouvertes aux familles</span></label>`,
      onOpen: r => {
        read = () => $$('.stage-wrow', r).map((x, i) => ({ id: (cur.weeks[i] || {}).id || Store.uid(), from: $('[data-wf]', x).value, to: $('[data-wt]', x).value }));
        $('#stWadd', r).onclick = () => { cur.weeks = read(); const last = cur.weeks[cur.weeks.length - 1], f = last && last.from ? addDays(last.from, 7) : nextMonday(); cur.weeks.push({ id: Store.uid(), from: f, to: addDays(f, 4) }); $('#stW', r).innerHTML = cur.weeks.map(weekRow).join(''); };
        $('#stW', r).onclick = e => { const b = e.target.closest('[data-wdel]'); if (!b) return; cur.weeks = read(); cur.weeks.splice(+b.dataset.wdel, 1); $('#stW', r).innerHTML = cur.weeks.map(weekRow).join(''); };
        $('#stW', r).onchange = e => { if (!e.target.matches('[data-wf]')) return; const to = $('[data-wt]', e.target.closest('.stage-wrow')); if (e.target.value && (!to.value || to.value < e.target.value)) to.value = addDays(e.target.value, 4); };
        $$('#stC .chip', r).forEach(b => b.onclick = () => b.classList.toggle('on'));
      },
      actions: [...(!isNew ? [{ label: 'Supprimer', kind: 'danger', onClick: async () => {
          if (!(await confirmBox(`Supprimer « ${cur.title} » et ses inscriptions ?`))) return false;
          S().club.stages = list().filter(x => x.id !== cur.id);
          S().players.forEach(p => { if ((p.stageIds || []).some(k => k.startsWith(cur.id + ':'))) { p.stageIds = p.stageIds.filter(k => !k.startsWith(cur.id + ':')); Store.upsert('players', p); } });
          save(); toast('Stage supprimé'); done(); } }] : []),
        { label: 'Annuler' }, { label: 'Enregistrer', kind: 'primary', onClick: (c, r) => {
          const weeks = read().filter(w => w.from && w.to);
          if (!weeks.length) { toast('Au moins une semaine, avec ses dates', 'err'); return false; }
          if (weeks.some(w => w.to < w.from)) { toast('Une semaine finit avant de commencer', 'err'); return false; }
          Object.assign(cur, { title: $('#stT', r).value.trim() || 'Stage ' + season(weeks[0].from), weeks: weeks.sort((a, b) => a.from.localeCompare(b.from)), start: $('#stS', r).value, end_h: $('#stE', r).value,
            price: Math.max(0, +$('#stP', r).value || 0), max: Math.max(0, Math.round(+$('#stM', r).value || 0)), teamIds: $$('#stC .chip.on', r).map(b => b.dataset.tid),
            contact: $('#stK', r).value.trim(), programme: $('#stG', r).value.trim(), info: $('#stI', r).value.trim(), open: $('#stO', r).checked });
          const all = S().club.stages = list(), i = all.findIndex(x => x.id === cur.id); if (i < 0) all.push(cur); else all[i] = Object.assign(all[i], cur);
          save(); toast(isNew ? 'Stage créé : les familles le voient dans leur espace' : 'Stage enregistré'); done(); } }] });
  }

  /* ---------- for the families: a message to paste, a poster to share ---------- */
  function text(s) {
    const ws = s.weeks || [];
    return [`🏕️ ${s.title}`, ws.map(w => `📅 Semaine ${weekLabel(w)}`).join('\n'), `⏰ De ${hh(s.start)} à ${hh(s.end_h)}`, s.price ? `💶 ${s.price} € la semaine` : '',
      prog(s).length ? '🗓️ Le programme :\n' + prog(s).map(([t, l]) => `${t ? t + ' · ' : ''}${l}`).join('\n') : '', s.info ? 'ℹ️ ' + s.info : '',
      `✍️ Inscriptions dans l'appli : espace parents, onglet Matchs, puis « Inscrire ». L'inscription est validée à la réception du paiement${s.contact ? ' (' + s.contact + ')' : ''}.`].filter(Boolean).join('\n\n');
  }
  async function share(s) {
    if (!s) return; const t = text(s);
    try { if (navigator.share && matchMedia('(pointer: coarse)').matches) { await navigator.share({ text: t }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(t); toast('Message copié : colle-le dans WhatsApp'); } catch (e) { modal({ title: 'Message aux familles', body: `<textarea rows="14" style="width:100%">${esc(t)}</textarea>`, actions: [{ label: 'Fermer' }] }); }
  }
  // the poster: navy, the club's name, the weeks, the hours, the programme, the price (1080 × 1350, like the convocations)
  async function poster(s) {
    if (!s) return;
    const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    x.fillStyle = '#0e1d45'; x.fillRect(0, 0, W, H); x.fillStyle = '#e2c27d'; x.fillRect(0, H - 18, W, 18);
    x.textAlign = 'center'; x.fillStyle = '#e2c27d'; x.font = '700 34px system-ui, sans-serif'; x.fillText(String(S().club.name || '').toUpperCase(), W / 2, 90);
    x.fillStyle = '#fff'; x.font = '800 70px system-ui, sans-serif'; x.fillText(String(s.title || 'Stage').toUpperCase().slice(0, 26), W / 2, 190);
    let y = 270; x.font = '600 38px system-ui, sans-serif'; (s.weeks || []).slice(0, 4).forEach(w => { x.fillText('Semaine ' + weekLabel(w), W / 2, y); y += 54; });
    x.fillStyle = '#e2c27d'; x.font = '700 40px system-ui, sans-serif'; x.fillText(`${hh(s.start)} – ${hh(s.end_h)}${s.price ? '  ·  ' + s.price + ' € la semaine' : ''}`, W / 2, y + 20); y += 110;
    const lines = prog(s).slice(0, 9);
    if (lines.length) {
      x.strokeStyle = '#e2c27d'; x.lineWidth = 3; x.strokeRect(80, y - 55, W - 160, lines.length * 62 + 40); x.textAlign = 'left';
      lines.forEach(([t, l]) => { x.fillStyle = '#e2c27d'; x.font = '600 30px system-ui, sans-serif'; x.fillText(t, 115, y); x.fillStyle = '#fff'; x.font = '800 34px system-ui, sans-serif'; x.fillText(String(l).toUpperCase().slice(0, 28), 420, y); y += 62; });
      y += 40; x.textAlign = 'center';
    }
    x.fillStyle = '#fff'; x.font = '600 32px system-ui, sans-serif'; x.fillText("Inscriptions dans l'appli : espace parents", W / 2, Math.min(H - 60, y + 30));
    const blob = await new Promise(r => c.toBlob(r, 'image/png')), name = `stage-${firstDay(s)}.png`, file = new File([blob], name, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: s.title }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('Affiche enregistrée dans Téléchargements');
  }
  // the call sheet: one line per child, one box per day of the week, and the validation
  async function callSheet(s, w, ks, gs) {
    const b = UI.busy('Création du PDF…');
    try {
      await Exporter.loadPdf(); const P = Exporter.pdfDoc(S().club), days = []; for (let d = w.from; d <= w.to; d = addDays(d, 1)) if (!weekend(d)) days.push(day(d, { weekday: 'short', day: 'numeric' }));
      P.header(s.title || 'Stage', 'Semaine ' + weekLabel(w));
      const rows = [...ks.map(p => [Store.fullName(p), teamName(p), ...days.map(() => ''), paid(s, p.id, w) ? 'validé' : 'à valider']), ...gs.map(g => [g.name, 'extérieur', ...days.map(() => ''), paid(s, g.id, w) ? 'validé' : 'à valider'])];
      const wd = .45 / (days.length + 1.5);
      P.table(['Enfant', 'Catégorie', ...days, 'Paiement'], rows.length ? rows : [['Personne', '', ...days.map(() => ''), '']], [.33, .22, ...days.map(() => wd), wd * 1.5]);
      const r = await Exporter.deliver(P.blob(), `stage-${w.from}.pdf`); if (r === 'downloaded') toast('PDF enregistré dans Téléchargements');
    } catch (e) { toast('PDF impossible : ' + (e.message || e), 'err'); } finally { b.done(); }
  }
  return { page, onDay, list, text };
})();
