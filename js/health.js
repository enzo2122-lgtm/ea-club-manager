/* Health: the injury room and the availability of the players, and the training load.
   An unavailability (injury, illness, absence, suspension) has a start, a planned return and a note; it is kept on the player
   (shared with the club). The convocation of a match and the call of a session show who is not available that day.
   After a session, each player's effort (RPE, 1 to 10) × its length gives the load; a player whose last 7 days are much
   heavier than his usual weeks is flagged (risk of injury). */
const Health = (() => {
  const { esc, $, $$, toast, modal, confirmBox } = UI;
  const S = () => Store.state;
  const KINDS = { injury: ['🚑', 'Blessure'], ill: ['🤒', 'Malade'], away: ['✈️', 'Absent'], susp: ['🟥', 'Suspendu'] };
  const PARTS = ['Cheville', 'Genou', 'Ischios', 'Quadriceps', 'Adducteurs', 'Mollet', 'Pied', 'Hanche', 'Dos', 'Épaule', 'Poignet / main', 'Tête (commotion)', 'Autre'];
  const AWAY = ['Vacances', 'Examens', 'Raison familiale', 'Voyage scolaire', 'Autre'];
  const RPE = ['', 'Très facile', 'Facile', 'Modéré', 'Un peu dur', 'Dur', 'Dur +', 'Très dur', 'Très dur +', 'Épuisant', 'Maximal'];
  const today = () => UI.today();
  const addDays = (d, n) => { const x = new Date(d + 'T12:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  const days = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);
  const fmt = d => UI.fmtDate(d, { day: 'numeric', month: 'short' });

  /* ---------- availability ---------- */
  // the unavailability running on a day (the return date is the first day he is back)
  const on = (p, date = today()) => (p && p.unavail || []).find(u => u.from <= date && (!u.to || date < u.to)) || null;
  // (1.81) the part with its side and the kind of injury; « 📱 » when the player or his parents reported it
  const side = u => u.side && typeof BodyMap !== 'undefined' ? ' ' + BodyMap.SIDE[u.side] : '';
  // (2.25) the last answer of the player to « comment ça s'est passé ? » after a session or a match (u.checks: objects; the coaches' calls: u.calls)
  const CHK = { ok: '✅ plus rien', watch: '⚠️ à surveiller', hurt: '🩺 toujours blessé' };
  const selfChecks = u => (u.checks || []).filter(c => c && typeof c === 'object');
  const calls = u => [...(u.calls || []), ...(u.checks || []).filter(c => typeof c === 'string')].sort();
  const lastCheck = u => { const c = selfChecks(u).slice(-1)[0]; return c && CHK[c.status] ? ` · ${CHK[c.status]} (${fmt(c.date)})` : ''; };
  const label = u => `${KINDS[u.kind][0]} ${KINDS[u.kind][1]}${u.part ? ' · ' + u.part + side(u) : u.reason ? ' · ' + u.reason : ''}${u.type ? ' · ' + u.type.toLowerCase() : ''}${u.to ? ' · retour le ' + fmt(u.to) : ' · retour à confirmer'}${u.self ? (u.parent ? ' · 📱 signalé par les parents' : ' · 📱 signalé par le joueur') : ''}${lastCheck(u)}`;
  // the small sign before a name (convocation, call of a session)
  const flag = (p, date) => { const u = on(p, date); return u ? `<span class="hl-flag" title="${esc(label(u))}" aria-label="${esc(label(u))}">${KINDS[u.kind][0]}</span>` : ''; };

  function dialog(p, done, u) {
    const e = Object.assign({ kind: 'injury', from: today(), to: '', part: '', zone: '', side: '', type: '', reason: '', note: '' }, u || {});
    const body = () => `<div class="chips">${Object.entries(KINDS).map(([k, [ic, l]]) => `<button class="chip ${e.kind === k ? 'on' : ''}" data-kind="${k}">${ic} ${l}</button>`).join('')}</div>
      ${e.kind === 'injury' ? `<div class="hl-bm">${BodyMap.html(e, { noDays: true })}</div>${e.part && !e.zone ? `<p class="muted small">Zone : ${esc(e.part)}</p>` : ''}` : ''}
      ${e.kind === 'away' ? `<div class="lbl">Pourquoi ?</div><div class="chips">${AWAY.map(x => `<button class="chip ${e.reason === x ? 'on' : ''}" data-reason="${esc(x)}">${esc(x)}</button>`).join('')}</div>` : ''}
      <div class="row2"><label class="fld"><span>Depuis le</span><input type="date" id="hlFrom" value="${esc(e.from)}"></label>
        <label class="fld"><span>${e.kind === 'susp' ? 'Rejoue le' : 'Retour prévu le'}</span><input type="date" id="hlTo" value="${esc(e.to)}"></label></div>
      ${e.kind !== 'away' ? `<div class="chips hl-quick">${[[7, '1 semaine'], [14, '2 semaines'], [21, '3 semaines'], [42, '6 semaines']].map(([n, l]) => `<button class="chip" data-plus="${n}">+ ${l}</button>`).join('')}</div>` : ''}
      <label class="fld"><span>Note (soins, kiné, certificat…)</span><input id="hlNote" value="${esc(e.note)}" maxlength="140"></label>`;
    const close = modal({ title: `${u ? 'Modifier' : 'Indisponible'} · ${Store.fullName(p)}`, noFocus: true, body: `<div id="hlBody">${body()}</div>`,
      onOpen: r => {
        const keep = () => { e.from = $('#hlFrom', r).value || e.from; e.to = $('#hlTo', r).value; e.note = $('#hlNote', r).value; };
        r.querySelector('#hlBody').onclick = ev => {
          if (BodyMap.click(ev, e)) { keep(); r.querySelector('#hlBody').innerHTML = body(); return; } // (1.81) the body: zone, injury, kind
          const b = ev.target.closest('button'); if (!b) return; keep();
          if (b.dataset.kind) e.kind = b.dataset.kind; if (b.dataset.part) e.part = b.dataset.part; if (b.dataset.reason) e.reason = b.dataset.reason;
          if (b.dataset.plus) e.to = addDays(e.from || today(), +b.dataset.plus);
          r.querySelector('#hlBody').innerHTML = body();
        };
      },
      actions: [...(u ? [{ label: 'Supprimer', kind: 'danger', onClick: () => { p.unavail = (p.unavail || []).filter(x => x.id !== u.id); Store.upsert('players', p); done && done(); } }] : []),
        { label: 'Annuler' }, { label: 'Enregistrer', kind: 'primary', onClick: (c, r) => {
          e.from = $('#hlFrom', r).value || today(); e.to = $('#hlTo', r).value; e.note = $('#hlNote', r).value.trim();
          if (e.to && e.to <= e.from) { toast('Le retour doit être après le début', 'err'); return false; }
          if (e.kind !== 'injury') { e.part = ''; e.zone = ''; e.side = ''; e.type = ''; } if (e.kind !== 'away') e.reason = '';
          const list = p.unavail = (p.unavail || []).filter(x => x.id !== e.id);
          list.push(Object.assign(e, { id: e.id || Store.uid(), by: (Auth.current() || {}).id || null })); list.sort((a, b) => b.from.localeCompare(a.from));
          Store.upsert('players', p); toast(u ? 'Modifié' : `${Store.shortName(p)} : ${KINDS[e.kind][1].toLowerCase()}`); done && done();
        } }] });
    void close;
  }
  const back = (p, u, done) => { u.to = today(); Store.upsert('players', p); toast(`${Store.shortName(p)} est de retour 💪`); done && done(); };

  // the section on the player's card
  function playerCard(p) {
    const cur = on(p), next = (p.unavail || []).filter(u => u.from > today()), past = (p.unavail || []).filter(u => u !== cur && !next.includes(u)).slice(0, 6);
    const injDays = (p.unavail || []).filter(u => u.kind === 'injury').reduce((a, u) => a + Math.max(0, days(u.from, u.to && u.to < today() ? u.to : today())), 0);
    return `<section class="card hl-card ${cur ? 'out' : ''}"><div class="row-head"><h2>🚑 Disponibilité</h2><button class="btn soft" data-hl="add">${I.plus}<span>Indisponible</span></button></div>
      ${cur ? `<div class="hl-now"><b>${esc(label(cur))}</b>${cur.note ? `<span class="muted small">${esc(cur.note)}</span>` : ''}<div class="chips"><button class="btn primary" data-hl="back" data-u="${cur.id}">💪 De retour</button><button class="btn soft" data-hl="edit" data-u="${cur.id}">${I.edit}<span>Modifier</span></button></div></div>`
        : '<p class="hl-ok">✅ Disponible</p>'}
      ${next.map(u => `<p class="hl-line">🗓️ À venir : ${esc(label(u))} (dès le ${esc(fmt(u.from))}) <button class="linkish" data-hl="edit" data-u="${u.id}">modifier</button></p>`).join('')}
      ${past.length ? `<details><summary class="muted small">Historique (${past.length})${injDays ? ` · ${injDays} jours blessé cette saison` : ''}</summary>${past.map(u => `<p class="hl-line">${esc(label(u))} · du ${esc(fmt(u.from))} <button class="linkish" data-hl="edit" data-u="${u.id}">modifier</button></p>`).join('')}</details>` : ''}
      ${(p.sanctions || []).length ? `<details class="hl-disc"><summary class="muted small">⚖️ Discipline officielle (${p.sanctions.length}) · Footclubs</summary>${p.sanctions.slice().sort((a, b) => b.date.localeCompare(a.date)).map(s => `<p class="hl-line">${/avertissement/i.test(s.decision) ? '🟨' : /suspen|ferme/i.test(s.decision) ? '🟥' : '⚖️'} <b>${esc(s.decision)}</b> · ${esc(fmt(s.date))}${s.to ? ' → ' + esc(fmt(s.to)) : ''}${s.comp ? ' · ' + esc(s.comp) : ''}${s.match ? `<br><span class="muted small">${esc(s.match)}</span>` : ''}</p>`).join('')}</details>` : ''}</section>`;
  }
  function click(e, p, done) {
    const b = e.target.closest('[data-hl]'); if (!b) return false;
    const u = (p.unavail || []).find(x => x.id === b.dataset.u);
    if (b.dataset.hl === 'add') dialog(p, done);
    if (b.dataset.hl === 'edit' && u) dialog(p, done, u);
    if (b.dataset.hl === 'back' && u) back(p, u, done);
    return true;
  }

  /* ---------- training load (RPE × minutes) ---------- */
  const trMinutes = t => (t.exercises || []).reduce((a, e) => a + (+e.duration || 0), 0) || 90;
  function loadOf(pid, from, to) {
    // (2.51) the coach's mark, otherwise the one the player gave himself
    const rv = e => (e.rpe || {})[pid] || (e.rpeSelf || {})[pid] || 0;
    return S().trainings.filter(t => !t.model && t.date >= from && t.date <= to && rv(t)).reduce((a, t) => a + rv(t) * trMinutes(t), 0)
      + S().matches.filter(m => m.played && m.date >= from && m.date <= to && rv(m)).reduce((a, m) => a + rv(m) * ((m.minutes || {})[pid] || m.duration || 90), 0);
  }
  // last 7 days compared with the average week of the 4 weeks before
  function risk(pid) {
    const t = today(), acute = loadOf(pid, addDays(t, -6), t), chronic = loadOf(pid, addDays(t, -34), addDays(t, -7)) / 4;
    return { acute, chronic: Math.round(chronic), ratio: chronic ? acute / chronic : null, high: chronic > 0 && acute > 1.3 * chronic && acute > 600 };
  }
  // the effort of a session or a match, for each player present
  function rpeBox(ev, ids, kind) {
    const own = ev.rpeSelf || {}, fun = ev.fun || {}, r = Object.assign({}, own, ev.rpe || {}), vals = ids.map(id => r[id]).filter(Boolean), avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    const nOwn = ids.filter(id => own[id]).length, funs = ids.map(id => fun[id]).filter(Boolean);
    const mins = kind === 'match' ? (ev.duration || 90) : trMinutes(ev);
    return `<section class="card hl-rpe"><div class="row-head"><h2>💪 Effort ressenti (RPE)</h2>${avg ? `<b class="hl-avg">${avg.toFixed(1).replace('.', ',')} / 10</b>` : ''}</div>
      <p class="muted small">Après ${kind === 'match' ? 'le match' : 'la séance'}, chaque joueur dit de 1 (très facile) à 10 (maximal) si c'était dur. Charge = effort × ${mins} min. Ça sert à repérer ceux qui en font trop.${nOwn ? ` <b>📱 ${nOwn} joueur${nOwn > 1 ? 's ont' : ' a'} répondu ${nOwn > 1 ? 'eux-mêmes' : 'lui-même'}</b> (le 📱 : sa réponse ; touche une note pour la remplacer).` : ' Les joueurs peuvent aussi répondre eux-mêmes dans leur espace.'}</p>
      ${funs.length ? `<p class="small">Ont-ils aimé ? ${['😃', '🙂', '😕'].map((e, i) => { const n = funs.filter(x => x === 3 - i).length; return n ? `${e} ${n}` : ''; }).filter(Boolean).join(' · ')}</p>` : ''}
      ${ids.length ? `<div class="hl-rpe-list">${ids.map(id => { const p = Store.get('players', id); if (!p) return ''; const v = r[id] || 0, mine = !(ev.rpe || {})[id] && own[id];
        return `<div class="hl-rpe-row"><span>${mine ? '📱 ' : ''}${esc(Store.shortName(p))}${fun[id] ? ' ' + ['', '😕', '🙂', '😃'][fun[id]] : ''}</span><span class="hl-scale">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<button class="${n === v ? 'on' : ''} r${n}" data-rpe="${id}" data-v="${n}" title="${RPE[n]}">${n}</button>`).join('')}</span></div>`; }).join('')}</div>
        <div class="chips"><button class="btn soft" data-rpeall="5">Tous à 5</button><button class="btn soft" data-rpeall="7">Tous à 7</button><button class="btn soft" data-rpeall="0">Effacer</button></div>`
        : `<p class="muted">${kind === 'match' ? 'Coche les convoqués' : 'Fais l\'appel'} pour noter l'effort.</p>`}</section>`;
  }
  function rpeClick(e, ev, ids, save) {
    const b = e.target.closest('[data-rpe], [data-rpeall]'); if (!b) return false;
    ev.rpe = ev.rpe || {};
    if (b.dataset.rpe) { const v = +b.dataset.v; if (ev.rpe[b.dataset.rpe] === v) delete ev.rpe[b.dataset.rpe]; else ev.rpe[b.dataset.rpe] = v; }
    else { const v = +b.dataset.rpeall; ids.forEach(id => { if (v) ev.rpe[id] = v; else delete ev.rpe[id]; }); }
    save(); return true;
  }

  /* ---------- the injury room page ---------- */
  // (2.59) the injuries of the season: how many, days lost, where, when, again the same place, during a session or a match
  function injStats(ps) {
    const y = new Date(), start = `${y.getMonth() >= 7 ? y.getFullYear() : y.getFullYear() - 1}-08-01`, t = today();
    const all = ps.flatMap(p => (p.unavail || []).filter(u => u.kind === 'injury' && u.from >= start).map(u => ({ p, u })));
    if (all.length < 2) return '';
    const lost = x => Math.max(0, days(x.u.from, x.u.to && x.u.to < t ? x.u.to : t));
    const by = f => { const c = {}; all.forEach(x => { const k = f(x); if (k) c[k] = (c[k] || 0) + 1; }); return Object.entries(c).sort((a, b) => b[1] - a[1]); };
    const parts = by(x => x.u.part), types = by(x => x.u.type), months = by(x => x.u.from.slice(0, 7)).sort((a, b) => a[0].localeCompare(b[0]));
    const again = {}; all.forEach(x => { const k = x.p.id + '|' + (x.u.part || ''); again[k] = (again[k] || 0) + 1; });
    const rec = Object.entries(again).filter(([, n]) => n > 1).map(([k, n]) => { const [pid, part] = k.split('|'); return `${Store.shortName(Store.get('players', pid) || {})} (${part || '?'}, ${n} fois)`; });
    // during a session or a match: the event of that day where he was
    const ctx = { tr: 0, m: 0 }; all.forEach(x => { if (S().matches.some(m => m.date === x.u.from && (m.convoked || []).includes(x.p.id))) ctx.m++; else if (S().trainings.some(tr => tr.date === x.u.from && (tr.presents || []).includes(x.p.id))) ctx.tr++; });
    const nm = S().matches.filter(m => m.played && m.date >= start).length, nt = S().trainings.filter(tr => !tr.model && tr.date >= start && tr.date <= t && (tr.presents || []).length).length;
    const max = Math.max(...parts.map(x => x[1]), 1), mo = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    return `<section class="card inj-stats"><h2>📊 Les blessures de la saison</h2>
      <div class="tiles"><div class="tile"><b>${all.length}</b><span>blessures</span></div><div class="tile"><b>${all.reduce((a, x) => a + lost(x), 0)}</b><span>jours d'absence</span></div><div class="tile"><b>${all.filter(x => x.u.self).length}</b><span>signalées par les familles</span></div>
        ${nm && ctx.m ? `<div class="tile"><b>${(ctx.m / nm * 10).toFixed(1).replace('.', ',')}</b><span>pour 10 matchs</span></div>` : ''}${nt && ctx.tr ? `<div class="tile"><b>${(ctx.tr / nt * 10).toFixed(1).replace('.', ',')}</b><span>pour 10 séances</span></div>` : ''}</div>
      <h3 class="sub-h">Où</h3><div class="inj-bars">${parts.map(([k, n]) => `<div><span>${esc(k)}</span><i style="width:${Math.round(n / max * 100)}%"></i><b>${n}</b></div>`).join('')}</div>
      ${types.length ? `<p class="small"><b>Type :</b> ${types.map(([k, n]) => `${esc(k)} ${n}`).join(' · ')}</p>` : ''}
      <p class="small"><b>Par mois :</b> ${months.map(([k, n]) => `${mo[+k.slice(5) - 1]} ${n}`).join(' · ')}${ctx.m + ctx.tr ? ` · <b>${ctx.m}</b> en match, <b>${ctx.tr}</b> à l'entraînement` : ''}</p>
      ${rec.length ? `<p class="small">🔁 <b>Récidives :</b> ${rec.map(esc).join(', ')}</p>` : ''}</section>`;
  }
  function page(root) {
    const t = today(), ps = S().players.filter(Auth.seesPerson);
    const now = ps.map(p => [p, on(p, t)]).filter(([, u]) => u).sort((a, b) => (a[1].to || '9999').localeCompare(b[1].to || '9999'));
    const soon = ps.flatMap(p => (p.unavail || []).filter(u => u.from > t && u.from <= addDays(t, 21)).map(u => [p, u])).sort((a, b) => a[1].from.localeCompare(b[1].from));
    const teamsOf = p => (p.teamIds || []).map(id => (Store.get('teams', id) || {}).name).filter(Boolean).join(', ');
    const load = ps.map(p => [p, risk(p.id)]).filter(([, r]) => r.acute || r.chronic).sort((a, b) => (b[1].ratio || 0) - (a[1].ratio || 0));
    root.innerHTML = `<header class="page-head"><div><h1>🚑 Infirmerie</h1><p class="sub">Blessés, malades, absents, suspendus · charge d'entraînement</p></div>
      <div class="head-actions"><a class="btn" href="#/equipes">${I.back}<span>Équipes</span></a><button class="btn primary" data-hl="new">${I.plus}<span>Déclarer un joueur</span></button></div></header>
      ${followCard()}<div class="hl-sum">${Object.entries(KINDS).map(([k, [ic, l]]) => `<span>${ic} <b>${now.filter(([, u]) => u.kind === k).length}</b> ${l.toLowerCase()}${now.filter(([, u]) => u.kind === k).length > 1 ? 's' : ''}</span>`).join('')}</div>
      <h2 class="section">Indisponibles aujourd'hui (${now.length})</h2>
      <div class="list">${now.map(([p, u]) => `<div class="list-item hl-item k-${u.kind}"><a class="li-main" href="#/joueur/${p.id}"><b>${KINDS[u.kind][0]} ${esc(Store.fullName(p))}</b><span class="muted">${esc(teamsOf(p))} · ${esc(label(u).replace(/^\S+ /, ''))}${u.to ? ` · ${days(t, u.to)} j` : ''}${u.note ? ' · ' + esc(u.note) : ''}</span></a>
        <button class="btn soft" data-hlback="${p.id}|${u.id}">💪 De retour</button></div>`).join('') || '<p class="muted">Personne : tout le monde est disponible. 💪</p>'}</div>
      ${soon.length ? `<h2 class="section">Absences à venir</h2><div class="list">${soon.map(([p, u]) => `<a class="list-item" href="#/joueur/${p.id}"><span class="li-main"><b>${KINDS[u.kind][0]} ${esc(Store.fullName(p))}</b><span class="muted">dès le ${esc(fmt(u.from))} · ${esc(label(u).replace(/^\S+ /, ''))}</span></span></a>`).join('')}</div>` : ''}
      ${wellnessSection()}
      ${injStats(ps)}
      <h2 class="section">Charge d'entraînement (7 derniers jours)</h2>
      <p class="muted small">Charge = effort ressenti (RPE) × minutes, noté après les séances et les matchs. ⚠️ = 7 derniers jours bien plus lourds que ses semaines habituelles : à surveiller, risque de blessure.</p>
      ${load.length ? `<div class="hl-load">${load.map(([p, r]) => `<a href="#/joueur/${p.id}" class="${r.high ? 'high' : ''}"><span>${r.high ? '⚠️ ' : ''}${esc(Store.fullName(p))}</span><b>${r.acute}</b><i>habituel ${r.chronic || '–'}</i></a>`).join('')}</div>`
        : '<p class="muted">Pas encore d\'effort noté : sur la page d\'une séance, section « Effort ressenti ».</p>'}`;
    const redraw = () => page(root);
    root.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.hlback) { const [pid, uid] = b.dataset.hlback.split('|'), p = Store.get('players', pid), u = p && (p.unavail || []).find(x => x.id === uid); if (u) back(p, u, redraw); return; }
      if (b.dataset.hl === 'new') {
        const list = ps.slice().sort(Store.byName);
        const close = modal({ title: 'Quel joueur ?', noFocus: true, body: `<input id="hlQ" class="hl-q" placeholder="Rechercher un nom" autocomplete="off"><div class="list hl-pick">${list.map(p => `<button class="list-item" data-pick="${p.id}"><span class="li-main"><b>${esc(Store.fullName(p))}</b><span class="muted">${esc(teamsOf(p))}</span></span></button>`).join('')}</div>`,
          onOpen: r => { $('#hlQ', r).oninput = ev => { const q = ev.target.value.toLowerCase(); $$('[data-pick]', r).forEach(x => { x.hidden = !x.textContent.toLowerCase().includes(q); }); };
            $$('[data-pick]', r).forEach(x => x.onclick = () => { close(); setTimeout(() => dialog(Store.get('players', x.dataset.pick), redraw), 60); }); } });
      }
    };
  }
  const count = () => S().players.filter(Auth.seesPerson).filter(p => on(p)).length;

  /* ---------- (1.81) news of the injured: a reminder to the coaches every 3 days (at once when the player reported it himself) ---------- */
  const EVERY = 3;
  function followUps() {
    const t = today();
    return S().players.filter(Auth.seesPerson).map(p => { const u = on(p, t); if (!u || u.kind !== 'injury') return null;
      const cl = calls(u), last = cl.length ? cl[cl.length - 1] : null, sc = selfChecks(u).slice(-1)[0];
      const due = (sc && sc.status === 'hurt' && (!last || last < sc.date)) || (last ? days(last, t) >= EVERY : (u.self || days(u.from, t) >= EVERY)); // « toujours blessé » answered: at once
      return due ? { p, u, last, since: days(u.from, t) } : null; }).filter(Boolean).sort((a, b) => b.since - a.since);
  }
  // (2.25) the injuries reported by a player or his parents, not yet seen by a coach
  const toValidate = () => S().players.filter(Auth.seesPerson).flatMap(p => (p.unavail || []).filter(u => u.kind === 'injury' && u.self && !u.seen && days(u.from, today()) <= 60).map(u => ({ p, u })));
  function followCard() {
    const l = followUps(), v = toValidate(); if (!l.length && !v.length) return '';
    return `${v.length ? `<section class="card hl-follow hl-valid"><h2>🩹 Signalements à valider (${v.length})</h2><p class="muted small">Blessures signalées depuis l'appli par le joueur ou ses parents : vérifie, corrige la fiche si besoin, puis valide.</p>
      ${v.map(({ p, u }) => `<div class="hl-fu"><a href="#/joueur/${p.id}"><b>${esc(Store.fullName(p))}</b><span class="muted small">${esc(label(u).replace(/^\S+ \S+ · /, ''))} · le ${esc(fmt(u.from))}${u.note ? ' · « ' + esc(u.note) + ' »' : ''}</span></a>
        <span class="chips"><a class="btn soft" href="#/joueur/${p.id}">✏️<span>Fiche</span></a><button class="btn primary" data-hlseen="${p.id}|${u.id}">✓<span>Validé</span></button></span></div>`).join('')}</section>` : ''}
    ${l.length ? `<section class="card hl-follow"><h2>📞 Prendre des nouvelles des blessés (${l.length})</h2><p class="muted small">Un petit appel ou un message : ça compte beaucoup pour un joueur blessé. Rappel tous les ${EVERY} jours.</p>
      ${l.map(({ p, u, last, since }) => `<div class="hl-fu" data-fu="${p.id}|${u.id}"><a href="#/joueur/${p.id}"><b>${esc(Store.fullName(p))}</b><span class="muted small">${esc(label(u).replace(/^\S+ \S+ · /, ''))} · blessé depuis ${since} j · ${last ? 'nouvelles prises le ' + esc(fmt(last)) : 'pas encore de nouvelles'}</span></a>
        <span class="chips">${p.phone ? `<a class="btn soft" href="tel:${esc(String(p.phone).replace(/[^\d+]/g, ''))}">📞<span>Appeler</span></a>` : ''}<button class="btn primary" data-hlcheck="${p.id}|${u.id}">✓<span>Nouvelles prises</span></button></span></div>`).join('')}</section>` : ''}`;
  }
  // « Nouvelles prises » and « Validé »: kept on the injury (shared with the other coaches), the line leaves the list
  if (typeof document !== 'undefined') document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-hlcheck], [data-hlseen]'); if (!b) return;
    const seen = b.dataset.hlseen != null, [pid, uid] = (b.dataset.hlcheck || b.dataset.hlseen).split('|'), p = Store.get('players', pid), u = p && (p.unavail || []).find(x => x.id === uid); if (!u) return;
    if (seen) u.seen = today(); else u.calls = [...calls(u), today()].slice(-30);
    Store.upsert('players', p);
    const row = b.closest('.hl-fu'), card = b.closest('.hl-follow'); if (row) row.remove(); if (card && !card.querySelector('.hl-fu')) card.remove();
    toast(seen ? `Signalement de ${Store.shortName(p)} validé ✓` : `Noté : nouvelles de ${Store.shortName(p)} prises 💚`);
  });

  /* ---------- well-being: mood, mental, sleep, legs, soreness (1 to 10), filled in by the player on his page ---------- */
  const WB = [['mood', '🙂', 'Ressenti'], ['mental', '🧠', 'Mental'], ['sleep', '😴', 'Sommeil'], ['legs', '🦵', 'Jambes'], ['sore', '💪', 'Courbatures']];
  const wbAvg = w => { const v = WB.map(([k]) => +w[k]).filter(x => x > 0); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  // a player to call: a very low score in the last 3 days (pain, bad mood), or a fall compared with his usual level
  function toCall(p) {
    const l = (p.wellness || []).filter(w => w.day >= addDays(today(), -3)).sort((a, b) => a.day.localeCompare(b.day)); if (!l.length) return null;
    const last = l[l.length - 1], low = WB.filter(([k]) => +last[k] > 0 && +last[k] <= 4).map(([, , lab]) => lab);
    return low.length ? { last, why: low.join(', ') } : null;
  }
  function wellnessCard(p) {
    const l = (p.wellness || []).slice().sort((a, b) => a.day.localeCompare(b.day)).slice(-14); if (!l.length) return '';
    const last = l[l.length - 1];
    return `<section class="card"><h2>💚 Bien-être</h2><p class="muted small">Dernier questionnaire : ${esc(fmt(last.day))}${last.note ? ` · « ${esc(last.note)} »` : ''}</p>
      <div class="wb-last">${WB.map(([k, ic, lab]) => `<span class="${+last[k] <= 4 ? 'low' : +last[k] >= 8 ? 'high' : ''}">${ic}<b>${last[k] || '–'}</b><i>${lab}</i></span>`).join('')}</div>
      <div class="wb-spark" title="Moyenne des 14 derniers questionnaires">${l.map(w => { const a = wbAvg(w) || 0; return `<i style="height:${a * 10}%" class="${a <= 4 ? 'low' : a >= 8 ? 'high' : ''}" title="${esc(fmt(w.day))} : ${a.toFixed(1)}"></i>`; }).join('')}</div></section>`;
  }
  function wellnessSection() {
    const ps = S().players.filter(Auth.seesPerson), t = today();
    const calls = ps.map(p => [p, toCall(p)]).filter(([, c]) => c);
    const todayN = ps.filter(p => (p.wellness || []).some(w => w.day === t)).length, with7 = ps.filter(p => (p.wellness || []).some(w => w.day >= addDays(t, -6)));
    if (!with7.length && !calls.length) return `<h2 class="section">💚 Bien-être</h2><p class="muted small">Les joueurs remplissent un petit questionnaire (ressenti, mental, sommeil, jambes, courbatures) sur leur page. Les réponses apparaissent ici.</p>`;
    return `<h2 class="section">💚 Bien-être (7 jours) · ${todayN} réponse${todayN > 1 ? 's' : ''} aujourd'hui</h2>
      ${calls.length ? `<div class="wb-call">📞 <b>${calls.length} joueur${calls.length > 1 ? 's' : ''} à appeler</b> : ${calls.map(([p, c]) => `<a href="#/joueur/${p.id}">${esc(Store.shortName(p))}</a> <i>(${esc(c.why)})</i>`).join(' · ')}</div>` : ''}
      <div class="hl-load">${with7.map(p => { const l = (p.wellness || []).filter(w => w.day >= addDays(t, -6)), a = l.reduce((s, w) => s + (wbAvg(w) || 0), 0) / l.length;
        return `<a href="#/joueur/${p.id}" class="${a <= 4.5 ? 'high' : ''}"><span>${esc(Store.fullName(p))}</span><b>${a.toFixed(1).replace('.', ',')}</b><i>${l.length} réponse${l.length > 1 ? 's' : ''} · moyenne sur 10</i></a>`; }).join('')}</div>`;
  }

  return { followCard, followUps, on, flag, label, dialog, playerCard, click, rpeBox, rpeClick, risk, page, count, KINDS, WB, wellnessCard, wellnessSection, toCall };
})();
