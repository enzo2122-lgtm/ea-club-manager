/* Chat (1.96): the chat of a category, between the players of the category (teams A and B together) and their coaches.
   Club server: member_chat* for the players' page (personal code), club_chat* for the coaches' app (they moderate:
   delete any message, close the chat). Vulgar or insulting words are refused by the server in every category but
   Seniors and Vétérans. Used by joueurs.html and by the app (#/chat). */
const Chat = (() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ERR = [[/MOT_INTERDIT/, 'Message non envoyé : un mot grossier ou insultant n\'est pas accepté dans ce chat. Reformule gentiment 🙂'],
    [/TROP_VITE/, 'Doucement : attends quelques secondes entre deux messages.'], [/CHAT_FERME/, 'Le chat est fermé pour l\'instant par les coachs.'],
    [/LIMITE_CHAT/, 'Beaucoup de messages aujourd\'hui : réessaie demain.']];
  const nice = e => { const m = String((e && (e.code || '') + ' ' + (e.raw || '') + ' ' + (e.message || '')) || ''); const x = ERR.find(([r]) => r.test(m)); return x ? x[1] : (e && e.message) || 'Le serveur ne répond pas.'; };
  // one chat open at a time: its box, its options, its messages (kept when the page is redrawn)
  let box = null, o = null, view = null, cat = '', draft = '', timer = null, busy = false, sending = false;
  const POLL = 8000;

  function css() {
    if (document.getElementById('chatCss')) return;
    const st = document.createElement('style'); st.id = 'chatCss';
    st.textContent = '.ch-head{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}.ch-head h3{margin:0;font-size:18px}'
      + '.ch-tag{display:inline-block;font-size:12.5px;font-weight:700;padding:2px 9px;border-radius:999px;background:color-mix(in srgb,#15803d 14%,transparent);color:#15803d}'
      + '.ch-list{display:flex;flex-direction:column;gap:6px;max-height:min(58vh,520px);overflow-y:auto;padding:8px;border-radius:14px;background:var(--bg,#f4f5f8);overscroll-behavior:contain}'
      + '.ch-m{max-width:84%;align-self:flex-start;padding:7px 11px 6px;border-radius:14px 14px 14px 4px;background:var(--surface,#fff);border:1px solid var(--line,#e3e5ea);word-wrap:break-word;overflow-wrap:anywhere}'
      + '.ch-m.mine{align-self:flex-end;border-radius:14px 14px 4px 14px;background:#0e1d45;color:#fff;border-color:#0e1d45}.ch-m.coach:not(.mine){border-left:4px solid #c9a45c}'
      + '.ch-who{display:flex;gap:8px;align-items:baseline;font-size:12px;font-weight:700;opacity:.75;margin-bottom:2px}.ch-who .t{font-weight:500}.ch-m.mine .ch-who{justify-content:flex-end}'
      + '.ch-del{border:0;background:none;color:inherit;opacity:.6;cursor:pointer;font-size:13px;padding:0 2px;margin-left:auto}.ch-m.mine .ch-del{margin-left:0}'
      + '.ch-gone{font-style:italic;opacity:.6}.ch-day{align-self:center;font-size:12px;font-weight:700;color:var(--muted,#667);padding:4px 0}'
      + '.ch-form{display:flex;gap:8px;align-items:flex-end;margin-top:8px}.ch-form textarea{flex:1;min-height:44px;max-height:140px;resize:vertical;padding:10px 12px;border-radius:12px;border:1px solid var(--line,#d0d4dc);font:inherit;background:var(--surface,#fff);color:inherit}'
      + '.ch-form button{min-height:44px;padding:0 16px;border:0;border-radius:12px;background:#8c1024;color:#fff;font:inherit;font-weight:700;cursor:pointer}.ch-form button:disabled{opacity:.5}'
      + '.ch-off{padding:8px 12px;border-radius:12px;background:color-mix(in srgb,#b7791f 15%,transparent);font-weight:600;margin-bottom:8px}.ch-rule{font-size:12.5px;color:var(--muted,#667);margin:6px 2px 0}'
      + '.ch-cats{display:flex;gap:6px;flex-wrap:wrap}.ch-cats button{border:1px solid var(--line,#d0d4dc);background:var(--surface,#fff);border-radius:999px;padding:4px 12px;font:inherit;font-size:13px;cursor:pointer;color:inherit}.ch-cats button.on{background:#0e1d45;color:#fff;border-color:#0e1d45}'
      + '.ch-mod{border:1px solid var(--line,#d0d4dc);background:var(--surface,#fff);border-radius:10px;padding:6px 10px;font:inherit;font-size:13px;cursor:pointer;color:inherit}';
    document.head.appendChild(st);
  }
  const time = d => { try { return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
  const day = d => { try { const x = new Date(d), n = new Date(); if (x.toDateString() === n.toDateString()) return 'Aujourd\'hui'; n.setDate(n.getDate() - 1); if (x.toDateString() === n.toDateString()) return 'Hier';
    return x.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); } catch (e) { return ''; } };

  function msgHtml(m) {
    const canDel = !m.deleted && (m.mine || (view && view.mod));
    return `<div class="ch-m ${m.mine ? 'mine' : ''} ${m.kind === 'coach' ? 'coach' : ''}" data-chm="${m.id}">
      <div class="ch-who">${m.mine ? '' : `<span>${m.kind === 'coach' ? '🧢 ' : ''}${esc(m.name)}</span>`}<span class="t">${esc(time(m.at))}</span>${canDel ? `<button class="ch-del" data-chdel="${m.id}" title="Supprimer" aria-label="Supprimer le message">✕</button>` : ''}</div>
      ${m.deleted ? '<div class="ch-gone">Message supprimé</div>' : `<div>${esc(m.body).split('\n').join('<br>')}</div>`}</div>`;
  }
  function listHtml() {
    const ms = (view && view.msgs) || []; let last = '';
    if (!ms.length) return '<p class="ch-day">Pas encore de message. Lance la discussion ! 👋</p>';
    return ms.map(m => { const d = day(m.at), h = d !== last ? `<div class="ch-day">${esc(d)}</div>` : ''; last = d; return h + msgHtml(m); }).join('');
  }
  function html() {
    if (!view) return '<p class="ch-rule">Chargement du chat…</p>';
    if (!view.cat) return '<p class="ch-rule">Pas de chat pour l\'instant : tu n\'es dans aucune équipe.</p>';
    const cats = view.cats || [];
    return `<div class="ch-head"><h3>💬 Chat ${esc(view.cat)}</h3>${view.filtered ? '<span class="ch-tag">🛡️ Mots grossiers bloqués</span>' : ''}
        ${view.mod && o.off ? `<button class="ch-mod" data-choff="${view.off ? 0 : 1}">${view.off ? '🔓 Rouvrir le chat' : '🔒 Fermer le chat'}</button>` : ''}</div>
      ${cats.length > 1 ? `<div class="ch-cats">${cats.map(c => `<button class="${c === view.cat ? 'on' : ''}" data-chcat="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : ''}
      ${view.off ? `<div class="ch-off">🔒 Le chat est fermé par les coachs${view.mod ? ' : les joueurs ne peuvent plus écrire (toi, si).' : '.'}</div>` : ''}
      <div class="ch-list" id="chList">${listHtml()}</div>
      ${view.off && !view.mod ? '' : `<form class="ch-form" id="chForm"><textarea id="chText" maxlength="500" rows="1" placeholder="Écris un message à ${view.mod ? 'tes joueurs' : 'ta catégorie'}…" aria-label="Message">${esc(draft)}</textarea><button type="submit" ${sending ? 'disabled' : ''}>Envoyer</button></form>`}
      <p class="ch-rule">${view.mod ? 'Tu peux supprimer un message (✕) ou fermer le chat.' : 'Joueurs et coachs de la catégorie lisent ce chat. Reste respectueux : les coachs peuvent supprimer les messages.'}</p>`;
  }
  const nearBottom = l => !l || l.scrollHeight - l.scrollTop - l.clientHeight < 80;
  function draw(stick) {
    if (!box) return;
    const l0 = box.querySelector('#chList'), keep = l0 && !nearBottom(l0) && !stick ? l0.scrollTop : null;
    const focus = document.activeElement && document.activeElement.id === 'chText';
    box.innerHTML = html();
    const l = box.querySelector('#chList'); if (l) l.scrollTop = keep == null ? l.scrollHeight : keep;
    if (focus) { const t = box.querySelector('#chText'); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } }
  }
  const lastId = () => { const ms = (view && view.msgs) || []; return ms.length ? ms[ms.length - 1].id : 0; };
  async function load(full) {
    if (!o || busy) return; busy = true;
    try {
      const after = full || !view ? 0 : lastId();
      const r = await o.load(cat || null, after);
      if (!r) return;
      if (full || !view || r.cat !== view.cat) view = r;
      else {
        const gone = new Set(r.gone || []), had = new Set(view.msgs.map(m => m.id)), wasOff = view.off;
        let changed = r.off !== wasOff;
        view.msgs.forEach(m => { if (gone.has(m.id) && !m.deleted) { m.deleted = true; m.body = null; changed = true; } });
        const fresh = (r.msgs || []).filter(m => !had.has(m.id));
        Object.assign(view, { off: r.off, filtered: r.filtered, mod: r.mod, cats: r.cats || view.cats });
        view.msgs = view.msgs.concat(fresh).slice(-200);
        if (!fresh.length && !changed) return;
      }
      cat = view.cat || cat;
      draw(false);
    } catch (e) { if (!view) { view = { cat: '', msgs: [] }; if (box) box.innerHTML = `<p class="ch-rule">${esc(nice(e))}</p>`; } }
    finally { busy = false; }
  }
  // asks again every few seconds, while the chat is on screen and the page visible
  function tick() {
    if (!box || !document.body.contains(box)) { clearInterval(timer); timer = null; box = null; return; }
    if (document.visibilityState === 'visible' && box.offsetParent !== null) load(false);
  }
  async function send() {
    const t = box.querySelector('#chText'), b = (t ? t.value : '').trim(); if (!b || sending) return;
    draft = b; sending = true; draw(true);
    try { await o.post(view.cat, b); draft = ''; const tt = box.querySelector('#chText'); if (tt) tt.value = ''; sending = false; await load(false); draw(true); }
    catch (e) { sending = false; draw(true); (o.toast || alert)(nice(e), true); }
  }
  function bind(el) {
    if (el.dataset.chBound) return; el.dataset.chBound = 1;
    el.addEventListener('submit', e => { if (e.target.id === 'chForm') { e.preventDefault(); send(); } });
    el.addEventListener('input', e => { if (e.target.id === 'chText') draft = e.target.value; });
    el.addEventListener('keydown', e => { if (e.target.id === 'chText' && e.key === 'Enter' && !e.shiftKey && matchMedia('(pointer:fine)').matches) { e.preventDefault(); send(); } });
    el.addEventListener('click', async e => {
      const d = e.target.closest('[data-chdel]');
      if (d) { if (!confirm('Supprimer ce message ?')) return; try { await o.del(view.cat, +d.dataset.chdel); const m = view.msgs.find(x => x.id === +d.dataset.chdel); if (m) { m.deleted = true; m.body = null; } draw(false); } catch (err) { (o.toast || alert)(nice(err), true); } return; }
      const c = e.target.closest('[data-chcat]'); if (c) { cat = c.dataset.chcat; view = null; draw(true); load(true); return; }
      const f = e.target.closest('[data-choff]');
      if (f && o.off) { const off = f.dataset.choff === '1'; if (off && !confirm('Fermer le chat ? Les joueurs pourront le lire mais plus écrire.')) return;
        try { await o.off(off); view.off = off; draw(false); (o.toast || (() => {}))(off ? 'Chat fermé.' : 'Chat rouvert.'); } catch (err) { (o.toast || alert)(nice(err), true); } }
    });
  }
  /* el: the box; opts: { key (who / which team: a new key = a new chat), load(cat, after), post(cat, body), del(cat, id), off(bool) (coaches), toast(msg, err) } */
  function mount(el, opts) {
    if (!el) return; css();
    if (!o || o.key !== opts.key) { view = null; cat = ''; draft = ''; }
    o = opts; box = el; bind(el); draw(true);
    load(!view);
    if (!timer) timer = setInterval(tick, POLL);
  }
  return { mount, nice };
})();
