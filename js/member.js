/* Personal code of a licensee (shared by moi.html, joueurs.html and parents.html).
   Each player has his own code, given by the club (printed card or QR code of the category). With it, the player or his
   parents see only his own information and his category's (matches, sessions, results, coaches): never the other players'.
   A parent with several children keeps the codes of each one on his phone and switches from one to the other. */
const Member = (() => {
  const LIST = 'ea-codes', CUR = 'ea-code';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clean = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const pretty = c => clean(c).replace(/^(.{4})(.+)$/, '$1-$2');
  const read = (k, d) => { if (PREVIEW) return k in mem ? mem[k] : d; try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  // « Voir l'appli comme un parent / un joueur » (a responsable, inside the app): nothing is kept on his phone
  const PREVIEW = /[#&]preview=1/.test(location.hash); let mem = {};
  const write = (k, v) => { if (PREVIEW) { mem[k] = v; return; } try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const list = () => read(LIST, []).filter(x => x && x.c);
  // a code in the address (#c=XXXX-XXXX, from the QR code of a card) becomes the current one, then leaves the address
  const hashArg = k => (location.hash.match(new RegExp('[#&]' + k + '=([^&]+)')) || [])[1] || '';
  function current() {
    const h = clean(decodeURIComponent(hashArg('c')));
    if (h.length === 8) { write(CUR, h); try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} return h; }
    const c = read(CUR, ''); return list().some(x => x.c === c) || clean(c).length === 8 ? c : (list()[0] || {}).c || '';
  }
  function remember(c, d) {
    const me = (d && d.me) || {}, l = list().filter(x => x.c !== c);
    write(LIST, [...l, { c, name: me.name || '', first: me.firstName || '', team: d && d.team || '', birth: me.birth || '' }].slice(-6)); write(CUR, c);
  }
  function forget(c) { write(LIST, list().filter(x => x.c !== c)); if (read(CUR, '') === c) write(CUR, (list()[0] || {}).c || ''); }
  const use = c => write(CUR, c);
  // 16 and over: the players' page; younger: the parents' page (both are reachable from each other)
  const age = b => { if (!b) return 99; const d = new Date(b + 'T12:00'), n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return a; };
  const pageFor = d => age(d && d.me && d.me.birth) >= 16 ? 'joueurs.html' : 'parents.html';

  async function rpc(name, args) {
    const c = typeof CLUB_SERVER !== 'undefined' ? CLUB_SERVER : null;
    if (!c || !c.url) throw new Error('Serveur du club introuvable.');
    const headers = { apikey: c.key, 'Content-Type': 'application/json' };
    if (!String(c.key).startsWith('sb_')) headers.Authorization = 'Bearer ' + c.key;
    if (name === 'member_view' && PREVIEW) args = Object.assign({ p_preview: true }, args);
    let r;
    try { r = await fetch(`${c.url.replace(/\/+$/, '')}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(args) }); }
    catch (e) { throw new Error('Pas de connexion internet. Réessaie dans un instant.'); }
    const txt = await r.text();
    if (!r.ok) {
      let m = txt; try { m = JSON.parse(txt).message || txt; } catch (e) {}
      if (/CODE_PERSO/.test(m)) { const e = new Error('Ce code ne fonctionne pas. Vérifie-le, ou demande ton code au coach.'); e.code = 'CODE'; throw e; }
      if (/MATCH_PASSE/.test(m)) throw new Error('Ce match est passé : les réponses sont fermées.');
      if (/COMPLET/.test(m)) throw new Error('Cette tâche est déjà complète. Merci quand même !');
      if (r.status === 404 || /could not find the function/i.test(m)) throw new Error('Cet espace n\'est pas encore prêt : le club doit mettre à jour son serveur.');
      throw new Error('Le serveur ne répond pas. Réessaie dans un instant.');
    }
    return txt ? JSON.parse(txt) : null;
  }

  // the form « Ton code personnel » (category of the QR code shown on top)
  function form(root, opts = {}) {
    const cat = decodeURIComponent(hashArg('cat')).replace(/\+/g, ' ');
    root.innerHTML = `<div class="card code-card">
      ${cat ? `<p class="code-cat">⚽ ${esc(cat)}</p>` : ''}
      <h2>Ton code personnel</h2>
      <p class="info">Le club t'a donné un code de 8 lettres et chiffres (sur ta carte, ou par ton coach). Il ouvre <b>ton</b> espace : tes convocations, ton temps de jeu, les matchs et les séances de ta catégorie.</p>
      <form id="codeForm" autocomplete="off"><input id="codeIn" class="code-in" inputmode="text" autocapitalize="characters" spellcheck="false" maxlength="9" placeholder="ABCD-2345" aria-label="Code personnel" value="${esc(pretty(opts.code || ''))}">
      <button class="b yes on code-go" type="submit">Entrer</button></form>
      <p id="codeErr" class="code-err" role="alert">${esc(opts.error || '')}</p>
      ${list().length ? `<p class="info">Codes déjà enregistrés sur ce téléphone :</p><div class="btns">${list().map(x => `<button class="b small" data-usecode="${esc(x.c)}">${esc(x.first || x.name || pretty(x.c))}</button>`).join('')}</div>` : ''}
      <p class="muted small">Pas de code ? Demande-le à ton coach ou au responsable du club. Ne le donne à personne : il ouvre les informations de ton enfant ou les tiennes.</p></div>`;
    const inp = root.querySelector('#codeIn');
    inp.oninput = () => { const v = pretty(inp.value); if (v !== inp.value) inp.value = v; };
    root.querySelector('#codeForm').onsubmit = async e => {
      e.preventDefault(); const c = clean(inp.value), err = root.querySelector('#codeErr');
      if (c.length !== 8) { err.textContent = 'Le code a 8 caractères (ex : ABCD-2345).'; return; }
      err.textContent = 'Vérification…';
      try { const d = await rpc('member_view', { p_code: c }); remember(c, d); opts.onOk ? opts.onOk(c, d) : location.replace(pageFor(d)); }
      catch (x) { err.textContent = x.message; }
    };
    root.querySelectorAll('[data-usecode]').forEach(b => b.onclick = () => { use(b.dataset.usecode); opts.onOk ? opts.onOk(b.dataset.usecode) : location.replace('moi.html#c=' + b.dataset.usecode); });
  }
  // top of the page: who is shown, the other children of this phone, add a code, the other space
  function bar(d, kind) {
    const l = list(), c = read(CUR, ''), other = kind === 'parents' ? ['joueurs.html', '⚽ Espace joueur'] : ['parents.html', '👪 Espace parents'];
    return `<div class="card who"><span>${kind === 'parents' ? '👪' : '⚽'} <b>${esc((d.me || {}).name || '')}</b>${d.team ? ` · ${esc(d.team)}` : ''}</span>
      <span class="btns">${l.filter(x => x.c !== c).map(x => `<button class="b small" data-usecode="${esc(x.c)}">${esc(x.first || x.name || pretty(x.c))}</button>`).join('')}
      ${PREVIEW ? `<a class="b small lnk" href="${other[0]}#c=${esc(c)}&preview=1">${other[1]}</a>` : `<a class="b small lnk" href="moi.html#add=1">＋ ${kind === 'parents' ? 'Un autre enfant' : 'Un autre code'}</a><a class="b small lnk" href="${other[0]}">${other[1]}</a><button class="b small" data-forget="${esc(c)}">Se déconnecter</button>`}</span></div>`;
  }
  function onBar(e, reload) {
    const u = e.target.closest('[data-usecode]'); if (u) { use(u.dataset.usecode); reload(); return true; }
    const f = e.target.closest('[data-forget]'); if (f) { if (confirm('Retirer ce code de ce téléphone ? Il faudra le retaper pour revenir.')) { forget(f.dataset.forget); location.replace('moi.html'); } return true; }
    return false;
  }
  // the club's crest on top of the family pages
  function crest(d) { const c = d && d.club && d.club.crest, im = document.getElementById('clubCrest'); if (c && im && /^data:image\//.test(c)) im.src = c; }
  return { current, remember, forget, rpc, form, bar, onBar, pretty, clean, pageFor, list, crest };
})();
