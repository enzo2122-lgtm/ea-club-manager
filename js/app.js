/* App shell: navigation, routing, service worker. */
const App = (() => {
  // [hash, label, icon, short label for phones]; the first five are always in the menu, the others in « Plus » (phone and computer)
  const NAV = [
    ['', 'Accueil', 'home'], ['entrainements', 'Séances', 'training'], ['matchs', 'Matchs', 'match'], ['equipes', 'Joueurs', 'team'], ['messages', 'Messages', 'chat'],
    ['planning', 'Planning', 'calendar'], ['club', 'Vie du club', 'pin', 'Club'], ['resultats', 'Résultats', 'medal'], ['schemas', 'Schémas', 'board'], ['bibliotheque', 'Bibliothèque', 'video', 'Biblio'], ['stats', 'Stats', 'stats'], ['reglages', 'Réglages', 'settings'],
  ];
  const PHONE_MAIN = 5;
  // (1.37) « Plus », by theme (a page not listed here goes in « Outils »)
  const MORE_GROUPS = [['Le club', ['planning', 'club', 'resultats', 'gestion', 'benevoles']], ['Outils du coach', ['schemas', 'bibliotheque', 'stats']], ['Réglages et aide', ['reglages']]];
  const view = () => document.getElementById('view');

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
  function renderNav(active) {
    // the responsables also have the club's dashboard (before Réglages)
    const pv = Auth.preview();
    // a volunteer: only what he uses on match days
    const nav = pv && pv.role === 'benevole' ? [['benevoles', 'Bénévoles', 'team'], NAV[6]]
      : Auth.isAdmin() ? [...NAV.slice(0, -1), ['gestion', 'Gestion du club', 'shield', 'Gestion'], NAV[NAV.length - 1]] : NAV;
    const idx = nav.findIndex(n => n[0] === active);
    document.getElementById('nav').innerHTML = nav.map(([h, l, ic, short], i) =>
      `<a href="#/${h}" class="${h === active ? 'on' : ''} ${i >= PHONE_MAIN ? 'more' : ''}" ${h === active ? 'aria-current="page"' : ''} aria-label="${l}">${I[ic]}<span class="lg">${l}</span><span class="sh">${short || l}</span></a>`).join('')
      + `<button class="nav-more ${idx >= PHONE_MAIN ? 'on' : ''}" id="navMore" aria-label="Plus de pages">${I.layers}<span class="sh">Plus</span></button>`;
    document.getElementById('navMore').onclick = () => {
      const close = UI.modal({ title: 'Plus', noFocus: true,
        body: MORE_GROUPS.map(([g, hs]) => { const items = nav.slice(PHONE_MAIN).filter(n => hs.includes(n[0])); const help = hs.includes('reglages') ? `<button class="more-item" data-morenews>🎉<span>Nouveautés</span></button><button class="more-item" data-morehelp>${I.help}<span>Aide · signaler</span></button>` : ''; return items.length || help ? `<h3 class="more-h">${g}</h3><div class="more-grid">${items.map(([h, l, ic]) => `<a class="more-item ${h === active ? 'on' : ''}" href="#/${h}">${I[ic]}<span>${l}</span></a>`).join('')}${help}</div>` : ''; }).join(''),
        onOpen: r => { r.querySelectorAll('a').forEach(a => a.addEventListener('click', () => close())); const h = r.querySelector('[data-morehelp]'); if (h) h.onclick = () => { close(); setTimeout(() => Help.open(), 60); }; const nw = r.querySelector('[data-morenews]'); if (nw) nw.onclick = () => { close(); setTimeout(() => News.all(), 60); }; } });
    };
    Messages.badge();
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
    document.body.dataset.page = name;
    const full = name === 'schema' || name === 'tableau';
    document.body.classList.toggle('editing', full);
    const navKey = { equipe: 'equipes', joueurs: 'equipes', joueur: 'equipes', dirigeants: 'equipes', licences: 'gestion', president: 'gestion', codes: 'gestion', encadrement: 'planning', vestiaires: 'planning', analyse: 'bibliotheque', briefing: 'bibliotheque', prepa: 'matchs', direct: 'matchs', jourj: 'matchs', infirmerie: 'equipes', progression: 'equipes', exercices: 'entrainements', benevoles: 'club', arbitres: 'club', systemes: 'entrainements', bilan: 'stats', tests: 'equipes', schema: 'schemas', tableau: 'schemas', entrainement: 'entrainements', match: 'matchs' }[name] || name;
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
      planning: r => Planning.page(r), resultats: r => Results.page(r), club: (r, x) => ClubLife.page(r, x), messages: (r, x) => Messages.page(r, x),
      bibliotheque: r => Library.page(r), joueurs: r => People.listPage(r, 'player'), dirigeants: r => People.listPage(r, 'staff'),
      joueur: (r, x) => People.playerPage(r, x), president: r => President.page(r), licences: r => ClubAdmin.licencesPage(r), encadrement: r => ClubAdmin.staffingPage(r), vestiaires: r => Rooms.page(r),
      tests: (r, x) => Tests.page(r, x), bilan: (r, x) => Season.page(r, x), benevoles: r => Vol.page(r), arbitres: r => Refs.page(r), systemes: r => SesLib.page(r), gestion: r => Gestion.page(r), exercices: r => Exos.page(r), infirmerie: r => Health.page(r), progression: (r, x) => Progress.page(r, x), prepa: (r, x) => Prepa.page(r, x, sub), direct: (r, x) => Live.page(r, x), jourj: (r, x) => Quick.matchDay(r, x), analyse: (r, x) => Analyse.page(r, x), briefing: (r, x) => Analyse.briefingPage(r, x), codes: (r, x) => Codes.page(r, x), proprietaire: r => Owner.page(r) }[name] || Views.home;
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
  const BUILD = 48, UPD = AppCfg.key('update-tried');
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
    else if (fromSite) Sources.receive();
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
    });
    Messages.start();
    Quick.start();
    Notify.refresh(); // the phone's subscription to the notifications, sent again at each start
  }
  return { start, route, refreshChrome, checkUpdate };
})();
App.start();
