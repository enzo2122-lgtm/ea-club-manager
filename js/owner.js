/* Owner: the space of the owner of Clubbo (#/proprietaire), reached with the owner key (never kept after the tab is closed).
   Activation codes for the new clubs, the list of the clubs (players, dirigeants, matches, last activity), suspend / reactivate a club,
   the phone notifications of the platform. */
const Owner = (() => {
  const { esc, $, $$, toast, modal, confirmBox } = UI;
  const K = 'ea-owner-key';
  const key = () => { try { return sessionStorage.getItem(K) || ''; } catch (e) { return ''; } };
  const setKey = v => { try { if (v) sessionStorage.setItem(K, v); else sessionStorage.removeItem(K); } catch (e) {} };
  const FREE_TEAMS = 3; // the free version: up to 3 teams (then the « Club » plan, 15 € a month)
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
    let clubs, codes, votes;
    try { [clubs, codes, reqs, votes] = await Promise.all([Cloud.ownerClubs(key()), Cloud.ownerCodes(key(), 0), Cloud.ownerRequests(key()).catch(() => []), Cloud.ownerVotes(key()).catch(() => [])]); }
    catch (e) { if (e.code === 'PROPRIETAIRE') setKey(''); root.innerHTML = head + `<p class="tip">${esc(e.message)}</p>`; bind(root); return; }
    const free = codes.filter(c => !c.used), tot = k => clubs.reduce((a, c) => a + (+c[k] || 0), 0);
    root.innerHTML = head + `
      <div class="tiles"><div class="tile"><b>${clubs.length}</b><span>Clubs</span></div><div class="tile"><b>${clubs.filter(c => c.status === 'active').length}</b><span>Actifs</span></div>
        <div class="tile"><b>${tot('players')}</b><span>Joueurs</span></div><div class="tile"><b>${tot('accounts')}</b><span>Comptes</span></div><div class="tile"><b>${free.length}</b><span>Codes libres</span></div>
        <div class="tile"><b>${clubs.filter(c => c.plan === 'club').length}</b><span>Formule Club</span></div><div class="tile"><b>${clubs.filter(c => +c.week > 0).length}</b><span>Actifs cette semaine</span></div><div class="tile"><b>${tot('families')}</b><span>Familles prévenues</span></div></div>
      ${requestsCard()}
      <section class="card"><div class="row-head"><h2>🎟️ Codes d'activation</h2><span class="chips"><button class="btn primary" data-ow="prep">🏟️<span>Préparer un club</span></button><button class="btn" data-ow="new">${I.plus}<span>Nouveaux codes</span></button></span></div>
        <p class="muted small">Remets un code à chaque club que tu inscris : il crée son espace avec « Créer mon club ». Un code ne sert qu'une fois.</p>
        <div class="ow-codes">${codes.map(c => `<div class="ow-code ${c.used ? 'used' : ''}"><code>${esc(c.code)}</code><span class="muted small">${c.used ? `utilisé par <b>${esc(c.club || '?')}</b> le ${fmt(c.used)}` : `libre${c.note ? ' · ' + esc(c.note) : ''}`}</span>${c.used ? '' : `<button class="btn soft small" data-owcopy="${esc(c.code)}">${I.copy}<span>Copier</span></button>`}</div>`).join('') || '<p class="muted">Aucun code pour l\'instant.</p>'}</div></section>
      <section class="card"><h2>🏟️ Les clubs</h2>
        <div class="ow-clubs">${clubs.map(c => `<div class="ow-club ${c.status}"><div><b>${esc(c.name)}</b> <span class="muted small">code : ${esc(c.slug)}</span>
          <span class="muted small">créé le ${fmt(c.created)} · dernière activité ${ago(c.seen)} · ${c.players} joueurs · ${c.staff} dirigeants (${c.accounts} comptes) · ${c.matches} matchs</span>
          <span class="small"><span class="ow-plan ${c.plan === 'club' ? 'club' : ''}">${c.plan === 'club' ? '⭐ Formule Club' : 'Gratuit'}</span> ${c.teams != null ? `· <b class="${c.plan !== 'club' && +c.teams > FREE_TEAMS ? 'ow-over' : ''}">${c.teams} équipe${c.teams > 1 ? 's' : ''}</b>${c.plan !== 'club' && +c.teams > FREE_TEAMS ? ' (au-delà de la version gratuite)' : ''}` : ''}
            ${c.week != null ? ` · ${c.week} changement${c.week > 1 ? 's' : ''} en 7 jours · ${c.families || 0} famille${c.families > 1 ? 's' : ''} prévenue${c.families > 1 ? 's' : ''} · 👍 ${c.up || 0} 👎 ${c.down || 0}` : ''}</span></div>
          <div class="chips"><button class="btn small" data-owplan="${esc(c.id)}" data-plan="${c.plan === 'club' ? 'free' : 'club'}">${c.plan === 'club' ? 'Repasser en gratuit' : '⭐ Formule Club'}</button>
          <button class="btn ${c.status === 'active' ? 'danger' : 'primary'} small" data-owset="${esc(c.id)}" data-st="${c.status === 'active' ? 'suspended' : 'active'}">${c.status === 'active' ? 'Suspendre' : 'Réactiver'}</button></div></div>`).join('') || '<p class="muted">Aucun club inscrit.</p>'}</div></section>
      ${(votes || []).length ? `<section class="card"><h2>📊 Avis sur les pages (tous les clubs)</h2><p class="muted small">« Cette page t'aide ? » : les pages les moins aimées d'abord. Ce sont elles à simplifier.</p>
        <div class="vote-list">${votes.slice(0, 20).map(v => `<div><span>${esc(v.page || '?')}</span><b class="v-up">👍 ${+v.up || 0}</b><b class="v-down">👎 ${+v.down || 0}</b></div>`).join('')}</div></section>` : ''}
      <section class="card"><h2>🔔 Notifications des téléphones</h2>
        <p class="muted small">Adresse de la fonction « raincy-push » déployée sur le serveur EA (Supabase → Edge Functions). Tous les clubs en profitent.</p>
        <label class="fld"><span>Adresse de la fonction</span><input id="owPush" placeholder="https://xxxx.supabase.co/functions/v1/raincy-push"></label>
        <button class="btn" data-ow="push">Enregistrer</button></section>`;
    bind(root); mountAlert(root);
  }
  /* ---------- (1.22) the requests sent from « Découvrir Clubbo » ---------- */
  let reqs = [];
  const isMail = c => /@/.test(c);
  const phone = c => { const d = String(c).replace(/[^\d+]/g, ''); return d.startsWith('+') ? d.slice(1) : d.startsWith('00') ? d.slice(2) : d.startsWith('0') ? '33' + d.slice(1) : d; };
  const contactLink = c => isMail(c) ? `<a href="mailto:${esc(c)}">${esc(c)}</a>` : `<a href="tel:${esc(String(c).replace(/[^\d+]/g, ''))}">${esc(c)}</a>`;
  function requestsCard() {
    const open = reqs.filter(r => r.status === 'new');
    return `<section class="card"><h2>📨 Demandes de code${open.length ? ` <span class="ow-new">${open.length} nouvelle${open.length > 1 ? 's' : ''}</span>` : ''}</h2>
      <p class="muted small">Envoyées depuis la page « Découvrir Clubbo ». « Donner un code » crée le code et prépare le message à envoyer.</p>
      <div id="owAlert" class="ow-alert"></div>
      <div class="ow-reqs">${reqs.slice(0, 40).map(r => `<div class="ow-req ${esc(r.status)}"><div><b>${esc(r.club)}</b> <span class="muted small">${[r.sport, r.town, fmt(r.at)].filter(Boolean).map(esc).join(' · ')}</span>
          <span class="small">${esc(r.name)} · ${contactLink(r.contact)}</span>${r.message ? `<span class="muted small">« ${esc(r.message)} »</span>` : ''}
          ${r.code ? `<span class="small">Code donné : <code>${esc(r.code)}</code></span>` : ''}</div>
        <div class="chips">${r.status === 'new' ? `<button class="btn primary small" data-owreq="${esc(r.id)}" data-act="give">Donner un code</button><button class="btn small" data-owreq="${esc(r.id)}" data-act="drop">Écarter</button>`
          : r.code ? `<button class="btn small" data-owreq="${esc(r.id)}" data-act="send">Renvoyer le message</button>` : '<span class="muted small">Écartée</span>'}</div></div>`).join('') || '<p class="muted">Aucune demande pour l\'instant.</p>'}</div></section>`;
  }
  /* a notification on this phone at each new request (the platform's push, the phone then reads ea_owner_news) */
  const pushOk = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const b64 = s => { const p = '='.repeat((4 - s.length % 4) % 4), raw = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(raw, c => c.charCodeAt(0)); };
  async function mySub() { try { const reg = await navigator.serviceWorker.ready; return await reg.pushManager.getSubscription(); } catch (e) { return null; } }
  async function mountAlert(root) {
    const box = $('#owAlert', root); if (!box) return;
    if (!pushOk()) { box.innerHTML = '<p class="muted small">🔔 Ce navigateur ne reçoit pas de notifications. Sur iPhone : ajoute d\'abord Clubbo à l\'écran d\'accueil, puis ouvre-le depuis là.</p>'; return; }
    const sub = await mySub(); let on = false;
    try { on = sub ? (await Cloud.ownerSub(key(), sub.endpoint)).on : false; } catch (e) {}
    box.innerHTML = on ? '<p class="small">🔔 Ce téléphone est prévenu à chaque nouvelle demande. <button class="btn small" data-owalert="off">Ne plus me prévenir</button></p>'
      : '<button class="btn primary small" data-owalert="on">🔔 Me prévenir sur ce téléphone</button>';
  }
  async function setAlert(on, root) {
    try {
      if (!on) { const sub = await mySub(); if (sub) await Cloud.ownerSub(key(), sub.endpoint, false); toast('Tu ne seras plus prévenu sur ce téléphone'); return mountAlert(root); }
      if (await Notification.requestPermission() !== 'granted') return toast('Autorise les notifications pour Clubbo dans les réglages du téléphone', 'err');
      const k = (await Cloud.ownerSub(key())).key; if (!k) return toast('Les notifications ne sont pas encore prêtes sur le serveur', 'err');
      const reg = await navigator.serviceWorker.ready; let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(k) });
      await Cloud.ownerSub(key(), sub.endpoint, true); toast('C\'est fait : ce téléphone sera prévenu 🔔'); mountAlert(root);
    } catch (e) { toast(e.message || 'Notifications impossibles sur ce téléphone', 'err'); }
  }
  /* ---------- (3.59) « Préparer un club »: the club ready before the code is given — its name, its FFF page (automatic results,
     calendar, standings from the first opening) and the plan offered; then the message to send, with the link already filled
     and the way to put the Footclubs bookmark on the computer ---------- */
  // (3.60) the club's FFF number checked at once with the FFF's public API (open to web apps): its real name and its teams
  async function fffCheck(n) {
    const get = async u => { const r = await fetch('https://api-dofa.fff.fr' + u, { headers: { accept: 'application/ld+json' } }); if (!r.ok) return null; const j = await r.json(); return Array.isArray(j) ? j : (j['hydra:member'] || j); };
    let c = ((await get('/api/clubs?cl_cod=' + encodeURIComponent(n))) || []).find(y => String(y.affiliation_number) === String(n));
    if (!c) { const x = await get('/api/clubs/' + encodeURIComponent(n)); if (x && x.cl_no) c = x; }
    if (!c) return null;
    const eq = (await get('/api/clubs/' + c.cl_no + '/equipes')) || [];
    return { name: c.name, aff: String(c.affiliation_number || n), teams: Array.isArray(eq) ? eq.length : 0 };
  }
  function prepare(redraw) {
    modal({ title: '🏟️ Préparer un club', noFocus: true, body: `<p class="muted small">Le club reçoit un lien où tout est déjà rempli : il n'a plus qu'à écrire son nom et son mot de passe de responsable. Il arrive avec la FFF branchée.</p>
      <label class="fld"><span>Nom du club</span><input id="opName" placeholder="ex : JS Paris 10" maxlength="80"></label>
      <label class="fld"><span>Sa page sur epreuves.fff.fr (ou son numéro de club)</span><input id="opFff" placeholder="https://epreuves.fff.fr/competition/club/552176" inputmode="url"></label>
      <p id="opFound" class="small" aria-live="polite"></p>
      <p class="muted small"><a class="btn soft small" href="https://epreuves.fff.fr/" target="_blank" rel="noopener">🔍 Chercher le club sur le site de la FFF</a> Choisis la région, tape le nom, ouvre la fiche du club et copie son adresse. Clubbo vérifie aussitôt le numéro et affiche le nom officiel du club. Facultatif : le club pourra la mettre lui-même.</p>
      <label class="check"><input type="checkbox" id="opPlan" checked> <span>⭐ Formule Club offerte (toutes les équipes, sans limite)</span></label>`,
      onOpen: r => { let tm = null, seq = 0; const out = $('#opFound', r);
        $('#opFff', r).oninput = e => { clearTimeout(tm); const v = e.target.value.trim(), n = (/club\/(\d+)/.exec(v) || /^(\d{4,})$/.exec(v) || [])[1]; out.textContent = ''; if (!n) return;
          tm = setTimeout(async () => { const my = ++seq; out.textContent = '… vérification à la FFF'; let x = null; try { x = await fffCheck(n); } catch (er) { x = undefined; } if (my !== seq) return;
            out.innerHTML = x ? `✅ <b>${esc(x.name)}</b> · n° ${esc(x.aff)} · ${x.teams} équipe${x.teams > 1 ? 's' : ''}` : x === undefined ? '⚠️ La FFF ne répond pas : le numéro sera vérifié plus tard' : '❌ Aucun club à la FFF avec ce numéro : vérifie l\'adresse';
            if (x && x.aff !== n) e.target.dataset.aff = x.aff; else delete e.target.dataset.aff;
            if (x && !$('#opName', r).value.trim()) $('#opName', r).value = x.name.replace(/\b(\w)(\w*)/g, (m0, a, b2) => a + b2.toLowerCase()); }, 500); }; },
      actions: [{ label: 'Annuler' }, { label: 'Préparer', kind: 'primary', onClick: (c, r) => {
        const name = $('#opName', r).value.trim(), raw = $('#opFff', r).value.trim(), fff = $('#opFff', r).dataset.aff || (/club\/(\d+)/.exec(raw) || /^(\d{4,})$/.exec(raw) || [])[1] || '';
        if (name.length < 2) { toast('Écris le nom du club', 'err'); return false; }
        if (raw && !fff) { toast('Colle l\'adresse de la page du club sur epreuves.fff.fr (elle finit par /club/ et un numéro), ou laisse vide', 'err'); return false; }
        Cloud.ownerPrepare(key(), name, fff, $('#opPlan', r).checked ? 'club' : 'free').then(x => { redraw(); setTimeout(() => prepMessage(x.code, name, fff), 300); })
          .catch(x => toast(x.code === 'PROPRIETAIRE' ? 'Clé du propriétaire refusée' : /function|not find|does not exist/i.test(x.message || '') ? 'Le serveur n\'est pas encore à jour : colle supabase/clubs-prepares.sql dans Supabase' : x.message, 'err'));
      } }] });
  }
  function prepMessage(code, name, fff) {
    // always the address of Clubbo (the owner may be in the app of one club)
    const base = AppCfg.fixed ? 'https://enzo2122-lgtm.github.io/ea-club-manager/' : Cloud.appUrl(), link = `${base}#creer=${code}`, disc = base + 'decouvrir.html';
    const text = [`Salut 👋`, '', `Je t'ai préparé Clubbo pour ${name} : équipes, séances, matchs, convocations, compos, causeries, stats, et un espace pour les joueurs et les parents. C'est offert.`, '',
      `1️⃣ Découvre l'appli (2 minutes) : ${disc}`, '',
      `2️⃣ Crée ton espace (tout est déjà rempli, il reste ton nom et ton mot de passe) : ${link}`, '',
      `3️⃣ Sur ton téléphone : ouvre le lien dans Safari (iPhone) ou Chrome (Android), puis Partager (ou ⋮) → « Sur l'écran d'accueil ».`, '',
      ...(fff ? [`⚽ La FFF est déjà branchée : les scores, le calendrier et les classements de tes équipes arrivent tout seuls.`, ''] : []),
      `💻 Sur ton ordinateur, une seule fois, pour les licenciés de Footclubs : ouvre ${base}#/reglages, connecte-toi, puis dans « Mise à jour depuis Footclubs » fais glisser le bouton « Footclubs → Clubbo » dans la barre des favoris. Ensuite : connecte-toi à Footclubs et touche ce favori, tes joueurs arrivent dans l'appli.`, '',
      `Ensuite : crée tes équipes, invite tes éducateurs (Réglages → Comptes des dirigeants) et donne leurs codes aux joueurs et aux parents (page Codes).`, '',
      `Si tu bloques, appelle-moi 😉`].join('\n');
    modal({ title: `✅ ${name} est prêt`, noFocus: true, body: `<p class="small">Code : <code>${esc(code)}</code> · lien de création : <a href="${esc(link)}" target="_blank" rel="noopener">${esc(link)}</a></p>
      <p class="muted small">Le message à envoyer au responsable du club (modifie-le si tu veux) :</p><textarea id="opMsg" rows="14" style="width:100%">${esc(text)}</textarea>`,
      actions: [{ label: 'Fermer' }, { label: 'WhatsApp', onClick: (c, x) => { window.open('https://wa.me/?text=' + encodeURIComponent($('#opMsg', x).value), '_blank', 'noopener'); return false; } },
        { label: 'Copier', kind: 'primary', onClick: (c, x) => { navigator.clipboard.writeText($('#opMsg', x).value).then(() => toast('Message copié')).catch(() => toast('Copie impossible : sélectionne le texte', 'err')); return false; } }] });
  }
  // the code and the way to use it, ready to send by e-mail or WhatsApp
  function sendCode(r, code) {
    const first = String(r.name || '').trim().split(/\s+/)[0] || '';
    const text = `Bonjour ${first}, merci pour ta demande ! Voici le code d'activation Clubbo pour ${r.club} : ${code}\nCrée ton club ici : ${Cloud.appUrl()}#creer (touche « Créer mon club » et colle le code).\nÀ bientôt sur Clubbo !`;
    modal({ title: 'Envoyer le code', noFocus: true, body: `<p class="muted small">À ${esc(r.name)} (${esc(r.contact)}).</p><textarea id="owMsg" rows="7">${esc(text)}</textarea>`,
      actions: [
        isMail(r.contact) ? { label: 'E-mail', kind: 'primary', onClick: (c, x) => { location.href = `mailto:${encodeURIComponent(r.contact)}?subject=${encodeURIComponent('Ton code Clubbo')}&body=${encodeURIComponent($('#owMsg', x).value)}`; return false; } }
          : { label: 'WhatsApp', kind: 'primary', onClick: (c, x) => { window.open(`https://wa.me/${phone(r.contact)}?text=${encodeURIComponent($('#owMsg', x).value)}`, '_blank'); return false; } },
        { label: 'Copier', onClick: (c, x) => { navigator.clipboard.writeText($('#owMsg', x).value).then(() => toast('Message copié')).catch(() => toast('Sélectionne le texte et copie-le')); return false; } }] });
  }
  async function onRequest(b, redraw) {
    const r = reqs.find(x => x.id === b.dataset.owreq); if (!r) return;
    try {
      if (b.dataset.act === 'drop') { reqs = await Cloud.ownerRequests(key(), r.id, 'dropped'); return redraw(); }
      if (b.dataset.act === 'send') return sendCode(r, r.code);
      const codes = await Cloud.ownerCodes(key(), 1, 'Demande : ' + r.club), code = (codes[0] || {}).code;
      if (!code) return toast('Code non créé', 'err');
      reqs = await Cloud.ownerRequests(key(), r.id, 'done', code); redraw(); setTimeout(() => sendCode(r, code), 400);
    } catch (x) { toast(x.message, 'err'); }
  }
  function bind(root) {
    root.onclick = async e => {
      const b = e.target.closest('[data-ow], [data-owcopy], [data-owset], [data-owreq], [data-owalert], [data-owplan]'); if (!b) return;
      const redraw = () => page(root);
      if (b.dataset.owreq) return onRequest(b, redraw);
      if (b.dataset.owplan) { try { await Cloud.ownerClubPlan(key(), b.dataset.owplan, b.dataset.plan); toast(b.dataset.plan === 'club' ? 'Club passé en formule Club ⭐' : 'Club repassé en gratuit'); redraw(); } catch (x) { toast(x.message, 'err'); } return; }
      if (b.dataset.owalert) return setAlert(b.dataset.owalert === 'on', root);
      if (b.dataset.ow === 'in') { const v = $('#owKey', root).value.trim(); if (!v) return toast('Écris ta clé', 'err'); setKey(v); return redraw(); }
      if (b.dataset.ow === 'init') {
        const v = $('#owKey', root).value.trim(); if (v.length < 12) return toast('La clé doit faire au moins 12 caractères', 'err');
        if (!(await confirmBox('Cette clé sera la clé du propriétaire, pour toujours. Tu l\'as bien notée en lieu sûr ?', 'Oui, c\'est ma clé'))) return;
        try { await Cloud.ownerInit(v); setKey(v); toast('Clé enregistrée'); redraw(); } catch (x) { toast(x.code === 'PROPRIETAIRE' ? 'La clé du propriétaire est déjà choisie (ou le délai de 24 h est passé).' : x.message, 'err'); }
        return;
      }
      if (b.dataset.ow === 'out') { setKey(''); return redraw(); }
      if (b.dataset.ow === 'prep') return prepare(redraw);
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
