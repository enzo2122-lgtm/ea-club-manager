/* I18n (2.66): the families' pages (players, parents, my space, match helper) in English, Spanish or Portuguese.
   The pages are written in French; this module translates what is shown, as it is shown: each text of the page (and the
   placeholders, titles, dialogs) is looked up in the dictionary of the language (js/lang-xx.js, loaded only when needed).
   Texts with a part that changes (a name, a number, a date) are patterns: « {0} est convoqué » → « {0} is called up ».
   What the club, the coaches and the families write (messages, names, session titles) stays as written.
   The language: chosen in « Moi » (or on the code page), otherwise the phone's language when it is one of them. */
const I18n = (() => {
  const LANGS = [['fr', '🇫🇷', 'Français'], ['en', '🇬🇧', 'English'], ['es', '🇪🇸', 'Español'], ['pt', '🇵🇹', 'Português']];
  const KEY = typeof AppCfg !== 'undefined' ? AppCfg.key('lang') : 'lang';
  const ok = l => LANGS.some(x => x[0] === l);
  const stored = () => { try { const v = localStorage.getItem(KEY); return ok(v) ? v : ''; } catch (e) { return ''; } };
  const phone = () => { const n = String((navigator.languages && navigator.languages[0]) || navigator.language || 'fr').slice(0, 2).toLowerCase(); return ok(n) ? n : 'fr'; };
  const lang = stored() || phone();
  const set = l => { if (!ok(l)) return; try { localStorage.setItem(KEY, l); } catch (e) {} location.reload(); };

  /* ---------- the dictionary ---------- */
  const exact = new Map(), pats = [], frags = [];
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function build(D) {
    Object.entries(D).forEach(([fr, tr]) => {
      if (!/\{\d+\}/.test(fr)) { exact.set(fr, tr); if (fr.length >= 18) frags.push([fr, tr]); return; }
      const parts = fr.split(/(\{\d+\})/), idx = [];
      const src = '^' + parts.map(p => { const m = p.match(/^\{(\d+)\}$/); if (m) { idx.push(+m[1]); return '([\\s\\S]*?)'; } return reEsc(p); }).join('') + '$';
      const lit = parts.filter(p => !/^\{\d+\}$/.test(p)).sort((a, b) => b.length - a.length)[0] || '';
      if (lit.replace(/\s/g, '').length < 2) return; // a pattern made of placeholders only: it would catch anything
      pats.push({ re: new RegExp(src), idx, tr, lit });
    });
    pats.sort((a, b) => b.lit.length - a.lit.length);
    frags.sort((a, b) => b[0].length - a[0].length);
  }
  // dates written by the phone in French (« lundi 12 octobre », « sam. 10 oct. »)
  const WORDS = { en: { lundi: 'Monday', mardi: 'Tuesday', mercredi: 'Wednesday', jeudi: 'Thursday', vendredi: 'Friday', samedi: 'Saturday', dimanche: 'Sunday', 'lun.': 'Mon', 'mar.': 'Tue', 'mer.': 'Wed', 'jeu.': 'Thu', 'ven.': 'Fri', 'sam.': 'Sat', 'dim.': 'Sun',
      janvier: 'January', février: 'February', mars: 'March', avril: 'April', mai: 'May', juin: 'June', juillet: 'July', août: 'August', septembre: 'September', octobre: 'October', novembre: 'November', décembre: 'December',
      'janv.': 'Jan', 'févr.': 'Feb', 'avr.': 'Apr', 'juil.': 'Jul', 'sept.': 'Sep', 'oct.': 'Oct', 'nov.': 'Nov', 'déc.': 'Dec', "aujourd'hui": 'today', demain: 'tomorrow', hier: 'yesterday', à: 'at', au: 'to', du: 'from' },
    es: { lundi: 'lunes', mardi: 'martes', mercredi: 'miércoles', jeudi: 'jueves', vendredi: 'viernes', samedi: 'sábado', dimanche: 'domingo', 'lun.': 'lun.', 'mar.': 'mar.', 'mer.': 'mié.', 'jeu.': 'jue.', 'ven.': 'vie.', 'sam.': 'sáb.', 'dim.': 'dom.',
      janvier: 'enero', février: 'febrero', mars: 'marzo', avril: 'abril', mai: 'mayo', juin: 'junio', juillet: 'julio', août: 'agosto', septembre: 'septiembre', octobre: 'octubre', novembre: 'noviembre', décembre: 'diciembre',
      'janv.': 'ene.', 'févr.': 'feb.', 'avr.': 'abr.', 'juil.': 'jul.', 'sept.': 'sept.', 'oct.': 'oct.', 'nov.': 'nov.', 'déc.': 'dic.', "aujourd'hui": 'hoy', demain: 'mañana', hier: 'ayer', à: 'a las', au: 'al', du: 'del' },
    pt: { lundi: 'segunda-feira', mardi: 'terça-feira', mercredi: 'quarta-feira', jeudi: 'quinta-feira', vendredi: 'sexta-feira', samedi: 'sábado', dimanche: 'domingo', 'lun.': 'seg.', 'mar.': 'ter.', 'mer.': 'qua.', 'jeu.': 'qui.', 'ven.': 'sex.', 'sam.': 'sáb.', 'dim.': 'dom.',
      janvier: 'janeiro', février: 'fevereiro', mars: 'março', avril: 'abril', mai: 'maio', juin: 'junho', juillet: 'julho', août: 'agosto', septembre: 'setembro', octobre: 'outubro', novembre: 'novembro', décembre: 'dezembro',
      'janv.': 'jan.', 'févr.': 'fev.', 'avr.': 'abr.', 'juil.': 'jul.', 'sept.': 'set.', 'oct.': 'out.', 'nov.': 'nov.', 'déc.': 'dez.', "aujourd'hui": 'hoje', demain: 'amanhã', hier: 'ontem', à: 'às', au: 'a', du: 'de' } };
  const DATE_RE = /(^|[\s(·])(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|lun\.|mar\.|mer\.|jeu\.|ven\.|sam\.|dim\.)(?=\s\d)|\d\s(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|janv\.|févr\.|avr\.|juil\.|sept\.|oct\.|nov\.|déc\.)/;
  function dates(s) {
    if (!DATE_RE.test(s)) return null;
    const W = WORDS[lang]; if (!W) return null;
    return s.replace(/(?<![A-Za-zÀ-ÿ])(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)(?![A-Za-zÀ-ÿ])|(?<![A-Za-zÀ-ÿ])(lun|mar|mer|jeu|ven|sam|dim|janv|févr|avr|juil|sept|oct|nov|déc)\./g, (m) => W[m] || m)
      .replace(/(\d)h(\d\d)\b/g, '$1:$2').replace(/(^|\s)(à|au|du)(?=\s\d)/g, (m, a, w) => a + (W[w] || w));
  }
  // one piece of a text: known as is, as a pattern, or with an emoji before
  function trPiece(p) {
    const t = p.trim(); let v = exact.get(t);
    if (v == null) for (const q of pats) { if (q.lit && !t.includes(q.lit)) continue; const m = t.match(q.re); if (!m) continue; const got = {}; q.idx.forEach((n, i) => { got[n] = m[i + 1]; }); v = q.tr.replace(/\{(\d+)\}/g, (x, n) => got[n] == null ? '' : got[n]); break; }
    if (v == null) { const m = t.match(/^([^A-Za-zÀ-ÿŒœ{]*)([\s\S]*?)([\s:.,!?…)]*)$/); if (m && m[2] && exact.has(m[2])) v = m[1] + exact.get(m[2]) + m[3]; }
    return v == null ? null : p.replace(t, v);
  }
  function tr(t, inMsg, depth = 0) {
    const v = exact.get(t); if (v != null) return v;
    for (const p of pats) {
      if (p.lit && !t.includes(p.lit)) continue;
      const m = t.match(p.re); if (!m) continue;
      const got = {}; p.idx.forEach((n, i) => { got[n] = m[i + 1]; });
      return p.tr.replace(/\{(\d+)\}/g, (x, n) => { const g = got[n] == null ? '' : got[n], gt = g.trim(); if (!gt) return g;
        const y = exact.get(gt) || (depth < 2 && /[a-zà-ÿ]{3}/i.test(gt) ? tr(gt, true, depth + 1) : null) || dates(g); return y ? g.replace(gt, y) : g; });
    }
    const d = dates(t); if (d != null && d !== t) return d;
    // an emoji, a number or a sign before / after a known text (« 🤕 Une douleur », « Saison : »)
    const m = t.match(/^([^A-Za-zÀ-ÿŒœ{]*)([\s\S]*?)([\s:.,!?…·)\]»"]*)$/);
    if (m && (m[1] || m[3]) && m[2]) { const c = exact.get(m[2]); if (c != null) return m[1] + c + m[3]; }
    // pieces: « FA Le Raincy · Espace parents », or several sentences of which some are known
    if (!inMsg && /\s·\s|[.!?:]\s/.test(t)) { const parts = t.split(/(\s·\s|(?<=[.!?])\s+|(?<=\S)\s:\s)/); if (parts.length > 1) { let hit = false; const out = parts.map((p, i) => { if (i % 2) return p; const x = p.trim() ? trPiece(p) : null; if (x != null) { hit = true; return x; } return p; }).join(''); if (hit) return out; } }
    if (!inMsg && t.length >= 18) { let out = t, hit = false; for (const [fr, to] of frags) { if (out.length < fr.length) continue; if (out.includes(fr)) { out = out.split(fr).join(to); hit = true; } } if (hit) return out; }
    return null;
  }
  const done = new WeakMap(); // a text node → the translation put there (not to translate it twice)
  const SKIP = /^(SCRIPT|STYLE|TEXTAREA|CODE|PRE)$/;
  const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  function textNode(n) {
    const v = n.nodeValue; if (!v || done.get(n) === v) return;
    const t = v.trim(); if (!t || !/[a-zàâçéèêëîïôûùüœ]/i.test(t)) return;
    const pe = n.parentElement; if (!pe || SKIP.test(pe.tagName) || pe.closest('[data-noi18n]')) return;
    const x = tr(t, !!pe.closest('.cx-b'));
    if (x != null && x !== t) { const nv = v.replace(t, x); done.set(n, nv); n.nodeValue = nv; } else done.set(n, v);
  }
  function el(e) {
    if (e.nodeType === 3) return textNode(e);
    if (e.nodeType !== 1 || SKIP.test(e.tagName) || (e.hasAttribute && e.hasAttribute('data-noi18n'))) return;
    for (const a of ATTRS) { const v = e.getAttribute(a); if (v && /[a-zàéè]/i.test(v)) { const x = exact.get(v.trim()) || tr(v.trim(), true); if (x && x !== v) e.setAttribute(a, x); } }
    if (e.tagName === 'INPUT' && /^(button|submit)$/i.test(e.type) && e.value) { const x = exact.get(e.value.trim()); if (x) e.value = x; }
    for (let c = e.firstChild; c; c = c.nextSibling) el(c);
  }
  let ready = false, queue = [];
  function start() {
    ready = true; document.documentElement.lang = lang;
    el(document.body); queue.forEach(el); queue = [];
    if (document.title) { const x = tr(document.title.trim()); if (x) document.title = x; }
    new MutationObserver(ms => { for (const m of ms) { if (m.type === 'characterData') textNode(m.target); else if (m.type === 'attributes') { const e = m.target, v = e.getAttribute(m.attributeName); if (v) { const x = exact.get(v.trim()) || tr(v.trim(), true); if (x && x !== v) e.setAttribute(m.attributeName, x); } } else m.addedNodes.forEach(el); } })
      .observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    // the phone's dialogs (« Demander au club de supprimer… ? »)
    const wrap = f => function (msg) { return f.call(window, msg == null ? msg : (tr(String(msg).trim()) || msg)); };
    window.alert = wrap(window.alert); window.confirm = wrap(window.confirm); const pr = window.prompt; window.prompt = function (m, d) { return pr.call(window, m == null ? m : (tr(String(m).trim()) || m), d); };
    reveal();
  }
  function reveal() { document.documentElement.classList.remove('i18n-wait'); }
  if (lang !== 'fr') {
    // the page waits (hidden) for the dictionary, at most 2 s
    const st = document.createElement('style'); st.textContent = 'html.i18n-wait body{opacity:0}'; document.head.appendChild(st);
    document.documentElement.classList.add('i18n-wait'); setTimeout(reveal, 2000);
    const s = document.createElement('script'); s.src = `js/lang-${lang}.js`;
    s.onload = () => { build(window.I18N_DICT || {}); const go = () => start(); if (document.body) go(); else document.addEventListener('DOMContentLoaded', go); };
    s.onerror = reveal; document.head.appendChild(s);
  }
  // the choice of the language (« Moi », and the code page)
  function card() {
    return `<div class="card lang-card"><h3>🌍 Langue · Language</h3><div class="btns">${LANGS.map(([k, f, l]) => `<button class="b small ${k === lang ? 'on' : ''}" data-lang="${k}" data-noi18n>${f} ${l}</button>`).join('')}</div></div>`;
  }
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-lang]'); if (b) { e.preventDefault(); e.stopPropagation(); set(b.dataset.lang); } }, true);
  return { lang, set, card, t: s => (lang === 'fr' ? s : tr(s) || s) };
})();
