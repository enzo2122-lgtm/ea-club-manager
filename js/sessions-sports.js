/* The library of sessions by game system — basket, handball, rugby, volley (written for the app, no copy of any website).
   Same shape as SESSIONS_FOOT: { sys, fmt, title, goal, ex: [[theme, title, minutes, organisation, consignes « | », matériel, size]] }. */
const SESSIONS_SPORTS = {
  basket: [
    { sys: 'Défense homme à homme', fmt: 'b5', title: 'Défendre chacun son joueur, aider ensemble', goal: 'Pression sur le porteur, aide côté opposé, se replacer.', ex: [
      ['defense', 'Position de défense sur le porteur', 12, '1 contre 1 sur demi-terrain : le défenseur empêche le dribble vers le panier.', 'Entre son joueur et le panier|Bras actifs, fléchi|Pas glissés', 'Ballons', ''],
      ['defense', 'Aide et reprise à 4 contre 4', 18, '4 contre 4 sur demi-terrain : les attaquants font tourner le ballon, la défense se place selon le ballon (aide côté opposé).', 'Voir le ballon et son joueur|Aider sur la pénétration puis revenir|Se parler', 'Chasubles, ballons', ''],
      ['jeu', 'Match 5 contre 5 : défense forte', 20, 'Match normal. Une interception ou un passage en force provoqué vaut 2 points.', 'Défense agressive sur le porteur|Rebond défensif', 'Chasubles', '']] },
    { sys: 'Zone 2-3', fmt: 'b5', title: 'Défense de zone 2-3', goal: 'Deux devant, trois derrière : protéger la raquette et coulisser vers le ballon.', ex: [
      ['defense', 'Coulissement de la zone 2-3 sans ballon', 10, 'Les 5 défenseurs en zone 2-3, le coach déplace le ballon entre 5 positions : la zone glisse.', 'Le plus proche sort sur le ballon|Les intérieurs protègent la raquette|Mains hautes', 'Ballon', ''],
      ['defense', 'Zone 2-3 contre 5 attaquants', 18, 'Demi-terrain : la zone contre une attaque qui fait circuler. 3 arrêts défensifs d\'affilée = changement.', 'Fermer les passes vers le poste bas|Sortir sur les tireurs à 3 points|Rebond défensif', 'Chasubles, ballons', ''],
      ['jeu', 'Match avec zone obligatoire', 20, 'Match normal : chaque équipe défend en zone 2-3.', 'Communication|Rebond', 'Chasubles', '']] },
    { sys: 'Attaque contre zone', fmt: 'b5', title: 'Attaquer une défense de zone', goal: 'Se placer dans les trous de la zone, faire circuler vite, tirer à 3 points ou trouver le poste haut.', ex: [
      ['attaque', 'Circulation contre zone 1-3-1', 15, '5 attaquants contre une zone 1-3-1 : passes rapides pour trouver un tireur seul.', 'Se placer entre deux défenseurs|Passer vite, sans dribble inutile|Le poste haut est la clé', 'Chasubles, ballons', ''],
      ['tir', 'Tirs après circulation', 12, 'Trois passes autour de la ligne à 3 points puis tir du joueur seul.', 'Pieds prêts avant de recevoir|Tirer dans le rythme', 'Ballons', ''],
      ['jeu', 'Match : zone contre attaque', 20, 'Une équipe en zone, l\'autre attaque : un panier à 3 points vaut 4 points.', 'Patience|Rebond offensif', 'Chasubles', '']] },
    { sys: 'Pick and roll', fmt: 'b5', title: 'Le jeu à deux : écran porteur', goal: 'Bien poser et utiliser l\'écran, lire la défense (tir, pénétration, passe au poseur).', ex: [
      ['attaque', 'Pick and roll à 2 contre 2', 15, 'Le meneur à 45°, le pivot vient poser l\'écran : 2 contre 2 jusqu\'au panier.', 'Écran immobile, pieds écartés|Frôler l\'écran|Le poseur roule vers le panier', 'Ballons', ''],
      ['attaque', 'Pick and roll à 3 contre 3 avec le tireur', 15, 'Ajout d\'un tireur dans le coin : il punit l\'aide défensive.', 'Lire l\'aide|Passe au coin si son défenseur aide', 'Ballons, chasubles', ''],
      ['jeu', 'Match : 2 points de bonus sur pick and roll', 20, 'Match normal : un panier après un écran porteur vaut 1 point de plus.', 'Espacement|Patience', 'Chasubles', '']] },
    { sys: 'Jeu rapide', fmt: 'b5', title: 'Contre-attaque et jeu rapide', goal: 'Récupérer, sortir vite, courir dans les couloirs et finir avant le repli.', ex: [
      ['transitions', 'Sortie de rebond et passe longue', 12, 'Rebond défensif, première passe au meneur sur le côté, course des ailiers dans les couloirs.', 'Sortir le ballon en moins de 2 secondes|Courir large', 'Ballons', ''],
      ['transitions', '3 contre 2 puis 2 contre 1', 15, 'Trois attaquants contre deux, puis les deux défenseurs contre-attaquent à 2 contre 1.', 'Le porteur au centre|Passe avant le dernier défenseur', 'Ballons', ''],
      ['jeu', 'Match : panier en moins de 8 secondes = bonus', 20, 'Match normal : un panier marqué en moins de 8 secondes après la récupération vaut 1 point de plus.', 'Courir|Repli défensif immédiat', 'Chasubles', '']] },
  ],
  hand: [
    { sys: 'Défense 0-6', fmt: 'h7', title: 'Défense étagée 0-6', goal: 'Six défenseurs sur la zone : sortir sur le porteur, revenir, glisser ensemble.', ex: [
      ['defense', 'Glissements de la 0-6', 12, 'Six défenseurs contre six attaquants qui se passent le ballon sans tirer : la défense glisse et sort sur le porteur.', 'Sortir bras levés|Revenir après la passe|Se parler', 'Ballons', ''],
      ['defense', 'Défense 0-6 contre attaque placée', 18, 'Attaque placée 6 contre 6 : la défense doit récupérer avant 40 secondes.', 'Contact avec le porteur|Fermer l\'intérieur|Aider le voisin', 'Ballons, chasubles', ''],
      ['jeu', 'Match : défense 0-6', 20, 'Match normal, défense 0-6 obligatoire.', 'Discipline défensive|Montée de balle après récupération', 'Chasubles', '']] },
    { sys: 'Défense 1-5', fmt: 'h7', title: 'Défense 1-5 avec un avancé', goal: 'Un défenseur avancé gêne le demi-centre, cinq sur la zone.', ex: [
      ['defense', 'Le rôle de l\'avancé', 12, 'L\'avancé contre le demi-centre et deux arrières : il coupe les passes et gêne la circulation.', 'Rester entre le ballon et le demi-centre|Bras dans les lignes de passe', 'Ballons', ''],
      ['defense', '1-5 contre attaque placée', 18, 'Attaque placée 6 contre 6 contre une défense 1-5.', 'Les arrières défensifs sortent fort|Le pivot est toujours marqué', 'Ballons, chasubles', ''],
      ['jeu', 'Match : défense 1-5', 20, 'Match normal, défense 1-5 obligatoire. Une interception vaut un but.', 'Agressivité|Contre-attaque', 'Chasubles', '']] },
    { sys: 'Défense 3-2-1', fmt: 'h7', title: 'Défense 3-2-1 offensive', goal: 'Une défense étagée qui va chercher le ballon haut pour provoquer des pertes.', ex: [
      ['defense', 'Les 3 lignes de la 3-2-1', 15, 'Placement des 3 lignes contre une circulation lente : chacun sait qui il prend.', 'Pointe très haute|Distances entre les lignes|Fermer les passes', 'Ballons', ''],
      ['defense', 'Interception en 3-2-1', 15, 'Attaque 6 contre 6 : chaque interception lance une contre-attaque à 3.', 'Anticiper la passe|Partir vite après l\'interception', 'Ballons, chasubles', ''],
      ['jeu', 'Match : 3-2-1', 20, 'Match normal en 3-2-1.', 'Communication', 'Chasubles', '']] },
    { sys: 'Attaque placée 3-3', fmt: 'h7', title: 'Attaque placée en 3-3', goal: 'Trois arrières, deux ailiers et un pivot : fixer, croiser, trouver le pivot.', ex: [
      ['attaque', 'Fixation et passe', 15, '2 contre 2 arrières : l\'attaquant fixe son défenseur puis passe au voisin.', 'Attaquer l\'intervalle|Passer quand le défenseur s\'engage', 'Ballons', ''],
      ['attaque', 'Croisé et jeu avec le pivot', 18, '3 arrières + pivot contre 4 défenseurs : croisé demi-centre/arrière, puis passe au pivot.', 'Croiser dans le dos du porteur|Le pivot bloque son défenseur', 'Ballons', ''],
      ['jeu', 'Match : but du pivot = 2 points', 20, 'Match normal, un but du pivot compte double.', 'Patience|Jeu avec le pivot', 'Chasubles', '']] },
  ],
  rugby: [
    { sys: 'Organisation 1-3-3-1', fmt: 'r15', title: 'Le 1-3-3-1 : occuper la largeur', goal: 'Les avants répartis en pods de 3, un avant à chaque aile : du jeu dans tout le terrain.', ex: [
      ['soutien', 'Les pods de 3', 15, 'Trois avants en pod reçoivent du demi de mêlée, percutent et libèrent vite.', 'Un porteur, deux soutiens|Ballon sorti en 3 secondes', 'Ballons, boucliers', ''],
      ['attaque', 'Circulation 1-3-3-1', 18, 'Demi-terrain : lancements depuis un ruck, le jeu change de côté en passant par les pods.', 'Chacun à sa place|Avancer à chaque temps de jeu', 'Ballons, plots', ''],
      ['jeu', 'Match à thème : 5 temps de jeu', 20, 'Match au contact réduit : un essai après 5 temps de jeu vaut 2 points de plus.', 'Garder le ballon|Avancer', 'Chasubles', '']] },
    { sys: 'Organisation 2-4-2', fmt: 'r15', title: 'Le 2-4-2 : un gros bloc au centre', goal: 'Quatre avants au centre pour avancer, deux de chaque côté pour finir.', ex: [
      ['contact', 'Percussion à 4', 15, 'Quatre avants au centre : percussion, ruck, libération.', 'Avancer au contact|Libérer vite', 'Boucliers, ballons', ''],
      ['attaque', 'Écarter vers les côtés', 15, 'Après deux temps au centre, le ballon part vers les deux avants de côté et les trois-quarts.', 'Fixer au centre|Passer vite au large', 'Ballons', ''],
      ['jeu', 'Match à thème', 20, 'Match au contact réduit : chaque essai marqué au large vaut 2 points de plus.', 'Alterner centre et large', 'Chasubles', '']] },
    { sys: 'Défense en rideau', fmt: 'r15', title: 'Défendre en rideau', goal: 'Monter ensemble sur une ligne, plaquer et se relever.', ex: [
      ['plaquage', 'Montée en ligne à 5 contre 6', 15, 'Sur 30 m, 5 défenseurs montent ensemble contre 6 attaquants au toucher.', 'Monter ensemble|Le dernier défenseur glisse|Se parler', 'Chasubles, ballons', ''],
      ['plaquage', 'Plaquer et se relever', 12, 'Plaquage sur bouclier, se relever et se replacer dans la ligne.', 'Tête sur le côté|Se relever vite', 'Boucliers', ''],
      ['jeu', 'Match : défense en rideau', 20, 'Match au contact réduit : un ballon récupéré vaut 3 points.', 'Ligne défensive', 'Chasubles', '']] },
    { sys: 'Jeu au pied stratégique', fmt: 'r15', title: 'Occuper le terrain au pied', goal: 'Choisir le bon coup de pied : touche, chandelle, jeu rasant ; poursuivre ensemble.', ex: [
      ['pied', 'Les 3 coups de pied', 15, 'Par 2 : coup de pied en touche, chandelle, rasant ; le partenaire réceptionne.', 'Viser une zone|Réception bras en panier', 'Ballons, plots', ''],
      ['pied', 'Chandelle et poursuite', 15, 'Le demi lance une chandelle, deux chasseurs vont la disputer, deux réceptionneurs en face.', 'Partir au moment du coup de pied|Sauter pour le ballon', 'Ballons', ''],
      ['jeu', 'Match : 3 coups de pied obligatoires', 20, 'Chaque équipe doit jouer au pied 3 fois par période.', 'Bonne zone|Poursuite', 'Chasubles', '']] },
  ],
  volley: [
    { sys: '4-2', fmt: 'v6', title: 'Le système 4-2', goal: 'Deux passeurs opposés : le passeur avant passe, simple pour débuter.', ex: [
      ['technique', 'Passe du passeur avant', 15, 'Réception sur service facile, le passeur avant passe en 4 ou en 2.', 'Annoncer la passe|Passe haute vers l\'avant', 'Ballons', ''],
      ['reception', 'Réception à 4 en 4-2', 15, 'Quatre réceptionneurs, le passeur avant à la cible : service, réception, passe, attaque.', 'Se parler|Viser le passeur', 'Ballons', ''],
      ['jeu', 'Match en 4-2', 20, 'Match normal avec rotation 4-2.', 'Rotation correcte', 'Ballons', '']] },
    { sys: '5-1', fmt: 'v6', title: 'Le système 5-1', goal: 'Un seul passeur qui pénètre depuis l\'arrière : trois attaquants devant.', ex: [
      ['technique', 'Pénétration du passeur', 12, 'Le passeur part de la zone 1 au service adverse et rejoint la zone 2-3 pour passer.', 'Partir au moment du service|Être arrêté avant la passe', 'Ballons', ''],
      ['attaque', 'Attaque à 3 devant', 18, 'Le passeur pénètre, passe en 4, en 3 (courte) ou en 2.', 'Varier les passes|Les attaquants prêts', 'Ballons', ''],
      ['jeu', 'Match en 5-1', 20, 'Match normal en 5-1 : un point d\'attaque au centre vaut 2.', 'Rotations|Communication', 'Ballons', '']] },
    { sys: 'Réception à 3', fmt: 'v6', title: 'Réceptionner à 3', goal: 'Trois réceptionneurs (deux réceptionneurs-attaquants et le libéro) couvrent le terrain.', ex: [
      ['reception', 'Couloirs de réception', 15, 'Trois réceptionneurs, chacun son couloir, sur service flottant.', 'Être arrêté|Annoncer « j\'ai »|Viser la cible', 'Ballons, cible', ''],
      ['reception', 'Réception puis attaque', 18, 'Réception à 3, passe, attaque : point si l\'attaque est réussie.', 'Qualité de la réception d\'abord', 'Ballons', ''],
      ['jeu', 'Match : réception notée', 20, 'Match normal : une réception parfaite vaut un point bonus.', 'Concentration', 'Ballons', '']] },
    { sys: 'Défense en 6 arrière', fmt: 'v6', title: 'Défendre avec le 6 en arrière', goal: 'Le joueur en zone 6 recule au fond, les côtés défendent les diagonales.', ex: [
      ['defense', 'Placement en défense', 12, 'Le coach attaque depuis l\'autre côté : les défenseurs se placent selon l\'attaquant.', 'Position basse|Lire l\'épaule de l\'attaquant', 'Ballons', ''],
      ['contre', 'Contre et défense ensemble', 18, 'Deux contreurs et trois défenseurs contre une attaque en 4.', 'Le contre ferme la ligne|Les défenseurs couvrent la diagonale', 'Ballons', ''],
      ['jeu', 'Match : défense récompensée', 20, 'Match normal : une défense remontée puis attaquée gagnante vaut 2 points.', 'Ne rien lâcher', 'Ballons', '']] },
  ],
};

// more systems (written for the app)
SESSIONS_SPORTS.basket.push(
  { sys: 'Zone 3-2', fmt: 'b5', title: 'Défense de zone 3-2', goal: 'Trois devant pour gêner les tireurs, deux derrière pour la raquette.', ex: [
    ['defense', 'Glissements de la zone 3-2', 10, 'Le coach fait circuler le ballon entre 5 positions, la zone suit.', 'La pointe sur le ballon|Les ailes ferment les passes vers le coin', 'Ballon', ''],
    ['defense', 'Zone 3-2 contre 5', 18, 'Demi-terrain : la zone contre une attaque qui fait circuler.', 'Sortir sur les tireurs|Rebond', 'Chasubles, ballons', ''],
    ['jeu', 'Match en zone 3-2', 20, 'Chaque équipe défend en 3-2.', 'Communication', 'Chasubles', '']] },
  { sys: 'Box and one', fmt: 'b5', title: 'Box and one : stopper le meilleur adversaire', goal: 'Quatre défenseurs en carré, un défenseur colle le meilleur joueur adverse.', ex: [
    ['defense', 'Le défenseur collant', 12, '1 contre 1 tout terrain sur le meilleur attaquant : l\'empêcher de recevoir.', 'Toujours entre lui et le ballon|Bras dans la ligne de passe', 'Ballons', ''],
    ['defense', 'Le carré de 4', 15, 'Quatre défenseurs en carré contre 4 attaquants.', 'Garder le carré|Aider sur la pénétration', 'Chasubles, ballons', ''],
    ['jeu', 'Match avec box and one', 20, 'Une équipe défend en box and one.', 'Discipline', 'Chasubles', '']] },
  { sys: 'Motion offense (5 extérieurs)', fmt: 'b5', title: 'Attaque en mouvement', goal: 'Cinq joueurs à l\'extérieur qui coupent, passent et se replacent.', ex: [
    ['attaque', 'Passe et coupe', 15, '5 contre 0 puis 5 contre 5 : après chaque passe, on coupe vers le panier puis on se replace.', 'Couper fort|Remplir la place libre', 'Ballons', ''],
    ['attaque', 'Lecture sur la coupe', 15, '3 contre 3 : passe au coupeur s\'il est libre, sinon on continue.', 'Lire son défenseur|Passe à terre', 'Ballons', ''],
    ['jeu', 'Match : pas de dribble de plus de 2 rebonds', 20, 'Match normal avec 2 dribbles maximum.', 'Mouvement', 'Chasubles', '']] },
  { sys: 'Presse tout terrain', fmt: 'b5', title: 'Presse tout terrain', goal: 'Mettre la pression dès la remise en jeu pour provoquer des pertes.', ex: [
    ['defense', 'Prise à deux sur la remise en jeu', 12, 'Remise en jeu : deux défenseurs piègent le receveur dans le coin.', 'Fermer la ligne de touche|Bras hauts', 'Ballons', ''],
    ['defense', 'Presse 2-2-1', 15, '5 contre 5 tout terrain avec une presse 2-2-1.', 'Le dernier défenseur protège le panier', 'Chasubles, ballons', ''],
    ['jeu', 'Match avec presse', 20, 'Après chaque panier, presse tout terrain.', 'Repli si la presse est battue', 'Chasubles', '']] }
);
SESSIONS_SPORTS.hand.push(
  { sys: 'Défense 5+1', fmt: 'h7', title: 'Défense 5+1 : un défenseur individuel', goal: 'Cinq sur la zone, un défenseur qui suit le meilleur tireur adverse.', ex: [
    ['defense', 'L\'individuel', 12, '1 contre 1 sur le meilleur arrière : l\'empêcher de recevoir.', 'Toujours entre lui et le ballon', 'Ballons', ''],
    ['defense', 'Les 5 sur la zone', 15, 'Cinq défenseurs contre 5 attaquants (le sixième est pris en individuel).', 'Glisser ensemble|Le pivot marqué', 'Ballons, chasubles', ''],
    ['jeu', 'Match en 5+1', 20, 'Défense 5+1 obligatoire.', 'Discipline', 'Chasubles', '']] },
  { sys: 'Attaque à 2 pivots', fmt: 'h7', title: 'Attaquer à deux pivots', goal: 'Deux pivots qui bloquent et libèrent les arrières.', ex: [
    ['attaque', 'Blocs des pivots', 15, 'Deux pivots posent des blocs pour les arrières qui tirent.', 'Bloc immobile|Tirer au-dessus du bloc', 'Ballons', ''],
    ['attaque', 'Passe au pivot libre', 15, '4 arrières/ailiers + 2 pivots contre 6 : trouver le pivot qui se libère.', 'Fixer avant de passer|Passe à terre au pivot', 'Ballons', ''],
    ['jeu', 'Match à 2 pivots', 20, 'But d\'un pivot = 2 points.', 'Patience', 'Chasubles', '']] },
  { sys: 'Montée de balle', fmt: 'h7', title: 'Montée de balle et engagement rapide', goal: 'Marquer avant que la défense soit en place : première, deuxième et troisième vague.', ex: [
    ['transitions', 'Première vague', 12, 'Arrêt du gardien, relance longue vers l\'ailier qui part.', 'Partir au moment de l\'arrêt|Relance précise', 'Ballons', ''],
    ['transitions', 'Deuxième vague à 3 contre 2', 15, 'Les arrières montent vite contre 2 défenseurs qui se replient.', 'Largeur|Tir rapide', 'Ballons', ''],
    ['jeu', 'Match : but en moins de 10 secondes = 2 points', 20, 'Match normal.', 'Vitesse', 'Chasubles', '']] }
);
SESSIONS_SPORTS.rugby.push(
  { sys: 'Jeu au large', fmt: 'r15', title: 'Faire vivre le ballon au large', goal: 'Attirer au centre puis écarter vite vers les ailes.', ex: [
    ['passe', 'Passes longues sautées', 12, 'Ligne de 5 : le ballon va de l\'ouvreur à l\'ailier en 2 passes.', 'Passe vrillée|Courir droit', 'Ballons', ''],
    ['attaque', 'Surnombre au large', 15, '4 contre 3 sur un couloir de 25 m après un ruck.', 'Fixer l\'intérieur|Ailier dans la course', 'Ballons, plots', ''],
    ['jeu', 'Match : essai au large = bonus', 20, 'Match au contact réduit : essai dans les 15 m = 2 points de plus.', 'Largeur', 'Chasubles', '']] },
  { sys: 'Touche et maul', fmt: 'r15', title: 'Conquête en touche et maul', goal: 'Gagner la touche et avancer en maul.', ex: [
    ['conquete', 'Alignement à 4', 15, 'Lancer, saut et réception avec deux lifteurs.', 'Appel clair|Synchronisation', 'Ballons', ''],
    ['contact', 'Former le maul', 15, 'Après réception, les avants se lient et poussent sur 5 m.', 'Lier fort|Ballon caché au fond', 'Boucliers, ballons', ''],
    ['jeu', 'Match : touche obligatoire', 20, 'Chaque sortie de ballon donne une touche.', 'Conquête', 'Chasubles', '']] },
  { sys: 'Mêlée', fmt: 'r15', title: 'La mêlée fermée', goal: 'Se lier, pousser ensemble et sortir un ballon propre (en sécurité).', ex: [
    ['conquete', 'Liaisons de la première ligne', 12, 'Liaisons sans pousser, puis poussée légère contre bouclier (encadré par l\'éducateur).', 'Dos droit, tête haute|Pieds bien placés', 'Boucliers', ''],
    ['conquete', 'Introduction et talonnage', 12, 'Le demi introduit, le talonneur talonne, le 8 contrôle.', 'Signal du talonneur|Ballon au 8', 'Ballons', ''],
    ['jeu', 'Match : mêlée sur chaque en-avant', 20, 'Mêlée simulée à la sortie des en-avants.', 'Sécurité avant tout', 'Chasubles', '']] }
);
SESSIONS_SPORTS.volley.push(
  { sys: '6-2', fmt: 'v6', title: 'Le système 6-2', goal: 'Deux passeurs opposés : celui de l\'arrière passe, trois attaquants devant.', ex: [
    ['technique', 'Le passeur arrière', 12, 'Le passeur en zone 1 pénètre et passe à 3 attaquants.', 'Pénétrer vite|Passe haute', 'Ballons', ''],
    ['attaque', 'Trois attaquants devant', 18, 'Réception, passe du passeur arrière, attaque en 4, 3 ou 2.', 'Varier|Annoncer', 'Ballons', ''],
    ['jeu', 'Match en 6-2', 20, 'Rotation 6-2 obligatoire.', 'Rotation correcte', 'Ballons', '']] },
  { sys: 'Réception à 4', fmt: 'v6', title: 'Réceptionner à 4', goal: 'Quatre réceptionneurs en W pour les débutants.', ex: [
    ['reception', 'Le W', 15, 'Quatre réceptionneurs en W, service facile.', 'Chacun sa zone|Annoncer', 'Ballons', ''],
    ['reception', 'Réception puis passe', 15, 'Réception à 4, passe vers la cible.', 'Viser le passeur', 'Ballons, cible', ''],
    ['jeu', 'Match : réception à 4', 20, 'Réception à 4 obligatoire.', 'Communication', 'Ballons', '']] },
  { sys: 'Attaque rapide (courte)', fmt: 'v6', title: 'L\'attaque courte au centre', goal: 'Le central attaque une passe courte et rapide devant le passeur.', ex: [
    ['attaque', 'Timing de la courte', 15, 'Le central saute pendant que le passeur touche le ballon.', 'Partir avant la passe|Bras haut', 'Ballons', ''],
    ['attaque', 'Courte et feinte', 15, 'Le passeur choisit : courte au centre ou passe haute en 4.', 'Lire le contre adverse', 'Ballons', ''],
    ['jeu', 'Match : point en courte = 2', 20, 'Match normal.', 'Vitesse', 'Ballons', '']] }
);
