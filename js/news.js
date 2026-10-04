/* News: « Quoi de neuf ? » after each update. The newest first; « n » goes up by one at each update (one entry per update,
   whatever the app: Clubbo or the app of one club). Each line: [icon, what changed, said with a smile]. Bugs fixed too.
   A device that has never seen any news gets the two latest entries once (the phones already in use when this window came, and new installs).
   RULE: every update of the app adds an entry here (the newest at the top). */
const News = (() => {
  const { esc, modal } = UI;
  const LIST = [
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
