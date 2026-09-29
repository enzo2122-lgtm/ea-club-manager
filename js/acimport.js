/* ACImport: brings a team exported from AssistCoachAI (the .json file of its data) into the app, without duplicates.
   Players: found again by licence, or by name and birth date (else created in the category). Matches: those already imported
   from the FFF (same day, same opponent) are completed; the others (friendlies) are created. Trainings: created once, with the
   attendance, the effort (RPE) and the session written on AssistCoachAI (its parts become exercises).
   Each thing keeps the AssistCoachAI id (acId): importing the same file again updates instead of adding.
   Also: injuries and absences, well-being questionnaires, the detailed stats of the matches and the championships. */
const ACImport = (() => {
  const { esc, toast, modal } = UI;
  const S = () => Store.state;
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const digits = s => String(s || '').replace(/\D/g, '');
  const POST = { gardien: ['GB'], defenseur: ['DEF'], milieu_def: ['MDC'], milieu_off: ['MOC'], milieu: ['MIL'], attaquant: ['ATT'], ailier: ['AG'], lateral: ['LD'] };
  const LINE = { GB: 'GB', DEF: 'DEF', MDC: 'MIL', MOC: 'MIL', MIL: 'MIL', ATT: 'ATT', AG: 'ATT', LD: 'DEF' };
  const ZONE = { th: 'Cuisse', ank: 'Cheville', kn: 'Genou', knee: 'Genou', hand: 'Main', nape: 'Nuque', neck: 'Cou', hip: 'Hanche', calf: 'Mollet', sh: 'Épaule', back: 'Dos', groin: 'Adducteurs',
    foot: 'Pied', ham: 'Ischios', quad: 'Quadriceps', head: 'Tête', wr: 'Poignet', abd: 'Abdominaux', lb: 'Bas du dos', elb: 'Coude', rib: 'Côtes' };
  const zone = z => { const m = /^([a-z]+)(?:_([lr]))?$/.exec(z || ''); if (!m) return z || ''; return (ZONE[m[1]] || m[1]) + (m[2] ? (m[2] === 'l' ? ' gauche' : ' droit' + (/(Cuisse|Cheville|Main|Hanche|Épaule)/.test(ZONE[m[1]] || '') ? 'e' : '')) : ''); };
  const msgOf = e => { try { return typeof e.message === 'string' ? JSON.parse(e.message) : (e.message || {}); } catch (x) { return {}; } };
  const day = s => String(s || '').slice(0, 10);
  const hhmm = s => { const m = /(\d{1,2})\s*[h:]\s*(\d{2})?/i.exec(s || ''); return m ? `${m[1].padStart(2, '0')}:${(m[2] || '00')}` : ''; };
  // opponent names: « Racing Club Rosny-sous-Bois » = « RCR », « F.C. Livry-Gargan 2 » = « Livry Gargan FC 2 »
  const STOP = new Set(['fc', 'f', 'c', 'as', 'a', 's', 'es', 'us', 'club', 'football', 'de', 'du', 'la', 'le', 'sfc', 'ass', 'csm', 'cs', 'sc', 'racing', 'sous', 'sur', 'ile', 'saint', 'st', 'academie', 'union']);
  const words = s => norm(s).split(' ').filter(Boolean);
  function sameOpp(a, b) {
    const A = words(a), B = words(b), num = w => w.filter(x => /^\d+$/.test(x)).join(','), core = w => w.filter(x => !STOP.has(x) && !/^\d+$/.test(x));
    if (num(A) !== num(B)) return 0;
    const ca = core(A), cb = core(B);
    if (ca.some(x => cb.includes(x)) || cb.some(x => ca.includes(x))) return 2;
    const ini = w => w.filter(x => !/^\d+$/.test(x)).map(x => x[0]).join(''), ia = ini(A), ib = ini(B);
    if ((cb.length === 1 && cb[0].length <= 4 && ia.includes(cb[0])) || (ca.length === 1 && ca[0].length <= 4 && ib.includes(ca[0]))) return 1;
    return 0;
  }

  /* ---------- the import ---------- */
  function run(D) {
    const st = { players: [0, 0], matches: [0, 0], trainings: [0, 0], injuries: 0, absences: 0, wellness: 0, rpe: 0, sessions: 0, champ: 0 };
    const teams = S().teams, fam = k => teams.filter(t => norm(t.category || t.name).replace(/ /g, '') === k);
    // the category: Seniors (the file is a Seniors team: « FCLR – Senior D3/D4 »)
    const acTeam = (D.effectif.teams || [])[0] || {}, catName = /senior/i.test(`${acTeam.category} ${acTeam.name}`) ? 'seniors' : norm(acTeam.category).replace(/ /g, '');
    const group = fam(catName), main = group.find(t => Store.isMain(t)) || group[0] || teams[0];
    const groupIds = group.map(t => t.id);
    const now = Date.now();
    /* players */
    const ours = S().players, byAc = {}, byCid = {};
    (D.effectif.players || []).forEach(a => {
      const lic = digits(a.licence), n1 = norm(`${a.prenom} ${a.nom}`);
      let p = ours.find(x => x.acId === a.id) || (lic && ours.find(x => digits(x.licence) === lic))
        || ours.find(x => norm(`${x.firstName} ${x.lastName}`) === n1 && (!a.dob || !x.birth || x.birth === a.dob))
        || ours.find(x => norm(x.lastName) === norm(a.nom) && x.birth && x.birth === a.dob);
      // « D'ARTOIS » = « DARTOIS »; the same first and last name, only one such player: the same person even if one date of birth is wrong
      const sq = s => norm(s).replace(/ /g, ''), same = ours.filter(x => !x.acId && sq(`${x.firstName}${x.lastName}`) === sq(`${a.prenom}${a.nom}`));
      if (!p && same.length === 1) p = same[0];
      const posts = POST[a.poste] || null;
      if (p) st.players[1]++; else { p = { id: Store.uid(), firstName: a.prenom || '', lastName: a.nom || '', birth: a.dob || '', teamIds: [main.id], parents: [] }; st.players[0]++; }
      Object.assign(p, { acId: a.id, licence: p.licence || a.licence || '', birth: p.birth || a.dob || '', number: p.number || (a.numero != null ? String(a.numero) : ''),
        foot: p.foot || (a.pied === 'gauche' ? 'Gauche' : a.pied === 'droit' ? 'Droit' : a.pied === 'deux' ? 'Les deux' : ''), height: p.height || a.taille || '', weight: p.weight || a.poids || '',
        mute: a.statut && a.statut !== 'non_mute' ? a.statut : (p.mute || '') });
      if (posts && !(p.posts || []).length) { p.posts = posts; p.pos = LINE[posts[0]]; }
      if (!(p.teamIds || []).some(id => groupIds.includes(id))) p.teamIds = [...(p.teamIds || []), main.id];
      if (a.vma) p.tests = [...(p.tests || []).filter(t => !(t.test === 'vma' && t.src === 'AssistCoachAI')), { id: Store.uid(), test: 'vma', date: day(a.updated_at) || UI.today(), value: +a.vma, src: 'AssistCoachAI' }];
      byAc[a.id] = p; byCid[a.client_id] = p;
      Store.upsert('players', p);
    });
    const pid = x => (byAc[x] || byCid[x] || {}).id;
    /* championships: which of our teams plays each one (from the matches it shares with the FFF import) */
    const champOfEvent = {}, champs = D.champDetail || {};
    Object.values(champs).forEach(c => (c.fixtures || []).forEach(f => { if (f.event_id) champOfEvent[f.event_id] = c.championship.id; }));
    /* matches */
    const evs = (D.planning.events || []).slice().sort((a, b) => a.date.localeCompare(b.date));
    const convBy = {}, attBy = {};
    (D.planning.convocations || []).forEach(c => { (convBy[c.event_id] = convBy[c.event_id] || []).push(c); });
    (D.planning.attendances || []).forEach(a => { (attBy[a.event_id] = attBy[a.event_id] || []).push(a); });
    const teamOfChamp = {};
    evs.filter(e => e.type === 'match').forEach(e => {
      const g = msgOf(e), date = day(e.date), opp = e.adversaire || g.opp || '';
      if (/^exempt$/i.test(opp.trim())) return;
      const cands = S().matches.filter(m => m.date === date && groupIds.includes(m.teamId) && !m.acId);
      let m = S().matches.find(x => x.acId === e.id) || cands.map(x => [x, sameOpp(x.opponent, opp)]).filter(x => x[1]).sort((a, b) => b[1] - a[1]).map(x => x[0])[0];
      const cid = champOfEvent[e.id];
      if (m) { st.matches[1]++; if (cid) teamOfChamp[cid] = m.teamId; }
      else { m = { id: Store.uid(), teamId: (cid && teamOfChamp[cid]) || main.id, date, opponent: opp, home: !!g.home, competition: g.type === 'amical' ? 'Amical' : g.type === 'coupe' ? 'Coupe' : 'Championnat', convoked: [], played: false, gf: 0, ga: 0 }; st.matches[0]++; }
      m.acId = e.id; m.time = m.time || g.time || ''; m.home = typeof m.home === 'boolean' ? m.home : !!g.home;
      const convMsg = e.convocation_msg || g.convocMsg || '';
      if (convMsg && !m.rdv) m.rdv = hhmm((/(rdv|rendez[- ]vous)[^0-9]*(\d{1,2}\s*[h:]\s*\d{0,2})/i.exec(convMsg) || [])[2] || '');
      if (e.note && !m.place) m.place = String(e.note).replace(/\s*\n\s*/g, ' ').replace(/-\s+/g, '- ').trim();
      if (convMsg) m.convocMsg = convMsg;
      const conv = (convBy[e.id] || []).filter(c => c.status === 'convoque').map(c => pid(c.player_id)).filter(Boolean);
      if (conv.length) m.convoked = [...new Set([...(m.convoked || []), ...conv])];
      const lu = e.lineup;
      if (lu && lu.slots) {
        const starters = Object.values(lu.slots).map(pid).filter(Boolean);
        m.acLineup = { formation: lu.formation || '', captain: pid(lu.captain) || null, starters, bench: (lu.bench || []).map(pid).filter(Boolean) };
        m.prep = m.prep || {}; m.prep.plan = Object.assign({}, m.prep.plan || {}, { system: (m.prep.plan || {}).system || lu.formation || '', captain: (m.prep.plan || {}).captain || pid(lu.captain) || '' });
        m.convoked = [...new Set([...(m.convoked || []), ...starters, ...m.acLineup.bench])];
      }
      const pt = e.pt;
      if (pt && pt.plan && Object.values(pt.plan).some(Boolean)) { m.prep = m.prep || {}; m.prep.plan = Object.assign({}, m.prep.plan || {}, { imported: Object.entries(pt.plan).filter(([, v]) => v).map(([k, v]) => `${k === 'jeu' ? '' : k + ' : '}${v}`).join('\n\n') }); }
      if (pt && pt.done) {
        const dur = +pt.dur || 90, half = dur / 2, gFor = pt.goalsFor || [], gAg = pt.goalsAgainst && pt.goalsAgainst.length ? pt.goalsAgainst : ((pt.opp || {}).gmins || []).map(min => ({ min }));
        m.played = true; m.gf = gFor.length; m.ga = gAg.length || +(pt.opp || {}).g || 0; m.duration = dur;
        // scorers and assists; the minutes of the goals come from the player's stats when the goal has none
        const used = {}, minOf = (g2, who) => g2.min != null ? +g2.min : (() => { const l = ((pt.stats || {})[who] || {}).gmins || []; used[who] = (used[who] || 0); return l[used[who]++]; })();
        const stats = {}; const add = (id, k) => { if (!id) return; (stats[id] = stats[id] || {})[k] = ((stats[id] || {})[k] || 0) + 1; };
        const evsL = [];
        gFor.forEach(g2 => { const sc = pid(g2.scorer), as = pid(g2.assist); add(sc, 'g'); add(as, 'a'); evsL.push({ type: 'goal', player: sc || null, assist: as || null, min: minOf(g2, g2.scorer) }); });
        gAg.forEach(g2 => evsL.push({ type: 'against', min: g2.min != null ? +g2.min : null }));
        m.stats = stats;
        // playing time from the lineup and the substitutions
        if (m.acLineup) {
          const mins = {}; m.acLineup.starters.forEach(id => { mins[id] = [0, dur]; });
          (pt.subs || []).forEach(s => { const o = pid(s.out), i = pid(s.in), t = +s.min || 0; if (o && mins[o]) mins[o][1] = Math.min(mins[o][1], t); if (i) mins[i] = [t, dur]; });
          m.minutes = {}; (m.convoked || []).forEach(id => { m.minutes[id] = mins[id] ? Math.max(0, Math.round(mins[id][1] - mins[id][0])) : 0; });
        }
        // the detailed stats of each player (shots, key passes, interceptions, crosses, corners, cards, saves)
        const det = {}; Object.entries(pt.stats || {}).forEach(([cid, s]) => { const id = pid(cid); if (!id) return;
          const n = k => +s[k] || 0, o = { sc: n('sc'), snc: n('snc'), d: n('d'), iv: n('iv'), cr: n('cr') || n('crL') + n('crR'), co: n('co') || n('coL') + n('coR'), yc: n('yc'), rc: n('rc'),
            sv: n('asl') + n('asp') + n('aae') + n('ard') + n('asg') + n('adl') + n('adp') + n('ada') };
          Object.keys(o).forEach(k => { if (!o[k]) delete o[k]; }); if (Object.keys(o).length) det[id] = o; });
        m.detail = det;
        // the match as if it had been followed live (goals by period on the Stats page)
        const base = new Date(date + 'T' + (m.time || '15:00') + ':00').getTime();
        const wall = min => base + (min > half ? (min + 15) : min) * 60000;
        m.live = { status: 'end', halfLen: half, starters: (m.acLineup || {}).starters || [], imported: true,
          periods: [{ start: base, end: base + half * 60000 }, { start: base + (half + 15) * 60000, end: base + (dur + 15) * 60000 }],
          events: evsL.filter(x => x.min != null).map(x => Object.assign({ id: Store.uid(), wall: wall(x.min), min: x.min + "'", period: x.min > half ? 2 : 1 }, x)) };
        if (e.debrief_note && !(m.notes || '').includes(e.debrief_note)) m.notes = [m.notes, e.debrief_note].filter(Boolean).join('\n\n');
      }
      Store.upsert('matches', m);
    });
    /* trainings */
    const rpeBy = {}; ((D.rpe || {}).logs || []).forEach(l => { if (l.event_id && l.rpe) (rpeBy[l.event_id] = rpeBy[l.event_id] || []).push(l); });
    const sessions = ((D.seances || {}).sessions || []).map(s => ({ s, date: new Date(s.date).toISOString().slice(0, 10) }));
    evs.filter(e => e.type === 'seance').forEach(e => {
      const g = msgOf(e), date = day(e.date);
      let tr = S().trainings.find(x => x.acId === e.id) || S().trainings.find(x => !x.model && x.date === date && groupIds.includes(x.teamId) && (x.time || '') === (g.time || '') && !x.acId);
      if (tr) st.trainings[1]++; else { tr = { id: Store.uid(), title: 'Entraînement', date, time: g.time || '', teamId: main.id, goal: '', exercises: [], presents: [] }; st.trainings[0]++; }
      tr.acId = e.id; if (g.place && !tr.place) tr.place = g.place;
      if (e.note && !(tr.goal || '').includes(e.note)) tr.goal = [tr.goal, e.note].filter(Boolean).join('\n');
      const att = attBy[e.id] || [];
      if (att.length) { tr.presents = [...new Set([...(tr.presents || []), ...att.filter(a => a.status === 'present').map(a => pid(a.player_id)).filter(Boolean)])]; tr.absents = att.filter(a => a.status === 'absent').map(a => pid(a.player_id)).filter(Boolean); }
      (rpeBy[e.id] || []).forEach(l => { const id = pid(l.player_id); if (id) { (tr.rpe = tr.rpe || {})[id] = +l.rpe; st.rpe++; } });
      const ses = sessions.find(x => x.date === date);
      if (ses && !(tr.exercises || []).length) { tr.exercises = parseSession(ses.s.text); tr.title = ses.s.title || tr.title; if (ses.s.theme) tr.goal = [tr.goal, 'Thème : ' + ses.s.theme].filter(Boolean).join('\n'); if (ses.s.cWorked || ses.s.cAdjust) tr.review = [ses.s.cWorked && 'Ce qui a marché : ' + ses.s.cWorked, ses.s.cAdjust && 'À ajuster : ' + ses.s.cAdjust].filter(Boolean).join('\n'); st.sessions++; }
      Store.upsert('trainings', tr);
    });
    /* injuries, absences */
    ((D.medical || {}).cases || []).forEach(c => {
      const p = byAc[c.player_id]; if (!p) return;
      const to = day(c.date_return || c.expected_return_on) || (c.status === 'apte' ? day(c.closed_at || c.updated_at) : '');
      const u = { id: 'ac-' + c.id, kind: 'injury', from: day(c.occurred_on), to, part: zone(c.body_zone), note: [c.mechanism && 'Mécanisme : ' + c.mechanism, c.event_context && 'En ' + c.event_context, c.surface && 'Terrain : ' + c.surface.replace(/_/g, ' '), c.status && 'Statut : ' + c.status].filter(Boolean).join(' · ') };
      p.unavail = [...(p.unavail || []).filter(x => x.id !== u.id), u].sort((a, b) => b.from.localeCompare(a.from)); Store.upsert('players', p); st.injuries++;
    });
    (D.planning.availabilities || []).forEach(a => {
      const p = byAc[a.player_id]; if (!p) return;
      const u = { id: 'ac-' + a.id, kind: 'away', from: day(a.debut), to: day(new Date(new Date(a.fin).getTime() + 1000).toISOString()), reason: /vacance/i.test(a.motif) ? 'Vacances' : a.motif === 'Personal' ? 'Raison familiale' : 'Autre', note: a.motif || '' };
      p.unavail = [...(p.unavail || []).filter(x => x.id !== u.id), u]; Store.upsert('players', p); st.absences++;
    });
    /* well-being questionnaires */
    const wel = {}; ((D.wellness || {}).logs || []).forEach(l => { const p = byAc[l.player_id]; if (!p) return; (wel[p.id] = wel[p.id] || []).push({ day: l.day, mood: l.ressenti, mental: l.mental, sleep: l.sommeil, legs: l.jambes, sore: l.courbatures, note: l.note || '' }); });
    Object.entries(wel).forEach(([id, list]) => { const p = Store.get('players', id); const k = new Set(list.map(x => x.day)); p.wellness = [...(p.wellness || []).filter(x => !k.has(x.day)), ...list].sort((a, b) => a.day.localeCompare(b.day)).slice(-120); Store.upsert('players', p); st.wellness += list.length; });
    /* championships: the table of each division, with the team of the club that plays it */
    Object.values(champs).forEach(c => {
      const tid = teamOfChamp[c.championship.id]; const t = tid && Store.get('teams', tid); if (!t) return;
      t.league = { name: c.championship.name, config: c.championship.config, teams: (c.teams || []).map(x => ({ id: x.id, name: x.name, own: !!x.is_own_team, pen: +x.points_penalty || 0 })),
        fixtures: (c.fixtures || []).map(f => ({ r: f.round, d: day(f.date), h: f.home_team_id, a: f.away_team_id, hs: f.home_score, as: f.away_score, ok: !!f.validated, ff: f.forfeit || null })), at: now };
      Store.upsert('teams', t); st.champ++;
    });
    return st;
  }
  // « ## Échauffement | DUR:17min … **ORG:** … **CON:** - … » → exercises
  function parseSession(text) {
    return String(text || '').split(/^##\s+/m).slice(1).map(part => {
      const [head, ...rest] = part.split('\n'), body = rest.join('\n'), title = head.split('|')[0].trim(), dur = +((/DUR:\s*(\d+)/.exec(head) || [])[1] || 15);
      const sect = k => (new RegExp('\\*\\*' + k + ':\\*\\*([\\s\\S]*?)(?=\\n\\*\\*[A-ZÉ]+:\\*\\*|$)').exec(body) || [])[1] || '';
      const cons = sect('CON').split('\n').map(l => l.replace(/^\s*[-•]\s*/, '').trim()).filter(Boolean).join('\n');
      const others = body.replace(/\*\*(ORG|CON):\*\*[\s\S]*?(?=\n\*\*[A-ZÉ]+:\*\*|$)/g, '').replace(/\*\*([A-ZÉ]+):\*\*/g, '$1 :').trim();
      return { id: Store.uid(), title, duration: dur, org: [sect('ORG').trim(), others].filter(Boolean).join('\n\n'), consignes: cons, materiel: '', schemaId: null };
    }).filter(e => e.title);
  }

  // the file chosen by the responsable (Recevoir un fichier), recognised as an AssistCoachAI export
  const isExport = obj => obj && obj.planning && obj.effectif && (obj.source === 'assistcoachai' || Array.isArray(obj.planning.events));
  async function fromText(txt) {
    let D; try { D = JSON.parse(txt); } catch (e) { return false; }
    if (!isExport(D)) return false;
    const r = run(D); App.route();
    modal({ title: 'Import AssistCoachAI', noFocus: true, body: `<p class="lead">Importé sans doublon :</p><ul>
      <li>👥 Joueurs : ${r.players[0]} ajouté${r.players[0] > 1 ? 's' : ''}, ${r.players[1]} complété${r.players[1] > 1 ? 's' : ''}</li>
      <li>⚽ Matchs : ${r.matches[0]} ajouté${r.matches[0] > 1 ? 's' : ''}, ${r.matches[1]} complété${r.matches[1] > 1 ? 's' : ''} (convocations, compos, scores, stats)</li>
      <li>🏃 Entraînements : ${r.trainings[0]} ajouté${r.trainings[0] > 1 ? 's' : ''}, ${r.trainings[1]} complété${r.trainings[1] > 1 ? 's' : ''} · ${r.sessions} séance${r.sessions > 1 ? 's' : ''} détaillée${r.sessions > 1 ? 's' : ''} · ${r.rpe} efforts (RPE)</li>
      <li>🚑 ${r.injuries} blessure${r.injuries > 1 ? 's' : ''} · ✈️ ${r.absences} absence${r.absences > 1 ? 's' : ''} · 💚 ${r.wellness} questionnaires de bien-être</li>
      <li>🏆 ${r.champ} championnat${r.champ > 1 ? 's' : ''} (classement)</li></ul>
      <p class="muted small">Tu peux réimporter un fichier plus récent : ce qui existe déjà est mis à jour, rien n'est ajouté deux fois.</p>`, actions: [{ label: 'OK', kind: 'primary' }] });
    return true;
  }
  return { run, fromText, isExport, parseSession, sameOpp };
})();
