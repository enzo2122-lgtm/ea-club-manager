/* Fabrique l'appli d'un club à partir de Clubbo (même code, réglée pour ce club) :
     node tools/fabriquer.js ../raincy-coach          (même version qu'avant)
     node tools/fabriquer.js ../raincy-coach 4.1      (nouvelle version : le numéro de build augmente de 1)
   Le dossier du club contient club/fabrication.json (sa version, les textes à changer dans les pages) et ce qui lui est propre :
   js/config.js (son club, son nom, les noms de sa mémoire, ses réglages par défaut), icons/, ses manifestes, sa page de confidentialité.
   Le script copie le code de Clubbo, change les textes, pose la version partout, refait js/app.bundle.js, puis lance la vérification.
   Il ne publie rien : on regarde, on essaie, puis on publie le dossier du club avec git. */
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const SRC = path.join(__dirname, '..');
const DST = path.resolve(process.argv[2] || '');
const newVersion = process.argv[3];
const fail = m => { console.error('❌ ' + m); process.exit(1); };
if (!process.argv[2] || !fs.existsSync(path.join(DST, 'club', 'fabrication.json'))) fail('donne le dossier du club (il doit contenir club/fabrication.json), ex : node tools/fabriquer.js ../raincy-coach');
if (DST === SRC) fail('le dossier du club ne peut pas être Clubbo lui-même');
const cfgPath = path.join(DST, 'club', 'fabrication.json');
const F = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
if (!fs.existsSync(path.join(DST, 'js', 'config.js'))) fail('le club n\'a pas de js/config.js');
if (!/club:\s*'[^']+'/.test(fs.readFileSync(path.join(DST, 'js', 'config.js'), 'utf8'))) fail('js/config.js du club doit contenir « club: \'code-du-club\' »');

// 1. the version of the club's app
if (newVersion) { if (newVersion !== F.version) { F.version = newVersion; F.build = (+F.build || 0) + 1; } fs.writeFileSync(cfgPath, JSON.stringify(F, null, 2) + '\n'); }
const { version, build } = F;
if (!version || !build) fail('club/fabrication.json : « version » et « build » manquent');

// 2. the code of Clubbo (the club keeps its config, icons, manifests, privacy page and notes)
const read = p => fs.readFileSync(path.join(SRC, p), 'utf8').replace(/\r\n/g, '\n');
const COPY = ['index.html', 'moi.html', 'joueurs.html', 'parents.html', 'app.css', 'sw.js', 'build.js', 'tools/verifier.js', 'tools/serveur.js', 'tools/verif.html',
  ...fs.readdirSync(path.join(SRC, 'js')).filter(f => f.endsWith('.js') && f !== 'config.js' && f !== 'app.bundle.js').map(f => 'js/' + f)];
const out = {};
COPY.forEach(p => { out[p] = read(p); });
// what the club's folder had and Clubbo no longer has (an old module, the old test club): removed
const gone = [...fs.readdirSync(path.join(DST, 'js')).filter(f => f.endsWith('.js') && f !== 'config.js' && f !== 'app.bundle.js' && !out['js/' + f]).map(f => 'js/' + f),
  ...['tools/demo-test.js'].filter(p => fs.existsSync(path.join(DST, p)))];
// the pictures of Clubbo (img/: the body of the injuries…), copied as they are
const IMGS = fs.existsSync(path.join(SRC, 'img')) ? fs.readdirSync(path.join(SRC, 'img')) : [];

// 3. the club's words in the pages (club/fabrication.json : « remplacer » : { "fichier ou *.html": [["avant", "après"], …] })
const rules = F.remplacer || {};
for (const [pat, pairs] of Object.entries(rules)) {
  const files = pat === '*.html' ? Object.keys(out).filter(p => p.endsWith('.html') && !p.startsWith('tools/')) : [pat];
  for (const f of files) {
    if (out[f] == null) fail(`club/fabrication.json : ${f} n'est pas un fichier copié de Clubbo`);
    for (const [a, b] of pairs) {
      if (!out[f].includes(a)) { if (pat === '*.html') continue; fail(`${f} : « ${a} » introuvable (Clubbo a changé ? mets à jour club/fabrication.json)`); }
      out[f] = out[f].split(a).join(b);
    }
  }
}

// 4. its version everywhere (pages, offline copy, app, help)
for (const f of Object.keys(out)) if (f.endsWith('.html') && !f.startsWith('tools/')) out[f] = out[f].replace(/\?v=\d+"/g, `?v=${build}"`);
out['sw.js'] = out['sw.js'].replace(/const VERSION = '[^']*';/, `const VERSION = '${F.cache}${build}';`);
out['js/app.js'] = out['js/app.js'].replace(/const BUILD = \d+,/, `const BUILD = ${build},`);
out['js/help.js'] = out['js/help.js'].replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`);

// 5. written in the club's folder, then the bundle and the check
for (const [p, s] of Object.entries(out)) { fs.mkdirSync(path.dirname(path.join(DST, p)), { recursive: true }); fs.writeFileSync(path.join(DST, p), s); }
if (IMGS.length) { fs.mkdirSync(path.join(DST, 'img'), { recursive: true }); IMGS.forEach(f => fs.copyFileSync(path.join(SRC, 'img', f), path.join(DST, 'img', f))); }
gone.forEach(p => fs.unlinkSync(path.join(DST, p)));
// the club's own pages (privacy…) take the same version
fs.readdirSync(DST).filter(f => f.endsWith('.html') && !out[f]).forEach(f => { const p = path.join(DST, f), s = fs.readFileSync(p, 'utf8'); fs.writeFileSync(p, s.replace(/\?v=\d+"/g, `?v=${build}"`)); });
fs.writeFileSync(path.join(DST, 'version.json'), `{ "build": ${build}, "version": "${version}" }\n`);
const run = (args, label) => { const r = spawnSync(process.execPath, args, { cwd: DST, encoding: 'utf8' }); process.stdout.write(r.stdout || ''); process.stderr.write(r.stderr || ''); if (r.status) fail(label); };
console.log(`Clubbo → ${path.basename(DST)} ${version} (build ${build}) : ${Object.keys(out).length} fichiers copiés${gone.length ? ', retirés : ' + gone.join(', ') : ''}`);
run(['build.js'], 'build.js a échoué');
run(['tools/verifier.js', ...(process.argv.includes('--sans-serveur') ? ['--sans-serveur'] : [])], 'la vérification a trouvé des problèmes (rien n\'est publié)');
console.log('Prêt. Essaie l\'appli (node tools/serveur.js dans le dossier du club), puis publie le dossier du club avec git.');
