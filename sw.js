/* Service worker: keeps the app working without internet. Bump VERSION after each update. */
const VERSION = 'ea-club-manager-v21';
const JSPDF = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js';
const FILES = [
  './', 'index.html', 'app.css', 'manifest.webmanifest',
  'js/config.js', 'js/sport.js', 'js/codes.js', 'js/imports.js', 'js/onboard.js', 'js/owner.js', 'js/icons.js', 'js/board.js', 'js/store.js', 'js/ui.js', 'js/clubs.js', 'js/exporter.js', 'js/auth.js', 'js/media.js', 'js/ratings.js', 'js/library.js', 'js/importer.js', 'js/help.js', 'js/cloud.js', 'js/sync.js', 'js/planning.js', 'js/results.js', 'js/messages.js', 'js/people.js', 'js/templates.js', 'js/autoschema.js', 'js/editor.js', 'js/clublife.js', 'js/weather.js', 'js/notify.js', 'js/supporters.js', 'js/vestiaires.js', 'js/prepa.js', 'js/live.js', 'js/health.js', 'js/progress.js', 'js/sport-exos.js', 'js/exos.js', 'js/sessions-foot.js', 'js/sessions-sports.js', 'js/seslib.js', 'js/volunteers.js', 'js/referees.js', 'js/perso.js', 'js/roles.js', 'js/gestion.js', 'js/season.js', 'js/tests.js', 'js/acimport.js', 'js/telestrator.js', 'js/analyse.js', 'js/clubadmin.js', 'js/parents.js', 'js/president.js', 'js/quick.js', 'js/demo.js', 'decouvrir.html', 'js/views.js', 'js/app.js',
  'icons/ea-logo.png', 'icons/ea-logo.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES).then(() => c.add(new Request(JSPDF, { mode: 'cors' })).catch(() => {}))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // PDF libraries come from a CDN with fixed versions: cache first, so they also work offline
  if (e.request.url.startsWith('https://cdn.jsdelivr.net/npm/')) {
    e.respondWith(caches.match(e.request.url).then(r => r || fetch(e.request).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request.url, copy)); return res; })));
    return;
  }
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || url.pathname.endsWith('/version.json')) return;
  // App files: network first so updates arrive when online; cache when offline
  // (3.63) a weak network at the stadium: after 3.5 s without an answer, the copy kept on the phone is used (the network still updates it)
  const net = fetch(e.request, { cache: 'no-cache' }).then(res => {
    const copy = res.clone();
    caches.open(VERSION).then(c => c.put(e.request, copy));
    return res;
  });
  const cached = () => caches.match(e.request, { ignoreSearch: true });
  e.respondWith(new Promise(resolve => {
    let done = false;
    const give = r => { if (!done && r) { done = true; resolve(r); } };
    const t = setTimeout(() => cached().then(give), 3500);
    net.then(r => { clearTimeout(t); give(r); }).catch(() => { clearTimeout(t); cached().then(r => give(r || caches.match('index.html'))); });
  }));
});

/* ---------- notifications (3.15) ----------
   The club server wakes the phone with an empty push; the phone then reads its notifications on the club server
   with the dirigeant's login (kept in the app's local database) and shows them. */
try { importScripts('js/config.js'); } catch (e) {}
function session() {
  return new Promise(res => {
    try {
      const rq = indexedDB.open('ea-club-manager', 1);
      rq.onerror = () => res(null);
      rq.onsuccess = () => { try { const g = rq.result.transaction('kv').objectStore('kv').get('state'); g.onsuccess = () => { const s = g.result; res(s && s.auth && s.auth.session); }; g.onerror = () => res(null); } catch (e) { res(null); } };
    } catch (e) { res(null); }
  });
}
async function pending() {
  const s = await session(), c = typeof CLUB_SERVER !== 'undefined' ? CLUB_SERVER : null;
  if (!s || !s.token || !c) return [];
  const headers = { apikey: c.key, 'Content-Type': 'application/json' };
  if (!String(c.key).startsWith('sb_')) headers.Authorization = 'Bearer ' + c.key;
  const r = await fetch(c.url.replace(/\/+$/, '') + '/rest/v1/rpc/club_notifs', { method: 'POST', headers, body: JSON.stringify({ k: s.token }) });
  return r.ok ? (await r.json()) || [] : [];
}
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let list = [];
    try { list = await pending(); } catch (err) {}
    // a phone must always show something when it is woken up
    if (!list.length) list = [{ title: 'Clubbo', body: 'Nouvelle information du club', url: '#/', tag: 'raincy' }];
    for (const n of list.slice(0, 4)) {
      await self.registration.showNotification(n.title || 'Clubbo', {
        body: (n.body || '') + (n.n > 1 ? ` (+${n.n - 1})` : ''), tag: n.tag || undefined, renotify: !!n.tag,
        icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: n.url || '#/' } });
    }
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL('./' + ((e.notification.data && e.notification.data.url) || '#/'), self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    const w = ws.find(x => x.url.startsWith(self.registration.scope));
    if (w) { w.postMessage({ raincyOpen: url }); return w.focus(); }
    return clients.openWindow(url);
  }));
});
