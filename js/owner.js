/* Owner: the space of the owner of Clubbo (#/proprietaire), reached with the owner key (never kept after the tab is closed).
   Activation codes for the new clubs, the list of the clubs (players, dirigeants, matches, last activity), suspend / reactivate a club,
   the phone notifications of the platform. */
const Owner = (() => {
  const { esc, $, $$, toast, modal, confirmBox } = UI;
  const K = 'ea-owner-key';
  const key = () => { try { return sessionStorage.getItem(K) || ''; } catch (e) { return ''; } };
  const setKey = v => { try { if (v) sessionStorage.setItem(K, v); else sessionStorage.removeItem(K); } catch (e) {} };
  const fmt = d => d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const ago = d => { if (!d) return 'jamais'; const n = Math.round((Date.now() - new Date(d)) / 864e5); return n <= 0 ? 'aujourd\'hui' : n === 1 ? 'hier' : `il y a ${n} jours`; };

  async function page(root) {
    const head = `<header class="page-head"><div><h1>👑 Propriétaire</h1><p class="sub">Clubbo · les clubs et leurs codes d'activation</p></div>
      ${key() ? '<div class="head-actions"><button class="btn" data-ow="out">Fermer l\'espace</button></div>' : ''}</header>`;
    if (!Cloud.canLogin()) { root.innerHTML = head + '<p class="tip">Le serveur Clubbo n\'est pas encore renseigné dans l\'appli (js/config.js).</p>'; return; }
    if (!key()) {
      root.innerHTML = head + `<section class="card"><h2>🔑 Clé du propriétaire</h2>
        <label class="fld"><span>Ta clé (au moins 12 caractères)</span><input id="owKey" type="password" autocomplete="off"></label>
        <div class="chips"><button class="btn primary" data-ow="in">Ouvrir</button><button class="btn" data-ow="init">Première fois : choisir ma clé</button></div>
        <p class="muted small">La clé se choisit une seule fois, dans les 24 heures après l'installation du serveur. Garde-la en lieu sûr : elle donne la main sur tous les clubs.</p></section>`;
      bind(root); return;
    }
    root.innerHTML = head + '<p class="muted">Chargement…</p>';
    let clubs, codes;
    try { [clubs, codes] = await Promise.all([Cloud.ownerClubs(key()), Cloud.ownerCodes(key(), 0)]); }
    catch (e) { if (e.code === 'PROPRIETAIRE') setKey(''); root.innerHTML = head + `<p class="tip">${esc(e.message)}</p>`; bind(root); return; }
    const free = codes.filter(c => !c.used), tot = k => clubs.reduce((a, c) => a + (+c[k] || 0), 0);
    root.innerHTML = head + `
      <div class="tiles"><div class="tile"><b>${clubs.length}</b><span>Clubs</span></div><div class="tile"><b>${clubs.filter(c => c.status === 'active').length}</b><span>Actifs</span></div>
        <div class="tile"><b>${tot('players')}</b><span>Joueurs</span></div><div class="tile"><b>${tot('accounts')}</b><span>Comptes</span></div><div class="tile"><b>${free.length}</b><span>Codes libres</span></div></div>
      <section class="card"><div class="row-head"><h2>🎟️ Codes d'activation</h2><button class="btn primary" data-ow="new">${I.plus}<span>Nouveaux codes</span></button></div>
        <p class="muted small">Remets un code à chaque club que tu inscris : il crée son espace avec « Créer mon club ». Un code ne sert qu'une fois.</p>
        <div class="ow-codes">${codes.map(c => `<div class="ow-code ${c.used ? 'used' : ''}"><code>${esc(c.code)}</code><span class="muted small">${c.used ? `utilisé par <b>${esc(c.club || '?')}</b> le ${fmt(c.used)}` : `libre${c.note ? ' · ' + esc(c.note) : ''}`}</span>${c.used ? '' : `<button class="btn soft small" data-owcopy="${esc(c.code)}">${I.copy}<span>Copier</span></button>`}</div>`).join('') || '<p class="muted">Aucun code pour l\'instant.</p>'}</div></section>
      <section class="card"><h2>🏟️ Les clubs</h2>
        <div class="ow-clubs">${clubs.map(c => `<div class="ow-club ${c.status}"><div><b>${esc(c.name)}</b> <span class="muted small">code : ${esc(c.slug)}</span>
          <span class="muted small">créé le ${fmt(c.created)} · dernière activité ${ago(c.seen)} · ${c.players} joueurs · ${c.staff} dirigeants (${c.accounts} comptes) · ${c.matches} matchs</span></div>
          <button class="btn ${c.status === 'active' ? 'danger' : 'primary'} small" data-owset="${esc(c.id)}" data-st="${c.status === 'active' ? 'suspended' : 'active'}">${c.status === 'active' ? 'Suspendre' : 'Réactiver'}</button></div>`).join('') || '<p class="muted">Aucun club inscrit.</p>'}</div></section>
      <section class="card"><h2>🔔 Notifications des téléphones</h2>
        <p class="muted small">Adresse de la fonction « raincy-push » déployée sur le serveur EA (Supabase → Edge Functions). Tous les clubs en profitent.</p>
        <label class="fld"><span>Adresse de la fonction</span><input id="owPush" placeholder="https://xxxx.supabase.co/functions/v1/raincy-push"></label>
        <button class="btn" data-ow="push">Enregistrer</button></section>`;
    bind(root);
  }
  function bind(root) {
    root.onclick = async e => {
      const b = e.target.closest('[data-ow], [data-owcopy], [data-owset]'); if (!b) return;
      const redraw = () => page(root);
      if (b.dataset.ow === 'in') { const v = $('#owKey', root).value.trim(); if (!v) return toast('Écris ta clé', 'err'); setKey(v); return redraw(); }
      if (b.dataset.ow === 'init') {
        const v = $('#owKey', root).value.trim(); if (v.length < 12) return toast('La clé doit faire au moins 12 caractères', 'err');
        if (!(await confirmBox('Cette clé sera la clé du propriétaire, pour toujours. Tu l\'as bien notée en lieu sûr ?', 'Oui, c\'est ma clé'))) return;
        try { await Cloud.ownerInit(v); setKey(v); toast('Clé enregistrée'); redraw(); } catch (x) { toast(x.code === 'PROPRIETAIRE' ? 'La clé du propriétaire est déjà choisie (ou le délai de 24 h est passé).' : x.message, 'err'); }
        return;
      }
      if (b.dataset.ow === 'out') { setKey(''); return redraw(); }
      if (b.dataset.ow === 'new') {
        return modal({ title: 'Nouveaux codes d\'activation', body: `<label class="fld"><span>Combien ?</span><input id="owN" type="number" min="1" max="50" value="1"></label><label class="fld"><span>Pour qui (note, facultatif)</span><input id="owNote" placeholder="ex : FC Exemple, contact M. Dupont"></label>`,
          actions: [{ label: 'Annuler' }, { label: 'Créer', kind: 'primary', onClick: (c, r) => { const n = +$('#owN', r).value || 1, note = $('#owNote', r).value.trim(); Cloud.ownerCodes(key(), n, note).then(() => { toast(`${n} code${n > 1 ? 's' : ''} créé${n > 1 ? 's' : ''}`); redraw(); }).catch(x => toast(x.message, 'err')); } }] });
      }
      if (b.dataset.owcopy) return navigator.clipboard.writeText(b.dataset.owcopy).then(() => toast('Code copié')).catch(() => toast(b.dataset.owcopy));
      if (b.dataset.owset) {
        if (b.dataset.st === 'suspended' && !(await confirmBox('Suspendre ce club ? Plus personne du club (éducateurs, joueurs, parents) ne pourra entrer, jusqu\'à ce que tu le réactives. Ses données sont gardées.', 'Suspendre'))) return;
        try { await Cloud.ownerClubSet(key(), b.dataset.owset, b.dataset.st); toast(b.dataset.st === 'active' ? 'Club réactivé' : 'Club suspendu'); redraw(); } catch (x) { toast(x.message, 'err'); }
      }
      if (b.dataset.ow === 'push') { try { await Cloud.ownerPush(key(), $('#owPush', root).value.trim()); toast('Enregistré'); } catch (x) { toast(x.message, 'err'); } }
    };
  }
  return { page };
})();
