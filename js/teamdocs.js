/* TeamDocs (2.60): the documents of a team, in PDF.
   - the sheets of the whole squad (one player after the other: identity, positions, contacts, emergency, season, tests, level);
   - the sessions from one date to another (attendance of each player, late, and the list of the sessions);
   - the lineup sheet to fill in by hand at the side of the pitch (numbers, players, in / out, goals, cards) for a match. */
const TeamDocs = (() => {
  const { esc, toast, modal } = UI;
  const S = () => Store.state;
  const fd = d => UI.fmtDate(d, { day: 'numeric', month: 'short', year: 'numeric' });
  const squad = t => (Store.playersOf(t.id).length ? Store.playersOf(t.id) : Store.rosterOf(t.id)).filter(p => !p.archived).slice().sort(Store.byName);
  const deliver = (P, name) => Exporter.deliver(P.blob(), String(name).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.pdf');
  async function run(label, fn) {
    const b = UI.busy(label);
    try { await Exporter.loadPdf(); const r = await fn(); if (r === 'downloaded') toast('Fichier enregistré dans Téléchargements'); }
    catch (e) { console.error(e); toast(e.message || 'PDF impossible', 'err'); } finally { b.done(); }
  }

  // the whole squad, one player after the other
  function roster(t) {
    const P = Exporter.pdfDoc(S().club), ps = squad(t);
    P.header('Fiches joueurs', `${t.name} · ${ps.length} joueurs`);
    ps.forEach((p, i) => {
      if (i) P.ensure(70);
      const s = People.playerSeason(p), lv = p.level || {}, crit = typeof Level !== 'undefined' ? Level.CRIT : [];
      P.h2(`${p.number ? p.number + '. ' : ''}${Store.fullName(p)}${p.trial ? ' (à l\'essai)' : ''}`);
      P.facts([['Postes', People.postsLabel(p) || '-'], ['Né(e) le', p.birth ? fd(p.birth) : '-'], ['Pied', p.foot || '-'], ['Taille / poids', [p.height && p.height + ' cm', p.weight && p.weight + ' kg'].filter(Boolean).join(' · ') || '-']]);
      P.facts([['Matchs', String(s.played.length)], ['Minutes', String(s.minutes)], ['Buts / passes', `${s.g} / ${s.a}`], ['Présence', s.att.pct == null ? '-' : s.att.pct + ' %']]);
      const contacts = [p.phone && `Joueur : ${p.phone}`, ...(p.parents || []).map(x => `${x.name || x.rel || 'Parent'}${x.rel && x.name ? ' (' + x.rel + ')' : ''} : ${x.phone || '-'}`)].filter(Boolean);
      if (contacts.length) { P.label('Contacts'); P.bullets(contacts); }
      const u = p.urgent;
      if (u && Urgent.filled(u)) { P.label('Fiche urgence'); P.bullets([u.allergies && 'Allergies : ' + u.allergies, u.treat && 'Traitements : ' + u.treat, u.pai && 'Conduite à tenir : ' + u.pai, u.know && 'À savoir : ' + u.know, u.devices && 'Appareillages : ' + u.devices, ...(u.contacts || []).map(c => `À appeler : ${c.name}${c.rel ? ' (' + c.rel + ')' : ''} ${c.phone || ''}`)]); }
      const tests = (p.tests || []).slice().sort((a, b) => b.date.localeCompare(a.date)), seen = new Set(), lastT = tests.filter(r => !seen.has(r.test) && seen.add(r.test));
      if (lastT.length) { P.label('Tests physiques (le dernier)'); P.para(lastT.map(r => { const d = (Tests.LIST.find(x => x[0] === r.test) || [r.test, r.test, '']); return `${d[1]} ${String(r.value).replace('.', ',')} ${d[2]}`; }).join(' · '), 10); }
      if (crit.some(([k]) => lv[k])) { P.label('Niveau (sur 5)'); P.para(crit.filter(([k]) => lv[k]).map(([k, , l]) => `${l} ${lv[k]}`).join(' · '), 10); }
      if (p.strengths || p.weaknesses) { P.label('Son profil'); P.para([p.strengths && 'Points forts : ' + p.strengths, p.weaknesses && 'À travailler : ' + p.weaknesses].filter(Boolean).join(' · '), 10); }
    });
    return deliver(P, `fiches-${t.name}`);
  }

  // the sessions between two dates: the attendance of each player, and the list of the sessions
  function sessions(t, from, to) {
    const trs = S().trainings.filter(x => !x.model && x.teamId && Store.rosterOf(t.id).length && (x.teamId === t.id) && x.date >= from && x.date <= to && (x.presents || []).length).sort((a, b) => a.date.localeCompare(b.date));
    if (!trs.length) throw new Error('Aucune séance avec l\'appel fait entre ces dates.');
    const P = Exporter.pdfDoc(S().club), ps = squad(t);
    P.header('Bilan des entraînements', `${t.name} · du ${fd(from)} au ${fd(to)}`);
    const tot = trs.reduce((a, x) => a + x.presents.length, 0);
    P.facts([['Séances', String(trs.length)], ['Présents en moyenne', (tot / trs.length).toFixed(1).replace('.', ',')], ['Joueurs', String(ps.length)], ['Retards', String(trs.reduce((a, x) => a + (x.late || []).length, 0))]]);
    P.label('Présence de chaque joueur');
    P.table(['Joueur', 'Présent', '%', 'Retards', 'Absences (motif)'], ps.map(p => { const n = trs.filter(x => x.presents.includes(p.id)).length, l = trs.filter(x => (x.late || []).includes(p.id)).length;
      const why = trs.map(x => (x.absWhy || {})[p.id]).filter(Boolean); return [Store.fullName(p), `${n}/${trs.length}`, Math.round(n / trs.length * 100) + ' %', l ? String(l) : '', why.slice(0, 3).join(', ')]; })
      .sort((a, b) => parseInt(b[2]) - parseInt(a[2])), [.34, .12, .1, .1, .34]);
    P.label('Les séances');
    P.table(['Date', 'Séance', 'Présents', 'Exercices'], trs.map(x => [fd(x.date), x.title || 'Entraînement', String(x.presents.length), String((x.exercises || []).length)]), [.2, .5, .14, .16]);
    return deliver(P, `entrainements-${t.name}-${from}-${to}`);
  }

  // the lineup sheet to fill in at the side of the pitch
  function sheet(m) {
    const t = Store.get('teams', m.teamId), P = Exporter.pdfDoc(S().club), conv = (t ? Store.rosterOf(t.id) : []).filter(p => (m.convoked || []).includes(p.id));
    const list = conv.length ? conv : t ? squad(t) : [];
    P.header('Compo · bord du terrain', `${t ? t.name : ''} · ${m.home ? 'contre' : 'chez'} ${m.opponent || '?'} · ${fd(m.date)}`);
    P.para('À remplir au stylo pendant le match : entrées et sorties avec la minute, buts, passes, cartons.', 9.5);
    P.table(['N°', 'Joueur', 'Poste', 'Titu.', 'Entrée', 'Sortie', 'Buts', 'Passes', 'Cartons'], list.slice().sort((a, b) => (+Store.numOf(a, m) || 99) - (+Store.numOf(b, m) || 99) || Store.byName(a, b))
      .map(p => [String(Store.numOf(p, m) || ''), Store.fullName(p) + (m.captain === p.id ? ' (C)' : ''), People.postsLabel(p, true) || '', '[  ]', '', '', '', '', '']), [.06, .31, .1, .07, .09, .09, .08, .08, .12]);
    P.label('Score par période'); P.table(['', '1re période', '2e période', 'Prolongation', 'Tirs au but'], [['Nous', '', '', '', ''], ['Eux', '', '', '', '']], [.2, .2, .2, .2, .2]);
    P.label('Notes'); for (let i = 0; i < 6; i++) { P.ensure(8); P.doc.setDrawColor(200); P.doc.line(P.M, P.y + 6, P.M + P.CW, P.y + 6); P.y += 8; }
    return deliver(P, `compo-${m.opponent || 'match'}-${m.date}`);
  }

  // the choice on the team page
  function open(t) {
    const today = UI.today(), y = new Date(), start = `${y.getMonth() >= 7 ? y.getFullYear() : y.getFullYear() - 1}-08-01`;
    modal({ title: `📄 Documents · ${t.name}`, noFocus: true,
      body: `<div class="td-list"><button class="btn wide" data-td="roster">🧾 Fiches de tout l'effectif (${squad(t).length} joueurs)</button>
        <div class="td-box"><b>📅 Bilan des entraînements</b><div class="row2"><label class="fld"><span>Du</span><input type="date" id="tdFrom" value="${start}"></label><label class="fld"><span>Au</span><input type="date" id="tdTo" value="${today}"></label></div>
        <button class="btn wide" data-td="sessions">📅 Faire le bilan</button></div>
        <p class="muted small">La compo à remplir au stylo est sur chaque match (bouton « Compo papier »).</p></div>`,
      onOpen: (r, close) => r.addEventListener('click', e => {
        const b = e.target.closest('[data-td]'); if (!b) return;
        if (b.dataset.td === 'roster') { close(); run('Création des fiches…', () => roster(t)); }
        if (b.dataset.td === 'sessions') { const f = r.querySelector('#tdFrom').value, to = r.querySelector('#tdTo').value; close(); run('Création du bilan…', () => sessions(t, f, to)); }
      }), actions: [{ label: 'Fermer' }] });
  }
  return { open, roster, sessions, sheet };
})();
