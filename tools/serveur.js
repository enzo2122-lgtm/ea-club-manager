/* Serveur local pour vérifier l'appli :   node tools/serveur.js   puis ouvrir http://localhost:8790/tools/verif.html
   Il sert les fichiers de l'appli tels quels, et /verif-app.html : la page de l'appli SANS serveur du club
   (config vide, rien n'est envoyé), avec un relevé des erreurs placé avant l'appli. Port : node tools/serveur.js 8791 */
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), port = +process.argv[2] || 8790;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.pdf': 'application/pdf' };
const COLLECT = `<script>window.__errs = []; window.__toasts = [];
addEventListener('error', e => __errs.push(location.hash + ' :: ' + e.message + (e.filename ? ' (' + e.filename.split('/').pop().split('?')[0] + ':' + e.lineno + ')' : '')));
addEventListener('unhandledrejection', e => __errs.push(location.hash + ' :: (promesse) ' + ((e.reason && e.reason.message) || e.reason)));
(function () { const ce = console.error.bind(console); console.error = function () { const a = [].slice.call(arguments); __errs.push(location.hash + ' :: console.error ' + a.map(x => (x && x.message) || String(x)).join(' ').slice(0, 200)); ce.apply(null, a); }; })();
window.open = () => null; window.confirm = () => false; window.prompt = () => null; window.alert = () => {}; window.print = () => {};
try { Object.defineProperty(navigator, 'share', { value: undefined }); } catch (e) {}
</script>`;
function verifApp(query) {
  let s = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  s = s.replace('<head>', '<head>' + COLLECT)
    .replace(/<script src="js\/config\.js[^"]*"><\/script>/, '<script>const CLUB_SERVER = {};</script>');
  // Raincy has no demo club of its own: the test one
  if (/demo=1/.test(query)) s = s.replace(/(<script src="js\/app\.bundle\.js[^"]*"><\/script>)/, '$1<script src="tools/demo-test.js"></script>');
  return s;
}
http.createServer((q, r) => {
  const [p0, query = ''] = q.url.split('?');
  let p = decodeURIComponent(p0); if (p.endsWith('/')) p += 'index.html';
  const head = { 'Cache-Control': 'no-store' };
  if (p === '/verif-app.html') { r.writeHead(200, Object.assign(head, { 'Content-Type': TYPES['.html'] })); return r.end(verifApp(query)); }
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT)) { r.writeHead(403); return r.end(); }
  fs.readFile(f, (e, b) => {
    if (e) { r.writeHead(404); return r.end(); }
    r.writeHead(200, Object.assign(head, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' })); r.end(b);
  });
}).listen(port, () => console.log(`Appli servie sur http://localhost:${port}/  ·  vérification : http://localhost:${port}/tools/verif.html`));
