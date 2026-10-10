/* Small UI helpers: escaping, toasts, modal sheets, confirmations, thumbnails. */
const UI = (() => {
  // (2.80) photos and thumbnails: WebP where the browser can make it (2 to 3 times lighter), JPEG elsewhere
  const IMG = (() => { try { const c = document.createElement('canvas'); c.width = c.height = 2; return c.toDataURL('image/webp').indexOf('image/webp') > 0 ? 'image/webp' : 'image/jpeg'; } catch (e) { return 'image/jpeg'; } })();
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  let toastTimer;
  function toast(msg, kind = '') {
    const t = $('#toast'); t.textContent = msg; t.className = 'toast show ' + kind;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.className = 'toast', 2600);
  }

  // modal({title, body, actions:[{label, kind:'primary'|'danger'|'', onClick(close, root) -> false keeps it open}] , onOpen(root)})
  // (2.65) the listeners a modal puts on the shared #modal element are removed when it closes or when another modal takes its place
  //   (before, they piled up: opening the same window twice ran its buttons twice)
  let modalLs = [];
  const dropModalLs = root => { modalLs.forEach(([t, f, c]) => root.removeEventListener(t, f, c)); modalLs = []; };
  function modal(o) {
    const root = $('#modal');
    dropModalLs(root);
    root.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="mTitle">
      <div class="sheet-head"><h2 id="mTitle">${esc(o.title || '')}</h2><button class="icon-btn" data-close aria-label="Fermer">${I.x}</button></div>
      <div class="sheet-body">${o.body || ''}</div>
      ${o.actions && o.actions.length ? `<div class="sheet-foot">${o.actions.map((a, i) => `<button class="btn ${a.kind || ''}" data-i="${i}">${a.icon || ''}<span>${esc(a.label)}</span></button>`).join('')}</div>` : ''}
    </div>`;
    root.hidden = false;
    const mine = [];
    const close = () => { root.hidden = true; root.innerHTML = ''; document.removeEventListener('keydown', onKey); mine.forEach(([t, f, c]) => root.removeEventListener(t, f, c)); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    root.onclick = e => {
      if (e.target === root || e.target.closest('[data-close]')) return close();
      const b = e.target.closest('.sheet-foot [data-i]');
      if (b) { const a = o.actions[+b.dataset.i]; if (!a.onClick || a.onClick(close, root) !== false) close(); }
    };
    if (o.onOpen) {
      root.addEventListener = function (t, f, c) { mine.push([t, f, c]); modalLs.push([t, f, c]); return EventTarget.prototype.addEventListener.call(this, t, f, c); };
      try { o.onOpen(root, close); } finally { delete root.addEventListener; }
    }
    const first = root.querySelector('input,select,textarea'); if (first && !o.noFocus && finePointer()) setTimeout(() => first.focus(), 60);
    return close;
  }
  function confirmBox(text, okLabel = 'Supprimer') {
    return new Promise(res => modal({ title: 'Es-tu sûr ?', body: `<p class="lead">${esc(text)}</p>`, noFocus: true,
      actions: [{ label: 'Annuler', onClick: () => res(false) }, { label: okLabel, kind: 'danger', onClick: () => res(true) }] }));
  }
  function busy(text) {
    const root = $('#busy'); root.hidden = false;
    root.innerHTML = `<div class="busy-card"><div class="spinner"></div><p>${esc(text)}</p><div class="bar"><i></i></div></div>`;
    return { progress: p => { const i = root.querySelector('.bar i'); if (i) i.style.width = Math.round(p * 100) + '%'; }, done: () => { root.hidden = true; root.innerHTML = ''; } };
  }

  // Work that goes on in the background (a file coming from a link, a big video being saved): a small line at the bottom
  // of the screen, the app stays usable meanwhile. bgTask(text) → { step(text, fraction), done() }
  function bgTask(text) {
    let box = document.getElementById('bgTasks');
    if (!box) { box = document.createElement('div'); box.id = 'bgTasks'; box.className = 'bg-tasks'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    const el = document.createElement('div'); el.className = 'bg-task';
    el.innerHTML = `<span class="spinner sm"></span><span class="bg-txt">${esc(text)}</span><i class="bg-bar"><b></b></i>`;
    box.appendChild(el);
    const leave = () => { if (!unloadWarn.size) window.removeEventListener('beforeunload', warn); };
    const warn = e => { e.preventDefault(); e.returnValue = ''; };
    unloadWarn.add(el); window.addEventListener('beforeunload', warn);
    return {
      step: (t, f) => { el.querySelector('.bg-txt').textContent = t; const b = el.querySelector('.bg-bar b'); b.style.width = f == null ? '' : Math.round(f * 100) + '%'; el.classList.toggle('known', f != null); },
      done: () => { unloadWarn.delete(el); el.remove(); leave(); },
    };
  }
  const unloadWarn = new Set();

  // Thumbnails of schemas, cached per update
  const thumbCache = new Map();
  function thumb(sc, w = 480, h = 312, opts = {}) {
    const key = sc.id + ':' + (sc.updatedAt || 0) + ':' + w + ':' + (opts.step == null ? 'all' : opts.step);
    if (thumbCache.has(key)) return thumbCache.get(key);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    // (2.30) an animated schema is shown whole: every movement of every step on the picture
    const view = opts.step == null && typeof AutoSchema !== 'undefined' && AutoSchema.overview ? AutoSchema.overview(sc) : sc;
    Board.drawFrame(c.getContext('2d'), w, h, view, opts.step || 0, 0, { homeBib: Store.state.club.homeBib });
    const url = c.toDataURL(IMG, .8); thumbCache.set(key, url); return url;
  }

  const fmtDate = (d, opts = { weekday: 'short', day: 'numeric', month: 'short' }) => d ? new Date(d + 'T12:00').toLocaleDateString('fr-FR', opts) : '';
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  // A coach's little sentence, shown next to his name (messages, list of dirigeants)
  const MOTTO_MAX = 80;
  const motto = s => s && s.motto ? `<i class="motto">« ${esc(String(s.motto).slice(0, MOTTO_MAX))} »</i>` : '';
  const MOTTO_IDEAS = [
    'Le ballon, lui, ne se plaint jamais.', 'Gagner, c\'est bien. Progresser, c\'est mieux.', 'On perd ensemble, on gagne ensemble.',
    'Un bon contrôle vaut mieux que deux dribbles ratés.', 'Le terrain dit toujours la vérité.', 'Pas de talent sans travail.',
    'Mon sifflet et moi, on se comprend.', 'La passe, c\'est le plus beau des cadeaux.', 'Tomber sept fois, se relever huit.',
    'Le plus important, c\'est le prochain match.', 'Plots rangés, coach heureux.', 'Le mental fait la différence.',
    'Jouer simple, c\'est le plus difficile.', 'Un vestiaire uni vaut tous les trophées.', 'Les chaussures propres, les idées claires.',
    'Le foot, c\'est 90 minutes de bonheur (et 3 heures de lessive).', 'Le jeu avant l\'enjeu.', 'Qui ne tente rien ne marque rien.',
  ];
  const mottoIdea = cur => { const l = MOTTO_IDEAS.filter(x => x !== cur); return l[Math.floor(Math.random() * l.length)]; };
  const accentFor = bib => ({ jaune: '#a16207', blanc: '#13245a', vert: '#3f7d0a', orange: '#c2410c' }[bib] || (Board.BIBS[bib] || Board.BIBS.bleu)[0]);

  // File picker that works on iPhone/iPad: the input must be in the page, and no unknown extensions in "accept"
  function pickFiles({ accept = '', multiple = false } = {}) {
    return new Promise(res => {
      const inp = document.createElement('input');
      inp.type = 'file'; if (accept) inp.accept = accept; inp.multiple = multiple;
      inp.style.cssText = 'position:fixed;left:-1000px;top:0;opacity:0';
      document.body.appendChild(inp);
      let done = false;
      const finish = files => { if (done) return; done = true; res(files); setTimeout(() => inp.remove(), 1000); };
      inp.addEventListener('change', () => finish([...inp.files]));
      inp.addEventListener('cancel', () => finish([]));
      inp.click();
    });
  }

  // On phones and tablets: choose where the files come from (gallery, Files with OneDrive / Google Drive…, or a share link)
  const touch = () => window.matchMedia && matchMedia('(pointer: coarse)').matches;
  function chooseFiles({ accept = '', multiple = true, media = true, link = null } = {}) {
    if (!touch() && !link) return pickFiles({ accept, multiple });
    return new Promise(res => {
      let picked = false;
      const pick = opts => { picked = true; close(); pickFiles(opts).then(res); };
      const close = modal({ title: 'Ajouter depuis…', noFocus: true, body: `<div class="src-list">
        ${media ? `<button class="src-btn" data-src="gallery">${I.image}<span><b>Photos et vidéos</b><span class="muted small">Galerie ou appareil photo</span></span></button>` : ''}
        <button class="src-btn" data-src="files">${I.upload}<span><b>Fichiers</b><span class="muted small">OneDrive, Google Drive, Dropbox, iCloud, Téléchargements…</span></span></button>
        ${link ? `<button class="src-btn" data-src="link">${I.share}<span><b>Lien de partage</b><span class="muted small">Coller un lien OneDrive, Google Drive, YouTube…</span></span></button>` : ''}</div>
        <details class="paste-box"><summary>OneDrive ou Google Drive n'apparaît pas ?</summary>
          <p class="muted small"><b>iPhone / iPad</b> : installe l'appli OneDrive ou Google Drive. Dans « Fichiers », touche <b>Parcourir</b>, puis <b>…</b> → <b>Modifier</b> et active-la. Elle apparaît ensuite quand tu touches « Fichiers » ici (choisis « Choisir un fichier » ou « Parcourir »).<br>
          <b>Android</b> : dans « Fichiers », ouvre le menu ☰ et choisis Drive ou OneDrive.<br>Tu peux aussi, dans l'appli OneDrive ou Drive, <b>télécharger</b> le fichier sur l'appareil, puis le choisir ici.</p></details>`,
        onOpen: r => {
          r.querySelectorAll('[data-src]').forEach(b => b.onclick = () => {
            if (b.dataset.src === 'gallery') return pick({ accept: accept && /image|video/.test(accept) ? accept.split(',').filter(a => /image|video/.test(a)).join(',') : 'image/*,video/*', multiple });
            if (b.dataset.src === 'files') return pick({ multiple });
            picked = true; close(); link().then(() => res([]));
          });
        } });
      const mo = new MutationObserver(() => { if (document.getElementById('modal').hidden) { mo.disconnect(); if (!picked) res([]); } });
      mo.observe(document.getElementById('modal'), { attributes: true });
    });
  }

  // mouse/trackpad (computer): fields can take the focus; touch screens: no keyboard popping up on its own
  const finePointer = () => matchMedia('(pointer: fine)').matches;
  // « 🏆 Officiels | 🤝 Amicaux » : what the results, goals and stats count (one choice for the whole app)
  function kindSeg(counts) {
    const k = Store.matchKind(), n = x => counts && counts[x] != null ? ` <i class="seg-n">${counts[x]}</i>` : '';
    return `<div class="seg kind-seg" role="tablist" aria-label="Type de matchs"><button class="seg-b ${k === 'off' ? 'on' : ''}" data-mkind="off" role="tab">🏆 Matchs officiels${n('off')}</button><button class="seg-b ${k === 'ami' ? 'on' : ''}" data-mkind="ami" role="tab">🤝 Matchs amicaux${n('ami')}</button></div>`;
  }
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-mkind]'); if (!b) return;
    e.stopPropagation(); Store.state.ui.matchKind = b.dataset.mkind; Store.persistNow(); App.route(true);
  }, true);
  // a text field as high as its text (on a phone, a small field that scrolls inside could not be read)
  // (2.01) measured again only when its text or its width changed (the page changes every second during a live match); the chat sizes its own field
  function autogrow(el, force) {
    if (!el || el.tagName !== 'TEXTAREA' || !el.offsetParent || el.closest('.cx')) return;
    const k = el.value.length + ':' + el.clientWidth; if (!force && el.dataset.gk === k) return; el.dataset.gk = k;
    el.style.height = 'auto'; el.style.height = (el.scrollHeight + 2) + 'px';
  }
  const growAll = root => (root || document).querySelectorAll('textarea').forEach(autogrow);
  document.addEventListener('input', e => autogrow(e.target, true));
  document.addEventListener('toggle', e => growAll(e.target), true);
  { let t = 0; new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => growAll(), 60); }).observe(document.documentElement, { childList: true, subtree: true }); }
  window.addEventListener('resize', () => growAll());
  (function lockScroll() {
    const start = () => {
      const root = document.getElementById('modal'); if (!root) return;
      let y = 0, locked = false; const st = document.body.style;
      const set = () => {
        if (!root.hidden && !locked) { y = window.scrollY; Object.assign(st, { position: 'fixed', top: -y + 'px', left: '0', right: '0' }); document.documentElement.classList.add('modal-open'); locked = true; }
        else if (root.hidden && locked) { Object.assign(st, { position: '', top: '', left: '', right: '' }); document.documentElement.classList.remove('modal-open'); window.scrollTo(0, y); locked = false; }
      };
      new MutationObserver(set).observe(root, { attributes: true, attributeFilter: ['hidden'] }); set();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  })();
  return { IMG,  kindSeg, finePointer, esc, $, $$, toast, modal, confirmBox, busy, bgTask, thumb, fmtDate, today, accentFor, pickFiles, chooseFiles, motto, mottoIdea, MOTTO_MAX };
})();
