/* Vérification automatique de l'appli, à lancer avant chaque publication :   node tools/verifier.js
   (ajoute --sans-serveur pour ne pas interroger le serveur du club)
   1. chaque fichier js se lit sans erreur de syntaxe ;
   2. js/app.bundle.js est à jour (sinon : node build.js) ;
   3. chaque « Module.fonction » appelé existe bien dans ce module ;
   4. les fichiers cités par les pages (scripts, styles, icônes) et par sw.js (appli hors ligne) existent ;
   5. le numéro de version est le même partout (version.json, js/app.js, js/help.js, pages, sw.js) ;
   6. chaque fonction du serveur appelée par l'appli existe, avec les mêmes paramètres.
      Les appels portent de faux codes : le serveur refuse tout, rien n'est écrit.
   Les pages et les boutons, eux, se vérifient dans le navigateur : tools/verif.html (voir LISEZ-MOI.md). */
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), JS = path.join(ROOT, 'js');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const problems = [], notes = [];
const bad = (part, msg) => problems.push(`[${part}] ${msg}`);
const files = fs.readdirSync(JS).filter(f => f.endsWith('.js') && f !== 'app.bundle.js');
const src = Object.fromEntries(files.map(f => [f, read('js/' + f)]));

/* 1. syntax */
for (const f of [...files.map(f => 'js/' + f), 'sw.js', 'build.js']) {
  const r = spawnSync(process.execPath, ['--check', path.join(ROOT, f)], { encoding: 'utf8' });
  if (r.status !== 0) bad('syntaxe', `${f} : ${(r.stderr || '').split('\n').find(l => /Error/.test(l)) || 'erreur'}`);
}

/* 2. the bundle, rebuilt in memory with the same rule as build.js */
{
  const order = JSON.parse(read('build.js').match(/const ORDER = (\[[^\]]*\])/)[1]);
  const head = read('build.js').match(/const out = \['([^']*)'\]/)[1];
  const out = [head];
  for (const f of order) {
    if (!src[f]) { bad('bundle', `build.js cite js/${f} qui n'existe pas`); continue; }
    out.push(`/* ===== ${f} ===== */`, src[f].replace(/^const (\w+) = /gm, 'var $1 = '), ';');
  }
  if (read('js/app.bundle.js') !== out.join('\n')) bad('bundle', 'js/app.bundle.js n\'est pas à jour : lance « node build.js »');
  const pages = ['moi.html', 'aide.html', 'joueurs.html', 'parents.html', 'decouvrir.html'].filter(p => fs.existsSync(path.join(ROOT, p))).map(read).join('\n');
  files.filter(f => !order.includes(f) && f !== 'config.js' && !pages.includes('js/' + f)).forEach(f => notes.push(`js/${f} n'est utilisé par aucune page ni par l'appli`));
}

/* 3. Module.name: every name called must be returned by its module */
{
  const exportsOf = {};
  for (const s of Object.values(src)) for (const m of s.matchAll(/^const (\w+) = \(\(\) => \{/gm)) {
    const name = m[1], end = s.indexOf('\n})();', m.index), body = s.slice(m.index, end < 0 ? undefined : end);
    const ri = body.lastIndexOf('\n  return '); if (ri < 0) continue;
    let r = body.slice(ri + 10); const keys = new Set();
    r.replace(/get (\w+)\(\)/g, (x, k) => { keys.add(k); return ''; });
    r = r.slice(r.indexOf('{') + 1);
    let prev; do { prev = r; r = r.replace(/\{[^{}]*\}/g, ''); } while (r !== prev);
    r = r.replace(/\([^()]*\)/g, '');
    r.split(/[,\n]/).forEach(p => { const k = p.trim().split(/[:\s(]/)[0]; if (/^\w+$/.test(k)) keys.add(k); });
    if (/Object\.assign\(api/.test(body.slice(ri, ri + 60))) { const a = body.match(/const api = \{([\s\S]*?)\n  \};/); if (a) for (const k of a[1].matchAll(/^\s{4}(\w+):/gm)) keys.add(k[1]); }
    exportsOf[name] = keys;
  }
  const seen = new Set();
  for (const [f, s] of Object.entries(src)) for (const m of s.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '').matchAll(/\b([A-Z]\w+)\.([a-zA-Z_]\w*)\b/g)) {
    const [, mod, k] = m, ex = exportsOf[mod];
    if (!ex || ex.has(k) || seen.has(mod + k)) continue;
    seen.add(mod + k); bad('modules', `${mod}.${k} appelé dans js/${f}, mais ${mod} ne le fournit pas`);
  }
}

/* 4. files named by the pages and by the offline copy */
{
  for (const p of fs.readdirSync(ROOT).filter(f => f.endsWith('.html'))) {
    for (const m of read(p).matchAll(/(?:src|href)="([^"#:?]+)(?:\?[^"]*)?"/g)) {
      const ref = m[1]; if (/^(https?:|mailto:|tel:|data:)/.test(ref) || ref.startsWith('#') || !/\.\w+$/.test(ref)) continue;
      if (!fs.existsSync(path.join(ROOT, ref))) bad('fichiers', `${p} cite ${ref} qui n'existe pas`);
    }
  }
  const sw = read('sw.js'), list = sw.match(/const FILES = \[([\s\S]*?)\];/);
  if (!list) bad('hors ligne', 'liste FILES introuvable dans sw.js');
  else for (const m of list[1].matchAll(/'([^']+)'/g)) if (m[1] !== './' && !fs.existsSync(path.join(ROOT, m[1]))) bad('hors ligne', `sw.js garde ${m[1]} qui n'existe pas`);
  for (const m of sw.matchAll(/importScripts\('([^']+)'\)/g)) if (!fs.existsSync(path.join(ROOT, m[1]))) bad('hors ligne', `sw.js charge ${m[1]} qui n'existe pas`);
}

/* 5. one version everywhere */
let version = '?', build = 0;
{
  const vj = JSON.parse(read('version.json')); version = vj.version; build = vj.build;
  const appB = +(src['app.js'].match(/const BUILD = (\d+)/) || [])[1];
  const helpV = (src['help.js'].match(/VERSION = '([^']+)'/) || [])[1];
  if (appB !== build) bad('version', `js/app.js BUILD = ${appB}, version.json build = ${build}`);
  if (helpV && helpV !== version) bad('version', `js/help.js VERSION = ${helpV}, version.json = ${version}`);
  for (const p of fs.readdirSync(ROOT).filter(f => f.endsWith('.html'))) for (const m of read(p).matchAll(/\?v=(\d+)"/g)) if (+m[1] !== build) { bad('version', `${p} charge un fichier en ?v=${m[1]} (attendu ${build})`); break; }
  const swV = (read('sw.js').match(/const VERSION = '[\w-]*?v(\d+)'/) || [])[1];
  if (+swV !== build) bad('version', `sw.js VERSION = v${swV} (attendu v${build}) : les téléphones ne verraient pas la mise à jour`);
}

/* 6. the club's server: each function called, with the parameters the app sends */
async function server() {
  const cfgTxt = src['config.js'] || '';
  const url = (cfgTxt.match(/url:\s*'([^']+)'/) || [])[1], key = (cfgTxt.match(/key:\s*'([^']+)'/) || [])[1];
  if (!url || !key) { notes.push('serveur non vérifié : js/config.js sans adresse'); return; }
  // the keys of the object literal written after rpc('name',
  const keysOf = (s, i) => {
    while (/\s|,/.test(s[i])) i++;
    if (s[i] !== '{') return null;
    let depth = 0, j = i, cur = '', parts = [];
    for (; j < s.length; j++) {
      const c = s[j];
      if ('{[('.includes(c)) { depth++; if (depth === 1) continue; }
      if ('}])'.includes(c)) { depth--; if (depth === 0) { parts.push(cur); break; } }
      if (c === ',' && depth === 1) { parts.push(cur); cur = ''; continue; }
      if (depth === 1) cur += c; else if (depth > 1 && cur.indexOf(':') < 0) cur += '';
    }
    return parts.map(p => p.trim()).filter(Boolean).map(p => p.split(':')[0].trim()).filter(k => /^\w+$/.test(k));
  };
  const noK = new Set(Object.keys(Function('return ' + ((src['cloud.js'] || '').match(/const NO_K = (\{[\s\S]*?\});/) || [, '{}'])[1])()));
  const calls = new Map();
  const scan = (file, s, wrapper) => {
    for (const m of s.matchAll(/\brpc\('(\w+)'\s*(,?)/g)) {
      const name = m[1], keys = m[2] ? keysOf(s, m.index + m[0].length) : [];
      if (keys === null) { notes.push(`${file} : ${name} appelé avec des paramètres non écrits en clair (non vérifié)`); continue; }
      const sent = new Set(keys); if (wrapper && !noK.has(name)) sent.add('k');
      const sig = [...sent].sort().join(',');
      const k = name + '|' + sig; if (!calls.has(k)) calls.set(k, { name, keys: [...sent], where: file });
    }
  };
  for (const [f, s] of Object.entries(src)) scan('js/' + f, s, f === 'cloud.js');
  // SQL written inside cloud.js (old setup scripts) is not an app call
  for (const [k, c] of calls) if (/^(select|perform)\b/i.test(c.name)) calls.delete(k);
  // functions that a fake call could still change: checked by name in the SQL file instead
  const SKIP = new Set(['ea_request', 'ea_create_club', 'ea_owner_init']);
  const sql = ['supabase/ea-schema.sql', 'supabase/schema.sql'].filter(f => fs.existsSync(path.join(ROOT, f))).map(read).join('\n');
  const dummy = k => /^(p_players|p_matches|p_renew|p_team_ids|p_ids)$/.test(k) ? [] : /^(p_new|p_on|p_preview|p_remove)$/.test(k) ? false
    : /^(p_seats|p_mood|p_mental|p_sleep|p_legs|p_sore|p_rev|p_since|since|p_start|p_end)$/.test(k) ? 0 : k === 'p' ? {} : /^(p_id)$/.test(k) ? null
    : /^(d_from|d_to|p_date)$/.test(k) ? '2000-01-01' : /^p_at$/.test(k) ? '2000-01-01T00:00:00Z' : 'ZZZZ9999';
  let n = 0;
  for (const c of calls.values()) {
    if (SKIP.has(c.name)) { if (sql && !new RegExp(`function ${c.name}\\(`).test(sql)) bad('serveur', `${c.name} introuvable dans le fichier SQL du serveur`); continue; }
    const body = Object.fromEntries(c.keys.map(k => [k, dummy(k)]));
    let txt = '', status = 0;
    try { const r = await fetch(`${url}/rest/v1/rpc/${c.name}`, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); status = r.status; txt = await r.text(); }
    catch (e) { bad('serveur', `pas de réseau (${e.message}) : relance ou ajoute --sans-serveur`); return; }
    n++;
    if (/PGRST202|Could not find the function/i.test(txt)) bad('serveur', `${c.name}(${c.keys.join(', ')}) appelé dans ${c.where} : le serveur n'a pas cette fonction avec ces paramètres`);
    else if (status >= 500) bad('serveur', `${c.name} : erreur du serveur ${status} ${txt.slice(0, 120)}`);
  }
  notes.push(`serveur : ${n} appels vérifiés (${url.replace(/^https:\/\//, '').split('.')[0]})`);
}

(async () => {
  if (!process.argv.includes('--sans-serveur')) await server();
  const app = path.basename(ROOT);
  console.log(`\n== Vérification de ${app} ${version} (build ${build}) ==`);
  notes.forEach(n => console.log('  · ' + n));
  if (!problems.length) console.log('\n✅ Aucun problème trouvé.\n');
  else { console.log(`\n❌ ${problems.length} problème${problems.length > 1 ? 's' : ''} :`); problems.forEach(p => console.log('  - ' + p)); console.log(''); }
  process.exitCode = problems.length ? 1 : 0;
})();
