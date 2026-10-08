/* Personal code of a licensee (shared by moi.html, joueurs.html and parents.html).
   Each player has his own code, given by the club (printed card or QR code of the category). With it, the player or his
   parents see only his own information and his category's (matches, sessions, results, coaches): never the other players'.
   A parent with several children keeps the codes of each one on his phone and switches from one to the other. */
const Member = (() => {
  const LIST = AppCfg.key('codes'), CUR = AppCfg.key('code');
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
  // (2.07) the families' space only for U15 and younger: a player of U16 and over (Seniors, Vétérans…) has only the players' page.
  // U15 and younger: under 16, the parents' page; the two pages are reachable from each other.
  const age = b => { if (!b) return 99; const d = new Date(b + 'T12:00'), n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return a; };
  const family = d => { const t = String((d && d.team) || '').split(' · ').filter(Boolean); return t.length ? t.some(AppCfg.family) : age(d && d.me && d.me.birth) < 16; };
  const pageFor = d => family(d) && age(d && d.me && d.me.birth) < 16 ? 'parents.html' : 'joueurs.html';

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
      if (/MOT_INTERDIT/.test(m)) throw new Error('Message non envoyé : un mot grossier ou insultant n\'est pas accepté dans ce chat. Reformule gentiment 🙂');
      if (/TROP_VITE/.test(m)) throw new Error('Doucement : attends quelques secondes entre deux messages.');
      if (/CHAT_FERME/.test(m)) throw new Error('Le chat est fermé pour l\'instant par les coachs.');
      if (/SONDAGE_FINI/.test(m)) throw new Error('Ce sondage est terminé.');
      if (/PHOTOS_COACHS/.test(m)) throw new Error('Dans ce chat, seuls les coachs envoient des photos pour l\'instant.');
      if (/\bPHOTO\b/.test(m)) throw new Error('Cette photo ne passe pas : essaie avec une autre.');
      if (/LIMITE_CHAT/.test(m)) throw new Error('Beaucoup de messages aujourd\'hui : réessaie demain.');
      if (/LIMITE/.test(m)) throw new Error('Tu as déjà envoyé 10 messages aujourd’hui : réessaie demain.');
      if (/CODE_PERSO/.test(m)) { const e = new Error('Ce code ne fonctionne pas. Vérifie-le, ou demande ton code au coach.'); e.code = 'CODE'; throw e; }
      if (/MATCH_PASSE/.test(m)) throw new Error('C\'est passé : les réponses sont fermées.');
      if (/COMPLET/.test(m)) throw new Error('Cette tâche est déjà complète. Merci quand même !');
      if (r.status === 404 || /could not find the function/i.test(m)) throw new Error('Cet espace n\'est pas encore prêt : le club doit mettre à jour son serveur.');
      throw new Error('Le serveur ne répond pas. Réessaie dans un instant.');
    }
    return txt ? JSON.parse(txt) : null;
  }

  // the form « Ton code personnel » (category of the QR code shown on top)
  function form(root, opts = {}) {
    sheetCss();
    const cat = decodeURIComponent(hashArg('cat')).replace(/\+/g, ' ');
    root.innerHTML = `<div class="card code-card">
      ${cat ? `<p class="code-cat">⚽ ${esc(cat)}</p>` : ''}
      <h2>Ton code personnel</h2>
      <p class="info">Le club t'a donné un code de 8 lettres et chiffres (sur ta carte, ou par ton coach). Il ouvre <b>ton</b> espace : tes convocations, ton temps de jeu, les matchs et les séances de ta catégorie.</p>
      <form id="codeForm" autocomplete="off"><input id="codeIn" class="code-in" inputmode="text" autocapitalize="characters" spellcheck="false" maxlength="9" placeholder="ABCD-2345" aria-label="Code personnel" value="${esc(pretty(opts.code || ''))}">
      <label class="consent"><input type="checkbox" id="codeOk"> <span>J'ai lu la <a href="confidentialite.html" target="_blank">page confidentialité</a>. Si le joueur a moins de 15 ans, je suis son parent et je donne mon accord.</span></label>
      <button class="b yes on code-go" type="submit">Entrer</button></form>
      <p id="codeErr" class="code-err" role="alert">${esc(opts.error || '')}</p>
      ${list().length ? `<p class="info">Codes déjà enregistrés sur ce téléphone :</p><div class="btns">${list().map(x => `<button class="b small" data-usecode="${esc(x.c)}">${esc(x.first || x.name || pretty(x.c))}</button>`).join('')}</div>` : ''}
      <p class="muted small">Pas de code ? Demande-le à ton coach ou au responsable du club. Ne le donne à personne : il ouvre les informations de ton enfant ou les tiennes.</p></div>`;
    const inp = root.querySelector('#codeIn');
    inp.oninput = () => { const v = pretty(inp.value); if (v !== inp.value) inp.value = v; };
    root.querySelector('#codeForm').onsubmit = async e => {
      e.preventDefault(); const c = clean(inp.value), err = root.querySelector('#codeErr');
      if (c.length !== 8) { err.textContent = 'Le code a 8 caractères (ex : ABCD-2345).'; return; }
      if (!root.querySelector('#codeOk').checked) { err.textContent = 'Coche la case : tu as lu la page confidentialité (et, pour un enfant de moins de 15 ans, tu es son parent).'; return; }
      err.textContent = 'Vérification…';
      try { const d = await rpc('member_view', { p_code: c }); remember(c, d); opts.onOk ? opts.onOk(c, d) : location.replace(pageFor(d)); }
      catch (x) { err.textContent = x.message; }
    };
    root.querySelectorAll('[data-usecode]').forEach(b => b.onclick = () => { use(b.dataset.usecode); opts.onOk ? opts.onOk(b.dataset.usecode) : location.replace('moi.html#c=' + b.dataset.usecode); });
  }
  // top of the page: who is shown, the other children of this phone, add a code, the other space
  function bar(d, kind) {
    const l = list(), c = read(CUR, ''), other = kind === 'parents' ? ['joueurs.html', '⚽ Espace joueur'] : family(d) ? ['parents.html', '👪 Espace parents'] : null;
    return `<div class="card who"><span>${kind === 'parents' ? '👪' : '⚽'} <b>${esc((d.me || {}).name || '')}</b>${d.team ? ` · ${esc(d.team)}` : ''}</span>
      <span class="btns">${l.filter(x => x.c !== c).map(x => `<button class="b small" data-usecode="${esc(x.c)}">${esc(x.first || x.name || pretty(x.c))}</button>`).join('')}
      ${PREVIEW ? (other ? `<a class="b small lnk" href="${other[0]}#c=${esc(c)}&preview=1">${other[1]}</a>` : '') : `<a class="b small lnk" href="moi.html#add=1">＋ ${kind === 'parents' ? 'Un autre enfant' : 'Un autre code'}</a>${other ? `<a class="b small lnk" href="${other[0]}">${other[1]}</a>` : ''}<button class="b small" data-forget="${esc(c)}">Se déconnecter</button>`}</span></div>`;
  }
  function privacy() {
    return `<div class="card privacy"><p class="info">🔒 <a href="confidentialite.html">Confidentialité</a> : ta fiche, ta santé et tes contacts ne sont vus que par les coachs de ta catégorie et les responsables du club. Ce que tu écris ou envoies dans le chat est vu par ta catégorie (photos effacées après 90 jours, messages après 1 an).</p>
      <button class="b small" data-forgetme>🗑️ Supprimer mes données</button></div>`;
  }
  // the request goes to the coaches of the category (they delete the player's file)
  async function forgetMe(kind) {
    const c = read(CUR, ''), me = list().find(x => x.c === c) || {};
    if (!confirm('Demander au club de supprimer toutes les données de ' + (me.first || me.name || 'ce joueur') + ' ? Les coachs reçoivent la demande et suppriment la fiche dans le mois. Le code ne marchera plus ensuite.')) return;
    try {
      await rpc('member_message', { p_code: c, p_parent: kind === 'parents', p_body: `🗑️ Demande de suppression des données de ${me.name || me.first || 'ce joueur'} (espace ${kind === 'parents' ? 'parents' : 'joueur'}). Merci de supprimer sa fiche, ses photos et ses réponses dans le mois, puis de le confirmer.` });
      alert('Ta demande est envoyée aux coachs. Ils suppriment les données dans le mois.');
    } catch (e) { alert(e.message); }
  }

  /* ---------- (3.68) notifications on the family's phone: convocation, change of time or place, cancellation ---------- */
  let nState = null, nAsked = false;
  const b64 = s => { const p = '='.repeat((4 - s.length % 4) % 4), raw = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(raw, ch => ch.charCodeAt(0)); };
  const pushOk = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && location.protocol !== 'file:';
  const ios = () => /iPhone|iPad|iPod/.test(navigator.userAgent), standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  // the card (filled once the club's server has answered)
  /* ---------- (2.05) « install the app »: a guide step by step for the phone in hand (iPhone, Android, an app's browser) ---------- */
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; document.dispatchEvent(new Event('member-redraw')); });
  window.addEventListener('appinstalled', () => { installEvt = null; document.dispatchEvent(new Event('member-redraw')); });
  const LATER = () => AppCfg.key('install-later');
  const ua = () => navigator.userAgent || '';
  const inApp = () => /FBAN|FBAV|Instagram|Snapchat|TikTok|Line\/|LinkedInApp|; wv\)/.test(ua());
  const android = () => /Android/.test(ua());
  const platform = () => inApp() ? 'inapp' : ios() ? (/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua()) ? 'ios-other' : 'ios') : android() ? 'android' : 'desktop';
  const SHARE = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" style="vertical-align:-5px"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round"/></svg>';
  function installCard(kind) {
    if (PREVIEW) return '';
    if (standalone()) {
      // installed: the last step, the notifications
      if (!pushOk()) return '';
      if (!nAsked) { nAsked = true; refreshNotify(); }
      return nState === false ? `<div class="card inst-card"><p><b>🔔 Dernière étape</b> : active les notifications pour être prévenu (convocations, chat, changements).</p><button class="b yes on" data-mnotif="on" data-kind="${kind}">Activer les notifications</button></div>` : '';
    }
    let later = 0; try { later = +localStorage.getItem(LATER()) || 0; } catch (e) {}
    if (Date.now() - later < 5 * 864e5 || platform() === 'desktop') return '';
    return `<div class="card inst-card"><p><b>📲 Installe l'appli sur ton téléphone</b><br><span class="info">Une icône comme une vraie appli, les notifications et le compteur de nouveautés. 1 minute.</span></p>
      <div class="btns">${installEvt ? '<button class="b yes on" data-inst="go">📲 Installer</button>' : '<button class="b yes on" data-inst="how">📲 Comment faire</button>'}<button class="b small" data-inst="later">Plus tard</button></div></div>`;
  }
  function installSheet() {
    sheetCss();
    const p = platform(), code = pretty(current() || ''), step = (n, h) => `<li><span class="inst-n">${n}</span><div>${h}</div></li>`;
    const codeStep = code ? `Ouvre l'appli avec la <b>nouvelle icône</b>, puis entre ton code : <span class="inst-code">${esc(code)}</span> <button class="b small" type="button" data-inst="copy">📋 Copier</button><br><span class="info small">Sur iPhone, l'appli installée ne connaît pas encore ton code : il faut le donner une fois.</span>` : 'Ouvre l\'appli avec la <b>nouvelle icône</b>.';
    const steps = p === 'inapp' ? `<p class="info">Tu as ouvert le lien dans une autre appli (Facebook, Instagram…) : elle ne sait pas installer.</p><ol class="inst">
        ${step(1, 'Touche <b>⋯</b> ou <b>⋮</b> en haut de l\'écran.')}${step(2, 'Choisis <b>« Ouvrir dans Safari »</b> (iPhone) ou <b>« Ouvrir dans Chrome »</b> (Android).')}${step(3, 'Reviens ici et touche « Installer l\'appli ».')}</ol>
        <p><button class="b small" type="button" data-inst="link">🔗 Copier le lien de la page</button></p>`
      : p === 'ios' || p === 'ios-other' ? `<ol class="inst">
        ${step(1, `Touche le bouton <b>Partager</b> ${SHARE} ${p === 'ios' ? 'en bas de l\'écran (en haut à droite sur iPad). <span class="info small">Pas de barre en bas ? Touche d\'abord le bas de l\'écran ou ⋯.</span>' : 'en haut à droite de Chrome.'}`)}
        ${step(2, 'Fais défiler et touche <b>« Sur l\'écran d\'accueil »</b> ⊞.')}
        ${step(3, 'Touche <b>« Ajouter »</b> en haut à droite. L\'icône du club apparaît sur ton écran.')}
        ${step(4, codeStep)}
        ${step(5, 'Dans l\'appli : touche <b>« Activer les notifications »</b> puis <b>« Autoriser »</b>.')}</ol>
        ${p === 'ios-other' ? '<p class="info small">Si tu ne trouves pas « Sur l\'écran d\'accueil », ouvre cette page dans <b>Safari</b> : ça marche toujours.</p>' : ''}`
      : `<ol class="inst">${step(1, 'Touche le menu <b>⋮</b> en haut à droite de Chrome.')}${step(2, 'Touche <b>« Installer l\'appli »</b> ou <b>« Ajouter à l\'écran d\'accueil »</b>.')}
        ${step(3, 'Confirme avec <b>« Installer »</b>, puis ouvre l\'appli avec la nouvelle icône (ton code est gardé).')}${step(4, 'Touche <b>« Activer les notifications »</b> puis <b>« Autoriser »</b>.')}</ol>`;
    const o = document.createElement('div'); o.className = 'rs-back';
    o.innerHTML = `<div class="rs-sheet inst-sheet" role="dialog" aria-label="Installer l'appli"><h3>📲 Installer l'appli</h3>${steps}<div class="btns"><button class="b" type="button" data-x>Fermer</button></div></div>`;
    document.body.appendChild(o);
    o.addEventListener('click', async e => {
      if (e.target === o || e.target.closest('[data-x]')) return o.remove();
      const b = e.target.closest('[data-inst]'); if (!b) return;
      const copy = async t => { try { await navigator.clipboard.writeText(t); b.textContent = '✓ Copié'; } catch (err) { prompt('Copie ceci :', t); } };
      if (b.dataset.inst === 'copy') copy(code);
      if (b.dataset.inst === 'link') copy(location.href.split('#')[0]);
    });
  }
  async function installClick(b) {
    const k = b.dataset.inst;
    if (k === 'later') { try { localStorage.setItem(LATER(), Date.now()); } catch (e) {} document.dispatchEvent(new Event('member-redraw')); return; }
    if (k === 'go' && installEvt) { const e = installEvt; installEvt = null; e.prompt(); try { await e.userChoice; } catch (err) {} document.dispatchEvent(new Event('member-redraw')); return; }
    installSheet();
  }
  // (2.05) the rankings: a player may say he does not want to be in them
  function optoutCard(L) {
    if (!L || L.hidden || typeof L.optout !== 'boolean') return '';
    return `<div class="card"><p class="info">🏆 <b>Classements de la catégorie</b> : ${L.optout ? 'tu n\'y apparais pas pour les autres (tu vois toujours tes chiffres et tes badges).' : 'ton prénom et tes chiffres (buts, passes, présences) y apparaissent pour ta catégorie.'}</p>
      <button class="b small" data-optout="${L.optout ? 0 : 1}">${L.optout ? 'Apparaître dans les classements' : 'Ne pas apparaître dans les classements'}</button></div>`;
  }
  function notifyCard(kind) {
    if (PREVIEW) return '';
    // (iPhone) the notifications only work from the home screen icon, in Safari as in Chrome (Chrome on iPhone says it can, then fails)
    if (ios() && !standalone()) return `<div class="card notif-card"><p class="info">🔔 <b>Être prévenu sur ce téléphone</b> (convocations, changements d'horaire, annulations) : sur iPhone, ajoute d'abord cette page à l'écran d'accueil. ${/CriOS/.test(navigator.userAgent) ? 'Dans Chrome : touche <b>Partager</b> (le carré avec la flèche, en haut à droite) → <b>« Sur l\'écran d\'accueil »</b>' : 'Dans Safari : touche <b>Partager</b> (le carré avec la flèche) → <b>« Sur l\'écran d\'accueil »</b>'}, puis ouvre-la depuis cette nouvelle icône : le bouton « Me prévenir » apparaît.</p></div>`;
    if (!pushOk()) return '';
    if (!nAsked) { nAsked = true; refreshNotify(); }
    if (nState === null || nState === 'old') return '';
    return `<div class="card notif-card">${nState ? `<p class="info">🔔 Ce téléphone est prévenu : convocations, changements d'horaire ou de lieu, annulations. <button class="b small" data-mnotif="off" data-kind="${kind}">Arrêter</button></p>`
      : `<p class="info"><b>🔔 Être prévenu sur ce téléphone</b> : convocations, changements d'horaire ou de lieu, matchs et séances annulés.</p><button class="b yes on" data-mnotif="on" data-kind="${kind}">Me prévenir</button>`}</div>`;
  }
  async function refreshNotify() {
    try {
      const reg = await navigator.serviceWorker.register('sw.js'); await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      nState = sub ? !!(await rpc('member_push', { p_code: current(), p_endpoint: sub.endpoint })).on : (await rpc('member_push', { p_code: current() }), false);
    } catch (e) { nState = 'old'; return; } // a club server not updated yet: no card
    document.dispatchEvent(new Event('member-redraw'));
  }
  async function setNotify(on, kind) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (!on) { const sub = await reg.pushManager.getSubscription(); if (sub) await rpc('member_push', { p_code: current(), p_endpoint: sub.endpoint, p_on: false }); nState = false; document.dispatchEvent(new Event('member-redraw')); return; }
      if (await Notification.requestPermission() !== 'granted') return alert('Autorise les notifications pour cette appli dans les réglages du téléphone.');
      const k = (await rpc('member_push', { p_code: current() })).key; if (!k) return alert('Les notifications ne sont pas encore prêtes sur le serveur du club.');
      let sub = await reg.pushManager.getSubscription(); if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(k) });
      await rpc('member_push', { p_code: current(), p_endpoint: sub.endpoint, p_on: true, p_page: kind === 'parents' ? 'parents.html' : 'joueurs.html' });
      nState = true; document.dispatchEvent(new Event('member-redraw'));
    } catch (e) { alert(e.message || 'Notifications impossibles sur ce téléphone.'); }
  }
  /* ---------- (1.64) the family pages in tabs: a bar at the bottom of the screen, like an app ---------- */
  let tabCur = null;
  const TABKEY = kind => AppCfg.key('tab-' + kind);
  function tabCss() {
    if (document.getElementById('tabCss')) return;
    const st = document.createElement('style'); st.id = 'tabCss';
    st.textContent = 'body.has-tabs main{padding-bottom:calc(env(safe-area-inset-bottom) + 96px)}'
      + '.tabbar{position:fixed;left:0;right:0;bottom:0;z-index:8;display:flex;justify-content:center;gap:2px;padding:6px 6px calc(env(safe-area-inset-bottom) + 6px);background:#0e1d45;border-top:3px solid #8c1024;box-shadow:0 -6px 20px rgba(0,0,0,.18);border-radius:18px 18px 0 0}'
      + 'body:not(.tabs-top) .tabbar::after{content:"";position:absolute;left:0;right:0;top:100%;height:120px;background:#0e1d45;pointer-events:none}'
      + '.tab{flex:1 1 0;max-width:120px;min-width:0;display:flex;flex-direction:column;align-items:center;gap:3px;padding:7px 2px 6px;border:0;border-radius:12px;background:transparent;color:rgba(255,255,255,.72);font-family:inherit;font-weight:600;font-size:11.5px;line-height:1.2;cursor:pointer}'
      + '.tab .ti{font-size:21px;line-height:1}.tab span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}'
      + '.tab.on{background:rgba(201,164,92,.18);color:#e2c27d;box-shadow:inset 0 3px 0 #c9a45c}'
      + '.tip-card{border-left:5px solid #c9a45c}.tip-card .tc-head{display:flex;justify-content:space-between;gap:8px;align-items:baseline;flex-wrap:wrap}.tip-card h3{margin:0;font-size:17px}'
      + '.tc-sess{margin:8px 0;padding:10px;border-radius:12px;background:var(--bg)}.tc-sess ol{margin:6px 0 0;padding-left:20px}.tc-sess li{margin:6px 0}.tc-links,.tc-files{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}'
      + '.tf-view{position:fixed;inset:0;z-index:95;background:rgba(10,15,34,.75);display:flex;align-items:center;justify-content:center;padding:16px}.tf-box{background:var(--surface);color:var(--ink);border-radius:16px;padding:16px;max-width:min(720px,100%);max-height:92vh;overflow:auto;text-align:center}.tf-box img{max-width:100%;border-radius:10px}'
      + '.tip-card .tc-txt{white-space:pre-wrap;margin:8px 0 4px}.tip-card .tc-th{display:inline-block;font-size:13px;font-weight:700;padding:2px 9px;border-radius:999px;background:var(--bg);border:1px solid var(--line);margin-bottom:6px}'
      + '.tab-pane>h2:first-child{margin-top:8px}'
      + '.kb{display:inline-flex;align-items:center;gap:4px;font-size:13px;font-weight:800;padding:3px 10px;border-radius:999px;color:#fff;margin:2px 6px 2px 0;white-space:nowrap}'
      + '.kb-team{background:#0e1d45}.kb-champ{background:#2563eb}.kb-cup{background:#b7791f}.kb-ami{background:#15803d}.kb-tour{background:#ea580c}.kb-tr{background:#7c3aed;font-size:12px;padding:2px 8px}'
      + '.card.k-champ{border-left:6px solid #2563eb}.card.k-cup{border-left:6px solid #b7791f}.card.k-ami{border-left:6px solid #15803d}.card.k-tour{border-left:6px solid #ea580c}'
      + '.prog-g{margin:8px 0;max-width:100%;overflow:hidden}.prog-g .tr{flex-wrap:wrap;align-items:center;gap:6px 10px}.prog-g .tr .d{min-width:0;width:100%;text-transform:capitalize}.prog-g .tr>span:nth-child(2){flex:1 1 160px;min-width:0}'
      + '.prog-g .tr .btns{display:flex;flex-direction:row;flex-wrap:nowrap;gap:6px}.prog-g .tr .btns .b{min-height:40px;padding:0 12px}.tr-m .why{display:block;font-size:13px;color:var(--muted)}.prog-g>summary{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;cursor:pointer;padding:12px 14px;border-radius:14px;background:var(--surface);border:1px solid var(--line);list-style:none;font-size:16px}'
      + '.prog-g>summary::-webkit-details-marker{display:none}.prog-g>summary::after{content:"▾";font-size:18px;color:var(--muted)}.prog-g[open]>summary::after{content:"▴"}.prog-g[open]>summary{border-radius:14px 14px 0 0;border-bottom:0}.prog-g>.card{border-radius:0 0 14px 14px;margin-top:0}.prog-g .todo{color:#b45309}'
      + '.tr-ans{border-left:4px solid #7c3aed;padding-left:10px}.tr-m{padding-left:10px;border-left:4px solid #2563eb}.tr.k-cup{border-left-color:#b7791f}.tr.k-ami{border-left-color:#15803d}.tr.k-tour{border-left-color:#ea580c}'
      + 'body.has-tabs .toast{bottom:calc(env(safe-area-inset-bottom) + 84px)}'
      // (2.01) more comfortable for a finger: bigger small buttons, the well-being scale on two lines, small texts readable
      + '.b.small{min-height:40px}.b:disabled{opacity:.55}.wb-scale{grid-template-columns:repeat(5,1fr)!important;gap:6px!important}.wb-scale button{min-height:44px!important;font-size:16px}'
      + '.gm-s small,.gm-src{font-size:12.5px!important}'
      + '.row-h{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}.row-h h2{margin-right:auto}'
      + '.inst-card{border-left:5px solid #2563eb}.inst-card p{margin:0 0 8px}.inst{list-style:none;margin:8px 0;padding:0;display:flex;flex-direction:column;gap:10px}.inst li{display:flex;gap:10px;align-items:flex-start;line-height:1.45}'
      + '.inst-n{flex:none;width:28px;height:28px;border-radius:50%;background:#2563eb;color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center}.inst-code{display:inline-block;font:800 18px/1 ui-monospace,Menlo,monospace;letter-spacing:.08em;padding:4px 8px;border-radius:8px;background:var(--bg);border:1px solid var(--line)}'
      + '.inst-sheet{max-height:88vh;overflow-y:auto}'
      + '.bdg{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:8px}.bdg span{display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 4px;border-radius:12px;text-align:center}'
      + '.bdg b{font-size:28px;line-height:1}.bdg i{font-style:normal;font-size:11.5px;font-weight:700;line-height:1.2}.bdg-on{background:color-mix(in srgb,#c9a45c 22%,transparent)}.bdg-off{opacity:.38;filter:grayscale(1);border:1px dashed var(--line)}'
      + '.lead-card h3{margin:10px 0 4px;font-size:15px}.lead{list-style:none;margin:0;padding:0}.lead li{display:flex;align-items:center;gap:10px;padding:6px 4px;border-bottom:1px solid var(--line)}.lead li:last-child{border:0}'
      + '.lead li span{width:24px;text-align:center;font-weight:800}.lead li b{flex:1}.lead li em{font-style:normal;font-weight:800}.lead li.me{background:color-mix(in srgb,#c9a45c 18%,transparent);border-radius:8px}'
      // (2.03) 7 or 8 tabs: a bit smaller, so « Bénévoles » or « Résultats » are not cut
      + '.tabbar[data-n="7"] .tab,.tabbar[data-n="8"] .tab{padding:6px 0 5px;gap:2px}.tabbar[data-n="7"] .tab .ti,.tabbar[data-n="8"] .tab .ti{font-size:19px}'
      + '.tabbar[data-n="7"] .tab span:not(.ti),.tabbar[data-n="8"] .tab span:not(.ti){font-size:10.5px;letter-spacing:-.2px}'
      // (1.94) the other view, chosen by the player: one small menu at the top right instead of the bar at the bottom
      + '.tabmenu{display:none}body.tabs-top main{padding-bottom:calc(env(safe-area-inset-bottom) + 24px)}body.tabs-top header.top .top-in{padding-right:140px}body.tabs-top .toast{bottom:calc(env(safe-area-inset-bottom) + 16px)}'
      + 'body.tabs-top .tabbar{top:calc(env(safe-area-inset-top) + 10px);bottom:auto;left:auto;right:10px;flex-direction:column;align-items:stretch;gap:2px;padding:4px;border:1px solid rgba(201,164,92,.55);border-radius:18px;background:rgba(14,29,69,.94);box-shadow:0 6px 18px rgba(0,0,0,.25)}'
      + 'body.tabs-top .tabmenu{display:flex;align-items:center;justify-content:flex-end;gap:6px;border:0;border-radius:14px;padding:6px 10px;background:transparent;color:#e2c27d;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer}'
      + 'body.tabs-top .tabbar .tab{display:none}body.tabs-top .tabbar.open{min-width:190px}body.tabs-top .tabbar.open .tab{display:flex;flex-direction:row;justify-content:flex-start;align-items:center;gap:10px;max-width:none;padding:9px 12px;font-size:14px}'
      + 'body.tabs-top .tab .ti{font-size:18px}body.tabs-top .tab.on{box-shadow:inset 3px 0 0 #c9a45c}'
      + '.tabpos{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}';
    document.head.appendChild(st);
  }
  // list: [{ id, icon, label, html, empty }] — the chosen tab stays the same when the page is redrawn
  // (1.94) where the tabs are: « bas » (the bar at the bottom, by default) or « haut » (a small menu at the top right), kept on this phone
  const TABPOS = () => AppCfg.key('tabpos');
  function tabPos() { try { return localStorage.getItem(TABPOS()) === 'haut' ? 'haut' : 'bas'; } catch (e) { return 'bas'; } }
  const menuIn = (icon, label) => `<span>${icon}</span><span>${esc(label)}</span><span aria-hidden="true">▾</span>`;
  const menuBtn = t => `<button class="tabmenu" data-tabmenu aria-label="Changer d'onglet">${menuIn(t.icon, t.label)}</button>`;
  function tabPosCard() {
    const p = tabPos();
    return `<div class="card"><p class="info">🧭 Où veux-tu les onglets ?</p><div class="tabpos">
      <button class="b small ${p === 'bas' ? 'yes on' : ''}" data-tabpos="bas">⬇️ Barre en bas</button><button class="b small ${p === 'haut' ? 'yes on' : ''}" data-tabpos="haut">↗️ Menu discret en haut à droite</button></div></div>`;
  }
  function setTabPos(p) {
    try { localStorage.setItem(TABPOS(), p); } catch (e) {}
    document.body.classList.toggle('tabs-top', p === 'haut');
    document.querySelectorAll('.tabbar').forEach(n => n.classList.remove('open'));
    document.querySelectorAll('[data-tabpos]').forEach(b => { const on = b.dataset.tabpos === p; b.classList.toggle('on', on); b.classList.toggle('yes', on); });
  }
  document.addEventListener('click', e => {
    const m = e.target.closest('[data-tabmenu]'); if (m) { m.closest('.tabbar').classList.toggle('open'); return; }
    const tp = e.target.closest('[data-tabpos]'); if (tp) { setTabPos(tp.dataset.tabpos); return; }
    if (!e.target.closest('.tabbar')) document.querySelectorAll('.tabbar.open').forEach(n => n.classList.remove('open'));
  });
  // (1.98) the app open: its notifications are read (the number on the icon goes down); a chat notification touched: the chat tab
  const PAGE = (location.pathname.split('/').pop() || '').replace(/[^\w.-]/g, '');
  const seenNotifs = () => { try { const c = navigator.serviceWorker && navigator.serviceWorker.controller; if (c && PAGE) c.postMessage({ raincySeen: PAGE }); } catch (e) {} };
  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('message', e => { const u = String((e.data && e.data.raincyOpen) || '');
      if (/#chat\b/.test(u)) { const b = document.querySelector('.tabbar [data-tab="chat"]'); if (b) showTab(b); } });
    navigator.serviceWorker.ready.then(seenNotifs).catch(() => {});
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') seenNotifs(); });
  function tabs(kind, list) {
    tabCss(); document.body.classList.add('has-tabs'); document.body.classList.toggle('tabs-top', tabPos() === 'haut'); checkNew();
    // (1.98) opened from a chat notification (« …#chat »): the chat tab
    if (/^#chat\b/.test(location.hash) && list.some(t => t.id === 'chat')) { tabCur = 'chat'; try { sessionStorage.setItem(TABKEY(kind), 'chat'); history.replaceState(null, '', location.pathname + location.search); } catch (e) {} }
    if (!list.some(t => t.id === tabCur)) { let s = ''; try { s = sessionStorage.getItem(TABKEY(kind)) || ''; } catch (e) {} tabCur = list.some(t => t.id === s) ? s : list[0].id; }
    return list.map(t => `<section class="tab-pane" data-pane="${t.id}" role="tabpanel" ${t.id === tabCur ? '' : 'hidden'}>${t.html && t.html.trim() ? t.html : `<p class="tip">${t.empty || 'Rien pour l\'instant.'}</p>`}</section>`).join('')
      + `<nav class="tabbar" role="tablist" data-kind="${kind}" data-n="${list.length}">${menuBtn(list.find(t => t.id === tabCur))}${list.map(t => `<button class="tab ${t.id === tabCur ? 'on' : ''}" role="tab" aria-selected="${t.id === tabCur}" data-tab="${t.id}"><span class="ti">${t.icon}</span><span>${esc(t.label)}</span></button>`).join('')}</nav>`;
  }
  // (1.65) the coach's personal suggestions for this player (Séances tab), from the club server (member_tips)
  const fmtDay = d => { try { return new Date(d + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }); } catch (e) { return d; } };
  // (1.74) a ready session joined to the tip: its goal and its exercises
  function tipSession(s) {
    if (!s || !s.exercises) return '';
    const total = s.exercises.reduce((a, e) => a + (+e.duration || 0), 0);
    return `<div class="tc-sess"><b>📋 ${esc(s.title || 'Séance')}${total ? ` · ${total} min` : ''}</b>${s.goal ? `<p class="info">🎯 ${esc(s.goal)}</p>` : ''}
      <ol>${s.exercises.map(e => `<li><b>${esc(e.title || 'Exercice')}</b>${+e.duration ? ` <span class="info">· ${esc(e.duration)} min</span>` : ''}
        ${e.org ? `<div class="info">${esc(e.org)}</div>` : ''}${e.consignes ? `<div class="info">${esc(e.consignes).split('\n').join('<br>')}</div>` : ''}${e.materiel ? `<div class="info">🧰 ${esc(e.materiel)}</div>` : ''}</li>`).join('')}</ol></div>`;
  }
  // video links and the files (PDF, images, the schemas) kept on the club server
  function tipMedia(t) {
    const links = [...new Set([...(t.links || []), t.link].filter(x => /^https:\/\//.test(x || '')))];
    const files = t.files || [];
    return (links.length ? `<p class="tc-links">${links.map((u, i) => `<a class="b small" href="${esc(u)}" target="_blank" rel="noopener noreferrer">▶️ ${links.length > 1 ? 'Vidéo ' + (i + 1) : 'Voir la vidéo'}</a>`).join(' ')}</p>` : '')
      + (files.length ? `<p class="tc-files">${files.map(x => `<button class="b small" data-tipfile="${esc(x.id)}">${x.mime === 'application/pdf' ? '📄' : '🖼️'} ${esc(x.name || 'Fichier')}</button>`).join(' ')}</p>` : '');
  }
  async function openTipFile(id) {
    const v = document.createElement('div'); v.className = 'tf-view';
    v.innerHTML = '<div class="tf-box"><p>Ouverture…</p><button class="b small" data-tfclose>Fermer</button></div>'; document.body.appendChild(v);
    v.onclick = e => { if (e.target === v || e.target.closest('[data-tfclose]')) v.remove(); };
    try {
      const f = await rpc('member_tip_file', { p_code: current(), p_id: id }); if (!f || !/^data:(image\/(png|jpe?g|webp|gif)|application\/pdf);base64,/.test(String(f.data))) throw new Error('Fichier introuvable.'); // (2.01) only an image or a PDF
      const box = v.querySelector('.tf-box');
      if (/^image\//.test(f.mime)) box.innerHTML = `<img src="${f.data}" alt=""><p><button class="b small" data-tfclose>Fermer</button></p>`;
      else {
        const bin = atob(f.data.split(',')[1]), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        const url = URL.createObjectURL(new Blob([u8], { type: 'application/pdf' }));
        box.innerHTML = `<p><b>📄 ${esc(f.name || 'Document')}</b></p><p><a class="b yes on" href="${url}" target="_blank" rel="noopener">Ouvrir le PDF</a> <a class="b" href="${url}" download="${esc(f.name || 'document.pdf')}">Télécharger</a></p><p><button class="b small" data-tfclose>Fermer</button></p>`;
      }
    } catch (e) { v.querySelector('.tf-box').innerHTML = `<p>${esc(e.message || 'Ouverture impossible')}</p><button class="b small" data-tfclose>Fermer</button>`; }
  }
  function tipsHtml(tips, who) {
    // (1.72) always shown, so the player knows where to look
    if (!tips || !tips.length) return `<h2>💡 Les conseils du coach</h2><p class="tip">Pas encore de conseil du coach. Quand il enverra un exercice pour progresser (course, passe, positionnement…), il apparaîtra ici.</p>`;
    return `<h2>💡 Les conseils du coach</h2><p class="info small">Des exercices choisis pour ${esc(who || 'toi')}, pour progresser là où c'est le plus utile.</p>`
      + tips.map(t => `<article class="card tip-card"><span class="tc-th">${esc(t.icon || '💡')} ${esc(t.themeLabel || 'Conseil')}</span>
        <div class="tc-head"><h3>${esc(t.title || 'Séance perso')}</h3><span class="muted small">${t.by ? esc(t.by) + ' · ' : ''}${esc(fmtDay(t.at || ''))}</span></div>
        ${t.text ? `<p class="tc-txt">${esc(t.text)}</p>` : ''}${tipSession(t.session)}${tipMedia(t)}</article>`).join('');
  }
  async function tips(code) { try { const r = await rpc('member_tips', { p_code: code }); return Array.isArray(r) ? r : []; } catch (e) { return []; } } // not yet on the server: nothing shown
  function showTab(b0) {
    // (2.01) a button elsewhere in the page (« Écrire au coach ») stands for its tab: the real tab button gives the icon and the label
    const b = document.querySelector(`.tabbar [data-tab="${b0.dataset.tab}"]`); if (!b) return;
    tabCur = b.dataset.tab; const kind = b.closest('.tabbar').dataset.kind || '';
    try { sessionStorage.setItem(TABKEY(kind), tabCur); } catch (e) {}
    document.querySelectorAll('.tab-pane').forEach(p => { p.hidden = p.dataset.pane !== tabCur; });
    document.querySelectorAll('.tabbar .tab').forEach(x => { const on = x.dataset.tab === tabCur; x.classList.toggle('on', on); x.setAttribute('aria-selected', on); });
    document.querySelectorAll('.tabbar').forEach(n => { n.classList.remove('open'); const mb = n.querySelector('[data-tabmenu]'); if (mb) mb.innerHTML = menuIn(b.querySelector('.ti').textContent, b.lastElementChild.textContent); });
    window.scrollTo(0, 0);
  }
  /* ---------- (1.67) « Mettre à jour l'appli » : no need to close and reopen it ---------- */
  const pageBuild = () => { const s = document.querySelector('script[src*="member.js?v="]'); return s ? +((s.getAttribute('src').match(/v=(\d+)/) || [])[1] || 0) : 0; };
  async function updateApp() {
    const t = document.getElementById('toast'); if (t) { t.textContent = 'Mise à jour de l\'appli…'; t.className = 'toast show'; }
    try { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r => r.update().catch(() => {}))); } catch (e) {} // kept: the notifications stay on
    try { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); } catch (e) {}
    setTimeout(() => location.reload(), 300);
  }
  function updateCard() {
    return `<div class="card"><p class="info">📲 Une nouveauté annoncée par le club ? Touche le bouton pour avoir la dernière version, sans fermer l'appli.</p>
      <button class="b yes on" data-mupdate>🔄 Mettre à jour l'appli</button></div>`;
  }
  // a newer version online: a bar on top of the page
  let checked = false;
  async function checkNew() {
    if (checked || location.protocol === 'file:') return; checked = true;
    try {
      const v = await (await fetch('version.json?t=' + Date.now(), { cache: 'no-store' })).json(), mine = pageBuild();
      if (!mine || !(v.build > mine) || document.getElementById('updBar')) return;
      const bar = document.createElement('div'); bar.id = 'updBar';
      bar.style.cssText = 'display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;background:#c9a45c;color:#14172b;padding:10px 16px;font-weight:700';
      bar.innerHTML = `<span>✨ Nouvelle version de l'appli (${esc(v.version || '')})</span><button class="b small" data-mupdate>🔄 Mettre à jour</button>`;
      const top = document.querySelector('header.top'); top ? top.after(bar) : document.body.prepend(bar);
    } catch (e) {}
  }
  /* (1.78) the kind of an event, with its pictogram and its colour (championship, cup, friendly, tournament, training) */
  function kind(m) {
    const c = String((m && m.competition) || '');
    if (/coupe|\bcup\b|challenge|troph/i.test(c)) return ['cup', '🏅', 'Coupe'];
    if (/amical|friendly|pr[ée]pa/i.test(c)) return ['ami', '🤝', 'Amical'];
    if (/tournoi|plateau|festi/i.test(c)) return ['tour', '🎪', /plateau/i.test(c) ? 'Plateau' : 'Tournoi'];
    return ['champ', '🏆', 'Championnat'];
  }
  // (1.79) and which team plays it (Seniors A or Seniors B): a player of the category sees and answers both
  const kindBadge = m => { const [k, ic, l] = kind(m); return `<span class="kb kb-${k}" title="${esc(m.competition || l)}">${ic} ${l}</span>${m.team ? `<span class="kb kb-team">⚽ ${esc(m.team)}</span>` : ''}`; };
  const kindCls = m => 'k-' + kind(m)[0];
  const trBadge = '<span class="kb kb-tr">🏃 Entraînement</span>';
  /* (1.80) the programme: trainings AND matches to come, by date (a match with its kind, its team and « dispo / pas dispo ») */
  function matchRow(m) {
    const d = new Date(m.date + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }), h = String(m.time || '').replace(':', 'h');
    const st = m.answer === 'oui' ? (m.convoked ? '✓ présent' : '✓ dispo') : m.answer === 'non' ? (m.convoked ? '✗ absent' : '✗ pas dispo') : m.convoked ? 'convoqué : réponds' : 'pas encore répondu';
    return `<div class="tr tr-m ${kindCls(m)}" data-m="${esc(m.id)}"><span class="d">${esc(d)}</span><span>${kindBadge(m)}<br>${m.home ? '🏠 contre' : '🚌 chez'} <b>${esc(m.opponent || '?')}</b>${h ? ' · ' + esc(h) : ''}
      <span class="why">${m.convoked ? '<b>📣 Tu es convoqué</b> · ' : ''}${esc(st)}${m.rdv ? ' · RDV ' + esc(String(m.rdv).replace(':', 'h')) : ''}</span>
      ${m.talk && (m.talk.objective || m.talk.final || m.talk.video) ? `<span class="why">🗣️ ${esc(m.talk.objective || m.talk.final || '')}${m.talk.video ? ` <a href="${esc(m.talk.video)}" target="_blank" rel="noopener noreferrer">▶ vidéo du coach</a>` : ''}</span>` : ''}</span>
      <span class="btns"><button class="b small yes ${m.answer === 'oui' ? 'on' : ''}" data-ans="oui">${m.convoked ? 'Présent' : 'Dispo'}</button><button class="b small no ${m.answer === 'non' ? 'on' : ''}" data-ans="non">${m.convoked ? 'Absent' : 'Pas dispo'}</button></span></div>`;
  }
  // (1.81) grouped by week: this week and next week open, weeks 3 and 4 folded, then one folded menu per month
  const opened = {};
  document.addEventListener('toggle', e => { const d = e.target; if (d && d.dataset && d.dataset.grp) opened[d.dataset.grp] = d.open; }, true);
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  function programme(trainings, matches, trRow) {
    const now = new Date(), today = iso(now);
    const ms = (matches || []).filter(m => !m.played && !m.exempt && m.date >= today).map(m => ({ date: m.date, time: m.time, _m: m }));
    const all = [...(trainings || []), ...ms].filter(x => x.date >= today).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
    if (!all.length) return '';
    const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)), week = k => iso(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 7 * k));
    const groups = [];
    all.forEach(x => {
      let k = 0; while (k < 4 && x.date >= week(k + 1)) k++;
      const key = k < 4 ? 'w' + k : 'm' + x.date.slice(0, 7);
      let g = groups.find(y => y.key === key);
      if (!g) { const d0 = new Date(week(k) + 'T12:00');
        g = { key, open: k < 2, items: [], label: k === 0 ? 'Cette semaine' : k === 1 ? 'Semaine prochaine' : k < 4 ? 'Semaine du ' + d0.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
          : new Date(x.date + 'T12:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase()) };
        groups.push(g); }
      g.items.push(x);
    });
    return groups.map(g => {
      const nt = g.items.filter(x => !x._m).length, nm = g.items.length - nt, todo = g.items.filter(x => !(x._m ? x._m.answer : x.answer)).length;
      const sum = [nt ? `${nt} entraînement${nt > 1 ? 's' : ''}` : '', nm ? `${nm} match${nm > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ') + (todo ? ` · <b class="todo">⚠️ ${todo} sans réponse</b>` : ' · ✓');
      const open = g.key in opened ? opened[g.key] : g.open;
      return `<details class="prog-g" data-grp="${g.key}" ${open ? 'open' : ''}><summary><b>${esc(g.label)}</b><span class="info small">${sum}</span></summary>
        <div class="card">${g.items.map(x => x._m ? matchRow(x._m) : trRow(x)).join('')}</div></details>`;
    }).join('');
  }
  /* (1.77) the sessions to come: the next 3 weeks (at least 3), then « Voir les suivants » */
  let allTr = false;
  function trList(list, row) {
    if (!list.length) return '';
    const lim = new Date(Date.now() + 21 * 864e5).toISOString().slice(0, 10), near = list.filter((t, i) => i < 3 || t.date <= lim), more = list.length - near.length;
    return `<div class="card">${(allTr ? list : near).map(row).join('')}</div>${more ? `<p><button class="b small" data-alltr>${allTr ? 'Voir seulement les 3 prochaines semaines' : `Voir les ${more} entraînement${more > 1 ? 's' : ''} suivant${more > 1 ? 's' : ''}`}</button></p>` : ''}`;
  }
  function onBar(e, reload) {
    if (e.target.closest('[data-alltr]')) { allTr = !allTr; document.dispatchEvent(new Event('member-redraw')); return true; }
    if (e.target.closest('[data-mupdate]')) { updateApp(); return true; }
    const tb = e.target.closest('[data-tab]'); if (tb && !tb.closest('#psOverlay, .ps-in')) { showTab(tb); return true; } // (2.01) not the tabs of « Mon entraînement perso »
    const tf = e.target.closest('[data-tipfile]'); if (tf) { openTipFile(tf.dataset.tipfile); return true; }
    const ib = e.target.closest('[data-inst]'); if (ib && !ib.closest('.inst-sheet')) { installClick(ib); return true; }
    const nb = e.target.closest('[data-mnotif]'); if (nb) { setNotify(nb.dataset.mnotif === 'on', nb.dataset.kind); return true; }
    if (e.target.closest('[data-forgetme]')) { forgetMe(/parents/.test(location.pathname) ? 'parents' : 'joueur'); return true; }
    const u = e.target.closest('[data-usecode]'); if (u) { use(u.dataset.usecode); reload(); return true; }
    const f = e.target.closest('[data-forget]'); if (f) { if (confirm('Retirer ce code de ce téléphone ? Il faudra le retaper pour revenir.')) { forget(f.dataset.forget); location.replace('moi.html'); } return true; }
    return false;
  }
  // the club's crest on top of the family pages
  function crest(d) { const c = d && d.club && d.club.crest, im = document.getElementById('clubCrest'); if (c && im && /^data:image\//.test(c)) im.src = c; }

  /* ---------- (3.65) absent: the reason (ill, injured, holidays…), and the answers to matches and sessions ---------- */
  const REASONS = [['🤒', 'Malade'], ['🤕', 'Blessure'], ['🏖️', 'Vacances'], ['💼', 'Travail'], ['📚', 'École / examens'], ['👪', 'Famille'], ['🙋', 'Perso'], ['✏️', 'Autre']];
  function sheetCss() {
    if (document.getElementById('rsCss')) return;
    const st = document.createElement('style'); st.id = 'rsCss';
    st.textContent = '.rs-back{position:fixed;inset:0;z-index:90;background:rgba(10,15,34,.55);display:flex;align-items:flex-end;justify-content:center;padding:12px}'
      + '.rs-sheet{width:min(460px,100%);background:#fff;color:#14172b;border-radius:20px;padding:18px 16px calc(env(safe-area-inset-bottom) + 16px);box-shadow:0 -10px 30px rgba(0,0,0,.3)}'
      + '.rs-sheet h3{margin:0 0 4px;font-size:19px}.rs-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0}'
      + '.rs-grid .b{justify-content:flex-start;text-align:left}.rs-grid .b.on{outline:3px solid #be123c;background:#fde8ec}'
      + '.rs-note{width:100%;box-sizing:border-box;padding:11px 12px;border-radius:12px;border:1px solid #d6d0cb;font:inherit;font-size:16px;margin-bottom:12px}'
      + '.rs-sheet .btns{display:flex;gap:8px;justify-content:flex-end}.rs-sheet .b[disabled]{opacity:.45}.why{display:block;font-size:13px;opacity:.85;margin-top:2px}'
      + '.consent{display:flex;gap:8px;align-items:flex-start;font-size:14px;margin:10px 0;text-align:left}.consent input{width:20px;height:20px;margin-top:2px;flex:none}'
      + '@media (prefers-color-scheme: dark){.rs-sheet{background:#121a33;color:#eceef6}.rs-note{background:#18223f;color:#eceef6;border-color:#263156}.rs-grid .b.on{background:#3b1220}}';
    document.head.appendChild(st);
  }
  // the reason of an absence: a few buttons and a precision; null if cancelled
  // (2.01) a short text in a sheet of the page (instead of the phone's « prompt » box): the first name of a volunteer…
  function askText(title, info, placeholder) {
    sheetCss();
    return new Promise(res => {
      const o = document.createElement('div'); o.className = 'rs-back';
      o.innerHTML = `<form class="rs-sheet" role="dialog" aria-label="${esc(title)}"><h3>${esc(title)}</h3>${info ? `<p class="info">${esc(info)}</p>` : ''}
        <input class="rs-note" maxlength="40" placeholder="${esc(placeholder || '')}" aria-label="${esc(title)}" autocomplete="given-name">
        <div class="btns"><button class="b" type="button" data-x>Annuler</button><button class="b yes on" type="submit">Valider</button></div></form>`;
      document.body.appendChild(o);
      const inp = o.querySelector('input'), done = v => { o.remove(); res(v); };
      setTimeout(() => inp.focus(), 50);
      o.addEventListener('click', e => { e.stopPropagation(); if (e.target === o || e.target.closest('[data-x]')) done(null); });
      o.querySelector('form').addEventListener('submit', e => { e.preventDefault(); const v = inp.value.trim(); if (v) done(v); else inp.focus(); });
    });
  }
  /* ---------- (2.04) the rankings of the category and the badges of the player (season, from the matches and the sessions) ---------- */
  const BADGES = [
    ['👟', 'Premier match', p => p.mp >= 1], ['⚽', 'Premier but', p => p.g >= 1], ['🅰️', 'Première passe décisive', p => p.a >= 1],
    ['⏱️', 'Match en entier', p => p.full >= 1], ['🎯', '5 buts', p => p.g >= 5], ['🎩', 'Coup du chapeau', p => p.hat >= 1],
    ['🧠', '5 passes décisives', p => p.a >= 5], ['🏟️', '10 matchs', p => p.mp >= 10], ['🏃', '10 entraînements', p => p.tr >= 10],
    ['💯', 'Toujours là (90 % des séances)', p => p.trt >= 8 && p.tr / p.trt >= .9], ['🔥', '10 buts', p => p.g >= 10], ['📅', '30 entraînements', p => p.tr >= 30]];
  // (2.06) the badges won, as a row of emojis (for the picture « Ma saison »)
  const badgesOf = L => { const me = L && Array.isArray(L.players) && L.players.find(p => p.me); return me ? BADGES.filter(b => b[2](me)).map(b => b[0]).join(' ') : ''; };
  // (2.06) the picture of a result, from a match of member_view (the club's name, its crest, the child's goals if the family wants)
  function shareMatch(d, m, who) {
    const club = (d.club && d.club.name) || 'Le club', im = document.getElementById('clubCrest'), crest = (d.club && /^data:image\//.test(d.club.crest || '') && d.club.crest) || (im && im.src) || '';
    const r = +m.gf > +m.ga ? 'V' : +m.gf < +m.ga ? 'D' : 'N', goals = +(m.my && m.my.g) || 0, [h, a, hs, as] = m.home ? [club, m.opponent || '?', m.gf, m.ga] : [m.opponent || '?', club, m.ga, m.gf];
    const tag = Share.tagOf(club), date = new Date(m.date + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    Share.open({ title: 'Partager le résultat', filename: `${m.team || 'match'}-${m.date}`.replace(/\s+/g, '-'), url: Share.appUrl(),
      option: goals ? { label: `Afficher ${who === 'toi' ? 'mes buts' : 'les buts de ' + who}`, on: false } : null,
      make: o => Share.result({ club, crest, cat: m.team, competition: m.competition, home: m.home, us: club, them: m.opponent || '?', gf: m.gf, ga: m.ga, date, place: m.place,
        scorers: o.on && goals ? [((d.me && d.me.name) || who) + (goals > 1 ? ' ×' + goals : '')] : [], tag }),
      textOf: o => `${{ V: '✅ Victoire', N: '🟰 Match nul', D: '❌ Défaite' }[r]}${m.team ? ' · ' + m.team : ''}\n${h} ${hs} – ${as} ${a}${o.on && goals ? `\n⚽ ${(d.me && d.me.name) || who}${goals > 1 ? ' ×' + goals : ''}` : ''}\n${tag}` });
  }
  function leaders(L, who) {
    if (!L || !Array.isArray(L.players)) return '';
    const me = L.players.find(p => p.me); let h = '';
    if (me) {
      const got = BADGES.filter(b => b[2](me)), next = BADGES.filter(b => !b[2](me)).slice(0, 3);
      h += `<h2>🏅 ${who === 'toi' ? 'Mes badges' : 'Les badges de ' + esc(who)}</h2><div class="card bdg-card"><div class="bdg">${got.map(b => `<span class="bdg-on" title="${esc(b[1])}"><b>${b[0]}</b><i>${esc(b[1])}</i></span>`).join('')}
        ${next.map(b => `<span class="bdg-off" title="À gagner : ${esc(b[1])}"><b>${b[0]}</b><i>${esc(b[1])}</i></span>`).join('')}</div>
        <p class="info small">${got.length ? `${got.length} badge${got.length > 1 ? 's' : ''} sur ${BADGES.length} cette saison.` : 'Les premiers badges arrivent avec les premiers matchs et entraînements.'} En gris : les prochains à gagner.</p></div>`;
    }
    if (L.hidden) return h;
    const top = (key, fmt, min) => L.players.filter(p => min(p)).sort((x, y) => key(y) - key(x) || x.name.localeCompare(y.name)).slice(0, 5)
      .map((p, i) => `<li class="${p.me ? 'me' : ''}"><span>${['🥇', '🥈', '🥉', '4', '5'][i]}</span><b>${esc(p.me ? (who === 'toi' ? 'Toi' : p.name) : p.name)}</b><em>${fmt(p)}</em></li>`).join('');
    const g = top(p => p.g, p => p.g + ' but' + (p.g > 1 ? 's' : ''), p => p.g > 0), a = top(p => p.a, p => p.a + ' passe' + (p.a > 1 ? 's' : ''), p => p.a > 0);
    const t = top(p => p.tr / p.trt, p => Math.round(100 * p.tr / p.trt) + ' %', p => p.trt >= 4);
    if (!g && !a && !t) return h;
    return h + `<h2>🏆 Classements ${esc(L.cat || '')}</h2><div class="card lead-card">
      ${g ? `<h3>⚽ Buteurs</h3><ol class="lead">${g}</ol>` : ''}${a ? `<h3>🅰️ Passeurs</h3><ol class="lead">${a}</ol>` : ''}${t ? `<h3>🏃 Assiduité aux entraînements</h3><ol class="lead">${t}</ol>` : ''}
      <p class="info small">Depuis le début de la saison, d'après les feuilles de match et les présences notées par les coachs.</p></div>`;
  }
  function askReason(title) {
    sheetCss();
    return new Promise(res => {
      const o = document.createElement('div'); o.className = 'rs-back';
      o.innerHTML = `<div class="rs-sheet" role="dialog" aria-label="Raison de l'absence"><h3>${esc(title)}</h3><p class="info">Pourquoi ? Le coach verra la raison.</p>
        <div class="rs-grid">${REASONS.map(([i, l]) => `<button class="b rs" type="button" data-r="${l}">${i} ${l}</button>`).join('')}</div>
        <input class="rs-note" maxlength="80" placeholder="Une précision (facultatif)" aria-label="Précision">
        <div class="btns"><button class="b" type="button" data-x>Annuler</button><button class="b no on" type="button" data-ok disabled>Envoyer : absent</button></div></div>`;
      document.body.appendChild(o);
      let pick = '';
      const done = v => { o.remove(); res(v); };
      o.addEventListener('click', e => {
        e.stopPropagation();
        if (e.target === o || e.target.closest('[data-x]')) return done(null);
        const r = e.target.closest('[data-r]');
        if (r) { pick = r.dataset.r; o.querySelectorAll('[data-r]').forEach(x => x.classList.toggle('on', x === r)); o.querySelector('[data-ok]').disabled = false; if (pick === 'Autre') o.querySelector('.rs-note').focus(); return; }
        if (e.target.closest('[data-ok]')) {
          const n = o.querySelector('.rs-note').value.trim();
          if (pick === 'Autre' && !n) { o.querySelector('.rs-note').focus(); return; }
          done(pick === 'Autre' ? n : pick + (n ? ' : ' + n : ''));
        }
      });
    });
  }
  // the answer to a match or a session (with the reason); a club server not updated yet still takes the answer to a match
  async function reply(code, kind, id, status, seats, reason) {
    try { return await rpc('member_reply', { p_code: code, p_kind: kind, p_id: id, p_status: status, p_seats: seats || 0, p_reason: reason || null }); }
    catch (e) { if (kind === 'match' && /pas encore prêt/.test(e.message)) return rpc('member_answer', { p_code: code, p_match: id, p_status: status, p_seats: seats || 0 }); throw e; }
  }
  // the sessions of the 2 weeks to come with my answer, and the reasons of my absences (an old server: nothing more)
  async function replies(code, data) {
    try {
      const r = await rpc('member_replies', { p_code: code });
      if (r && Array.isArray(r.trainings)) data.trainings = r.trainings;
      const rs = (r && r.reasons) || {}; (data.matches || []).forEach(m => { m.reason = rs[m.id] || ''; });
    } catch (e) {}
    return data;
  }
  return { badgesOf, shareMatch, installCard, optoutCard, leaders, askText, sheetCss, tabs, tabPosCard, trList, programme, kindBadge, kindCls, trBadge, updateCard, tipsHtml, tips, notifyCard, privacy, askReason, reply, replies, current, remember, forget, rpc, form, bar, onBar, pretty, clean, pageFor, list, crest, family };
})();
