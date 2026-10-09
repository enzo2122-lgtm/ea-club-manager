/* AppCfg: which app this is. The same code makes Clubbo (every club) and the app of one club (js/config.js « club »,
   e.g. FA Le Raincy). From js/config.js: the app's name, the names of its memory on the phone (so a club's app keeps the data
   its phones already have), its default crest, and the club settings filled once when they are missing (« defaults »).
   Loaded first (app, family pages and service worker). */
const AppCfg = (() => {
  const c = typeof CLUB_SERVER !== 'undefined' && CLUB_SERVER ? CLUB_SERVER : {};
  const pre = c.store || 'ea';
  return {
    name: c.app || 'Clubbo',            // shown to the users (title, login screen, notifications…)
    club: c.club || '',                 // the code of the club on the Clubbo server, for the app of one club
    fixed: !!c.club,                    // one club: no club code to type, no « Créer mon club », no demo, no owner's space
    db: c.db || 'ea-club-manager',      // the database of the app on the phone
    key: s => pre + '-' + s,            // the other names of its memory on the phone (« ea-msgs », « raincy-msgs »…)
    crest: c.crest || 'icons/ea-logo.png',
    defaults: c.defaults || {},
    demo: c.club ? '' : (c.demo || ''), // (1.46) a demo page of one sport (demo/<sport>/, made by build.js): opens straight on its demo club
    // (2.07) the families' space (parents' page, parents' chat): U15 and younger only. Not for U16 and over, Seniors, Vétérans, Loisirs.
    family: cat => !/(s[eé]nior|v[eé]t[eé]ran|cadet|junior|loisir|(?<![a-z])u[ -]?(1[6-9]|[2-9]\d)(?!\d))/i.test(String(cat || '')),
  };
})();

/* (2.38 → removed in 2.48: hiding and showing the page to make iOS measure again made the screen flash; the gap is handled by iosFill) */

/* (2.41) « 📏 Mesurer l'écran » (Plus): the sizes the phone gives to the app, and marks to see what the phone draws at the bottom.
   A red line at the bottom of the page as iOS sees it (fixed), a green block just below it (in the page): a screenshot tells where the band comes from. */
window.ScreenDiag = function () {
  const old = document.getElementById('scrDiag'); if (old) { old.remove(); document.querySelectorAll('.scr-mark').forEach(e => e.remove()); return; }
  const probe = css => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:0;top:0;width:1px;visibility:hidden;pointer-events:none;' + css; document.body.appendChild(d); const h = d.offsetHeight; d.remove(); return h; };
  const vv = window.visualViewport, ms = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  const rail = document.querySelector('.rail, .tabbar'), rr = rail ? rail.getBoundingClientRect() : null;
  const rows = [
    ['Écran', screen.width + ' × ' + screen.height], ['Fenêtre (innerHeight)', innerWidth + ' × ' + innerHeight],
    ['Page (clientHeight)', document.documentElement.clientHeight], ['Zone visible', vv ? Math.round(vv.width) + ' × ' + Math.round(vv.height) + ' (décalage ' + Math.round(vv.offsetTop) + ')' : '—'],
    ['Écart écran − fenêtre', screen.height - innerHeight], ['Encoche haut / bas', probe('height:env(safe-area-inset-top)') + ' / ' + probe('height:env(safe-area-inset-bottom)')],
    ['100vh / 100dvh / 100lvh / 100svh', [probe('height:100vh'), probe('height:100dvh'), probe('height:100lvh'), probe('height:100svh')].join(' / ')],
    ['Défilement', Math.round(scrollX) + ', ' + Math.round(scrollY)], ['Barre du bas', rr ? Math.round(rr.top) + ' → ' + Math.round(rr.bottom) : '—'],
    ['Appli installée', (navigator.standalone === true || matchMedia('(display-mode: standalone)').matches) ? 'oui' : 'non'], ['Barre d\'état', ms ? ms.content : '—'],
    ['iOS', (navigator.userAgent.match(/OS (\d+[_\d]*)/) || [, '?'])[1].replace(/_/g, '.')],
    ['Version de l\'appli', (typeof Help !== 'undefined' && Help.VERSION) || (document.querySelector('script[src*="appcfg.js?v="]') || { src: '' }).src.split('v=')[1] || '?'],
    ['Correction de la bande', (() => { const f = document.getElementById('iosFill'); if (!f) return 'absente'; const r = f.getBoundingClientRect(); return (document.documentElement.classList.contains('ios-gap') ? 'active' : 'inactive') + ' · ' + Math.round(r.top) + ' → ' + Math.round(r.bottom); })()]];
  const box = document.createElement('div'); box.id = 'scrDiag';
  box.style.cssText = 'position:fixed;left:10px;right:10px;top:calc(env(safe-area-inset-top) + 10px);z-index:99999;background:#111827;color:#fff;border-radius:14px;padding:12px 14px;font:13px/1.45 system-ui;box-shadow:0 10px 30px rgba(0,0,0,.4)';
  box.innerHTML = '<b style="font-size:15px">📏 Mesures de l\'écran</b><div style="margin:6px 0 8px;opacity:.8">Fais une capture d\'écran et envoie-la. Ligne rouge = bas de la page pour iOS ; bloc vert = juste en dessous. Touche ce cadre pour fermer.</div>'
    + rows.map(r => '<div style="display:flex;justify-content:space-between;gap:10px;border-top:1px solid rgba(255,255,255,.12);padding:3px 0"><span style="opacity:.75">' + r[0] + '</span><b>' + r[1] + '</b></div>').join('');
  box.onclick = () => window.ScreenDiag();
  const red = document.createElement('div'); red.className = 'scr-mark'; red.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:6px;background:#ef4444;z-index:99998;pointer-events:none';
  const green = document.createElement('div'); green.className = 'scr-mark'; green.style.cssText = 'position:absolute;left:0;width:30%;height:140px;background:repeating-linear-gradient(45deg,#16a34a 0 14px,#22c55e 14px 28px);z-index:99998;pointer-events:none;top:' + (scrollY + innerHeight) + 'px';
  const blue = document.createElement('div'); blue.className = 'scr-mark'; blue.style.cssText = 'position:fixed;left:0;width:40%;top:0;height:100lvh;border-right:6px solid #3b82f6;z-index:99997;pointer-events:none';
  document.body.append(box, red, green, blue);
};

/* (2.45) iPhone, app installed (iOS 18): the page is given the screen minus the status bar (innerHeight 894 on a 956 screen) while it
   is drawn from the top: the bars fixed at the bottom are cut at 894, and the last 62 px show the page under them (the « white band »).
   What is in the page itself is drawn there (not what is fixed): a strip of the colour of the bottom bar, glued to the bottom of the
   screen (« sticky », in the page), carries the bar down to the edge. Measured on the phone: nothing changes where there is no gap. */
/* (2.70) iOS 26/27, app installed: the height iOS gives the page (innerHeight, 100dvh, 100lvh…) does not match what is drawn on the
   screen, and it changes with the keyboard and the pages. The only reliable thing is the visual viewport (what is really visible):
   the bottom bars are moved so that their bottom edge is the bottom of the visible area. Checked on every change and twice a second. */
function placeBars() {
  const vv = window.visualViewport; if (!vv) return;
  const place = () => {
    const dy = Math.round(vv.height + vv.offsetTop - innerHeight), t = dy ? 'translateY(' + dy + 'px)' : '';
    document.querySelectorAll('.rail, .tabbar').forEach(b => { const cs = getComputedStyle(b); if (cs.position !== 'fixed' || cs.display === 'none' || cs.bottom !== '0px') return; if (b.style.transform !== t) b.style.transform = t; });
  };
  ['resize', 'scroll'].forEach(e => vv.addEventListener(e, place));
  ['resize', 'orientationchange', 'pageshow', 'hashchange', 'focusout'].forEach(e => window.addEventListener(e, place));
  setInterval(place, 500);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', place); else place();
}
(function iosFill() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const ios = /iP(hone|od|ad)/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  if (!(ios && standalone) && !window.__iosFillTest) return;
  // (2.69) the installed app on iOS: the bottom bars are placed from the real height of the screen (100lvh), not from the height iOS
  // announces (it flips between the screen and the screen minus the status bar, without warning): css rule « html.ios-app » in
  // app.css and member.js. The strip of 2.45 is no longer needed and it covered the bar at times: off (kept for the test page).
  if (ios && standalone) { const on = () => document.documentElement.classList.add('ios-app'); on(); document.addEventListener('DOMContentLoaded', on); placeBars(); }
  // (2.71) the strip is back (under the bars, remeasured every second): the only thing that can paint the band iOS draws under the page
  const st = document.createElement('style'); st.id = 'iosFillCss';
  st.textContent = 'html.ios-gap body{min-height:100lvh}#iosFill{display:none}'
    + 'html.ios-gap #iosFill{display:block;position:sticky;bottom:calc(-1 * var(--iosgap,0px));height:var(--iosgap,0px);margin-top:calc(-1 * var(--iosgap,0px));z-index:1;pointer-events:none;background:var(--iosfill,#0e1d45)}'
    + '@media (max-width:760px){html.ios-gap body:not(.nav-top):not(.editing) .rail{padding-bottom:12px}}html.ios-gap body:not(.tabs-top) .tabbar{padding-bottom:12px}';
  const typing = () => { const a = document.activeElement; return !!a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable); };
  const probe = css => { const d = document.createElement('div'); d.style.cssText = 'position:absolute;left:0;top:0;width:1px;visibility:hidden;pointer-events:none;' + css; document.documentElement.appendChild(d); const h = d.offsetHeight; d.remove(); return h; };
  let fill = null, last = -1;
  const color = () => {
    if (!fill) return;
    const bar = [...document.querySelectorAll('.rail, .tabbar')].find(b => { const r = b.getBoundingClientRect(); return r.height && r.bottom >= innerHeight - 2 && getComputedStyle(b).display !== 'none'; });
    const c = bar ? getComputedStyle(bar).backgroundColor : getComputedStyle(document.body).backgroundColor;
    document.documentElement.style.setProperty('--iosfill', c && c !== 'rgba(0, 0, 0, 0)' ? c : '#0e1d45');
  };
  const measure = () => {
    if (!document.body) return;
    if (!document.head.contains(st)) document.head.appendChild(st);
    if (!fill) { fill = document.createElement('div'); fill.id = 'iosFill'; fill.setAttribute('aria-hidden', 'true'); }
    if (document.body.lastElementChild !== fill) document.body.appendChild(fill);
    if (!typing() && innerHeight > innerWidth) {
      const g = window.__iosFillTest || Math.round(probe('height:100lvh') - innerHeight), v = g > 0 && g <= 120 ? g : 0;
      if (v !== last) { last = v; document.documentElement.style.setProperty('--iosgap', v + 'px'); document.documentElement.classList.toggle('ios-gap', v > 0); }
    }
    // (2.49) a short page (the chat: everything is fixed): the strip would sit right after the content, high on the screen — it is pushed
    // down to the bottom of the screen (« sticky » only pulls up, never down)
    if (last > 0) {
      const ps = fill.style.position; fill.style.position = 'static'; fill.style.marginTop = '0px';
      const end = fill.getBoundingClientRect().top + scrollY; fill.style.position = ps;
      fill.style.marginTop = Math.max(-last, Math.round(innerHeight - end)) + 'px';
    } else fill.style.marginTop = '';
    color();
  };
  let t = 0; const soon = d => { clearTimeout(t); t = setTimeout(measure, d == null ? 200 : d); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => soon(0)); else soon(0);
  ['resize', 'orientationchange', 'pageshow', 'hashchange', 'focusout'].forEach(e => window.addEventListener(e, () => soon()));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) soon(); });
  // the bar can go (editing a schema, typing in the chat) or change: the strip follows its colour; something added after it: it goes back last
  const watch = () => { if (!document.body) return setTimeout(watch, 50); new MutationObserver(() => soon(60)).observe(document.body, { attributes: true, attributeFilter: ['class'], childList: true });
    if (window.ResizeObserver) new ResizeObserver(() => soon(120)).observe(document.body); };
  watch();
  // (2.68) iOS 18 flips innerHeight between 894 and 956 without always firing an event (after the keyboard, a change of page):
  // measured again every second, and the strip stays UNDER the bars (z-index 1) — it used to cover the players' tab bar
  let seenH = 0; setInterval(() => { if (innerHeight !== seenH) { seenH = innerHeight; soon(0); } }, 1000);
})();

/* (2.65) The « back » button of the phone (Android, the app from the Play Store) closes the window open on top
   (a window of the app, a sheet, the video, the photo…) instead of leaving the page or the app.
   When such a window opens, one step is added to the history (same address); « back » takes it away and closes the window.
   The window closed by its own button: the step stays, and the next « back » goes on by itself to the page before. */
(() => {
  const SEL = '#modal:not([hidden]), #psOverlay, .rs-back, .tf-view, .cx-view, .sh-back, .vp-back';
  const CLOSERS = '[data-close], [data-x], [data-vpx], [data-tfclose], [data-ps="close"]';
  let onGuard = false, guardHref = '';
  const top = () => { const l = document.querySelectorAll(SEL); return l[l.length - 1] || null; };
  const arm = () => {
    if (onGuard || !top()) return;
    try { history.pushState(Object.assign({}, history.state || {}, { bg: 1 }), '', location.href); onGuard = true; guardHref = location.href; } catch (e) {}
  };
  addEventListener('popstate', () => {
    const was = onGuard; onGuard = !!(history.state && history.state.bg);
    if (!was || onGuard || location.href !== guardHref) return; // not « back » from our step (a page change by the app, for example)
    const t = top();
    if (t) { const c = t.querySelector(CLOSERS); (c && c.offsetParent !== null ? c : t).click(); return; }
    history.back();
  });
  const watch = () => {
    if (!document.body) return setTimeout(watch, 50);
    const mo = new MutationObserver(() => { if (!onGuard && top()) arm(); });
    mo.observe(document.body, { childList: true });
    const m = document.getElementById('modal'); if (m) mo.observe(m, { attributes: true, attributeFilter: ['hidden'] });
  };
  watch();
})();
