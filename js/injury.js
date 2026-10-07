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
    st.textContent = '.inj-sheet{max-height:92vh;overflow:auto}.inj-now{display:grid;gap:6px;margin-bottom:10px;padding:10px;border-radius:12px;background:#fde8ec;color:#7f1d1d}.inj-now .b{justify-self:start}.inj-kept{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:4px 0 6px}.inj-chip{display:inline-flex;align-items:center;gap:4px;padding:6px 10px;border-radius:999px;background:#fde8ec;color:#7f1d1d;font-size:14px}.inj-chip button{border:0;background:none;color:inherit;font-size:14px;cursor:pointer;padding:0 2px}@media (prefers-color-scheme: dark){.inj-now{background:#3b1220;color:#fecaca}}';
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
  // the sheet over the page; (1.87) several injuries at once: « ＋ Ajouter une autre blessure » keeps the current one in a list
  const NEW = () => ({ zone: '', side: '', part: '', type: '', days: null, note: '' });
  const ready = s => s.part && s.days != null;
  const label = s => `${s.part}${s.side && BodyMap.SIDE[s.side] ? ' ' + BodyMap.SIDE[s.side] : ''}${s.type ? ' · ' + s.type : ''}`;
  function open(code, parent, who, done) {
    let sel = NEW(); const kept = [];
    Member.sheetCss(); css(); const o = document.createElement('div'); o.className = 'rs-back';
    const draw = () => {
      const n = kept.length + (ready(sel) ? 1 : 0);
      o.innerHTML = `<div class="rs-sheet inj-sheet" role="dialog" aria-label="Signaler une blessure"><h3>🚑 ${who ? 'Blessure de ' + esc(who) : 'Signaler une blessure'}</h3>
        ${kept.length ? `<div class="inj-kept"><b>Déjà ajoutées :</b>${kept.map((k, i) => `<span class="inj-chip">🚑 ${esc(label(k))} <button type="button" data-injrm="${i}" aria-label="Retirer">✕</button></span>`).join('')}</div><p class="bm-lbl">Blessure ${kept.length + 1}</p>` : ''}
        ${BodyMap.html(sel)}
        ${sel.part ? `<input class="rs-note" maxlength="140" placeholder="Une précision (comment, quand, soins, kiné…)" value="${esc(sel.note)}" data-injnote>` : ''}
        ${ready(sel) && kept.length < 4 ? '<p><button class="b" type="button" data-injmore>＋ Ajouter une autre blessure</button></p>' : ''}
        <div class="btns"><button class="b" type="button" data-x>Annuler</button><button class="b no on" type="button" data-ok ${n ? '' : 'disabled'}>Envoyer au coach${n > 1 ? ' (' + n + ' blessures)' : ''}</button></div></div>`;
    };
    draw(); document.body.appendChild(o);
    o.addEventListener('input', e => { if (e.target.dataset.injnote != null) sel.note = e.target.value; });
    o.addEventListener('click', async e => {
      e.stopPropagation();
      if (e.target === o || e.target.closest('[data-x]')) return o.remove();
      const keepScroll = () => { const sc = o.querySelector('.rs-sheet').scrollTop; draw(); o.querySelector('.rs-sheet').scrollTop = sc; };
      if (BodyMap.click(e, sel)) return keepScroll();
      if (e.target.closest('[data-injmore]')) { kept.push(sel); sel = NEW(); draw(); o.querySelector('.rs-sheet').scrollTop = 0; return; }
      const rm = e.target.closest('[data-injrm]'); if (rm) { kept.splice(+rm.dataset.injrm, 1); return keepScroll(); }
      const ok = e.target.closest('[data-ok]'); if (!ok || ok.disabled) return;
      const all = [...kept, ...(ready(sel) ? [sel] : [])]; ok.disabled = true; ok.textContent = 'Envoi…';
      let sent = 0;
      try {
        for (const s of all) {
          const r = await Member.rpc('member_injury', { p_code: code, p_action: 'add', p_parent: !!parent, p_data: { part: s.part, zone: s.zone, side: s.side, type: s.type, days: s.days || 0, note: s.note } });
          list = Array.isArray(r) ? r : list; sent++;
        }
        o.remove(); done && done(all.length > 1 ? `Les ${all.length} blessures sont envoyées. Le coach est prévenu. Soigne-toi bien 🙏` : 'Le coach est prévenu. Soigne-toi bien 🙏');
      } catch (x) {
        kept.length = 0; kept.push(...all.slice(sent)); sel = NEW(); // the ones not sent stay in the list
        draw(); alert((sent ? sent + ' blessure(s) envoyée(s), les autres non : ' : '') + x.message);
      }
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
