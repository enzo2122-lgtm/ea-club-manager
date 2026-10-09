/* Service worker: keeps the app working without internet. Bump VERSION after each update. */
const VERSION = 'ea-club-manager-v175';
const JSPDF = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js';
const FILES = [
  './', 'index.html', 'app.css', 'manifest.webmanifest',
  'js/config.js', 'js/appcfg.js', 'js/app.bundle.js', 'confidentialite.html', 'moi.html', 'aide.html', 'js/helper.js', 'joueurs.html', 'parents.html', 'famille.webmanifest', 'famille.css', 'js/member.js', 'js/perso.js', 'js/players-page.js', 'js/game.js', 'js/chat.js', 'js/share.js', 'js/parents-page.js', 'js/vplayer.js', 'js/bodymap.js', 'js/injury.js', 'js/urgent.js', 'js/consent.js', 'js/i18n.js', 'js/lang-en.js', 'js/lang-es.js', 'js/lang-pt.js', 'js/absence.js', 'js/after.js', 'js/talks.js', 'img/corps-face.jpg', 'decouvrir.html',
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
      const rq = indexedDB.open((typeof CLUB_SERVER !== 'undefined' && CLUB_SERVER.db) || 'ea-club-manager', 1);
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
// (1.23) the owner's phone: the new requests of an activation code (this phone's subscription is its proof)
async function ownerNews() {
  const c = typeof CLUB_SERVER !== 'undefined' ? CLUB_SERVER : null, sub = await self.registration.pushManager.getSubscription();
  if (!c || !sub) return [];
  const headers = { apikey: c.key, 'Content-Type': 'application/json' };
  if (!String(c.key).startsWith('sb_')) headers.Authorization = 'Bearer ' + c.key;
  const r = await fetch(c.url.replace(/\/+$/, '') + '/rest/v1/rpc/ea_owner_news', { method: 'POST', headers, body: JSON.stringify({ p_endpoint: sub.endpoint }) });
  return r.ok ? (await r.json()) || [] : [];
}
// (3.68) the family's phone: the notifications of the players followed on it
async function memberNews() {
  const c = typeof CLUB_SERVER !== 'undefined' ? CLUB_SERVER : null, sub = await self.registration.pushManager.getSubscription();
  if (!c || !sub) return [];
  const headers = { apikey: c.key, 'Content-Type': 'application/json' };
  if (!String(c.key).startsWith('sb_')) headers.Authorization = 'Bearer ' + c.key;
  const r = await fetch(c.url.replace(/\/+$/, '') + '/rest/v1/rpc/member_news', { method: 'POST', headers, body: JSON.stringify({ p_endpoint: sub.endpoint }) });
  return r.ok ? (await r.json()) || [] : [];
}
// (1.98) like a messaging app: one notification per conversation (the same « tag » replaces the one before and counts the messages),
// and the number of unread news on the app's icon (iPhone: the app added to the home screen; Android: Chrome)
const SUM = list => list.reduce((a, n) => a + ((n.data && n.data.count) || 1), 0);
async function setBadge() {
  try { const all = await self.registration.getNotifications(); const n = SUM(all);
    if (self.navigator.setAppBadge) { if (n) await self.navigator.setAppBadge(n); else await self.navigator.clearAppBadge(); } } catch (e) {}
}
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let list = [];
    try { list = list.concat(await memberNews()); } catch (err) {}
    try { list = list.concat(await ownerNews()); } catch (err) {}
    try { list = list.concat(await pending()); } catch (err) {}
    // a phone must always show something when it is woken up
    if (!list.length) list = [{ title: (typeof CLUB_SERVER !== 'undefined' && CLUB_SERVER.app) || 'Clubbo', body: 'Nouvelle information du club', url: '#/', tag: 'raincy' }];
    // the same conversation: the newest message, and how many came (the lists come newest first)
    const groups = [], byTag = {};
    list.forEach(n => { const k = n.tag || ('x' + groups.length); if (byTag[k]) { byTag[k].count += n.n || 1; return; } byTag[k] = Object.assign({}, n, { count: n.n || 1 }); groups.push(byTag[k]); });
    for (const n of groups.slice(0, 6)) {
      let count = n.count;
      if (n.tag) { try { const old = await self.registration.getNotifications({ tag: n.tag }); count += SUM(old); } catch (err) {} }
      const chat = /^chat:/.test(n.tag || '');
      await self.registration.showNotification((n.title || (typeof CLUB_SERVER !== 'undefined' && CLUB_SERVER.app) || 'Clubbo') + (chat && count > 1 ? ` · ${count} messages` : ''), {
        body: (n.body || '') + (!chat && count > 1 ? ` (+${count - 1})` : ''), tag: n.tag || undefined, renotify: !!n.tag,
        icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: n.url || '#/', count } });
    }
    await setBadge();
  })());
});
self.addEventListener('notificationclose', e => { e.waitUntil(setBadge()); });
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL('./' + ((e.notification.data && e.notification.data.url) || '#/'), self.registration.scope).href, path = url.split('#')[0];
  e.waitUntil(setBadge().then(() => clients.matchAll({ type: 'window', includeUncontrolled: true })).then(ws => {
    // the page of the notification (players', parents' or coaches' app) already open: it goes there; another page of the club: it opens the right one
    const same = ws.find(x => x.url.split('#')[0] === path || (path.endsWith('/') && /\/(index\.html)?$/.test(x.url.split('#')[0])));
    if (same) { same.postMessage({ raincyOpen: url }); return same.focus(); }
    const any = ws.find(x => x.url.startsWith(self.registration.scope));
    if (any && any.navigate) return any.navigate(url).then(w => w && w.focus());
    return clients.openWindow(url);
  }));
});
// the app opened: its notifications are read (the page asks)
self.addEventListener('message', e => {
  if (!(e.data && e.data.raincySeen)) return;
  e.waitUntil(self.registration.getNotifications().then(ns => ns.forEach(n => { const u = (n.data && n.data.url) || ''; if (e.data.raincySeen === '*' || u.startsWith(e.data.raincySeen)) n.close(); })).then(setBadge));
});
