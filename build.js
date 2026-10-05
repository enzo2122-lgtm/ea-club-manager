/* Regroupe les modules de l'appli en un seul fichier (js/app.bundle.js) : un seul téléchargement au lieu de 50, l'appli s'ouvre plus vite.
   À relancer après chaque modification d'un fichier de js/ :  node build.js   (le script de publication le fait tout seul).
   L'ordre est celui de la liste ci-dessous ; js/config.js reste à part (il change d'un serveur à l'autre). */
const fs = require('fs'), path = require('path');
const ORDER = ["appcfg.js", "sport.js", "icons.js", "board.js", "store.js", "ui.js", "clubs.js", "exporter.js", "auth.js", "media.js", "ratings.js", "library.js", "importer.js", "help.js", "cloud.js", "sync.js", "planning.js", "results.js", "messages.js", "people.js", "templates.js", "autoschema.js", "editor.js", "clublife.js", "weather.js", "notify.js", "supporters.js", "vestiaires.js", "prepa.js", "live.js", "health.js", "progress.js", "sport-exos.js", "exos.js", "sessions-foot.js", "sessions-sports.js", "sport-more.js", "seslib.js", "volunteers.js", "referees.js", "perso.js", "roles.js", "gestion.js", "season.js", "tests.js", "acimport.js", "telestrator.js", "analyse.js", "clubadmin.js", "parents.js", "codes.js", "imports.js", "onboard.js", "owner.js", "president.js", "quick.js", "demo.js", "news.js", "sources.js", "game.js", "views.js", "app.js"];
const out = ['/* Fichier généré par build.js : ne pas modifier ici, modifier les fichiers de js/ puis relancer « node build.js ». */'];
// Each module was its own script: a module asking « typeof Store » before Store was loaded got « undefined ».
// In one file a « const » not reached yet would throw instead, so the modules are declared with « var » (same behaviour).
for (const f of ORDER) out.push(`/* ===== ${f} ===== */`, fs.readFileSync(path.join(__dirname, 'js', f), 'utf8').replace(/\r\n/g, '\n').replace(/^const (\w+) = /gm, 'var $1 = '), ';');
fs.writeFileSync(path.join(__dirname, 'js', 'app.bundle.js'), out.join('\n'));
console.log(`js/app.bundle.js : ${ORDER.length} modules, ${Math.round(fs.statSync(path.join(__dirname, 'js', 'app.bundle.js')).size / 1024)} Ko`);

// (1.46) Clubbo only: one demo page per sport (demo/<sport>/), to install on a phone as its own app, with its own memory
// and its demo club already open. Made from index.html each time, so it always has the same version.
const cfg = fs.readFileSync(path.join(__dirname, 'js', 'config.js'), 'utf8');
if (!/^\s*club\s*:/m.test(cfg)) {
  const DEMOS = { foot: 'Football', basket: 'Basket', hand: 'Handball', rugby: 'Rugby', volley: 'Volley' };
  const idx = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
  for (const [k, label] of Object.entries(DEMOS)) {
    const dir = path.join(__dirname, 'demo', k); fs.mkdirSync(dir, { recursive: true });
    const page = idx.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<base href="../../">')
      .replace('<title>Clubbo</title>', `<title>Clubbo · Démo ${label}</title>`)
      .replace('name="apple-mobile-web-app-title" content="Clubbo">', `name="apple-mobile-web-app-title" content="Démo ${label}">`)
      .replace('href="manifest.webmanifest"', `href="demo/${k}/manifest.webmanifest"`)
      .replace(/(<script src="js\/config\.js\?v=\d+"><\/script>)/, `$1\n<script>CLUB_SERVER.store = 'demo-${k}'; CLUB_SERVER.db = 'demo-${k}'; CLUB_SERVER.demo = '${k}';
/* <base> makes the files load from the app's folder; a link « #/… » would then open the main app: keep it on this page */
window.addEventListener('click', function (e) { var a = !e.defaultPrevented && e.target.closest && e.target.closest('a[href^="#"]'); if (!a || a.target) return; e.preventDefault(); var h = a.getAttribute('href'); if (h.length > 1) location.hash = h; });</script>`);
    if (!page.includes(`CLUB_SERVER.demo = '${k}'`) || !page.includes('<base href') || !page.includes(`demo/${k}/manifest`)) throw new Error('demo/' + k + ' : index.html a changé, page de démo impossible');
    fs.writeFileSync(path.join(dir, 'index.html'), page);
    fs.writeFileSync(path.join(dir, 'manifest.webmanifest'), JSON.stringify({ id: `demo-${k}`, name: `Clubbo · Démo ${label}`, short_name: `Démo ${label}`, lang: 'fr', start_url: './', scope: './', display: 'standalone',
      background_color: '#0e1d45', theme_color: '#0e1d45', icons: [192, 512].map(s => ({ src: `../../icons/icon-${s}.png`, sizes: `${s}x${s}`, type: 'image/png' })) }, null, 2) + '\n');
  }
  console.log('demo/ : ' + Object.keys(DEMOS).join(', '));
}
