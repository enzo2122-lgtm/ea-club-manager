/* (2.27) Reactions and comments under a session or a match, coach side: the 🔥 of the players and the parents, their comments,
   the coach reacts and comments too, and moderates (he deletes any comment). Players' side: Member.evBar in member.js. */
const EvFeed = (() => {
  const { esc, toast } = UI;
  const fmt = at => { const d = new Date(at); return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); };
  async function mount(box, id) {
    if (!box || !Cloud.ready() || !Cloud.evFeed) return;
    let f = null;
    const load = async () => { try { f = ((await Cloud.evFeed([id])) || {})[id] || { fire: 0, mine: null, n: 0, last: [] }; } catch (e) { f = null; } };
    const draw = () => {
      if (!box.isConnected) return;
      if (!f) { box.innerHTML = ''; return; }
      box.innerHTML = `<section class="card evf"><div class="row-head"><h3>🔥 Réactions et commentaires</h3><span class="muted small">${f.fire} 🔥 · ${f.n} 💬</span></div>
        <div class="chips"><button class="chip ${f.mine ? 'on' : ''}" data-evf="react">🔥 ${f.mine ? 'Tu as réagi' : 'Réagir'}</button></div>
        ${(f.last || []).length ? `<div class="evf-list">${f.last.map(c => `<div class="evf-c ${c.kind === 'coach' ? 'coach' : ''}"><b>${esc(c.name)}</b> <span class="muted small">${esc(fmt(c.at))}</span><button class="linkish" data-evf="del" data-id="${c.id}" title="Supprimer">✕</button><div>${esc(c.body)}</div></div>`).join('')}</div>` : '<p class="muted small">Pas encore de commentaire. Les joueurs et les parents peuvent en laisser depuis leur espace.</p>'}
        <div class="evf-in"><input maxlength="300" placeholder="Un mot aux joueurs (visible par la catégorie)" data-evf-in><button class="btn soft" data-evf="post">${I.chat}<span>Envoyer</span></button></div></section>`;
    };
    box.onclick = async e => {
      const b = e.target.closest('[data-evf]'); if (!b) return;
      try {
        if (b.dataset.evf === 'react') await Cloud.evReact(id, f.mine ? '' : '🔥');
        else if (b.dataset.evf === 'del') { if (!await UI.confirmBox('Supprimer ce commentaire ?', 'Supprimer')) return; await Cloud.evDel(+b.dataset.id); }
        else if (b.dataset.evf === 'post') { const i = box.querySelector('[data-evf-in]'), v = i.value.trim(); if (!v) return i.focus(); await Cloud.evPost(id, v); }
        await load(); draw();
      } catch (err) { toast(err.message || 'Impossible pour l\'instant', 'err'); }
    };
    await load(); draw();
  }
  return { mount };
})();
