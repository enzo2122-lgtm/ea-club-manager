/* (2.24) Former des équipes: balanced teams for a training game, in one touch. 2 to 5 teams, from the level of the players
   (global, technique, physique, speed from the sprint tests, or any criterion), the goalkeepers spread one per team, the positions
   spread too (a defender, a midfielder, an attacker in each team when possible). Present players only (the training of the day),
   a « re-mix » button, a picture to share on WhatsApp, print. Nothing is kept: it is a tool for the session. */
const Balance = (() => {
  const { esc, toast } = UI;
  const S = () => Store.state;
  const KEYS = [['avg', '⭐ Niveau global'], ['tech', '⚽ Technique'], ['phys', '🏃 Physique'], ['speed', '⚡ Vitesse (sprint)'], ['iq', '🧠 Intelligence de jeu'], ['att', '🤝 Attitude'], ['ment', '🦁 Mental']];
  const fmt = n => n == null ? '–' : (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
  const today = () => UI.today();
  const gap = d => Math.abs((new Date(d + 'T12:00') - new Date(today() + 'T12:00')) / 864e5);
  const sessions = tid => S().trainings.filter(t => !t.model && t.teamId === tid && gap(t.date) <= 7).sort((a, b) => gap(a.date) - gap(b.date));
  const isGK = p => People.postsOf(p).some(x => /^(GB|G)$/.test(x));
  const line = p => { const x = People.postsOf(p)[0] || ''; return /^(GB|G)$/.test(x) ? 'G' : /^(DC|LG|LD|DG|DD|D)/.test(x) ? 'D' : /^(M|SA)/.test(x) ? 'M' : /^(A|BU|AG|AD)/.test(x) ? 'A' : '?'; };
  // the speed of a player from his sprints (the shortest test he has, the lower the better) → a mark from 1 to 5 within the group
  const sprint = p => { for (const k of ['sp10', 'sp20', 'sp30']) { const t = (p.tests || []).filter(r => r.test === k).pop(); if (t) return { k, v: +t.value }; } return null; };
  function score(p, key, all) {
    if (key === 'speed') { const s = sprint(p); if (!s) return null; const same = all.map(sprint).filter(x => x && x.k === s.k).map(x => x.v); const lo = Math.min(...same), hi = Math.max(...same); return hi === lo ? 3 : 1 + 4 * (hi - s.v) / (hi - lo); }
    const l = Level.cur(p); return key === 'avg' ? Level.avg(l) : (+l[key] || null);
  }
  // the teams: goalkeepers first (one each), then by position, the best to the weakest team each time (snake), shuffled a little
  function make(players, n, key, seed) {
    const rnd = (() => { let s = seed || 1; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; })();
    const teams = Array.from({ length: n }, () => ({ ps: [], sum: 0, c: 0 }));
    const add = (t, x) => { t.ps.push(x); if (x.s != null) { t.sum += x.s; t.c++; } };
    const avg = t => t.c ? t.sum / t.c : 0;
    const weakest = () => teams.slice().sort((a, b) => avg(a) - avg(b) || a.ps.length - b.ps.length || rnd() - .5)[0];
    const rated = players.map(p => ({ p, s: score(p, key, players), gk: isGK(p), l: line(p) }));
    const order = list => list.slice().sort((a, b) => (b.s == null ? -1 : b.s) - (a.s == null ? -1 : a.s) || rnd() - .5);
    order(rated.filter(x => x.gk)).forEach((x, i) => add(teams[i % n], x));
    for (const L of ['D', 'M', 'A', '?']) order(rated.filter(x => !x.gk && x.l === L)).forEach(x => add(weakest(), x));
    return teams.map(t => ({ ps: t.ps, avg: t.c ? t.sum / t.c : null }));
  }
  function page(root, teamId) {
    const all = Auth.teams(), t = Store.get('teams', teamId) || Store.get('teams', S().ui.teamId) || all[0];
    if (!t) { root.innerHTML = '<div class="empty"><p>Crée d\'abord une équipe.</p></div>'; return; }
    const u = S().ui.balance = Object.assign({ n: 2, key: 'avg', present: true, gk: true, seed: 1, tr: '' }, S().ui.balance || {});
    const roster = Store.rosterOf(t.id).slice().sort(Store.byName), sess = sessions(t.id);
    const tr = sess.find(x => x.id === u.tr) || sess.find(x => x.date === today()) || sess[0];
    const presentIds = tr && (tr.presents || []).length ? new Set(tr.presents) : null;
    const pool = roster.filter(p => (u.gk || !isGK(p)) && (!u.present || !presentIds || presentIds.has(p.id)));
    const teams = pool.length ? make(pool, Math.min(u.n, Math.max(1, pool.length)), u.key, u.seed) : [];
    const unrated = pool.filter(p => score(p, u.key, pool) == null).length;
    const COL = ['#2563eb', '#dc2626', '#16a34a', '#ea580c', '#9333ea'], NAME = ['Bleus', 'Rouges', 'Verts', 'Orange', 'Violets'];
    root.innerHTML = `<header class="page-head"><div><h1>👥 Former des équipes</h1><p class="sub">${esc(t.name)} · ${pool.length} joueur${pool.length > 1 ? 's' : ''} · équilibre selon ${esc((KEYS.find(k => k[0] === u.key) || KEYS[0])[1].replace(/^\S+ /, '').toLowerCase())}</p></div>
      <div class="head-actions"><a class="btn" href="#/niveau/${t.id}">📊<span>Niveau des joueurs</span></a>${teams.length ? `<button class="btn" data-bal="mix">🔀<span>Remélanger</span></button><button class="btn" data-bal="print">🖨️<span>Imprimer</span></button><button class="btn primary" data-bal="share">📲<span>Partager (WhatsApp)</span></button>` : ''}</div></header>
      <section class="card">
        <div class="row3">
          <label class="fld"><span>Équipe</span><select data-bal="team">${all.map(x => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${esc(Store.teamLabel(x))}</option>`).join('')}</select></label>
          <label class="fld"><span>Nombre d'équipes</span><select data-bal="n">${[2, 3, 4, 5].map(x => `<option value="${x}" ${x === u.n ? 'selected' : ''}>${x} équipes</option>`).join('')}</select></label>
          <label class="fld"><span>Équilibrer selon</span><select data-bal="key">${KEYS.map(([k, l]) => `<option value="${k}" ${k === u.key ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
        </div>
        <div class="chips"><button class="chip ${u.present ? 'on' : ''}" data-bal="present">✓ Présents seulement${tr ? ` (${esc(UI.fmtDate(tr.date, { weekday: 'short', day: 'numeric', month: 'short' }))}${presentIds ? ` · ${presentIds.size}` : ' · appel pas fait'})` : ' (pas de séance cette semaine)'}</button><button class="chip ${u.gk ? 'on' : ''}" data-bal="gk">🧤 Gardiens (un par équipe)</button>
          ${sess.length > 1 ? `<select data-bal="tr" class="chip">${sess.map(x => `<option value="${x.id}" ${tr && x.id === tr.id ? 'selected' : ''}>${esc(UI.fmtDate(x.date, { weekday: 'short', day: 'numeric', month: 'short' }))} ${esc(x.title || '')}</option>`).join('')}</select>` : ''}</div>
        ${unrated ? `<p class="muted small">ℹ️ ${unrated} joueur${unrated > 1 ? 's' : ''} sans ${u.key === 'speed' ? 'test de sprint' : 'niveau'} : placé${unrated > 1 ? 's' : ''} en dernier, répartis au mieux. ${u.key === 'speed' ? 'Saisis les sprints dans « Tests physiques ».' : 'Note-les dans « Niveau des joueurs ».'}</p>` : '<p class="muted small">Les gardiens sont répartis un par équipe, puis chaque poste (défenseurs, milieux, attaquants) : le meilleur restant va toujours à l\'équipe la plus faible.</p>'}
      </section>
      ${teams.length ? `<div class="bal-teams">${teams.map((T, i) => `<section class="card bal-t" style="--c:${COL[i]}"><div class="ath-head"><h2>${NAME[i]} <span class="muted small">(${T.ps.length})</span></h2><span class="bal-avg">${T.avg != null ? fmt(T.avg) + ' / 5' : ''}</span></div>
        <ul>${T.ps.map(x => `<li>${x.gk ? '🧤 ' : ''}${esc(Store.shortName(x.p))}<i>${x.l !== '?' && x.l !== 'G' ? x.l : ''}${x.s != null ? ' · ' + fmt(x.s) : ''}</i></li>`).join('')}</ul></section>`).join('')}</div>` : '<section class="card"><p class="muted">Personne à répartir : décoche « Présents seulement » ou fais l\'appel de la séance.</p></section>'}`;
    const save = () => { Store.persistNow(); page(root, t.id); };
    root.onchange = e => { const k = e.target.dataset.bal; if (!k) return; if (k === 'team') { location.hash = '#/equilibre/' + e.target.value; return; } u[k] = ['key', 'tr'].includes(k) ? e.target.value : +e.target.value; save(); };
    root.onclick = e => { const b = e.target.closest('[data-bal]'); if (!b || b.tagName === 'SELECT') return; const k = b.dataset.bal;
      if (k === 'present' || k === 'gk') { u[k] = !u[k]; save(); return; }
      if (k === 'mix') { u.seed = Math.floor(Math.random() * 1e6) + 1; save(); return; }
      if (k === 'print') return window.print();
      if (k === 'share') return share(t, teams, NAME, COL);
    };
  }
  function share(t, teams, NAME, COL) {
    const W = 1080, H = 1350, make = async () => {
      const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
      x.fillStyle = '#0e1d45'; x.fillRect(0, 0, W, H); x.fillStyle = '#c9a45c'; x.fillRect(0, 0, W, 14);
      x.fillStyle = '#fff'; x.font = '800 54px system-ui, sans-serif'; x.textAlign = 'center'; x.fillText('👥 Les équipes du jour', W / 2, 90);
      x.font = '600 34px system-ui, sans-serif'; x.fillStyle = '#e2c27d'; x.fillText(`${t.name} · ${UI.fmtDate(today(), { weekday: 'long', day: 'numeric', month: 'long' })}`, W / 2, 140);
      const cols = teams.length <= 2 ? teams.length : 2, rows = Math.ceil(teams.length / cols), bw = (W - 80 - (cols - 1) * 20) / cols, bh = Math.min(560, (H - 260) / rows - 20);
      teams.forEach((T, i) => { const cx = 40 + (i % cols) * (bw + 20), cy = 190 + Math.floor(i / cols) * (bh + 20);
        x.fillStyle = 'rgba(255,255,255,.08)'; x.beginPath(); x.roundRect(cx, cy, bw, bh, 22); x.fill(); x.fillStyle = COL[i]; x.beginPath(); x.roundRect(cx, cy, bw, 14, 7); x.fill();
        x.textAlign = 'left'; x.fillStyle = '#fff'; x.font = '800 38px system-ui, sans-serif'; x.fillText(NAME[i], cx + 24, cy + 64);
        x.font = '500 29px system-ui, sans-serif'; x.fillStyle = '#e2e8f0'; const per = Math.floor((bh - 90) / 38);
        T.ps.slice(0, per).forEach((p, j) => x.fillText(`${p.gk ? '🧤 ' : ''}${Store.shortName(p.p)}`, cx + 24, cy + 112 + j * 38));
        if (T.ps.length > per) x.fillText(`+ ${T.ps.length - per}…`, cx + 24, cy + 112 + per * 38); });
      x.textAlign = 'center'; x.fillStyle = '#94a3b8'; x.font = '500 26px system-ui, sans-serif'; x.fillText(AppCfg.name, W / 2, H - 36);
      return c;
    };
    const text = `👥 Les équipes du jour · ${t.name}\n` + teams.map((T, i) => `${NAME[i]} : ${T.ps.map(p => (p.gk ? '🧤 ' : '') + Store.shortName(p.p)).join(', ')}`).join('\n');
    Share.open({ title: 'Les équipes du jour', text, filename: 'equipes-du-jour', make });
  }
  return { page, make, score };
})();
