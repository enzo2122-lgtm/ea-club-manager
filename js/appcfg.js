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
