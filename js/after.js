/* After (2.51): after a session or a match, the player answers himself on his page (or his parents for him):
   the effort he felt (RPE 1 to 10), « tu as aimé ? », and after a match where he played (3 h after the kick-off): his mark from 0 to 10,
   his match and the team in one word, his vote for the star of the match. Once sent, it does not change.
   o: key, load(), save(d), toast, who ('toi' | a first name) */
const After = (() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const RPE = ['', 'Très facile', 'Facile', 'Modéré', 'Un peu dur', 'Dur', 'Dur +', 'Très dur', 'Très dur +', 'Épuisant', 'Maximal'];
  const FUN = [['', ''], ['😕', 'Bof'], ['🙂', 'Bien'], ['😃', 'Génial']];
  const WORD = v => v >= 9 ? 'Exceptionnel' : v >= 8 ? 'Très bon' : v >= 7 ? 'Bon' : v >= 6 ? 'Correct' : v >= 5 ? 'Moyen' : v >= 4 ? 'Difficile' : 'Compliqué';
  const fd = d => new Date(d + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
  const col = n => `hsl(${Math.round(130 - (n - 1) * 13)},70%,${n > 6 ? 45 : 40}%)`;
  const CSS = '.af-card h3{margin:0 0 2px}.af-q{margin:12px 0 6px;font-weight:800;font-size:14px}.af-rpe{display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:4px}'
    + '.af-rpe button{border:0;border-radius:8px;padding:9px 0;font:800 15px/1 system-ui;color:#fff;opacity:.45;background:var(--c)}.af-rpe button.on{opacity:1;outline:3px solid #14172b;outline-offset:1px}'
    + '.af-lbl{font-size:13px;opacity:.85;margin-top:4px;min-height:17px}.af-fun{display:flex;gap:8px}.af-fun button{flex:1;font-size:15px;padding:8px;border-radius:12px;border:1px solid #d6d0cb;background:#fff;color:#14172b}'
    + '.af-fun button.on{outline:3px solid #be123c;background:#fde8ec}.af-note{display:flex;align-items:center;gap:10px}.af-note input[type=range]{flex:1;accent-color:#be123c}.af-note b{font-size:22px;min-width:52px;text-align:right}'
    + '.af-in{width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:9px 10px;border-radius:10px;border:1px solid #d6d0cb;background:#fff;color:#14172b}.af-2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}'
    + '.af-done{padding:10px 12px;border-radius:12px;background:#ecfdf5;color:#065f46;margin-top:8px;font-size:14px}.af-wait{font-size:13px;opacity:.8;margin-top:8px}.af-ev+.af-ev{border-top:1px dashed rgba(127,127,127,.35);margin-top:14px;padding-top:12px}'
    + '@media (prefers-color-scheme: dark){.af-fun button,.af-in{background:#18223f;color:#eceef6;border-color:#263156}.af-done{background:#0f2e25;color:#a7f3d0}.af-rpe button.on{outline-color:#fff}}';
  function css() { if (document.getElementById('afCss')) return; const s = document.createElement('style'); s.id = 'afCss'; s.textContent = CSS; document.head.appendChild(s); }

  let memo = { key: null, list: null, at: 0, f: {} };
  function mount(el, o) {
    if (!el) return; css();
    if (memo.key !== o.key) memo = { key: o.key, list: null, at: 0, f: {} };
    const you = o.who && o.who !== 'toi' ? o.who : null;
    const draw = () => {
      const list = (memo.list || []).filter(e => e.rpe == null || e.fun == null || (e.kind === 'match' && e.self == null));
      if (!list.length) { el.innerHTML = ''; return; }
      el.innerHTML = `<div class="card af-card"><h3>💪 Après l'effort</h3><p class="info">${you ? `Comment ça s'est passé pour ${esc(you)} ? Réponds avec lui : ` : 'Dis au coach comment ça s\'est passé : '}ça l'aide à doser les séances.</p>
        ${list.map(e => { const f = memo.f[e.id] || (memo.f[e.id] = { v: 6 }), needSelf = e.kind === 'match' && e.self == null;
          return `<div class="af-ev" data-afev="${esc(e.id)}"><b>${e.kind === 'match' ? '⚽' : '🏃'} ${esc(e.title)}</b> · <span class="muted">${esc(fd(e.date))}</span>
          ${e.rpe == null ? `<div class="af-q">L'effort : c'était dur ?</div><div class="af-rpe">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<button style="--c:${col(n)}" class="${f.rpe === n ? 'on' : ''}" data-afrpe="${n}" aria-label="${n} : ${RPE[n]}">${n}</button>`).join('')}</div><div class="af-lbl">${f.rpe ? esc(RPE[f.rpe]) : '1 = très facile · 10 = maximal'}</div>` : ''}
          ${e.fun == null ? `<div class="af-q">Tu as aimé ?</div><div class="af-fun">${[1, 2, 3].map(n => `<button class="${f.fun === n ? 'on' : ''}" data-affun="${n}">${FUN[n][0]} ${FUN[n][1]}</button>`).join('')}</div>` : ''}
          ${needSelf ? e.open ? `<div class="af-q">Ta note de ton match</div><div class="af-note"><input type="range" min="0" max="10" step="0.5" value="${f.v}" data-afv><b>${String(f.v).replace('.', ',')}</b></div><div class="af-lbl">${esc(WORD(f.v))}</div>
            <div class="af-2"><input class="af-in" data-afw="word" maxlength="40" placeholder="Ton match en un mot" value="${esc(f.word || '')}"><input class="af-in" data-afw="team" maxlength="40" placeholder="L'équipe en un mot" value="${esc(f.team || '')}"></div>
            ${(e.mates || []).length ? `<div class="af-q">⭐ Ton étoile du match</div><select class="af-in" data-afw="star"><option value="">Choisir un coéquipier…</option>${e.mates.map(m => `<option value="${esc(m.id)}" ${f.star === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select>` : ''}`
            : '<p class="af-wait">⏳ Ta note de match s\'ouvre 3 h après le coup d\'envoi.</p>' : ''}
          <div class="ab-acts" style="display:flex;justify-content:flex-end;margin-top:10px"><button class="b yes on" data-afsend>Envoyer</button></div></div>`; }).join('')}</div>`;
    };
    const ev = t => { const x = t.closest('[data-afev]'); return x ? x.dataset.afev : null; };
    el.oninput = e => { const id = ev(e.target); if (!id) return; const f = memo.f[id];
      if (e.target.hasAttribute('data-afv')) { f.v = +e.target.value; const b = e.target.parentElement.querySelector('b'); if (b) b.textContent = String(f.v).replace('.', ','); const l = e.target.parentElement.nextElementSibling; if (l) l.textContent = WORD(f.v); }
      else if (e.target.dataset.afw) f[e.target.dataset.afw] = e.target.value; };
    el.onchange = el.oninput;
    el.onclick = async e => {
      const id = ev(e.target); if (!id) return; const f = memo.f[id], it = (memo.list || []).find(x => x.id === id);
      const r = e.target.closest('[data-afrpe]'); if (r) { f.rpe = +r.dataset.afrpe; draw(); return; }
      const g = e.target.closest('[data-affun]'); if (g) { f.fun = +g.dataset.affun; draw(); return; }
      if (!e.target.closest('[data-afsend]') || !it) return;
      const d = { id }; if (it.rpe == null && f.rpe) d.rpe = f.rpe; if (it.fun == null && f.fun) d.fun = f.fun;
      if (it.kind === 'match' && it.self == null && it.open) d.self = { v: f.v, word: f.word || '', team: f.team || '', star: f.star || '' };
      if (!d.rpe && !d.fun && !d.self) { (o.toast || alert)('Touche d\'abord une réponse', true); return; }
      try { const l = await o.save(d); if (Array.isArray(l)) { memo.list = l; memo.at = Date.now(); } delete memo.f[id]; draw(); (o.toast || (() => {}))('💪 Merci, le coach a ta réponse'); }
      catch (err) { (o.toast || alert)(/TROP_TOT/.test(err.message || '') ? 'La note de match s\'ouvre 3 h après le coup d\'envoi.' : (err.message || 'Pas envoyé, réessaie.'), true); }
    };
    draw();
    if (memo.list == null || Date.now() - memo.at > 60000)
      Promise.resolve().then(() => o.load()).then(r => { if (memo.key !== o.key) return; memo.list = Array.isArray(r) ? r : []; memo.at = Date.now(); if (document.body.contains(el)) draw(); }).catch(() => {});
  }
  return { mount };
})();
