/* AutoSchema: the animated schema of an exercise, made by the app from its text (no drawing by hand).
   It reads the exercise: how many players (« 4 contre 4 », « + 2 jokers », « par 3 »), the size (« 30 x 20 m »), the kind of exercise
   (rondo / conservation, opposition with goals, finishing, duel, a shape of cones « carré, triangle, losange », running)
   and builds players, cones, goals, ball and 3 or 4 steps with their movements (passes, runs, dribbles, shots).
   The coach sees it at once on the exercise; « Utiliser ce schéma » keeps it (then it can be changed like any schema).
   AutoSchema.big(): the exercise in large, schema animated, organisation and consignes in big letters (to show the players). */
const AutoSchema = (() => {
  const club = () => Store.state.club;
  const sport = () => (typeof Sport !== 'undefined' ? Sport.id() : 'foot');
  const hasGk = () => (typeof Sport !== 'undefined' ? !!Sport.cur().gk : true);
  function mk(name, w, h, notes) {
    return { id: Store.uid(), name, teamId: null, auto: true, field: { format: 'zone', view: 'full', w, h }, overlays: {}, objects: [], zones: [],
      steps: notes.map(n => ({ pos: {}, arrows: [], moves: {}, note: n, dur: 2 })) };
  }
  function put(sc, o, positions) {
    o.id = Store.uid(); sc.objects.push(o);
    sc.steps.forEach((st, i) => { st.pos[o.id] = (positions[i] || positions[positions.length - 1]).slice(); });
    return o.id;
  }
  const mv = (sc, k, id, type, c = 0) => { if (sc.steps[k]) sc.steps[k].moves[id] = { type, c }; };
  const home = label => ({ type: 'player', color: club().homeBib || 'bleu', label: String(label) });
  const away = label => ({ type: 'player', color: club().awayBib === club().homeBib ? 'blanc' : (club().awayBib || 'blanc'), label: String(label) });
  const joker = () => ({ type: 'player', color: 'jaune', label: 'J' });
  const gkObj = () => ({ type: 'player', color: 'orange', gk: true, label: 'G' });
  const cone = (sc, p, color = 'orange') => put(sc, { type: 'cone', color }, [p]);
  const goal = (sc, x, y, rot, w = 3) => put(sc, { type: 'goal', size: w >= 5 ? 'big' : 'mini', w, rot }, [[x, y]]);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- reading the exercise ---------- */
  function read(ex) {
    const t = `${ex.title || ''}\n${ex.org || ''}\n${ex.consignes || ''}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const vs = t.match(/(\d{1,2})\s*(?:contre|c|vs?|-)\s*(\d{1,2})(?!\s*m)/);
    let a = vs ? +vs[1] : 0, b = vs ? +vs[2] : 0;
    const jk = t.match(/(\d)\s*(?:jokers?|appuis|neutres?)/) || (/\bjoker\b|\bappui\b/.test(t) ? [0, '1'] : null);
    const jokers = jk ? clamp(+jk[1], 1, 4) : 0;
    const by = t.match(/par\s*(\d)\b|groupes? de\s*(\d)/), group = by ? +(by[1] || by[2]) : 0;
    const sz = (ex.size || '').match(/(\d{1,3})\s*x\s*(\d{1,3})/) || t.match(/(\d{1,3})\s*(?:m\s*)?[x×]\s*(\d{1,3})\s*m?/);
    let w = sz ? +sz[1] : 0, h = sz ? +sz[2] : 0;
    const gk = hasGk() && /gardien|\bgb\b|portier/.test(t);
    const shape = /triangle/.test(t) ? 3 : /losange/.test(t) ? 'lo' : /carre|square/.test(t) ? 4 : /colonne|file/.test(t) ? 'col' : 0;
    // the title says most: then the whole text
    const ti = String(ex.title || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    let kind = 'shape';
    if (/rondo|toro|conserv|possession|passe a dix|garder le ballon|jeu de position/.test(ti)) kind = 'possession';
    else if (/\b1\s*(?:contre|c|vs?)\s*1\b|duel/.test(ti)) kind = 'duel';
    else if (/\btirs?\b|frappe|finition|centre|reprise|double pas|lancer|shoot|attaque en zone|service|smash/.test(ti)) kind = 'finish';
    else if (/(\d)\s*(?:contre|c|vs?)\s*(\d)/.test(ti) || /match|jeu reduit|jeu a theme|opposition|transition|contre-attaque/.test(ti)) kind = 'game';
    else if (/rondo|toro|conserv|possession|passe a dix|garder le ballon/.test(t)) kind = 'possession';
    else if (/\b1\s*(?:contre|c|vs?)\s*1\b/.test(t)) kind = 'duel';
    else if (/(\d)\s*(?:contre|c|vs?)\s*(\d)/.test(t) && /\bbuts?\b|mini-buts|marquer|panier|essai|en-but|match|jeu reduit|transition|contre-attaque/.test(t)) kind = 'game';
    else if (/\btirs?\b|frappe|finition|centre|double pas|lancer|shoot|attaque en zone|service/.test(t)) kind = 'finish';
    else if (/sprint|physique|vitesse|endurance|intermittent|gammes|appuis|echelle|circuit|course/.test(t) && !/passe/.test(t)) kind = 'run';
    else if (vs && a && b) kind = /but|panier|essai/.test(t) ? 'game' : 'possession';
    if (kind === 'possession' && !a) { a = /toro/.test(t) ? 3 : /rondo/.test(t) ? 4 : 4; b = /rondo|toro/.test(t) ? 1 : 4; }
    if (kind === 'game' && !a) { a = 4; b = 4; }
    if (kind === 'duel') { a = 1; b = 1; }
    a = clamp(a || 0, 0, 11); b = clamp(b || 0, 0, 11);
    return { t, kind, a, b, jokers, group, w, h, gk, shape };
  }

  /* ---------- the builders, one per kind of exercise ---------- */
  function possession(ex, r) {
    const rondo = r.b <= 2 && r.a >= 3;
    const s = r.w || (rondo ? clamp(6 + r.a * 1.6, 8, 16) : clamp(10 + (r.a + r.b) * 2, 15, 45)), hh = r.h || s;
    const sc = mk(ex.title || 'Conservation', s, hh, rondo ? ['Les joueurs autour du carré, les défenseurs au milieu', 'Passe : le défenseur presse le receveur', 'Le receveur joue vite vers le joueur libre', 'On change de côté'] :
      ['Les deux équipes dans la zone' + (r.jokers ? ', les jokers jouent avec l\'équipe qui a le ballon' : ''), 'Passe au partenaire démarqué, le défenseur presse', r.jokers ? 'Passe au joker pour sortir du pressing' : 'Changement de côté', 'Le joueur libre reçoit et relance']);
    [[.5, .5], [s - .5, .5], [s - .5, hh - .5], [.5, hh - .5]].forEach(p => cone(sc, p));
    const A = [];
    if (rondo) {
      for (let i = 0; i < r.a; i++) { const ang = -Math.PI / 2 + i * 2 * Math.PI / r.a; A.push([s / 2 + Math.cos(ang) * (s / 2 - .8), hh / 2 + Math.sin(ang) * (hh / 2 - .8)]); }
      A.forEach((p, i) => put(sc, home(i + 1), [p]));
      const ids = [];
      for (let i = 0; i < r.b; i++) ids.push(put(sc, away(String.fromCharCode(88 + i)), [[s / 2 + (i ? 1 : 0), hh / 2 + (i ? 1 : 0)]]));
      const seq = [0, 1, 2 % r.a, 3 % r.a].map(i => A[i]);
      const ball = put(sc, { type: 'ball' }, seq.map(p => [p[0] + .5, p[1] + .5]));
      [1, 2, 3].forEach(k => { mv(sc, k, ball, 'passe'); ids.forEach((id, j) => { const p = seq[k]; sc.steps[k].pos[id] = [s / 2 + (p[0] - s / 2) * .45 + j, hh / 2 + (p[1] - hh / 2) * .45 + j]; mv(sc, k, id, 'pressing'); }); });
    } else {
      const ring = (n, rad, off) => Array.from({ length: n }, (_, i) => { const ang = off + i * 2 * Math.PI / Math.max(1, n); return [s / 2 + Math.cos(ang) * s * rad, hh / 2 + Math.sin(ang) * hh * rad]; });
      const pa = ring(r.a, .34, 0), pb = ring(r.b, .2, Math.PI / Math.max(1, r.b));
      pa.forEach((p, i) => A.push(p));
      const aIds = pa.map((p, i) => put(sc, home(i + 1), [p])), bIds = pb.map((p, i) => put(sc, away(i + 1), [p]));
      const J = []; for (let i = 0; i < r.jokers; i++) J.push(put(sc, joker(), [[i % 2 ? s - .9 : .9, hh / 2 + (i > 1 ? (i - 2.5) * 3 : 0)]]));
      const target = (k) => k === 2 && r.jokers ? [.9 + 1, hh / 2] : A[k % A.length];
      const ball = put(sc, { type: 'ball' }, [0, 1, 2, 3].map(k => { const p = k === 2 && r.jokers ? [s - 1.6, hh / 2] : A[k % Math.max(1, A.length)] || [s / 2, hh / 2]; return [p[0] + .5, p[1] + .5]; }));
      [1, 2, 3].forEach(k => { mv(sc, k, ball, 'passe', k === 2 ? .15 : 0); });
      // the closest defender presses the receiver, the next receiver moves to get free
      [1, 2, 3].forEach(k => { const p = sc.steps[k].pos[ball]; const near = bIds.slice().sort((x, y) => dist(sc.steps[k - 1].pos[x], p) - dist(sc.steps[k - 1].pos[y], p))[0];
        if (near) { sc.steps[k].pos[near] = [(p[0] + sc.steps[k - 1].pos[near][0]) / 2, (p[1] + sc.steps[k - 1].pos[near][1]) / 2]; mv(sc, k, near, 'pressing'); }
        const nxt = aIds[(k + 1) % aIds.length]; if (nxt && k < 3) { const q = sc.steps[k - 1].pos[nxt]; sc.steps[k].pos[nxt] = [clamp(q[0] + (q[0] < s / 2 ? -2 : 2), 1, s - 1), clamp(q[1] + (q[1] < hh / 2 ? -1.5 : 1.5), 1, hh - 1)]; mv(sc, k, nxt, 'course'); }
        for (let j = k + 1; j < sc.steps.length; j++) { if (near) sc.steps[j].pos[near] = sc.steps[k].pos[near].slice(); if (nxt) sc.steps[j].pos[nxt] = sc.steps[k].pos[nxt].slice(); } });
      void target; void J;
    }
    return sc;
  }
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  function game(ex, r) {
    const n = r.a + r.b, w = r.w || clamp(18 + n * 3, 25, 60), h = r.h || Math.round(w * .65);
    const sc = mk(ex.title || 'Jeu', w, h, ['Deux équipes, un but à défendre chacune' + (r.jokers ? ', jokers avec l\'équipe qui a le ballon' : ''), 'Construction : passe vers l\'avant', 'Appel dans la profondeur, passe décisive', sport() === 'rugby' ? 'Essai' : sport() === 'basket' ? 'Tir au panier' : 'Tir au but']);
    const big = r.gk || n >= 12;
    if (sport() !== 'rugby') { goal(sc, 0, h / 2, 180, big ? 5 : 2.5); goal(sc, w, h / 2, 0, big ? 5 : 2.5); }
    else { [[1, 0], [w - 1, 0]].forEach(([x]) => { for (let y = 1; y < h; y += Math.max(3, h / 6)) cone(sc, [x, y], 'jaune'); }); }
    if (r.gk) { put(sc, gkObj(), [[1, h / 2]]); put(sc, Object.assign(gkObj(), { color: 'jaune' }), [[w - 1, h / 2], [w - 1, h / 2], [w - 1, h / 2 - 1.5]]); }
    const lane = (i, n2) => h * (i + 1) / (n2 + 1);
    const A = Array.from({ length: r.a }, (_, i) => [w * (.3 + .35 * ((i % 3) / 2)), lane(i, r.a)]);
    const B = Array.from({ length: r.b }, (_, i) => [w * (.55 + .3 * ((i % 2))), lane(i, r.b) + 1]);
    const aIds = A.map((p, i) => put(sc, home(i + 1), [p])), bIds = B.map((p, i) => put(sc, away(i + 1), [p]));
    for (let i = 0; i < r.jokers; i++) put(sc, joker(), [[w / 2, i % 2 ? h - .9 : .9]]);
    if (aIds.length) {
      const c = 0, f = aIds.length > 1 ? aIds.length - 1 : 0, carrier = A[c], runner = A[f];
      const run = [clamp(w * .8, 0, w - 3), clamp(runner[1] + (runner[1] < h / 2 ? 2 : -2), 1, h - 1)];
      sc.steps[1].pos[aIds[c]] = [carrier[0] + w * .1, carrier[1]]; mv(sc, 1, aIds[c], 'conduite');
      [2, 3].forEach(k => { sc.steps[k].pos[aIds[c]] = sc.steps[1].pos[aIds[c]].slice(); sc.steps[k].pos[aIds[f]] = run.slice(); });
      mv(sc, 2, aIds[f], 'course', .15);
      const ball = put(sc, { type: 'ball' }, [[carrier[0] + .6, carrier[1] + .6], [carrier[0] + w * .1 + .6, carrier[1] + .6], [run[0] + .6, run[1] + .6], [w, h / 2]]);
      mv(sc, 2, ball, 'passe', -.1); mv(sc, 3, ball, 'tir');
      bIds.forEach((id, i) => { [2, 3].forEach(k => { const p = sc.steps[k - 1].pos[id]; sc.steps[k].pos[id] = [p[0] + (run[0] - p[0]) * .2, p[1] + (run[1] - p[1]) * .2]; }); mv(sc, 2, id, 'pressing'); });
    }
    return sc;
  }
  function finish(ex, r) {
    const w = r.w || 30, h = r.h || 25, net = sport() === 'volley';
    const sc = mk(ex.title || 'Finition', w, h, net ? ['Le passeur au filet, les attaquants en file', 'Passe haute vers l\'attaquant', 'Élan et frappe', 'Retour en file'] :
      ['Le passeur au centre, les tireurs en file', 'Passe dans la course', sport() === 'basket' ? 'Dribble vers le panier' : 'Contrôle orienté vers le but', sport() === 'basket' ? 'Tir ou double pas' : 'Tir']);
    if (net) { for (let y = .5; y < h; y += 1.5) cone(sc, [w / 2, y], 'blanc'); } // the net
    else goal(sc, w, h / 2, 0, sport() === 'foot' && !r.w ? 5 : 3);
    if (r.gk && !net) put(sc, gkObj(), [[w - 1, h / 2], [w - 1, h / 2], [w - 1.2, h / 2 - .8], [w - 1.2, h / 2 - 1.5]]);
    const file = [w * .25, h * .75];
    for (let i = 1; i <= 3; i++) put(sc, home(i + 1), [[file[0] - i * 1.4, file[1] + i * .6]]);
    const s1 = put(sc, home(1), [file, [w * .55, h * .62], [w * .72, h * .55], [w * .72, h * .55]]);
    const p = put(sc, home('P'), [[w * .45, h * .3]]);
    const ball = put(sc, { type: 'ball' }, [[w * .45 + .6, h * .3 + .6], [w * .55 + .6, h * .62], [w * .72 + .6, h * .55], [net ? w * .78 : w, h / 2 - (net ? 0 : .8)]]);
    mv(sc, 1, ball, 'passe'); mv(sc, 1, s1, 'course', .1); mv(sc, 2, s1, 'conduite'); mv(sc, 2, ball, 'conduite'); mv(sc, 3, ball, 'tir'); void p;
    cone(sc, [file[0], file[1] + .9], 'bleu');
    return sc;
  }
  function duel(ex, r) {
    const w = r.w || 20, h = r.h || 10;
    const sc = mk(ex.title || 'Duel 1 contre 1', w, h, ['L\'attaquant part avec le ballon, le défenseur face à lui', 'Feinte et changement de rythme', 'Débordement', 'Finition']);
    [[0, 0], [w, 0], [0, h], [w, h]].forEach(p => cone(sc, [clamp(p[0], .5, w - .5), clamp(p[1], .5, h - .5)]));
    if (sport() !== 'rugby' && sport() !== 'volley') goal(sc, w, h / 2, 0, 3);
    const at = put(sc, home(1), [[2, h / 2], [w * .45, h / 2], [w * .6, h * .25], [w * .85, h * .3]]);
    const df = put(sc, away(1), [[w * .65, h / 2], [w * .55, h / 2], [w * .58, h * .45], [w * .7, h * .4]]);
    const ball = put(sc, { type: 'ball' }, [[2.6, h / 2 + .5], [w * .45 + .6, h / 2 + .5], [w * .6 + .6, h * .25 + .5], [w, h / 2]]);
    mv(sc, 1, at, 'conduite'); mv(sc, 1, ball, 'conduite'); mv(sc, 2, at, 'conduite', .2); mv(sc, 2, ball, 'conduite', .2); mv(sc, 2, df, 'pressing'); mv(sc, 3, ball, 'tir'); mv(sc, 3, at, 'course');
    return sc;
  }
  function shape(ex, r) {
    const n = r.shape === 3 ? 3 : 4, s = r.w || (n === 3 ? 10 : 12), hh = r.h || s;
    const col = r.shape === 'col';
    const sc = mk(ex.title || 'Exercice', s, hh, col ? ['Deux files face à face', 'Passe vers la file d\'en face', 'Je suis ma passe et je vais au bout de l\'autre file', 'On enchaîne'] :
      [`Un joueur à chaque plot (${n === 3 ? 'triangle' : r.shape === 'lo' ? 'losange' : 'carré'}), le ballon au premier`, 'Passe au plot suivant, je suis ma passe', 'Le receveur contrôle et enchaîne', 'Tour complet, puis dans l\'autre sens']);
    let pts;
    if (col) pts = [[1.5, hh / 2], [s - 1.5, hh / 2]];
    else if (r.shape === 'lo') pts = [[s / 2, .8], [s - .8, hh / 2], [s / 2, hh - .8], [.8, hh / 2]];
    else if (n === 3) pts = [[s / 2, .8], [s - .8, hh - .8], [.8, hh - .8]];
    else pts = [[.8, .8], [s - .8, .8], [s - .8, hh - .8], [.8, hh - .8]];
    pts.forEach(p => cone(sc, p));
    const ids = pts.map((p, i) => put(sc, home(i + 1), [[p[0], p[1]]]));
    if (col) { put(sc, home(3), [[.6, hh / 2]]); put(sc, home(4), [[s - .6, hh / 2]]); }
    const m = pts.length, seq = [0, 1, 2 % m, 3 % m].map(i => pts[i]);
    const ball = put(sc, { type: 'ball' }, seq.map(p => [p[0] + .5, p[1] + .5]));
    [1, 2, 3].forEach(k => { mv(sc, k, ball, 'passe');
      const passer = ids[(k - 1) % m], to = pts[k % m]; sc.steps[k].pos[passer] = [to[0] - .7, to[1] - .7]; mv(sc, k, passer, 'course', .2);
      for (let j = k + 1; j < sc.steps.length; j++) sc.steps[j].pos[passer] = sc.steps[k].pos[passer].slice(); });
    return sc;
  }
  function run(ex, r) {
    const w = r.w || 25, h = r.h || 10;
    const sc = mk(ex.title || 'Physique', w, h, ['Départ sur la ligne', 'Course jusqu\'aux plots (appuis courts)', 'Changement de direction', 'Retour en récupérant']);
    const lanes = Math.max(2, Math.min(4, r.group || 3));
    for (let i = 0; i < lanes; i++) {
      const y = h * (i + 1) / (lanes + 1);
      [2, w * .5, w - 2].forEach(x => cone(sc, [x, y]));
      const id = put(sc, home(i + 1), [[1, y], [w * .5 - .6, y], [w - 2.6, y], [1.5, y]]);
      mv(sc, 1, id, 'course'); mv(sc, 2, id, 'course'); mv(sc, 3, id, 'course', .3);
    }
    return sc;
  }

  // the schema of an exercise (not saved): the same exercise always gives the same schema
  function build(ex) {
    const r = read(ex);
    const sc = ({ possession, game, finish, duel, shape, run })[r.kind](ex, r);
    sc.name = ex.title || sc.name;
    sc.notes = [ex.org, ex.consignes].filter(Boolean).join('\n');
    sc.kind = r.kind;
    return sc;
  }
  // a preview for the card: an id and a version from the text, so the picture is redrawn only when the text changes
  function preview(ex) {
    const sc = build(ex), txt = `${ex.title}|${ex.org}|${ex.consignes}|${ex.size}`;
    let hsh = 0; for (let i = 0; i < txt.length; i++) hsh = (hsh * 31 + txt.charCodeAt(i)) | 0;
    sc.id = 'auto-' + (ex.id || 'x'); sc.updatedAt = hsh;
    return sc;
  }
  // keep it: a real schema of the club (it can then be changed like any other)
  function save(ex, teamId) {
    const sc = build(ex); sc.id = Store.uid(); sc.teamId = teamId || null; delete sc.kind;
    return Store.upsert('schemas', sc);
  }

  /* ---------- the exercise in large: the schema plays by itself, the text in big letters ---------- */
  function big(ex, scIn) {
    const sc = scIn || preview(ex);
    const cons = String(ex.consignes || '').split('\n').filter(Boolean);
    const close = UI.modal({ title: ex.title || 'Exercice', noFocus: true,
      body: `<div class="ex-big"><div class="ex-big-board"><canvas id="exBigC"></canvas><div class="chips"><button type="button" class="btn soft" data-bg="play">⏯<span>Pause</span></button><button type="button" class="btn soft" data-bg="zoom">🔍<span>Plein écran</span></button><span class="muted small" id="exBigNote"></span></div></div>
        <div class="ex-big-txt">${ex.duration ? `<p class="ex-big-dur">⏱️ ${UI.esc(ex.duration)} min${ex.size ? ' · ' + UI.esc(String(ex.size).replace('x', ' × ')) + ' m' : ''}</p>` : ''}
          ${ex.org ? `<h3>Organisation</h3><p>${UI.esc(ex.org).replace(/\n/g, '<br>')}</p>` : ''}
          ${cons.length ? `<h3>Consignes</h3><ul>${cons.map(c => `<li>${UI.esc(c)}</li>`).join('')}</ul>` : ''}
          ${ex.materiel ? `<h3>Matériel</h3><p>${UI.esc(ex.materiel)}</p>` : ''}</div></div>`,
      onOpen: r => {
        const cv = r.querySelector('#exBigC'), box = cv.parentNode, note = r.querySelector('#exBigNote');
        let playing = true, t0 = performance.now(), raf = 0;
        const total = () => sc.steps.reduce((a, s) => a + (s.dur || 2), 0);
        const draw = now => {
          if (!document.body.contains(cv)) return cancelAnimationFrame(raf);
          const W = box.clientWidth, H = Math.round(W * Math.min(.75, (Board.dims(sc.field).W / Board.dims(sc.field).L) || .62));
          if (cv.width !== W * 2) { cv.width = W * 2; cv.height = H * 2; cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
          let el = ((now - t0) / 1000) % (total() + 1), k = 0;
          while (k < sc.steps.length - 1 && el > (sc.steps[k + 1].dur || 2)) { el -= (sc.steps[k + 1].dur || 2); k++; }
          const u = k < sc.steps.length - 1 ? Math.min(1, el / (sc.steps[k + 1].dur || 2)) : 0;
          Board.drawFrame(cv.getContext('2d'), cv.width, cv.height, sc, k, u, { homeBib: club().homeBib });
          note.textContent = (sc.steps[Math.min(sc.steps.length - 1, k + (u > .5 ? 1 : 0))] || {}).note || '';
          if (playing) raf = requestAnimationFrame(draw);
        };
        raf = requestAnimationFrame(draw);
        r.querySelector('.ex-big').onclick = e => {
          const b = e.target.closest('[data-bg]'); if (!b) return;
          if (b.dataset.bg === 'play') { playing = !playing; b.querySelector('span').textContent = playing ? 'Pause' : 'Lecture'; if (playing) { t0 = performance.now(); raf = requestAnimationFrame(draw); } }
          if (b.dataset.bg === 'zoom') { const el = r.querySelector('.ex-big'); (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el); }
        };
      } });
    return close;
  }
  return { read, build, preview, save, big };
})();
