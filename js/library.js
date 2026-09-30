/* Library: videos, montages, PDFs and images imported from other apps.
   Each file is kept on the device and can be used with the app's own tools:
   draw on it (photo, PDF page, video frame), turn a PDF into a training, attach it to a training or a match. */
const Library = (() => {
  const { esc, $, $$, toast, modal, confirmBox, busy } = UI;
  const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/pdf.min.js';
  const PDFW = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/pdf.worker.min.js';
  const MAX_PAGES = 40;
  const S = () => Store.state;
  const KIND = { video: ['Vidéo', 'video'], pdf: ['PDF', 'pdf'], image: ['Image', 'image'], link: ['Lien', 'share'] };

  /* ---------- PDF reading (pdf.js, loaded on first use then kept offline) ---------- */
  let pdfjsP = null;
  function pdfjs() {
    return pdfjsP || (pdfjsP = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = PDFJS; s.crossOrigin = 'anonymous';
      s.onload = async () => {
        try { const w = await (await fetch(PDFW)).blob(); window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(w); }
        catch (e) { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFW; }
        res(window.pdfjsLib);
      };
      s.onerror = () => { pdfjsP = null; rej(new Error('Pour lire un PDF la première fois, il faut être connecté à internet.')); };
      document.head.appendChild(s);
    }));
  }
  async function readPdf(file, onPage) {
    const lib = await pdfjs(), doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const n = Math.min(doc.numPages, MAX_PAGES), pages = [];
    for (let i = 1; i <= n; i++) {
      onPage && onPage(i, n);
      const page = await doc.getPage(i), vp1 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: Math.min(2.5, 1400 / vp1.width) });
      const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .85));
      let text = '';
      try { text = (await page.getTextContent()).items.map(it => it.str + (it.hasEOL ? '\n' : ' ')).join('').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim(); } catch (e) {}
      pages.push({ blob, w: c.width, h: c.height, text, thumb: i === 1 ? Media.drawScaled(c, c.width, c.height, 360).toDataURL('image/jpeg', .7) : '' });
    }
    return { pages, total: doc.numPages };
  }

  /* ---------- import ---------- */
  async function importFiles(files, onStep = () => {}) {
    const me = Auth.current(), ids = [];
    for (const f of files) {
      const base = { id: Store.uid(), ref: 'lib', name: f.name || 'Sans nom', createdAt: Date.now(), by: me ? me.id : null };
      const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
      if (isPdf) {
        onStep(`Lecture du PDF ${f.name}…`);
        const { pages, total } = await readPdf(f, (i, n) => onStep(`Lecture du PDF : page ${i} sur ${n}`));
        if (total > MAX_PAGES) toast(`Seules les ${MAX_PAGES} premières pages sont gardées`);
        await Media.put(Object.assign(base, { kind: 'pdf', blob: f, mime: 'application/pdf', pages, thumb: pages[0] && pages[0].thumb }));
      } else if (f.type.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/i.test(f.name)) {
        if (f.size > Media.MAX_VIDEO) { toast(`${f.name} est trop lourde (plus de 300 Mo)`, 'err'); continue; }
        onStep(`Import de la vidéo ${f.name}…`);
        await Media.put(Object.assign(base, { kind: 'video', blob: f, mime: f.type || 'video/mp4', thumb: await Media.videoThumb(f) }));
      } else if (f.type.startsWith('image/')) {
        await Media.put(Object.assign(base, { kind: 'image' }, await Media.photo(f)));
      } else { toast(`${f.name} : format non pris en charge (vidéo, PDF ou image)`, 'err'); continue; }
      ids.push(base.id);
    }
    return ids;
  }
  /* ---------- share links (OneDrive, Google Drive, Dropbox, YouTube…) ---------- */
  function directUrl(u) {
    try {
      const x = new URL(u), h = x.hostname;
      if (/(^|\.)drive\.google\.com$/.test(h)) { const id = (x.pathname.match(/\/d\/([\w-]+)/) || [])[1] || x.searchParams.get('id'); if (id) return `https://drive.google.com/uc?export=download&id=${id}`; }
      if (/(^|\.)dropbox\.com$/.test(h)) { x.searchParams.set('dl', '1'); return x.href; }
      if (/(^|\.)(1drv\.ms|onedrive\.live\.com|sharepoint\.com)$/.test(h)) {
        const b = btoa(unescape(encodeURIComponent(u))).replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');
        return `https://api.onedrive.com/v1.0/shares/u!${b}/root/content`;
      }
    } catch (e) {}
    return u;
  }
  // Tries to get the file itself (so the app can read the PDF or draw on the picture); many sites refuse, then the link is kept
  async function fetchFile(u, name, onProgress = () => {}) {
    // 30 s to get an answer; then the download goes on as long as it needs (a match video is big)
    const ctl = new AbortController(); let t = setTimeout(() => ctl.abort(), 30000);
    try {
      const r = await fetch(directUrl(u), { signal: ctl.signal }); if (!r.ok) throw new Error('refusé');
      if (!/pdf|image\/|video\/|octet-stream/.test(r.headers.get('content-type') || '')) throw new Error('pas un fichier');
      clearTimeout(t);
      const total = +r.headers.get('content-length') || 0, parts = []; let got = 0;
      // no news from the site for 60 s: given up
      const idle = () => { clearTimeout(t); t = setTimeout(() => ctl.abort(), 60000); };
      if (r.body && r.body.getReader) {
        const rd = r.body.getReader(); idle();
        for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; idle(); onProgress(got, total); }
      } else { parts.push(await r.blob()); }
      // « application/octet-stream » (Google Drive, OneDrive): the kind of file comes from its name
      let type = (r.headers.get('content-type') || '').split(';')[0];
      if (!/pdf|image\/|video\//.test(type)) type = /\.pdf$/i.test(name) ? 'application/pdf' : /\.(jpe?g|png|webp)$/i.test(name) ? 'image/jpeg' : /\.(mp4|m4v|mov)$/i.test(name) ? 'video/mp4' : '';
      if (!type) throw new Error('pas un fichier');
      const blob = new Blob(parts, { type });
      const ext = type.includes('pdf') ? '.pdf' : type.startsWith('image/') ? '.jpg' : '.mp4';
      return new File([blob], /\.[a-z0-9]{2,4}$/i.test(name) ? name : name + ext, { type });
    } finally { clearTimeout(t); }
  }
  function addLink(cb) {
    return new Promise(res => {
      modal({ title: 'Ajouter un lien', body: `<label class="fld"><span>Lien de partage</span><input id="lkUrl" type="url" inputmode="url" placeholder="https://1drv.ms/…  ou  https://drive.google.com/…" autocapitalize="off" autocorrect="off"></label>
        <label class="fld"><span>Nom (facultatif)</span><input id="lkName" placeholder="Ex : Séance passes U13"></label>
        <p class="muted small">Dans OneDrive ou Google Drive : <b>Partager</b> → <b>Copier le lien</b>, puis colle-le ici. L'appli essaie de récupérer le fichier pour l'utiliser avec ses outils ; sinon elle garde le lien, qui s'ouvre d'un toucher.</p>`,
        actions: [{ label: 'Annuler', onClick: () => res() }, { label: 'Ajouter', kind: 'primary', onClick: (close, r) => {
          const url = $('#lkUrl', r).value.trim(); let host = '';
          try { const x = new URL(url); if (!/^https?:$/.test(x.protocol)) throw 0; host = x.hostname.replace(/^www\./, ''); } catch (e) { toast('Colle un lien qui commence par https://', 'err'); return false; }
          const typed = $('#lkName', r).value.trim(), name = typed || decodeURIComponent((url.split(/[?#]/)[0].split('/').pop() || '')).slice(0, 60) || host;
          close();
          const me = Auth.current();
          // a YouTube video stays a link, played by YouTube in the analysis (its thumbnail comes from YouTube): nothing to download
          const yt = /(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([\w-]{11})/.exec(url);
          if (yt) {
            const id = Store.uid();
            Media.put({ id, ref: 'lib', kind: 'link', url, name: typed || 'Vidéo YouTube', host, thumb: `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg`, createdAt: Date.now(), by: me ? me.id : null })
              .then(() => { toast('Vidéo YouTube ajoutée : ouvre-la puis « Analyser le match »'); cb && cb([id]); }, () => toast('Impossible d\'enregistrer le lien sur cet appareil', 'err'));
            return res();
          }
          // other sites: the file comes in the background, the app stays usable meanwhile
          res();
          const task = UI.bgTask(`Récupération de « ${name} »…`);
          (async () => {
            let ids = [];
            try {
              const f = await fetchFile(url, name, (got, total) => task.step(`« ${name} » : ${Math.round(got / 1048576)} Mo${total ? ' sur ' + Math.round(total / 1048576) + ' Mo' : ''}`, total ? got / total : null));
              task.step(`Enregistrement de « ${name} »…`);
              ids = await importFiles([f], t => task.step(t));
              toast(`« ${name} » est dans la Bibliothèque`);
            } catch (e) {
              const id = Store.uid();
              await Media.put({ id, ref: 'lib', kind: 'link', url, name, host, createdAt: Date.now(), by: me ? me.id : null }).catch(() => {});
              ids = [id]; toast('Lien enregistré : il s\'ouvre dans ' + host);
            } finally { task.done(); }
            cb && cb(ids);
          })();
        } }] });
    });
  }
  function pickFiles(cb) {
    UI.chooseFiles({ accept: 'video/*,image/*,application/pdf', multiple: true, link: () => addLink(cb) }).then(async files => {
      if (!files.length) return;
      // in the background: the app stays usable while a big video is being saved
      const task = UI.bgTask(`Import de ${files.length > 1 ? files.length + ' fichiers' : '« ' + (files[0].name || 'fichier') + ' »'}…`);
      try { const ids = await importFiles(files, t => task.step(t)); if (ids.length) toast(`${ids.length} fichier${ids.length > 1 ? 's' : ''} importé${ids.length > 1 ? 's' : ''} dans la Bibliothèque`); cb && cb(ids); }
      catch (e) { toast(e.message || "Import impossible : l'appareil manque peut-être de place", 'err'); }
      finally { task.done(); }
    });
  }

  /* ---------- use a picture as a drawing background ---------- */
  async function drawOn(blob, w, h, name, teamId) {
    const id = Store.uid();
    await Media.put({ id, ref: 'bg', kind: 'image', name, blob, mime: 'image/jpeg', createdAt: Date.now() });
    Board.BG.set(id, await Media.loadImage(URL.createObjectURL(blob)));
    const sc = { id: Store.uid(), name, teamId: teamId || null, field: { format: 'bg', bgId: id, w: 100, h: Math.round(100 * h / w * 10) / 10 }, overlays: {}, objects: [], zones: [],
      steps: [{ pos: {}, arrows: [], moves: {}, note: '', dur: 2 }] };
    return Store.upsert('schemas', sc);
  }
  async function canvasBlob(src, w, h) {
    const c = Media.drawScaled(src, w, h, 1600);
    return { blob: await new Promise(r => c.toBlob(r, 'image/jpeg', .88)), w: c.width, h: c.height };
  }
  const cleanName = n => String(n || 'Document').replace(/\.[a-z0-9]{2,4}$/i, '');

  /* ---------- « Mettre au propre »: a hand-drawn exercise (photo, PDF page) redrawn on a clean pitch ---------- */
  function cleanCopy(blob, w, h, name) {
    modal({ title: 'Mettre au propre', body: `<p class="tip">Ton dessin s'affiche en transparence sur un vrai terrain. Redessine-le avec les joueurs, les flèches et les zones, puis retire le calque : il reste un schéma propre, animable et imprimable.</p>
      <div class="lbl">Sur quel terrain ?</div><div class="chips" id="ccFmt">${[['11', 'Foot à 11'], ['8', 'Foot à 8'], ['5', 'Foot à 5'], ['zone', 'Zone libre']].map(([v, l], i) => `<button class="chip ${i ? '' : 'on'}" data-v="${v}">${l}</button>`).join('')}</div>
      <label class="fld" style="margin-top:12px"><span>Nom du schéma</span><input id="ccName" value="${esc(cleanName(name))} · au propre"></label>`,
      onOpen: r => $$('#ccFmt .chip', r).forEach(b => b.onclick = () => { $$('#ccFmt .chip', r).forEach(x => x.classList.remove('on')); b.classList.add('on'); }),
      actions: [{ label: 'Annuler' }, { label: 'Commencer', kind: 'primary', icon: I.board, onClick: (c, r) => {
        const format = $('#ccFmt .on', r).dataset.v, nm = $('#ccName', r).value.trim() || cleanName(name);
        (async () => {
          const bgId = Store.uid();
          await Media.put({ id: bgId, ref: 'bg', kind: 'image', name: nm, blob, mime: 'image/jpeg', createdAt: Date.now() });
          Board.BG.set(bgId, await Media.loadImage(URL.createObjectURL(blob)));
          const field = format === 'zone' ? { format, view: 'full', w: 40, h: Math.round(40 * h / w) } : { format, view: 'full' };
          const sc = Store.upsert('schemas', { id: Store.uid(), name: nm, teamId: S().ui.teamId || null, field, overlays: {}, objects: [], zones: [], trace: { bgId, on: true, opacity: .7 },
            steps: [{ pos: {}, arrows: [], moves: {}, note: '', dur: 2 }] });
          location.hash = '#/schema/' + sc.id;
        })();
      } }] });
  }

  /* ---------- print (the picture or every PDF page, one per sheet) ---------- */
  function printRec(rec) {
    const blobs = rec.kind === 'pdf' ? rec.pages.map(p => p.blob) : rec.kind === 'image' ? [rec.blob] : [];
    if (!blobs.length) return toast('Ce fichier ne s\'imprime pas depuis l\'appli', 'err');
    const old = document.getElementById('printArea'); if (old) old.remove();
    const area = document.createElement('div'); area.id = 'printArea';
    const urls = blobs.map(b => URL.createObjectURL(b));
    area.innerHTML = urls.map(u => `<img src="${u}" alt="">`).join('');
    document.body.appendChild(area);
    const done = () => { area.remove(); urls.forEach(u => URL.revokeObjectURL(u)); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    Promise.all([...area.querySelectorAll('img')].map(im => im.decode ? im.decode().catch(() => {}) : null)).then(() => setTimeout(() => window.print(), 100));
  }

  /* ---------- send to the club messaging: each page travels as a picture (like a schema background) ---------- */
  function sendToChat(rec) {
    const pages = rec.kind === 'pdf' ? rec.pages.slice(0, 8) : rec.kind === 'image' ? [{ blob: rec.blob, w: rec.w || 1600, h: rec.h || 1000 }] : [];
    if (!pages.length) return toast('Seuls les images et les PDF s\'envoient dans la messagerie', 'err');
    if (!Cloud.ready()) return toast('La messagerie passe par le serveur du club, pas encore connecté ici', 'err');
    const chans = [['general', 'Tout le club · tous les coachs'], ...S().teams.map(t => ['team:' + t.id, Store.teamLabel(t)])];
    modal({ title: 'Envoyer dans la messagerie', body: `<label class="fld"><span>Où ?</span><select id="chTo">${chans.map(([v, l]) => `<option value="${v}" ${v === 'team:' + (Auth.teams()[0] || {}).id && !Auth.isAdmin() ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      <label class="fld"><span>Message (facultatif)</span><input id="chTxt" placeholder="Ex : la séance de mercredi"></label>
      ${rec.kind === 'pdf' && rec.pages.length > 8 ? '<p class="muted small">Les 8 premières pages sont envoyées.</p>' : ''}`,
      actions: [{ label: 'Annuler' }, { label: 'Envoyer', kind: 'primary', icon: I.share, onClick: (c, r) => {
        const ch = $('#chTo', r).value, txt = $('#chTxt', r).value.trim();
        (async () => {
          const b = busy('Envoi du document…');
          try {
            const ids = [];
            for (let i = 0; i < pages.length; i++) {
              const p = pages[i]; let w = p.w, h = p.h;
              if (!w || !h) { const img = await Media.loadImage(URL.createObjectURL(p.blob)); w = img.naturalWidth; h = img.naturalHeight; }
              const sc = await drawOn(p.blob, w, h, `${cleanName(rec.name)}${pages.length > 1 ? ' · page ' + (i + 1) : ''}`, null);
              sc.shared = true; Store.upsert('schemas', sc); ids.push(sc.id);
            }
            await Sync.run();
            await Cloud.post(ch, `📎 ${cleanName(rec.name)}${txt ? '\n' + txt : ''}\n[[fichier:${ids.join(',')}]]`);
            toast('Document envoyé dans la messagerie');
          } catch (e) { toast(e.message || 'Envoi impossible', 'err'); } finally { b.done(); }
        })();
      } }] });
  }

  /* ---------- turn a PDF into a training ---------- */
  function toTraining(rec) {
    modal({ title: 'Créer une séance avec ce PDF', body: `
      <p class="tip">Chaque page devient un exercice : son texte va dans « Organisation » et la page devient le schéma, sur lequel tu peux dessiner des flèches et des joueurs.</p>
      <label class="fld"><span>Thème de la séance</span><input id="ttName" value="${esc(cleanName(rec.name))}"></label>
      <div class="row2"><label class="fld"><span>Date</span><input type="date" id="ttDate" value="${UI.today()}"></label>
      <label class="fld"><span>Durée par exercice (min)</span><input type="number" id="ttDur" value="15" min="0" max="120"></label></div>
      <label class="fld"><span>Équipe</span><select id="ttTeam"><option value="">Aucune</option>${Auth.teams().map(t => `<option value="${t.id}" ${t.id === S().ui.teamId ? 'selected' : ''}>${esc(Store.teamLabel(t))}</option>`).join('')}</select></label>`,
      actions: [{ label: 'Annuler' }, { label: 'Créer la séance', kind: 'primary', onClick: (c, r) => {
        const title = $('#ttName', r).value.trim() || cleanName(rec.name), date = $('#ttDate', r).value || UI.today(), dur = +$('#ttDur', r).value || 0, teamId = $('#ttTeam', r).value || null;
        (async () => {
          const b = busy('Création de la séance…');
          try {
            const exercises = [], assist = Importer.isAssistCoach(rec.pages);
            for (let i = 0; i < rec.pages.length; i++) {
              const pg = rec.pages[i], lines = (pg.text || '').split('\n').map(x => x.trim()).filter(Boolean);
              if (assist) {
                const ex = Importer.parseAssistPage(pg.text); if (!ex) continue;
                const sc = await drawOn(pg.blob, pg.w, pg.h, `${ex.title} · fiche`, teamId);
                exercises.push(Object.assign({ id: Store.uid(), schemaId: sc.id }, ex));
                continue;
              }
              const exTitle = (lines[0] || `Page ${i + 1}`).slice(0, 70);
              const sc = await drawOn(pg.blob, pg.w, pg.h, `${title} · page ${i + 1}`, teamId);
              exercises.push({ id: Store.uid(), title: exTitle, duration: dur, org: lines.slice(1).join('\n').slice(0, 900), consignes: '', materiel: '', schemaId: sc.id });
            }
            const tr = Store.upsert('trainings', { id: Store.uid(), title, date, time: '', teamId, goal: '', exercises, presents: [], docIds: [rec.id] });
            toast(`Séance créée : ${exercises.length} exercice${exercises.length > 1 ? 's' : ''}`);
            location.hash = '#/entrainement/' + tr.id;
          } catch (e) { toast('Création impossible', 'err'); } finally { b.done(); }
        })();
      } }] });
  }

  /* ---------- attach to a training or a match ---------- */
  function attach(rec) {
    // every training and match (not only the last 40): by category, the coming ones first (soonest first), then the past ones
    const today = new Date().toISOString().slice(0, 10), teams = S().teams.filter(t => Auth.sees(t.id));
    const u = Auth.current(), mine = (u && u.teamIds || []).filter(id => teams.some(t => t.id === id));
    const all = [...S().trainings.filter(x => !x.model && Auth.sees(x.teamId)).map(t => ({ col: 'trainings', ev: t, lbl: t.title || 'Entraînement' })),
      ...S().matches.filter(x => Auth.sees(x.teamId)).map(m => ({ col: 'matches', ev: m, lbl: 'contre ' + (m.opponent || '?') })),
      ...S().trainings.filter(x => x.model).map(t => ({ col: 'models', ev: t, lbl: t.title || 'Séance type' }))];
    const tName = id => { const t = Store.get('teams', id); return t ? t.name : ''; };
    const opts = (team, q) => {
      const list = all.filter(x => (!team || x.col === 'models' || x.ev.teamId === team) && (!q || ((x.ev.date ? UI.fmtDate(x.ev.date) : '') + ' ' + (x.ev.date || '') + ' ' + x.lbl + ' ' + tName(x.ev.teamId)).toLowerCase().includes(q)));
      const models = list.filter(x => x.col === 'models').sort((a, b) => String(a.lbl).localeCompare(String(b.lbl), 'fr'));
      const line = x => `<option value="${x.col}:${x.ev.id}">${esc(UI.fmtDate(x.ev.date))}${x.ev.time ? ' ' + esc(x.ev.time) : ''} · ${esc(x.lbl)}${team ? '' : ' · ' + esc(tName(x.ev.teamId))}</option>`;
      const group = (label, col, next) => { const g = list.filter(x => x.col === col && (x.ev.date || '') >= today === next)
        .sort((a, b) => next ? (a.ev.date || '').localeCompare(b.ev.date || '') : (b.ev.date || '').localeCompare(a.ev.date || ''));
        return g.length ? `<optgroup label="${label} (${g.length})">${g.map(line).join('')}</optgroup>` : ''; };
      const html = (models.length ? `<optgroup label="📚 Séances types du club (${models.length})">${models.map(x => `<option value="trainings:${x.ev.id}">📚 ${esc(x.lbl)}</option>`).join('')}</optgroup>` : '') + group('Entraînements à venir', 'trainings', true) + group('Entraînements passés', 'trainings', false) + group('Matchs à venir', 'matches', true) + group('Matchs passés', 'matches', false);
      return `<option value="">${html ? 'Choisir…' : 'Aucun entraînement ni match trouvé'}</option>${html}`;
    };
    const first = mine.length === 1 ? mine[0] : '';
    modal({ title: 'Joindre à…', body: `<label class="fld"><span>Catégorie</span><select id="attTeam"><option value="">Toutes les catégories</option>${teams.map(t => `<option value="${t.id}" ${t.id === first ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
      <label class="fld"><span>Rechercher (date, titre, adversaire)</span><input id="attQ" type="search" placeholder="ex. 12/10, Seniors, Montreuil"></label>
      <label class="fld"><span>Choisis une séance type, un entraînement ou un match</span><select id="attTo">${opts(first, '')}</select></label>`,
      onOpen: r => { const redo = () => { $('#attTo', r).innerHTML = opts($('#attTeam', r).value, $('#attQ', r).value.trim().toLowerCase()); }; $('#attTeam', r).onchange = redo; $('#attQ', r).oninput = redo; },
      actions: [{ label: 'Annuler' }, { label: 'Joindre', kind: 'primary', onClick: (c, r) => {
        const v = $('#attTo', r).value; if (!v) { toast('Choisis où joindre le fichier', 'err'); return false; }
        const [col, id] = v.split(':'), ev = Store.get(col, id);
        ev.docIds = [...new Set([...(ev.docIds || []), rec.id])]; Store.upsert(col, ev); toast('Fichier joint');
      } }] });
  }

  /* ---------- viewer ---------- */
  async function open(id, after) {
    const rec = await Media.get(id); if (!rec) return toast('Fichier introuvable sur cet appareil', 'err');
    const urls = [], url = b => { const u = URL.createObjectURL(b); urls.push(u); return u; };
    let body = `<label class="fld"><span>Nom</span><input id="docName" value="${esc(rec.name || '')}"></label>`;
    if (rec.kind === 'link') body += `<p class="link-box">${I.share}<a href="${esc(rec.url)}" target="_blank" rel="noopener noreferrer">${esc(rec.url)}</a></p>
      <p class="muted small">${Analyse.isYT(rec) ? '« Analyser le match » : marque les actions pendant la lecture et prépare un briefing vidéo. Pour dessiner sur une image ou exporter les séquences en fichier vidéo, télécharge la vidéo sur l\'appareil puis importe-la avec « Fichiers » (YouTube ne laisse pas copier ses images).'
        : `Pour dessiner dessus ou en faire une séance, télécharge le fichier sur l'appareil depuis ${esc(rec.host || 'le site')}, puis importe-le avec « Fichiers ».`}</p>`;
    if (rec.kind === 'image') body += `<div class="viewer"><img alt="" src="${url(rec.blob)}"></div>`;
    if (rec.kind === 'video') body += `<div class="viewer"><video id="docVideo" src="${url(rec.blob)}" controls playsinline></video></div>
      <p class="tip">« Analyser le match » : marque les actions pendant la lecture et prépare un briefing vidéo. Ou mets la vidéo sur pause au bon moment, puis touche « Dessiner sur cette image » pour analyser l'action avec les flèches et les joueurs.</p>`;
    if (rec.kind === 'pdf') body += `<p class="muted small">${rec.pages.length} page${rec.pages.length > 1 ? 's' : ''}</p><div class="pdf-pages">${rec.pages.map((p, i) => `
      <figure><img alt="Page ${i + 1}" src="${url(p.blob)}"><figcaption><span>Page ${i + 1}</span><button class="btn soft" data-page="${i}">${I.edit}<span>Dessiner dessus</span></button><button class="btn soft" data-clean="${i}">${I.board}<span>Mettre au propre</span></button></figcaption></figure>`).join('')}</div>`;
    const actions = [];
    if (rec.kind === 'image') actions.push({ label: 'Dessiner dessus', kind: 'primary', icon: I.board, onClick: () => { (async () => { const img = await Media.loadImage(URL.createObjectURL(rec.blob)); const c = await canvasBlob(img, img.naturalWidth, img.naturalHeight); const sc = await drawOn(c.blob, c.w, c.h, cleanName(rec.name)); location.hash = '#/schema/' + sc.id; })(); } });
    if (rec.kind === 'video') actions.push({ label: 'Analyser le match', kind: 'primary', icon: I.video, onClick: () => { location.hash = '#/analyse/' + rec.id; } });
    if (rec.kind === 'video') actions.push({ label: 'Dessiner sur cette image', kind: 'primary', icon: I.board, onClick: (close, r) => {
      const v = $('#docVideo', r); if (!v.videoWidth) { toast('Lance la vidéo puis mets-la sur pause', 'err'); return false; }
      v.pause(); (async () => { const c = await canvasBlob(v, v.videoWidth, v.videoHeight); const t = Math.floor(v.currentTime); close();
        const sc = await drawOn(c.blob, c.w, c.h, `${cleanName(rec.name)} · ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`); location.hash = '#/schema/' + sc.id; })();
      return false; } });
    if (rec.kind === 'pdf') actions.push({ label: 'Créer une séance', kind: 'primary', icon: I.training, onClick: () => { setTimeout(() => toTraining(rec), 60); } });
    if (rec.kind === 'image') actions.push({ label: 'Mettre au propre', icon: I.board, onClick: () => { (async () => { const img = await Media.loadImage(URL.createObjectURL(rec.blob)); const cb = await canvasBlob(img, img.naturalWidth, img.naturalHeight); setTimeout(() => cleanCopy(cb.blob, cb.w, cb.h, rec.name), 60); })(); } });
    if (rec.kind === 'pdf' || rec.kind === 'image') {
      actions.push({ label: 'Imprimer', icon: I.pdf, onClick: () => { printRec(rec); return false; } });
      actions.push({ label: 'Envoyer dans la messagerie', icon: I.chat, onClick: () => { setTimeout(() => sendToChat(rec), 60); } });
    }
    if (Analyse.isYT(rec)) actions.push({ label: 'Analyser le match', kind: 'primary', icon: I.video, onClick: () => { location.hash = '#/analyse/' + rec.id; } });
    if (rec.kind === 'link') actions.push({ label: Analyse.isYT(rec) ? 'Ouvrir sur YouTube' : 'Ouvrir', kind: Analyse.isYT(rec) ? '' : 'primary', icon: I.share,onClick: () => { window.open(rec.url, '_blank', 'noopener'); return false; } });
    actions.push({ label: 'Joindre…', icon: I.layers, onClick: () => { setTimeout(() => attach(rec), 60); } });
    if (rec.blob) actions.push({ label: 'Partager', icon: I.share, onClick: () => { Exporter.deliver(rec.blob, rec.name || 'document'); return false; } });
    if (Auth.isAdmin() || (Auth.current() && rec.by === Auth.current().id)) actions.push({ label: 'Supprimer', kind: 'danger', icon: I.trash, onClick: () => { setTimeout(async () => { if (await confirmBox(`Supprimer « ${rec.name} » de la bibliothèque ?`)) { await Media.del(rec.id); toast('Supprimé'); after && after(); } }, 60); } });
    modal({ title: KIND[rec.kind][0], noFocus: true, body, actions,
      onOpen: (r, close) => {
        $('#docName', r).onchange = async e => { rec.name = e.target.value.trim() || rec.name; await Media.put(rec); after && after(); };
        $$('[data-clean]', r).forEach(b => b.onclick = () => { const p = rec.pages[+b.dataset.clean]; close(); setTimeout(() => cleanCopy(p.blob, p.w, p.h, `${rec.name} · page ${+b.dataset.clean + 1}`), 60); });
        $$('[data-page]', r).forEach(b => b.onclick = async () => { const p = rec.pages[+b.dataset.page]; close(); const sc = await drawOn(p.blob, p.w, p.h, `${cleanName(rec.name)} · page ${+b.dataset.page + 1}`); location.hash = '#/schema/' + sc.id; });
      } });
    const mo = new MutationObserver(() => { if (document.getElementById('modal').hidden) { urls.forEach(u => URL.revokeObjectURL(u)); mo.disconnect(); } });
    mo.observe(document.getElementById('modal'), { attributes: true });
  }

  /* ---------- library page ---------- */
  function card(m) {
    const [lab, ic] = KIND[m.kind] || ['Fichier', 'pdf'];
    return `<button class="lib-card" data-doc="${m.id}">
      <span class="lib-thumb">${m.thumb ? `<img alt="" src="${m.thumb}">` : I[ic]}<span class="lib-badge">${lab}${m.kind === 'pdf' ? ' · ' + m.pages.length + ' p.' : ''}</span></span>
      <span class="lib-name">${esc(m.name || 'Sans nom')}</span><span class="muted small">${esc(new Date(m.createdAt).toLocaleDateString('fr-FR'))}</span></button>`;
  }
  async function page(root) {
    const filt = S().ui.libFilter || '';
    root.innerHTML = `<header class="page-head"><div><h1>Bibliothèque</h1><p class="sub">Vidéos, montages, PDF et images venant d'autres applis</p></div>
      <div class="head-actions"><a class="btn" href="#/schemas">${I.board}<span>Schémas</span></a><button class="btn primary" data-act="import">${I.upload}<span>Importer</span></button></div></header>
      <section class="card how"><ul>
        <li>${I.video}<span><b>Vidéo de match</b> : « Analyser le match » pour marquer les actions et en faire un briefing vidéo, ou mets sur pause et dessine sur l'image.</span></li>
        <li>${I.pdf}<span><b>PDF</b> (séance, exercice, fiche) : l'appli le lit page par page, en fait une séance ou te laisse dessiner sur une page.</span></li>
        <li>${I.image}<span><b>Image ou capture d'écran</b> : dessine dessus comme sur le tableau tactique.</span></li>
        <li>${I.share}<span><b>OneDrive, Google Drive, Dropbox</b> : « Importer » → « Fichiers », ou colle un lien de partage.</span></li>
        <li>${I.layers}<span>Joins n'importe quel fichier à un entraînement ou un match : il apparaît sur sa page et dans son PDF.</span></li></ul></section>
      ${Analyse.libraryCard()}
      <div class="chips filter">${[['', 'Tout'], ['video', 'Vidéos'], ['pdf', 'PDF'], ['image', 'Images'], ['link', 'Liens']].map(([v, l]) => `<button class="chip ${v === filt ? 'on' : ''}" data-f="${v}">${l}</button>`).join('')}</div>
      <div class="lib-grid" id="libGrid"><p class="muted">Chargement…</p></div>`;
    const grid = $('#libGrid', root);
    const fill = async () => {
      const items = (await Media.list('lib')).filter(m => !filt || m.kind === filt).reverse();
      grid.innerHTML = items.length ? items.map(card).join('') : `<div class="empty"><p>Rien ici pour l'instant. Touche « Importer » pour ajouter une vidéo, un PDF ou une image depuis Fichiers, Photos ou une autre appli.</p></div>`;
    };
    await fill();
    root.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.act === 'import') return pickFiles(() => fill());
      if (b.hasAttribute('data-anbrief')) return Analyse.briefingsDialog();
      if (b.dataset.f !== undefined && b.classList.contains('chip')) { S().ui.libFilter = b.dataset.f; Store.save(); return page(root); }
      if (b.dataset.doc) open(b.dataset.doc, fill);
    };
  }

  /* ---------- documents attached to a training or a match ---------- */
  const docsPlaceholder = () => `<section class="card"><div class="row-head"><h2>${I.pdf}Documents</h2>
      <div class="chips"><button class="btn soft" data-docs="pick">${I.layers}<span>Depuis la bibliothèque</span></button><button class="btn soft" data-docs="import">${I.upload}<span>Importer</span></button></div></div>
      <div class="doc-list" id="docList"><p class="muted small">Chargement…</p></div></section>`;
  async function mountDocs(box, ev, save) {
    const list = $('#docList', box); if (!list) return;
    const recs = (await Promise.all((ev.docIds || []).map(id => Media.get(id)))).filter(Boolean);
    list.innerHTML = recs.length ? recs.map(m => `<div class="doc-item"><button class="doc-open" data-doc="${m.id}">${m.thumb ? `<img alt="" src="${m.thumb}">` : `<span class="doc-ic">${I[(KIND[m.kind] || [])[1] || 'pdf']}</span>`}
        <span><b>${esc(m.name || 'Sans nom')}</b><span class="muted small">${KIND[m.kind][0]}${m.kind === 'pdf' ? ' · ' + m.pages.length + ' pages' : ''}</span></span></button>
        <button class="icon-btn" data-undoc="${m.id}" aria-label="Retirer ${esc(m.name)}">${I.x}</button></div>`).join('')
      : '<p class="muted small">Aucun document. Joins une vidéo, un PDF ou une image : ils seront aussi dans le PDF imprimable.</p>';
    box.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      e.stopPropagation();
      const refresh = () => mountDocs(box, ev, save);
      if (b.dataset.doc) return open(b.dataset.doc, refresh);
      if (b.dataset.undoc) { ev.docIds = ev.docIds.filter(x => x !== b.dataset.undoc); save(); return refresh(); }
      if (b.dataset.docs === 'import') return pickFiles(ids => { ev.docIds = [...new Set([...(ev.docIds || []), ...ids])]; save(); refresh(); });
      if (b.dataset.docs === 'pick') {
        const items = (await Media.list('lib')).reverse();
        const close = modal({ title: 'Choisir dans la bibliothèque', noFocus: true,
          body: items.length ? `<div class="lib-grid small">${items.map(card).join('')}</div>` : '<p class="muted">La bibliothèque est vide.</p>',
          onOpen: r => $$('[data-doc]', r).forEach(x => x.onclick = () => { ev.docIds = [...new Set([...(ev.docIds || []), x.dataset.doc])]; save(); close(); refresh(); }) });
      }
    };
  }

  /* ---------- sharing schemas drawn on a picture ---------- */
  const toDataURL = blob => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });
  async function withBackgrounds(json) {
    const obj = JSON.parse(json);
    for (const sc of (obj.data.schemas || [])) {
      if (sc.field && sc.field.format === 'bg' && sc.field.bgId) { const m = await Media.get(sc.field.bgId); if (m) sc.bgData = await toDataURL(m.blob); }
    }
    return JSON.stringify(obj);
  }
  // One schema at a time, for the club server
  async function withBackground(sc) {
    const m = await Media.get(sc.field.bgId).catch(() => null);
    return m ? Object.assign({}, sc, { bgData: await toDataURL(m.blob) }) : sc;
  }
  async function saveBackground(sc) {
    if (!sc.bgData || !sc.field || !sc.field.bgId) return;
    if (!(await Media.get(sc.field.bgId).catch(() => null))) {
      const blob = await (await fetch(sc.bgData)).blob();
      await Media.put({ id: sc.field.bgId, ref: 'bg', kind: 'image', name: sc.name, blob, mime: blob.type, createdAt: Date.now() });
    }
    Board.BG.delete(sc.field.bgId);
    await Board.ensureBg(Object.assign({}, sc, { bgData: undefined })).catch(() => {});
  }
  async function restoreBackgrounds() {
    let n = 0;
    for (const sc of S().schemas) {
      if (!sc.bgData) continue;
      const blob = await (await fetch(sc.bgData)).blob();
      await Media.put({ id: sc.field.bgId, ref: 'bg', kind: 'image', name: sc.name, blob, mime: blob.type, createdAt: Date.now() });
      delete sc.bgData; Board.BG.delete(sc.field.bgId); await Board.ensureBg(sc); n++;
    }
    if (n) Store.save();
  }
  // Data URLs of attached documents for the printable PDF
  async function docImages(ids) {
    const out = [];
    for (const id of ids || []) {
      const m = await Media.get(id); if (!m) continue;
      if (m.kind === 'image') out.push({ name: m.name, images: [await toDataURL(m.blob)] });
      if (m.kind === 'pdf') out.push({ name: m.name, images: await Promise.all(m.pages.map(p => toDataURL(p.blob))), dims: m.pages.map(p => [p.w, p.h]) });
      if (m.kind === 'video') out.push({ name: m.name, video: true });
      if (m.kind === 'link') out.push({ name: m.name, link: m.url });
    }
    return out;
  }

  return { pdfjs, drawOnFrame: drawOn, page, open, pickFiles, importFiles, docsPlaceholder, mountDocs, withBackgrounds, withBackground, saveBackground, restoreBackgrounds, docImages };
})();
