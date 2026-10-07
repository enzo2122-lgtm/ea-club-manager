/* (1.81) Highlights of a match (coach and responsable, tab « Après »): the best moments as video links (YouTube, Drive, Veo…),
   each with its title and its start time, then « Envoyer aux joueurs »: they see them in their space (tab Vidéos) and get a notification. */
const Highlights = (() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 10);
  function html(m) {
    const cl = m.highlights || [];
    return `<section class="card hl-card"><h2>🎬 Highlights du match</h2>
      <p class="muted small">Colle le lien de chaque vidéo (YouTube, Google Drive, Dropbox, Vimeo, Veo, fichier MP4, MOV, WebM…) avec un titre et, si besoin, la minute où ça commence. Les joueurs les regardent dans l'appli. Les AVI, MPG ou WMV ne se lisent pas dans un navigateur : convertis-les en MP4 ou mets-les sur YouTube (« non répertoriée »).</p>
      ${cl.length ? VPlayer.list(cl) + `<div class="chips" style="margin-top:6px">${cl.map(c => `<button class="chip" data-hldel="${esc(c.id)}">✕ ${esc(c.title || 'Vidéo')}</button>`).join('')}</div>` : ''}
      <div class="row3" style="margin-top:10px">
        <label class="fld"><span>Titre</span><input id="hlTitle" maxlength="80" placeholder="But de Yanis, 23e"></label>
        <label class="fld"><span>Lien de la vidéo</span><input id="hlUrl" inputmode="url" placeholder="https://youtu.be/…"></label>
        <label class="fld"><span>Début (min:s)</span><input id="hlT" maxlength="8" placeholder="1:23"></label>
      </div>
      <div class="chips"><button class="btn soft" data-hladd>＋ Ajouter la vidéo</button>
        ${cl.length ? `<button class="btn primary" data-hlsend>📣 ${m.hlSent ? 'Renvoyer aux joueurs' : 'Envoyer aux joueurs'}</button>` : ''}</div>
      ${m.hlSent ? `<p class="muted small">✓ Envoyé le ${esc(new Date(m.hlSent).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }))} : les joueurs de l'équipe les voient dans l'onglet « Vidéos ».</p>` : ''}</section>`;
  }
  // box: the element to fill; save: stores the match; toast: the message bar
  function mount(box, m, save, toast) {
    if (!box) return;
    const draw = () => { box.innerHTML = html(m); };
    draw();
    box.onclick = e => {
      if (VPlayer.onClick(e)) return;
      const d = e.target.closest('[data-hldel]');
      if (d) { if (!confirm('Retirer cette vidéo ?')) return; m.highlights = (m.highlights || []).filter(c => c.id !== d.dataset.hldel); save(); return draw(); }
      if (e.target.closest('[data-hladd]')) {
        const url = box.querySelector('#hlUrl').value.trim(), title = box.querySelector('#hlTitle').value.trim(), t = box.querySelector('#hlT').value.trim();
        if (!/^https:\/\//.test(url)) return toast('Colle un lien qui commence par https://', true);
        m.highlights = [...(m.highlights || []), { id: uid(), url, title: title || 'Action ' + ((m.highlights || []).length + 1), t }];
        save(); draw(); toast(VPlayer.src(url) ? 'Vidéo ajoutée ✓' : 'Ajoutée ✓ (ce lien s\'ouvrira dans un nouvel onglet)'); return;
      }
      if (e.target.closest('[data-hlsend]')) {
        m.hlSent = new Date().toISOString(); save(); draw();
        toast('Envoyé : les joueurs sont prévenus 🎬');
      }
    };
  }
  return { mount, html };
})();
