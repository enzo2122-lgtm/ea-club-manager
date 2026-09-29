/* Store: the whole club lives in one object, saved in IndexedDB on the device.
   Sharing between coaches goes through export/import of a .json file (AirDrop, WhatsApp, mail). */
const Store = (() => {
  const DB = 'ea-club-manager', OS = 'kv', KEY = 'state';
  const COLS = ['teams', 'players', 'staff', 'schemas', 'trainings', 'matches', 'reports'];
  let state = null, saveTimer = null;
  const listeners = new Set();
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function idb() {
    return new Promise((res, rej) => {
      const rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore(OS);
      rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
    });
  }
  async function idbGet(k) {
    const db = await idb();
    return new Promise((res, rej) => { const t = db.transaction(OS).objectStore(OS).get(k); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); });
  }
  async function idbPut(k, v) {
    const db = await idb();
    return new Promise((res, rej) => { const t = db.transaction(OS, 'readwrite'); t.objectStore(OS).put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); });
  }

  function blank() {
    return { version: 2, club: { name: '', homeBib: 'bleu', awayBib: 'blanc', brand: 1 }, ui: {}, teams: [], players: [], staff: [], schemas: [], trainings: [], matches: [], reports: [] };
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
    try { state = await idbGet(KEY); } catch (e) { state = null; }
    if (!state) { try { state = JSON.parse(localStorage.getItem(KEY)); } catch (e) { state = null; } }
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
  const get = (col, id) => state[col].find(x => x.id === id);
  function upsert(col, item) {
    item.updatedAt = Date.now();
    // who changed a match or a session: he is not notified of his own change (club server)
    if ((col === 'matches' || col === 'trainings') && typeof Auth !== 'undefined' && Auth.current()) item.editedBy = Auth.current().id;
    const i = state[col].findIndex(x => x.id === item.id);
    if (i < 0) state[col].push(item); else state[col][i] = item;
    if (col === 'teams') sortTeams();
    save(); return item;
  }
  function remove(col, id) { state[col] = state[col].filter(x => x.id !== id); save(); }

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
    return own.concat(state.players.filter(p => !ownIds.has(p.id) && (p.teamIds || []).some(id => fam.has(id))).sort(byName));
  }
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
  const matchKind = () => (state && state.ui && state.ui.matchKind) || 'off';
  const kindOk = m => isFriendly(m) === (matchKind() === 'ami');

  return {
    load, save, persistNow, sortTeams, get, upsert, remove, uid, exportAll, exportTraining, exportSchema, importText, reset, removeExamples,
    playersOf, rosterOf, staffOf, fullName, shortName, byName, isMain, isSub, teamGroups, teamLabel, isFriendly, matchKind, kindOk,
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
  '5': {
    '2-2': [['G', .04, .5, 1], ['2', .2, .28], ['3', .2, .72], ['4', .4, .28], ['5', .4, .72]],
    '1-2-1': [['G', .04, .5, 1], ['2', .17, .5], ['3', .3, .2], ['4', .3, .8], ['5', .43, .5]],
  },
};

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
