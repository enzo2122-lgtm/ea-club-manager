/* Editor: the interactive tactical board (place players, draw arrows and zones, build steps, play the animation). */
const Editor = (() => {
  const { esc } = UI;
  let E = null;
  const TOOLS = [
    ['move', 'Bouger', 'hand'], ['home', 'Joueur', 'player'], ['away', 'Adversaire', 'player'], ['gk', 'Gardien', 'player'],
    ['ball', 'Ballon', 'ball'], ['cone', 'Plot', 'cone'], ['goal', 'But', 'goal'], ['arrow', 'Flèche', 'arrow'], ['zone', 'Zone', 'zone'], ['erase', 'Gomme', 'eraser'],
  ];
  const HINTS = {
    move: 'Fais glisser un joueur pour le placer. Touche une flèche ou une zone pour la modifier.',
    home: 'Touche le terrain pour ajouter un joueur de ton équipe.',
    away: 'Touche le terrain pour ajouter un adversaire.',
    gk: `Touche le ${Sport.cur().place === 'salle' ? 'terrain' : 'terrain'} pour ajouter un ${(Sport.cur().gk || 'gardien').toLowerCase()}.`,
    ball: 'Touche le terrain pour poser un ballon.',
    cone: 'Touche le terrain pour poser un plot.',
    goal: 'Touche le terrain pour poser un but.',
    arrow: 'Glisse depuis un joueur ou le ballon : il fera ce mouvement quand tu touches « Jouer ».',
    zone: 'Glisse ton doigt sur le terrain pour dessiner une zone.',
    erase: 'Touche ce que tu veux effacer.',
  };
  const DURS = [[3, 'Lent'], [2, 'Normal'], [1.3, 'Rapide']];
  const club = () => Store.state.club;
  const cur = () => E.sc.steps[E.k];
  const findArrow = id => (cur().arrows || []).find(a => a.id === id);
  const findZone = id => (E.sc.zones || []).find(z => z.id === id);
  const findObj = id => E.sc.objects.find(o => o.id === id);

  /* ---------- lifecycle ---------- */
  // Full screen (computer, Android, iPad): hides the browser's bars; not available on iPhone
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
  const canFs = () => !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
  function fullscreen(on) {
    const d = document.documentElement;
    try {
      if (on && !fsEl()) { const p = (d.requestFullscreen || d.webkitRequestFullscreen).call(d); if (p && p.catch) p.catch(() => {}); }
      if (!on && fsEl()) { const p = (document.exitFullscreen || document.webkitExitFullscreen).call(document); if (p && p.catch) p.catch(() => {}); }
    } catch (e) {}
  }
  function open(root, sc, opts = {}) {
    close();
    sc.overlays = sc.overlays || {}; sc.zones = sc.zones || [];
    sc.steps.forEach(st => { st.arrows = st.arrows || []; st.moves = st.moves || {}; });
    // scratch = whiteboard: nothing is saved, the drawing disappears when the coach leaves
    E = { sc, k: 0, tool: 'move', arrowType: 'course', zoneColor: 'jaune', coneColor: 'orange', sel: null, playing: false, hist: [], fut: [], drag: null, root, back: opts.back, dpr: 1, scratch: !!opts.scratch };
    root.innerHTML = `<div class="ed ${E.scratch ? 'ed-scratch' : ''}">
      <header class="ed-top">
        <button class="icon-btn" data-act="back" aria-label="Retour">${I.back}</button>
        ${E.scratch ? `<span class="ed-title ed-wb">✏️ Tableau blanc <i>rien n'est enregistré</i></span>` : `<input class="ed-title" id="edTitle" value="${esc(sc.name)}" aria-label="Nom du schéma" maxlength="80">`}
        <span class="grow"></span>
        <button class="icon-btn" data-act="help" aria-label="Aide">${I.help}</button>
        ${canFs() ? `<button class="icon-btn" data-act="fullscreen" aria-label="Plein écran">${I.expand}</button>` : ''}
        <button class="icon-btn opt-btn" data-act="panel" aria-label="Options du terrain">${I.layers}</button>
        <button class="icon-btn" data-act="undo" aria-label="Annuler">${I.undo}</button>
        <button class="icon-btn" data-act="redo" aria-label="Rétablir">${I.redo}</button>
        ${E.scratch ? `<button class="icon-btn" data-act="wipe" aria-label="Tout effacer">${I.eraser}</button><button class="btn" data-act="keep">${I.download}<span>Garder</span></button>`
          : `<button class="icon-btn" data-act="duplicate" aria-label="Dupliquer le schéma" title="Dupliquer">${I.copy}</button>`}
        <button class="btn primary" data-act="export">${I.share}<span>Exporter</span></button>
      </header>
      <nav class="ed-tools" id="edTools" aria-label="Outils"></nav>
      <div class="ed-stage"><canvas aria-label="Terrain"></canvas><div class="ed-sub" id="edSub"></div><div class="ed-hint" id="edHint"></div></div>
      <aside class="ed-side" id="edSide"></aside>
      <footer class="ed-steps" id="edSteps"></footer>
    </div>`;
    E.canvas = root.querySelector('canvas'); E.ctx = E.canvas.getContext('2d');
    bind(); renderTools(); renderSteps(); renderPanel();
    E.ro = new ResizeObserver(resize); E.ro.observe(root.querySelector('.ed-stage'));
    resize();
    Board.ensureBg(sc).then(() => { if (E && E.sc === sc) draw(); });
  }
  function close() {
    if (!E) return;
    if (E.saveT) { clearTimeout(E.saveT); if (!E.scratch) Store.upsert('schemas', E.sc); }
    if (E.scratch) fullscreen(false);
    E.playing = false; cancelAnimationFrame(E.raf); E.ro && E.ro.disconnect(); E = null;
  }
  function resize() {
    if (!E) return;
    // the canvas's own size (on touch screens it keeps a margin from the screen edges, see app.css)
    const cv = E.canvas, dpr = Math.min(2, window.devicePixelRatio || 1);
    E.dpr = dpr; cv.width = Math.max(10, cv.clientWidth * dpr); cv.height = Math.max(10, cv.clientHeight * dpr);
    draw();
  }

  /* ---------- model changes ---------- */
  function snapshot() { E.hist.push(JSON.stringify(E.sc)); if (E.hist.length > 60) E.hist.shift(); E.fut = []; }
  function restore(json) {
    const obj = JSON.parse(json), sc = E.sc;
    Object.keys(sc).forEach(k => delete sc[k]); Object.assign(sc, obj);
    E.k = Math.min(E.k, sc.steps.length - 1); E.sel = null;
    commit(); renderSteps(); renderPanel();
  }
  function undo() { if (!E.hist.length) return UI.toast('Rien à annuler'); E.fut.push(JSON.stringify(E.sc)); restore(E.hist.pop()); }
  function redo() { if (!E.fut.length) return; E.hist.push(JSON.stringify(E.sc)); restore(E.fut.pop()); }
  function commit() { clearTimeout(E.saveT); E.saveT = null; if (!E.scratch) Store.upsert('schemas', E.sc); draw(); }
  // A copy of the schema (new name « … (copie) »), opened right away
  function duplicate() {
    commit();
    const c = JSON.parse(JSON.stringify(E.sc)); c.id = Store.uid(); c.name = (E.sc.name || 'Schéma') + ' (copie)'; delete c.example;
    Store.upsert('schemas', c); UI.toast('Copie créée : tu peux la modifier');
    location.hash = '#/schema/' + c.id;
  }
  // Whiteboard → a real schema, if the coach wants to keep the drawing after all
  function keepScratch() {
    UI.modal({ title: 'Garder ce dessin', body: `<label class="fld"><span>Nom du schéma</span><input id="kpName" maxlength="80" placeholder="ex : Pressing sur la relance"></label>
      <p class="tip">Le dessin devient un schéma normal, rangé dans Schémas.</p>`,
      actions: [{ label: 'Annuler' }, { label: 'Enregistrer', kind: 'primary', onClick: (c, r) => {
        const sc = JSON.parse(JSON.stringify(E.sc)); sc.id = Store.uid(); delete sc.scratch;
        sc.name = r.querySelector('#kpName').value.trim() || 'Tableau du ' + new Date().toLocaleDateString('fr-FR');
        Store.upsert('schemas', sc); E.scratch = false; UI.toast('Schéma enregistré');
        location.hash = '#/schema/' + sc.id;
      } }] });
  }
  // typing: saved half a second after the last letter (nothing is lost if the app is closed right after)
  function saveSoon() { clearTimeout(E.saveT); E.saveT = setTimeout(() => { if (E) commit(); }, 500); draw(); }

  // (2.84) the compo of a match: the players to choose from are its convoked ones (the whole category otherwise)
  const matchOf = sc => sc && Store.state.matches.find(m => m.lineupId === sc.id);
  function pool(sc) {
    const all = sc.teamId ? Store.rosterOf(sc.teamId) : [], m = matchOf(sc);
    return m && (m.convoked || []).length ? all.filter(p => m.convoked.includes(p.id)) : all;
  }
  // the convoked players not on the field yet: on the touchline, in a row, like a bench
  function placeBench() {
    const sc = E.sc, onField = new Set(sc.objects.map(o => o.playerId).filter(Boolean)), free = pool(sc).filter(p => !onField.has(p.id));
    if (!free.length) return UI.toast('Tous les convoqués sont déjà placés');
    snapshot();
    const { L, W } = Board.dims(sc.field), r = Board.tokenR(sc.field), st = cur(), c = club();
    free.forEach((p, i) => {
      const gk = p.pos === 'GB';
      const o = addObject({ type: 'player', color: gk ? 'jaune' : c.homeBib, gk, label: p.number ? String(p.number) : (gk ? 'G' : 'R'), name: Store.shortName(p), playerId: p.id, bench: true }, [r * 2.2 + i * r * 3.6, W + r]);
      st.pos[o.id] = [Math.min(r * 2.2 + i * r * 3.6, L - r), W + r];
    });
    sc.overlays.names = true;
    const m = matchOf(sc); if (m && !/Remplaçants/.test(sc.notes || '')) sc.notes = ((sc.notes || '') + '\nRemplaçants : ' + free.map(p => Store.shortName(p)).join(', ')).trim();
    E.sel = null; commit(); renderPanel();
    UI.toast(`${free.length} remplaçant${free.length > 1 ? 's' : ''} sur la ligne de touche`);
  }
  function clampW(w) {
    const e = Board.extents(E.sc.field), r = Board.tokenR(E.sc.field);
    return [Board.clamp(w[0], e.x0 - r, e.x1 + r), Board.clamp(w[1], e.y0 - r, e.y1 + r)];
  }
  function nextLabel(color) {
    const used = new Set(E.sc.objects.filter(o => o.type === 'player' && o.color === color).map(o => String(o.label)));
    for (let n = 1; n < 99; n++) if (!used.has(String(n))) return String(n);
    return '';
  }
  function makeObj(tool, w) {
    const c = club(), f = E.sc.field;
    if (tool === 'home') return { type: 'player', color: c.homeBib, label: nextLabel(c.homeBib) };
    if (tool === 'away') return { type: 'player', color: c.awayBib, label: nextLabel(c.awayBib) };
    if (tool === 'gk') return { type: 'player', color: 'jaune', gk: true, label: 'G' };
    if (tool === 'ball') return { type: 'ball' };
    if (tool === 'cone') return { type: 'cone', color: E.coneColor };
    if (tool === 'goal') return { type: 'goal', size: f.format === 'zone' ? 'mini' : 'big', w: (Board.PITCH[f.format] || {}).goal || (f.format === '11' ? 7.32 : 6), rot: w[0] > Board.dims(f).L / 2 ? 0 : 180 };
  }
  function addObject(o, p) {
    o.id = Store.uid(); E.sc.objects.push(o);
    E.sc.steps.forEach(st => st.pos[o.id] = p.slice());
    return o;
  }
  function removeThing(h) {
    const sc = E.sc;
    if (h.kind === 'obj') { sc.objects = sc.objects.filter(o => o.id !== h.id); sc.steps.forEach(st => { delete st.pos[h.id]; delete st.moves[h.id]; }); }
    if (h.kind === 'arrow') cur().arrows = cur().arrows.filter(a => a.id !== h.id);
    if (h.kind === 'zone') sc.zones = sc.zones.filter(z => z.id !== h.id);
    if (h.kind === 'move') {
      // the player stays where he was: in the next steps too, as long as they followed this movement
      const A = cur().pos[h.id], nx = sc.steps[E.k + 1], B = nx && nx.pos[h.id]; if (!A || !B) return;
      for (let j = E.k + 1; j < sc.steps.length; j++) { const p = sc.steps[j].pos[h.id]; if (p && Board.dist(p, B) < .01) sc.steps[j].pos[h.id] = A.slice(); else break; }
      delete nx.moves[h.id];
    }
  }
  // Arrow drawn from a player or the ball: it becomes a real movement towards the next step (created if needed)
  const MOVE_TYPES = { player: ['course', 'conduite', 'pressing', 'bascule'], ball: ['passe', 'tir'] };
  function makeMove(id, end) {
    const sc = E.sc, k = E.k, o = findObj(id), A = cur().pos[id], r = Board.tokenR(sc.field);
    let created = false;
    if (k === sc.steps.length - 1) { sc.steps.push({ pos: JSON.parse(JSON.stringify(cur().pos)), arrows: [], moves: {}, note: '', dur: 2 }); created = true; }
    const nx = sc.steps[k + 1], B = clampW(end);
    const shift = (oid, to) => {
      const old = nx.pos[oid];
      for (let j = k + 1; j < sc.steps.length; j++) { const p = sc.steps[j].pos[oid]; if (j === k + 1 || (p && old && Board.dist(p, old) < .01)) sc.steps[j].pos[oid] = to.slice(); else break; }
    };
    shift(id, B);
    const ok = MOVE_TYPES[o.type] || MOVE_TYPES.player, type = ok.includes(E.arrowType) ? E.arrowType : ok[0];
    nx.moves[id] = { type, c: 0 };
    // a player dribbling takes the ball with him
    if (type === 'conduite') {
      const ball = sc.objects.find(b => b.type === 'ball' && cur().pos[b.id] && Board.dist(cur().pos[b.id], A) < r * 2.6);
      if (ball) { const bp = cur().pos[ball.id]; shift(ball.id, [B[0] + bp[0] - A[0], B[1] + bp[1] - A[1]]); delete nx.moves[ball.id]; }
    }
    E.sel = { kind: 'move', id };
    if (created) { renderSteps(); UI.toast('Mouvement ajouté : touche « Jouer » pour le voir'); }
  }
  function select(h) { E.sel = h; renderPanel(); draw(); }

  /* ---------- pointer ---------- */
  // finger → pitch: from the canvas as it is shown (right even if its size changed since the last drawing)
  function wpos(e) { const c = E.canvas, r = c.getBoundingClientRect(); return E.cam.toW((e.clientX - r.left) * c.width / (r.width || 1), (e.clientY - r.top) * c.height / (r.height || 1)); }
  function onDown(e) {
    if (!E || !E.cam || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (E.playing) stopPlay();
    E.canvas.setPointerCapture(e.pointerId);
    const w = wpos(e), st = cur(), r = E.cam.r, t = E.tool;
    if (t === 'move') {
      if (E.sel && E.sel.kind === 'arrow') {
        const a = findArrow(E.sel.id);
        if (a && Board.dist(w, a.a) < r * .9) return (E.drag = { kind: 'arrowEnd', end: 'a', id: a.id });
        if (a && Board.dist(w, a.b) < r * .9) return (E.drag = { kind: 'arrowEnd', end: 'b', id: a.id });
      }
      if (E.sel && E.sel.kind === 'move') {
        const nx = E.sc.steps[E.k + 1], B = nx && nx.pos[E.sel.id];
        if (B && Board.dist(w, B) < r * 1.1) {
          const follow = E.sc.steps.map((s, j) => j > E.k + 1 && s.pos[E.sel.id] && Board.dist(s.pos[E.sel.id], B) < .01 ? j : -1).filter(j => j >= 0);
          return (E.drag = { kind: 'moveEnd', id: E.sel.id, follow });
        }
      }
      if (E.sel && E.sel.kind === 'zone') {
        const z = findZone(E.sel.id);
        if (z && Board.dist(w, [z.x + z.w, z.y + z.h]) < r * 1.1) return (E.drag = { kind: 'zoneResize', id: z.id });
      }
      const h = Board.hit(E.sc, E.k, E.cam, w);
      if (!h) return select(null);
      select(h);
      if (h.kind === 'obj') {
        const p = st.pos[h.id];
        const follow = E.sc.steps.map((s, j) => j > E.k && s.pos[h.id] && Board.dist(s.pos[h.id], p) < .01 ? j : -1).filter(j => j >= 0);
        E.drag = { kind: 'obj', id: h.id, off: [w[0] - p[0], w[1] - p[1]], follow };
      } else if (h.kind === 'zone') { const z = findZone(h.id); E.drag = { kind: 'zone', id: h.id, off: [w[0] - z.x, w[1] - z.y] }; }
      else if (h.kind === 'arrow') { const a = findArrow(h.id); E.drag = { kind: 'arrow', id: h.id, start: w, a0: a.a.slice(), b0: a.b.slice() }; }
      return;
    }
    if (['home', 'away', 'gk', 'ball', 'cone', 'goal'].includes(t)) {
      snapshot();
      const o = addObject(makeObj(t, w), clampW(w));
      E.sel = { kind: 'obj', id: o.id }; commit(); renderPanel();
      E.drag = { kind: 'obj', id: o.id, off: [0, 0], follow: E.sc.steps.map((s, j) => j > E.k ? j : -1).filter(j => j >= 0), placed: true };
      return;
    }
    if (t === 'arrow') {
      // starting on a player or the ball: the arrow is his movement
      const h = Board.hit(E.sc, E.k, E.cam, w), o = h && h.kind === 'obj' && findObj(h.id);
      if (o && (o.type === 'player' || o.type === 'ball')) return (E.drag = { kind: 'newArrow', a: st.pos[o.id].slice(), b: w, from: o.id });
      return (E.drag = { kind: 'newArrow', a: w, b: w });
    }
    if (t === 'zone') return (E.drag = { kind: 'newZone', a: w, b: w });
    if (t === 'erase') {
      const h = Board.hit(E.sc, E.k, E.cam, w);
      if (h) { snapshot(); removeThing(h); E.sel = null; commit(); renderPanel(); }
    }
  }
  function onMove(e) {
    if (!E || !E.drag) return;
    const d = E.drag, w = wpos(e), r = E.cam.r;
    if (!d.moved && !d.placed && ['obj', 'zone', 'arrow', 'arrowEnd', 'zoneResize', 'moveEnd'].includes(d.kind)) snapshot();
    d.moved = true;
    if (d.kind === 'obj') {
      const p = clampW([w[0] - d.off[0], w[1] - d.off[1]]);
      cur().pos[d.id] = p; d.follow.forEach(j => E.sc.steps[j].pos[d.id] = p.slice());
    } else if (d.kind === 'zone') { const z = findZone(d.id); z.x = w[0] - d.off[0]; z.y = w[1] - d.off[1]; }
    else if (d.kind === 'zoneResize') { const z = findZone(d.id); z.w = Math.max(r * 1.5, w[0] - z.x); z.h = Math.max(r * 1.5, w[1] - z.y); }
    else if (d.kind === 'arrow') { const a = findArrow(d.id), dx = w[0] - d.start[0], dy = w[1] - d.start[1]; a.a = [d.a0[0] + dx, d.a0[1] + dy]; a.b = [d.b0[0] + dx, d.b0[1] + dy]; }
    else if (d.kind === 'arrowEnd') { findArrow(d.id)[d.end] = w; }
    else if (d.kind === 'moveEnd') { const p = clampW(w); E.sc.steps[E.k + 1].pos[d.id] = p; d.follow.forEach(j => E.sc.steps[j].pos[d.id] = p.slice()); }
    else if (d.kind === 'newArrow' || d.kind === 'newZone') d.b = w;
    draw();
  }
  function onUp() {
    if (!E || !E.drag) return;
    const d = E.drag, r = E.cam.r; E.drag = null;
    if (d.kind === 'newArrow') {
      if (Board.dist(d.a, d.b) > r * 1.2) {
        snapshot();
        if (d.from) makeMove(d.from, d.b);
        else { const a = { id: Store.uid(), type: E.arrowType, a: d.a, b: d.b, c: 0 }; cur().arrows.push(a); E.sel = { kind: 'arrow', id: a.id }; }
        commit(); renderPanel();
      } else draw();
      return;
    }
    if (d.kind === 'newZone') {
      const x = Math.min(d.a[0], d.b[0]), y = Math.min(d.a[1], d.b[1]), w = Math.abs(d.b[0] - d.a[0]), h = Math.abs(d.b[1] - d.a[1]);
      if (w > r * 1.5 && h > r * 1.5) {
        snapshot();
        const z = { id: Store.uid(), x, y, w, h, color: E.zoneColor, label: '' };
        E.sc.zones.push(z); E.sel = { kind: 'zone', id: z.id }; commit(); renderPanel();
        // on a computer the name field is ready to type; on a phone/tablet no keyboard pops up (it made the page jump)
        const inp = E.root.querySelector('#zLabel'); if (inp && UI.finePointer()) inp.focus();
      } else draw();
      return;
    }
    if (d.moved || d.placed) { commit(); if (E.sel) renderPanel(); }
  }

  /* ---------- drawing ---------- */
  function draw() {
    if (!E) return;
    const { ctx, canvas } = E, W = canvas.width, H = canvas.height;
    const k = E.playing ? E.pk : E.k, u = E.playing ? E.pu : 0;
    E.cam = Board.drawFrame(ctx, W, H, E.sc, k, u, { homeBib: club().homeBib, names: E.sc.overlays.names, vertical: H > W * 1.15, editor: E.playing ? null : { sel: E.sel } });
    const d = E.drag;
    if (d && d.kind === 'newArrow') {
      const o = d.from && findObj(d.from), ok = o && (MOVE_TYPES[o.type] || MOVE_TYPES.player);
      Board.drawArrow(ctx, E.cam, d.a, d.b, 0, ok ? (ok.includes(E.arrowType) ? E.arrowType : ok[0]) : E.arrowType, o ? E.cam.r * (o.type === 'ball' ? .4 : 1.05) : 0, 0, .8);
    }
    if (d && d.kind === 'newZone') {
      const [x1, y1] = E.cam.toS(d.a), [x2, y2] = E.cam.toS(d.b);
      ctx.save(); ctx.setLineDash([8, 6]); ctx.lineWidth = 2.5; ctx.strokeStyle = Board.ZONE_COLORS[E.zoneColor];
      ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1)); ctx.restore();
    }
  }

  /* ---------- playback ---------- */
  function play() {
    if (E.sc.steps.length < 2) return UI.toast('Ajoute une 2e étape pour voir le mouvement');
    E.playing = true; E.sel = null; renderPanel();
    const segs = [], n = E.sc.steps.length;
    for (let k = 0; k < n; k++) { segs.push({ k, move: false, d: .6 }); if (k < n - 1) segs.push({ k, move: true, d: Board.stepDur(E.sc, k) }); }
    segs.push({ k: n - 1, move: false, d: 1 });
    const total = segs.reduce((a, s) => a + s.d, 0);
    let t0 = performance.now();
    const tick = now => {
      if (!E || !E.playing) return;
      let t = (now - t0) / 1000;
      if (t > total) { t0 = now; t = 0; }
      let acc = 0, seg = segs[segs.length - 1];
      for (const s of segs) { if (t < acc + s.d) { seg = s; break; } acc += s.d; }
      E.pk = seg.k; E.pu = seg.move ? (t - acc) / seg.d : 0;
      E.root.querySelectorAll('.step-chip').forEach((c, i) => c.classList.toggle('playing', i === E.pk));
      draw(); E.raf = requestAnimationFrame(tick);
    };
    renderSteps(); E.raf = requestAnimationFrame(tick);
  }
  function stopPlay() {
    if (!E) return;
    E.playing = false; cancelAnimationFrame(E.raf); renderSteps(); draw();
  }

  /* ---------- toolbar, steps, side panel ---------- */
  function renderTools() {
    const c = club();
    E.root.querySelector('#edTools').innerHTML = TOOLS.filter(([id]) => id !== 'gk' || Sport.cur().gk).map(([id, lab, ic]) => { if (id === 'goal' && !Sport.isFoot()) lab = Sport.id() === 'basket' ? 'Panier' : Sport.id() === 'volley' ? 'Cible' : Sport.id() === 'rugby' ? 'Poteaux' : 'But';
      const col = id === 'home' ? Board.BIBS[c.homeBib] : id === 'away' ? Board.BIBS[c.awayBib] : id === 'gk' ? Board.BIBS.jaune : null;
      const style = col ? ` style="color:${col[0]};--tool-ink:${col[1]}"` : '';
      return `<button class="tool ${E.tool === id ? 'on' : ''}" data-tool="${id}" aria-pressed="${E.tool === id}"><span class="ti"${style}>${I[ic]}</span><span>${lab}</span></button>`;
    }).join('');
    renderSub();
    const hint = E.root.querySelector('#edHint');
    hint.textContent = HINTS[E.tool]; hint.classList.remove('gone');
    clearTimeout(E.hintT); E.hintT = setTimeout(() => hint.classList.add('gone'), 4000);
  }
  // The choices of the active tool, right above the pitch (on a phone the options panel is hidden)
  function renderSub() {
    const t = E.tool, el = E.root.querySelector('#edSub');
    el.innerHTML = t === 'arrow' ? chipRow(ARROW_ITEMS(), 'tat', E.arrowType)
      : t === 'zone' ? chipRow(Object.entries(Board.ZONE_COLORS).map(([k, v]) => [k, '', swatch(v)]), 'tzc', E.zoneColor)
      : t === 'cone' ? chipRow([['orange', 'Orange'], ['jaune', 'Jaune'], ['bleu', 'Bleu'], ['rouge', 'Rouge']], 'tcone', E.coneColor) : '';
    el.hidden = !el.innerHTML;
  }
  function renderSteps() {
    const n = E.sc.steps.length, st = cur();
    E.root.querySelector('#edSteps').innerHTML = `
      <button class="btn play ${E.playing ? 'on' : ''}" data-act="play">${E.playing ? I.pause : I.play}<span>${E.playing ? 'Pause' : 'Jouer'}</span></button>
      <div class="step-list" role="tablist" aria-label="Étapes">
        ${E.sc.steps.map((s, i) => `<button class="step-chip ${i === E.k ? 'on' : ''}" data-step="${i}" aria-label="Étape ${i + 1}">${i + 1}</button>`).join('')}
        <button class="btn soft" data-act="addStep" title="Ajoute une étape : copie la position actuelle, puis bouge les joueurs">${I.plus}<span>Étape</span></button>
      </div>
      <input class="step-note" id="stepNote" maxlength="140" placeholder="Explique l'étape ${E.k + 1} (ex : le 6 descend entre les centraux)" value="${esc(st.note || '')}">
      <label class="step-dur" title="Vitesse du mouvement vers l'étape suivante">
        <span>Vitesse</span>
        <select id="stepDur" ${E.k >= n - 1 ? 'disabled' : ''}>${DURS.map(([v, l]) => `<option value="${v}" ${Math.abs((st.dur || 2) - v) < .01 ? 'selected' : ''}>${l}</option>`).join('')}</select>
      </label>
      <button class="icon-btn" data-act="delStep" aria-label="Supprimer l'étape ${E.k + 1}" ${n < 2 ? 'disabled' : ''}>${I.trash}</button>`;
  }
  const chipRow = (items, attr, active) => `<div class="chips">${items.map(([v, l, sw]) => `<button class="chip ${v === active ? 'on' : ''}" data-${attr}="${v}">${sw || ''}${l}</button>`).join('')}</div>`;
  const swatch = c => `<i class="sw" style="background:${c}"></i>`;
  const arrowSw = t => { const a = Board.ARROWS[t]; return `<i class="asw" style="--c:${a.color};--d:${a.dash ? 'dashed' : a.wave ? 'dotted' : 'solid'}"></i>`; };
  const ARROW_ITEMS = () => Object.entries(Board.ARROWS).map(([k, a]) => [k, a.label, arrowSw(k)]);
  const CURVES = () => `<div class="chips"><button class="chip" data-curve="-0.25">↶ Courbe</button><button class="chip" data-curve="0">Droite</button><button class="chip" data-curve="0.25">Courbe ↷</button></div>`;

  function renderPanel() {
    const side = E.root.querySelector('#edSide'), sc = E.sc, sel = E.sel;
    let h = '';
    if (sel && sel.kind === 'obj') {
      const o = findObj(sel.id); if (!o) { E.sel = null; return renderPanel(); }
      const titles = { player: o.gk ? 'Gardien' : 'Joueur', ball: 'Ballon', cone: 'Plot', goal: 'But' };
      h += `<div class="panel-head"><h3>${titles[o.type]}</h3><button class="icon-btn danger" data-act="delSel" aria-label="Supprimer">${I.trash}</button></div>`;
      if (o.type === 'player') {
        const mt = matchOf(sc), onF = new Set(sc.objects.filter(x => x.id !== o.id).map(x => x.playerId).filter(Boolean));
        let roster = pool(sc); if (o.playerId && !roster.some(p => p.id === o.playerId)) { const me = Store.get('players', o.playerId); if (me) roster = [me, ...roster]; }
        h += `${roster.length ? `<label class="fld"><span>${mt ? 'Joueur convoqué' : 'Joueur de l\'effectif'}</span><select id="pWho"><option value="">Choisir un joueur…</option>${roster.map(p => `<option value="${p.id}" ${p.id === o.playerId ? 'selected' : ''}>${esc(Store.fullName(p))}${p.number ? ' (' + esc(p.number) + ')' : ''}${onF.has(p.id) ? ' · déjà placé' : ''}</option>`).join('')}</select></label>` : ''}
          <label class="fld"><span>Numéro ou lettre</span><input id="pLabel" maxlength="3" value="${esc(o.label || '')}"></label>
          <label class="fld"><span>Nom affiché</span><input id="pName" maxlength="24" value="${esc(o.name || '')}" placeholder="Prénom"></label>
          <div class="lbl">Couleur du maillot</div>
          ${chipRow(Object.entries(Board.BIBS).map(([k, v]) => [k, '', swatch(v[0])]), 'bib', o.color)}
          <label class="switch"><input type="checkbox" id="pGk" ${o.gk ? 'checked' : ''}><span>${Sport.cur().gk ? 'C\'est un gardien' : 'Joueur à part (couleur différente)'}</span></label>`;
      }
      if (o.type === 'cone') h += `<div class="lbl">Couleur</div>${chipRow([['orange', 'Orange'], ['jaune', 'Jaune'], ['bleu', 'Bleu'], ['rouge', 'Rouge']], 'cone', o.color)}`;
      if (o.type === 'goal') h += `<div class="lbl">Taille</div>${chipRow([['big', 'Grand but'], ['mini', 'Mini-but']], 'gsize', o.size === 'mini' ? 'mini' : 'big')}
        <button class="btn soft" data-act="rotGoal">${I.rotate}<span>Tourner le but</span></button>`;
      if (o.type === 'player' || o.type === 'ball') {
        if (E.k > 0) {
          const A = sc.steps[E.k - 1].pos[o.id], B = cur().pos[o.id];
          if (A && B && Board.dist(A, B) > Board.tokenR(sc.field) * .6) {
            const ty = Board.moveType(sc, E.k - 1, o.id);
            h += `<div class="lbl">Flèche pour arriver ici (depuis l'étape ${E.k})</div>
              ${chipRow(ARROW_ITEMS().concat([['none', 'Pas de flèche', '']]), 'mt', ty)}${CURVES()}`;
          } else h += `<p class="tip">Pour faire bouger ${o.type === 'ball' ? 'le ballon' : 'ce joueur'} : prends l'outil « Flèche » et glisse depuis lui jusqu'à l'arrivée.</p>`;
        } else h += `<p class="tip">Pour faire bouger ${o.type === 'ball' ? 'le ballon' : 'ce joueur'} : prends l'outil « Flèche » et glisse depuis ${o.type === 'ball' ? 'le ballon' : 'le joueur'} jusqu'à l'arrivée. Touche « Jouer » pour voir l'animation.</p>`;
      }
    } else if (sel && sel.kind === 'move') {
      const o = findObj(sel.id), nx = sc.steps[E.k + 1]; if (!o || !nx) { E.sel = null; return renderPanel(); }
      const ok = MOVE_TYPES[o.type] || MOVE_TYPES.player, ty = Board.moveType(sc, E.k, o.id);
      h += `<div class="panel-head"><h3>Mouvement ${o.type === 'ball' ? 'du ballon' : 'du joueur ' + esc(o.label || '')}</h3><button class="icon-btn danger" data-act="delSel" aria-label="Supprimer le mouvement">${I.trash}</button></div>
        <div class="lbl">Type</div>${chipRow(ARROW_ITEMS().filter(([k]) => ok.includes(k)), 'nmt', ty)}<div class="lbl">Forme</div>${CURVES()}
        <p class="tip">Tire sur le rond blanc pour changer l'arrivée. Touche « Jouer » pour voir le mouvement.</p>`;
    } else if (sel && sel.kind === 'arrow') {
      const a = findArrow(sel.id); if (!a) { E.sel = null; return renderPanel(); }
      h += `<div class="panel-head"><h3>Flèche</h3><button class="icon-btn danger" data-act="delSel" aria-label="Supprimer">${I.trash}</button></div>
        <div class="lbl">Type</div>${chipRow(ARROW_ITEMS(), 'at', a.type)}<div class="lbl">Forme</div>${CURVES()}
        <p class="tip">Tire sur les ronds blancs pour déplacer le début ou la fin.</p>`;
    } else if (sel && sel.kind === 'zone') {
      const z = findZone(sel.id); if (!z) { E.sel = null; return renderPanel(); }
      h += `<div class="panel-head"><h3>Zone</h3><button class="icon-btn danger" data-act="delSel" aria-label="Supprimer">${I.trash}</button></div>
        <label class="fld"><span>Nom de la zone</span><input id="zLabel" maxlength="30" value="${esc(z.label || '')}" placeholder="ex : zone de finition"></label>
        <div class="lbl">Couleur</div>${chipRow(Object.entries(Board.ZONE_COLORS).map(([k, v]) => [k, '', swatch(v)]), 'zc', z.color)}
        <p class="tip">Tire sur le rond blanc en bas à droite pour changer la taille.</p>`;
    } else {
      h += `<h3>Notes du schéma</h3>
        <label class="fld"><span class="sr">Notes du schéma</span><textarea id="scNotes" rows="4" maxlength="2000" placeholder="Objectif, consignes, variantes… (enregistré tout seul)">${esc(sc.notes || '')}</textarea></label>`;
      const ov = sc.overlays, f = sc.field;
      const tg = (id, lab) => `<label class="switch"><input type="checkbox" data-ov="${id}" ${ov[id] ? 'checked' : ''}><span>${lab}</span></label>`;
      if (sc.trace) h += `<h3>Calque : ton dessin d'origine</h3>
        <p class="tip">Redessine par-dessus avec les joueurs, flèches et zones. Quand c'est fini, retire le calque : il reste le schéma propre.</p>
        <label class="switch"><input type="checkbox" data-trace="on" ${sc.trace.on !== false ? 'checked' : ''}><span>Voir le calque</span></label>
        <label class="fld"><span>Transparence du calque</span><input type="range" id="traceOp" min="10" max="90" step="5" value="${Math.round((sc.trace.opacity == null ? .7 : sc.trace.opacity) * 100)}"></label>
        <button class="btn primary wide" data-act="dropTrace">${I.check}<span>Retirer le calque (version propre)</span></button>`;
      h += `<h3>Afficher</h3>
        ${Sport.isFoot() ? tg('lanes', 'Couloirs et demi-espaces') + tg('phases', 'Zones de jeu : conservation, progression, déséquilibre, finition') : ''}${tg('bloc', 'Bloc adverse')}${tg('names', 'Prénoms des joueurs')}
        <h3>Terrain</h3>
        ${f.format === 'bg' ? '<p class="tip">Le fond est une image importée (photo, page de PDF ou image de vidéo). Dessine dessus avec les outils : joueurs, flèches, zones et étapes.</p>' : chipRow([...Sport.cur().formats.map(x => [x[0], x[1]]), ['zone', 'Zone libre']], 'fmt', f.format)}
        ${f.format === 'bg' ? '' : f.format === 'zone' ? `<div class="row2"><label class="fld"><span>Longueur (m)</span><input type="number" id="fW" min="5" max="110" value="${f.w || 30}"></label><label class="fld"><span>Largeur (m)</span><input type="number" id="fH" min="5" max="75" value="${f.h || 20}"></label></div>`
          : chipRow([['full', 'Terrain entier'], ['half', 'Demi-terrain']], 'view', f.view || 'full')}
        <h3>Équipe</h3>
        <label class="fld"><span>Catégorie</span><select id="scTeam"><option value="">Aucune</option>${Auth.teams().map(t => `<option value="${t.id}" ${t.id === sc.teamId ? 'selected' : ''}>${esc(Store.teamLabel(t))}</option>`).join('')}</select></label>
        ${sc.teamId ? (() => { const onField = new Set(sc.objects.map(o => o.playerId).filter(Boolean)), free = pool(sc).filter(p => !onField.has(p.id)), mt = matchOf(sc);
          return `<label class="fld"><span>Mettre un joueur sur le terrain</span><select id="addWho"><option value="">${free.length ? 'Choisir un joueur…' : 'Tout l\'effectif est sur le terrain'}</option>${free.map(p => `<option value="${p.id}">${esc(Store.fullName(p))}${p.number ? ' (' + esc(p.number) + ')' : ''}${People.postsLabel(p, true) ? ' · ' + esc(People.postsLabel(p, true)) : ''}</option>`).join('')}</select></label>`; })() : '<p class="tip">Choisis une catégorie pour placer tes joueurs avec un menu.</p>'}
        ${matchOf(sc) ? `<button class="btn soft wide" data-act="bench">🪑<span>Placer les remplaçants (${pool(sc).filter(p => !sc.objects.some(o => o.playerId === p.id)).length})</span></button>` : ''}
        <button class="btn soft wide" data-act="formation" ${f.format === 'zone' || f.format === 'bg' ? 'disabled' : ''}>${I.formation}<span>Placer une formation</span></button>
        <h3>Les flèches</h3>
        <ul class="legend">${Object.entries(Board.ARROWS).map(([k, a]) => `<li>${arrowSw(k)}<span>${a.label}</span></li>`).join('')}</ul>`;
    }
    side.innerHTML = `<div class="side-grip"><b>${sel ? 'Modifier' : 'Options'}</b><button class="icon-btn" data-act="closePanel" aria-label="Fermer">${I.x}</button></div>` + h;
    E.root.querySelector('.opt-btn').classList.toggle('dot', !!sel);
  }

  // Put a roster player on the field, on the first free spot along our touchline
  function placePlayer(p) {
    snapshot();
    const sc = E.sc, { L, W } = Board.dims(sc.field), r = Board.tokenR(sc.field), st = cur();
    const used = Object.values(st.pos);
    let spot = [L * .25, W * .5];
    outer: for (let row = 0; row < 6; row++) for (let i = 0; i < 12; i++) {
      const c = [r * 2 + i * r * 2.6, W - r * 1.4 - row * r * 2.6];
      if (c[0] > L - r) break;
      if (used.every(u => Board.dist(u, c) > r * 2.2)) { spot = c; break outer; }
    }
    const gk = p.pos === 'GB';
    const o = addObject({ type: 'player', color: gk ? 'jaune' : club().homeBib, gk, label: p.number ? String(p.number) : (gk ? 'G' : ''), name: Store.shortName(p), playerId: p.id }, spot);
    sc.overlays.names = true; E.sel = { kind: 'obj', id: o.id }; commit(); renderPanel();
    UI.toast(`${Store.shortName(p)} est sur le terrain : fais-le glisser à son poste`);
  }

  /* ---------- formation ---------- */
  function formationModal() {
    const f = E.sc.field, list = Object.keys(Formations[f.format] || {});
    const teams = Auth.teams().filter(t => t.format === f.format);
    UI.modal({
      title: 'Placer une formation',
      body: `<label class="fld"><span>Mon équipe</span><select id="fmTeam"><option value="">Sans prénoms</option>${teams.map(t => `<option value="${t.id}" ${t.id === E.sc.teamId ? 'selected' : ''}>${esc(Store.teamLabel(t))}</option>`).join('')}</select></label>
        <label class="fld"><span>Notre système</span><select id="fmHome">${formationOptions(f.format)}</select></label>
        <label class="fld"><span>Adversaires</span><select id="fmAway"><option value="">Pas d'adversaires</option>${formationOptions(f.format)}</select></label>
        <label class="switch"><input type="checkbox" id="fmReplace" checked><span>Enlever les joueurs déjà placés</span></label>`,
      actions: [{ label: 'Annuler' }, { label: 'Placer', kind: 'primary', onClick: (close, root) => {
        const team = Store.get('teams', root.querySelector('#fmTeam').value), home = root.querySelector('#fmHome').value, away = root.querySelector('#fmAway').value;
        placeFormation(team, home, away, root.querySelector('#fmReplace').checked);
      } }],
    });
  }
  function placeFormation(team, home, away, replace) {
    snapshot();
    const sc = E.sc, { L, W } = Board.dims(sc.field), c = club();
    if (replace) sc.objects.filter(o => o.type === 'player').map(o => o.id).forEach(id => removeThing({ kind: 'obj', id }));
    const roster = team ? Store.rosterOf(team.id) : [];
    const rows = Formations[sc.field.format][home], { out } = People.assignSlots(roster, rows); // each spot gets the player whose positions fit it
    const k = away ? .88 : 1; // with two teams, each one stays in its own half so the strikers don't overlap
    rows.forEach(([lab, x, y, gk], j) => {
      const who = out[j];
      addObject({ type: 'player', color: gk ? 'jaune' : c.homeBib, gk: !!gk, label: who && who.number ? String(who.number) : lab, name: who ? Store.shortName(who) : '', playerId: who ? who.id : undefined }, [x * k * L, y * W]);
    });
    if (away) Formations[sc.field.format][away].forEach(([lab, x, y, gk]) => addObject({ type: 'player', color: gk ? 'orange' : c.awayBib, gk: !!gk, label: gk ? 'G' : lab }, [(1 - x * k) * L, (1 - y) * W]));
    if (team) { sc.teamId = team.id; if (roster.length) sc.overlays.names = true; }
    E.sel = null; commit(); renderPanel();
  }

  /* ---------- export ---------- */
  function exportSheet() {
    const sc = E.sc, o = { homeBib: club().homeBib, names: sc.overlays.names };
    const run = async (label, fn) => {
      const b = UI.busy(label);
      try { const r = await fn(b.progress); if (r === 'downloaded') UI.toast('Fichier enregistré dans Téléchargements'); }
      catch (err) { UI.toast(err.message || 'Export impossible', 'err'); }
      finally { b.done(); }
    };
    UI.modal({
      title: 'Exporter', noFocus: true,
      body: `<div class="big-actions">
        <button class="big-act" data-x="png">${I.image}<b>Image</b><span>L'étape ${E.k + 1} en photo (PNG)</span></button>
        <button class="big-act" data-x="video" ${sc.steps.length < 2 ? 'disabled' : ''}>${I.video}<b>Vidéo</b><span>${sc.steps.length < 2 ? 'Il faut au moins 2 étapes' : "L'animation complète"}</span></button>
        <button class="big-act" data-x="pdf">${I.pdf}<b>PDF à imprimer</b><span>Toutes les étapes, 2 par page</span></button>
        <button class="big-act" data-x="json">${I.share}<b>Envoyer à un éducateur</b><span>Il pourra l'ouvrir dans son appli</span></button>
      </div>`,
      onOpen: (root, close) => root.querySelectorAll('[data-x]').forEach(b => b.onclick = () => {
        close(); const x = b.dataset.x;
        if (x === 'png') run('Création de l\'image…', () => Exporter.png(sc, E.k, o));
        if (x === 'video') run('Enregistrement de la vidéo… garde l\'appli ouverte', p => Exporter.video(sc, o, p));
        if (x === 'pdf') run('Création du PDF…', () => Exporter.pdfSchema(sc, club(), o));
        if (x === 'json') run('Préparation du fichier…', async () => Exporter.json(await Library.withBackgrounds(Store.exportSchema(sc)), sc.name));
      }),
    });
  }

  /* ---------- events ---------- */
  function bind() {
    const r = E.root;
    E.canvas.addEventListener('pointerdown', onDown);
    E.canvas.addEventListener('pointermove', onMove);
    E.canvas.addEventListener('pointerup', onUp);
    E.canvas.addEventListener('pointercancel', onUp);
    const ti = r.querySelector('#edTitle'); if (ti) ti.addEventListener('change', e => { E.sc.name = e.target.value.trim() || 'Sans nom'; commit(); });
    r.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || !E) return;
      const d = b.dataset;
      if (d.tool) { E.tool = d.tool; E.sel = null; renderTools(); renderPanel(); draw(); return; }
      if (d.step) { stopPlay(); E.k = +d.step; E.sel = null; renderSteps(); renderPanel(); draw(); return; }
      const sc = E.sc, sel = E.sel;
      const setSel = fn => { snapshot(); fn(); commit(); renderPanel(); };
      if (d.bib) return setSel(() => findObj(sel.id).color = d.bib);
      if (d.cone && sel) return setSel(() => findObj(sel.id).color = d.cone);
      if (d.gsize) return setSel(() => findObj(sel.id).size = d.gsize);
      if (d.mt) return setSel(() => { const m = cur().moves[sel.id] = cur().moves[sel.id] || {}; m.type = d.mt; });
      if (d.nmt && sel) return setSel(() => { const nx = sc.steps[E.k + 1]; nx.moves[sel.id] = Object.assign(nx.moves[sel.id] || {}, { type: d.nmt }); });
      if (d.curve !== undefined) {
        if (sel && sel.kind === 'move') return setSel(() => { const nx = sc.steps[E.k + 1]; nx.moves[sel.id] = Object.assign(nx.moves[sel.id] || {}, { c: +d.curve }); });
        if (sel && sel.kind === 'arrow') return setSel(() => findArrow(sel.id).c = +d.curve);
        if (sel && sel.kind === 'obj' && E.k > 0) return setSel(() => { const m = cur().moves[sel.id] = cur().moves[sel.id] || {}; m.c = +d.curve; });
        return;
      }
      if (d.at) return setSel(() => findArrow(sel.id).type = d.at);
      if (d.zc) return setSel(() => findZone(sel.id).color = d.zc);
      if (d.tat) { E.arrowType = d.tat; return renderSub(); }
      if (d.tzc) { E.zoneColor = d.tzc; return renderSub(); }
      if (d.tcone) { E.coneColor = d.tcone; return renderSub(); }
      if (d.fmt) return setSel(() => { sc.field.format = d.fmt; if (d.fmt === 'zone') { sc.field.w = sc.field.w || 30; sc.field.h = sc.field.h || 20; } });
      if (d.view) return setSel(() => sc.field.view = d.view);
      switch (d.act) {
        case 'back': {
          const leave = () => { stopPlay(); close(); return history.length > 1 ? history.back() : (location.hash = '#/schemas'); };
          if (E.scratch && E.sc.objects.length + E.sc.zones.length + E.sc.steps.reduce((a, s) => a + s.arrows.length, 0) > 0)
            return UI.confirmBox('Quitter le tableau blanc ? Le dessin ne sera pas gardé (touche « Garder » pour l\'enregistrer).', 'Quitter').then(ok => { if (ok && E) leave(); });
          return leave();
        }
        case 'help': return Help.open(E.scratch ? 'tableau' : 'schema');
        case 'fullscreen': return fullscreen(!fsEl());
        case 'duplicate': stopPlay(); return duplicate();
        case 'keep': stopPlay(); return keepScratch();
        case 'wipe': return UI.confirmBox('Tout effacer sur le tableau ?', 'Effacer').then(ok => {
          if (!ok || !E) return; stopPlay(); snapshot();
          Object.assign(E.sc, { objects: [], zones: [], steps: [{ pos: {}, arrows: [], moves: {}, note: '', dur: 2 }] }); E.k = 0; E.sel = null;
          commit(); renderSteps(); renderPanel();
        });
        case 'panel': return E.root.querySelector('.ed').classList.toggle('panel-open');
        case 'closePanel': return E.root.querySelector('.ed').classList.remove('panel-open');
        case 'undo': return undo();
        case 'redo': return redo();
        case 'export': stopPlay(); return exportSheet();
        case 'play': return E.playing ? stopPlay() : play();
        case 'addStep': {
          stopPlay(); snapshot();
          const st = cur(), nst = { pos: JSON.parse(JSON.stringify(st.pos)), arrows: [], moves: {}, note: '', dur: 2 };
          sc.steps.splice(E.k + 1, 0, nst); E.k++; E.sel = null; E.tool = 'move';
          commit(); renderTools(); renderSteps(); renderPanel();
          return UI.toast(`Étape ${E.k + 1} : déplace les joueurs et le ballon`);
        }
        case 'delStep': {
          if (sc.steps.length < 2) return;
          UI.confirmBox(`Supprimer l'étape ${E.k + 1} ?`).then(ok => { if (!ok || !E) return; snapshot(); sc.steps.splice(E.k, 1); E.k = Math.max(0, E.k - 1); E.sel = null; commit(); renderSteps(); renderPanel(); });
          return;
        }
        case 'delSel': snapshot(); removeThing(sel); E.sel = null; commit(); return renderPanel();
        case 'rotGoal': return setSel(() => { const o = findObj(sel.id); o.rot = ((o.rot || 0) + 90) % 360; });
        case 'formation': return formationModal();
        case 'bench': return placeBench();
        case 'dropTrace': snapshot(); delete E.sc.trace; commit(); renderPanel(); return UI.toast('Calque retiré : ton schéma est au propre');
      }
    });
    r.addEventListener('input', e => {
      if (!E) return;
      const t = e.target, sel = E.sel;
      if (t.id === 'traceOp' && E.sc.trace) { E.sc.trace.opacity = +t.value / 100; draw(); }
      if (t.id === 'pLabel') { findObj(sel.id).label = t.value.trim(); saveSoon(); }
      if (t.id === 'pName') { findObj(sel.id).name = t.value.trim(); saveSoon(); }
      if (t.id === 'zLabel') { findZone(sel.id).label = t.value; saveSoon(); }
      if (t.id === 'stepNote') { cur().note = t.value; saveSoon(); }
      if (t.id === 'scNotes') { E.sc.notes = t.value; saveSoon(); }
      if (t.id === 'edTitle') { E.sc.name = t.value.trim() || 'Sans nom'; saveSoon(); }
    });
    r.addEventListener('change', e => {
      if (!E) return;
      const t = e.target, sc = E.sc;
      if (['pLabel', 'pName', 'zLabel', 'stepNote', 'scNotes'].includes(t.id)) { commit(); return; }
      if (t.id === 'pGk') { snapshot(); const o = findObj(E.sel.id); o.gk = t.checked; if (t.checked) { o.color = 'jaune'; o.label = o.label || 'G'; } commit(); return renderPanel(); }
      if (t.dataset.ov) { sc.overlays[t.dataset.ov] = t.checked; return commit(); }
      if (t.dataset.trace && sc.trace) { sc.trace.on = t.checked; return commit(); }
      if (t.id === 'traceOp' && sc.trace) { sc.trace.opacity = +t.value / 100; return commit(); }
      if (t.id === 'fW' || t.id === 'fH') { snapshot(); sc.field.w = Board.clamp(+document.getElementById('fW').value || 30, 5, 110); sc.field.h = Board.clamp(+document.getElementById('fH').value || 20, 5, 75); return commit(); }
      if (t.id === 'scTeam') { sc.teamId = t.value || null; commit(); return renderPanel(); }
      if (t.id === 'addWho' && t.value) { placePlayer(Store.get('players', t.value)); return; }
      if (t.id === 'pWho') {
        snapshot(); const o = findObj(E.sel.id), p = Store.get('players', t.value);
        if (p) { o.playerId = p.id; o.name = Store.shortName(p); if (p.number) o.label = String(p.number); if (p.pos === 'GB') { o.gk = true; o.color = 'jaune'; } sc.overlays.names = true; }
        else { delete o.playerId; }
        commit(); return renderPanel();
      }
      if (t.id === 'stepDur') { snapshot(); cur().dur = +t.value; return commit(); }
    });
  }

  return { open, close };
})();
