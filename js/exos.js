/* Exos: the exercise library of the club, and a session built on demand.
   Every exercise the coaches wrote in a session (with its diagram) is found here, by theme and by category;
   a base of classic exercises fills the gaps from the first day. « Générer une séance »: a theme, a category, a length →
   warm-up, 2 or 3 exercises of the theme (from simple to game-like), a themed game, cool-down; the club's exercises first. */
const Exos = (() => {
  const { esc, $, $$, toast, modal } = UI;
  const S = () => Store.state;
  const THEMES_F = [['pressing', '🔥 Pressing / récupération'], ['conservation', '🔄 Conservation'], ['transitions', '⚡ Transitions'], ['finition', '🎯 Finition'],
    ['defense', '🛡️ Défense'], ['construction', '🧱 Construction / relance'], ['technique', '⚽ Technique'], ['cpa', '🚩 Coups de pied arrêtés'], ['physique', '🏃 Physique / vitesse'],
    ['gardien', '🧤 Gardien de but'], ['echauffement', '🔥 Échauffement'], ['jeu', '🏟️ Jeu / match à thème'], ['calme', '🧘 Retour au calme']];
  const KEYS_F = { pressing: /press|récup|contre-press|harc|déclench/i, conservation: /conserv|rondo|possess|toro|garder le ballon/i, transitions: /transit|contre-attaque|perte.*balle|récupération.*attaque|attaque rapide/i,
    finition: /finit|frapp|\btirs?\b|\bcentres?\b|devant le but|conclu/i, defense: /défen|duel|marquage|bloc|couverture|coulisse/i, construction: /construct|relance|sortie de balle|jeu court|premi[eè]re relance/i,
    technique: /techni|contrôle|passe|conduite|dribble|jongl|coordination|motricit/i, cpa: /cpa|corner|coup franc|coup-franc|penalty|touche longue|arrêté/i,
    physique: /physi|vitesse|sprint|endurance|puissance|fractionn|intermittent|explos|athlét/i, echauffement: /échauff|activation|mobilit|gamme/i,
    gardien: /gardien|plongeon|sortie aérienne|prise de balle/i, jeu: /match|jeu réduit|jeu à thème|opposition|\d ?c ?\d|contre \d/i, calme: /retour au calme|étirement|récupération active/i };
  // age groups: the format of the team (5, 8 or 11)
  const fmtOf = teamId => ((Store.get('teams', teamId) || {}).format) || Sport.defFormat();
  // the classic base: [theme, title, minutes, organisation, consignes, matériel, formats]
  const BASE_F = [
    ['echauffement', 'Échauffement avec ballon par 2', 12, 'Par 2, 15 m d\'écart. Passes, contrôles orientés, puis déplacements.', 'Contrôle orienté du bon pied\nRegarder avant de recevoir\nMonter progressivement l\'intensité', 'Ballons, plots', '5,8,11'],
    ['echauffement', 'Activation : gammes et coordination', 10, 'Couloir de 20 m, échelle de rythme et petites haies.', 'Appuis rapides\nGainage du buste\nAccélération en sortie', 'Échelle, haies, plots', '8,11'],
    ['echauffement', 'Le béret / jeu de réaction', 10, 'Deux équipes face à face, un ballon au centre. Le coach appelle un numéro.', 'Réagir vite\nProtéger le ballon\nRevenir en défense', 'Ballons, plots', '5,8'],
    ['conservation', 'Rondo 5 contre 2', 12, 'Carré de 12 × 12 m. 5 joueurs autour, 2 au milieu. Le défenseur qui récupère sort celui qui a perdu.', 'Deux touches maximum\nOffrir des angles de passe\nPasse à l\'opposé quand c\'est fermé', 'Ballons, chasubles, plots', '5,8,11'],
    ['conservation', 'Conservation 4 contre 4 + 2 jokers', 15, 'Carré de 25 × 25 m. Les jokers jouent avec l\'équipe qui a le ballon.', 'Se démarquer dans les intervalles\nJouer vite\nChanger de côté', 'Chasubles 3 couleurs', '8,11'],
    ['conservation', 'Toro 3 contre 1 en triangle', 10, 'Triangles de 8 m, un défenseur par triangle.', 'Soutien toujours proche\nContrôle orienté vers le partenaire libre', 'Ballons, plots', '5,8'],
    ['pressing', 'Pressing 3 contre 2 : récupérer vite', 12, 'Zone de 20 × 15 m. 3 attaquent en conservation, 2 pressent puis 1 renfort entre.', 'Presser en triangle\nCouper la passe vers l\'axe\nRécupérer en moins de 6 secondes', 'Chasubles, plots', '8,11'],
    ['pressing', 'Pressing sur la relance adverse', 20, 'Demi-terrain. L\'adversaire relance de son gardien, nous pressons sur un signal (passe au latéral).', 'Signal : passe vers le côté\nFermer l\'intérieur\nLe bloc monte ensemble', 'Chasubles, ballons, 2 buts', '8,11'],
    ['pressing', 'Jeu réduit 5 contre 5 : contre-pressing 5 secondes', 15, 'Terrain de 35 × 25 m, 2 buts. Un point en plus si on récupère dans les 5 secondes après la perte.', 'Réagir tout de suite à la perte\nLe plus proche presse, les autres ferment\nGagner le duel', 'Chasubles, 2 buts', '8,11'],
    ['transitions', 'Transition 3 contre 2 puis 2 contre 1 retour', 15, 'Longueur de 40 m. Attaque à 3 contre 2, puis les 2 défenseurs repartent en 2 contre 1.', 'Attaquer vite l\'espace\nFixer avant de passer\nRepli immédiat', 'Ballons, 2 buts', '8,11'],
    ['transitions', 'Récupérer et marquer en 8 secondes', 15, 'Demi-terrain, 6 contre 6 + gardiens. Après la récupération, 8 secondes pour marquer.', 'Première passe vers l\'avant\n3 joueurs partent\nFinir l\'action', 'Chasubles, buts, chrono', '8,11'],
    ['finition', 'Frappes après combinaison', 15, 'Deux colonnes à 25 m du but. Une-deux avec le pivot puis frappe.', 'Frappe cadrée\nSurface de pied adaptée\nSuivre sa frappe', 'Ballons, but, plots', '5,8,11'],
    ['finition', 'Centres et reprises', 15, 'Couloir latéral + 2 attaquants dans la surface (premier et second poteau).', 'Centre en retrait ou tendu\nAttaquer le premier poteau\nDécaler les courses', 'Ballons, but, plots', '8,11'],
    ['finition', 'Duels 1 contre 1 face au but', 12, 'Deux colonnes, départ côte à côte à 25 m. Le coach lance le ballon.', 'Protéger le ballon\nFrapper vite\nDéfenseur : cadrer, orienter', 'Ballons, but', '5,8,11'],
    ['defense', 'Défense à 4 : coulisser et couvrir', 20, 'Ligne de 4 défenseurs contre 3 milieux qui font circuler sur la largeur.', 'Coulisser ensemble\nCouverture derrière celui qui sort\nParler', 'Plots, ballons', '11'],
    ['defense', 'Duels 1 contre 1 défensifs', 12, 'Couloir de 10 × 15 m, l\'attaquant doit franchir la ligne.', 'Distance d\'intervention\nSur les appuis, de profil\nPousser vers l\'extérieur', 'Plots, ballons', '5,8,11'],
    ['defense', 'Défendre les centres', 15, 'Centres des deux côtés, 3 défenseurs contre 3 attaquants dans la surface.', 'Voir le ballon et l\'adversaire\nAttaquer le ballon\nDégager loin et large', 'Ballons, but', '8,11'],
    ['construction', 'Sortie de balle depuis le gardien', 20, 'Tiers défensif : gardien + 4 défenseurs + 2 milieux contre 4 presseurs.', 'Écarter les défenseurs centraux\nUn milieu entre les lignes\nSi c\'est fermé : jeu long ciblé', 'Chasubles, but, mini-buts', '8,11'],
    ['construction', 'Jeu en triangle et troisième homme', 15, 'Losanges de 15 m, circulation à une ou deux touches.', 'Remiser pour le troisième\nFaux appel avant de recevoir', 'Ballons, plots', '8,11'],
    ['technique', 'Conduite de balle et dribbles', 12, 'Slalom entre plots puis dribble face à un défenseur passif.', 'Toucher le ballon souvent\nChangement de rythme\nTête levée', 'Plots, ballons', '5,8'],
    ['technique', 'Passes et contrôles en carré', 12, 'Carré de 10 m, un joueur par plot, passe et suit.', 'Contrôle orienté\nPasse au sol, appuyée\nAnnoncer', 'Ballons, plots', '5,8,11'],
    ['technique', 'Jonglerie et coordination', 10, 'Chacun son ballon, défis de jonglerie.', 'Pied fort puis pied faible\nCuisse, tête\nSe fixer un record', 'Ballons', '5,8'],
    ['cpa', 'Corners offensifs', 12, 'Corner des deux côtés, 5 attaquants dans la surface contre défense et gardien.', 'Courses croisées\nUn joueur sur le gardien\nAttaquer le ballon', 'Ballons, but', '8,11'],
    ['cpa', 'Corners défensifs : placement', 10, 'Placement en zone + 2 joueurs au marquage.', 'Chacun connaît sa zone\nSortir ensemble après le dégagement', 'Ballons, but', '8,11'],
    ['cpa', 'Coups francs et penalties', 10, 'Tireurs désignés, coups francs à 20-25 m et penalties.', 'Routine avant la frappe\nChoisir son côté', 'Ballons, but, mur', '8,11'],
    ['physique', 'Vitesse : départs et sprints courts', 10, 'Sprints de 10 à 20 m, départs variés (assis, dos, au signal).', 'Récupération complète entre les sprints\nPremiers appuis rapides', 'Plots', '8,11'],
    ['physique', 'Intermittent 15-15 avec ballon', 12, '15 s de course rapide balle au pied, 15 s de marche, 2 × 6 min.', 'Tenir le rythme\nRespirer', 'Ballons, plots', '11'],
    ['physique', 'Jeu réduit 4 contre 4 intense', 16, 'Terrain de 30 × 20 m, 4 × 3 min, 1 min de récupération.', 'Intensité maximale\nPresser à la perte\nEncourager', 'Chasubles, 2 buts', '8,11'],
    ['jeu', 'Match à thème', 20, 'Grand terrain, consigne liée au thème de la séance (ex : but valable après 5 passes, pressing sur signal).', 'Appliquer le thème\nLe coach arrête pour corriger', 'Chasubles, buts', '5,8,11'],
    ['jeu', 'Jeu réduit 6 contre 6 avec zones', 20, 'Terrain de 50 × 35 m découpé en 3 zones, contraintes par zone.', 'Occuper la largeur\nProgresser zone par zone', 'Chasubles, buts, plots', '8,11'],
    ['jeu', 'Petit match 3 contre 3', 15, 'Terrain de 20 × 15 m, mini-buts, pas de gardien.', 'Chacun touche beaucoup de ballons\nAttaquer, défendre ensemble', 'Mini-buts, chasubles', '5,8'],
    ['calme', 'Retour au calme et étirements', 5, 'Footing léger puis étirements en cercle, retour sur la séance.', 'Respirer calmement\nUne phrase sur ce qu\'on retient', '', '5,8,11'],
    // (3.40) des exercices pour chaque âge et chaque taille de terrain, et pour les gardiens (dimensions en mètres)
    ['jeu', 'L\'épervier balle au pied', 10, 'Couloir de 20 × 15 m. Les joueurs traversent en conduite, l\'épervier au milieu essaie de toucher les ballons ; ceux touchés deviennent éperviers.', 'Garder le ballon près du pied\nLever la tête\nChanger de direction', 'Ballons, plots', '5', '20x15'],
    ['technique', 'Les déménageurs', 10, 'Deux camps de 15 × 15 m, ballons au centre. En 1 minute, ramener le plus de ballons en conduite dans son camp.', 'Conduite rapide\nPetites touches\nOn ne prend qu\'un ballon à la fois', 'Ballons, plots', '5', '30x15'],
    ['technique', 'Feu rouge, feu vert', 8, 'Chacun son ballon dans un carré de 15 × 15 m. Vert : conduite ; orange : pied sur le ballon ; rouge : s\'asseoir sur le ballon.', 'Écouter et réagir\nContrôler le ballon', 'Ballons, plots', '5', '15x15'],
    ['finition', 'Tirs dans les mini-buts de couleur', 10, '4 mini-buts de couleurs différentes ; le coach annonce une couleur, le joueur conduit puis frappe dans ce but.', 'Regarder le but avant de frapper\nFrappe du bon pied', 'Mini-buts, ballons', '5', '20x20'],
    ['conservation', 'Passe à dix', 10, 'Terrain de 20 × 20 m, 4 contre 4. Dix passes d\'affilée = un point.', 'Se démarquer\nPasser au partenaire libre\nParler', 'Chasubles, ballons', '5,8', '20x20'],
    ['defense', 'Le chat et la souris (1 contre 1)', 8, 'Couloirs de 10 × 5 m : l\'attaquant doit franchir la ligne, le défenseur l\'en empêche.', 'Défenseur : rester entre l\'attaquant et la ligne\nAttaquant : feinter', 'Plots, ballons', '5,8', '10x5'],
    ['echauffement', 'Les statues avec ballon', 8, 'Carré de 15 × 15 m, conduite libre ; au coup de sifflet, tout le monde s\'arrête pied sur le ballon.', 'Conduite en regardant autour\nArrêt rapide', 'Ballons, plots', '5', '15x15'],
    ['physique', 'Relais conduite de balle', 8, 'Équipes de 4, aller-retour en slalom balle au pied sur 15 m.', 'Vitesse avec ballon\nEncourager son équipe', 'Plots, ballons', '5,8', '15x10'],
    ['calme', 'Le mot de la séance', 5, 'En cercle, chaque enfant dit ce qu\'il a aimé ou appris.', 'Écouter les autres\nRespirer calmement', '', '5', ''],
    ['technique', 'Circuit technique : conduite, passe, frappe', 15, 'Parcours de 40 × 30 m : slalom en conduite, une-deux contre un mur ou un partenaire, frappe au but.', 'Qualité de la dernière touche\nEnchaîner sans s\'arrêter', 'Plots, ballons, but', '8', '40x30'],
    ['conservation', 'Rondo 4 contre 1 à deux touches', 10, 'Carré de 10 × 10 m, 4 autour et 1 au milieu.', 'Contrôle orienté\nPasse appuyée\nOffrir une solution', 'Ballons, plots', '8,11', '10x10'],
    ['transitions', '2 contre 1 puis 2 contre 2 en continu', 15, 'Terrain de 30 × 20 m avec 2 buts : attaque à 2 contre 1, un second défenseur entre à la première passe.', 'Attaquer vite\nFixer le défenseur\nFinir avant que l\'autre revienne', 'Chasubles, 2 buts', '8', '30x20'],
    ['construction', 'Relance du gardien à 3 contre 2', 15, 'Zone de 35 × 40 m : le gardien relance, 3 joueurs doivent franchir la ligne médiane contre 2 presseurs.', 'Écarter\nUn joueur à l\'opposé\nJouer vers l\'avant dès que possible', 'Chasubles, but, plots', '8', '35x40'],
    ['finition', 'Combinaisons à 2 et frappe', 15, 'Deux colonnes à 30 m du but : une-deux, appel en profondeur, frappe.', 'Timing de l\'appel\nPasse dans la course\nFrappe cadrée', 'Ballons, but, plots', '8,11', '30x40'],
    ['defense', 'Défendre à 2 : presser et couvrir', 12, 'Zone de 20 × 15 m, 2 contre 2 : un défenseur presse, l\'autre couvre.', 'Le plus proche presse\nL\'autre couvre en diagonale\nParler', 'Chasubles, mini-buts', '8,11', '20x15'],
    ['jeu', 'Jeu à 4 portes', 15, 'Terrain de 30 × 25 m, 2 portes de 3 m sur chaque ligne de fond ; marquer en conduisant à travers une porte.', 'Changer de côté quand c\'est fermé\nOccuper la largeur', 'Plots, chasubles', '8', '30x25'],
    ['pressing', 'Chasse au ballon 4 contre 2', 12, 'Carré de 20 × 20 m ; les 2 chasseurs récupèrent en moins de 8 passes adverses.', 'Presser à deux\nFermer la passe facile\nAccélérer à la mauvaise passe', 'Chasubles, ballons', '8,11', '20x20'],
    ['construction', 'Circulation 11 contre 0 par ligne', 15, 'Demi-terrain : le gardien relance, le ballon passe par chaque ligne avant de finir.', 'Écartement\nSoutien\nRythme de passe', 'Ballons, buts', '11', '60x68'],
    ['transitions', 'Jeu 8 contre 8 à transitions rapides', 20, 'Terrain de 60 × 45 m découpé en 3 zones : après la récupération, marquer en moins de 10 secondes rapporte double.', 'Première passe vers l\'avant\nRepli immédiat à la perte', 'Chasubles, 2 buts', '11', '60x45'],
    ['pressing', 'Bloc équipe : pressing coordonné 10 contre 8', 20, 'Trois quarts de terrain : l\'équipe presse sur un signal (passe vers le latéral) et doit récupérer avant la ligne médiane.', 'Monter ensemble\nFermer l\'intérieur\nCompacité', 'Chasubles, but, mini-buts', '11', '75x68'],
    ['finition', 'Attaque 4 contre 3 + gardien', 20, 'Zone de 40 × 40 m face au but, 4 attaquants contre 3 défenseurs.', 'Créer le surnombre\nCentres en retrait\nSuivre les frappes', 'Chasubles, ballons, but', '8,11', '40x40'],
    ['defense', 'Défense de zone en infériorité 4 contre 5', 15, 'Largeur du terrain sur 30 m : 4 défenseurs contre 5 attaquants.', 'Coulisser\nDéfendre l\'axe d\'abord\nRetarder', 'Chasubles, but', '11', '68x30'],
    ['physique', 'Circuit puissance-vitesse avec ballon', 15, 'Ateliers de 30 s : haies basses, sprint 10 m, frappe, retour trottiné.', 'Qualité avant quantité\nRécupération complète', 'Haies, plots, ballons', '11', '30x20'],
    ['conservation', 'Jeu de position 6 contre 6 + 3 appuis', 18, 'Terrain de 40 × 35 m, 3 appuis (2 en bout, 1 au centre) jouent avec l\'équipe qui a le ballon.', 'Se placer entre les lignes\nJouer vers l\'appui opposé\nRegarder avant de recevoir', 'Chasubles 3 couleurs', '11', '40x35'],
    ['cpa', 'Touche longue et deuxième ballon', 10, 'Touches longues vers la surface, 4 contre 4 sur le deuxième ballon.', 'Anticiper le point de chute\nÊtre premier sur le deuxième ballon', 'Ballons, but', '11', '40x30'],
    ['gardien', 'Gardien : prises de balle et plongeons', 15, 'Frappes à 11 m, au sol puis à mi-hauteur, des deux côtés.', 'Mains en W\nPas d\'appel avant le plongeon\nSe relever vite', 'Ballons, but', '8,11', '16x11'],
    ['gardien', 'Gardien : sorties aériennes sur centres', 15, 'Centres des deux côtés avec un attaquant passif puis actif.', 'Annoncer « gardien ! »\nPrendre le ballon au point le plus haut\nGenou de protection', 'Ballons, but', '8,11', '30x16'],
    ['gardien', 'Gardien : jeu au pied et relance', 12, 'Passes en retrait, contrôle et relance vers une cible (plot) à gauche ou à droite.', 'Regarder avant de recevoir\nRelance rapide et précise', 'Ballons, plots', '5,8,11', '30x30'],
    ['gardien', 'Gardien : duels en 1 contre 1', 12, 'L\'attaquant part de 25 m, le gardien sort réduire l\'angle.', 'Sortir vite puis se fixer\nRester debout le plus longtemps', 'Ballons, but', '5,8,11', '25x20'],
  ].map(([theme, title, duration, org, consignes, materiel, formats, size], i) => ({ id: 'base' + i, theme, title, duration, org, consignes, materiel, formats: formats.split(','), size: size || '', base: true }));
  // the lists of the club's sport (football: the ones above; the other sports: sport-exos.js)
  const mapBase = (list, pre) => list.map(([theme, title, duration, org, consignes, materiel, formats, size], i) => ({ id: pre + i, theme, title, duration, org, consignes, materiel, formats: formats ? formats.split(',') : [], size: size || '', base: true }));
  // (2.30) the library: exercises with a schema written for each one (exos-lib.js)
  const LIB_F = (typeof EXOS_LIB !== 'undefined' ? EXOS_LIB : []).map(([theme, title, duration, org, consignes, materiel, formats, size, script], i) => ({ id: 'lib' + i, theme, title, duration, org, consignes, materiel, formats: formats.split(','), size: size || '', script: script || '', base: true, lib: true }));
  const SX = () => Sport.isFoot() ? null : SPORT_EXOS[Sport.id()];
  const TH = () => SX() ? SX().themes : THEMES_F;
  const KY = () => SX() ? SX().keys : KEYS_F;
  let baseCache = null, baseOf = '';
  const BS = () => { if (baseOf !== Sport.id()) { baseOf = Sport.id(); baseCache = SX() ? mapBase(SX().base, baseOf + '-') : [...LIB_F, ...BASE_F]; } return baseCache; };
  // the themes the generator can complete with (warm-up, game and cool-down apart)
  const coreThemes = () => TH().map(t => t[0]).filter(k => !['echauffement', 'calme', 'jeu'].includes(k));

  const schemaOfBase = e => e.base && S().schemas.find(sc => sc.baseEx === e.id);
  const themeOf = e => { if (e.theme) return [e.theme]; const t = `${e.title || ''} ${e.org || ''} ${e.consignes || ''}`; return Object.keys(KY()).filter(k => KY()[k].test(t)); };
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  // every exercise of the club (one per title, the one with a diagram first), then the base
  function all() {
    const seen = new Map();
    S().trainings.forEach(t => (t.exercises || []).forEach(e => {
      if (!e.title || !e.title.trim()) return;
      const k = norm(e.title), cur = seen.get(k);
      const item = { id: t.id + ':' + e.id, theme: e.theme || null, title: e.title, duration: +e.duration || 15, org: e.org || '', consignes: e.consignes || '', materiel: e.materiel || '', schemaId: e.schemaId || null, script: e.script || '',
        from: t, formats: e.formats && e.formats.length ? e.formats : [fmtOf(t.teamId)], size: e.size || '', club: true };
      if (!cur || (!cur.schemaId && item.schemaId) || (cur.from.date || '') < (t.date || '')) seen.set(k, cur ? Object.assign(item, { formats: [...new Set([...cur.formats, ...item.formats])] }) : item);
    }));
    const club = [...seen.values()];
    const clubTitles = new Set(club.map(e => norm(e.title)));
    return [...club, ...BS().filter(b => !clubTitles.has(norm(b.title))).map(b => { const sc = schemaOfBase(b); return sc ? Object.assign({}, b, { schemaId: sc.id }) : b; })];
  }

  /* ---------- the library page ---------- */
  function page(root) {
    const st = S().ui.exos = S().ui.exos || { theme: '', fmt: '', q: '' };
    const list = all().filter(e => (!st.theme || themeOf(e).includes(st.theme)) && (!st.fmt || e.formats.includes(st.fmt)) && (!st.q || norm(`${e.title} ${e.org} ${e.consignes}`).includes(norm(st.q))));
    const clubN = all().filter(e => e.club).length;
    root.innerHTML = `<header class="page-head"><div><h1>📚 Exercices du club</h1><p class="sub">${clubN} exercice${clubN > 1 ? 's' : ''} des coachs du club + ${BS().length} exercices de base</p></div>
      <div class="head-actions"><a class="btn" href="#/entrainements">${I.back}<span>Séances</span></a><a class="btn" href="#/systemes">🗂️<span>Séances par système</span></a><button class="btn" data-fromfile>📥<span>Depuis un fichier (PDF, photo)</span></button><button class="btn primary" data-gen>✨<span>Générer une séance</span></button></div></header>
      <input class="hl-q" id="exQ" placeholder="Rechercher (ex : ${Sport.isFoot() ? 'rondo, centre, pressing' : esc(coreThemes().slice(0, 3).map(k => (TH().find(t => t[0] === k) || ['', k])[1].replace(/^\S+\s/, '').toLowerCase()).join(', '))})" value="${esc(st.q)}" autocomplete="off">
      <div class="chips ex-themes"><button class="chip ${!st.theme ? 'on' : ''}" data-th="">Tous</button>${TH().map(([k, l]) => `<button class="chip ${st.theme === k ? 'on' : ''}" data-th="${k}">${l}</button>`).join('')}</div>
      <div class="chips"><button class="chip ${!st.fmt ? 'on' : ''}" data-fm="">Toutes catégories</button>${((Sport.isFoot() ? null : Sport.cur().formats.map(x => [x[0], x[1]])) || [['5', 'Foot à 5 (U6-U9)'], ['8', 'Foot à 8 (U10-U13)'], ['11', 'Foot à 11 (U14+)']]).map(([k, l]) => `<button class="chip ${st.fmt === k ? 'on' : ''}" data-fm="${k}">${l}</button>`).join('')}</div>
      ${Sport.isFoot() ? `<details class="card ex-res"><summary><b>📚 Ressources officielles gratuites (FFF)</b><span class="muted small"> · vidéos, fiches et guides par âge</span></summary>${RES.map(([age, n, u], i) => `<div class="ex-res-row"><span class="tag">${esc(age)}</span><a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(n)}</a><button class="btn soft" data-res="${i}">${I.plus}<span>Bibliothèque</span></button></div>`).join('')}</details>` : ''}
      <p class="muted small">${list.length} exercice${list.length > 1 ? 's' : ''}</p>
      <div class="ex-lib">${list.slice(0, 80).map(e => { const sc = e.schemaId && Store.get('schemas', e.schemaId), th = themeOf(e);
        return `<article class="card ex-item"><div class="ex-item-head">${true ? `<img alt="" src="${UI.thumb(sc || AutoSchema.preview(e), 240, 156)}" data-big="${esc(e.id)}" style="cursor:zoom-in" title="Voir en grand">` : `<span class="ex-noimg">${(TH().find(t => t[0] === th[0]) || ['', '⚽'])[1].split(' ')[0]}</span>`}
          <div><b>${esc(e.title)}</b><span class="muted small">${e.duration} min${e.size ? ' · ' + esc(e.size.replace('x', ' × ')) + ' m' : ''} · ${th.map(k => (TH().find(t => t[0] === k) || ['', k])[1].replace(/^\S+\s/, '')).join(', ') || 'Divers'}${e.club ? ` · ${esc((Store.get('teams', e.from.teamId) || {}).name || 'club')}` : ' · base'}</span></div></div>
          <button class="btn soft ex-add" data-addex="${esc(e.id)}" aria-label="Ajouter à une séance">${I.plus}<span>Séance</span></button>
          <details class="ex-more"><summary>Détails</summary>${e.org ? `<p class="small">${esc(e.org)}</p>` : ''}${e.consignes ? `<ul class="small ex-cons">${e.consignes.split('\n').filter(Boolean).slice(0, 4).map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
          <div class="chips"><button class="btn soft" data-big="${esc(e.id)}">🔍<span>Voir en grand</span></button><button class="btn soft" data-addex="${esc(e.id)}">${I.plus}<span>Ajouter à une séance</span></button>${e.club ? `<a class="btn soft" href="#/entrainement/${e.from.id}">Voir la séance</a>` : sc ? `<a class="btn soft" href="#/schema/${sc.id}">${I.board}<span>Le schéma</span></a>` : `<button class="btn soft" data-draw="${esc(e.id)}">✨<span>Créer le schéma animé</span></button>`}</div></details></article>`; }).join('') || '<p class="muted">Aucun exercice ne correspond.</p>'}</div>`;
    const redraw = () => page(root);
    $('#exQ', root).oninput = e => { st.q = e.target.value; clearTimeout(page.t); page.t = setTimeout(() => { const pos = e.target.selectionStart; redraw(); const q = $('#exQ', root); q.focus(); q.setSelectionRange(pos, pos); }, 300); };
    root.onclick = e => {
      const bg = e.target.closest('[data-big]'); if (bg) { const x = all().find(y => y.id === bg.dataset.big); if (x) return AutoSchema.big(x, x.schemaId && Store.get('schemas', x.schemaId)); }
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.th !== undefined) { st.theme = b.dataset.th; Store.persistNow(); return redraw(); }
      if (b.dataset.fm !== undefined) { st.fmt = b.dataset.fm; Store.persistNow(); return redraw(); }
      if (b.hasAttribute('data-gen')) return generator();
      if (b.hasAttribute('data-fromfile')) return Library.schemasFromFiles();
      if (b.dataset.addex) return addTo(all().find(x => x.id === b.dataset.addex));
      if (b.dataset.draw) return drawBase(all().find(x => x.id === b.dataset.draw));
      if (b.dataset.res) { const r = RES[+b.dataset.res]; Media.put({ id: Store.uid(), ref: 'lib', kind: 'link', url: r[2], name: r[1], host: 'fff.fr', createdAt: Date.now(), by: (Auth.current() || {}).id || null }).then(() => toast('Ajouté à la Bibliothèque')); return; }
    };
  }
  // free official resources (FFF): opened on their site, or kept in the Bibliothèque
  const RES = [['U6-U13', 'Guide interactif du football des enfants (GIFE) : séances, vidéos, fiches par catégorie', 'https://districtvaldemarne.fff.fr/simple/gife-des-u7-u9-u11-u13/'], // (1.49) Ligue Paris Île-de-France
    ['U6-U9', 'Guide de la pratique du foot à 5 (FFF, édition 2025, PDF)', 'https://media.fff.fr/uploads/documents/guide-de-la-pratique-fff_foot5_e-dition-2025.pdf'],
    ['U6-U19', 'Programme éducatif fédéral : fiches et actions terrain', 'https://pef.fff.fr/fiches/'],
    ['Tous', 'L\'échauffement d\'avant-match (FFF, PDF)', 'https://lgef.fff.fr/wp-content/uploads/sites/14/2017/11/1-LEchauffement-dAvant-Match.pdf'],
    ['U11-U13', 'L\'échauffement du jeune footballeur U11-U13 (PDF)', 'https://district71.fff.fr/wp-content/uploads/sites/51/2024/09/Lechauffement-du-jeune-footballeur-U11-U13.pdf']];
  // the schema of a base exercise: made by the app (players, cones, movements), then the coach changes what he wants
  function drawBase(e) {
    if (!e) return;
    const sc = AutoSchema.save(e); sc.baseEx = e.id; Store.upsert('schemas', sc);
    toast('Schéma animé créé : change ce que tu veux'); location.hash = '#/schema/' + sc.id;
  }

  const copyEx = e => ({ id: Store.uid(), theme: e.theme || themeOf(e)[0] || null, title: e.title, duration: e.duration, org: e.org || '', consignes: e.consignes || '', materiel: e.materiel || '', schemaId: e.schemaId || null, size: e.size || '', script: e.script || '' });
  // « Ajouter à une séance »: an entraînement to come (all of them, by category), or a new séance created with this exercise
  function addTo(ex) {
    if (!ex) return;
    const teams = Auth.teams(), u = Auth.current(), mine = ((u && u.teamIds) || []).filter(id => teams.some(t => t.id === id));
    let team = S().ui.teamId && teams.some(t => t.id === S().ui.teamId) ? S().ui.teamId : mine.length === 1 ? mine[0] : '';
    const rows = () => {
      const list = S().trainings.filter(t => !t.model && Auth.sees(t.teamId) && (!team || t.teamId === team) && (t.date || '') >= UI.today()).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
      return list.length ? list.map(t => `<button class="list-item hl-pickrow" data-tr="${t.id}"><span class="li-main"><b>${esc(t.title || 'Entraînement')}</b><span class="muted">${esc(UI.fmtDate(t.date))}${t.time ? ' · ' + esc(t.time) : ''} · ${esc((Store.get('teams', t.teamId) || {}).name || '')} · ${(t.exercises || []).length} exercice${(t.exercises || []).length > 1 ? 's' : ''}</span></span></button>`).join('')
        : '<p class="muted small">Pas d\'entraînement à venir ici : crée une nouvelle séance juste en dessous.</p>';
    };
    const close = modal({ title: `Ajouter « ${ex.title} »`, noFocus: true, body: `
      <label class="fld"><span>Catégorie</span><select id="atTeam"><option value="">Toutes les catégories</option>${teams.map(t => `<option value="${t.id}" ${t.id === team ? 'selected' : ''}>${esc(Store.teamLabel(t))}</option>`).join('')}</select></label>
      <div class="lbl">Ajouter à un entraînement à venir</div>
      <div class="list" id="atList">${rows()}</div>
      <div class="lbl">Ou créer une nouvelle séance avec cet exercice</div>
      <label class="fld"><span>Thème de la séance</span><input id="atTitle" value="${esc(ex.title)}" maxlength="80"></label>
      <div class="row2"><label class="fld"><span>Date</span><input type="date" id="atDate" value="${UI.today()}"></label><label class="fld"><span>Heure</span><input type="time" id="atTime" value="18:00"></label></div>
      <button type="button" class="btn primary wide" id="atNew">${I.plus}<span>Créer la séance</span></button>`,
      onOpen: r => {
        const bind = () => $$('[data-tr]', r).forEach(b => b.onclick = () => { const t = Store.get('trainings', b.dataset.tr); t.exercises = [...(t.exercises || []), copyEx(ex)]; Store.upsert('trainings', t); close(); toast('Exercice ajouté'); location.hash = '#/entrainement/' + t.id; });
        $('#atTeam', r).onchange = e => { team = e.target.value; $('#atList', r).innerHTML = rows(); bind(); };
        bind();
        $('#atNew', r).onclick = () => {
          const tr = Store.upsert('trainings', { id: Store.uid(), title: $('#atTitle', r).value.trim() || ex.title, date: $('#atDate', r).value || UI.today(), time: $('#atTime', r).value, teamId: team || null, goal: '', exercises: [copyEx(ex)], presents: [] });
          close(); toast('Séance créée avec l\'exercice'); location.hash = '#/entrainement/' + tr.id;
        };
      } });
  }

  // from a séance: pick an exercise of the club (those of its category first), it is copied in the séance
  function pick(teamId, done) {
    const fmt = teamId ? fmtOf(teamId) : '';
    let q = '', th = '';
    const rows = () => {
      const list = all().filter(e => (!fmt || !e.formats.length || e.formats.includes(fmt)) && (!th || themeOf(e).includes(th)) && (!q || norm(`${e.title} ${e.org} ${e.consignes}`).includes(norm(q))))
        .sort((a, b) => (b.club ? 1 : 0) - (a.club ? 1 : 0));
      return list.slice(0, 120).map(e => { const sc = e.schemaId && Store.get('schemas', e.schemaId);
        return `<button class="list-item hl-pickrow" data-pk="${esc(e.id)}">${sc ? `<img alt="" src="${UI.thumb(sc, 120, 78)}" style="width:60px;border-radius:4px">` : ''}<span class="li-main"><b>${esc(e.title)}</b><span class="muted small">${e.duration} min · ${e.club ? '📚 club' : 'base'}${themeOf(e).length ? ' · ' + themeOf(e).map(k => (TH().find(t => t[0] === k) || ['', k])[1].replace(/^\S+\s/, '')).join(', ') : ''}</span></span></button>`; }).join('')
        || '<p class="muted small">Aucun exercice ne correspond.</p>';
    };
    const close = modal({ title: '📚 Choisir un exercice', noFocus: true, body: `
      <input class="hl-q" id="pkQ" placeholder="Rechercher (ex : ${Sport.isFoot() ? 'rondo, centre, pressing' : esc(coreThemes().slice(0, 3).map(k => (TH().find(t => t[0] === k) || ['', k])[1].replace(/^\S+\s/, '').toLowerCase()).join(', '))})" autocomplete="off">
      <label class="fld"><span>Thème</span><select id="pkTh"><option value="">Tous</option>${TH().map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
      <div class="list" id="pkList">${rows()}</div>`,
      onOpen: r => {
        const bind = () => $$('[data-pk]', r).forEach(b => b.onclick = () => { const e = all().find(x => x.id === b.dataset.pk); if (!e) return; close(); done(copyEx(e)); });
        const redo = () => { $('#pkList', r).innerHTML = rows(); bind(); };
        $('#pkQ', r).oninput = e => { q = e.target.value; redo(); }; $('#pkTh', r).onchange = e => { th = e.target.value; redo(); };
        bind();
      } });
  }

  /* ---------- the generator ---------- */
  function generator(pre = {}) {
    const teams = Auth.teams(), g = Object.assign({ theme: 'pressing', teamId: S().ui.teamId || (teams[0] || {}).id, minutes: 75, date: UI.today() }, S().ui.exGen || {}, pre);
    if (!coreThemes().includes(g.theme)) g.theme = coreThemes()[0]; // a theme of another sport (the club changed sport)
    const body = () => `<div class="lbl">Thème</div><div class="chips">${TH().filter(t => !['echauffement', 'calme', 'jeu'].includes(t[0])).map(([k, l]) => `<button class="chip ${g.theme === k ? 'on' : ''}" data-gth="${k}">${l}</button>`).join('')}</div>
      <div class="row2"><label class="fld"><span>Catégorie</span><select id="gTeam">${teams.map(t => `<option value="${t.id}" ${t.id === g.teamId ? 'selected' : ''}>${esc(Store.teamLabel(t))}</option>`).join('')}</select></label>
        <label class="fld"><span>Durée</span><select id="gMin">${[45, 60, 75, 90, 105].map(n => `<option ${n === +g.minutes ? 'selected' : ''} value="${n}">${n} min</option>`).join('')}</select></label>
        <label class="fld"><span>Date</span><input type="date" id="gDate" value="${esc(g.date)}"></label></div>
      <p class="muted small">L'appli prend d'abord les exercices des coachs du club, puis ceux de la base. Tu pourras tout changer ensuite.</p>`;
    modal({ title: '✨ Générer une séance', noFocus: true, body: `<div id="genBody">${body()}</div>`,
      onOpen: r => { r.querySelector('#genBody').onclick = e => { const b = e.target.closest('[data-gth]'); if (!b) return; keep(r); g.theme = b.dataset.gth; r.querySelector('#genBody').innerHTML = body(); }; },
      actions: [{ label: 'Annuler' }, { label: 'Générer', kind: 'primary', onClick: (c, r) => { keep(r); if (g.target && (Store.get('trainings', g.target) || {}).teamId !== g.teamId) delete g.target; S().ui.exGen = { theme: g.theme, minutes: g.minutes }; Store.persistNow(); setTimeout(() => build(g), 60); } }] });
    function keep(r) { g.teamId = $('#gTeam', r).value; g.minutes = +$('#gMin', r).value; g.date = $('#gDate', r).value || UI.today(); }
  }
  // (2.30) a session that changes every time: a draw among all the exercises of the theme (the club's and the library's, those with a written
  // schema a little more often), never those of the team's last sessions; then a preview where each exercise can be swapped before creating
  function build(g) {
    // a picture or PDF put in a séance (« Depuis un fichier ») is not an exercise to draw: a file name for title, no text
    const junk = e => /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(String(e.title).trim()) || /\.(pdf|jpe?g|png|heic|webp)$/i.test(String(e.title).trim()) || /^(img|image|photo|scan|capture)[ _-]?\d/i.test(String(e.title).trim())
      || (e.club && !String(e.org || '').trim() && !String(e.consignes || '').trim());
    const fmt = fmtOf(g.teamId), pool = all().filter(e => (e.formats.includes(fmt) || e.formats.length === 0) && !junk(e));
    const since = new Date(Date.now() - 28 * 864e5).toISOString().slice(0, 10);
    const recent = new Set(S().trainings.filter(t => t.teamId === g.teamId && (t.date || '') >= since).flatMap(t => (t.exercises || []).map(e => norm(e.title))));
    const shown = new Set((S().ui.genShown || []).map(norm));
    const weight = e => (e.club ? 1.1 : 1) * (e.script || e.schemaId ? 2 : 1) * (recent.has(norm(e.title)) ? .1 : 1) * (shown.has(norm(e.title)) ? .35 : 1);
    const pick = (theme, used, n = 1) => {
      const c = pool.filter(e => themeOf(e).includes(theme) && !used.has(norm(e.title))).map(e => [e, Math.random() * weight(e)]).sort((x, y) => y[1] - x[1]).map(x => x[0]);
      const out = c.slice(0, n); out.forEach(e => used.add(norm(e.title))); return out;
    };
    const NEAR = { defense: ['pressing', 'physique'], pressing: ['transitions', 'defense'], transitions: ['pressing', 'finition'], finition: ['technique', 'transitions'],
      conservation: ['construction', 'technique'], construction: ['conservation', 'technique'], technique: ['conservation', 'finition'], cpa: ['finition', 'defense'], physique: ['pressing', 'transitions'], gardien: ['finition', 'technique'] };
    const make = () => {
      const used = new Set(), total = g.minutes, warm = total >= 75 ? 15 : 10, calm = 5, game = total >= 75 ? 20 : 15, core = total - warm - calm - game;
      const nCore = core >= 40 ? 3 : core >= 25 ? 2 : 1;
      const coreEx = pick(g.theme, used, nCore).map(e => [e, g.theme]);
      // too few exercises of the theme for this category: a close theme completes (never one exercise of 45 min)
      for (const alt of Sport.isFoot() ? [...(NEAR[g.theme] || []), 'conservation', 'technique'] : coreThemes().filter(k => k !== g.theme)) { if (coreEx.length >= nCore) break; coreEx.push(...pick(alt, used, nCore - coreEx.length).map(e => [e, alt])); }
      const each = Math.max(5, Math.floor(core / Math.max(1, coreEx.length) / 5) * 5);
      const plan = [...pick('echauffement', used).map(e => ({ e, d: warm, th: 'echauffement', ph: 'Échauffement' })),
        ...coreEx.map(([e, th], i) => ({ e, th, d: i === coreEx.length - 1 ? core - each * (coreEx.length - 1) : each, ph: `Exercice ${i + 1}` })),
        ...pick('jeu', used).map(e => ({ e, d: game, th: 'jeu', ph: 'Jeu' })), ...pick('calme', used).map(e => ({ e, d: calm, th: 'calme', ph: 'Retour au calme' }))];
      const have = plan.reduce((x, p) => x + p.d, 0);
      if (have < total - 10) { const th = Sport.isFoot() ? 'conservation' : coreThemes()[0], extra = pick(th, used)[0]; if (extra) plan.splice(1 + nCore, 0, { e: extra, d: total - have, th, ph: 'Exercice +' }); }
      return { plan, used };
    };
    let cur = make();
    const remember = () => { S().ui.genShown = [...cur.plan.map(p => p.e.title), ...(S().ui.genShown || [])].slice(0, 40); Store.persistNow(); };
    remember();
    const thLabel = (TH().find(t => t[0] === g.theme) || ['', g.theme])[1].replace(/^\S+\s/, '');
    const row = (p, i) => { const sc = p.e.schemaId && Store.get('schemas', p.e.schemaId);
      return `<div class="gen-row"><button type="button" class="gen-thumb" data-genbig="${i}" title="Voir le schéma en grand"><img alt="" src="${UI.thumb(sc || AutoSchema.preview(p.e), 180, 117)}"></button>
        <div class="gen-txt"><span class="muted small">${esc(p.ph)} · ${p.d} min${p.e.club ? ' · 📚 club' : ''}</span><b>${esc(p.e.title)}</b><span class="small">${esc(String(p.e.org || '').slice(0, 110))}${String(p.e.org || '').length > 110 ? '…' : ''}</span></div>
        <button type="button" class="btn small" data-genswap="${i}" title="Un autre exercice">🔄</button></div>`; };
    // the trainings already planned for this team (from today, 6 weeks), the one asked first, then the next without exercises
    const planned = S().trainings.filter(t => t.teamId === g.teamId && !t.model && (t.date || '') >= UI.today() && (t.date || '') <= new Date(Date.now() + 42 * 864e5).toISOString().slice(0, 10))
      .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))).slice(0, 12);
    const defDest = g.target && Store.get('trainings', g.target) ? g.target : ((planned.find(t => !(t.exercises || []).length) || {}).id || 'new');
    const trLabel = t => `${UI.fmtDate(t.date, { weekday: 'short', day: 'numeric', month: 'short' })}${t.time ? ' · ' + t.time : ''} · ${(t.exercises || []).length ? (t.exercises || []).length + ' exercice(s) déjà prévu(s)' : 'vide'}`;
    const dest = r => { const sel = r && r.querySelector('#genDest'), how = r && r.querySelector('#genHow'); return { to: sel ? sel.value : defDest, how: how ? how.value : 'add' }; };
    const destHtml = d => { const t = d.to !== 'new' && Store.get('trainings', d.to);
      return `<div class="gen-dest"><label class="fld"><span>📅 Mettre la séance dans</span><select id="genDest"><option value="new" ${d.to === 'new' ? 'selected' : ''}>Un nouvel entraînement (${esc(UI.fmtDate(g.date, { weekday: 'short', day: 'numeric', month: 'short' }))})</option>
        ${[...planned, ...(t && !planned.includes(t) ? [t] : [])].map(x => `<option value="${x.id}" ${x.id === d.to ? 'selected' : ''}>L'entraînement du ${esc(trLabel(x))}</option>`).join('')}</select></label>
        ${t && (t.exercises || []).length ? `<label class="fld"><span>Ses ${(t.exercises || []).length} exercice(s) déjà prévu(s)</span><select id="genHow"><option value="add" ${d.how !== 'replace' ? 'selected' : ''}>Les garder, ajouter la séance à la suite</option><option value="replace" ${d.how === 'replace' ? 'selected' : ''}>Les remplacer par la séance générée</option></select></label>` : ''}</div>`; };
    const body = (d = { to: defDest, how: 'add' }) => `${destHtml(d)}<p class="muted small">Touche 🔄 pour changer un exercice, ou 🎲 pour tout retirer au sort. Touche un schéma pour l'agrandir ; il s'anime une fois la séance créée.</p>
      <style>.gen-row{display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line,#e3e5ea)}.gen-thumb{border:0;padding:0;background:none;cursor:pointer;flex:none}.gen-thumb img{width:120px;border-radius:8px;display:block}.gen-row:has(.gen-thumb.on){flex-wrap:wrap}.gen-thumb.on{flex-basis:100%}.gen-thumb.on img{width:100%}.gen-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.gen-txt b{font-size:15px}@media(max-width:480px){.gen-thumb img{width:88px}}</style>
      ${cur.plan.map(row).join('')}<p class="muted small">Total : ${cur.plan.reduce((x, p) => x + p.d, 0)} min</p>`;
    modal({ title: `✨ ${thLabel} · ${g.minutes} min`, noFocus: true, body: `<div id="genPrev">${body()}</div>`,
      onOpen: r => { r.querySelector('#genPrev').onclick = ev => {
        const big = ev.target.closest('[data-genbig]'); if (big) { const p = cur.plan[+big.dataset.genbig], img = big.querySelector('img'), on = big.classList.toggle('on'); img.src = UI.thumb((p.e.schemaId && Store.get('schemas', p.e.schemaId)) || AutoSchema.preview(p.e), on ? 640 : 180, on ? 416 : 117); return; }
        const sw = ev.target.closest('[data-genswap]'); if (!sw) return; const p = cur.plan[+sw.dataset.genswap];
        const alt = pick(p.th, cur.used)[0] || (cur.used.clear(), cur.plan.forEach(x => cur.used.add(norm(x.e.title))), pick(p.th, cur.used)[0]);
        if (!alt) return toast('Pas d\'autre exercice pour ce thème dans cette catégorie'); p.e = alt; const d = dest(r); r.querySelector('#genPrev').innerHTML = body(d); }; r.querySelector('#genPrev').onchange = ev => { if (ev.target.id === 'genDest') r.querySelector('#genPrev').innerHTML = body(dest(r)); }; },
      actions: [{ label: '🎲 Tout changer', onClick: (c, r) => { const keepDest = dest(r); cur = make(); remember(); r.querySelector('#genPrev').innerHTML = body(keepDest); return false; } },
        { label: 'Valider la séance', kind: 'primary', onClick: (c, r) => { const d = dest(r); setTimeout(() => create(d), 60); } }] });
    function create(d) {
      const plan = cur.plan, nCore = plan.filter(p => /^Exercice/.test(p.ph)).length, exs = plan.map(p => Object.assign(copyEx(p.e), { duration: p.d }));
      const goal = `Thème : ${thLabel}. Séance générée : échauffement, ${nCore} exercice${nCore > 1 ? 's' : ''} du thème, jeu à thème, retour au calme.`, min = plan.reduce((x, p) => x + p.d, 0);
      const t = d && d.to !== 'new' && Store.get('trainings', d.to);
      if (t) {
        // (2.31) into the training already planned: its date, time, place and attendance stay; the exercises are added (or replace)
        const keep = d.how === 'replace' ? [] : (t.exercises || []);
        t.exercises = [...keep, ...exs];
        if (!t.title || /^entra[iî]nement$/i.test(t.title)) t.title = thLabel;
        if (!String(t.goal || '').includes(goal)) t.goal = [d.how === 'replace' ? '' : t.goal, goal].filter(Boolean).join('\n');
        Store.upsert('trainings', t);
        toast(`Séance « ${thLabel} » mise dans l'entraînement du ${UI.fmtDate(t.date, { weekday: 'long', day: 'numeric', month: 'long' })} : ${exs.length} exercices, ${min} min`);
        location.hash = '#/entrainement/' + t.id; return;
      }
      const tr = Store.upsert('trainings', { id: Store.uid(), title: thLabel, date: g.date, time: '', teamId: g.teamId, goal, exercises: exs, presents: [] });
      toast(`Séance « ${thLabel} » créée : ${exs.length} exercices, ${min} min`);
      location.hash = '#/entrainement/' + tr.id;
    }
  }

  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-exgen]'); if (b) generator(); });
  return { page, generator, all, themeOf, pick, get THEMES() { return TH(); } };
})();
