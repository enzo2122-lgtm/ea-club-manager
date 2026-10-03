# Clubbo

L'appli des clubs de **football, basket, handball, rugby et volley** (le club choisit son sport à la création ; terrains, postes, catégories, scores et exercices s'adaptent) : équipes et catégories, tableau tactique animé, séances et bibliothèque d'exercices, matchs (convocations, match en direct, préparation, causerie), statistiques (matchs officiels et amicaux à part), messagerie, planning des terrains, bénévoles, espaces joueurs et parents avec un code personnel par licencié.

Un seul serveur pour tous les clubs : chaque club ne voit que ses propres données. Le propriétaire de la plateforme remet un **code d'activation** à chaque club qui s'inscrit.

## 1. Le serveur (une seule fois)

1. Sur [supabase.com](https://supabase.com/dashboard) : **New project** (nom : `ea-club-manager`, région : Europe). Garde le mot de passe de la base pour toi.
2. **SQL Editor → New query** : colle tout le fichier `supabase/ea-schema.sql`, puis **Run**. Il doit afficher « Success ».
3. **Project Settings → API** (ou **Connect**) : copie la **Project URL** et la clé **publishable** (jamais la clé secrète), et mets-les dans `js/config.js`.

Pour une mise à jour du serveur : recolle le même fichier et relance **Run** (rien n'est effacé).

## 2. Le site

1. Sur GitHub : un nouveau dépôt public `ea-club-manager`, avec tout le contenu de ce dossier.
2. **Settings → Pages** : branche `main`, dossier `/ (root)`, puis **Save**. L'adresse ressemble à `https://ton-pseudo.github.io/ea-club-manager/`.

## 3. L'espace du propriétaire

Dans les **24 heures** qui suivent l'installation du serveur : ouvre `…/ea-club-manager/#/proprietaire`, écris une clé (au moins 12 caractères) et touche **Première fois : choisir ma clé**. Garde-la en lieu sûr : elle donne la main sur tous les clubs.

Ensuite, dans cet espace :
- **Nouveaux codes** : un code d'activation par club (il ne sert qu'une fois) ;
- la liste des clubs : joueurs, dirigeants, comptes, matchs, dernière activité ;
- **Suspendre / Réactiver** un club (ses données sont gardées).

## 4. Un club s'inscrit

1. Le responsable ouvre l'appli, touche **Créer mon club**, et écrit le code d'activation, le nom du club, un **code du club** (ex. `fc-exemple`) et son compte.
2. Il personnalise le club : blason, couleurs, ville (météo), devise, catégories.
3. Il importe ses données : **Réglages → Le club → Importer des données**. Une photo ou une capture d'écran d'une liste, un PDF (liste de la fédération, calendrier), un fichier Excel / CSV ou un texte copié. Il vérifie et corrige le tableau avant d'importer, sans doublon.
4. Il invite ses éducateurs (**Réglages → Inviter les éducateurs**). Chacun se connecte ensuite partout avec le code du club, son nom, son prénom et son mot de passe.
5. Il remet un **code personnel** à chaque joueur ou à ses parents (**Codes personnels**), avec les cartes à imprimer et le QR code de chaque catégorie.

## Vérifier avant de publier

1. **Les fichiers et le serveur** : `node tools/verifier.js`. Il contrôle la syntaxe, le fichier `js/app.bundle.js` (sinon : `node build.js`), les appels entre modules, les fichiers de l'appli hors ligne, le numéro de version partout, et chaque fonction du serveur appelée par l'appli (avec de faux codes : le serveur refuse tout, rien n'est écrit). Il doit afficher « ✅ Aucun problème trouvé ».
2. **Les pages et les boutons** : `node tools/serveur.js`, puis ouvre http://localhost:8790/tools/verif.html et touche **Lancer la vérification**. Un club inventé est chargé (chaque sport coché), chaque page est ouverte et ses boutons touchés (sauf supprimer, importer, se déconnecter…), en responsable et en coach, sur ordinateur et sur téléphone. Rien n'est envoyé au serveur. Cette page ne marche qu'en local : elle remplace les données de l'appli du navigateur.

Depuis que FA Le Raincy est sur ce serveur, une modification du serveur touche tous les clubs : la faire seulement après avoir vérifié, et garder `supabase/ea-schema.sql` à jour.

## Données personnelles

La plateforme héberge les données de tous les clubs, dont des mineurs. Avant d'accueillir des clubs : une politique de confidentialité, un contrat avec chaque club (qui reste responsable de ses licenciés), et un plan Supabase adapté (le plan gratuit met le projet en pause après une semaine sans activité et limite la taille de la base).
