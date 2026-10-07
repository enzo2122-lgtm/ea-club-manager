/* (1.81) A human body (front and back) to point at the painful zone: a touch on a zone gives the usual injuries there
   (groin, hamstrings, knee ligaments…). Shared by the coach's app (Infirmerie) and the players' and parents' pages.
   html(sel) draws it; sel = { zone, side, part, type, days }. The page calls click(e, sel) and redraws when it returns true. */
const BodyMap = (() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // zone: [name, the usual injuries]
  const ZONES = {
    head: ['Tête', ['Commotion (choc à la tête)', 'Nez', 'Mâchoire / dents', 'Arcade', 'Œil']],
    neck: ['Cou / nuque', ['Torticolis', 'Cervicales', 'Coup du lapin']],
    shoulder: ['Épaule', ['Luxation de l\'épaule', 'Clavicule', 'Coiffe des rotateurs', 'Acromio-claviculaire']],
    arm: ['Bras / coude', ['Coude', 'Avant-bras', 'Biceps', 'Triceps']],
    hand: ['Poignet / main', ['Entorse du poignet', 'Doigt', 'Pouce', 'Main']],
    chest: ['Poitrine / côtes', ['Côtes', 'Pectoraux', 'Sternum']],
    abdo: ['Ventre', ['Abdominaux', 'Point de côté', 'Obliques']],
    groin: ['Aine / hanche', ['Aine (adducteurs)', 'Pubalgie', 'Psoas (fléchisseur de hanche)', 'Hanche']],
    thigh: ['Cuisse (devant)', ['Quadriceps', 'Droit fémoral', 'Contusion (béquille)']],
    knee: ['Genou', ['Ligament croisé (LCA)', 'Ligament latéral interne', 'Ligament latéral externe', 'Ménisque', 'Rotule / tendon rotulien']],
    shin: ['Tibia / jambe', ['Tibia (périostite)', 'Contusion (coup de crampon)', 'Péroné']],
    ankle: ['Cheville', ['Entorse de la cheville', 'Ligaments de la cheville', 'Malléole']],
    foot: ['Pied', ['Orteil', 'Voûte plantaire', 'Métatarse', 'Dessus du pied']],
    upback: ['Haut du dos', ['Dorsales', 'Omoplate', 'Trapèzes']],
    lowback: ['Bas du dos', ['Lombaires', 'Lumbago', 'Sciatique']],
    glute: ['Fessier', ['Fessier', 'Sciatique', 'Pyramidal']],
    ham: ['Arrière de la cuisse', ['Ischio-jambiers', 'Élongation des ischios', 'Déchirure des ischios']],
    calf: ['Mollet', ['Mollet', 'Tennis leg (déchirure du mollet)', 'Crampe']],
    achilles: ['Talon / Achille', ['Tendon d\'Achille', 'Talon', 'Aponévrose plantaire']],
  };
  const TYPES = ['Entorse', 'Contracture', 'Élongation', 'Déchirure', 'Choc / contusion', 'Tendinite', 'Fracture', 'Luxation', 'Douleur', 'Autre'];
  const DAYS = [[3, 'Quelques jours'], [7, '1 semaine'], [14, '2 semaines'], [21, '3 semaines'], [30, '1 mois'], [42, '6 semaines'], [90, '3 mois'], [0, 'Je ne sais pas']];
  // the drawing (viewBox 120 × 240): a human body, the clickable zones over it, the skeleton on top (it lets the touches through).
  // A shape is drawn on the left of the picture; MIR copies it to the right. Front view: his right on our left; back view: the opposite.
  const MIR = ' transform="matrix(-1 0 0 1 120 0)"', mir = el => el.replace(/^<(\w+)/, '<$1' + MIR);
  const P = {
    head: '<ellipse cx="60" cy="19" rx="11" ry="13"/>', neck: '<path d="M54.5,29 L65.5,29 L66.5,39 L53.5,39 Z"/>',
    torso: '<path d="M54,37 C44,38 36,40 33,46 C31,51 33,60 37,70 C39,78 42,84 43,90 C42,96 39,102 40,110 L80,110 C81,102 78,96 77,90 C78,84 81,78 83,70 C87,60 89,51 87,46 C84,40 76,38 66,37 Z"/>',
    arm: '<path d="M35,45 C29,47 26.5,55 25.5,65 L23.5,84 C22,94 21,104 20.5,112 L27,113 C28,104 29.5,95 31,86 L33.5,70 C34.5,62 37,55 38,50 Z"/>',
    hand: '<ellipse cx="23.5" cy="120" rx="4.5" ry="7.5"/>',
    leg: '<path d="M40,108 C38.5,125 41,145 44,160 C45,167 44.5,170 44.2,175 C44,193 46,208 47.8,221 L54.2,221 C55.3,208 56.3,193 56.6,175 C56.4,170 56.5,166 57.5,160 C58.5,145 59.5,125 60,108 Z"/>',
    foot: '<path d="M46.5,224 L55,224 L57,232 C57.5,236 53,237.5 48,237 C43.5,236.5 42,234 44,231 Z"/>',
    shoulder: '<circle cx="37" cy="48" r="7"/>',
    chest: '<path d="M44,40 C50,38.5 70,38.5 76,40 C80,42 82,50 81,58 L79,70 L41,70 L39,58 C38,50 40,42 44,40 Z"/>',
    abdo: '<path d="M41,70 L79,70 C78,78 77,85 77.5,92 L42.5,92 C43,85 42,78 41,70 Z"/>',
    groin: '<path d="M42.5,92 L77.5,92 C79,98 80,104 80,110 C73,113 66,114 60,114 C54,114 47,113 40,110 C40,104 41,98 42.5,92 Z"/>',
    glute: '<path d="M41,92 L60,92 L60,114 C52,116 44,114 40.5,110 C40,104 40.5,97 41,92 Z"/>',
    thigh: '<path d="M40,108 C38.5,125 41,145 44,160 L57.5,160 C58.5,145 59.5,125 60,108 Z"/>',
    knee: '<ellipse cx="50.5" cy="166.5" rx="7" ry="7.5"/>',
    shin: '<path d="M44.2,173 C44,193 46,208 47.8,218 L54.2,218 C55.3,208 56.3,193 56.6,173 Z"/>',
    calf: '<path d="M44.2,173 C43.5,186 45,198 47.5,209 L54.5,209 C56.5,198 57.3,186 56.6,173 Z"/>',
    ankle: '<ellipse cx="51" cy="221.5" rx="4.8" ry="3.6"/>', achilles: '<rect x="48" y="209" width="6" height="13" rx="3"/>',
    heel: '<ellipse cx="51" cy="229" rx="5.5" ry="6"/>',
  };
  const BODY = [P.head, P.neck, P.torso, P.arm, mir(P.arm), P.hand, mir(P.hand), P.leg, mir(P.leg), P.foot, mir(P.foot)].join('');
  // [zone, side, shape]: one per side for the limbs (the left one of the picture first)
  const two = (z, el, front) => [[z, front ? 'd' : 'g', el], [z, front ? 'g' : 'd', mir(el)]];
  const FRONT = [['head', '', P.head], ['neck', '', P.neck], ['chest', '', P.chest], ['abdo', '', P.abdo], ['groin', '', P.groin],
    ...two('shoulder', P.shoulder, 1), ...two('arm', P.arm, 1), ...two('hand', P.hand, 1), ...two('thigh', P.thigh, 1), ...two('knee', P.knee, 1),
    ...two('shin', P.shin, 1), ...two('ankle', P.ankle, 1), ...two('foot', P.foot, 1)];
  const BACK = [['head', '', P.head], ['neck', '', P.neck], ['upback', '', P.chest], ['lowback', '', P.abdo],
    ...two('glute', P.glute, 0), ...two('shoulder', P.shoulder, 0), ...two('arm', P.arm, 0), ...two('hand', P.hand, 0), ...two('ham', P.thigh, 0), ...two('knee', P.knee, 0),
    ...two('calf', P.calf, 0), ...two('achilles', P.achilles, 0), ...two('foot', P.heel, 0)];
  // the bones: one side of the limbs (copied to the other side), then the middle (skull, ribs, spine, pelvis)
  const ribs = (y0, n) => Array.from({ length: n }, (_, i) => `M60,${y0 + 5 * i} C54,${y0 - 1 + 5 * i} 47,${y0 + 1 + 5 * i} 44.5,${y0 + 7 + 5 * i}`).join(' ');
  const LIMB = 'M59,41 C52,40 44,41.5 37,45 M35.5,50 L28.5,82 M27.5,86 L22.5,110 M30,86 L25.5,111 M22,115 L21,126 M24,115 L24,127 M26,115 L27,126 '
    + 'M47,106 L50.5,159 M50.5,164 a2.3,2.3 0 1,0 0.01,0 M50,172 L50.5,217 M46.2,175 L47.5,214 M49,225 L47.5,234 M51.5,225 L51.5,235 M54,225 L55,233';
  const SKULL = 'M60,8 C52,8 50,14 50,19 C50,24 53,26 54,28 L66,28 C67,26 70,24 70,19 C70,14 68,8 60,8 Z ';
  const PELVIS = 'M44,95 C43,104 50,110 60,108 C70,110 77,104 76,95 C70,100 65,103 60,103 C55,103 50,100 44,95 Z';
  const BONES = {
    front: [LIMB + ' ' + ribs(47, 5), SKULL + 'M55,15 a2.5,2.5 0 1,0 0.01,0 M65,15 a2.5,2.5 0 1,0 0.01,0 M54,24 Q60,32 66,24 M60,42 L60,66 M60,70 L60,90 ' + PELVIS],
    back: [LIMB + ' ' + ribs(47, 5) + ' M41,48 L52,47 L46,64 Z', SKULL + 'M60,30 L60,100 ' + Array.from({ length: 14 }, (_, i) => `M58,${33 + 5 * i} L62,${33 + 5 * i}`).join(' ') + ' ' + PELVIS],
  };
  const bones = k => { const [side, mid] = BONES[k], d = side + ' ' + mid; return `<g class="bm-bones"><path class="bo" d="${d}"/><path class="bo" d="${side}"${MIR}/><path class="bi" d="${d}"/><path class="bi" d="${side}"${MIR}/></g>`; };
  const SIDE = { d: 'droit', g: 'gauche' };
  function css() {
    if (document.getElementById('bmCss')) return;
    const st = document.createElement('style'); st.id = 'bmCss';
    st.textContent = '.bm{display:flex;justify-content:center;gap:14px;margin:6px 0}.bm figure{margin:0;text-align:center}.bm figcaption{font-size:12px;font-weight:700;opacity:.7}'
      + '.bm svg{width:min(140px,41vw);height:auto;touch-action:manipulation}.bm-body *{fill:#f1cfb6;stroke:#c99a7c;stroke-width:.7}'
      + '.bm [data-bz]{fill:rgba(220,38,38,0);stroke:none;cursor:pointer;transition:fill .15s}.bm [data-bz]:hover{fill:rgba(239,68,68,.3)}.bm [data-bz].on{fill:rgba(220,38,38,.62)}'
      + '.bm-bones path{fill:none;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}.bm-bones .bo{stroke:#a38a74;stroke-width:2.5}.bm-bones .bi{stroke:#fffdf6;stroke-width:1.3}'
      + '.bm-sug{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.bm-sug button,.bm-chips button{border:1px solid #d6d0cb;background:#fff;color:#14172b;border-radius:999px;padding:8px 12px;font:inherit;font-size:14px;cursor:pointer}'
      + '.bm-sug button.on,.bm-chips button.on{background:#dc2626;border-color:#dc2626;color:#fff}.bm-chips{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 10px}.bm-lbl{font-weight:700;margin:10px 0 2px}'
      + '@media (prefers-color-scheme: dark){.bm-body *{fill:#8a6b58;stroke:#5c4536}.bm-sug button,.bm-chips button{background:#18223f;color:#eceef6;border-color:#263156}}';
    document.head.appendChild(st);
  }
  const view = (shapes, sel, cap, k) => `<figure><svg viewBox="15 2 90 240" role="group" aria-label="${cap}"><g class="bm-body">${BODY}</g>${shapes.map(([z, s, el]) => el.replace(/^<(\w+)/, `<$1 data-bz="${z}" data-bs="${s}" class="${sel.zone === z && (sel.side || '') === s ? 'on' : ''}"`).replace('/>', `><title>${esc(ZONES[z][0] + (s ? ' ' + SIDE[s] : ''))}</title></${el.match(/^<(\w+)/)[1]}>`)).join('')}${bones(k)}</svg><figcaption>${cap}</figcaption></figure>`;
  // the body, the injuries of the chosen zone, the kind, the time to recover (opts.noDays: without the time)
  function html(sel, opts = {}) {
    css(); const z = ZONES[sel.zone];
    return `<p class="bm-lbl">1. Touche la zone douloureuse</p><div class="bm">${view(FRONT, sel, 'Face', 'front')}${view(BACK, sel, 'Dos', 'back')}</div>
      ${z ? `<p class="bm-lbl">2. ${esc(z[0])}${sel.side ? ' ' + SIDE[sel.side] : ''} : c'est plutôt…</p><div class="bm-sug">${z[1].map(x => `<button type="button" class="${sel.part === x ? 'on' : ''}" data-bpart="${esc(x)}">${esc(x)}</button>`).join('')}<button type="button" class="${sel.part === z[0] ? 'on' : ''}" data-bpart="${esc(z[0])}">Je ne sais pas</button></div>` : ''}
      ${z ? `<p class="bm-lbl">3. Le type de blessure</p><div class="bm-chips">${TYPES.map(x => `<button type="button" class="${sel.type === x ? 'on' : ''}" data-btype="${esc(x)}">${esc(x)}</button>`).join('')}</div>` : ''}
      ${z && !opts.noDays ? `<p class="bm-lbl">4. Temps de rétablissement estimé</p><div class="bm-chips">${DAYS.map(([n, l]) => `<button type="button" class="${sel.days === n ? 'on' : ''}" data-bdays="${n}">${l}</button>`).join('')}</div>` : ''}`;
  }
  function click(e, sel) {
    const z = e.target.closest('[data-bz]');
    if (z) { const nz = z.dataset.bz; if (nz !== sel.zone) { sel.part = ''; } sel.zone = nz; sel.side = z.dataset.bs || ''; if (!sel.part) sel.part = ''; return true; }
    const p = e.target.closest('[data-bpart]'); if (p) { sel.part = p.dataset.bpart; return true; }
    const t = e.target.closest('[data-btype]'); if (t) { sel.type = sel.type === t.dataset.btype ? '' : t.dataset.btype; return true; }
    const d = e.target.closest('[data-bdays]'); if (d) { sel.days = +d.dataset.bdays; return true; }
    return false;
  }
  // « Ischio-jambiers (gauche) »
  const partLabel = sel => sel.part ? sel.part + (sel.side ? ` (${SIDE[sel.side]})` : '') : '';
  return { html, click, partLabel, ZONES, TYPES, DAYS, SIDE };
})();
