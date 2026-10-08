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

(function iosViewport() {
  // (2.38) iPhone installed app: once the keyboard has been opened, iOS keeps the screen of the app shorter (bug of iOS),
  // a band stays under the tab bar. Hiding and showing the page for one instant makes iOS measure the screen again: the band goes.
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const ios = /iP(hone|od|ad)/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  if (!ios || !standalone) return;
  const typing = () => { const a = document.activeElement; return !!a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable); };
  const portrait = () => window.innerHeight > window.innerWidth;
  let peak = { p: 0, l: 0 }, t = 0;
  const note = () => { const k = portrait() ? 'p' : 'l'; if (!typing()) peak[k] = Math.max(peak[k], window.innerHeight); };
  const remeasure = () => {
    const b = document.body; if (!b || typing()) return;
    const k = portrait() ? 'p' : 'l'; if (peak[k] - window.innerHeight <= 4) return;
    // the places in the lists are kept (a hidden list forgets where it was)
    const keep = [...document.querySelectorAll('*')].filter(e => e.scrollTop > 0).map(e => [e, e.scrollTop]), x = window.scrollX, y = window.scrollY;
    b.style.display = 'none'; void b.offsetHeight; b.style.display = '';
    keep.forEach(([e, v]) => { e.scrollTop = v; }); window.scrollTo(x, y);
    window.dispatchEvent(new Event('resize'));
  };
  const soon = () => { clearTimeout(t); t = setTimeout(() => { remeasure(); setTimeout(remeasure, 450); }, 160); };
  note(); window.addEventListener('resize', note); window.addEventListener('orientationchange', () => { peak = { p: 0, l: 0 }; setTimeout(note, 500); });
  document.addEventListener('focusout', soon);
  window.addEventListener('pageshow', soon);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) soon(); });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', () => { if (!typing()) soon(); });
})();

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
    ['iOS', (navigator.userAgent.match(/OS (\d+[_\d]*)/) || [, '?'])[1].replace(/_/g, '.')]];
  const box = document.createElement('div'); box.id = 'scrDiag';
  box.style.cssText = 'position:fixed;left:10px;right:10px;top:calc(env(safe-area-inset-top) + 10px);z-index:99999;background:#111827;color:#fff;border-radius:14px;padding:12px 14px;font:13px/1.45 system-ui;box-shadow:0 10px 30px rgba(0,0,0,.4)';
  box.innerHTML = '<b style="font-size:15px">📏 Mesures de l\'écran</b><div style="margin:6px 0 8px;opacity:.8">Fais une capture d\'écran et envoie-la. Ligne rouge = bas de la page pour iOS ; bloc vert = juste en dessous. Touche ce cadre pour fermer.</div>'
    + rows.map(r => '<div style="display:flex;justify-content:space-between;gap:10px;border-top:1px solid rgba(255,255,255,.12);padding:3px 0"><span style="opacity:.75">' + r[0] + '</span><b>' + r[1] + '</b></div>').join('');
  box.onclick = () => window.ScreenDiag();
  const red = document.createElement('div'); red.className = 'scr-mark'; red.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:6px;background:#ef4444;z-index:99998;pointer-events:none';
  const green = document.createElement('div'); green.className = 'scr-mark'; green.style.cssText = 'position:absolute;left:0;right:0;height:140px;background:repeating-linear-gradient(45deg,#16a34a 0 14px,#22c55e 14px 28px);z-index:99998;pointer-events:none;top:' + (scrollY + innerHeight) + 'px';
  const blue = document.createElement('div'); blue.className = 'scr-mark'; blue.style.cssText = 'position:fixed;left:0;width:40%;top:0;height:100lvh;border-right:6px solid #3b82f6;z-index:99997;pointer-events:none';
  document.body.append(box, red, green, blue);
};
