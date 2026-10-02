/* Refs: the referees of the club. Each one says, for every official match at home (any category), if he can help
   (« dispo » / « pas dispo »), and writes the official matches he referees elsewhere (that day he is taken).
   The coaches and the responsable see who can help on each match, choose the referee of the match and can call for help.
   Kept on the referee's own record (staff.refAvail = { matchId: 'yes'|'no' }, staff.refGames = [{ id, date, time, comp, place }])
   and on the match (m.refId): nothing new on the server. */
const Refs = (() => {
  const { esc, $, $$, toast, modal, confirmBox } = UI;
  const S = () => Store.state;
  const isRef = p => !!p && /arbitre/i.test(p.role || '');
  const refs = () => S().staff.filter(isRef).sort(Store.byName);
  const me = () => Auth.current();
  const mine = () => me() && (isRef(me()) || (Auth.preview() || {}).role === 'arbitre') ? Store.get('staff', me().id) : null;
  // the official matches at home still to play, every category
  const homeMatches = () => S().matches.filter(m => m.home && !Store.isFriendly(m) && !m.played && (m.date || '') >= UI.today())
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  const teamName = id => (Store.get('teams', id) || {}).name || '';
  const when = m => `${UI.fmtDate(m.date)}${m.time ? ' · ' + m.time : ''}`;
  // a referee taken that day (an official match he referees elsewhere)
  const busy = (r, date) => (r.refGames || []).filter(g => g.date === date);
  const answer = (r, m) => (r.refAvail || {})[m.id] || (busy(r, m.date).length ? 'no' : '');
  const canChoose = m => Auth.isAdmin() || (Auth.sees(m.teamId) && !mine());

  // home: a referee sees what waits for his answer
  function waiting() { const r = mine(); return r ? homeMatches().filter(m => !answer(r, m)).length : 0; }

  function page(root) {
    const r = mine(), list = homeMatches(), all = refs();
    const row = m => {
      const ref = m.refId && Store.get('staff', m.refId);
      const yes = all.filter(x => answer(x, m) === 'yes'), no = all.filter(x => answer(x, m) === 'no');
      const myA = r ? answer(r, m) : '', taken = r ? busy(r, m.date) : [];
      return `<article class="card ref-m">
        <div class="row-head"><div><b>${esc(when(m))}</b> · ${esc(teamName(m.teamId))} contre ${esc(m.opponent || '?')}<div class="muted small">${esc(m.competition || 'Match officiel')}${m.place ? ' · ' + esc(m.place) : ''}</div></div>
          ${ref ? `<span class="tag">🟨 ${esc(Store.fullName(ref))}</span>` : '<span class="tag warn">Pas d\'arbitre du club</span>'}</div>
        ${r ? `<div class="chips">${m.refId === r.id ? '<span class="tag">🟨 Tu arbitres ce match</span>' : ''}
          <button class="chip ${myA === 'yes' ? 'on' : ''}" data-av="${m.id}" data-v="yes">✅ Dispo</button><button class="chip ${myA === 'no' ? 'on' : ''}" data-av="${m.id}" data-v="no">❌ Pas dispo</button>
          ${taken.length ? `<span class="muted small">⚠️ Tu arbitres ce jour-là : ${taken.map(g => esc((g.time || '') + ' ' + (g.comp || ''))).join(', ')}</span>` : ''}</div>` : ''}
        <p class="small">${yes.length ? `✅ Dispo : ${yes.map(x => `<b>${esc(Store.fullName(x))}</b>`).join(', ')}` : '<span class="muted">Personne de dispo pour l\'instant</span>'}${no.length ? ` <span class="muted">· ❌ ${no.map(x => esc(Store.fullName(x)) + (busy(x, m.date).length ? ' (arbitre ailleurs)' : '')).join(', ')}</span>` : ''}</p>
        ${canChoose(m) ? `<div class="chips"><button class="btn soft" data-pick="${m.id}">🟨<span>${ref ? 'Changer l\'arbitre' : 'Choisir l\'arbitre'}</span></button>${!ref ? `<button class="btn soft" data-help="${m.id}">📣<span>Appeler les arbitres</span></button>` : ''}</div>` : ''}
      </article>`;
    };
    root.innerHTML = `<header class="page-head"><div><h1>🟨 Arbitres du club</h1><p class="sub">Dépanner sur les matchs officiels à domicile, toutes catégories</p></div>
      <div class="head-actions"><a class="btn" href="#/club">${I.back}<span>Vie du club</span></a>${r ? `<button class="btn primary" data-act="game">${I.plus}<span>Un match où j'arbitre</span></button>` : ''}</div></header>
      ${r ? `<section class="card"><h2>Mes matchs où j'arbitre</h2><p class="muted small">Tes désignations officielles (district, ligue) : ces jours-là, tu es noté « pas dispo » pour le club.</p>
        ${(r.refGames || []).filter(g => g.date >= UI.today()).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))).map(g => `<div class="list-item"><span class="li-main"><b>${esc(UI.fmtDate(g.date))}${g.time ? ' · ' + esc(g.time) : ''}</b><span class="muted small">${esc(g.comp || 'Match officiel')}${g.place ? ' · ' + esc(g.place) : ''}</span></span><button class="icon-btn" data-delg="${g.id}" aria-label="Retirer">${I.x}</button></div>`).join('') || '<p class="muted small">Aucun pour l\'instant.</p>'}</section>`
        : !all.length ? `<section class="card"><p>Aucun arbitre dans le club pour l'instant. Dans <a href="#/dirigeants">Dirigeants</a>, mets le rôle <b>« Arbitre du club »</b> (ou « Arbitre bénévole ») : il pourra se connecter et donner ses disponibilités ici.</p></section>` : ''}
      <h2 class="section">Matchs officiels à domicile (${list.length})</h2>
      ${list.map(row).join('') || '<p class="muted">Aucun match officiel à domicile à venir.</p>'}
      ${all.length ? `<h2 class="section">Les arbitres du club (${all.length})</h2><div class="list">${all.map(x => { const y = list.filter(m => answer(x, m) === 'yes').length, n = list.filter(m => m.refId === x.id).length;
        return `<div class="list-item"><span class="li-main"><b>${esc(Store.fullName(x))}</b><span class="muted small">${esc(x.role || '')} · ${y} dispo${y > 1 ? 's' : ''} · ${n} match${n > 1 ? 's' : ''} arbitré${n > 1 ? 's' : ''} au club${(x.refGames || []).filter(g => g.date >= UI.today()).length ? ' · ' + (x.refGames || []).filter(g => g.date >= UI.today()).length + ' désignation(s) ailleurs' : ''}</span></span>${x.phone ? `<a class="btn soft" href="tel:${esc(x.phone)}">📞</a>` : ''}</div>`; }).join('')}</div>` : ''}`;

    root.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.av) {
        const st = mine(); if (!st) return;
        st.refAvail = Object.assign({}, st.refAvail || {}); if (st.refAvail[b.dataset.av] === b.dataset.v) delete st.refAvail[b.dataset.av]; else st.refAvail[b.dataset.av] = b.dataset.v;
        Store.upsert('staff', st); return page(root);
      }
      if (b.dataset.act === 'game') return addGame(() => page(root));
      if (b.dataset.delg) { const st = mine(); st.refGames = (st.refGames || []).filter(g => g.id !== b.dataset.delg); Store.upsert('staff', st); return page(root); }
      if (b.dataset.pick) return pick(Store.get('matches', b.dataset.pick), () => page(root));
      if (b.dataset.help) return callHelp(Store.get('matches', b.dataset.help));
    };
  }

  function addGame(done) {
    modal({ title: 'Un match où j\'arbitre', body: `<p class="muted small">Une désignation officielle ailleurs : ce jour-là, tu es noté « pas dispo » pour les matchs du club.</p>
      <div class="row2"><label class="fld"><span>Date</span><input type="date" id="rgDate" value="${UI.today()}"></label><label class="fld"><span>Heure</span><input type="time" id="rgTime"></label></div>
      <label class="fld"><span>Compétition / catégorie</span><input id="rgComp" placeholder="ex : U17 D1, Seniors R3" maxlength="80"></label>
      <label class="fld"><span>Lieu</span><input id="rgPlace" placeholder="ex : stade de Bondy" maxlength="80"></label>`,
      actions: [{ label: 'Annuler' }, { label: 'Ajouter', kind: 'primary', onClick: (c, r) => {
        const st = mine(), date = $('#rgDate', r).value; if (!date) { toast('Choisis la date', 'err'); return false; }
        st.refGames = [...(st.refGames || []), { id: Store.uid(), date, time: $('#rgTime', r).value, comp: $('#rgComp', r).value.trim(), place: $('#rgPlace', r).value.trim() }];
        Store.upsert('staff', st); toast('Ajouté'); done();
      } }] });
  }

  // the coach or the responsable chooses the referee of the match: those who said yes first
  function pick(m, done) {
    if (!m) return;
    const all = refs(), order = x => ({ yes: 0, '': 1, no: 2 })[answer(x, m)];
    const close = modal({ title: `Arbitre · ${when(m)}`, noFocus: true, body: `<div class="list">${all.sort((a, b) => order(a) - order(b)).map(x => { const a = answer(x, m), t = busy(x, m.date);
        return `<button class="list-item hl-pickrow" data-rf="${x.id}"><span class="li-main"><b>${a === 'yes' ? '✅' : a === 'no' ? '❌' : '❔'} ${esc(Store.fullName(x))}</b><span class="muted small">${a === 'yes' ? 'Dispo' : a === 'no' ? 'Pas dispo' : 'Pas encore répondu'}${t.length ? ' · arbitre ailleurs ce jour-là' : ''}</span></span></button>`; }).join('') || '<p class="muted">Aucun arbitre dans le club.</p>'}</div>
      ${m.refId ? '<button type="button" class="btn danger wide" data-rf="">Retirer l\'arbitre</button>' : ''}`,
      onOpen: r => $$('[data-rf]', r).forEach(b => b.onclick = () => {
        const prev = m.refId; m.refId = b.dataset.rf || null; Store.upsert('matches', m); close(); done();
        const ref = m.refId && Store.get('staff', m.refId);
        if (ref) { toast(`${Store.fullName(ref)} arbitre ce match`); tell(ref, `🟨 Tu arbitres ${teamName(m.teamId)} contre ${m.opponent || '?'}, ${when(m)}${m.place ? ' (' + m.place + ')' : ''}. Merci !`); }
        else if (prev) toast('Arbitre retiré');
      }) });
  }
  const tell = (ref, text) => { const u = me(); if (Cloud.ready() && u && ref.id !== u.id) Cloud.post('dm:' + [u.id, ref.id].sort().join(':'), text).catch(() => {}); };
  // no referee yet: a private message to every referee who is not taken that day
  async function callHelp(m) {
    if (!m) return;
    const to = refs().filter(x => answer(x, m) !== 'no' && x.id !== (me() || {}).id);
    if (!to.length) return toast('Aucun arbitre disponible à prévenir', 'err');
    if (!Cloud.ready()) return toast('Il faut être connecté au serveur du club', 'err');
    if (!await confirmBox(`Envoyer un message à ${to.length} arbitre${to.length > 1 ? 's' : ''} pour ${teamName(m.teamId)} contre ${m.opponent || '?'} (${when(m)}) ?`, 'Envoyer')) return;
    to.forEach(x => tell(x, `📣 Besoin d'un arbitre : ${teamName(m.teamId)} contre ${m.opponent || '?'}, ${when(m)}${m.place ? ' (' + m.place + ')' : ''}, ${m.competition || 'match officiel'}. Si tu peux, mets « Dispo » dans l'appli (Vie du club → Arbitres).`));
    toast('Message envoyé aux arbitres');
  }

  return { page, isRef, waiting, refs };
})();
