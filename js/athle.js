/* (2.23) Travail athlétique: the running groups of a session, from the players' VMA (or VIFT of the 30-15).
   The coach picks the intensity (% of VMA), the work time, the rest, the number of groups; the app sorts the players by VMA,
   makes groups of close speeds and gives, for each group, the speed and the distance to run (cones), so that everyone runs
   at his own pace. Present players only (the training of the day), goalkeepers or not. A picture to share on WhatsApp. */
const Athle = (() => {
  const { esc, $, toast } = UI;
  const S = () => Store.state;
  const PCTS = [70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120];
  const WORK = [[5, '5″'], [10, '10″'], [15, '15″'], [20, '20″'], [30, '30″'], [45, '45″'], [60, '1′'], [90, '1′30'], [120, '2′'], [180, '3′'], [300, '5′'], [360, '6′']];
  const RATIO = [[1, 'Récup = effort (15-15, 30-30…)'], [0.5, 'Récup = moitié'], [2, 'Récup = le double'], [0, 'Sans arrêt (course continue)']];
  const fmt = (n, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toFixed(d).replace('.', ',');
  const mmss = s => s >= 60 ? `${Math.floor(s / 60)}′${s % 60 ? String(s % 60).padStart(2, '0') : ''}` : `${s}″`;
  const isGK = p => People.postsOf(p).some(x => /^(GB|G)$/.test(x));
  const today = () => UI.today();
  // the last VMA (or VIFT) of a player; the VIFT runs about 15 % above the VMA: brought back to a VMA
  const speed = (p, k) => { const t = (p.tests || []).filter(r => r.test === k).sort((a, b) => a.date.localeCompare(b.date)).pop(); return t ? +t.value : null; };
  // the trainings around today (presents known), the one of today first
  const gap = d => Math.abs((new Date(d + 'T12:00') - new Date(today() + 'T12:00')) / 864e5); // days from today
  const sessions = tid => S().trainings.filter(t => !t.model && t.teamId === tid && gap(t.date) <= 7).sort((a, b) => gap(a.date) - gap(b.date));
  // the groups: players sorted by speed, cut into n groups of close speeds (equal sizes)
  function groups(list, n) {
    const sorted = list.slice().sort((a, b) => b.v - a.v), out = [], size = Math.ceil(sorted.length / n);
    for (let i = 0; i < n; i++) { const g = sorted.slice(i * size, (i + 1) * size); if (g.length) out.push(g); }
    return out;
  }
  const plan = (g, u) => { const vs = g.map(x => x.v), ref = vs.reduce((a, b) => a + b, 0) / vs.length, kmh = ref * u.pct / 100, m = kmh / 3.6 * u.work; return { ref, min: Math.min(...vs), max: Math.max(...vs), kmh, m, lap: Math.round(m) }; };

  function page(root, teamId) {
    const teams = Auth.teams(), t = Store.get('teams', teamId) || Store.get('teams', S().ui.teamId) || teams[0];
    if (!t) { root.innerHTML = '<div class="empty"><p>Crée d\'abord une équipe.</p></div>'; return; }
    const u = S().ui.athle = Object.assign({ test: 'vma', pct: 100, work: 15, ratio: 1, n: 3, present: true, gk: true, reps: 8, sets: 2, tr: '' }, S().ui.athle || {});
    const all = Store.rosterOf(t.id).slice().sort(Store.byName), sess = sessions(t.id);
    const tr = sess.find(x => x.id === u.tr) || sess.find(x => x.date === today()) || sess[0];
    const presentIds = tr && (tr.presents || []).length ? new Set(tr.presents) : null;
    const pool = all.filter(p => (u.gk || !isGK(p)) && (!u.present || !presentIds || presentIds.has(p.id)));
    const withV = pool.map(p => ({ p, v: speed(p, u.test) })).filter(x => x.v), without = pool.filter(p => !speed(p, u.test));
    const gs = groups(withV, Math.min(u.n, Math.max(1, withV.length))), rest = Math.round(u.work * u.ratio);
    const total = u.ratio ? u.sets * u.reps * (u.work + rest) - rest : u.work;
    const sel = (id, opts, val) => `<select data-ath="${id}">${opts.map(([v, l]) => `<option value="${v}" ${String(v) === String(val) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    root.innerHTML = `<header class="page-head"><div><h1>⚡ Travail athlétique</h1><p class="sub">${esc(t.name)} · groupes de course d'après ${u.test === 'vma' ? 'la VMA' : 'la VIFT (30-15)'}</p></div>
      <div class="head-actions"><a class="btn" href="#/tests/${t.id}">🏃<span>Tests physiques</span></a>${gs.length ? `<button class="btn" data-ath="print">🖨️<span>Imprimer</span></button><button class="btn primary" data-ath="share">📲<span>Partager (WhatsApp)</span></button>` : ''}</div></header>
      <section class="card ath-set">
        <div class="row3">
          <label class="fld"><span>Équipe</span><select data-ath="team">${teams.map(x => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${esc(Store.teamLabel(x))}</option>`).join('')}</select></label>
          <label class="fld"><span>D'après</span>${sel('test', [['vma', 'VMA'], ['vift', 'VIFT (30-15)']], u.test)}</label>
          <label class="fld"><span>Intensité</span>${sel('pct', PCTS.map(x => [x, x + ' % ' + (u.test === 'vma' ? 'VMA' : 'VIFT')]), u.pct)}</label>
          <label class="fld"><span>Effort</span>${sel('work', WORK, u.work)}</label>
          <label class="fld"><span>Récupération</span>${sel('ratio', RATIO, u.ratio)}</label>
          <label class="fld"><span>Groupes</span>${sel('n', [1, 2, 3, 4, 5].map(x => [x, x + (x > 1 ? ' groupes' : ' groupe')]), u.n)}</label>
          ${u.ratio ? `<label class="fld"><span>Répétitions</span>${sel('reps', [4, 6, 8, 10, 12, 15, 20].map(x => [x, x + ' ×']), u.reps)}</label><label class="fld"><span>Séries</span>${sel('sets', [1, 2, 3, 4].map(x => [x, x + (x > 1 ? ' séries' : ' série')]), u.sets)}</label>` : ''}
        </div>
        <div class="chips"><button class="chip ${u.present ? 'on' : ''}" data-ath="present">✓ Présents seulement${tr ? ` (${esc(UI.fmtDate(tr.date, { weekday: 'short', day: 'numeric', month: 'short' }))}${presentIds ? ` · ${presentIds.size}` : ' · appel pas fait'})` : ' (pas de séance cette semaine)'}</button><button class="chip ${u.gk ? 'on' : ''}" data-ath="gk">🧤 Gardiens inclus</button>
          ${sess.length > 1 ? `<select data-ath="tr" class="chip">${sess.map(x => `<option value="${x.id}" ${tr && x.id === tr.id ? 'selected' : ''}>${esc(UI.fmtDate(x.date, { weekday: 'short', day: 'numeric', month: 'short' }))} ${esc(x.title || '')}</option>`).join('')}</select>` : ''}</div>
        <p class="muted small">${u.ratio ? `<b>${u.sets} × ${u.reps}</b> efforts de <b>${mmss(u.work)}</b>, récupération <b>${mmss(rest)}</b> entre deux : environ <b>${mmss(Math.round(total))}</b> de travail par série.` : `Course continue de <b>${mmss(u.work)}</b>.`} Chaque groupe court à l'allure de sa VMA moyenne : place un plot à la distance indiquée, tout le monde part et arrive ensemble.</p>
      </section>
      ${gs.length ? `<div class="ath-groups">${gs.map((g, i) => { const P = plan(g, u); return `<section class="card ath-g g${i + 1}"><div class="ath-head"><h2>Groupe ${i + 1}</h2><span class="muted small">${u.test.toUpperCase()} ${fmt(P.min)}${P.min !== P.max ? ' à ' + fmt(P.max) : ''} km/h</span></div>
          <div class="ath-nums"><div><b>${fmt(P.kmh)}</b><span>km/h</span></div><div><b>${P.lap}</b><span>m en ${mmss(u.work)}</span></div>${u.ratio ? `<div><b>${Math.round(P.lap * u.reps / 100) / 10}</b><span>km par série</span></div>` : ''}</div>
          <div class="ath-names">${g.map(x => `<span>${esc(Store.shortName(x.p))}${isGK(x.p) ? ' 🧤' : ''}<i>${fmt(x.v)}</i></span>`).join('')}</div></section>`; }).join('')}</div>`
        : `<section class="card"><p class="muted">${withV.length ? '' : `Aucun ${u.present && presentIds ? 'présent' : 'joueur'} avec une ${u.test.toUpperCase()} : saisis ou importe les tests (bouton « Tests physiques »)${u.present ? ', ou décoche « Présents seulement »' : ''}.`}</p></section>`}
      ${without.length ? `<p class="muted small">ℹ️ Sans ${u.test.toUpperCase()}, donc pas placés : ${without.map(p => esc(Store.shortName(p))).join(', ')}. Mets-les avec le groupe qui leur ressemble.</p>` : ''}`;
    const save = () => { Store.persistNow(); page(root, t.id); };
    root.onchange = e => { const k = e.target.dataset.ath; if (!k) return; if (k === 'team') { location.hash = '#/athle/' + e.target.value; return; } u[k] = ['test', 'tr'].includes(k) ? e.target.value : +e.target.value; save(); };
    root.onclick = e => { const b = e.target.closest('[data-ath]'); if (!b || b.tagName === 'SELECT') return; const k = b.dataset.ath;
      if (k === 'present' || k === 'gk') { u[k] = !u[k]; save(); return; }
      if (k === 'print') return window.print();
      if (k === 'share') return share(t, u, gs, rest);
    };
  }
  /* ---------- the picture for WhatsApp (1080 × 1350) ---------- */
  function share(t, u, gs, rest) {
    const W = 1080, H = 1350, make = async () => {
      const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
      x.fillStyle = '#0e1d45'; x.fillRect(0, 0, W, H); x.fillStyle = '#c9a45c'; x.fillRect(0, 0, W, 14);
      x.fillStyle = '#fff'; x.font = '800 54px system-ui, sans-serif'; x.textAlign = 'center'; x.fillText('⚡ Travail athlétique', W / 2, 90);
      x.font = '600 34px system-ui, sans-serif'; x.fillStyle = '#e2c27d'; x.fillText(`${t.name} · ${u.pct} % ${u.test.toUpperCase()}`, W / 2, 140);
      x.fillStyle = '#cbd5e1'; x.font = '500 30px system-ui, sans-serif';
      x.fillText(u.ratio ? `${u.sets} × ${u.reps} efforts de ${mmss(u.work)} · récup ${mmss(rest)}` : `Course continue de ${mmss(u.work)}`, W / 2, 190);
      const top = 240, h = Math.min(260, Math.floor((H - top - 80) / gs.length)), cols = ['#16a34a', '#2563eb', '#9333ea', '#ea580c', '#db2777'];
      gs.forEach((g, i) => { const P = plan(g, u), y = top + i * h; x.fillStyle = 'rgba(255,255,255,.08)'; x.beginPath(); x.roundRect(40, y, W - 80, h - 16, 22); x.fill();
        x.fillStyle = cols[i % 5]; x.beginPath(); x.roundRect(40, y, 16, h - 16, 8); x.fill();
        x.textAlign = 'left'; x.fillStyle = '#fff'; x.font = '800 40px system-ui, sans-serif'; x.fillText(`Groupe ${i + 1}`, 84, y + 56);
        x.textAlign = 'right'; x.fillStyle = '#e2c27d'; x.font = '800 44px system-ui, sans-serif'; x.fillText(`${P.lap} m · ${fmt(P.kmh)} km/h`, W - 70, y + 58);
        x.textAlign = 'left'; x.fillStyle = '#e2e8f0'; x.font = '500 29px system-ui, sans-serif';
        const names = g.map(z => Store.shortName(z.p)), lines = []; let line = '';
        names.forEach(n => { const tryL = line ? line + ' · ' + n : n; if (x.measureText(tryL).width > W - 170) { lines.push(line); line = n; } else line = tryL; }); if (line) lines.push(line);
        lines.slice(0, Math.floor((h - 90) / 36)).forEach((l, j) => x.fillText(l, 84, y + 104 + j * 36)); });
      x.textAlign = 'center'; x.fillStyle = '#94a3b8'; x.font = '500 26px system-ui, sans-serif'; x.fillText(`${AppCfg.name} · un plot par groupe, tout le monde part et arrive ensemble`, W / 2, H - 36);
      return c;
    };
    const text = `⚡ Travail athlétique · ${t.name}\n${u.pct} % ${u.test.toUpperCase()} · ${u.ratio ? `${u.sets} × ${u.reps} × ${mmss(u.work)}, récup ${mmss(rest)}` : `course continue ${mmss(u.work)}`}\n` + gs.map((g, i) => { const P = plan(g, u); return `Groupe ${i + 1} : ${P.lap} m (${fmt(P.kmh)} km/h) — ${g.map(z => Store.shortName(z.p)).join(', ')}`; }).join('\n');
    Share.open({ title: 'Travail athlétique', text, filename: 'travail-athletique', make });
  }
  return { page, groups, plan };
})();
