/* Help: first-use tour, contextual help on every page, and reports (bugs, ideas, questions) sent to the club's responsable.
   Errors are caught and kept so a coach can attach them to a report. */
const Help = (() => {
  const { esc, $, $$, toast, modal } = UI;
  const VERSION = '2.59';
  const TOUR_KEY = AppCfg.key('tour-seen'), ERR_KEY = AppCfg.key('errors');

  /* ---------- error log ---------- */
  function errors() { try { return JSON.parse(localStorage.getItem(ERR_KEY)) || []; } catch (e) { return []; } }
  function logError(msg, src) {
    const list = errors(); list.push({ at: new Date().toISOString(), msg: String(msg).slice(0, 300), src: String(src || '').slice(0, 120), page: location.hash });
    try { localStorage.setItem(ERR_KEY, JSON.stringify(list.slice(-15))); } catch (e) {}
  }
  let lastToast = 0;
  function onCrash(msg, src) {
    logError(msg, src);
    if (Date.now() - lastToast < 8000) return; lastToast = Date.now();
    const t = document.getElementById('toast');
    t.innerHTML = `Oups, quelque chose n'a pas marché. <button class="toast-btn" id="crashReport">Signaler</button>`;
    t.className = 'toast show err';
    const b = document.getElementById('crashReport'); if (b) b.onclick = () => { t.className = 'toast'; report('bug'); };
    setTimeout(() => { t.className = 'toast'; }, 7000);
  }
  function watch() {
    window.addEventListener('error', e => onCrash(e.message, (e.filename || '').split('/').pop() + ':' + e.lineno));
    window.addEventListener('unhandledrejection', e => onCrash(e.reason && (e.reason.message || e.reason), 'promesse'));
  }

  /* ---------- first-use tour ---------- */
  const SLIDES = [
    ['crest', 'Bienvenue !', `${AppCfg.name}, c'est l'appli des éducateurs du club : tableau tactique animé, effectifs, séances, matchs et statistiques. Elle marche aussi sans internet.`],
    ['whistle', 'Ton compte', "Première fois : ouvre le lien d'invitation du responsable, choisis ton nom et crée ton mot de passe. Ensuite, connecte-toi sur n'importe quel téléphone, tablette ou ordinateur avec ton nom, ton prénom et ton mot de passe : tes données te suivent."],
    ['team', 'Équipes et joueurs', "Dans Équipes, retrouve chaque catégorie avec ses joueurs et dirigeants. Pour charger les licenciés : Réglages → Recevoir un fichier. Touche un joueur pour ajouter son numéro et le téléphone des parents."],
    ['board', 'Le tableau tactique', "Dans Schémas : choisis un outil (joueur, ballon, flèche, zone) puis touche le terrain. Touche « + Étape », déplace les joueurs : la flèche se dessine toute seule. « Jouer » lance l'animation."],
    ['training', 'Séances et matchs', "Prépare tes exercices, coche les présents, note les joueurs avec les étoiles, ajoute photos et vidéos. Pour un match : convocation, composition, score, buteurs… et les smileys !"],
    ['calendar', 'Planning et messages', "Réserve le terrain (grand ou demi-terrain) sans chevauchement, et discute avec les autres éducateurs dans Messages : tout le club, ta catégorie ou en privé."],
    ['video', 'Vidéos et PDF', "Dans la Bibliothèque, importe une vidéo, un montage ou un PDF venant d'une autre appli : dessine dessus ou transforme un PDF en séance."],
    ['share', 'Imprimer et partager', "Chaque schéma, séance ou match se partage en image, vidéo ou PDF à imprimer. « Envoyer toutes mes données » transmet tout à un autre éducateur."],
    ['help', "Besoin d'aide ?", "Le bouton « ? » est présent sur chaque page : il explique la page et permet de signaler un problème ou de proposer une idée au responsable."],
  ];
  function tour(onDone) {
    let i = 0;
    const el = document.createElement('div'); el.className = 'tour'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Guide de démarrage');
    document.body.appendChild(el);
    const render = () => {
      const [ic, title, text] = SLIDES[i], last = i === SLIDES.length - 1;
      el.innerHTML = `<div class="tour-card">
        <div class="tour-ic">${ic === 'crest' ? `<img src="${esc(Supporters.crest())}" alt="">` : I[ic]}</div>
        <p class="eyebrow">Guide · ${i + 1} sur ${SLIDES.length}</p><h2>${esc(title)}</h2><p class="tour-text">${esc(text)}</p>
        <div class="tour-dots">${SLIDES.map((_, k) => `<span class="${k === i ? 'on' : ''}"></span>`).join('')}</div>
        <div class="tour-nav"><button class="btn" data-t="skip">${last ? 'Fermer' : 'Passer'}</button>
          <span class="grow"></span>${i ? `<button class="btn" data-t="prev">${I.back}<span>Retour</span></button>` : ''}
          <button class="btn primary" data-t="${last ? 'end' : 'next'}"><span>${last ? "C'est parti !" : 'Suivant'}</span>${last ? '' : I.next}</button></div></div>`;
    };
    const close = () => { try { localStorage.setItem(TOUR_KEY, '1'); } catch (e) {} el.remove(); onDone && onDone(); };
    el.onclick = e => {
      const b = e.target.closest('[data-t]'); if (!b) return;
      if (b.dataset.t === 'next') { i++; render(); }
      else if (b.dataset.t === 'prev') { i--; render(); }
      else close();
    };
    let x0 = null;
    el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    el.addEventListener('touchend', e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (dx < -50 && i < SLIDES.length - 1) { i++; render(); } else if (dx > 50 && i > 0) { i--; render(); } });
    render();
  }
  const tourSeen = () => { try { return !!localStorage.getItem(TOUR_KEY); } catch (e) { return true; } };

  /* ---------- help per page ---------- */
  const PAGES = {
    '': ['Accueil', ['Le bouton rond « + » en bas à droite, sur toutes les pages : créer une séance, un match, un exercice, écrire un message, ou chercher (un joueur, une séance, « samedi »…).', 'En haut, choisis ton équipe : tu ne vois plus que ses séances et ses matchs.', 'Le prochain match et la prochaine séance sont juste en dessous : touche-les pour les ouvrir.', 'Le menu (à gauche, ou en bas sur téléphone) mène à toutes les pages. Sur chaque page, ce cadre « Comment ça marche ? » explique quoi faire.']],
    equipes: ['Équipes', ['Chaque carte est une catégorie (U11, Seniors…). Touche-la pour voir ses joueurs et ses dirigeants.', '« Tous les joueurs » montre tout le club, avec une recherche et un filtre par catégorie.', '« Nouvelle catégorie » : choisis le format foot à 11, à 8 ou à 5.']],
    equipe: ['Une catégorie', ['Composition : les convoqués sont placés selon leur poste (DC dans l\'axe, LD à droite, AG à gauche…), les autres sont notés comme remplaçants.', 'Touche un joueur pour ouvrir sa fiche. « Modifier » : numéro, poste principal et autres postes, téléphone des parents, infos santé.', '« Trier : Nom, N°, Poste » range la liste ; par poste, elle est coupée en gardiens, défenseurs, milieux et attaquants.', 'Le menu « Ajouter un joueur d\'une autre catégorie » permet de mettre un joueur dans plusieurs catégories.', 'La croix retire le joueur de la catégorie seulement : il reste dans le club.']],
    joueurs: ['Tous les joueurs', ['Cherche un nom ou filtre par catégorie.', '« Coller une liste » : colle des lignes copiées depuis le logiciel de ta fédération (Footclubs, FBI, Oval-e…), les joueurs sont rangés tout seuls dans leur catégorie.', 'Pour charger le fichier des licenciés : Réglages → Recevoir un fichier.']],
    dirigeants: ['Dirigeants', ['Ajoute chaque dirigeant avec son rôle, son téléphone et ses catégories.', 'À sa première connexion (lien d\'invitation : Réglages → Inviter les éducateurs), le dirigeant choisit son nom et crée son mot de passe.']],
    schemas: ['Schémas', ['Un schéma est un exercice ou une tactique animée. « Nouveau schéma » : foot à 11, à 8, à 5 ou zone libre.', '« Modèles » : rondo, 3 contre 2, conservation, sortie de balle, centre-tir, déjà animés. Ils deviennent ton schéma, à adapter.', '« Tableau blanc » : un terrain vierge en plein écran, rien n\'est enregistré (sauf si tu touches « Garder »).', 'Le bouton copie (sur la carte ou dans le schéma) duplique un schéma pour en faire une variante.', 'La Bibliothèque permet de dessiner sur une vidéo, un PDF ou une image.', '« Recevoir » ouvre un schéma envoyé par un autre éducateur.']],
    schema: ['Le tableau tactique', ['1. Choisis un outil à gauche (ou en haut sur téléphone), puis touche le terrain.', '2. « Bouger » : fais glisser un joueur. Touche-le pour changer son numéro, sa couleur ou son nom.', '3. Flèche : glisse depuis un joueur (ou le ballon) jusqu\'à l\'arrivée : il fera ce mouvement. Choisis le type (course, conduite, passe, tir…) au-dessus du terrain. Une flèche tracée ailleurs reste un simple dessin.', '4. « Jouer » lance l\'animation. Pour un mouvement après le premier, touche l\'étape suivante en bas et recommence. Zone : dessine un rectangle et donne-lui un nom.', '5. Les notes de l\'étape (en bas) et les notes du schéma (options) s\'enregistrent toutes seules. « Exporter » : image, vidéo, PDF à imprimer.', 'Sur téléphone, le bouton en forme de pile ouvre les options (couloirs, zones de jeu, formations…).']],
    tableau: ['Tableau blanc', ['Un terrain vierge pour expliquer une idée tout de suite : mêmes outils que les schémas (joueurs, flèches, zones, étapes, « Jouer »).', 'Rien n\'est enregistré : en quittant, le dessin disparaît. « Garder » le transforme en schéma normal.', 'La gomme en haut efface tout le tableau. Le bouton aux quatre coins met en plein écran (ordinateur, tablette, Android).', 'Les options (bouton en forme de pile) changent le terrain : foot à 11, à 8, à 5 ou zone libre.']],
    joueur: ['Fiche joueur', ['Présence à l\'entraînement sur la saison (séances où l\'appel a été fait), matchs, minutes, buts, passes et notes.', '« Modifier » ouvre ses informations : numéro, poste, téléphones des parents, infos santé.', 'Les minutes se saisissent dans chaque match joué, rubrique « Temps de jeu ».']],
    president: ['Tableau de bord', ['Les chiffres de la saison pour tout le club, et le détail par catégorie (licenciés, encadrants, présence, résultats).', '« À surveiller » liste ce qui demande une action : catégorie sans éducateur, match sans score, joueurs sans téléphone.', 'Sauvegardes : le serveur copie les données chaque lundi (8 semaines gardées). Tu peux aussi télécharger une copie à garder en lieu sûr, jamais sur GitHub.']],
    licences: ['Licences et cotisations', ['Touche une case pour changer son état : licence, certificat ou questionnaire santé, cotisation, droit à l\'image. Le montant payé s\'écrit à droite.', '« Seulement ceux qui ne sont pas en règle » : la liste de ceux à relancer.', 'Les coachs voient ⚠️ dans les convocations pour un joueur dont la licence est en attente ou le certificat à fournir. Les cotisations restent entre responsables.', '« Excel » télécharge le tableau.']],
    import: ['Import AssistCoachAI', ['Réglages ou Entraînements → « Recevoir un fichier » : choisis le fichier exporté d\'AssistCoachAI. Joueurs, matchs, entraînements, présences, compos, stats, blessures, bien-être et championnats arrivent dans l\'appli.', 'Rien n\'est ajouté deux fois : les joueurs et les matchs déjà là (import FFF) sont complétés. Un fichier plus récent peut être réimporté.']],
    tests: ['Tests physiques', ['Choisis l\'équipe et le test (VMA, VIFT 30-15, Yo-Yo, sprints, détente, agilité, jongles…) : classement, progrès depuis le test d\'avant.', '« Nouvelle séance de tests » : toute l\'équipe dans un seul tableau.', '« Importer » : un fichier Excel ou CSV d\'une autre plateforme (GPS, appli de tests, tablette). L\'appli reconnaît les joueurs et les colonnes ; tu vérifies avant d\'importer.', 'Avec la VMA ou la VIFT : les allures de course de chaque joueur (15-15, 30-30…).']],
    bilan: ['Bilan de saison', ['Pour une équipe : résultats, buteurs, passeurs, et pour chaque joueur les matchs, minutes, buts, présence, évaluation et jours de blessure.', '« Le mot du coach » s\'ajoute au bilan PDF, à remettre au club ou aux parents.', '« Sauvegarder la saison » enregistre toutes les données du club dans un fichier, à garder avant de repartir sur la saison suivante.']],
    codes: ['Codes personnels', ['Chaque licencié a un code de 8 caractères : il ouvre sa page (joueur ou parents) et seulement la sienne, avec les matchs et séances de sa catégorie. Sans code, on ne voit rien.', 'Remets le code en main propre (ou imprime les cartes : nom, code et QR code de la catégorie), puis coche « Remis ». Pour un coach, le code quitte alors sa liste ; le responsable du club les garde tous.', '« ✓ activé » : la famille a ouvert son espace (tu reçois une notification). « ⏳ pas encore activé » : touche « Relancer » pour lui envoyer un message.', 'Le QR code de la catégorie s\'affiche au club ou s\'envoie aux familles : on le scanne, puis on tape son code. Un code perdu ou qui a circulé : le responsable en fait un nouveau (↻), l\'ancien ne marche plus.']],
    systemes: ['Séances par système de jeu', ['Des séances prêtes, classées par système (4-3-3, 4-2-3-1, 4-4-2…) et par format : avec ballon, sans ballon, transitions.', 'Chaque exercice a son schéma animé : touche-le pour le voir en grand, avec l\'organisation et les consignes à montrer aux joueurs.', '« Utiliser cette séance » : elle est créée pour la catégorie et la date choisies, avec un échauffement et un retour au calme.']],
    gestion: ['Gestion du club', ['« À faire » : ce qui manque pour les deux semaines à venir (arbitres, bénévoles, convocations, éducateurs, scores). Touche une ligne pour t\'en occuper.', 'Tous les outils du responsable rangés par thème : les personnes, l\'organisation, le sportif, la communication, les données.', '« Mes rôles » : passe en coach, bénévole, arbitre, joueur ou parent avec ton code, pour voir l\'appli comme eux. Le bandeau en haut te ramène en responsable.']],
    arbitres: ['Arbitres du club', ['Les dirigeants avec le rôle « Arbitre du club » (ou « Arbitre bénévole ») donnent leurs disponibilités pour dépanner sur les matchs officiels à domicile, toutes catégories : ✅ Dispo ou ❌ Pas dispo.', '« Un match où j\'arbitre » : leurs désignations officielles ailleurs (district, ligue). Ce jour-là, ils sont notés pas dispo.', 'Le coach de la catégorie ou le responsable voit qui est dispo, choisit l\'arbitre du match (il reçoit un message) ou « Appeler les arbitres » s\'il n\'y a personne.']],
    benevoles: ['Bénévoles', ['Pour chaque match des 4 semaines : les tâches (buvette, arbitre de touche, délégué, table de marque, lavage des maillots…) et qui s\'en occupe.', '« Je m\'inscris » en un geste, ou « Inscrire quelqu\'un » pour un parent qui a dit oui. Les parents peuvent aussi s\'inscrire depuis leur page.', 'La veille, les dirigeants inscrits reçoivent un rappel sur leur téléphone.', 'Le responsable choisit les tâches et le nombre de personnes (« Les tâches »).']],
    exercices: ['Exercices du club', ['Tous les exercices écrits par les coachs du club dans leurs séances (avec leur schéma), plus une base d\'exercices classiques. Filtre par thème et par catégorie, ou cherche un mot.', '« Ajouter à une séance » copie l\'exercice dans une de tes séances à venir.', '« Générer une séance » : un thème, une catégorie, une durée → échauffement, exercices du thème, jeu à thème, retour au calme. Les exercices du club passent en premier ; tout se modifie ensuite.', 'Une séance réussie ? En bas de la séance : « Enregistrer comme séance type » pour la partager avec toutes les catégories.']],
    progression: ['Progression', ['Deux ou trois évaluations par saison (début, milieu, fin) : 4 domaines, 3 critères chacun, de 1 à 5 étoiles. La dernière évaluation est reprise : on ne change que ce qui a bougé.', '« Évaluer les restants » enchaîne les joueurs de l\'équipe pas encore évalués cette saison.', 'Sur la fiche du joueur : le radar (en pointillés la fois d\'avant), la courbe de progression, 1 à 3 objectifs personnels.', '« Bulletin » crée un PDF à remettre au joueur ou aux parents.']],
    infirmerie: ['Infirmerie', ['Tous les joueurs indisponibles aujourd\'hui (blessés, malades, absents, suspendus), avec leur date de retour. « De retour » les remet disponibles.', 'Sur la fiche d\'un joueur : « Indisponible » pour déclarer une blessure (où, combien de temps), une absence ou une suspension.', 'À la convocation et à l\'appel, un joueur indisponible ce jour-là a un signe 🚑 ✈️ 🤒 ou 🟥 devant son nom.', 'Charge : après une séance, note l\'effort de chaque joueur de 1 à 10. ⚠️ signale ceux dont les 7 derniers jours sont bien plus lourds que d\'habitude.']],
    direct: ['Match en direct', ['Avant le match : touche les titulaires. Puis « Début », les pauses entre les périodes (mi-temps, quart-temps ou sets), « Fin du match ».', 'Un bouton par événement (but, but encaissé, changement, cartons, occasion, blessure, note) : la minute se note toute seule, tu choisis les joueurs tout de suite ou plus tard.', 'À la fin : le score, les buteurs, les passeurs et le temps de jeu de chaque joueur sont mis sur la page du match.', 'Le chrono continue même si tu fermes l\'appli, et tous les coachs voient le même direct.', 'Vidéo du match : dans l\'analyse, touche « C\'est le coup d\'envoi » au bon moment de la vidéo, puis « Créer les séquences ».']],
    prepa: ['Préparation du match', ['7 étapes, dans l\'ordre de la semaine : Semaine (les séances avant le match, J-1 créée en un geste), Adversaire, Plan de jeu, Causerie, Jour J, Mi-temps, Après-match. Tout est enregistré avec le match : les autres coachs de la catégorie voient le même plan.', 'Les propositions (« + … ») remplissent les cases en un geste ; tu peux toujours écrire toi-même.', '« Lancer la causerie » affiche tout en plein écran, une page après l\'autre, avec le chrono de la causerie (glisse ou touche les flèches).', '« Résumé aux joueurs » prépare un message (horaires, objectif, 3 clés) à coller dans WhatsApp.', 'Jour J : le déroulé est calculé depuis l\'heure du coup d\'envoi ; coche l\'échauffement et le matériel au fur et à mesure.']],
    analyse: ['Analyse vidéo', ['Lance la vidéo et touche une action (But, Occasion, Perte de balle…) au moment où elle arrive : une séquence est créée, de quelques secondes avant à quelques secondes après (réglable).', 'Sous chaque séquence : ajuste le début et la fin sur l\'image affichée, écris un commentaire, choisis les joueurs concernés (choisis d\'abord le match analysé).', '« Dessins sur la vidéo » : mets la vidéo au bon moment, choisis un outil (Marquer les joueurs, Projecteur, Vision du joueur, Déplacer un joueur, Formation, Espace de formation, Espace, Forme libre, Étiquette, Minuteur, Zoom) et touche l\'image. Chaque dessin reste quelques secondes, avec un arrêt sur image si tu veux, et se retrouve dans la présentation et la vidéo du briefing.', '« Titre de phase » (Récupération, Possession…) s\'affiche dans le coin de l\'image. « Tableau tactique sur l\'image » ouvre l\'image dans le tableau tactique.', '« Ajouter à un briefing » rassemble des séquences de plusieurs vidéos. Les vidéos et les briefings restent sur cet appareil.']],
    briefing: ['Briefing vidéo', ['« Présenter » passe les séquences en plein écran, avec le titre et le commentaire de chacune (flèches du clavier pour avancer).', '« Télécharger » → « Vidéo à regarder partout » crée un seul fichier vidéo à envoyer sur WhatsApp : garde l\'appli ouverte pendant la création, qui dure le temps de la vidéo.', '« Télécharger » → « Briefing à rouvrir dans l\'appli » enregistre le briefing avec ses vidéos dans un fichier (Fichiers, Drive, clé USB, ordinateur). Sur l\'autre appareil : Bibliothèque → Mes briefings → « Importer un briefing ».', 'Change l\'ordre avec les flèches, retire une séquence avec la croix.']],
    vestiaires: ['Vestiaires', ['Une colonne par vestiaire (Vestiaire 1, 2, Karaté 1, Karaté 2) pour le jour choisi. Touche une case vide pour attribuer un vestiaire à une catégorie ou à l\'équipe adverse (🆚).', 'Matchs à domicile : « Attribuer » donne un vestiaire à notre équipe et un à l\'adversaire, du rendez-vous jusqu\'après les douches. « Tous les matchs du jour » le fait pour tous.', '« Chaque semaine » garde le même vestiaire pour les entraînements d\'une catégorie jusqu\'à la fin de la saison.', 'Un vestiaire ne peut pas être donné deux fois en même temps. Touche un vestiaire occupé pour le libérer.']],
    encadrement: ['Qui encadre ?', ['Tous les matchs et séances de la semaine, avec leurs encadrants. ⚠️ Personne : il manque un encadrant.', '« J\'y serai » t\'ajoute comme encadrant, « Je n\'y serai pas » te retire.', '« Déclarer une absence » : tes vacances ou indisponibilités, visibles par les autres dirigeants. Un responsable peut en déclarer pour n\'importe qui.']],
    entrainements: ['Séances', ['Le plus simple : « Générer une séance » (un thème, une catégorie, une durée) ou « Séances par système de jeu » : la séance est prête, avec ses schémas animés.', 'Pour l\'écrire toi-même : « Nouvel entraînement » (un thème, une date, une équipe), puis ajoute les exercices.', 'Une fiche papier ou un PDF : « Importer une fiche PDF » ou « Depuis un fichier » : les exercices sont lus et repris.', '« Séances types du club » : les séances partagées par les coachs. « Utiliser » la copie pour ta catégorie et ta date.']],
    entrainement: ['Une séance', ['1. Ajoute les exercices : « Ajouter un exercice », « Exercices du club » ou « Depuis un fichier ». Chaque exercice est une carte : touche-la (« Ouvrir ») pour écrire l\'organisation et les consignes, et voir son schéma animé.', '2. Le jour J : coche les présents d\'un toucher (ou « Tous présents »), puis note-les avec les étoiles.', '3. « PDF » fait la fiche à imprimer ou à envoyer, avec le schéma de chaque exercice étape par étape. « Envoyer » la transmet à un autre coach.', 'Après la séance (en bas) : notes des joueurs, effort, documents, photos et vidéos.']],
    matchs: ['Matchs', ['« Importer » : colle le calendrier copié sur le site de ta fédération ou de ton district (mois par mois), ou choisis un fichier d\'agenda (.ics) ou un tableur (.csv). La catégorie est trouvée toute seule et le terrain peut être réservé pour les matchs à domicile.', '« Nouveau match » : adversaire, date, domicile ou extérieur.', 'Les résultats s\'affichent avec leur smiley.']],
    jourj: ['Jour de match', ['Tout le match en 5 étapes, dans l\'ordre : les convoqués, la composition, la causerie, le match en direct, le résumé aux parents.', 'Touche un prénom pour le convoquer, puis « Envoyer la convocation » (WhatsApp ou la messagerie du club).', 'Pendant le match : « Suivre le match en direct ». Le chrono, les buts et le temps de jeu se notent tout seuls, même sans réseau.', 'À la fin : « Envoyer le résumé aux parents ». Le score et les buteurs sont déjà écrits, ajoute ton mot.']],
    match: ['Un match', ['En haut, le résumé du match : « Modifier » pour changer la date, l\'heure, le lieu ou l\'adversaire. Puis 4 onglets : Avant, Compo, Pendant, Après.', 'Avant : coche les convoqués et choisis les encadrants.', 'Envoie la convocation avec le lien des parents : ils répondent présent ou absent, les réponses s\'affichent sous les convoqués.', 'Match à l\'extérieur : le covoiturage range les enfants dans les voitures des parents, et s\'envoie sur WhatsApp.', 'Match joué : « Temps de jeu » note les minutes de chaque joueur (total sur sa fiche et dans Stats). ⏱️ signale ceux qui ont peu joué cette saison.', '« Relancer les sans réponse » prépare le message WhatsApp pour les parents qui n\'ont pas répondu.', '« Photos pour les parents » : choisis les photos du match à montrer sur leur page (droit à l\'image respecté).', '« Faire la composition » place les joueurs sur le terrain.', 'Coche « Le match est joué », règle le score, les buteurs et les passeurs, puis note les joueurs.', '« Feuille de match » fait le PDF à imprimer.']],
    stats: ['Résultats et stats', ['En haut, deux onglets : « Tout le club » (les résultats de toutes les catégories, week-end par week-end) et « Par équipe ».', 'Par équipe : classement officiel, résultats et agenda de la poule, coupes à part, puis le tableau des joueurs (touche un titre de colonne pour trier).']],
    club: ['Vie du club', ['Événements : organise une réunion, un tournoi ou un déjeuner. Chaque coach répond « Je viens » ou « Je ne viens pas » ; touche l\'événement pour voir qui vient.', 'Signalements : objet perdu, matériel cassé ou souci d\'organisation, avec jusqu\'à 3 photos. Tout le monde peut commenter ; celui qui a signalé (ou un responsable) passe le statut à « En cours » puis « Résolu ».', 'En cochant « Prévenir tous les coachs », un message part aussi dans « Tout le club ».']],
    resultats: ['Résultats du club', ['Tous les matchs joués par toutes les catégories, rangés par week-end, pour toute la saison.', 'Les scores officiels arrivent tout seuls de la FFF ; un éducateur peut aussi noter un score dans Matchs → le match.', 'L\'onglet « Par équipe » donne le détail : classement, poule, coupes, joueurs.', '« Partager le dernier week-end » envoie le récapitulatif sur WhatsApp.']],
    planning: ['Planning du terrain', ['« Chaque semaine » réserve ton créneau d\'entraînement toutes les semaines jusqu\'au 30 juin, en une fois. Les semaines déjà prises sont listées.', 'Touche une case vide du planning (ou « Réserver ») pour prendre un créneau : date, heure de début et de fin, grand terrain ou demi-terrain, entraînement ou match.', 'Pas besoin de connaître l\'adversaire : il suffit de l\'horaire.', 'Un grand terrain bloque tout le terrain. Deux demi-terrains peuvent être utilisés en même temps (A et B).', 'L\'appli refuse tout chevauchement, même si deux coachs réservent en même temps.', 'Touche une réservation pour la libérer ou préparer la séance ou la fiche match.', 'Le responsable fixe les créneaux disponibles de la semaine.']],
    messages: ['Messages', ['« Tout le club » : pour tous les éducateurs.', 'Chaque catégorie a sa conversation.', '« Écrire à un éducateur » ouvre une conversation privée.', 'Les nouveaux messages arrivent tout seuls ; le chiffre rouge dans le menu indique ceux que tu n\'as pas lus.', 'Écris @ puis le prénom d\'un coach (une liste s\'ouvre) : il reçoit une notification tout de suite, même s\'il a coupé celles des messages.', 'Accusés de lecture : ✓ envoyé, ✓✓ lu (message privé) ; « Vu par » sous ton dernier message dans une catégorie ou Tout le club.', 'Notifications sur le téléphone : Réglages → Mon compte → Activer les notifications.']],
    reglages: ['Réglages', ['Deux parties : « Moi » (mon compte, mes notifications, l\'aide) et « Le club » (serveur, invitations, fichiers, et pour les responsables : le club, les comptes des dirigeants).', 'Recevoir un fichier : licenciés ou données d\'un autre éducateur.', 'Les données se partagent toutes seules par le serveur du club. « Envoyer toutes mes données » fait une sauvegarde.', 'Inviter les éducateurs : un lien à envoyer par WhatsApp pour leur première connexion.', 'Le responsable gère les comptes des dirigeants et l\'e-mail qui reçoit les signalements.', 'Mon compte : ajoute ton téléphone si tu veux, et choisis qui le voit (les responsables, tous les éducateurs, ou aussi les parents de tes catégories).']],
    bibliotheque: ['Bibliothèque', ['« Importer » : choisis une vidéo, un montage, un PDF ou une image (Fichiers, Photos…).', 'Vidéo : mets sur pause puis « Dessiner sur cette image ».', 'PDF : « Créer une séance » ou « Dessiner sur cette page ».', '« Joindre… » ajoute le fichier à une séance ou à un match.']],
  };
  const pageKey = () => (location.hash || '#/').split('/')[1] || '';
  function open(key = pageKey()) {
    const [title, tips] = PAGES[key] || PAGES[''];
    modal({ title: `Aide · ${title}`, noFocus: true,
      body: `<ul class="help-list">${tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
        <div class="help-actions">
          <button class="big-act" data-h="bug">🐞<b>Signaler un problème sur cette page</b><span>Le responsable le reçoit dans ses messages</span></button>
          <button class="big-act" data-h="tour">${I.help}<b>Revoir le guide</b><span>Les bases en 8 écrans</span></button>
          <button class="big-act" data-h="idea">💡<b>Proposer une idée</b><span>Une amélioration, une demande</span></button>
        </div>`,
      onOpen: (r, close) => $$('[data-h]', r).forEach(b => b.onclick = () => { close(); const h = b.dataset.h; setTimeout(() => h === 'tour' ? tour() : report(h), 60); }) });
  }
  /* « Comment ça marche ? » : open at the first visit of a page; afterwards only a « ? » next to the page's title (1.37).
     « J'ai compris » closes it. */
  const GUIDE_KEY = 'guide-seen', guideOpen = {};
  const seen = () => { try { return JSON.parse(localStorage.getItem(GUIDE_KEY)) || {}; } catch (e) { return {}; } };
  const setSeen = (k, n) => { const s = seen(); s[k] = n; try { localStorage.setItem(GUIDE_KEY, JSON.stringify(s)); } catch (e) {} };
  function visit() { const k = pageKey(), n = seen()[k] || 0; if (n < 9) setSeen(k, n + 1); guideOpen[k] = (seen()[k] || 0) <= 1; }
  /* (3.67) « Cette page t'aide ? » : one vote per person and per page, kept with the club's messages (the responsables see the totals) */
  const voteId = key => 'avis-' + ((Auth.current() || {}).id || 'x') + '-' + (key || 'accueil');
  const myVote = key => { const r = Store.get('reports', voteId(key)); return r ? r.value : ''; };
  function vote(key, title, value) {
    const u = Auth.current();
    Store.upsert('reports', { id: voteId(key), type: 'avis', value, page: title, key: key || 'accueil', at: Date.now(), by: u ? u.id : null, byName: u ? Store.fullName(u) : '', status: 'new', text: '' });
    toast(value === 'up' ? 'Merci ! 👍' : 'Merci. Dis-nous ce qui manque avec « Aide · signaler un problème ».');
  }
  // the totals by page for the responsables
  function votesHtml() {
    const by = {}; Store.state.reports.filter(x => x.type === 'avis').forEach(x => { const b = by[x.page] = by[x.page] || { up: 0, down: 0 }; b[x.value === 'up' ? 'up' : 'down']++; });
    const rows = Object.entries(by).sort((a, b) => (b[1].down - b[1].up) - (a[1].down - a[1].up));
    return rows.length ? `<h3 class="sub-h">Avis sur les pages</h3><div class="vote-list">${rows.map(([pg, v]) => `<div><span>${esc(pg)}</span><b class="v-up">👍 ${v.up}</b><b class="v-down">👎 ${v.down}</b></div>`).join('')}</div>` : '';
  }
  function guideInto(root) {
    if (!root || document.body.classList.contains('editing') || !Auth.current()) return;
    const key = pageKey(), p = PAGES[key]; if (!p || root.querySelector(':scope > .page-guide, :scope > * > .page-guide')) return;
    if (!guideOpen[key]) { // a « ? » next to the title opens it
      const h = root.querySelector(':scope > .page-head h1'); if (!h || h.querySelector('.pg-q')) return;
      const q = document.createElement('button'); q.type = 'button'; q.className = 'pg-q'; q.textContent = '?'; q.title = 'Comment ça marche ?'; q.setAttribute('aria-label', 'Comment ça marche ?');
      q.onclick = e => { e.preventDefault(); e.stopPropagation(); q.remove(); guideOpen[key] = true; guideInto(root); };
      h.appendChild(q); return;
    }
    const el = document.createElement('details'); el.className = 'card page-guide'; el.open = true;
    el.innerHTML = `<summary><span class="pg-ic">💡</span><b>Comment ça marche ?</b><span class="muted small">${esc(p[0])}</span></summary>
      <ol>${p[1].map(t => `<li>${esc(t.replace(/^\d\.\s*/, ''))}</li>`).join('')}</ol>
      <div class="pg-vote"><span>Cette page t'aide ?</span>${['up', 'down'].map(v => `<button type="button" class="btn soft ${myVote(key) === v ? 'on' : ''}" data-pg="${v}" aria-label="${v === 'up' ? 'Oui' : 'Non'}">${v === 'up' ? '👍' : '👎'}</button>`).join('')}</div>
      <div class="pg-act"><button type="button" class="btn soft" data-pg="ok">J'ai compris</button><button type="button" class="btn soft" data-pg="more">${I.help}<span>Aide · signaler un problème</span></button></div>`;
    el.ontoggle = () => { guideOpen[key] = el.open; };
    el.onclick = e => { const b = e.target.closest('[data-pg]'); e.stopPropagation(); if (!b) return;
      if (b.dataset.pg === 'up' || b.dataset.pg === 'down') { vote(key, p[0], b.dataset.pg); el.querySelectorAll('.pg-vote .btn').forEach(x => x.classList.toggle('on', x === b)); return; }
      if (b.dataset.pg === 'ok') { setSeen(key, 9); guideOpen[key] = false; el.remove(); guideInto(root); } else open(key); };
    const head = root.querySelector(':scope > .page-head'); if (head) head.after(el); else root.prepend(el);
  }
  function button() {
    let b = document.getElementById('helpFab');
    if (!b) { b = document.createElement('button'); b.id = 'helpFab'; b.className = 'help-fab'; b.setAttribute('aria-label', 'Aide'); b.innerHTML = `${I.help}<span>Aide</span>`; b.onclick = () => open(); document.body.appendChild(b); }
    b.hidden = true; // (1.37) one round button only (« + »): the help is in « Plus » and in the « ? » of each page
    b.innerHTML = `${I.help}<span>Aide · Signaler</span>`;
  }

  /* ---------- reports ---------- */
  const TYPES = { bug: ['🐞', 'Problème'], idea: ['💡', 'Idée'], question: ['❓', 'Question'] };
  function diagnostics() {
    const u = Auth.current();
    return { version: VERSION, page: location.hash || '#/', device: navigator.userAgent, screen: `${screen.width}×${screen.height} (${innerWidth}×${innerHeight})`,
      standalone: matchMedia('(display-mode: standalone)').matches || !!navigator.standalone, by: u ? Store.fullName(u) : '', role: u ? u.role || '' : '', errors: errors().slice(-5) };
  }
  const pageTitle = (key = pageKey()) => (PAGES[key] || PAGES[''])[0];
  function textOf(rep) {
    const d = rep.diag || {};
    return [`${TYPES[rep.type][0]} ${TYPES[rep.type][1]} – ${AppCfg.name}${rep.page ? ' · page « ' + rep.page + ' »' : ''}`, `De : ${rep.byName || '?'}${d.role ? ' (' + d.role + ')' : ''}`, `Date : ${new Date(rep.at).toLocaleString('fr-FR')}`, '',
      rep.text, rep.context ? `\nCe que je faisais : ${rep.context}` : '',
      rep.withDiag ? `\n--- Infos techniques ---\nVersion ${d.version} · page ${d.page}\nÉcran ${d.screen} · appli installée : ${d.standalone ? 'oui' : 'non'}\n${d.device}${(d.errors || []).length ? '\nErreurs récentes :\n' + d.errors.map(e => `- ${e.at.slice(0, 16)} ${e.msg} (${e.src} ${e.page})`).join('\n') : ''}` : ''].join('\n');
  }
  function report(type = 'bug') {
    const email = Store.state.club.reportEmail || '', page = pageTitle(), toAdmins = Cloud.ready() && !Auth.isAdmin();
    let shot = '';
    modal({ title: 'Signaler ou proposer', body: `
      <p class="muted small">📍 Page : <b>${esc(page)}</b> (ajoutée toute seule au message)</p>
      <div class="chips" id="repType">${Object.entries(TYPES).map(([k, [e, l]]) => `<button class="chip ${k === type ? 'on' : ''}" data-v="${k}">${e} ${l}</button>`).join('')}</div>
      <label class="fld" style="margin-top:12px"><span>Explique en quelques mots</span><textarea id="repText" rows="5" placeholder="ex : quand je touche « Jouer », les joueurs ne bougent pas"></textarea></label>
      <label class="fld"><span>Ce que tu faisais juste avant (facultatif)</span><input id="repCtx" placeholder="ex : j'étais sur le schéma de la séance U13"></label>
      <div class="rep-shot"><button class="btn soft" type="button" id="repShot">${I.image}<span>Ajouter une capture d'écran</span></button><span id="repShotView"></span></div>
      <p class="muted small">Astuce : fais une capture d'écran du problème avec ton téléphone, puis ajoute-la ici.</p>
      <label class="switch"><input type="checkbox" id="repDiag" checked><span>Joindre les infos techniques (version, appareil, erreurs)</span></label>
      <p class="tip">${toAdmins ? 'Le message part tout de suite aux responsables du club, dans <b>Signalements et idées</b> (pas dans la messagerie), avec une notification.' : Auth.isAdmin() ? 'Tu es responsable : le message est gardé dans Tableau de bord → Signalements.' : 'Le message est gardé dans l\'appli et part au serveur du club au retour du réseau.'}${email ? ` « E-mail » l'envoie aussi à ${esc(email)}.` : ''}</p>`,
      onOpen: r => {
        $$('#repType .chip', r).forEach(b => b.onclick = () => { $$('#repType .chip', r).forEach(x => x.classList.remove('on')); b.classList.add('on'); });
        // a screenshot, made light (it travels with the report)
        $('#repShot', r).onclick = async () => {
          const [f] = await UI.pickFiles({ accept: 'image/*' }); if (!f) return;
          try { const img = await Media.loadImage(URL.createObjectURL(f)); shot = Media.drawScaled(img, img.naturalWidth, img.naturalHeight, 900).toDataURL('image/jpeg', .6);
            $('#repShotView', r).innerHTML = `<img alt="Capture jointe" src="${shot}">`; } catch (e) { toast('Image illisible', 'err'); }
        };
      },
      actions: [
        { label: 'Partager', icon: I.share, onClick: (c, r) => send(r, 'share', page, shot) },
        ...(email ? [{ label: 'E-mail', icon: I.upload, onClick: (c, r) => send(r, 'mail', page, shot) }] : []),
        { label: toAdmins ? 'Envoyer au responsable' : 'Enregistrer', kind: 'primary', icon: I.check, onClick: (c, r) => send(r, 'app', page, shot) },
      ] });
  }
  // (2.14) the report is no longer a private message: it is kept with the club's data (synced) and lands in « Signalements et idées »;
  // the club server sends the responsables a notification when it arrives
  const deliver = () => Promise.resolve(1);
  function send(r, how, page, shot) {
    const text = $('#repText', r).value.trim();
    if (!text) { toast('Écris d\'abord ton message', 'err'); return false; }
    const u = Auth.current();
    const rep = { id: Store.uid(), type: $('#repType .on', r).dataset.v, text, context: $('#repCtx', r).value.trim(), withDiag: $('#repDiag', r).checked, diag: diagnostics(),
      at: Date.now(), by: u ? u.id : null, byName: u ? Store.fullName(u) : '', status: 'new', page: page || pageTitle() };
    if (shot) rep.shot = shot;
    Store.upsert('reports', rep);
    const body = textOf(rep), subject = `[${AppCfg.name}] ${TYPES[rep.type][1]} de ${rep.byName || 'un éducateur'}`;
    if (how === 'mail') location.href = `mailto:${encodeURIComponent(Store.state.club.reportEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.slice(0, 1800))}`;
    else if (how === 'share') {
      if (navigator.share) navigator.share({ title: subject, text: body }).catch(() => {});
      else if (navigator.clipboard) navigator.clipboard.writeText(body).then(() => toast('Message copié : colle-le dans WhatsApp ou un mail')).catch(() => {});
    }
    if (how === 'app' && Cloud.ready() && !Auth.isAdmin()) {
      deliver(rep).then(() => { if (typeof Sync !== 'undefined' && Sync.now) Sync.now(); toast('Merci ! Les responsables le reçoivent dans « Signalements et idées »'); }).catch(() => toast('Merci ! Ton message est enregistré'));
    } else toast('Merci ! Ton message est enregistré');
  }

  /* ---------- settings: report e-mail + received reports ---------- */
  function settingsSection() {
    const c = Store.state.club, admin = Auth.isAdmin(), reps = Store.state.reports.filter(x => !x.life && x.type !== 'avis').sort((a, b) => b.at - a.at); // (items with `life` belong to « Vie du club »)
    return `<section class="card"><h2>${I.help}Aide et signalements</h2>
      <div class="chips"><button class="btn" data-help="tour">${I.help}<span>Revoir le guide</span></button>
      <button class="btn" data-help="bug">🐞<span>Signaler un problème</span></button><button class="btn" data-help="idea">💡<span>Proposer une idée</span></button></div>
      ${admin ? `<label class="fld" style="margin-top:14px"><span>E-mail qui reçoit les signalements des éducateurs</span><input id="repEmail" type="email" inputmode="email" value="${esc(c.reportEmail || '')}" placeholder="ton.adresse@exemple.fr"></label>
        <p class="muted small">Cet e-mail est transmis aux autres éducateurs avec « Envoyer toutes mes données ». Les messages enregistrés sur leur appareil te reviennent aussi quand ils t'envoient leurs données.</p>
        ${votesHtml()}
        <p style="margin-top:12px"><a class="btn primary" href="#/signalements">🐞<span>Signalements et idées (${reps.filter(x => x.status !== 'done').length} à traiter)</span></a></p>
        ${false ? `<div class="rep-list">${reps.map(x => `<details class="rep ${x.status === 'done' ? 'done' : ''}"><summary><span>${TYPES[x.type][0]}</span><b>${esc(x.text.slice(0, 70))}${x.text.length > 70 ? '…' : ''}</b><span class="muted small">${esc(x.byName || '?')} · ${new Date(x.at).toLocaleDateString('fr-FR')}</span></summary>
          <pre>${esc(textOf(x))}</pre>${x.shot ? `<img class="rep-img" alt="Capture d'écran" src="${x.shot}">` : ''}<button class="btn" data-repdone="${x.id}">${x.status === 'done' ? 'Marquer à traiter' : 'Marquer comme traité'}</button></details>`).join('')}</div>` : '<p class="muted">Aucun message pour l\'instant.</p>'}` : ''}
    </section>`;
  }
  function onSettings(root, rerender) {
    const inp = $('#repEmail', root); if (inp) inp.onchange = () => { Store.state.club.reportEmail = inp.value.trim(); Store.save(); toast('E-mail enregistré'); };
    $$('[data-help]', root).forEach(b => b.onclick = e => { e.stopPropagation(); b.dataset.help === 'tour' ? tour() : report(b.dataset.help); });
    $$('[data-repdone]', root).forEach(b => b.onclick = e => { e.stopPropagation(); const x = Store.get('reports', b.dataset.repdone); x.status = x.status === 'done' ? 'new' : 'done'; Store.upsert('reports', x); rerender(); });
  }

  /* ---------- (2.14) « Signalements et idées »: problems, ideas and questions together, apart from the messages ----------
     A responsable sees everything (to handle); a coach sees his own and whether they were handled. */
  const listOf = () => { const me = Auth.current(), admin = Auth.isAdmin();
    return Store.state.reports.filter(x => !x.life && x.type !== 'avis' && TYPES[x.type] && (admin || (me && x.by === me.id))).sort((a, b) => b.at - a.at); };
  const toDo = () => Auth.isAdmin() ? listOf().filter(x => x.status !== 'done').length : 0;
  function inboxBadge() {
    const n = toDo(); document.querySelectorAll('a[href="#/signalements"]').forEach(a => { if (!a.closest('#nav, .more-item, .rail, nav')) return;
      let b = a.querySelector('.nav-badge'); if (!b) { b = document.createElement('i'); b.className = 'nav-badge'; a.appendChild(b); } b.textContent = n > 9 ? '9+' : n; b.hidden = !n; });
  }
  let flt = { type: '', st: 'todo' };
  function inbox(root) {
    const admin = Auth.isAdmin(), all = listOf(), me = Auth.current();
    const list = all.filter(x => (!flt.type || x.type === flt.type) && (flt.st === 'all' || (flt.st === 'done' ? x.status === 'done' : x.status !== 'done')));
    const n = t => all.filter(x => x.type === t && (flt.st === 'all' || (flt.st === 'done' ? x.status === 'done' : x.status !== 'done'))).length;
    const dm = x => x.by && me && x.by !== me.id ? '#/messages/dm:' + [me.id, x.by].sort().join(':') : '';
    root.innerHTML = `<header class="page-head"><div><h1>🐞 Signalements et idées</h1><p class="sub">${admin ? 'Les problèmes, idées et questions envoyés par les éducateurs, à part des messages' : 'Ce que tu as signalé ou proposé, et où ça en est'}</p></div>
      </header><div class="chips" style="margin-bottom:10px"><button class="btn" data-help="bug">🐞<span>Signaler un problème</span></button><button class="btn primary" data-help="idea">💡<span>Proposer une idée</span></button></div>
      <div class="chips"><button class="chip ${!flt.type ? 'on' : ''}" data-ft="">Tout</button>${Object.entries(TYPES).map(([k, [e, l]]) => `<button class="chip ${flt.type === k ? 'on' : ''}" data-ft="${k}">${e} ${l === 'Idée' ? 'Idées' : l === 'Problème' ? 'Problèmes' : 'Questions'} (${n(k)})</button>`).join('')}</div>
      <div class="chips" style="margin:8px 0 12px"><button class="chip ${flt.st === 'todo' ? 'on' : ''}" data-fs="todo">⏳ À traiter (${all.filter(x => x.status !== 'done').length})</button><button class="chip ${flt.st === 'done' ? 'on' : ''}" data-fs="done">✅ Traités (${all.filter(x => x.status === 'done').length})</button><button class="chip ${flt.st === 'all' ? 'on' : ''}" data-fs="all">Tous</button></div>
      ${list.length ? `<div class="rep-list">${list.map(x => `<section class="card rep-card ${x.status === 'done' ? 'done' : ''}">
        <div class="rep-top"><span class="rep-ic">${TYPES[x.type][0]}</span><div><b>${esc(TYPES[x.type][1])}</b> · <span class="muted small">${esc(x.byName || '?')} · ${new Date(x.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} ${new Date(x.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}${x.page ? ' · page « ' + esc(x.page) + ' »' : ''}</span></div>
          <span class="rep-st ${x.status === 'done' ? 'ok' : ''}">${x.status === 'done' ? '✅ Traité' : '⏳ À traiter'}</span></div>
        <p class="rep-text">${esc(x.text)}</p>${x.context ? `<p class="muted small">Ce qu'il faisait : ${esc(x.context)}</p>` : ''}
        ${x.shot ? `<button class="rep-shotbtn" data-repshot="${esc(x.id)}" aria-label="Voir la capture d'écran"><img alt="Capture d'écran" src="${x.shot}"></button>` : ''}
        ${x.withDiag ? `<details class="muted small"><summary>Infos techniques</summary><pre>${esc(textOf(x).split('--- Infos techniques ---')[1] || '')}</pre></details>` : ''}
        ${admin ? `<div class="chips" style="margin-top:8px"><button class="btn ${x.status === 'done' ? '' : 'primary'}" data-repdone="${esc(x.id)}">${x.status === 'done' ? '↩️<span>Remettre à traiter</span>' : '✅<span>Marquer comme traité</span>'}</button>${dm(x) ? `<a class="btn soft" href="${dm(x)}">💬<span>Répondre en message privé</span></a>` : ''}</div>` : ''}
      </section>`).join('')}</div>` : `<p class="empty">${flt.st === 'todo' ? (admin ? 'Rien à traiter 🎉' : 'Rien en attente.') : 'Rien ici.'}</p>`}
      ${admin ? votesHtml() : ''}`;
    $$('[data-ft]', root).forEach(b => b.onclick = () => { flt.type = b.dataset.ft; inbox(root); });
    $$('[data-fs]', root).forEach(b => b.onclick = () => { flt.st = b.dataset.fs; inbox(root); });
    $$('[data-help]', root).forEach(b => b.onclick = () => report(b.dataset.help));
    $$('[data-repdone]', root).forEach(b => b.onclick = () => { const x = Store.get('reports', b.dataset.repdone); x.status = x.status === 'done' ? 'new' : 'done'; x.doneAt = Date.now(); Store.upsert('reports', x); inbox(root); inboxBadge(); });
    $$('[data-repshot]', root).forEach(b => b.onclick = () => { const x = Store.get('reports', b.dataset.repshot); if (x && x.shot) modal({ title: 'Capture d\'écran', body: `<img alt="Capture d'écran" src="${x.shot}" style="width:100%;border-radius:10px">`, actions: [{ label: 'Fermer' }] }); });
    inboxBadge();
  }
  return { watch, tour, tourSeen, open, button, visit, guideInto, report, settingsSection, onSettings, VERSION, TYPES, inbox, inboxBadge };
})();
Help.watch();
