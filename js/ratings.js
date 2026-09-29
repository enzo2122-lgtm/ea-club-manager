/* Ratings: each dirigeant rates players (1 to 5 stars + a comment) after a training or a match.
   Stored in the event: ratings[playerId][staffId] = { v, c, at }. Also: result smileys and a little celebration. */
const Ratings = (() => {
  const { esc } = UI;
  const FACES = ['', '😕', '🙂', '😀', '😃', '🤩'];
  const WORDS = ['', 'À retravailler', 'Correct', 'Bien', 'Très bien', 'Excellent'];
  const SMILEYS = ['🏆', '🎉', '🔥', '💪', '😎', '🤝', '😐', '😢', '😤', '🌧️'];
  const DEFAULT = { V: '🏆', N: '🤝', D: '😢' };
  const RESULT_WORD = { V: 'Victoire !', N: 'Match nul', D: 'On se relève !' };
  const fr = n => n.toFixed(1).replace('.', ',');

  const result = m => !m.played ? null : m.gf > m.ga ? 'V' : m.gf < m.ga ? 'D' : 'N';
  const smiley = m => { const r = result(m); return r ? (m.smiley || DEFAULT[r]) : ''; };

  function avg(ev, pid) {
    const r = ((ev.ratings || {})[pid]) || {}, vals = Object.values(r).map(x => x.v).filter(Boolean);
    return vals.length ? { v: vals.reduce((a, b) => a + b, 0) / vals.length, n: vals.length } : null;
  }
  // All ratings of a player, most recent first
  function history(pid) {
    const out = [], S = Store.state;
    const scan = (list, kind) => list.forEach(ev => Object.entries(((ev.ratings || {})[pid]) || {}).forEach(([sid, x]) => {
      if (x.v) out.push({ kind, ev, date: ev.date, v: x.v, c: x.c || '', by: Store.get('staff', sid) });
    }));
    scan(S.matches, 'match'); scan(S.trainings, 'training');
    return out.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }
  function average(pid, kind) {
    const h = history(pid).filter(x => !kind || x.kind === kind);
    return h.length ? h.reduce((a, x) => a + x.v, 0) / h.length : null;
  }

  /* ---------- rating section for a match or a training ---------- */
  function section(ev, players, what) {
    const me = Auth.current();
    if (!players.length) return `<section class="card"><h2>⭐ Notes des joueurs</h2><p class="muted">${what === 'match' ? 'Coche les convoqués pour pouvoir les noter.' : 'Coche les présents pour pouvoir les noter.'}</p></section>`;
    const rows = players.map(p => {
      const mine = me && (((ev.ratings || {})[p.id]) || {})[me.id] || {}, a = avg(ev, p.id);
      const others = a && (a.n > 1 || !mine.v) ? `<span class="avg" title="Moyenne de tous les dirigeants">moy. ${fr(a.v)} · ${a.n} note${a.n > 1 ? 's' : ''}</span>` : '';
      return `<div class="rate-row" data-pid="${p.id}">
        <span class="nm">${esc(p.number ? p.number + ' · ' : '')}${esc(Store.fullName(p))}</span>
        <span class="stars" role="radiogroup" aria-label="Note de ${esc(Store.fullName(p))}">${[1, 2, 3, 4, 5].map(n => `<button class="star ${n <= (mine.v || 0) ? 'on' : ''}" data-rate="${n}" role="radio" aria-checked="${n === mine.v}" aria-label="${n} sur 5 : ${WORDS[n]}">★</button>`).join('')}</span>
        <span class="face" title="${esc(WORDS[mine.v || 0])}">${FACES[mine.v || 0]}</span>${others}
        <input class="rate-c" data-rc placeholder="Commentaire (facultatif)" value="${esc(mine.c || '')}" maxlength="140" ${mine.v || mine.c ? '' : 'hidden'}>
      </div>`;
    }).join('');
    return `<section class="card rate-card"><div class="row-head"><h2>⭐ Notes des joueurs</h2><span class="muted small">Tes notes : ${esc(me ? Store.fullName(me) : '')}</span></div>
      <p class="muted small">1 étoile : à retravailler · 3 : bien · 5 : excellent. Chaque dirigeant donne sa note, l'appli fait la moyenne.</p>${rows}</section>`;
  }
  function bind(root, ev, save) {
    const me = Auth.current(); if (!me) return;
    const slot = pid => { ev.ratings = ev.ratings || {}; const r = ev.ratings[pid] = ev.ratings[pid] || {}; return r[me.id] = r[me.id] || {}; };
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-rate]'); if (!b) return;
      const row = b.closest('[data-pid]'), s = slot(row.dataset.pid), n = +b.dataset.rate;
      s.v = s.v === n ? 0 : n; s.at = Date.now(); save();
      row.querySelectorAll('.star').forEach((x, i) => { x.classList.toggle('on', i < s.v); x.setAttribute('aria-checked', i + 1 === s.v); });
      row.querySelector('.face').textContent = FACES[s.v]; row.querySelector('.face').title = WORDS[s.v];
      row.querySelector('[data-rc]').hidden = !s.v && !s.c;
    });
    root.addEventListener('input', e => {
      if (!e.target.matches('[data-rc]')) return;
      const s = slot(e.target.closest('[data-pid]').dataset.pid); s.c = e.target.value; s.at = Date.now(); save();
    });
  }

  /* ---------- smiley picker + celebration ---------- */
  function smileyPicker(m) {
    const r = result(m); if (!r) return '';
    return `<div class="result-banner res-${r}"><span class="big-smiley">${smiley(m)}</span><div><b>${RESULT_WORD[r]}</b>
      <div class="smileys" aria-label="Choisir le smiley du match">${SMILEYS.map(s => `<button class="smiley ${s === smiley(m) ? 'on' : ''}" data-smiley="${s}" aria-label="Smiley ${s}">${s}</button>`).join('')}</div></div></div>`;
  }
  function celebrate() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = document.createElement('canvas'), ctx = c.getContext('2d'), W = c.width = innerWidth, H = c.height = innerHeight;
    c.className = 'confetti'; document.body.appendChild(c);
    const cols = ['#8c1024', '#c9a45c', '#ffffff', '#13245a', '#e2c27d'];
    const bits = Array.from({ length: 140 }, () => ({ x: W / 2 + (Math.random() - .5) * 120, y: H * .35, vx: (Math.random() - .5) * 14, vy: -Math.random() * 13 - 4, r: Math.random() * 6 + 4, a: Math.random() * 6, col: cols[Math.floor(Math.random() * cols.length)] }));
    const t0 = performance.now();
    const tick = now => {
      ctx.clearRect(0, 0, W, H);
      bits.forEach(b => { b.vy += .35; b.x += b.vx; b.y += b.vy; b.a += .2; ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a); ctx.fillStyle = b.col; ctx.fillRect(-b.r / 2, -b.r / 4, b.r, b.r / 2); ctx.restore(); });
      if (now - t0 < 2200) requestAnimationFrame(tick); else c.remove();
    };
    requestAnimationFrame(tick);
  }

  return { section, bind, history, average, avg, smiley, smileyPicker, celebrate, result, FACES, fr };
})();
