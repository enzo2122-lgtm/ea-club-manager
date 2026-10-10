/* Messages: the coaches' internal messaging, through the club server.
   Channels: the whole club, one per category, and private conversations between two coaches. */
const Messages = (() => {
  const { esc, $, $$, toast, confirmBox } = UI;
  const S = () => Store.state;
  const CACHE = AppCfg.key('msgs'), READ = AppCfg.key('msg-read');
  let msgs = [], last = '1970-01-01T00:00:00Z', timer = null, fast = false, busy = false;
  // (2.14) a report sent before as a private message: shown in « Signalements et idées », not here
  const isReport = m => /\[\[signalement:[\w-]+\]\]/.test(String(m.body || '')) || /^(🐞|💡|❓) (Problème|Idée|Question) signalé depuis la page/.test(String(m.body || ''));

  try { msgs = JSON.parse(localStorage.getItem(CACHE)) || []; if (!Array.isArray(msgs)) msgs = []; msgs = msgs.filter(m => !isReport(m)); if (msgs.length) last = msgs[msgs.length - 1].created_at; } catch (e) { msgs = []; } // a damaged copy: read again from the server
  const reads = () => { try { return JSON.parse(localStorage.getItem(READ)) || {}; } catch (e) { return {}; } };
  // categories whose teams A / B are shown in the list of conversations (this device)
  const FAMS = AppCfg.key('msg-fams');
  const openFams = () => { try { return JSON.parse(localStorage.getItem(FAMS)) || []; } catch (e) { return []; } };
  const saveFams = l => { try { localStorage.setItem(FAMS, JSON.stringify(l)); } catch (e) {} };
  // (1.58) a conversation read: its notifications still on the phone go away (they open « #/messages/<conversation> »)
  const clearNotifs = ch => { try { if (!('serviceWorker' in navigator)) return; navigator.serviceWorker.getRegistration().then(reg => reg && reg.getNotifications && reg.getNotifications().then(ns => ns.forEach(n => {
    const u = String((n.data || {}).url || ''); if (u === '#/messages' || u.endsWith('#/messages/' + encodeURIComponent(ch)) || u.endsWith('#/messages/' + ch)) n.close(); }))).catch(() => {}); } catch (e) {} };
  const markRead = ch => { const r = reads(); r[ch] = new Date().toISOString(); try { localStorage.setItem(READ, JSON.stringify(r)); } catch (e) {} clearNotifs(ch); };
  const me = () => Auth.current();
  const dmKey = (a, b) => 'dm:' + [a, b].sort().join(':');
  const isMineDm = ch => ch.startsWith('dm:') && me() && ch.split(':').includes(me().id);
  function visible(ch) {
    if (ch === 'general') return true;
    if (ch.startsWith('team:')) return !!Store.get('teams', ch.slice(5)); // every coach can talk in every category (a deleted category: nowhere to read it)
    return isMineDm(ch);
  }
  // In the messaging everybody is « Coach » + first name (« Coach Karim »); « Giova (Christian) » shows as « Coach Giova »
  function coachName(s) {
    const f = String(s.firstName || '').replace(/\(.*?\)/g, '').trim().split(/\s+/)[0];
    return 'Coach ' + (f ? f.charAt(0).toUpperCase() + f.slice(1) : String(s.lastName || '').charAt(0) + String(s.lastName || '').slice(1).toLowerCase());
  }
  const staffOf = m => m.author_id && Store.get('staff', m.author_id);
  /* ---------- @mentions: « @Karim » in a message; the app adds [[tag:id]] so the server notifies Karim in any case ---------- */
  const fold = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const firstOf = s => coachName(s).replace(/^Coach /, '');
  function tagsOf(text) {
    const words = new Set((fold(text).match(/@([a-z0-9'-]+)/g) || []).map(w => w.slice(1)));
    return S().staff.filter(s => me() && s.id !== me().id && words.has(fold(firstOf(s)))).map(s => s.id);
  }
  const shotOk = v => typeof v === 'string' && /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(v); // (2.01) only a real screenshot goes into the page
  const clean = body => String(body).replace(Chat.ATT_RE, '').replace(/\n?#rappel-[\w-]+\s*$/, '').replace(/\n?\[\[fichier:[\w,-]+\]\]/, '').replace(/\n?\[\[signalement:[\w-]+\]\]/, '').replace(/\n?\[\[tag:[\w,-]+\]\]/, '');
  // @Prénom of a coach of the club, highlighted in the bubble
  const withMentions = html => html.replace(/@([A-Za-zÀ-ÿ0-9'-]+)/g, (all, w) => S().staff.some(s => fold(firstOf(s)) === fold(w)) ? `<b class="mention">@${w}</b>` : all);
  /* ---------- read receipts (club server): when each dirigeant last read a conversation ---------- */
  const readsOf = {}, marked = {};
  async function loadReads(ch) { try { readsOf[ch] = await Cloud.reads(ch) || []; } catch (e) { readsOf[ch] = readsOf[ch] || []; } return readsOf[ch]; }
  function sendRead(ch) {
    const list = msgs.filter(m => m.channel === ch), lastAt = list.length ? list[list.length - 1].created_at : null;
    if (!lastAt || marked[ch] === lastAt || !Cloud.token()) return;
    marked[ch] = lastAt; Cloud.markRead(ch, lastAt).catch(() => { marked[ch] = null; });
  }
  const redraw = () => { if (location.hash.startsWith('#/messages')) App.route(true); };
  const crestOf = s => s && s.club ? Clubs.crest(s.club, 18, redraw) : '';
  function authorName(m) {
    const s = m.author_id && Store.get('staff', m.author_id);
    if (s) return coachName(s);
    const n = String(m.author_name || '').trim();
    // (2.14) a message from the players' or parents' space (« Écrire au coach », an injury): a player or a parent, never « Coach »
    if (/^member:/.test(m.author_id || '')) { const p = Store.get('players', m.author_id.slice(7)), parent = /\(parent\)\s*$/i.test(n), nm = p ? Store.shortName(p) : n.replace(/\s*\((joueur|parent)\)\s*$/i, '') || 'un joueur';
      return parent ? `Parent de ${nm}` : `${nm} · joueur`; }
    const first = n.split(/\s+/).find(w => w !== w.toUpperCase());
    return first ? 'Coach ' + first : n || '?';
  }
  // Documents sent from the library: [[fichier:id,id]] = pictures travelling as schemas (with their image) to every device
  const bgAsked = new Set();
  function filesOf(m) {
    const rid = (String(m.body).match(/\[\[signalement:([\w-]+)\]\]/) || [])[1];
    if (rid) { const rep = Store.get('reports', rid);
      return `<div class="msg-files">${rep && shotOk(rep.shot) ? `<button class="msg-shot" data-shot="${rid}" aria-label="Voir la capture d'écran"><img alt="Capture d'écran du problème" src="${rep.shot}"></button>` : '<span class="msg-file wait">Capture d\'écran en cours de réception…</span>'}</div>`; }
    const ids = ((String(m.body).match(/\[\[fichier:([\w,-]+)\]\]/) || [])[1] || '').split(',').filter(Boolean); if (!ids.length) return '';
    const missing = ids.map(id => Store.get('schemas', id)).filter(s => s && s.field && s.field.bgId && !Board.BG.has(s.field.bgId) && !bgAsked.has(s.id));
    if (missing.length) { missing.forEach(s => bgAsked.add(s.id)); Board.preloadBackgrounds(missing).then(() => { if (location.hash.startsWith('#/messages')) App.route(true); }); }
    return `<div class="msg-files">${ids.map(id => { const s = Store.get('schemas', id);
      return s ? `<a class="msg-file" href="#/schema/${id}"><img alt="" src="${UI.thumb(s, 320, 208)}"><span>${esc(s.name)}</span></a>` : '<span class="msg-file wait">Document en cours de réception…</span>'; }).join('')}</div>`;
  }
  function channelName(ch) {
    if (ch === 'general') return 'Tout le club · tous les coachs';
    if (ch.startsWith('team:')) { const t = Store.get('teams', ch.slice(5)); return t ? t.name : 'Catégorie'; }
    const other = ch.split(':').slice(1).find(id => id !== (me() || {}).id), s = Store.get('staff', other);
    return s ? coachName(s) : 'Message privé';
  }
  const unread = ch => { const r = reads()[ch] || '1970'; return msgs.filter(m => m.channel === ch && m.created_at > r && m.author_id !== (me() || {}).id).length; };
  const totalUnread = () => [...new Set(msgs.map(m => m.channel))].filter(visible).reduce((a, ch) => a + unread(ch), 0);

  async function fetchNew() {
    if (busy || !Cloud.ready() || !me()) return false;
    busy = true;
    try {
      let fresh = await Cloud.messages(last);
      for (let more = fresh, n = 0; more && more.length >= 500 && n < 20; n++) { more = await Cloud.messages(more[more.length - 1].created_at); if (more && more.length) fresh = fresh.concat(more); }
      if (fresh && fresh.length) {
        const ids = new Set(msgs.map(m => m.id));
        fresh.forEach(m => { if (!ids.has(m.id) && !isReport(m)) msgs.push(m); });
        msgs.sort((a, b) => a.created_at.localeCompare(b.created_at)); msgs = msgs.slice(-800);
        last = msgs[msgs.length - 1].created_at;
        try { localStorage.setItem(CACHE, JSON.stringify(msgs)); } catch (e) {}
        return true;
      }
    } catch (e) {} finally { busy = false; }
    return false;
  }
  function badge() {
    const n = totalUnread(), a = document.querySelector('#nav a[href="#/messages"]'); if (!a) return;
    let b = a.querySelector('.nav-badge'); if (!b) { b = document.createElement('i'); b.className = 'nav-badge'; a.appendChild(b); }
    b.textContent = n > 9 ? '9+' : n; b.hidden = !n;
  }
  /* ---------- automatic reminder the day before a match ----------
     No server runs on its own, so the first device of a coach of the category (or of a responsable) opened the day before
     posts it in the category's channel. The match keeps « reminded » and the message carries a tag: it is posted once. */
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const TAG = id => `#rappel-${id}`;
  let reminding = false;
  async function matchReminders() {
    if (reminding || !Cloud.ready() || !me()) return;
    const now = new Date(), today = iso(now), tomorrow = iso(new Date(now.getTime() + 864e5)), mine = new Set(me().teamIds || []);
    const due = S().matches.filter(m => !m.exempt && !m.played && !m.reminded && (m.date === tomorrow || (m.date === today && (!m.time || m.time > now.toTimeString().slice(0, 5))))
      && m.teamId && (mine.has(m.teamId) || Auth.realAdmin()));
    if (!due.length) return;
    reminding = true;
    try {
      for (const m of due) {
        const ch = 'team:' + m.teamId;
        if (msgs.some(x => x.channel === ch && (x.body || '').includes(TAG(m.id)))) { m.reminded = m.date; Store.upsert('matches', m); continue; }
        const t = Store.get('teams', m.teamId) || {}, club = S().club.name || 'Le club', d = new Date(m.date + 'T12:00');
        const when = m.date === today ? 'aujourd\'hui' : 'demain ' + d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        const body = [`📣 Rappel : match ${when}`, `⚽ ${t.name || ''} · ${m.home ? club + ' – ' + (m.opponent || '?') : (m.opponent || '?') + ' – ' + club}`,
          m.rdv || m.time ? `🕘 ${m.rdv ? 'Rendez-vous ' + m.rdv : ''}${m.rdv && m.time ? ' · ' : ''}${m.time ? 'coup d\'envoi ' + m.time : ''}` : '🕘 Heure à confirmer',
          m.home ? `🏟️ À domicile${S().club.fieldName ? ' · ' + S().club.fieldName : ''}` : `🚌 À l'extérieur${m.place ? ' · ' + m.place : ''}`,
          (m.convoked || []).length ? `👥 ${(m.convoked || []).length} joueur${m.convoked.length > 1 ? 's' : ''} convoqué${m.convoked.length > 1 ? 's' : ''}` : '',
          TAG(m.id)].filter(Boolean).join('\n');
        try { const r = await Cloud.post(ch, body); if (r) msgs.push(r); m.reminded = m.date; Store.upsert('matches', m); } catch (e) { break; }
      }
    } finally { reminding = false; }
  }
  /* (1.58) a message read on another device (the phone) is read here too: the server keeps when each dirigeant last read
     each conversation (read receipts). For the conversations that look unread on this device, that time is taken back. */
  let syncedAt = 0;
  async function syncReads() {
    if (!Cloud.token() || !me() || Date.now() - syncedAt < 60000) return false;
    syncedAt = Date.now();
    const chs = [...new Set(msgs.map(m => m.channel))].filter(ch => visible(ch) && unread(ch)).slice(0, 15);
    if (!chs.length) return false;
    const r = reads(); let changed = false;
    await Promise.all(chs.map(async ch => { try {
      const mine = ((await Cloud.reads(ch)) || []).filter(x => x.staff_id === me().id).map(x => x.at).sort().pop();
      if (mine && mine > (r[ch] || '')) { r[ch] = mine; changed = true; }
    } catch (e) {} }));
    if (changed) { try { localStorage.setItem(READ, JSON.stringify(r)); } catch (e) {} }
    return changed;
  }
  function start() {
    clearInterval(timer);
    const tick = async () => { const changed = await fetchNew(); const readElsewhere = await syncReads(); await matchReminders(); badge(); if (readElsewhere && location.hash.startsWith('#/messages')) App.route(true); if (changed && fast && onNew) onNew(); if (fast && onTick) onTick(); };
    tick(); timer = setInterval(tick, fast ? 6000 : 45000);
  }
  let onNew = null, onTick = null;

  /* ---------- page ---------- */
  // (2.64) phone: the conversation goes down to the tab bar (or the keyboard), measured on the screen (no guessed height: no gap, no jump)
  let fitOn = false;
  function fitLayout(root) {
    const go = () => {
      const el = root.querySelector('.msg-layout'); if (!el || !el.isConnected) return;
      if (window.innerWidth > 760) { el.style.height = ''; return; }
      const vv = window.visualViewport, vb = vv ? vv.height + vv.offsetTop : window.innerHeight, rail = document.querySelector('.rail');
      const rr = rail && getComputedStyle(rail).display !== 'none' ? rail.getBoundingClientRect() : null;
      const bottom = Math.min(vb, rr && rr.height && rr.top > window.innerHeight / 2 ? rr.top : vb);
      const h = Math.max(240, Math.round(bottom - el.getBoundingClientRect().top - 8));
      if (el.style.height !== h + 'px') el.style.height = h + 'px';
    };
    go(); requestAnimationFrame(go); setTimeout(go, 350);
    if (!fitOn) { fitOn = true; const later = () => { go(); setTimeout(go, 300); };
      window.addEventListener('resize', later); if (window.visualViewport) window.visualViewport.addEventListener('resize', later);
      document.addEventListener('focusin', later); document.addEventListener('focusout', later);
      // something shown above (the help, a banner): measured again
      if (window.ResizeObserver) new ResizeObserver(() => { const el = document.querySelector('.msg-layout'); if (el) requestAnimationFrame(() => root._fitMsg && root._fitMsg()); }).observe(root); }
    root._fitMsg = go;
  }
  function page(root, chParam) {
    if (!Cloud.ready()) {
      root.innerHTML = `<header class="page-head"><div><h1>Messages</h1><p class="sub">La messagerie des éducateurs du club</p></div></header>
        <div class="empty"><p>La messagerie passe par le serveur du club, qui n'est pas encore connecté sur cet appareil.</p>
        ${Auth.isAdmin() ? `<a class="btn primary" href="#/reglages">${I.settings}<span>Se reconnecter</span></a>` : '<p class="muted">Déconnecte-toi puis reconnecte-toi avec ton nom et ton mot de passe. Si ça ne marche pas, préviens le responsable.</p>'}</div>`;
      return;
    }
    const ch = chParam && visible(decodeURIComponent(chParam)) ? decodeURIComponent(chParam) : '';
    const mineTeams = new Set((me().teamIds || []));
    const teams = S().teams.slice(); // club order: Seniors, Vétérans, École de foot, U6 … U17
    const dms = [...new Set(msgs.map(m => m.channel).filter(isMineDm))];
    const item = (c, sub, n = unread(c)) => `<a class="ch ${sub ? 'ch-sub' : ''} ${c === ch ? 'on' : ''}" href="#/messages/${encodeURIComponent(c)}"><span class="ch-ic">${sub ? '↳' : c === 'general' ? I.team : c.startsWith('team:') ? I.whistle : (crestOf(Store.get('staff', c.split(':').slice(1).find(id => id !== (me() || {}).id))) || I.edit)}</span>
      <span class="ch-name">${esc(channelName(c))}</span>${n ? `<i class="ch-badge">${n}</i>` : ''}</a>`;
    // a category, its teams A / B folded under it: « U14 » always shows the unread messages of the whole category,
    // « ▸ 2 » opens « ↳ U14 A », « ↳ U14 B » (kept open on this device, and always open on the team being read)
    const groups = Store.teamGroups(teams), mineGroup = g => g.some(t => mineTeams.has(t.id));
    const opened = openFams();
    const groupItems = list => list.map(g => {
      const [main, ...subs] = g;
      if (!Store.isMain(main) || !subs.length) return g.map(t => item('team:' + t.id, Store.isSub(t))).join('');
      const open = opened.includes(main.id) || subs.some(t => 'team:' + t.id === ch);
      const total = g.reduce((a, t) => a + unread('team:' + t.id), 0), subN = subs.reduce((a, t) => a + unread('team:' + t.id), 0);
      return `<div class="ch-fam ${open ? 'open' : ''}"><div class="ch-row">${item('team:' + main.id, false, total)}
          <button type="button" class="ch-tog" data-fam="${main.id}" aria-expanded="${open}" aria-label="${open ? 'Cacher' : 'Voir'} les équipes de ${esc(main.name)}">${open ? '▾' : '▸'} ${subs.length}${!open && subN ? '<i class="ch-dot"></i>' : ''}</button></div>
        <div class="ch-subs">${subs.map(t => item('team:' + t.id, true)).join('')}</div></div>`;
    }).join('');
    root.innerHTML = `<div class="msg-layout ${ch ? 'has-ch' : ''}">
      <aside class="ch-list">
        <header class="page-head"><div><h1>Messages</h1><p class="sub">Entre éducateurs du club</p></div></header>
        ${item('general')}
        ${mineTeams.size ? `<div class="ch-sec">Mes catégories</div>${groupItems(groups.filter(mineGroup))}` : ''}
        <div class="ch-sec">${mineTeams.size ? 'Les autres catégories' : 'Catégories'}</div>${groupItems(groups.filter(g => !mineGroup(g)))}
        <div class="ch-sec">Messages privés</div>${dms.map(c => item(c)).join('')}
        <button class="btn soft wide" id="newDm">${I.plus}<span>Écrire à un éducateur</span></button>
      </aside>
      <section class="conv">${ch ? `
        <header class="conv-head"><a class="icon-btn conv-back" href="#/messages" aria-label="Retour">${I.back}</a><span class="conv-title"><b>${esc(channelName(ch))}</b>${ch.startsWith('dm:') ? UI.motto(Store.get('staff', ch.split(':').slice(1).find(id => id !== (me() || {}).id))) : ''}</span></header>
        <div class="conv-body" id="convBody"></div>
        <form class="composer" id="composer">${Cloud.ready() ? `<button class="btn soft att-pick" type="button" id="attPick" aria-label="Joindre un fichier (PDF, vidéo, document)">📎</button><input type="file" id="attFile" accept="${Chat.ACCEPT}" hidden>` : ''}<textarea id="msgText" rows="1" maxlength="2000" placeholder="Écris ton message…" aria-label="Message"></textarea>
          <button class="btn primary" type="submit" aria-label="Envoyer">${I.upload}</button></form>`
        : '<div class="conv-empty"><p class="muted">Choisis une conversation.</p></div>'}</section></div>`;
    fitLayout(root);
    $('#newDm', root).onclick = pickCoach;
    $$('[data-fam]', root).forEach(b => b.onclick = () => {
      const l = openFams(), id = b.dataset.fam, on = !l.includes(id);
      saveFams(on ? [...l, id] : l.filter(x => x !== id));
      const fam = b.closest('.ch-fam'), g = Store.teamGroups(S().teams).find(x => x[0].id === id) || [];
      fam.classList.toggle('open', on); b.setAttribute('aria-expanded', on);
      const subN = g.slice(1).reduce((a, t) => a + unread('team:' + t.id), 0);
      b.innerHTML = `${on ? '▾' : '▸'} ${g.length - 1}${!on && subN ? '<i class="ch-dot"></i>' : ''}`;
    });
    if (!ch) { fast = false; onNew = () => page(root); start(); return; }
    markRead(ch); badge();
    const body = $('#convBody', root);
    // ✓ sent, ✓✓ read (private conversation); « Vu par N » under my last message (category, whole club)
    const receipt = (m, isLast) => {
      const rs = (readsOf[ch] || []).filter(r => r.staff_id !== me().id && r.at >= m.created_at);
      if (ch.startsWith('dm:')) return rs.length ? ` · <span class="seen" title="Lu à ${esc(new Date(rs[0].at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))}">✓✓${isLast ? ' Lu ' + esc(new Date(rs[0].at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })) : ''}</span>` : ` · <span class="sent">✓${isLast ? ' Envoyé' : ''}</span>`;
      return isLast ? ` · <button class="linkish seen-by" data-seen="${m.id}">${rs.length ? `Vu par ${rs.length}` : 'Pas encore vu'}</button>` : '';
    };
    let myLast = null;
    const draw = () => {
      const list = msgs.filter(m => m.channel === ch);
      myLast = list.filter(m => m.author_id === me().id).pop() || null;
      // stays where the coach is reading, except at the bottom of the conversation
      const atBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 60, keep = body.scrollTop;
      let day = '';
      body.innerHTML = list.length ? list.map(m => {
        const d = new Date(m.created_at), ds = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        const sep = ds !== day ? `<div class="day-sep">${esc(ds)}</div>` : ''; day = ds;
        const mine = m.author_id === me().id;
        return `${sep}<div class="bubble ${mine ? 'mine' : ''}" data-m="${m.id}">${mine ? '' : `<span class="author-line"><b class="author">${crestOf(staffOf(m))}${esc(authorName(m))}</b>${UI.motto(staffOf(m))}</span>`}${Chat.attsOf(m.body).map(Chat.attChip).join('')}${clean(m.body).trim() ? `<p>${withMentions(esc(clean(m.body).trim())).replace(/\n/g, '<br>')}</p>` : ''}${filesOf(m)}
          <span class="time">${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}${mine ? receipt(m, m === myLast) : ''}${mine || Auth.isAdmin() ? ` · <button class="linkish" data-delm="${m.id}">supprimer</button>` : ''}</span></div>`;
      }).join('') : '<p class="muted conv-hint">Pas encore de message. Écris le premier !</p>';
      body.scrollTop = atBottom || !drawn ? body.scrollHeight : keep; drawn = true;
    };
    let drawn = false;
    draw(); sendRead(ch);
    loadReads(ch).then(() => { if (body.isConnected) draw(); });
    const ta = $('#msgText', root);
    ta.oninput = () => { ta.style.height = 'auto'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px'; suggest(); };
    // « @ka… » → the coaches whose first name starts like this; a touch completes the name
    const sug = document.createElement('div'); sug.className = 'mention-sug'; sug.hidden = true; $('#composer', root).before(sug);
    const suggest = () => {
      const upto = ta.value.slice(0, ta.selectionStart), m = upto.match(/(^|\s)@([A-Za-zÀ-ÿ'-]*)$/);
      if (!m) { sug.hidden = true; return; }
      const q = fold(m[2]), list = S().staff.filter(s => s.id !== me().id && fold(firstOf(s)).startsWith(q)).sort(Store.byName).slice(0, 6);
      sug.innerHTML = list.map(s => `<button type="button" data-mention="${esc(firstOf(s))}">${crestOf(s)}<b>@${esc(firstOf(s))}</b><span class="muted small">${esc(Store.fullName(s))}${s.role ? ' · ' + esc(s.role) : ''}</span></button>`).join('');
      sug.hidden = !list.length;
    };
    sug.onclick = e => {
      const b = e.target.closest('[data-mention]'); if (!b) return;
      const pos = ta.selectionStart, before = ta.value.slice(0, pos).replace(/@([A-Za-zÀ-ÿ'-]*)$/, '@' + b.dataset.mention + ' ');
      ta.value = before + ta.value.slice(pos); ta.focus(); ta.setSelectionRange(before.length, before.length); sug.hidden = true;
    };
    ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && matchMedia('(pointer: fine)').matches) { e.preventDefault(); $('#composer', root).requestSubmit(); } };
    // (3.14) a file joined: sent in pieces, then the message carries it
    const ap = $('#attPick', root), af = $('#attFile', root);
    if (ap && af) { ap.onclick = () => af.click(); af.onchange = async () => {
      const file = af.files && af.files[0]; af.value = ''; if (!file) return;
      const b = UI.busy(`📎 ${file.name}…`), cap = ta.value.trim();
      try {
        const tok = await Chat.attUpload({ begin: (n, mi, sz, pa) => Cloud.attBegin('msg:' + ch, n, mi, sz, pa), put: Cloud.attPut }, file, f => b.progress(f));
        const m = await Cloud.post(ch, (cap ? cap + '\n' : '') + tok); ta.value = ''; ta.oninput();
        if (m && !msgs.some(x => x.id === m.id)) msgs.push(m); markRead(ch); draw(); toast('Fichier envoyé');
      } catch (err) { toast(err.message, 'err'); } finally { b.done(); }
    }; }
    $('#composer', root).onsubmit = async e => {
      e.preventDefault();
      const text = ta.value.trim(); if (!text) return;
      const btn = e.target.querySelector('[type=submit]'); if (btn) { if (btn.disabled) return; btn.disabled = true; btn.classList.add('sending'); } // (2.01) sending: the button waits
      ta.value = ''; ta.oninput();
      const tags = tagsOf(text), sent = tags.length ? `${text}\n[[tag:${tags.join(',')}]]` : text;
      try { const m = await Cloud.post(ch, sent); if (m && !msgs.some(x => x.id === m.id)) { msgs.push(m); last = m.created_at > last ? m.created_at : last; try { localStorage.setItem(CACHE, JSON.stringify(msgs)); } catch (e2) {} } markRead(ch); draw(); }
      catch (err) { ta.value = text; toast(err.message, 'err'); }
      finally { if (btn && document.contains(btn)) { btn.disabled = false; btn.classList.remove('sending'); } }
    };
    body.onclick = async e => {
      const at = e.target.closest('[data-cxatt]'); if (at) return Chat.attOpen({ get: Cloud.attGet }, { id: at.dataset.cxatt, name: at.dataset.name, mime: at.dataset.mime, size: +at.dataset.size }, (m, err) => toast(m, err ? 'err' : ''));
      // a report's screenshot, full size
      const sh = e.target.closest('[data-shot]');
      const sb = e.target.closest('[data-seen]');
      if (sb) {
        const m = msgs.find(x => x.id === sb.dataset.seen), rs = (readsOf[ch] || []).filter(r => r.staff_id !== me().id && m && r.at >= m.created_at);
        return UI.modal({ title: 'Vu par', noFocus: true, body: rs.length ? `<ul class="alerts">${rs.map(r => { const s = Store.get('staff', r.staff_id); return `<li><b>${esc(s ? coachName(s) : 'Un dirigeant')}</b> <span class="muted small">${esc(new Date(r.at).toLocaleString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' }))}</span></li>`; }).join('')}</ul>` : '<p class="muted">Personne n\'a encore ouvert la conversation depuis ce message.</p>', actions: [{ label: 'Fermer', kind: 'primary' }] });
      }
      if (sh) { const rep = Store.get('reports', sh.dataset.shot); if (rep && shotOk(rep.shot)) UI.modal({ title: 'Capture d\'écran', noFocus: true, body: `<div class="viewer"><img alt="Capture d'écran du problème" src="${rep.shot}"></div><p class="muted small">${esc(rep.byName || '')}${rep.page ? ' · page « ' + esc(rep.page) + ' »' : ''}</p>`, actions: [{ label: 'Fermer', kind: 'primary' }] }); return; }
      const b = e.target.closest('[data-delm]'); if (!b) return;
      if (!(await confirmBox('Supprimer ce message pour tout le monde ?'))) return;
      try { await Cloud.deleteMessage(b.dataset.delm); msgs = msgs.filter(m => m.id !== b.dataset.delm); try { localStorage.setItem(CACHE, JSON.stringify(msgs)); } catch (e2) {} draw(); }
      catch (err) { toast(err.message, 'err'); }
    };
    fast = true; onNew = () => { if (location.hash.startsWith('#/messages/')) { markRead(ch); draw(); sendRead(ch); badge(); } };
    onTick = () => { if (location.hash.startsWith('#/messages/') && body.isConnected) { const before = JSON.stringify(readsOf[ch]); loadReads(ch).then(r => { if (body.isConnected && JSON.stringify(r) !== before) draw(); }); } };
    start();
    if (UI.finePointer()) setTimeout(() => ta.focus(), 100);
  }
  function pickCoach() {
    const others = S().staff.filter(s => s.id !== me().id).sort(Store.byName);
    const close = UI.modal({ title: 'Écrire à un éducateur', noFocus: true,
      body: others.length ? `<div class="people">${others.map(s => `<button class="person-main" data-to="${s.id}"><span class="pnum role">${I.whistle}</span><span class="pmain"><b class="author">${crestOf(s)}${esc(coachName(s))}</b>${UI.motto(s)}<span class="muted">${esc([s.role, (s.teamIds || []).map(id => (Store.get('teams', id) || {}).name).filter(Boolean).join(', '), s.club ? 'club de cœur : ' + Clubs.name(s.club) : ''].filter(Boolean).join(' · '))}</span></span></button>`).join('')}</div>` : '<p class="muted">Aucun autre dirigeant dans l\'appli.</p>',
      onOpen: r => $$('[data-to]', r).forEach(b => b.onclick = () => { close(); location.hash = '#/messages/' + encodeURIComponent(dmKey(me().id, b.dataset.to)); }) });
  }
  // (2.01) leaving a conversation slows the checks down; leaving any other page changes nothing (no request at each page)
  function leave() { const was = fast; fast = false; onNew = null; onTick = null; if (was || !timer) start(); }

  return { page, start, badge, leave, coachName };
})();
