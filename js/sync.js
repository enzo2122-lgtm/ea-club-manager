/* Sync: the club's data lives on the club server, each device keeps a copy that works offline.
   Every few seconds a device sends what changed on it and receives what changed on the others.
   (2.91) Nothing is lost any more when two devices touch the same item: each device remembers the last version it shared
   with the server (the « base »), and a three-way merge (base, mine, theirs) keeps the changes of both sides, field by field.
   The server refuses a version built on an outdated base and returns its own: the device merges and sends again. */
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

  /* ---------- the base: the last version of each item shared with the server (kept apart, in the phone's database) ---------- */
  const BKEY = AppCfg.key('sync-base');
  let base = null, baseT = null;
  async function loadBase() {
    if (base) return base;
    try { base = (await Store.auxGet(BKEY)) || {}; } catch (e) { base = {}; }
    // first time after the update: an item that is clean (same as the last print) is taken as the shared version
    if (!Object.keys(base).length) { const H = meta().h; Object.entries(current()).forEach(([k, [col, x]]) => { if (col !== 'club' && H[k] && H[k] === fp(x)) base[k] = clone(x); }); }
    return base;
  }
  function saveBase() { clearTimeout(baseT); baseT = setTimeout(() => { if (base) Store.auxPut(BKEY, base).catch(() => {}); }, 400); }
  const clone = x => x == null ? x : JSON.parse(JSON.stringify(x));

  /* ---------- the three-way merge: base (what both sides started from), mine, theirs ---------- */
  const same = (a, b) => canon(a) === canon(b);
  const isObj = x => x && typeof x === 'object' && !Array.isArray(x);
  const SETS = /^(convoked|presents|late|absents|teamIds|staffIds|docIds|helps|subs|coaches|members|tags|ids|seen|read)$/i;
  const idLike = s => typeof s === 'string' && /^[A-Za-z0-9_.:-]{1,60}$/.test(s);
  const isIdSet = (arr, key) => arr.every(idLike) && new Set(arr).size === arr.length && (SETS.test(key || '') || /ids?$/i.test(key || ''));
  const hasIds = arr => arr.length > 0 && arr.every(x => isObj(x) && x.id != null);
  // « newer » says which side wins when both changed the same simple value
  function merge3(b, l, s, newer, key) {
    if (same(l, s)) return l;
    if (same(b, l)) return s;
    if (same(b, s)) return l;
    if (l === undefined) return s; if (s === undefined) return l; // one side has it, the other never had it
    if (isObj(l) && isObj(s)) {
      const bb = isObj(b) ? b : {}, out = {};
      new Set([...Object.keys(bb), ...Object.keys(l), ...Object.keys(s)]).forEach(k => {
        const v = merge3(bb[k], l[k], s[k], newer, k); if (v !== undefined) out[k] = v;
      });
      // a value removed on one side (present in the base, absent on that side) and untouched on the other: it goes
      Object.keys(bb).forEach(k => { if ((!(k in l) && same(bb[k], s[k])) || (!(k in s) && same(bb[k], l[k]))) delete out[k]; });
      return out;
    }
    if (Array.isArray(l) && Array.isArray(s)) {
      const ba = Array.isArray(b) ? b : [];
      if (isIdSet(l, key) && isIdSet(s, key)) { // a set of ids: the additions of both, minus the removals of both
        const bs = new Set(ba), ls = new Set(l), ss = new Set(s), out = [];
        s.forEach(x => { if (ls.has(x) || !bs.has(x)) out.push(x); });
        l.forEach(x => { if (!ss.has(x) && !bs.has(x) && !out.includes(x)) out.push(x); });
        return out;
      }
      if (hasIds(l) && hasIds(s)) { // a list of things with an id (exercises, notes, events): merged one by one, order of theirs then mine
        const bm = new Map(ba.filter(x => isObj(x) && x.id != null).map(x => [x.id, x])), lm = new Map(l.map(x => [x.id, x])), sm = new Map(s.map(x => [x.id, x])), out = [];
        s.forEach(x => { const mine = lm.get(x.id), was = bm.get(x.id); if (mine) out.push(merge3(was, mine, x, newer, key)); else if (!was || !same(was, x)) out.push(x); });
        l.forEach(x => { if (!sm.has(x.id) && !bm.has(x.id)) out.push(x); });
        return out;
      }
      return newer === 'l' ? l : s; // other lists (positions, keys of a talk…): the most recent wins
    }
    return newer === 'l' ? l : s;
  }
  // mine and theirs merged on the base; without a base (old device), what one side has and the other lacks is kept
  function merged(b, loc, data) {
    const newer = (loc.updatedAt || 0) > (data.updatedAt || 0) ? 'l' : 's';
    const out = merge3(b || {}, loc, data, newer, '');
    out.updatedAt = Math.max(loc.updatedAt || 0, data.updatedAt || 0);
    return out;
  }

  /* ---------- receive ---------- */
  async function apply(rows) {
    const H = meta().h, B = await loadBase(); let changed = false;
    for (const r of rows) {
      const k = r.col + '/' + r.id;
      if (r.col === 'club') {
        if (r.del || !r.data) continue;
        const loc = clubData();
        if (H[k] && fp(loc) !== H[k]) { // changed here too: both sides merged
          const m = merged(B[k] || {}, loc, r.data); Object.assign(S().club, m); B[k] = clone(r.data); H[k] = fp(r.data); changed = true; if (typeof Sport !== 'undefined') Sport.apply(); saveBase(); continue;
        }
        if (fp(loc) !== fp(r.data)) { Object.assign(S().club, r.data); changed = true; if (typeof Sport !== 'undefined') Sport.apply(); }
        H[k] = fp(clubData()); B[k] = clone(r.data); continue;
      }
      if (!COLS.includes(r.col)) continue;
      const arr = S()[r.col], i = arr.findIndex(x => x.id === r.id), loc = i >= 0 ? arr[i] : null;
      if (r.del) {
        if (loc && H[k] && fp(loc) !== H[k]) continue; // edited here meanwhile: ours is kept and sent again (the deletion is undone)
        if (loc) { arr.splice(i, 1); changed = true; }
        delete H[k]; delete B[k]; saveBase(); continue;
      }
      let data = r.data;
      if (data && data.bgData) { await Library.saveBackground(data).catch(() => {}); data = strip(data); }
      if (loc) {
        if (fp(loc) === fp(data)) { H[k] = fp(loc); B[k] = clone(data); continue; }
        const dirty = fp(loc) !== H[k];
        if (!dirty) arr[i] = data; // nothing changed here: theirs, simply
        else arr[i] = merged(B[k], loc, data); // changed on both sides: the merge keeps both; it differs from theirs, so it leaves at the next push
      } else arr.push(data);
      H[k] = fp(data); B[k] = clone(data); changed = true;
    }
    saveBase();
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
  async function push(round = 0) {
    if (typeof Auth !== 'undefined' && Auth.readOnly && Auth.readOnly()) return 0; // (2.61) observation: nothing goes to the server
    const H = meta().h, B = await loadBase(), cur = current(), out = [], now = Date.now();
    const only = typeof Auth !== 'undefined' && Auth.limited && Auth.limited() ? 'players' : ''; // (2.66) intendance / référent médical
    for (const [k, [col, x]] of Object.entries(cur)) {
      if (only && col !== only) continue;
      if (fp(x) === H[k]) continue;
      if (col !== 'club') x.updatedAt = Math.max(now, (x.updatedAt || 0) + 1);
      // a copy taken now: what is typed or drawn while it travels stays "to send" (otherwise the server's echo would erase it)
      const snap = JSON.parse(JSON.stringify(x));
      // the base the change was built on: the server refuses the item if someone else changed it since (and returns its version)
      const bu = col === 'club' ? null : B[k] ? (B[k].updatedAt || 0) : (H[k] ? null : 0);
      out.push({ k, col, id: col === 'club' ? 'club' : x.id, x: snap, f: fp(snap), u: col === 'club' ? now : x.updatedAt, bu });
    }
    Object.keys(H).forEach(k => { if (!cur[k] && (!only || k.startsWith(only + '/'))) out.push({ k, col: k.slice(0, k.indexOf('/')), id: k.slice(k.indexOf('/') + 1), del: true, u: now, bu: B[k] ? (B[k].updatedAt || 0) : null }); });
    if (!out.length) return 0;
    let batch = [], size = 0, conflicts = [];
    const send = async () => {
      if (!batch.length) return;
      const res = await Cloud.push(batch.map(b => ({ col: b.col, id: b.id, data: b.del ? null : b.data, u: b.u, del: !!b.del, bu: b.bu })));
      const refused = new Set((res && Array.isArray(res.conflicts) ? res.conflicts : []).map(c => c.col + '/' + c.id));
      batch.forEach(b => { if (refused.has(b.k)) return; if (b.del) { delete H[b.k]; delete B[b.k]; } else { H[b.k] = b.f; B[b.k] = clone(b.x); } });
      if (res && Array.isArray(res.conflicts)) conflicts.push(...res.conflicts);
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
    await send(); saveBase();
    // refused by the server (someone else changed the same thing): their version is merged with ours, then sent again
    if (conflicts.length && round < 3) {
      await apply(conflicts.map(c => ({ col: c.col, id: c.id, data: c.data, u: c.u, del: !!c.del, rev: c.rev })));
      await push(round + 1);
    }
    return out.length;
  }

  // First connection of a device to a club that already has its data on the server: old things kept on this device
  // (not touched for more than a day, e.g. an old list or examples) are not sent again to everybody; they stay here only.
  // Recent work of the device is still shared.
  function adoptStale() {
    const H = meta().h, old = Date.now() - 864e5;
    Object.entries(current()).forEach(([k, [col, x]]) => { if (col !== 'club' && !H[k] && (x.updatedAt || 0) < old) { H[k] = fp(x); if (base) base[k] = clone(x); } });
  }

  /* ---------- run ---------- */
  function run() {
    if (running) { again = true; return running; }
    if (!Cloud.ready() || !navigator.onLine) return Promise.resolve(false);
    running = (async () => {
      let changed = false;
      try {
        await loadBase();
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
  const soon = () => { clearTimeout(timer); timer = setTimeout(run, 1500); };
  function start() {
    Store.on(soon);
    // (2.91) every 15 s while the app is on screen, at once when it comes back, when the network returns, and before it is closed
    clearInterval(poll); poll = setInterval(() => { if (document.visibilityState === 'visible') run(); }, 15000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') run(); else { clearTimeout(timer); run(); } });
    window.addEventListener('online', () => run());
    window.addEventListener('pagehide', () => { clearTimeout(timer); run(); });
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
  const forget = () => { S().sync = { rev: 0, h: {} }; base = {}; saveBase(); };

  return { start, run, firstLoad, status, forget, fp, merge3, merged };
})();
