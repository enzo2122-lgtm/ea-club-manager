/* News: « Quoi de neuf ? » after each update. The newest first; « n » goes up by one at each update (one entry per update,
   whatever the app: Clubbo or the app of one club). Each line: [icon, what changed, said with a smile]. Bugs fixed too.
   A device that has never seen any news gets the two latest entries once (the phones already in use when this window came, and new installs).
   RULE: every update of the app adds an entry here (the newest at the top). */
const News = (() => {
  const { esc, modal } = UI;
  const LIST = [
    { n: 37, date: '2026-10-07', title: 'Programme par semaine, vidéos jusqu\'à 1 Go', items: [
      ['📅', 'Espaces joueur et parents : le programme (entraînements et matchs) rangé par semaine — cette semaine et la suivante ouvertes, les autres semaines et les mois suivants en menus repliés, avec les réponses qui manquent.'],
      ['🎬', 'Bibliothèque et briefings vidéo : les vidéos jusqu\'à 1 Go (un match entier) pour faire les highlights.'],
    ] },
    { n: 36, date: '2026-10-07', title: 'Tout le programme au même endroit', items: [
      ['📅', 'Espaces joueur et parents, onglet Séances : les entraînements ET les matchs à venir, par date, avec « dispo / pas dispo » sur chaque match.'],
    ] },
    { n: 35, date: '2026-10-07', title: 'Un coup d\'œil suffit', items: [
      ['🎨', 'Espaces joueur et parents : chaque match a son étiquette et sa couleur — 🏆 Championnat (bleu), 🏅 Coupe (or), 🤝 Amical (vert), 🎪 Tournoi / Plateau (orange) — et les entraînements 🏃 (violet).'],
    ] },
    { n: 34, date: '2026-10-07', title: 'Matchs de toute la catégorie', items: [
      ['⚽', 'Un joueur de « Seniors » voit les matchs de Seniors A et de Seniors B (il peut être pris dans les deux) et peut dire s\'il est dispo.'],
      ['📅', 'Entraînements : les 3 prochaines semaines, puis « Voir les suivants ».'],
    ] },
    { n: 33, date: '2026-10-07', title: 'Message aux non-convoqués par notification', items: [
      ['🔔', 'Match → « Non-convoqués » → « Notifier tous dans l\'appli » (ou 🔔 joueur par joueur, avec son prénom). L\'appli dit qui l\'a reçu ; pour les autres (notifications pas activées) : WhatsApp.'],
    ] },
    { n: 32, date: '2026-10-07', title: 'Convocations : seulement les dispos', items: [
      ['🙋', 'Match et séance : la liste ne montre que les joueurs qui ont répondu « dispo » / « présent », au fur et à mesure. Un menu ajoute un joueur à la main (téléphone perdu, réponse de vive voix…).'],
      ['📣', '« Non-convoqués » : un message pour tous (groupe WhatsApp) ou joueur par joueur. Les joueurs ne voient plus « tu n\'es pas convoqué ».'],
    ] },
    { n: 31, date: '2026-10-07', title: 'Conseils perso : séance, vidéos et PDF', items: [
      ['📋', 'Fiche joueur → Conseils perso : joignez une séance prête (séance type du club ou de l\'équipe), avec les schémas des exercices en images.'],
      ['🎬', 'Ajoutez des liens vidéo (YouTube, Google Drive…) et des PDF ou images (3 Mo maximum). Le joueur les ouvre dans son espace, onglet Séances.'],
    ] },
    { n: 30, date: '2026-10-07', title: 'Dispo avant la convocation', items: [
      ['🙋', 'Les joueurs (et les parents) voient tous les matchs et entraînements de la saison et disent « dispo / pas dispo » avant la convocation.'],
      ['📋', 'Sur la fiche du match : « Disponibilités annoncées » (dispo, pas dispo et la raison) et « Convoquer les disponibles ». Puis « Envoyer la convocation » comme d\'habitude.'],
    ] },
    { n: 29, date: '2026-10-07', title: 'Classements FFF corrigés', items: [
      ['🏆', 'Les classements venus de la FFF restaient bloqués sur une des premières journées (points, matchs joués, rangs). Ils sont maintenant lus en entier : le classement officiel du jour.'],
      ['⚽', 'Différence de buts (et buts pour / contre) recalculée à partir de tous les scores de la poule : celle reçue de la FFF était fausse.'],
    ] },
    { n: 28, date: '2026-10-07', title: 'Groupes d\'entraînement et conseils perso', items: [
      ['👥', 'Plusieurs séances le même jour (Groupe Gianni, Groupe Enzo…) : le joueur répond « Présent » une seule fois pour la journée. Sur la séance, « Réponses des joueurs » : touchez le groupe de chacun (il le garde les semaines suivantes). Il voit alors la séance de son groupe.'],
      ['📊', 'Dans Entraînements, chaque séance à venir affiche les réponses du jour (✓ présents · ✗ absents · % de présence). Dans la séance : le total de la journée (tous groupes), les sans-réponse et le nombre de joueurs par groupe.'],
      ['💡', 'Fiche joueur → « Conseils perso » : envoyez à un joueur un exercice pour progresser (course, passe, positionnement…). Il le voit avec ses parents dans son espace, onglet Séances.'],
      ['📱', 'Espaces joueur et parents rangés en onglets en bas de l\'écran, avec un onglet Bénévoles pour les parents.'],
      ['🔄', '« Mettre à jour l\'appli » : menu Plus (et onglet Moi pour les joueurs et les parents). Plus besoin de fermer et rouvrir.'],
    ] },
    { n: 27, date: '2026-10-06', title: 'La séance avant la séance', items: [
      ['📋', 'Espace joueur : un joueur qui répond « Présent » à une séance voit tout de suite son programme (objectif, exercices, consignes du coach). Plus d\'excuse « je savais pas qu\'on faisait des centres ».'],
      ['🔒', 'Seuls les joueurs présents la voient, et seulement avant la séance. Les notes et les présences restent entre coachs.'],
    ] },
    { n: 26, date: '2026-10-05', title: 'Départage au millimètre', items: [
      ['🎯', 'Jeu des pronos : à égalité de points, la meilleure réussite passe devant (le % de pronos qui rapportent des points).'],
      ['⚡', 'Toujours à égalité ? Le plus rapide gagne : celui qui pronostique le plus tôt avant les matchs. Fini d\'attendre la compo officielle pour copier les coachs.'],
    ] },
    { n: 25, date: '2026-10-05', title: 'Le jeu des pronos', items: [
      ['🎲', 'Nouveau : le jeu des pronos sur la Ligue des champions, entre les joueurs et les coachs de la catégorie (A et B ensemble). Gratuit, sans argent : 3 points le score exact, 1 point le bon résultat. Les coachs aussi peuvent se faire chambrer.'],
      ['❤️', 'Chacun choisit son club de cœur, affiché à côté de son nom dans le classement. Les débats du vestiaire ont enfin des preuves.'],
      ['🏋️', 'Le dernier de la semaine a un gage à la séance suivante (10 pompes, ranger les plots…), affiché aussi sur la page de la séance du coach. Les coachs choisissent la liste et peuvent mettre le jeu en pause.'],
      ['🙈', 'Pas de copie possible : les pronos des autres n\'apparaissent qu\'au coup d\'envoi.'],
    ] },
    { n: 24, date: '2026-10-05', title: 'Les joueurs voient le classement', items: [
      ['🏆', 'Sur l\'espace joueur : « Classements de ma catégorie », avec un onglet par équipe (A, B…) puisqu\'un joueur peut être appelé dans l\'une ou l\'autre. Classement, derniers résultats et prochaine journée.'],
      ['📊', '« Ma saison » compte maintenant tous les matchs du joueur, en A comme en B, avec ses cartons et sa présence aux séances. Les stats ne se perdent plus en changeant d\'équipe.'],
    ] },
    { n: 23, date: '2026-10-05', title: 'Notes sur 10', items: [
      ['🔟', 'Les notes des joueurs passent sur 10, après les matchs comme après les séances : dix pastilles de 1 à 10 au lieu de 5 étoiles. Plus de nuances entre « pas mal » et « presque parfait ».'],
      ['🔁', 'Les anciennes notes sur 5 sont converties toutes seules (un 4/5 devient 8/10) : les moyennes de la saison restent justes.'],
      ['📱', 'Sur téléphone, le nom du joueur a enfin sa ligne à lui au-dessus des notes : plus de « 2 ·… » mystérieux.'],
    ] },
    { n: 22, date: '2026-10-04', title: 'Deux pages en une', items: [
      ['🔀', 'Résultats et Stats fusionnent : une seule entrée « Résultats et stats », avec deux onglets en haut, « Tout le club » (les week-ends de toutes les catégories) et « Par équipe » (classement, poule, coupes, joueurs). Un bouton de moins dans le menu.'],
      ['⚡', 'La mise à jour FFF lit 4 poules à la fois : 4 secondes au lieu de 17. Le temps de dire « hors-jeu ».'],
      ['✉️', 'Un message lu sur le téléphone n\'apparaît plus comme non lu sur l\'ordinateur (et inversement). Et ouvrir une conversation efface ses notifications restées sur le téléphone.'],
      ['🔍', 'Grand tour de contrôle : 51 pages, plus de 2 000 boutons touchés, en responsable et en coach, sur téléphone et ordinateur. Aucune erreur. Les bugs sont partis en vacances.'],
    ] },
    { n: 21, date: '2026-10-04', title: 'La coupe, c\'est la coupe', items: [
      ['🥇', 'Dans Stats, une petite partie « Coupes » à part : chaque tour, le score, et où on en est (1er tour, qualifiés, éliminés). Les compteurs du haut ne comptent plus que le championnat.'],
      ['🏆', 'La District Cup (et toutes les coupes) est rangée en « Coupe » : élimination directe, pas de classement, et elle ne compte plus dans les points de championnat ni dans la forme de l\'adversaire. Un match de coupe gagné ne rapporte pas 3 points, désolé.'],
    ] },
    { n: 20, date: '2026-10-04', title: 'L\'agenda de la poule', items: [
      ['🗓️', 'Dans Stats, sous les résultats : l\'agenda de la poule, avec la prochaine journée (tous les matchs, adversaires compris, avec l\'heure) et les suivantes repliées. Pour les coupes, seulement les nôtres. Tes matchs à venir arrivent aussi tout seuls dans Matchs.'],
    ] },
    { n: 19, date: '2026-10-04', title: 'Le bon numéro', items: [
      ['🐛', 'Bug réparé : « Club introuvable à la FFF ». L\'appli avait gardé le numéro interne de la FFF (162203) au lieu du numéro d\'affiliation (552176) : elle accepte maintenant les deux. Deux numéros pour un seul club, la FFF aime l\'administratif.'],
      ['🔄', 'Le bouton « Mettre à jour » est dans Stats pour toutes les catégories : un clic met à jour toutes les équipes, avec l\'heure de la dernière mise à jour.'],
    ] },
    { n: 18, date: '2026-10-04', title: 'Le bouton qui dit tout', items: [
      ['🔄', 'Dans Stats, une équipe sans classement officiel a maintenant son bouton « Les chercher maintenant ». Et le compte-rendu reste affiché : ce qui a été trouvé à la FFF, ou la vraie raison si ça coince. Fini les messages qui jouent à cache-cache.'],
    ] },
    { n: 17, date: '2026-10-04', title: 'Moins de boutons, moins de pièges', items: [
      ['🧹', 'Réglages → Le club : le favori « Résultats FFF » est rangé dans « Facultatif » (il ne sert plus qu\'aux cartons et remplacements des feuilles de match). Les résultats, eux, arrivent tout seuls.'],
      ['🐛', 'Un bouton-favori touché dans l\'appli au lieu d\'être glissé affichait un message qui s\'enfuyait plus vite qu\'un ailier : il reste maintenant affiché jusqu\'à ce que tu le fermes.'],
    ] },
    { n: 16, date: '2026-10-04', title: 'Footclubs en un clic', items: [
      ['🪪', 'Le favori Footclubs ouvre maintenant la liste des licences tout seul : connecte-toi, touche le favori depuis n\'importe quelle page, c\'est tout. Fini le tour du menu Licences → Liste → Afficher.'],
      ['⚠️', 'Le favori a changé : refais-le glisser une fois depuis Réglages → Le club (l\'ancien marche encore, mais seulement depuis la liste).'],
    ] },
    { n: 15, date: '2026-10-04', title: 'La FFF vient toute seule', items: [
      ['🪄', 'Plus de favori à glisser pour les résultats : l\'appli va chercher elle-même, sur le service officiel de la FFF, les scores de toutes tes équipes, le calendrier, les classements et les résultats de tous les adversaires. À chaque ouverture, au plus toutes les 3 heures. Le dimanche soir, ouvre l\'appli, c\'est tout.'],
      ['🧮', 'Le District n\'a pas encore publié un classement ? L\'appli le calcule à partir des résultats officiels, et le dit.'],
      ['🔄', 'Réglages → Le club : « Mettre à jour maintenant » si tu ne peux pas attendre. Le favori « Résultats FFF » ne sert plus qu\'aux feuilles de match (cartons, remplacements).'],
      ['🤝', 'Toujours sans doublon : « F.C. Bourget 2 » d\'AssistCoachAI et « BOURGET FC 2 » de la FFF sont le même match.'],
    ] },
    { n: 14, date: '2026-10-04', title: 'Les résultats sortent du placard', items: [
      ['📅', 'Les résultats de toute la poule s\'affichent maintenant dans Stats, même sans le favori FFF : le championnat d\'AssistCoachAI les contenait déjà, ils dormaient. La forme de l\'adversaire en profite aussi.'],
      ['🤝', 'AssistCoachAI et la FFF fusionnent : une seule liste par poule, chaque match une seule fois, le score officiel de la FFF d\'abord, et ce qu\'une seule des deux sources connaît est gardé. « PLAINE 2 » et « La Plaine 2 », c\'est enfin la même équipe.'],
      ['🐛', '« Exempt » ne figure plus dans le classement. C\'était le seul club à ne jamais perdre, c\'était louche.'],
    ] },
    { n: 13, date: '2026-10-04', title: 'Retour en Île-de-France', items: [
      ['🧭', 'Le lien du guide du football des enfants (GIFE), dans les ressources des exercices, part maintenant chez nos voisins du District du Val-de-Marne (Ligue Paris Île-de-France) au lieu des Pays de la Loire. Même guide, moins de bouchons sur le périph\'.'],
    ] },
    { n: 12, date: '2026-10-04', title: 'On espionne toute la poule', items: [
      ['📅', 'Le favori « Résultats FFF » rapporte maintenant les résultats de tous les matchs de nos poules, adversaires compris. Ils s\'ajoutent chaque semaine aux précédents, rien n\'est effacé. À voir dans Stats, sous le classement.'],
      ['🔎', 'Dans l\'onglet « Avant » du match : la forme du moment de l\'adversaire (ses 5 derniers résultats). Tu sauras s\'il arrive en confiance ou en crise.'],
      ['🅰️', 'AssistCoachAI range enfin chaque match dans la bonne équipe : le championnat le plus haut (D3) va à l\'équipe A, le suivant (D4) à la B. Les matchs mal rangés avant sont déménagés tout seuls.'],
      ['🐛', 'Bug réparé : une équipe engagée dans deux poules perdait le classement de la première. Les deux restent maintenant.'],
    ] },
    { n: 11, date: '2026-10-04', title: 'Le compte-rendu qui part tout seul', items: [
      ['📄', 'Nouveau dans l\'onglet « Après » du match : « Envoyer le PDF ». Score, buteurs, passeurs, temps forts, minutes, cartons, notes, commentaires et le mot du coach, dans un joli PDF prêt pour WhatsApp. Les parents vont croire que tu as un attaché de presse.'],
      ['🤝', 'Le match suivi en direct, la feuille de la FFF et AssistCoachAI se complètent au lieu de s\'écraser : un carton noté deux fois compte une fois, un changement oublié en direct est repris de la feuille, tes buteurs restent. Trois sources, une seule vérité.'],
    ] },
    { n: 10, date: '2026-10-04', title: 'Une démo par sport', items: [
      ['📱', 'Chaque sport a maintenant sa propre adresse de démonstration, qui s\'installe comme une appli à part sur le téléphone : foot, basket, hand, rugby, volley. Cinq clubs dans la poche, zéro cotisation.'],
      ['🐛', 'Bug réparé : le club de démonstration se faisait parfois mettre à la porte au démarrage (« connexion expirée »). Il avait pourtant sa licence.'],
    ] },
    { n: 9, date: '2026-10-04', title: 'Le match oublié', items: [
      ['🐛', 'Bug réparé : un match passé sur AssistCoachAI sans le bouton « terminé » était ignoré, même avec ses buts et ses remplacements. Il compte maintenant : on ne punit pas un match pour un clic oublié.'],
      ['🟨', 'Les cartons notés sur AssistCoachAI arrivent aussi dans la colonne « Cartons ». Aucun carton ne passe entre les mailles.'],
    ] },
    { n: 8, date: '2026-10-04', title: 'Les cartons au grand jour', items: [
      ['🟨', 'Nouvelle colonne « Cartons » dans le tableau des joueurs de la page Stats. Un clic dessus et les plus chauds du vestiaire passent en tête.'],
      ['📭', 'Une équipe sans match joué ne montre plus une page de zéros muette : elle explique d\'où viennent les stats et quoi faire pour les remplir.'],
    ] },
    { n: 7, date: '2026-10-04', title: 'Un joueur, un poste', items: [
      ['👕', 'Dans « Qui joue où ? », un joueur déjà placé disparaît des autres listes. Les listes raccourcissent à mesure que l\'équipe se remplit : plus facile de voir qui reste sur le banc.'],
    ] },
    { n: 6, date: '2026-10-04', title: 'La feuille de match débarque', items: [
      ['📋', 'Le favori « Résultats FFF » lit aussi la feuille de match de chaque match joué : cartons, remplacements, compositions. Elle s\'affiche dans l\'onglet « Après » du match.'],
      ['⏱️', 'Le temps de jeu se calcule tout seul : un titulaire joue jusqu\'à sa sortie, un remplaçant depuis son entrée. Fini le chronomètre sur la ligne de touche.'],
      ['🟨', 'Les cartons jaunes et rouges arrivent dans les stats de chaque joueur. Les récidivistes ne pourront plus dire « c\'était pas moi ».'],
    ] },
    { n: 5, date: '2026-10-04', title: 'Chacun à son poste', items: [
      ['👕', 'Nouveau dans l\'onglet « Compo » du match : « Qui joue où ? ». Choisis le joueur de chaque poste dans une liste, son nom s\'écrit sur le schéma et sur la feuille de match. Plus besoin de deviner qui est le numéro 7.'],
      ['🔁', 'Un joueur choisi à un nouveau poste quitte l\'ancien tout seul : pas de clone sur le terrain, l\'arbitre aurait compté.'],
    ] },
    { n: 4, date: '2026-10-04', title: 'Le dimanche soir, c\'est résultats', items: [
      ['🏆', 'Nouveau favori « Résultats FFF » : sur la page du club du site de la FFF, un geste et les scores de toutes tes équipes arrivent, avec le classement officiel de chaque poule. Même les adversaires sont à jour, sans leur demander leur avis.'],
      ['🪪', 'Le favori Footclubs ramène maintenant le numéro de licence de chaque joueur. Il sert aussi à reconnaître les joueurs : fini les jumeaux imaginaires.'],
      ['🛡️', 'Les adversaires ont enfin un visage : leur logo s\'affiche à côté de leur nom, dans les matchs et les classements. Plus d\'excuse pour ne pas reconnaître l\'ennemi.'],
      ['📊', 'Sur la page d\'une équipe, le classement officiel de la FFF passe devant le classement calculé : c\'est la FFF qui a le dernier mot (et le carton).'],
    ] },
    { n: 3, date: '2026-10-04', title: 'AssistCoachAI et Footclubs entrent dans le vestiaire', items: [
      ['📥', 'Nouveau (responsables) : deux favoris « AssistCoachAI → l\'appli » et « Footclubs → l\'appli » (Réglages → Le club). Un geste sur le site, et les joueurs, licences, présences et blessures arrivent à jour. Plus de copier-coller, plus de crampes.'],
      ['👀', 'Avant d\'enregistrer, l\'appli montre ce qui change : nouveaux joueurs, licences validées, départs. Comme un arbitre vidéo, mais qui ne refuse jamais un but valable.'],
      ['🧷', 'Sans doublon, et sans déménagement forcé : un joueur surclassé à la main reste dans la catégorie où tu l\'as mis.'],
    ] },
    { n: 2, date: '2026-10-03', title: 'Le grand rangement d\'automne', items: [
      ['🎉', 'Nouveau : cette fenêtre ! Après chaque mise à jour, elle te dit ce qui a changé, comme le débrief d\'après-match, en beaucoup plus court. Elle se relit dans « Plus » → « Nouveautés ».'],
      ['🏃', 'Les exercices d\'une séance font la sieste repliés en petites cartes. Touche « Ouvrir » pour les réveiller : 10 écrans de défilement en moins, ton pouce te dit merci.'],
      ['📣', 'La fiche d\'un match se range en 4 onglets, Avant, Compo, Pendant, Après, comme un vrai dimanche. Plus besoin de GPS pour retrouver la convocation.'],
      ['❓', 'L\'encadré « Comment ça marche ? » a compris qu\'il parlait trop : il ne s\'ouvre plus qu\'une fois, puis se cache derrière un petit « ? » à côté du titre.'],
      ['🧭', 'Le menu « Plus » est rangé par thèmes, comme un vestiaire après le passage de l\'intendant.'],
      ['🏠', 'L\'accueil va droit au but : « À ne pas oublier » dès le premier écran. Les catégories en trop sont parties s\'échauffer sur le banc (« +33 »).'],
      ['📚', 'Les exercices du club tiennent sur des cartes compactes, avec un « + » pour les envoyer dans une séance. Un quart de page en moins, zéro exercice en moins.'],
      ['⚙️', 'Les Réglages se coupent en deux : « Moi » d\'un côté, « Le club » de l\'autre. Chacun son vestiaire.'],
      ['👋', 'Le bouton rond « Aide » a pris sa retraite : le « + » reste seul capitaine. L\'aide est dans « Plus » et dans le « ? » de chaque page.'],
    ] },
    { n: 1, date: '2026-10-03', title: 'Ce qui a changé ces derniers jours', items: [
      ['🏠', 'L\'appli a déménagé dans une maison plus grande (le serveur Clubbo) sans perdre une seule chaussette : joueurs, matchs, messages et mots de passe ont suivi.'],
      ['🧊', 'Bug corrigé : sur iPhone, l\'appli faisait parfois la statue après une mise à jour. Elle s\'installe maintenant avant de se relancer, et propose « Recharger » si elle hésite.'],
      ['🤒', 'Quand un joueur ou un parent répond « absent », le coach de la catégorie est prévenu sur son téléphone, raison comprise. Plus de surprise à l\'appel.'],
      ['🔗', 'Une séance s\'envoie par un lien WhatsApp : l\'autre coach touche le lien, la séance arrive dans son appli. Plus rapide qu\'une passe en une touche.'],
      ['📲', 'Bug corrigé : sur iPhone avec Chrome, la page des familles n\'expliquait pas comment recevoir les notifications. Elle le dit maintenant, étape par étape.'],
      ['🛡️', 'Les sauvegardes de chaque nuit sont maintenant testées : on les remet chaque semaine dans une base d\'essai pour être sûr qu\'elles marchent. Ceinture et bretelles.'],
    ] },
  ];
  const KEY = AppCfg.key('news-seen');
  const seen = () => { try { return +localStorage.getItem(KEY) || 0; } catch (e) { return 0; } };
  const setSeen = n => { try { localStorage.setItem(KEY, String(n)); } catch (e) {} };
  const latest = () => LIST[0].n;
  const fmt = d => new Date(d + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const block = e => `<section class="news-e"><h3>${esc(e.title)} <span class="muted small">· ${esc(fmt(e.date))}</span></h3>
    <ul class="news-list">${e.items.map(([ic, t]) => `<li><span class="news-ic">${ic}</span><span>${esc(t)}</span></li>`).join('')}</ul></section>`;
  function show(list, title) {
    modal({ title: title || '🎉 Quoi de neuf ?', noFocus: true, body: list.map(block).join(''), actions: [{ label: 'C\'est parti !', kind: 'primary' }] });
  }
  // after an update: the news not seen yet on this device (a new install starts from the latest)
  function check() {
    const s = seen();
    const fresh = s ? LIST.filter(e => e.n > s) : LIST.slice(0, 2);
    setSeen(latest());
    if (fresh.length) setTimeout(() => show(fresh), 700);
  }
  const all = () => show(LIST, '📰 Les nouveautés');
  return { check, all, LIST };
})();
