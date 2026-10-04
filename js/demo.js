/* Demo: a made-up club, filled in, to understand Clubbo in 30 seconds without creating anything.
   It lives only on this device (no server, nothing is sent), with invented names. The bar at the top says it is a demo,
   « Créer mon club » leaves it for the real thing, « Quitter » empties it. Offered on the login screen (and #demo). */
const Demo = (() => {
  const { esc, $, toast, modal } = UI;
  const S = () => Store.state;
  const FIRST = ['Lucas', 'Léa', 'Nathan', 'Inès', 'Hugo', 'Emma', 'Adam', 'Jade', 'Rayan', 'Chloé', 'Yanis', 'Lina', 'Noah', 'Sarah', 'Enzo', 'Manon', 'Ilyes', 'Camille', 'Sacha', 'Zoé', 'Malik', 'Louise', 'Théo', 'Maëlys', 'Ethan', 'Nora'];
  const LAST = ['Martin', 'Bernard', 'Diallo', 'Petit', 'Moreau', 'Laurent', 'Benali', 'Traoré', 'Garcia', 'Roux', 'Fontaine', 'Cissé', 'Morel', 'Haddad', 'Blanc', 'Kone', 'Mercier', 'Lefèvre', 'Barbier', 'Perrin', 'Rousseau', 'Faure'];
  const OPP = ['AS Les Lilas', 'US Villemomble', 'ES Gagny', 'FC Neuilly', 'Olympique Rosny', 'AC Bondy', 'Stade Montfermeil', 'CS Livry', 'RC Pavillons', 'JS Noisy'];
  const SCORE = { foot: [0, 5], basket: [38, 78], hand: [18, 34], rugby: [3, 38], volley: [0, 3] };
  const is = () => !!(S() && S().club && S().club.demo);

  // the same club each time for the same sport (a seeded draw), so the screenshots and the explanations match
  function rnd(seed) { let x = seed; return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; }; }
  function build(sport) {
    const R = rnd(sport.length * 7919 + 17), pick = a => a[Math.floor(R() * a.length)], int = (a, b) => a + Math.floor(R() * (b - a + 1));
    const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
    const SP = Sport.SPORTS[sport], cats = SP.cats, now = Date.now();
    const chosen = sport === 'foot' ? ['U11', 'U13', 'Seniors'] : [cats[Math.min(3, cats.length - 1)], cats[Math.min(5, cats.length - 1)], 'Seniors'].filter((c, i, a) => cats.includes(c) && a.indexOf(c) === i);
    const teams = chosen.map(c => ({ id: 'demo-' + c.toLowerCase().replace(/[^a-z0-9]/g, ''), name: c, category: c, format: SP.formatOfCat(c), demo: true }));
    const posts = SP.posts.filter(p => p[0] !== p[3] || SP.posts.filter(q => q[3] === p[3]).length === 1);
    const used = new Set(), name = () => { let n; do n = [pick(FIRST), pick(LAST)]; while (used.has(n.join())); used.add(n.join()); return n; };
    const players = [];
    teams.forEach((t, ti) => { for (let i = 0; i < 12; i++) { const [fn, ln] = name(); const age = t.name === 'Seniors' ? 24 : +(t.name.match(/\d+/) || [12])[0] - 1;
      players.push({ id: `demo-p${ti}-${i}`, firstName: fn, lastName: ln.toUpperCase(), teamIds: [t.id], number: i + 1, post: posts[i % posts.length][0], birth: `${new Date().getFullYear() - age}-0${1 + (i % 9)}-1${i % 9}`, updatedAt: now }); } });
    const me = { id: 'demo-me', lastName: 'DÉMO', firstName: 'Alex', role: 'Responsable du club', teamIds: teams.map(t => t.id), phone: '', email: '', notes: '' };
    const staff = [me, ...teams.map((t, i) => { const [fn, ln] = name(); return { id: 'demo-s' + i, lastName: ln.toUpperCase(), firstName: fn, role: 'Éducateur', teamIds: [t.id], phone: '', email: '', notes: '' }; })];
    const [lo, hi] = SCORE[sport] || SCORE.foot, matches = [], trainings = [];
    const sc = () => sport === 'volley' ? (R() < .55 ? [3, int(0, 2)] : [int(0, 2), 3]) : [int(lo, hi), int(lo, hi)];
    const exos = (() => { try { return Exos.all().filter(e => !e.club); } catch (e) { return []; } })();
    teams.forEach((t, ti) => {
      const roster = players.filter(p => p.teamIds.includes(t.id)), ids = roster.map(p => p.id);
      [-20, -13, -6].forEach((d, k) => {
        const [gf, ga] = sc(), conv = ids.slice(0, 10 + (k % 3)), stats = {};
        if (sport === 'foot' || sport === 'hand') for (let g = 0; g < gf; g++) { const p = pick(conv.slice(1)); (stats[p] = stats[p] || {}).g = ((stats[p] || {}).g || 0) + 1; }
        const minutes = sport === 'foot' ? Object.fromEntries(conv.map((id, i) => [id, i < 8 ? 60 : int(15, 45)])) : undefined;
        matches.push({ id: `demo-m${ti}-${k}`, teamId: t.id, date: day(d - ti), time: '15:00', home: k % 2 === 0, opponent: OPP[(ti * 3 + k) % OPP.length], competition: 'Championnat', place: '', rdv: '14:15', played: true, gf, ga, convoked: conv, stats, minutes, notes: '', updatedAt: now });
      });
      matches.push({ id: `demo-m${ti}-next`, teamId: t.id, date: day(ti ? 5 + ti : 1), time: ti ? '10:30' : '15:00', home: ti % 2 === 0, opponent: OPP[(ti * 3 + 5) % OPP.length], competition: 'Championnat', place: '', rdv: '', played: false, gf: 0, ga: 0, convoked: ti ? [] : ids.slice(0, 11), stats: {}, notes: '', updatedAt: now });
      [-9, -2, 1].forEach((d, k) => {
        const ex = exos.length ? [0, 1, 2, 3].map(i => exos[(ti * 7 + k * 4 + i * 5) % exos.length]) : [];
        trainings.push({ id: `demo-t${ti}-${k}`, teamId: t.id, date: day(d + ti), time: '18:30', title: ex[1] ? ex[1].title : 'Entraînement', presents: d < 0 ? ids.filter(() => R() < .82) : [],
          exercises: ex.map((e, i) => ({ id: `demo-e${ti}${k}${i}`, title: e.title, duration: e.duration, org: e.org, consignes: e.consignes, materiel: e.materiel, theme: e.theme || '' })), updatedAt: now });
      });
    });
    return { version: 2, club: { name: 'Club Démo', short: 'Le Club', sport, demo: true, color1: '#1d4ed8', color2: '#0e1d45', slogan: 'Un club, une famille', setupDone: 1, catSeason: People.seasonLabel(), matchTeamsV1: 1, matchTeamsV2: 1, homeBib: 'bleu', awayBib: 'blanc' },
      ui: { tourSeen: 1 }, teams, players, staff, schemas: [], trainings, matches, reports: [],
      auth: { users: {}, session: { token: 'demo', staff_id: me.id, admin: true, teams_set: true, demo: true } } };
  }
  // the club is replaced by the demo (only on a device without a real club: see Auth's login screen)
  function start() {
    document.body.classList.add('modal-top'); // above the login screen
    modal({ title: '👀 Essayer Clubbo', noFocus: true,
      body: `<p>Un club inventé, déjà rempli (équipes, joueurs, séances, matchs), pour tout essayer. Il reste sur ce téléphone : <b>rien n'est envoyé</b>, et tu le quittes quand tu veux.</p>
        <div class="lbl">Quel sport ?</div><div class="quick-menu">${Sport.KEYS.map(k => `<button class="quick-item" data-demo="${k}"><b>${Sport.SPORTS[k].icon}</b><span>${esc(Sport.SPORTS[k].label)}</span></button>`).join('')}</div>`,
      onOpen: r => r.querySelectorAll('[data-demo]').forEach(b => b.onclick = () => launch(b.dataset.demo)) });
  }
  async function launch(sport) {
    const bz = UI.busy('Préparation du club de démonstration…');
    try {
      S().club.sport = sport; Sport.apply();
      const st = build(sport);
      Object.keys(S()).forEach(k => delete S()[k]); Object.assign(S(), st);
      Store.save(); await new Promise(res => setTimeout(res, 500));
      location.hash = '#/'; location.reload();
    } catch (e) { bz.done(); toast(e.message || 'Démonstration impossible', 'err'); }
  }
  async function quit(then) {
    const bz = UI.busy('Fermeture de la démonstration…');
    Store.reset(); await new Promise(res => setTimeout(res, 500));
    location.hash = then || ''; location.reload(); bz.done();
  }
  // the bar at the top of every page while the demo is open
  function bar() {
    let b = document.getElementById('demoBar');
    if (!is() || AppCfg.fixed) { if (b) { b.remove(); document.body.classList.remove('demoing'); } return; } // never in the app of one club
    if (!b) {
      b = document.createElement('div'); b.id = 'demoBar'; document.body.appendChild(b);
      b.innerHTML = `<span>👀 <b>Club de démonstration</b><span class="lg"> · inventé, rien n'est envoyé</span></span><span class="chips"><button class="btn primary" data-demo-act="create">Créer mon club</button><button class="btn" data-demo-act="quit">Quitter</button></span>`;
      // (1.46) on a demo page of one sport, « Créer mon club » goes to the real app; « Quitter » gives a fresh demo club
      b.onclick = e => { const x = e.target.closest('[data-demo-act]'); if (!x) return; if (AppCfg.demo && x.dataset.demoAct === 'create') { location.href = './#creer'; return; } quit(x.dataset.demoAct === 'create' ? '#creer' : ''); };
    }
    document.body.classList.add('demoing'); document.body.style.setProperty('--dmh', b.offsetHeight + 'px');
  }
  return { is, start, launch, quit, bar, build };
})();
