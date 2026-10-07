/* Sync: the club's data lives on the club server, each device keeps a copy that works offline.
   Every few seconds a device sends what changed on it and receives what changed on the others.
   One item (a player, a training, a schema…) is the unit: the latest change of an item wins. */
const Sync = (() => {
  const COLS = ['teams', 'players', 'staff', 'schemas', 'trainings', 'matches', 'reports'];
  const S = () => Store.state;
  const meta = () => (S().sync = S().sync || { rev: 0, h: {} });
  let timer = null, poll = null, running = null, again = false, lastOk = 0, lastErr = '';

  // Same content → same fingerprint, whatever the order of the keys
  function canon(x) {
    if (Array.isArray(x)) return '[' + x.map(canon).join(',') + ']';
    if (x && typeof x === 'object') return '{' + Object.keys(x).filter(k => x[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canon(x[k])).join(',') + '}';
    return JSON.stringify(x === undefined ? null : x);
  }
  // (2.03) the slow part (keys sorted at every level) is done again only when the item really changed: the browser's own
  // JSON.stringify (fast) tells it; same item, same text → the fingerprint kept. Same result as before, much less work for a big club.
  const fpMemo = new WeakMap();
  function fp(x) {
    if (x && typeof x === 'object') { const raw = JSON.stringify(x), m = fpMemo.get(x); if (m && m.raw === raw) return m.fp; const f = fp0(x); fpMemo.set(x, { raw, fp: f }); return f; }
    return fp0(x);
  }
  function fp0(x) {
    const s = canon(x); let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(36) + '.' + s.length.toString(36);
  }
  // Club settings shared with everybody (the server connection itself stays on each device)
  function clubData() { const c = Object.assign({}, S().club); delete c.cloud; return c; }
  const strip = x => { if (x && x.bgData) { x = Object.assign({}, x); delete x.bgData; } return x; };
  function current() {
    const cur = {};
    COLS.forEach(c => (S()[c] || []).forEach(x => { if (x && x.id) cur[c + '/' + x.id] = [c, x]; }));
    cur['club/club'] = ['club', clubData()];
    return cur;
  }

  /* ---------- receive ---------- */
  async function apply(rows) {
    const H = meta().h; let changed = false;
    for (const r of rows) {
      const k = r.col + '/' + r.id;
      if (r.col === 'club') {
        if (r.del || !r.data) continue;
        const loc = clubData();
        if (H[k] && fp(loc) !== H[k]) continue; // changed here too: ours will be sent
        if (fp(loc) !== fp(r.data)) { Object.assign(S().club, r.data); changed = true; if (typeof Sport !== 'undefined') Sport.apply(); }
        H[k] = fp(clubData()); continue;
      }
      if (!COLS.includes(r.col)) continue;
      const arr = S()[r.col], i = arr.findIndex(x => x.id === r.id), loc = i >= 0 ? arr[i] : null;
      if (r.del) {
        if (loc && H[k] && fp(loc) !== H[k] && (loc.updatedAt || 0) > (r.u || 0)) continue; // edited here after the deletion
        if (loc) { arr.splice(i, 1); changed = true; }
        delete H[k]; continue;
      }
      let data = r.data;
      if (data && data.bgData) { await Library.saveBackground(data).catch(() => {}); data = strip(data); }
      if (loc) {
        const same = fp(loc) === fp(data);
        if (same) { H[k] = fp(loc); continue; }
        const dirty = fp(loc) !== H[k];
        if (dirty && (loc.updatedAt || 0) > (r.u || 0)) continue; // our version is newer: it will be sent
        arr[i] = data;
      } else arr.push(data);
      H[k] = fp(data); changed = true;
    }
    return changed;
  }
  async function pull() {
    let changed = false;
    for (let n = 0; n < 50; n++) {
      const rows = await Cloud.pull(meta().rev) || [];
      if (await apply(rows)) changed = true;
      if (rows.length) meta().rev = Math.max(meta().rev, ...rows.map(r => +r.rev || 0));
      if (rows.length < 1000) break;
    }
    if (changed) Store.sortTeams();
    return changed;
  }

  /* ---------- send ---------- */
  async function push() {
    const H = meta().h, cur = current(), out = [], now = Date.now();
    for (const [k, [col, x]] of Object.entries(cur)) {
      if (fp(x) === H[k]) continue;
      if (col !== 'club') x.updatedAt = Math.max(now, (x.updatedAt || 0) + 1);
      // a copy taken now: what is typed or drawn while it travels stays "to send" (otherwise the server's echo would erase it)
      const snap = JSON.parse(JSON.stringify(x));
      out.push({ k, col, id: col === 'club' ? 'club' : x.id, x: snap, f: fp(snap), u: col === 'club' ? now : x.updatedAt });
    }
    Object.keys(H).forEach(k => { if (!cur[k]) out.push({ k, col: k.slice(0, k.indexOf('/')), id: k.slice(k.indexOf('/') + 1), del: true, u: now }); });
    if (!out.length) return 0;
    let batch = [], size = 0;
    const send = async () => {
      if (!batch.length) return;
      await Cloud.push(batch.map(b => ({ col: b.col, id: b.id, data: b.del ? null : b.data, u: b.u, del: !!b.del })));
      batch.forEach(b => { if (b.del) delete H[b.k]; else H[b.k] = b.f; });
      batch = []; size = 0;
    };
    for (const o of out) {
      o.data = o.del ? null : o.x;
      // a schema drawn on a picture carries its picture so the other devices can show it
      if (!o.del && o.col === 'schemas' && o.x.field && o.x.field.format === 'bg') o.data = await Library.withBackground(o.x);
      const len = o.del ? 80 : JSON.stringify(o.data).length;
      if (batch.length && (size + len > 900000 || batch.length >= 150)) await send();
      batch.push(o); size += len;
    }
    await send();
    return out.length;
  }

  // First connection of a device to a club that already has its data on the server: old things kept on this device
  // (not touched for more than a day, e.g. an old list or examples) are not sent again to everybody; they stay here only.
  // Recent work of the device is still shared.
  function adoptStale() {
    const H = meta().h, old = Date.now() - 864e5;
    Object.entries(current()).forEach(([k, [col, x]]) => { if (col !== 'club' && !H[k] && (x.updatedAt || 0) < old) H[k] = fp(x); });
  }

  /* ---------- run ---------- */
  function run() {
    if (running) { again = true; return running; }
    if (!Cloud.ready() || !navigator.onLine) return Promise.resolve(false);
    running = (async () => {
      let changed = false;
      try {
        const fresh = !meta().rev && !Object.keys(meta().h).length;
        changed = await pull();
        if (fresh && meta().rev > 0) adoptStale();
        const sent = await push();
        if (changed || sent) Store.persistNow();
        lastOk = Date.now(); lastErr = '';
      } catch (e) {
        lastErr = e.message || 'erreur';
        if (e.code === 'SESSION' || e.code === 'CLE_CLUB') Auth.expired();
      } finally { running = null; }
      if (typeof Quick !== 'undefined') Quick.syncDone(lastErr);
      if (changed) refreshView();
      if (again) { again = false; run(); }
      return changed;
    })();
    return running;
  }
  // Redraw the page with the new data, unless someone is typing, drawing or has a window open
  function refreshView() {
    const a = document.activeElement, typing = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
    // not while the finger is on the screen or the page is still moving (it would jump under the finger)
    if (Date.now() - lastTouch < 1500) { pending = true; clearTimeout(retry); retry = setTimeout(refreshView, 1600); return; }
    // Réglages: forms and lists loaded one by one; redrawn when the coach comes back to it, not under his fingers
    if (/^#\/reglages/.test(location.hash)) { pending = true; return; }
    if (document.body.classList.contains('editing') || !document.getElementById('modal').hidden || !document.getElementById('lock').hidden || typing) { pending = true; return; }
    pending = false; App.refreshChrome(); App.route(true);
  }
  let pending = false, lastTouch = 0, retry = null;
  ['touchstart', 'touchmove', 'scroll', 'wheel'].forEach(ev => window.addEventListener(ev, () => { lastTouch = Date.now(); }, { passive: true, capture: true }));
  const soon = () => { clearTimeout(timer); timer = setTimeout(run, 2500); };
  function start() {
    Store.on(soon);
    clearInterval(poll); poll = setInterval(() => { if (document.visibilityState === 'visible') run(); }, 30000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') run(); });
    window.addEventListener('online', () => run());
    window.addEventListener('hashchange', () => { if (pending) { pending = false; } });
    run();
  }
  // First connection on a device: everything from the server before showing the app
  async function firstLoad() { try { await run(); } catch (e) {} return S().staff.length > 0; }
  function status() {
    if (!Cloud.ready()) return '';
    if (lastErr) return 'Synchronisation : ' + lastErr;
    return lastOk ? 'Données à jour avec le serveur (' + new Date(lastOk).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + ').' : 'Synchronisation en cours…';
  }
  const forget = () => { S().sync = { rev: 0, h: {} }; };

  return { start, run, firstLoad, status, forget, fp };
})();
