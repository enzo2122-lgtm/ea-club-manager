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
  };
})();
