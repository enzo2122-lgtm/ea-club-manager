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

/* (2.36) iPhone, app installed on the home screen: iOS can make the page shorter than the screen by the height of the status bar
   (the page covers the whole screen, but « the bottom » of the page stops above the real edge). A bar fixed at the bottom then floats
   above a light band. The gap is measured on the phone and the bottom bars are moved down by it (--iosgap), to rest on the edge. */
(function iosGap() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const ios = /iP(hone|od|ad)/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  if (!ios || !standalone) return;
  const topInset = () => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:0;padding-top:env(safe-area-inset-top);visibility:hidden;pointer-events:none'; document.body.appendChild(d); const t = d.offsetHeight; d.remove(); return t; };
  const typing = () => { const a = document.activeElement; return !!a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable); };
  let last = -1;
  const measure = () => {
    if (!document.body || typing()) return;
    const portrait = window.innerHeight > window.innerWidth, screenH = Math.max(screen.height, screen.width), top = topInset();
    const gap = portrait ? Math.round(screenH - window.innerHeight) : 0;
    // only the case of the bug: a gap no bigger than the status bar (never a page that really starts under the status bar)
    const v = top > 0 && gap > 0 && gap <= top + 6 ? gap : 0;
    if (v !== last) { last = v; document.documentElement.style.setProperty('--iosgap', v + 'px'); document.documentElement.classList.toggle('ios-gap', v > 0); }
  };
  const soon = () => setTimeout(measure, 350);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', measure); else measure();
  ['resize', 'orientationchange', 'pageshow', 'focusout'].forEach(e => window.addEventListener(e, soon));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) soon(); });
})();
