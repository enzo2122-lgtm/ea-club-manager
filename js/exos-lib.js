/* ExosLib (2.30): the library of exercises with a schema WRITTEN for each one (AutoSchema.fromScript): zones, cones, goals,
   numbered players and the action step by step. [theme, title, minutes, organisation, consignes (+ évolutions), matériel, formats (5,8,11), size, script]
   Coordinates in metres, x to the right, y down; our team (h, blue) attacks to the right. */
const EXOS_LIB = [
  /* ---------------- échauffement ---------------- */
  ['echauffement', 'Échauffement : passes en Y', 12, 'Plots en Y : un départ, un plot central à 10 m, deux sorties à 8 m en diagonale. Un joueur par plot, les autres attendent au départ.',
    'Passe appuyée au sol, contrôle orienté vers la sortie\nSuivre sa passe\nAnnoncer le côté (« gauche ! »)\nÉvolution : une-deux avec le plot central', 'Plots, ballons', '8,11', '24x16',
    `F 24x16
C 2 8
C 12 8
C 20 3
C 20 13
P 1 1.5 8 h
P 5 0.6 9.3 h
P 2 12.8 8 h
P 3 20.5 3 h
P 4 20.5 13 h
B 1
S Le 1 a le ballon, le 2 est en appui au plot central
> Le 1 passe au 2, qui vient au-devant | run 2 11 8; pass 2
> Contrôle orienté du 2 vers la sortie haute, le 1 suit sa passe | drib 2 14 6; run 1 11 8
> Passe du 2 au 3, qui attaque le ballon | pass 3; run 3 18.5 4
> Le 2 prend la place du 3 à la sortie, le 3 repart au départ | run 2 20 3`],
  ['echauffement', 'Échauffement : le carré des passes', 12, 'Carré de 12 × 12 m, un plot à chaque coin, 2 joueurs par plot, 2 ballons en même temps.',
    'Passe et suis ta passe (dans le sens des aiguilles d\'une montre)\nContrôle du pied extérieur au carré\nRegarder où va le 2e ballon\nÉvolution : changer de sens au coup de sifflet', 'Plots, 2 ballons', '5,8,11', '12x12',
    `F 14x14
C 1 1
C 13 1
C 13 13
C 1 13
P 1 1 1.6 h
P 2 13 1.6 h
P 3 13 12.4 h
P 4 1 12.4 h
P 5 0.4 0.4 h
P 6 13.6 13.6 h
B 1
S Un joueur à chaque coin, le 1 a le ballon
> Le 1 passe au 2 et suit sa passe | pass 2; run 1 12 1.2
> Le 2 contrôle vers l'intérieur et passe au 3 | drib 2 13 3; pass 3; run 2 12.8 11.8
> Le 3 enchaîne vers le 4 | pass 4; run 3 1.8 12.6
> Le 4 ferme le carré vers le 5 au départ | pass 5; run 4 0.8 2.2`],
  ['echauffement', 'Activation : couloirs d\'appuis', 10, 'Trois couloirs de 15 m : échelle de rythme, slalom de plots, sprint de 5 m en sortie. Retour au trot.',
    'Pointe de pied, buste droit\nBras actifs\nSprint de 5 m à fond en sortie\nÉvolution : finir par une passe au coach', 'Échelle, plots, coupelles', '8,11', '20x12',
    `F 22x14
Z 2 1 10 3 jaune échelle
L 2 7 12 7 6
Z 2 10 10 3 bleu sprint
C 17 2.5
C 17 7
C 17 11.5
P 1 1 2.5 h
P 2 1 7 h
P 3 1 11.5 h
S Un joueur par couloir
> Appuis rapides dans l'échelle, slalom, montée de genoux | run 1 12 2.5; run 2 12 7 .3; run 3 12 11.5
> Sprint jusqu'au plot de sortie | run 1 17 2.5; run 2 17 7; run 3 17 11.5
> Retour au trot par l'extérieur | run 1 20 1; run 2 20 7; run 3 20 13`],
  ['echauffement', 'Toro de réveil 4 contre 1', 10, 'Cercle de 10 m de diamètre, 4 joueurs autour, 1 au milieu. Rotation toutes les 45 s.',
    'Deux touches maximum\nPas de passe au voisin direct quand il est fermé\nLe défenseur court 45 s à fond', 'Coupelles, chasubles', '5,8,11', '12x12',
    `F 12x12
C 1 1
C 11 1
C 11 11
C 1 11
P 1 6 1.4 h
P 2 10.6 6 h
P 3 6 10.6 h
P 4 1.4 6 h
P X 6.5 5.6 a X
B 1
S 4 autour, 1 au milieu : le 1 a le ballon
> Le défenseur ferme la passe vers le 2 : passe au 4 | press X 4.5 4.5; pass 4 .15
> Le 4 casse la ligne : passe au 2 entre les jambes | press X 3 6; pass 2
> Le 2 contrôle, le défenseur repart : passe au 3 | press X 8.5 7.5; pass 3 .15`],
  ['echauffement', 'Échauffement en couleurs (enfants)', 8, 'Carré de 15 × 15 m, chacun son ballon, 4 portes de couleur (2 plots). Le coach annonce une couleur.',
    'Tête haute, ballon près du pied\nChanger de direction au signal\nPasser la bonne porte le plus vite possible', 'Plots de 4 couleurs, ballons', '5,8', '15x15',
    `F 15x15
C 1 6
C 1 9
C 14 6 bleu
C 14 9 bleu
C 6 1 jaune
C 9 1 jaune
C 6 14 rouge
C 9 14 rouge
P 1 5 5 h
P 2 9 6 h
P 3 7 10 h
P 4 10.5 9.5 h
B 1
S Chacun son ballon dans le carré
> Conduite libre, tête haute | drib 1 7 7 .3; run 2 6 8; run 3 9 9; run 4 8 6
> « Bleu ! » : tout le monde fonce vers la porte bleue | drib 1 13.5 7.5; run 2 13.5 7.3; run 3 13.4 8; run 4 13.6 8.4`],

  /* ---------------- technique ---------------- */
  ['technique', 'Passe et suis en losange', 15, 'Losange de 12 m (4 plots), 2 joueurs au départ. Passe, suis ta passe ; une-deux avec le joueur en face.',
    'Passe à plat du pied, tendue\nContrôle orienté dans la course\nAppel avant de recevoir\nÉvolution : en une touche', 'Plots, ballons', '8,11', '16x16',
    `F 16x16
C 8 2
C 14 8
C 8 14
C 2 8
P 1 2 8.6 h
P 5 1 9.4 h
P 2 8 2.6 h
P 3 13.4 8 h
P 4 8 13.4 h
B 1
S Un joueur par plot, le 1 a le ballon
> Le 1 passe au 2 | pass 2; run 1 3 7
> Une-deux : le 2 remet au 1 qui arrive | pass 1 .1; run 1 5 5
> Le 1 joue vers le 3, le 2 va au plot du 3 | pass 3; run 1 7.6 2.6; run 2 12.6 7
> Le 3 conduit et passe au 4 | drib 3 11 10; pass 4`],
  ['technique', 'Conduite et dribble face au défenseur', 15, 'Couloir de 25 × 12 m : slalom de 5 plots, puis duel face à un défenseur qui démarre à la ligne, mini-but au bout.',
    'Petites touches dans le slalom\nAccélérer après le dernier plot\nFeinte puis changement de rythme\nÉvolution : défenseur actif dès le départ', 'Plots, 1 mini-but, ballons', '5,8,11', '25x12',
    `F 25x12
L 4 6 12 6 5
G 25 6 0 2
P 1 1.5 6 h
P 2 0.6 7.5 h
P X 17 6 a X
B 1
S L'attaquant au départ, le défenseur au bout du slalom
> Slalom en petites touches | drib 1 12.5 6 .25
> Le défenseur sort, l'attaquant accélère vers lui | drib 1 15 6; press X 16.5 6.2
> Feinte vers l'intérieur… | drib 1 16 7.5 .2; press X 16.5 7
> …crochet extérieur et frappe dans le mini-but | drib 1 20 4.5 -.2; shot 25 5.6`],
  ['technique', 'Contrôle orienté sous pression', 15, 'Carré de 15 × 15 m, 2 portes de sortie (2 plots) sur les côtés. Le passeur au fond, le receveur au centre, un défenseur derrière lui.',
    'Regarder par-dessus l\'épaule avant de recevoir\nContrôle orienté du côté opposé au défenseur\nSortir par la porte en conduite\nÉvolution : défenseur libre', 'Plots, chasubles, ballons', '8,11', '15x15',
    `F 16x16
C 1 6
C 1 10
C 15 6
C 15 10
P 1 8 15 h
P 2 8 8 h
P X 8 5.5 a X
B 1
S Le passeur en bas, le receveur dos au jeu, le défenseur derrière
> Le receveur regarde, le passeur joue au sol | pass 2; press X 8.5 6.8
> Contrôle orienté vers la droite, loin du défenseur | drib 2 11 8.5 -.2; press X 9.5 7
> Il sort par la porte en conduite | drib 2 15.5 8; run X 12 7`],
  ['technique', 'Jeu de tête : sauter et orienter', 10, 'Par 3 sur 15 m : un lanceur à la main, un joueur de tête, un receveur sur le côté.',
    'Yeux ouverts, front sur le ballon\nSauter sur un pied\nOrienter vers le receveur\nRéservé aux U12 et plus', 'Ballons', '11', '15x10',
    `F 15x10
P 1 2 5 h
P 2 9 5 h
P 3 13 1.5 h
B 1
S Le lanceur, le joueur de tête, le receveur
> Lancer à la main en cloche | pass 2 -.3
> Saut, tête orientée vers le receveur | pass 3 .1; run 2 9.5 4.5`],
  ['technique', 'Jonglerie défis par 2', 10, 'Par 2, un ballon : jongler, passer en l\'air au partenaire qui contrôle et enchaîne.',
    'Pied fort puis pied faible\nAmortir avec la cuisse ou le pied\nCompter les passes sans que le ballon tombe', 'Ballons', '5,8,11', '10x6',
    `F 10x6
P 1 2 3 h
P 2 8 3 h
B 1
S Par 2, face à face
> Trois jongles puis passe en l'air | pass 2 -.35
> Contrôle de la cuisse, jongle, et retour | pass 1 -.35`],
  ['technique', 'Circuit technique en 3 ateliers', 18, 'Parcours de 40 × 20 m : slalom en conduite, une-deux avec un appui, frappe dans le mini-but. Retour au départ par l\'extérieur.',
    'Enchaîner sans s\'arrêter\nDernière touche de conduite pour se placer à la frappe\nUne-deux en une touche\nÉvolution : chrono par équipe', 'Plots, 1 mini-but, ballons', '5,8,11', '40x20',
    `F 40x20
L 4 10 14 10 5
C 20 4
P A 22 4 h A
G 40 10 0 2
P 1 2 10 h
P 2 1 12 h
B 1
S Le 1 démarre, l'appui attend au plot
> Slalom en conduite | drib 1 15 10 .25
> Une-deux avec l'appui | pass A; run 1 26 9
> Remise en une touche dans la course | pass 1 .1
> Frappe dans le mini-but | drib 1 32 10; shot 40 9.6`],

  /* ---------------- conservation ---------------- */
  ['conservation', 'Rondo 6 contre 2 sur deux zones', 15, 'Deux carrés de 10 × 10 m côte à côte. 6 joueurs dans un carré contre 2 ; après 6 passes, passe longue dans l\'autre carré, les défenseurs suivent.',
    'Deux touches maximum\nUn joueur toujours en soutien\nChanger de carré après 6 passes\nÉvolution : 3 défenseurs', 'Plots, chasubles', '8,11', '24x12',
    `F 24x12
Z 1 1 10 10 bleu carré 1
Z 13 1 10 10 jaune carré 2
P 1 1.5 3 h
P 2 6 1.5 h
P 3 10.5 4 h
P 4 10.5 9 h
P 5 6 10.5 h
P 6 1.5 8 h
P X 5 5 a X
P Y 7 7 a Y
B 1
S 6 contre 2 dans le carré bleu
> Passe au 2, les défenseurs coulissent | pass 2; press X 5.5 3; press Y 7 5
> Passe qui casse la ligne vers le 5 | pass 5; press Y 6.5 8.5
> Le 5 trouve le 4, libre | pass 4 .1; press X 9 7
> Passe longue dans le carré jaune, tous suivent | run 1 14 3; run 2 18 1.5; run 6 14 9; pass 1 -.2; run X 16 6; run Y 17 7`],
  ['conservation', 'Conservation 5 contre 5 + 2 appuis', 18, 'Rectangle de 30 × 25 m, un appui (joker) sur chaque largeur. Point : 10 passes ou passe d\'un appui à l\'autre.',
    'Largeur et profondeur\nJouer vers l\'appui pour changer de côté\nAprès la perte, presser 5 secondes\nÉvolution : appuis à une touche', 'Plots, chasubles 3 couleurs', '8,11', '30x25',
    `F 30x25
C 0.5 0.5
C 29.5 0.5
C 29.5 24.5
C 0.5 24.5
P J1 1 12.5 j J
P J2 29 12.5 j J
P 1 6 5 h
P 2 6 19 h
P 3 15 12 h
P 4 22 4 h
P 5 23 20 h
P A1 11 8 a
P A2 12 17 a
P A3 18 11 a
P A4 19 5 a
P A5 18 19 a
B J1
S 5 contre 5, un appui jaune de chaque côté : l'appui de gauche a le ballon
> L'appui joue au 2 qui s'est écarté | run 2 5 21; pass 2; pb
> Le 3 décroche, le 2 lui donne | run 3 12 13; pass 3; pb
> Le 3 se retourne et trouve le 5 en profondeur | pass 5 .1; pb
> Le 5 joue l'appui de droite : point ! | pass J2; pb`],
  ['conservation', 'Jeu de position 4 contre 4 + 3', 18, 'Rectangle de 32 × 24 m découpé en 3 couloirs. 4 contre 4 au milieu, 3 jokers (2 en bout, 1 au centre). Les jokers jouent avec le ballon.',
    'Un joueur par couloir minimum\nFixer pour libérer le joueur suivant\nTroisième homme : passe vers le joker qui trouve le partenaire libre\nÉvolution : joker central à une touche', 'Plots, chasubles 3 couleurs', '8,11', '32x24',
    `F 32x24
Z 0 0 32 8 bleu
Z 0 16 32 8 bleu
P J1 1 12 j J
P J2 31 12 j J
P J3 16 12 j J
P 1 8 4 h
P 2 8 20 h
P 3 24 4 h
P 4 24 20 h
P A1 12 7 a
P A2 12 17 a
P A3 20 7 a
P A4 20 17 a
B J1
S 4 contre 4 + 3 jokers : on joue dans les 3 couloirs
> Le joker de gauche lance le 1 | pass 1; pb
> Fixé, le 1 joue le joker central… | pass J3; pb
> …qui trouve le 4, libre dans le couloir opposé (troisième homme) | run 4 25 21; pass 4 .15; pb
> Le 4 donne au joker de droite : séquence réussie | pass J2; pb`],
  ['conservation', 'Rondo 4 contre 2 + 1 joker central', 12, 'Carré de 12 × 12 m, 4 joueurs sur les côtés, 1 joker au milieu, 2 défenseurs.',
    'Le joker se montre entre les deux défenseurs\nPasse à travers = 1 point\nDeux touches', 'Plots, chasubles', '8,11', '12x12',
    `F 12x12
C 0.5 0.5
C 11.5 0.5
C 11.5 11.5
C 0.5 11.5
P 1 6 0.8 h
P 2 11.2 6 h
P 3 6 11.2 h
P 4 0.8 6 h
P J 6 6 j J
P X 4.5 4 a X
P Y 7.5 8 a Y
B 4
S 4 sur les côtés, le joker au centre, 2 défenseurs
> Le joker se montre entre les défenseurs | run J 5.5 6.5; pb
> Passe au joker… | pass J; press X 5 5
> …qui se retourne et sert le 2 de l'autre côté | pass 2; press Y 9 7`],
  ['conservation', 'Passe à dix (enfants)', 12, 'Terrain de 20 × 20 m, 4 contre 4. Dix passes d\'affilée = un point. La balle perdue, on recommence à zéro.',
    'Se démarquer : aller où il n\'y a personne\nAppeler le ballon\nCompter à voix haute', 'Plots, chasubles', '5,8', '20x20',
    `F 20x20
C 0.5 0.5
C 19.5 0.5
C 19.5 19.5
C 0.5 19.5
P 1 4 4 h
P 2 15 5 h
P 3 5 15 h
P 4 15 15 h
P A1 8 8 a
P A2 12 8 a
P A3 8 12 a
P A4 12 12 a
B 1
S 4 contre 4 : les bleus comptent leurs passes
> Le 2 s'écarte et appelle, passe ! « 1 ! » | run 2 17 3; pass 2; pb
> « 2 ! » vers le 4, démarqué | run 4 17 17; pass 4; pb
> « 3 ! » vers le 3 de l'autre côté | pass 3 .2; pb`],

  /* ---------------- pressing ---------------- */
  ['pressing', 'Pressing 4 contre 4 + 4 : récupérer en 6 secondes', 18, 'Carré de 25 × 25 m, 3 équipes de 4. Deux équipes conservent (8 contre 4), l\'équipe qui perd le ballon devient pressante.',
    'Le plus proche presse le porteur\nLes autres ferment les passes courtes\nObjectif : récupérer en moins de 6 secondes\nÉvolution : 2 touches pour les conservants', 'Plots, chasubles 3 couleurs', '8,11', '25x25',
    `F 25x25
C 0.5 0.5
C 24.5 0.5
C 24.5 24.5
C 0.5 24.5
P 1 3 4 h
P 2 12 2 h
P 3 21 5 h
P 4 22 20 h
P 5 3 21 j
P 6 12 23 j
P 7 4 12 j
P 8 21 12 j
P A1 10 9 a
P A2 15 10 a
P A3 10 15 a
P A4 15 15 a
B 1
S 8 conservent (bleus + jaunes), les 4 blancs pressent
> Passe au 2 : le premier presseur fonce, les autres coulissent | pass 2; press A1 11 4; press A2 15 6; run A3 11 10; run A4 15 11
> Le 2 cherche le 3 : la passe est coupée par le deuxième presseur | press A2 18 5; press A1 13 3; run 3 22 4
> Récupération en moins de 6 secondes : on change de rôle | pass A2 .1; run A3 14 8`],
  ['pressing', 'Pressing sur la relance : 6 contre 4 + gardien', 20, 'Demi-terrain : le gardien relance avec 4 défenseurs ; 6 attaquants pressent sur un signal (passe vers un latéral). Récupérer et marquer en 10 secondes.',
    'Signal : passe vers le côté\nFermer l\'intérieur, pousser vers la ligne\nLe bloc monte ensemble\nÉvolution : un milieu de plus pour la relance', 'Plots, chasubles, 1 but', '11', '50x45',
    `F 52x45
G 0 22.5 180 5
P G 1.5 22.5 k G
P D1 8 6 a
P D2 7 17 a
P D3 7 28 a
P D4 8 39 a
P 9 20 18 h
P 10 20 28 h
P 7 22 8 h
P 11 22 37 h
P 8 30 15 h
P 6 30 30 h
B G
S Le gardien relance, nos 6 attendent le signal
> Le gardien joue court à droite : signal ! | pass D2; run 9 12 18; run 10 15 25
> Passe au latéral : le 7 fonce, le 9 ferme l'axe | pass D1; press 7 10 7; run 9 9 13; run 8 18 12
> Le latéral est enfermé contre la ligne : récupération du 7 | press 7 8.5 5.5; run 8 13 9
> Le 7 centre en retrait, le 9 finit | drib 7 9 10; pass 9; shot 0 21.5`],
  ['pressing', 'Contre-pressing 5 contre 5 + 2 mini-buts', 15, 'Terrain de 35 × 25 m, 2 mini-buts de chaque côté. But normal = 1 point ; but marqué dans les 6 s après une récupération = 2 points.',
    'Réagir tout de suite à la perte\nLe plus proche presse, les autres ferment\nMarquer vite après la récupération', 'Plots, chasubles, 4 mini-buts', '8,11', '35x25',
    `F 36x26
G 0 6 180 2
G 0 20 180 2
G 36 6 0 2
G 36 20 0 2
P 1 8 8 h
P 2 8 18 h
P 3 15 13 h
P 4 22 6 h
P 5 22 20 h
P A1 26 9 a
P A2 26 17 a
P A3 20 13 a
P A4 14 6 a
P A5 14 20 a
B 4
S Les bleus attaquent à droite
> Le 4 perd le ballon : l'adversaire le récupère | pass A1; run 4 23 7
> Perte : les trois plus proches pressent tout de suite | press 4 25 8; press 3 22 11; press 5 24 17
> Récupération du 4 et but en moins de 6 s : 2 points ! | pass 4; drib 4 31 7; shot 36 6.4`],
  ['pressing', 'Chasseurs 3 contre 6 (enfants)', 10, 'Carré de 20 × 20 m, 6 joueurs avec chacun un ballon, 3 chasseurs sans ballon. Chasseur qui touche un ballon = il le sort du carré.',
    'Protéger son ballon avec le corps\nRegarder où sont les chasseurs\nChasseurs : s\'organiser à 3 pour coincer', 'Plots, chasubles, ballons', '5,8', '20x20',
    `F 20x20
C 0.5 0.5
C 19.5 0.5
C 19.5 19.5
C 0.5 19.5
P 1 4 4 h
P 2 16 4 h
P 3 10 10 h
P X 2 17 a X
P Y 10 18 a Y
B 1
S Les bleus conduisent, les chasseurs entrent
> Les chasseurs coincent le 1 à deux | press X 3 7; press Y 6 6; drib 1 5 3
> Le 1 protège, change de direction et s'échappe | drib 1 12 2 -.3; press X 9 4`],

  /* ---------------- transitions ---------------- */
  ['transitions', 'Transition 4 contre 3 puis 3 contre 2 retour', 18, 'Terrain de 50 × 35 m, 2 buts + gardiens. Les 4 bleus attaquent contre 3 ; à la perte ou au but, 3 blancs repartent contre 2 bleus.',
    'Attaquer vite l\'espace\nFixer avant de donner\nÀ la perte : repli immédiat des deux derniers\nÉvolution : 8 secondes pour marquer', 'Plots, chasubles, 2 buts', '8,11', '50x35',
    `F 50x35
G 0 17.5 180 5
G 50 17.5 0 5
P G 1.5 17.5 g G
P K 48.5 17.5 k G
P 1 18 10 h
P 2 18 25 h
P 3 24 17 h
P 4 30 12 h
P A1 36 10 a
P A2 36 24 a
P A3 40 17 a
B 3
S 4 bleus attaquent à droite contre 3
> Le 3 conduit pour fixer le défenseur central | drib 3 31 17; press A3 35 17
> Passe au 2 qui attaque l'espace sur le côté | run 2 36 28; pass 2; press A2 38 25
> Centre en retrait pour le 4 qui arrive | run 4 41 15; pass 4 .1
> Frappe : le gardien plonge | shot 50 16.2; run K 48.8 16.6`],
  ['transitions', 'Récupère et marque en 8 secondes', 18, 'Demi-terrain, 6 contre 6 + gardien. Les blancs attaquent ; dès la récupération, les bleus ont 8 secondes pour marquer dans l\'un des 2 mini-buts à la ligne médiane.',
    'Première passe vers l\'avant\n3 joueurs partent tout de suite\nChrono à voix haute\nÉvolution : 6 secondes', 'Plots, chasubles, 1 but, 2 mini-buts', '11', '50x45',
    `F 52x45
G 0 22.5 180 5
G 52 10 0 2
G 52 35 0 2
P G 1.5 22.5 g G
P 4 9 16 h
P 5 9 29 h
P 6 18 22 h
P 8 26 12 h
P 10 26 32 h
P A1 14 22 a
P A2 20 10 a
P A3 22 34 a
B A1
S Les blancs attaquent notre but
> Le 6 coupe la passe et récupère | pass 6 .1; press 6 15 22
> Première passe vers l'avant pour le 8 qui part | run 8 34 12; pass 8; run 10 36 30
> 8 secondes : le 8 conduit et frappe dans le mini-but | drib 8 45 11; shot 52 10.4`],
  ['transitions', 'Le jeu des vagues 3 contre 2', 15, 'Terrain de 40 × 30 m, 2 buts. 3 bleus attaquent contre 2 ; l\'action finie, les 2 défenseurs repartent avec un 3e contre 2 nouveaux.',
    'Prendre la largeur à 3\nFinir l\'action en moins de 10 s\nEnchaîner sans attendre', 'Plots, chasubles, 2 buts', '5,8,11', '40x30',
    `F 40x30
G 0 15 180 3
G 40 15 0 3
P 1 6 15 h
P 2 6 5 h
P 3 6 25 h
P A1 26 11 a
P A2 26 19 a
B 1
S 3 contre 2 vers la droite
> Le 1 conduit dans l'axe, les 2 et 3 s'écartent | drib 1 17 15; run 2 22 4; run 3 22 26
> Le défenseur sort sur le 1 : passe au 3 | press A2 20 17; pass 3; press A1 27 20
> Le 3 frappe au second poteau | drib 3 32 22; shot 40 14`],

  /* ---------------- finition ---------------- */
  ['finition', 'Frappes après une-deux avec le pivot', 15, 'Deux colonnes à 30 m du but, un pivot dos au but à 20 m. Une-deux avec le pivot, frappe sans contrôle.',
    'Passe tendue dans les pieds du pivot\nAppel dans la course pour la remise\nFrapper du coup de pied, cheville verrouillée\nÉvolution : le pivot se retourne et frappe', 'Plots, 1 but, ballons', '8,11', '35x30',
    `F 36x30
G 36 15 0 5
P K 34.5 15 k G
P 1 6 10 h
P 2 6 20 h
P 5 5 11.5 h
P 9 18 15 h
B 1
S Le pivot dos au but, les colonnes à 30 m
> Passe tendue au pivot | pass 9; run 9 17 14.5
> Le 1 attaque l'espace, remise en une touche | run 1 21 12; pass 1 .1
> Frappe sans contrôle : le gardien plonge | shot 36 13.6; run K 34.8 13.8`],
  ['finition', 'Centres : premier et second poteau', 18, 'Couloir latéral + surface. Le latéral reçoit, déborde et centre ; 2 attaquants attaquent les deux poteaux, 1 milieu se place en retrait.',
    'Le centreur lève la tête avant de centrer\nAttaquant 1 au premier poteau, attaquant 2 au second\nLe milieu en retrait pour le ballon repoussé\nÉvolution : 2 défenseurs dans la surface', 'Plots, 1 but, ballons', '11', '40x40',
    `F 40x40
Z 24 8 16 24 blanc surface
G 40 20 0 5
P K 38.5 20 k G
P 2 6 3 h
P 6 12 20 h
P 9 22 16 h
P 11 22 25 h
P 8 18 28 h
B 6
S Le 6 lance le latéral dans le couloir
> Passe longue dans la course du latéral | run 2 22 3; pass 2 .1
> Débordement jusqu'à la ligne, les attaquants démarrent | drib 2 34 4; run 9 30 15; run 11 27 26
> Centre : le 9 au premier poteau, le 11 au second, le 8 en retrait | pass 11 .25; run 9 36 17; run 11 35 24; run 8 27 26
> Reprise du 11 au second poteau | shot 40 21.5`],
  ['finition', 'Duel de frappes 1 contre 1 + gardien', 12, 'Deux colonnes à 25 m du but, départ côte à côte ; le coach lance le ballon devant : celui qui le gagne attaque, l\'autre défend.',
    'Réagir vite au lancer\nProtéger le ballon avec le corps\nFrapper tôt, le gardien sort', 'Plots, 1 but, ballons', '5,8,11', '30x25',
    `F 30x25
G 30 12.5 0 5
P K 28.5 12.5 k G
P C 4 12.5 a Coach
P 1 6 9 h
P X 6 16 a X
B C
S Les deux joueurs côte à côte, le coach a le ballon
> Le coach lance devant : les deux sprintent | pass 1 -.2; run 1 13 12; run X 12 14
> Le bleu gagne le ballon et protège | drib 1 18 11; press X 17 12.5
> Frappe tôt, avant le retour du défenseur | shot 30 11.2; run K 28.6 11.6`],
  ['finition', 'Finition : tirs de loin et suivi', 12, 'Une colonne à 22 m, un ballon chacun. Frappe puis suivi pour le ballon repoussé par le gardien (le coach en relance un).',
    'Frapper du cou-de-pied, buste au-dessus du ballon\nToujours suivre sa frappe\nCadrer avant la puissance', 'Plots, 1 but, ballons', '8,11', '30x25',
    `F 30x25
G 30 12.5 0 5
P K 28.5 12.5 k G
P 1 7 12.5 h
P C 27 22 a Coach
B 1
S Le frappeur à 22 m, le coach sur le côté
> Frappe de loin, le gardien repousse | shot 28 11; run K 28.5 11.5
> Suivi : le frappeur fonce sur le ballon repoussé | run 1 24 12
> Le coach relance un ballon, reprise dans le but | pass 1 .2; shot 30 13.8`],
  ['finition', 'Attaque 3 contre 2 + gardien en continu', 18, 'Zone de 35 × 30 m face au but. 3 attaquants contre 2 défenseurs ; le défenseur qui récupère marque dans un mini-but au milieu.',
    'Jouer vite, avant que le 3e défenseur revienne\nAttaquer l\'espace entre les défenseurs\nFinir en 2 touches', 'Plots, chasubles, 1 but, 1 mini-but', '8,11', '35x30',
    `F 36x30
G 36 15 0 5
G 0 15 180 2
P K 34.5 15 k G
P 1 10 15 h
P 2 12 6 h
P 3 12 24 h
P A1 26 11 a
P A2 26 19 a
B 1
S 3 attaquants contre 2
> Le 1 conduit et fixe le défenseur central | drib 1 20 15; press A1 23 13
> Passe dans la course du 2, entre les défenseurs | run 2 27 9; pass 2 .1
> Frappe en deux touches | drib 2 30 11; shot 36 14`],

  /* ---------------- défense ---------------- */
  ['defense', 'Défense à 4 contre 6 : coulisser', 20, 'Largeur du terrain sur 35 m. 4 défenseurs + gardien contre 6 attaquants qui font circuler. Les défenseurs coulissent du côté du ballon.',
    'Le plus proche sort sur le porteur\nLes autres couvrent derrière lui\nDistances : 8 à 10 m entre défenseurs\nÉvolution : récupération = contre sur 2 mini-buts', 'Plots, chasubles, 1 but', '11', '45x35',
    `F 45x35
G 0 17.5 180 5
P G 1.5 17.5 g G
P 2 12 5 h
P 4 10 14 h
P 5 10 22 h
P 3 12 30 h
P A1 26 4 a
P A2 24 13 a
P A3 24 22 a
P A4 26 31 a
P A5 34 10 a
P A6 34 24 a
B A3
S 4 défenseurs face à 6 attaquants
> Le ballon va à gauche : tout le bloc coulisse | pass A1; run 2 18 6; run 4 13 9; run 5 12 16; run 3 12 23
> Le latéral sort sur le porteur, le central le couvre | press 2 22 5; run 4 14 7
> Passe en retrait : le bloc ressort ensemble | pass A2; press 4 18 12; run 2 16 7; run 5 13 15`],
  ['defense', 'Duel 1 contre 1 défensif en couloir', 12, 'Couloirs de 15 × 8 m. L\'attaquant doit franchir la ligne en conduite ; le défenseur part de la ligne d\'en face.',
    'Freiner à 2 m de l\'attaquant\nPosition de profil, pousser vers l\'extérieur\nNe pas se jeter : attendre l\'erreur', 'Plots, chasubles, ballons', '5,8,11', '15x8',
    `F 16x8
L 0.5 0.5 15.5 0.5 4
L 0.5 7.5 15.5 7.5 4
P 1 1.5 4 h
P X 14.5 4 a X
B 1
S L'attaquant à gauche, le défenseur en face
> Le défenseur sort vite puis freine | press X 9 4; drib 1 5 4
> De profil, il pousse l'attaquant vers le côté | press X 7.5 3.4; drib 1 7 5.6 .2
> L'attaquant touche trop long : récupération | press X 8 6; drib 1 8.5 6.6`],
  ['defense', 'Défendre en infériorité 3 contre 4', 15, 'Zone de 30 × 30 m devant le but. 3 défenseurs + gardien contre 4 attaquants. Les défenseurs protègent l\'axe et retardent.',
    'Retarder plutôt que plonger\nProtéger l\'axe, laisser le côté\nCommunication : un patron qui parle', 'Plots, chasubles, 1 but', '8,11', '30x30',
    `F 30x30
G 0 15 180 5
P G 1.5 15 g G
P 4 9 9 h
P 5 8 15 h
P 2 9 21 h
P A1 22 6 a
P A2 20 13 a
P A3 20 19 a
P A4 22 25 a
B A2
S 3 défenseurs contre 4 attaquants
> Le central sort à demi-distance, les deux autres resserrent | press 5 13 14; run 4 10 12; run 2 10 18
> Passe sur le côté : on laisse, on protège l'axe | pass A4; run 2 10 21; run 5 9 16
> Centre : le gardien sort et capte | pass A3 .2; run G 5 17`],

  /* ---------------- construction ---------------- */
  ['construction', 'Sortie de balle à 3 contre 2 + gardien', 18, 'Tiers défensif de 40 × 45 m : gardien + 3 défenseurs contre 2 attaquants. Objectif : franchir la ligne des 40 m en conduite.',
    'Le gardien est un joueur de plus\nÉcarter les centraux à la largeur de la surface\nJouer à l\'opposé du pressing', 'Plots, chasubles, 1 but', '8,11', '40x45',
    `F 42x45
G 0 22.5 180 5
L 40 1 40 44 6 blanc
P G 1.5 22.5 g G
P 4 9 10 h
P 5 9 35 h
P 6 18 22.5 h
P A1 13 16 a
P A2 13 30 a
B G
S Le gardien a le ballon, les centraux s'écartent
> Passe au 4, l'attaquant sort sur lui | pass 4; press A1 11 12
> Retour au gardien qui renverse vers le 5, libre | pass G; press A1 6 18; pass 5 .2
> Le 5 trouve le 6 qui a décroché | run 6 16 26; pass 6; press A2 14 28
> Le 6 se retourne et franchit la ligne en conduite | drib 6 41 22`],
  ['construction', 'Relance par les côtés : 11 contre 0 par lignes', 15, 'Demi-terrain : le gardien relance, le ballon doit passer par chaque ligne (défense, milieu, attaque) avant de finir dans le but.',
    'Le latéral haut et large\nLe milieu se présente entre les lignes\nJouer vers l\'avant dès que c\'est possible', 'Plots, 2 buts', '11', '60x45',
    `F 60x45
G 0 22.5 180 5
G 60 22.5 0 5
P G 1.5 22.5 g G
P 4 9 15 h
P 5 9 30 h
P 2 18 4 h
P 6 22 22 h
P 8 32 12 h
P 7 42 5 h
P 9 50 22 h
B G
S Les joueurs en place : la relance part du gardien
> Gardien vers le central | pass 4
> Le central donne au latéral haut et large | pass 2 .1
> Le milieu 8 se présente entre les lignes | run 8 30 14; pass 8
> Il déclenche l'ailier dans la profondeur | run 7 50 6; pass 7 .15
> Centre pour le 9 | pass 9 .2; shot 60 21`],

  /* ---------------- coups de pied arrêtés ---------------- */
  ['cpa', 'Corner rentrant : premier poteau', 12, 'Corner côté droit : 1 tireur, 1 joueur au premier poteau, 2 en mouvement vers le point de penalty, 1 au second poteau, 1 en retrait.',
    'Le tireur annonce le code (bras levé)\nAppels retardés : partir au moment de la frappe\nUn joueur sur le gardien', 'Plots, 1 but, ballons', '8,11', '30x40',
    `F 30x40
Z 14 4 16 32 blanc surface
G 30 20 0 5
P K 28.5 20 k G
P 7 29.5 39.5 h
P 9 25 30 h
P 4 19 26 h
P 5 18 14 h
P 11 26 10 h
P 8 10 24 h
B 7
S Corner à droite : chacun sa zone
> Appels retardés au moment de la frappe | run 9 27 25; run 4 25 22; run 5 24 17; run 11 28 14
> Ballon rentrant au premier poteau | pass 9 .3
> Déviation de la tête vers le second poteau | pass 5 -.1
> Le 5 reprend au point de penalty | shot 30 18.5`],
  ['cpa', 'Coup franc : le mur et le décalage', 10, 'Coup franc à 22 m, mur de 4 adversaires. Variante : passe courte latérale et frappe du 2e tireur.',
    'Deux tireurs au ballon pour cacher l\'intention\nLe décalage court, frappe du pied fort\nUn joueur pour le ballon repoussé', 'Plots (mur), 1 but, ballons', '11', '30x30',
    `F 30x30
Z 16 7 14 16 blanc surface
G 30 15 0 5
P K 28.5 15 k G
P A1 17 13 a
P A2 17 14 a
P A3 17 15 a
P A4 17 16 a
P 10 8 15 h
P 7 8 17 h
P 9 23 10 h
B 10
S Coup franc à 22 m, mur de 4
> Le 10 décale court vers le 7 | pass 7 .1
> Le 7 frappe à côté du mur | shot 30 18; run K 28.8 17.5
> Le 9 suit pour le ballon repoussé | run 9 27 17`],

  /* ---------------- physique ---------------- */
  ['physique', 'Vitesse : départs variés sur 15 m', 10, 'Couloirs de 15 m, départs au signal : assis, dos, à genoux, après un demi-tour. 6 à 8 sprints, récupération complète.',
    'Premiers appuis courts et rapides\nPousser fort, buste penché\nRécupérer 1 minute entre deux sprints', 'Plots, coupelles', '8,11', '20x12',
    `F 20x12
L 2 1 2 11 4 blanc
L 17 1 17 11 4 rouge
P 1 1.5 2.5 h
P 2 1.5 6 h
P 3 1.5 9.5 h
S Trois joueurs assis au départ
> Signal : départ explosif | run 1 9 2.5; run 2 8 6; run 3 9 9.5
> Sprint à fond jusqu'à la ligne rouge | run 1 17.5 2.5; run 2 17.5 6; run 3 17.5 9.5`],
  ['physique', 'Intermittent 15-15 avec ballon', 15, 'Boucle de 60 m : 15 s de conduite rapide, 15 s de récupération en trottinant. 2 séries de 6 min, 3 min de récupération.',
    'Respecter les distances données (selon la VMA)\nBallon toujours près du pied\nRécupération active : trottiner', 'Plots, ballons, chrono', '11', '40x25',
    `F 40x25
L 4 4 36 4 5
L 4 21 36 21 5
C 36 12.5 bleu
P 1 4 6 h
P 2 4 19 h
B 1
S Départ de la boucle, ballon au pied
> 15 s : conduite rapide sur la ligne haute | drib 1 34 6; run 2 34 19
> Virage et retour au trot (récupération) | drib 1 36 12 .3; run 2 36 14`],
  ['physique', 'Circuit puissance-vitesse avec ballon', 15, '4 ateliers de 30 s : haies basses, sprint de 10 m, frappe, retour en conduite. 30 s de récupération entre deux ateliers.',
    'Qualité avant la vitesse\nPieds actifs sur les haies\nFrapper fort en fin d\'atelier', 'Haies basses, plots, 1 but, ballons', '11', '40x20',
    `F 40x20
Z 3 4 10 4 jaune haies
L 16 6 26 6 2 bleu
G 40 10 0 5
P 1 1.5 6 h
P 2 1.5 14 h
B 2
S Atelier 1 : haies ; atelier 2 : sprint ; atelier 3 : frappe
> Haies : appuis rapides, genoux hauts | run 1 13 6
> Sprint de 10 m | run 1 26 6
> L'autre joueur enchaîne conduite et frappe | drib 2 30 12; shot 40 9`],

  /* ---------------- gardien ---------------- */
  ['gardien', 'Gardien : plongeons et relevés', 15, 'Deux plots-lanceurs à 8 m. Le coach frappe alternativement à droite et à gauche, le gardien plonge, se relève et repart.',
    'Pas chassés avant le plongeon\nMains en avant, ballon devant le corps\nSe relever vite pour le 2e ballon', 'Plots, 1 but, ballons', '5,8,11', '20x16',
    `F 20x16
G 20 8 0 5
P G 18.5 8 g G
P C 10 8 a Coach
P A 10 4 a
B C
S Le gardien face au coach
> Frappe à ras de terre côté droit : plongeon | shot 20 10.2; run G 18.8 10
> Le gardien se relève, le 2e lanceur frappe à gauche | run G 18.6 8; pass A; shot 20 5.8; run G 18.9 6`],
  ['gardien', 'Gardien : sorties sur centres', 15, 'Centres des deux côtés, d\'abord sans attaquant, puis avec un attaquant passif, puis actif.',
    'Appeler « gardien ! » fort\nPrendre le ballon au point le plus haut\nGenou de protection', 'Ballons, 1 but', '8,11', '30x40',
    `F 30x40
Z 14 4 16 32 blanc surface
G 30 20 0 5
P G 28.5 20 g G
P 7 22 2 h
P 9 22 22 a
B 7
S Le centreur sur le côté, un attaquant au point de penalty
> Centre au second poteau | pass 9 .3
> Le gardien sort et capte au point le plus haut | run G 23.5 20.5`],

  /* ---------------- jeu ---------------- */
  ['jeu', 'Jeu à 4 portes', 15, 'Terrain de 30 × 25 m, 2 portes de 3 m sur chaque ligne de fond. On marque en traversant une porte en conduite.',
    'Regarder la porte libre\nChanger de côté quand une porte est fermée\nDéfendre les deux portes', 'Plots, chasubles', '5,8,11', '30x25',
    `F 30x25
C 29.5 4
C 29.5 7
C 29.5 18
C 29.5 21
C 0.5 4
C 0.5 7
C 0.5 18
C 0.5 21
P 1 8 12 h
P 2 12 5 h
P 3 12 20 h
P A1 20 7 a
P A2 20 18 a
P A3 16 12 a
B 1
S On attaque les portes de droite
> Les blancs ferment la porte du haut | pass 2; press A1 21 6; press A3 15 8
> Changement de côté vers le 3 | pass 3 .2; press A2 22 19
> Le 3 traverse la porte du bas en conduite | drib 3 29.8 19.5 -.2`],
  ['jeu', 'Match à thème 7 contre 7 : but après 5 passes', 20, 'Terrain de 50 × 35 m, 2 buts + gardiens. Un but compte seulement après 5 passes dans le camp adverse.',
    'Patience dans la circulation\nAttaquer quand le défenseur est attiré\nLe thème de la séance appliqué en match', 'Plots, chasubles, 2 buts', '8,11', '50x35',
    `F 50x35
G 0 17.5 180 5
G 50 17.5 0 5
P G 1.5 17.5 g G
P K 48.5 17.5 k G
P 2 14 6 h
P 4 12 17.5 h
P 3 14 29 h
P 6 22 17.5 h
P 7 30 7 h
P 9 36 17.5 h
P A1 32 12 a
P A2 32 23 a
P A3 25 9 a
P A4 25 26 a
P A5 40 17.5 a
B 4
S 7 contre 7 : 5 passes avant de marquer
> 1-2 : circulation derrière | pass 2; pass 6 .1; pb
> 3-4 : le 6 trouve le 7 qui donne au 9 en appui | pass 7; pass 9; pb
> 5 : remise du 9 pour le 6 qui arrive, frappe | run 6 34 15; pass 6 .1; shot 50 16.5`],
  ['jeu', 'Jeu réduit 3 zones : supériorité au milieu', 20, 'Terrain de 54 × 36 m en 3 zones. Dans chaque zone : 2 contre 1 en défense, 2 contre 2 au milieu, 1 contre 2 en attaque. Passer zone par zone.',
    'Jouer vers l\'avant dès que possible\nLe joueur libre de la zone appelle\nUn joueur peut monter dans la zone suivante avec le ballon', 'Plots, chasubles, 2 buts', '8,11', '54x36',
    `F 54x36
Z 0 0 18 36 bleu défense
Z 36 0 18 36 rouge attaque
G 0 18 180 5
G 54 18 0 5
P G 1.5 18 g G
P K 52.5 18 k G
P 4 9 10 h
P 5 9 26 h
P 6 24 12 h
P 8 30 24 h
P 9 44 18 h
P A1 14 18 a
P A2 26 18 a
P A3 32 10 a
P A4 42 12 a
P A5 42 25 a
B G
S Trois zones : on passe zone par zone
> Gardien vers le 5, libre en défense | pass 5; press A1 12 22
> Le 5 trouve le 8 au milieu | pass 8 .1; press A2 28 21
> Le 8 monte avec le ballon dans la zone d'attaque : 2 contre 2 | drib 8 40 24; run 9 46 14
> Une-deux avec le 9 et frappe | pass 9; run 8 47 22; pass 8 .1; shot 54 19`],
  ['jeu', 'Petit match 4 contre 4 sur mini-buts', 15, 'Terrain de 25 × 20 m, 2 mini-buts par équipe. Beaucoup de ballons touchés, pas de gardien.',
    'Chacun attaque et défend\nPasser à celui qui est libre\nFrapper dès que c\'est possible', 'Plots, chasubles, 4 mini-buts', '5,8', '25x20',
    `F 26x20
G 0 5 180 2
G 0 15 180 2
G 26 5 0 2
G 26 15 0 2
P 1 6 7 h
P 2 6 14 h
P 3 11 10 h
P 4 16 5 h
P A1 19 9 a
P A2 19 15 a
P A3 13 5 a
P A4 9 15 a
B 3
S 4 contre 4, 2 mini-buts de chaque côté
> Le 3 conduit et attire un blanc | drib 3 14 11; press A1 16 11
> Passe au 4 démarqué | pass 4
> Frappe dans le mini-but | drib 4 21 5; shot 26 5.3`],


  /* ---------------- (2.30, 2e série) ---------------- */
  ['echauffement', 'Échauffement : la passe en triangle avec appel', 12, 'Triangle de 10 m, 3 plots, 4 joueurs. Passe, puis appel dans le dos du plot pour recevoir de nouveau.',
    'Appel en courbe pour ouvrir l\'angle\nPasse dans la course\nRegarder avant de recevoir', 'Plots, ballons', '8,11', '14x12',
    `F 14x12
C 7 1.5
C 12.5 10.5
C 1.5 10.5
P 1 1.5 11.3 h
P 4 0.6 10.2 h
P 2 7 2.2 h
P 3 12.5 9.7 h
B 1
S Un joueur à chaque plot, le 1 a le ballon
> Passe au 2 qui descend au-devant | run 2 7 3.5; pass 2
> Le 1 fait un appel en courbe, le 2 joue dans sa course | run 1 9.5 5 .3; pass 1 .1
> Le 1 donne au 3 et prend la place du 2 | pass 3; run 1 7 2.2; run 2 12.5 10.5`],
  ['echauffement', 'Rondo en couloir 3 contre 1 avec changement de zone', 10, 'Deux zones de 8 × 8 m. 3 contre 1 dans la zone 1 ; après 4 passes, passe dans la zone 2 où un 2e défenseur attend.',
    'Une touche pour le receveur libre\nCorps orienté vers l\'autre zone\nLe défenseur suit le ballon', 'Plots, chasubles', '8,11', '18x9',
    `F 18x9
Z 0.5 0.5 8 8 bleu zone 1
Z 9.5 0.5 8 8 jaune zone 2
P 1 1 4.5 h
P 2 4.5 1 h
P 3 4.5 8 h
P X 4.5 4.5 a X
P Y 13.5 4.5 a Y
P 4 17 4.5 h
B 1
S 3 contre 1 dans la zone bleue
> Passe au 2, le défenseur ferme | pass 2; press X 4.5 3
> Le 2 trouve le 3, libre | pass 3 .2; press X 4.5 6.5
> 4e passe : vers la zone jaune, les 3 suivent | pass 4 .1; run 1 10 4.5; run 2 13.5 1; run 3 13.5 8; run X 12 4.5`],
  ['technique', 'Contrôle-passe en carré à 2 ballons', 12, 'Carré de 12 m, un joueur par coin + 2 au départ, 2 ballons en même temps sur deux coins opposés.',
    'Contrôle orienté vers le joueur suivant\nPasse au pied opposé du receveur\nRegarder l\'autre ballon pour ne pas se gêner', 'Plots, 2 ballons', '8,11', '14x14',
    `F 14x14
C 1 1
C 13 1
C 13 13
C 1 13
P 1 1.6 1.6 h
P 2 12.4 1.6 h
P 3 12.4 12.4 h
P 4 1.6 12.4 h
B 1
S Un joueur par coin, deux ballons opposés
> Le 1 passe au 2 et suit | pass 2; run 1 11.5 1.6
> Contrôle orienté du 2 vers le bas, passe au 3 | drib 2 12.4 3.5; pass 3; run 2 12.4 11
> Le 3 joue le 4 en une touche | pass 4 .1; run 3 2.5 12.4`],
  ['technique', 'Les relais conduite-passe (enfants)', 10, 'Équipes de 4 en colonne. Conduite jusqu\'au plot à 12 m, demi-tour, passe au suivant depuis la ligne.',
    'Petites touches, ballon près du pied\nDemi-tour avec la semelle\nPasse au sol dans les pieds', 'Plots, ballons', '5,8', '16x10',
    `F 16x10
C 13 3 bleu
C 13 7 rouge
L 2 1 2 9 3 blanc
P 1 1.5 3 h
P 2 0.5 3 h
P A1 1.5 7 a
P A2 0.5 7 a
B 1
S Deux équipes en colonne
> Conduite jusqu'au plot | drib 1 12.5 3.2; run A1 12.5 7
> Demi-tour avec la semelle et retour | drib 1 5 3 .2; run A1 5 7
> Passe au suivant depuis la ligne | pass 2; run 1 0.8 4`],
  ['technique', 'Contrôles aériens par 3', 10, 'Par 3 en ligne sur 15 m. Le joueur du bout lance en l\'air, celui du milieu contrôle (pied, cuisse, poitrine) et passe à l\'autre bout.',
    'Se placer sous la trajectoire\nAmortir en reculant la surface de contact\nPasse au sol après le contrôle', 'Ballons', '8,11', '16x6',
    `F 16x6
P 1 1.5 3 h
P 2 8 3 h
P 3 14.5 3 h
B 1
S Par 3 en ligne
> Le 1 lance en cloche | pass 2 -.4
> Contrôle de la poitrine, passe au sol au 3 | drib 2 8.8 3; pass 3
> Le 3 relance en cloche, le 2 se retourne | pass 2 .4; run 2 8 3`],
  ['conservation', 'Conservation 3 contre 3 + 3 (trois équipes)', 15, 'Carré de 20 × 20 m, 3 équipes de 3. Deux équipes ensemble contre la 3e ; l\'équipe qui perd le ballon devient défenseur.',
    'Six joueurs contre trois : jouer simple\nÉcarter le jeu, utiliser la largeur\nÀ la perte, presser tout de suite', 'Plots, chasubles 3 couleurs', '8,11', '20x20',
    `F 20x20
C 0.5 0.5
C 19.5 0.5
C 19.5 19.5
C 0.5 19.5
P 1 3 3 h
P 2 17 3 h
P 3 10 10 h
P 4 3 17 j
P 5 17 17 j
P 6 10 1 j
P A1 8 6 a
P A2 12 8 a
P A3 9 13 a
B 1
S Bleus + jaunes (6) contre blancs (3)
> Passe au 6 qui s'écarte, les blancs serrent | pass 6; pb
> Le 6 renverse vers le 2 | pass 2 .1; pb
> Le 2 cherche le 5 dans la profondeur | pass 5; pb`],
  ['conservation', 'Rondo 5 contre 2 avec porte de sortie', 12, 'Carré de 12 × 12 m, 5 contre 2. Une porte de 2 m au milieu de chaque côté : une passe à travers la porte = 1 point.',
    'Attirer les deux défenseurs d\'un côté\nRenverser vers la porte libre\nDeux touches', 'Plots, chasubles', '8,11', '14x14',
    `F 14x14
C 6 0.5
C 8 0.5
C 6 13.5
C 8 13.5
C 0.5 6
C 0.5 8
C 13.5 6
C 13.5 8
P 1 2 2 h
P 2 12 2 h
P 3 12 12 h
P 4 2 12 h
P 5 7 7 h
P X 5 5 a X
P Y 8 4 a Y
B 1
S 5 contre 2, une porte sur chaque côté
> Passe au 2 : les défenseurs basculent | pass 2; press Y 10.5 3; press X 8 4.5
> Le 2 trouve le 5 au centre | pass 5; press X 7 6
> Le 5 joue à travers la porte vers le 3 : point ! | pass 3 .1`],
  ['pressing', 'Pressing en infériorité 2 contre 3 en couloir', 12, 'Couloir de 30 × 15 m. 3 attaquants doivent franchir la ligne en conduite ; 2 défenseurs pressent pour ralentir et récupérer.',
    'Le premier presse, le second couvre en biais\nOrienter vers la ligne de touche\nGagner du temps pour le retour d\'un 3e', 'Plots, chasubles', '8,11', '30x15',
    `F 30x15
L 29.5 0.5 29.5 14.5 4 blanc
P A1 4 3 a
P A2 4 7.5 a
P A3 4 12 a
P 1 18 6 h
P 2 22 9 h
B A2
S 3 attaquants contre 2 défenseurs
> Le premier sort sur le porteur, le second couvre | drib A2 9 7.5; press 1 12 7; run 2 17 9
> Le porteur joue à droite : on bascule ensemble | pass A3; press 2 13 11; run 1 15 8
> Pressé contre la ligne, l'attaquant perd le ballon | drib A3 13 13.5; press 2 13.5 13`],
  ['pressing', 'Le déclencheur : presser sur la passe en retrait', 15, 'Terrain de 40 × 30 m, 6 contre 6. On ne presse haut que sur une passe en arrière de l\'adversaire (signal).',
    'Tout le bloc monte sur la passe en retrait\nCouper la passe vers l\'axe\nLe dernier défenseur monte aussi', 'Plots, chasubles, 2 buts', '8,11', '40x30',
    `F 40x30
G 0 15 180 3
G 40 15 0 3
P A1 6 10 a
P A2 6 20 a
P A3 14 15 a
P A4 20 6 a
P 9 24 15 h
P 7 28 6 h
P 11 28 24 h
P 6 32 15 h
B A4
S Les blancs ont le ballon, nous attendons le signal
> Passe en retrait vers le central : signal ! | pass A1; run 9 12 12; run 7 18 5; run 11 18 22; run 6 24 15
> Tout le bloc monte, le 9 ferme l'axe | press 9 8 11; press 7 12 6; run 11 14 18
> Récupération haute du 9 et frappe | press 9 6.5 10; shot 0 14`],
  ['transitions', 'Transition défense-attaque sur 3 zones', 18, 'Terrain de 54 × 35 m en 3 zones. 4 défenseurs bleus récupèrent dans la zone 1 et doivent lancer les 2 attaquants dans la zone 3 en moins de 3 passes.',
    'Première passe vers l\'avant\nLes attaquants proposent des appels en profondeur\nMoins de 3 passes pour atteindre la zone 3', 'Plots, chasubles, 2 buts', '11', '54x35',
    `F 54x35
Z 0 0 18 35 bleu zone 1
Z 36 0 18 35 rouge zone 3
G 0 17.5 180 5
G 54 17.5 0 5
P G 1.5 17.5 g G
P K 52.5 17.5 k G
P 4 8 10 h
P 5 8 25 h
P 6 15 17.5 h
P 9 38 14 h
P 11 38 24 h
P A1 13 12 a
P A2 13 22 a
P A3 42 18 a
B A1
S Les blancs attaquent dans notre zone
> Le 6 intercepte | pass 6; press 6 13.5 14
> Passe verticale vers le 9 qui décroche | run 9 34 14; pass 9 .1
> Le 9 lance le 11 dans la profondeur | run 11 46 26; pass 11 .15
> Frappe | shot 54 18.5`],
  ['finition', 'Finition après conduite et crochet', 12, 'Une colonne à 30 m du but, un mannequin (ou plot) à 18 m. Conduite, crochet devant le plot, frappe.',
    'Accélérer avant le plot\nCrochet du pied fort vers le pied faible\nFrapper vite après le crochet', 'Plots, 1 but, ballons', '8,11', '30x25',
    `F 32x25
G 32 12.5 0 5
P K 30.5 12.5 k G
C 18 12.5 rouge
P 1 4 12.5 h
P 2 3 14 h
B 1
S Le joueur en conduite, un plot rouge à 18 m
> Conduite rapide vers le plot | drib 1 16 12.5
> Crochet vers l'intérieur | drib 1 19 15 .3
> Frappe du pied fort | shot 32 11.2; run K 30.7 11.6`],
  ['finition', 'Le jeu des quatre frappes (enfants)', 10, '4 plots de départ autour de la surface, un ballon à chaque plot. Le joueur frappe les 4 ballons à la suite, le plus vite possible.',
    'Regarder le but avant de frapper\nFrapper avec l\'intérieur pour cadrer\nCourir d\'un ballon à l\'autre', 'Plots, 1 but, 4 ballons', '5,8', '20x16',
    `F 22x16
G 22 8 0 3
P K 21 8 k G
C 12 3
C 10 8
C 12 13
C 16 8
P 1 8 3 h
B 1
S Un ballon sur chaque plot
> Frappe du premier ballon | drib 1 12 3.2; shot 22 7
> Course vers le 2e ballon | run 1 10 8.2
> Et le 3e | run 1 12 12.6`],
  ['defense', 'Défense de la surface sur centres 3 contre 3', 15, 'Surface + couloirs latéraux. Un centreur de chaque côté ; 3 défenseurs + gardien contre 3 attaquants dans la surface.',
    'Voir le ballon ET l\'attaquant\nLe défenseur du premier poteau attaque le ballon\nDégager loin et sur le côté', 'Plots, chasubles, 1 but, ballons', '11', '40x40',
    `F 40x40
Z 24 8 16 24 blanc surface
G 40 20 0 5
P G 38.5 20 g G
P 4 34 15 h
P 5 33 22 h
P 2 32 28 h
P A1 26 16 a
P A2 27 23 a
P A3 22 28 a
P C 22 2 a
B C
S Le centreur à gauche, 3 contre 3 dans la surface
> Les défenseurs se placent entre l'attaquant et le but | run 4 35 17; run 5 34 23; run 2 33 27
> Centre : les attaquants attaquent les poteaux | pass A1 .2; run A1 34 18; run A2 33 24
> Le 4 attaque le ballon de la tête et dégage sur le côté | press 4 34.5 17.5; shot 30 40`],
  ['defense', 'Le 2 contre 2 : presser et couvrir', 12, 'Zone de 20 × 15 m, 2 attaquants contre 2 défenseurs, un mini-but à défendre. Le premier presse, le deuxième couvre.',
    'Distance de couverture : 3-4 m derrière\nEn biais pour couper la passe\nInverser les rôles si le ballon change de côté', 'Plots, chasubles, 1 mini-but', '8,11', '20x15',
    `F 20x15
G 0 7.5 180 2
P A1 16 4 a
P A2 16 11 a
P 1 9 5 h
P 2 6 9 h
B A1
S 2 attaquants contre 2 défenseurs
> Le 1 presse le porteur, le 2 couvre en biais | press 1 13 4.5; run 2 9 7
> Passe vers l'autre attaquant : les rôles s'inversent | pass A2; press 2 12 10; run 1 8 7
> Le 2 récupère le ballon | press 2 14 10.8`],
  ['construction', 'Jeu court du gardien : triangles de relance', 15, 'Zone de 35 × 30 m : gardien + 2 centraux + 1 milieu contre 2 attaquants. Le milieu se place dans le triangle libre.',
    'Le milieu décroche dans l\'intervalle\nLe gardien joue vers le côté libre\nPremière touche orientée vers l\'avant', 'Plots, chasubles, 1 but', '8,11', '35x30',
    `F 36x30
G 0 15 180 5
L 35 1 35 29 5 blanc
P G 1.5 15 g G
P 4 8 7 h
P 5 8 23 h
P 6 17 15 h
P A1 11 11 a
P A2 13 19 a
B G
S Gardien, 2 centraux, 1 milieu contre 2 attaquants
> Le milieu décroche dans l'intervalle libre | run 6 13 15
> Le gardien joue le 4, l'attaquant sort | pass 4; press A1 9 9
> Le 4 trouve le 6 entre les deux attaquants | pass 6; press A2 12 17
> Le 6 se retourne et sort en conduite | drib 6 35.5 13`],
  ['construction', 'Renversement de jeu 6 contre 4 sur largeur', 15, 'Terrain de 50 × 35 m, 2 mini-buts par côté de largeur. 6 bleus contre 4 : marquer après un changement de côté.',
    'Attirer d\'un côté, jouer de l\'autre\nPasse longue tendue à ras de terre ou en l\'air\nLe joueur côté opposé reste large', 'Plots, chasubles, 4 mini-buts', '11', '50x35',
    `F 50x35
G 50 5 0 2
G 50 30 0 2
P 4 10 10 h
P 5 10 25 h
P 2 20 3 h
P 3 20 32 h
P 6 22 17.5 h
P 8 32 12 h
P A1 22 8 a
P A2 24 14 a
P A3 30 7 a
P A4 34 15 a
B 2
S Les bleus jouent côté haut, les blancs s'y regroupent
> Circulation courte côté haut | pass 4; pass 6; pb
> Le 6 renverse vers le 3, resté large | pass 3 .2; pb
> Le 3 conduit et frappe dans le mini-but | drib 3 42 30; shot 50 30.2`],
  ['cpa', 'Corner sortant : le deuxième ballon', 12, 'Corner côté gauche, frappé vers le point de penalty. Deux joueurs en retrait à 20 m pour le deuxième ballon.',
    'Le tireur vise la zone, pas un joueur\nAttaquer le ballon, pas l\'attendre\nLes joueurs en retrait frappent sans contrôle', 'Plots, 1 but, ballons', '8,11', '30x40',
    `F 30x40
Z 14 4 16 32 blanc surface
G 30 20 0 5
P K 28.5 20 k G
P 11 29.5 0.5 h
P 9 23 14 h
P 5 22 22 h
P 4 20 26 h
P 8 9 18 h
P 6 9 26 h
B 11
S Corner à gauche, 2 joueurs en retrait
> Corner sortant vers le point de penalty | pass 5 .3; run 5 24 20
> La tête est repoussée au deuxième ballon | pass 8 -.1; run 9 26 16
> Frappe sans contrôle du 8 | shot 30 19`],
  ['cpa', 'Touche longue et déviation', 10, 'Touche longue côté droit vers le premier poteau ; un joueur dévie de la tête, deux attaquent le second poteau.',
    'Lanceur : prise d\'élan, ballon tendu\nLe dévieur attaque le ballon devant son défenseur\nAppels retardés au second poteau', 'Plots, 1 but, ballons', '11', '30x40',
    `F 30x40
Z 14 4 16 32 blanc surface
G 30 20 0 5
P K 28.5 20 k G
P 2 22 39.5 h
P 9 24 26 h
P 11 20 20 h
P 7 18 14 h
B 2
S Touche longue à droite
> Touche tendue vers le premier poteau | pass 9 .2; run 9 26 25
> Déviation de la tête vers le second poteau | pass 7 -.1; run 7 27 16; run 11 25 18
> Reprise du 7 | shot 30 18.5`],
  ['physique', 'Fractionné 30-30 en navette', 15, 'Navette de 2 plots, distance selon la VMA (ex : 15 km/h = 62 m en 30 s, aller-retour sur 31 m). 2 séries de 8 min.',
    '30 s de course à la vitesse donnée, 30 s de récupération sur place\nRegarder le chrono\nGroupes de même VMA', 'Plots, chrono', '11', '35x15',
    `F 35x15
L 2 2 2 13 3 blanc
L 33 2 33 13 3 rouge
P 1 1.5 4 h
P 2 1.5 8 h
P 3 1.5 12 h
S Groupes au départ, distance selon la VMA
> 30 s : aller jusqu'au plot rouge | run 1 33 4; run 2 31 8; run 3 29 12
> Retour au point de départ | run 1 2 4; run 2 4 8; run 3 6 12`],
  ['physique', 'Agilité : le slalom en étoile', 10, '5 plots en étoile autour d\'un plot central à 5 m. Le joueur touche chaque plot en revenant au centre, le plus vite possible.',
    'Appuis courts dans les changements de direction\nCentre de gravité bas\nRegarder le plot suivant', 'Plots', '5,8,11', '12x12',
    `F 12x12
C 6 6 rouge
C 6 1
C 11 4.5
C 9.5 10.5
C 2.5 10.5
C 1 4.5
P 1 6 6.6 h
S Le joueur au centre de l'étoile
> Aller au plot du haut et revenir | run 1 6 1.6; run 1 6 6
> Plot de droite | run 1 10.4 4.7
> Retour au centre, puis plot en bas à droite | run 1 6 6.2; run 1 9.2 10`],
  ['gardien', 'Gardien : jeu au pied sous pression', 12, 'Passes en retrait du défenseur, un attaquant presse. Le gardien relance vers l\'une des deux cibles (plots) à 25 m.',
    'Regarder avant de recevoir\nContrôle orienté vers le côté libre\nRelance tendue vers la cible ouverte', 'Plots, 1 but, ballons', '8,11', '30x30',
    `F 30x30
G 0 15 180 5
P G 1.5 15 g G
P 4 12 9 h
P A 16 15 a
C 26 5 bleu
C 26 25 bleu
P 7 27 5 h
P 3 27 25 h
B 4
S Le défenseur joue en retrait, l'attaquant va presser
> Passe en retrait, l'attaquant sort sur le gardien | pass G; press A 6 13
> Contrôle orienté vers le côté libre | run G 3 18
> Relance vers la cible du bas | pass 3 .1`],
  ['gardien', 'Gardien : 1 contre 1 face à l\'attaquant', 12, 'L\'attaquant part de 25 m en conduite ; le gardien sort pour réduire l\'angle et se coucher au bon moment.',
    'Sortir vite quand le ballon est loin du pied\nRéduire l\'angle, rester sur ses appuis\nSe coucher côté ballon', 'Plots, 1 but, ballons', '8,11', '25x20',
    `F 26x20
G 26 10 0 5
P G 24.5 10 g G
P 1 3 8 a
B 1
S L'attaquant part de 25 m
> Conduite : le gardien sort quand le ballon s'éloigne du pied | drib 1 12 9; run G 20 9.5
> Le gardien réduit l'angle, l'attaquant tente le crochet | drib 1 15 11 .2; run G 18 10.5
> Le gardien se couche côté ballon et capte | run G 16.5 11`],
  ['jeu', 'Le jeu des 3 couleurs (enfants)', 12, 'Terrain de 25 × 20 m, 3 équipes de 3. Deux équipes jouent, la 3e attend derrière le but ; l\'équipe qui encaisse sort.',
    'Jouer vite pour rester sur le terrain\nTout le monde défend\nEncourager les copains', 'Plots, chasubles 3 couleurs, 2 mini-buts', '5,8', '25x20',
    `F 26x20
G 0 10 180 2
G 26 10 0 2
P 1 8 6 h
P 2 8 14 h
P 3 12 10 h
P A1 18 7 a
P A2 18 13 a
P A3 15 10 a
P J1 2 2 j
P J2 2 18 j
P J3 4 10 j
B 3
S Bleus contre blancs, les jaunes attendent
> Le 3 combine avec le 1 | pass 1; run 3 16 9; pass 3 .1; pb
> But ! les blancs sortent, les jaunes entrent | shot 26 9.8; run J1 9 5; run J2 9 15; run J3 12 10`],
  ['jeu', 'Match à thème : la zone de vérité', 20, 'Terrain de 60 × 40 m, 8 contre 8. Une zone de 15 m devant chaque but : on ne peut y entrer qu\'à 2 attaquants maximum.',
    'Créer le surnombre avant la zone\nUn appel dans la zone au bon moment\nFinir en 2 touches dans la zone', 'Plots, chasubles, 2 buts', '11', '60x40',
    `F 60x40
Z 45 0 15 40 rouge zone de vérité
Z 0 0 15 40 bleu
G 0 20 180 5
G 60 20 0 5
P G 1.5 20 g G
P K 58.5 20 k G
P 6 20 20 h
P 8 30 12 h
P 10 32 26 h
P 9 44 18 h
P 7 40 6 h
P A1 50 14 a
P A2 50 26 a
P A3 36 18 a
B 6
S 8 contre 8 : seulement 2 attaquants dans la zone rouge
> Le 6 trouve le 10 entre les lignes | pass 10; pb
> Le 9 entre dans la zone, le 10 joue dans sa course | run 9 50 20; pass 9 .1
> Frappe en deux touches | shot 60 18.5`],

  /* ---------------- retour au calme ---------------- */
  ['calme', 'Retour au calme : jonglage et étirements', 8, 'Chacun son ballon : 2 minutes de jonglage libre, puis étirements en cercle (mollets, ischios, quadriceps, adducteurs), 20 s chacun.',
    'Respirer lentement\nPas d\'à-coups dans les étirements\nLe coach fait le bilan de la séance', 'Ballons', '5,8,11', '15x15',
    `F 16x16
P C 8 8 a Coach
P 1 8 2 h
P 2 13 5 h
P 3 13 11 h
P 4 8 14 h
P 5 3 11 h
P 6 3 5 h
S En cercle autour du coach
> Étirements, puis le mot du coach | run 1 8 4; run 2 11.5 6; run 3 11.5 10; run 4 8 12; run 5 4.5 10; run 6 4.5 6`],
];
