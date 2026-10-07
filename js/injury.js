/* (1.81) A player or his parents report an injury (players' and parents' pages): the zone on the body, what it is likely to be,
   the kind and the time to recover. It goes on his file in the coach's Infirmerie, and the coaches get a notification.
   « Je suis rétabli » ends it. The club server: member_injury (list / add / back). */
const Injury = (() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = d => d ? new Date(d + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : '';
  const today = () => new Date().toISOString().slice(0, 10);
  function css() {
    if (document.getElementById('injCss')) return;
    const st = document.createElement('style'); st.id = 'injCss';
    st.textContent = '.inj-sheet{max-height:92vh;overflow:auto}.inj-now{display:grid;gap:6px;margin-bottom:10px;padding:10px;border-radius:12px;background:#fde8ec;color:#7f1d1d}.inj-now .b{justify-self:start}@media (prefers-color-scheme: dark){.inj-now{background:#3b1220;color:#fecaca}}';
    document.head.appendChild(st);
  }
  let list = null; // null: the club server has not answered (or is not updated)
  async function load(code) { try { const r = await Member.rpc('member_injury', { p_code: code, p_action: 'list' }); list = Array.isArray(r) ? r : []; } catch (e) { list = null; } return list; }
  const current = () => (list || []).filter(u => u.kind === 'injury' && u.from <= today() && (!u.to || u.to > today()));
  const line = u => `${esc(u.part || 'Blessure')}${u.side && BodyMap.SIDE[u.side] ? ' ' + BodyMap.SIDE[u.side] : ''}${u.type ? ' · ' + esc(u.type) : ''}`;
  // the card: his injury now (with « Je suis rétabli »), or the button to report one
  function card(who) {
    if (list === null) return ''; css();
    const cur = current();
    return `<h2>🚑 Blessure</h2><div class="card inj-card">${cur.length ? cur.map(u => `<div class="inj-now"><b>🚑 ${line(u)}</b><span class="info">depuis le ${esc(fmt(u.from))}${u.to ? ` · retour prévu le ${esc(fmt(u.to))}` : ' · retour à confirmer'}</span>
        <button class="b yes on" data-injback="${esc(u.id)}">💪 ${who ? esc(who) + ' est rétabli' : 'Je suis rétabli'}</button></div>`).join('')
      : `<p class="info">${who ? esc(who) + ' s\'est blessé' : 'Tu t\'es blessé'} ? Montre où sur le corps : le coach est prévenu tout de suite.</p>`}
      <button class="b ${cur.length ? '' : 'no on'}" data-injnew>🚑 Signaler une blessure</button></div>`;
  }
  // the sheet over the page
  function open(code, parent, who, done) {
    const sel = { zone: '', side: '', part: '', type: '', days: null }; let note = '';
    Member.sheetCss(); css(); const o = document.createElement('div'); o.className = 'rs-back';
    const draw = () => {
      o.innerHTML = `<div class="rs-sheet inj-sheet" role="dialog" aria-label="Signaler une blessure"><h3>🚑 ${who ? 'Blessure de ' + esc(who) : 'Signaler une blessure'}</h3>
        ${BodyMap.html(sel)}
        ${sel.part ? `<input class="rs-note" maxlength="140" placeholder="Une précision (comment, quand, soins, kiné…)" value="${esc(note)}" data-injnote>` : ''}
        <div class="btns"><button class="b" type="button" data-x>Annuler</button><button class="b no on" type="button" data-ok ${sel.part && sel.days != null ? '' : 'disabled'}>Envoyer au coach</button></div></div>`;
    };
    draw(); document.body.appendChild(o);
    o.addEventListener('input', e => { if (e.target.dataset.injnote != null) note = e.target.value; });
    o.addEventListener('click', async e => {
      e.stopPropagation();
      if (e.target === o || e.target.closest('[data-x]')) return o.remove();
      if (BodyMap.click(e, sel)) { const sc = o.querySelector('.rs-sheet').scrollTop; draw(); o.querySelector('.rs-sheet').scrollTop = sc; return; }
      const ok = e.target.closest('[data-ok]'); if (!ok || ok.disabled) return;
      ok.disabled = true; ok.textContent = 'Envoi…';
      try {
        const r = await Member.rpc('member_injury', { p_code: code, p_action: 'add', p_parent: !!parent, p_data: { part: sel.part, zone: sel.zone, side: sel.side, type: sel.type, days: sel.days || 0, note } });
        list = Array.isArray(r) ? r : list; o.remove(); done && done('Le coach est prévenu. Soigne-toi bien 🙏');
      } catch (x) { ok.disabled = false; ok.textContent = 'Envoyer au coach'; alert(x.message); }
    });
  }
  // the clicks of the card (true when handled)
  function onClick(e, code, parent, who, done) {
    if (e.target.closest('[data-injnew]')) { open(code, parent, who, done); return true; }
    const b = e.target.closest('[data-injback]'); if (!b) return false;
    if (confirm(`${who ? who + ' est' : 'Tu es'} rétabli et peut rejouer ?`)) back(b.dataset.injback, code, parent, done);
    return true;
  }
  async function back(id, code, parent, done) {
    try { const r = await Member.rpc('member_injury', { p_code: code, p_action: 'back', p_parent: !!parent, p_data: { id } }); list = Array.isArray(r) ? r : list; done && done('Super, bon retour sur le terrain 💪'); }
    catch (x) { alert(x.message); }
  }
  return { load, card, open, onClick, current };
})();
