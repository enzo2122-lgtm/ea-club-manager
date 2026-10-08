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
  // (2.09) one of the two names without its team number (« Villemomble » / « VILLEMOMBLE SPORTS 2 »): the same opponent if the rest matches.
  // Only to find the same match again (same day, same category, same time), never to merge two teams of a table.
  function sameOppLoose(a, b) {
    const s = sameOpp(a, b); if (s) return s;
    const nums = x => words(x).some(w => /^\d+$/.test(w)), strip = x => words(x).filter(w => !/^\d+$/.test(w)).join(' ');
    return nums(a) !== nums(b) && sameOpp(strip(a), strip(b)) === 2 ? 1 : 0;
  }
  const timeOk = (x, t) => !x.time || !t || x.time === t;
  // the category of a team as the server reads it (« Seniors B » → « Seniors »): its A, B… teams share their matches' search
  const catOf = t => norm((t && String(t.category || '').trim()) || String((t && t.name) || '').trim().replace(/\s+[A-Za-z0-9]$/, ''));
  const famIds = t => { const k = catOf(t); return k ? S().teams.filter(x => catOf(x) === k).map(x => x.id) : t ? [t.id] : []; };
  /* (2.09) a match created by AssistCoachAI and the same one imported from the FFF (often in another team of the category: the cup
     match in « Seniors », the FFF one in « Seniors B »): one match only. The FFF one stays (official team and score) and takes what
     AssistCoachAI knew (convocations, lineup, scorers, minutes, notes); the other is removed. Returns the moves [old id, kept id]. */
  function dedupe() {
    const moves = [];
    S().matches.filter(m => m.acId && !m.imported).forEach(m => {
      const fam = famIds(Store.get('teams', m.teamId));
      const twin = S().matches.filter(x => x !== m && x.imported && !x.acId && !x.exempt && x.date === m.date && fam.includes(x.teamId) && timeOk(x, m.time))
        .map(x => [x, sameOppLoose(x.opponent, m.opponent)]).filter(x => x[1]).sort((a, b) => b[1] - a[1]).map(x => x[0])[0];
      if (!twin) return;
      twin.acId = m.acId;
      ['acLineup', 'prep', 'rdv', 'place', 'convocMsg', 'duration', 'detail'].forEach(k => { if (m[k] && !twin[k]) twin[k] = m[k]; });
      twin.convoked = [...new Set([...(twin.convoked || []), ...(m.convoked || [])])];
      if (m.competition === 'Coupe') twin.competition = 'Coupe';
      if (m.notes && !(twin.notes || '').includes(m.notes)) twin.notes = [twin.notes, m.notes].filter(Boolean).join('\n\n');
      // the game itself (scorers, minutes, live) when only AssistCoachAI had it; the official score of the FFF stays
      if (m.played && !(twin.live && (twin.live.events || []).length)) { ['stats', 'minutes', 'live'].forEach(k => { if (m[k] && !(twin[k] && Object.keys(twin[k]).length)) twin[k] = m[k]; }); if (!twin.played) Object.assign(twin, { played: true, gf: m.gf, ga: m.ga }); }
      Store.upsert('matches', twin); Store.remove('matches', m.id);
      moves.push([m.id, twin.id]);
    });
    return moves;
  }
  /* (2.09) the players' answers on AssistCoachAI (« acks »: present / absent on a match or a training, with the reason) → the answers
     of the app (the same as a « dispo / pas dispo » given in the players' space). The names of the fields are read loosely. */
  const YES = /^(oui|yes|y|ok|present|pr[ée]sent|dispo|disponible|available|accept|confirm|going|coming|vient|viendra|in|true|1)/i;
  const NO = /^(non|no|n|absent|indispo|unavailable|not|declin|refus|out|false|0|bless|malade|excus)/i;
  const pick = (o, ks) => { for (const k of ks) if (o[k] != null && o[k] !== '') return o[k]; return null; };
  function answerOf(a) {
    let v = pick(a, ['response', 'reponse', 'réponse', 'answer', 'ack', 'ack_status', 'reply', 'choice', 'value', 'vote', 'status', 'state', 'presence']);
    if (v == null) { const b = pick(a, ['present', 'available', 'dispo', 'coming', 'is_present', 'is_available', 'going']); if (b != null) v = b ? 'oui' : 'non'; }
    if (typeof v === 'boolean') v = v ? 'oui' : 'non';
    const s = norm(v); if (!s || /peut|maybe|incert|doute|unknown|pending|attente|convoqu|non repondu/.test(s)) return null;
    return NO.test(s) ? 'non' : YES.test(s) ? 'oui' : null;
  }

  /* ---------- the import ---------- */
  function run(D) {
    const st = { players: [0, 0], matches: [0, 0], trainings: [0, 0], injuries: 0, absences: 0, wellness: 0, rpe: 0, sessions: 0, champ: 0, merged: 0, moves: [], answers: [] };
    const teams = S().teams, fam = k => teams.filter(t => norm(t.category || t.name).replace(/ /g, '') === k);
    // the category: Seniors (the file is a Seniors team: « FCLR – Senior D3/D4 »)
    const acTeam = (D.effectif.teams || [])[0] || {}, catName = /senior/i.test(`${acTeam.category} ${acTeam.name}`) ? 'seniors' : norm(acTeam.category).replace(/ /g, '');
    const group = fam(catName), main = group.find(t => Store.isMain(t)) || group[0] || teams[0];
    const groupIds = [...new Set([...group.map(t => t.id), ...famIds(main)])];
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
    const evMap = {}; // AssistCoachAI event → our match or training (its id read after the merges)
    const convBy = {}, attBy = {};
    (D.planning.convocations || []).forEach(c => { (convBy[c.event_id] = convBy[c.event_id] || []).push(c); });
    (D.planning.attendances || []).forEach(a => { (attBy[a.event_id] = attBy[a.event_id] || []).push(a); });
    const teamOfChamp = {};
    // (1.48) one AssistCoachAI team can play two championships (« Senior D3/D4 »): the club's A team always plays the highest
    // level (R1 > R2 > … > D1 > D2 …), so the championships sorted by level go to A, B, C… (a match shared with the FFF import still decides)
    const rank = s => { const n = norm(s), r = n.match(/\br ?(\d)\b/), d = n.match(/\bd ?(\d)\b/); return /coupe|cup|ancien|veteran|cdm/.test(n) ? 0 : r ? +r[1] : d ? 10 + +d[1] : 0; };
    const lettered = group.filter(t => /\s[A-E]$/i.test(String(t.name || '').trim())).sort((a, b) => String(a.name).trim().slice(-1).localeCompare(String(b.name).trim().slice(-1)));
    Object.values(champs).map(c => ({ id: c.championship.id, r: rank(c.championship.name) })).filter(x => x.r).sort((a, b) => a.r - b.r)
      .forEach((x, i) => { if (lettered[i]) teamOfChamp[x.id] = lettered[i].id; });
    const byLevel = Object.assign({}, teamOfChamp);
    evs.filter(e => e.type === 'match').forEach(e => {
      const g = msgOf(e), date = day(e.date), opp = e.adversaire || g.opp || '';
      if (/^exempt$/i.test(opp.trim())) return;
      const cands = S().matches.filter(m => m.date === date && groupIds.includes(m.teamId) && !m.acId && timeOk(m, g.time));
      const best = f => cands.map(x => [x, f(x.opponent, opp)]).filter(x => x[1]).sort((a, b) => b[1] - a[1]).map(x => x[0])[0];
      let m = S().matches.find(x => x.acId === e.id) || best(sameOpp) || best(sameOppLoose); // (2.09) then without the team number
      evMap[e.id] = () => m.id;
      const cid = champOfEvent[e.id];
      // a match AssistCoachAI created before in the wrong team (A instead of B) goes to the team of its level
      if (m) { st.matches[1]++; if (cid) { if (byLevel[cid] && m.acId === e.id && !m.imported && !m.teamManual && !m.fffSheet) m.teamId = byLevel[cid]; teamOfChamp[cid] = m.teamId; } }
      else { m = { id: Store.uid(), teamId: (cid && teamOfChamp[cid]) || main.id, date, opponent: opp, home: !!g.home, competition: g.type === 'amical' ? 'Amical' : g.type === 'coupe' ? 'Coupe' : 'Championnat', convoked: [], played: false, gf: 0, ga: 0 }; st.matches[0]++; }
      if (g.type === 'coupe' && m.competition !== 'Coupe') m.competition = 'Coupe'; // (2.09) a cup match stays a cup match
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
      if (pt && (pt.subs || []).length) { m.acSubs = pt.subs.map(s => ({ out: pid(s.out) || null, in: pid(s.in) || null, min: +s.min || 0 })); m.acDur = +pt.dur || 90; } // (2.12)
      if (pt && pt.plan && Object.values(pt.plan).some(Boolean)) { m.prep = m.prep || {}; m.prep.plan = Object.assign({}, m.prep.plan || {}, { imported: Object.entries(pt.plan).filter(([, v]) => v).map(([k, v]) => `${k === 'jeu' ? '' : k + ' : '}${v}`).join('\n\n') }); }
      // (1.45) a past match with goals, substitutions or stats counts as played even when the coach did not press « terminé » on AssistCoachAI
      // (2.11) a match corrected by hand (« Corriger le match ») keeps its scorers, minutes and cards
      if (pt && !m.handFix && (pt.done || (date < UI.today() && ((pt.goalsFor || []).length || (pt.goalsAgainst || []).length || (pt.subs || []).length || Object.keys(pt.stats || {}).length)))) {
        const dur = +pt.dur || 90, half = dur / 2, gFor = pt.goalsFor || [], gAg = pt.goalsAgainst && pt.goalsAgainst.length ? pt.goalsAgainst : ((pt.opp || {}).gmins || []).map(min => ({ min }));
        // (1.47) AssistCoachAI completes the match: the official FFF score, the live match followed in the app and the cards stay
        const official = m.played && (m.fffSheet || m.imported), followed = !!(m.live && !m.live.imported && (m.live.events || []).length);
        m.played = true; if (!official) { m.gf = gFor.length; m.ga = gAg.length || +(pt.opp || {}).g || 0; } m.duration = m.duration || dur;
        // scorers and assists; the minutes of the goals come from the player's stats when the goal has none
        const used = {}, minOf = (g2, who) => g2.min != null ? +g2.min : (() => { const l = ((pt.stats || {})[who] || {}).gmins || []; used[who] = (used[who] || 0); return l[used[who]++]; })();
        const stats = {}; const add = (id, k) => { if (!id) return; (stats[id] = stats[id] || {})[k] = ((stats[id] || {})[k] || 0) + 1; };
        const evsL = [];
        gFor.forEach(g2 => { const sc = pid(g2.scorer), as = pid(g2.assist); add(sc, 'g'); add(as, 'a'); evsL.push({ type: 'goal', player: sc || null, assist: as || null, min: minOf(g2, g2.scorer) }); });
        gAg.forEach(g2 => evsL.push({ type: 'against', min: g2.min != null ? +g2.min : null }));
        // goals and assists from AssistCoachAI when it has some (unless the match was followed live in the app); the other figures (cards…) stay
        const old = m.stats || {}, useAc = gFor.length && !followed, merged = {};
        [...new Set([...Object.keys(old), ...Object.keys(stats)])].forEach(id => { const o = Object.assign({}, old[id]); if (useAc) { delete o.g; delete o.a; Object.assign(o, stats[id]); } if (Object.keys(o).length) merged[id] = o; });
        m.stats = merged;
        // playing time from the lineup and the substitutions (the live match's minutes stay for the players it followed)
        if (m.acLineup) {
          const mins = {}; m.acLineup.starters.forEach(id => { mins[id] = [0, dur]; });
          (pt.subs || []).forEach(s => { const o = pid(s.out), i = pid(s.in), t = +s.min || 0; if (o && mins[o]) mins[o][1] = Math.min(mins[o][1], t); if (i) mins[i] = [t, dur]; });
          const had = m.minutes || {}; m.minutes = {};
          (m.convoked || []).forEach(id => { const ac = mins[id] ? Math.max(0, Math.round(mins[id][1] - mins[id][0])) : 0; m.minutes[id] = followed && +had[id] > 0 ? +had[id] : (ac || +had[id] || 0); });
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
        if (!followed) m.live = { status: 'end', halfLen: half, starters: (m.acLineup || {}).starters || [], imported: true,
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
      tr.acId = e.id; if (g.place && !tr.place) tr.place = g.place; evMap[e.id] = () => tr.id;
      if (e.note && !(tr.goal || '').includes(e.note)) tr.goal = [tr.goal, e.note].filter(Boolean).join('\n');
      const att = attBy[e.id] || [];
      if (att.length) { tr.presents = [...new Set([...(tr.presents || []), ...att.filter(a => a.status === 'present').map(a => pid(a.player_id)).filter(Boolean)])]; tr.absents = att.filter(a => a.status === 'absent').map(a => pid(a.player_id)).filter(Boolean); }
      (rpeBy[e.id] || []).forEach(l => { const id = pid(l.player_id); if (id) { (tr.rpe = tr.rpe || {})[id] = +l.rpe; st.rpe++; } });
      const ses = sessions.find(x => x.date === date);
      if (ses && !(tr.exercises || []).length) { tr.exercises = parseSession(ses.s.text); tr.title = ses.s.title || tr.title; if (ses.s.theme) tr.goal = [tr.goal, 'Thème : ' + ses.s.theme].filter(Boolean).join('\n'); if (ses.s.cWorked || ses.s.cAdjust) tr.review = [ses.s.cWorked && 'Ce qui a marché : ' + ses.s.cWorked, ses.s.cAdjust && 'À ajuster : ' + ses.s.cAdjust].filter(Boolean).join('\n'); st.sessions++; }
      Store.upsert('trainings', tr);
    });
    /* (2.09) one match only when AssistCoachAI and the FFF both had it */
    st.moves = dedupe(); st.merged = st.moves.length; const moved = Object.fromEntries(st.moves);
    /* (2.09) the players' answers (present / absent) to the matches and trainings */
    const today = UI.today(), ans = {}, seen = { n: 0, keys: new Set(), vals: new Set() };
    const evDate = {}; evs.forEach(e => { evDate[e.id] = day(e.date); });
    const addAns = (a, fromAttendance) => {
      const ev = pick(a, ['event_id', 'eventId', 'event', 'planning_event_id', 'match_id', 'seance_id']), who = pid(pick(a, ['player_id', 'playerId', 'client_id', 'player', 'member_id', 'user_id']));
      let id = ev && evMap[ev] && evMap[ev](); id = moved[id] || id; if (!id || !who) return false;
      const s = answerOf(a); if (!s) return false;
      if (fromAttendance && evDate[ev] < today) return false; // a past training: its attendance (above), not an answer
      const note = s === 'non' ? String(pick(a, ['reason', 'motif', 'comment', 'commentaire', 'note', 'message']) || '').slice(0, 120) : '';
      const at = pick(a, ['updated_at', 'answered_at', 'responded_at', 'created_at', 'at']);
      const k = id + '|' + who; if (!ans[k] || String(at || '') >= String(ans[k].at || '')) ans[k] = { m: id, p: who, s, note, at: at || null };
      return true;
    };
    const acks = D.planning.acks || D.planning.responses || D.planning.answers || D.planning.votes || [];
    (Array.isArray(acks) ? acks : Object.values(acks).flat()).forEach(a => { if (!a || typeof a !== 'object') return; seen.n++; Object.keys(a).forEach(k => seen.keys.add(k));
      const v = pick(a, ['response', 'reponse', 'answer', 'ack', 'status', 'value', 'vote']); if (v != null) seen.vals.add(String(v)); addAns(a); });
    // a convocation can carry the answer too; the attendance said before a training is an answer
    (D.planning.convocations || []).forEach(c => { const r = pick(c, ['response', 'reponse', 'answer', 'ack', 'ack_status', 'reply']); if (r != null) addAns(Object.assign({}, c, { response: r })); });
    (D.planning.attendances || []).forEach(a => addAns(a, true));
    st.answers = Object.values(ans); st.acksSeen = seen;
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
    const sent = await sendAnswers(r.answers, r.moves);
    modal({ title: 'Import AssistCoachAI', noFocus: true, body: `<p class="lead">Importé sans doublon :</p><ul>
      <li>👥 Joueurs : ${r.players[0]} ajouté${r.players[0] > 1 ? 's' : ''}, ${r.players[1]} complété${r.players[1] > 1 ? 's' : ''}</li>
      <li>⚽ Matchs : ${r.matches[0]} ajouté${r.matches[0] > 1 ? 's' : ''}, ${r.matches[1]} complété${r.matches[1] > 1 ? 's' : ''} (convocations, compos, scores, stats)</li>
      <li>🏃 Entraînements : ${r.trainings[0]} ajouté${r.trainings[0] > 1 ? 's' : ''}, ${r.trainings[1]} complété${r.trainings[1] > 1 ? 's' : ''} · ${r.sessions} séance${r.sessions > 1 ? 's' : ''} détaillée${r.sessions > 1 ? 's' : ''} · ${r.rpe} efforts (RPE)</li>
      <li>🚑 ${r.injuries} blessure${r.injuries > 1 ? 's' : ''} · ✈️ ${r.absences} absence${r.absences > 1 ? 's' : ''} · 💚 ${r.wellness} questionnaires de bien-être</li>
      <li>🏆 ${r.champ} championnat${r.champ > 1 ? 's' : ''} (classement)</li>
      ${r.merged ? `<li>🤝 ${r.merged} match${r.merged > 1 ? 's' : ''} en double fusionné${r.merged > 1 ? 's' : ''} avec celui de la FFF</li>` : ''}
      <li>🗳️ ${sent.text}</li></ul>
      ${!r.answers.length && r.acksSeen.n ? `<p class="muted small">AssistCoachAI a envoyé ${r.acksSeen.n} réponse${r.acksSeen.n > 1 ? 's' : ''} que l'appli ne sait pas encore lire (champs : ${esc([...r.acksSeen.keys].slice(0, 12).join(', '))} · valeurs : ${esc([...r.acksSeen.vals].slice(0, 8).join(', ') || 'aucune')}). Envoie une capture de ce message pour qu'on les ajoute.</p>` : ''}
      <p class="muted small">Tu peux réimporter un fichier plus récent : ce qui existe déjà est mis à jour, rien n'est ajouté deux fois.</p>`, actions: [{ label: 'OK', kind: 'primary' }] });
    return true;
  }
  // (2.09) the answers to the club server (a newer answer given in the app stays), and the answers of a merged match follow it
  async function sendAnswers(rows, moves) {
    rows = rows || []; moves = moves || [];
    if (!rows.length && !moves.length) return { text: 'Aucune réponse présent / absent dans ce fichier' };
    if (typeof Cloud === 'undefined' || !Cloud.ready()) return { text: `${rows.length} réponse${rows.length > 1 ? 's' : ''} présent / absent lue${rows.length > 1 ? 's' : ''} : connecte-toi au serveur du club et réimporte pour les enregistrer` };
    try {
      let n = 0; for (let i = 0; i < Math.max(rows.length, 1); i += 500) { const r = await Cloud.importAnswers(rows.slice(i, i + 500), i ? [] : moves.map(([from, to]) => ({ from, to }))); n += +((r && r.saved) || 0); }
      return { text: `${rows.length} réponse${rows.length > 1 ? 's' : ''} présent / absent des joueurs (${n} nouvelle${n > 1 ? 's' : ''} ou mise${n > 1 ? 's' : ''} à jour)` };
    } catch (e) { return { text: /function|introuvable|PGRST|404/i.test(String(e.message)) ? `${rows.length} réponses lues : le serveur doit d'abord être mis à jour (SQL « reponses-assistcoachai »)` : 'Réponses non enregistrées : ' + e.message }; }
  }
  return { run, fromText, isExport, parseSession, sameOpp, sameOppLoose, dedupe, famIds, sendAnswers };
})();
