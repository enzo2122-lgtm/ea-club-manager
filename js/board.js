/* Board: geometry, animation model and canvas rendering of a tactical schema.
   World units are metres. x runs along the pitch length (our team attacks to the right), y across it. */
const Board = (() => {
  const PITCH = {
    '11': { L: 105, W: 68, box: [16.5, 40.32], six: [5.5, 18.32], spot: 11, circle: 9.15, goal: 7.32, label: 'Foot à 11' },
    '8':  { L: 64,  W: 48, box: [13, 26],      six: null,         spot: 9,  circle: 6,    goal: 6,    label: 'Foot à 8' },
    '5':  { L: 35,  W: 25, box: [6, 12],       six: null,         spot: 6,  circle: 4,    goal: 4,    label: 'Foot à 5' },
    b5:  { kind: 'basket', L: 28, W: 15, goal: 1, label: 'Basket 5 contre 5' },
    b3:  { kind: 'basket', half: true, L: 11, W: 15, goal: 1, label: 'Basket 3x3' },
    h7:  { kind: 'hand', L: 40, W: 20, goal: 3, label: 'Hand à 7' },
    r15: { kind: 'rugby', ig: 7, L: 114, W: 70, goal: 5.6, label: 'Rugby à XV' },
    r10: { kind: 'rugby', ig: 5, L: 70, W: 40, goal: 5.6, label: 'Rugby à X (école)' },
    r7:  { kind: 'rugby', ig: 7, L: 114, W: 70, goal: 5.6, label: 'Rugby à 7' },
    v6:  { kind: 'volley', free: 3, attack: 3, L: 24, W: 15, goal: 1, label: 'Volley 6 contre 6' },
    v4:  { kind: 'volley', free: 2, attack: 0, L: 16, W: 10, goal: 1, label: 'Volley 4 contre 4' },
  };
  const ARROWS = {
    course:   { label: 'Course',   color: '#ffffff', w: .2 },
    conduite: { label: 'Conduite', color: '#ffffff', w: .17, wave: true },
    passe:    { label: 'Passe',    color: '#ffb54a', w: .18, dash: [.6, .38] },
    tir:      { label: 'Tir',      color: '#ffb54a', w: .32 },
    pressing: { label: 'Pressing', color: '#ff5a4a', w: .24 },
    bascule:  { label: 'Bascule',  color: '#8fd0ff', w: .15, dash: [.2, .32] },
  };
  const BIBS = {
    bordeaux: ['#8c1024', '#ffffff'], marine: ['#13245a', '#ffffff'], bleu: ['#2563eb', '#ffffff'], rouge: ['#e11d48', '#ffffff'], jaune: ['#facc15', '#2a2200'], vert: ['#a3e635', '#13240b'],
    noir: ['#121518', '#f5f7f5'], blanc: ['#f8fafc', '#111827'], orange: ['#fb923c', '#2b1400'], violet: ['#8b5cf6', '#ffffff'],
  };
  const ZONE_COLORS = { jaune: '#ffe14d', bleu: '#60a5fa', rouge: '#f87171', violet: '#c084fc', blanc: '#ffffff', vert: '#a3e635' };
  const PHASES = [['Conservation', '#8fd0ff'], ['Progression', '#c6f25e'], ['Déséquilibre', '#ffb54a'], ['Finition', '#ff6b57']];
  const LANE_NAMES = ['Couloir', 'Demi-espace', 'Axe', 'Demi-espace', 'Couloir'];

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  function bez(p0, p1, c, k) {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
    const cx = (p0[0] + p1[0]) / 2 - dy * c, cy = (p0[1] + p1[1]) / 2 + dx * c, m = 1 - k;
    return [m * m * p0[0] + 2 * m * k * cx + k * k * p1[0], m * m * p0[1] + 2 * m * k * cy + k * k * p1[1]];
  }

  /* ---------- geometry ---------- */
  function dims(f) {
    if (f.format === 'zone') return { L: f.w || 30, W: f.h || 20 };
    if (f.format === 'bg') return { L: f.w || 100, W: f.h || 60 };
    const P = PITCH[f.format] || PITCH['11'];
    return { L: P.L, W: P.W };
  }
  function extents(f) {
    const { L, W } = dims(f);
    if (f.format !== 'zone' && f.format !== 'bg' && f.view === 'half') return { x0: L / 2 - 2, x1: L, y0: 0, y1: W, L, W };
    return { x0: 0, x1: L, y0: 0, y1: W, L, W };
  }
  function tokenR(f) { const e = extents(f); return Math.max(e.x1 - e.x0, e.y1 - e.y0) / 40; }
  function phases(f) {
    const { L } = dims(f);
    const cuts = f.format === '11' ? [0, 35, 70, 88.5, 105] : f.format === '8' ? [0, L / 3, 2 * L / 3, L - 13, L] : [0, L * .35, L * .6, L * .8, L];
    return PHASES.map((p, i) => [cuts[i], cuts[i + 1], p[0], p[1]]);
  }
  function lanes(f) {
    const { W } = dims(f);
    let c;
    if (f.format === '11') { const a = (W - 40.32) / 2, b = (W - 18.32) / 2; c = [0, a, b, W - b, W - a, W]; }
    else if (f.format === '8') { const a = (W - 26) / 2, b = (W - 12) / 2; c = [0, a, b, W - b, W - a, W]; }
    else c = [0, W * .2, W * .35, W * .65, W * .8, W];
    return LANE_NAMES.map((n, i) => [c[i], c[i + 1], n]);
  }
  // The camera maps world metres to screen pixels. In "vertical" mode (phone held upright) the pitch is turned
  // a quarter turn: we attack towards the top of the screen and our left touchline is on the left.
  function camera(sc, W, H, opts = {}) {
    const f = sc.field, e = extents(f), r = tokenR(f), ov = sc.overlays || {}, v = !!opts.vertical && f.format !== 'bg';
    // Margins in world units: lo/hi along the length (x) and across the width (y)
    const m = { xLo: r * 2, xHi: r * 2 + (ov.lanes ? (v ? r * 2 : r * 5.2) : 0), yLo: r * 2 + (ov.phases ? r * 1.5 : 0), yHi: r * 2 };
    const lenX = e.x1 - e.x0 + m.xLo + m.xHi, lenY = e.y1 - e.y0 + m.yLo + m.yHi;
    const sw = v ? lenY : lenX, sh = v ? lenX : lenY, s = Math.min(W / sw, H / sh);
    const ox = (W - sw * s) / 2, oy = (H - sh * s) / 2;
    const toS = v
      ? p => [ox + (p[1] - (e.y0 - m.yLo)) * s, oy + (e.x1 + m.xHi - p[0]) * s]
      : p => [ox + (p[0] - (e.x0 - m.xLo)) * s, oy + (p[1] - (e.y0 - m.yLo)) * s];
    const toW = v
      ? (X, Y) => [e.x1 + m.xHi - (Y - oy) / s, (X - ox) / s + (e.y0 - m.yLo)]
      : (X, Y) => [(X - ox) / s + (e.x0 - m.xLo), (Y - oy) / s + (e.y0 - m.yLo)];
    // Screen rectangle of a world rectangle
    const rect = (x, y, w, h) => { const a = toS([x, y]), b = toS([x + w, y + h]); return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])]; };
    return { s, e, r, m, vertical: v, toS, toW, rect };
  }

  /* ---------- animation model ---------- */
  const obj = (sc, id) => sc.objects.find(o => o.id === id);
  function moveType(sc, k, id) {
    const nxt = sc.steps[k + 1]; if (!nxt) return 'none';
    const o = obj(sc, id); if (!o) return 'none';
    const A = sc.steps[k].pos[id], B = nxt.pos[id];
    if (!A || !B || dist(A, B) < tokenR(sc.field) * .6) return 'none';
    const set = (nxt.moves || {})[id];
    if (set && set.type) return set.type;
    if (o.type === 'ball') return carrier(sc, k, id) ? 'none' : 'passe';
    if (o.type === 'player') {
      const ball = sc.objects.find(b => b.type === 'ball' && carrierIs(sc, k, b.id, id));
      return ball ? 'conduite' : 'course';
    }
    return 'course';
  }
  // A ball is "carried" if one player stays next to it from step k to k+1
  function carrierIs(sc, k, ballId, pid) {
    const r = tokenR(sc.field) * 2.1, s0 = sc.steps[k], s1 = sc.steps[k + 1];
    if (!s1) return false;
    const b0 = s0.pos[ballId], b1 = s1.pos[ballId], p0 = s0.pos[pid], p1 = s1.pos[pid];
    return b0 && b1 && p0 && p1 && dist(b0, p0) < r && dist(b1, p1) < r && dist(b0, b1) > .1;
  }
  function carrier(sc, k, ballId) {
    return sc.objects.some(o => o.type === 'player' && carrierIs(sc, k, ballId, o.id));
  }
  function posAt(sc, k, u, id) {
    const A = sc.steps[k].pos[id];
    if (!A) return null;
    if (u <= 0 || k >= sc.steps.length - 1) return A;
    const B = sc.steps[k + 1].pos[id] || A;
    const mv = (sc.steps[k + 1].moves || {})[id] || {};
    let t = u;
    const o = obj(sc, id);
    if (o && o.type === 'ball') { const ty = moveType(sc, k, id); if (ty === 'passe' || ty === 'tir') t = clamp((u - .2) / .65); }
    return bez(A, B, mv.c || 0, ease(clamp(t)));
  }
  function stepDur(sc, k) { return (sc.steps[k] && sc.steps[k].dur) || 2; }

  /* ---------- drawing helpers ---------- */
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
  function arrowPath(cam, a, b, c, type, s0, s1) {
    const st = ARROWS[type]; if (!st) return null;
    const L = dist(a, b); if (L < s0 + s1 + cam.r * .5) return null;
    const ta = s0 / L, tb = 1 - s1 / L, N = 40, pts = [];
    for (let j = 0; j <= N; j++) {
      const k = ta + (tb - ta) * j / N; let p = bez(a, b, c, k);
      if (st.wave) {
        const q = bez(a, b, c, Math.min(1, k + .002)), tl = dist(p, q) || 1, tx = (q[0] - p[0]) / tl, ty = (q[1] - p[1]) / tl, sN = j / N;
        const env = Math.min(1, sN / .1, (1 - sN) / .18), amp = cam.r * .3 * env * Math.sin(sN * L * (tb - ta) / (cam.r * 1.5) * Math.PI * 2);
        p = [p[0] - ty * amp, p[1] + tx * amp];
      }
      pts.push(cam.toS(p));
    }
    return pts;
  }
  function drawArrow(ctx, cam, a, b, c, type, s0, s1, alpha = 1) {
    const pts = arrowPath(cam, a, b, c, type, s0, s1); if (!pts) return;
    const st = ARROWS[type], lw = Math.max(1.5, st.w * cam.r * cam.s);
    ctx.save(); ctx.globalAlpha = alpha; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const line = (col, w) => {
      ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
      ctx.strokeStyle = col; ctx.lineWidth = w;
      ctx.setLineDash(st.dash ? st.dash.map(v => v * cam.r * cam.s) : []); ctx.stroke();
    };
    line('rgba(0,0,0,.3)', lw * 2); line(st.color, lw);
    ctx.setLineDash([]);
    const p = pts[pts.length - 1], q = pts[pts.length - 3] || pts[0], ang = Math.atan2(p[1] - q[1], p[0] - q[0]), hs = Math.max(9, lw * 3.3);
    ctx.beginPath(); ctx.moveTo(p[0] + Math.cos(ang) * hs * .35, p[1] + Math.sin(ang) * hs * .35);
    ctx.lineTo(p[0] - Math.cos(ang - .5) * hs, p[1] - Math.sin(ang - .5) * hs);
    ctx.lineTo(p[0] - Math.cos(ang + .5) * hs, p[1] - Math.sin(ang + .5) * hs); ctx.closePath();
    ctx.fillStyle = st.color; ctx.fill();
    ctx.restore();
  }
  function label(ctx, x, y, txt, size, color, align = 'center', weight = 800) {
    ctx.font = `${weight} ${size}px ui-rounded, "SF Pro Rounded", system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(txt, x, y);
  }
  function pill(ctx, x, y, txt, size) {
    ctx.font = `700 ${size}px ui-rounded, system-ui, -apple-system, sans-serif`;
    const w = ctx.measureText(txt).width + size * 1.1, h = size * 1.7;
    rr(ctx, x - w / 2, y - h / 2, w, h, h / 2); ctx.fillStyle = 'rgba(8,22,14,.85)'; ctx.fill();
    label(ctx, x, y + size * .04, txt, size, '#fff', 'center', 700);
  }

  /* ---------- pitch ---------- */
  // Backgrounds (a photo, a PDF page or a video frame) are kept decoded in memory, keyed by media id
  const BG = new Map();
  async function ensureBg(sc) {
    const f = sc && sc.field, ids = [f && f.format === 'bg' && f.bgId, sc && sc.trace && sc.trace.bgId].filter(id => id && !BG.has(id));
    for (const id of ids) {
      try {
        const m = await Media.get(id); if (!m || !m.blob) continue;
        const img = await Media.loadImage(URL.createObjectURL(m.blob)); BG.set(id, img);
      } catch (e) {}
    }
  }
  // « Mettre au propre »: the photo of a hand-drawn exercise, see-through over a clean pitch, to redraw it with the tools
  function drawTrace(ctx, cam, sc) {
    const tr = sc.trace, img = tr && tr.on !== false && BG.get(tr.bgId); if (!img) return;
    const { L, W: FW } = dims(sc.field);
    // « multiply »: the white paper disappears, only the pen strokes stay on the grass
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = tr.opacity == null ? .7 : tr.opacity; ctx.drawImage(img, ...cam.rect(0, 0, L, FW)); ctx.restore();
  }
  const preloadBackgrounds = list => Promise.all((list || []).map(ensureBg));
  /* ---------- the courts of the other sports (basket, hand, rugby, volley) ---------- */
  function drawCourt(ctx, cam, sc, W, H) {
    const f = sc.field, { L, W: FW } = dims(f), s = cam.s, P = PITCH[f.format];
    const line = (x1, y1, x2, y2, dash) => { ctx.setLineDash(dash ? dash.map(d => d * s) : []); ctx.beginPath(); ctx.moveTo(...cam.toS([x1, y1])); ctx.lineTo(...cam.toS([x2, y2])); ctx.stroke(); ctx.setLineDash([]); };
    const arc = (x, y, r, a0, a1, dash) => { ctx.setLineDash(dash ? dash.map(d => d * s) : []); ctx.beginPath(); for (let i = 0; i <= 32; i++) { const a = a0 + (a1 - a0) * i / 32, p = cam.toS([x + r * Math.cos(a), y + r * Math.sin(a)]); i ? ctx.lineTo(...p) : ctx.moveTo(...p); } ctx.stroke(); ctx.setLineDash([]); };
    const rect = (x, y, w, h, fill) => { const r = cam.rect(x, y, w, h); if (fill) { ctx.fillStyle = fill; ctx.fillRect(...r); } else ctx.strokeRect(...r); };
    const lw = Math.max(1, .1 * s), white = 'rgba(255,255,255,.9)', cy = FW / 2;
    if (P.kind === 'basket') {
      ctx.fillStyle = '#7a4a24'; ctx.fillRect(0, 0, W, H); rect(0, 0, L, FW, '#c98c55');
      for (let x = 0; x < L; x += 1.2) rect(x, 0, .6, FW, 'rgba(255,255,255,.04)');
      ctx.strokeStyle = white; ctx.lineWidth = lw; rect(0, 0, L, FW);
      const ends = P.half ? [[L, -1]] : [[0, 1], [L, -1]];
      if (!P.half) { line(L / 2, 0, L / 2, FW); arc(L / 2, cy, 1.8, 0, Math.PI * 2); }
      ends.forEach(([x0, d]) => {
        rect(d > 0 ? x0 : x0 - 5.8, cy - 2.45, 5.8, 4.9, 'rgba(140,16,36,.35)'); ctx.strokeStyle = white; rect(d > 0 ? x0 : x0 - 5.8, cy - 2.45, 5.8, 4.9);
        arc(x0 + d * 5.8, cy, 1.8, d > 0 ? -Math.PI / 2 : Math.PI / 2, d > 0 ? Math.PI / 2 : Math.PI * 1.5);
        const bx = x0 + d * 1.575, k = Math.sqrt(6.75 * 6.75 - (cy - .9) * (cy - .9)), ang = Math.asin((cy - .9) / 6.75);
        line(x0, .9, bx + d * k, .9); line(x0, FW - .9, bx + d * k, FW - .9);
        if (d > 0) arc(bx, cy, 6.75, -ang, ang); else arc(bx, cy, 6.75, Math.PI - ang, Math.PI + ang);
        line(x0 + d * 1.2, cy - .9, x0 + d * 1.2, cy + .9);
        ctx.strokeStyle = '#ff7a1a'; arc(bx, cy, .23, 0, Math.PI * 2); ctx.strokeStyle = white;
      });
      return;
    }
    if (P.kind === 'hand') {
      ctx.fillStyle = '#183a6b'; ctx.fillRect(0, 0, W, H); rect(0, 0, L, FW, '#2f6fb3');
      ctx.strokeStyle = white; ctx.lineWidth = lw; rect(0, 0, L, FW); line(L / 2, 0, L / 2, FW);
      ctx.save(); ctx.beginPath(); ctx.rect(...cam.rect(0, 0, L, FW)); ctx.clip();
      [[0, 1], [L, -1]].forEach(([x0, d]) => {
        const zone = (r, dash) => { const a = d > 0 ? [-Math.PI / 2, 0] : [Math.PI, Math.PI * 1.5], b = d > 0 ? [0, Math.PI / 2] : [Math.PI / 2, Math.PI];
          arc(x0, cy - 1.5, r, a[0], a[1], dash); arc(x0, cy + 1.5, r, b[0], b[1], dash); line(x0 + d * r, cy - 1.5, x0 + d * r, cy + 1.5, dash); };
        ctx.fillStyle = 'rgba(226,194,125,.35)'; ctx.beginPath(); ctx.moveTo(...cam.toS([x0, cy - 7.5]));
        for (let i = 0; i <= 16; i++) { const a = -Math.PI / 2 + Math.PI / 2 * i / 16; ctx.lineTo(...cam.toS([x0 + d * 6 * Math.cos(a), cy - 1.5 + 6 * Math.sin(a)])); }
        for (let i = 0; i <= 16; i++) { const a = Math.PI / 2 * i / 16; ctx.lineTo(...cam.toS([x0 + d * 6 * Math.cos(a), cy + 1.5 + 6 * Math.sin(a)])); }
        ctx.closePath(); ctx.fill();
        zone(6); zone(9, [.4, .3]); line(x0 + d * 7, cy - .5, x0 + d * 7, cy + .5);
        const g = cam.rect(d > 0 ? x0 - 1 : x0, cy - 1.5, 1, 3); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(...g); ctx.strokeRect(...g);
      });
      ctx.restore(); ctx.strokeStyle = white; ctx.lineWidth = lw;
      [[0, 1], [L, -1]].forEach(([x0, d]) => { const g = cam.rect(d > 0 ? x0 - 1 : x0, cy - 1.5, 1, 3); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(...g); ctx.strokeRect(...g); });
      return;
    }
    if (P.kind === 'rugby') {
      ctx.fillStyle = '#1f5137'; ctx.fillRect(0, 0, W, H); rect(0, 0, L, FW, '#2c6646');
      const ig = P.ig, F = L - 2 * ig; rect(0, 0, ig, FW, '#275c3f'); rect(L - ig, 0, ig, FW, '#275c3f');
      ctx.strokeStyle = white; ctx.lineWidth = lw; rect(0, 0, L, FW);
      line(ig, 0, ig, FW); line(L - ig, 0, L - ig, FW); line(L / 2, 0, L / 2, FW);
      if (F >= 90) { line(ig + 22, 0, ig + 22, FW); line(L - ig - 22, 0, L - ig - 22, FW); }
      line(L / 2 - 10, 0, L / 2 - 10, FW, [1.2, 1]); line(L / 2 + 10, 0, L / 2 + 10, FW, [1.2, 1]);
      line(ig + 5, 0, ig + 5, FW, [1.2, 1.6]); line(L - ig - 5, 0, L - ig - 5, FW, [1.2, 1.6]);
      if (FW >= 50) [5, 15, FW - 15, FW - 5].forEach(y => line(ig, y, L - ig, y, [1, 4]));
      [[ig, 1], [L - ig, -1]].forEach(([x0]) => { ctx.lineWidth = lw * 2.4; line(x0, cy - 2.8, x0, cy + 2.8); ctx.lineWidth = lw;
        ctx.fillStyle = '#fff'; [cy - 2.8, cy + 2.8].forEach(y => { ctx.beginPath(); ctx.arc(...cam.toS([x0, y]), Math.max(2, .35 * s), 0, Math.PI * 2); ctx.fill(); }); });
      return;
    }
    if (P.kind === 'volley') {
      ctx.fillStyle = '#244f8a'; ctx.fillRect(0, 0, W, H); rect(0, 0, L, FW, '#2f63a8');
      const m = P.free, cl = L - 2 * m, cw = FW - 2 * m; rect(m, m, cl, cw, '#d9824a');
      ctx.strokeStyle = white; ctx.lineWidth = lw; rect(m, m, cl, cw);
      if (P.attack) { line(L / 2 - P.attack, m, L / 2 - P.attack, m + cw); line(L / 2 + P.attack, m, L / 2 + P.attack, m + cw); }
      ctx.lineWidth = lw * 3; ctx.strokeStyle = '#f8fafc'; line(L / 2, m - .6, L / 2, m + cw + .6); ctx.lineWidth = lw;
      ctx.fillStyle = '#111827'; [m - .9, m + cw + .9].forEach(y => { ctx.beginPath(); ctx.arc(...cam.toS([L / 2, y]), Math.max(2, .25 * s), 0, Math.PI * 2); ctx.fill(); });
    }
  }
  function drawPitch(ctx, cam, sc, W, H) {
    const f = sc.field, { L, W: FW } = dims(f), s = cam.s, P = PITCH[f.format];
    if (P && P.kind) return drawCourt(ctx, cam, sc, W, H);
    if (f.format === 'bg') {
      ctx.fillStyle = '#10182e'; ctx.fillRect(0, 0, W, H);
      const img = BG.get(f.bgId), rc = cam.rect(0, 0, L, FW);
      if (img) ctx.drawImage(img, ...rc);
      else { ctx.fillStyle = '#1c2748'; ctx.fillRect(...rc); label(ctx, rc[0] + rc[2] / 2, rc[1] + rc[3] / 2, 'Image absente sur cet appareil', Math.max(12, cam.r * .7 * s), '#e2c27d'); }
      const ov = sc.overlays || {};
      if (ov.phases) drawPhases(ctx, cam, sc);
      if (ov.lanes) drawLanes(ctx, cam, sc);
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1; ctx.strokeRect(...rc);
      return;
    }
    // a free zone of an indoor sport: the floor of the hall (wood for basket, blue for hand, orange for volley)
    const floor = typeof Sport !== 'undefined' && !P ? ({ basket: ['#7a4a24', '#c98c55', '#c4864f'], hand: ['#183a6b', '#2f6fb3', '#2b68a8'], volley: ['#244f8a', '#d9824a', '#d27c45'] })[Sport.id()] : null;
    const [c0, c1, c2] = floor || ['#1f5137', '#2c6646', '#306d4b'];
    ctx.fillStyle = c0; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = c1; ctx.fillRect(...cam.rect(0, 0, L, FW));
    const sw = L > 50 ? 5.25 : 3.2;
    ctx.fillStyle = c2;
    for (let x = 0; x < L; x += sw * 2) ctx.fillRect(...cam.rect(x, 0, Math.min(sw, L - x), FW));
    const ov = sc.overlays || {};
    if (ov.phases) drawPhases(ctx, cam, sc);
    if (ov.lanes) drawLanes(ctx, cam, sc);
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = Math.max(1, .12 * s);
    ctx.strokeRect(...cam.rect(0, 0, L, FW));
    if (P) {
      const cy = FW / 2, line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(...cam.toS([x1, y1])); ctx.lineTo(...cam.toS([x2, y2])); ctx.stroke(); };
      line(L / 2, 0, L / 2, FW);
      ctx.beginPath(); ctx.arc(...cam.toS([L / 2, cy]), P.circle * s, 0, Math.PI * 2); ctx.stroke();
      [[0, 1], [L, -1]].forEach(([x0, d]) => {
        const box = (dep, wid) => ctx.strokeRect(...cam.rect(d > 0 ? x0 : x0 - dep, cy - wid / 2, dep, wid));
        box(P.box[0], P.box[1]); if (P.six) box(P.six[0], P.six[1]);
        ctx.beginPath(); ctx.arc(...cam.toS([x0 + d * P.spot, cy]), Math.max(1.5, .22 * s), 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
        const g = cam.rect(d > 0 ? x0 - 2 : x0, cy - P.goal / 2, 2, P.goal);
        ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(...g); ctx.strokeRect(...g);
      });
    }
  }
  function drawPhases(ctx, cam, sc) {
    const { W: FW } = dims(sc.field), s = cam.s, r = cam.r;
    phases(sc.field).forEach(([a, b, name, col], i) => {
      ctx.globalAlpha = .1; ctx.fillStyle = col; ctx.fillRect(...cam.rect(a, 0, b - a, FW)); ctx.globalAlpha = 1;
      if (i) {
        ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, .12 * s); ctx.setLineDash([r * .8 * s, r * .5 * s]);
        ctx.beginPath(); ctx.moveTo(...cam.toS([a, 0])); ctx.lineTo(...cam.toS([a, FW])); ctx.stroke(); ctx.restore();
      }
      const xa = Math.max(a, cam.e.x0), xb = Math.min(b, cam.e.x1);
      if (xb - xa > r) {
        ctx.fillStyle = col; rr(ctx, ...cam.rect(xa + .4, -r * .95, xb - xa - .8, r * .22), r * .11 * s); ctx.fill();
        const [lx, ly] = cam.toS([(xa + xb) / 2, -r * .45]), fs = Math.max(9, r * .62 * s);
        if (cam.vertical) { ctx.save(); ctx.translate(lx, ly); ctx.rotate(-Math.PI / 2); label(ctx, 0, 0, name.toUpperCase(), fs, col); ctx.restore(); }
        else label(ctx, lx, ly - r * .15 * s, name.toUpperCase(), fs, col);
      }
    });
  }
  const LANE_SHORT = { 'Couloir': 'COUL.', 'Demi-espace': '½ ESP.', 'Axe': 'AXE' };
  function drawLanes(ctx, cam, sc) {
    const { L } = dims(sc.field), s = cam.s, r = cam.r;
    lanes(sc.field).forEach(([a, b, name], i) => {
      if (name === 'Demi-espace') {
        const [x, y, w, h] = cam.rect(0, a, L, b - a);
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
        ctx.strokeStyle = 'rgba(255,255,255,.13)'; ctx.lineWidth = Math.max(1, .3 * s);
        for (let d = -h; d < w; d += 1.6 * s) { ctx.beginPath(); ctx.moveTo(x + d, y + h); ctx.lineTo(x + d + h, y); ctx.stroke(); }
        ctx.restore();
      }
      if (i) {
        ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = Math.max(1, .1 * s); ctx.setLineDash([r * .35 * s, r * .35 * s]);
        ctx.beginPath(); ctx.moveTo(...cam.toS([0, a])); ctx.lineTo(...cam.toS([L, a])); ctx.stroke(); ctx.restore();
      }
      const [lx, ly] = cam.toS([cam.e.x1 + (cam.vertical ? r * .9 : r * 1.5), (a + b) / 2]);
      label(ctx, lx, ly, cam.vertical ? LANE_SHORT[name] : name.toUpperCase(), Math.max(9, r * .55 * s), 'rgba(255,255,255,.85)', cam.vertical ? 'center' : 'left');
    });
  }
  function drawZones(ctx, cam, sc, sel) {
    const s = cam.s;
    (sc.zones || []).forEach(z => {
      const col = ZONE_COLORS[z.color] || '#ffe14d', [x, y, w, h] = cam.rect(z.x, z.y, z.w, z.h);
      ctx.save(); ctx.globalAlpha = .16; ctx.fillStyle = col; rr(ctx, x, y, w, h, cam.r * .3 * s); ctx.fill(); ctx.restore();
      ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, .14 * s); ctx.setLineDash([cam.r * .45 * s, cam.r * .3 * s]);
      rr(ctx, x, y, w, h, cam.r * .3 * s); ctx.stroke(); ctx.restore();
      if (z.label) label(ctx, x + w / 2, y + cam.r * .75 * s, z.label.toUpperCase(), Math.max(10, cam.r * .62 * s), col);
      if (sel && sel.kind === 'zone' && sel.id === z.id) handle(ctx, ...cam.toS([z.x + z.w, z.y + z.h]), cam);
    });
  }
  function handle(ctx, x, y, cam) {
    ctx.beginPath(); ctx.arc(x, y, Math.max(9, cam.r * .45 * cam.s), 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#2563eb'; ctx.stroke();
  }
  function drawBloc(ctx, cam, sc, k, u, homeBib) {
    const pts = sc.objects.filter(o => o.type === 'player' && !o.gk && o.color !== homeBib).map(o => posAt(sc, k, u, o.id)).filter(Boolean);
    if (pts.length < 3) return;
    const pad = cam.r * 1.45, xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad, s = cam.s;
    const [X, Y, w, h] = cam.rect(x0, y0, x1 - x0, y1 - y0);
    ctx.save(); ctx.fillStyle = 'rgba(10,12,14,.14)'; rr(ctx, X, Y, w, h, cam.r * s); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = Math.max(1.5, .12 * s); ctx.setLineDash([cam.r * .25 * s, cam.r * .3 * s]); ctx.stroke(); ctx.restore();
    pill(ctx, X + w / 2, Y + h, `bloc adverse · ${Math.round(x1 - x0 - 2 * pad)} m`, Math.max(10, cam.r * .55 * s));
  }

  /* ---------- objects ---------- */
  function drawObject(ctx, cam, o, p, opts) {
    const s = cam.s, r = cam.r * s, [x, y] = cam.toS(p);
    if (o.type === 'player') {
      const [fill, ink] = BIBS[o.color] || BIBS.bleu;
      ctx.beginPath(); ctx.arc(x + r * .12, y + r * .2, r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
      ctx.lineWidth = Math.max(1.5, r * .12); ctx.strokeStyle = o.color === 'noir' ? '#e9efe9' : 'rgba(0,0,0,.55)'; ctx.stroke();
      if (o.gk) { ctx.beginPath(); ctx.arc(x, y, r * .78, 0, Math.PI * 2); ctx.strokeStyle = ink; ctx.globalAlpha = .45; ctx.lineWidth = Math.max(1, r * .08); ctx.stroke(); ctx.globalAlpha = 1; }
      const t = String(o.label || ''); if (t) label(ctx, x, y + r * .06, t, r * (t.length >= 3 ? .72 : t.length === 2 ? .9 : 1.05), ink);
      if (opts.names && o.name) {
        ctx.font = `700 ${Math.max(10, r * .62)}px ui-rounded, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.strokeText(o.name, x, y + r * 1.15); ctx.fillStyle = '#fff'; ctx.fillText(o.name, x, y + r * 1.15);
      }
    } else if (o.type === 'ball') {
      ctx.beginPath(); ctx.arc(x, y, r * .45, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = Math.max(1.2, r * .1); ctx.strokeStyle = '#111'; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, r * .16, 0, Math.PI * 2); ctx.fillStyle = '#111'; ctx.fill();
    } else if (o.type === 'cone') {
      const col = { orange: '#ff8a2a', jaune: '#facc15', bleu: '#3b82f6', rouge: '#ef4444' }[o.color] || '#ff8a2a';
      ctx.beginPath(); ctx.arc(x, y, r * .42, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = Math.max(1, r * .08); ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, r * .15, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fill();
    } else if (o.type === 'goal') {
      const big = o.size !== 'mini', gw = (big ? (o.w || 6) : 2.4) * s, gd = (big ? 2 : 1) * s;
      ctx.save(); ctx.translate(x, y); ctx.rotate(((o.rot || 0) - (cam.vertical ? 90 : 0)) * Math.PI / 180);
      ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(-gd / 2, -gw / 2, gd, gw);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.5, .14 * s); ctx.strokeRect(-gd / 2, -gw / 2, gd, gw);
      ctx.beginPath(); ctx.moveTo(-gd / 2, -gw / 2); ctx.lineTo(-gd / 2, gw / 2); ctx.lineWidth = Math.max(2.5, .3 * s); ctx.stroke();
      ctx.restore();
    }
  }

  /* ---------- frame ---------- */
  // opts: {names, homeBib, editor:{sel, ghosts}, outgoing:true}
  function drawFrame(ctx, W, H, sc, k, u, opts = {}) {
    const cam = camera(sc, W, H, { vertical: opts.vertical }), r = cam.r, st = sc.steps[k], ov = sc.overlays || {};
    drawPitch(ctx, cam, sc, W, H);
    drawTrace(ctx, cam, sc);
    drawZones(ctx, cam, sc, opts.editor && opts.editor.sel);
    if (ov.bloc) drawBloc(ctx, cam, sc, k, u, opts.homeBib || 'bleu');
    const ed = opts.editor;
    // incoming trails (editor only): where things came from
    if (ed && k > 0) {
      sc.objects.forEach(o => {
        const A = sc.steps[k - 1].pos[o.id], B = st.pos[o.id]; if (!A || !B || dist(A, B) < r * .6) return;
        const [x, y] = cam.toS(A); ctx.beginPath(); ctx.arc(x, y, (o.type === 'player' ? r : r * .45) * cam.s, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fill(); ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);
        const ty = moveType(sc, k - 1, o.id), mv = (st.moves || {})[o.id] || {};
        if (ty !== 'none') drawArrow(ctx, cam, A, B, mv.c || 0, ty, o.type === 'player' ? r * 1.05 : r * .4, o.type === 'player' ? r * 1.1 : r * .5, .45);
      });
    }
    // outgoing movements (what happens next)
    if (opts.outgoing !== false && k < sc.steps.length - 1) {
      const nx = sc.steps[k + 1];
      sc.objects.forEach(o => {
        const ty = moveType(sc, k, o.id); if (ty === 'none') return;
        const A = st.pos[o.id], B = nx.pos[o.id], mv = (nx.moves || {})[o.id] || {};
        const big = o.type === 'player';
        drawArrow(ctx, cam, A, B, mv.c || 0, ty, big ? r * 1.05 : r * .4, big ? r * 1.1 : r * .5, ed ? .9 : 1);
        if (ed && ed.sel && ed.sel.kind === 'move' && ed.sel.id === o.id) {
          // where it goes: a see-through copy with a handle to drag the end
          ctx.save(); ctx.globalAlpha = .45; drawObject(ctx, cam, o, B, opts); ctx.restore();
          handle(ctx, ...cam.toS(B), cam);
        }
      });
    }
    (st.arrows || []).forEach(a => {
      drawArrow(ctx, cam, a.a, a.b, a.c || 0, a.type, 0, 0);
      if (ed && ed.sel && ed.sel.kind === 'arrow' && ed.sel.id === a.id) { handle(ctx, ...cam.toS(a.a), cam); handle(ctx, ...cam.toS(a.b), cam); }
    });
    const order = { goal: 0, cone: 1, player: 2, ball: 3 };
    sc.objects.slice().sort((a, b) => order[a.type] - order[b.type]).forEach(o => {
      const p = posAt(sc, k, u, o.id); if (!p) return;
      drawObject(ctx, cam, o, p, opts);
      if (ed && ed.sel && ed.sel.kind === 'obj' && ed.sel.id === o.id) {
        const [x, y] = cam.toS(p); ctx.beginPath(); ctx.arc(x, y, (o.type === 'player' ? r * 1.35 : r * .9) * cam.s, 0, Math.PI * 2);
        ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 3; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
      }
    });
    return cam;
  }

  /* ---------- hit testing ---------- */
  function hit(sc, k, cam, w) {
    const r = cam.r, st = sc.steps[k];
    const order = { ball: 0, player: 1, cone: 2, goal: 3 };
    const objs = sc.objects.slice().sort((a, b) => order[a.type] - order[b.type]);
    for (const o of objs) {
      const p = st.pos[o.id]; if (!p) continue;
      const rad = o.type === 'player' ? r * 1.15 : o.type === 'goal' ? r * 1.5 : r * .8;
      if (dist(p, w) < rad) return { kind: 'obj', id: o.id };
    }
    // a movement towards the next step: touch its arrow
    if (k < sc.steps.length - 1) for (const o of objs) {
      if (moveType(sc, k, o.id) === 'none') continue;
      const A = st.pos[o.id], B = sc.steps[k + 1].pos[o.id], c = ((sc.steps[k + 1].moves || {})[o.id] || {}).c || 0;
      for (let j = 4; j <= 20; j++) if (dist(bez(A, B, c, j / 20), w) < r * .7) return { kind: 'move', id: o.id };
    }
    for (const a of st.arrows || []) {
      for (let j = 0; j <= 20; j++) if (dist(bez(a.a, a.b, a.c || 0, j / 20), w) < r * .6) return { kind: 'arrow', id: a.id };
    }
    for (const z of (sc.zones || []).slice().reverse()) {
      if (w[0] >= z.x && w[0] <= z.x + z.w && w[1] >= z.y && w[1] <= z.y + z.h) return { kind: 'zone', id: z.id };
    }
    return null;
  }

  return { ensureBg, preloadBackgrounds, BG, PITCH, ARROWS, BIBS, ZONE_COLORS, dims, extents, tokenR, camera, drawFrame, drawArrow, hit, posAt, moveType, stepDur, dist, bez, clamp, ease };
})();
