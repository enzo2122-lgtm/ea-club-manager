/* App shell: navigation, routing, service worker. */
const App = (() => {
  // [hash, label, icon, short label for phones]; the first five are always in the menu, the others in « Plus » (phone and computer)
  const NAV = [
    ['', 'Accueil', 'home'], ['entrainements', 'Séances', 'training'], ['matchs', 'Matchs', 'match'], ['equipes', 'Joueurs', 'team'], ['messages', 'Messages', 'chat'],
    ['planning', 'Planning', 'calendar'], ['club', 'Vie du club', 'pin', 'Club'], ['stats', 'Résultats et stats', 'stats', 'Résultats'], ['chat', 'Chat des joueurs et des parents', 'chat', 'Chat'], ['schemas', 'Schémas', 'board'], ['bibliotheque', 'Bibliothèque', 'video', 'Biblio'], ['terrain', 'Chrono et score', 'clock', 'Chrono'], ['jeu', 'Jeu des pronos', 'medal', 'Pronos'], ['signalements', 'Signalements et idées', 'help', 'Signalements'], ['reglages', 'Réglages', 'settings'],
  ];
  const PHONE_MAIN = 5, DESK_MAIN = 9; // (2.73) a phone shows 5 pages in the bar, a computer 9 in the sidebar; « Plus » holds the rest
  const mainN = () => innerWidth > 760 ? DESK_MAIN : PHONE_MAIN;
  // (1.37) « Plus », by theme (a page not listed here goes in « Outils »)
  const MORE_GROUPS = [['Le club', ['planning', 'club', 'stats', 'chat', 'jeu', 'gestion', 'benevoles']], ['Outils du coach', ['schemas', 'bibliotheque', 'terrain']], ['Réglages et aide', ['signalements', 'reglages']]];
  const view = () => document.getElementById('view');

  // (2.80) phone gestures: a swipe from the left edge goes back, a pull from the top of the page refreshes
  (() => {
    let x0 = -1, y0 = -1, pull = 0, edge = false;
    const ptr = document.getElementById('pullHint') || (() => { const d = document.createElement('div'); d.id = 'pullHint'; d.textContent = '↓ Actualiser'; document.body.appendChild(d); return d; })();
    addEventListener('touchstart', e => { const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; pull = 0; edge = x0 < 22 && !document.body.classList.contains('editing'); }, { passive: true });
    addEventListener('touchmove', e => {
      if (document.body.classList.contains('editing') || document.getElementById('modal')) return;
      const t = e.touches[0], dy = t.clientY - y0;
      if (!edge && window.scrollY <= 0 && dy > 0 && Math.abs(t.clientX - x0) < 40) { pull = dy; ptr.classList.toggle('show', dy > 50); ptr.classList.toggle('go', dy > 90); }
    }, { passive: true });
    addEventListener('touchend', e => {
      const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      ptr.classList.remove('show', 'go');
      if (edge && dx > 90 && Math.abs(dy) < 70 && !document.getElementById('modal')) { history.back(); return; }
      if (pull > 90) { if (typeof Sync !== 'undefined' && Sync.run) { try { Sync.run(); } catch (x) {} } route(); UI.toast('Actualisé'); }
      pull = 0; edge = false;
    }, { passive: true });
  })();
  // (2.79) no network (the pitch, the gym): say it, the changes leave when it comes back
  const netState = () => document.body.classList.toggle('offline', !navigator.onLine);
  window.addEventListener('online', netState); window.addEventListener('offline', netState); setTimeout(netState, 0);
  // (3.14) the developer's diagnostic: version, device, screen, server, session, last errors (to copy)
  function devDiag() {
    const d = Object.assign({}, Help.diagnostics(), { build: BUILD, club: (AppCfg.club || ''), server: Cloud.ready() ? 'connecté' : 'non connecté', admin: Auth.isAdmin(), sw: !!(navigator.serviceWorker && navigator.serviceWorker.controller), storage: (() => { try { return Math.round(JSON.stringify(localStorage).length / 1024) + ' Ko'; } catch (e) { return '?'; } })() });
    const txt = Object.entries(d).map(([k, v]) => `${k} : ${typeof v === 'object' ? JSON.stringify(v) : v}`).join('\n');
    UI.modal({ title: '🩺 Diagnostic', body: `<textarea rows="14" readonly style="font:12px monospace;width:100%">${UI.esc(txt)}</textarea>`, actions: [{ label: 'Fermer' }, { label: 'Copier', kind: 'primary', onClick: () => { navigator.clipboard.writeText(txt).then(() => UI.toast('Copié')).catch(() => UI.toast('Sélectionne et copie')); return false; } }] });
  }
  function refreshChrome() {
    const c = Store.state.club;
    // Banner while a responsable looks at the app as a coach
    let bar = document.getElementById('previewBar'); const pv = Auth.preview();
    if (pv) {
      if (!bar) { bar = document.createElement('div'); bar.id = 'previewBar'; document.body.appendChild(bar); }
      const names = pv.teamIds.map(id => (Store.get('teams', id) || {}).name).filter(Boolean).join(', ');
      bar.innerHTML = `<span>${UI.esc(pv.label || (pv.role === 'benevole' ? '🙋 Bénévole' : pv.role === 'arbitre' ? '🟨 Arbitre' : '🧢 Coach · ' + names))}</span><span class="chips"><button class="btn" id="swPv">🔀<span class="lg"> Changer de rôle</span></button><button class="btn" id="stopPv">🏛️ Responsable</button></span>`;
      bar.querySelector('#stopPv').onclick = () => Auth.stopPreview(); bar.querySelector('#swPv').onclick = () => Roles.open();
      document.body.classList.add('previewing');
      document.body.style.setProperty('--pvh', bar.offsetHeight + 'px');
    } else if (bar) { bar.remove(); document.body.classList.remove('previewing'); }
    Demo.bar();
    document.documentElement.style.setProperty('--accent', UI.accentFor(c.homeBib));
    document.getElementById('clubName').textContent = c.name || AppCfg.name;
    Supporters.refresh();
    const u = Auth.current(), ru = document.getElementById('railUser');
    // The connected coach: his initials with his favourite club's crest, and « Coach Prénom » (opens Mon compte)
    const coach = u ? Messages.coachName(u) : '', first = coach.replace(/^Coach /, '');
    ru.innerHTML = u ? `<a class="ru-me" href="#/reglages" title="Mon compte">
        <span class="avatar" aria-hidden="true">${UI.esc((first[0] || '') + ((u.lastName || '')[0] || ''))}${u.club ? `<span class="avatar-club">${Clubs.crest(u.club, 18, () => refreshChrome())}</span>` : ''}</span>
        <span class="ru-name">${UI.esc(coach)}</span></a>${Auth.realAdmin() ? '<button class="ru-out" id="rolesBtn" title="Mes rôles">🔀 Rôles</button>' : ''}<button class="ru-out" id="logoutBtn">Sortir</button>` : '';
    const rb = document.getElementById('rolesBtn'); if (rb) rb.onclick = () => Roles.open();
    const lo = document.getElementById('logoutBtn'); if (lo) lo.onclick = () => Auth.logout();
    document.title = (u ? coach + ' · ' : '') + (c.name || AppCfg.name);
  }
  // (1.95) on a phone, the menu at the bottom (by default) or one small menu at the top right, chosen in Réglages, kept on this device
  const NAVPOS = () => AppCfg.key('navpos');
  function navPos() { try { return localStorage.getItem(NAVPOS()) === 'haut' ? 'haut' : 'bas'; } catch (e) { return 'bas'; } }
  function setNavPos(p) {
    try { localStorage.setItem(NAVPOS(), p); } catch (e) {}
    document.body.classList.toggle('nav-top', p === 'haut');
    const r = document.querySelector('.rail'); if (r) r.classList.remove('open');
  }
  document.addEventListener('click', e => {
    if (e.target.closest('#navToggle')) { e.target.closest('.rail').classList.toggle('open'); return; }
    if (!e.target.closest('.rail') || e.target.closest('#nav a, #navMore')) { const r = document.querySelector('.rail.open'); if (r) r.classList.remove('open'); }
  });
  function renderNav(active) {
    // the responsables also have the club's dashboard (before Réglages)
    const pv = Auth.preview();
    // a volunteer: only what he uses on match days
    const nav = pv && pv.role === 'benevole' ? [['benevoles', 'Bénévoles', 'team'], NAV[6]]
      : Auth.limited() === 'kit' ? [['equipements', 'Équipements', 'team', 'Équip.'], ...NAV.filter(n => Auth.pageOk(n[0]))]
      : Auth.isAdmin() ? [...NAV.slice(0, -1).filter(n => n[0] !== 'jeu' && n[0] !== 'terrain'), ['gestion', 'Gestion du club', 'shield', 'Gestion'], NAV[NAV.length - 1]] : NAV; // (2.86) a responsable: no predictions game, no chrono in the menu
    const idx = nav.findIndex(n => n[0] === active);
    document.body.classList.toggle('nav-top', navPos() === 'haut');
    const rail = document.querySelector('.rail'), cur = nav[idx] || null;
    let tg = document.getElementById('navToggle');
    if (!tg) { tg = document.createElement('button'); tg.id = 'navToggle'; tg.className = 'nav-toggle'; tg.setAttribute('aria-label', 'Menu'); rail.insertBefore(tg, document.getElementById('nav')); }
    tg.innerHTML = `${cur ? I[cur[2]] : I.layers}<span>${UI.esc(cur ? cur[3] || cur[1] : 'Menu')}</span><span aria-hidden="true">▾</span>`;
    rail.classList.remove('open');
    document.getElementById('nav').innerHTML = nav.map(([h, l, ic, short], i) =>
      `<a href="#/${h}" class="${h === active ? 'on' : ''} ${i >= PHONE_MAIN ? 'more' : ''} ${i >= DESK_MAIN ? 'more-d' : ''}" ${h === active ? 'aria-current="page"' : ''} aria-label="${l}">${I[ic]}<span class="lg">${l}</span><span class="sh">${short || l}</span></a>`).join('')
      + `<button class="nav-more ${idx >= mainN() ? 'on' : ''}" id="navMore" aria-label="Plus de pages">${I.layers}<span class="sh">Plus</span></button>`;
    document.getElementById('navMore').onclick = () => {
      const close = UI.modal({ title: 'Plus', noFocus: true,
        body: MORE_GROUPS.map(([g, hs]) => { const items = nav.slice(mainN()).filter(n => hs.includes(n[0])); const help = hs.includes('reglages') ? `<button class="more-item" data-morenews>🎉<span>Nouveautés</span></button><button class="more-item" data-morehelp>${I.help}<span>Aide · signaler</span></button><button class="more-item" data-moreupd>🔄<span>Mettre à jour l'appli</span></button>` : ''; return items.length || help ? `<h3 class="more-h">${g}</h3><div class="more-grid">${items.map(([h, l, ic]) => `<a class="more-item ${h === active ? 'on' : ''}" href="#/${h}">${I[ic]}<span>${l}</span></a>`).join('')}${help}</div>` : ''; }).join('') + (Auth.isDev() ? `<h3 class="more-h">🧑‍💻 Développeur</h3><div class="more-grid"><button class="more-item" data-morediag>📏<span>Mesurer l'écran</span></button><button class="more-item" data-moredev="diag">🩺<span>Diagnostic</span></button><a class="more-item" href="${AppCfg.fixed ? "https://enzo2122-lgtm.github.io/ea-club-manager/demo/foot/" : "demo/foot/"}" target="_blank" rel="noopener">🧪<span>Club d'essai</span></a>${AppCfg.fixed ? '' : '<a class="more-item" href="#/proprietaire">🗝️<span>Espace propriétaire</span></a>'}<a class="more-item" href="tools/verif.html" target="_blank" rel="noopener">✅<span>Vérificateur</span></a><a class="more-item" href="#/journal">📜<span>Journal</span></a></div>` : ''),
        onOpen: r => { r.querySelectorAll('a').forEach(a => a.addEventListener('click', () => close())); const h = r.querySelector('[data-morehelp]'); if (h) h.onclick = () => { close(); setTimeout(() => Help.open(), 60); }; const nw = r.querySelector('[data-morenews]'); if (nw) nw.onclick = () => { close(); setTimeout(() => News.all(), 60); };
          const up = r.querySelector('[data-moreupd]'); if (up) up.onclick = () => { close(); checkUpdate(true); }; const dg = r.querySelector('[data-morediag]'); if (dg) dg.onclick = () => { close(); setTimeout(() => window.ScreenDiag && window.ScreenDiag(), 350); }; const dd = r.querySelector('[data-moredev="diag"]'); if (dd) dd.onclick = () => { close(); setTimeout(() => devDiag(), 300); }; } }); // (1.67) the latest version in one tap
    };
    Messages.badge(); Help.inboxBadge();
  }
  // keep = true: same page redrawn with new data from the server, stay where the user was in the page
  function route(keep) {
    keep = keep === true;
    const sy = window.scrollY, st = view().scrollTop;
    const [, name = '', id, sub] = (location.hash || '#/').split('/');
    const root = view();
    root.onclick = root.oninput = root.onchange = null;
    Editor.close();
    if (name !== 'messages') Messages.leave();
    if (name !== 'analyse') Analyse.leave();
    if (name === 'connexion') { history.replaceState(null, '', '#/'); route(); return Auth.connectServer(); }
    const pvw = Auth.preview();
    if (pvw && pvw.role === 'benevole' && !['benevoles', 'club'].includes(name)) { location.hash = '#/benevoles'; return; }
    if (!Auth.pageOk(name)) { location.hash = '#/equipements'; return; } // (2.66) intendance: its pages only
    document.body.dataset.page = name;
    const full = name === 'schema' || name === 'tableau';
    document.body.classList.toggle('editing', full);
    const navKey = { niveau: 'equipes', urgences: 'equipes', autorisations: 'equipes', equipements: Auth.limited() === 'kit' ? 'equipements' : 'equipes', equipe: 'equipes', joueurs: 'equipes', joueur: 'equipes', dirigeants: 'equipes', licences: 'gestion', journal: 'gestion', president: 'gestion', codes: 'gestion', encadrement: 'planning', vestiaires: 'planning', analyse: 'bibliotheque', briefing: 'bibliotheque', prepa: 'matchs', direct: 'matchs', jourj: 'matchs', infirmerie: 'equipes', progression: 'equipes', exercices: 'entrainements', benevoles: 'club', arbitres: 'club', systemes: 'entrainements', bilan: 'stats', resultats: 'stats', tests: 'equipes', schema: 'schemas', tableau: 'schemas', entrainement: 'entrainements', match: 'matchs' }[name] || name;
    renderNav(navKey);
    Quick.fab();
    // Whiteboard: a blank board, never saved (id = format of the pitch)
    if (name === 'tableau') { Help.button(); return Editor.open(root, Templates.blank(id || '11'), { scratch: true }); }
    if (full) {
      const sc = Store.get('schemas', id);
      if (!sc) { location.hash = '#/schemas'; return; }
      Help.button(); return Editor.open(root, sc);
    }
    const fn = { '': Views.home, equipes: Views.teams, equipe: Views.team, schemas: Views.schemas, entrainements: Views.trainings, entrainement: Views.training,
      matchs: Views.matches, match: Views.match, stats: Views.stats, reglages: Views.settings,
      planning: r => Planning.page(r), jeu: r => Views.game(r), chat: (r, x) => Views.chat(r, x), resultats: r => Results.page(r), club: (r, x) => ClubLife.page(r, x), messages: (r, x) => Messages.page(r, x), signalements: r => Help.inbox(r),
      bibliotheque: r => Library.page(r), joueurs: r => People.listPage(r, 'player'), dirigeants: r => People.listPage(r, 'staff'),
      joueur: (r, x) => People.playerPage(r, x), president: r => President.page(r), licences: r => ClubAdmin.licencesPage(r), journal: r => Journal.page(r), encadrement: r => ClubAdmin.staffingPage(r), vestiaires: r => Rooms.page(r),
      tests: (r, x) => Tests.page(r, x), athle: (r, x) => Athle.page(r, x), equilibre: (r, x) => Balance.page(r, x), niveau: (r, x) => Level.page(r, x), terrain: (r, x) => Terrain.page(r, x), urgences: (r, x) => Urgent.page(r, x), equipements: (r, x) => Kit.page(r, x), autorisations: (r, x) => Consent.page(r, x), bilan: (r, x) => Season.page(r, x), benevoles: r => Vol.page(r), arbitres: r => Refs.page(r), systemes: r => SesLib.page(r), gestion: r => Gestion.page(r), exercices: r => Exos.page(r), infirmerie: r => Health.page(r), progression: (r, x) => Progress.page(r, x), prepa: (r, x) => Prepa.page(r, x, sub), direct: (r, x) => Live.page(r, x), jourj: (r, x) => Quick.matchDay(r, x), analyse: (r, x) => Analyse.page(r, x), briefing: (r, x) => Analyse.briefingPage(r, x), codes: (r, x) => Codes.page(r, x), proprietaire: r => Owner.page(r) }[name] || Views.home;
    if (!keep) Help.visit();
    fn(root, id);
    Help.guideInto(root);
    if (keep) { root.scrollTop = st; window.scrollTo(0, sy); } else { releaseHeight(); root.scrollTop = 0; window.scrollTo(0, 0); enter(root); }
    Help.button();
  }
  /* A new page slides in, its blocks one after the other (only when changing page: a page redrawn with new data
     from the server stays still). The club's crest turns round when touched. */
  let enterT = null;
  function enter(root) {
    root.classList.remove('page-enter'); void root.offsetWidth; root.classList.add('page-enter');
    clearTimeout(enterT); enterT = setTimeout(() => root.classList.remove('page-enter'), 1200);
  }
  document.addEventListener('click', e => {
    const c = e.target.closest && e.target.closest('.crest-live'); if (!c) return;
    c.classList.remove('spin'); void c.offsetWidth; c.classList.add('spin');
    setTimeout(() => c.classList.remove('spin'), 1000);
  });
  /* A page redrawn in place (a tap, or new data from the server) is first shorter than before: photos, documents, weather,
     parents' answers or pitch slots arrive a moment later. On a phone scrolled down, the page then jumped up.
     So while a page is redrawn, it keeps at least its previous height for a moment. */
  let holdT = null;
  function releaseHeight() { clearTimeout(holdT); view().style.minHeight = ''; }
  (function holdHeight() {
    const el = view(), d = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    Object.defineProperty(el, 'innerHTML', { configurable: true, get() { return d.get.call(this); }, set(v) {
      if (!document.body.classList.contains('editing') && this.childElementCount) {
        this.style.minHeight = Math.max(parseFloat(this.style.minHeight) || 0, this.offsetHeight) + 'px';
        clearTimeout(holdT); holdT = setTimeout(releaseHeight, 1800);
      } else releaseHeight();
      d.set.call(this, v);
      if (typeof Help !== 'undefined') Help.guideInto(this);
    } });
  })();
  /* Updates: version.json on the site says which build is online. When it is newer than this one,
     the app empties its offline copy and reloads (an iPhone can keep an old copy open for days). */
  const BUILD = 215, UPD = AppCfg.key('update-tried');
  async function onlineBuild() {
    const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
    return (await r.json()).build || 0;
  }
  async function forceUpdate() {
    // with notifications on, the service worker is updated rather than removed (removing it would cancel the notifications)
    // (3.75) …and the new one is waited for (8 s at most) before reloading: reloading in the middle left a blank page on iPhone
    let kept = false;
    try { const regs = await navigator.serviceWorker.getRegistrations(), keep = Store.state && Store.state.ui && Store.state.ui.notifOn;
      await Promise.all(regs.map(async r => {
        if (!keep) return r.unregister();
        kept = true;
        await r.update().catch(() => {});
        const w = r.installing || r.waiting;
        if (w) await new Promise(ok => { const to = setTimeout(ok, 8000); w.addEventListener('statechange', () => { if (w.state === 'activated' || w.state === 'redundant') { clearTimeout(to); ok(); } }); });
      })); } catch (e) {}
    if (!kept) { try { const keys = await caches.keys(); await Promise.all(keys.map(k => caches.delete(k))); } catch (e) {} }
    try { Store.persistNow(); } catch (e) {}
    setTimeout(() => location.reload(), 250); // the page going away closes the database (pagehide)
  }
  async function checkUpdate(manual) {
    let online;
    try { online = await onlineBuild(); } catch (e) { if (manual) UI.toast('Pas de connexion internet : impossible de vérifier la version.', 'err'); return; }
    if (online > BUILD) {
      let tried = null; try { tried = sessionStorage.getItem(UPD); } catch (e) {}
      if (!manual && tried === String(online)) return; // already tried once: don't loop
      try { sessionStorage.setItem(UPD, String(online)); } catch (e) {}
      UI.busy('Mise à jour de l\'appli…'); return forceUpdate();
    }
    if (manual) { UI.busy('Rechargement de l\'appli…'); forceUpdate(); }
  }
  // (fusion) the app of one club: the club's settings (name, slogan, town, FFF page…) given by js/config.js when they are missing
  function fillDefaults() {
    if (!AppCfg.fixed || !Auth.isAdmin()) return false;
    const c = Store.state.club, d = AppCfg.defaults; let n = 0;
    Object.keys(d).forEach(k => { if (c[k] == null || c[k] === '') { c[k] = d[k]; n++; } });
    if (n) { Store.save(); refreshChrome(); }
    return n > 0;
  }
  async function start() {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(() => {});
      // a notification touched while the app is open: go to its page
      navigator.serviceWorker.addEventListener('message', e => { const u = e.data && e.data.raincyOpen; if (u) { const h = u.slice(u.indexOf('#')); if (h.startsWith('#/')) location.hash = h; } });
      // (1.98) the app open: its notifications are read (the number on the icon goes down)
      const seen = () => { try { const c = navigator.serviceWorker.controller; if (c) c.postMessage({ raincySeen: '#/' }); } catch (e) {} };
      navigator.serviceWorker.ready.then(seen).catch(() => {}); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') seen(); });
    }
    if (location.protocol !== 'file:') { checkUpdate(); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkUpdate(); }); }
    try { await Store.load(); }
    catch (e) { document.getElementById('app-stuck') || document.body.insertAdjacentHTML('beforeend', `<div id="app-stuck" style="position:fixed;inset:0;z-index:300;display:flex;align-items:center;justify-content:center;padding:16px;background:#f2f0ee"><div style="max-width:380px;text-align:center;font:16px system-ui;color:#14172b"><p><b>L'appli n'a pas pu s'ouvrir.</b><br>Tes données sont toujours sur le téléphone.</p><button style="font:inherit;padding:12px 18px;border-radius:12px;border:0;background:#8c1024;color:#fff" onclick="location.reload()">Recharger</button></div></div>`); return; }
    window.__appStarted = true; // the data are read: the safety net of index.html is not needed
    Sport.apply();
    // the owner's space of Clubbo: no club account needed (the owner key is asked on the page)
    if (!AppCfg.fixed && /^#\/proprietaire/.test(location.hash)) { refreshChrome(); window.addEventListener('hashchange', route); route(); return; }
    // Invitation link sent by the responsable: …#rejoindre=CODE
    const join = (location.hash.match(/^#rejoindre=([A-Za-z0-9]+)/) || [])[1];
    // (3.74) a session received as a link: …#/recevoir/CODE
    const recv = (location.hash.match(/^#\/recevoir\/([\w-]+)/) || [])[1];
    // (1.39) opened by the « AssistCoachAI / Footclubs → app » bookmark: the data arrive from the site
    const fromSite = /^#\/recevoir-source/.test(location.hash);
    const fcData = (location.hash.match(/^#\/recevoir-source\/((?:fc|ac)=.+)$/) || [])[1]; // (1.85) the Footclubs data in the address; (2.10) AssistCoachAI's too
    if (fromSite) history.replaceState(null, '', location.pathname + location.search + '#/');
    if (recv) history.replaceState(null, '', location.pathname + location.search + '#/entrainements');
    const iosTab = /iPhone|iPad|iPod/.test(navigator.userAgent) && !(matchMedia('(display-mode: standalone)').matches || navigator.standalone);
    if (recv && iosTab && !Auth.current()) await Views.linkGate(recv);
    const who = (location.hash.match(/[#&]qui=([\w-]+)/) || [])[1];
    if (join) { Auth.setInvite(join, who); history.replaceState(null, '', location.pathname + location.search); }
    refreshChrome();
    await Auth.gate({ joined: !!join });
    try { await Board.preloadBackgrounds(Store.state.schemas); } catch (e) {}
    window.addEventListener('hashchange', route);
    route();
    if (recv) Views.receiveLink(recv);
    else if (fromSite) Sources.receive(fcData);
    else if (Auth.current()) News.check(); // after an update: « Quoi de neuf ? »
    Sync.start();
    // After the first exchange with the server: categories U6 … Vétérans for the new season
    Promise.resolve(Sync.run()).catch(() => {}).then(() => {
      let redraw = fillDefaults() || People.autoCategories();
      // once, on a responsable's device: imported matches go to team A / B from the District team number
      const c = Store.state.club;
      if (Auth.isAdmin() && !c.matchTeamsV1) { if (Importer.reassignImported()) redraw = true; c.matchTeamsV1 = 1; Store.save(); }
      // (3.11) « RAINCY F.A. 2 » was read as team 1, and « U14 D4 - U15 - U14 » as U15: imported matches are put back in their team, once
      if (Auth.isAdmin() && !c.matchTeamsV2) { const n = Importer.refileImported(); c.matchTeamsV2 = 1; Store.save(); if (n) { redraw = true; UI.toast(`${n} match${n > 1 ? 's' : ''} importé${n > 1 ? 's' : ''} rangé${n > 1 ? 's' : ''} dans la bonne équipe (A / B, U14 / U15)`); } }
      if (redraw) route(true);
      // (1.51) results, tables and calendar from the FFF, by themselves (at most every 3 hours, after the server's data)
      Sources.autoFFF().catch(() => {});
    });
    Messages.start();
    Quick.start();
    Notify.refresh(); // the phone's subscription to the notifications, sent again at each start
  }
  return { start, route, refreshChrome, checkUpdate, navPos, setNavPos };
})();
App.start();
