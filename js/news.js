/* News: « Quoi de neuf ? » after each update. The newest first; « n » goes up by one at each update (one entry per update,
   whatever the app: Clubbo or the app of one club). Each line: [icon, what changed, said with a smile]. Bugs fixed too.
   A device that has never seen any news gets the two latest entries once (the phones already in use when this window came, and new installs).
   RULE: every update of the app adds an entry here (the newest at the top). */
const News = (() => {
  const { esc, modal } = UI;
  const LIST = [
    { n: 105, date: '2026-10-09', title: 'Le chat jusqu\'au bord aussi 📱', items: [
      ['📱', 'Sur iPhone, dans le chat, la barre du bas descend elle aussi jusqu\'au bord de l\'écran (la bande claire restait sur cette page).'],
    ] },
    { n: 104, date: '2026-10-09', title: 'Plus de saut d\'écran 📱', items: [
      ['📱', 'Corrigé sur iPhone : l\'écran ne clignote plus en ouvrant « Plus » (ni en fermant le clavier), et les onglets du bas ne sont plus rognés.'],
    ] },
    { n: 103, date: '2026-10-09', title: 'Modifier son message ✏️', items: [
      ['✏️', 'Dans le chat, touche ton message : « Modifier » pour corriger le texte (il s\'affiche « modifié »), « Supprimer » pour l\'enlever.'],
      ['🔒', 'Seul l\'auteur d\'un message peut le modifier ou le supprimer, coachs compris. Pour un message déplacé : « Signaler », ou fermer le chat.'],
    ] },
    { n: 102, date: '2026-10-09', title: 'Mesurer l\'écran, plus précis 📏', items: [
      ['📏', '« Mesurer l\'écran » montre aussi la version de l\'appli et l\'état de la correction de la barre du bas.'],
    ] },
    { n: 101, date: '2026-10-09', title: 'La barre du bas va jusqu\'au bord 📱', items: [
      ['📱', 'Sur iPhone (appli installée), iOS coupait le bas de l\'écran à la hauteur de la barre d\'état : une bande claire restait sous les onglets. Mesuré sur un iPhone : la barre descend maintenant jusqu\'au bord.'],
    ] },
    { n: 100, date: '2026-10-09', title: 'Compo, capitaine, suspensions, mutés et retards ©️', items: [
      ['♻️', 'Compo : « Reprendre la compo du … » refait celle du dernier match, sans les blessés, les suspendus et les non-convoqués (leurs postes restent à remplir).'],
      ['©️', 'Capitaine et vice-capitaine du match (onglet Compo). Le (C) s\'écrit sur la feuille de match.'],
      ['🟥', 'Après un carton rouge, le joueur porte 🟥 « suspendu ? » dans les convocations de toutes ses équipes, jusqu\'à ce qu\'il rejoue ou qu\'un coach touche « lever ».'],
      ['🔁', 'Mutés : statut sur la fiche (muté, hors période, sous contrat), un « M » sur les convoqués et le compte sous la convocation (limite habituelle : 6 dont 2 hors période).'],
      ['⏰', 'Appel : 1 toucher présent, 2 en retard, 3 absent. Les absents ont un motif privé, pour les coachs seulement.'],
    ] },
    { n: 99, date: '2026-10-09', title: 'Joueur à l\'essai, renforts et numéros du match 👕', items: [
      ['🧪', 'Joueur à l\'essai : coche « À l\'essai » sur sa fiche. Il porte 🧪 partout ; sur sa page, « Le garder dans l\'effectif » ou « Fin de l\'essai » (il reste dans la base du club).'],
      ['🤝', 'Renfort : dans un match, « Ajouter un renfort d\'une autre catégorie ». Il est convoqué et reste dans sa catégorie ; « gérer » pour le retirer.'],
      ['👕', 'Numéros : sur la fiche, les numéros déjà pris dans ses catégories (en rouge si le sien l\'est). Dans un match, onglet Compo, « Numéros du match » pour changer un numéro ce jour-là seulement (doublons en rouge, feuille de match et direct à jour).'],
    ] },
    { n: 98, date: '2026-10-08', title: 'La fiche urgence 🚑', items: [
      ['🚑', 'Chaque joueur a sa fiche urgence : allergies, traitements et où ils sont, conduite à tenir (PAI), choses à savoir, appareillages, et jusqu\'à 3 personnes à appeler.'],
      ['👪', 'Les familles la remplissent dans leur espace, onglet « Moi ». Seuls les coachs la voient.'],
      ['📋', 'Côté coach : la fiche sur la page du joueur, et « Fiches urgence » dans Équipes pour toute l\'équipe sur un écran (ce qu\'il faut savoir d\'abord, qui appeler en un geste).'],
    ] },
    { n: 97, date: '2026-10-08', title: 'Mesurer l\'écran 📏', items: [
      ['📏', 'Dans « Plus », « Mesurer l\'écran » affiche les tailles que le téléphone donne à l\'appli, pour régler la bande sous la barre du bas sur iPhone.'],
    ] },
    { n: 96, date: '2026-10-08', title: 'Tague aussi les coachs 🧢', items: [
      ['🧢', 'Avec @, les coachs de la catégorie sont proposés en premier (« @Coach Karim »). Le coach tagué reçoit sa notification, même s\'il a mis le chat en sourdine.'],
    ] },
    { n: 95, date: '2026-10-08', title: 'Tague un joueur avec @ 📣', items: [
      ['📣', 'Dans le chat, tape @ : la liste des joueurs de la catégorie s\'affiche, touche un nom pour le taguer. Il ressort en bleu dans le message.'],
      ['🔔', 'Le joueur tagué reçoit une notification rien que pour lui, même s\'il a mis le chat en sourdine. Dans le chat des parents, ce sont ses parents qui la reçoivent.'],
    ] },
    { n: 94, date: '2026-10-08', title: 'L\'écran reprend toute sa hauteur après le clavier 📱', items: [
      ['📱', 'Sur iPhone (appli installée), iOS gardait l\'écran raccourci après l\'ouverture du clavier : une bande restait sous la barre du bas. L\'appli fait maintenant remesurer l\'écran à iOS dès que le clavier se ferme.'],
      ['🔧', 'La barre du bas n\'est plus à moitié coupée (retour en arrière sur la version précédente).'],
    ] },
    { n: 93, date: '2026-10-08', title: 'Le chat prend tout l\'écran 💬', items: [
      ['💬', 'Sur téléphone, le chat n\'est plus une carte posée au milieu : il va d\'un bord à l\'autre de l\'écran et descend jusqu\'à la barre des onglets. Il fait vraiment partie de l\'appli.'],
    ] },
    { n: 92, date: '2026-10-08', title: 'La barre du bas colle au bord de l\'écran 📱', items: [
      ['📱', 'Sur iPhone (appli installée), iOS laissait une bande blanche sous les onglets. Pas de cache-misère : la barre descend maintenant jusqu\'au bord de l\'écran, la bande n\'existe plus.'],
    ] },
    { n: 91, date: '2026-10-08', title: 'Plus de bande claire sous la barre du bas 📱', items: [
      ['📱', 'Sur iPhone, après avoir écrit un message, la barre du bas pouvait rester remontée avec une bande claire en dessous. L\'appli remet l\'écran en place dès que le clavier se ferme.'],
    ] },
    { n: 90, date: '2026-10-08', title: 'Le chat tient en place quand tu écris ⌨️', items: [
      ['⌨️', 'Quand tu écris dans le chat, la barre du bas s\'efface : le chat descend juste au-dessus du clavier et ne saute plus. Elle revient quand tu fermes le clavier.'],
    ] },
    { n: 89, date: '2026-10-08', title: 'Le bouton Envoyer du chat est libre 💬', items: [
      ['💬', 'Dans le chat, le bouton rond ＋ ne cache plus le bouton Envoyer : il disparaît tant que le chat est ouvert.'],
    ] },
    { n: 88, date: '2026-10-08', title: 'Plus de « Enregistrement… » à chaque lettre 🤫', items: [
      ['🤫', 'L\'appli enregistre en silence : les messages « Enregistrement… » et « Enregistré » ne s\'affichent plus quand tu écris. Un message n\'apparaît que s\'il y a un souci (pas de réseau, envoi au club en attente).'],
    ] },
    { n: 87, date: '2026-10-08', title: 'La séance générée va dans ton entraînement 📅', items: [
      ['📅', 'Dans l\'aperçu de la séance générée, choisis « Mettre la séance dans » : un nouvel entraînement, ou un entraînement déjà prévu au planning (le prochain vide est proposé). Sa date, son heure, son lieu et l\'appel restent.'],
      ['✨', 'Sur la page d\'un entraînement, nouveau bouton « Générer la séance » : la séance générée arrive directement dedans. S\'il y a déjà des exercices, tu choisis de les garder ou de les remplacer.'],
      ['🧹', 'Corrigé : une photo ou un PDF ajouté à une séance (« Depuis un fichier ») n\'est plus proposé comme exercice par le générateur.'],
      ['🎲', 'Le tirage est plus juste : les exercices déjà proposés récemment reviennent moins, ceux qui ont un schéma dessiné passent devant.'],
    ] },
    { n: 86, date: '2026-10-08', title: 'Des séances générées plus variées et des schémas complets ✨', items: [
      ['🎲', '« Générer une séance » tire maintenant au sort parmi tous les exercices du thème, et évite ceux des 4 dernières semaines de l\'équipe : deux séances de suite ne se ressemblent plus.'],
      ['🔄', 'Avant de créer la séance, un aperçu : touche 🔄 pour changer un exercice, ou 🎲 pour tout retirer au sort. Touche un schéma pour l\'agrandir.'],
      ['📚', 'Une bibliothèque de 69 exercices avec un schéma dessiné pour chacun : zones, plots, buts, joueurs numérotés et l\'action étape par étape (échauffements, rondos, pressing, transitions, finition, défense, relance, coups de pied arrêtés, physique, gardien, jeux, et des jeux pour les plus jeunes).'],
      ['🗺️', 'Les schémas montrent toute l\'action sur une seule image : passes en pointillé, courses, conduites, pressing en rouge, frappes. Sur la séance, ils s\'animent toujours étape par étape.'],
    ] },
    { n: 85, date: '2026-10-08', title: "L'appli fait sa valise pour le Play Store 🧳", items: [
      ['📲', "Espaces joueur et parents : la copie hors ligne se prépare dès l'ouverture de la page (plus seulement quand on active les notifications), ce que le Play Store vérifie."],
    ] },
    { n: 84, date: '2026-10-08', title: "La commission de discipline passe à l'appli ⚖️", items: [
      ['⚖️', "Favori Footclubs : après les licences, il lit aussi les sanctions officielles du club (Compétitions → Dossiers). Avertissements et suspensions arrivent sur la fiche du joueur (« Discipline officielle ») ; une suspension le rend indisponible aux bonnes dates (convocations, Infirmerie)."],
    ] },
    { n: 83, date: '2026-10-08', title: "Ça chauffe sous les séances 🔥", items: [
      ['🔥', "Sous chaque séance et chaque match, joueurs et parents réagissent (🔥) et commentent (💬). Toi aussi, depuis la page de la séance ou du match : carte « Réactions et commentaires », tu supprimes ce qui dépasse, et tu es prévenu d'un commentaire. Mêmes règles que le chat (mots interdits, limites)."],
    ] },
    { n: 82, date: '2026-10-08', title: "Vu, pas vu, pas lu 👁️", items: [
      ['👁️', "Sur chaque séance et chaque match : « Qui a vu » — ont répondu, vu sans répondre, pas ouvert l'appli, jamais utilisé leur code. Avec les prénoms pour relancer les bons."],
      ['📶', "Page Codes : les joueurs silencieux (appli pas ouverte depuis 30 jours)."],
    ] },
    { n: 81, date: '2026-10-08', title: "Alors, cette cheville ? 🩹", items: [
      ['🩹', "Suivi après blessure : après chaque séance ou match où le blessé était présent, l'appli lui demande « comment ça s'est passé ? » (plus rien / à surveiller / toujours blessé). « Plus rien » termine la blessure, « toujours blessé » te prévient tout de suite."],
      ['✅', "Infirmerie et accueil : les blessures signalées depuis l'appli par un joueur ou ses parents attendent ta validation (« Signalements à valider »)."],
    ] },
    { n: 80, date: '2026-10-08', title: "Fini les chamailleries pour faire les équipes 👥", items: [
      ['👥', "Former des équipes (Joueurs → « Former des équipes ») : 2 à 5 équipes équilibrées d'après le niveau (global, technique, physique, vitesse des sprints…), un gardien par équipe, les postes répartis. Présents seulement, « Remélanger », image WhatsApp, impression."],
    ] },
    { n: 79, date: '2026-10-08', title: "Les plots se placent tout seuls ⚡", items: [
      ['⚡', "Travail athlétique (Joueurs → « Travail athlétique », ou depuis les tests physiques) : d'après les VMA, l'appli fait 1 à 5 groupes de course et donne à chacun sa vitesse et sa distance (% de VMA, effort, récup, séries). Présents seulement, gardiens ou non, image à partager sur WhatsApp."],
    ] },
    { n: 78, date: '2026-10-08', title: 'La page confidentialité a rattrapé l\'appli 🔒', items: [
      ['🔒', "Page confidentialité complétée : profil et blessures signalés par les joueurs, messages au coach, highlights et vidéos (YouTube sans cookie, option Gemini avec accord des familles), jeu des pronos, anniversaires, imports AssistCoachAI / Footclubs, durées de conservation."],
    ] },
    { n: 77, date: '2026-10-08', title: 'Les notes des coachs d\'AssistCoachAI', items: [
      ['⭐', 'L\'import AssistCoachAI ramène les notes des coachs : le niveau de chaque joueur (technique, intelligence de jeu, physique, attitude, mental) va dans « Niveau des joueurs », ramené sur 5 quelle que soit l\'échelle d\'AssistCoachAI, avec le commentaire du coach.'],
      ['📝', 'Les notes d\'un joueur après un match ou un entraînement vont dans « Notes des dirigeants » sur sa fiche (sur 10), avec le commentaire. Elles sont marquées « AssistCoachAI ».'],
      ['✋', 'Un niveau changé à la main dans l\'appli après la date d\'AssistCoachAI est gardé. Rien n\'est montré aux joueurs ni aux parents.'],
      ['🔁', 'Refais le favori AssistCoachAI (Réglages → Le club) : il cherche aussi les pages de notes et d\'évaluations, y compris la fiche de chaque joueur.'],
    ] },
    { n: 76, date: '2026-10-08', title: 'Le niveau des joueurs', items: [
      ['📊', 'Nouveau : le niveau de chaque joueur sur 5 critères notés de 1 à 5 : technique, intelligence de jeu, physique, attitude et mental. Sur la fiche du joueur (touche les étoiles) et dans Équipes → Niveau des joueurs.'],
      ['⭐', '« Noter l\'équipe » : tous les joueurs à la suite, ceux qui n\'ont pas de note d\'abord. Le tableau se trie par critère, avec la moyenne de l\'équipe, ses points forts et ses points à travailler.'],
      ['🔒', 'Réservé aux coachs de la catégorie et aux responsables : jamais montré aux joueurs ni aux parents. La fiche montre ce qui a bougé depuis la dernière fois (▲ ▼).'],
    ] },
    { n: 75, date: '2026-10-08', title: 'Joyeux anniversaire ! 👑', items: [
      ['🎂', 'Le jour de son anniversaire, la page du joueur se met en fête : en-tête doré, couronne, confettis et une carte « King of the day ». Côté parents aussi pour les U15 et en dessous.'],
      ['👑', 'Dans le chat de sa catégorie, un message « King of the day » invite tout le groupe à lui souhaiter son anniversaire (bouton « 🎂 Lui souhaiter » en un geste), et une couronne s\'affiche devant son nom toute la journée.'],
      ['📋', 'Coachs et responsables : une carte « Anniversaires » sur l\'accueil (ceux du jour et des 7 prochains jours), et une couronne sur la fiche du joueur.'],
      ['🏃', 'Favori AssistCoachAI : il trouve maintenant tout seul la page des tests physiques. Astuce : ouvre la page des tests dans AssistCoachAI avant de toucher le favori.'],
    ] },
    { n: 74, date: '2026-10-08', title: 'Les tests physiques d\'AssistCoachAI', items: [
      ['🏃', 'L\'import AssistCoachAI ramène les tests physiques de chaque joueur, avec leur date : VMA, VTI (VIFT du 30-15), sprints 10, 20 et 30 m, détente, saut en longueur, Illinois, T-test, Yo-Yo, Cooper, jongles et conduite. À voir dans Joueurs → Tests et sur la fiche du joueur. Un nouvel import ne fait pas de doublon.'],
      ['📏', 'Les unités sont remises d\'aplomb (un sprint en millisecondes, une détente en mètres…) et une valeur impossible est écartée. Un test qu\'AssistCoachAI a mais que l\'appli ne connaît pas est listé dans la fenêtre d\'import.'],
      ['🔁', 'Refais le favori AssistCoachAI (Réglages → Le club) : il lit maintenant aussi les tests.'],
    ] },
    { n: 72, date: '2026-10-08', title: 'Petites corrections sur téléphone', items: [
      ['🟦', 'Corrigé : avec le menu discret en haut, un carré bleu apparaissait sous le menu.'],
      ['🎯', 'Corrigé : la page « Pronos » des joueurs dépassait de l\'écran (le téléphone dézoomait).'],
      ['🏷️', 'Corrigé : avec le menu discret en haut, le menu cachait une partie du nom du club dans l\'espace joueurs et parents.'],
      ['📋', 'Les boutons des favoris (AssistCoachAI, Footclubs, FFF) ne sont plus coupés sur un petit écran.'],
    ] },
    { n: 71, date: '2026-10-08', title: 'Sur téléphone : plus de zoom, et jusqu\'aux bords', items: [
      ['📱', 'Les pages ne zooment et ne dézooment plus (ni à deux doigts, ni au double toucher, ni en touchant un champ).'],
      ['📐', 'La barre du bas va jusqu\'au bord de l\'écran et suit ses coins arrondis : plus de rectangle blanc sous la barre sur iPhone. Les espaces joueurs et parents passent aussi sous la barre d\'état, comme l\'appli des coachs.'],
      ['↕️', 'Moins de vide au bas des pages.'],
    ] },
    { n: 70, date: '2026-10-08', title: 'Les signalements à part des messages', items: [
      ['🐞', 'Nouveau : « Signalements et idées » (menu Plus). Les problèmes, idées et questions des éducateurs y arrivent ensemble, à traiter ou traités, avec la capture et la page. Les responsables reçoivent une notification.'],
      ['💬', 'La messagerie ne garde que les messages : les signalements n\'y arrivent plus (les anciens y sont retirés, ils sont dans « Signalements et idées »).'],
      ['🧑', 'Corrigé : un message envoyé depuis l\'espace joueur (blessure, « Écrire au coach ») s\'affichait « Coach Prénom ». Il s\'affiche maintenant « Prénom N. · joueur » ou « Parent de Prénom N. ».'],
      ['📱', 'Corrigé sur téléphone : la page ne zoome et ne dézoome plus toute seule (des boutons d\'en-tête dépassaient de l\'écran), l\'iPhone ne zoome plus quand on touche un champ, et le menu « ⋯ » (Séances, Matchs…) s\'ouvre en entier dans l\'écran.'],
    ] },
    { n: 69, date: '2026-10-08', title: 'Le temps additionnel compte', items: [
      ['⏱️', '« Corriger le match » : le temps additionnel de chaque mi-temps, pris du match suivi en direct ou de la feuille FFF, à corriger si besoin. « Tout » donne la durée réelle (90 + temps additionnel).'],
      ['🔎', 'La vérification des temps de jeu en tient compte : 95 minutes ne sont plus « trop » quand il y a eu 5 minutes de temps additionnel, et un écart avec la feuille FFF dû au temps additionnel n\'est plus signalé.'],
      ['⚽', 'Un but peut se noter « 45+2 ».'],
    ] },
    { n: 68, date: '2026-10-08', title: 'Les temps de jeu vérifiés', items: [
      ['🔎', 'Chaque match joué est vérifié : total des minutes (joueurs sur le terrain × durée), un joueur au-delà de la durée, trop de joueurs du début à la fin, un buteur sans temps de jeu, un temps non saisi.'],
      ['🔁', 'Les temps sont comparés aux remplacements (match suivi en direct, feuille FFF, AssistCoachAI) : « Appliquer ces temps » corrige en un toucher.'],
      ['⚠️', 'Matchs → Résultats : un ⚠️ à la place du ✏️ sur un match à vérifier, et « Corriger un match » → « À vérifier » pour les voir tous.'],
    ] },
    { n: 67, date: '2026-10-08', title: 'Corriger un match en un seul écran ✏️', items: [
      ['✏️', 'Matchs → Résultats : un ✏️ à côté de chaque match joué, et « Corriger un match » pour retrouver un match (par catégorie, par adversaire).'],
      ['⚽', 'Un seul écran : le score, chaque but (minute, buteur, passeur), le temps de jeu et les cartons de chaque joueur, un joueur oublié à ajouter ou à retirer.'],
      ['🔒', 'La correction est gardée : un nouvel import AssistCoachAI ou de la feuille FFF ne l\'écrase plus. Les stats de la saison, le compte-rendu et l\'espace des joueurs suivent.'],
    ] },
    { n: 66, date: '2026-10-08', title: 'Le favori AssistCoachAI marche aussi avec l\'appli installée', items: [
      ['📥', 'Le favori AssistCoachAI montre ce qu\'il lit (joueurs, matchs, réponses), puis un bouton « Envoyer à l\'appli → ». Les données passent dans l\'adresse, comme Footclubs : ça marche même quand l\'appli est installée sur l\'ordinateur.'],
      ['🔁', 'Refais le favori une fois (Réglages → Le club) : l\'ancien ne marche plus.'],
    ] },
    { n: 65, date: '2026-10-08', title: 'AssistCoachAI : les réponses des joueurs, et plus de doublons', items: [
      ['🗳️', 'Les réponses des joueurs sur AssistCoachAI (présent / absent aux matchs et aux entraînements, avec le motif) arrivent dans l\'appli à l\'import. Une réponse plus récente donnée dans l\'appli reste.'],
      ['🤝', 'Corrigé : un match d\'AssistCoachAI rangé dans une autre équipe de la catégorie que celui de la FFF (la coupe en « Seniors », la FFF en « Seniors B »), ou nommé sans le numéro d\'équipe (« Villemomble » / « VILLEMOMBLE SPORTS 2 »), faisait un doublon. Les doublons déjà là sont fusionnés au prochain import : le match de la FFF reste, avec les convocations et les notes.'],
    ] },
    { n: 64, date: '2026-10-08', title: 'Une seule appli pour tout le club', items: [
      ['📲', 'La page du code (joueurs et parents) a un lien « Coach ou dirigeant ? » vers l\'appli des coachs, et l\'écran de connexion des coachs un lien « Joueur ou parent ? ». L\'appli retient ton choix.'],
      ['🏪', 'Préparation de la publication sur le Play Store : icône adaptée à Android, captures, raccourcis.'],
    ] },
    { n: 63, date: '2026-10-08', title: 'Espace famille jusqu\'aux U15, et sourdine des parents', items: [
      ['👪', 'L\'espace parents est réservé aux U15 et plus jeunes. À partir des U16 (et Seniors, Vétérans), le code ouvre directement l\'espace joueur.'],
      ['💬', 'Un seul chat par catégorie : jusqu\'aux U15, le chat des parents (espace parents, avec les coachs), plus de chat dans l\'espace joueur ; à partir des U16, le chat des joueurs.'],
      ['🔇', 'Coachs et responsables : « Sourdine parents » en haut du chat. Les parents lisent sans pouvoir écrire (ils peuvent encore réagir et voter aux sondages). « Parole aux parents » pour rouvrir.'],
      ['🔒', 'Corrigé : le bouton « Fermer » du chat ne fermait pas vraiment le chat.'],
    ] },
    { n: 62, date: '2026-10-08', title: 'Partage les résultats 📣', items: [
      ['📣', 'Coachs : sur un match joué, onglet « Après » → « Partager le résultat ». Une belle image (score, catégorie, blason) à envoyer sur WhatsApp, Facebook, Instagram, X, Telegram, SMS ou e-mail.'],
      ['🗓️', 'Résultats du club : un bouton 📣 par week-end crée l\'image de tous les scores du week-end.'],
      ['⚽', 'Joueurs et parents : « Partager » sous chaque résultat, et « Partager ma saison » (matchs, buts, passes, badges).'],
      ['🔒', 'Les buteurs ne s\'affichent que si tu le choisis (décoché par défaut chez les jeunes).'],
    ] },
    { n: 61, date: '2026-10-08', title: 'Installer l\'appli en 1 minute, et vos données', items: [
      ['📲', 'Espaces joueurs et parents : « Installe l\'appli » guide pas à pas selon le téléphone (iPhone, Android, lien ouvert dans Facebook ou Instagram), avec ton code à copier. Une fois installée : « Activer les notifications ».'],
      ['🔒', 'Confidentialité mise à jour : qui voit quoi dans le chat et les classements, protections des jeunes, durées (photos du chat 90 jours, messages 1 an).'],
      ['🏆', 'Onglet Moi : « Ne pas apparaître dans les classements » (tes badges restent).'],
      ['🗑️', 'Un joueur supprimé par le club : ses messages, photos et réactions du chat partent avec lui.'],
    ] },
    { n: 60, date: '2026-10-08', title: 'Photos, parents, relances et badges 🏅', items: [
      ['📷', 'Chat : envoie une photo (📷). Chez les jeunes, seuls les coachs en envoient, sauf si un coach ouvre les photos aux joueurs.'],
      ['📌', 'Les coachs épinglent un message en haut du chat (horaires, infos importantes).'],
      ['👪', 'Le chat des parents : par catégorie, entre parents et coachs (covoiturage, organisation). Espace parents → onglet Chat → « Parents ».'],
      ['⏰', 'La veille à 18 h, ceux qui n\'ont pas répondu au match ou à l\'entraînement reçoivent un rappel ; les coachs ont la liste.'],
      ['🏆', 'Classements de la catégorie (buteurs, passeurs, assiduité) et badges à gagner dans la saison. Chez les plus petits (U6 à U9) : les badges seulement.'],
    ] },
    { n: 59, date: '2026-10-07', title: 'Le chat en mieux 💬', items: [
      ['👆', 'Touche une bulle : réagis (👍 ❤️ 😂 ⚽ 🔥 👏), réponds à ce message (la citation s\'affiche), signale-le ou supprime-le.'],
      ['🚩', '« Signaler » : les coachs de la catégorie sont prévenus tout de suite.'],
      ['🌙', 'Heures calmes : pas de notification du chat aux jeunes entre 22 h et 7 h (les messages restent là).'],
      ['🔕', 'La cloche en haut du chat coupe (ou remet) ses notifications.'],
      ['📱', 'Coachs : sur téléphone, les en-têtes chargés gardent 2 boutons, les autres sont dans « ⋯ ». Familles : onglets lisibles, pages plus légères. Synchro plus économe pour les gros clubs.'],
    ] },
    { n: 58, date: '2026-10-07', title: 'La page du match plus réactive', items: [
      ['⚡', 'Page d\'un match : un but, une passe, le score ou un convoqué se mettent à jour tout de suite, sans redessiner toute la page. La page se remet complètement à jour une seconde et demie après le dernier appui.'],
    ] },
    { n: 57, date: '2026-10-07', title: 'Plus fluide, plus léger', items: [
      ['⚡', 'Espaces joueurs et parents : tout se charge en même temps (2 affichages au lieu de 6), et revenir dans l\'appli ne recharge plus tout à chaque fois.'],
      ['👆', 'Un appui = un envoi : les boutons attendent la réponse (« Envoi… »), plus de doublons (réponses, messages, bénévoles, sondages).'],
      ['🧹', 'Corrigé : la page vide après « Mon entraînement perso », la note du questionnaire qui s\'effaçait, les données d\'un enfant mélangées en changeant de code, les dates fausses après minuit.'],
      ['📱', 'Boutons plus grands au doigt, échelle du questionnaire sur 2 lignes, prénom du bénévole demandé dans l\'appli. Coachs : les boutons du haut tiennent sur une ligne qui défile.'],
    ] },
    { n: 56, date: '2026-10-07', title: 'Le chat ne bouge plus', items: [
      ['📌', 'Le chat est fixé à l\'écran : la page derrière ne défile plus, même quand le clavier s\'ouvre.'],
      ['✨', 'Plus de saut quand la page se recharge ; seuls les nouveaux messages glissent à l\'écran.'],
    ] },
    { n: 55, date: '2026-10-07', title: 'Les sondages dans le chat 📊', items: [
      ['📊', 'Dans le chat, touche 📊 : une question, 2 à 6 réponses (une seule ou plusieurs possibles). Toute la catégorie est prévenue.'],
      ['🗳️', 'Vote d\'une touche, change d\'avis quand tu veux, vois les pourcentages et « qui a voté ».'],
      ['🗂️', 'La partie « Sondages » (en haut du chat) rassemble tous les sondages. L\'auteur ou un coach peut le clôturer : 🏆 la réponse gagnante.'],
    ] },
    { n: 54, date: '2026-10-07', title: 'Le chat comme une vraie messagerie 💬', items: [
      ['💬', 'Le chat prend tout l\'écran : bulles par personne avec initiales, messages qui s\'affichent tout de suite, nouveaux messages toutes les 3 secondes, émojis, bouton « Nouveaux messages ».'],
      ['🗑️', 'Supprimer un message : touche la bulle, puis « Supprimer ».'],
      ['🔔', 'Notifications : nouveau message dans le chat, nouveau match, nouvelle séance (joueurs et parents) ; joueur dispo ou présent (coachs).'],
      ['🔴', 'Un compteur sur l\'icône de l\'appli quand il y a du nouveau, comme WhatsApp (appli ajoutée à l\'écran d\'accueil, notifications activées).'],
    ] },
    { n: 53, date: '2026-10-07', title: 'Le chat aussi dans l\'espace parents', items: [
      ['💬', 'Espace parents : onglet « Chat », le chat de la catégorie de ton enfant (les messages partent à son nom).'],
    ] },
    { n: 52, date: '2026-10-07', title: 'Le chat de la catégorie 💬', items: [
      ['💬', 'Un chat par catégorie : tous les joueurs (équipes A et B) et leurs coachs. Joueurs : onglet « Chat ». Coachs : Plus → « Chat des joueurs ».'],
      ['🛡️', 'Les mots grossiers ou insultants sont bloqués dans toutes les catégories, sauf Seniors et Vétérans.'],
      ['🧢', 'Les coachs peuvent supprimer un message ou fermer le chat un moment.'],
    ] },
    { n: 51, date: '2026-10-07', title: 'Ton menu, ta place', items: [
      ['🧭', 'Coachs et dirigeants aussi : Réglages → « Menu sur le téléphone » → la barre en bas, ou un petit menu discret en haut à droite. Le choix reste sur ton téléphone.'],
    ] },
    { n: 50, date: '2026-10-07', title: 'Les onglets où tu veux', items: [
      ['🧭', 'Espace joueur et parents : onglet « Moi » → choisis la barre d\'onglets en bas, ou un petit menu discret en haut à droite. Le choix reste sur ton téléphone.'],
      ['⚽', 'Les matchs de toute la catégorie (A et B) s\'affichent de nouveau côté joueur.'],
    ] },
    { n: 49, date: '2026-10-07', title: 'Le son de tout le match', items: [
      ['🔊', 'Analyse automatique au son : toute la vidéo est maintenant écoutée, jusqu\'à la dernière minute (avant, la fin des vidéos de téléphone était perdue).'],
    ] },
    { n: 48, date: '2026-10-07', title: 'L\'analyse vidéo se fait toute seule 🤖', items: [
      ['🤖', 'Bibliothèque → une vidéo → Analyser → « Repérer les actions automatiquement » : l\'appli écoute le son du match (cris, sifflets) et crée une séquence à chaque moment fort, sans regarder la vidéo. Tu choisis ensuite ce que c\'est.'],
    ] },
    { n: 47, date: '2026-10-07', title: 'Programme par semaine, vidéos jusqu\'à 1 Go', items: [
      ['📅', 'Espaces joueur et parents : le programme (entraînements et matchs) rangé par semaine — cette semaine et la suivante ouvertes, les autres semaines et les mois suivants en menus repliés, avec les réponses qui manquent.'],
      ['🎬', 'Bibliothèque et briefings vidéo : les vidéos jusqu\'à 1 Go (un match entier) pour faire les highlights.'],
    ] },
    { n: 46, date: '2026-10-07', title: 'Un analyste vidéo qui ne dort jamais 🧠', items: [
      ['🧠', "Highlights automatiques → option « Analyse par IA (Gemini) » : l'IA de Google regarde le match et repère buts, tirs, poteaux, arrêts des deux équipes. Chaque coach met sa propre clé Google (quota gratuit, puis Google le facture directement)."],
    ] },
    { n: 45, date: '2026-10-07', title: 'YouTube entre dans la salle de montage ▶️', items: [
      ['▶️', "Highlights automatiques avec un lien YouTube : la vidéo s'affiche dans la fenêtre, ⏱️ règle le coup d'envoi en un geste, et chaque moment se prévisualise. Pour le repérage au son, ajoute le fichier de la vidéo."],
    ] },
    { n: 44, date: '2026-10-07', title: 'Le monteur vidéo ne prend pas de pause café 🎬🤖', items: [
      ['🤖', "Match → Après → Highlights → « Créer automatiquement » : l'appli écoute le son de la vidéo (cris, sifflets) et place les actions du direct. Tu valides en 2 minutes au lieu de revoir tout le match."],
      ['🥅', "Match en direct : nouveaux boutons « Poteau / barre » et « Occasion adverse », pour les highlights des deux équipes."],
      ['🔍', "Lecteur vidéo : zoom à deux doigts, double-tap ou ＋/－, et boutons ⏪ ⏯ ⏩."],
    ] },
    { n: 43, date: '2026-10-07', title: 'Les blessures arrivent en groupe 🤕🤕', items: [
      ['🚑', "Joueurs et parents peuvent signaler plusieurs blessures en une fois (« ＋ Ajouter une autre blessure »), jusqu'à 5."],
    ] },
    { n: 42, date: '2026-10-07', title: 'Le lecteur vidéo a pris des vitamines 📼', items: [
      ['🎬', "Highlights : le lecteur intégré lit aussi Dropbox et les fichiers MP4, MOV, WebM, 3GP. Pour un AVI ou un MPG (que les navigateurs ne savent pas lire), il propose de le télécharger."],
    ] },
    { n: 41, date: '2026-10-07', title: 'Footclubs, troisième round : KO 🥊', items: [
      ['📥', "Favori Footclubs : à la fin de la lecture, un bouton « Envoyer à l'appli » apparaît sur Footclubs. Ça marche même quand l'appli est installée sur le PC."],
    ] },
    { n: 40, date: '2026-10-07', title: 'Footclubs, deuxième round 🥊', items: [
      ['📥', "Favori Footclubs : l'appli s'ouvre dès le clic (plus de fenêtre bloquée), il ouvre la liste des licences tout seul, et un bandeau montre qu'il travaille."],
    ] },
    { n: 39, date: '2026-10-07', title: 'Footclubs, on a trouvé ta cachette', items: [
      ['🔎', 'Favori Footclubs : il trouve la liste des licences même cachée dans un cadre dans un cadre. Si ça coince, il dit enfin pourquoi.'],
    ] },
    { n: 38, date: '2026-10-07', title: 'Le bonhomme est allé à la muscu 💪', items: [
      ['🦵', 'Blessures : un vrai corps humain (muscles) à toucher. Chaque zone propose l\'avant et l\'arrière : cuisse → quadriceps ou ischios, jambe → mollet, cheville → Achille.'],
    ] },
    { n: 37, date: '2026-10-07', title: 'Silence, on tourne 🎬', items: [
      ['🎬', 'Match → onglet Après : « Highlights » (liens vidéo + minute), puis « Envoyer aux joueurs ». Ils les regardent dans l\'appli, pop-corn non fourni.'],
      ['💬', 'Les joueurs écrivent au coach (message, idée, bug) : notification sur ton téléphone.'],
      ['🧍', 'Profil joueur : poids, taille, pied fort, points forts et faibles, IMC calculé tout seul.'],
      ['🦴', 'Blessures : joueurs et parents touchent la zone sur un vrai corps humain (muscles), choisissent la blessure, le type et la durée. Tu es prévenu, et l\'Infirmerie te rappelle de prendre des nouvelles tous les 3 jours.'],
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
  // (1.81) a bénévole or a referee (not a coach): only what is new, short (no bug fixed, no detail)
  const FIX = /^(🐛|🐞|🔧|🩹|🛠️)$/, fixText = /corrig|r[ée]par|bug|plantait|ne marchait/i;
  const brief = list => list.map(e => Object.assign({}, e, { items: e.items.filter(([ic, tx]) => !FIX.test(ic) && !fixText.test(tx)).slice(0, 2).map(([ic, tx]) => [ic, String(tx).split(/[.:(]/)[0]]) })).filter(e => e.items.length).slice(0, 3);
  function check() {
    const s = seen();
    const fresh = s ? LIST.filter(e => e.n > s) : LIST.slice(0, 2);
    setSeen(latest());
    const pv = Auth.preview(), list = pv && pv.role !== 'coach' ? brief(fresh) : fresh;
    if (list.length) setTimeout(() => show(list), 700);
  }
  const all = () => show(LIST, '📰 Les nouveautés');
  return { check, all, LIST };
})();
