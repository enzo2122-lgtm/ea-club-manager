/* Profil (2.75) : la photo de profil et les courbes taille / poids, côté familles (joueurs.html, parents.html).
   - La photo : prise avec le téléphone ou choisie, coupée en rond, gardée petite (320 px) ; envoyée au serveur par member_profile,
     le coach la voit sur la fiche du joueur (la même que s'il l'avait prise lui-même).
   - Les courbes : l'historique « growth » tenu par le serveur à chaque mesure (le joueur, ses parents ou le coach). */
const Profil = (() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fd = d => { try { return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' }); } catch (e) { return d; } };
  let css = false;
  function style() {
    if (css) return; css = true;
    const st = document.createElement('style');
    st.textContent = '.pf-photo{display:flex;align-items:center;gap:14px;margin:0 0 12px}.pf-av{width:84px;height:84px;border-radius:50%;object-fit:cover;flex:none;border:3px solid var(--navy,#0e1d45);background:var(--surface,#fff)}'
      + '.pf-av.ph{display:grid;place-items:center;font-size:34px;color:var(--muted,#667)}.pf-photo .btns{display:flex;flex-wrap:wrap;gap:6px}.pf-photo input[type=file]{display:none}'
      + '.pf-curves{display:grid;gap:10px;margin:10px 0}.pf-curves>div>span{display:block;font-size:13px;font-weight:700;color:var(--muted,#667)}.pf-curve{width:100%;height:auto;display:block;background:var(--bg,#f3f4f8);border-radius:10px}';
    document.head.appendChild(st);
  }
  function shrink(file, size = 320) {
    return new Promise((res, rej) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = size; const s = Math.min(img.width, img.height), x = (img.width - s) / 2, y = (img.height - s) / 2;
        c.getContext('2d').drawImage(img, x, y, s, s, 0, 0, size, size); URL.revokeObjectURL(url); res(c.toDataURL((() => { try { const t = document.createElement('canvas'); t.width = t.height = 2; return t.toDataURL('image/webp').indexOf('image/webp') > 0 ? 'image/webp' : 'image/jpeg'; } catch (e) { return 'image/jpeg'; } })(), .8)); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Photo illisible')); }; img.src = url;
    });
  }
  function curve(pts, col, unit) {
    if (pts.length < 2) return '';
    const W = 300, H = 90, xs = pts.map(x => +new Date(x.date)), ys = pts.map(x => x.v), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const X = t => 8 + (x1 === x0 ? 0 : (t - x0) / (x1 - x0)) * (W - 16), Y = v => H - 14 - (y1 === y0 ? .5 : (v - y0) / (y1 - y0)) * (H - 28);
    return `<svg class="pf-curve" viewBox="0 0 ${W} ${H}"><polyline fill="none" stroke="${col}" stroke-width="2.5" points="${pts.map(x => `${X(+new Date(x.date)).toFixed(1)},${Y(x.v).toFixed(1)}`).join(' ')}"/>
      ${pts.map(x => `<circle cx="${X(+new Date(x.date)).toFixed(1)}" cy="${Y(x.v).toFixed(1)}" r="3" fill="${col}"><title>${esc(fd(x.date))} : ${x.v} ${unit}</title></circle>`).join('')}
      <text x="8" y="${H - 2}" font-size="10" fill="currentColor" opacity=".6">${esc(fd(pts[0].date))}</text><text x="${W - 8}" y="${H - 2}" font-size="10" text-anchor="end" fill="currentColor" opacity=".6">${esc(fd(pts[pts.length - 1].date))}</text>
      <text x="${W - 8}" y="12" font-size="11" text-anchor="end" fill="${col}" font-weight="700">${pts[pts.length - 1].v} ${unit}</text></svg>`;
  }
  // the photo and its buttons; « view » : no change possible (a minor seen by… nobody: the parents and the player can both change it)
  function photoHtml(prof, o = {}) {
    style(); const ph = prof && /^data:image\//.test(prof.photo || '') ? prof.photo : '';
    return `<div class="pf-photo">${ph ? `<img class="pf-av" alt="" src="${ph}">` : `<span class="pf-av ph" aria-hidden="true">${o.icon || '🙂'}</span>`}
      <div class="btns"><label class="b small">📷 ${ph ? 'Changer la photo' : 'Ajouter une photo'}<input type="file" accept="image/*" data-pfpick></label>${ph ? '<button class="b small" data-pfdel>Retirer</button>' : ''}
      <span class="info small">${o.note || 'Vue par les coachs et sur ta fiche.'}</span></div></div>`;
  }
  function growthHtml(prof) {
    style(); const g = (prof && prof.growth) || [], hs = g.filter(x => x.h).map(x => ({ date: x.date, v: +x.h })), ws = g.filter(x => x.w).map(x => ({ date: x.date, v: +x.w }));
    if (hs.length < 2 && ws.length < 2) return g.length ? '<p class="info small">📏 Une seule mesure pour l\'instant : la courbe apparaît à la suivante.</p>' : '';
    return `<div class="pf-curves">${hs.length > 1 ? `<div><span>📏 Taille</span>${curve(hs, '#2563eb', 'cm')}</div>` : ''}${ws.length > 1 ? `<div><span>⚖️ Poids</span>${curve(ws, '#ea580c', 'kg')}</div>` : ''}</div>`;
  }
  // the clicks of the photo: o.code, o.rpc, o.toast, o.done(prof) (the page redraws)
  let bound = false;
  function bind(o) {
    if (bound) return; bound = true;
    const send = async (photo, msg) => {
      try { const prof = await o.rpc('member_profile', { p_code: o.code(), p_data: { photo } }); o.toast(msg); o.done(prof || {}); }
      catch (e) { o.toast(/PHOTO/.test(e.message) ? 'Cette photo ne passe pas : essaie avec une autre.' : e.message, true); }
    };
    document.addEventListener('change', async e => { const i = e.target.closest && e.target.closest('[data-pfpick]'); if (!i) return; const f = i.files && i.files[0]; if (!f) return;
      try { send(await shrink(f), '📷 Photo enregistrée'); } catch (x) { o.toast(x.message, true); } i.value = ''; });
    document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-pfdel]')) send('', 'Photo retirée'); });
  }
  return { photoHtml, growthHtml, bind, shrink, curve };
})();
