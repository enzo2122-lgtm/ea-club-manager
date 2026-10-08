/* Urgent (2.42): the emergency sheet of a player — allergies, treatments and where they are, what to do (PAI), devices, things to know,
   people to call. Filled by the family (players' and parents' pages, « Moi ») or by a coach; seen by the coaches of the player only.
   Used in the coach app (player's page, « 🚑 Urgences » of a team) and on the family pages (no UI module there: its own little helpers). */
const Urgent = (() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const FIELDS = [
    ['allergies', '🥜', 'Allergies', 'aliments, médicaments, piqûres… et la réaction'],
    ['treat', '💊', 'Traitements', 'quoi, quand, et où ils sont (sac, trousse du coach…)'],
    ['pai', '📋', 'Conduite à tenir (PAI)', 'ce qu\'il faut faire en cas de crise'],
    ['know', 'ℹ️', 'À savoir', 'asthme, diabète, épilepsie, problème cardiaque, opération récente…'],
    ['devices', '👓', 'Appareillages', 'lunettes, lentilles, appareil dentaire, appareil auditif…']];
  const MAX = 3;
  const tel = s => String(s || '').replace(/[^\d+]/g, '');
  const clean = u => {
    const o = {}; if (!u || typeof u !== 'object') return o;
    FIELDS.forEach(([k]) => { const v = String(u[k] || '').trim().slice(0, 400); if (v) o[k] = v; });
    const cs = (Array.isArray(u.contacts) ? u.contacts : []).map(c => ({ name: String((c || {}).name || '').trim().slice(0, 60), rel: String((c || {}).rel || '').trim().slice(0, 30), phone: String((c || {}).phone || '').trim().slice(0, 25) }))
      .filter(c => c.name || c.phone).slice(0, MAX);
    if (cs.length) o.contacts = cs;
    if (u.at) o.at = u.at; if (u.by) o.by = u.by;
    return o;
  };
  const filled = u => !!u && (FIELDS.some(([k]) => (u[k] || '').trim()) || (u.contacts || []).length > 0);
  // something the coach must know before anything else (red): an allergy, a treatment, a PAI, a medical point
  const alert = u => !!u && ['allergies', 'treat', 'pai', 'know'].some(k => (u[k] || '').trim());
  const when = u => { if (!u || !u.at) return ''; const d = new Date(u.at); return isNaN(d) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); };

  // the sheet, to read (call buttons on the people)
  function view(u, o = {}) {
    if (!filled(u)) return `<p class="urg-none">${esc(o.empty || 'Pas encore remplie.')}</p>`;
    return `<div class="urg-view">${FIELDS.filter(([k]) => (u[k] || '').trim()).map(([k, ic, l]) =>
      `<div class="urg-f ${['allergies', 'treat', 'pai', 'know'].includes(k) ? 'hot' : ''}"><span>${ic} ${esc(l)}</span><p>${esc(u[k]).replace(/\n/g, '<br>')}</p></div>`).join('')}
      ${(u.contacts || []).length ? `<div class="urg-cs"><span>📞 À appeler</span>${u.contacts.map(c => `<a class="urg-c" href="tel:${esc(tel(c.phone))}"><b>${esc(c.name || c.phone)}</b>${c.rel ? ` <i>${esc(c.rel)}</i>` : ''}${c.phone ? `<em>${esc(c.phone)}</em>` : ''}</a>`).join('')}</div>` : ''}
      ${u.at ? `<p class="urg-at">Mise à jour le ${esc(when(u))}${u.by ? ' · ' + esc(u.by === 'coach' ? 'par un coach' : 'par la famille') : ''}</p>` : ''}</div>`;
  }
  // the form (the same for the family and the coach)
  function form(u) {
    u = clean(u); const cs = (u.contacts || []).slice(); while (cs.length < MAX) cs.push({});
    return `<div class="urg-form">${FIELDS.map(([k, ic, l, ph]) => `<label class="urg-l"><span>${ic} ${esc(l)}</span><textarea data-urg="${k}" rows="2" maxlength="400" placeholder="${esc(ph)}">${esc(u[k] || '')}</textarea></label>`).join('')}
      <div class="urg-l"><span>📞 Personnes à appeler en urgence</span>${cs.map((c, i) => `<div class="urg-crow">
        <input data-urgc="${i}:name" placeholder="Nom" value="${esc(c.name || '')}" maxlength="60" autocomplete="off">
        <input data-urgc="${i}:rel" placeholder="Lien (mère, oncle…)" value="${esc(c.rel || '')}" maxlength="30" autocomplete="off">
        <input data-urgc="${i}:phone" placeholder="Téléphone" value="${esc(c.phone || '')}" maxlength="25" type="tel" inputmode="tel" autocomplete="off"></div>`).join('')}</div></div>`;
  }
  function read(root, by) {
    const u = {}; root.querySelectorAll('[data-urg]').forEach(t => { u[t.dataset.urg] = t.value; });
    const cs = []; root.querySelectorAll('[data-urgc]').forEach(t => { const [i, k] = t.dataset.urgc.split(':'); (cs[+i] = cs[+i] || {})[k] = t.value; });
    u.contacts = cs.filter(Boolean); u.at = new Date().toISOString(); if (by) u.by = by;
    return clean(u);
  }

  const CSS = '.urg-card{border-left:4px solid #94a3b8}.urg-card.hot{border-left-color:#dc2626;background:linear-gradient(0deg,rgba(220,38,38,.04),rgba(220,38,38,.04)),var(--surface,#fff)}'
    + '.urg-card h2,.urg-card h3{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.urg-badge{font-size:11px;font-weight:800;color:#fff;background:#dc2626;border-radius:999px;padding:2px 8px}'
    + '.urg-none{color:#6b7280;margin:6px 0}.urg-view{display:flex;flex-direction:column;gap:8px;margin-top:6px}'
    + '.urg-f span,.urg-cs>span{display:block;font-size:12px;font-weight:800;color:#6b7280;text-transform:uppercase;letter-spacing:.02em}.urg-f p{margin:2px 0 0;font-weight:600}.urg-f.hot p{color:#b91c1c}'
    + '.urg-cs{display:flex;flex-direction:column;gap:6px}.urg-c{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:9px 12px;border-radius:12px;background:#dcfce7;color:#14532d;text-decoration:none}'
    + '.urg-c::before{content:"📞"}.urg-c i{font-style:normal;opacity:.75}.urg-c em{font-style:normal;margin-left:auto;font-weight:700}.urg-at{font-size:12px;color:#6b7280;margin:2px 0 0}'
    + '.urg-form{display:flex;flex-direction:column;gap:10px}.urg-l{display:flex;flex-direction:column;gap:4px}.urg-l>span{font-size:13px;font-weight:800}'
    + '.urg-l textarea,.urg-l input{width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:10px;padding:8px 10px;font:inherit;font-size:16px;background:#fff;color:#111}'
    + '.urg-crow{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:6px 0;border-bottom:1px dashed #e5e7eb}.urg-crow input[data-urgc$=":phone"]{grid-column:1/-1}'
    + '.urg-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.urg-team .urg-p{padding:12px 0;border-top:1px solid var(--line,#e5e7eb)}.urg-team .urg-p:first-of-type{border-top:0}'
    + '.urg-team .urg-p h3{margin:0 0 4px;font-size:16px}.urg-missing{font-size:13px;color:#6b7280}';
  function css() { if (document.getElementById('urgCss')) return; const s = document.createElement('style'); s.id = 'urgCss'; s.textContent = CSS; document.head.appendChild(s); }

  /* ---------- the family: « 🚑 Fiche urgence » in « Moi » (o: load, save, toast, who) ---------- */
  // the page of the family is drawn again now and then: what was loaded and what is being typed are kept here
  let memo = { key: null, u: null, at: 0, editing: false, draft: null, busy: false };
  function mount(el, o) {
    if (!el) return; css();
    const key = o.key || 'x';
    if (memo.key !== key) memo = { key, u: null, at: 0, editing: false, draft: null, busy: false };
    const draw = () => {
      const u = memo.u;
      el.innerHTML = `<div class="card urg-card ${alert(u) ? 'hot' : ''}"><h3>🚑 Fiche urgence${alert(u) ? '<span class="urg-badge">À connaître</span>' : ''}</h3>
        <p class="info">${esc(o.intro || 'Ce que les coachs doivent savoir et qui appeler s\'il arrive quelque chose. Seuls les coachs la voient.')}</p>
        ${u == null ? '<p class="urg-none">Chargement…</p>' : memo.editing ? `${form(memo.draft || u)}<div class="urg-acts"><button class="b yes on" data-urgsave>Enregistrer</button><button class="b" data-urgno>Annuler</button></div>`
          : `${view(u, { empty: 'Pas encore remplie : prends 2 minutes, c\'est important en déplacement.' })}<div class="urg-acts"><button class="b yes on" data-urgedit>${filled(u) ? '✏️ Modifier' : '✍️ Remplir la fiche'}</button></div>`}</div>`;
    };
    el.oninput = () => { if (memo.editing) memo.draft = read(el); };
    el.onclick = async e => {
      if (e.target.closest('[data-urgedit]')) { memo.editing = true; memo.draft = null; draw(); const t = el.querySelector('textarea'); if (t) t.focus({ preventScroll: true }); return; }
      if (e.target.closest('[data-urgno]')) { memo.editing = false; memo.draft = null; draw(); return; }
      if (e.target.closest('[data-urgsave]') && !memo.busy) {
        memo.busy = true; const d = read(el, 'famille');
        try { memo.u = clean(await o.save(d)); memo.at = Date.now(); memo.editing = false; memo.draft = null; draw(); (o.toast || (() => {}))('Fiche urgence enregistrée ✓'); }
        catch (err) { (o.toast || alert)((err && err.message) || 'Pas enregistrée, réessaie.', true); }
        memo.busy = false;
      }
    };
    draw();
    if (memo.u == null || (!memo.editing && Date.now() - memo.at > 60000))
      Promise.resolve().then(() => o.load()).then(r => { if (memo.key !== key) return; if (!memo.editing) { memo.u = clean(r); memo.at = Date.now(); } if (document.body.contains(el)) draw(); })
        .catch(() => { if (memo.u == null) { memo.u = {}; if (document.body.contains(el)) draw(); } });
  }

  /* ---------- the coach: the card on the player's page, the modal to fill it, the list of a team ---------- */
  function card(p) {
    css(); const u = p.urgent;
    return `<section class="card urg-card ${alert(u) ? 'hot' : ''}"><h2>🚑 Fiche urgence${alert(u) ? '<span class="urg-badge">À connaître</span>' : ''}</h2>
      ${view(u, { empty: 'Pas encore remplie. La famille peut la remplir dans son espace (onglet « Moi »), ou toi ici.' })}
      <div class="urg-acts"><button class="btn small" data-urgcoach>${filled(u) ? '✏️ Modifier' : '✍️ Remplir'}</button>${(p.teamIds || [])[0] ? `<a class="btn small" href="#/urgences/${esc(p.teamIds[0])}">🚑 Urgences de l'équipe</a>` : ''}</div></section>`;
  }
  function click(e, p, redraw) {
    if (!e.target.closest('[data-urgcoach]')) return false;
    UI.modal({ title: `🚑 Fiche urgence · ${Store.fullName(p)}`, noFocus: true, body: form(p.urgent),
      actions: [{ label: 'Annuler' }, { label: 'Enregistrer', kind: 'primary', onClick: (close, root) => {
        const u = read(root, 'coach'); if (filled(u)) p.urgent = u; else delete p.urgent;
        Store.upsert('players', p); UI.toast('Fiche urgence enregistrée ✓'); setTimeout(redraw, 0); } }] });
    return true;
  }
  // #/urgences/teamId: the whole team on one screen (before a trip, at the stadium): what to know first, then who to call
  function page(root, teamId) {
    css();
    const teams = Auth.teams() || [], cur = teamId || (Store.state.ui || {}).teamId, t = (cur && Auth.sees(cur) && Store.get('teams', cur)) || teams.find(x => (Store.state.players || []).some(p => (p.teamIds || []).includes(x.id))) || teams[0];
    if (!t) { root.innerHTML = '<p class="muted">Aucune équipe.</p>'; return; }
    const ps = (Store.state.players || []).filter(p => (p.teamIds || []).includes(t.id))
      .sort((a, b) => (alert(b.urgent) - alert(a.urgent)) || Store.fullName(a).localeCompare(Store.fullName(b), 'fr'));
    const hot = ps.filter(p => alert(p.urgent)), ok = ps.filter(p => filled(p.urgent) && !alert(p.urgent)), none = ps.filter(p => !filled(p.urgent));
    const phones = p => (p.urgent && p.urgent.contacts && p.urgent.contacts.length ? p.urgent.contacts : (p.parents || []).filter(x => x.phone).map(x => ({ name: x.name || x.rel || 'Parent', rel: x.rel, phone: x.phone })));
    const one = p => `<div class="urg-p"><h3><a href="#/joueur/${esc(p.id)}">${esc(Store.fullName(p))}</a>${alert(p.urgent) ? ' <span class="urg-badge">À connaître</span>' : ''}</h3>
      ${filled(p.urgent) ? view(Object.assign({}, p.urgent, { contacts: phones(p) })) : view({ contacts: phones(p) }, { empty: 'Fiche pas remplie, pas de téléphone.' })}</div>`;
    root.innerHTML = `<header class="page-head"><div><h1>🚑 Urgences · ${esc(t.name || '')}</h1><p class="sub">${hot.length} à connaître · ${ok.length + hot.length}/${ps.length} fiches remplies</p></div>
      <div class="head-actions"><button class="btn" data-act="back">${I.back}<span>Retour</span></button>${teams.length > 1 ? `<select class="urg-sel" aria-label="Équipe">${teams.map(x => `<option value="${esc(x.id)}" ${x.id === t.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>` : ''}</div></header>
      <p class="muted small">🔒 Seulement pour les coachs. Les familles remplissent la fiche dans leur espace, onglet « Moi ».</p>
      ${hot.length ? `<section class="card urg-card hot urg-team"><h2>⚠️ À connaître (${hot.length})</h2>${hot.map(one).join('')}</section>` : ''}
      ${ok.length ? `<section class="card urg-card urg-team"><h2>✅ Fiche remplie, rien de particulier (${ok.length})</h2>${ok.map(one).join('')}</section>` : ''}
      ${none.length ? `<section class="card urg-card urg-team"><h2>📝 Pas encore remplie (${none.length})</h2><p class="urg-missing">${none.map(p => esc(Store.fullName(p))).join(' · ')}</p>
        <p class="muted small">Le téléphone des parents de la fiche joueur est montré en attendant. Pense à leur demander de la remplir (espace famille → « Moi »).</p>${none.filter(p => phones(p).length).map(one).join('')}</section>` : ''}`;
    root.onclick = e => { const b = e.target.closest('[data-act="back"]'); if (b) return history.length > 1 ? history.back() : (location.hash = '#/joueurs'); };
    const sel = root.querySelector('.urg-sel'); if (sel) sel.onchange = () => { location.hash = '#/urgences/' + sel.value; };
  }

  return { FIELDS, clean, filled, alert, view, form, read, mount, card, click, page };
})();
