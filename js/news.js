/* News: « Quoi de neuf ? » after each update. The newest first; « n » goes up by one at each update (one entry per update,
   whatever the app: Clubbo or the app of one club). Each line: [icon, what changed, said with a smile]. Bugs fixed too.
   A device that has never seen any news gets the two latest entries once (the phones already in use when this window came, and new installs).
   RULE: every update of the app adds an entry here (the newest at the top). */
const News = (() => {
  const { esc, modal } = UI;
  const LIST = [
    { n: 214, date: '2026-10-18', title: 'Les joueurs sont prêts avant le coup d\'envoi 🎒', items: [
      ['🎒', "Espace joueur, sur la carte du prochain match : ce qu'il faut dans le sac et la caisse de l'équipe (ceux choisis pour la convocation)."],
      ['🏃', "L'échauffement aussi : les étapes et leurs minutes (Jour J), avec le nom du capitaine qui le mène."],
      ['🟩', "Et les tableaux que le coach a gardés « Avant-match » sur le tableau du match, en image. La compo, elle, reste pour le vestiaire."],
    ] },
    { n: 213, date: '2026-10-17', title: 'L\x27appli au régime 🥗', items: [
      ['⚡', "L'appli est 20 % plus légère à télécharger : la première ouverture après une mise à jour va plus vite, surtout en 4G au stade."],
      ['🧹', "Le ménage : seules les 30 dernières nouveautés restent dans l'appli, et des fichiers d'outils mis en ligne par erreur sont retirés du site."],
    ] },
    { n: 212, date: '2026-10-17', title: 'Les blocs prennent de la longueur 📏', items: [
      ['📏', "Systèmes de jeu : les 5 hauteurs de bloc sont plus étirées. La ligne de défense reste à sa hauteur (12, 22, 33, 45, 55 m), le milieu et les attaquants montent : attaque à 51 m en bloc très bas, 63 m en bas, 75 m en médian, 85 m en haut, 92 m en très haut. La liste « Bloc » de la compo l'écrit."],
    ] },
    { n: 211, date: '2026-10-17', title: 'Le menu ⋯ remonte à la surface 🤿', items: [
      ['⋯', "Fiche du match : le menu « ⋯ » passait sous les onglets « Compo / Pendant » et se retrouvait coupé. Il s'affiche maintenant en entier, par-dessus."],
      ['🔤', "Compo sur les PDF en économie d'encre : les noms des joueurs s'écrivent en foncé, plus gros, avec un halo blanc, bien lisibles sur le terrain clair."],
    ] },
    { n: 210, date: '2026-10-17', title: 'L\'affiche passe au régime 🖨️', items: [
      ['🌿', "L'affiche du vestiaire (PDF de la préparation) n'est plus une page entièrement bleue : fond blanc, un fin cadre bordeaux, le texte en bleu marine. Les couleurs d'avant restent possibles : Réglages → Impression → « En couleurs »."],
      ['🖨️', "Tout ce qui s'imprime économise l'encre : les PDF, l'affiche, le tableau des licences, et les pages imprimées depuis l'appli (plus aucun fond coloré, texte foncé)."],
      ['🔵', "Tableau du match : nous en bleu, les adversaires en blanc, le ballon orange pour le voir partout."],
    ] },
    { n: 209, date: '2026-10-17', title: 'Le tableau qui se lit au doigt ✍️', items: [
      ['✍️', "Nouveau « 🟩 Tableau » (fiche du match, préparation, jour de match, mode tablette) : un terrain vide en plein écran, ton onze déjà placé avec les noms (la compo du match). Glisse un joueur pour le déplacer, glisse ailleurs pour dessiner : ➡️ course, ⇢ passe, ✏️ trait libre, en 4 couleurs."],
      ["🎯", "Tableau des séances : en mode « Bouger », glisser le doigt sur la pelouse dessine directement une flèche (plus besoin de choisir « Flèche » avant). Glisser un joueur le déplace toujours."],
      ['📸', "↩️ Annuler, 🧹 Effacer, 👥 Adversaires, ⚽ Ballon, ◧ Demi-terrain, 🔄 Replacer. « Garder » le range avec le match (Avant-match, Mi-temps), « Envoyer » en fait une image pour WhatsApp."],
      ['⏱️', "Causerie : la durée suit ce qu'il y a à dire (le temps de la voix et une pause sur chaque diapo), plus forcément 8 minutes. Une durée fixe reste possible dans l'étape Causerie."],
    ] },
    { n: 208, date: '2026-10-17', title: 'L\'iPad est chez lui 📱', items: [
      ['👆', "Sur iPad : boutons, puces, cases et champs plus grands pour le doigt, texte un peu plus gros, un appui se voit, et un appui long n'ouvre plus la bulle « Copier » sur les boutons."],
      ['✏️', "Apple Pencil sur le tableau tactique et sur la vidéo : la main posée sur l'écran ne dessine plus rien, et un deuxième doigt ne vole plus le joueur que tu déplaces."],
      ['🍏', "Les iPad récents (qui se présentent comme un Mac) sont enfin reconnus : la bonne aide pour installer l'appli et recevoir les notifications."],
    ] },
    { n: 207, date: '2026-10-17', title: 'Capitaine, à toi l\'échauffement 🏃', items: [
      ['🏃', "Causerie : le rendez-vous et le coup d'envoi laissent la place à l'échauffement, en fin de causerie, mené par le capitaine (son nom en grand). Les étapes viennent de « Jour J » (celles cochées, sinon toutes) avec leurs minutes, et la voix les lit."],
    ] },
    { n: 206, date: '2026-10-17', title: 'La causerie prend la parole 🎙️', items: [
      ['🎙️', "Causerie plein écran : une voix lit chaque diapo, un coup de sifflet ouvre et ferme, et les diapos défilent seules sur la durée choisie (8 min = chaque diapo sa part, tu parles par-dessus). 🔊 coupe la voix, ⏸ arrête le défilement."],
      ['📋', "Nouvelles diapos : le programme (rendez-vous, coup d'envoi, lieu), le onze de départ avec les numéros et les postes, le banc, et notre forme (5 derniers matchs, la dernière fois contre eux)."],
      ['🧠', "La compo de la causerie montre le nom de chaque joueur sous son maillot, à son poste."],
    ] },
    { n: 205, date: '2026-10-17', title: 'L\'imprimante dit merci 🖨️', items: [
      ['🌿', "Les PDF (séance, feuille de match, préparation…) économisent l'encre : plus de grand bandeau bleu en haut, et les terrains des schémas sont blancs avec des lignes vertes et des flèches foncées."],
      ['🎨', "Envie de couleurs quand même ? Réglages → Impression → « En couleurs »."],
    ] },
    { n: 204, date: '2026-10-16', title: 'Deux options, un coach 🤔', items: [
      ['🔀', "Un peu trop de joueurs pour un jeu, pas assez pour deux : l'appli donne les deux façons, le jeu agrandi (ex. 11 contre 10 sur 60 × 40 m) ou le jeu tel qu'écrit avec rotation. Tu choisis sur le terrain."],
    ] },
    { n: 203, date: '2026-10-16', title: 'Chacun son groupe 🅰️🅱️', items: [
      ['🅰️', "Séance coupée en groupes A et B : chaque exercice s'adapte au groupe A, au groupe B et à tout le monde ensemble, à l'écran comme sur le PDF (plus de « Pour 40 » quand vous êtes 17 et 23)."],
    ] },
    { n: 202, date: '2026-10-16', title: 'La cotisation en plusieurs chèques 🏦', items: [
      ['💶', "Licences et cotisations → 💶 à côté d'un joueur : jusqu'à 5 chèques (numéro, banque, nom sur le chèque, date de dépôt prévue), ou espèces, virement, carte, Pass'Sport. « Préparer les chèques » partage la cotisation en un chèque par mois."],
      ['🏦', "« Chèques à déposer » : ceux du mois, en rouge quand leur date est passée, « ✓ Déposé » d'une touche, et le bordereau pour Excel. Gestion → À faire rappelle les chèques à déposer."],
    ] },
    { n: 201, date: '2026-10-16', title: 'Les licences en PDF 🪪', items: [
      ['📄', "Licences et cotisations → « Exporter en PDF » : toutes les licences, ou seulement certaines catégories, groupes (A, B…) et sous-catégories, à combiner. Une ligne par joueur (n° de licence, statut valide / expirée / en attente, date d'expiration), un total par section et à la fin, « page X / Y »."],
      ['📎', "Le scan de la licence (photo ou PDF) s'ajoute sur la fiche du joueur, et peut suivre le tableau dans le PDF (case « Inclure les scans des licences »)."],
    ] },
    { n: 200, date: '2026-10-16', title: 'Le schéma a la parole 🗣️', items: [
      ['👥', "Un exercice qui n'écrit pas combien de joueurs il faut (« Jeu à 4 portes ») s'adapte quand même à ton effectif : l'appli compte les joueurs de son schéma (3 rouges contre 3 blancs = 3 contre 3), à l'écran comme sur le PDF."],
    ] },
    { n: 199, date: '2026-10-16', title: 'Le PDF sait compter 🧮', items: [
      ['🧮', "PDF de la séance : sous chaque exercice, « Avec ton effectif » dit comment l'organiser pour tes joueurs du jour, et aussi avec 2 de moins ou 2 de plus (ateliers, jokers, taille de la zone, demi-terrain)."],
      ['📏', "« 15 x 10 m » n'est plus lu comme « 15 contre 1 » 😅 : les exercices avec leurs dimensions s'adaptent juste. Un match sans « 6 contre 6 » écrit donne 2 équipes et un joker si vous êtes impairs."],
    ] },
    { n: 198, date: "2026-10-16", title: "Le menu ⋯ sort de l’ombre 🕶️", items: [
      ["⋯", "Le menu « ⋯ » des en-têtes foncés (séance, match…) n’écrivait plus qu’en blanc sur blanc : seuls les émojis résistaient. Le texte est de retour."],
    ] },
    { n: 197, date: '2026-10-14', title: 'Le sifflet dans la poche ⏱️', items: [
      ['⏱️', "Séance d'entraînement → « Lancer la séance » : les exercices défilent avec leur chrono en grand, le nom de l'exercice, ses consignes et le suivant ; sifflet et vibration à chaque changement, 3-2-1 avant, écran allumé. Pause, +1 min, Suivant, Précédent ; ▶️ sur une carte démarre à cet exercice."],
    ] },
    { n: 196, date: '2026-10-13', title: "Pas coach, juste dirigeant 🙂", items: [
      ['👤', "Fiche d'un dirigeant : « Pas de Coach devant son prénom » pour ceux qui n'entraînent pas (trésorière, secrétaire) : la messagerie écrit « Celia », pas « Coach Celia »."],
    ] },
    { n: 195, date: '2026-10-13', title: "Une seule Celia, pour de bon 👯", items: [
      ['🐛', "« Écrire à un éducateur » et les @mentions : une même personne n'apparaît plus qu'une fois, même s'il reste de vieilles copies sur l'appareil."],
    ] },
    { n: 194, date: '2026-10-13', title: "Une seule Celia 👯", items: [
      ['🐛', "Messagerie : un dirigeant pouvait apparaître dix fois dans « Écrire à un éducateur » (vieilles copies gardées sur l'appareil, jamais envoyées au serveur). Une fois par jour, l'appli les retire de l'appareil et garde la vraie fiche, celle qui a un compte."],
    ] },
    { n: 193, date: '2026-10-12', title: "La semaine sans oubli ✅", items: [
      ['✅', "Accueil, « Ma semaine » : 3 jours avant un match, tout ce qui reste à faire (convocation, compo, causerie, points de la FMI) ou « tout est prêt », et l'arbitre quand la FFF l'a désigné."],
    ] },
    { n: 192, date: '2026-10-11', title: 'Groupe A = Seniors A, groupe B = Seniors B 🧩', items: [
      ['🧩', "Groupes de la séance : choisis quelle équipe est le groupe A et le groupe B (Seniors A, Seniors B…). « Selon les équipes » range chaque joueur dans le groupe de son équipe ; les noms des équipes s'affichent partout, jusque dans le message envoyé."],
    ] },
    { n: 191, date: '2026-10-11', title: 'Un message pour un seul groupe 📣', items: [
      ['📣', "Groupes A / B de la séance : « Envoyer au groupe A » (ou B) prévient seulement les joueurs de ce groupe, dans l'appli ou sur WhatsApp, avec un message que tu peux modifier."],
    ] },
    { n: 190, date: '2026-10-11', title: 'Groupes A / B de la séance 🅰️🅱️', items: [
      ['👥', "Dans une séance, « Groupes A / B » : touche un joueur pour le mettre en A, puis en B. Ou « Répartir au hasard » / « Équilibrer par poste ». Les groupes sont aussi dans le PDF de la séance."],
    ] },
    { n: 189, date: '2026-10-11', title: 'Générer une séance pour X joueurs 👥', items: [
      ['✨', "Générer une séance : nouveau champ « Joueurs ». L'aperçu montre chaque exercice adapté (ateliers, jokers, taille du terrain), et la séance garde ce nombre (modifiable à la dernière minute avec − / +)."],
    ] },
    { n: 188, date: '2026-10-11', title: 'Qui vient, qui ne vient pas 🟢🔴', items: [
      ['🗳️', "Séance : le total des réponses en un coup d'œil, à côté des joueurs du jour : les présents en vert, les absents en rouge."],
    ] },
    { n: 187, date: '2026-10-11', title: 'Les exercices s\'adaptent aux joueurs du jour 👥', items: [
      ['👥', "Dans une séance, « Joueurs à la séance » avec − / + : l'appli part des présents (ou des réponses « présent », sinon de l'effectif). Change-le à la dernière minute quand un joueur arrive ou se désiste."],
      ['📐', "Chaque exercice s'adapte : combien d'ateliers, qui joue joker ou tourne, un terrain agrandi ou réduit, et s'il tient dans le demi-terrain (sinon la taille à prendre)."],
    ] },
    { n: 186, date: '2026-10-11', title: 'Une séance, plusieurs types de travail 🔀', items: [
      ['✨', "Générer une séance : touche jusqu'à 3 thèmes (ex. physique + conservation). Le temps du corps de séance est partagé entre eux, chaque exercice dit à quel thème il appartient."],
    ] },
    { n: 185, date: '2026-10-11', title: 'Le compte-rendu complet 📄', items: [
      ['📄', "Compte-rendu du match (PDF) : les notes du coach et le mot du coach (onglet « Après ») y sont tous les deux, chacun avec son titre."],
    ] },
    { n: 184, date: '2026-10-11', title: "Monsieur l'arbitre 🟨", items: [
      ['🟨', "L'arbitre désigné par la FFF s'affiche sur la fiche du match et dans la fiche FMI (relevé sur Footclubs pour les matchs joués du club)."],
    ] },
    { n: 183, date: '2026-10-11', title: 'La compo prend ses aises 🖥️', items: [
      ['🖥️', "Sur ordinateur : le dessin de la compo à gauche, « Qui joue où ? » à droite, et les noms en entier (le poste et le numéro gardent leur taille)."],
    ] },
    // (3.55) only the 30 latest are kept in the app (the file is downloaded by every phone); the older ones are in git
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
  // (2.81) no big window any more: the news wait in a small line on the home page (« Voir » opens them, ✕ closes)
  let pending = [];
  function check() {
    const s = seen();
    const fresh = s ? LIST.filter(e => e.n > s) : LIST.slice(0, 2);
    const pv = Auth.preview(); pending = pv && pv.role !== 'coach' ? brief(fresh) : fresh;
    if (!pending.length) return;
    const tc = document.querySelector('#view .today-card'); if (tc && !document.querySelector('.news-pill')) tc.insertAdjacentHTML('beforebegin', pill());
  }
  const pill = () => pending.length ? `<div class="news-pill"><span>🎉 Nouveautés de la version ${esc(typeof Help !== 'undefined' ? Help.VERSION : '')}</span><button type="button" class="btn small" onclick="News.open()">Voir</button><button type="button" class="np-x" aria-label="Fermer" onclick="News.dismiss()">✕</button></div>` : '';
  function dismiss() { pending = []; setSeen(latest()); document.querySelectorAll('.news-pill').forEach(e => e.remove()); }
  function open() { const l = pending.length ? pending : LIST.slice(0, 1); dismiss(); show(l); }
  const all = () => show(LIST, '📰 Les nouveautés');
  return { check, all, pill, open, dismiss, LIST };
})();
