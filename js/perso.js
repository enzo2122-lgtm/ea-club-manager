/* Perso: « Mon entraînement perso », for a player, a parent (for his child) or a referee.
   The person chooses what he needs (physique, technique, tactique), alone or with others, how long and where:
   the app makes the session (warm-up, exercises, cool-down) in big letters, easy to read on a phone.
   He notes his footings (time, distance, how it felt) and what he did; he can send a session or his footings to his coach.
   Everything is kept on the phone; only what he sends goes to the coach. Works on the players' / parents' pages (no Store there). */
const Perso = (() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sportId = () => (typeof Sport !== 'undefined' ? Sport.id() : 'foot');
  const ball = () => ({ foot: '⚽', basket: '🏀', hand: '🤾', rugby: '🏉', volley: '🏐' }[sportId()] || '⚽');
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const fmtD = d => d ? new Date(d + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
  // [need, title, minutes, solo / group (s, g, sg), place (t: terrain, m: maison, p: partout), organisation, consignes « | », matériel]
  const COMMON = [
    ['echauffement', 'Échauffement dynamique', 8, 'sg', 'p', 'Trottiner 3 minutes, puis montées de genoux, talons-fesses, pas chassés, rotations des bras et des hanches.', 'Monter doucement le rythme|Respirer par le nez', ''],
    ['echauffement', 'Mobilité et activation', 7, 'sg', 'm', 'Sur place : cercles de chevilles, hanches, épaules, 10 squats lents, 10 fentes, 20 sauts légers.', 'Mouvements amples et contrôlés', ''],
    ['physique', 'Footing d\'endurance', 25, 'sg', 't', 'Courir à allure facile : tu dois pouvoir parler pendant la course.', 'Allure régulière|Boire après', 'Montre ou téléphone'],
    ['physique', 'Fractionné 30-30', 15, 'sg', 't', '30 secondes de course rapide, 30 secondes de marche ou trot, 2 séries de 6 avec 3 minutes de pause.', 'Rapide mais pas à fond|Même distance à chaque fois', 'Chrono'],
    ['physique', 'Sprints courts', 12, 'sg', 't', '8 sprints de 20 m, retour en marchant. Puis 4 départs différents (assis, de dos, couché).', 'Pousser fort les premiers pas|Récupérer complètement', 'Plots'],
    ['physique', 'Circuit renforcement', 15, 'sg', 'm', '3 tours : 15 squats, 10 pompes (genoux au sol si besoin), 10 fentes par jambe, 30 s de gainage, 20 crunchs. 1 minute de pause entre les tours.', 'Dos droit|Qualité avant vitesse', 'Tapis'],
    ['physique', 'Gainage', 10, 'sg', 'm', '3 séries : planche 30 s, planche sur le côté 20 s chaque côté, pont fessier 30 s.', 'Corps bien aligné|Ne pas bloquer la respiration', 'Tapis'],
    ['physique', 'Corde à sauter et appuis', 10, 's', 'p', '5 x 1 minute de corde à sauter, puis 2 x 30 s de pas rapides sur place.', 'Sur l\'avant des pieds|Rester léger', 'Corde à sauter'],
    ['physique', 'Côtes', 15, 'sg', 't', '6 montées rapides d\'une côte (15 à 20 s), retour en marchant.', 'Bras actifs|Regard devant', ''],
    ['physique', 'Équilibre et chevilles', 8, 'sg', 'm', 'Sur une jambe : 30 s yeux ouverts, 30 s yeux fermés, puis petits sauts sur une jambe. Changer de jambe.', 'Genou légèrement fléchi|Utile pour éviter les entorses', ''],
    ['tactique', 'Regarder un match comme un coach', 20, 'sg', 'm', 'Regarde 20 minutes d\'un match de haut niveau en suivant uniquement un joueur de ton poste : où il se place avec et sans le ballon.', 'Note 3 choses qu\'il fait souvent|Essaie de les refaire à l\'entraînement', 'Écran'],
    ['tactique', 'Revoir mon dernier match', 15, 's', 'm', 'Pense à 3 actions de ton dernier match : ce que tu as fait, ce que tu aurais pu faire. Écris-les.', 'Une chose réussie, une chose à améliorer', 'Papier'],
    ['tactique', 'Prise d\'information', 10, 'g', 't', 'Par 2 : ton partenaire lève des doigts ou annonce une couleur pendant que tu reçois le ballon : tu dois répondre avant de jouer.', 'Regarder avant de recevoir|Tête levée', 'Ballon'],
    ['tactique', '3 contre 1', 12, 'g', 't', 'À 4 dans un carré de 8 m : 3 gardent le ballon, 1 essaie de le prendre. On change quand il le touche.', 'Se déplacer pour offrir une solution|Jouer vite', 'Ballon, plots'],
    ['calme', 'Retour au calme et étirements', 8, 'sg', 'p', 'Marcher 2 minutes, puis étirer mollets, cuisses, ischio-jambiers, fessiers et dos (30 s chacun).', 'Pas d\'à-coups|Respirer lentement', ''],
  ];
  const TECH = {
    foot: [
      ['technique', 'Jonglage : bats ton record', 10, 'sg', 'p', 'Jongle pied droit, pied gauche, cuisses, tête. Note ton record et essaie de le battre.', 'Toucher le ballon du coup de pied|Pied faible aussi', 'Ballon'],
      ['technique', 'Conduite entre plots', 12, 'sg', 't', '6 plots en slalom : intérieur, extérieur, semelle. Puis accélération sur 10 m.', 'Petites touches|Tête levée entre les plots', 'Ballon, plots'],
      ['technique', 'Passes et contrôles contre un mur', 12, 's', 't', 'À 5 m d\'un mur : passe, contrôle orienté à droite, passe, contrôle orienté à gauche. 50 passes de chaque pied.', 'Contrôle vers l\'espace|Passe appuyée', 'Ballon, mur'],
      ['technique', 'Frappes au but', 15, 'sg', 't', '20 frappes de 16 m : 10 intérieur du pied placées, 10 coup de pied puissantes. Vise les coins.', 'Pied d\'appui à côté du ballon|Regarder le but puis le ballon', 'Ballons, but'],
      ['technique', 'Dribbles en 1 contre 1', 12, 'g', 't', 'Par 2 dans un couloir de 10 m : dribbler son partenaire et franchir la ligne.', 'Feinte puis accélération|Protéger le ballon', 'Ballon, plots'],
      ['technique', 'Tennis-ballon', 15, 'g', 't', 'Par 2 ou 4 avec un filet ou une ligne : un rebond autorisé, pieds et tête.', 'Contrôle de la cuisse|Placer le ballon', 'Ballon'],
    ],
    basket: [
      ['technique', 'Dribble à deux ballons', 10, 's', 'p', 'Un ballon dans chaque main : dribbles simultanés, puis alternés, puis en marchant.', 'Tête levée|Doigts, pas la paume', '2 ballons'],
      ['technique', 'Tirs en 5 positions', 15, 's', 't', '5 positions autour du panier, 10 tirs par position. Note tes réussites.', 'Coude sous le ballon|Finir le geste', 'Ballon, panier'],
      ['technique', 'Lancers francs', 10, 's', 't', '3 séries de 10 lancers francs avec toujours la même routine.', 'Même routine à chaque tir|Respirer', 'Ballon, panier'],
      ['technique', '1 contre 1 au panier', 12, 'g', 't', 'Par 2 : 1 contre 1 depuis la ligne à 3 points.', 'Feinte de tir puis pénétration', 'Ballon, panier'],
    ],
    hand: [
      ['technique', 'Passes contre un mur', 10, 's', 't', 'À 4 m d\'un mur : passes à une main, main droite puis gauche, en se déplaçant.', 'Bras armé haut|Réception mains en coupe', 'Ballon, mur'],
      ['technique', 'Tirs en appui', 15, 'sg', 't', '20 tirs depuis 9 m en visant les coins (cible au mur si pas de but).', 'Pied opposé devant|Tirer au plus haut', 'Ballons, but ou mur'],
      ['technique', 'Manipulation de balle', 8, 's', 'p', 'Faire tourner le ballon autour de la taille, des jambes, passer d\'une main à l\'autre, dribbler.', 'Regarder devant', 'Ballon'],
    ],
    rugby: [
      ['technique', 'Passes vers l\'arrière en courant', 12, 'g', 't', 'Par 2 ou 3 en ligne décalée sur 30 m, aller-retour.', 'Passer vers l\'arrière|Mains tendues vers le passeur', 'Ballon'],
      ['technique', 'Passes contre un mur', 10, 's', 't', 'Passes vrillées contre un mur, des deux côtés.', 'Pousser avec la main arrière', 'Ballon, mur'],
      ['technique', 'Jeu au pied de précision', 12, 'sg', 't', 'Viser des cibles à 15, 20 et 30 m (plots), puis chandelles et réceptions.', 'Regarder le ballon jusqu\'au pied|Réception bras en panier', 'Ballon, plots'],
    ],
    volley: [
      ['technique', 'Manchettes contre un mur', 10, 's', 'p', 'Manchettes continues contre un mur à 2 m de hauteur.', 'Bras tendus|Se placer avec les jambes', 'Ballon, mur'],
      ['technique', 'Touches au-dessus de soi', 8, 's', 'p', 'Touches hautes continues au-dessus de soi, puis assis, puis en marchant.', 'Mains en coupe au-dessus du front', 'Ballon'],
      ['technique', 'Service sur cible', 12, 'sg', 't', '30 services en visant une zone (plot ou cerceau) dans le terrain.', 'Lancer régulier|Bras haut', 'Ballons, cible'],
    ],
  };
  const REF = [
    ['physique', 'Intermittent de l\'arbitre', 15, 'sg', 't', '40 m en 15 s puis 20 s de marche, répété 10 fois, 2 séries.', 'Régularité|Récupérer en marchant', 'Plots, chrono'],
    ['physique', 'Déplacements latéraux et en arrière', 10, 'sg', 't', 'Courses en pas chassés et en reculant sur 20 m, changements de direction au signal.', 'Regard vers le jeu|Ne pas croiser les pieds', 'Plots'],
    ['tactique', 'Placement en diagonale', 15, 's', 'm', 'Sur une vidéo de match, à chaque action, imagine où l\'arbitre doit se placer pour voir l\'action et l\'assistant.', 'Garder le jeu entre soi et l\'assistant', 'Écran'],
    ['tactique', 'Décider sur des situations vidéo', 15, 'sg', 'm', 'Regarde des actions litigieuses (fautes, hors-jeu, mains) et décide avant de voir la décision.', 'Décider vite|Justifier sa décision', 'Écran'],
  ];
  const NEEDS = [['physique', '💪 Physique'], ['technique', `${ball()} Technique`], ['tactique', '🧠 Tactique']];

  function bank(referee) {
    const list = [...COMMON, ...(referee ? REF : (TECH[sportId()] || TECH.foot))];
    return list.map(([need, title, min, sg, place, org, cons, mat]) => ({ need, title, min, solo: sg.includes('s'), group: sg.includes('g'), place, org, cons: cons ? cons.split('|') : [], mat }));
  }
  // the session: a warm-up, the exercises of the needs chosen (one after the other), a cool-down; the exact length asked
  function build(o, referee) {
    const all = bank(referee).filter(x => (o.group ? x.group : x.solo) && (o.place === 'm' ? x.place !== 't' : true));
    const pick = (need, used) => { const l = all.filter(x => x.need === need && !used.has(x.title)); return l[Math.floor(Math.random() * l.length)]; };
    const used = new Set(), out = [];
    const warm = pick('echauffement', used); if (warm) { out.push(warm); used.add(warm.title); }
    const calm = all.find(x => x.need === 'calme');
    let left = o.min - (warm ? warm.min : 0) - (calm ? calm.min : 0), i = 0, tries = 0;
    const needs = o.needs.length ? o.needs : ['physique'];
    while (left > 4 && tries < 30) { tries++; const x = pick(needs[i % needs.length], used); i++; if (!x) continue; used.add(x.title); const m = Math.min(x.min, left); out.push(Object.assign({}, x, { min: m })); left -= m; }
    if (calm) out.push(calm);
    return { id: Date.now().toString(36), date: today(), needs, group: o.group, place: o.place, min: out.reduce((a, x) => a + x.min, 0), ex: out };
  }
  // what is kept on the phone
  const load = k => { try { return JSON.parse(localStorage.getItem(k)) || { sessions: [], runs: [] }; } catch (e) { return { sessions: [], runs: [] }; } };
  const save = (k, d) => { try { localStorage.setItem(k, JSON.stringify(d)); } catch (e) {} };
  const sessionText = (s, who) => `🏃 Entraînement perso de ${who} (${fmtD(s.done || s.date)}) : ${s.needs.join(', ')}, ${s.min} min, ${s.group ? 'à plusieurs' : 'seul'}${s.done ? ' · ✅ fait' : ''}\n` + s.ex.map((x, i) => `${i + 1}. ${x.title} (${x.min} min)`).join('\n');
  // the pace and the speed, from the time and the distance: « 5'30/km · 10,9 km/h »
  const pace = r => { if (!r.km || !r.min) return ''; const p = r.min / r.km, m = Math.floor(p), s = Math.round((p - m) * 60); return `${s === 60 ? m + 1 : m}'${String(s === 60 ? 0 : s).padStart(2, '0')}/km · ${(r.km / (r.min / 60)).toFixed(1).replace('.', ',')} km/h`; };
  const week = (runs, days) => { const from = new Date(); from.setDate(from.getDate() - days); const f = from.toISOString().slice(0, 10); return runs.filter(r => r.date >= f); };
  const runsText = (runs, who) => { const w = week(runs, 7); return `👟 Footings de ${who} (7 derniers jours) : ${w.length} sortie${w.length > 1 ? 's' : ''}, ${w.reduce((a, r) => a + (+r.min || 0), 0)} min, ${w.reduce((a, r) => a + (+r.km || 0), 0).toFixed(1).replace('.', ',')} km\n` + w.map(r => `${fmtD(r.date)} : ${r.min} min${r.km ? ', ' + String(r.km).replace('.', ',') + ' km (' + pace(r) + ')' : ''}${r.feel ? ', ressenti ' + r.feel + '/5' : ''}${r.note ? ' · ' + r.note : ''}`).join('\n'); };

  /* ---------- the screen (an overlay, the same on every page) ---------- */
  function open(ctx) {
    // ctx = { key, who, referee, send(text) → Promise (absent: no sending), toast(msg, err) }
    const toast = (m, err) => (ctx.toast ? ctx.toast(m, err) : alert(m));
    let d = load(ctx.key), tab = 'build', cur = null;
    const o = Object.assign({ needs: ['physique'], group: false, min: 30, place: 't' }, d.last || {});
    let ov = document.getElementById('psOverlay'); if (ov) ov.remove();
    ov = document.createElement('div'); ov.id = 'psOverlay'; ov.className = 'ps'; document.body.appendChild(ov);
    const prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const close = () => { ov.remove(); document.body.style.overflow = prevOverflow; };
    const chip = (on, attr, label) => `<button class="ps-chip ${on ? 'on' : ''}" ${attr}>${label}</button>`;
    const exCard = (x, i) => `<article class="ps-ex"><div class="ps-ex-h"><span class="ps-n">${i + 1}</span><b>${esc(x.title)}</b><span class="ps-min">${x.min} min</span></div>
      <p>${esc(x.org)}</p>${x.cons.length ? `<ul>${x.cons.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}${x.mat ? `<p class="ps-mat">🎒 ${esc(x.mat)}</p>` : ''}</article>`;
    const draw = () => {
      const runs = d.runs.slice().sort((a, b) => b.date.localeCompare(a.date)), w7 = week(d.runs, 7), w30 = week(d.runs, 30);
      ov.innerHTML = `<div class="ps-in"><header class="ps-top"><button class="ps-x" data-ps="close" aria-label="Fermer">✕</button><h2>🏃 Mon entraînement perso</h2></header>
        <nav class="ps-tabs">${[['build', 'Créer ma séance'], ['runs', '👟 Mes footings'], ['hist', '📒 Ce que j\'ai fait']].map(([k, l]) => chip(tab === k, `data-tab="${k}"`, l)).join('')}</nav>
        ${tab === 'build' ? `<section class="ps-card"><h3>De quoi as-tu besoin ?</h3><div class="ps-chips">${NEEDS.map(([k, l]) => chip(o.needs.includes(k), `data-need="${k}"`, l)).join('')}</div>
          <h3>Comment ?</h3><div class="ps-chips">${chip(!o.group, 'data-group="0"', '🙋 Seul')}${chip(o.group, 'data-group="1"', '👥 À plusieurs')}</div>
          <h3>Où ?</h3><div class="ps-chips">${chip(o.place === 't', 'data-place="t"', '🏟️ Terrain ou parc')}${chip(o.place === 'm', 'data-place="m"', '🏠 À la maison')}</div>
          <h3>Combien de temps ?</h3><div class="ps-chips">${[20, 30, 45, 60].map(m => chip(o.min === m, `data-min="${m}"`, m + ' min')).join('')}</div>
          <button class="ps-btn main" data-ps="make">✨ Créer ma séance</button></section>
          ${cur ? `<section class="ps-card"><h3>Ta séance · ${cur.min} min</h3>${cur.ex.map(exCard).join('')}
            <div class="ps-acts"><button class="ps-btn main" data-ps="done">✅ Je l'ai faite</button><button class="ps-btn" data-ps="again">🔄 Autre proposition</button>${ctx.send ? '<button class="ps-btn" data-ps="sendS">📤 Envoyer à mon coach</button>' : ''}</div></section>` : ''}` : ''}
        ${tab === 'runs' ? `<section class="ps-card"><h3>Ajouter un footing</h3>
          <div class="ps-row"><label>Date<input type="date" id="psDate" value="${today()}"></label><label>Durée<input id="psMin" inputmode="decimal" placeholder="35 ou 1h05" autocomplete="off"></label><label>Distance (km)<input id="psKm" inputmode="decimal" placeholder="6,5" autocomplete="off"></label></div>
          <h3>Ressenti</h3><div class="ps-chips" id="psFeel">${[1, 2, 3, 4, 5].map(n => chip(false, `data-feel="${n}"`, ['😫', '😕', '🙂', '😀', '🤩'][n - 1] + ' ' + n)).join('')}</div>
          <label class="ps-full">Note (facultatif)<input id="psNote" maxlength="120" placeholder="ex : jambes lourdes, belle sortie"></label>
          <button class="ps-btn main" data-ps="addRun">Ajouter</button></section>
          <section class="ps-card"><h3>Mes chiffres</h3><div class="ps-tiles"><div><b>${w7.length}</b><span>sorties en 7 jours</span></div><div><b>${w7.reduce((a, r) => a + (+r.min || 0), 0)}'</b><span>en 7 jours</span></div><div><b>${w30.reduce((a, r) => a + (+r.km || 0), 0).toFixed(1).replace('.', ',')}</b><span>km en 30 jours</span></div></div>
            ${runs.slice(0, 15).map(r => `<div class="ps-line"><span>${esc(fmtD(r.date))}</span><span>${r.min} min${r.km ? ' · ' + String(r.km).replace('.', ',') + ' km · ' + pace(r) : ''}${r.feel ? ' · ' + ['😫', '😕', '🙂', '😀', '🤩'][r.feel - 1] : ''}${r.note ? ' · ' + esc(r.note) : ''}</span><button class="ps-del" data-delrun="${r.id}" aria-label="Supprimer">✕</button></div>`).join('') || '<p class="ps-muted">Pas encore de footing noté.</p>'}
            ${ctx.send && w7.length ? '<button class="ps-btn" data-ps="sendR">📤 Envoyer mes footings de la semaine à mon coach</button>' : ''}</section>` : ''}
        ${tab === 'hist' ? `<section class="ps-card"><h3>Mes séances faites</h3>${d.sessions.slice().reverse().map(s => `<details class="ps-hist"><summary>${esc(fmtD(s.done))} · ${esc(s.needs.join(', '))} · ${s.min} min${s.sent ? ' · 📤 envoyée' : ''}</summary>${s.ex.map(exCard).join('')}${ctx.send && !s.sent ? `<button class="ps-btn" data-sendh="${s.id}">📤 Envoyer à mon coach</button>` : ''}</details>`).join('') || '<p class="ps-muted">Rien pour l\'instant : crée ta première séance.</p>'}</section>` : ''}
        <p class="ps-muted ps-foot">Tout reste sur ton téléphone. Seul ce que tu envoies arrive chez ton coach.</p></div>`;
    };
    const send = async (text, after) => { try { await ctx.send(text); toast('Envoyé à ton coach 👍'); if (after) after(); save(ctx.key, d); draw(); } catch (e) { toast(e.message || 'Envoi impossible', true); } };
    ov.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.ps === 'close') return close();
      if (b.dataset.tab) { tab = b.dataset.tab; return draw(); }
      if (b.dataset.need) { const k = b.dataset.need; o.needs = o.needs.includes(k) ? o.needs.filter(x => x !== k) : [...o.needs, k]; return draw(); }
      if (b.dataset.group) { o.group = b.dataset.group === '1'; return draw(); }
      if (b.dataset.place) { o.place = b.dataset.place; return draw(); }
      if (b.dataset.min) { o.min = +b.dataset.min; return draw(); }
      if (b.dataset.ps === 'make' || b.dataset.ps === 'again') { if (!o.needs.length) return toast('Choisis au moins un besoin', true); cur = build(o, ctx.referee); d.last = o; save(ctx.key, d); draw(); const c = ov.querySelectorAll('.ps-card')[1]; if (c) c.scrollIntoView({ behavior: 'smooth' }); return; }
      if (b.dataset.ps === 'done') { cur.done = today(); d.sessions.push(cur); save(ctx.key, d); toast('Bravo ! Séance notée 💪'); const s = cur; cur = null; tab = 'hist'; draw(); void s; return; }
      if (b.dataset.ps === 'sendS') return send(sessionText(cur, ctx.who));
      if (b.dataset.sendh) { const s = d.sessions.find(x => x.id === b.dataset.sendh); return send(sessionText(s, ctx.who), () => { s.sent = true; }); }
      if (b.dataset.feel) { ov.querySelectorAll('[data-feel]').forEach(x => x.classList.toggle('on', x === b)); return; }
      if (b.dataset.ps === 'addRun') {
        // « 35 », « 1h05 », « 1:05 » → minutes ; « 6,5 » or « 6.5 » km
        const tm = String(ov.querySelector('#psMin').value).trim().toLowerCase().replace(',', '.'), hm = tm.match(/^(\d+)\s*[h:]\s*(\d{0,2})/);
        const min = hm ? +hm[1] * 60 + (+hm[2] || 0) : Math.round(parseFloat(tm) || 0), km = Math.round((parseFloat(String(ov.querySelector('#psKm').value).replace(',', '.')) || 0) * 100) / 100, f = ov.querySelector('[data-feel].on');
        if (!min || min > 600) return toast('Écris la durée (ex : 35 ou 1h05)', true);
        if (km > 200) return toast('Distance trop grande', true);
        d.runs.push({ id: Date.now().toString(36), date: ov.querySelector('#psDate').value || today(), min, km: km || 0, feel: f ? +f.dataset.feel : 0, note: ov.querySelector('#psNote').value.trim() });
        save(ctx.key, d); toast('Footing noté 👟'); return draw();
      }
      if (b.dataset.delrun) { d.runs = d.runs.filter(r => r.id !== b.dataset.delrun); save(ctx.key, d); return draw(); }
      if (b.dataset.ps === 'sendR') return send(runsText(d.runs, ctx.who));
    };
    draw();
  }
  // its look: the same on the app and on the players' / parents' pages, big letters for the phone
  const css = `.ps{position:fixed;inset:0;z-index:2000;background:rgba(10,18,40,.55);overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.ps-in{max-width:720px;margin:0 auto;min-height:100%;background:#f6f4ef;color:#141a2e;padding:calc(env(safe-area-inset-top) + 12px) 14px 40px;font-size:17px;line-height:1.45;font-family:inherit}
.ps-top{display:flex;align-items:center;gap:10px;position:sticky;top:0;background:#f6f4ef;padding:6px 0;z-index:1}.ps-top h2{margin:0;font-size:21px}
.ps-x{border:0;background:#0e1d45;color:#fff;width:40px;height:40px;border-radius:50%;font-size:18px;flex:none}
.ps-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.ps-chips{display:flex;gap:8px;flex-wrap:wrap}
.ps-chip{border:1.5px solid #c9cdd8;background:#fff;border-radius:99px;padding:9px 14px;font-size:16px;font-weight:600;color:#141a2e}.ps-chip.on{background:#0e1d45;border-color:#0e1d45;color:#fff}
.ps-card{background:#fff;border-radius:16px;padding:14px;margin:12px 0;box-shadow:0 2px 10px rgba(0,0,0,.06)}.ps-card h3{margin:12px 0 8px;font-size:17px}.ps-card h3:first-child{margin-top:0}
.ps-btn{border:0;border-radius:12px;padding:13px 16px;font-size:16px;font-weight:700;background:#e9e6de;color:#141a2e;margin-top:12px}.ps-btn.main{background:#8c1024;color:#fff;width:100%}
.ps-acts{display:flex;flex-direction:column;gap:0}.ps-ex{border-top:1px solid #ece9e1;padding:12px 0}.ps-ex p{margin:6px 0}.ps-ex ul{margin:6px 0;padding-left:20px}
.ps-ex-h{display:flex;align-items:center;gap:8px}.ps-ex-h b{flex:1;font-size:18px}.ps-n{background:#0e1d45;color:#fff;border-radius:50%;width:28px;height:28px;display:grid;place-items:center;font-size:14px;flex:none}
.ps-min{font-weight:700;color:#8c1024;white-space:nowrap}.ps-mat{color:#555}.ps-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.ps-row label,.ps-full{display:flex;flex-direction:column;font-size:14px;font-weight:600;gap:4px}.ps-full{margin-top:10px}
.ps input{font-size:17px;padding:10px;border:1.5px solid #c9cdd8;border-radius:10px;width:100%;box-sizing:border-box;background:#fff;color:#141a2e}
.ps-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px}.ps-tiles div{background:#f6f4ef;border-radius:12px;padding:10px;text-align:center}.ps-tiles b{display:block;font-size:22px}.ps-tiles span{font-size:13px}
.ps-line{display:flex;gap:8px;align-items:center;border-top:1px solid #ece9e1;padding:8px 0}.ps-line span:first-child{font-weight:700;min-width:96px}.ps-line span:nth-child(2){flex:1}
.ps-del{border:0;background:none;color:#999;font-size:16px}.ps-muted{color:#666;font-size:15px}.ps-hist summary{font-weight:700;padding:8px 0}.ps-foot{text-align:center}
@media (max-width:480px){.ps-row{grid-template-columns:1fr 1fr}.ps-row label:first-child{grid-column:1 / -1}}`;
  if (typeof document !== 'undefined') { const st = document.createElement('style'); st.textContent = css; (document.head || document.documentElement).appendChild(st); }
  return { open, build, bank };
})();
