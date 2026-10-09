/* Les langues des espaces familles (2.66) : fabrique js/lang-en.js, js/lang-es.js, js/lang-pt.js à partir de tools/langues.tsv
   (une ligne par texte : français <TAB> anglais <TAB> espagnol <TAB> portugais ; « @placeholder texte » pour un attribut),
   et liste les textes français des pages familles qui n'ont pas encore de traduction.
   Usage : node tools/langues.js */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const rows = fs.readFileSync(path.join(__dirname, 'langues.tsv'), 'utf8').split('\n').filter(Boolean).map(l => l.split('\t'));
const D = { en: {}, es: {}, pt: {} }, known = new Set();
for (const r of rows) {
  if (r.length !== 4) { console.log('ligne ignorée (pas 4 colonnes) :', r[0]); continue; }
  const fr = r[0].replace(/^@(placeholder|title|aria-label|alt) /, ''); known.add(r[0]); if (!fr.trim()) continue;
  const ph = (fr.match(/\{\d+\}/g) || []).sort().join();
  ['en', 'es', 'pt'].forEach((l, i) => { const t = r[1 + i]; if (!t || t === fr) return; if ((t.match(/\{\d+\}/g) || []).sort().join() !== ph) { console.log(`${l} : {n} différents → ${fr}`); return; } D[l][fr] = t; });
}
for (const l of Object.keys(D)) fs.writeFileSync(path.join(ROOT, 'js', `lang-${l}.js`), `/* Fichier fabriqué par tools/langues.js à partir de tools/langues.tsv : ne pas modifier ici. */\nwindow.I18N_DICT = ${JSON.stringify(D[l])};\n`);
console.log(`js/lang-en.js ${Object.keys(D.en).length} · lang-es.js ${Object.keys(D.es).length} · lang-pt.js ${Object.keys(D.pt).length} textes`);
// the French texts of the families' pages without a line in langues.tsv
const FILES = ['js/member.js', 'js/perso.js', 'js/game.js', 'js/chat.js', 'js/share.js', 'js/bodymap.js', 'js/injury.js', 'js/urgent.js', 'js/consent.js', 'js/profil.js', 'js/absence.js', 'js/after.js', 'js/talks.js', 'js/vplayer.js', 'js/players-page.js', 'js/parents-page.js', 'js/helper.js', 'joueurs.html', 'parents.html', 'moi.html', 'aide.html'];
let acorn, walk; try { acorn = require('acorn'); walk = require('acorn-walk'); } catch (e) { console.log('(pour lister les textes sans traduction : npm i acorn acorn-walk, puis relancer)'); process.exit(0); }
const found = new Set();
const add = s => { s = s.replace(/\s+/g, ' ').trim(); if (!s || !/[a-zàâçéèêëîïôûùüÿœ]{2}/i.test(s)) return; if (/[_]|^[a-z]+[A-Z]|^\[data-|^\(display-mode|^application\/|=>|^[.#][a-z]|^[a-z-]+:\s|(^|[^}\d])[{};]\s*$|^\d+(px|%|ms|s)\b/.test(s)) return; if (/^(https?:|mailto:|tel:|#|\.\/|js\/|icons\/|[a-z_-]+\.(html|js|png|css|jpg|svg))/.test(s)) return; found.add(s); };
const scanText = t => { t.split(/<[^>]*>/).forEach(x => add(x.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"'))); (t.match(/(placeholder|title|aria-label|alt)="([^"]*)"/g) || []).forEach(a => add('@' + a.replace(/^(\S+?)="([^"]*)"$/, '$1 $2'))); };
const scanJs = code => { const ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true });
  walk.full(ast, n => { if (n.type === 'Literal' && typeof n.value === 'string') scanText(n.value); if (n.type === 'TemplateLiteral') scanText(n.quasis.map((q, i) => q.value.cooked + (i < n.expressions.length ? '{' + i + '}' : '')).join('')); }); };
for (const f of FILES) {
  if (!fs.existsSync(path.join(ROOT, f))) continue;
  let src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  if (f.endsWith('.html')) { src = src.replace(/<style[\s\S]*?<\/style>/g, ''); const sc = []; src = src.replace(/<script[^>]*>([\s\S]*?)<\/script>/g, (m, c) => { sc.push(c); return ''; }); scanText(src.replace(/<!--[\s\S]*?-->/g, '')); sc.forEach(scanJs); }
  else scanJs(src);
}
const missing = [...found].filter(s => !known.has(s) && !/^[{}\d\s.,:;·–\-+%/()]+$/.test(s));
if (missing.length) { fs.writeFileSync(path.join(__dirname, 'langues-a-traduire.txt'), missing.join('\n') + '\n'); console.log(`${missing.length} texte(s) sans traduction : voir tools/langues-a-traduire.txt`); }
else { try { fs.unlinkSync(path.join(__dirname, 'langues-a-traduire.txt')); } catch (e) {} console.log('Tous les textes des pages familles ont leur traduction.'); }
