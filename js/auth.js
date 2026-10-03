/* Auth: each dirigeant has an account on the club server (nom + prénom + mot de passe) and logs in on any device.
   The password never leaves the device: only a slow hash of it is sent, and the server hashes it again with its own salt.
   A copy of the hash also stays on the device so a dirigeant who already logged in there can open the app without internet.
   Without a club server (another club, no setup yet) accounts stay on the device, as in the first versions. */
const Auth = (() => {
  const { esc, $, toast, modal, confirmBox } = UI;
  const KEY = 'ea-session', TMP = 'ea-session-tmp', NAMES = 'ea-last-names', ITER = 150000, MIN = 6;
  const enc = new TextEncoder();
  const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const hex = buf => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
  const newSalt = () => b64(crypto.getRandomValues(new Uint8Array(16)));
  async function derive(pw, salt, iter = ITER) {
    const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
    return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(salt), iterations: iter }, key, 256));
  }
  // What is sent to the server instead of the password
  async function proof(lastKey, pw) {
    const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
    return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('raincy-coach|' + lastKey), iterations: 100000 }, key, 256));
  }
  // Names compared without accents or capitals; « Enzo (Adnane) » answers to Enzo and to Adnane
  const nkey = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9()' -]/g, ' ').replace(/\s+/g, ' ').trim();
  const noPar = s => s.replace(/\([^)]*\)?/g, ' ').replace(/\s+/g, ' ').trim();
  function firstKeys(firstName) {
    const f = nkey(firstName), out = new Set(), main = noPar(f);
    if (main) { out.add(main); out.add(main.split(' ')[0]); }
    (f.match(/\(([^)]*)\)/g) || []).forEach(m => { const w = m.slice(1, -1).trim(); if (w) { out.add(w); out.add(w.split(' ')[0]); } });
    return [...out];
  }
  const lastKeyOf = s => nkey(s.lastName || s.firstName);

  const A = () => (Store.state.auth = Store.state.auth || { users: {} });
  const U = id => A().users[id];
  const sess = () => A().session || null;
  let user = null, resolveGate = null, fails = 0, lockedUntil = 0;

  const current = () => user;
  const realAdmin = () => { if (!user) return false; const s = sess(); if (s && s.staff_id === user.id) return !!s.admin; return !!(U(user.id) && U(user.id).admin); };
  // « Voir comme un coach »: a responsable sees the app exactly as a coach of the chosen categories (this device and tab only)
  const PREVIEW = 'ea-preview';
  const preview = () => { if (!realAdmin()) return null; try { const v = JSON.parse(localStorage.getItem(PREVIEW)); return v && Array.isArray(v.teamIds) ? v : null; } catch (e) { return null; } };
  const isAdmin = () => realAdmin() && !preview();
  // a responsable looking at the app as a volunteer: only the volunteers' tasks and the club's events
  const volView = () => { const p = preview(); return !!p && p.role === 'benevole'; };
  // A category and its teams A / B go together: a coach of « U15 » also sees « U15 A » and « U15 B », and the other way round
  const famKey = t => String(t.category || t.name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, '');
  const myIds = () => {
    const pv = preview(), raw = pv ? pv.teamIds : (user && user.teamIds) || [];
    const keys = new Set(raw.map(id => Store.get('teams', id)).filter(Boolean).map(famKey));
    return [...new Set([...raw, ...Store.state.teams.filter(t => keys.has(famKey(t))).map(t => t.id)])];
  };
  // What a dirigeant may see: a responsable sees every category, a coach only the ones chosen at his first connection
  // (the pitch planning and the club results stay common to everybody)
  // (3.70) a coach without any category sees no team (before, he saw the whole club): the responsable gives him his categories
  const allTeams = () => !user || isAdmin();
  const teams = () => allTeams() ? Store.state.teams : Store.state.teams.filter(t => myIds().includes(t.id));
  const sees = teamId => allTeams() || !teamId || myIds().includes(teamId);
  const seesPerson = p => allTeams() || (p.teamIds || []).some(id => myIds().includes(id)) || (user && p.id === user.id);
  function startPreview(teamIds, role, extra = {}) { try { localStorage.setItem(PREVIEW, JSON.stringify(Object.assign({ teamIds, role: role || 'coach' }, extra))); } catch (e) {} Store.state.ui.teamId = ''; App.refreshChrome(); location.hash = role === 'arbitre' ? '#/arbitres' : '#/'; App.route(); toast('Tu es maintenant : ' + (extra.label || role)); }
  function stopPreview() { try { localStorage.removeItem(PREVIEW); sessionStorage.removeItem(PREVIEW); } catch (e) {} App.refreshChrome(); App.route(); toast('Retour en responsable'); }
  // « Voir l'appli comme… » : un coach (ses catégories), un parent ou un joueur (leur vraie page), un bénévole (l'appli réduite)
  const ROLES = [['coach', '🧢 Un coach', 'L\'appli exactement comme lui : ses catégories seulement, sans les réglages du responsable.'],
    ['parent', '👨‍👩‍👧 Un parent', 'La vraie page d\'un parent (avec le code d\'un enfant de la catégorie) : ses matchs, sa convocation, covoiturage, bénévoles, photos. Rien sur les autres enfants.'],
    ['joueur', '⚽ Un joueur', 'La vraie page d\'un joueur de la catégorie (avec son code) : sa convocation, la causerie du match, son temps de jeu. Rien sur les autres joueurs.'],
    ['benevole', '🙋 Un bénévole', 'L\'appli réduite à ce qu\'utilise un bénévole : les tâches des jours de match (il s\'y inscrit) et les événements du club. Ni joueurs, ni messages, ni résultats.']];
  function previewDialog() {
    let role = 'coach';
    const body = () => `<div class="chips pv-roles">${ROLES.map(([k, l]) => `<button class="chip ${k === role ? 'on' : ''}" data-role="${k}">${l}</button>`).join('')}</div>
      <p>${ROLES.find(x => x[0] === role)[2]}</p>
      ${role === 'benevole' ? '' : `<div class="lbl">${role === 'coach' ? 'Ses catégories' : 'La catégorie'}</div>${teamChips([])}`}
      <p class="muted small">Rien n'est changé pour les autres : c'est seulement un aperçu sur cet appareil.${role === 'parent' || role === 'joueur' ? ' Les réponses faites dans l\'aperçu comptent vraiment : regarde sans répondre.' : ' Le bandeau en haut de l\'écran te ramène en responsable.'}</p>`;
    const el = modal({ title: 'Voir l\'appli comme…', noFocus: true, body: `<div id="pvBody">${body()}</div>`,
      onOpen: r => { r.querySelector('#pvBody').onclick = e => {
        const rb = e.target.closest('[data-role]'); if (rb) { role = rb.dataset.role; r.querySelector('#pvBody').innerHTML = body(); return; }
        const c = e.target.closest('#myTeams .chip'); if (!c) return;
        if (role !== 'coach') r.querySelectorAll('#myTeams .chip').forEach(x => x !== c && x.classList.remove('on'));
        c.classList.toggle('on'); }; },
      actions: [{ label: 'Annuler' }, { label: 'Voir', kind: 'primary', icon: I.check, onClick: (c, r) => {
        const ids = [...r.querySelectorAll('#myTeams .chip.on')].map(b => b.dataset.t);
        if (role === 'benevole') { startPreview([], 'benevole'); return; }
        if (!ids.length) { toast('Choisis une catégorie', 'err'); return false; }
        if (role === 'coach') return startPreview(ids);
        setTimeout(() => viewPage(role, ids[0]), 60);
      } }] });
    return el;
  }
  // the parents' or players' page, inside the app (full screen), with a bar to come back
  async function viewPage(role, teamId, playerId) {
    if (!Cloud.ready()) return toast('Il faut être connecté au serveur du club', 'err');
    let url; const b = UI.busy('Ouverture de la page…');
    const t = Store.get('teams', teamId), ids = Store.teamGroups([t]).flat().map(x => x.id);
    const pl = (playerId && Store.get('players', playerId)) || Store.state.players.filter(p => (p.teamIds || []).some(id => id === teamId || ids.includes(id))).sort((a, c) => String(a.lastName || '').localeCompare(String(c.lastName || ''), 'fr'))[0];
    if (!pl) { b.done(); return toast('Aucun joueur dans cette catégorie', 'err'); }
    try { const map = await Cloud.memberCodes([pl.id]) || {}, c = (map[pl.id] || {}).code; if (!c) throw new Error('Code indisponible');
      url = `${location.href.split('#')[0].replace(/index\.html$/, '')}${role === 'parent' ? 'parents' : 'joueurs'}.html#c=${c}&preview=1`; }
    catch (e) { return toast(e.message || 'Page indisponible', 'err'); } finally { b.done(); }
    const ov = document.createElement('div'); ov.className = 'pv-frame';
    ov.innerHTML = `<div class="pv-bar"><b>${role === 'parent' ? '👨‍👩‍👧 Vue parent' : '⚽ Vue joueur'} · ${esc(Store.shortName(pl))} (${esc((t || {}).name || '')})</b><span class="chips"><button class="btn" data-pvr>🔀<span>Changer de rôle</span></button><button class="btn" data-pvx>${I.x}<span>Fermer</span></button></span></div><iframe src="${esc(url)}" title="Aperçu"></iframe>`;
    document.body.appendChild(ov); ov.querySelector('[data-pvx]').onclick = () => ov.remove(); ov.querySelector('[data-pvr]').onclick = () => { ov.remove(); Roles.open(); };
  }
  const hasAccounts = () => Object.values(A().users).some(u => u.hash);
  async function setPassword(id, pw, extra = {}) {
    const salt = newSalt(), hash = await derive(pw, salt);
    A().users[id] = Object.assign(U(id) || {}, { salt, hash, iter: ITER, setAt: Date.now() }, extra);
    Store.save();
  }
  async function check(id, pw) { const u = U(id); return !!(u && u.hash && (await derive(pw, u.salt, u.iter)) === u.hash); }
  async function newRecovery() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = crypto.getRandomValues(new Uint8Array(10));
    const code = Array.from(r, x => alphabet[x % alphabet.length]).join('').replace(/(.{5})/, '$1-');
    const salt = newSalt(); A().recovery = { salt, hash: await derive(code, salt) }; Store.save();
    return code;
  }
  function askPassword(text, okLabel = 'Confirmer') {
    return new Promise(res => {
      let done = false; const end = v => { if (!done) { done = true; res(v); } };
      modal({ title: '🔒 Ton mot de passe', body: `<p>${esc(text)}</p><label class="fld"><span>Mot de passe de ${esc(user ? Store.fullName(user) : '')}</span><input id="askPw" type="password" autocomplete="current-password"></label>`,
        onOpen: (r, close) => { const i = $('#askPw', r); setTimeout(() => i.focus(), 60); i.onkeydown = e => { if (e.key === 'Enter') r.querySelector('.sheet-foot .danger').click(); }; },
        actions: [{ label: 'Annuler', onClick: () => end(false) }, { label: okLabel, kind: 'danger', onClick: (close, r) => {
          const pw = $('#askPw', r).value; if (!pw) { toast('Écris ton mot de passe', 'err'); return false; }
          check(user && user.id, pw).then(ok => { if (ok) { close(); end(true); } else { toast('Mot de passe incorrect', 'err'); $('#askPw', r).select(); } });
          return false; } }] });
      const root = document.getElementById('modal'), watch = setInterval(() => { if (root.hidden) { clearInterval(watch); end(false); } }, 300);
    });
  }
  async function checkRecovery(code) {
    const r = A().recovery; if (!r) return false;
    return (await derive(code.trim().toUpperCase(), r.salt)) === r.hash;
  }
  const ss = { get: k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} }, del: k => { try { sessionStorage.removeItem(k); } catch (e) {} } };
  function remember(id, keep) { ss.set(KEY, id); try { if (keep) localStorage.setItem(KEY, id); else localStorage.removeItem(KEY); } catch (e) {} }
  function restore() {
    const s = sess();
    if (s && s.token) {
      if (s.temp && !ss.get(TMP)) return false;
      const st = Store.get('staff', s.staff_id);
      if (st && !needsTeams(st.id)) { user = st; return true; }
      return false;
    }
    let id = ss.get(KEY); if (!id) try { id = localStorage.getItem(KEY); } catch (e) {}
    const st = id && Store.get('staff', id);
    if (st && U(id) && U(id).hash && !needsTeams(id)) { user = st; return true; }
    return false;
  }
  function logout(msg) {
    const s = sess();
    if (s) { Cloud.logout(s.token).catch(() => {}); delete A().session; Store.save(); }
    ss.del(KEY); ss.del(TMP); try { localStorage.removeItem(KEY); } catch (e) {}
    user = null; App.refreshChrome(); if (msg) toast(msg, 'err');
    gate().then(() => App.route());
  }
  // The server refused our login (password reset by a responsable, session expired…)
  let checking = false;
  async function expired() {
    if (checking || !sess() || !user) return; checking = true;
    try { const r = await Cloud.me(); if (r && r.error) logout('Ta connexion a expiré : reconnecte-toi.'); } catch (e) {} finally { checking = false; }
  }
  // Admin rights or locked categories may have changed on the server
  async function refreshMe() {
    if (!sess()) return;
    try {
      const r = await Cloud.me(); if (!r) return;
      if (r.error) return logout('Ta connexion a expiré : reconnecte-toi.');
      const s = sess(), before = s.admin;
      s.admin = !!r.admin; s.teams_set = !!r.teams_set; if (r.last_key) s.last_key = r.last_key;
      if (U(s.staff_id)) Object.assign(U(s.staff_id), { admin: s.admin, teamsSet: s.teams_set });
      Store.save(); if (before !== s.admin) { App.refreshChrome(); App.route(); }
    } catch (e) {}
  }

  /* ---------- lock screen ---------- */
  const lock = () => document.getElementById('lock');
  function frame(inner) {
    const el = lock(); el.hidden = false;
    el.innerHTML = `<div class="lock-card">${Supporters.coin('lock-crest')}<p class="eyebrow">Clubbo</p><h1>${esc(Store.state.club.name || 'Espace éducateurs')}</h1>${inner}
      <button class="btn wide link how-btn" id="howTo">${I.help}<span>Comment utiliser l'appli ?</span></button>
      <p class="lock-version">Clubbo · créée par <b>Coach Enzo</b> · version ${Help.VERSION} · <button class="linkish" id="updApp">Mettre à jour l'appli</button> · <a href="confidentialite.html">Confidentialité</a></p></div>`;
    el.querySelector('#howTo').onclick = () => Help.tour();
    el.querySelector('#updApp').onclick = () => App.checkUpdate(true);
    el.scrollTop = 0;
    return el;
  }
  const pwFields = (label = 'Mot de passe') => `
    <label class="fld"><span>${label} (au moins ${MIN} caractères)</span><input id="pw1" type="password" autocomplete="new-password" minlength="${MIN}"></label>
    <label class="fld"><span>Retape le mot de passe</span><input id="pw2" type="password" autocomplete="new-password"></label>`;
  const keepBox = `<label class="switch"><input type="checkbox" id="keep" checked><span>Rester connecté sur cet appareil</span></label>`;
  const nameFields = (ln = '', fn = '') => `<div class="row2"><label class="fld"><span>Nom</span><input id="ln" value="${esc(ln)}" autocapitalize="characters" autocomplete="family-name" autocorrect="off"></label>
      <label class="fld"><span>Prénom</span><input id="fn" value="${esc(fn)}" autocomplete="given-name" autocorrect="off"></label></div>`;
  function readNewPw(el) {
    const a = $('#pw1', el).value, b = $('#pw2', el).value;
    if (a.length < MIN) { toast(`Le mot de passe doit faire au moins ${MIN} caractères`, 'err'); return null; }
    if (a !== b) { toast('Les deux mots de passe ne sont pas pareils', 'err'); return null; }
    return a;
  }
  async function withBusy(label, fn) { const b = UI.busy(label); try { return await fn(); } finally { b.done(); } }
  const lastNames = () => { try { return JSON.parse(localStorage.getItem(NAMES)) || {}; } catch (e) { return {}; } };
  const saveNames = (ln, fn) => { try { localStorage.setItem(NAMES, JSON.stringify({ ln, fn })); } catch (e) {} };

  // A coach links his account to his categories once; afterwards only a responsable can change them
  function needsTeams(id) {
    if (!Store.state.teams.length) return false;
    const s = sess();
    if (s && s.staff_id === id) return !s.admin && !s.teams_set;
    const u = U(id) || {}; return !u.admin && !u.teamsSet;
  }
  // one group per category: « U14 », then its teams « U14 A », « U14 B »
  const teamChips = ids => `<div class="chips team-pick" id="myTeams">${Store.teamGroups(Store.state.teams).map(g => `<span class="team-fam">${g.map(t => `<button type="button" class="chip ${Store.isSub(t) ? 'sub' : ''} ${(ids || []).includes(t.id) ? 'on' : ''}" data-t="${t.id}">${esc(t.name)}</button>`).join('')}</span>`).join('')}</div>
    <p class="muted small">Choisir « U14 » donne aussi accès à U14 A et U14 B.</p>`;
  function teamsScreen(id, keep) {
    const s = Store.get('staff', id);
    const el = frame(`<p class="lead">${esc(s.firstName || Store.fullName(s))}, choisis ta ou tes catégories. <b>Attention : après validation, seul un responsable pourra les changer.</b></p>
      ${teamChips(s.teamIds)}
      <button class="btn primary wide" id="go" style="margin-top:14px">Valider mes catégories</button>`);
    el.querySelectorAll('#myTeams .chip').forEach(b => b.onclick = () => b.classList.toggle('on'));
    $('#go', el).onclick = () => {
      const ids = [...el.querySelectorAll('#myTeams .chip.on')].map(b => b.dataset.t);
      if (!ids.length) return toast('Choisis au moins une catégorie', 'err');
      s.teamIds = ids; Store.upsert('staff', s);
      A().users[id] = Object.assign(U(id) || {}, { teamsSet: true, teamsSetAt: Date.now() });
      const se = sess(); if (se && se.staff_id === id) { se.teams_set = true; Cloud.teamsDone().catch(() => {}); }
      Store.save();
      done(id, keep);
    };
  }
  function done(id, keep) {
    if (needsTeams(id)) return teamsScreen(id, keep);
    user = Store.get('staff', id); remember(id, keep); fails = 0;
    const mine = (user.teamIds || []).filter(t => Store.get('teams', t));
    if (mine.length && !mine.includes(Store.state.ui.teamId)) { Store.state.ui.teamId = mine[0]; Store.save(); }
    lock().hidden = true; lock().innerHTML = '';
    App.refreshChrome(); toast(`Bonjour ${user.firstName || user.lastName} !`);
    if (resolveGate) { const r = resolveGate; resolveGate = null; r(); }
  }

  /* ---------- club server accounts ---------- */
  const regPayload = (s, h, admin) => ({ staff_id: s.id, last_key: lastKeyOf(s), first_keys: firstKeys(s.firstName), display: Store.fullName(s), h, admin: !!admin });
  function findStaff(ln, fn) {
    const L = nkey(ln), F = noPar(nkey(fn));
    const match = (a, b) => Store.state.staff.filter(s => lastKeyOf(s) === a && firstKeys(s.firstName).some(k => k === b || k === b.split(' ')[0]));
    const byPw = list => list.find(s => U(s.id) && U(s.id).hash) || list[0];
    return byPw(match(L, F)) || byPw(match(F, L)) || null;
  }
  // the club of this device (its code, remembered for the next connection)
  const CLUB = 'ea-club-code';
  const lastClub = () => { try { return localStorage.getItem(CLUB) || ''; } catch (e) { return ''; } };
  const saveClub = c => { try { localStorage.setItem(CLUB, c); } catch (e) {} };
  async function serverLogin(club, ln, fn, pw) {
    let last = null;
    for (const [a, b] of [[ln, fn], [fn, ln]]) { // also works if nom and prénom were swapped
      const lk = nkey(a), f = noPar(nkey(b)); if (!lk || !f) continue;
      last = await Cloud.login(club, lk, f, await proof(lk, pw));
      if (!last || last.error !== 'COMPTE_INCONNU') return last;
    }
    return last || { error: 'COMPTE_INCONNU' };
  }
  async function afterServerLogin(r, pw, keep, ln, fn) {
    A().session = { token: r.token, staff_id: r.staff_id, admin: !!r.admin, teams_set: !!r.teams_set, last_key: r.last_key, club: r.club || null, temp: !keep, at: Date.now() };
    if (r.club) { Store.state.club.cloud = { slug: r.club.slug }; if (!Store.state.club.name || Store.state.club.name === 'Mon club') Store.state.club.name = r.club.name; saveClub(r.club.slug); }
    if (!keep) ss.set(TMP, '1');
    Store.save();
    if (!Store.get('staff', r.staff_id)) await withBusy('Chargement des données du club…', () => Sync.run());
    let s = Store.get('staff', r.staff_id);
    if (!s) s = Store.upsert('staff', { id: r.staff_id, lastName: String(ln || '').toUpperCase(), firstName: fn || '', role: r.admin ? 'Responsable du club' : 'Dirigeant', phone: '', email: '', notes: '', teamIds: [] });
    await setPassword(s.id, pw, { admin: !!r.admin, teamsSet: !!r.teams_set });
    saveNames(s.lastName, s.firstName);
    done(s.id, keep);
  }
  const errText = code => ({ MOT_DE_PASSE: 'Mot de passe incorrect', BLOQUE: 'Trop d\'essais : attends 5 minutes avant de réessayer', COMPTE_INCONNU: 'Aucun compte à ce nom dans ce club',
    CLUB_INCONNU: 'Aucun club avec ce code', CLUB_SUSPENDU: 'L\'accès de ce club est suspendu : contacte Clubbo' }[code] || 'Connexion impossible');
  const clubField = (v = '') => `<label class="fld"><span>Code du club</span><input id="club" value="${esc(v)}" placeholder="ex : fc-exemple" autocapitalize="off" autocorrect="off" autocomplete="organization"></label>`;

  function loginScreen() {
    const n = lastNames();
    const el = frame(`<p class="lead">Connecte-toi avec le code de ton club, ton nom, ton prénom et ton mot de passe.</p>
      ${clubField(lastClub())}${nameFields(n.ln, n.fn)}
      <label class="fld"><span>Mot de passe</span><input id="pw" type="password" autocomplete="current-password"></label>${keepBox}
      <button class="btn primary wide" id="go">Se connecter</button>
      <div class="lock-links"><button class="btn wide" id="first">${I.plus}<span>Première connexion (lien d'invitation)</span></button>
      <button class="btn wide" id="create">${I.whistle}<span>Créer mon club</span></button>
      ${!Store.state.staff.length ? '<button class="btn wide" id="demo">👀<span>Essayer avec un club de démonstration</span></button>' : ''}
      <a class="btn wide link" href="decouvrir.html">Découvrir Clubbo</a>
      <button class="btn wide link" id="forgot">Mot de passe oublié ?</button></div>`);
    const go = async () => {
      const club = $('#club', el).value.trim(), ln = $('#ln', el).value.trim(), fn = $('#fn', el).value.trim(), pw = $('#pw', el).value, keep = $('#keep', el).checked;
      if (!club) return toast('Écris le code de ton club', 'err');
      if (!ln || !fn) return toast('Écris ton nom et ton prénom', 'err');
      if (!pw) return toast('Écris ton mot de passe', 'err');
      if (Date.now() < lockedUntil) return toast(`Trop d'essais : attends ${Math.ceil((lockedUntil - Date.now()) / 1000)} secondes`, 'err');
      const b = UI.busy('Connexion…');
      let r;
      try { r = await serverLogin(club, ln, fn, pw); }
      catch (e) {
        b.done();
        // No internet: an account already used on this device still opens
        const loc = findStaff(ln, fn);
        if (loc && U(loc.id) && U(loc.id).hash) { if (await check(loc.id, pw)) return done(loc.id, keep); return failed(); }
        return toast(e.offline ? 'Pas de connexion internet : la première connexion sur un appareil a besoin d\'internet.' : e.message, 'err');
      }
      b.done();
      if (r && r.token) return withBusy('Connexion…', () => afterServerLogin(r, pw, keep, ln, fn));
      if (r && r.error === 'COMPTE_INCONNU') return toast('Aucun compte à ce nom dans ce club. Si c\'est ta première connexion, ouvre le lien d\'invitation envoyé par ton responsable.', 'err');
      if (r && r.error === 'MOT_DE_PASSE') return failed();
      toast(errText(r && r.error), 'err');
    };
    const failed = () => { fails++; if (fails >= 5) { lockedUntil = Date.now() + 30000; fails = 0; } toast('Mot de passe incorrect', 'err'); const p = $('#pw', el); if (p) p.select(); };
    $('#go', el).onclick = go; $('#pw', el).onkeydown = e => { if (e.key === 'Enter') go(); };
    $('#first', el).onclick = () => firstScreen();
    $('#create', el).onclick = () => createClubScreen();
    $('#forgot', el).onclick = () => forgotServer();
    const dm = $('#demo', el); if (dm) dm.onclick = () => Demo.start();
    setTimeout(() => { const f = !lastClub() ? $('#club', el) : n.ln ? $('#pw', el) : $('#ln', el); if (f) f.focus(); }, 60);
  }

  // Invitation code from the link sent by the responsable
  function setInvite(code, who) {
    try { if (who) sessionStorage.setItem('join-who', who); } catch (e) {}
    const c = Store.state.club;
    c.cloud = Object.assign({}, c.cloud || {}, { clubKey: code });
    Store.save();
  }
  const hasAccess = () => { const c = Cloud.cfg(); return !!(c && (c.clubKey || Cloud.token())); };
  function firstScreen() {
    if (hasAccess()) return pickScreen();
    const el = frame(`<p class="lead"><b>Première connexion</b></p>
      <p>Ouvre le <b>lien d'invitation</b> envoyé par le responsable de ton club (WhatsApp, SMS, e-mail) : tu pourras choisir ton nom et créer ton mot de passe.</p>
      <label class="fld"><span>Ou colle le lien d'invitation ici</span><input id="inv" placeholder="https://…#rejoindre=…" autocapitalize="off" autocorrect="off"></label>
      <button class="btn primary wide" id="useInv">Continuer</button>
      <div class="lock-links"><button class="btn wide" id="create">${I.whistle}<span>Je suis responsable : créer mon club</span></button>
      <button class="btn wide link" id="back">Retour</button></div>`);
    $('#useInv', el).onclick = () => {
      const v = $('#inv', el).value.trim(), m = v.match(/rejoindre=([A-Za-z0-9]+)/) || v.match(/^([A-Za-z0-9]{8,})$/);
      if (!m) return toast('Colle le lien reçu du responsable', 'err');
      setInvite(m[1]); pickScreen();
    };
    $('#create', el).onclick = () => createClubScreen();
    $('#back', el).onclick = () => loginScreen();
  }
  async function pickScreen() {
    frame('<p class="lead">Chargement de la liste des dirigeants…</p>');
    let accounts = [];
    try { accounts = await Cloud.accounts() || []; await Sync.run(); }
    catch (e) {
      if (e.code === 'CLE_CLUB') { const c = Store.state.club.cloud; if (c) delete c.clubKey; Store.save(); toast('Ce lien d\'invitation n\'est plus valable : demande le nouveau lien au responsable.', 'err'); return firstScreen(); }
      toast(e.message, 'err'); if (!Store.state.staff.length) return loginScreen();
    }
    const reg = new Set(accounts.filter(a => a.has_pw).map(a => a.staff_id));
    const staff = Store.state.staff.filter(x => !x.blocked).sort(Store.byName); // a dirigeant whose access was removed is not proposed
    const el = frame(`<p class="lead"><b>Première connexion</b> : choisis ton nom, puis crée ton mot de passe.</p>
      ${staff.length ? `<label class="fld"><span>Qui es-tu ?</span><select id="who"><option value="">Choisis ton nom…</option>
      ${staff.map(s => `<option value="${s.id}" ${reg.has(s.id) ? 'disabled' : ''}>${esc(Store.fullName(s))}${reg.has(s.id) ? ' · déjà inscrit' : [s.role, (s.teamIds || []).map(id => (Store.get('teams', id) || {}).name).filter(Boolean).join(', ')].filter(Boolean).map(esc).map(x => ' · ' + x).join('')}</option>`).join('')}</select></label>
      <div id="step"></div>` : '<p class="tip">La liste des dirigeants du club est vide : le responsable doit d\'abord les ajouter (Équipes → Dirigeants).</p>'}
      <button class="btn wide" id="notListed" type="button">＋ Je ne suis pas dans la liste</button>
      <p class="muted small">Déjà inscrit ? Reviens à la connexion.</p>
      <button class="btn wide link" id="back">Retour à la connexion</button>`);
    $('#back', el).onclick = () => loginScreen();
    $('#notListed', el).onclick = () => selfScreen(staff);
    const who = $('#who', el); if (!who) return;
    who.onchange = () => {
      const s = Store.get('staff', who.value), step = $('#step', el);
      if (!s) { step.innerHTML = ''; return; }
      step.innerHTML = `<p class="tip">Choisis ton mot de passe et garde-le pour toi. Ensuite tu te connecteras avec <b>${esc(Store.fullName(s))}</b> et ce mot de passe.</p>${pwFields('Nouveau mot de passe')}${keepBox}
        <button class="btn primary wide" id="go">Créer mon mot de passe</button>`;
      $('#go', el).onclick = async () => {
        const pw = readNewPw(el); if (!pw) return; const keep = $('#keep', el).checked;
        try {
          const r = await withBusy('Création de ton compte…', async () => Cloud.register(regPayload(s, await proof(lastKeyOf(s), pw), false)));
          await withBusy('Connexion…', () => afterServerLogin(r, pw, keep, s.lastName, s.firstName));
        } catch (e) { toast(e.message, 'err'); }
      };
    };
    preselect(el);
  }
  // A new club: the activation code given by Clubbo, the name of the club, its code, and its first responsable
  const slugOf = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
  function createClubScreen() {
    const n = lastNames();
    const el = frame(`<p class="lead"><b>Créer mon club</b> sur Clubbo</p>
      <label class="fld"><span>Code d'activation (remis par Clubbo)</span><input id="act" placeholder="EA-XXXX-XXXX" autocapitalize="characters" autocorrect="off" autocomplete="off"></label>
      <label class="fld"><span>Nom du club</span><input id="cname" placeholder="ex : FC Exemple" autocomplete="organization"></label>
      <label class="fld"><span>Code du club (pour se connecter, sans espace)</span><input id="cslug" placeholder="fc-exemple" autocapitalize="off" autocorrect="off"></label>
      <p class="muted small">Toi, le premier responsable du club :</p>
      ${nameFields(n.ln, n.fn)}${pwFields('Ton mot de passe')}${keepBox}
      <button class="btn primary wide" id="go">Créer le club</button>
      <div class="lock-links"><button class="btn wide link" id="back">Retour</button></div>
      <p class="muted small">Pas de code d'activation ? <a href="decouvrir.html#code">Demande-le ici</a>.</p>`);
    let slugTouched = false;
    $('#cname', el).oninput = () => { if (!slugTouched) $('#cslug', el).value = slugOf($('#cname', el).value); };
    $('#cslug', el).oninput = () => { slugTouched = true; };
    $('#back', el).onclick = () => loginScreen();
    $('#go', el).onclick = async () => {
      const code = $('#act', el).value.trim(), name = $('#cname', el).value.trim(), slug = slugOf($('#cslug', el).value || name);
      const ln = $('#ln', el).value.trim(), fn = $('#fn', el).value.trim();
      if (!code) return toast('Écris le code d\'activation', 'err');
      if (name.length < 2) return toast('Écris le nom du club', 'err');
      if (slug.length < 3) return toast('Le code du club doit faire au moins 3 lettres', 'err');
      if (!ln || !fn) return toast('Écris ton nom et ton prénom', 'err');
      const pw = readNewPw(el); if (!pw) return; const keep = $('#keep', el).checked;
      const s = { id: Store.uid(), lastName: ln.toUpperCase(), firstName: fn, role: 'Responsable du club', phone: '', email: '', notes: '', teamIds: [] };
      try {
        const r = await withBusy('Création du club…', async () => Cloud.createClub(code, name, slug, regPayload(s, await proof(lastKeyOf(s), pw), true)));
        // a brand-new app on this device: the club starts empty
        Store.reset(); Store.state.club.name = name;
        Store.upsert('staff', s); Store.save();
        await withBusy('Ouverture du club…', () => afterServerLogin(r, pw, keep, s.lastName, s.firstName));
        setTimeout(() => { if (typeof Onboard !== 'undefined') Onboard.start(); }, 400);
      } catch (e) { toast(e.message, 'err'); }
    };
  }
  function preselect(el) {
    let id = ''; try { id = sessionStorage.getItem('join-who') || ''; } catch (e) {}
    const who = el && el.querySelector('#who'); if (!id || !who || !who.querySelector(`option[value="${id}"]:not([disabled])`)) return;
    who.value = id; who.onchange();
  }
  // A coach who is not in the list yet: his name, his role, his password (the responsables see « 🆕 » next to him in Dirigeants)
  const norm = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
  function selfScreen(staff) {
    const el = frame(`<p class="lead"><b>Première connexion</b> : tu n'es pas encore dans la liste du club ? Inscris-toi.</p>
      ${nameFields('', '')}
      <label class="fld"><span>Ton rôle</span><select id="role">${['Éducateur', 'Éducateur adjoint', 'Dirigeant', 'Accompagnateur', 'Entraîneur des gardiens', 'Bénévole'].map(r => `<option>${r}</option>`).join('')}</select></label>
      ${pwFields('Ton mot de passe')}${keepBox}
      <button class="btn primary wide" id="go">Créer mon compte</button>
      <p class="muted small">Le responsable du club voit ton inscription. Ensuite tu choisis tes catégories.</p>
      <div class="lock-links"><button class="btn wide link" id="back">Retour à la liste</button></div>`);
    $('#back', el).onclick = () => pickScreen();
    $('#go', el).onclick = async () => {
      const ln = $('#ln', el).value.trim(), fn = $('#fn', el).value.trim();
      if (!ln || !fn) return toast('Écris ton nom et ton prénom', 'err');
      const same = staff.find(x => norm(x.lastName) === norm(ln) && norm(x.firstName) === norm(fn));
      if (same) { toast('Tu es déjà dans la liste : choisis ton nom', 'err'); try { sessionStorage.setItem('join-who', same.id); } catch (e) {} return pickScreen(); }
      const pw = readNewPw(el); if (!pw) return; const keep = $('#keep', el).checked;
      const s = { id: Store.uid(), lastName: ln.toUpperCase(), firstName: fn, role: $('#role', el).value, phone: '', email: '', notes: '', teamIds: [], selfJoined: Date.now() };
      try {
        Store.upsert('staff', s);
        await withBusy('Inscription au club…', () => Sync.run());
        const r = await withBusy('Création de ton compte…', async () => Cloud.register(regPayload(s, await proof(lastKeyOf(s), pw), false)));
        try { sessionStorage.removeItem('join-who'); } catch (e) {}
        await withBusy('Connexion…', () => afterServerLogin(r, pw, keep, s.lastName, s.firstName));
      } catch (e) { toast(e.message, 'err'); }
    };
  }
  function forgotServer() {
    const el = frame(`<p class="lead"><b>Mot de passe oublié</b></p>
      <p><b>Éducateur</b> : demande au responsable de ton club de réinitialiser ton mot de passe (Réglages → Comptes des dirigeants → Réinitialiser). Ensuite, ouvre le lien d'invitation et crée un nouveau mot de passe.</p>
      <p><b>Responsable</b> : un autre responsable de ton club peut le réinitialiser. Sinon, contacte Clubbo.</p>
      <div class="lock-links"><button class="btn wide link" id="back">Retour</button></div>`);
    $('#back', el).onclick = () => loginScreen();
  }

  function gate(opts = {}) {
    return new Promise(async res => {
      if (restore()) { res(); refreshMe(); if (opts.joined) toast('Tu es déjà connecté sur cet appareil'); return; }
      // Logged in but this device doesn't have the club's data yet
      const s = sess();
      if (s && s.token && !(s.temp && !ss.get(TMP)) && !Store.get('staff', s.staff_id)) {
        await withBusy('Chargement des données du club…', () => Sync.run());
        if (restore()) { res(); return; }
      }
      resolveGate = res;
      const want = (location.hash.match(/^#(demo|creer)$/) || [])[1];
      if (want) history.replaceState(null, '', location.pathname + location.search);
      if (s && s.token && Store.get('staff', s.staff_id) && needsTeams(s.staff_id)) teamsScreen(s.staff_id, !s.temp);
      else if (opts.joined) pickScreen(); else if (want === 'creer') createClubScreen(); else loginScreen();
      if (want === 'demo' && !Store.state.staff.length) setTimeout(() => Demo.start(), 200);
      else if (!Help.tourSeen() && !opts.joined && !want) Help.tour();
    });
  }

  const localOnly = () => false;
  function connectServer() {
    if (user) saveNames(user.lastName, user.firstName);
    ss.del(KEY); ss.del(TMP); try { localStorage.removeItem(KEY); } catch (e) {}
    user = null; App.refreshChrome();
    gate().then(() => App.route());
  }

  /* ---------- settings section ---------- */
  const serverMode = () => !!(sess() && Cloud.ready());
  function settingsSection() {
    if (!user) return '';
    const me = `<section class="card"><h2>${I.whistle}Mon compte</h2>
      <p>Connecté : <b>${esc(Store.fullName(user))}</b>${user.role ? ' · ' + esc(user.role) : ''}${isAdmin() ? ' · <span class="badge">Responsable</span>' : ''}</p>
      <label class="fld"><span>Mon club de cœur (son blason s'affiche devant mon nom dans les messages)</span><select id="myClub">${Clubs.options(user.club)}</select></label>
      <label class="fld"><span>Ma petite phrase (drôle ou philosophique, à côté de mon nom)</span><input id="myMotto" value="${esc(user.motto || '')}" maxlength="${UI.MOTTO_MAX}" placeholder="Ex : Le jeu avant l'enjeu."></label>
      <button class="btn soft" data-auth="mottoIdea">🎲<span>Une idée</span></button>
      <div class="acc-phone"><label class="fld"><span>Mon téléphone (facultatif)</span><input id="myPhone" type="tel" inputmode="tel" autocomplete="tel" value="${esc(user.phone || '')}" placeholder="06 12 34 56 78"></label>
      <label class="fld"><span>Qui voit mon numéro ?</span><select id="myPhoneShow">${People.PHONE_SHOW.map(([v, l]) => `<option value="${v}" ${(user.phoneShow || 'club') === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label></div>
      <p class="muted small">Laisse vide pour ne pas donner ton numéro. Les responsables du club le voient toujours. « Les parents » : il s'affiche sur la page des parents de tes catégories, pour qu'ils puissent te joindre.</p>
      ${Cloud.ready() ? Notify.accountSection() : ''}
      <div class="my-abs"><b>Mes absences</b> ${(user.absences || []).filter(a => (a.to || a.from) >= UI.today()).map(a => `<span class="chip">${esc(UI.fmtDate(a.from, { day: 'numeric', month: 'short' }))}${a.to && a.to !== a.from ? ' → ' + esc(UI.fmtDate(a.to, { day: 'numeric', month: 'short' })) : ''}</span>`).join(' ') || '<span class="muted small">aucune prévue</span>'}
        <button class="btn soft" data-auth="absence">${I.plus}<span>Déclarer une absence</span></button> <a class="btn soft" href="#/encadrement">${I.whistle}<span>Qui encadre ?</span></a></div>
      <p class="muted small">${sess() ? 'Ton compte est sur le serveur du club : connecte-toi sur n\'importe quel appareil avec ton nom, ton prénom et ton mot de passe.' : 'Ton compte est seulement sur cet appareil.'}</p>
      <div class="chips"><button class="btn" data-auth="pw">${I.edit}<span>Changer mon mot de passe</span></button>
      <button class="btn" data-auth="logout">${I.back}<span>Se déconnecter</span></button>
      ${realAdmin() ? (preview() ? `<button class="btn primary" data-auth="stopPreview">${I.whistle}<span>Revenir en responsable</span></button>` : `<button class="btn" data-auth="preview">${I.team}<span>🔀 Mes rôles (coach, bénévole, arbitre, joueur, parent)</span></button>`) : ''}</div></section>`;
    if (!isAdmin()) return me;
    return me + `<section class="card"><h2>${I.team}Comptes des dirigeants</h2>
      <p class="muted">« Retirer l'accès » déconnecte un dirigeant de partout et l'empêche de se réinscrire. Un responsable peut aussi réinitialiser le mot de passe d'un dirigeant (il en recréera un avec « Première connexion ») et changer ses catégories. 🔒 : catégories choisies à la première connexion, verrouillées pour l'éducateur.</p>
      <div class="acc-list" id="accList">${serverMode() ? '<p class="muted">Chargement des comptes…</p>' : accRows(null)}</div>
      ${serverMode() ? `<button class="btn primary" data-cloud="invite">${I.share}<span>Inviter les éducateurs</span></button>` : `<button class="btn" data-auth="recovery">${I.rotate}<span>Nouveau code de secours</span></button>`}</section>`;
  }
  let serverAcc = null;
  function accRows(list) {
    const byId = {}; (list || []).forEach(a => byId[a.staff_id] = a);
    const rows = Store.state.staff.slice().sort(Store.byName).map(s => {
      const a = list ? byId[s.id] : null, u = U(s.id) || {};
      const has = list ? !!(a && a.has_pw) : !!u.hash, adm = list ? !!(a && a.admin) : !!u.admin, locked = list ? !!(a && a.teams_set) : !!u.teamsSet;
      const cats = (s.teamIds || []).map(t => (Store.get('teams', t) || {}).name).filter(Boolean).join(', ');
      return `<div class="acc-row"><span class="acc-name"><b>${esc(Store.fullName(s))}</b><span class="muted">${s.blocked ? '🚫 Accès retiré' : has ? 'Mot de passe créé' : 'Pas encore inscrit'}${s.selfJoined ? ' · 🆕 inscrit lui-même' : ''} · ${cats ? esc(cats) : 'aucune catégorie'}${locked ? ' 🔒' : ''}</span></span>
        <button class="btn" data-auth="cats" data-id="${s.id}">Catégories</button>
        <label class="switch small"><input type="checkbox" data-admin="${s.id}" ${adm ? 'checked' : ''} ${s.id === user.id || (list && !has) ? 'disabled' : ''}><span>Responsable</span></label>
        <button class="btn" data-reset="${s.id}" ${has && s.id !== user.id && !s.blocked ? '' : 'disabled'}>Réinitialiser</button>
        <button class="btn ${s.blocked ? 'primary' : 'danger'}" data-revoke="${s.id}" ${s.id === user.id ? 'disabled' : ''}>${s.blocked ? 'Rendre l\'accès' : 'Retirer l\'accès'}</button></div>`;
    }).join('');
    return rows || '<p class="muted">Ajoute les dirigeants dans Équipes → Dirigeants.</p>';
  }
  async function mountSettings(root) {
    const box = root.querySelector('#accList'); if (!box || !serverMode()) return;
    try { serverAcc = await Cloud.accounts() || []; box.innerHTML = accRows(serverAcc); }
    catch (e) { serverAcc = null; box.innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
  }
  const accOf = id => (serverAcc || []).find(a => a.staff_id === id) || {};
  async function onSettingsClick(b, rerender) {
    if (b.dataset.auth === 'mottoIdea') { const inp = document.getElementById('myMotto'); if (inp) { inp.value = UI.mottoIdea(inp.value); saveMotto(inp.value); } return; }
    if (b.dataset.auth === 'logout') { try { sessionStorage.removeItem(PREVIEW); localStorage.removeItem(PREVIEW); } catch (e) {} return logout(); }
    if (b.dataset.auth === 'preview') return Roles.open();
    if (b.dataset.auth === 'absence') return ClubAdmin.absenceDialog(user.id, () => { user = Store.get('staff', user.id) || user; rerender && rerender(); });
    if (b.dataset.auth === 'stopPreview') return stopPreview();
    if (b.dataset.auth === 'pw') return modal({ title: 'Changer mon mot de passe', body: `<label class="fld"><span>Mot de passe actuel</span><input id="old" type="password" autocomplete="current-password"></label>${pwFields('Nouveau mot de passe')}`,
      actions: [{ label: 'Annuler' }, { label: 'Changer', kind: 'primary', onClick: (c, r) => {
        (async () => {
          const old = $('#old', r).value, pw = readNewPw(r); if (!pw) return;
          const s = sess();
          if (s && s.staff_id === user.id) {
            const lk = s.last_key || lastKeyOf(user);
            try {
              const res = await withBusy('Changement du mot de passe…', async () => Cloud.changePw(await proof(lk, old), await proof(lk, pw)));
              if (res && res.error) return toast('Mot de passe actuel incorrect', 'err');
            } catch (e) { return toast(e.message, 'err'); }
          } else if (!(await check(user.id, old))) return toast('Mot de passe actuel incorrect', 'err');
          await setPassword(user.id, pw); c(); toast('Mot de passe changé');
        })(); return false;
      } }] });
    if (b.dataset.auth === 'recovery') {
      if (!(await confirmBox("L'ancien code de secours ne marchera plus. Continuer ?", 'Créer un nouveau code'))) return;
      const code = await newRecovery();
      return modal({ title: 'Nouveau code de secours', body: `<p>Note ce code sur papier et range-le bien.</p><p class="code">${code}</p>`, actions: [{ label: "J'ai noté le code", kind: 'primary' }] });
    }
    if (b.dataset.auth === 'cats') {
      const s = Store.get('staff', b.dataset.id), locked = serverMode() ? !!accOf(s.id).teams_set : !!(U(s.id) || {}).teamsSet;
      return modal({ title: `Catégories de ${Store.fullName(s)}`, body: `${teamChips(s.teamIds)}
        <label class="switch" style="margin-top:12px"><input type="checkbox" id="relock" ${locked ? '' : 'checked'}><span>Lui redemander ses catégories à sa prochaine connexion</span></label>`,
        onOpen: r => r.querySelectorAll('#myTeams .chip').forEach(x => x.onclick = () => x.classList.toggle('on')),
        actions: [{ label: 'Annuler' }, { label: 'Enregistrer', kind: 'primary', onClick: (c, r) => {
          s.teamIds = [...r.querySelectorAll('#myTeams .chip.on')].map(x => x.dataset.t); Store.upsert('staff', s);
          const lockIt = !$('#relock', r).checked;
          A().users[s.id] = Object.assign(U(s.id) || {}, { teamsSet: lockIt }); Store.save();
          if (serverMode() && accOf(s.id).staff_id) Cloud.accountSet({ staff_id: s.id, teams_set: lockIt }).then(rerender).catch(e => toast(e.message, 'err'));
          toast('Catégories enregistrées'); rerender();
        } }] });
    }
    if (b.dataset.revoke) {
      const s = Store.get('staff', b.dataset.revoke); if (!s) return;
      const back = !!s.blocked;
      if (!back && !(await confirmBox(`Retirer l'accès de ${Store.fullName(s)} ? Il est déconnecté tout de suite de tous ses appareils et ne peut plus s'inscrire, même avec le lien d'invitation. Sa fiche reste : tu pourras lui rendre l'accès.`, 'Retirer l\'accès'))) return;
      if (back) delete s.blocked; else s.blocked = Date.now();
      Store.upsert('staff', s);
      try {
        if (serverMode()) await Sync.run(); // the server knows it at once (it refuses a new registration)
        if (!back) { const u = U(s.id); if (u) { delete u.hash; delete u.salt; } Store.save(); if (serverMode()) await Cloud.accountSet({ staff_id: s.id, delete: true }); }
      } catch (e) { return toast(e.message, 'err'); }
      toast(back ? 'Accès rendu : envoie-lui son lien pour qu\'il recrée son mot de passe' : 'Accès retiré : il est déconnecté'); rerender(); return;
    }
    if (b.dataset.reset) {
      const s = Store.get('staff', b.dataset.reset);
      if (await confirmBox(`Réinitialiser le mot de passe de ${Store.fullName(s)} ? Il en créera un nouveau avec « Première connexion ».`, 'Réinitialiser')) {
        const u = U(s.id); if (u) { delete u.hash; delete u.salt; } Store.save();
        if (serverMode()) { try { await Cloud.accountSet({ staff_id: s.id, reset: true }); } catch (e) { return toast(e.message, 'err'); } }
        toast('Mot de passe réinitialisé'); rerender();
      }
    }
  }
  function saveMotto(v) {
    const s = Store.get('staff', user.id); if (!s) return;
    s.motto = String(v || '').replace(/\s+/g, ' ').trim().slice(0, UI.MOTTO_MAX); Store.upsert('staff', s); user = s;
    toast(s.motto ? 'Phrase enregistrée' : 'Phrase retirée');
  }
  function onSettingsChange(t) {
    if (t.id === 'myMotto') { saveMotto(t.value); return; }
    if (t.id === 'myPhone' || t.id === 'myPhoneShow') {
      const s = Store.get('staff', user.id); if (!s) return;
      if (t.id === 'myPhone') s.phone = t.value.replace(/\s+/g, ' ').trim(); else s.phoneShow = t.value;
      Store.upsert('staff', s); user = s;
      toast(!s.phone ? 'Pas de numéro affiché' : ({ resp: 'Numéro visible seulement par les responsables', club: 'Numéro visible par les éducateurs du club', parents: 'Numéro visible par les éducateurs et les parents de tes catégories' })[s.phoneShow || 'club']); return;
    }
    if (t.id === 'myClub') { const s = Store.get('staff', user.id); if (s) { s.club = t.value; Store.upsert('staff', s); user = s; toast(t.value ? 'Club de cœur : ' + Clubs.name(t.value) : 'Club de cœur retiré'); } return; }
    if (!t.dataset.admin) return;
    const id = t.dataset.admin; A().users[id] = Object.assign(U(id) || {}, { admin: t.checked }); Store.save();
    if (serverMode()) Cloud.accountSet({ staff_id: id, admin: t.checked }).then(() => toast(t.checked ? 'Droits de responsable donnés' : 'Droits de responsable retirés')).catch(e => { toast(e.message, 'err'); t.checked = !t.checked; });
  }
  function forget(staffId) {
    delete A().users[staffId]; Store.save();
    if (serverMode() && isAdmin()) Cloud.accountSet({ staff_id: staffId, delete: true }).catch(() => {});
  }

  return { PREVIEW, startPreview, viewPage, askPassword, gate, current, isAdmin, realAdmin, preview, volView, stopPreview, teams, sees, seesPerson, logout, localOnly, connectServer, expired, settingsSection, mountSettings, onSettingsClick, onSettingsChange, forget, setInvite, nkey, firstKeys };
})();
