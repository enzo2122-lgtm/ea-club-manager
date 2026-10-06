/* Cloud: the Clubbo server, shared by every club (Supabase). Each club only reaches its own data:
   every SQL function finds the club from the dirigeant's login (or the club's invitation code) — see supabase/ea-schema.sql.
   The clubs never set up anything: the server is run by the owner of the platform, who gives each new club an activation code. */
const Cloud = (() => {
  const builtIn = () => (typeof CLUB_SERVER !== 'undefined' && CLUB_SERVER.url && CLUB_SERVER.key ? CLUB_SERVER : null);
  const session = () => (Store.state.auth && Store.state.auth.session) || null;
  const token = () => { const s = session(); return (s && !s.demo && s.token) || ''; }; // the demo club stays on the device
  // Server address (built into the app); the invitation code of the club while a dirigeant joins it
  function cfg() {
    const c = Store.state.club.cloud || {}, b = builtIn() || {};
    return b.url && b.key ? { url: b.url, key: b.key, clubKey: c.clubKey || '' } : null;
  }
  const canLogin = () => !!cfg();
  const access = () => token() || (cfg() || {}).clubKey;
  const ready = () => !!(cfg() && access());
  // A responsable's login is his « responsable code »
  const adminKey = () => (session() && session().admin ? token() : '');
  const ERRORS = {
    COMPTE_INCONNU: 'Aucun compte à ce nom dans ce club.',
    CLUB_INCONNU: 'Aucun club avec ce code. Vérifie le code du club (demande-le à ton responsable).',
    CLUB_SUSPENDU: 'L\'accès de ce club est suspendu : contacte Clubbo.',
    ACTIVATION: 'Ce code d\'activation n\'est pas valable (ou a déjà servi).',
    SLUG_PRIS: 'Ce code de club est déjà pris : choisis-en un autre.',
    PROPRIETAIRE: 'Clé du propriétaire incorrecte.',
    MOT_DE_PASSE: 'Mot de passe incorrect.',
    BLOQUE: 'Trop d\'essais : attends 5 minutes avant de réessayer.',
    DEJA_INSCRIT: 'Ce dirigeant a déjà un mot de passe : connecte-toi, ou demande au responsable de le réinitialiser.',
    ACCES_RETIRE: 'Ton accès à l\'appli du club a été retiré par un responsable.',
    SESSION: 'Ta connexion a expiré : reconnecte-toi.',
    DONNEES: 'Informations incomplètes.',
    CRENEAU_PRIS: 'Ce créneau est déjà pris sur cette partie du terrain. Choisis un autre horaire ou l\'autre moitié.',
    HORS_CRENEAU: 'Cet horaire est en dehors des créneaux disponibles du terrain.',
    CLE_CLUB: 'Accès au club refusé : reconnecte-toi (ou demande un nouveau lien d\'invitation au responsable).',
    ADMIN: 'Réservé à un responsable du club.',
    HORAIRE: 'L\'heure de fin doit être après l\'heure de début.',
    MATCH_PASSE: 'Ce match est passé : les réponses sont fermées.',
    PHOTOS_MAX: '12 photos au plus par match pour les parents.',
    DONNEES_PUSH: 'Abonnement aux notifications refusé par le serveur.',
  };
  function nice(msg) {
    const k = Object.keys(ERRORS).find(x => String(msg).includes(x));
    return k ? ERRORS[k] : 'Le serveur ne répond pas : vérifie la connexion internet.';
  }
  async function rpc(name, args = {}, c = cfg()) {
    if (!c || !c.url) throw new Error('Serveur non configuré');
    const headers = { apikey: c.key, 'Content-Type': 'application/json' };
    if (!String(c.key).startsWith('sb_')) headers.Authorization = 'Bearer ' + c.key;
    let r;
    const body = name in NO_K ? args : Object.assign({ k: access() }, args);
    try { r = await fetch(`${c.url.replace(/\/+$/, '')}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(body) }); }
    catch (e) { const err = new Error('Pas de connexion internet.'); err.offline = true; throw err; }
    const txt = await r.text();
    if (!r.ok) {
      let m = txt; try { m = JSON.parse(txt).message || txt; } catch (e) {}
      const err = new Error(nice(m)); err.code = Object.keys(ERRORS).find(x => String(m).includes(x)) || '';
      if (r.status === 404 || /could not find the function/i.test(m)) { err.code = 'MISE_A_JOUR'; err.message = 'Le serveur Clubbo est en cours de mise à jour : réessaie dans quelques minutes.'; }
      throw err;
    }
    return txt ? JSON.parse(txt) : null;
  }
  // Functions that identify the person otherwise than by the club access (login, club creation, owner of the platform)
  const NO_K = { club_login: 1, club_me: 1, club_teams_done: 1, club_change_pw: 1, club_logout: 1, ea_create_club: 1,
    ea_owner_init: 1, ea_owner_codes: 1, ea_owner_clubs: 1, ea_owner_club_set: 1, ea_owner_push: 1,
    // (1.34) the owner's space: no club login sent (the server refused these four calls)
    ea_owner_sub: 1, ea_owner_votes: 1, ea_owner_club_plan: 1, ea_owner_requests: 1 };
  function genKey(n = 24) {
    const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789', r = crypto.getRandomValues(new Uint8Array(n));
    return Array.from(r, x => a[x % a.length]).join('');
  }

  // Dates always as YYYY-MM-DD, whatever the server sends
  const normDate = b => (b && b.date ? Object.assign(b, { date: String(b.date).slice(0, 10) }) : b);

  /* ---------- API ---------- */
  const api = {
    ping: c => rpc('club_ping', {}, c),
    adminPing: () => rpc('club_admin_ping', { admin_k: adminKey() }),
    messages: since => rpc('club_messages', { since: since || '1970-01-01T00:00:00Z' }),
    post: (channel, body) => { const u = Auth.current(); return rpc('club_post', { p_channel: channel, p_author_id: u.id, p_author_name: Store.fullName(u), p_body: body }); },
    deleteMessage: id => rpc('club_delete_message', { p_id: id, p_author: Auth.current().id, admin_k: adminKey() || null }),
    slots: () => rpc('club_slots'),
    setSlots: list => rpc('club_set_slots', { admin_k: adminKey(), p: list }),
    bookings: async (from, to) => ((await rpc('club_bookings', { d_from: from, d_to: to })) || []).map(normDate),
    book: async b => normDate(await rpc('club_book', { p: b })),
    unbook: id => rpc('club_unbook', { p_id: id, p_author: Auth.current().id, admin_k: adminKey() || null }),
    unbookSeries: series => rpc('club_unbook_series', { p_series: series, p_author: Auth.current().id, admin_k: adminKey() || null }),
    // accounts
    login: (club, last, first, h) => rpc('club_login', { p_club: club, p_last: last, p_first: first, p_h: h }),
    createClub: (code, name, slug, p) => rpc('ea_create_club', { p_code: code, p_name: name, p_slug: slug, p }),
    register: (p, admK) => rpc('club_register', { admin_k: admK || adminKey() || null, p }),
    accounts: () => rpc('club_accounts'),
    accountSet: p => rpc('club_account_set', { admin_k: adminKey(), p }),
    me: () => rpc('club_me', { t: token() }),
    teamsDone: () => rpc('club_teams_done', { t: token() }),
    changePw: (oldH, newH) => rpc('club_change_pw', { t: token(), p_old: oldH, p_new: newH }),
    logout: t => rpc('club_logout', { t }),
    invite: renew => rpc('club_invite', { admin_k: adminKey(), p_new: !!renew }),
    info: () => rpc('club_info'),
    // shared club data
    pull: since => rpc('club_pull', { p_since: since || 0 }),
    push: list => rpc('club_push', { p: list }),
    // personal codes of the licensees, answers to convocations
    memberCodes: (ids, renew) => rpc('club_member_codes', { admin_k: adminKey() || null, p_players: ids, p_renew: renew || [] }),
    memberGiven: (id, given) => rpc('club_member_given', { admin_k: adminKey() || null, p_player: id, p_given: !!given }),
    answers: matchIds => rpc('club_answers', { p_matches: matchIds }),
    setAnswer: (matchId, playerId, status) => rpc('club_set_answer', { p_match: matchId, p_player: playerId, p_status: status || '' }),
    // notifications and read receipts
    pushKey: () => rpc('club_push_key'),
    pushSub: (endpoint, prefs) => rpc('club_push_sub', { k: token(), p_endpoint: endpoint, p_prefs: prefs }),
    pushUnsub: endpoint => rpc('club_push_unsub', { k: token(), p_endpoint: endpoint }),
    pushTest: () => rpc('club_push_test', { k: token() }),
    markRead: (channel, at) => rpc('club_mark_read', { k: token(), p_channel: channel, p_at: at }),
    reads: channel => rpc('club_reads', { p_channel: channel }),
    tipFileAdd: (playerId, tipId, name, mime, data) => rpc('club_tip_file_add', { p_player: playerId, p_tip: tipId, p_name: name, p_mime: mime, p_data: data }), // (1.74)
    tipFileDel: id => rpc('club_tip_file_del', { p_id: id }),
    photoAdd: (matchId, src, data) => rpc('club_photo_add', { p_match: matchId, p_src: src, p_data: data, p_by: Auth.current() ? Store.fullName(Auth.current()) : '' }),
    photos: matchId => rpc('club_photos', { p_match: matchId }),
    photoGet: id => rpc('club_photo_get', { p_id: id }),
    photoDel: id => rpc('club_photo_del', { p_id: id }),
    // backups
    // (1.61) the predictions game
    game: team => rpc('club_game', { p_team: team }),
    gameBet: (ev, h, a, ko) => rpc('club_game_bet', { p_event: ev, p_h: h, p_a: a, p_kickoff: ko }),
    gameFav: f => rpc('club_game_fav', { p_fav: f }),
    backups: () => rpc('club_backups', { admin_k: adminKey() }),
    backupNow: () => rpc('club_backup_now', { admin_k: adminKey() }),
    backupGet: id => rpc('club_backup_get', { admin_k: adminKey(), p_id: id }),
    backupAuto: () => rpc('club_backup_auto'),
    // the owner of the platform
    ownerInit: key => rpc('ea_owner_init', { p_key: key }),
    ownerCodes: (key, n, note) => rpc('ea_owner_codes', { p_key: key, p_new: n || 0, p_note: note || null }),
    ownerClubs: key => rpc('ea_owner_clubs', { p_key: key }),
    ownerSub: (key, endpoint, on) => rpc('ea_owner_sub', { p_key: key, p_endpoint: endpoint || null, p_on: on == null ? null : !!on }),
    ownerVotes: key => rpc('ea_owner_votes', { p_key: key }),
    ownerClubPlan: (key, club, plan) => rpc('ea_owner_club_plan', { p_key: key, p_club: club, p_plan: plan }),
    ownerRequests: (key, id, status, code) => rpc('ea_owner_requests', { p_key: key, p_id: id || null, p_status: status || null, p_code: code || null }),
    ownerClubSet: (key, club, status) => rpc('ea_owner_club_set', { p_key: key, p_club: club, p_status: status }),
    ownerPush: (key, url) => rpc('ea_owner_push', { p_key: key, p_url: url }),
  };
  // the club of this device (its code, shown to the dirigeants to log in)
  const clubSlug = () => AppCfg.club || (session() && session().club && session().club.slug) || (Store.state.club.cloud || {}).slug || '';
  const appUrl = () => `${location.origin}${location.pathname.replace(/index\.html$/, '')}`;
  const inviteLink = code => `${appUrl()}#rejoindre=${encodeURIComponent(code)}`;
  // (3.69) the link of one person: his name is already chosen when he opens it
  async function invitePerson(p) {
    let code;
    try { code = await api.invite(false); } catch (e) { return toast(e.message, 'err'); }
    const link = inviteLink(code) + '&qui=' + encodeURIComponent(p.id), first = p.firstName || '';
    const text = `Bonjour ${first}, voici ton accès à l'appli du club ${Store.state.club.name || ''} : ouvre ce lien, ton nom est déjà choisi, il te reste à créer ton mot de passe. Ensuite, ajoute l'appli à ton écran d'accueil.\n${link}`;
    const ph = String(p.phone || '').replace(/[^\d+]/g, ''), intl = ph.startsWith('+') ? ph.slice(1) : ph.startsWith('0') ? '33' + ph.slice(1) : ph;
    modal({ title: `Le lien de ${first || 'ce dirigeant'}`, noFocus: true, body: `<p class="muted small">Envoie-le à lui seulement : en l'ouvrant, son nom est déjà choisi.</p><textarea id="invTxt" rows="6">${esc(text)}</textarea>`,
      actions: [
        { label: 'WhatsApp', kind: 'primary', icon: I.share, onClick: (c, r) => { window.open(`https://wa.me/${intl}?text=${encodeURIComponent($('#invTxt', r).value)}`, '_blank'); return false; } },
        ...(navigator.share ? [{ label: 'Autre appli', icon: I.share, onClick: (c, r) => { navigator.share({ text: $('#invTxt', r).value }).catch(() => {}); return false; } }] : []),
        { label: 'Copier', icon: I.copy, onClick: (c, r) => { navigator.clipboard.writeText($('#invTxt', r).value).then(() => toast('Message copié')).catch(() => toast('Sélectionne le texte et copie-le')); return false; } }] });
  }
  async function shareInvite(renew) {
    let code;
    try { code = await api.invite(renew); } catch (e) { return toast(e.message, 'err'); }
    const link = inviteLink(code), club = Store.state.club.name || 'le club';
    const text = `${club} · ${AppCfg.name} : ouvre ce lien pour créer ton mot de passe (première connexion), puis ajoute l'appli à ton écran d'accueil.\nCode du club : ${clubSlug()}\n${link}`;
    Store.state.ui.invited = true; Store.save();
    modal({ title: 'Inviter les éducateurs', body: `<p>Envoie ce lien aux dirigeants (WhatsApp, SMS, e-mail). En l'ouvrant, chacun choisit son nom et crée son mot de passe. Ensuite, ils se connectent partout avec le <b>code du club</b> (<b>${esc(clubSlug())}</b>), leur <b>nom, prénom et mot de passe</b>.</p>
      <label class="fld"><span>Lien d'invitation</span><input id="invLink" value="${esc(link)}" readonly></label>
      <p class="muted small">Garde ce lien dans le groupe des éducateurs : il donne accès aux données du club. « Nouveau lien » annule l'ancien.</p>`,
      onOpen: r => { const i = $('#invLink', r); i.onclick = () => i.select(); },
      actions: [{ label: 'Nouveau lien', onClick: () => { setTimeout(() => shareInvite(true), 60); } },
        { label: 'Copier', icon: I.copy, onClick: () => { navigator.clipboard.writeText(text).then(() => toast('Invitation copiée')).catch(() => toast('Sélectionne le lien et copie-le')); return false; } },
        ...(navigator.share ? [{ label: 'Envoyer', kind: 'primary', icon: I.share, onClick: () => { navigator.share({ title: AppCfg.name, text }).catch(() => {}); return false; } }] : [])] });
  }

  /* ---------- Réglages ---------- */
  const { esc, $, toast, modal } = UI;
  function settingsSection() {
    const admin = Auth.isAdmin(), sync = typeof Sync !== 'undefined' ? Sync.status() : '';
    return `<section class="card"><h2>${I.share}${AppCfg.fixed ? 'Serveur du club' : 'Le club sur Clubbo'}</h2>
      <p>${ready() ? `<span class="res res-V">Connecté</span> Code du club : <b>${esc(clubSlug() || '—')}</b>` : '<span class="res res-D">Non connecté</span>'}</p>
      ${sync ? `<p class="muted small">${esc(sync)}</p>` : ''}
      ${admin && ready() ? `<div class="chips"><button class="btn primary" data-cloud="invite">${I.share}<span>Inviter les éducateurs</span></button><button class="btn" data-cloud="test">${I.check}<span>Tester la connexion</span></button></div>
        <p class="muted small">Les éducateurs rejoignent le club avec le lien d'invitation, puis se connectent sur n'importe quel appareil avec le code du club, leur nom et leur mot de passe.</p>`
      : `<p class="muted small">Tes données sont enregistrées sur le serveur : tu les retrouves en te connectant sur un autre appareil.</p>`}
    </section>`;
  }
  async function onSettingsClick(b) {
    if (b.dataset.cloud === 'invite') return shareInvite(false);
    if (b.dataset.cloud === 'test') { try { await api.ping(); toast('Connexion OK'); } catch (e) { toast(e.message, 'err'); } }
  }

  return Object.assign(api, { ready, invitePerson, canLogin, cfg, adminKey, token, genKey, settingsSection, onSettingsClick, shareInvite, clubSlug, appUrl });
})();
