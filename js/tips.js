/* Tips (1.65): the coach's personal suggestions for one player, to work on his weak points (running, passing, positioning…).
   On the player's page the coach picks a theme (a ready-made exercise fills the text, he can change it) and sends it.
   The suggestions are kept on the player (p.coachTips, shared with the coaches of the club); the player and his parents
   see them in their space, « Séances » tab (club server: member_tips, which reads only this player's suggestions). */
const Tips = (() => {
  const { esc, $, $$, toast, modal, confirmBox } = UI;
  const THEMES = [
    ['course', '🏃', 'Course / vitesse', 'Échauffement 10 min.\n6 × 30 m en accélérant petit à petit, retour en marchant.\n4 × 10 m départ arrêté, au signal (réaction).\nÉtirements 5 min.'],
    ['passe', '🎯', 'Passe', 'Contre un mur à 5 m : 3 × 20 passes pied droit, puis pied gauche, intérieur du pied.\nUn contrôle orienté avant chaque passe.\nPuis à 10 m : 2 × 15 passes appuyées.'],
    ['controle', '🦶', 'Contrôle', 'Jongles : 3 séries, objectif +5 par rapport à ton record.\nContre un mur : contrôle orienté à droite puis à gauche, 3 × 15.\nLe ballon doit rester à moins d\'un pas.'],
    ['frappe', '⚽', 'Frappe', 'Face à un but ou un mur : 3 × 10 frappes, cou-de-pied.\nPied d\'appui à côté du ballon, regarder la cible avant de frapper.\nAlterner pied droit et pied gauche.'],
    ['dribble', '🌀', 'Dribble / conduite', '6 plots en ligne, 1 m entre chaque : slalom pied droit, pied gauche, intérieur-extérieur, 5 passages chacun.\nPuis conduite rapide sur 20 m, aller-retour × 6, tête levée.'],
    ['placement', '🧭', 'Positionnement', 'Regarde un match (ou un résumé) en suivant un joueur de ton poste.\nOù se place-t-il quand son équipe a le ballon ? Et quand elle le perd ?\nNote 3 choses et parles-en au coach à l\'entraînement.'],
    ['defense', '🛡️', 'Défense / duels', 'Appuis : pas chassés 4 × 20 s, course arrière 4 × 15 m.\nChangements de direction entre 2 plots × 6.\nEn duel : reste entre l\'adversaire et le but, sur les appuis, ne plonge pas.'],
    ['endurance', '🫀', 'Endurance', 'Footing de 25 à 30 min à une allure où tu peux parler.\nOu : 2 × (8 × 30 s rapide / 30 s lent), 3 min de repos entre les deux.'],
    ['gardien', '🧤', 'Gardien', 'Prises de balle contre un mur : 3 × 20.\nPlongeons sur l\'herbe : 2 × 6 de chaque côté.\nJeu au pied : 2 × 10 dégagements, viser une zone.'],
    ['mental', '🧠', 'Mental', 'Avant chaque match : 3 grandes respirations, une phrase positive, un objectif simple (ex : demander le ballon 10 fois).\nAprès une erreur : « suivant ! » et on repart.'],
  ];
  const theme = k => THEMES.find(t => t[0] === k) || THEMES[0];
  const fmt = d => { try { return new Date(d + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); } catch (e) { return d || ''; } };
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const coachName = () => { const u = Auth.current && Auth.current(); return u ? 'Coach ' + (u.firstName || u.lastName || '') : 'Le coach'; };

  function card(p) {
    const l = p.coachTips || [];
    return `<section class="card tips-card"><div class="row-head"><h2>💡 Conseils perso</h2><button class="btn primary" data-tip="new">${I.plus}<span>Envoyer un conseil</span></button></div>
      <p class="muted small">Des exercices choisis pour ${esc(p.firstName || 'ce joueur')} (course, passe, positionnement…). Il les voit avec ses parents dans son espace, onglet « Séances ».</p>
      ${l.length ? `<div class="list">${l.map(t => `<div class="list-item"><div class="li-main"><b>${esc(t.icon || '💡')} ${esc(t.title || t.themeLabel || 'Conseil')}</b>
        <span class="muted small">${esc(t.themeLabel || '')} · ${esc(fmt(t.at))}${t.by ? ' · ' + esc(t.by) : ''}${t.session ? ' · 📋 séance' : ''}${(t.links || []).length ? ` · 🎬 ${t.links.length} vidéo${t.links.length > 1 ? 's' : ''}` : ''}${(t.files || []).length ? ` · 📎 ${t.files.length} fichier${t.files.length > 1 ? 's' : ''}` : ''}</span>${t.text ? `<span class="small pre">${esc(t.text)}</span>` : ''}</div>
        <button class="icon-btn" data-tip="del" data-t="${esc(t.id)}" aria-label="Retirer ce conseil">${I.trash}</button></div>`).join('')}</div>`
        : '<p class="muted">Aucun conseil envoyé pour l\'instant.</p>'}</section>`;
  }
  // (1.74) the sessions a coach can join: the club's ready sessions, then the sessions of the player's teams (newest first)
  function sessionsFor(p) {
    const tr = Store.state.trainings, mine = new Set(p.teamIds || []);
    const models = tr.filter(t => t.model && (t.exercises || []).length).sort((a, b) => String(a.title).localeCompare(String(b.title), 'fr'));
    const team = tr.filter(t => !t.model && (t.exercises || []).length && mine.has(t.teamId)).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 30);
    return [['Séances types du club', models], ['Séances de son équipe', team]].filter(x => x[1].length);
  }
  const readData = f => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = ko; r.readAsDataURL(f); });
  async function toJpeg(src, max = 1600) {
    const img = await Media.loadImage(src), k = Math.min(1, max / Math.max(img.width, img.height)), cv = document.createElement('canvas');
    cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); return cv.toDataURL('image/jpeg', .85);
  }
  async function schemaJpeg(sc) {
    await Board.ensureBg(sc); const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 800;
    Board.drawFrame(cv.getContext('2d'), 1200, 800, sc, 0, 0, { homeBib: Store.state.club.homeBib, names: (sc.overlays || {}).names }); return cv.toDataURL('image/jpeg', .85);
  }
  // the tip is saved on the player; its files go to the club server (the player reads them with his code)
  async function send(p, tip, sess, files) {
    const todo = [];
    if (sess) (sess.exercises || []).forEach((e, i) => { const sc = e.schemaId && Store.get('schemas', e.schemaId); if (sc) todo.push({ name: `Schéma ${i + 1} · ${e.title || sc.name || ''}`.slice(0, 100), mime: 'image/jpeg', make: () => schemaJpeg(sc) }); });
    files.forEach(f => {
      if (f.type === 'application/pdf') todo.push({ name: f.name, mime: 'application/pdf', make: async () => { if (f.size > 3.1e6) throw new Error('trop lourd'); return readData(f); } });
      else if (/^image\//.test(f.type)) todo.push({ name: f.name, mime: 'image/jpeg', make: async () => toJpeg(URL.createObjectURL(f)) });
    });
    const skipped = [];
    if (todo.length) {
      if (!Cloud.ready()) skipped.push(...todo.map(x => x.name));
      else { const bz = UI.busy('Envoi des fichiers…');
        try { for (const x of todo) { try { const id = await Cloud.tipFileAdd(p.id, tip.id, x.name, x.mime, await x.make()); tip.files.push({ id, name: x.name, mime: x.mime }); } catch (e) { skipped.push(x.name); } } }
        finally { bz.done(); } }
    }
    p.coachTips = [tip, ...(p.coachTips || [])].slice(0, 30); Store.upsert('players', p);
    toast(skipped.length ? `Conseil envoyé, mais ${skipped.length} fichier${skipped.length > 1 ? 's' : ''} non envoyé${skipped.length > 1 ? 's' : ''} (trop lourd ou serveur pas à jour) : mets-le sur Google Drive et colle le lien` : `Conseil envoyé à ${p.firstName || 'ton joueur'}`, skipped.length ? 'err' : '');
  }
  function dialog(p, done) {
    let th = 'course', touched = false;
    modal({
      title: `Un conseil pour ${p.firstName || 'le joueur'}`,
      body: `<div class="lbl">À travailler</div>
        <div class="chips" id="tpTh">${THEMES.map(([k, ic, l]) => `<button class="chip ${k === th ? 'on' : ''}" data-th="${k}">${ic} ${esc(l)}</button>`).join('')}</div>
        <label class="fld"><span>Titre</span><input id="tpTitle" maxlength="80" value="${esc(theme(th)[2])}"></label>
        <label class="fld"><span>L'exercice (déjà rempli : modifie-le si tu veux)</span><textarea id="tpText" rows="7" maxlength="1500">${esc(theme(th)[3])}</textarea></label>
        <label class="fld"><span>Joindre une séance prête (facultatif)</span><select id="tpSess"><option value="">Aucune</option>${sessionsFor(p).map(([g, l]) => `<optgroup label="${esc(g)}">${l.map(t => `<option value="${t.id}">${esc((t.date && !t.model ? UI.fmtDate(t.date) + ' · ' : '') + (t.title || 'Séance'))} (${(t.exercises || []).length} ex.)</option>`).join('')}</optgroup>`).join('')}</select></label>
        <label class="switch"><input type="checkbox" id="tpSch" checked><span>Avec les schémas des exercices (images)</span></label>
        <label class="fld"><span>Liens de vidéos (un par ligne : YouTube, Google Drive, Instagram…)</span><textarea id="tpLinks" rows="2" inputmode="url" placeholder="https://…"></textarea></label>
        <label class="fld"><span>PDF ou images (3 Mo maximum chacun)</span><input id="tpFiles" type="file" multiple accept="application/pdf,image/*"></label>
        ${Cloud.ready() ? '' : '<p class="tip">Les fichiers ne partent que si l\'appli est connectée au serveur du club.</p>'}`,
      onOpen: r => {
        $('#tpText', r).addEventListener('input', () => { touched = true; });
        // a ready session chosen: its title, and the ready-made exercise is left out (unless the coach wrote his own)
        $('#tpSess', r).onchange = e => { const s = Store.get('trainings', e.target.value); if (!s) return; $('#tpTitle', r).value = s.title || 'Séance'; if (!touched) $('#tpText', r).value = ''; };
        $$('#tpTh .chip', r).forEach(b => b.onclick = () => {
          th = b.dataset.th; $$('#tpTh .chip', r).forEach(x => x.classList.toggle('on', x === b));
          $('#tpTitle', r).value = theme(th)[2];
          if (!touched) $('#tpText', r).value = theme(th)[3];
        });
      },
      actions: [{ label: 'Annuler' }, { label: 'Envoyer', kind: 'primary', onClick: (close, r) => {
        const text = $('#tpText', r).value.trim(), [, icon, themeLabel] = theme(th), sess = Store.get('trainings', $('#tpSess', r).value);
        if (!text && !sess) { toast('Écris l\'exercice ou choisis une séance', 'err'); return false; }
        const links = $('#tpLinks', r).value.split(/\s+/).map(x => x.trim()).filter(x => /^https:\/\/\S+$/.test(x)).slice(0, 8);
        const tip = { id: Store.uid(), at: today(), theme: th, icon, themeLabel, title: $('#tpTitle', r).value.trim() || (sess && sess.title) || themeLabel, text, links, files: [], by: coachName() };
        if (sess) tip.session = { title: sess.title || 'Séance', goal: sess.goal || '', exercises: (sess.exercises || []).map(e => ({ title: e.title || '', duration: e.duration || '', org: e.org || '', consignes: e.consignes || '', materiel: e.materiel || '' })) };
        send(p, tip, sess && $('#tpSch', r).checked ? sess : null, [...($('#tpFiles', r).files || [])]).then(done);
      } }],
    });
  }
  function click(e, p, done) {
    const b = e.target.closest('[data-tip]'); if (!b) return false;
    if (b.dataset.tip === 'new') dialog(p, done);
    if (b.dataset.tip === 'del') confirmBox('Retirer ce conseil ? Le joueur ne le verra plus.', 'Retirer').then(ok => {
      if (!ok) return; const t = (p.coachTips || []).find(x => x.id === b.dataset.t);
      ((t && t.files) || []).forEach(x => Cloud.tipFileDel(x.id).catch(() => {}));
      p.coachTips = (p.coachTips || []).filter(x => x.id !== b.dataset.t); Store.upsert('players', p); done();
    });
    return true;
  }
  return { card, click, THEMES };
})();
