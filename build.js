/* Regroupe les modules de l'appli en un seul fichier (js/app.bundle.js) : un seul téléchargement au lieu de 50, l'appli s'ouvre plus vite.
   À relancer après chaque modification d'un fichier de js/ :  node build.js   (le script de publication le fait tout seul).
   L'ordre est celui de la liste ci-dessous ; js/config.js reste à part (il change d'un serveur à l'autre). */
const fs = require('fs'), path = require('path');
const ORDER = ["appcfg.js", "sport.js", "icons.js", "board.js", "store.js", "ui.js", "clubs.js", "exporter.js", "auth.js", "media.js", "ratings.js", "library.js", "importer.js", "help.js", "cloud.js", "sync.js", "planning.js", "results.js", "messages.js", "people.js", "templates.js", "autoschema.js", "editor.js", "clublife.js", "weather.js", "notify.js", "supporters.js", "vestiaires.js", "prepa.js", "live.js", "health.js", "progress.js", "sport-exos.js", "exos.js", "sessions-foot.js", "sessions-sports.js", "sport-more.js", "seslib.js", "volunteers.js", "referees.js", "perso.js", "roles.js", "gestion.js", "season.js", "tests.js", "acimport.js", "telestrator.js", "analyse.js", "clubadmin.js", "parents.js", "codes.js", "imports.js", "onboard.js", "owner.js", "president.js", "quick.js", "demo.js", "news.js", "sources.js", "views.js", "app.js"];
const out = ['/* Fichier généré par build.js : ne pas modifier ici, modifier les fichiers de js/ puis relancer « node build.js ». */'];
// Each module was its own script: a module asking « typeof Store » before Store was loaded got « undefined ».
// In one file a « const » not reached yet would throw instead, so the modules are declared with « var » (same behaviour).
for (const f of ORDER) out.push(`/* ===== ${f} ===== */`, fs.readFileSync(path.join(__dirname, 'js', f), 'utf8').replace(/\r\n/g, '\n').replace(/^const (\w+) = /gm, 'var $1 = '), ';');
fs.writeFileSync(path.join(__dirname, 'js', 'app.bundle.js'), out.join('\n'));
console.log(`js/app.bundle.js : ${ORDER.length} modules, ${Math.round(fs.statSync(path.join(__dirname, 'js', 'app.bundle.js')).size / 1024)} Ko`);
