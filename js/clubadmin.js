/* Club admin: licences, medical certificates, fees and image rights of the players (responsables),
   Excel exports (attendance and playing time), and who supervises what each week, with the dirigeants' absences. */
const ClubAdmin = (() => {
  const { esc, $, $$, toast, modal, confirmBox, fmtDate, today } = UI;
  const S = () => Store.state;
  const addDays = (d, n) => { const x = new Date(d + 'T12:00'); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  const monday = d => { const x = new Date(d + 'T12:00'), k = (x.getDay() + 6) % 7; return addDays(d, -k); };

  /* ---------- the player's paperwork: p.adm = { lic, certif, cotis, paid, image } ---------- */
  // each field: [key, column title, the values in the order a touch goes through them: [value, label, tone]]
  const FIELDS = [
    ['lic', 'Licence', [['', '–', ''], ['ok', '✓ Validée', 'good'], ['attente', '⏳ En attente', 'mid']]],
    ['certif', 'Certificat / questionnaire santé', [['', '–', ''], ['ok', '✓ OK', 'good'], ['manque', '✗ À fournir', 'bad']]],
    ['cotis', 'Cotisation', [['', '✗ Non payée', 'bad'], ['ok', '✓ Payée', 'good'], ['partiel', '½ En partie', 'mid']]],
    ['image', 'Droit à l\'image', [['', '–', ''], ['oui', '✓ Accepté', 'good'], ['non', '✗ Refusé', 'bad']]],
  ];
  const adm = p => p.adm || {};
  const val = (p, k) => adm(p)[k] || '';
  const cell = (p, [k, , vals]) => { const v = vals.find(x => x[0] === val(p, k)) || vals[0]; return `<button class="adm-b ${v[2]}" data-adm="${k}" data-p="${p.id}">${esc(v[1])}</button>`; };
  // Not allowed to play: licence still pending, or certificate to provide (a box not filled in yet gives no warning)
  const tracking = () => S().players.some(p => p.adm && (p.adm.lic || p.adm.certif));
  function problem(p) {
    if (!tracking()) return '';
    const a = adm(p), out = [];
    if (a.lic === 'attente') out.push('licence en attente');
    if (a.certif === 'manque') out.push('certificat à fournir');
    return out.join(', ');
  }
  const noImage = p => val(p, 'image') === 'non';

  function licencesPage(root) {
    if (!Auth.isAdmin()) { location.hash = '#/'; return; }
    const ui = S().ui, cat = ui.admCat || '', only = ui.admOnly || '', q = (ui.admQ || '').toLowerCase();
    const inCat = p => !cat || (p.teamIds || []).includes(cat);
    const all = S().players.filter(inCat);
    const bad = p => { const a = adm(p); return a.lic !== 'ok' || a.certif === 'manque' || a.cotis !== 'ok'; };
    const list = all.filter(p => (!only || bad(p)) && (!q || Store.fullName(p).toLowerCase().includes(q))).sort(Store.byName);
    const n = (k, v) => all.filter(p => val(p, k) === v).length, total = all.reduce((a, p) => a + (+adm(p).paid || 0), 0);
    const tile = (v, l, cls = '') => `<div class="tile ${cls}"><b>${v}</b><span>${l}</span></div>`;
    root.innerHTML = `<header class="page-head"><div><h1>Licences et cotisations</h1><p class="sub">Saison ${esc(People.seasonLabel())} · ${all.length} joueur${all.length > 1 ? 's' : ''}${cat ? ' · ' + esc((Store.get('teams', cat) || {}).name || '') : ''}</p></div>
      <div class="head-actions"><a class="btn" href="#/president">${I.back}<span>Tableau de bord</span></a><button class="btn" data-act="csv">${I.download}<span>Excel</span></button></div></header>
      <div class="tiles">${tile(`${n('lic', 'ok')}/${all.length}`, 'Licences validées', 'v')}${tile(n('certif', 'manque'), 'Certificats à fournir', n('certif', 'manque') ? 'd' : '')}
        ${tile(`${n('cotis', 'ok')}/${all.length}`, 'Cotisations payées', 'v')}${tile(n('cotis', 'partiel'), 'Payées en partie', 'n')}${tile(total ? total.toLocaleString('fr-FR') + ' €' : '–', 'Encaissé')}${tile(n('image', 'non'), 'Refus droit à l\'image', n('image', 'non') ? 'd' : '')}</div>
      <div class="filters">
        <label class="search">${I.search}<input id="admQ" type="search" placeholder="Chercher un nom" value="${esc(ui.admQ || '')}"></label>
        <select id="admCat" aria-label="Catégorie"><option value="">Toutes les catégories</option>${S().teams.map(t => `<option value="${t.id}" ${t.id === cat ? 'selected' : ''}>${esc(Store.teamLabel(t))}</option>`).join('')}</select>
        <label class="switch"><input type="checkbox" id="admOnly" ${only ? 'checked' : ''}><span>Seulement ceux qui ne sont pas en règle</span></label>
      </div>
      <p class="muted small">Touche une case pour changer son état. Les coachs voient ⚠️ à côté d'un joueur dont la licence est en attente ou le certificat à fournir (dans les convocations), et savent qui refuse le droit à l'image. Les cotisations restent entre responsables.</p>
      <div class="table-wrap"><table class="tbl adm-tbl"><thead><tr><th>Joueur</th>${FIELDS.map(f => `<th>${esc(f[1])}</th>`).join('')}<th>Payé (€)</th></tr></thead>
        <tbody>${list.map(p => `<tr><td><a href="#/joueur/${p.id}"><b>${esc(Store.fullName(p))}</b></a><br><span class="muted small">${esc((p.teamIds || []).map(id => (Store.get('teams', id) || {}).name).filter(Boolean).join(', '))}</span></td>
          ${FIELDS.map(f => `<td>${cell(p, f)}</td>`).join('')}<td><input class="adm-paid" type="number" min="0" step="1" inputmode="decimal" data-paid="${p.id}" value="${adm(p).paid == null ? '' : esc(adm(p).paid)}" aria-label="Montant payé par ${esc(Store.fullName(p))}"></td></tr>`).join('') || `<tr><td colspan="6" class="muted">Personne ici.</td></tr>`}</tbody></table></div>`;
    const again = () => { const y = window.scrollY; licencesPage(root); window.scrollTo(0, y); };
    $('#admQ', root).oninput = e => { ui.admQ = e.target.value; clearTimeout(licencesPage.t); licencesPage.t = setTimeout(() => { again(); const i = $('#admQ', root); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 400); };
    $('#admCat', root).onchange = e => { ui.admCat = e.target.value; Store.persistNow(); again(); };
    $('#admOnly', root).onchange = e => { ui.admOnly = e.target.checked ? 1 : 0; Store.persistNow(); again(); };
    root.onchange = e => {
      const i = e.target.closest('[data-paid]'); if (!i) return;
      const p = Store.get('players', i.dataset.paid); p.adm = Object.assign({}, p.adm, { paid: i.value === '' ? null : Math.max(0, +i.value) }); Store.upsert('players', p);
    };
    root.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.act === 'csv') return csvLicences(list);
      if (b.dataset.adm) {
        const p = Store.get('players', b.dataset.p), f = FIELDS.find(x => x[0] === b.dataset.adm), vals = f[2];
        const i = vals.findIndex(x => x[0] === val(p, f[0])), next = vals[(i + 1) % vals.length];
        p.adm = Object.assign({}, p.adm, { [f[0]]: next[0] }); Store.upsert('players', p);
        const y = window.scrollY; licencesPage(root); window.scrollTo(0, y); // counters at the top follow
      }
    };
  }

  /* ---------- Excel (a .csv file that Excel opens with the French accents and columns) ---------- */
  function csv(rows, name) {
    const cellOf = v => { const s = v == null ? '' : typeof v === 'number' ? String(v).replace('.', ',') : String(v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const text = '﻿' + rows.map(r => r.map(cellOf).join(';')).join('\r\n');
    return Exporter.deliver(new Blob([text], { type: 'text/csv;charset=utf-8' }), `${name}.csv`).then(r => { if (r === 'downloaded') toast('Fichier Excel enregistré dans Téléchargements'); });
  }
  const labelOf = (k, v) => ((FIELDS.find(f => f[0] === k)[2].find(x => x[0] === (v || '')) || [])[1] || '').replace(/^[✓✗⏳½] /, '');
  function csvLicences(list) {
    csv([['Nom', 'Prénom', 'Né(e) le', 'Catégories', ...FIELDS.map(f => f[1]), 'Payé (€)'],
      ...list.map(p => [p.lastName, p.firstName, People.fmtBirth(p.birth), (p.teamIds || []).map(id => (Store.get('teams', id) || {}).name).filter(Boolean).join(', '), ...FIELDS.map(f => labelOf(f[0], val(p, f[0]))), adm(p).paid == null ? '' : +adm(p).paid])],
      `Licences-${S().club.name}-${today()}`);
  }
  // Attendance and playing time of the season, one line per player (one category, or the whole club)
  function csvSeason(teamIds) {
    const from = People.seasonFrom(), now = today(), rows = [['Catégorie', 'Nom', 'Prénom', 'Postes', 'Séances (appel fait)', 'Présences', 'Présence (%)', 'Convocations', 'Matchs joués', 'Minutes', 'Moyenne (min/match)', 'Buts', 'Passes déc.']];
    const teams = (teamIds || S().teams.map(t => t.id)).map(id => Store.get('teams', id)).filter(Boolean);
    teams.forEach(t => {
      const trs = S().trainings.filter(x => !x.model && x.teamId === t.id && x.date >= from && x.date <= now && (x.presents || []).length);
      const ms = S().matches.filter(m => m.teamId === t.id && m.date >= from && !m.exempt && Store.kindOk(m));
      Store.playersOf(t.id).forEach(p => {
        const pr = trs.filter(x => x.presents.includes(p.id)).length, conv = ms.filter(m => (m.convoked || []).includes(p.id)), pl = conv.filter(m => m.played);
        const min = pl.reduce((a, m) => a + (+((m.minutes || {})[p.id]) || 0), 0), withMin = pl.filter(m => (m.minutes || {})[p.id] != null).length;
        const st = k => pl.reduce((a, m) => a + (((m.stats || {})[p.id] || {})[k] || 0), 0);
        rows.push([t.name, p.lastName, p.firstName, People.postsLabel(p, true), trs.length, pr, trs.length ? Math.round(pr / trs.length * 100) : '', conv.length, pl.length, min, withMin ? Math.round(min / withMin) : '', st('g'), st('a')]);
      });
    });
    return csv(rows, `Presences-temps-de-jeu-${teamIds && teamIds.length === 1 ? (Store.get('teams', teamIds[0]) || {}).name : S().club.name}-${today()}`);
  }

  /* ---------- who supervises what (week) and the dirigeants' absences: staff.absences = [{ id, from, to, note }] ---------- */
  const absentOn = (s, d) => (s.absences || []).find(a => a.from <= d && d <= (a.to || a.from));
  function staffingPage(root) {
    const ui = S().ui, me = Auth.current(), wk = ui.encWeek = ui.encWeek || monday(today()), days = Array.from({ length: 7 }, (_, i) => addDays(wk, i));
    const mine = ui.encMine && !Auth.isAdmin();
    const evs = [...S().matches.filter(m => !m.exempt && days.includes(m.date)).map(m => ({ kind: 'match', x: m, date: m.date, time: m.rdv || m.time || '', title: `⚽ ${(Store.get('teams', m.teamId) || {}).name || ''} ${m.home ? 'contre' : 'chez'} ${m.opponent || '?'}`, href: '#/match/' + m.id })),
      ...S().trainings.filter(t => !t.model && days.includes(t.date)).map(t => ({ kind: 'training', x: t, date: t.date, time: t.time || '', title: `🏃 ${(Store.get('teams', t.teamId) || {}).name || 'Séance'} · ${t.title || 'Entraînement'}`, href: '#/entrainement/' + t.id }))]
      .filter(e => !mine || Auth.sees(e.x.teamId)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const nobody = evs.filter(e => !(e.x.staffIds || []).length).length;
    const absents = S().staff.map(s => ({ s, a: (s.absences || []).filter(a => a.from <= days[6] && (a.to || a.from) >= days[0]) })).filter(x => x.a.length);
    root.innerHTML = `<header class="page-head"><div><h1>Qui encadre ?</h1><p class="sub">Matchs et séances de la semaine, leurs encadrants, et les absences</p></div>
      <div class="head-actions"><a class="btn" href="#/planning">${I.calendar}<span>Planning</span></a><button class="btn primary" data-act="absence">${I.plus}<span>Déclarer une absence</span></button></div></header>
      <div class="plan-nav"><button class="icon-btn" data-wk="-7" aria-label="Semaine précédente">${I.back}</button><b>Semaine du ${esc(fmtDate(wk, { day: 'numeric', month: 'long' }))}</b><button class="icon-btn" data-wk="7" aria-label="Semaine suivante">${I.next}</button><button class="btn soft" data-wk="0">Cette semaine</button>
        ${Auth.isAdmin() ? '' : `<span class="grow"></span><label class="switch small"><input type="checkbox" id="encMine" ${mine ? 'checked' : ''}><span>Mes catégories</span></label>`}</div>
      ${nobody ? `<p class="tip">⚠️ ${nobody} match${nobody > 1 ? 's' : ''} ou séance${nobody > 1 ? 's' : ''} sans encadrant cette semaine.</p>` : ''}
      ${absents.length ? `<section class="card"><h2>🏖️ Absents cette semaine</h2><ul class="alerts">${absents.map(({ s, a }) => a.map(x => `<li><b>${esc(Store.fullName(s))}</b> : ${esc(fmtDate(x.from, { weekday: 'short', day: 'numeric', month: 'short' }))}${x.to && x.to !== x.from ? ' → ' + esc(fmtDate(x.to, { weekday: 'short', day: 'numeric', month: 'short' })) : ''}${x.note ? ' · ' + esc(x.note) : ''}
        ${Auth.isAdmin() || (me && me.id === s.id) ? `<button class="linkish" data-delabs="${s.id}|${x.id}">retirer</button>` : ''}</li>`).join('')).join('')}</ul></section>` : ''}
      ${days.map(d => { const list = evs.filter(e => e.date === d); if (!list.length) return '';
        return `<h2 class="section">${esc(fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' }))}</h2><div class="list">${list.map(e => { const ids = e.x.staffIds || [], st = ids.map(id => Store.get('staff', id)).filter(Boolean);
          const away = st.filter(s => absentOn(s, d));
          return `<div class="list-item enc-item ${!st.length ? 'enc-none' : ''}"><a class="li-main" href="${e.href}"><b>${esc(e.title)}</b><span class="muted">${e.time ? esc(e.time.replace(':', 'h')) + ' · ' : ''}${st.length ? st.map(s => esc(Store.shortName(s)) + (absentOn(s, d) ? ' ⚠️ absent' : '')).join(', ') : '⚠️ Personne'}</span>${away.length ? `<span class="muted small">Absent ce jour-là : ${away.map(s => esc(Store.shortName(s))).join(', ')}</span>` : ''}</a>
            ${me && !ids.includes(me.id) ? `<button class="btn soft" data-take="${e.kind}|${e.x.id}">${I.whistle}<span>J'y serai</span></button>` : me && ids.includes(me.id) ? `<button class="btn soft" data-drop="${e.kind}|${e.x.id}">Je n'y serai pas</button>` : ''}</div>`; }).join('')}</div>`; }).join('') || '<p class="muted">Aucun match ni séance cette semaine.</p>'}`;
    const again = () => { const y = window.scrollY; staffingPage(root); window.scrollTo(0, y); };
    const mc = $('#encMine', root); if (mc) mc.onchange = () => { ui.encMine = mc.checked ? 1 : 0; Store.persistNow(); again(); };
    root.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.wk) { ui.encWeek = b.dataset.wk === '0' ? monday(today()) : addDays(wk, +b.dataset.wk); Store.persistNow(); return staffingPage(root); }
      if (b.dataset.act === 'absence') return absenceDialog(null, again);
      if (b.dataset.take || b.dataset.drop) {
        const [kind, id] = (b.dataset.take || b.dataset.drop).split('|'), col = kind === 'match' ? 'matches' : 'trainings', x = Store.get(col, id);
        x.staffIds = b.dataset.take ? [...new Set([...(x.staffIds || []), me.id])] : (x.staffIds || []).filter(s => s !== me.id);
        Store.upsert(col, x); toast(b.dataset.take ? 'Noté : tu encadres' : 'Retiré'); return again();
      }
      if (b.dataset.delabs) {
        const [sid, aid] = b.dataset.delabs.split('|'), s = Store.get('staff', sid);
        s.absences = (s.absences || []).filter(a => a.id !== aid); Store.upsert('staff', s); return again();
      }
    };
  }
  // An absence: a responsable can declare one for any dirigeant, a coach for himself
  function absenceDialog(staffId, done) {
    const me = Auth.current(); if (!me) return;
    modal({ title: 'Déclarer une absence', body: `
      ${Auth.isAdmin() ? `<label class="fld"><span>Dirigeant</span><select id="abWho">${S().staff.slice().sort(Store.byName).map(s => `<option value="${s.id}" ${s.id === (staffId || me.id) ? 'selected' : ''}>${esc(Store.fullName(s))}</option>`).join('')}</select></label>` : ''}
      <div class="row2"><label class="fld"><span>Du</span><input type="date" id="abFrom" value="${today()}"></label><label class="fld"><span>Au (inclus)</span><input type="date" id="abTo" value="${today()}"></label></div>
      <label class="fld"><span>Motif (facultatif, visible par les autres dirigeants)</span><input id="abNote" maxlength="60" placeholder="ex : vacances, travail"></label>`,
      actions: [{ label: 'Annuler' }, { label: 'Enregistrer', kind: 'primary', onClick: (c, r) => {
        const s = Store.get('staff', Auth.isAdmin() ? $('#abWho', r).value : me.id), from = $('#abFrom', r).value, to = $('#abTo', r).value || from;
        if (!s || !from) { toast('Choisis une date', 'err'); return false; }
        if (to < from) { toast('La date de fin est avant le début', 'err'); return false; }
        s.absences = [...(s.absences || []).filter(a => (a.to || a.from) >= addDays(today(), -60)), { id: Store.uid(), from, to, note: $('#abNote', r).value.trim() }];
        Store.upsert('staff', s); toast('Absence enregistrée'); done && done();
      } }] });
  }

  return { licencesPage, staffingPage, absenceDialog, problem, noImage, csv, csvSeason, tracking };
})();
