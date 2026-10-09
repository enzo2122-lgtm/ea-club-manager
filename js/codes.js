/* Personal codes of the licensees (#/codes/teamId) and the QR codes of the app.
   Each player has one code (made by the club server): it opens his own page, or his parents' page, and nothing else.
   A coach sees the codes of his categories that he has not handed out yet: once he ticks « remis », the code leaves his list.
   The responsables see every code (handed out or not, by whom, used or not), make a new one if a code is lost, and print
   the cards (name, code, QR code of the category) or the list. Each category also has its QR code: it opens the page where
   a player or a parent types his code. */
const Codes = (() => {
  const { esc, $, $$, toast, modal, confirmBox } = UI;
  const S = () => Store.state;
  const pretty = c => String(c || '').replace(/^(.{4})(.+)$/, '$1-$2');
  const base = () => location.href.split('#')[0].split('?')[0].replace(/index\.html$/, '');
  const catUrl = name => base() + 'moi.html#cat=' + encodeURIComponent(name);
  const appUrl = () => base();
  const byName = (a, b) => String(a.lastName || '').localeCompare(String(b.lastName || ''), 'fr') || String(a.firstName || '').localeCompare(String(b.firstName || ''), 'fr');
  const full = p => `${String(p.lastName || '').toUpperCase()} ${p.firstName || ''}`.trim();
  let cache = {}; // teamId → { at, map }

  /* ---------- QR codes (small library, loaded the first time) ---------- */
  let qrLib = null;
  function loadQr() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    return qrLib = qrLib || new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js';
      s.onload = () => res(window.qrcode); s.onerror = () => { qrLib = null; rej(new Error('QR code indisponible : vérifie la connexion internet.')); }; document.head.appendChild(s); });
  }
  const svg = (text, cell = 4) => { const q = window.qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: cell, margin: 2, scalable: true }); };

  /* ---------- the categories this dirigeant sees, and their players ---------- */
  const groups = () => Store.teamGroups(Auth.teams()).filter(g => g.length);
  function playersOf(t) {
    const g = groups().find(x => x.some(y => y.id === t.id)) || [t];
    const ids = Store.isSub(t) ? [t.id] : g.map(x => x.id);
    return S().players.filter(p => (p.teamIds || []).some(id => ids.includes(id))).sort(byName);
  }
  async function codesOf(t, force) {
    const c = cache[t.id]; if (!force && c && Date.now() - c.at < 60000) return c.map;
    const map = await Cloud.memberCodes(playersOf(t).map(p => p.id)) || {};
    cache[t.id] = { at: Date.now(), map }; return map;
  }

  /* ---------- the page ---------- */
  async function page(root, teamId) {
    const admin = Auth.isAdmin(), ui = S().ui.codes = S().ui.codes || { show: 'todo' };
    const all = groups().flat(), t = Store.get('teams', teamId) || Store.get('teams', ui.team) || all[0];
    if (t) ui.team = t.id;
    const head = `<header class="page-head"><div><h1>🔑 Codes personnels</h1><p class="sub">Un code par licencié : il ouvre sa page (joueur ou parents), et seulement la sienne</p></div>
      <div class="head-actions">${t ? `<button class="btn" data-cq="cat">📱<span>QR de la catégorie</span></button>` : ''}${admin ? `<button class="btn" data-cq="app">📲<span>QR de l'appli</span></button>` : ''}</div></header>
      <div class="chips">${groups().map(g => `<span class="team-fam">${g.map(x => `<button class="chip ${Store.isSub(x) ? 'sub' : ''} ${t && x.id === t.id ? 'on' : ''}" data-ct="${x.id}">${esc(x.name)}</button>`).join('')}</span>`).join('')}</div>`;
    if (!t) { root.innerHTML = head + '<p class="muted">Aucune catégorie.</p>'; return bind(root, t); }
    if (!Cloud.ready()) { root.innerHTML = head + '<p class="tip">Les codes sont faits par le serveur du club : connecte l\'appli au serveur (Réglages).</p>'; return bind(root, t); }
    root.innerHTML = head + '<p class="muted">Chargement des codes…</p>';
    let map;
    try { map = await codesOf(t, true); } catch (e) { root.innerHTML = head + `<p class="tip">${esc(e.message)}</p>`; return bind(root, t); }
    if (location.hash.split('/')[1] !== 'codes') return; // left the page meanwhile
    const ps = playersOf(t), given = ps.filter(p => (map[p.id] || {}).given), todo = ps.filter(p => map[p.id] && !(map[p.id] || {}).given);
    // handed out but never opened: the ones to remind (the coach sees their names, not their codes)
    const wait = given.filter(p => !(map[p.id] || {}).first), on = ps.filter(p => (map[p.id] || {}).first);
    const silent = on.filter(p => Date.now() - new Date((map[p.id] || {}).used || 0) > 30 * 864e5); // (2.26) the app not opened for a month
    const rows = admin ? (ui.show === 'todo' ? todo : ui.show === 'wait' ? wait : ui.show === 'given' ? given : ps) : todo;
    const d = x => x ? new Date(x).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';
    // (2.67) the invitation codes of the category: a player without a licence signs up with one, the coach validates his card
    let guests = null; try { guests = await Cloud.guestCodes(t.id, 0); } catch (e) { guests = e.message; }
    // (2.75) each invitation is a unique link (moi.html#c=CODE), good for 60 days; the expired ones are shown apart
    const gFree = Array.isArray(guests) ? guests.filter(g => !g.used && !g.expired) : [], gUsed = Array.isArray(guests) ? guests.filter(g => g.used) : [], gOld = Array.isArray(guests) ? guests.filter(g => !g.used && g.expired) : [];
    const gLink = g => base() + 'moi.html#c=' + pretty(g.code), gLeft = g => Math.max(0, 60 - Math.floor((Date.now() - new Date(g.at)) / 864e5));
    const gStatus = g => g.status === 'pending' ? `<a href="#/joueur/${esc(g.player)}" class="wait">⏳ à valider</a>` : g.status === 'ok' ? '<b class="ok">✓ validé</b>' : '<span class="muted">refusé</span>';
    const guestHtml = `<section class="card guest-card"><div class="row-head"><h3>🎟️ Codes d'invitation</h3><div class="chips"><button class="btn primary small" data-gnew ${Array.isArray(guests) ? '' : 'disabled'}>＋<span>10 codes</span></button><button class="btn small" data-gprint ${gFree.length ? '' : 'disabled'}>🖨️<span>Imprimer (${gFree.length})</span></button></div></div>
        <p class="muted small">Pour un joueur qui vient essayer <b>sans licence</b> (pas encore dans Footclubs) : tu lui donnes un code, il s'inscrit lui-même sur <b>${esc(base().replace(/^https?:\/\//, ''))}moi.html</b> (prénom, nom, date de naissance). Tant que tu n'as pas validé sa fiche, il ne voit que le nom du club et sa catégorie : pas de chat, pas de séances, pas de convocations.</p>
        ${Array.isArray(guests) ? `${gFree.length ? `<div class="guest-codes">${gFree.map(g => `<span class="guest-code"><code class="cr-code">${esc(pretty(g.code))}</code><button class="btn small" data-glink="${esc(g.code)}" title="Copier le lien d'invitation">🔗</button><button class="btn small" data-gwa="${esc(g.code)}" title="Envoyer sur WhatsApp">💬</button><span class="muted small">${gLeft(g)} j</span></span>`).join('')}</div><p class="muted small">🔗 copie le lien unique de l'invitation (il ouvre directement l'inscription) · 💬 l'envoie sur WhatsApp. Une invitation non utilisée s'éteint au bout de 60 jours.</p>` : '<p class="muted small">Aucun code libre : crée-en 10.</p>'}
          ${gOld.length ? `<p class="muted small">⌛ ${gOld.length} invitation${gOld.length > 1 ? 's' : ''} expirée${gOld.length > 1 ? 's' : ''} (jamais utilisée${gOld.length > 1 ? 's' : ''} en 60 jours) : elle${gOld.length > 1 ? 's' : ''} ser${gOld.length > 1 ? 'ont' : 'a'} supprimée${gOld.length > 1 ? 's' : ''} à la prochaine création de codes.</p>` : ''}
          ${gUsed.length ? `<div class="codes-list">${gUsed.map(g => `<div class="code-row given"><span class="cr-name"><b>${esc(g.name || 'Fiche supprimée')}</b><span class="muted small">inscrit le ${esc(d(g.used))}</span></span><code class="cr-code">${esc(pretty(g.code))}</code><span>${gStatus(g)}</span></div>`).join('')}</div>` : ''}`
          : `<p class="tip">${esc(guests || 'Le serveur du club doit être mis à jour (supabase/codes-invites.sql).')}</p>`}</section>`;
    root.innerHTML = head + `
      <section class="card codes-card">
        <p class="muted small">${admin ? `${ps.length} licencié${ps.length > 1 ? 's' : ''} · ${todo.length} code${todo.length > 1 ? 's' : ''} à remettre · ${given.length} remis.${silent.length ? ` · 📶 ${silent.length} silencieux (pas ouvert l'appli depuis 30 jours : ${silent.map(p => esc(Store.shortName(p))).join(', ')})` : ''}`
          : `${todo.length} code${todo.length > 1 ? 's' : ''} à remettre${given.length ? ` · ${given.length} déjà remis (le responsable du club les garde)` : ''}.`}
          Remets à chacun son code (en main propre ou sur sa carte), puis coche « Remis ».</p>
        <p class="codes-stat"><b class="ok">✓ ${on.length} activé${on.length > 1 ? 's' : ''}</b> · <b class="wait">⏳ ${wait.length} remis, pas encore activé${wait.length > 1 ? 's' : ''}</b> · ${todo.length} à remettre</p>
        ${admin ? `<div class="seg" role="tablist">${[['todo', 'À remettre'], ['wait', `À relancer (${wait.length})`], ['given', 'Remis'], ['all', 'Tous']].map(([k, l]) => `<button class="seg-b ${ui.show === k ? 'on' : ''}" data-cs="${k}">${l}</button>`).join('')}</div>` : ''}
        <div class="chips codes-acts"><button class="btn primary" data-cp="cards" ${rows.length ? '' : 'disabled'}>🖨️<span>Imprimer les cartes (${rows.length})</span></button><button class="btn" data-cp="list" ${rows.length ? '' : 'disabled'}>🧾<span>Imprimer la liste</span></button></div>
        <div class="codes-list">${rows.map(p => { const c = map[p.id] || {};
          return `<div class="code-row ${c.given ? 'given' : ''}"><span class="cr-name"><b>${esc(full(p))}</b><span class="muted small">${p.birth ? esc(p.birth.slice(0, 4)) : ''}${c.first ? ` · <b class="ok">✓ activé le ${esc(d(c.first))}</b>` : c.given ? ' · <b class="wait">⏳ pas encore activé</b>' : ''}${admin && c.given ? ` · remis le ${esc(d(c.given))}${c.by ? ' par ' + esc(c.by) : ''}` : ''}</span></span>
            <code class="cr-code">${c.code ? esc(pretty(c.code)) : '—'}</code>
            <label class="cr-given"><input type="checkbox" data-cg="${p.id}" ${c.given ? 'checked' : ''} ${!admin && c.given ? 'disabled' : ''}><span>Remis</span></label>
            ${c.given && !c.first ? `<button class="btn soft small" data-rl="${p.id}">💬<span>Relancer</span></button>` : ''}
            ${admin ? `<button class="icon-btn" data-cr="${p.id}" title="Nouveau code (l'ancien ne marchera plus)" aria-label="Nouveau code pour ${esc(full(p))}">↻</button>` : ''}</div>`; }).join('') || `<p class="muted">${admin ? 'Personne dans cette liste.' : 'Tous les codes de la catégorie ont été remis. 👍'}</p>`}</div>
      </section>
      ${guestHtml}
      ${!admin && wait.length ? `<section class="card"><div class="row-head"><h3>⏳ Remis, pas encore activés (${wait.length})</h3><button class="btn soft" data-rlall>📋<span>Copier la liste</span></button></div>
        <p class="muted small">Ces familles ont reçu leur code mais n'ont pas encore ouvert leur espace : relance-les.</p>
        <div class="codes-list">${wait.map(p => `<div class="code-row"><span class="cr-name"><b>${esc(full(p))}</b><span class="muted small">remis le ${esc(d((map[p.id] || {}).given))}</span></span><button class="btn soft small" data-rl="${p.id}">💬<span>Relancer</span></button></div>`).join('')}</div></section>` : ''}
      ${admin && wait.length && ui.show === 'wait' ? `<p><button class="btn soft" data-rlall>📋<span>Copier la liste à relancer</span></button></p>` : ''}
      <p class="muted small">Tu reçois une notification quand une famille ouvre son espace pour la première fois. Le joueur (ou ses parents) scanne le QR code de la catégorie, ou ouvre <b>${esc(base().replace(/^https?:\/\//, ''))}moi.html</b>, puis tape son code. Il ne voit que ses convocations, son temps de jeu, et les matchs et séances de sa catégorie. Un code perdu ou qui a circulé : le responsable en fait un nouveau (↻).</p>`;
    bind(root, t, rows, map, wait, gFree);
  }
  function bind(root, t, rows = [], map = {}, wait = [], gFree = []) {
    root.onchange = async e => {
      const cb = e.target.closest('[data-cg]'); if (!cb) return;
      const p = Store.get('players', cb.dataset.cg), on = cb.checked;
      if (!Auth.isAdmin() && on && !(await confirmBox(`Code remis à ${full(p)} ? Il disparaîtra de ta liste (le responsable du club le garde).`, 'Remis'))) { cb.checked = false; return; }
      try { await Cloud.memberGiven(p.id, on); cache[t.id] = null; toast(on ? 'Code remis ✓' : 'Remis à faire'); page(root, t.id); }
      catch (x) { cb.checked = !on; toast(x.message, 'err'); }
    };
    root.onclick = async e => {
      const ct = e.target.closest('[data-ct]'); if (ct) { location.hash = '#/codes/' + ct.dataset.ct; return; }
      const cs = e.target.closest('[data-cs]'); if (cs) { S().ui.codes.show = cs.dataset.cs; Store.persistNow(); page(root, t.id); return; }
      const cr = e.target.closest('[data-cr]');
      if (cr) { const p = Store.get('players', cr.dataset.cr);
        if (!(await confirmBox(`Nouveau code pour ${full(p)} ? L'ancien ne marchera plus : il faudra lui remettre le nouveau.`, 'Nouveau code'))) return;
        try { await Cloud.memberCodes([p.id], [p.id]); cache[t.id] = null; toast('Nouveau code créé'); page(root, t.id); } catch (x) { toast(x.message, 'err'); } return; }
      const rl = e.target.closest('[data-rl]');
      if (rl) { const p = Store.get('players', rl.dataset.rl), txt = `Bonjour, c'est ${Messages.coachName(Auth.current() || {}) || 'le coach'} (${S().club.name}). Pensez à ouvrir l'espace de ${p.firstName || full(p)} : convocations, horaires, temps de jeu. Scannez le QR code ou ouvrez ${catUrl(t.name)} puis tapez le code personnel qui vous a été remis. Merci !`;
        window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank'); return; }
      if (e.target.closest('[data-rlall]')) { const txt = `${t.name} · codes remis, espace pas encore ouvert :\n` + wait.map(p => '• ' + full(p)).join('\n');
        navigator.clipboard.writeText(txt).then(() => toast('Liste copiée')).catch(() => toast(txt)); return; }
      const cq = e.target.closest('[data-cq]'); if (cq) { cq.dataset.cq === 'app' ? qrDialog('app') : qrDialog('cat', t); return; }
      // (2.67) invitation codes
      if (e.target.closest('[data-gnew]')) { try { await Cloud.guestCodes(t.id, 10); toast('10 codes d\'invitation créés'); page(root, t.id); } catch (x) { toast(/LIMITE/.test(x.message) ? 'Déjà beaucoup de codes libres : distribue-les d\'abord.' : x.message, 'err'); } return; }
      const gl = e.target.closest('[data-glink]'); if (gl) { const u = base() + 'moi.html#c=' + pretty(gl.dataset.glink); navigator.clipboard.writeText(u).then(() => toast('Lien d\'invitation copié')).catch(() => toast(u)); return; }
      const gw = e.target.closest('[data-gwa]'); if (gw) { const u = base() + 'moi.html#c=' + pretty(gw.dataset.gwa), txt = `Bonjour, c'est ${Messages.coachName(Auth.current() || {}) || 'le coach'} (${S().club.name}). Pour venir essayer avec les ${t.name}, inscris-toi avec ce lien (il est personnel, valable 60 jours) : ${u}`; window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank'); return; }
      if (e.target.closest('[data-gprint]')) { print(`<h2>🎟️ ${esc(S().club.name)} · ${esc(t.name)} · codes d'invitation</h2><p>Pour venir essayer sans licence : ouvre <b>${esc(base().replace(/^https?:\/\//, ''))}moi.html</b>, tape ton code et inscris-toi (prénom, nom, date de naissance). Le coach valide ensuite ta fiche.</p>
        <div class="print-codes">${gFree.map(g => `<div class="print-code"><b>${esc(pretty(g.code))}</b><span>${esc(t.name)} · ${esc(S().club.name)}</span></div>`).join('')}</div>`, 'print-list'); return; }
      const cp = e.target.closest('[data-cp]'); if (cp) { cp.dataset.cp === 'cards' ? printCards(t, rows, map) : printList(t, rows, map); }
    };
  }

  /* ---------- QR code of a category (to the personal code) or of the coaches' app ---------- */
  async function qrDialog(kind, t) {
    try { await loadQr(); } catch (e) { return toast(e.message, 'err'); }
    const club = S().club.name, url = kind === 'app' ? appUrl() : catUrl(t.name);
    const title = kind === 'app' ? `L'appli des coachs · ${club}` : `${club} · ${t.name}`;
    const text = kind === 'app' ? `${club} · l'appli des coachs et dirigeants :\n${url}` : `${club} · ${t.name}\nL'espace des joueurs et des parents : scanne ou ouvre le lien, puis tape le code personnel que le club t'a remis.\n${url}`;
    modal({ title: kind === 'app' ? '📲 QR code de l\'appli' : `📱 QR code · ${t.name}`, noFocus: true,
      body: `<div class="qr-big">${svg(url, 6)}</div><p class="muted small qr-url">${esc(url)}</p>
        <p>${kind === 'app' ? 'Pour les coachs et dirigeants : ils scannent, ouvrent l\'appli et se connectent avec leur compte.' : 'À afficher au club ou à envoyer aux familles : chacun scanne, puis tape son <b>code personnel</b>. Sans code, on ne voit rien.'}</p>`,
      actions: [{ label: 'Copier le lien', icon: I.copy, onClick: () => { navigator.clipboard.writeText(url).then(() => toast('Lien copié')).catch(() => toast('Sélectionne le lien et copie-le')); return false; } },
        { label: 'WhatsApp', icon: I.share, onClick: () => { window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank'); return false; } },
        { label: 'Imprimer', kind: 'primary', icon: I.download, onClick: () => { printPoster(title, url, kind); return false; } }] });
  }

  /* ---------- printing (A4 sheets; on a phone, « Enregistrer en PDF ») ---------- */
  // (2.76) the installed app on iPhone cannot print (iOS gives it no print function): say it, and share the codes as text instead
  const noPrint = () => document.documentElement.classList.contains('ios-app') || (/iP(hone|ad|od)/.test(navigator.userAgent || '') && navigator.standalone === true);
  function print(html, cls) {
    if (noPrint() && !window.__printTest) {
      const area = document.createElement('div'); area.innerHTML = html;
      const lines = [...area.querySelectorAll('.pc, .pl-row, tr')].map(e => e.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean);
      const txt = (S().club.name || '') + ' · codes personnels\n' + lines.join('\n');
      return modal({ title: '🖨️ Imprimer depuis un ordinateur', body: `<p>L'appli installée sur iPhone ne peut pas imprimer : iOS ne le permet pas aux applis de ce type.</p>
        <p>Pour les cartes avec QR code, ouvre l'appli sur un <b>ordinateur</b> (Réglages → Codes personnels → Imprimer les cartes).</p>
        <p class="muted small">En dépannage, tu peux partager la liste des codes en texte (WhatsApp, Notes, mail) : sans QR code, les familles ouvrent <b>${esc(base().replace(/^https?:\/\//, ''))}moi.html</b> et tapent leur code.</p>`,
        actions: [{ label: 'Fermer' }, { label: '📤 Partager la liste', kind: 'primary', onClick: () => { if (navigator.share) navigator.share({ title: 'Codes personnels', text: txt }).catch(() => {}); else navigator.clipboard.writeText(txt).then(() => toast('Liste copiée')).catch(() => toast(txt)); } }] });
    }
    const old = document.getElementById('printArea'); if (old) old.remove();
    const area = document.createElement('div'); area.id = 'printArea'; area.className = cls || ''; area.innerHTML = html;
    document.body.appendChild(area);
    const done = () => { area.remove(); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    Promise.all([...area.querySelectorAll('img')].map(im => im.decode ? im.decode().catch(() => {}) : null)).then(() => setTimeout(() => window.print(), 150));
  }
  function printPoster(title, url, kind) {
    print(`<div class="qr-poster"><img src="${esc(Supporters.crest())}" alt=""><h1>${esc(title)}</h1>
      <p class="qp-sub">${kind === 'app' ? 'Scanne pour ouvrir l\'appli des coachs' : 'Joueurs et parents : scanne, puis tape ton code personnel'}</p>
      <div class="qp-qr">${svg(url, 10)}</div><p class="qp-url">${esc(url)}</p>
      ${kind === 'app' ? '' : '<p class="qp-note">Ton code personnel t\'est remis par le coach. Il n\'ouvre que tes informations : ne le donne à personne.</p>'}</div>`, 'pa-poster');
  }
  async function printCards(t, rows, map) {
    try { await loadQr(); } catch (e) { return toast(e.message, 'err'); }
    const club = S().club.name, url = catUrl(t.name), q = svg(url, 3), host = base().replace(/^https?:\/\//, '') + 'moi.html';
    const card = p => `<div class="pc"><div class="pc-top"><img src="${esc(Supporters.crest())}" alt=""><span>${esc(club)}<br><b>Espace joueur · parents</b></span></div>
      <div class="pc-name">${esc(full(p))}</div><div class="pc-team">${esc(t.name)}</div>
      <div class="pc-mid"><div class="pc-qr">${q}</div><div><div class="pc-lbl">Code personnel</div><div class="pc-code">${esc(pretty((map[p.id] || {}).code || ''))}</div>
      <div class="pc-how">1. Scanne le QR code (ou ouvre ${esc(host)})<br>2. Tape ton code</div></div></div>
      <div class="pc-note">Ce code n'ouvre que tes informations. Ne le donne à personne.</div></div>`;
    const pages = []; for (let i = 0; i < rows.length; i += 8) pages.push(rows.slice(i, i + 8));
    print(pages.map(pg => `<div class="pc-sheet">${pg.map(card).join('')}</div>`).join(''), 'pa-cards');
  }
  function printList(t, rows, map) {
    const club = S().club.name;
    print(`<div class="pl-sheet"><h1>${esc(club)} · ${esc(t.name)}</h1><p>Codes personnels · à remettre à chaque joueur ou à ses parents · ${esc(new Date().toLocaleDateString('fr-FR'))}</p>
      <p class="pl-how">Page à ouvrir : <b>${esc(base())}moi.html</b> (ou le QR code de la catégorie), puis taper le code.</p>
      <table><thead><tr><th>Nom</th><th>Né(e)</th><th>Code</th><th>Remis le / signature</th></tr></thead>
      <tbody>${rows.map(p => `<tr><td>${esc(full(p))}</td><td>${esc((p.birth || '').slice(0, 4))}</td><td class="pl-code">${esc(pretty((map[p.id] || {}).code || ''))}</td><td></td></tr>`).join('')}</tbody></table>
      <p class="pl-note">Document confidentiel : chaque code ouvre les informations d'un licencié.</p></div>`, 'pa-list');
  }
  const qrSvg = async (text, cell = 5) => { await loadQr(); return svg(text, cell); }; // (2.63)
  return { page, qrDialog, catUrl, qrSvg, base };
})();
