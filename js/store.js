/* Store: the whole club lives in one object, saved in IndexedDB on the device.
   Sharing between coaches goes through export/import of a .json file (AirDrop, WhatsApp, mail). */
const Store = (() => {
  const DB = AppCfg.db, OS = 'kv', KEY = 'state';
  const COLS = ['teams', 'players', 'staff', 'schemas', 'trainings', 'matches', 'reports'];
  let state = null, saveTimer = null;
  const listeners = new Set();
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // (3.75) on iPhone, after the app reloads itself (update), opening the database sometimes never answers:
  // the app stayed blank. One connection is kept (closed when the page goes away), and an opening without answer is tried again.
  let dbP = null;
  function openDb(ms) {
    return new Promise((res, rej) => {
      const to = setTimeout(() => rej(new Error('IDB_TIMEOUT')), ms);
      const rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore(OS);
      rq.onsuccess = () => { clearTimeout(to); const db = rq.result; db.onversionchange = () => { db.close(); dbP = null; }; db.onclose = () => { dbP = null; }; res(db); };
      rq.onerror = () => { clearTimeout(to); rej(rq.error); };
      rq.onblocked = () => {};
    });
  }
  function idb() {
    if (!dbP) dbP = (async () => {
      for (let i = 0; i < 3; i++) {
        try { return await openDb(2000 + i * 1000); }
        catch (e) { if (e.message !== 'IDB_TIMEOUT') throw e; try { indexedDB.databases && await indexedDB.databases(); } catch (x) {} } // wakes Safari's database
      }
      throw new Error('IDB_TIMEOUT');
    })().catch(e => { dbP = null; throw e; });
    return dbP;
  }
  function closeDb() { const p = dbP; dbP = null; if (p) p.then(db => db.close()).catch(() => {}); }
  addEventListener('pagehide', closeDb);
  async function idbGet(k) {
    const db = await idb();
    return new Promise((res, rej) => { const t = db.transaction(OS).objectStore(OS).get(k); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); });
  }
  async function idbPut(k, v) {
    const db = await idb();
    return new Promise((res, rej) => { const t = db.transaction(OS, 'readwrite'); t.objectStore(OS).put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); });
  }

  function blank() {
    return { version: 2, club: Object.assign({ name: '', homeBib: 'bleu', awayBib: 'blanc', brand: 1 }, AppCfg.defaults), // the app of one club starts with its name, slogan, town…
      ui: {}, teams: [], players: [], staff: [], schemas: [], trainings: [], matches: [], reports: [] };
  }
  // v1 kept players inside each team; v2 keeps one club-wide list where a player can belong to several categories.
  function migrate() {
    COLS.forEach(c => state[c] = state[c] || []);
    state.ui = state.ui || {};
    if (state.club && !state.club.brand) { // club colours: bordeaux and white
      if (state.club.homeBib === 'bleu') state.club.homeBib = 'bordeaux';
      if (state.club.awayBib === 'rouge') state.club.awayBib = 'blanc';
      state.club.brand = 1;
    }
    state.teams.forEach(t => {
      if (!Array.isArray(t.players)) return;
      t.players.forEach(p => {
        const ex = state.players.find(x => x.id === p.id);
        if (ex) { if (!ex.teamIds.includes(t.id)) ex.teamIds.push(t.id); return; }
        const parts = String(p.name || '').trim().split(/\s+/);
        state.players.push({ id: p.id, firstName: parts.shift() || '', lastName: parts.join(' '), number: p.number, pos: p.pos || 'MIL', teamIds: [t.id], parents: [], example: t.example, updatedAt: Date.now() });
      });
      delete t.players;
    });
    state.version = 2;
    mergeStaffDuplicates();
    sortTeams();
  }
  // Category order everywhere: Seniors, Vétérans, École de foot, then U6, U7 … U17 (a team like « U13 A » comes right after U13)
  const catKey = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, '');
  function teamRank(t) {
    const base = k => { if (/^SENIOR/.test(k)) return 0; if (/^VET/.test(k)) return 1; if (/^ECOLE/.test(k)) return 2; const m = /^U(\d+)/.exec(k); return m ? 10 + +m[1] : null; };
    const kn = catKey(t.name);
    let b = base(catKey(t.category)); if (b === null) b = base(kn); if (b === null) return 999;
    return b + (['SENIORS', 'VETERANS', 'ECOLEDEFOOT', 'U' + (b - 10)].includes(kn) ? 0 : 0.5);
  }
  function sortTeams() {
    if (state && state.teams) state.teams.sort((a, b) => teamRank(a) - teamRank(b) || String(a.name || '').localeCompare(String(b.name || ''), 'fr', { numeric: true }));
  }
  // Same dirigeant twice (an account made by hand + the card from the club file, e.g. « Enzo » and « Enzo (Adnane) »):
  // keep the card that has a password, take over the other card's details, and remember it so a new import doesn't bring it back.
  function mergeStaffDuplicates() {
    // With the club server, accounts live on the server: a card that looks like a duplicate here may be
    // another device's account, so nothing is merged (the responsable merges by hand if needed)
    if (state.auth && state.auth.session) return;
    const users = (state.auth && state.auth.users) || {}, hasPw = id => !!(users[id] && users[id].hash);
    const key = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
    const firstWords = p => { const f = String(p.firstName || ''), inPar = (f.match(/\(([^)]+)\)/) || [])[1]; return [key(f.replace(/\(.*\)/, '').split(/\s+/)[0]), inPar && key(inPar.split(/\s+/)[0])].filter(Boolean); };
    state.ui.mergedStaff = state.ui.mergedStaff || {};
    for (const keep of state.staff.filter(s => hasPw(s.id))) {
      for (const dup of state.staff.filter(s => s !== keep && !hasPw(s.id) && key(s.lastName) === key(keep.lastName) && firstWords(s).some(w => firstWords(keep).includes(w)))) {
        keep.playerId = keep.playerId || dup.playerId;
        keep.phone = keep.phone || dup.phone; keep.email = keep.email || dup.email;
        keep.teamIds = [...new Set([...(keep.teamIds || []), ...(dup.teamIds || [])])];
        if (!keep.role || keep.role === 'Dirigeant') keep.role = dup.role && dup.role !== 'Dirigeant' ? dup.role : (keep.role || dup.role);
        keep.updatedAt = Date.now();
        state.ui.mergedStaff[dup.id] = keep.id;
        state.staff = state.staff.filter(s => s !== dup);
      }
    }
  }

  async function load() {
    let slow = false;
    try { state = await idbGet(KEY); } catch (e) { state = null; slow = e && e.message === 'IDB_TIMEOUT'; }
    if (!state) { try { state = JSON.parse(localStorage.getItem(KEY)); } catch (e) { state = null; } }
    if (!state && slow) throw new Error('IDB_TIMEOUT'); // the app shows « Recharger » (its data are still on the phone)
    if (!state) { state = blank(); persist(); }
    migrate();
    try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}
    return state;
  }
  async function persist() {
    const snap = JSON.parse(JSON.stringify(state));
    try { await idbPut(KEY, snap); } catch (e) { try { localStorage.setItem(KEY, JSON.stringify(snap)); } catch (e2) {} }
  }
  function save() {
    clearTimeout(saveTimer); saveTimer = setTimeout(persist, 300);
    listeners.forEach(f => f());
  }
  // Save without telling the listeners (used by the sync, which is itself a listener)
  function persistNow() { clearTimeout(saveTimer); saveTimer = setTimeout(persist, 50); }
  // (2.80) an index id → position per collection, rebuilt when the array changes (replaced, grown) or no longer matches
  const idx = {};
  const build = a => { const m = new Map(); for (let i = 0; i < a.length; i++) m.set(a[i].id, i); return { a, n: a.length, m }; };
  const get = (col, id) => {
    const a = state[col]; if (!a) return undefined;
    let x = idx[col]; if (!x || x.a !== a || x.n !== a.length) x = idx[col] = build(a);
    let p = x.m.get(id); if (p != null && a[p] && a[p].id === id) return a[p];
    x = idx[col] = build(a); p = x.m.get(id); return p != null ? a[p] : undefined;
  };
  // (2.61) a staff with « Observation (lecture seule) »: he sees everything he may see, he changes nothing
  let roT = 0;
  const ro = col => typeof Auth !== 'undefined' && Auth.canWrite && !Auth.canWrite(col);
  const roSay = () => { if (Date.now() - roT > 4000 && typeof UI !== 'undefined') { roT = Date.now(); UI.toast(Auth.limited() ? '🔒 Ton accès permet de modifier seulement les fiches des joueurs' : '👀 Accès en lecture seule : rien n\'est enregistré', 'err'); } };
  function upsert(col, item) {
    if (ro(col)) { roSay(); return item; }
    item.updatedAt = Date.now();
    // who changed a match or a session: he is not notified of his own change (club server)
    if ((col === 'matches' || col === 'trainings') && typeof Auth !== 'undefined' && Auth.current()) item.editedBy = Auth.current().id;
    const i = state[col].findIndex(x => x.id === item.id);
    if (i < 0) state[col].push(item); else state[col][i] = item;
    if (col === 'teams') sortTeams();
    save(); return item;
  }
  function remove(col, id) { if (ro(col)) return roSay(); state[col] = state[col].filter(x => x.id !== id); save(); }

  /* ---------- sharing ---------- */
  function pack(data) { return JSON.stringify({ app: 'raincy-coach', version: 1, exportedAt: new Date().toISOString(), data }, null, 1); }
  function exportAll() { const d = {}; COLS.forEach(c => d[c] = state[c]); d.club = state.club; return pack(d); }
  function exportTraining(t) {
    const ids = new Set(t.exercises.map(e => e.schemaId).filter(Boolean));
    return pack({ trainings: [t], schemas: state.schemas.filter(s => ids.has(s.id)) });
  }
  function exportSchema(s) { return pack({ schemas: [s] }); }
  function importText(txt) {
    let obj; try { obj = JSON.parse(txt); } catch (e) { throw new Error("Ce fichier n'est pas un fichier de l'appli."); }
    if (!obj || obj.app !== 'raincy-coach' || !obj.data) throw new Error("Ce fichier n'est pas un fichier de l'appli.");
    const res = { added: 0, updated: 0, kept: 0, byCol: {} };
    const count = c => res.byCol[c] = (res.byCol[c] || 0) + 1;
    COLS.forEach(c => (obj.data[c] || []).forEach(it => {
      if (!it || !it.id) return;
      if (c === 'staff' && state.ui.mergedStaff && state.ui.mergedStaff[it.id]) return; // already merged into an account
      const i = state[c].findIndex(x => x.id === it.id);
      if (i < 0) { state[c].push(it); res.added++; count(c); }
      else if ((it.updatedAt || 0) > (state[c][i].updatedAt || 0)) { state[c][i] = it; res.updated++; count(c); }
      else res.kept++;
    }));
    // Entries the club file says to remove (e.g. people wrongly listed in a previous file)
    Object.entries(obj.removed || {}).forEach(([c, ids]) => { if (COLS.includes(c) && Array.isArray(ids)) { const before = state[c].length; state[c] = state[c].filter(x => !ids.includes(x.id)); res.removed = (res.removed || 0) + before - state[c].length; } });
    // The club's report e-mail travels with the club file so every coach can send reports
    if (obj.data.club && obj.data.club.reportEmail && !state.club.reportEmail) state.club.reportEmail = obj.data.club.reportEmail;
    // The club server connection (URL, public key, club code) comes with the club file
    if (obj.data.club && obj.data.club.cloud && obj.data.club.cloud.url) { state.club.cloud = obj.data.club.cloud; if (obj.data.club.fieldName) state.club.fieldName = obj.data.club.fieldName; }
    migrate(); save(); return res;
  }
  function reset() { state = blank(); migrate(); save(); }
  function removeExamples() {
    const isEx = x => x.example || /\(exemple\)/i.test(x.name || x.title || '');
    ['teams', 'schemas', 'trainings'].forEach(c => state[c].forEach(x => { if (isEx(x)) x.example = true; }));
    const ex = new Set(state.teams.filter(t => t.example).map(t => t.id));
    state.players.forEach(p => { if ((p.teamIds || []).length && p.teamIds.every(id => ex.has(id))) p.example = true; });
    ['teams', 'schemas', 'trainings', 'matches', 'players', 'staff'].forEach(c => state[c] = state[c].filter(x => !x.example && !(c !== 'teams' && x.teamId && ex.has(x.teamId))));
    state.players.forEach(p => p.teamIds = (p.teamIds || []).filter(id => !ex.has(id)));
    if (ex.has(state.ui.teamId)) state.ui.teamId = '';
    save();
  }

  /* ---------- people ---------- */
  const inTeam = (x, teamId) => (x.teamIds || []).includes(teamId);
  const byName = (a, b) => (a.lastName || '').localeCompare(b.lastName || '', 'fr') || (a.firstName || '').localeCompare(b.firstName || '', 'fr');
  const playersOf = teamId => state.players.filter(p => inTeam(p, teamId)).sort(byName);
  // Players a coach can pick for a match, a session or a lineup: the team's own players first, then the rest of its category
  // (a match of « Seniors A » also offers the Seniors who are not put in group A or B yet)
  function rosterOf(teamId) {
    const t = get('teams', teamId); if (!t) return [];
    const own = playersOf(teamId), key = catKey(t.category || t.name);
    const fam = new Set(state.teams.filter(x => x.id !== teamId && catKey(x.category || x.name) === key).map(x => x.id));
    const ownIds = new Set(own.map(p => p.id));
    const fams = state.players.filter(p => !ownIds.has(p.id) && (p.teamIds || []).some(id => fam.has(id))).sort(byName);
    // (2.43) the « renforts »: players of another category who help this team (they stay in their own category)
    const had = new Set([...ownIds, ...fams.map(p => p.id)]);
    return own.concat(fams, state.players.filter(p => !had.has(p.id) && (p.helps || []).includes(teamId)).sort(byName));
  }
  // a player of the category of the team (its A / B teams included)
  const sameCat = (p, teamId) => { const t = get('teams', teamId); if (!t || !p) return false; const k = catKey(t.category || t.name); return (p.teamIds || []).some(id => { const x = get('teams', id); return !!x && catKey(x.category || x.name) === k; }); };
  const helps = (p, teamId) => !!p && (p.helps || []).includes(teamId) && !(p.teamIds || []).includes(teamId);
  // (2.43) the number of a player for a match: the one given for this match, otherwise his usual one
  const numOf = (p, m) => { const n = m && m.numbers && p ? m.numbers[p.id] : null; return n != null && n !== '' ? n : (p && p.number != null ? p.number : ''); };
  const staffOf = teamId => state.staff.filter(p => inTeam(p, teamId)).sort(byName);
  const fullName = p => p ? [String(p.lastName || '').toUpperCase(), p.firstName].filter(Boolean).join(' ') || 'Sans nom' : '';
  const shortName = p => p ? (p.firstName ? p.firstName + (p.lastName ? ' ' + p.lastName[0].toUpperCase() + '.' : '') : fullName(p)) : '';

  /* ---------- a category and its teams: « U14 » (the main one), then « U14 A », « U14 B » ---------- */
  const famOf = t => catKey(t.category || t.name);
  const isMain = t => !!t && catKey(t.name) === famOf(t);
  // a team A / B of a category that has its main team
  const isSub = t => !!t && !isMain(t) && state.teams.some(x => x !== t && isMain(x) && famOf(x) === famOf(t));
  // [[U14, U14 A, U14 B], [U15, …]] in the order of the list, the main team first
  function teamGroups(list) {
    const out = [], by = new Map();
    list.forEach(t => { const k = famOf(t); if (!by.has(k)) { const g = []; by.set(k, g); out.push(g); } by.get(k).push(t); });
    out.forEach(g => { const i = g.findIndex(isMain); if (i > 0) g.unshift(g.splice(i, 1)[0]); });
    return out;
  }
  // in a drop-down list, the teams A / B are shifted under their category
  const teamLabel = t => t ? (isSub(t) ? '   ↳ ' : '') + (t.name || '') : '';

  // Friendly matches (amical, tournoi, préparation) are counted apart from the official ones (championnat, coupe, plateau):
  // results, goals, playing time and stats show one kind or the other (« Officiels » by default)
  const isFriendly = m => /amical|tournoi|pr[ée]pa|friendly/i.test((m && m.competition) || '');
  // (2.66) a day of plateau / tournament: several short matches of a team on the same day (one « journée »)
  const isDayComp = m => /plateau|tournoi/i.test((m && m.competition) || '');
  const dayOf = m => !m || !isDayComp(m) ? [] : state.matches.filter(x => x.teamId === m.teamId && x.date === m.date && isDayComp(x) && !x.exempt).sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')) || String(a.id).localeCompare(String(b.id)));
  const matchKind = () => (state && state.ui && state.ui.matchKind) || 'off';
  const kindOk = m => isFriendly(m) === (matchKind() === 'ami');

  return {
    load, closeDb, save, persistNow, sortTeams, get, upsert, remove, uid, exportAll, exportTraining, exportSchema, importText, reset, removeExamples,
    playersOf, rosterOf, helps, sameCat, numOf, staffOf, fullName, shortName, byName, isMain, isSub, teamGroups, teamLabel, isFriendly, isDayComp, dayOf, matchKind, kindOk,
    get state() { return state; }, on: f => listeners.add(f), off: f => listeners.delete(f),
  };
})();

/* Formations: x = fraction of pitch length (we attack to the right), y = fraction of width (0 = our left). */
const Formations = {
  '11': {
    '4-3-3':   [['G', .02, .5, 1], ['3', .2, .12], ['5', .17, .37], ['4', .17, .63], ['2', .2, .88], ['6', .3, .5], ['8', .38, .3], ['10', .38, .7], ['11', .47, .12], ['9', .49, .5], ['7', .47, .88]],
    '4-1-2-3 (sans ballon)': [['G', .02, .5, 1], ['3', .18, .12], ['5', .15, .37], ['4', .15, .63], ['2', .18, .88], ['6', .24, .5], ['8', .33, .33], ['10', .33, .67], ['11', .44, .12], ['9', .46, .5], ['7', .44, .88]],
    '3-4-3 (avec ballon)':   [['G', .02, .5, 1], ['5', .14, .27], ['6', .12, .5], ['4', .14, .73], ['3', .36, .07], ['8', .31, .38], ['10', .31, .62], ['2', .36, .93], ['11', .45, .22], ['9', .48, .5], ['7', .45, .78]],
    '4-4-2':   [['G', .02, .5, 1], ['3', .2, .12], ['5', .17, .37], ['4', .17, .63], ['2', .2, .88], ['11', .34, .12], ['6', .3, .38], ['8', .3, .62], ['7', .34, .88], ['10', .45, .4], ['9', .45, .6]],
    '4-2-3-1': [['G', .02, .5, 1], ['3', .2, .12], ['5', .17, .37], ['4', .17, .63], ['2', .2, .88], ['6', .28, .38], ['8', .28, .62], ['11', .39, .15], ['10', .39, .5], ['7', .39, .85], ['9', .48, .5]],
  },
  '8': {
    '3-3-1': [['G', .03, .5, 1], ['3', .18, .2], ['4', .15, .5], ['2', .18, .8], ['6', .32, .2], ['8', .29, .5], ['7', .32, .8], ['9', .45, .5]],
    '3-2-2': [['G', .03, .5, 1], ['3', .18, .2], ['4', .15, .5], ['2', .18, .8], ['6', .3, .35], ['8', .3, .65], ['9', .45, .35], ['10', .45, .65]],
    '2-3-2': [['G', .03, .5, 1], ['4', .16, .33], ['5', .16, .67], ['3', .3, .15], ['6', .28, .5], ['2', .3, .85], ['9', .45, .35], ['10', .45, .65]],
    '3-1-3': [['G', .03, .5, 1], ['3', .18, .2], ['4', .15, .5], ['2', .18, .8], ['6', .28, .5], ['7', .42, .15], ['9', .46, .5], ['11', .42, .85]],
  },
  b5: {
    '1-2-2': [['1', .62, .5, 0, ['MEN']], ['2', .72, .18, 0, ['ARR']], ['3', .72, .82, 0, ['AIL']], ['4', .86, .3, 0, ['AF']], ['5', .88, .66, 0, ['PIV']]],
    '2-1-2': [['1', .64, .35, 0, ['MEN']], ['2', .64, .65, 0, ['ARR']], ['3', .78, .5, 0, ['AF', 'PIV']], ['4', .88, .2, 0, ['AIL']], ['5', .88, .8, 0, ['PIV', 'AF']]],
    '1-3-1': [['1', .6, .5, 0, ['MEN']], ['2', .74, .12, 0, ['ARR', 'AIL']], ['3', .74, .5, 0, ['AF']], ['4', .74, .88, 0, ['AIL', 'ARR']], ['5', .9, .5, 0, ['PIV']]],
  },
  b3: { '3 ouverts': [['1', .25, .5, 0, ['MEN']], ['2', .6, .15, 0, ['ARR', 'AIL']], ['3', .7, .8, 0, ['AF', 'PIV']]] },
  h7: {
    '3-3 (attaque)': [['G', .03, .5, 1, ['GB']], ['AG', .9, .04, 0, ['AIG', 'AIL']], ['ArG', .72, .22, 0, ['ARG', 'ARR']], ['DC', .7, .5, 0, ['DC', 'ARR']], ['ArD', .72, .78, 0, ['ARD', 'ARR']], ['AD', .9, .96, 0, ['AID', 'AIL']], ['PIV', .88, .5, 0, ['PIV']]],
    '0-6 (défense)': [['G', .03, .5, 1, ['GB']], ['1', .18, .08, 0, ['AIL']], ['2', .17, .27, 0, ['ARR']], ['3', .16, .44, 0, ['PIV']], ['4', .16, .56, 0, ['PIV', 'ARR']], ['5', .17, .73, 0, ['ARR']], ['6', .18, .92, 0, ['AIL']]],
  },
  r15: { 'Lancement de jeu': [['1', .47, .44, 0, ['PIL']], ['2', .47, .5, 0, ['TAL']], ['3', .47, .56, 0, ['PIL']], ['4', .45, .47, 0, ['DL']], ['5', .45, .53, 0, ['DL']], ['6', .45, .4, 0, ['FL']], ['7', .45, .6, 0, ['FL']], ['8', .43, .5, 0, ['N8']],
    ['9', .41, .44, 0, ['DM']], ['10', .36, .36, 0, ['DO']], ['12', .33, .28, 0, ['CEN']], ['13', .3, .2, 0, ['CEN']], ['14', .28, .1, 0, ['AIL']], ['11', .4, .9, 0, ['AIL']], ['15', .15, .5, 0, ['ARR']]] },
  r10: { 'Lancement de jeu': [['1', .47, .44, 0, ['PIL']], ['2', .47, .5, 0, ['TAL']], ['3', .47, .56, 0, ['PIL']], ['8', .44, .5, 0, ['N8', 'FL']], ['9', .41, .42, 0, ['DM']], ['10', .36, .34, 0, ['DO']], ['12', .32, .25, 0, ['CEN']], ['13', .29, .16, 0, ['CEN']], ['11', .4, .88, 0, ['AIL']], ['15', .16, .5, 0, ['ARR']]] },
  r7: { 'Lancement de jeu': [['1', .47, .45, 0, ['PIL']], ['2', .47, .5, 0, ['TAL']], ['3', .47, .55, 0, ['PIL']], ['9', .43, .42, 0, ['DM']], ['10', .38, .32, 0, ['DO']], ['12', .33, .2, 0, ['CEN']], ['11', .28, .08, 0, ['AIL']]] },
  v6: { 'Rotation 1 (passeur en 1)': [['4', .44, .3, 0, ['OPP']], ['3', .44, .5, 0, ['CEN']], ['2', .44, .7, 0, ['R4']], ['5', .25, .3, 0, ['R4']], ['6', .25, .5, 0, ['CEN', 'LIB']], ['1', .25, .7, 0, ['PAS']]],
    'Rotation 2 (passeur en 6)': [['4', .44, .3, 0, ['R4']], ['3', .44, .5, 0, ['OPP']], ['2', .44, .7, 0, ['CEN']], ['5', .25, .3, 0, ['CEN', 'LIB']], ['6', .25, .5, 0, ['PAS']], ['1', .25, .7, 0, ['R4']]] },
  v4: { 'Carré': [['A', .42, .32, 0, ['PAS']], ['B', .42, .68, 0, ['R4']], ['C', .25, .32, 0, ['CEN']], ['D', .25, .68, 0, ['OPP', 'LIB']]] },
  '5': {
    '2-2': [['G', .04, .5, 1], ['2', .2, .28], ['3', .2, .72], ['4', .4, .28], ['5', .4, .72]],
    '1-2-1': [['G', .04, .5, 1], ['2', .17, .5], ['3', .3, .2], ['4', .3, .8], ['5', .43, .5]],
  },
};

/* More game systems, made line by line (« 4-3-2-1 » = 4 defenders, 3, 2, then 1): the ones drawn by hand above stay as they are.
   Then the systems of the other sports (attack and defence), and the list sorted in sub-categories for the menus. */
(function moreFormations() {
  const xsOf = n => ({ 2: [.2, .45], 3: [.18, .32, .47], 4: [.17, .28, .38, .48], 5: [.16, .24, .32, .4, .48] })[n];
  const ysOf = n => n === 1 ? [.5] : n === 2 ? [.34, .66] : Array.from({ length: n }, (_, i) => .08 + .84 * i / (n - 1));
  const build = lines => { const xs = xsOf(lines.length), out = [['G', lines.length > 2 ? .02 : .04, .5, 1]]; let num = 2;
    lines.forEach((n, li) => ysOf(n).forEach(y => out.push([String(num++), xs[li], y]))); return out; };
  const add = (fmt, name, lines) => { Formations[fmt] = Formations[fmt] || {}; if (!Formations[fmt][name]) Formations[fmt][name] = build(lines); };
  // football à 11
  [['4-1-4-1', [4, 1, 4, 1]], ['4-3-2-1 (sapin)', [4, 3, 2, 1]], ['4-3-1-2', [4, 3, 1, 2]], ['4-4-2 losange', [4, 1, 2, 1, 2]], ['4-2-2-2', [4, 2, 2, 2]], ['4-5-1', [4, 5, 1]],
    ['4-4-1-1', [4, 4, 1, 1]], ['4-2-4', [4, 2, 4]], ['4-1-3-2', [4, 1, 3, 2]], ['4-2-1-3', [4, 2, 1, 3]], ['4-1-2-1-2', [4, 1, 2, 1, 2]],
    ['3-5-2', [3, 5, 2]], ['3-4-3', [3, 4, 3]], ['3-4-1-2', [3, 4, 1, 2]], ['3-4-2-1', [3, 4, 2, 1]], ['3-1-4-2', [3, 1, 4, 2]], ['3-3-3-1', [3, 3, 3, 1]], ['3-6-1', [3, 6, 1]], ['3-5-1-1', [3, 5, 1, 1]],
    ['5-3-2', [5, 3, 2]], ['5-4-1', [5, 4, 1]], ['5-2-3', [5, 2, 3]], ['5-2-1-2', [5, 2, 1, 2]], ['5-3-1-1', [5, 3, 1, 1]]].forEach(([n, l]) => add('11', n, l));
  // football à 8 (7 joueurs de champ)
  [['2-4-1', [2, 4, 1]], ['3-1-2-1', [3, 1, 2, 1]], ['3-2-1-1', [3, 2, 1, 1]], ['2-3-1-1', [2, 3, 1, 1]], ['2-1-3-1', [2, 1, 3, 1]], ['1-3-2-1', [1, 3, 2, 1]]].forEach(([n, l]) => add('8', n, l));
  // football à 5 (4 joueurs de champ)
  [['2-1-1', [2, 1, 1]], ['1-1-2', [1, 1, 2]], ['3-1', [3, 1]], ['1-3', [1, 3]]].forEach(([n, l]) => add('5', n, l));
  // the other sports: [label, x, y, gk, positions that fit]
  const more = {
    b5: { '1-4 haut': [['1', .6, .5, 0, ['MEN']], ['2', .75, .1, 0, ['ARR']], ['3', .75, .9, 0, ['AIL']], ['4', .8, .38, 0, ['AF']], ['5', .8, .62, 0, ['PIV']]],
      '4 extérieurs - 1 intérieur': [['1', .62, .5, 0, ['MEN']], ['2', .7, .12, 0, ['ARR']], ['3', .7, .88, 0, ['AIL']], ['4', .9, .05, 0, ['AF', 'AIL']], ['5', .9, .55, 0, ['PIV']]],
      '5 extérieurs': [['1', .6, .5, 0, ['MEN']], ['2', .68, .15, 0, ['ARR']], ['3', .68, .85, 0, ['AIL']], ['4', .92, .05, 0, ['AF']], ['5', .92, .95, 0, ['PIV', 'AF']]],
      'Triangle (2 intérieurs)': [['1', .62, .5, 0, ['MEN']], ['2', .7, .1, 0, ['ARR']], ['3', .7, .9, 0, ['AIL']], ['4', .88, .35, 0, ['AF']], ['5', .9, .65, 0, ['PIV']]],
      'Homme à homme (défense)': [['1', .35, .5, 0, ['MEN']], ['2', .25, .15, 0, ['ARR']], ['3', .25, .85, 0, ['AIL']], ['4', .15, .35, 0, ['AF']], ['5', .12, .62, 0, ['PIV']]],
      'Zone 2-3': [['1', .24, .35, 0, ['MEN', 'ARR']], ['2', .24, .65, 0, ['ARR', 'AIL']], ['3', .1, .15, 0, ['AIL', 'AF']], ['4', .08, .5, 0, ['PIV']], ['5', .1, .85, 0, ['AF']]],
      'Zone 3-2': [['1', .28, .5, 0, ['MEN']], ['2', .22, .15, 0, ['ARR']], ['3', .22, .85, 0, ['AIL']], ['4', .09, .35, 0, ['AF', 'PIV']], ['5', .09, .65, 0, ['PIV']]],
      'Zone 1-3-1': [['1', .3, .5, 0, ['MEN']], ['2', .2, .12, 0, ['ARR']], ['3', .18, .5, 0, ['PIV', 'AF']], ['4', .2, .88, 0, ['AIL']], ['5', .07, .5, 0, ['PIV', 'AF']]],
      'Box and one': [['1', .3, .45, 0, ['MEN', 'ARR']], ['2', .22, .32, 0, ['ARR']], ['3', .22, .68, 0, ['AIL']], ['4', .09, .32, 0, ['AF']], ['5', .09, .68, 0, ['PIV']]] },
    h7: { '2-4 (deux pivots)': [['G', .03, .5, 1, ['GB']], ['AG', .9, .04, 0, ['AIG', 'AIL']], ['ArG', .7, .3, 0, ['ARG', 'ARR']], ['ArD', .7, .7, 0, ['ARD', 'ARR']], ['AD', .9, .96, 0, ['AID', 'AIL']], ['P1', .88, .4, 0, ['PIV']], ['P2', .88, .6, 0, ['PIV', 'DC']]],
      '1-5 (défense)': [['G', .03, .5, 1, ['GB']], ['Av', .26, .5, 0, ['DC', 'ARR']], ['1', .18, .08, 0, ['AIL']], ['2', .16, .3, 0, ['ARR']], ['3', .15, .5, 0, ['PIV']], ['4', .16, .7, 0, ['ARR']], ['5', .18, .92, 0, ['AIL']]],
      '3-2-1 (défense)': [['G', .03, .5, 1, ['GB']], ['Pte', .3, .5, 0, ['DC']], ['2', .24, .3, 0, ['ARR']], ['3', .24, .7, 0, ['ARR']], ['4', .16, .1, 0, ['AIL']], ['5', .15, .5, 0, ['PIV']], ['6', .16, .9, 0, ['AIL']]],
      '5+1 (défense)': [['G', .03, .5, 1, ['GB']], ['Ind', .3, .4, 0, ['ARR']], ['1', .18, .1, 0, ['AIL']], ['2', .16, .32, 0, ['ARR']], ['3', .15, .5, 0, ['PIV']], ['4', .16, .68, 0, ['ARR']], ['5', .18, .9, 0, ['AIL']]],
      '4+2 (défense)': [['G', .03, .5, 1, ['GB']], ['I1', .28, .35, 0, ['ARR']], ['I2', .28, .65, 0, ['ARR']], ['1', .17, .15, 0, ['AIL']], ['2', .15, .4, 0, ['PIV']], ['3', .15, .6, 0, ['PIV']], ['4', .17, .85, 0, ['AIL']]] },
    r15: { 'Défense en ligne': Array.from({ length: 15 }, (_, i) => [String(i + 1), i === 14 ? .2 : i === 8 ? .4 : .44, i === 14 ? .5 : .05 + .9 * (i < 8 ? i : i - 1) / 13, 0, [i < 3 ? 'PIL' : i < 5 ? 'DL' : i < 8 ? 'FL' : i === 8 ? 'DM' : i === 9 ? 'DO' : i < 12 ? 'CEN' : i < 14 ? 'AIL' : 'ARR']]),
      'Mêlée offensive': [['1', .47, .46, 0, ['PIL']], ['2', .47, .5, 0, ['TAL']], ['3', .47, .54, 0, ['PIL']], ['4', .455, .48, 0, ['DL']], ['5', .455, .52, 0, ['DL']], ['6', .445, .44, 0, ['FL']], ['7', .445, .56, 0, ['FL']], ['8', .44, .5, 0, ['N8']],
        ['9', .45, .4, 0, ['DM']], ['10', .38, .33, 0, ['DO']], ['12', .35, .26, 0, ['CEN']], ['13', .32, .19, 0, ['CEN']], ['14', .3, .1, 0, ['AIL']], ['11', .38, .9, 0, ['AIL']], ['15', .2, .5, 0, ['ARR']]] },
    v6: { 'Rotation 3 (passeur en 5)': [['4', .44, .3, 0, ['CEN']], ['3', .44, .5, 0, ['R4']], ['2', .44, .7, 0, ['OPP']], ['5', .25, .3, 0, ['PAS']], ['6', .25, .5, 0, ['R4']], ['1', .25, .7, 0, ['CEN', 'LIB']]],
      'Rotation 4 (passeur en 4)': [['4', .44, .3, 0, ['PAS']], ['3', .44, .5, 0, ['R4']], ['2', .44, .7, 0, ['CEN']], ['5', .25, .3, 0, ['OPP']], ['6', .25, .5, 0, ['CEN', 'LIB']], ['1', .25, .7, 0, ['R4']]],
      'Rotation 5 (passeur en 3)': [['4', .44, .3, 0, ['R4']], ['3', .44, .5, 0, ['PAS']], ['2', .44, .7, 0, ['OPP']], ['5', .25, .3, 0, ['CEN', 'LIB']], ['6', .25, .5, 0, ['R4']], ['1', .25, .7, 0, ['CEN']]],
      'Rotation 6 (passeur en 2)': [['4', .44, .3, 0, ['CEN']], ['3', .44, .5, 0, ['R4']], ['2', .44, .7, 0, ['PAS']], ['5', .25, .3, 0, ['R4']], ['6', .25, .5, 0, ['OPP']], ['1', .25, .7, 0, ['CEN', 'LIB']]],
      'Réception à 3': [['4', .44, .25, 0, ['CEN']], ['P', .42, .62, 0, ['PAS']], ['2', .44, .85, 0, ['OPP']], ['R1', .22, .2, 0, ['R4']], ['L', .2, .5, 0, ['LIB']], ['R2', .22, .8, 0, ['R4']]],
      'Réception à 4': [['P', .42, .7, 0, ['PAS']], ['A', .44, .2, 0, ['CEN']], ['R1', .28, .15, 0, ['R4']], ['R2', .22, .4, 0, ['LIB']], ['R3', .22, .62, 0, ['R4']], ['R4', .28, .86, 0, ['OPP']]] },
  };
  Object.entries(more).forEach(([f, list]) => { Formations[f] = Formations[f] || {}; Object.entries(list).forEach(([n, rows]) => { if (!Formations[f][n]) Formations[f][n] = rows; }); });
})();
// The systems of a format in sub-categories, for the menus: football by the number of defenders, the other sports by attack / defence
function formationGroups(fmt) {
  const names = Object.keys(Formations[fmt] || {}), groups = {};
  const foot = ['11', '8', '5'].includes(fmt);
  names.forEach(n => {
    const g = foot ? `Défense à ${n[0]}` : /^v/.test(fmt) ? (/réception/i.test(n) ? 'Réception' : 'Rotations') : /défense|zone|box|homme|0-6|1-5|3-2-1|5\+1|4\+2/i.test(n) ? 'Défense' : 'Attaque / lancement';
    (groups[g] = groups[g] || []).push(n);
  });
  return Object.entries(groups).sort((a, b) => foot ? (+b[0].slice(-1) === 4 ? 1 : 0) - (+a[0].slice(-1) === 4 ? 1 : 0) || a[0].localeCompare(b[0]) : a[0].localeCompare(b[0]));
}
function formationOptions(fmt, sel) {
  const e = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  return formationGroups(fmt).map(([g, ns]) => `<optgroup label="${e(g)} (${ns.length})">${ns.map(n => `<option ${n === sel ? 'selected' : ''}>${e(n)}</option>`).join('')}</optgroup>`).join('');
}

/* Example content so the app opens in a working state. Everything is marked « exemple » and can be deleted. */
const Seed = {
  schema(name, format, extra = {}) {
    return Object.assign({ id: Store.uid(), name, field: { format, view: 'full' }, overlays: {}, objects: [], zones: [], steps: [{ pos: {}, arrows: [], moves: {}, note: '', dur: 2 }] }, extra);
  },
  addObj(sc, o, positions) {
    o.id = o.id || Store.uid(); sc.objects.push(o);
    sc.steps.forEach((st, i) => st.pos[o.id] = (positions[i] || positions[positions.length - 1]).slice());
    return o.id;
  },
  fill(state) {
    const uid = Store.uid, now = Date.now();
    const u11 = { id: uid(), name: 'U11 A (exemple)', category: 'U11', format: '8', example: true, updatedAt: now,
      players: ['Adam', 'Bilal', 'Chris', 'Dylan', 'Enzo', 'Farès', 'Gabin', 'Hugo', 'Ilyes', 'Jules'].map((n, i) => ({ id: uid(), name: n, number: i + 1, pos: i === 0 ? 'GB' : i < 4 ? 'DEF' : i < 8 ? 'MIL' : 'ATT' })) };
    const sen = { id: uid(), name: 'Seniors A (exemple)', category: 'Seniors', format: '11', example: true, updatedAt: now,
      players: Array.from({ length: 14 }, (_, i) => ({ id: uid(), name: 'Joueur ' + (i + 1), number: i + 1, pos: i === 0 ? 'GB' : i < 5 ? 'DEF' : i < 10 ? 'MIL' : 'ATT' })) };
    state.teams.push(u11, sen);

    // Example 1 · foot à 8 : passe et suit dans un carré
    const s1 = Seed.schema('Passe et suis (exemple)', 'zone', { field: { format: 'zone', view: 'full', w: 24, h: 16 } });
    s1.steps[0].note = 'A a le ballon, chaque joueur attend sur son plot';
    s1.steps.push({ pos: {}, arrows: [], moves: {}, note: 'A passe à B', dur: 1.6 }, { pos: {}, arrows: [], moves: {}, note: 'A suit son ballon, B passe à C', dur: 1.8 });
    [[4, 3], [20, 3], [20, 13], [4, 13]].forEach(c => Seed.addObj(s1, { type: 'cone', color: 'orange' }, [c]));
    Seed.addObj(s1, { type: 'player', color: 'bordeaux', label: 'A' }, [[4, 3], [4, 3], [17.5, 3]]);
    Seed.addObj(s1, { type: 'player', color: 'bordeaux', label: 'B' }, [[20, 3]]);
    Seed.addObj(s1, { type: 'player', color: 'bordeaux', label: 'C' }, [[20, 13]]);
    Seed.addObj(s1, { type: 'ball' }, [[5.3, 4], [21.3, 4], [21.3, 14]]);

    // Example 2 · foot à 11 : sortie à 3 (le 6 descend, les latéraux deviennent pistons)
    const s2 = Seed.schema('Sortie à 3 : 4-1-2-3 → 3-4-3 (exemple)', '11', { overlays: { lanes: true, phases: true } });
    s2.steps.push({ pos: {}, arrows: [], moves: {}, note: 'Avec ballon : le 6 descend entre les centraux, les latéraux montent en pistons', dur: 2.6 });
    s2.steps[0].note = 'Sans ballon : 4-1-2-3';
    const L = 105, W = 68, f1 = Formations['11']['4-1-2-3 (sans ballon)'], f2 = Formations['11']['3-4-3 (avec ballon)'];
    f1.forEach(([lab, x, y, gk]) => {
      const t = f2.find(q => q[0] === lab);
      Seed.addObj(s2, { type: 'player', color: 'bordeaux', label: lab, gk: !!gk }, [[x * L, y * W], [t[1] * L, t[2] * W]]);
    });
    const gk = s2.objects.find(o => o.label === 'G').id;
    const six = s2.objects.find(o => o.label === '6').id, near = p => [p[0] + 2.4, p[1] + 1.6];
    Seed.addObj(s2, { type: 'ball' }, [near(s2.steps[0].pos[gk]), near(s2.steps[1].pos[six])]);
    Formations['11']['4-3-3'].forEach(([lab, x, y, g]) => Seed.addObj(s2, { type: 'player', color: g ? 'orange' : 'blanc', label: g ? 'G' : '', gk: !!g }, [[(1 - x * .8) * L, (1 - y) * W]]));
    s2.overlays.bloc = true;
    s2.updatedAt = now; s1.updatedAt = now; s1.example = s2.example = true;
    state.schemas.push(s1, s2);

    const d = new Date(); const iso = x => x.toISOString().slice(0, 10);
    const next = new Date(d.getTime() + 3 * 864e5), prev = new Date(d.getTime() - 4 * 864e5);
    state.trainings.push({ id: uid(), teamId: u11.id, date: iso(d), time: '18:00', title: 'Passes et déplacements (exemple)', updatedAt: now, presents: [],
      exercises: [{ id: uid(), title: 'Passe et suis', duration: 15, org: 'Carré de 24 × 16 m, 4 plots, 3 joueurs par carré, 1 ballon.', consignes: 'Passe au sol\nJe suis mon ballon\nJe parle à mon partenaire', materiel: '4 plots, 1 ballon par carré', schemaId: s1.id }] });
    state.matches.push(
      { id: uid(), teamId: u11.id, date: iso(prev), time: '10:00', opponent: 'US Exemple', home: true, competition: 'Plateau', place: 'Stade municipal', rdv: '09:15', played: true, gf: 3, ga: 1, convoked: u11.players.map(p => p.id), stats: { [u11.players[8].id]: { g: 2, a: 0 }, [u11.players[9].id]: { g: 1, a: 1 } }, notes: '', updatedAt: now },
      { id: uid(), teamId: u11.id, date: iso(next), time: '10:30', opponent: 'AS Exemple', home: false, competition: 'Championnat', place: '', rdv: '09:30', played: false, gf: 0, ga: 0, convoked: [], stats: {}, notes: '', updatedAt: now });
    state.ui.teamId = u11.id;
  },
};
