/* Tele: drawings on the match video, like the club's analysis videos: a light beam on a player, a ring under his feet,
   his vision cone, a label (« Repli défensif », « Prise à deux »), a movement arrow, the line or the block formed by several
   players, a space, a free line, a stopwatch, a zoom. Each drawing belongs to a sequence, appears at its moment of the video
   (with an optional freeze of the image) and stays a few seconds. Points are kept in fractions of the image (0 → 1),
   so the same drawing fits the phone, the full screen and the exported MP4. */
const Tele = (() => {
  const { esc, $, $$, toast } = UI;
  const TOOLS = [
    ['mark', '⭕', 'Marquer les joueurs', 'Touche les pieds du joueur'],
    ['spot', '🔦', 'Projecteur', 'Touche les pieds du joueur'],
    ['vision', '👁️', 'Vision du joueur', 'Glisse du joueur vers ce qu\'il regarde'],
    ['move', '➡️', 'Déplacer un joueur', 'Glisse du joueur vers où il doit aller'],
    ['line', '🔗', 'Formation des joueurs', 'Touche les joueurs l\'un après l\'autre, puis « Terminer »'],
    ['block', '🔷', 'Espace de formation des joueurs', 'Touche les joueurs qui forment le bloc, puis « Terminer »'],
    ['space', '🟩', 'Espace', 'Touche les coins de l\'espace, puis « Terminer »'],
    ['free', '✍️', 'Forme libre', 'Dessine avec le doigt'],
    ['label', '🏷️', 'Étiquette', 'Écris le texte, puis touche l\'endroit'],
    ['timer', '⏱️', 'Minuteur', 'Touche l\'endroit où l\'afficher'],
    ['zoom', '🔍', 'Zoom', 'Touche la zone à grossir'],
  ];
  const MULTI = ['line', 'block', 'space'];
  const COLORS = [['#22c55e', 'Nous'], ['#ef4444', 'Adversaire'], ['#facc15', 'Jaune'], ['#ffffff', 'Blanc'], ['#3b82f6', 'Bleu']];
  const LABELS = ['Repli défensif', 'Défense en escalier', 'Couverture mutuelle', 'Scan', 'Scan en se ressituant', 'Prise à deux', 'Pressing', 'Récupération haute',
    'Transition offensive', 'Conservation', 'Appel en profondeur', 'Soutien', 'Intervalle', 'Ligne de passe', 'Compact', 'Bloc bas'];
  const PHASES = ['Récupération', 'Possession', 'Transition offensive', 'Transition défensive', 'Coup de pied arrêté', 'Construction', 'Finition'];
  const toolOf = k => TOOLS.find(t => t[0] === k) || TOOLS[0];

  /* ---------- drawing ---------- */
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
  // the drawings visible at this moment of the video
  const visible = (draws, time, clipEnd) => (draws || []).filter(d => time >= d.t - .02 && time < (d.dur ? d.t + d.dur : (clipEnd != null ? clipEnd + .05 : Infinity)));
  function ring(ctx, x, y, r, col, a = 1, dots = true) {
    ctx.save(); ctx.globalAlpha *= a;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * .36, 0, 0, Math.PI * 2);
    ctx.fillStyle = rgba(col, .35); ctx.fill(); ctx.lineWidth = Math.max(2, r * .12); ctx.strokeStyle = col; ctx.stroke();
    if (dots) { ctx.fillStyle = '#fff'; for (let k = 0; k < 4; k++) { const an = k * Math.PI / 2 + Math.PI / 4; ctx.beginPath(); ctx.ellipse(x + Math.cos(an) * r, y + Math.sin(an) * r * .36, r * .1, r * .06, 0, 0, Math.PI * 2); ctx.fill(); } }
    ctx.restore();
  }
  function label(ctx, x, y, text, col, s) {
    const fs = Math.max(11, s * .026), pad = fs * .45;
    ctx.save(); ctx.font = `700 ${fs}px system-ui, sans-serif`;
    const lines = String(text || '').split('\n').slice(0, 3), w = Math.max(...lines.map(l => ctx.measureText(l).width)) + pad * 2, h = lines.length * fs * 1.2 + pad * 1.2;
    ctx.fillStyle = col === '#ffffff' || col === '#facc15' ? rgba(col, .92) : rgba(col === '#22c55e' ? '#16a34a' : col, .92);
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, fs * .3); ctx.fill();
    ctx.fillStyle = col === '#ffffff' || col === '#facc15' ? '#0e1d45' : '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, x, y - h / 2 + pad * .6 + fs * .6 + i * fs * 1.2));
    ctx.restore();
  }
  function arrowHead(ctx, x1, y1, x2, y2, size, col) {
    const an = Math.atan2(y2 - y1, x2 - x1);
    ctx.save(); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - size * Math.cos(an - .45), y2 - size * Math.sin(an - .45)); ctx.lineTo(x2 - size * Math.cos(an + .45), y2 - size * Math.sin(an + .45)); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  // one drawing on a canvas; box = where the video image is on this canvas (pixels); video = to read the pixels for the zoom
  function drawOne(ctx, d, box, time, video) {
    const P = p => [box.x + p[0] * box.w, box.y + p[1] * box.h], s = box.w, col = d.color || '#22c55e';
    const a = 1;
    const pts = (d.pts || []).map(P); if (!pts.length) return;
    ctx.save(); ctx.globalAlpha = a; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const r = s * .045 * (d.size || 1);
    switch (d.tool) {
      case 'mark': pts.forEach(([x, y]) => ring(ctx, x, y, r, col)); if (d.text) label(ctx, pts[0][0], pts[0][1] + r * 1.4, d.text, col, s); break;
      case 'spot': {
        const [x, y] = pts[0], top = box.y, wTop = r * .5, wBot = r * 1.1;
        const g = ctx.createLinearGradient(0, top, 0, y); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.35, 'rgba(255,255,255,.28)'); g.addColorStop(1, 'rgba(255,255,255,.55)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - wTop, top); ctx.lineTo(x + wTop, top); ctx.lineTo(x + wBot, y); ctx.lineTo(x - wBot, y); ctx.closePath(); ctx.fill();
        const gl = ctx.createRadialGradient(x, y, 0, x, y, wBot * 1.3); gl.addColorStop(0, 'rgba(255,255,255,.9)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gl; ctx.beginPath(); ctx.ellipse(x, y, wBot * 1.3, wBot * .45, 0, 0, Math.PI * 2); ctx.fill();
        if (d.text) label(ctx, x, y + wBot * 1.1, d.text, col, s); break;
      }
      case 'vision': {
        const [[x1, y1], [x2, y2]] = pts.length > 1 ? pts : [pts[0], [pts[0][0] + s * .1, pts[0][1]]];
        const an = Math.atan2(y2 - y1, x2 - x1), L = Math.hypot(x2 - x1, y2 - y1), half = .38;
        const ax = x1 + L * Math.cos(an - half), ay = y1 + L * Math.sin(an - half), bx = x1 + L * Math.cos(an + half), by = y1 + L * Math.sin(an + half);
        const g = ctx.createLinearGradient(x1, y1, x2, y2); g.addColorStop(0, rgba(col, .6)); g.addColorStop(1, rgba(col, .12));
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(ax, ay); ctx.lineTo(bx, by); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = rgba('#0b1b12', .7); ctx.lineWidth = Math.max(1.5, s * .003); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(x1, y1); ctx.lineTo(bx, by); ctx.stroke();
        if (d.text) label(ctx, x1, y1 + r * 1.3, d.text, col, s); break;
      }
      case 'move': {
        const [[x1, y1], [x2, y2]] = pts.length > 1 ? pts : [pts[0], pts[0]];
        ring(ctx, x1, y1, r * .8, col, .9, false);
        const mx = (x1 + x2) / 2 - (y2 - y1) * .18, my = (y1 + y2) / 2 + (x2 - x1) * .18;
        ctx.strokeStyle = col; ctx.lineWidth = Math.max(2.5, s * .005); ctx.setLineDash([s * .012, s * .008]);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx, my, x2, y2); ctx.stroke(); ctx.setLineDash([]);
        arrowHead(ctx, mx, my, x2, y2, s * .022, col);
        ctx.globalAlpha = a * .55; ring(ctx, x2, y2, r * .8, col, 1, false);
        if (d.text) { ctx.globalAlpha = a; label(ctx, x2, y2 + r * 1.1, d.text, col, s); } break;
      }
      case 'line': case 'block': case 'space': {
        if (d.tool !== 'line' && pts.length > 2) {
          ctx.fillStyle = rgba(col, d.tool === 'space' ? .32 : .25); ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill();
        }
        ctx.strokeStyle = col; ctx.lineWidth = Math.max(2.5, s * .005); if (d.tool === 'space') ctx.setLineDash([s * .012, s * .008]);
        ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); if (d.tool !== 'line' && pts.length > 2 && !d.open) ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
        if (d.tool !== 'space') pts.forEach(([x, y]) => ring(ctx, x, y, r * .7, col, 1, false));
        if (d.text) { const cx = pts.reduce((q, p) => q + p[0], 0) / pts.length, cy = Math.min(...pts.map(p => p[1])); label(ctx, cx, cy - r * 1.2, d.text, col, s); } break;
      }
      case 'free': {
        ctx.strokeStyle = col; ctx.lineWidth = Math.max(3, s * .006);
        ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
        if (d.arrow && pts.length > 3) arrowHead(ctx, ...pts[pts.length - 4], ...pts[pts.length - 1], s * .022, col); break;
      }
      case 'label': label(ctx, pts[0][0], pts[0][1], d.text || 'Texte', col, s); break;
      case 'timer': {
        const sec = Math.max(0, time - d.t), txt = `⏱ ${sec.toFixed(1).replace('.', ',')} s`, fs = Math.max(13, s * .034);
        ctx.font = `800 ${fs}px system-ui, sans-serif`; const w = ctx.measureText(txt).width + fs, h = fs * 1.5, [x, y] = pts[0];
        ctx.fillStyle = 'rgba(14,29,69,.88)'; ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, x, y + 1);
        if (d.text) label(ctx, x, y + h, d.text, col, s); break;
      }
      case 'zoom': {
        const [x, y] = pts[0], R = s * .12 * (d.size || 1), k = d.factor || 2.2;
        if (video && video.videoWidth) {
          // the image under the lens, grown k times
          const vx = (x - box.x) / box.w * video.videoWidth, vy = (y - box.y) / box.h * video.videoHeight, vr = R / k / box.w * video.videoWidth;
          ctx.save(); ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.clip();
          try { ctx.drawImage(video, vx - vr, vy - vr * box.w / box.h * video.videoHeight / video.videoWidth, vr * 2, vr * 2 * box.w / box.h * video.videoHeight / video.videoWidth, x - R, y - R, R * 2, R * 2); } catch (e) {}
          ctx.restore();
        } else { ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill(); }
        ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(3, s * .006); ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, s * .003); ctx.beginPath(); ctx.arc(x, y, R + ctx.lineWidth * 2, 0, Math.PI * 2); ctx.stroke();
        if (d.text) label(ctx, x, y + R + s * .02, d.text, col, s); break;
      }
    }
    ctx.restore();
  }
  // everything of a sequence at this moment: the drawings, and the phase title in the corner (« Récupération »)
  function render(ctx, box, clip, time, video, o = {}) {
    if (!clip) return;
    visible(clip.draws, time, clip.end).forEach(d => drawOne(ctx, d, box, time, video));
    if (clip.phase) {
      // bottom left like the club's videos; at the top when a caption already takes the bottom (briefing)
      const fs = Math.max(10, box.w * .02), y = o.phaseTop ? box.y : box.y + box.h - fs * 1.7; ctx.save(); ctx.font = `700 ${fs}px system-ui, sans-serif`;
      const w = ctx.measureText(clip.phase).width + fs;
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(box.x, y, w, fs * 1.7);
      ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(clip.phase, box.x + fs * .5, y + fs * .85); ctx.restore();
    }
  }
  // drawings that ask to freeze the image, reached between two moments
  const freezesBetween = (clip, t0, t1) => (clip && clip.draws || []).filter(d => d.freeze > 0 && d.t > t0 && d.t <= t1);

  // where the image of a video is inside its element (the video keeps its proportions: bands on the sides or above)
  function contentBox(el, vw, vh, ox = 0, oy = 0) {
    const W = el.clientWidth, H = el.clientHeight; vw = vw || 16; vh = vh || 9;
    const sc = Math.min(W / vw, H / vh), w = vw * sc, h = vh * sc;
    return { x: ox + (W - w) / 2, y: oy + (H - h) / 2, w, h };
  }

  /* ---------- the drawing layer over a player ----------
     host: the element around the player; target: the <video> (or the YouTube box); getV: the player; clips(): the sequences;
     editing: the sequence being drawn on (null: the drawings are only shown while the video plays) */
  function layer(host, target, getV, clips, o = {}) {
    const cv = document.createElement('canvas'); cv.className = 'tele-layer'; host.appendChild(cv);
    const ctx = cv.getContext('2d'); let editing = null, raf = 0, draft = null, lastT = null, frozen = null;
    const tgt = () => typeof target === 'function' ? target() : target;
    const box = () => { const v = getV(), isEl = v && v.tagName === 'VIDEO', el = tgt(); if (!el) return { x: 0, y: 0, w: host.clientWidth, h: host.clientHeight };
      const hr = host.getBoundingClientRect(), tr = el.getBoundingClientRect();
      return contentBox(el, isEl ? v.videoWidth : 16, isEl ? v.videoHeight : 9, tr.left - hr.left, tr.top - hr.top); };
    function frame() {
      raf = requestAnimationFrame(frame);
      if (!document.body.contains(cv)) { cancelAnimationFrame(raf); clearTimeout(frozen); return; }
      const dpr = window.devicePixelRatio || 1, W = host.clientWidth, H = host.clientHeight;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const v = getV(); if (!v) { lastT = null; return; } const t = v.currentTime, b = box(), el = v.tagName === 'VIDEO' ? v : null;
      const list = editing ? [editing] : clips().filter(c => t >= c.start && t <= c.end + .05);
      // « arrêt sur image »: the video stops a few seconds when a drawing that asks for it appears
      if (!editing && o.freeze !== false && !v.paused && lastT != null && t > lastT && t - lastT < 1.5) {
        const fz = list.flatMap(c => freezesBetween(c, lastT, t));
        if (fz.length) { v.pause(); const p = v; clearTimeout(frozen); frozen = setTimeout(() => { frozen = null; if (getV() === p && document.body.contains(cv)) p.play(); }, Math.max(...fz.map(d => d.freeze)) * 1000); }
      }
      lastT = t;
      list.forEach(c => render(ctx, b, c, t, el, o));
      if (draft) drawOne(ctx, Object.assign({ t: t - 1 }, draft), b, t, el);
    }
    frame();
    return {
      cv, box,
      edit(clip) { editing = clip; cv.classList.toggle('drawing', !!clip); },
      setDraft(d) { draft = d; },
      // a pause asked by the coach cancels the end of a freeze
      cancelFreeze() { clearTimeout(frozen); frozen = null; },
      destroy() { cancelAnimationFrame(raf); clearTimeout(frozen); cv.remove(); },
    };
  }

  /* ---------- the drawing tools of a sequence ----------
     box: the element where the tools go; L: the layer; v(): the player; clip; save(); isYT: no zoom (YouTube hides its pixels) */
  function tools(boxEl, L, getV, clip, save, isYT, onClose) {
    clip.draws = clip.draws || [];
    const st = Object.assign({ tool: 'mark', color: '#22c55e', dur: 4, freeze: 0, text: '' }, tools.last || {});
    let pts = [], down = null;
    const setDraft = () => L.setDraft(pts.length ? { tool: st.tool, color: st.color, pts, text: st.text, open: true } : null);
    const draw = () => {
      const tl = toolOf(st.tool);
      boxEl.innerHTML = `<div class="tele-bar">
        <div class="tele-tools">${TOOLS.filter(t => !(isYT && t[0] === 'zoom')).map(([k, ic, l]) => `<button class="tele-tool ${k === st.tool ? 'on' : ''}" data-tool="${k}" title="${esc(l)}"><b>${ic}</b><span>${esc(l)}</span></button>`).join('')}</div>
        <p class="tele-hint">${esc(tl[1] + ' ' + tl[2] + ' : ' + tl[3])}${MULTI.includes(st.tool) ? ` · <button class="linkish" data-tele="finish">Terminer (${pts.length} point${pts.length > 1 ? 's' : ''})</button>` : ''}</p>
        <div class="tele-row"><span class="tele-lbl">Couleur</span>${COLORS.map(([c, l]) => `<button class="tele-col ${c === st.color ? 'on' : ''}" data-col="${c}" style="--c:${c}" title="${esc(l)}" aria-label="${esc(l)}"></button>`).join('')}</div>
        <div class="tele-row"><label class="tele-lbl" for="teleText">Texte</label><input id="teleText" maxlength="60" value="${esc(st.text)}" placeholder="${st.tool === 'label' ? 'ex : Repli défensif' : 'facultatif, sous le dessin'}"></div>
        <div class="chips tele-sugg">${LABELS.map(l => `<button class="chip" data-txt="${esc(l)}">${esc(l)}</button>`).join('')}</div>
        <div class="tele-row"><label class="tele-lbl" for="teleDur">Reste</label><select id="teleDur">${[[2, '2 s'], [4, '4 s'], [6, '6 s'], [10, '10 s'], [0, 'jusqu\'à la fin de la séquence']].map(([v, l]) => `<option value="${v}" ${v === st.dur ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <label class="tele-lbl" for="teleFreeze">Arrêt sur image</label><select id="teleFreeze">${[[0, 'non'], [2, '2 s'], [3, '3 s'], [5, '5 s']].map(([v, l]) => `<option value="${v}" ${v === st.freeze ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="tele-row"><label class="tele-lbl" for="telePhase">Titre de phase</label><input id="telePhase" list="telePhases" maxlength="40" value="${esc(clip.phase || '')}" placeholder="ex : Récupération (coin de l'écran)"><datalist id="telePhases">${PHASES.map(p => `<option value="${esc(p)}">`).join('')}</datalist></div>
        <div class="tele-list">${clip.draws.length ? clip.draws.slice().sort((a, b) => a.t - b.t).map(d => `<span class="tele-item"><button class="linkish" data-seek="${d.t}">${toolOf(d.tool)[1]} ${Analyse.mmss(d.t)}${d.text ? ' · ' + esc(d.text) : ''}${d.freeze ? ' · ⏸ ' + d.freeze + ' s' : ''}</button><button class="icon-btn danger" data-del="${d.id}" aria-label="Effacer">${I.x}</button></span>`).join('') : '<span class="muted small">Aucun dessin : mets la vidéo au bon moment, choisis un outil et touche l\'image.</span>'}</div>
        <div class="tele-row"><button class="btn soft" data-tele="undo" ${clip.draws.length ? '' : 'disabled'}>${I.undo}<span>Annuler le dernier</span></button><button class="btn primary" data-tele="close">${I.check}<span>Fini</span></button></div></div>`;
    };
    draw();
    const commit = d => { clip.draws.push(Object.assign({ id: Store.uid(), t: +getV().currentTime.toFixed(2), color: st.color, dur: st.dur || null, freeze: st.freeze || 0, text: st.text.trim() }, d)); pts = []; setDraft(); save(); draw(); };
    const norm = e => { const r = L.cv.getBoundingClientRect(), b = L.box(); return [Math.max(0, Math.min(1, (e.clientX - r.left - b.x) / b.w)), Math.max(0, Math.min(1, (e.clientY - r.top - b.y) / b.h))]; };
    L.edit(clip);
    const v0 = getV(); if (v0 && !v0.paused) v0.pause();
    L.cv.onpointerdown = e => {
      e.preventDefault(); const p = norm(e); down = p; L.cv.setPointerCapture(e.pointerId);
      if (st.tool === 'free') { pts = [p]; setDraft(); }
    };
    L.cv.onpointermove = e => {
      if (!down) return; const p = norm(e);
      if (st.tool === 'free') { const q = pts[pts.length - 1]; if (Math.hypot(p[0] - q[0], p[1] - q[1]) > .004) { pts.push(p); setDraft(); } }
      else if (st.tool === 'vision' || st.tool === 'move') { pts = [down, p]; setDraft(); }
    };
    L.cv.onpointerup = e => {
      if (!down) return; const p = norm(e), a = down; down = null;
      const moved = Math.hypot(p[0] - a[0], p[1] - a[1]) > .02;
      if (st.tool === 'free') { if (pts.length > 1) commit({ tool: 'free', pts: pts.map(q => q.map(n => +n.toFixed(4))) }); else { pts = []; setDraft(); } return; }
      if (st.tool === 'vision' || st.tool === 'move') {
        if (!moved) { pts = []; setDraft(); return toast(st.tool === 'vision' ? 'Glisse du joueur vers ce qu\'il regarde' : 'Glisse du joueur vers où il doit aller'); }
        return commit({ tool: st.tool, pts: [a, p].map(q => q.map(n => +n.toFixed(4))) });
      }
      if (MULTI.includes(st.tool)) { pts.push(p); setDraft(); draw(); return; }
      if (st.tool === 'label' && !st.text.trim()) return toast('Écris d\'abord le texte de l\'étiquette (ou touche une proposition)', 'err');
      commit({ tool: st.tool, pts: [p.map(n => +n.toFixed(4))] });
    };
    boxEl.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tool) { st.tool = b.dataset.tool; pts = []; setDraft(); tools.last = st; return draw(); }
      if (b.dataset.col) { st.color = b.dataset.col; tools.last = st; return draw(); }
      if (b.dataset.txt) { st.text = b.dataset.txt; tools.last = st; return draw(); }
      if (b.dataset.seek) { const v = getV(); v.pause(); v.currentTime = +b.dataset.seek; return; }
      if (b.dataset.del) { clip.draws = clip.draws.filter(d => d.id !== b.dataset.del); save(); return draw(); }
      const a = b.dataset.tele;
      if (a === 'finish') { if (pts.length < 2) return toast('Touche au moins 2 points', 'err'); return commit({ tool: st.tool, pts: pts.map(q => q.map(n => +n.toFixed(4))) }); }
      if (a === 'undo') { clip.draws.pop(); save(); return draw(); }
      if (a === 'close') { L.edit(null); pts = []; setDraft(); L.cv.onpointerdown = L.cv.onpointermove = L.cv.onpointerup = null; boxEl.innerHTML = ''; boxEl.onclick = boxEl.oninput = boxEl.onchange = null; onClose && onClose(); }
    };
    boxEl.oninput = e => { if (e.target.id === 'teleText') { st.text = e.target.value; tools.last = st; } if (e.target.id === 'telePhase') { clip.phase = e.target.value.trim(); clearTimeout(tools.t); tools.t = setTimeout(save, 400); } };
    boxEl.onchange = e => { if (e.target.id === 'teleDur') st.dur = +e.target.value; if (e.target.id === 'teleFreeze') st.freeze = +e.target.value; tools.last = st; };
  }

  return { TOOLS, render, drawOne, freezesBetween, contentBox, layer, tools };
})();
