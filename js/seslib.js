/* SesLib: the sessions ready to use, sorted by game system (4-3-3, 4-2-3-1, 4-4-2… in football; zone 2-3, pick and roll… in basket…).
   Each session: its goal, its exercises with their animated schema (made by the app), « Voir en grand » on each exercise,
   and « Utiliser cette séance »: a training of the chosen category and date, with a warm-up and a cool-down. */
const SesLib = (() => {
  const { esc, $, $$, toast, modal } = UI;
  const S = () => Store.state;
  const sportId = () => (typeof Sport !== 'undefined' ? Sport.id() : 'foot');
  const all = () => sportId() === 'foot' ? (typeof SESSIONS_FOOT !== 'undefined' ? SESSIONS_FOOT : []) : ((typeof SESSIONS_SPORTS !== 'undefined' && SESSIONS_SPORTS[sportId()]) || []);
  const fmtLabel = f => typeof Sport !== 'undefined' ? Sport.formatLabel(f) : ({ '11': 'Foot à 11', '8': 'Foot à 8', '5': 'Foot à 5' }[f] || f);
  const key = s => s.sys + '|' + s.title;
  const exOf = (x, fmt) => ({ id: Store.uid(), theme: x[0], title: x[1], duration: x[2], org: x[3], consignes: String(x[4] || '').split('|').join('\n'), materiel: x[5] || '', size: x[6] || '', schemaId: null, formats: fmt ? [fmt] : [] });
  // sub-categories: football by the number of defenders, the other sports defence / attack
  const groupOf = s => sportId() === 'foot' && /^\d/.test(s) ? `Défense à ${s[0]}` : /défense|zone|box|presse|0-6|1-5|3-2-1|5\+1|rideau|homme/i.test(s) ? 'Défense' : sportId() === 'volley' ? 'Systèmes et réception' : 'Attaque et organisation';
  // the systems of the club's sport, by format (foot à 11, à 8, à 5…)
  function systems() {
    const out = []; all().forEach(s => { if (!out.some(o => o.sys === s.sys && o.fmt === s.fmt)) out.push({ sys: s.sys, fmt: s.fmt }); });
    return out;
  }
  function page(root) {
    const st = S().ui.sesLib = S().ui.sesLib || {};
    const sys = systems(), cur = sys.find(x => x.sys === st.sys) || sys[0];
    const list = cur ? all().filter(s => s.sys === cur.sys && s.fmt === cur.fmt) : [];
    const fmts = [...new Set(sys.map(x => x.fmt))];
    root.innerHTML = `<header class="page-head"><div><h1>📚 Séances par système de jeu</h1><p class="sub">${all().length} séances prêtes à l'emploi · chaque exercice a son schéma animé</p></div>
      <div class="head-actions"><a class="btn" href="#/entrainements">${I.back}<span>Séances</span></a><a class="btn" href="#/exercices">📚<span>Exercices du club</span></a></div></header>
      ${fmts.map(f => { const groups = []; sys.filter(x => x.fmt === f).forEach(x => { const g = groupOf(x.sys); let gr = groups.find(y => y[0] === g); if (!gr) groups.push(gr = [g, []]); gr[1].push(x); });
        groups.sort((a, b) => a[0] === 'Défense à 4' ? -1 : b[0] === 'Défense à 4' ? 1 : a[0].localeCompare(b[0]));
        return `<div class="lbl">${esc(fmtLabel(f))}</div>${groups.map(([g, xs]) => `<div class="sl-grp"><span class="muted small">${esc(g)}</span><div class="chips">${xs.map(x => `<button class="chip ${cur && x.sys === cur.sys && x.fmt === cur.fmt ? 'on' : ''}" data-sys="${esc(x.sys)}" data-fmt="${esc(x.fmt)}">${esc(x.sys)}</button>`).join('')}</div></div>`).join('')}`; }).join('') || '<p class="muted">Pas encore de séances pour ce sport.</p>'}
      ${list.map(s => `<section class="card sl-card"><div class="row-head"><div><h2>${esc(s.title)}</h2><p class="muted small">${esc(s.sys)} · ${esc(fmtLabel(s.fmt))} · ${s.ex.reduce((a, x) => a + x[2], 0) + 20} min avec échauffement et retour au calme</p></div>
          <button class="btn primary" data-use="${esc(key(s))}">${I.plus}<span>Utiliser cette séance</span></button></div>
        <p>🎯 ${esc(s.goal)}</p>
        <div class="sl-ex">${s.ex.map((x, i) => { const e = exOf(x, s.fmt); e.id = 'sl-' + i + '-' + key(s).length;
          return `<article class="sl-item"><button type="button" class="thumb auto-thumb" data-slbig="${esc(key(s))}" data-i="${i}" title="Voir en grand"><img alt="" src="${UI.thumb(AutoSchema.preview(e), 320, 208)}"></button>
            <div><b>${i + 1}. ${esc(x[1])}</b><span class="muted small"> · ${x[2]} min</span><p class="small">${esc(x[3])}</p><button class="btn soft" data-slbig="${esc(key(s))}" data-i="${i}">🔍<span>Voir en grand</span></button></div></article>`; }).join('')}</div></section>`).join('')}`;
    root.onclick = e => {
      const c = e.target.closest('[data-sys]'); if (c) { st.sys = c.dataset.sys; Store.persistNow(); return page(root); }
      const bg = e.target.closest('[data-slbig]'); if (bg) { const s = all().find(x => key(x) === bg.dataset.slbig); const x = s && s.ex[+bg.dataset.i]; if (x) return AutoSchema.big(exOf(x, s.fmt)); }
      const u = e.target.closest('[data-use]'); if (u) return use(all().find(x => key(x) === u.dataset.use));
    };
  }
  // a warm-up and a cool-down of the base, for the format of the session
  const baseOf = (theme, fmt) => { const l = Exos.all().filter(e => e.base && (Exos.themeOf(e) || []).includes(theme)); return l.find(e => !e.formats.length || e.formats.includes(fmt)) || l[0]; };
  function use(s) {
    if (!s) return;
    const teams = Auth.teams(), t0 = (teams.find(t => t.format === s.fmt) || teams[0] || {}).id || '';
    modal({ title: `Utiliser « ${s.title} »`, body: `<label class="fld"><span>Catégorie</span><select id="slTeam"><option value="">Aucune</option>${teams.map(t => `<option value="${t.id}" ${t.id === t0 ? 'selected' : ''}>${esc(Store.teamLabel(t))}</option>`).join('')}</select></label>
      <div class="row2"><label class="fld"><span>Date</span><input type="date" id="slDate" value="${UI.today()}"></label><label class="fld"><span>Heure</span><input type="time" id="slTime" value="18:00"></label></div>
      <p class="muted small">La séance est créée avec un échauffement, les ${s.ex.length} exercices du système ${esc(s.sys)} et un retour au calme. Tout se change ensuite.</p>`,
      actions: [{ label: 'Annuler' }, { label: 'Créer la séance', kind: 'primary', onClick: (c, r) => {
        const warm = baseOf('echauffement', s.fmt), calm = baseOf('calme', s.fmt);
        const copy = e => e && { id: Store.uid(), theme: e.theme || null, title: e.title, duration: Math.min(15, e.duration || 10), org: e.org || '', consignes: e.consignes || '', materiel: e.materiel || '', size: e.size || '', schemaId: null };
        const exercises = [copy(warm), ...s.ex.map(x => exOf(x, s.fmt)), copy(calm)].filter(Boolean);
        const tr = Store.upsert('trainings', { id: Store.uid(), title: `${s.sys} · ${s.title}`, date: $('#slDate', r).value || UI.today(), time: $('#slTime', r).value, teamId: $('#slTeam', r).value || null, goal: s.goal, exercises, presents: [] });
        toast('Séance créée'); location.hash = '#/entrainement/' + tr.id;
      } }] });
  }
  return { page, all, systems };
})();
