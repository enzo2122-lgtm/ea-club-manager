/* AutoSchema: the animated schema of an exercise, made by the app from its text (no drawing by hand).
   It reads the exercise: how many players (« 4 contre 4 », « + 2 jokers », « par 3 »), the size (« 30 x 20 m »), the kind of exercise
   (rondo / conservation, opposition with goals, finishing, duel, a shape of cones « carré, triangle, losange », running)
   and the actions it names (une-deux / remise, appel, dédoublement, centre, frappe, changement de côté).
   Then it tells the action step by step: the ball follows every pass, the carrier dribbles with it, the players make their runs,
   the defenders press the ball, the goalkeeper dives. Each step has its sentence.
   The coach sees it at once on the exercise; « Utiliser ce schéma » keeps it (then it can be changed like any schema).
   AutoSchema.big(): the exercise in large, played by itself or step by step, organisation and consignes in big letters. */
const AutoSchema = (() => {
  const club = () => Store.state.club;
  const sport = () => (typeof Sport !== 'undefined' ? Sport.id() : 'foot');
  const hasGk = () => (typeof Sport !== 'undefined' ? !!Sport.cur().gk : true);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const home = label => ({ type: 'player', color: club().homeBib || 'bleu', label: String(label) });
  const away = label => ({ type: 'player', color: club().awayBib === club().homeBib ? 'blanc' : (club().awayBib || 'blanc'), label: String(label) });
  const joker = () => ({ type: 'player', color: 'jaune', label: 'J' });
  const gkObj = color => ({ type: 'player', color: color || 'orange', gk: true, label: 'G' });
  const shotWord = () => ({ basket: 'Tir au panier', rugby: 'Essai', volley: 'Attaque' }[sport()] || 'Frappe au but');

  /* ---------- the story of the action: one step after the other ---------- */
  function story(name, w, h) {
    const sc = { id: Store.uid(), name, teamId: null, auto: true, field: { format: 'zone', view: 'full', w, h }, overlays: {}, objects: [], zones: [], steps: [] };
    const pos = {}, S = { sc, pos, ball: null, holder: null, w, h };
    const near = (p, dx = .55, dy = .45) => [clamp(p[0] + dx, 0, w), clamp(p[1] + dy, 0, h)];
    S.add = (o, p) => { o.id = Store.uid(); sc.objects.push(o); pos[o.id] = p.slice(); return o.id; };
    S.cone = (p, color = 'orange') => S.add({ type: 'cone', color }, p);
    S.goal = (x, y, rot, gw = 3) => S.add({ type: 'goal', size: gw >= 5 ? 'big' : 'mini', w: gw, rot }, [x, y]);
    S.giveBall = id => { S.holder = id; S.ball = S.add({ type: 'ball' }, near(pos[id])); };
    S.start = note => sc.steps.push({ pos: JSON.parse(JSON.stringify(pos)), arrows: [], moves: {}, note, dur: 1.6 });
    // a step: what moves in it (runs first, then the ball), and its sentence
    S.step = (note, fn, dur) => {
      const st = { pos: {}, arrows: [], moves: {}, note, dur: dur || 1.7 };
      const A = {
        run: (id, p, c = 0) => { pos[id] = [clamp(p[0], .5, w - .5), clamp(p[1], .5, h - .5)]; st.moves[id] = { type: 'course', c }; if (S.holder === id) pos[S.ball] = near(pos[id]); },
        press: (id, p) => { pos[id] = [clamp(p[0], .5, w - .5), clamp(p[1], .5, h - .5)]; st.moves[id] = { type: 'pressing', c: 0 }; },
        dribble: (id, p, c = 0) => { pos[id] = [clamp(p[0], .5, w - .5), clamp(p[1], .5, h - .5)]; st.moves[id] = { type: 'conduite', c }; if (S.holder === id) { pos[S.ball] = near(pos[id]); st.moves[S.ball] = { type: 'conduite', c }; } },
        pass: (to, c = 0) => { S.holder = to; pos[S.ball] = near(pos[to], -.5, .45); st.moves[S.ball] = { type: 'passe', c }; },
        shot: (p, c = 0) => { S.holder = null; pos[S.ball] = p.slice(); st.moves[S.ball] = { type: 'tir', c }; },
        // the closest defender goes towards the ball (half the way: he closes, he does not teleport)
        pressBall: (defs, k = .5) => { const b = pos[S.ball]; const d = defs.slice().sort((x, y) => dist(pos[x], b) - dist(pos[y], b))[0]; if (d) A.press(d, [pos[d][0] + (b[0] - pos[d][0]) * k, pos[d][1] + (b[1] - pos[d][1]) * k]); return d; },
      };
      fn(A); Object.keys(pos).forEach(id => { st.pos[id] = pos[id].slice(); }); sc.steps.push(st);
    };
    return S;
  }

  /* ---------- reading the exercise ---------- */
  const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  function read(ex) {
    const t = fold(`${ex.title || ''}\n${ex.org || ''}\n${ex.consignes || ''}`), ti = fold(ex.title);
    const vs = t.match(/(\d{1,2})\s*(?:contre|c|vs?|-)\s*(\d{1,2})(?!\s*m)/);
    let a = vs ? +vs[1] : 0, b = vs ? +vs[2] : 0;
    const jk = t.match(/(\d)\s*(?:jokers?|appuis|neutres?)/) || (/\bjoker\b|\bappui\b/.test(t) ? [0, '1'] : null);
    const jokers = jk ? clamp(+jk[1], 1, 4) : 0;
    const by = t.match(/par\s*(\d)\b|groupes? de\s*(\d)/), group = by ? +(by[1] || by[2]) : 0;
    const sz = (ex.size || '').match(/(\d{1,3})\s*x\s*(\d{1,3})/) || t.match(/(\d{1,3})\s*(?:m\s*)?[x×]\s*(\d{1,3})\s*m?/);
    const w = sz ? +sz[1] : 0, h = sz ? +sz[2] : 0;
    const gk = hasGk() && /gardien|\bgb\b|portier/.test(t);
    const shape = /triangle/.test(t) ? 3 : /losange/.test(t) ? 'lo' : /carre|square/.test(t) ? 4 : /colonne|file/.test(t) ? 'col' : 0;
    // the actions named in the text
    const acts = { oneTwo: /une-deux|une deux|1-2|remise|mur\b|deviation/.test(t), overlap: /dedoubl|chevauch|recouvr/.test(t), cross: /centre|centr|debord/.test(t),
      switchPlay: /changer de cote|changement de cote|renvers|jeu long|largeur/.test(t), run: /appel|profondeur|dans le dos/.test(t), follow: /passe et suis|suis (ta|sa) passe|je suis ma passe/.test(t) };
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
    if (kind === 'possession' && !a) { a = /toro/.test(t) ? 3 : 4; b = /rondo|toro/.test(t) ? 1 : 4; }
    if (kind === 'game' && !a) { a = 4; b = 4; }
    if (kind === 'duel') { a = 1; b = 1; }
    a = clamp(a || 0, 0, 11); b = clamp(b || 0, 0, 11);
    return { t, kind, a, b, jokers, group, w, h, gk, shape, acts };
  }

  /* ---------- rondo and conservation ---------- */
  function possession(ex, r) {
    const rondo = r.b <= 2 && r.a >= 3;
    const s = r.w || (rondo ? clamp(6 + r.a * 1.6, 8, 16) : clamp(10 + (r.a + r.b) * 2, 15, 45)), hh = r.h || s;
    const S = story(ex.title || 'Conservation', s, hh), P = S.pos;
    [[.5, .5], [s - .5, .5], [s - .5, hh - .5], [.5, hh - .5]].forEach(p => S.cone(p));
    if (rondo) {
      const A = Array.from({ length: r.a }, (_, i) => { const ang = -Math.PI / 2 + i * 2 * Math.PI / r.a; return S.add(home(i + 1), [s / 2 + Math.cos(ang) * (s / 2 - .9), hh / 2 + Math.sin(ang) * (hh / 2 - .9)]); });
      const B = Array.from({ length: r.b }, (_, i) => S.add(away(String.fromCharCode(88 + i)), [s / 2 + (i ? 1.2 : -.4), hh / 2 + (i ? .8 : 0)]));
      S.giveBall(A[0]); S.start(`${r.a} joueurs autour, ${r.b} au milieu : le 1 a le ballon`);
      // passes around the square, sometimes across (the pass that breaks the line), the defenders chase the ball
      const order = [1, 3 % r.a, 2 % r.a, 0, 2 % r.a].filter((x, i, l) => i === 0 || x !== l[i - 1]);
      order.forEach((to, k) => {
        const from = A.indexOf(S.holder), across = Math.abs(to - from) > 1 && Math.abs(to - from) < r.a - 1;
        S.step(across ? `Passe qui casse la ligne : du ${from + 1} au ${to + 1}, ${r.b > 1 ? 'entre les défenseurs' : 'en passant le défenseur'}` : `Passe du ${from + 1} au ${to + 1}, le défenseur presse le receveur`, A2 => {
          // the receiver opens his body (a small move to give a better angle)
          const q = P[A[to]]; A2.run(A[to], [q[0] + (q[0] < s / 2 ? -.3 : .3), q[1] + (q[1] < hh / 2 ? -.3 : .3)]);
          A2.pass(A[to], across ? 0 : .12); A2.pressBall(B, .55);
          if (B[1]) { const o = B.find(x => x !== B[0]); if (o) A2.press(o, [(s / 2 + P[S.ball][0]) / 2, (hh / 2 + P[S.ball][1]) / 2]); }
        }, across ? 1.4 : 1.6); void k;
      });
      return S.sc;
    }
    // conservation: two teams inside, jokers on the sides
    const ring = (n, rad, off) => Array.from({ length: n }, (_, i) => { const ang = off + i * 2 * Math.PI / Math.max(1, n); return [s / 2 + Math.cos(ang) * s * rad, hh / 2 + Math.sin(ang) * hh * rad]; });
    const A = ring(r.a, .34, 0).map((p, i) => S.add(home(i + 1), p)), B = ring(r.b, .2, Math.PI / Math.max(1, r.b)).map((p, i) => S.add(away(i + 1), p));
    const J = Array.from({ length: r.jokers }, (_, i) => S.add(joker(), [i % 2 ? s - .9 : .9, hh / 2 + (i > 1 ? (i - 2.5) * 3 : 0)]));
    S.giveBall(A[0]); S.start(`${r.a} contre ${r.b}${r.jokers ? ` + ${r.jokers} joker${r.jokers > 1 ? 's' : ''} jaune${r.jokers > 1 ? 's' : ''}` : ''} : l'équipe du ballon le garde`);
    const free = id => { const p = P[id], d = B.reduce((m, x) => Math.min(m, dist(P[x], p)), 99); return d; };
    for (let k = 0; k < 5; k++) {
      const useJoker = J.length && k === 2, mates = A.filter(x => x !== S.holder);
      const to = useJoker ? J[0] : mates.sort((x, y) => free(y) - free(x))[0];
      S.step(useJoker ? 'Pressé : passe au joker pour sortir du pressing' : k === 0 ? 'Appel dans l\'espace libre, passe au joueur démarqué' : k === 3 && r.acts.switchPlay ? 'Changement de côté vers le joueur libre' : 'Le porteur passe au partenaire le plus libre, le défenseur le plus proche presse', A2 => {
        if (!useJoker) { const q = P[to]; A2.run(to, [clamp(q[0] + (q[0] < s / 2 ? -2 : 2), 1, s - 1), clamp(q[1] + (q[1] < hh / 2 ? -1.5 : 1.5), 1, hh - 1)], .15); }
        A2.pass(to, useJoker ? .15 : 0); A2.pressBall(B, .5);
      });
      if (useJoker) S.step('Le joker rejoue tout de suite vers un partenaire démarqué', A2 => { const back = A.slice().sort((x, y) => free(y) - free(x))[0]; A2.run(back, [P[back][0] + (P[back][0] < s / 2 ? -1.5 : 1.5), P[back][1]], .1); A2.pass(back); A2.pressBall(B, .4); });
    }
    return S.sc;
  }

  /* ---------- opposition with goals: build-up, une-deux, run in behind, shot ---------- */
  function game(ex, r) {
    const n = r.a + r.b, w = r.w || clamp(18 + n * 3, 25, 60), h = r.h || Math.round(w * .65);
    const S = story(ex.title || 'Jeu', w, h), P = S.pos, big = r.gk || n >= 12;
    if (sport() !== 'rugby') { S.goal(0, h / 2, 180, big ? 5 : 2.5); S.goal(w, h / 2, 0, big ? 5 : 2.5); }
    else for (let y = 1; y < h; y += Math.max(3, h / 6)) { S.cone([1, y], 'jaune'); S.cone([w - 1, y], 'jaune'); }
    const gkB = r.gk ? S.add(gkObj('jaune'), [w - 1, h / 2]) : null; if (r.gk) S.add(gkObj(), [1, h / 2]);
    const lane = (i, k) => h * (i + 1) / (k + 1);
    // our team attacks to the right: the defenders behind, the midfielders, the attackers high
    const A = Array.from({ length: r.a }, (_, i) => S.add(home(i + 1), [w * (r.a <= 2 ? .35 + .15 * i : [.22, .4, .58, .7][i % 4] || .45), lane(i, r.a)]));
    const B = Array.from({ length: r.b }, (_, i) => S.add(away(i + 1), [w * (.62 + .18 * (i % 2)), lane(i, r.b) + .8]));
    for (let i = 0; i < r.jokers; i++) S.add(joker(), [w / 2, i % 2 ? h - .9 : .9]);
    if (!A.length) { S.start('Les deux équipes en place'); return S.sc; }
    const back = A[0], mid = A[Math.min(1, A.length - 1)], fw = A[A.length - 1], fw2 = A.length > 3 ? A[A.length - 2] : null;
    S.giveBall(back); S.start('Les deux équipes en place : on attaque vers la droite');
    S.step('Le milieu décroche pour se montrer, le défenseur lui passe', A2 => { A2.run(mid, [P[mid][0] - 3, P[mid][1]], .1); A2.pass(mid); A2.pressBall(B, .3); });
    S.step('Le milieu conduit vers l\'avant pour fixer un adversaire', A2 => { A2.dribble(mid, [P[mid][0] + w * .14, P[mid][1]]); A2.pressBall(B, .5); });
    if (r.acts.oneTwo || A.length >= 3) {
      S.step('Une-deux : passe à l\'attaquant en appui, dos au but…', A2 => { A2.run(fw, [P[fw][0] - 2, P[fw][1]]); A2.pass(fw); A2.pressBall(B, .5); });
      S.step('…le passeur suit sa passe dans le dos du défenseur, remise en une touche', A2 => { A2.run(mid, [P[mid][0] + w * .2, clamp(P[mid][1] + (P[mid][1] < h / 2 ? -2 : 2), 1, h - 1)], .2); A2.pass(mid, -.1); A2.pressBall(B, .4); });
    }
    if (r.acts.overlap && fw2) S.step('Dédoublement : le partenaire passe par l\'extérieur et reçoit dans la course', A2 => { A2.run(fw2, [P[fw2][0] + w * .15, P[fw2][1] < h / 2 ? 1.5 : h - 1.5], .25); A2.pass(fw2, .1); A2.pressBall(B, .4); });
    else if (fw2) S.step('Appel en profondeur du deuxième attaquant, passe dans la course', A2 => { A2.run(fw2, [w * .82, clamp(P[fw2][1] + (P[fw2][1] < h / 2 ? 1.5 : -1.5), 1, h - 1)], .2); A2.pass(fw2, -.1); A2.pressBall(B, .45); });
    const goalP = [w - (sport() === 'rugby' ? .5 : 0), h / 2 - .7];
    S.step(shotWord() + (r.gk ? ' : le gardien plonge' : ''), A2 => { if (gkB) A2.run(gkB, [w - 1.2, goalP[1] + (goalP[1] > h / 2 ? .8 : -.8)]); A2.shot(goalP); }, 1.2);
    return S.sc;
  }

  /* ---------- finishing: a pass, a control (or a une-deux), the shot; a cross with the runs to the posts ---------- */
  function finish(ex, r) {
    const w = r.w || 30, h = r.h || 25, net = sport() === 'volley';
    const S = story(ex.title || 'Finition', w, h), P = S.pos;
    if (net) { for (let y = .5; y < h; y += 1.5) S.cone([w / 2, y], 'blanc'); }
    else S.goal(w, h / 2, 0, sport() === 'foot' && !r.w ? 5 : 3);
    const gk = r.gk && !net ? S.add(gkObj(), [w - 1, h / 2]) : null;
    if (r.acts.cross && !net) {
      const wing = S.add(home(7), [w * .45, 1.5]), s9 = S.add(home(9), [w * .55, h * .45]), s10 = S.add(home(10), [w * .5, h * .7]), p = S.add(home(6), [w * .3, h * .35]);
      const d = S.add(away(4), [w * .78, h * .45]);
      S.giveBall(p); S.start('Le passeur, l\'ailier le long de la ligne, deux attaquants au centre');
      S.step('Passe en profondeur pour l\'ailier qui part', A => { A.run(wing, [w * .62, 1.5]); A.pass(wing, .1); });
      S.step('L\'ailier déborde en conduite, les attaquants attendent pour partir', A => { A.dribble(wing, [w * .88, 1.8]); A.run(d, [w * .84, h * .42]); });
      S.step('Appels croisés : le 9 au premier poteau, le 10 au second', A => { A.run(s9, [w - 3.5, h / 2 - 2], .2); A.run(s10, [w - 4, h / 2 + 3], -.2); A.press(d, [w - 3, h / 2 - 1]); });
      S.step('Centre tendu au premier poteau', A => { A.pass(s9, -.2); if (gk) A.run(gk, [w - 1.2, h / 2 - 1.5]); });
      S.step('Reprise de volée', A => { A.shot([w, h / 2 + .5]); }, 1.2);
      return S.sc;
    }
    const file = [w * .25, h * .75];
    const queue = [1, 2, 3].map(i => S.add(home(i + 1), [file[0] - i * 1.4, file[1] + i * .6]));
    const sh = S.add(home(1), file), pas = S.add(home('P'), net ? [w * .45, h * .5] : [w * .45, h * .3]);
    const wall = r.acts.oneTwo && !net ? S.add(home('M'), [w * .6, h * .45]) : null;
    S.cone([file[0], file[1] + .9], 'bleu');
    S.giveBall(pas); S.start(net ? 'Le passeur au filet, les attaquants en file' : 'Le passeur au centre, les tireurs en file derrière le plot bleu');
    if (net) {
      S.step('Le premier attaquant prend son élan', A => { A.run(sh, [w * .35, h * .55]); });
      S.step('Passe haute vers l\'attaquant', A => { A.pass(sh, .2); });
      S.step('Saut et attaque', A => { A.shot([w * .8, h * .3]); }, 1.2);
    } else {
      S.step('Le tireur part, passe dans sa course', A => { A.run(sh, [w * .5, h * .62], .1); A.pass(sh, .1); });
      if (wall) {
        S.step('Une-deux : passe au joueur en appui…', A => { A.pass(wall); });
        S.step('…le tireur suit, remise dans sa course', A => { A.run(sh, [w * .72, h * .5], -.15); A.pass(sh, -.1); });
      } else S.step('Contrôle orienté vers le but et conduite', A => { A.dribble(sh, [w * .72, h * .52]); });
      S.step(shotWord() + (gk ? ' : le gardien plonge' : ''), A => { if (gk) A.run(gk, [w - 1.2, h / 2 - 1.4]); A.shot([w, h / 2 - .9]); }, 1.2);
      S.step('Le suivant s\'avance, le tireur va chercher le ballon et revient en file', A => { A.run(queue[0], file); A.run(sh, [file[0] - 4 * 1.4, file[1] + 2.4], .3); });
    }
    return S.sc;
  }

  /* ---------- duel: the dribble, the feint, the acceleration, the shot ---------- */
  function duel(ex, r) {
    const w = r.w || 20, h = r.h || 10;
    const S = story(ex.title || 'Duel 1 contre 1', w, h), P = S.pos;
    [[.5, .5], [w - .5, .5], [.5, h - .5], [w - .5, h - .5]].forEach(p => S.cone(p));
    if (sport() !== 'rugby' && sport() !== 'volley') S.goal(w, h / 2, 0, 3);
    const at = S.add(home(1), [2, h / 2]), df = S.add(away(1), [w * .65, h / 2]);
    S.giveBall(at); S.start('L\'attaquant part avec le ballon, le défenseur face à lui');
    S.step('Conduite vers le défenseur, qui sort', A => { A.dribble(at, [w * .4, h / 2]); A.press(df, [w * .55, h / 2]); });
    S.step('Feinte de corps vers l\'intérieur…', A => { A.dribble(at, [w * .45, h * .62], .2); A.press(df, [w * .54, h * .58]); }, 1.2);
    S.step('…et changement de rythme par l\'extérieur', A => { A.dribble(at, [w * .68, h * .22], -.2); A.press(df, [w * .6, h * .35]); }, 1.4);
    S.step(sport() === 'rugby' ? 'Il aplatit derrière la ligne' : shotWord(), A => { if (sport() === 'rugby') A.dribble(at, [w - 1, h * .3]); else A.shot([w, h / 2 - .6]); A.run(df, [w * .72, h * .3]); }, 1.2);
    return S.sc;
  }

  /* ---------- a shape of cones: pass and follow, une-deux ---------- */
  function shape(ex, r) {
    const n = r.shape === 3 ? 3 : 4, s = r.w || (n === 3 ? 10 : 12), hh = r.h || s, col = r.shape === 'col';
    const S = story(ex.title || 'Exercice', s, hh), P = S.pos;
    let pts;
    if (col) pts = [[1.5, hh / 2], [s - 1.5, hh / 2]];
    else if (r.shape === 'lo') pts = [[s / 2, .9], [s - .9, hh / 2], [s / 2, hh - .9], [.9, hh / 2]];
    else if (n === 3) pts = [[s / 2, .9], [s - .9, hh - .9], [.9, hh - .9]];
    else pts = [[.9, .9], [s - .9, .9], [s - .9, hh - .9], [.9, hh - .9]];
    pts.forEach(p => S.cone(p));
    const at = pts.map((p, i) => S.add(home(i + 1), [p[0] + (p[0] < s / 2 ? -.5 : .5) * (col ? 0 : 1), p[1]]));
    // a second player waits behind the first cone (he starts the next round)
    const wait = S.add(home(pts.length + 1), col ? [.4, hh / 2] : [pts[0][0] - .4, pts[0][1] - .4]);
    if (col) S.add(home(pts.length + 2), [s - .4, hh / 2]);
    S.giveBall(at[0]); S.start(col ? 'Deux files face à face, le premier a le ballon' : `Un joueur à chaque plot (${n === 3 ? 'triangle' : r.shape === 'lo' ? 'losange' : 'carré'}), le 1 a le ballon`);
    const m = pts.length;
    if (r.acts.oneTwo && !col && m >= 3) {
      S.step('Le 1 passe au 2', A => { A.pass(at[1]); });
      S.step('Une-deux : le 1 court vers l\'intérieur, le 2 lui remet en une touche', A => { A.run(at[0], [s / 2, hh / 2], .1); A.pass(at[0], .1); }, 1.6);
      S.step('Le 1 passe au 3 et prend la place du 2', A => { A.pass(at[2], -.1); A.run(at[0], [pts[1][0], pts[1][1] + .7], .15); A.run(at[1], [pts[2][0] - .6, pts[2][1]], .15); });
      S.step('Le 3 enchaîne avec le 4, chacun avance d\'un plot', A => { A.pass(at[3 % m]); A.run(at[2], [pts[3 % m][0], pts[3 % m][1] - .7], .15); A.run(wait, pts[0]); });
      return S.sc;
    }
    for (let k = 0; k < Math.max(3, m); k++) {
      const from = at[k % m], to = at[(k + 1) % m], target = pts[(k + 1) % m];
      S.step(col ? 'Passe vers la file d\'en face, je suis ma passe et je vais au bout de l\'autre file' : `Le ${k % m + 1} passe au ${(k + 1) % m + 1} et suit sa passe jusqu'au plot suivant`, A => {
        A.pass(to); A.run(from, [target[0] + (target[0] < s / 2 ? -.9 : .9), target[1] + (target[1] < hh / 2 ? -.9 : .9)], .2);
      });
      if (k === 0) S.step('Le receveur contrôle vers le plot suivant (contrôle orienté)', A => { const nx = pts[(k + 2) % m]; A.dribble(to, [P[to][0] + (nx[0] - P[to][0]) * .15, P[to][1] + (nx[1] - P[to][1]) * .15]); }, 1);
    }
    return S.sc;
  }

  /* ---------- running ---------- */
  function run(ex, r) {
    const w = r.w || 25, h = r.h || 10;
    const S = story(ex.title || 'Physique', w, h);
    const lanes = Math.max(2, Math.min(4, r.group || 3)), ids = [];
    for (let i = 0; i < lanes; i++) { const y = h * (i + 1) / (lanes + 1); [2, w * .5, w - 2].forEach(x => S.cone([x, y])); ids.push(S.add(home(i + 1), [1, y])); }
    S.start('Départ derrière la ligne');
    S.step('Accélération jusqu\'au plot du milieu', A => ids.forEach(id => A.run(id, [w * .5 - .6, S.pos[id][1]])));
    S.step('Sprint jusqu\'au dernier plot', A => ids.forEach(id => A.run(id, [w - 2.6, S.pos[id][1]])), 1.2);
    S.step('Retour en trottinant (récupération)', A => ids.forEach(id => A.run(id, [1.5, S.pos[id][1]], .3)), 2.2);
    return S.sc;
  }

  // the schema of an exercise (not saved): its action told step by step
  function build(ex) {
    const r = read(ex);
    const sc = ({ possession, game, finish, duel, shape, run })[r.kind](ex, r);
    sc.name = ex.title || sc.name;
    sc.notes = [ex.org, ex.consignes].filter(Boolean).join('\n');
    sc.kind = r.kind;
    if (!sc.steps.length) sc.steps.push({ pos: {}, arrows: [], moves: {}, note: '', dur: 2 });
    return sc;
  }
  // a preview for the card: the same id as long as the text does not change (the picture is kept)
  function preview(ex) {
    const txt = `${ex.title}|${ex.org}|${ex.consignes}|${ex.size}`;
    let hsh = 0; for (let i = 0; i < txt.length; i++) hsh = (hsh * 31 + txt.charCodeAt(i)) | 0;
    const key = 'auto-' + (ex.id || 'x') + ':' + hsh;
    if (cache.has(key)) return cache.get(key);
    const sc = build(ex); sc.id = 'auto-' + (ex.id || 'x'); sc.updatedAt = hsh;
    cache.set(key, sc); return sc;
  }
  const cache = new Map();
  // keep it: a real schema of the club (it can then be changed like any other)
  function save(ex, teamId) {
    const sc = build(ex); sc.id = Store.uid(); sc.teamId = teamId || null; delete sc.kind;
    return Store.upsert('schemas', sc);
  }

  /* ---------- the exercise in large: played by itself or step by step, the sentence of each step, the text in big letters ---------- */
  function big(ex, scIn) {
    const sc = scIn || preview(ex);
    const cons = String(ex.consignes || '').split('\n').filter(Boolean), n = sc.steps.length;
    const close = UI.modal({ title: ex.title || 'Exercice', noFocus: true,
      body: `<div class="ex-big"><div class="ex-big-board"><canvas id="exBigC"></canvas>
          <p class="ex-big-step" id="exBigNote"></p>
          <div class="chips"><button type="button" class="btn soft" data-bg="prev" aria-label="Étape précédente">◀</button><button type="button" class="btn soft" data-bg="play">⏸<span>Pause</span></button><button type="button" class="btn soft" data-bg="next" aria-label="Étape suivante">▶</button>
            <button type="button" class="btn soft" data-bg="slow">🐢<span>Lent</span></button><button type="button" class="btn soft" data-bg="zoom">🔍<span>Plein écran</span></button></div></div>
        <div class="ex-big-txt">${ex.duration ? `<p class="ex-big-dur">⏱️ ${UI.esc(ex.duration)} min${ex.size ? ' · ' + UI.esc(String(ex.size).replace('x', ' × ')) + ' m' : ''}</p>` : ''}
          ${sc.steps[0] && sc.steps[0].note ? `<p class="muted">📍 ${UI.esc(sc.steps[0].note)}</p>` : ''}
          <h3>Les actions</h3><ol class="ex-big-steps">${sc.steps.slice(1).map((s, i) => `<li data-st="${i + 1}">${UI.esc(s.note || '')}</li>`).join('')}</ol>
          ${ex.org ? `<h3>Organisation</h3><p>${UI.esc(ex.org).replace(/\n/g, '<br>')}</p>` : ''}
          ${cons.length ? `<h3>Consignes</h3><ul>${cons.map(c => `<li>${UI.esc(c)}</li>`).join('')}</ul>` : ''}
          ${ex.materiel ? `<h3>Matériel</h3><p>${UI.esc(ex.materiel)}</p>` : ''}</div></div>`,
      onOpen: r => {
        const cv = r.querySelector('#exBigC'), box = cv.parentNode, note = r.querySelector('#exBigNote');
        // time in « steps »: k.u = between step k and k+1; play = it moves by itself, else it stays on a step
        let playing = true, speed = 1, pos = 0, last = performance.now(), raf = 0;
        const durOf = k => (sc.steps[k + 1] || {}).dur || 1.6;
        const paint = () => {
          const W = box.clientWidth, ratio = Math.min(.8, (Board.dims(sc.field).W / Board.dims(sc.field).L) || .62), H = Math.round(W * ratio);
          if (cv.width !== W * 2) { cv.width = W * 2; cv.height = H * 2; cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
          const k = Math.min(n - 1, Math.floor(pos)), u = k < n - 1 ? pos - k : 0;
          Board.drawFrame(cv.getContext('2d'), cv.width, cv.height, sc, k, u, { homeBib: club().homeBib });
          // the drawing shows the action that leads to the next step: its sentence is the one of that step (step 0 is the starting position)
          const cur = n > 1 ? Math.min(n - 1, k + 1) : 0;
          note.innerHTML = n > 1 ? `<b>Action ${cur}/${n - 1}</b> · ${UI.esc((sc.steps[cur] || {}).note || '')}` : UI.esc((sc.steps[0] || {}).note || '');
          r.querySelectorAll('[data-st]').forEach(li => li.classList.toggle('on', +li.dataset.st === cur));
        };
        const tick = now => {
          if (!document.body.contains(cv)) return cancelAnimationFrame(raf);
          const dt = (now - last) / 1000; last = now;
          if (playing) { const k = Math.floor(pos); pos += dt * speed / (k < n - 1 ? durOf(k) : 1.2); if (pos >= n) pos = 0; }
          paint(); raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        const setPlay = on => { playing = on; const b = r.querySelector('[data-bg="play"]'); b.innerHTML = on ? '⏸<span>Pause</span>' : '▶<span>Lecture</span>'; };
        r.querySelector('.ex-big').onclick = e => {
          const li = e.target.closest('[data-st]'); if (li) { setPlay(false); pos = Math.max(0, +li.dataset.st - 1); return; }
          const b = e.target.closest('[data-bg]'); if (!b) return;
          if (b.dataset.bg === 'play') setPlay(!playing);
          if (b.dataset.bg === 'prev') { setPlay(false); pos = Math.max(0, Math.ceil(pos) - 1); }
          if (b.dataset.bg === 'next') { setPlay(false); pos = Math.min(n - 1, Math.floor(pos) + 1); }
          if (b.dataset.bg === 'slow') { speed = speed === 1 ? .45 : 1; b.classList.toggle('on', speed !== 1); }
          if (b.dataset.bg === 'zoom') { const el = r.querySelector('.ex-big'); (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el); }
        };
      } });
    return close;
  }
  return { read, build, preview, save, big };
})();
