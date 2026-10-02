/* The library of sessions by game system — football. Written for the app (no copy of any website):
   for each system, sessions « avec ballon », « sans ballon », « transitions », each with its exercises.
   An exercise: [theme, title, minutes, organisation, consignes (one per « | »), matériel, size (« 40x30 »)].
   The warm-up and the cool-down are added when the session is used. */
const SESSIONS_FOOT = [
  // ---------- foot à 11 ----------
  { sys: '4-3-3', fmt: '11', title: 'Sortir le ballon à 3 et trouver les ailiers', goal: 'Construire depuis le gardien : le 6 entre les centraux, les latéraux hauts, les ailiers fixent la largeur.', ex: [
    ['construction', 'Sortie de balle 6 contre 4', 18, 'Tiers défensif de 40 x 50 m : gardien, 2 centraux, 2 latéraux et le 6 contre 4 attaquants qui pressent. Point si on franchit la ligne médiane en conduite ou par une passe.', 'Centraux écartés à la largeur de la surface|Le 6 se montre entre les deux lignes adverses|Latéral haut et large|Jouer vers l\'avant dès que la passe est ouverte', 'Chasubles, ballons, 1 but', '40x50'],
    ['conservation', 'Jeu de position 4-3-3 contre 4-4', 20, 'Demi-terrain : les 3 milieux, les 2 latéraux et les 2 ailiers contre 8 défenseurs. 6 passes = 1 point, passe à l\'ailier dans le couloir = 2 points.', 'Triangles autour du porteur|Un milieu entre les lignes|L\'ailier reste collé à la ligne de touche', 'Chasubles 2 couleurs', '50x60'],
    ['jeu', 'Match 11 contre 11 à thème : sortie à 3', 25, 'Grand terrain. Chaque relance du gardien doit passer par un central puis par le 6 ou un latéral avant de franchir la médiane.', 'Patience dans la construction|Changer de côté si c\'est fermé|Attaquer vite dès qu\'on casse la première ligne', 'Chasubles, ballons', '']] },
  { sys: '4-3-3', fmt: '11', title: 'Pressing haut en 4-3-3', goal: 'Presser ensemble sur la relance adverse : l\'avant-centre oriente, les ailiers ferment les latéraux, les milieux montent.', ex: [
    ['pressing', 'Pressing des 3 attaquants sur 4 défenseurs', 15, 'Zone de 35 x 45 m : 4 défenseurs + gardien relancent, les 3 attaquants pressent. Récupérer avant la ligne des 35 m = 1 point.', 'Le 9 coupe la passe vers un central|Les ailiers pressent de l\'intérieur vers l\'extérieur|Déclencher sur une passe lente ou un mauvais contrôle', 'Chasubles, plots, 1 but', '35x45'],
    ['pressing', 'Bloc haut 7 contre 6 : 3 attaquants + 3 milieux', 20, 'Deux tiers de terrain : 6 relanceurs contre les 3 attaquants et les 3 milieux. Si on récupère, 10 secondes pour marquer.', 'Le milieu côté ballon monte sur le 6 adverse|Distance entre les lignes : 10 à 15 m|Le plus proche presse, les autres ferment', 'Chasubles, ballons, 2 buts', '60x50'],
    ['jeu', 'Match 9 contre 9 : récupérer haut', 20, 'Terrain de 70 x 50 m divisé en 3 zones. Un but marqué après une récupération dans la zone offensive compte double.', 'Presser en bloc|Ne pas laisser de passe dans l\'axe|Finir vite après la récupération', 'Chasubles, plots', '70x50']] },
  { sys: '4-3-3', fmt: '11', title: 'Transitions : contre-pressing et contre-attaque', goal: 'À la perte : 5 secondes de contre-pressing. À la récupération : attaquer la profondeur avec les ailiers.', ex: [
    ['transitions', 'Contre-pressing 5 secondes', 15, 'Zone de 40 x 30 m, 6 contre 6 + 2 jokers. L\'équipe qui perd le ballon doit le récupérer en 5 secondes : 1 point.', 'Réagir immédiatement|Les joueurs proches ferment les passes courtes|Le plus près presse le porteur', 'Chasubles 3 couleurs', '40x30'],
    ['transitions', 'Contre-attaque à 3 contre 2', 15, 'Les 2 ailiers et le 9 partent du milieu de terrain contre 2 défenseurs qui reculent, le gardien en place. 8 secondes pour finir.', 'Première passe vers l\'avant|Les ailiers attaquent l\'espace entre latéral et central|Fixer un défenseur avant de donner', 'Ballons, plots, 1 but', '50x45'],
    ['jeu', 'Match 8 contre 8 à transitions', 20, 'Terrain de 60 x 45 m. Après une récupération, un but dans les 10 secondes compte double. Après une perte, récupérer en 5 secondes = 1 point.', 'Changement d\'attitude immédiat|Courir vers l\'avant à la récupération', 'Chasubles, 2 buts', '60x45']] },

  { sys: '4-2-3-1', fmt: '11', title: 'Jouer entre les lignes avec le meneur', goal: 'Le double pivot sécurise, le 10 reçoit entre les lignes, les ailiers rentrent, le latéral déborde.', ex: [
    ['conservation', 'Rondo de position 5 contre 3 + le 10', 15, 'Carré de 20 x 20 m : 4 joueurs autour, le 10 au milieu contre 3 défenseurs. Passe au 10 qui se retourne = 1 point.', 'Le 10 se place dans le dos des défenseurs|Jouer vite autour pour ouvrir une ligne de passe|Le 10 contrôle orienté vers l\'avant', 'Chasubles, plots', '20x20'],
    ['construction', 'Double pivot et décrochage du 10', 18, 'Demi-terrain : 2 centraux, double pivot et 10 contre 5 défenseurs. Point si le ballon arrive au 10 qui joue vers un attaquant.', 'Un pivot décroche, l\'autre reste haut|Le 10 bouge pour se démarquer des lignes|Passe verticale dès que possible', 'Chasubles, ballons', '40x50'],
    ['jeu', 'Match à thème : passe entre les lignes', 25, 'Grand terrain. Un but précédé d\'une passe reçue par le 10 ou un ailier entre les lignes compte double.', 'Occuper les demi-espaces|Rentrer intérieur pour libérer le couloir au latéral', 'Chasubles', '']] },
  { sys: '4-2-3-1', fmt: '11', title: 'Défendre en 4-4-1-1', goal: 'Sans ballon, le 4-2-3-1 devient un 4-4-1-1 compact : le 10 sur le 6 adverse, les ailiers redescendent.', ex: [
    ['defense', 'Bloc médian à 8 contre 6', 18, 'Deux lignes de 4 contre 6 attaquants dans une zone de 40 x 50 m. Les défenseurs gagnent un point s\'ils récupèrent et sortent par une porte.', 'Coulisser ensemble vers le ballon|Distance entre les lignes : 10 m|Fermer l\'axe d\'abord', 'Chasubles, plots', '40x50'],
    ['defense', 'Le 10 sur le 6 adverse', 15, 'Zone de 30 x 30 m : le 10 et l\'attaquant contre 2 centraux et un 6 qui veulent relancer. Récupérer = 1 point.', 'Couper la passe vers le 6|Orienter vers un côté|Déclencher avec l\'ailier', 'Chasubles, plots', '30x30'],
    ['jeu', 'Match 11 contre 11 : bloc médian', 25, 'Grand terrain. L\'équipe en 4-4-1-1 défend dans son camp et marque deux fois plus après une récupération dans son tiers central.', 'Compacité|Sortir vite après la récupération', 'Chasubles', '']] },

  { sys: '4-4-2', fmt: '11', title: 'Le 4-4-2 à plat : jouer à deux attaquants', goal: 'Les deux attaquants combinent (un en appui, un en profondeur), les milieux excentrés débordent.', ex: [
    ['finition', 'Combinaisons des deux attaquants', 15, 'Devant la surface : un milieu sert l\'attaquant en appui qui remise ou déviation pour l\'autre en profondeur. Tir.', 'Un vient, un part|Remise en une touche|Appel dans le dos du central', 'Ballons, 1 but, mannequins', '35x40'],
    ['finition', 'Débordement et centre à 2 attaquants', 18, 'Le milieu excentré déborde, les deux attaquants attaquent le premier et le second poteau, le milieu axial arrive en retrait.', 'Croiser les courses dans la surface|Centre tendu au premier poteau|Un joueur reste en retrait', 'Ballons, 1 but', '40x60'],
    ['jeu', 'Match 9 contre 9 : à deux devant', 20, 'Terrain de 70 x 50 m, chaque équipe en 3-4-2 réduit. Un but sur centre compte double.', 'Toujours deux attaquants dans la surface|Les milieux excentrés hauts et larges', 'Chasubles, 2 buts', '70x50']] },
  { sys: '4-4-2', fmt: '11', title: 'Défendre à deux lignes de quatre', goal: 'Deux lignes compactes qui coulissent, les deux attaquants ferment l\'axe.', ex: [
    ['defense', 'Coulisser à 4 + 4', 18, 'Largeur du terrain sur 40 m : 8 défenseurs en deux lignes contre 7 attaquants qui font circuler. Les défenseurs marquent dans 2 mini-buts après récupération.', 'Coulisser ensemble|Le milieu côté ballon presse, les autres couvrent|Pas de trou entre les lignes', 'Chasubles, 2 mini-buts', '40x68'],
    ['defense', 'Défense de la surface sur centre', 15, 'Les 4 défenseurs et le gardien contre 3 attaquants et 2 centreurs. Dégager loin = 1 point.', 'Se placer entre l\'adversaire et le but|Attaquer le ballon|Le latéral opposé ferme le second poteau', 'Ballons, 1 but', '35x60'],
    ['jeu', 'Match 11 contre 11 : bloc compact', 25, 'Grand terrain. Interdit de laisser plus de 30 m entre le dernier défenseur et l\'attaquant le plus haut quand on défend.', 'Bloc court|Sortir ensemble', 'Chasubles', '']] },

  { sys: '3-5-2', fmt: '11', title: 'Les pistons et le jeu à 3 derrière', goal: 'Trois centraux relancent, les pistons donnent la largeur, deux attaquants complémentaires.', ex: [
    ['construction', 'Relance à 3 contre 2 attaquants', 15, 'Zone de 40 x 50 m : 3 centraux + gardien contre 2 attaquants, puis passe au piston ou au milieu.', 'Le central latéral conduit pour fixer|Le piston haut sur la ligne|Changer de côté par le central', 'Chasubles, plots', '40x50'],
    ['conservation', 'Couloirs aux pistons', 18, 'Terrain de 60 x 50 m avec deux couloirs de 8 m : les pistons seuls dans les couloirs, 5 contre 5 au centre. Passe au piston puis centre = 2 points.', 'Attirer au centre pour libérer le couloir|Le piston reçoit orienté vers l\'avant|Deux attaquants dans la surface', 'Chasubles, plots, 2 buts', '60x50'],
    ['jeu', 'Match à thème en 3-5-2', 25, 'Grand terrain. Les pistons ne peuvent pas être taclés dans leur couloir : centre obligatoire avant de marquer pour 2 points.', 'Largeur par les pistons|Les relayeurs arrivent dans la surface', 'Chasubles', '']] },
  { sys: '3-5-2', fmt: '11', title: 'Défendre à 5 : quand les pistons redescendent', goal: 'Sans ballon, la ligne de 5 protège la largeur, le milieu à 3 ferme l\'axe.', ex: [
    ['defense', 'Ligne de 5 contre 6 attaquants', 18, 'Largeur du terrain sur 35 m : 5 défenseurs + gardien contre 6 attaquants. Récupérer et relancer vers une porte = 1 point.', 'Le piston sort sur l\'ailier, le central couvre|Garder la ligne alignée|Communiquer', 'Chasubles, 1 but, plots', '35x68'],
    ['transitions', 'Sortie des pistons après récupération', 15, 'Après une récupération dans le camp, le piston part dans son couloir et reçoit dans la course, 3 contre 2 vers le but.', 'Course immédiate du piston|Passe dans la course|Les attaquants fixent les centraux', 'Ballons, 1 but', '60x50'],
    ['jeu', 'Match 11 contre 11 : bloc bas à 5', 25, 'Grand terrain. L\'équipe qui défend à 5 marque deux fois plus sur contre-attaque.', 'Patience en défense|Partir vite en contre', 'Chasubles', '']] },

  { sys: '3-4-3', fmt: '11', title: 'Le 3-4-3 : largeur et attaque à 3', goal: 'Trois attaquants occupent la largeur, les deux milieux protègent, les latéraux de milieu montent.', ex: [
    ['conservation', 'Jeu de position 7 contre 7 + 2', 20, 'Demi-terrain : chaque équipe en 3-4 réduit, 2 jokers attaquants. Passe à un attaquant qui se retourne = 1 point.', 'Occuper les 5 couloirs|Les attaquants larges fixent les latéraux|Passes vers l\'avant', 'Chasubles 3 couleurs', '50x60'],
    ['finition', 'Attaque à 3 contre 4 défenseurs', 18, 'Les 3 attaquants et un milieu contre 4 défenseurs et le gardien sur 40 m. 12 secondes pour marquer.', 'Courses croisées des attaquants|Jouer dans le dos des défenseurs|Tir au premier temps', 'Ballons, 1 but', '40x60'],
    ['jeu', 'Match à thème : attaque à 3', 25, 'Grand terrain. Les buts marqués par un des trois attaquants comptent double.', 'Trois joueurs dans la surface sur chaque centre', 'Chasubles', '']] },

  { sys: '4-1-4-1', fmt: '11', title: 'La sentinelle et les deux relayeurs', goal: 'La sentinelle couvre et oriente le jeu, les relayeurs attaquent les demi-espaces.', ex: [
    ['construction', 'La sentinelle dans le rond', 15, 'Zone de 30 x 30 m : 4 joueurs autour, la sentinelle au centre, 2 défenseurs. La sentinelle doit toucher le ballon tous les 3 passes.', 'Se montrer dans le dos des défenseurs|Jouer sur un côté puis changer|Contrôle orienté', 'Chasubles, plots', '30x30'],
    ['finition', 'Arrivée des relayeurs dans la surface', 18, 'L\'ailier déborde et centre, l\'attaquant attaque le premier poteau, le relayeur arrive au point de penalty.', 'Arriver lancé, pas trop tôt|Un relayeur reste pour couvrir', 'Ballons, 1 but', '40x60'],
    ['jeu', 'Match 11 contre 11 : relayeurs dans la surface', 25, 'Grand terrain. Un but d\'un relayeur compte double.', 'Équilibre : la sentinelle reste derrière', 'Chasubles', '']] },

  { sys: '5-3-2', fmt: '11', title: 'Bloc bas et contre-attaque', goal: 'Défendre bas et compact à 5, partir en contre avec les deux attaquants.', ex: [
    ['defense', 'Défendre la surface à 5 + 3', 20, 'Tiers défensif : 8 défenseurs contre 8 attaquants qui cherchent à marquer. Les défenseurs marquent en sortant le ballon au-delà de 40 m.', 'Fermer l\'axe|Pas de duel inutile|Récupérer et sortir', 'Chasubles, 1 but', '40x68'],
    ['transitions', 'Contre éclair à 2 attaquants', 15, 'Après une récupération, passe longue vers les 2 attaquants contre 2 défenseurs, un milieu arrive en soutien.', 'Appel en diagonale|Un attaquant en appui, l\'autre en profondeur|10 secondes pour finir', 'Ballons, 1 but', '60x50'],
    ['jeu', 'Match 11 contre 11 en 5-3-2', 25, 'Grand terrain. Un but marqué moins de 12 secondes après une récupération compte double.', 'Compacité|Vitesse de la première passe', 'Chasubles', '']] },

  // ---------- foot à 8 ----------
  { sys: '3-3-1', fmt: '8', title: 'Foot à 8 en 3-3-1 : occuper le terrain', goal: 'Trois lignes simples : défendre à 3, un milieu à 3 avec deux côtés, un attaquant en pointe.', ex: [
    ['conservation', 'Triangles à 3 contre 2', 12, 'Carré de 15 x 15 m : 3 attaquants en triangle contre 2 défenseurs. 5 passes = 1 point.', 'Former un triangle autour du porteur|Se déplacer après la passe', 'Plots, chasubles', '15x15'],
    ['construction', 'Relance par les côtés', 15, 'Demi-terrain de foot à 8 : gardien, 3 défenseurs et 3 milieux contre 4. Point si le milieu côté reçoit et passe la médiane.', 'Les défenseurs côté s\'écartent|Le milieu côté se montre|Jouer vers l\'avant', 'Chasubles, plots', '30x45'],
    ['jeu', 'Match 8 contre 8 à thème', 20, 'Terrain de foot à 8. Un but après une passe d\'un joueur de côté compte double.', 'Garder ses positions|Écarter le jeu', 'Chasubles', '']] },
  { sys: '2-3-2', fmt: '8', title: 'Foot à 8 en 2-3-2 : deux attaquants', goal: 'Deux défenseurs, trois milieux, deux attaquants qui combinent.', ex: [
    ['finition', 'Deux attaquants contre un défenseur', 12, 'Zone de 25 x 20 m devant le but : 2 contre 1 + gardien. 6 secondes pour marquer.', 'Fixer avant de passer|Un attaquant en appui, l\'autre en profondeur', 'Ballons, 1 but', '25x20'],
    ['pressing', 'Presser à deux attaquants', 15, 'Zone de 30 x 30 m : 2 attaquants pressent 3 défenseurs qui relancent. Récupérer = 1 point.', 'Un presse le porteur, l\'autre coupe la passe|Courir ensemble', 'Chasubles, plots', '30x30'],
    ['jeu', 'Match 8 contre 8 : à deux devant', 20, 'Terrain de foot à 8. Les buts des attaquants comptent double.', 'Toujours deux joueurs devant', 'Chasubles', '']] },
  { sys: '3-2-2', fmt: '8', title: 'Foot à 8 en 3-2-2 : solidité et contre', goal: 'Trois défenseurs, deux milieux qui récupèrent, deux attaquants qui partent vite.', ex: [
    ['defense', 'Défendre à 3 contre 4', 15, 'Zone de 30 x 40 m : 3 défenseurs + gardien contre 4 attaquants. Récupérer et passer à un attaquant à la médiane = 1 point.', 'Le central couvre|Défendre l\'axe d\'abord', 'Chasubles, 1 but', '30x40'],
    ['transitions', 'Récupérer et partir à 2', 15, 'Après récupération des milieux, 2 attaquants contre 1 défenseur qui recule.', 'Première passe vers l\'avant|Courir dans l\'espace', 'Ballons, 1 but', '40x40'],
    ['jeu', 'Match 8 contre 8 en 3-2-2', 20, 'Terrain de foot à 8. Un but après une récupération dans son camp compte double.', 'Compacité|Vitesse en contre', 'Chasubles', '']] },

  // ---------- foot à 5 ----------
  { sys: '2-2', fmt: '5', title: 'Foot à 5 en 2-2 : jouer ensemble', goal: 'Deux derrière, deux devant : passer, se déplacer, aider.', ex: [
    ['technique', 'Passe et va à 2', 10, 'Par 2 sur 15 m : je passe et je cours devant mon partenaire.', 'Passe du plat du pied|Courir après la passe', 'Ballons, plots', '15x10'],
    ['jeu', 'Le 2 contre 1', 12, 'Zone de 15 x 12 m : 2 attaquants contre 1 défenseur et un mini-but.', 'Attirer le défenseur avant de passer', 'Ballons, mini-but', '15x12'],
    ['jeu', 'Match 4 contre 4 + gardiens', 15, 'Terrain de foot à 5 : un but après 3 passes compte double.', 'Se démarquer|Revenir défendre', 'Chasubles', '']] },
  { sys: '1-2-1', fmt: '5', title: 'Foot à 5 en 1-2-1 : le losange', goal: 'Un défenseur, deux côtés, un attaquant : former un losange autour du ballon.', ex: [
    ['conservation', 'Le losange', 10, 'Quatre plots en losange de 10 m, un joueur par plot : passe et je suis ma passe.', 'Contrôle vers le plot suivant|Annoncer', 'Plots, ballons', '10x10'],
    ['jeu', 'Losange contre 2', 12, 'Losange de 12 m : 4 attaquants contre 2 défenseurs, 5 passes = 1 point.', 'Toujours deux solutions', 'Chasubles, plots', '12x12'],
    ['jeu', 'Match 4 contre 4 en losange', 15, 'Terrain de foot à 5 : garder la forme du losange pour marquer.', 'Écarter le jeu', 'Chasubles', '']] },
];

// more systems (written for the app)
SESSIONS_FOOT.push(
  { sys: '4-1-2-3', fmt: '11', title: 'La sentinelle et les deux 8 offensifs', goal: 'Une sentinelle devant la défense, deux relayeurs qui attaquent les demi-espaces, trois attaquants.', ex: [
    ['construction', 'Jouer par la sentinelle', 15, 'Zone de 35 x 40 m : 2 centraux et la sentinelle contre 3 attaquants, puis passe à un relayeur.', 'La sentinelle se montre dans le dos des attaquants|Contrôle orienté vers l\'avant|Jouer simple', 'Chasubles, plots', '35x40'],
    ['finition', 'Les 8 dans la surface', 18, 'Attaque à 5 (2 relayeurs + 3 attaquants) contre 4 défenseurs et le gardien sur 40 m.', 'Un relayeur arrive lancé|L\'ailier rentre, le latéral déborde', 'Ballons, 1 but', '40x60'],
    ['jeu', 'Match à thème 4-1-2-3', 25, 'Grand terrain : un but d\'un relayeur compte double.', 'Équilibre : la sentinelle couvre', 'Chasubles', '']] },
  { sys: '4-3-2-1 (sapin)', fmt: '11', title: 'Le sapin : deux meneurs derrière la pointe', goal: 'Trois milieux solides, deux meneurs entre les lignes, un attaquant qui fixe.', ex: [
    ['conservation', 'Les deux meneurs entre les lignes', 18, 'Demi-terrain : 3 milieux + 2 meneurs contre 4 milieux adverses. Passe à un meneur qui se retourne = 1 point.', 'Les meneurs dans les demi-espaces|Se montrer entre deux adversaires', 'Chasubles', '45x50'],
    ['finition', 'Combinaisons à 3 devant', 15, 'Les 2 meneurs et l\'attaquant contre 3 défenseurs et le gardien.', 'Une-deux avec la pointe|Frappe de loin si l\'axe est fermé', 'Ballons, 1 but', '35x45'],
    ['jeu', 'Match à thème : passe entre les lignes', 25, 'Grand terrain : un but après une passe reçue par un meneur compte double.', 'Largeur par les latéraux', 'Chasubles', '']] },
  { sys: '4-3-1-2', fmt: '11', title: 'Le meneur derrière deux attaquants', goal: 'Un milieu axial à 3, un meneur et deux attaquants : jeu dans l\'axe, latéraux pour la largeur.', ex: [
    ['construction', 'Losange au milieu', 15, 'Zone de 40 x 40 m : les 3 milieux + le meneur contre 3 milieux adverses.', 'Former des triangles|Le meneur décroche entre les lignes', 'Chasubles', '40x40'],
    ['finition', 'Meneur et deux attaquants', 15, 'Le meneur sert un des deux attaquants, l\'autre attaque le second ballon.', 'Appels croisés|Passe dans la course', 'Ballons, 1 but', '35x45'],
    ['jeu', 'Match : les latéraux doivent monter', 25, 'Grand terrain : un but après un centre d\'un latéral compte double.', 'Largeur par les latéraux', 'Chasubles', '']] },
  { sys: '4-4-2 losange', fmt: '11', title: 'Le losange au milieu', goal: 'Sentinelle, deux relayeurs, un meneur : supériorité dans l\'axe.', ex: [
    ['conservation', 'Losange 4 contre 2', 12, 'Losange de 15 m : 4 joueurs aux pointes contre 2 au centre. 8 passes = 1 point.', 'Toujours deux solutions|Jouer en une ou deux touches', 'Chasubles, plots', '15x15'],
    ['conservation', 'Supériorité dans l\'axe', 18, 'Zone de 40 x 30 m : les 4 du losange + 2 attaquants contre 4 milieux et 2 défenseurs.', 'Attirer au centre puis écarter|Le meneur se retourne', 'Chasubles', '40x30'],
    ['jeu', 'Match en 4-4-2 losange', 25, 'Grand terrain : un but après 3 passes dans l\'axe compte double.', 'Les latéraux donnent la largeur', 'Chasubles', '']] },
  { sys: '4-2-2-2', fmt: '11', title: 'Le carré au milieu', goal: 'Deux milieux défensifs, deux milieux offensifs intérieurs, deux attaquants : jeu direct et combinaisons.', ex: [
    ['transitions', 'Récupérer et jouer vite vers l\'avant', 15, 'Zone de 50 x 40 m : 6 contre 6, après récupération 3 passes maximum pour marquer.', 'Première passe vers l\'avant|Les milieux offensifs attaquent l\'espace', 'Chasubles, 2 buts', '50x40'],
    ['finition', 'Combinaisons à 4 devant', 15, 'Les 2 milieux offensifs et les 2 attaquants contre 4 défenseurs.', 'Appels dans la profondeur|Jeu à une touche', 'Ballons, 1 but', '40x50'],
    ['jeu', 'Match à thème', 25, 'Grand terrain : un but marqué moins de 10 secondes après la récupération compte double.', 'Verticalité', 'Chasubles', '']] },
  { sys: '4-5-1', fmt: '11', title: 'Le bloc à 5 milieux', goal: 'Densité au milieu, un attaquant en appui, les milieux arrivent de la deuxième ligne.', ex: [
    ['defense', 'Bloc de 9 sans ballon', 18, 'Deux lignes (4 + 5) contre 7 attaquants : coulisser et fermer l\'axe.', 'Compacité|Distances courtes', 'Chasubles', '45x68'],
    ['finition', 'L\'appui et les arrivées', 15, 'L\'attaquant reçoit dos au but, remise pour un milieu qui arrive et frappe.', 'Remise en une touche|Arriver lancé', 'Ballons, 1 but', '30x40'],
    ['jeu', 'Match à thème', 25, 'Grand terrain : un but d\'un milieu compte double.', 'Équilibre', 'Chasubles', '']] },
  { sys: '4-4-1-1', fmt: '11', title: 'Le 9 et demi', goal: 'Deux lignes de 4, un attaquant de soutien derrière la pointe.', ex: [
    ['pressing', 'Pressing à 2 décalés', 15, 'Le 9 et le 9 et demi contre 2 centraux et un 6 : le 9 et demi coupe le 6.', 'Un presse, l\'autre ferme|Orienter vers un côté', 'Chasubles, plots', '30x30'],
    ['finition', 'Le 9 et demi entre les lignes', 15, 'Il reçoit entre les lignes et sert la pointe ou frappe.', 'Se retourner vite|Regarder avant de recevoir', 'Ballons, 1 but', '35x40'],
    ['jeu', 'Match à thème', 25, 'Grand terrain : passe décisive du 9 et demi = but double.', 'Compacité', 'Chasubles', '']] },
  { sys: '3-4-1-2', fmt: '11', title: 'Trois derrière, un meneur et deux attaquants', goal: 'Pistons pour la largeur, un meneur, deux attaquants.', ex: [
    ['construction', 'Relance à 3 et piston', 15, 'Zone de 40 x 60 m : 3 centraux + 2 pistons contre 3 attaquants.', 'Le piston haut|Changer de côté', 'Chasubles', '40x60'],
    ['finition', 'Le meneur et les deux attaquants', 15, 'Combinaisons à 3 contre 3 défenseurs devant la surface.', 'Appels croisés|Le meneur frappe si c\'est ouvert', 'Ballons, 1 but', '35x45'],
    ['jeu', 'Match en 3-4-1-2', 25, 'Grand terrain : centre d\'un piston puis but = double.', 'Largeur', 'Chasubles', '']] },
  { sys: '3-4-2-1', fmt: '11', title: 'Les deux 10 derrière la pointe', goal: 'Deux milieux offensifs dans les demi-espaces, une pointe, les pistons dans les couloirs.', ex: [
    ['conservation', 'Les demi-espaces', 18, 'Terrain découpé en 5 couloirs : les deux 10 seuls dans les demi-espaces, 7 contre 7.', 'Recevoir dans le demi-espace|Jouer vers la pointe', 'Chasubles, plots', '50x60'],
    ['finition', 'Arrivées des deux 10', 15, 'Le piston centre en retrait, les deux 10 arrivent.', 'Arriver au bon moment', 'Ballons, 1 but', '40x50'],
    ['jeu', 'Match à thème', 25, 'Grand terrain : but d\'un 10 = double.', 'Occuper les couloirs', 'Chasubles', '']] },
  { sys: '5-4-1', fmt: '11', title: 'Défendre très bas à 9', goal: 'Cinq défenseurs et quatre milieux très proches, un attaquant qui garde le ballon.', ex: [
    ['defense', 'Bloc bas 9 contre 9', 20, 'Tiers défensif : 9 défenseurs contre 9 attaquants. Sortir le ballon = 1 point.', 'Pas d\'espace entre les lignes|Défendre la surface', 'Chasubles, 1 but', '40x68'],
    ['transitions', 'L\'attaquant garde le ballon', 15, 'Passe longue vers l\'attaquant qui protège en attendant 2 soutiens.', 'Protéger avec le corps|Jouer en retrait vers le soutien', 'Ballons', '40x30'],
    ['jeu', 'Match en 5-4-1', 25, 'Grand terrain : but sur contre-attaque = double.', 'Patience', 'Chasubles', '']] },
  { sys: '5-2-3', fmt: '11', title: 'Défense à 5 et trois attaquants', goal: 'Solides derrière, trois attaquants qui restent hauts pour la contre-attaque.', ex: [
    ['defense', 'Ligne de 5 et double pivot', 18, 'Les 5 défenseurs et 2 milieux contre 7 attaquants.', 'Fermer l\'axe|Les pistons sortent sur les ailiers', 'Chasubles', '40x68'],
    ['transitions', 'Contre-attaque à 3', 15, 'Les 3 attaquants contre 3 défenseurs qui reculent, 10 secondes pour finir.', 'Courir vers l\'avant|Passe dans la course', 'Ballons, 1 but', '60x50'],
    ['jeu', 'Match à thème', 25, 'Grand terrain : but en contre-attaque = double.', 'Rester haut devant', 'Chasubles', '']] },
  { sys: '3-1-3', fmt: '8', title: 'Foot à 8 en 3-1-3 : trois attaquants', goal: 'Un milieu central, trois attaquants qui attaquent la largeur.', ex: [
    ['construction', 'Le milieu central relais', 12, 'Zone de 25 x 25 m : 3 défenseurs + le milieu contre 2 attaquants.', 'Le milieu se montre|Jouer vers les côtés', 'Chasubles', '25x25'],
    ['finition', 'Attaque à 3', 15, 'Les 3 attaquants contre 2 défenseurs et le gardien.', 'Largeur|Centre au premier poteau', 'Ballons, 1 but', '30x35'],
    ['jeu', 'Match 8 contre 8 en 3-1-3', 20, 'Terrain de foot à 8 : but d\'un attaquant de côté = double.', 'Écarter', 'Chasubles', '']] },
  { sys: '2-4-1', fmt: '8', title: 'Foot à 8 en 2-4-1 : le milieu à 4', goal: 'Densité au milieu, deux défenseurs, un attaquant de pointe.', ex: [
    ['conservation', 'Milieu à 4 contre 3', 15, 'Zone de 30 x 25 m : 4 milieux contre 3, 6 passes = 1 point.', 'Losange|Passes courtes', 'Chasubles', '30x25'],
    ['finition', 'La pointe et les arrivées', 12, 'L\'attaquant remise pour un milieu qui frappe.', 'Remise propre', 'Ballons, 1 but', '25x30'],
    ['jeu', 'Match 8 contre 8 en 2-4-1', 20, 'But d\'un milieu = double.', 'Arriver dans la surface', 'Chasubles', '']] },
  { sys: '2-1-1', fmt: '5', title: 'Foot à 5 en 2-1-1', goal: 'Deux derrière, un milieu, un attaquant.', ex: [
    ['technique', 'Passe au milieu puis devant', 10, 'Les 2 défenseurs passent au milieu qui sert l\'attaquant.', 'Regarder avant de recevoir', 'Ballons, plots', '20x15'],
    ['jeu', '3 contre 2', 12, 'Zone de 20 x 15 m : 3 attaquants contre 2.', 'Fixer et passer', 'Ballons, mini-but', '20x15'],
    ['jeu', 'Match 4 contre 4', 15, 'Terrain de foot à 5 : chacun à son poste.', 'Revenir défendre', 'Chasubles', '']] }
);
