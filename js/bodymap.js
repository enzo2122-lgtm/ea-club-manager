/* (1.81) A realistic human body (muscles) to point at the painful zone: a touch on a zone gives the usual injuries there
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
    chest: ['Poitrine / haut du dos', ['Côtes', 'Pectoraux', 'Sternum', 'Haut du dos (dorsales)', 'Omoplate', 'Trapèzes']],
    abdo: ['Ventre / bas du dos', ['Abdominaux', 'Obliques', 'Bas du dos (lombaires)', 'Lumbago', 'Point de côté']],
    groin: ['Aine / hanche / fessier', ['Aine (adducteurs)', 'Pubalgie', 'Psoas (fléchisseur de hanche)', 'Hanche', 'Fessier', 'Sciatique']],
    thigh: ['Cuisse', ['Ischio-jambiers (arrière)', 'Quadriceps (devant)', 'Adducteurs (intérieur)', 'Élongation des ischios', 'Déchirure des ischios', 'Contusion (béquille)']],
    knee: ['Genou', ['Ligament croisé (LCA)', 'Ligament latéral interne', 'Ligament latéral externe', 'Ménisque', 'Rotule / tendon rotulien']],
    shin: ['Jambe / mollet', ['Mollet', 'Tennis leg (déchirure du mollet)', 'Tibia (périostite)', 'Péroné', 'Contusion (coup de crampon)', 'Crampe']],
    ankle: ['Cheville / Achille', ['Entorse de la cheville', 'Ligaments de la cheville', 'Malléole', 'Tendon d\'Achille']],
    foot: ['Pied', ['Orteil', 'Voûte plantaire', 'Métatarse', 'Dessus du pied', 'Talon', 'Aponévrose plantaire']],
    upback: ['Haut du dos', ['Dorsales', 'Omoplate', 'Trapèzes']],
    lowback: ['Bas du dos', ['Lombaires', 'Lumbago', 'Sciatique']],
    glute: ['Fessier', ['Fessier', 'Sciatique', 'Pyramidal']],
    ham: ['Arrière de la cuisse', ['Ischio-jambiers', 'Élongation des ischios', 'Déchirure des ischios']],
    calf: ['Mollet', ['Mollet', 'Tennis leg (déchirure du mollet)', 'Crampe']],
    achilles: ['Talon / Achille', ['Tendon d\'Achille', 'Talon', 'Aponévrose plantaire']],
  };
  const TYPES = ['Entorse', 'Contracture', 'Élongation', 'Déchirure', 'Choc / contusion', 'Tendinite', 'Fracture', 'Luxation', 'Douleur', 'Autre'];
  const DAYS = [[3, 'Quelques jours'], [7, '1 semaine'], [14, '2 semaines'], [21, '3 semaines'], [30, '1 mois'], [42, '6 semaines'], [90, '3 mois'], [0, 'Je ne sais pas']];
  // the picture: a body with its muscles (johnbloor, Pixabay, CC0, through Wikimedia Commons), 536 × 1220; the clickable zones over it.
  // A shape is drawn on the left of the picture (his right side); MIR copies it to the other side.
  const IMG = 'img/corps-face.jpg', W = 536, H = 1220;
  const MIR = ` transform="matrix(-1 0 0 1 ${W} 0)"`, mir = el => el.replace(/^<(\w+)/, '<$1' + MIR);
  const P = {
    head: '<ellipse cx="268" cy="108" rx="62" ry="88"/>', neck: '<rect x="222" y="190" width="92" height="52" rx="18"/>',
    shoulder: '<circle cx="158" cy="288" r="44"/>',
    chest: '<path d="M200,248 L336,248 L352,300 L346,378 L190,378 L184,300 Z"/>',
    abdo: '<path d="M196,378 L340,378 L338,450 L344,528 L192,528 L198,450 Z"/>',
    groin: '<path d="M178,528 L358,528 L366,600 L300,660 L268,668 L236,660 L170,600 Z"/>',
    arm: '<polygon points="128,318 180,330 168,470 128,600 76,610 98,470"/>',
    hand: '<ellipse cx="55" cy="662" rx="50" ry="56"/>',
    thigh: '<polygon points="168,600 236,662 262,690 256,826 190,826 168,700"/>',
    knee: '<ellipse cx="222" cy="856" rx="40" ry="40"/>',
    shin: '<polygon points="186,894 256,894 250,1060 202,1060"/>',
    ankle: '<ellipse cx="224" cy="1088" rx="32" ry="24"/>',
    foot: '<ellipse cx="208" cy="1152" rx="58" ry="50"/>',
  };
  const two = (z, el) => [[z, 'd', el], [z, 'g', mir(el)]];
  const SHAPES = [['head', '', P.head], ['neck', '', P.neck], ['chest', '', P.chest], ['abdo', '', P.abdo], ['groin', '', P.groin],
    ...two('shoulder', P.shoulder), ...two('arm', P.arm), ...two('hand', P.hand), ...two('thigh', P.thigh), ...two('knee', P.knee),
    ...two('shin', P.shin), ...two('ankle', P.ankle), ...two('foot', P.foot)];
  const SIDE = { d: 'droit', g: 'gauche' };
  function css() {
    if (document.getElementById('bmCss')) return;
    const st = document.createElement('style'); st.id = 'bmCss';
    st.textContent = '.bm{display:flex;justify-content:center;margin:6px 0}.bm figure{margin:0;text-align:center}.bm figcaption{font-size:11px;opacity:.6}'
      + '.bm svg{width:min(230px,62vw);height:auto;touch-action:manipulation;display:block}'
      + '.bm [data-bz]{fill:rgba(220,38,38,0);stroke:none;cursor:pointer;transition:fill .15s}.bm [data-bz]:hover{fill:rgba(239,68,68,.28)}.bm [data-bz].on{fill:rgba(220,38,38,.55);stroke:#b91c1c;stroke-width:4}'
      + '.bm-sug{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.bm-sug button,.bm-chips button{border:1px solid #d6d0cb;background:#fff;color:#14172b;border-radius:999px;padding:8px 12px;font:inherit;font-size:14px;cursor:pointer}'
      + '.bm-sug button.on,.bm-chips button.on{background:#dc2626;border-color:#dc2626;color:#fff}.bm-chips{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 10px}.bm-lbl{font-weight:700;margin:10px 0 2px}'
      + '@media (prefers-color-scheme: dark){.bm-sug button,.bm-chips button{background:#18223f;color:#eceef6;border-color:#263156}}';
    document.head.appendChild(st);
  }
  const view = sel => `<figure><svg viewBox="0 0 ${W} ${H}" role="group" aria-label="Le corps"><image href="${IMG}" width="${W}" height="${H}"/>${SHAPES.map(([z, s, el]) => el.replace(/^<(\w+)/, `<$1 data-bz="${z}" data-bs="${s}" class="${sel.zone === z && (sel.side || '') === s ? 'on' : ''}"`).replace('/>', `><title>${esc(ZONES[z][0] + (s ? ' ' + SIDE[s] : ''))}</title></${el.match(/^<(\w+)/)[1]}>`)).join('')}</svg><figcaption>Sa droite est à ta gauche · avant et arrière du corps</figcaption></figure>`;
  // the body, the injuries of the chosen zone, the kind, the time to recover (opts.noDays: without the time)
  function html(sel, opts = {}) {
    css(); const z = ZONES[sel.zone];
    return `<p class="bm-lbl">1. Touche la zone douloureuse</p><div class="bm">${view(sel)}</div>
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
