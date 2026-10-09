/* Kit (2.66): the equipment of the players (« intendance »).
   For each player: his sizes (top, bottom, shoes) and what the club gave him (jersey, shorts, tracksuit, bag…, with the date).
   The page sums up the sizes to order and who still waits for something. Coaches, responsables and the « Intendance » access fill it. */
const Kit = (() => {
  const { esc, toast, modal } = UI;
  const S = () => Store.state;
  const ITEMS0 = ['Maillot', 'Short', 'Chaussettes', 'Survêtement', 'Sac', 'K-way'];
  const SIZES = ['6 ans', '8 ans', '10 ans', '12 ans', '14 ans', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
  const items = () => (Array.isArray(S().club.kitItems) && S().club.kitItems.length ? S().club.kitItems : ITEMS0);
  const kitOf = p => p.kit || {};
  const fd = d => UI.fmtDate(d, { day: 'numeric', month: 'short' });
  const sizeOpts = (cur, ph) => `<option value="">${ph}</option>${SIZES.map(s => `<option ${s === cur ? 'selected' : ''}>${s}</option>`).join('')}`;
  let only = 'all'; // all / missing

  function css() {
    if (document.getElementById('kitCss')) return;
    const st = document.createElement('style'); st.id = 'kitCss';
    st.textContent = `.kit-sum{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}.kit-sum div{background:var(--surface2,rgba(0,0,0,.04));border-radius:10px;padding:8px 10px}
      .kit-sum b{display:block;font-size:.95rem}.kit-sum span{font-size:.85rem;color:var(--muted)}
      .kit-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;padding:10px 0;border-top:1px solid var(--line)}.kit-row:first-of-type{border-top:0}
      .kit-name{flex:1 1 160px;min-width:0}.kit-name b{display:block}.kit-name small{color:var(--muted)}
      .kit-chips{display:flex;flex-wrap:wrap;gap:5px;flex:2 1 260px}.kit-chips .chip{padding:5px 9px;font-size:.82rem}
      .kit-chips .chip.on::before{content:'✓ '}`;
    document.head.appendChild(st);
  }

  function edit(p, done) {
    const k = kitOf(p);
    modal({ title: `🎽 ${Store.fullName(p)}`, body: `
      <div class="row3"><label class="fld"><span>Taille haut (maillot)</span><select id="kTop">${sizeOpts(k.top, '–')}</select></label>
        <label class="fld"><span>Taille bas (short)</span><select id="kBot">${sizeOpts(k.bottom, '–')}</select></label>
        <label class="fld"><span>Pointure</span><input id="kShoe" inputmode="numeric" maxlength="4" value="${esc(k.shoe || '')}" placeholder="ex : 38"></label></div>
      <label class="fld"><span>Numéro de maillot</span><input id="kNum" inputmode="numeric" maxlength="3" value="${esc(p.number || '')}"></label>
      <div class="lbl">Ce qui lui a été donné</div>
      <div class="chips" id="kGot">${items().map(i => `<button type="button" class="chip ${(k.got || {})[i] ? 'on' : ''}" data-it="${esc(i)}">${esc(i)}${(k.got || {})[i] ? ' · ' + esc(fd(k.got[i])) : ''}</button>`).join('')}</div>
      <label class="fld"><span>Note (à rendre, à changer, flocage…)</span><input id="kNote" maxlength="120" value="${esc(k.note || '')}"></label>`,
      onOpen: r => r.querySelectorAll('#kGot [data-it]').forEach(b => b.onclick = () => b.classList.toggle('on')),
      actions: [{ label: 'Annuler' }, { label: 'Enregistrer', kind: 'primary', onClick: (c, r) => {
        const got = Object.assign({}, k.got || {}), v = id => r.querySelector('#' + id).value.trim();
        r.querySelectorAll('#kGot [data-it]').forEach(b => { const i = b.dataset.it; if (b.classList.contains('on')) got[i] = got[i] || UI.today(); else delete got[i]; });
        p.kit = { top: v('kTop'), bottom: v('kBot'), shoe: v('kShoe'), got, note: v('kNote') };
        Object.keys(p.kit).forEach(x => { if (p.kit[x] === '' || (x === 'got' && !Object.keys(got).length)) delete p.kit[x]; });
        p.number = v('kNum');
        Store.upsert('players', p); toast('Enregistré'); done && done();
      } }] });
  }

  function csv(t, ps) {
    const head = ['Joueur', 'N°', 'Taille haut', 'Taille bas', 'Pointure', ...items(), 'Note'];
    const rows = ps.map(p => { const k = kitOf(p); return [Store.fullName(p), p.number || '', k.top || '', k.bottom || '', k.shoe || '', ...items().map(i => (k.got || {})[i] || ''), k.note || '']; });
    const q = x => /[;"\n]/.test(String(x)) ? '"' + String(x).replace(/"/g, '""') + '"' : String(x);
    const txt = '﻿' + [head, ...rows].map(r => r.map(q).join(';')).join('\n');
    return Exporter.deliver(new Blob([txt], { type: 'text/csv' }), `equipements-${String(t.name).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`);
  }

  // #/equipements/teamId
  function page(root, teamId) {
    css();
    const teams = Auth.teams() || [], cur = teamId || (S().ui || {}).teamId, t = (cur && Auth.sees(cur) && Store.get('teams', cur)) || teams[0];
    if (!t) { root.innerHTML = '<header class="page-head"><div><h1>🎽 Équipements</h1></div></header><p class="muted">Aucune catégorie ouverte pour toi : demande au responsable du club.</p>'; return; }
    S().ui.teamId = t.id;
    const ps = Store.playersOf(t.id).filter(p => !p.archived).slice().sort(Store.byName), IT = items();
    const miss = p => IT.filter(i => !(kitOf(p).got || {})[i]);
    const count = (key) => { const o = {}; ps.forEach(p => { const v = kitOf(p)[key]; if (v) o[v] = (o[v] || 0) + 1; }); return Object.entries(o).sort((a, b) => SIZES.indexOf(a[0]) - SIZES.indexOf(b[0]) || a[0].localeCompare(b[0], 'fr', { numeric: true })); };
    const noSize = ps.filter(p => !kitOf(p).top).length, list = only === 'missing' ? ps.filter(p => miss(p).length) : ps;
    const sum = (l, ic, key) => { const c = count(key); return `<div><b>${ic} ${l}</b><span>${c.length ? c.map(([s, n]) => `${esc(s)} × ${n}`).join(' · ') : '–'}</span></div>`; };
    root.innerHTML = `<header class="page-head"><div><h1>🎽 Équipements · ${esc(t.name)}</h1><p class="sub">${ps.length} joueurs · ${ps.filter(p => !miss(p).length).length} équipés de tout</p></div>
      <div class="head-actions">${teams.length > 1 ? `<select class="kit-sel" aria-label="Catégorie">${teams.map(x => `<option value="${esc(x.id)}" ${x.id === t.id ? 'selected' : ''}>${esc(Store.teamLabel(x))}</option>`).join('')}</select>` : ''}
        <button class="btn" data-kit="csv">${I.download}<span>Excel</span></button>${Auth.isAdmin() ? '<button class="btn" data-kit="items">⚙️<span>Liste des articles</span></button>' : ''}</div></header>
      <section class="card"><h2>🧾 Les tailles (pour commander)</h2><div class="kit-sum">${sum('Haut', '👕', 'top')}${sum('Bas', '🩳', 'bottom')}${sum('Pointure', '👟', 'shoe')}
        ${IT.map(i => { const n = ps.filter(p => !(kitOf(p).got || {})[i]).length; return `<div><b>${esc(i)}</b><span>${n ? `${n} à donner` : '✅ tous servis'}</span></div>`; }).join('')}</div>
        ${noSize ? `<p class="muted small">${noSize} joueur${noSize > 1 ? 's' : ''} sans taille notée.</p>` : ''}</section>
      <section class="card"><div class="row-head"><h2>👥 Les joueurs</h2><div class="chips"><button class="chip ${only === 'all' ? 'on' : ''}" data-kitonly="all">Tous</button><button class="chip ${only === 'missing' ? 'on' : ''}" data-kitonly="missing">Il leur manque quelque chose</button></div></div>
        <p class="muted small">Touche un article pour le cocher (donné aujourd'hui), ou le nom pour les tailles et le numéro.</p>
        ${list.length ? list.map(p => { const k = kitOf(p); return `<div class="kit-row"><button class="linkish kit-name" data-kitp="${esc(p.id)}"><b>${p.number ? esc(p.number) + '. ' : ''}${esc(Store.fullName(p))}</b>
          <small>${[k.top && '👕 ' + k.top, k.bottom && '🩳 ' + k.bottom, k.shoe && '👟 ' + k.shoe].filter(Boolean).map(esc).join(' · ') || 'Tailles à noter'}${k.note ? ' · 📝 ' + esc(k.note) : ''}</small></button>
          <div class="kit-chips">${IT.map(i => `<button class="chip ${(k.got || {})[i] ? 'on' : ''}" data-kitgot="${esc(p.id)}" data-it="${esc(i)}" title="${(k.got || {})[i] ? 'Donné le ' + esc(fd(k.got[i])) : 'Pas encore donné'}">${esc(i)}</button>`).join('')}</div></div>`; }).join('')
        : `<p class="muted">${only === 'missing' ? '✅ Tout le monde a tout.' : 'Pas de joueur dans cette catégorie.'}</p>`}</section>`;
    const redraw = () => page(root, t.id);
    const sel = root.querySelector('.kit-sel'); if (sel) sel.onchange = () => { location.hash = '#/equipements/' + sel.value; };
    root.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.kitonly) { only = b.dataset.kitonly; return redraw(); }
      if (b.dataset.kitp) { const p = Store.get('players', b.dataset.kitp); if (p) edit(p, redraw); return; }
      if (b.dataset.kitgot) { const p = Store.get('players', b.dataset.kitgot); if (!p) return; const k = p.kit = Object.assign({}, p.kit), got = k.got = Object.assign({}, k.got), i = b.dataset.it;
        if (got[i]) delete got[i]; else got[i] = UI.today(); if (!Object.keys(got).length) delete k.got; Store.upsert('players', p); return redraw(); }
      if (b.dataset.kit === 'csv') return csv(t, ps);
      if (b.dataset.kit === 'items') return modal({ title: '⚙️ Articles donnés par le club', body: `<label class="fld"><span>Un article par ligne</span><textarea id="kItems" rows="7">${esc(IT.join('\n'))}</textarea></label>`,
        actions: [{ label: 'Annuler' }, { label: 'Enregistrer', kind: 'primary', onClick: (c, r) => { const l = [...new Set(r.querySelector('#kItems').value.split('\n').map(x => x.trim().slice(0, 30)).filter(Boolean))].slice(0, 12);
          S().club.kitItems = l.length ? l : ITEMS0; Store.save(); toast('Liste enregistrée'); redraw(); } }] });
    };
  }
  return { page, items, kitOf };
})();
