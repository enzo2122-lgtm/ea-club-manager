/* QuickBoard (3.51): the « tableau rapide » of the coach, before the match and at half-time. An empty pitch in full screen,
   our players already on it (the match's lineup, with their names), and no tool to choose:
   - drag a player (or the ball) = he moves;
   - drag anywhere else = a line is drawn: a run (arrow), a pass (dotted arrow) or a free line, in the chosen colour.
   Undo, wipe the lines, the opponents and the ball at a touch, half or whole pitch. « Garder » keeps the board with the match
   (« Avant-match », « Mi-temps »), « Envoyer » makes a picture for WhatsApp. */
const QuickBoard = (() => {
  const { esc, toast } = UI;
  const S = () => Store.state;
  // where the players stand when the match has no lineup: our goal on the left (x = 0 → 1 along the length, y across)
  const SHAPES = {
    '11': [[.05, .5], [.2, .14], [.17, .38], [.17, .62], [.2, .86], [.32, .3], [.29, .5], [.32, .7], [.43, .18], [.46, .5], [.43, .82]],
    '8': [[.05, .5], [.2, .24], [.17, .5], [.2, .76], [.33, .2], [.3, .5], [.33, .8], [.44, .5]],
    '5': [[.05, .5], [.22, .3], [.22, .7], [.38, .35], [.38, .65]],
  };
  const COLORS = [['#ffffff', 'Blanc'], ['#facc15', 'Jaune'], ['#ef4444', 'Rouge'], ['#38bdf8', 'Bleu']];
  const STYLES = [['run', '➡️', 'Course'], ['pass', '⇢', 'Passe'], ['pen', '✏️', 'Trait']];
  let B = null; // the open board

  function fmtOf(teamId, m) {
    const t = teamId && Store.get('teams', teamId), lu = m && m.lineupId && Store.get('schemas', m.lineupId);
    const f = (lu && lu.field && lu.field.format) || (t && t.format) || '11';
    return ['11', '8', '5'].includes(f) ? f : '11';
  }
  // our players: the lineup's places and names, else the convoked players on the usual shape
  function ours(m, fmt) {
    const { L, W } = Board.dims({ format: fmt }), out = [];
    const lu = m && m.lineupId && Store.get('schemas', m.lineupId);
    if (lu && lu.field && lu.field.format === fmt) {
      const pos = ((lu.steps || [])[0] || {}).pos || {};
      (lu.objects || []).filter(o => o.type === 'player' && !o.bench && pos[o.id] && (o.playerId || o.color === lu.objects.find(x => x.playerId) ?.color)).forEach(o => {
        const p = o.playerId && Store.get('players', o.playerId);
        out.push({ id: 'u' + out.length, side: 'us', x: pos[o.id][0], y: pos[o.id][1], label: String(o.label || (p && Store.numOf(p, m)) || ''), name: o.name || (p ? Store.shortName(p) : ''), gk: !!o.gk });
      });
      if (out.length >= 3) return out;
      out.length = 0;
    }
    const conv = m ? (m.convoked || []).filter(id => !(m.absents || []).includes(id)).map(id => Store.get('players', id)).filter(Boolean) : [];
    SHAPES[fmt].forEach(([fx, fy], k) => { const p = conv[k]; out.push({ id: 'u' + k, side: 'us', x: fx * L, y: fy * W, label: p ? String(Store.numOf(p, m) || k + 1) : String(k + 1), name: p ? Store.shortName(p) : '', gk: k === 0 }); });
    return out;
  }
  const theirs = fmt => { const { L, W } = Board.dims({ format: fmt }); return SHAPES[fmt].map(([fx, fy], k) => ({ id: 't' + k, side: 'them', x: L - fx * L, y: W - fy * W, label: String(k + 1), name: '', gk: k === 0 })); };

  /* ---------- open ---------- */
  function open(o = {}) {
    if (B) close();
    const m = o.matchId && Store.get('matches', o.matchId), fmt = o.format || fmtOf(o.teamId || (m && m.teamId), m), { L, W } = Board.dims({ format: fmt });
    const saved = o.board && o.board.data;
    B = { m, fmt, half: saved ? !!saved.half : false, players: saved ? saved.players.map(x => Object.assign({}, x)) : ours(m, fmt), them: saved ? !!saved.them : false, ball: saved ? saved.ball : null,
      strokes: saved ? saved.strokes.map(s => Object.assign({}, s, { pts: s.pts.map(p => p.slice()) })) : [], style: 'run', color: COLORS[0][0], undo: [], title: o.title || (m ? `${m.home ? 'Contre' : 'Chez'} ${m.opponent || '?'}` : 'Tableau rapide') };
    if (saved && saved.them && !B.players.some(x => x.side === 'them')) B.players.push(...theirs(fmt));
    const ov = document.createElement('div'); ov.className = 'qb'; B.ov = ov;
    ov.innerHTML = `<div class="qb-top"><button class="icon-btn" data-qb="close" aria-label="Fermer">${I.x}</button><b class="qb-title">${esc(B.title)}</b>
        <span class="qb-tip">Glisse un joueur pour le déplacer · glisse ailleurs pour dessiner</span>
        <button class="btn soft" data-qb="list">🗂️<span>Gardés</span></button><button class="btn soft" data-qb="share">📤<span>Envoyer</span></button><button class="btn primary" data-qb="keep">📸<span>Garder</span></button></div>
      <div class="qb-stage"><canvas></canvas></div>
      <div class="qb-tools">
        <div class="qb-seg">${STYLES.map(([k, ic, l]) => `<button data-qbs="${k}" class="${k === B.style ? 'on' : ''}"><span class="qb-ic">${ic}</span>${l}</button>`).join('')}</div>
        <div class="qb-seg qb-cols">${COLORS.map(([c, l]) => `<button data-qbc="${c}" class="${c === B.color ? 'on' : ''}" aria-label="${l}"><i style="background:${c}"></i></button>`).join('')}</div>
        <div class="qb-seg"><button data-qb="undo"><span class="qb-ic">↩️</span>Annuler</button><button data-qb="wipe"><span class="qb-ic">🧹</span>Effacer</button></div>
        <div class="qb-seg"><button data-qb="them" class="${B.them ? 'on' : ''}"><span class="qb-ic">👥</span>Adversaires</button><button data-qb="ball" class="${B.ball ? 'on' : ''}"><span class="qb-ic">⚽</span>Ballon</button>
          <button data-qb="half" class="${B.half ? 'on' : ''}"><span class="qb-ic">◧</span>Demi-terrain</button><button data-qb="reset"><span class="qb-ic">🔄</span>Replacer</button></div>
      </div>`;
    B.hadTop = document.body.classList.contains('modal-top'); document.body.appendChild(ov); document.body.classList.add('qb-open', 'modal-top');
    B.cv = ov.querySelector('canvas'); B.ctx = B.cv.getContext('2d');
    const fit = () => { if (!B) return; const st = ov.querySelector('.qb-stage'), r = st.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      B.cv.width = Math.round(r.width * dpr); B.cv.height = Math.round(r.height * dpr); B.dpr = dpr; draw(); };
    B.ro = new ResizeObserver(fit); B.ro.observe(ov.querySelector('.qb-stage'));
    bind(); fit();
    B.onHash = () => close(); window.addEventListener('hashchange', B.onHash);
    B.onKey = e => { if (!document.getElementById('modal').hidden) return; if (e.key === 'Escape') close(); if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); } }; document.addEventListener('keydown', B.onKey);
    return B;
  }
  function close() {
    if (!B) return; try { B.ro.disconnect(); } catch (e) {}
    window.removeEventListener('hashchange', B.onHash); document.removeEventListener('keydown', B.onKey);
    B.ov.remove(); document.body.classList.remove('qb-open'); if (!B.hadTop) document.body.classList.remove('modal-top'); B = null;
  }

  /* ---------- drawing ---------- */
  const field = () => ({ format: B.fmt, view: B.half ? 'half' : 'full' });
  function cam() {
    const W = B.cv.width, H = B.cv.height, vertical = H > W * 1.05;
    return Board.camera({ field: field(), overlays: {} }, W, H, { vertical });
  }
  function draw(ctxIn, Win, Hin) {
    const ctx = ctxIn || B.ctx, W = Win || B.cv.width, H = Hin || B.cv.height;
    const sc = { field: field(), overlays: {}, objects: [], zones: [], steps: [{ pos: {}, arrows: [], moves: {} }] };
    const vertical = H > W * 1.05;
    Board.drawFrame(ctx, W, H, sc, 0, 0, { vertical });
    const c = Board.camera(sc, W, H, { vertical }), s = c.s, r = c.r * s * 1.05;
    B.strokes.forEach(st => stroke(ctx, c, st));
    if (B.cur) stroke(ctx, c, B.cur);
    const bib = (S().club || {}).homeBib || 'bordeaux', away = (S().club || {}).awayBib && S().club.awayBib !== bib ? S().club.awayBib : 'blanc';
    B.players.filter(p => B.them || p.side === 'us').forEach(p => {
      const [X, Y] = c.toS([p.x, p.y]), [fill, ink] = Board.BIBS[p.side === 'us' ? (p.gk ? 'jaune' : bib) : (p.gk ? 'vert' : away === bib ? 'blanc' : away)] || Board.BIBS.bleu;
      ctx.beginPath(); ctx.arc(X + r * .1, Y + r * .18, r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fill();
      ctx.beginPath(); ctx.arc(X, Y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = Math.max(2, r * .12); ctx.strokeStyle = B.drag && B.drag.p === p ? '#facc15' : 'rgba(0,0,0,.55)'; ctx.stroke();
      ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 ${Math.round(r * (p.label.length > 2 ? .8 : 1))}px ui-rounded, system-ui, sans-serif`; ctx.fillText(p.label, X, Y + r * .05);
      if (p.name) { ctx.font = `700 ${Math.round(r * .78)}px ui-rounded, system-ui, sans-serif`; ctx.textBaseline = 'top'; ctx.lineWidth = Math.max(2, r * .22); ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.strokeText(p.name, X, Y + r * 1.15); ctx.fillStyle = '#fff'; ctx.fillText(p.name, X, Y + r * 1.15); }
    });
    if (B.ball) { const [X, Y] = c.toS([B.ball.x, B.ball.y]), br = r * .55; ctx.beginPath(); ctx.arc(X, Y, br, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = Math.max(1.5, br * .18); ctx.strokeStyle = '#111'; ctx.stroke(); ctx.beginPath(); ctx.arc(X, Y, br * .38, 0, Math.PI * 2); ctx.fillStyle = '#111'; ctx.fill(); }
  }
  // a line through the points (smoothed), dotted for a pass, an arrow head for a run or a pass
  function stroke(ctx, c, st) {
    const P = st.pts.map(p => c.toS(p)); if (P.length < 2) return;
    const w = Math.max(3, c.r * c.s * (st.kind === 'pen' ? .22 : .26));
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = st.color; ctx.lineWidth = w;
    ctx.setLineDash(st.kind === 'pass' ? [w * 2.2, w * 1.6] : []);
    ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = w;
    ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]);
    for (let k = 1; k < P.length - 1; k++) { const mx = (P[k][0] + P[k + 1][0]) / 2, my = (P[k][1] + P[k + 1][1]) / 2; ctx.quadraticCurveTo(P[k][0], P[k][1], mx, my); }
    const last = P[P.length - 1]; ctx.lineTo(last[0], last[1]); ctx.stroke(); ctx.setLineDash([]);
    if (st.kind !== 'pen') { // the head points along the last part of the line
      let k = P.length - 2; while (k > 0 && Math.hypot(last[0] - P[k][0], last[1] - P[k][1]) < w * 4) k--;
      const a = Math.atan2(last[1] - P[k][1], last[0] - P[k][0]), h = w * 3.4;
      ctx.beginPath(); ctx.moveTo(last[0] + Math.cos(a) * w * .6, last[1] + Math.sin(a) * w * .6);
      ctx.lineTo(last[0] - Math.cos(a - .45) * h, last[1] - Math.sin(a - .45) * h); ctx.lineTo(last[0] - Math.cos(a + .45) * h, last[1] - Math.sin(a + .45) * h); ctx.closePath(); ctx.fillStyle = st.color; ctx.fill();
    }
    ctx.restore();
  }

  /* ---------- the finger ---------- */
  function bind() {
    const cv = B.cv, pt = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * B.cv.width / r.width, (e.clientY - r.top) * B.cv.height / r.height]; };
    let pid = null, penAt = 0;
    cv.onpointerdown = e => {
      if (e.pointerType === 'pen') penAt = Date.now(); else if (e.pointerType === 'touch' && Date.now() - penAt < 1500) return; // the hand resting while the pencil writes
      if (pid != null) return; pid = e.pointerId; try { cv.setPointerCapture(e.pointerId); } catch (x) {} e.preventDefault();
      const c = cam(), [X, Y] = pt(e), w = c.toW(X, Y), r = c.r * 1.5;
      const hit = B.players.filter(p => B.them || p.side === 'us').map(p => [p, Math.hypot(p.x - w[0], p.y - w[1])]).filter(x => x[1] < r).sort((a, b) => a[1] - b[1])[0];
      if (B.ball && Math.hypot(B.ball.x - w[0], B.ball.y - w[1]) < r * .8) B.drag = { ball: true, dx: B.ball.x - w[0], dy: B.ball.y - w[1] };
      else if (hit) B.drag = { p: hit[0], dx: hit[0].x - w[0], dy: hit[0].y - w[1], x0: hit[0].x, y0: hit[0].y };
      else B.cur = { kind: B.style, color: B.color, pts: [w] };
      draw();
    };
    cv.onpointermove = e => {
      if (e.pointerId !== pid) return; if (e.pointerType === 'pen') penAt = Date.now();
      const c = cam(), w = c.toW(...pt(e)), { L, W } = Board.dims({ format: B.fmt }), cl = (v, a, b) => Math.max(a, Math.min(b, v));
      if (B.drag && B.drag.ball) { B.ball.x = cl(w[0] + B.drag.dx, -2, L + 2); B.ball.y = cl(w[1] + B.drag.dy, -2, W + 2); }
      else if (B.drag) { B.drag.p.x = cl(w[0] + B.drag.dx, -2, L + 2); B.drag.p.y = cl(w[1] + B.drag.dy, -2, W + 2); }
      else if (B.cur) { const q = B.cur.pts[B.cur.pts.length - 1]; if (Math.hypot(w[0] - q[0], w[1] - q[1]) > c.r * .25) B.cur.pts.push(w); }
      draw();
    };
    const up = e => {
      if (e.pointerId !== pid) return; pid = null;
      if (B.drag && B.drag.p && (B.drag.p.x !== B.drag.x0 || B.drag.p.y !== B.drag.y0)) B.undo.push({ move: B.drag.p, x: B.drag.x0, y: B.drag.y0 });
      if (B.cur) { if (B.cur.pts.length > 1) { B.cur.pts = B.cur.pts.map(p => [+p[0].toFixed(1), +p[1].toFixed(1)]); B.strokes.push(B.cur); B.undo.push({ stroke: B.cur }); } }
      B.drag = null; B.cur = null; draw();
    };
    cv.onpointerup = up; cv.onpointercancel = up;
    B.ov.onclick = e => {
      const s = e.target.closest('[data-qbs]'), c = e.target.closest('[data-qbc]'), b = e.target.closest('[data-qb]');
      if (s) { B.style = s.dataset.qbs; B.ov.querySelectorAll('[data-qbs]').forEach(x => x.classList.toggle('on', x === s)); return; }
      if (c) { B.color = c.dataset.qbc; B.ov.querySelectorAll('[data-qbc]').forEach(x => x.classList.toggle('on', x === c)); return; }
      if (!b) return; const a = b.dataset.qb;
      if (a === 'close') return close();
      if (a === 'undo') return undo();
      if (a === 'wipe') { if (!B.strokes.length) return; B.undo.push({ wipe: B.strokes.slice() }); B.strokes = []; return draw(); }
      if (a === 'them') { B.them = !B.them; if (B.them && !B.players.some(x => x.side === 'them')) B.players.push(...theirs(B.fmt)); b.classList.toggle('on', B.them); return draw(); }
      if (a === 'ball') { const { L, W } = Board.dims({ format: B.fmt }); B.ball = B.ball ? null : { x: L / 2, y: W / 2 }; b.classList.toggle('on', !!B.ball); return draw(); }
      if (a === 'half') { B.half = !B.half; b.classList.toggle('on', B.half); return draw(); }
      if (a === 'reset') { B.undo.push({ reset: B.players.map(p => [p, p.x, p.y]) }); const fresh = [...ours(B.m, B.fmt), ...theirs(B.fmt)]; B.players.forEach(p => { const f = fresh.find(x => x.id === p.id); if (f) { p.x = f.x; p.y = f.y; } }); return draw(); }
      if (a === 'share') return share();
      if (a === 'keep') return keep();
      if (a === 'list') return list();
    };
  }
  function undo() {
    const u = B && B.undo.pop(); if (!u) return;
    if (u.stroke) B.strokes = B.strokes.filter(x => x !== u.stroke);
    if (u.move) { u.move.x = u.x; u.move.y = u.y; }
    if (u.wipe) B.strokes = u.wipe;
    if (u.reset) u.reset.forEach(([p, x, y]) => { p.x = x; p.y = y; });
    draw();
  }

  /* ---------- keep, share, the boards kept ---------- */
  const data = () => ({ fmt: B.fmt, half: B.half, them: B.them, ball: B.ball, players: B.players.map(p => Object.assign({}, p, { x: +p.x.toFixed(1), y: +p.y.toFixed(1) })), strokes: B.strokes });
  const store = () => B.m ? (B.m.boards = B.m.boards || []) : (S().ui.qboards = S().ui.qboards || []);
  function keep() {
    const kinds = B.m ? [['Avant-match', '🗣️'], ['Mi-temps', '⏸️'], ['Autre', '📌']] : [['Tableau', '📌']];
    UI.modal({ title: '📸 Garder ce tableau', body: `<p class="muted small">${B.m ? 'Il reste avec le match : tu le retrouves dans « Gardés », ici ou sur la fiche du match.' : 'Il reste sur cet appareil, dans « Gardés ».'}</p><div class="chips">${kinds.map(([k, ic]) => `<button class="chip" data-kind="${k}">${ic} ${k}</button>`).join('')}</div>`,
      onOpen: (r, close) => r.querySelectorAll('[data-kind]').forEach(x => x.onclick = () => {
        const l = store(), n = l.filter(b => b.label.startsWith(x.dataset.kind)).length;
        l.push({ id: Store.uid(), label: x.dataset.kind + (n ? ' ' + (n + 1) : ''), at: Date.now(), data: data() });
        if (B.m) Store.upsert('matches', B.m); else Store.persistNow();
        close(); toast('Tableau gardé : ' + l[l.length - 1].label);
      }), actions: [{ label: 'Annuler' }] });
  }
  function list() {
    const l = store();
    if (!l.length) return toast('Aucun tableau gardé pour l\'instant : « 📸 Garder »');
    UI.modal({ title: '🗂️ Tableaux gardés', body: `<div class="list">${l.slice().reverse().map(b => `<div class="list-item"><div class="grow"><b>${esc(b.label)}</b><span class="muted small"> · ${esc(new Date(b.at).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}</span></div>
        <button class="btn soft" data-open="${b.id}">Ouvrir</button><button class="icon-btn" data-del="${b.id}" aria-label="Supprimer">${I.trash}</button></div>`).join('')}</div>`,
      onOpen: (r, close) => { r.addEventListener('click', e => { const o = e.target.closest('[data-open]'), d = e.target.closest('[data-del]');
        if (o) { const b = l.find(x => x.id === o.dataset.open), m = B.m; close(); open({ matchId: m && m.id, board: b, title: (B && B.title) || b.label }); return; }
        if (d) { const k = l.findIndex(x => x.id === d.dataset.del); if (k >= 0) l.splice(k, 1); if (B.m) Store.upsert('matches', B.m); else Store.persistNow(); d.closest('.list-item').remove(); if (!l.length) close(); } }); },
      actions: [{ label: 'Fermer' }] });
  }
  async function share() {
    const c = document.createElement('canvas'), land = true; c.width = land ? 1600 : 1000; c.height = land ? 1040 : 1500;
    draw(c.getContext('2d'), c.width, c.height);
    const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', .9));
    try { await Exporter.deliver(blob, (B.title || 'tableau').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() + '.jpg'); } catch (e) { toast('Image impossible : ' + (e.message || e), 'err'); }
  }

  return { open, close, isOpen: () => !!B };
})();
