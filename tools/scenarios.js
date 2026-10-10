/* Scénarios joués dans un vrai navigateur (Chrome ou Edge, sans fenêtre) avant chaque publication :
     node tools/scenarios.js            (lance son propre petit serveur sur le port 8797)
     node tools/scenarios.js --crawl                      (en plus : toutes les pages, tous les boutons, sur le club de démonstration)
     node tools/scenarios.js --donnees copie.json         (le parcours sur une copie des vraies données d'un club : sauvegarde de l'appli
                                                           ou lignes du serveur ; le serveur est bloqué, rien ne sort de l'ordinateur ;
                                                           la copie ne doit jamais être mise dans le dépôt : données personnelles)
   Chaque scénario ouvre le club de démonstration, fait ce qu'un coach fait (ouvrir un match, convoquer, jour J, séance, réglages…)
   et vérifie le résultat. Toute erreur JavaScript de l'appli fait échouer le scénario. Rien n'est envoyé à un serveur.
   Sans dépendance : Chrome est piloté par son protocole de débogage (WebSocket de Node). */
const { spawn, execSync } = require('child_process'), fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const ROOT = path.join(__dirname, '..'), PORT = 8797, DBG = 9339;
const BROWSERS = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', process.env.CHROME || ''].filter(Boolean);
const DEMO = fs.existsSync(path.join(ROOT, 'demo', 'foot', 'index.html')) ? `http://localhost:${PORT}/demo/foot/` : `http://localhost:${PORT}/verif-app.html?demo=1`;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = url => new Promise((res, rej) => http.get(url, r => { let s = ''; r.on('data', d => s += d); r.on('end', () => res(s)); }).on('error', rej));

/* ---------- the browser, through its debugging protocol ---------- */
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.waiting = new Map(); this.events = []; ws.onmessage = e => this.onMsg(JSON.parse(e.data)); }
  onMsg(m) { if (m.id && this.waiting.has(m.id)) { const w = this.waiting.get(m.id); this.waiting.delete(m.id); m.error ? w.rej(new Error(m.error.message)) : w.res(m.result); } else if (m.method) this.events.push(m); }
  send(method, params = {}, sessionId) { const id = ++this.id; return new Promise((res, rej) => { this.waiting.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params, sessionId })); }); }
}
async function openBrowser() {
  const exe = BROWSERS.find(p => fs.existsSync(p)); if (!exe) throw new Error('Chrome ou Edge introuvable');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'clubbo-scen-'));
  const proc = spawn(exe, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', ...(process.getuid && process.getuid() === 0 ? ['--no-sandbox'] : []), '--window-size=540,960', '--remote-debugging-port=' + DBG, '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });
  let info; for (let i = 0; i < 50 && !info; i++) { try { info = JSON.parse(await get(`http://127.0.0.1:${DBG}/json/version`)); } catch (e) { await sleep(200); } }
  if (!info) { proc.kill(); throw new Error('le navigateur ne répond pas'); }
  const ws = new WebSocket(info.webSocketDebuggerUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  return { proc, profile, cdp: new CDP(ws) };
}

/* ---------- one page per scenario ---------- */
async function page(cdp) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Runtime.enable', {}, sessionId); await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 540, height: 960, deviceScaleFactor: 1, mobile: true }, sessionId);
  const errors = () => cdp.events.filter(e => e.sessionId === sessionId && (e.method === 'Runtime.exceptionThrown' || (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error')))
    .map(e => e.method === 'Runtime.exceptionThrown' ? (e.params.exceptionDetails.exception || {}).description || e.params.exceptionDetails.text : e.params.args.map(a => a.value || a.description || '').join(' '));
  const evalIn = async (expr) => {
    const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sessionId);
    if (r.exceptionDetails) throw new Error('dans la page : ' + ((r.exceptionDetails.exception || {}).description || r.exceptionDetails.text).split('\n')[0]);
    return r.result.value;
  };
  const goto = async (url) => { await cdp.send('Page.navigate', { url }, sessionId); await sleep(2500); };
  const close = () => cdp.send('Target.closeTarget', { targetId });
  return { evalIn, goto, errors, close };
}

/* ---------- helpers injected in the page ---------- */
const H = `
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const guide = () => $$('button').filter(b => /J'ai compris|C'est parti/.test(b.innerText)).forEach(b => b.click());
  const go = async h => { location.hash = h; await wait(900); guide(); await wait(200); };
  const click = async (sel, ms = 500) => { const b = $(sel); if (!b) throw new Error('bouton absent : ' + sel); b.click(); await wait(ms); return b; };
  const text = sel => (($(sel) || {}).innerText || '').trim();
  const must = (ok, msg) => { if (!ok) throw new Error(msg); };
  const modal = () => $('#modal');
  const closeModal = async () => { $$('#modal button').filter(b => /Annuler|Fermer/.test(b.innerText)).forEach(b => b.click()); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await wait(300); };
`;

/* ---------- the scenarios ---------- */
const SCENARIOS = [
  ['Préparation du match : PDF complet (toutes les parties)', `
    const m = Store.state.matches.filter(x => !x.played && !x.exempt && x.date >= UI.today()).sort((a, b) => a.date.localeCompare(b.date))[0]; must(m, 'aucun match à venir');
    m.prep = { talk: { objective: 'Gagner', keys: ['Presser', 'Courir', 'Parler'], hook: 'Allez' }, day: { warmMin: 25 } };
    m.lineupId = null; m.acLineup = { starters: (m.convoked || []).slice(0, 7), bench: [] }; m.numbers = { [m.convoked[0]]: 42, [m.convoked[3]]: 2 }; const pp = Store.get('players', m.convoked[1]); pp.posts = ['DD']; Store.upsert('players', pp); Store.upsert('matches', m);
    window.__rows = []; const tb = Exporter.pdfDoc;
    window.__lbl = []; const mk = Exporter.pdfDoc; Exporter.pdfDoc = c => { const d = mk(c), l = d.label, tt = d.table; d.label = x => { window.__lbl.push(x); return l.call(d, x); }; d.table = (h, r, w) => { window.__rows.push(...r); return tt.call(d, h, r, w); }; return d; };
    Exporter.deliver = async (b) => { window.__pdf = b; return 'shared'; }; await go('#/matchs'); await go('#/prepa/' + m.id);
    if (!window.jspdf) { const sc = document.createElement('script'); sc.src = '/node_modules/jspdf/dist/jspdf.umd.min.js'; document.head.appendChild(sc); await wait(1500); } // hors ligne : copie locale si elle existe
    let t = '';
    for (let n = 0; n < 4; n++) {
      await click('[data-pa="print"]', 600); $$('#modal [data-part]').forEach(x => { x.checked = true; });
      const ok = $$('#modal button').find(b => /Créer le PDF/.test(b.innerText)); must(ok, 'pas de bouton « Créer le PDF »'); ok.click(); await wait(4000);
      t = text('#toast'); if (!/se prépare/.test(t)) break; await wait(2500);
    }
    must(!/impossible/i.test(t), t); must(window.__lbl.some(x => /^(Remplaçants|Joueurs convoqués)/.test(x)), 'pas de liste des joueurs dans le PDF');
    must(window.__rows.some(r => r[0] === '42'), 'numéro du match absent du PDF');
    const tit = window.__rows.slice(0, 7).map(r => +r[0] || 999); must(tit.every((n, i) => !i || n >= tit[i - 1]), 'titulaires pas dans l’ordre des numéros : ' + tit.join(','));
    must(!window.__rows.some(r => r[2] && /^[A-Z]{2,3}$/.test(r[2])), 'poste en abréviation : ' + window.__rows.filter(r => /^[A-Z]{2,3}$/.test(r[2] || '')).map(r => r[2]).join(','));
    return 'PDF créé · ' + window.__lbl.filter(x => /Titulaires|Remplaçants|convoqués/.test(x)).join(' · ');`],
  ['Accueil : prochain rendez-vous et menu', `
    guide(); must($('.today-card'), 'pas de carte « Prochain rendez-vous »');
    must($('#nav a'), 'pas de menu'); must(matchMedia('(max-width: 760px)').matches, 'largeur téléphone attendue');
    must($('#quickFab'), 'pas de bouton +'); return text('.today-card').slice(0, 60);`],
  ['Matchs : liste, fiche, un seul bouton principal', `
    await go('#/matchs'); must($$('a[href^="#/match/"]').length > 0, 'aucun match listé');
    const first = $$('a[href^="#/match/"]')[0].getAttribute('href'); await go(first);
    const heads = $$('.page-head .head-actions > *'); must(heads.length <= 2, 'trop de boutons en tête : ' + heads.length);
    must($('.more-acts'), 'pas de menu ⋯'); return first;`],
  ['Convocation : vider, reprendre « comme au dernier match », envoyer', `
    const m = Store.state.matches.filter(x => !x.played && !x.exempt && x.date >= UI.today()).sort((a, b) => a.date.localeCompare(b.date))[0]; must(m, 'aucun match à venir');
    m.convoked = []; Store.upsert('matches', m); await go('#/matchs'); await go('#/match/' + m.id);
    must(text('.section').startsWith('Convoqués (0)'), 'devrait afficher 0 convoqué : ' + text('.section'));
    await click('[data-act="sameconv"]'); const n = (Store.get('matches', m.id).convoked || []).length; must(n > 0, 'rien repris');
    await click('[data-act="convoc"]', 800); must(modal() || Store.get('matches', m.id).convSent, 'envoi non déclenché'); await closeModal(); return n + ' convoqués';`],
  ['Jour de match : qui est là, absent noté', `
    const m = Store.state.matches.filter(x => !x.played && !x.exempt && x.date >= UI.today()).sort((a, b) => a.date.localeCompare(b.date))[0];
    m.date = UI.today(); m.absents = []; Store.upsert('matches', m); await go('#/matchs'); await go('#/jourj/' + m.id);
    must($$('.md-who .chip').length > 0, 'pas de liste « Qui est là ? »');
    await click('.md-who .chip'); must((Store.get('matches', m.id).absents || []).length === 1, 'absent non noté');
    await click('.md-who .chip.abs'); must((Store.get('matches', m.id).absents || []).length === 0, 'absent non retiré'); return 'ok';`],
  ['Séances : liste, fiche pliée, PDF en tête', `
    await go('#/entrainements'); const a = $$('a[href^="#/entrainement/"]')[0]; must(a, 'aucune séance');
    await go(a.getAttribute('href')); must($('.tr-more'), 'objectif et groupe non pliés'); must($('[data-act="pdf"]'), 'pas de bouton PDF');
    return (text('h1') || text('.page-head')).slice(0, 40);`],
  ['Le + : reprendre la dernière séance', `
    await go('#/entrainements'); await click('#quickFab', 600); must($('[data-t="last"]'), 'pas de « Reprendre la dernière séance »');
    await click('[data-t="last"]', 700); must(/Reprendre/.test(text('#modal h2')), 'mauvaise fenêtre : ' + text('#modal h2'));
    const d = $('#cpDate').value; must(d >= UI.today(), 'date passée proposée'); await closeModal(); return d;`],
  ['Joueurs : liste, fiche, nouveau joueur par le +', `
    await go('#/joueurs'); must($$('[data-person]').length > 0, 'aucun joueur'); await click('#quickFab', 600);
    must(/Nouveau joueur/.test(text('#modal h2')), 'le + devrait ouvrir « Nouveau joueur »'); await closeModal();
    const id = $('[data-person]').dataset.person; await go('#/joueur/' + id); must($('.page-head'), 'fiche joueur vide'); return id;`],
  ['Équipes et dirigeants : ajouter un éducateur', `
    await go('#/equipes'); must($$('a[href^="#/equipe/"]').length > 0, 'aucune catégorie');
    await go('#/dirigeants'); await click('[data-act="new"]', 500); must(/éducateur/i.test(text('#modal h2')), 'fiche éducateur non ouverte'); await closeModal(); return 'ok';`],
  ['Schémas : nouveau schéma, retour', `
    await go('#/schemas'); await click('#quickFab', 800); const h = location.hash;
    must(modal() || /#\\/schema\\//.test(h), 'rien ne s\\'ouvre'); await closeModal(); await go('#/schemas'); return h;`],
  ["Messages, planning, stats, vie du club : s'affichent", `
    for (const p of ['#/messages', '#/planning', '#/stats', '#/club', '#/bibliotheque', '#/chat']) { await go(p); must($('#view').innerText.trim().length > 20, 'page vide : ' + p); }
    return 'ok';`],
  ['Gestion du club : À faire et tuiles', `
    await go('#/gestion'); must($('.g-tile'), 'pas de tuiles'); must(/À faire/.test($('#view').innerText), 'pas de « À faire »');
    await click('[data-g="newstaff"]', 500); must(/éducateur/i.test(text('#modal h2')), 'ajout éducateur non ouvert'); await closeModal(); return $$('.list-item').length + ' points';`],
  ['Réglages : deux onglets, avancé plié', `
    await go('#/reglages'); must($$('.set-tabs .chip').length === 2, 'pas deux onglets');
    await click('[data-stab="club"]'); must(!$$('.set-pane')[1].hidden, 'onglet club caché'); must($('.set-pane:not([hidden]) details.fold'), 'pas de « Avancé »');
    await click('[data-stab="moi"]'); must(!$$('.set-pane')[0].hidden, 'onglet moi caché'); return 'ok';`],
  ['Synchro : fusion à trois (base, moi, eux)', `
    const b = { id: 'm1', updatedAt: 1, convoked: ['a', 'b'], prep: {}, gf: 0, notes: 'x', minutes: { a: 60 } };
    const mine = { id: 'm1', updatedAt: 5, convoked: ['a', 'b', 'c'], prep: { talk: { objective: 'Gagner' } }, gf: 0, notes: 'x', minutes: { a: 60 } };
    const theirs = { id: 'm1', updatedAt: 3, convoked: ['a'], prep: {}, lineupId: 'sc1', gf: 2, notes: 'x', minutes: { a: 60, b: 30 } };
    const r = Sync.merged(b, mine, theirs);
    must(r.prep && r.prep.talk && r.prep.talk.objective === 'Gagner', 'la causerie de mon côté est perdue');
    must(r.lineupId === 'sc1', 'la compo de leur côté est perdue');
    must(r.convoked.join(',') === 'a,c', 'convoqués : attendu a,c (b retiré par eux, c ajouté par moi), obtenu ' + r.convoked.join(','));
    must(r.gf === 2 && r.minutes.b === 30 && r.minutes.a === 60, 'score ou minutes perdus');
    must(r.updatedAt === 5, 'updatedAt');
    // without any base (old device): what one side has and the other lacks is kept
    const r2 = Sync.merged(null, { id: 'm1', updatedAt: 9, prep: { talk: { objective: 'Tenir' } } }, { id: 'm1', updatedAt: 8, lineupId: 'sc2', prep: {} });
    must(r2.prep.talk.objective === 'Tenir' && r2.lineupId === 'sc2', 'fusion sans base');
    // a list of exercises with ids: edited here, extended there
    const r3 = Sync.merged({ id: 't', exercises: [{ id: 'e1', title: 'A', duration: 10 }] }, { id: 't', updatedAt: 2, exercises: [{ id: 'e1', title: 'A', duration: 15 }] }, { id: 't', updatedAt: 3, exercises: [{ id: 'e1', title: 'A', duration: 10 }, { id: 'e2', title: 'B', duration: 5 }] });
    must(r3.exercises.length === 2 && r3.exercises[0].duration === 15 && r3.exercises[1].id === 'e2', 'exercices : ' + JSON.stringify(r3.exercises));
    return 'ok';`],
  ['Hors connexion : le bandeau', `
    document.body.classList.add('offline'); const c = getComputedStyle(document.body, '::before').content; document.body.classList.remove('offline');
    must(/Hors connexion/.test(c), 'pas de bandeau'); return 'ok';`],
];

/* ---------- crawl: every page, every button (option --crawl) ---------- */
const CRAWL = `
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const appJs = await (await fetch('js/app.js', { cache: 'no-store' })).text();
  const routes = [...new Set([...appJs.slice(appJs.indexOf("const fn = { '': Views.home")).split('}[name]')[0].matchAll(/(?:^|[\\s,{])(\\w+):/g)].map(m => m[1]))].filter(r => r !== 'r' && r !== 'x' && r !== 'schema' && r !== 'tableau');
  const S = Store.state, up = S.matches.find(m => !m.played), played = S.matches.find(m => m.played), tr = S.trainings.find(t => !t.model), team = S.teams[0], pl = S.players[0];
  const withId = { equipe: team, joueur: pl, entrainement: tr, match: up, prepa: up, direct: up, jourj: up, codes: team, progression: pl, tests: team, bilan: team };
  let rs = ['', ...routes, ...Object.entries(withId).filter(([, o]) => o).map(([r, o]) => r + '/' + o.id), ...(played ? ['match/' + played.id] : [])];
  const ALL = window.__crawlAll, STEPS = ['semaine', 'adversaire', 'plan', 'causerie', 'jourj', 'mitemps', 'apres'];
  const today = new Date().toISOString().slice(0, 10), hot = new Set(S.matches.filter(m => m.prep || m.lineupId || (m.date || '') >= today).map(m => m.id));
  if (ALL) rs = [...rs, ...S.matches.flatMap(m => ['match/' + m.id, 'jourj/' + m.id, 'direct/' + m.id, ...(hot.has(m.id) ? STEPS.map(s => 'prepa/' + m.id + '/' + s) : ['prepa/' + m.id])]),
    ...S.teams.flatMap(t => ['equipe/' + t.id, 'codes/' + t.id, 'tests/' + t.id, 'bilan/' + t.id]), ...S.trainings.map(t => 'entrainement/' + t.id),
    ...S.players.flatMap(p => ['joueur/' + p.id, 'progression/' + p.id])];
  const MAXC = r => !ALL ? 25 : /^(joueur|progression)[/]/.test(r) ? 0 : /^(match|prepa|jourj|equipe)[/]/.test(r) && (r.startsWith('equipe') || hot.has(r.split('/')[1])) ? 12 : 2;
  HTMLAnchorElement.prototype.click = function () {}; window.open = () => null; window.print = () => {};
  const d = document, modalOpen = () => { const m = d.getElementById('modal'); return m && !m.hidden; };
  const closeAll = async () => { d.querySelectorAll('.pp-show [data-pp="close"], .an-show [data-b="close"], .an-show .x').forEach(x => x.click()); for (let k = 0; k < 4 && modalOpen(); k++) { const x = d.querySelector('#modal .x, #modal [aria-label="Fermer"], #modal [data-close]'); if (x) x.click(); else d.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(80); } const m = d.getElementById('modal'); if (m) m.hidden = true; d.querySelectorAll('.rs-back, .link-gate').forEach(x => x.remove()); };
  const SKIP = /supprim|delete|trash|danger|logout|sortir|déconnect|reset|réinitial|retirer|quitter|quit|vider|effacer|forget|fichier|import|photo|vidéo|video|caméra|micro|recevoir|notif|créer mon club|demo|mettre à jour|télécharg|exporter|pdf|imprim|partag|envoyer|whatsapp|image|refaire|redo|lineupredo|dayrotate|autocomp|nophoto|archiv/i;
  const out = []; window.__crawlErrs = [];
  for (const r of rs) {
    location.hash = '#/' + r; await wait(ALL ? 250 : 500); let clicked = 0; if (ALL && !d.querySelector('#view').children.length) window.__crawlErrs.push(r + ' :: page vide');
    for (let i = 0; i < MAXC(r); i++) {
      if (location.hash !== '#/' + r) { location.hash = '#/' + r; await wait(350); }
      const b = [...d.querySelectorAll('#view button:not([disabled]), #view summary')][i]; if (!b) break;
      const t = (b.textContent + ' ' + b.className + ' ' + JSON.stringify(b.dataset)).toLowerCase(); if (SKIP.test(t)) continue;
      try { b.click(); } catch (e) { window.__crawlErrs.push(r + ' :: clic ' + e.message); }
      clicked++; await wait(150); const busy = d.getElementById('busy'); if (busy && !busy.hidden) await wait(1500); await closeAll();
      if (d.body.classList.contains('editing')) { location.hash = '#/' + r; await wait(300); }
    }
    out.push(r + ':' + clicked);
  }
  return out.join(' ');`;

/* ---------- a copy of a club's real data in place of the demo (option --donnees) ---------- */
async function loadData(cdp, p, file) {
  // nothing leaves the computer: every request to a server other than the local one fails
  const t = (await cdp.send('Target.getTargets')).targetInfos.find(x => x.type === 'page' && /localhost/.test(x.url));
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
  await cdp.send('Network.enable', {}, sessionId); await cdp.send('Network.setBlockedURLs', { urls: ['*supabase*', '*googleapis*', 'https://*'] }, sessionId);
  let raw = JSON.parse(fs.readFileSync(file, 'utf8')), data = {};
  if (raw.app && raw.data) data = raw.data; // a backup of the app
  else (Array.isArray(raw) ? raw : raw.rows || []).forEach(r => { const it = typeof r.data === 'string' ? JSON.parse(r.data) : r.data; if (!it) return; if (r.col === 'club') data.club = it; else (data[r.col] = data[r.col] || []).push(it); });
  const res = await p.evalIn(`(() => { const d = ${JSON.stringify(data)}, S = Store.state, out = [];
    Object.entries(d).forEach(([c, v]) => { if (c === 'club') { const cl = Object.assign({}, v); delete cl.cloud; Object.assign(S.club, cl); return; } if (Array.isArray(v)) { S[c] = v; out.push(c + ' ' + v.length); } });
    window.__crawlAll = true; Store.save(); location.hash = '#/'; return out.join(', '); })()`);
  console.log('\n📂 Données chargées (serveur bloqué) : ' + res);
}

/* ---------- run ---------- */
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, 'serveur.js'), String(PORT)], { stdio: 'ignore' });
  await sleep(600);
  let br; const t0 = Date.now(); let bad = 0;
  try {
    br = await openBrowser();
    for (const [name, body] of SCENARIOS) {
      const p = await page(br.cdp);
      try {
        await p.goto(DEMO);
        const out = await p.evalIn(`(async () => { ${H} ${body} })()`);
        const errs = p.errors().filter(e => !/favicon|net::ERR|Failed to fetch|NetworkError|Load failed/.test(e));
        if (errs.length) throw new Error('erreur de l\'appli : ' + errs[0].split('\n')[0]);
        console.log(`  ✅ ${name}${out ? ' · ' + String(out).replace(/\s+/g, ' ').slice(0, 60) : ''}`);
      } catch (e) { bad++; console.log(`  ❌ ${name}\n     ${e.message.split('\n')[0]}`); }
      finally { await p.close().catch(() => {}); }
    }
  } catch (e) { bad++; console.log('❌ ' + e.message); }
  finally {
    if (br) { try { br.cdp.ws.close(); } catch (e) {} br.proc.kill(); await sleep(400); try { fs.rmSync(br.profile, { recursive: true, force: true }); } catch (e) {} }
    srv.kill();
  }
  console.log(bad ? `\n❌ ${bad} scénario${bad > 1 ? 's' : ''} en échec (${Math.round((Date.now() - t0) / 1000)} s)` : `\n✅ ${SCENARIOS.length} scénarios réussis (${Math.round((Date.now() - t0) / 1000)} s)`);
  const di = process.argv.indexOf('--donnees'), DATA = di > 0 ? process.argv[di + 1] : null;
  if (process.argv.includes('--crawl') || DATA) {
    const srv2 = spawn(process.execPath, [path.join(__dirname, 'serveur.js'), String(PORT)], { stdio: 'ignore' }); await sleep(600);
    let br2; try {
      br2 = await openBrowser(); const p = await page(br2.cdp); await p.goto(DEMO); await p.evalIn(`(async () => { ${H} guide(); })()`);
      if (DATA) await loadData(br2.cdp, p, DATA);
      const visited = await p.evalIn(`(async () => { ${CRAWL} })()`);
      const errs = p.errors().filter(e => !/favicon|net::ERR|Failed to fetch|NetworkError|Load failed/.test(e) && !(DATA && /Le PDF se prépare/.test(e))); // internet blocked: no PDF library
      const inPage = await p.evalIn('window.__crawlErrs || []');
      console.log(`\n🕷️ Parcours de toutes les pages : ${String(visited).split(' ').length} pages, boutons touchés`);
      [...errs, ...inPage].forEach(e => console.log('  ⚠️ ' + String(e).split('\n')[0].slice(0, 220)));
      console.log(errs.length + inPage.length ? `❌ ${errs.length + inPage.length} erreur(s) pendant le parcours` : '✅ Aucune erreur pendant le parcours');
      if (errs.length + inPage.length) bad++;
      await p.close().catch(() => {});
    } catch (e) { bad++; console.log('❌ parcours : ' + e.message); }
    finally { if (br2) { try { br2.cdp.ws.close(); } catch (e) {} br2.proc.kill(); await sleep(400); try { fs.rmSync(br2.profile, { recursive: true, force: true }); } catch (e) {} } srv2.kill(); }
  }
  process.exit(bad ? 1 : 0);
})();
