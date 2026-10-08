/* People: club-wide players and staff (dirigeants), their contact details and their categories. */
const People = (() => {
  const { esc, $, $$, toast, modal, confirmBox } = UI;
  const S = () => Store.state;
  const POS = [['', '–'], ['GB', 'Gardien'], ['DEF', 'Défenseur'], ['MIL', 'Milieu'], ['ATT', 'Attaquant']];
  const SUBCATS = ['Senior', 'Senior U20', 'Vétéran', 'U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'U19'];
  const ROLES = ['Éducateur', 'Éducateur adjoint', 'Responsable de catégorie', 'Dirigeant', 'Accompagnateur', 'Entraîneur des gardiens', 'Arbitre du club', 'Arbitre bénévole', 'Intendant', 'Président', 'Vice-président', 'Secrétaire', 'Trésorier', 'Autre'];
  const RELS = ['Mère', 'Père', 'Tuteur', 'Autre'];
  // Which category (team) gathers each licence sub-category
  // Footclubs sub-category → category of the club (no U18 / U19 / U20 at the club: those players are in Seniors)
  const TEAM_OF_SUB = { 'Vétéran': 'Vétérans', 'Senior': 'Seniors', 'Senior U20': 'Seniors', U19: 'Seniors', U18: 'Seniors', U17: 'U17', U16: 'U16', U15: 'U15', U14: 'U14', U13: 'U13', U12: 'U12', U11: 'U11', U10: 'U10', U9: 'U9', U8: 'U8', U7: 'U7', U6: 'U6' };
  const FORMAT_OF_TEAM = { U7: '5', U9: '5', U11: '8', U13: '8' };

  /* Positions: a main position and possibly others. p.posts = [main, ...others]; p.pos keeps the line (GB, DEF, MIL, ATT)
     that the lineups use. Old players only have p.pos (a line): it is shown as « Défenseur », « Milieu »… */
  // [code, name, abbreviation, type]. The first one of each type is the type itself (« Défenseur », without more detail)
  const POSTS = Sport.POSTS, OLD_POSTS = [['GB', 'Gardien', 'G', 'GB'],
    ['DEF', 'Défenseur', 'DEF', 'DEF'], ['DC', 'Défenseur central', 'DC', 'DEF'], ['LD', 'Latéral droit', 'LD', 'DEF'], ['LG', 'Latéral gauche', 'LG', 'DEF'],
    ['MIL', 'Milieu', 'MIL', 'MIL'], ['MDC', 'Milieu défensif', 'MDC', 'MIL'], ['MC', 'Milieu relayeur', 'MC', 'MIL'], ['MOC', 'Milieu offensif', 'MOC', 'MIL'], ['MD', 'Milieu droit', 'MD', 'MIL'], ['MG', 'Milieu gauche', 'MG', 'MIL'],
    ['ATT', 'Attaquant', 'ATT', 'ATT'], ['AD', 'Ailier droit', 'AD', 'ATT'], ['AG', 'Ailier gauche', 'AG', 'ATT'], ['SA', 'Second attaquant', 'SA', 'ATT'], ['BU', 'Avant-centre', 'BU', 'ATT']];
  const TYPES = Sport.TYPES;
  const subsOf = type => POSTS.filter(x => x[3] === type && x[0] !== type); // the precise positions of a type
  const LINES = Sport.LINES;
  const postOf = c => POSTS.find(x => x[0] === c);
  const postsOf = p => (Array.isArray(p.posts) && p.posts.length ? p.posts : p.pos ? [p.pos] : []).filter(postOf);
  const lineOf = p => { const m = postsOf(p)[0]; return m ? postOf(m)[3] : ''; };
  const postsLabel = (p, short) => postsOf(p).map(c => postOf(c)[short ? 2 : 1]).join(short ? '/' : ' · ');
  const hasPost = (p, c) => postsOf(p).some(x => x === c || postOf(x)[3] === c); // « DEF » also finds the central and full backs
  // Players in the chosen order: 'name' (default), 'num', or 'post' (goalkeepers, defenders, midfielders, forwards)
  function sortPlayers(list, mode) {
    const l = list.slice(), num = p => (p.number === '' || p.number == null ? 999 : +p.number);
    if (mode === 'num') return l.sort((a, b) => num(a) - num(b) || Store.byName(a, b));
    if (mode === 'post') {
      const rk = p => { const i = LINES.findIndex(x => x[0] === lineOf(p)); return i < 0 ? 9 : i; }, pk = p => { const m = postsOf(p)[0]; return m ? POSTS.findIndex(x => x[0] === m) : 99; };
      return l.sort((a, b) => rk(a) - rk(b) || pk(a) - pk(b) || Store.byName(a, b));
    }
    return l.sort(Store.byName);
  }
  // Same list cut by line, for headings: [[« Gardiens », players], …]
  const byLine = list => LINES.map(([k, lab]) => [lab, sortPlayers(list.filter(p => lineOf(p) === k), 'post')]).filter(x => x[1].length);
  const sortBar = (cur, key = 'sort') => `<span class="sort-bar" role="group" aria-label="Trier"><span class="muted small">Trier :</span>${[['name', 'Nom'], ['num', 'N°'], ['post', 'Poste']].map(([v, l]) => `<button type="button" class="chip ${(cur || 'name') === v ? 'on' : ''}" data-${key}="${v}">${l}</button>`).join('')}</span>`;
  // A list of player rows, cut by line when sorted by position
  const rowsOf = (list, mode, row) => mode === 'post' ? byLine(list).map(([lab, ps]) => `<h3 class="line-h">${esc(lab)} (${ps.length})</h3>${ps.map(row).join('')}`).join('') : sortPlayers(list, mode).map(row).join('');

  /* Phone of a dirigeant: each one chooses who sees it (Mon compte). 'resp': the responsables only, 'club': every dirigeant (default),
     'parents': also the parents of his categories, on their page */
  const PHONE_SHOW = [['resp', 'Seulement les responsables du club'], ['club', 'Tous les éducateurs et dirigeants du club'], ['parents', 'Les éducateurs, et les parents de mes catégories']];
  const me = () => Auth.current();
  const phoneVisible = s => !!s.phone && (Auth.isAdmin() || (me() && me().id === s.id) || (s.phoneShow || 'club') !== 'resp');
  const staffPhone = s => phoneVisible(s) ? s.phone : '';

  const name = Store.fullName;
  const age = iso => { if (!iso) return ''; const b = new Date(iso + 'T12:00'), n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a; };
  const fmtBirth = iso => iso ? iso.split('-').reverse().join('/') : '';
  const telHref = n => 'tel:' + String(n).replace(/[^\d+]/g, '');
  const tel = (n, label) => n ? `<a class="tel" href="${telHref(n)}">${I.phone}<span>${label ? esc(label) + ' : ' : ''}${esc(n)}</span></a>` : '';
  const teamNames = ids => (ids || []).map(id => (Store.get('teams', id) || {}).name).filter(Boolean).join(', ');
  const phonesOf = p => [p.phone, ...(p.parents || []).map(x => x.phone)].filter(Boolean);
  // A dirigeant who is also a licensed player: same nom and same first prénom (without accents or capitals)
  const nk = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
  const firstOf = s => nk(String(s || '').replace(/\(.*\)/, '')).split(' ')[0];
  // « Giova (Christian) » also matches the licence « Christian »
  const firstsOf = s => [firstOf(s), ...(String(s || '').match(/\(([^)]*)\)/g) || []).map(m => firstOf(m.slice(1, -1)))].filter(Boolean);
  const playerLike = p => S().players.find(x => nk(x.lastName) === nk(p.lastName) && firstsOf(p.firstName).includes(firstOf(x.firstName)));
  const linkPlayer = p => { if (!p.playerId || !Store.get('players', p.playerId)) { const x = playerLike(p); if (x) p.playerId = x.id; } };

  /* ---------- rows ---------- */
  function playerRow(p, teamId, groups) {
    const sub = [postsLabel(p), p.subcat, p.birth ? `${age(p.birth)} ans` : '', teamId ? '' : teamNames(p.teamIds), S().staff.some(x => x.playerId === p.id) ? 'aussi dirigeant' : ''].filter(Boolean).join(' · ');
    // Groups A / B of the category: one touch puts the player in A or in B (touch his group again: no group)
    const ab = groups ? `<span class="ab" role="group" aria-label="Groupe de ${esc(name(p))}">${groups.subs.map(g => `<button type="button" class="ab-b ${(p.teamIds || []).includes(g.id) ? 'on' : ''}" data-ab="${g.id}" data-p="${p.id}" aria-label="Mettre ${esc(name(p))} en ${esc(g.name)}">${esc(g.name.trim().slice(-1))}</button>`).join('')}</span>` : '';
    return `<div class="person">
      <button class="person-main" data-person="${p.id}" data-kind="player">
        <span class="pnum">${esc(p.number || '')}</span>
        <span class="pmain"><b>${esc(name(p))}</b><span class="muted">${esc(sub) || '&nbsp;'}</span></span>
        ${teamId ? pctBadge(attendance(p, teamId)) : ''}
        ${phonesOf(p).length ? `<span class="has-tel" title="Téléphone renseigné">${I.phone}</span>` : ''}
      </button>${ab}
      ${teamId ? `<button class="icon-btn" data-unlink="${p.id}" data-kind="player" aria-label="Retirer ${esc(name(p))} de la catégorie">${I.x}</button>` : ''}
    </div>`;
  }
  function staffRow(p, teamId) {
    return `<div class="person">
      <button class="person-main" data-person="${p.id}" data-kind="staff">
        <span class="pnum role">${I.whistle}</span>
        <span class="pmain"><b>${esc(name(p))}${p.blocked ? ' 🚫' : p.selfJoined ? ' 🆕' : ''}</b>${UI.motto(p)}<span class="muted">${esc(p.role || '')}${teamId ? '' : ' · ' + esc(teamNames(p.teamIds) || 'aucune catégorie')}${p.playerId && Store.get('players', p.playerId) ? ' · aussi joueur (' + esc(teamNames(Store.get('players', p.playerId).teamIds)) + ')' : ''}</span></span>
      </button>
      ${staffPhone(p) ? `<a class="icon-btn" href="${telHref(p.phone)}" aria-label="Appeler ${esc(name(p))}">${I.phone}</a>` : ''}
      ${teamId ? `<button class="icon-btn" data-unlink="${p.id}" data-kind="staff" aria-label="Retirer ${esc(name(p))} de la catégorie">${I.x}</button>` : ''}
    </div>`;
  }
  const teamChips = ids => `<div class="chips" id="pTeams">${Store.teamGroups(Auth.teams()).map(g => `<span class="team-fam">${g.map(t => `<button type="button" class="chip ${Store.isSub(t) ? 'sub' : ''} ${(ids || []).includes(t.id) ? 'on' : ''}" data-t="${t.id}">${esc(t.name)}</button>`).join('')}</span>`).join('') ||'<p class="muted">Crée d\'abord une catégorie dans Équipes.</p>'}</div>`;
  const bindChips = r => $$('#pTeams .chip', r).forEach(b => b.onclick = () => b.classList.toggle('on'));
  // Chips only show the categories this dirigeant sees: the other categories of the person are kept as they were
  const pickedTeams = (r, before = []) => [...before.filter(id => !Auth.teams().some(t => t.id === id)), ...$$('#pTeams .chip.on', r).map(b => b.dataset.t)];
  // (a value that is not in the list, e.g. a role typed elsewhere, is kept as the first choice instead of being lost)
  const opt = (list, cur) => (cur && !list.some(v => (Array.isArray(v) ? v[0] : v) === cur) ? `<option selected>${esc(cur)}</option>` : '') + list.map(v => Array.isArray(v) ? `<option value="${esc(v[0])}" ${v[0] === cur ? 'selected' : ''}>${esc(v[1])}</option>` : `<option ${v === cur ? 'selected' : ''}>${esc(v)}</option>`).join('');

  /* ---------- the same player twice (e.g. created again in the category where he plays « surclassé ») ---------- */
  const twinKey = x => String(x.lastName || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '') + '|' + String(x.firstName || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
  const twinOf = d => S().players.find(x => twinKey(x) === twinKey(d) && (!d.birth || !x.birth || x.birth === d.birth));
  function twinDialog(twin, p, data, opts) {
    modal({ title: 'Ce joueur existe déjà', noFocus: true,
      body: `<p><b>${esc(name(twin))}</b>${twin.birth ? `, né(e) le ${esc(fmtBirth(twin.birth))}` : ''}, est déjà dans le club : ${esc(teamNames(twin.teamIds) || 'sans catégorie')}.</p>
        <p>Plutôt qu'une 2e fiche, ajoute-le à ta catégorie : un joueur peut être dans plusieurs catégories (surclassé, équipe A / B). Ses matchs, séances et stats restent sur une seule fiche.</p>`,
      actions: [{ label: 'Créer quand même', onClick: () => { Object.assign(p, data); Store.upsert('players', p); toast('Enregistré'); opts.onSave && opts.onSave(p); } },
        { label: 'Ajouter à ma catégorie', kind: 'primary', icon: I.check, onClick: () => {
          twin.teamIds = [...new Set([...(twin.teamIds || []), ...(data.teamIds || [])])];
          ['number', 'pos', 'posts', 'phone', 'email', 'birth'].forEach(k => { if ((twin[k] == null || twin[k] === '' || (Array.isArray(twin[k]) && !twin[k].length)) && data[k] != null && data[k] !== '') twin[k] = data[k]; });
          if (!(twin.parents || []).length && (data.parents || []).length) twin.parents = data.parents;
          if (data.notes && !(twin.notes || '').includes(data.notes)) twin.notes = [twin.notes, data.notes].filter(Boolean).join('\n');
          Store.upsert('players', twin); toast(`${Store.shortName(twin)} ajouté à la catégorie`); opts.onSave && opts.onSave(twin); } }] });
  }

  /* ---------- player sheet ---------- */
  function editPlayer(p, opts = {}) {
    const isNew = !p;
    p = p || { id: Store.uid(), lastName: '', firstName: '', birth: '', subcat: '', number: '', pos: '', phone: '', email: '', parents: [], notes: '', teamIds: opts.teamId ? [opts.teamId] : [] };
    const par = i => (p.parents || [])[i] || { name: '', rel: i ? 'Père' : 'Mère', phone: '' };
    const parentBlock = i => `<fieldset class="parent"><legend>Parent ${i + 1}</legend>
      <div class="row2"><label class="fld"><span>Nom et prénom</span><input id="par${i}n" value="${esc(par(i).name)}"></label>
      <label class="fld"><span>Lien</span><select id="par${i}r">${opt(RELS, par(i).rel)}</select></label></div>
      <label class="fld"><span>Téléphone</span><input id="par${i}t" type="tel" inputmode="tel" value="${esc(par(i).phone)}" placeholder="06 12 34 56 78"></label>
      ${par(i).phone ? tel(par(i).phone, 'Appeler') : ''}</fieldset>`;
    modal({
      title: isNew ? 'Nouveau joueur' : name(p),
      body: `<div class="row2"><label class="fld"><span>Nom</span><input id="pLast" value="${esc(p.lastName)}" autocapitalize="characters"></label>
        <label class="fld"><span>Prénom</span><input id="pFirst" value="${esc(p.firstName)}"></label></div>
        <div class="row3"><label class="fld"><span>Né(e) le</span><input id="pBirth" type="date" value="${esc(p.birth || '')}"></label>
        <label class="fld"><span>Sous-catégorie</span><select id="pSub"><option value="">–</option>${opt(SUBCATS, p.subcat)}</select></label>
        <label class="fld"><span>Numéro</span><input id="pNum" type="number" min="0" max="99" value="${esc(p.number)}"></label>
        <input type="hidden" id="pPos" value="${esc(postsOf(p)[0] || '')}"></div>
        <div class="lbl">Poste principal</div><div id="pMain">${mainPicker(postsOf(p)[0] || '')}</div>
        <details class="posts-more" ${postsOf(p).length > 1 ? 'open' : ''}><summary>Autres postes possibles${postsOf(p).length > 1 ? ` (${postsOf(p).length - 1})` : ''}</summary><div id="pPosts">${TYPES.map(([t, l]) => `<div class="post-group"><span class="muted small">${esc(l)}</span><div class="chips">${POSTS.filter(x => x[3] === t).map(x => `<button type="button" class="chip ${postsOf(p).slice(1).includes(x[0]) ? 'on' : ''}" data-post="${x[0]}">${postChip(x)}</button>`).join('')}</div></div>`).join('')}</div></details>
        <div class="lbl">Catégories (plusieurs possibles)</div>${teamChips(p.teamIds)}
        <h3 class="sub-h">Contacts</h3>
        <div class="row2"><label class="fld"><span>Téléphone du joueur</span><input id="pTel" type="tel" inputmode="tel" value="${esc(p.phone || '')}"></label>
        <label class="fld"><span>E-mail</span><input id="pMail" type="email" inputmode="email" value="${esc(p.email || '')}"></label></div>
        ${p.phone ? tel(p.phone, 'Appeler') : ''}
        ${parentBlock(0)}${parentBlock(1)}
        <label class="fld"><span>Infos utiles (santé, allergies, transport…)</span><textarea id="pNotes" rows="3">${esc(p.notes || '')}</textarea></label>
        ${isNew ? '' : notesHistory(p)}`,
      onOpen: r => {
        bindChips(r);
        $$('#pPosts .chip', r).forEach(b => b.onclick = () => b.classList.toggle('on'));
        // main position: touch a type (Défenseur…), then if you want a precise position (DC, LD…)
        $('#pMain', r).onclick = e => { const b = e.target.closest('[data-main]'); if (!b) return; $('#pPos', r).value = b.dataset.main; $('#pMain', r).innerHTML = mainPicker(b.dataset.main); };
        // A new date of birth selects the matching category (U6 … U17, Seniors, Vétérans)
        $('#pBirth', r).onchange = e => {
          const cat = catOf({ birth: e.target.value, subcat: $('#pSub', r).value }); if (!cat) return;
          const t = findCat(cat); if (!t) return;
          $$('#pTeams .chip', r).forEach(b => { const tm = Store.get('teams', b.dataset.t); if (tm && isAgeTeam(tm)) b.classList.toggle('on', b.dataset.t === t.id); });
        };
      },
      actions: [
        ...(isNew ? [] : [{ label: 'Supprimer', kind: 'danger', icon: I.trash, onClick: () => { setTimeout(() => confirmBox(`Supprimer ${name(p)} de tout le club ?`).then(ok => { if (ok) { Store.remove('players', p.id); toast('Joueur supprimé'); opts.onSave && opts.onSave(); } }), 60); } }]),
        { label: 'Annuler' },
        { label: 'Enregistrer', kind: 'primary', onClick: (c, r) => {
          const v = id => $('#' + id, r).value.trim();
          if (!v('pLast') && !v('pFirst')) { toast('Écris au moins le nom ou le prénom', 'err'); return false; }
          const data = { lastName: v('pLast').toUpperCase(), firstName: v('pFirst'), birth: v('pBirth'), subcat: v('pSub'), number: v('pNum') === '' ? '' : +v('pNum'), ...readPosts(r, v('pPos')), phone: v('pTel'), email: v('pMail'), notes: $('#pNotes', r).value, teamIds: pickedTeams(r, p.teamIds || []),
            parents: [0, 1].map(i => ({ name: v(`par${i}n`), rel: v(`par${i}r`), phone: v(`par${i}t`) })).filter(x => x.name || x.phone) };
          // a new player who is already in the club (same name, same date of birth): add him to this category instead of a 2nd card
          const twin = isNew && twinOf(data);
          if (twin) { setTimeout(() => twinDialog(twin, p, data, opts), 60); return; }
          Object.assign(p, data);
          Store.upsert('players', p); toast('Enregistré'); opts.onSave && opts.onSave(p);
        } },
      ],
    });
  }

  // « DC · Défenseur central » (the abbreviation, then the name)
  const postChip = x => x[0] === x[3] || x[0] === 'GB' ? `<b>${esc(x[1])}</b>` + (x[0] === 'GB' ? '' : ' <i class="muted">sans précision</i>') : `<b>${esc(x[2])}</b> · ${esc(x[1])}`;
  function mainPicker(cur) {
    const type = cur ? postOf(cur)[3] : '';
    return `<div class="chips">${TYPES.map(([t, l]) => `<button type="button" class="chip ${type === t ? 'on' : ''}" data-main="${t}">${esc(l)}</button>`).join('')}${cur ? '<button type="button" class="chip" data-main="">✕ Aucun</button>' : ''}</div>` +
      (type && subsOf(type).length ? `<div class="chips sub-posts">${[[type, 'Pas de précision']].concat(subsOf(type).map(x => [x[0], x])).map(([c, x]) => `<button type="button" class="chip ${cur === c ? 'on' : ''}" data-main="${c}">${typeof x === 'string' ? esc(x) : postChip(x)}</button>`).join('')}</div>` : '');
  }
  // Main position first, then the other ones ticked (p.pos = its line, for the lineups)
  function readPosts(r, main) {
    const posts = [main, ...$$('#pPosts .chip.on', r).map(b => b.dataset.post).filter(c => c !== main)].filter(Boolean);
    return { posts, pos: posts.length ? postOf(posts[0])[3] : '' };
  }
  function notesHistory(p) {
    const h = Ratings.history(p.id); if (!h.length) return '';
    const am = Ratings.average(p.id, 'match'), at = Ratings.average(p.id, 'training');
    return `<h3 class="sub-h">⭐ Notes des dirigeants</h3>
      <p class="muted">${am ? 'Matchs : ' + Ratings.fr(am) + '/10' : ''}${am && at ? ' · ' : ''}${at ? 'Entraînements : ' + Ratings.fr(at) + '/10' : ''}</p>
      <ul class="notes-list">${h.slice(0, 12).map(x => `<li><span class="note-ro" aria-label="${x.v} sur 10"><b>${x.v}</b>/10</span>
        <span><b>${x.kind === 'match' ? 'Match contre ' + esc(x.ev.opponent || '') : esc(x.ev.title || 'Entraînement')}</b> · ${esc(UI.fmtDate(x.date))}${x.by ? ' · ' + esc(Store.fullName(x.by)) : ''}${x.c ? `<br><span class="muted">« ${esc(x.c)} »</span>` : ''}</span></li>`).join('')}</ul>`;
  }

  /* ---------- staff sheet ---------- */
  // Who may change a dirigeant's phone: himself, a responsable, or whoever makes a new card
  const canPhone = (p, isNew) => isNew || Auth.isAdmin() || (me() && me().id === p.id);
  function editStaff(p, opts = {}) {
    const isNew = !p;
    p = p || { id: Store.uid(), lastName: '', firstName: '', role: 'Éducateur', phone: '', email: '', notes: '', teamIds: opts.teamId ? [opts.teamId] : [] };
    modal({
      title: isNew ? 'Nouveau dirigeant' : name(p),
      body: `<div class="row2"><label class="fld"><span>Nom</span><input id="sLast" value="${esc(p.lastName)}" autocapitalize="characters"></label>
        <label class="fld"><span>Prénom</span><input id="sFirst" value="${esc(p.firstName)}"></label></div>
        <div class="row2"><label class="fld"><span>Rôle</span><select id="sRole">${opt(ROLES, p.role)}</select></label>
        <label class="fld"><span>Club de cœur (son blason s'affiche dans les messages)</span><select id="sClub">${Clubs.options(p.club)}</select></label></div>
        <label class="fld"><span>Petite phrase (drôle ou philosophique, à côté de son nom)</span><input id="sMotto" value="${esc(p.motto || '')}" maxlength="${UI.MOTTO_MAX}"></label>
        <div class="lbl">Catégories (plusieurs possibles)</div>${Auth.isAdmin() || isNew ? teamChips(p.teamIds) : `<p class="tip">🔒 ${esc(teamNames(p.teamIds) || 'Aucune catégorie')} · seul un responsable peut changer les catégories d'un dirigeant.</p>`}
        ${canPhone(p, isNew) ? `<div class="row2"><label class="fld"><span>Téléphone</span><input id="sTel" type="tel" inputmode="tel" value="${esc(p.phone || '')}"></label>
        <label class="fld"><span>Qui voit ce numéro ?</span><select id="sShow">${PHONE_SHOW.map(([v, l]) => `<option value="${v}" ${(p.phoneShow || 'club') === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label></div>`
          : `<p class="muted small">${!p.phone ? 'Pas de numéro. Chaque dirigeant peut ajouter le sien dans Réglages → Mon compte.' : staffPhone(p) ? '' : '📵 Numéro masqué : ce dirigeant le montre seulement aux responsables.'}</p>`}
        ${staffPhone(p) ? tel(p.phone, 'Appeler') : ''}
        <label class="fld"><span>E-mail</span><input id="sMail" type="email" inputmode="email" value="${esc(p.email || '')}"></label>
        ${S().players.length ? (() => { const sel = p.playerId || (playerLike(p) || {}).id || ''; return `<label class="fld"><span>Aussi joueur licencié ?</span><select id="sPlayer"><option value="">Non</option>
          ${S().players.slice().sort(Store.byName).map(x => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(name(x))}${x.teamIds && x.teamIds.length ? ' · ' + esc(teamNames(x.teamIds)) : ''}</option>`).join('')}</select></label>`; })() : ''}
        <label class="fld"><span>Infos (diplôme, licence, disponibilités…)</span><textarea id="sNotes" rows="3">${esc(p.notes || '')}</textarea></label>`,
      onOpen: bindChips,
      actions: [
        ...(!isNew && Auth.isAdmin() && Cloud.ready() && !p.blocked ? [{ label: '📲 Envoyer son lien', onClick: () => { setTimeout(() => Cloud.invitePerson(p), 60); } }] : []),
        ...(isNew ? [] : [{ label: 'Supprimer', kind: 'danger', icon: I.trash, onClick: () => { setTimeout(() => confirmBox(`Supprimer ${name(p)} ? Son compte est supprimé aussi : il est déconnecté de l'appli.`).then(ok => { if (ok) { Store.remove('staff', p.id); Auth.forget(p.id); toast('Dirigeant supprimé'); opts.onSave && opts.onSave(); } }), 60); } }]),
        { label: 'Annuler' },
        { label: 'Enregistrer', kind: 'primary', onClick: (c, r) => {
          const v = id => $('#' + id, r).value.trim();
          if (!v('sLast') && !v('sFirst')) { toast('Écris au moins le nom ou le prénom', 'err'); return false; }
          Object.assign(p, { lastName: v('sLast').toUpperCase(), firstName: v('sFirst'), role: v('sRole'), club: v('sClub'), motto: v('sMotto').replace(/\s+/g, ' '), email: v('sMail'), notes: $('#sNotes', r).value });
          if ($('#sTel', r)) { p.phone = v('sTel'); p.phoneShow = v('sShow') || 'club'; }
          if (Auth.isAdmin() || isNew) p.teamIds = pickedTeams(r, p.teamIds || []);
          const sp = $('#sPlayer', r); if (sp) { if (sp.value) p.playerId = sp.value; else delete p.playerId; }
          Store.upsert('staff', p); toast('Enregistré'); opts.onSave && opts.onSave(p);
          if (isNew && Auth.isAdmin() && Cloud.ready()) setTimeout(() => Cloud.invitePerson(p), 500); // and his link to send
        } },
      ],
    });
  }

  /* ---------- dropdowns ---------- */
  // Select listing people not yet in the team, grouped by their categories
  function addSelect(kind, teamId, label) {
    const list = (kind === 'player' ? S().players : S().staff).filter(p => Auth.seesPerson(p) && !(p.teamIds || []).includes(teamId)).sort(Store.byName);
    const groups = new Map();
    list.forEach(p => { const g = teamNames(p.teamIds) || 'Sans catégorie'; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(p); });
    return `<select class="add-select" data-add="${kind}" aria-label="${esc(label)}"><option value="">${esc(label)}</option>
      ${[...groups].map(([g, ps]) => `<optgroup label="${esc(g)}">${ps.map(p => `<option value="${p.id}">${esc(name(p))}${kind === 'staff' && p.role ? ' · ' + esc(p.role) : ''}</option>`).join('')}</optgroup>`).join('')}</select>`;
  }
  // Staff picker for a training or a match: category staff first
  function staffPicker(teamId, chosen) {
    const all = S().staff.slice().sort(Store.byName), mine = all.filter(p => (p.teamIds || []).includes(teamId)), others = all.filter(p => !mine.includes(p));
    const chips = (chosen || []).map(id => Store.get('staff', id)).filter(Boolean)
      .map(p => `<span class="chip on staff-chip">${I.whistle}${esc(name(p))}<button class="x" data-unstaff="${p.id}" aria-label="Retirer ${esc(name(p))}">${I.x}</button></span>`).join('');
    const o = ps => ps.filter(p => !(chosen || []).includes(p.id)).map(p => `<option value="${p.id}">${esc(name(p))}${p.role ? ' · ' + esc(p.role) : ''}</option>`).join('');
    return `<div class="chips">${chips}</div>
      <select class="add-select" data-staffpick aria-label="Ajouter un encadrant"><option value="">Ajouter un encadrant…</option>
      ${mine.length ? `<optgroup label="De la catégorie">${o(mine)}</optgroup>` : ''}${others.length ? `<optgroup label="Autres dirigeants">${o(others)}</optgroup>` : ''}</select>
      ${!all.length ? '<p class="tip">Ajoute les dirigeants dans Équipes → Dirigeants.</p>' : ''}`;
  }

  /* ---------- team sections (inside a category page) ---------- */
  // A category (« U15 ») with its teams A and B, or one of these teams: the groups the players can be moved between
  function groupsOf(t) {
    const key = catKey(t.category || t.name), base = isSubTeam(t) ? findCat(t.category || '') : t;
    const subs = S().teams.filter(x => isSubTeam(x) && catKey(x.category) === key).sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return subs.length >= 2 ? { base: base && !isSubTeam(base) ? base : null, subs } : null;
  }
  function moveGroup(p, target, g) {
    const had = (p.teamIds || []).includes(target);
    p.teamIds = (p.teamIds || []).filter(id => !g.subs.some(s => s.id === id));
    if (!had) { p.teamIds.push(target); if (g.base && !p.teamIds.includes(g.base.id)) p.teamIds.push(g.base.id); }
    Store.upsert('players', p);
    toast(had ? `${name(p)} n'est plus dans un groupe` : `${name(p)} → ${Store.get('teams', target).name}`);
  }
  function teamSections(t) {
    const ps = Store.playersOf(t.id), st = Store.staffOf(t.id), g = groupsOf(t);
    const count = g ? g.subs.map(s => `${esc(s.name)} : ${ps.filter(p => (p.teamIds || []).includes(s.id)).length}`).join(' · ') + (isSubTeam(t) ? '' : ` · sans groupe : ${ps.filter(p => !g.subs.some(s => (p.teamIds || []).includes(s.id))).length}`) : '';
    return `<section class="card">
        <div class="row-head"><h2>${I.team}Joueurs (${ps.length})</h2>
          <div class="chips"><button class="btn primary" data-newplayer>${I.plus}<span>Nouveau joueur</span></button></div></div>
        ${g ? `<p class="tip">Groupes : touche ${g.subs.map(s => `<b>${esc(s.name.trim().slice(-1))}</b>`).join(' ou ')} à côté d'un joueur pour le changer de groupe (touche encore : plus de groupe).<br>${count}</p>` : ''}
        ${addSelect('player', t.id, 'Ajouter un joueur d\'une autre catégorie…')}
        ${ps.length ? sortBar(S().ui.peopleSort, 'psort') : ''}
        <div class="people">${rowsOf(ps, S().ui.peopleSort, p => playerRow(p, t.id, g)) || '<p class="muted">Aucun joueur dans cette catégorie.</p>'}</div>
      </section>
      <section class="card">
        <div class="row-head"><h2>${I.whistle}Encadrement (${st.length})</h2>
          <button class="btn" data-newstaff>${I.plus}<span>Nouveau dirigeant</span></button></div>
        ${Auth.isAdmin() ? addSelect('staff', t.id, 'Ajouter un dirigeant existant…') : ''}
        <div class="people">${st.map(p => staffRow(p, Auth.isAdmin() ? t.id : null)).join('') || '<p class="muted">Aucun dirigeant pour cette catégorie.</p>'}</div>
      </section>`;
  }
  function bindTeamSections(root, t, rerender) {
    root.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b || !root.contains(b)) return;
      if (b.dataset.psort) { S().ui.peopleSort = b.dataset.psort; Store.persistNow(); return rerender(); }
      if (b.dataset.ab) { const g = groupsOf(t), p = Store.get('players', b.dataset.p); if (g && p) { moveGroup(p, b.dataset.ab, g); rerender(); } return; }
      if (b.hasAttribute('data-newplayer')) return editPlayer(null, { teamId: t.id, onSave: rerender });
      if (b.hasAttribute('data-newstaff')) return editStaff(null, { teamId: t.id, onSave: rerender });
      if (b.dataset.person && b.dataset.kind === 'player') { location.hash = '#/joueur/' + b.dataset.person; return; }
      if (b.dataset.person) return editStaff(Store.get('staff', b.dataset.person), { onSave: rerender });
      if (b.dataset.unlink) {
        const col = b.dataset.kind === 'player' ? 'players' : 'staff', p = Store.get(col, b.dataset.unlink);
        if (await confirmBox(`Retirer ${name(p)} de ${t.name} ? ${b.dataset.kind === 'player' ? 'Le joueur' : 'Le dirigeant'} reste dans le club.`, 'Retirer')) { p.teamIds = p.teamIds.filter(id => id !== t.id); Store.upsert(col, p); rerender(); }
      }
    });
    root.addEventListener('change', e => {
      const s = e.target.closest('[data-add]'); if (!s || !s.value) return;
      const col = s.dataset.add === 'player' ? 'players' : 'staff', p = Store.get(col, s.value);
      p.teamIds = [...new Set([...(p.teamIds || []), t.id])]; Store.upsert(col, p); toast(`${name(p)} ajouté à ${t.name}`); rerender();
    });
  }

  /* ---------- pages ---------- */
  function listPage(root, kind) {
    const isP = kind === 'player', ui = S().ui, key = isP ? 'plFilter' : 'stFilter';
    const filt = ui[key] || '', q = (ui[key + 'Q'] || '').toLowerCase(), pf = isP ? ui.plPost || '' : '', sort = isP ? ui.peopleSort : 'name';
    const all = (isP ? S().players : S().staff).filter(Auth.seesPerson).sort(Store.byName);
    const match = (p, f, qq) => (!f || (f === '-' ? !(p.teamIds || []).length : (p.teamIds || []).includes(f))) && (!qq || name(p).toLowerCase().includes(qq)) && (!pf || (pf === '-' ? !postsOf(p).length : hasPost(p, pf)));
    const list = all.filter(p => match(p, filt, q));
    const draw = l => (isP ? rowsOf(l, sort, p => playerRow(p)) : l.map(p => staffRow(p)).join('')) || '<p class="muted">Personne ici.</p>';
    root.innerHTML = `<header class="page-head"><div><h1>${isP ? 'Joueurs' : 'Dirigeants'}</h1><p class="sub">${list.length} sur ${all.length} · ${Auth.isAdmin() ? 'tout le club' : 'mes catégories'}</p></div>
      <div class="head-actions"><a class="btn" href="#/equipes">${I.back}<span>Équipes</span></a>
      <button class="btn" data-act="paste">${I.paste}<span>Coller une liste</span></button>
      <button class="btn primary" data-act="new">${I.plus}<span>${isP ? 'Nouveau joueur' : 'Nouveau dirigeant'}</span></button></div></header>
      <div class="filters">
        <label class="search">${I.search}<input id="q" type="search" placeholder="Chercher un nom" value="${esc(ui[key + 'Q'] || '')}"></label>
        ${isP ? `<select id="post" aria-label="Poste"><option value="">Tous les postes</option>${TYPES.map(([t]) => `<optgroup label="${esc(LINES.find(x => x[0] === t)[1])}"><option value="${t}" ${pf === t ? 'selected' : ''}>${esc(LINES.find(x => x[0] === t)[1])} (tous)</option>${subsOf(t).map(x => `<option value="${x[0]}" ${pf === x[0] ? 'selected' : ''}>${esc(x[2] + ' · ' + x[1])}</option>`).join('')}</optgroup>`).join('')}<option value="-" ${pf === '-' ? 'selected' : ''}>Poste non renseigné</option></select>` : ''}
        <select id="cat" aria-label="Catégorie"><option value="">${Auth.isAdmin() ? 'Toutes les catégories' : 'Mes catégories'}</option>${Auth.teams().map(t => `<option value="${t.id}" ${t.id === filt ? 'selected' : ''}>${esc(Store.teamLabel(t))}</option>`).join('')}<option value="-" ${filt === '-' ? 'selected' : ''}>Sans catégorie</option></select>
      </div>
      ${isP ? sortBar(sort, 'psort') : ''}
      <div class="people big" id="plist">${draw(list)}</div>`;
    const again = () => { const y = window.scrollY; listPage(root, kind); window.scrollTo(0, y); };
    // Search: only the list is redrawn, the search field keeps the keyboard (no jump on iPhone)
    $('#q', root).oninput = e => {
      ui[key + 'Q'] = e.target.value; const qq = e.target.value.toLowerCase(), f = ui[key] || '';
      const l = all.filter(p => match(p, f, qq));
      $('#plist', root).innerHTML = draw(l);
      $('.page-head .sub', root).textContent = `${l.length} sur ${all.length} · ${Auth.isAdmin() ? 'tout le club' : 'mes catégories'}`;
    };
    $('#cat', root).onchange = e => { ui[key] = e.target.value; Store.save(); again(); };
    const ps = $('#post', root); if (ps) ps.onchange = e => { ui.plPost = e.target.value; Store.persistNow(); again(); };
    root.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.psort) { ui.peopleSort = b.dataset.psort; Store.persistNow(); return again(); }
      if (b.dataset.act === 'new') return (isP ? editPlayer : editStaff)(null, { teamId: filt && filt !== '-' ? filt : null, onSave: again });
      if (b.dataset.act === 'paste') return isP ? pasteList(again) : pasteStaff(again);
      if (b.dataset.person && isP) { location.hash = '#/joueur/' + b.dataset.person; return; }
      if (b.dataset.person) editStaff(Store.get('staff', b.dataset.person), { onSave: again });
    };
  }

  /* ---------- paste a list copied from Footclubs ---------- */
  function parseLines(txt) {
    const out = [];
    txt.split(/\r?\n/).forEach(line => {
      const d = line.match(/(\d{2})\/(\d{2})\/(\d{4})/); if (!d) return;
      const before = line.slice(0, d.index).replace(/[\t|;]+/g, ' ').trim(), after = line.slice(d.index + d[0].length);
      const words = before.split(/\s+/).filter(w => /[A-Za-zÀ-ÿ]/.test(w));
      if (!words.length) return;
      const upper = words.filter(w => w === w.toUpperCase() && /[A-Z]/.test(w)), rest = words.filter(w => !upper.includes(w));
      const subM = after.match(/Senior U20|Senior|V[ée]t[ée]ran|U\d{1,2}/i);
      let sub = subM ? subM[0] : '';
      if (/^v/i.test(sub)) sub = 'Vétéran'; else if (/senior u20/i.test(sub)) sub = 'Senior U20'; else if (/senior/i.test(sub)) sub = 'Senior'; else sub = sub.toUpperCase();
      out.push({ lastName: upper.join(' '), firstName: rest.join(' '), birth: `${d[3]}-${d[2]}-${d[1]}`, subcat: sub });
    });
    return out;
  }
  /* ---------- categories by year of birth (FFF: a season starts on 1 July, U13 in 2026-2027 = born in 2014) ---------- */
  const FOOT_CATS = ['U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'U19', 'U20', 'Seniors', 'Vétérans'];
  const REMOVED_CATS = []; // (Clubbo: each club chooses its categories, U18 / U19 / U20 included)
  const seasonStart = (d = new Date()) => d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
  const seasonLabel = () => `${seasonStart()}-${seasonStart() + 1}`;
  // From U9 to Seniors, each category also has two teams A and B: the coach picks their players among the category's licenci\u00e9s
  const AB_FROM = ['U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'Seniors'];
  const EXTRA_CATS = ['\u00c9cole de foot']; // filled by hand
  const catKey = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, '');
  const isSubTeam = t => /\s[A-Z]$/.test(String(t.name || '').trim()); // \u00ab U13 A \u00bb, \u00ab Seniors B \u00bb
  const ageCats = () => Sport.isFoot() ? FOOT_CATS : Sport.cur().cats;
  const isAgeTeam = t => ageCats().some(c => catKey(c) === catKey(t.name) || (!isSubTeam(t) && catKey(c) === catKey(t.category)));
  // The category itself (\u00ab U13 \u00bb), never one of its teams (\u00ab U13 A \u00bb)
  const findCat = cat => S().teams.find(x => catKey(x.name) === catKey(cat)) || S().teams.find(x => !isSubTeam(x) && catKey(x.category) === catKey(cat));
  // Category of a player: U + age reached during the season; 18 and over: Seniors (no U18 / U19 / U20 at the club), or Vétérans with a vétéran licence
  function catOf(p) {
    const y = +(String(p.birth || '').slice(0, 4)); if (!y) return null;
    const age = seasonStart() + 1 - y;
    if (!Sport.isFoot()) return Sport.cur().catOf(age);
    if (/v[ée]t/i.test(p.subcat || '') || age >= 36) return 'Vétérans';
    if (age >= 18) return age <= 20 && findCat('U' + age) ? 'U' + age : 'Seniors';
    return 'U' + Math.max(6, age);
  }
  const formatOf = cat => { if (!Sport.isFoot()) return Sport.cur().formatOfCat(cat); if (/^[ÉE]cole/i.test(cat)) return '5'; const n = +cat.slice(1); return cat[0] !== 'U' ? '11' : n <= 9 ? '5' : n <= 13 ? '8' : '11'; };
  function ageTeam(cat) {
    let t = findCat(cat);
    // Same id on every device, so two devices creating « U8 » at the same time give one category after the sync
    if (!t) t = Store.upsert('teams', { id: 'cat-' + catKey(cat), name: cat, category: cat, format: formatOf(cat) });
    return t;
  }
  // École de foot, and teams A and B from U9 to Seniors (made once: a team the club deletes is not made again)
  function extraTeams() {
    if (!Sport.isFoot()) return;
    EXTRA_CATS.forEach(ageTeam);
    AB_FROM.forEach(base => ['A', 'B'].forEach(l => {
      const name = base + ' ' + l;
      if (!S().teams.some(x => catKey(x.name) === catKey(name))) Store.upsert('teams', { id: 'cat-' + catKey(name), name, category: base, format: formatOf(base) });
    }));
  }
  const sortTeams = () => Store.sortTeams(); // Seniors, Vétérans, École de foot, then U6 … U17
  // U18, U19 and U20 removed (done once): their players, dirigeants, sessions, matches and schemas go to Seniors,
  // then the two categories and their teams A / B are deleted on every device
  function removeOldCats() {
    const gone = S().teams.filter(t => REMOVED_CATS.some(c => catKey(c) === catKey(t.name) || catKey(c) === catKey(t.category)));
    if (!gone.length) return false;
    const sen = ageTeam('Seniors'), ids = new Set(gone.map(t => t.id));
    const swap = list => [...new Set((list || []).map(id => ids.has(id) ? sen.id : id))];
    ['players', 'staff'].forEach(col => S()[col].slice().forEach(x => { const n = swap(x.teamIds); if (n.join() !== (x.teamIds || []).join()) { x.teamIds = n; Store.upsert(col, x); } }));
    ['matches', 'trainings', 'schemas'].forEach(col => S()[col].slice().forEach(x => { if (ids.has(x.teamId)) { x.teamId = sen.id; Store.upsert(col, x); } }));
    if (ids.has(S().ui.teamId)) S().ui.teamId = '';
    gone.forEach(t => Store.remove('teams', t.id));
    return true;
  }
  // Creates every category and puts each player with a date of birth in his one (other teams, e.g. « U13 A », are kept)
  function sortByBirth() {
    const ageIds = new Set(S().teams.filter(isAgeTeam).map(t => t.id));
    let moved = 0, noBirth = 0;
    S().players.forEach(p => {
      const cat = catOf(p); if (!cat) { noBirth++; return; }
      const tid = ageTeam(cat).id, before = (p.teamIds || []).slice().sort().join();
      p.teamIds = [...(p.teamIds || []).filter(id => !ageIds.has(id)), tid];
      if (p.teamIds.slice().sort().join() !== before) { p.updatedAt = Date.now(); moved++; }
    });
    sortTeams(); Store.save();
    return { moved, noBirth };
  }
  // Once per season, on a responsable's device: every category exists and each player is in his own
  // (after that, a player moved by hand, e.g. surclassé, stays where he was put)
  function autoCategories() {
    if (!Auth.isAdmin() || !S().players.length) return false;
    const season = seasonLabel(), c = S().club;
    let changed = false;
    if (c.catSeason === season) return changed;
    sortByBirth(); c.catSeason = season; Store.save(); return true;
  }
  function sortByBirthDialog(done) {
    const y = seasonStart() + 1;
    UI.confirmBox(`Ranger chaque joueur dans sa catégorie (créée si besoin) selon son année de naissance (saison ${seasonLabel()}${Sport.isFoot() ? ` : U13 = né en ${y - 13}, U17 = né en ${y - 17}, Seniors = né en ${y - 18} ou avant` : ` : catégories de la fédération de ${Sport.cur().label.toLowerCase()}`}) ? Les autres équipes (ex : « U13 A ») et les dirigeants ne changent pas.`, 'Ranger').then(ok => {
      if (!ok) return;
      const r = sortByBirth(); S().club.catSeason = seasonLabel(); Store.save();
      toast(`${r.moved} joueur${r.moved > 1 ? 's' : ''} rangé${r.moved > 1 ? 's' : ''}${r.noBirth ? ` · ${r.noBirth} sans date de naissance` : ''}`);
      done && done();
    });
  }
  function teamForSub(sub) {
    const tn = TEAM_OF_SUB[sub]; if (!tn) return null;
    let t = findCat(tn);
    if (!t) t = Store.upsert('teams', { id: Store.uid(), name: tn, category: tn, format: Sport.isFoot() ? FORMAT_OF_TEAM[tn] || '11' : formatOf(tn) });
    return t.id;
  }
  function pasteList(done) {
    modal({ title: 'Coller une liste de joueurs',
      body: `<p class="tip">${Sport.isFoot() ? 'Dans Footclubs' : 'Dans le logiciel de ta fédération'}, sélectionne les lignes de la liste des licenciés, copie-les puis colle-les ici. Il faut au minimum le nom, le prénom et la date de naissance sur chaque ligne. Les joueurs sont rangés dans leur catégorie selon leur année de naissance (${Sport.cur().cats.slice(0, 1)[0]} à Seniors).</p>
        <textarea id="pasteTxt" rows="9" placeholder="DUPONT Lucas   12/03/2014   Libre / U13 (- 13 ans)"></textarea><p class="muted small" id="pasteInfo"></p>`,
      onOpen: r => { $('#pasteTxt', r).oninput = e => { const n = parseLines(e.target.value).length; $('#pasteInfo', r).textContent = n ? `${n} joueur${n > 1 ? 's' : ''} reconnu${n > 1 ? 's' : ''}` : ''; }; },
      actions: [{ label: 'Annuler' }, { label: 'Ajouter', kind: 'primary', onClick: (c, r) => {
        const rows = parseLines($('#pasteTxt', r).value);
        if (!rows.length) { toast('Aucune ligne reconnue : il faut une date de naissance jj/mm/aaaa', 'err'); return false; }
        const { added, updated } = addPlayers(rows);
        toast(`${added} ajouté${added > 1 ? 's' : ''}, ${updated} mis à jour`); done && done();
      } }] });
  }
  // Players from a Footclubs list: same nom + prénom (+ date of birth) → updated, otherwise added; category from the year of birth
  function addPlayers(rows) {
        let added = 0, updated = 0;
        rows.forEach(x => {
          const ex = S().players.find(p => (p.lastName || '').toUpperCase() === x.lastName && (p.firstName || '').toLowerCase() === x.firstName.toLowerCase() && (!p.birth || p.birth === x.birth));
          const cat = catOf(x), tid = cat ? ageTeam(cat).id : teamForSub(x.subcat);
          if (ex) { Object.assign(ex, { birth: x.birth, subcat: x.subcat || ex.subcat }); if (tid) { const ageIds = new Set(S().teams.filter(isAgeTeam).map(t => t.id)); ex.teamIds = [...(ex.teamIds || []).filter(id => !ageIds.has(id)), tid]; } Store.upsert('players', ex); updated++; }
          else { Store.upsert('players', Object.assign({ id: Store.uid(), number: '', pos: '', phone: '', email: '', parents: [], notes: '', teamIds: tid ? [tid] : [] }, x)); added++; }
        });
        sortTeams(); Store.save();
        return { added, updated };
  }

  /* ---------- paste a list of dirigeants: « NOM Prénom · rôle · téléphone · catégories » on each line ---------- */
  const ROLE_RE = /(responsable de cat[ée]gorie|[ée]ducateur adjoint|entra[iî]neur des gardiens|[ée]ducat(?:eur|rice)|entra[iî]neu(?:r|se)|coach|dirigeant(?:e)?|accompagnat(?:eur|rice)|pr[ée]sident(?:e)?|vice-pr[ée]sident(?:e)?|secr[ée]taire|tr[ée]sori(?:er|[èe]re)|arbitre)/i;
  function parseStaff(txt) {
    return txt.split(/\r?\n/).map(line => {
      let l = line.replace(/[\t|;]+/g, ' ').replace(/\s+/g, ' ').trim(); if (!l) return null;
      // « club: Juventus » (or « équipe: … ») at the end of the line = favourite club
      const clubM = l.match(/\b(?:club(?:\s+de\s+c(?:œ|oe)ur)?|[ée]quipe(?:\s+pr[ée]f[ée]r[ée]e)?)\s*:\s*(.+)$/i), club = clubM ? Clubs.find(clubM[1]) : '';
      if (clubM) l = l.slice(0, clubM.index).trim();
      const phone = (l.match(/(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}/) || [''])[0];
      const email = (l.match(/[\w.+-]+@[\w-]+\.[\w.]+/) || [''])[0];
      const roleM = l.match(ROLE_RE);
      const cats = (l.match(/\bU\s?\d{1,2}\b|\bS[ée]niors?\b|\bV[ée]t[ée]rans?\b/gi) || []).map(c => c.replace(/\s/g, '').toUpperCase().replace(/^S[ÉE]NIORS?$/, 'SENIORS').replace(/^V[ÉE]T[ÉE]RANS?$/, 'VETERANS'));
      let rest = l.replace(phone, ' ').replace(email, ' ').replace(roleM ? roleM[0] : '', ' ').replace(/\bU\s?\d{1,2}\b|\bS[ée]niors?\b|\bV[ée]t[ée]rans?\b/gi, ' ').replace(/\d{2}\/\d{2}\/\d{4}/g, ' ');
      // a usual first name can keep the licence one in brackets: « MOTO Giova (Christian) »
      const par = (rest.match(/\([^)]*\)/g) || []).join(' '); rest = rest.replace(/\([^)]*\)/g, ' ');
      const words = rest.split(/[\s,·/-]+/).filter(w => /^[A-Za-zÀ-ÿ'’]{2,}$/.test(w) && !/^(Libre|Dirigeant|Licence|Valid[ée]e)$/i.test(w));
      if (!words.length) return null;
      const upper = words.filter(w => w === w.toUpperCase()), other = words.filter(w => w !== w.toUpperCase());
      const lastName = (upper.length ? upper : words.slice(0, 1)).join(' ').toUpperCase(), firstName = [(upper.length ? other : words.slice(1)).join(' '), par].filter(Boolean).join(' ');
      const role = roleM ? roleM[0].replace(/^./, c => c.toUpperCase()).replace(/^Entra[iî]neur$/i, 'Éducateur').replace(/^Coach$/i, 'Éducateur').replace(/^Educateur/i, 'Éducateur') : '';
      return { lastName, firstName, role, phone, email, cats, club };
    }).filter(Boolean);
  }
  const normCat = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  function pasteStaff(done) {
    modal({ title: 'Coller une liste de dirigeants',
      body: `<p class="tip">Une personne par ligne : nom, prénom, et si tu les as le rôle, le téléphone et la ou les catégories. Par exemple : « DUPONT Karim Éducateur U13 06 12 34 56 78 ». Une liste copiée depuis Footclubs ou un tableur marche aussi.</p>
        <textarea id="stTxt" rows="8" placeholder="DUPONT Karim Éducateur U13 06 12 34 56 78&#10;MARTIN Sophie Dirigeante U11 U9"></textarea><div id="stPrev" class="imp-preview"></div>`,
      onOpen: r => { $('#stTxt', r).oninput = e => { const rows = parseStaff(e.target.value);
        $('#stPrev', r).innerHTML = rows.length ? `<ul class="imp-list">${rows.map(x => `<li><b>${esc(x.lastName)} ${esc(x.firstName)}</b> · ${esc(x.role)}${x.cats.length ? ' · ' + esc(x.cats.join(', ')) : ''}${x.club ? ' · club de cœur : ' + Clubs.crest(x.club, 16) + ' ' + esc(Clubs.name(x.club)) : ''}${x.phone ? ' · ' + esc(x.phone) : ''}</li>`).join('')}</ul>` : ''; }; },
      actions: [{ label: 'Annuler' }, { label: 'Ajouter', kind: 'primary', onClick: (c, r) => {
        const rows = parseStaff($('#stTxt', r).value);
        if (!rows.length) { toast('Aucune ligne reconnue', 'err'); return false; }
        const { added, updated } = addStaff(rows);
        toast(`${added} ajouté${added > 1 ? 's' : ''}, ${updated} mis à jour. Ils apparaissent maintenant dans « Première connexion ».`); done && done();
      } }] });
  }
  function addStaff(rows) {
        let added = 0, updated = 0;
        rows.forEach(x => {
          const teamIds = x.cats.map(cat => (S().teams.find(t => normCat(t.name) === cat) || S().teams.find(t => !isSubTeam(t) && normCat(t.category) === cat) || {}).id).filter(Boolean);
          // same person: same nom and a common prénom (« Giova (Christian) » = « Christian »)
          const ex = S().staff.find(p => nk(p.lastName) === nk(x.lastName) && firstsOf(p.firstName).some(f => firstsOf(x.firstName).includes(f)));
          if (ex) { Object.assign(ex, { firstName: x.firstName.length > (ex.firstName || '').length ? x.firstName : ex.firstName, role: x.role || ex.role, phone: x.phone || ex.phone, email: x.email || ex.email, club: x.club || ex.club, teamIds: [...new Set([...(ex.teamIds || []), ...teamIds])] }); linkPlayer(ex); Store.upsert('staff', ex); updated++; }
          else { const n = { id: Store.uid(), lastName: x.lastName, firstName: x.firstName, role: x.role || 'Éducateur', phone: x.phone, email: x.email, notes: '', teamIds, club: x.club || '' }; linkPlayer(n); Store.upsert('staff', n); added++; }
        });
        return { added, updated };
  }

  /* ---------- a club list as a text file: Footclubs lines, then a line « DIRIGEANTS » and one dirigeant per line ---------- */
  const isClubList = txt => !/^\s*[{[]/.test(txt) && (parseLines(txt).length > 0 || /^\s*#?\s*DIRIGEANTS\s*$/im.test(txt));
  function importClubList(txt) {
    const [pl, st = ''] = txt.split(/^\s*#?\s*DIRIGEANTS\s*$/im);
    const p = addPlayers(parseLines(pl)), s = addStaff(parseStaff(st));
    sortByBirth(); S().club.catSeason = seasonLabel();
    return { players: p, staff: s };
  }

  /* ---------- season figures of a player: attendance, playing time, goals ---------- */
  const seasonFrom = () => `${seasonStart()}-07-01`;
  // Sessions of the season where the attendance was taken (at least one player ticked), up to today
  function attendance(p, teamId) {
    const from = seasonFrom(), now = UI.today(), ids = teamId ? [teamId] : (p.teamIds || []);
    const trs = S().trainings.filter(t => t.date >= from && t.date <= now && ids.includes(t.teamId) && (t.presents || []).length);
    const n = trs.filter(t => t.presents.includes(p.id)).length;
    return { n, total: trs.length, pct: trs.length ? Math.round(n / trs.length * 100) : null, list: trs };
  }
  // Length of a match (minutes) by category: the coach can change it on the match
  function matchLength(m) {
    if (m && +m.duration) return +m.duration;
    const t = m && Store.get('teams', m.teamId), c = catKey((t && (t.category || t.name)) || '');
    const n = +((/^U(\d+)/.exec(c) || [])[1] || 0);
    if (!n) return 90;
    return n >= 17 ? 90 : n >= 14 ? 80 : n >= 12 ? 60 : n >= 10 ? 50 : 40;
  }
  function seasonMatches(p) {
    const from = seasonFrom();
    return S().matches.filter(m => m.date >= from && !m.exempt && (m.convoked || []).includes(p.id)).sort((a, b) => b.date.localeCompare(a.date));
  }
  function playerSeason(p) {
    const ms = seasonMatches(p), played = ms.filter(m => m.played && Store.kindOk(m));
    const minutes = played.reduce((a, m) => a + (+((m.minutes || {})[p.id]) || 0), 0);
    const withMin = played.filter(m => (m.minutes || {})[p.id] != null && (m.minutes || {})[p.id] !== '');
    const g = played.reduce((a, m) => a + (((m.stats || {})[p.id] || {}).g || 0), 0), as = played.reduce((a, m) => a + (((m.stats || {})[p.id] || {}).a || 0), 0);
    return { ms, played, minutes, avg: withMin.length ? Math.round(minutes / withMin.length) : null, g, a: as, att: attendance(p) };
  }
  const pctClass = v => v == null ? '' : v >= 75 ? 'pct-good' : v >= 50 ? 'pct-mid' : 'pct-low';
  const pctBadge = a => a.pct == null ? '' : `<i class="pct ${pctClass(a.pct)}" title="${a.n} séance${a.n > 1 ? 's' : ''} sur ${a.total} cette saison">${a.pct} %</i>`;

  /* ---------- lineup: each spot of a formation gets the player whose positions fit it best ---------- */
  // A spot of Formations: [label, x (0 = our goal, .5 = halfway), y (0 = our left), gk]
  function slotOf([, x, y, gk, fits]) {
    if (gk) return { line: 'GB', ideal: ['GB'] };
    if (fits) { const pt = POSTS.find(p => p[0] === fits[0]); return { line: pt ? pt[3] : '', side: '', ideal: fits }; }
    const line = x < .22 ? 'DEF' : x < .4 ? 'MIL' : 'ATT', side = y < .3 ? 'G' : y > .7 ? 'D' : 'C';
    const ideal = line === 'DEF' ? (side === 'G' ? ['LG'] : side === 'D' ? ['LD'] : ['DC'])
      : line === 'MIL' ? (side === 'G' ? ['MG', 'LG', 'AG'] : side === 'D' ? ['MD', 'LD', 'AD'] : x <= .3 ? ['MDC', 'MC'] : x >= .37 ? ['MOC', 'MC', 'SA'] : ['MC', 'MDC', 'MOC'])
      : (side === 'G' ? ['AG', 'MG'] : side === 'D' ? ['AD', 'MD'] : ['BU', 'SA']);
    return { line, side, ideal };
  }
  const sideOf = c => /D$/.test(c) && c !== 'MOD' ? 'D' : /G$/.test(c) ? 'G' : c === 'DC' || c === 'BU' || c === 'SA' || /^M(DC|C|OC)$/.test(c) ? 'C' : '';
  function fit(code, slot) {
    const pt = postOf(code); if (!pt) return 0;
    if (slot.line === 'GB') return code === 'GB' ? 10 : -99;
    if (code === 'GB') return -20;
    const i = slot.ideal.indexOf(code); if (i >= 0) return 10 - i * 2;
    if (pt[3] === slot.line) return code === pt[3] ? 6 : sideOf(code) === slot.side ? 5 : 4;
    return 1; // another line: only if nobody better
  }
  // players → one player (or undefined) per spot; the main position counts more than the others
  function assignSlots(players, rows) {
    const slots = rows.map(slotOf), pairs = [];
    players.forEach(p => slots.forEach((sl, j) => {
      const ps = postsOf(p), sc = ps.length ? Math.max(...ps.map((c, i) => fit(c, sl) - (i ? 1 : 0))) : (sl.line === 'GB' ? -99 : 2);
      if (sc > -50) pairs.push([sc, p, j]);
    }));
    pairs.sort((a, b) => b[0] - a[0] || Store.byName(a[1], b[1]));
    const out = new Array(rows.length), used = new Set();
    for (const [, p, j] of pairs) if (!out[j] && !used.has(p.id)) { out[j] = p; used.add(p.id); }
    return { out, bench: players.filter(p => !used.has(p.id)) };
  }

  /* ---------- fair playing time: players who played much less than the others this season ---------- */
  function lowPlaytime(teamId) {
    const t = Store.get('teams', teamId); if (!t) return [];
    const fam = new Set(S().teams.filter(x => catKey(x.category || x.name) === catKey(t.category || t.name)).map(x => x.id));
    const from = seasonFrom(), ms = S().matches.filter(m => fam.has(m.teamId) && m.played && !m.exempt && !Store.isFriendly(m) && m.date >= from && m.minutes && Object.keys(m.minutes).length);
    if (ms.length < 3) return []; // not enough matches with playing time yet
    const own = Store.playersOf(teamId), squad = own.length ? own : Store.rosterOf(teamId);
    const rows = squad.map(p => ({ p, min: ms.reduce((a, m) => a + (+(m.minutes[p.id]) || 0), 0), conv: ms.filter(m => (m.convoked || []).includes(p.id)).length }));
    const played = rows.filter(r => r.min > 0); if (!played.length) return [];
    const avg = played.reduce((a, r) => a + r.min, 0) / played.length;
    return rows.filter(r => r.min < avg * .5).map(r => Object.assign(r, { avg: Math.round(avg) })).sort((a, b) => a.min - b.min);
  }

  /* ---------- the full player page (#/joueur/id) ---------- */
  function playerPage(root, id) {
    const p = Store.get('players', id);
    if (!p || !Auth.seesPerson(p)) { location.hash = '#/joueurs'; return; }
    const s = playerSeason(p), hh = x => String(x || '').replace(':', 'h');
    const res = m => !m.played ? '' : m.gf > m.ga ? 'V' : m.gf < m.ga ? 'D' : 'N';
    const am = Ratings.average(p.id, 'match'), at = Ratings.average(p.id, 'training');
    const tile = (v, l, cls = '') => `<div class="tile ${cls}"><b>${v}</b><span>${l}</span></div>`;
    const recentTr = s.att.list.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
    root.innerHTML = `<header class="page-head"><div><h1>${p.number ? `<span class="pnum big">${esc(p.number)}</span> ` : ''}${esc(name(p))}${p.birth && String(p.birth).slice(5, 10) === (d => `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date()) ? ' <span title="C\'est son anniversaire aujourd\'hui">👑🎂</span>' : ''}</h1>
        <p class="sub">${[postsLabel(p), p.birth ? `${age(p.birth)} ans (${fmtBirth(p.birth)})` : '', p.foot ? 'pied ' + String(p.foot).toLowerCase() : '', p.height ? p.height + ' cm' : '', p.weight ? p.weight + ' kg' : '', +p.weight && +p.height ? 'IMC ' + String(Math.round(p.weight / Math.pow(p.height / 100, 2) * 10) / 10).replace('.', ',') : '', p.mute ? 'muté' : '', p.licence ? 'licence ' + p.licence : '', p.subcat, teamNames(p.teamIds)].filter((x, i, a) => x && a.indexOf(x) === i).map(esc).join(' · ')}</p></div>
      <div class="head-actions"><button class="btn" data-act="back">${I.back}<span>Retour</span></button><button class="btn primary" data-act="edit">${I.edit}<span>Modifier</span></button></div></header>
      ${UI.kindSeg()}
      <div class="tiles">
        ${tile(s.att.pct == null ? '–' : s.att.pct + ' %', `Présence à l'entraînement${s.att.total ? ` (${s.att.n}/${s.att.total})` : ''}`, s.att.pct == null ? '' : s.att.pct >= 75 ? 'v' : s.att.pct >= 50 ? 'n' : 'd')}
        ${tile(s.played.length, 'Matchs joués')}${tile(s.minutes, 'Minutes jouées')}${tile(s.avg == null ? '–' : s.avg + "'", 'Moyenne par match')}
        ${tile(s.g, Sport.W().Units)}${tile(s.a, Sport.W().Assists)}${tile(am ? Ratings.fr(am) : '–', 'Note matchs /10')}${tile(at ? Ratings.fr(at) : '–', 'Note entr. /10')}
      </div>
      <p class="muted small">Saison ${esc(seasonLabel())} · les présences comptent les séances où le coach a fait l'appel.</p>
      <div class="cards2">
        ${Health.playerCard(p)}
        ${p.strengths || p.weaknesses ? `<section class="card"><h2>🧍 Son profil (rempli par le joueur)</h2>${p.strengths ? `<p>💪 <b>Points forts :</b> ${esc(p.strengths)}</p>` : ''}${p.weaknesses ? `<p>🎯 <b>À travailler :</b> ${esc(p.weaknesses)}</p>` : ''}</section>` : ''}
        ${Progress.card(p)}
        ${Tips.card(p)}
        ${Tests.card(p)}
        ${Health.wellnessCard(p)}
        ${Season.playerDetail(p)}
        <section class="card"><h2>${I.phone}Contacts</h2>
          ${p.phone ? tel(p.phone, 'Joueur') : ''}${(p.parents || []).map(x => `<div class="pp-parent"><b>${esc(x.name || x.rel || 'Parent')}</b>${x.rel && x.name ? ` <span class="muted">(${esc(x.rel)})</span>` : ''}${x.phone ? tel(x.phone) : ''}</div>`).join('')}
          ${p.email ? `<p><a href="mailto:${esc(p.email)}">${esc(p.email)}</a></p>` : ''}
          ${!phonesOf(p).length && !p.email ? '<p class="muted">Aucun contact : touche « Modifier » pour ajouter le téléphone des parents.</p>' : ''}
          ${p.notes ? `<h3 class="sub-h">Infos utiles</h3><p class="pre">${esc(p.notes)}</p>` : ''}
        </section>
        <section class="card"><h2>${I.match}Matchs de la saison (${s.ms.length})</h2>
          ${s.ms.length ? `<ul class="res-list">${s.ms.slice(0, 15).map(m => { const st = (m.stats || {})[p.id] || {}, mn = (m.minutes || {})[p.id];
            return `<li><a href="#/match/${m.id}"><span class="d">${esc(UI.fmtDate(m.date))}</span><span class="o">${m.home ? 'contre' : 'chez'} ${esc(m.opponent || '?')}</span>
            <span class="s">${m.played ? `${mn != null && mn !== '' ? esc(mn) + "'" : ''}${st.g ? ' ' + Sport.W().icon + (st.g > 1 ? '×' + st.g : '') : ''}${st.a ? ' 🅿️' + (st.a > 1 ? '×' + st.a : '') : ''}` : hh(m.time) || 'à venir'}</span>${res(m) ? `<span class="res res-${res(m)}">${res(m)}</span>` : ''}</a></li>`; }).join('')}</ul>` : '<p class="muted">Pas encore convoqué cette saison.</p>'}
        </section>
        <section class="card"><h2>${I.training}Entraînements (${s.att.n}/${s.att.total})</h2>
          ${recentTr.length ? `<div class="att-strip">${recentTr.map(t => `<a class="att ${t.presents.includes(p.id) ? 'in' : 'out'}" href="#/entrainement/${t.id}" title="${esc(t.title || 'Entraînement')}"><b>${t.presents.includes(p.id) ? '✓' : '✗'}</b><span>${esc(UI.fmtDate(t.date, { day: 'numeric', month: 'short' }))}</span></a>`).join('')}</div>` : '<p class="muted">Aucun appel fait pour l\'instant.</p>'}
        </section>
        <section class="card">${notesHistory(p) || `<h2>⭐ Notes des dirigeants</h2><p class="muted">Pas encore de note.</p>`}</section>
      </div>`;
    Progress.mount(root, p);
    root.onclick = e => {
      if (Health.click(e, p, () => playerPage(root, id))) return;
      if (Progress.click(e, p, () => playerPage(root, id))) return;
      if (Tips.click(e, p, () => playerPage(root, id))) return;
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.act === 'back') return history.length > 1 ? history.back() : (location.hash = '#/joueurs');
      if (b.dataset.act === 'edit') return editPlayer(p, { onSave: () => { if (Store.get('players', p.id)) playerPage(root, p.id); else location.hash = '#/joueurs'; } });
    };
  }

  return { parseLines, addPlayers, addStaff, ageTeam, findCat, get AGE_CATS() { return ageCats(); }, isClubList, importClubList, autoCategories, sortByBirth, sortByBirthDialog, catOf, seasonLabel, seasonFrom, editPlayer, editStaff, teamSections, bindTeamSections, staffPicker, listPage, playerPage, age, fmtBirth, tel, name,
    attendance, pctBadge, matchLength, playerSeason, assignSlots, lowPlaytime, POSTS, TYPES, postsOf, postsLabel, lineOf, sortPlayers, byLine, sortBar, PHONE_SHOW, staffPhone };
})();
