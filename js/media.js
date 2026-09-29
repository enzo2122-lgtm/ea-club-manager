/* Media: photos and videos attached to a match or a training, stored on this device (IndexedDB).
   Photos are resized to keep the iPad storage light; videos are kept as they are. */
const Media = (() => {
  const { esc, toast, modal, confirmBox } = UI;
  const DB = 'ea-media', OS = 'media', MAX_VIDEO = 300 * 1024 * 1024;
  let dbp = null;
  function db() {
    return dbp || (dbp = new Promise((res, rej) => {
      const rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = () => { const s = rq.result.createObjectStore(OS, { keyPath: 'id' }); s.createIndex('ref', 'ref'); };
      rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
    }));
  }
  const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(OS, mode), r = fn(t.objectStore(OS)); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }); };
  const list = async ref => ((await tx('readonly', s => s.index('ref').getAll(ref))) || []).sort((a, b) => a.createdAt - b.createdAt);
  const get = id => tx('readonly', s => s.get(id));
  const put = rec => tx('readwrite', s => s.put(rec));
  const del = id => tx('readwrite', s => s.delete(id));
  async function removeRef(ref) { (await list(ref)).forEach(m => del(m.id)); }

  function loadImage(url) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; }); }
  function drawScaled(src, w, h, max, type = 'image/jpeg', q = .85) {
    const k = Math.min(1, max / Math.max(w, h)), c = document.createElement('canvas');
    c.width = Math.round(w * k); c.height = Math.round(h * k);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return c;
  }
  async function photo(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      const big = drawScaled(img, img.naturalWidth, img.naturalHeight, 1920);
      const blob = await new Promise(r => big.toBlob(r, 'image/jpeg', .85));
      return { blob, mime: 'image/jpeg', thumb: drawScaled(img, img.naturalWidth, img.naturalHeight, 360).toDataURL('image/jpeg', .7) };
    } finally { URL.revokeObjectURL(url); }
  }
  async function videoThumb(file) {
    const url = URL.createObjectURL(file), v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
    try {
      await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = rej; setTimeout(res, 4000); });
      await new Promise(res => { v.onseeked = res; try { v.currentTime = Math.min(.5, (v.duration || 1) / 2); } catch (e) { res(); } setTimeout(res, 2500); });
      return v.videoWidth ? drawScaled(v, v.videoWidth, v.videoHeight, 360).toDataURL('image/jpeg', .7) : '';
    } catch (e) { return ''; } finally { URL.revokeObjectURL(url); }
  }
  async function add(ref, files) {
    const me = Auth.current(); let n = 0;
    for (const f of files) {
      const isVid = f.type.startsWith('video/');
      if (!isVid && !f.type.startsWith('image/')) continue;
      if (isVid && f.size > MAX_VIDEO) { toast(`${f.name} est trop lourde (plus de 300 Mo)`, 'err'); continue; }
      const rec = { id: Store.uid(), ref, kind: isVid ? 'video' : 'image', name: f.name || '', createdAt: Date.now(), by: me ? me.id : null, caption: '' };
      if (isVid) Object.assign(rec, { blob: f, mime: f.type || 'video/mp4', thumb: await videoThumb(f) });
      else Object.assign(rec, await photo(f));
      await put(rec); n++;
    }
    return n;
  }

  /* ---------- gallery ---------- */
  const placeholder = (ref, title = 'Photos et vidéos') => `<section class="card gallery-card"><div class="row-head"><h2>${I.image}${esc(title)}</h2>
      <button class="btn primary" data-media-add="${esc(ref)}">${I.plus}<span>Ajouter</span></button></div>
      <div class="gallery" data-gallery="${esc(ref)}"><p class="muted">Chargement…</p></div></section>`;
  async function mount(root) {
    for (const el of root.querySelectorAll('[data-gallery]')) {
      const ref = el.dataset.gallery, items = await list(ref);
      el.innerHTML = items.length ? items.map(m => `<button class="thumb-btn" data-media="${m.id}" aria-label="${m.kind === 'video' ? 'Vidéo' : 'Photo'}">
          ${m.thumb ? `<img alt="" src="${m.thumb}">` : `<span class="no-thumb">${I.video}</span>`}${m.kind === 'video' ? `<span class="play-badge">${I.play}</span>` : ''}</button>`).join('')
        : '<p class="muted">Pas encore de photo ni de vidéo. Touche « Ajouter » pour en mettre depuis l\'appareil photo ou la galerie.</p>';
    }
    root.querySelectorAll('[data-media-add]').forEach(btn => btn.onclick = async e => {
      e.stopPropagation();
      const files = await UI.chooseFiles({ accept: 'image/*,video/*', multiple: true }); if (!files.length) return;
      const b = UI.busy('Ajout des photos et vidéos…');
      try { const n = await add(btn.dataset.mediaAdd, files); if (n) toast(`${n} ajoutée${n > 1 ? 's' : ''}`); else toast('Choisis des photos ou des vidéos (pour un PDF, utilise « Documents »)', 'err'); }
      catch (e) { toast("Impossible d'enregistrer ce fichier : l'appareil manque peut-être de place", 'err'); }
      finally { b.done(); mount(root); }
    });
    root.querySelectorAll('[data-media]').forEach(btn => btn.onclick = () => view(btn.dataset.media, () => mount(root)));
  }
  async function view(id, after) {
    const m = await get(id); if (!m) return;
    const url = URL.createObjectURL(m.blob), by = m.by && Store.get('staff', m.by);
    const date = new Date(m.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    const close = modal({
      title: m.kind === 'video' ? 'Vidéo' : 'Photo', noFocus: true,
      body: `<div class="viewer">${m.kind === 'video' ? `<video src="${url}" controls playsinline></video>` : `<img alt="" src="${url}">`}</div>
        <p class="muted small">Ajoutée le ${esc(date)}${by ? ' par ' + esc(Store.fullName(by)) : ''}</p>`,
      actions: [
        ...(m.kind === 'video' ? [{ label: 'Analyser', icon: I.video, onClick: () => { location.hash = '#/analyse/' + m.id; } }] : []),
        ...(canDelete(m) ? [{ label: 'Supprimer', kind: 'danger', icon: I.trash, onClick: () => { setTimeout(async () => { if (await confirmBox('Supprimer ce fichier ?')) { await del(m.id); toast('Supprimé'); after && after(); } }, 60); } }] : []),
        { label: 'Enregistrer / partager', icon: I.share, onClick: () => { Exporter.deliver(m.blob, `club-${m.id}.${m.kind === 'video' ? (m.mime.includes('quicktime') ? 'mov' : 'mp4') : 'jpg'}`); return false; } },
        { label: 'Fermer', kind: 'primary' },
      ],
    });
    const obs = new MutationObserver(() => { if (document.getElementById('modal').hidden) { URL.revokeObjectURL(url); obs.disconnect(); } });
    obs.observe(document.getElementById('modal'), { attributes: true });
    void close;
  }
  const canDelete = m => Auth.isAdmin() || (Auth.current() && m.by === Auth.current().id);

  return { placeholder, mount, removeRef, list, get, put, del, photo, videoThumb, drawScaled, loadImage, MAX_VIDEO };
})();
