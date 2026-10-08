/* PCard (2.62): more on the player's page, for the coaches.
   - Photo: taken with the phone or chosen, cut round, kept small (seen by the coaches only).
   - Growth: height and weight with their date, the curves, and a warning when he grows fast (growth spurt: careful with the loads).
   - Affinities: « jouer avec » / « éviter » (2 at most each, both ways), used by « Former des équipes ».
   - Talks: the individual talks (strengths, what to work on, goals, how he feels), private, or shared with the player and his family. */
const PCard = (() => {
  const { esc, toast, modal, confirmBox } = UI;
  const S = () => Store.state;
  const fd = d => UI.fmtDate(d, { day: 'numeric', month: 'short', year: '2-digit' });
  const today = () => UI.today();

  /* ---------- photo ---------- */
  function shrink(file, size = 320) {
    return new Promise((res, rej) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = size; const s = Math.min(img.width, img.height), x = (img.width - s) / 2, y = (img.height - s) / 2;
        c.getContext('2d').drawImage(img, x, y, s, s, 0, 0, size, size); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', .8)); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Photo illisible')); }; img.src = url;
    });
  }
  const photo = (p, cls = '') => p && p.photo && /^data:image\//.test(p.photo) ? `<img class="pc-photo ${cls}" src="${p.photo}" alt="">` : '';
  function photoHtml(p) {
    return `<div class="pc-ph">${photo(p) || `<span class="pc-ph0">${esc(((p.firstName || '?')[0] + (p.lastName || '')[0]).toUpperCase())}</span>`}
      <label class="btn soft small">📷 ${p.photo ? 'Changer' : 'Ajouter une photo'}<input type="file" accept="image/*" data-pcphoto hidden></label>${p.photo ? '<button class="linkish" data-pcact="nophoto">enlever</button>' : ''}</div>`;
  }

  /* ---------- growth ---------- */
  // the history: each new height / weight on the sheet (coach or the player's own profile) is kept with its date
  function track(p) {
    const g = (p.growth || []).slice(), last = g[g.length - 1] || {}, h = +p.height || null, w = +p.weight || null;
    if ((h || w) && (h !== (last.h || null) || w !== (last.w || null))) {
      const d = (p.profileAt && String(p.profileAt).slice(0, 10)) || today();
      p.growth = [...g.filter(x => x.date !== d), { date: d, h, w }].sort((a, b) => a.date.localeCompare(b.date)).slice(-40);
      Store.upsert('players', p);
    }
  }
  const spurt = p => { // more than 3 cm in 6 months: a growth spurt
    const g = (p.growth || []).filter(x => x.h); if (g.length < 2) return null;
    const last = g[g.length - 1], ref = g.filter(x => (new Date(last.date) - new Date(x.date)) / 864e5 <= 190)[0];
    if (!ref || ref === last) return null; const cm = last.h - ref.h, mo = Math.max(1, Math.round((new Date(last.date) - new Date(ref.date)) / 864e5 / 30));
    return cm >= 3 ? { cm, mo } : null;
  };
  function curve(pts, col, unit) {
    if (pts.length < 2) return '';
    const W = 300, H = 90, xs = pts.map(x => +new Date(x.date)), ys = pts.map(x => x.v), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const X = t => 8 + (x1 === x0 ? 0 : (t - x0) / (x1 - x0)) * (W - 16), Y = v => H - 14 - (y1 === y0 ? .5 : (v - y0) / (y1 - y0)) * (H - 28);
    return `<svg class="pc-curve" viewBox="0 0 ${W} ${H}"><polyline fill="none" stroke="${col}" stroke-width="2.5" points="${pts.map(x => `${X(+new Date(x.date)).toFixed(1)},${Y(x.v).toFixed(1)}`).join(' ')}"/>
      ${pts.map(x => `<circle cx="${X(+new Date(x.date)).toFixed(1)}" cy="${Y(x.v).toFixed(1)}" r="3" fill="${col}"><title>${esc(fd(x.date))} : ${x.v} ${unit}</title></circle>`).join('')}
      <text x="8" y="${H - 2}" font-size="10" fill="currentColor" opacity=".6">${esc(fd(pts[0].date))}</text><text x="${W - 8}" y="${H - 2}" font-size="10" text-anchor="end" fill="currentColor" opacity=".6">${esc(fd(pts[pts.length - 1].date))}</text>
      <text x="${W - 8}" y="12" font-size="11" text-anchor="end" fill="${col}" font-weight="700">${pts[pts.length - 1].v} ${unit}</text></svg>`;
  }
  function growthHtml(p) {
    const g = p.growth || [], hs = g.filter(x => x.h).map(x => ({ date: x.date, v: x.h })), ws = g.filter(x => x.w).map(x => ({ date: x.date, v: x.w })), s = spurt(p);
    return `<section class="card pc-card"><h2>📏 Croissance</h2>
      ${s ? `<p class="pc-warn">⚠️ <b>Pic de croissance</b> : +${s.cm} cm en ${s.mo} mois. Vigilance sur les charges, les sauts et les sprints répétés (genoux, talons : Osgood, Sever).</p>` : ''}
      ${hs.length > 1 || ws.length > 1 ? `<div class="pc-curves">${hs.length > 1 ? `<div><span>Taille</span>${curve(hs, '#2563eb', 'cm')}</div>` : ''}${ws.length > 1 ? `<div><span>Poids</span>${curve(ws, '#ea580c', 'kg')}</div>` : ''}</div>`
        : `<p class="muted small">${g.length ? 'Une seule mesure pour l\'instant : la courbe arrive à la prochaine.' : 'Pas encore de mesure.'} Mesure-le 2 ou 3 fois dans la saison (ou le joueur remplit son profil).</p>`}
      <div class="chips"><button class="btn soft small" data-pcact="measure">➕ Nouvelle mesure</button>${g.length ? `<span class="muted small">${g.length} mesure${g.length > 1 ? 's' : ''}</span>` : ''}</div></section>`;
  }

  /* ---------- affinities ---------- */
  const ids = (p, k) => (p[k] || []).filter(id => Store.get('players', id));
  function affHtml(p) {
    const w = ids(p, 'with'), a = ids(p, 'avoid'), nm = id => esc(Store.shortName(Store.get('players', id)));
    return `<section class="card pc-card"><h2>🤝 Affinités</h2><p class="muted small">🔒 Coachs seulement. Utilisées par « Former des équipes » (2 au plus, dans les deux sens).</p>
      <div class="pc-aff"><span>💚 Jouer avec</span><div>${w.map(id => `<span class="pc-tag">${nm(id)} <button data-pcaff="with:${id}" aria-label="Retirer">✕</button></span>`).join('') || '<i class="muted">personne</i>'}${w.length < 2 ? '<button class="btn soft small" data-pcact="with">➕</button>' : ''}</div></div>
      <div class="pc-aff"><span>⛔ Éviter</span><div>${a.map(id => `<span class="pc-tag no">${nm(id)} <button data-pcaff="avoid:${id}" aria-label="Retirer">✕</button></span>`).join('') || '<i class="muted">personne</i>'}${a.length < 2 ? '<button class="btn soft small" data-pcact="avoid">➕</button>' : ''}</div></div></section>`;
  }
  function setAff(p, k, other, on) {
    const q = Store.get('players', other); if (!q) return;
    const put = (x, y) => { x[k] = [...new Set((x[k] || []).filter(id => id !== y).concat(on ? [y] : []))].slice(-2); if (!x[k].length) delete x[k]; Store.upsert('players', x); };
    put(p, q.id); put(q, p.id);
  }

  /* ---------- individual talks ---------- */
  const TF = [['strong', '💪 Points forts'], ['work', '🎯 Axes de progrès'], ['goals', '🏁 Objectifs fixés'], ['feel', '💬 Son ressenti, ses attentes']];
  function talksHtml(p) {
    const l = (p.talks || []).slice().sort((a, b) => b.date.localeCompare(a.date));
    return `<section class="card pc-card"><div class="row-head"><h2>🗣️ Entretiens individuels</h2><button class="btn soft small" data-pcact="talk">➕ Nouvel entretien</button></div>
      ${l.length ? l.map(t => `<details class="pc-talk"><summary><b>${esc(fd(t.date))}</b>${t.shared ? ' · <span class="pc-sh">👪 partagé</span>' : ' · <span class="muted">🔒 privé</span>'}${t.reply ? ' · 💬 il a répondu' : ''}</summary>
        ${TF.filter(([k]) => t[k]).map(([k, l2]) => `<p><b>${l2}</b><br>${esc(t[k]).replace(/\n/g, '<br>')}</p>`).join('')}
        ${t.reply ? `<p class="pc-reply"><b>💬 Sa réponse</b> (${esc(fd(String(t.replyAt || '').slice(0, 10) || t.date))})<br>${esc(t.reply)}</p>` : ''}
        <div class="chips"><button class="btn soft small" data-pctalk="${t.id}">✏️ Modifier</button></div></details>`).join('') : '<p class="muted small">Un point avec le joueur : ses points forts, ce qu\'il doit travailler, ses objectifs, ce qu\'il ressent. Privé, ou partagé avec lui et sa famille (il peut répondre).</p>'}</section>`;
  }
  function talkEdit(p, t, redraw) {
    const isNew = !t; t = t || { id: Store.uid(), date: today() };
    modal({ title: `🗣️ Entretien · ${Store.fullName(p)}`, noFocus: true,
      body: `<label class="fld"><span>Date</span><input type="date" id="tkDate" value="${esc(t.date)}"></label>${TF.map(([k, l]) => `<label class="fld"><span>${l}</span><textarea data-tk="${k}" rows="3" maxlength="600">${esc(t[k] || '')}</textarea></label>`).join('')}
        <label class="switch small"><input type="checkbox" id="tkShare" ${t.shared ? 'checked' : ''}><span>👪 Partager avec le joueur et sa famille (dans leur espace, ils peuvent répondre)</span></label>`,
      actions: [...(isNew ? [] : [{ label: 'Supprimer', kind: 'danger', onClick: () => { p.talks = (p.talks || []).filter(x => x.id !== t.id); Store.upsert('players', p); setTimeout(redraw, 0); } }]),
        { label: 'Annuler' }, { label: 'Enregistrer', kind: 'primary', onClick: (c, r) => {
          t.date = r.querySelector('#tkDate').value || today(); r.querySelectorAll('[data-tk]').forEach(x => { const v = x.value.trim(); if (v) t[x.dataset.tk] = v; else delete t[x.dataset.tk]; });
          t.shared = r.querySelector('#tkShare').checked; t.by = (Auth.current() || {}).id || null;
          if (!TF.some(([k]) => t[k])) { toast('Écris au moins une rubrique', 'err'); return false; }
          p.talks = [...(p.talks || []).filter(x => x.id !== t.id), t]; Store.upsert('players', p); toast('🗣️ Entretien enregistré'); setTimeout(redraw, 0); } }] });
  }

  /* ---------- on the player's page ---------- */
  function cards(p) { try { track(p); } catch (e) {} return `${growthHtml(p)}${affHtml(p)}${talksHtml(p)}`; }
  function pickPlayer(p, title, done) {
    const pool = S().players.filter(x => x.id !== p.id && !x.archived && (x.teamIds || []).some(id => (p.teamIds || []).includes(id))).sort(Store.byName);
    modal({ title, noFocus: true, body: `<div class="chips">${pool.map(x => `<button class="chip" data-pick="${x.id}">${esc(Store.fullName(x))}</button>`).join('') || '<p class="muted">Personne dans ses catégories.</p>'}</div>`,
      onOpen: (r, close) => r.addEventListener('click', e => { const b = e.target.closest('[data-pick]'); if (b) { close(); done(b.dataset.pick); } }), actions: [{ label: 'Fermer' }] });
  }
  async function click(e, p, redraw) {
    const b = e.target.closest('[data-pcact], [data-pcaff], [data-pctalk]'); if (!b) return false;
    const a = b.dataset.pcact;
    if (a === 'nophoto') { delete p.photo; Store.upsert('players', p); redraw(); return true; }
    if (a === 'measure') { modal({ title: '📏 Nouvelle mesure', body: `<div class="row3"><label class="fld"><span>Date</span><input type="date" id="msD" value="${today()}"></label><label class="fld"><span>Taille (cm)</span><input type="number" inputmode="decimal" id="msH" value="${esc(p.height || '')}"></label><label class="fld"><span>Poids (kg)</span><input type="number" inputmode="decimal" id="msW" value="${esc(p.weight || '')}"></label></div>`,
      actions: [{ label: 'Annuler' }, { label: 'Enregistrer', kind: 'primary', onClick: (c, r) => { const d = r.querySelector('#msD').value || today(), h = +r.querySelector('#msH').value || null, w = +r.querySelector('#msW').value || null;
        if ((h && (h < 80 || h > 230)) || (w && (w < 15 || w > 200))) { toast('Mesure étonnante : vérifie', 'err'); return false; }
        p.growth = [...(p.growth || []).filter(x => x.date !== d), { date: d, h, w }].sort((x, y) => x.date.localeCompare(y.date)); const last = p.growth[p.growth.length - 1]; if (last.h) p.height = String(last.h); if (last.w) p.weight = String(last.w);
        Store.upsert('players', p); setTimeout(redraw, 0); } }] }); return true; }
    if (a === 'with' || a === 'avoid') { pickPlayer(p, a === 'with' ? '💚 Jouer avec…' : '⛔ Éviter…', id => { setAff(p, a, id, true); if (a === 'with') setAff(p, 'avoid', id, false); else setAff(p, 'with', id, false); redraw(); }); return true; }
    if (b.dataset.pcaff) { const [k, id] = b.dataset.pcaff.split(':'); setAff(p, k, id, false); redraw(); return true; }
    if (a === 'talk') { talkEdit(p, null, redraw); return true; }
    if (b.dataset.pctalk) { talkEdit(p, (p.talks || []).find(x => x.id === b.dataset.pctalk), redraw); return true; }
    return false;
  }
  function bindPhoto(root, p, redraw) {
    const i = root.querySelector('[data-pcphoto]'); if (!i) return;
    i.onchange = async () => { const f = i.files && i.files[0]; if (!f) return; try { p.photo = await shrink(f); Store.upsert('players', p); toast('📷 Photo enregistrée'); redraw(); } catch (e) { toast(e.message, 'err'); } };
  }
  return { photo, photoHtml, cards, click, bindPhoto, spurt };
})();
