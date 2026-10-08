/* Talks (2.62): on the family pages, the individual talks the coach shared (strengths, what to work on, goals, feelings),
   and the player's answer (one per talk, he can change it). o: key, load(), reply(id, text), toast, who */
const Talks = (() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TF = [['strong', '💪 Points forts'], ['work', '🎯 À travailler'], ['goals', '🏁 Objectifs'], ['feel', '💬 Ce que tu as dit']];
  const fd = d => new Date(d + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  let memo = { key: null, list: null, at: 0, open: null };
  function mount(el, o) {
    if (!el) return;
    if (memo.key !== o.key) memo = { key: o.key, list: null, at: 0, open: null };
    const draw = () => {
      const l = memo.list || []; if (!l.length) { el.innerHTML = ''; return; }
      el.innerHTML = `<h2>🗣️ ${o.who ? 'Les entretiens de ' + esc(o.who) : 'Mes entretiens'} avec le coach</h2>${l.map(t => `<div class="card tk-card"><b>${esc(fd(t.date))}</b>
        ${TF.filter(([k]) => t[k]).map(([k, lb]) => `<p><b>${lb}</b><br>${esc(t[k]).replace(/\n/g, '<br>')}</p>`).join('')}
        ${memo.open === t.id ? `<textarea class="tk-in" id="tkText" rows="3" maxlength="600" placeholder="Ta réponse au coach">${esc(t.reply || '')}</textarea><div style="display:flex;gap:8px;justify-content:flex-end"><button class="b" data-tkno>Annuler</button><button class="b yes on" data-tksend="${esc(t.id)}">Envoyer</button></div>`
          : `${t.reply ? `<p class="tk-rep"><b>💬 Ta réponse</b><br>${esc(t.reply)}</p>` : ''}<button class="b small" data-tkopen="${esc(t.id)}">${t.reply ? '✏️ Modifier ma réponse' : '💬 Répondre au coach'}</button>`}</div>`).join('')}`;
    };
    el.onclick = async e => {
      const op = e.target.closest('[data-tkopen]'); if (op) { memo.open = op.dataset.tkopen; draw(); const t = el.querySelector('#tkText'); if (t) t.focus(); return; }
      if (e.target.closest('[data-tkno]')) { memo.open = null; draw(); return; }
      const s = e.target.closest('[data-tksend]'); if (!s) return; const txt = (el.querySelector('#tkText') || {}).value || '';
      if (!txt.trim()) return;
      try { const l = await o.reply(s.dataset.tksend, txt.trim()); if (Array.isArray(l)) memo.list = l; memo.open = null; draw(); (o.toast || (() => {}))('💬 Réponse envoyée au coach'); }
      catch (err) { (o.toast || alert)(err.message || 'Pas envoyé, réessaie.', true); }
    };
    draw();
    if (memo.list == null || Date.now() - memo.at > 60000)
      Promise.resolve().then(() => o.load()).then(r => { if (memo.key !== o.key) return; memo.list = Array.isArray(r) ? r : []; memo.at = Date.now(); if (document.body.contains(el) && !memo.open) draw(); }).catch(() => {});
  }
  if (typeof document !== 'undefined' && !document.getElementById('tkCss')) { const st = document.createElement('style'); st.id = 'tkCss'; st.textContent = '.tk-card p{margin:8px 0}.tk-rep{padding:8px 10px;border-radius:10px;background:#eff6ff;color:#1e3a8a}.tk-in{width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:9px 10px;border-radius:10px;border:1px solid #d6d0cb;margin:8px 0}'; (document.head || document.documentElement).appendChild(st); }
  return { mount };
})();
