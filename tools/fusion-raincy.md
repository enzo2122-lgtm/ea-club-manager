# Fusion : Raincy fabriqué à partir de Clubbo

Étape 1 (tri des différences, 3 octobre 2026). Raincy 3.76 et Clubbo 1.34 comparés fichier par fichier.

## Ce qui est déjà dans Clubbo (rien à reporter)

- Tous les modules de Raincy existent dans Clubbo. Clubbo en a 7 de plus : `sport.js`, `sport-exos.js`, `sport-more.js`, `sessions-sports.js`, `onboard.js` (fenêtre « Le club »), `owner.js` (espace propriétaire), `demo.js`.
- Aucune fonction de Raincy ne manque à Clubbo, sauf les comptes « sur l'appareil, sans serveur » (`setupScreen`, `localLoginScreen`, `forgotLocal` dans `auth.js`) : inutiles, Raincy est sur le serveur Clubbo.
- La bibliothèque d'exercices de foot est identique (`BASE` de Raincy = `BASE_F` de Clubbo).
- Les catégories : Clubbo range les joueurs une fois par saison, seulement dans les catégories qui existent (sans U18 au club, 18 ans = Seniors). Les règles de Raincy (pas de U18 / U19 / U20, Vétérans loisirs, équipes A et B) sont respectées.
- Partout ailleurs, la version de Clubbo est la version généralisée (sport, nom du club, blason du club).

## Ce que Raincy a en dur et qui devient un réglage du club

| Dans Raincy | Où | Dans la version fusionnée |
|---|---|---|
| Nom « FA Le Raincy », « Raincy Coach » | index.html, manifest, help.js, views.js, exporter.js, analyse.js, store.js… | nom de l'appli dans `js/config.js` (`app`) et nom du club (réglages) |
| Devise « Plus d'un siècle de passion… : Notre Club, Notre Histoire, Notre Fierté » (pièce, drapeau) | supporters.js | `club.slogan` ; règle ajoutée à Clubbo : la partie avant « : » autour de la pièce, la suite au centre |
| Blason avec « 1914 » | icons/crest.png | blason du club (`club.crest`) + icônes de l'appli Raincy gardées |
| « Allez Raincy ! » | prepa.js | `club.short` (« Allez … ! ») |
| Météo au Raincy (48.8993, 2.5183) | weather.js | `club.city`, `club.lat`, `club.lon` |
| Page FFF du club (epreuves.fff.fr/competition/club/552176-…) et « RAINCY F.A. » | importer.js | `club.fffUrl`, `club.fffName` |
| Maillots bordeaux / blanc | store.js | `club.homeBib`, `club.awayBib` |
| Couleurs du terrain du tableau tactique | board.js | identiques dans Clubbo pour le foot (même vert) : rien à faire |

Ces valeurs sont mises une fois dans les réglages du club FA Le Raincy (sur le serveur) si elles manquent, à partir de `js/config.js` de Raincy.

## Ce qui doit rester exactement comme dans Raincy (sinon des données du téléphone seraient perdues)

Noms de la mémoire du téléphone : base `raincy-coach` (données), `raincy-media` (photos et vidéos), et les clés `raincy-crests`, `raincy-briefings`, `raincy-codes` / `raincy-code`, `raincy-msgs`, `raincy-msg-read`, `raincy-msg-fams`, `raincy-parent-name`, `raincy-weather`, `raincy-geo`, `raincy-tour-seen`, `raincy-errors`, `raincy-update-tried`.
Nom du cache de l'appli hors ligne : `raincy-coach-v…`. Même adresse (`/raincy-coach/`), même `sw.js` (les notifications restent).

→ Un préfixe dans `js/config.js` (`store: 'raincy'` pour Raincy, `'ea'` pour Clubbo) donne tous ces noms.

## Petites choses vues en passant

- Raincy : accents abîmés dans la bulle de la devise (index.html, « si?cle »).
- Clubbo : « réessaie dans quelques minutes. (). » (notify.js).
- Raincy : `sync.js` remet le compteur à zéro quand l'adresse du serveur change : utile à garder dans Clubbo.

## Étape 2 : le mode « un seul club » dans Clubbo

Quand `js/config.js` contient `club` (code du club) :
- connexion sans code du club à taper ;
- pas de « Créer mon club », de démo, ni d'espace propriétaire ;
- nom de l'appli, icônes et noms de la mémoire du téléphone pris dans la config ;
- réglages du club complétés une fois depuis la config s'ils manquent.
