/* Roles: for a responsable only, the app of every kind of member under his own login: a coach (of the chosen categories),
   a volunteer, a referee, a player, a parent. One tap to switch, one tap to come back as responsable; the chosen role stays
   on this device until he changes it. Nothing changes for the others: the roles are kept on this device only. */
const Roles = (() => {
  const { esc, $, $$, toast, modal, confirmBox } = UI;
  const S = () => Store.state;
  const KINDS = { coach: ['🧢', 'Coach', 'L\'appli d\'un éducateur : ses catégories seulement, sans la gestion du club.'],
    benevole: ['🙋', 'Bénévole', 'Ce qu\'utilise un bénévole : les tâches des jours de match et les événements du club.'],
    arbitre: ['🟨', 'Arbitre', 'L\'appli d\'un arbitre du club : ses disponibilités sur les matchs à domicile et ses désignations.'],
    joueur: ['⚽', 'Joueur', 'La vraie page d\'un joueur (avec son code) : convocations, causerie, temps de jeu. Rien sur les autres.'],
    parent: ['👨‍👩‍👧', 'Parent', 'La vraie page d\'un parent : matchs de l\'enfant, convocation, covoiturage, bénévoles.'] };
  const KEY = () => Auth.PREVIEW + '-list';
  const teamName = id => (Store.get('teams', id) || {}).name || '';
  const firstPlayer = teamId => Store.playersOf(teamId).sort(Store.byName)[0];
  function defaults() {
    const u = Auth.current() || {}, t0 = (u.teamIds || []).filter(id => Store.get('teams', id))[0] || (S().teams[0] || {}).id || '';
    const p0 = t0 && firstPlayer(t0), fam = id => { const t = Store.get('teams', id); return t && AppCfg.family(t.category || t.name); };
    const tf = [...(u.teamIds || []), ...S().teams.map(t => t.id)].find(fam) || '', pf = tf && firstPlayer(tf); // (2.07) the parents' view: a U15-or-younger category
    return [{ id: 'coach', kind: 'coach', teamIds: t0 ? [t0] : [] }, { id: 'benevole', kind: 'benevole' }, { id: 'arbitre', kind: 'arbitre' },
      { id: 'joueur', kind: 'joueur', teamId: t0, playerId: p0 ? p0.id : '' }, ...(tf ? [{ id: 'parent', kind: 'parent', teamId: tf, playerId: pf ? pf.id : '' }] : [])];
  }
  function list() { try { const l = JSON.parse(localStorage.getItem(KEY())); if (Array.isArray(l) && l.length) return l; } catch (e) {} return defaults(); }
  const save = l => { try { localStorage.setItem(KEY(), JSON.stringify(l)); } catch (e) {} };
  function label(r) {
    const [ic, name] = KINDS[r.kind] || ['', r.kind];
    if (r.kind === 'coach') return `${ic} ${name} · ${(r.teamIds || []).map(teamName).filter(Boolean).join(', ') || 'choisir les catégories'}`;
    if (r.kind === 'joueur' || r.kind === 'parent') { const p = Store.get('players', r.playerId); return `${ic} ${name} · ${p ? Store.shortName(p) : 'choisir'}${r.teamId ? ' (' + teamName(r.teamId) + ')' : ''}`; }
    return `${ic} ${name}`;
  }
  const active = () => { const p = Auth.preview(); return p ? p.id || p.role : 'admin'; };

  function go(r) {
    if (!r) { Auth.stopPreview(); return; }
    if (r.kind === 'coach') { if (!(r.teamIds || []).length) return edit(r); return Auth.startPreview(r.teamIds, 'coach', { id: r.id, label: label(r) }); }
    if (r.kind === 'benevole' || r.kind === 'arbitre') return Auth.startPreview([], r.kind, { id: r.id, label: label(r) });
    // a player or a parent: their real page, full screen (the code of the chosen player)
    if (!r.playerId) return edit(r);
    Auth.viewPage(r.kind, r.teamId, r.playerId);
  }

  function open() {
    if (!Auth.realAdmin()) return;
    const l = list(), on = active();
    const close = modal({ title: '🔀 Mes rôles', noFocus: true, body: `<p class="muted small">Tu passes d'un rôle à l'autre avec ton code : tu vois l'appli exactement comme lui. Rien ne change pour les autres.</p>
      <div class="list">
        <div class="list-item ${on === 'admin' ? 'on' : ''}"><button class="li-main role-go" data-go="admin"><b>🏛️ Responsable du club</b><span class="muted small">Tout le club et sa gestion${on === 'admin' ? ' · <b>rôle actuel</b>' : ''}</span></button></div>
        ${l.map(r => `<div class="list-item ${on === r.id ? 'on' : ''}"><button class="li-main role-go" data-go="${esc(r.id)}"><b>${esc(label(r))}</b><span class="muted small">${esc((KINDS[r.kind] || [])[2] || '')}${on === r.id ? ' · <b>rôle actuel</b>' : ''}</span></button>
          <button class="icon-btn" data-ed="${esc(r.id)}" aria-label="Modifier">${I.edit}</button></div>`).join('')}
      </div>
      <button type="button" class="btn soft wide" data-add>${I.plus}<span>Ajouter un rôle (ex. coach d'une autre catégorie)</span></button>`,
      onOpen: r => {
        $$('[data-go]', r).forEach(b => b.onclick = () => { close(); const id = b.dataset.go; setTimeout(() => go(id === 'admin' ? null : list().find(x => x.id === id)), 60); });
        $$('[data-ed]', r).forEach(b => b.onclick = () => { close(); setTimeout(() => edit(list().find(x => x.id === b.dataset.ed)), 60); });
        $('[data-add]', r).onclick = () => { close(); setTimeout(() => edit({ id: Store.uid(), kind: 'coach', teamIds: [], isNew: true }), 60); };
      } });
  }

  function edit(r) {
    if (!r) return;
    let kind = r.kind, teamIds = [...(r.teamIds || [])], teamId = r.teamId || (S().teams[0] || {}).id || '', playerId = r.playerId || '';
    const teams = S().teams;
    const body = () => `<div class="chips">${Object.entries(KINDS).map(([k, [ic, l]]) => `<button type="button" class="chip ${k === kind ? 'on' : ''}" data-k="${k}">${ic} ${l}</button>`).join('')}</div>
      <p class="muted small">${KINDS[kind][2]}</p>
      ${kind === 'coach' ? `<div class="lbl">Ses catégories</div><div class="chips">${teams.map(t => `<button type="button" class="chip ${teamIds.includes(t.id) ? 'on' : ''}" data-t="${t.id}">${esc(t.name)}</button>`).join('')}</div>` : ''}
      ${kind === 'joueur' || kind === 'parent' ? `<label class="fld"><span>Catégorie</span><select id="rlTeam">${(kind === 'parent' ? teams.filter(t => AppCfg.family(t.category || t.name)) : teams).map(t => `<option value="${t.id}" ${t.id === teamId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
        <label class="fld"><span>${kind === 'parent' ? 'L\'enfant' : 'Le joueur'}</span><select id="rlPl">${Store.playersOf(teamId).sort(Store.byName).map(p => `<option value="${p.id}" ${p.id === playerId ? 'selected' : ''}>${esc(Store.fullName(p))}</option>`).join('') || '<option value="">Aucun joueur</option>'}</select></label>` : ''}`;
    const close = modal({ title: r.isNew ? 'Ajouter un rôle' : 'Modifier le rôle', noFocus: true, body: `<div id="rlBody">${body()}</div>`,
      onOpen: m => {
        const box = $('#rlBody', m), redraw = () => { box.innerHTML = body(); bind(); };
        const bind = () => { const ts = $('#rlTeam', m); if (ts) ts.onchange = e => { teamId = e.target.value; playerId = (firstPlayer(teamId) || {}).id || ''; redraw(); };
          const ps = $('#rlPl', m); if (ps) ps.onchange = e => { playerId = e.target.value; }; };
        box.onclick = e => { const k = e.target.closest('[data-k]'); if (k) { kind = k.dataset.k;
            if (kind === 'parent') { const tt = Store.get('teams', teamId); if (!tt || !AppCfg.family(tt.category || tt.name)) { const f = teams.find(x => AppCfg.family(x.category || x.name)); teamId = f ? f.id : ''; playerId = f ? (firstPlayer(teamId) || {}).id || '' : ''; } } // (2.07) U15 and younger
            if (!playerId) playerId = (firstPlayer(teamId) || {}).id || ''; return redraw(); }
          const t = e.target.closest('[data-t]'); if (t) { teamIds = teamIds.includes(t.dataset.t) ? teamIds.filter(x => x !== t.dataset.t) : [...teamIds, t.dataset.t]; t.classList.toggle('on'); } };
        bind();
      },
      actions: [...(r.isNew ? [] : [{ label: 'Supprimer', kind: 'danger', onClick: () => { save(list().filter(x => x.id !== r.id)); if (active() === r.id) Auth.stopPreview(); toast('Rôle supprimé'); } }]),
        { label: 'Annuler' }, { label: 'Enregistrer et y passer', kind: 'primary', onClick: () => {
          if (kind === 'coach' && !teamIds.length) { toast('Choisis au moins une catégorie', 'err'); return false; }
          if ((kind === 'joueur' || kind === 'parent') && !playerId) { toast('Choisis le joueur', 'err'); return false; }
          const n = { id: r.id, kind, teamIds: kind === 'coach' ? teamIds : undefined, teamId: kind === 'joueur' || kind === 'parent' ? teamId : undefined, playerId: kind === 'joueur' || kind === 'parent' ? playerId : undefined };
          const l = list(), i = l.findIndex(x => x.id === r.id); if (i < 0) l.push(n); else l[i] = n; save(l);
          setTimeout(() => go(n), 60);
        } }] });
  }
  return { open, list, label, KINDS };
})();
