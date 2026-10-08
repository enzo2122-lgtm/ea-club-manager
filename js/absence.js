/* Absence (2.50): on the family pages, « Prévenir le coach » — an absence of several days (holidays, exams, ill…) that the coaches
   see as an unavailability, « Finalement je serai là », and « J'ai un souci » for a session or a match coming (late, transport, a pain,
   can't come): a message to the coaches. o: key, load(), add(d), del(id), alert(kind, eventId, note), toast, events (next ones), who */
const Absence = (() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const WHY = [['🏖️', 'Vacances'], ['📚', 'Examens'], ['🤒', 'Malade'], ['👪', 'Raison familiale'], ['🚌', 'Voyage scolaire'], ['✏️', 'Autre']];
  const ALERTS = [['late', '⏰', 'En retard'], ['ride', '🚗', 'Souci de transport'], ['pain', '🤕', 'Une douleur'], ['cant', '🚫', 'Empêché']];
  const day = (d, n = 0) => { const x = new Date(d + 'T12:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
  const fd = d => new Date(d + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const CSS = '.ab-card h3{margin:0 0 4px}.ab-alerts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:10px 0}.ab-alerts .b{justify-content:flex-start}'
    + '.ab-alerts .b.on{outline:3px solid #be123c;background:#fde8ec;color:#14172b}.ab-form{display:flex;flex-direction:column;gap:8px;margin:8px 0 4px;padding:12px;border-radius:14px;background:rgba(127,127,127,.08)}'
    + '.ab-form label{display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:700}.ab-form select,.ab-form input,.ab-form textarea{font:inherit;font-size:16px;padding:9px 10px;border-radius:10px;border:1px solid #d6d0cb;background:#fff;color:#14172b;width:100%;box-sizing:border-box}'
    + '.ab-dates{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}.ab-dates label{min-width:0}.ab-dates input{min-width:0;max-width:100%;-webkit-appearance:none;appearance:none;min-height:42px}.ab-why{display:flex;flex-wrap:wrap;gap:6px}.ab-why .b{padding:6px 10px;font-size:14px}.ab-why .b.on{outline:3px solid #be123c;background:#fde8ec;color:#14172b}'
    + '.ab-list{display:flex;flex-direction:column;gap:6px;margin-top:8px}.ab-item{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:9px 12px;border-radius:12px;background:#eef2ff;color:#1e1b4b}'
    + '.ab-item span{flex:1;min-width:150px}.ab-item small{display:block;opacity:.75}.ab-acts{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}'
    + '@media (prefers-color-scheme: dark){.ab-form select,.ab-form input,.ab-form textarea{background:#18223f;color:#eceef6;border-color:#263156}.ab-item{background:#1e2547;color:#e0e7ff}}';
  function css() { if (document.getElementById('abCss')) return; const s = document.createElement('style'); s.id = 'abCss'; s.textContent = CSS; document.head.appendChild(s); }

  let memo = { key: null, list: null, at: 0, open: null, f: {} };
  function mount(el, o) {
    if (!el) return; css();
    if (memo.key !== o.key) memo = { key: o.key, list: null, at: 0, open: null, f: {} };
    const evs = (o.events || []).filter(e => e && e.date >= today() && e.date <= day(today(), 3)).slice(0, 6);
    const draw = () => {
      const f = memo.f, list = memo.list || [];
      el.innerHTML = `<div class="card ab-card"><h3>📣 Prévenir le coach</h3>
        <p class="info">Un souci pour la prochaine séance ou le prochain match, ou absent plusieurs jours : le coach est prévenu tout de suite.</p>
        <div class="ab-alerts">${ALERTS.map(([k, ic, l]) => `<button class="b ${memo.open === k ? 'on' : ''}" data-abal="${k}">${ic} ${l}</button>`).join('')}</div>
        ${ALERTS.some(a => a[0] === memo.open) ? `<div class="ab-form">
          ${evs.length ? `<label>Pour<select data-abf="ev">${evs.map(e => `<option value="${esc(e.id)}" ${f.ev === e.id ? 'selected' : ''}>${esc(fd(e.date))}${e.time ? ' · ' + esc(String(e.time).replace(':', 'h')) : ''} · ${esc(e.label)}</option>`).join('')}<option value="" ${f.ev === '' ? 'selected' : ''}>Autre / pas de date</option></select></label>` : ''}
          <label>Un mot pour le coach (facultatif)<textarea data-abf="note" rows="2" maxlength="200" placeholder="${memo.open === 'late' ? 'Ex. : j\'arrive vers 18h20' : memo.open === 'ride' ? 'Ex. : personne pour l\'emmener, quelqu\'un peut le prendre ?' : memo.open === 'pain' ? 'Ex. : mal au genou depuis samedi' : 'Ex. : rendez-vous médical'}">${esc(f.note || '')}</textarea></label>
          ${memo.open === 'pain' ? '<p class="tip">Une vraie blessure ? Signale-la aussi avec « 🚑 Blessure » : le coach suit son évolution.</p>' : ''}
          <div class="ab-acts"><button class="b" data-abclose>Annuler</button><button class="b yes on" data-absend>Envoyer au coach</button></div></div>` : ''}
        <div class="ab-acts" style="justify-content:flex-start"><button class="b ${memo.open === 'away' ? 'on' : ''}" data-abal="away">✈️ Absent plusieurs jours</button></div>
        ${memo.open === 'away' ? `<div class="ab-form">
          <div class="ab-dates"><label>Du<input type="date" data-abf="from" value="${esc(f.from || today())}" min="${today()}"></label><label>Au (inclus)<input type="date" data-abf="to" value="${esc(f.to || f.from || today())}" min="${esc(f.from || today())}"></label></div>
          <div class="ab-why">${WHY.map(([ic, l]) => `<button class="b ${f.reason === l ? 'on' : ''}" data-abwhy="${l}">${ic} ${l}</button>`).join('')}</div>
          <label>Un mot (facultatif)<input data-abf="note" maxlength="140" value="${esc(f.note || '')}" placeholder="Ex. : retour le lundi soir"></label>
          <div class="ab-acts"><button class="b" data-abclose>Annuler</button><button class="b yes on" data-abadd ${f.reason ? '' : 'disabled'}>Déclarer l'absence</button></div></div>` : ''}
        ${list.length ? `<div class="ab-list">${list.map(a => `<div class="ab-item"><span>${a.kind === 'ill' ? '🤒' : a.kind === 'susp' ? '🟥' : '✈️'} <b>${esc(a.reason || (a.kind === 'susp' ? 'Suspendu' : 'Absent'))}</b> · du ${esc(fd(a.from))}${a.to ? ' au ' + esc(fd(day(a.to, -1))) : ''}${a.note ? `<small>${esc(a.note)}</small>` : ''}${a.self ? '' : '<small>noté par le coach</small>'}</span>
          ${a.self ? `<button class="b small" data-abdel="${esc(a.id)}">${a.from > today() ? '✅ Finalement je serai là' : '✅ De retour'}</button>` : ''}</div>`).join('')}</div>` : ''}</div>`;
    };
    const busy = async (fn, ok) => { try { const r = await fn(); if (Array.isArray(r)) { memo.list = r; memo.at = Date.now(); } memo.open = null; memo.f = {}; draw(); (o.toast || (() => {}))(ok); } catch (e) { (o.toast || alert)(/LIMITE/.test(e.message || '') ? 'Trop d\'envois : réessaie plus tard.' : (e.message || 'Pas envoyé, réessaie.'), true); } };
    el.oninput = el.onchange = e => { const k = e.target.dataset.abf; if (!k) return; memo.f[k] = e.target.value; if (k === 'from' && (!memo.f.to || memo.f.to < memo.f.from)) { memo.f.to = memo.f.from; draw(); } };
    el.onclick = e => {
      const a = e.target.closest('[data-abal]'); if (a) { const k = a.dataset.abal; memo.open = memo.open === k ? null : k; memo.f = k === 'away' ? { from: today(), to: today() } : { ev: evs[0] ? evs[0].id : '' }; draw(); return; }
      if (e.target.closest('[data-abclose]')) { memo.open = null; memo.f = {}; draw(); return; }
      const w = e.target.closest('[data-abwhy]'); if (w) { memo.f.reason = w.dataset.abwhy; draw(); return; }
      if (e.target.closest('[data-absend]')) { const k = memo.open, f = memo.f; return busy(() => o.alert(k, f.ev || null, f.note || ''), '📣 Le coach est prévenu'); }
      if (e.target.closest('[data-abadd]')) { const f = memo.f; if (!f.reason) return; return busy(() => o.add({ from: f.from || today(), to: f.to || f.from || today(), reason: f.reason, note: f.note || '' }), '✈️ Absence déclarée, le coach est prévenu'); }
      const d = e.target.closest('[data-abdel]'); if (d) return busy(() => o.del(d.dataset.abdel), '✅ C\'est noté, le coach est prévenu');
    };
    draw();
    if (memo.list == null || Date.now() - memo.at > 60000)
      Promise.resolve().then(() => o.load()).then(r => { if (memo.key !== o.key) return; memo.list = Array.isArray(r) ? r : []; memo.at = Date.now(); if (document.body.contains(el)) draw(); }).catch(() => {});
  }
  return { mount };
})();
