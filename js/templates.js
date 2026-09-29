/* Templates: ready-made animated schemas (rondo, 3 contre 2, conservation, sortie de balle, centre-tir)
   that a coach opens as a new schema and adapts, and the blank board of the whiteboard mode. */
const Templates = (() => {
  const club = () => Store.state.club;
  // A schema with n steps; each object gets one position per step (the last one repeats)
  function mk(name, field, notes) {
    return { id: Store.uid(), name, teamId: null, field, overlays: {}, objects: [], zones: [],
      steps: notes.map(n => ({ pos: {}, arrows: [], moves: {}, note: n, dur: 2 })) };
  }
  function put(sc, o, positions) {
    o.id = Store.uid(); sc.objects.push(o);
    sc.steps.forEach((st, i) => { st.pos[o.id] = (positions[i] || positions[positions.length - 1]).slice(); });
    return o.id;
  }
  // Arrow type of the movement that arrives at step k (course, conduite, passe, tir, pressing, bascule)
  const mv = (sc, k, id, type, c = 0) => { sc.steps[k].moves[id] = { type, c }; };
  const home = label => ({ type: 'player', color: club().homeBib, label });
  const away = label => ({ type: 'player', color: club().awayBib, label });
  const joker = label => ({ type: 'player', color: 'jaune', label });
  const gk = (color = 'jaune') => ({ type: 'player', color, gk: true, label: 'G' });
  const cones = (sc, pts, color = 'orange') => pts.forEach(p => put(sc, { type: 'cone', color }, [p]));

  const LIST = [
    { key: 'rondo', name: 'Rondo 4 contre 1', desc: 'Carré de 12 m, conservation et jeu à une touche', build() {
      const sc = mk('Rondo 4 contre 1', { format: 'zone', view: 'full', w: 12, h: 12 },
        ['4 joueurs sur les côtés du carré, 1 défenseur au milieu', 'A passe à B, le défenseur presse B', 'B joue à une touche vers C, le défenseur ferme la passe']);
      cones(sc, [[.6, .6], [11.4, .6], [11.4, 11.4], [.6, 11.4]]);
      const b = put(sc, { type: 'ball' }, [[6.9, 1.9], [10.1, 6.9], [6.9, 10.1]]);
      put(sc, home('A'), [[6, 1.2]]); put(sc, home('B'), [[10.8, 6]]); put(sc, home('C'), [[6, 10.8]]); put(sc, home('D'), [[1.2, 6]]);
      const x = put(sc, away('X'), [[6, 6], [8.6, 5.2], [7.6, 8.4]]);
      mv(sc, 1, b, 'passe'); mv(sc, 1, x, 'pressing'); mv(sc, 2, b, 'passe'); mv(sc, 2, x, 'pressing');
      sc.notes = 'Objectif : conserver le ballon, jeu en 1 ou 2 touches.\nVariantes : 5 contre 2, limiter à une touche, compter les passes (10 passes = 1 point).';
      return sc;
    } },
    { key: '3c2', name: '3 contre 2 vers le but', desc: 'Surnombre offensif et finition', build() {
      const sc = mk('3 contre 2 vers le but', { format: 'zone', view: 'full', w: 30, h: 25 },
        ['Le milieu part balle au pied, les deux attaquants sont écartés', 'Il conduit et fixe un défenseur, les ailiers attaquent la profondeur', 'Passe dans le dos au joueur libre', 'Tir']);
      put(sc, { type: 'goal', size: 'big', w: 6, rot: 0 }, [[30, 12.5]]);
      put(sc, gk(), [[29, 12.5], [29, 12.5], [28.6, 15], [28.8, 14]]);
      const m = put(sc, home('8'), [[5, 12.5], [13, 12.5], [14, 12.5], [18, 12]]);
      const l = put(sc, home('11'), [[6, 5], [14, 4.5], [20, 7], [22, 8]]);
      const r = put(sc, home('7'), [[6, 20], [15, 20.5], [21, 18.5], [23, 17]]);
      put(sc, away('4'), [[19, 9.5], [16, 11], [17, 10], [19.5, 10.5]]);
      put(sc, away('5'), [[19, 15.5], [18, 15], [19, 13.5], [21, 14.5]]);
      const b = put(sc, { type: 'ball' }, [[5.9, 13.2], [13.9, 13.2], [21.5, 17.8], [30, 13.5]]);
      mv(sc, 1, m, 'conduite'); mv(sc, 2, b, 'passe'); mv(sc, 2, r, 'course', -.15); mv(sc, 3, b, 'tir');
      sc.notes = 'Objectif : utiliser le surnombre, fixer un défenseur avant de passer.\nRègle : 8 secondes pour finir. Les défenseurs qui récupèrent marquent dans les mini-buts.';
      return sc;
    } },
    { key: 'conservation', name: 'Conservation 4 contre 4 + 2 jokers', desc: 'Garder le ballon avec les appuis', build() {
      const sc = mk('Conservation 4 contre 4 + 2 jokers', { format: 'zone', view: 'full', w: 30, h: 20 },
        ['4 contre 4 dans le carré, les jokers jaunes jouent avec l\'équipe qui a le ballon', 'Passe au joker pour sortir du pressing', 'Le joker rejoue vers un partenaire démarqué']);
      cones(sc, [[.6, .6], [29.4, .6], [29.4, 19.4], [.6, 19.4]]);
      const h1 = put(sc, home('1'), [[8, 6]]); put(sc, home('2'), [[20, 5]]); put(sc, home('3'), [[10, 14], [10, 14], [13, 16]]); put(sc, home('4'), [[21, 15]]);
      put(sc, away('1'), [[11, 8], [9.6, 7]]); put(sc, away('2'), [[17, 8]]); put(sc, away('3'), [[13, 12.5]]); put(sc, away('4'), [[23, 11]]);
      put(sc, joker('J'), [[15, .9]]); put(sc, joker('J'), [[15, 19.1]]);
      const b = put(sc, { type: 'ball' }, [[8.9, 6.7], [15, 1.9], [12.4, 15.6]]);
      mv(sc, 1, b, 'passe'); mv(sc, 2, b, 'passe', .15); mv(sc, 1, h1, 'course');
      sc.notes = 'Objectif : conserver, se démarquer, utiliser les appuis.\nRègles : jokers en 2 touches, 8 passes = 1 point. Changer d\'équipe toutes les 3 minutes.';
      return sc;
    } },
    { key: 'sortie', name: 'Sortie de balle à 3', desc: 'Foot à 11 : le 6 descend, les latéraux montent', build() {
      const sc = mk('Sortie de balle à 3', { format: '11', view: 'full' },
        ['Le gardien a le ballon, 3 adversaires pressent', 'Les centraux s\'écartent, le 6 descend entre eux, les latéraux montent', 'Le gardien joue sur le central libre', 'Le central casse la ligne vers le latéral']);
      const L = 105, W = 68, P = (x, y) => [x * L, y * W];
      const F = Object.fromEntries(Formations['11']['4-3-3'].map(([lab, x, y]) => [lab, P(x, y)]));
      const open = { '5': P(.07, .22), '4': P(.07, .78), '6': P(.13, .5), '3': P(.3, .07), '2': P(.3, .93), '8': P(.33, .32), '10': P(.33, .68) };
      const ids = {};
      Formations['11']['4-3-3'].forEach(([lab, , , g]) => {
        const a = F[lab], b = open[lab] || a;
        ids[lab] = put(sc, g ? gk() : home(lab), [a, b]);
      });
      put(sc, away('9'), [P(.2, .5), P(.14, .42)]); put(sc, away('11'), [P(.24, .3), P(.14, .25), P(.1, .74)]); put(sc, away('7'), [P(.24, .7), P(.14, .72), P(.12, .74)]);
      const b = put(sc, { type: 'ball' }, [[F.G[0] + 1.8, F.G[1] + 1.2], [F.G[0] + 1.8, F.G[1] + 1.2], [open['4'][0] + 1.6, open['4'][1] + 1], [open['2'][0] + 1.6, open['2'][1] - 1]]);
      mv(sc, 2, b, 'passe', -.1); mv(sc, 3, b, 'passe');
      ['5', '4', '6', '3', '2'].forEach(k => mv(sc, 1, ids[k], 'course'));
      sc.overlays = { lanes: true };
      sc.notes = 'Objectif : sortir le ballon proprement face au pressing.\nPoints clés : écarter les centraux, 6 disponible entre les lignes, orienter le contrôle vers l\'avant.';
      return sc;
    } },
    { key: 'centre', name: 'Centre-tir', desc: 'Débordement, centre et attaque des zones', build() {
      const sc = mk('Centre-tir', { format: '11', view: 'half' },
        ['Le passeur sert l\'ailier dans la course', 'L\'ailier déborde, les attaquants attaquent le premier et le second poteau', 'Centre en retrait ou au premier poteau', 'Frappe']);
      put(sc, gk(), [[103.5, 34], [103.5, 34], [103.2, 32], [103.2, 31]]);
      put(sc, home('6'), [[72, 36]]);
      const w = put(sc, home('7'), [[80, 60], [88, 62], [99, 60]]);
      const s9 = put(sc, home('9'), [[84, 36], [86, 36], [99, 30.5]]);
      const s10 = put(sc, home('10'), [[80, 44], [82, 44], [93, 39]]);
      put(sc, away('4'), [[92, 32], [93, 33], [100, 32]]);
      const b = put(sc, { type: 'ball' }, [[73, 37.3], [88.9, 61], [99.6, 58.8], [99.6, 31.4], [105, 32.5]]);
      sc.steps.push({ pos: JSON.parse(JSON.stringify(sc.steps[3].pos)), arrows: [], moves: {}, note: 'But !', dur: 1.3 });
      sc.steps[4].pos[b] = [105, 32.5]; sc.steps[3].note = 'Centre au premier poteau pour le 9';
      mv(sc, 1, b, 'passe', .1); mv(sc, 1, w, 'course'); mv(sc, 2, w, 'conduite');mv(sc, 3, b, 'passe', -.2);
      mv(sc, 2, s9, 'course', .2); mv(sc, 2, s10, 'course'); mv(sc, 4, b, 'tir');
      cones(sc, [[72, 38.5]], 'bleu');
      sc.notes = 'Objectif : déborder et finir sur centre.\nPoints clés : timing des appels (premier poteau, second poteau, retrait), centre tendu devant le gardien.';
      return sc;
    } },
  ];

  // New schema from a template, saved and ready to open
  function create(key, teamId) {
    const t = LIST.find(x => x.key === key); if (!t) return null;
    const sc = t.build(); sc.teamId = teamId || null;
    return Store.upsert('schemas', sc);
  }
  // The whiteboard: a blank board that is never saved (unless the coach asks)
  function blank(format = '11') {
    const field = format === 'zone' ? { format, view: 'full', w: 40, h: 25 } : { format, view: 'full' };
    return { id: 'tableau-' + Store.uid(), name: 'Tableau blanc', teamId: null, field, overlays: {}, objects: [], zones: [], steps: [{ pos: {}, arrows: [], moves: {}, note: '', dur: 2 }], scratch: true };
  }
  return { LIST, create, blank };
})();
