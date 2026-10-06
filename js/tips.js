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
        <span class="muted small">${esc(t.themeLabel || '')} · ${esc(fmt(t.at))}${t.by ? ' · ' + esc(t.by) : ''}</span>${t.text ? `<span class="small pre">${esc(t.text)}</span>` : ''}</div>
        <button class="icon-btn" data-tip="del" data-t="${esc(t.id)}" aria-label="Retirer ce conseil">${I.trash}</button></div>`).join('')}</div>`
        : '<p class="muted">Aucun conseil envoyé pour l\'instant.</p>'}</section>`;
  }
  function dialog(p, done) {
    let th = 'course', touched = false;
    modal({
      title: `Un conseil pour ${p.firstName || 'le joueur'}`,
      body: `<div class="lbl">À travailler</div>
        <div class="chips" id="tpTh">${THEMES.map(([k, ic, l]) => `<button class="chip ${k === th ? 'on' : ''}" data-th="${k}">${ic} ${esc(l)}</button>`).join('')}</div>
        <label class="fld"><span>Titre</span><input id="tpTitle" maxlength="80" value="${esc(theme(th)[2])}"></label>
        <label class="fld"><span>L'exercice (déjà rempli : modifie-le si tu veux)</span><textarea id="tpText" rows="7" maxlength="1500">${esc(theme(th)[3])}</textarea></label>
        <label class="fld"><span>Lien d'une vidéo (facultatif)</span><input id="tpLink" type="url" inputmode="url" placeholder="https://…"></label>`,
      onOpen: r => {
        $('#tpText', r).addEventListener('input', () => { touched = true; });
        $$('#tpTh .chip', r).forEach(b => b.onclick = () => {
          th = b.dataset.th; $$('#tpTh .chip', r).forEach(x => x.classList.toggle('on', x === b));
          $('#tpTitle', r).value = theme(th)[2];
          if (!touched) $('#tpText', r).value = theme(th)[3];
        });
      },
      actions: [{ label: 'Annuler' }, { label: 'Envoyer', kind: 'primary', onClick: (close, r) => {
        const text = $('#tpText', r).value.trim(), link = $('#tpLink', r).value.trim(), [, icon, themeLabel] = theme(th);
        if (!text) { toast('Écris l\'exercice', 'err'); return false; }
        p.coachTips = [{ id: Store.uid(), at: today(), theme: th, icon, themeLabel, title: $('#tpTitle', r).value.trim() || themeLabel, text, link: /^https:\/\//.test(link) ? link : '', by: coachName() }, ...(p.coachTips || [])].slice(0, 30);
        Store.upsert('players', p); toast(`Conseil envoyé à ${p.firstName || 'ton joueur'}`); done();
      } }],
    });
  }
  function click(e, p, done) {
    const b = e.target.closest('[data-tip]'); if (!b) return false;
    if (b.dataset.tip === 'new') dialog(p, done);
    if (b.dataset.tip === 'del') confirmBox('Retirer ce conseil ? Le joueur ne le verra plus.', 'Retirer').then(ok => {
      if (!ok) return; p.coachTips = (p.coachTips || []).filter(t => t.id !== b.dataset.t); Store.upsert('players', p); done();
    });
    return true;
  }
  return { card, click, THEMES };
})();
