/* Importer: bring matches and sessions from other places into the app.
   - FFF / District calendar copied from the website (epreuves.fff.fr, district93foot.fff.fr),
   - calendar files (.ics) exported by Google Calendar, iPhone Calendar or other apps,
   - spreadsheets (.csv),
   - AssistCoachAI session sheets (PDF) read section by section. */
const Importer = (() => {
  const { esc, $, $$, toast, modal } = UI;
  const S = () => Store.state;
  // the main word of the club's name: « FA Le Raincy » → RAINCY, « Olympique de Paris FC » → PARIS (or the FFF name typed in Réglages → Le club)
  const STOP = /^(FC|F|C|AS|A|S|US|U|ES|E|FA|SC|RC|JS|AC|CS|CO|OL|OLYMPIQUE|UNION|ENTENTE|ETOILE|STADE|SPORTING|SPORTIVE|SPORTIF|SPORT|SPORTS|FOOTBALL|FOOT|CLUB|ASSOCIATION|ATHLETIC|RACING|LE|LA|LES|L|DE|DU|DES|D|ET|EN|SUR|SOUS)$/;
  const clubWord = () => { const c = S().club || {}; if (c.fffName) return norm(c.fffName).trim(); const w = norm(c.name || '').split(/[^A-Z0-9]+/).filter(x => x.length > 1 && !STOP.test(x)).sort((a, b) => b.length - a.length); return w[0] || '§'; };
  const CLUB_RE = { test: s => { const w = clubWord(); return !!w && norm(s).includes(w); } };
  const MONTHS = { JAN: 1, FEV: 2, FÉV: 2, MAR: 3, AVR: 4, MAI: 5, JUN: 6, JUIN: 6, JUI: 7, JUIL: 7, JUL: 7, AOU: 8, AOÛ: 8, AOUT: 8, AOÛT: 8, SEP: 9, SEPT: 9, OCT: 10, NOV: 11, DEC: 12, DÉC: 12 };
  const pad = n => String(n).padStart(2, '0');
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

  /* ---------- FFF / District calendar (copy-paste of the page) ---------- */
  const DATE_RE = /^(LUN|MAR|MER|JEU|VEN|SAM|DIM)\.?\s+(\d{1,2})\s+([A-ZÉÛ]{3,5})\.?\s+(\d{4})(?:\s*[-–]\s*(\d{1,2})\s*H\s*(\d{2}))?/i;
  function parseFFF(text) {
    const lines = String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(DATE_RE); if (!m) continue;
      const month = MONTHS[norm(m[3]).slice(0, 4)] || MONTHS[norm(m[3]).slice(0, 3)]; if (!month) continue;
      const block = []; let j = i + 1;
      while (j < lines.length && !DATE_RE.test(lines[j])) { block.push(lines[j]); j++; }
      const ci = block.findIndex(l => /journ[ée]e|brassage|coupe|plateau|challenge|poule|d\d\b|critérium|criterium/i.test(l) && /[-–]|journ/i.test(l));
      const comp = ci >= 0 ? block[ci] : '', rest = ci >= 0 ? block.slice(ci + 1) : block;
      const teams = rest.filter(l => !/^\d{1,2}([:h]\d{2})?$/i.test(l) && !/^(ajouter au favoris|voir|lien)/i.test(l));
      const nums = rest.filter(l => /^\d{1,2}$/.test(l)).map(Number);
      const time = m[5] ? `${pad(m[5])}:${m[6]}` : ((rest.find(l => /^\d{1,2}:\d{2}$/.test(l)) || ''));
      const homeT = teams[0] || '', awayT = teams[1] || '';
      // Exempt: no match for this team on this matchday, kept so the coach sees it in the calendar
      if (/EXEMPT/i.test(homeT + awayT)) {
        const ours = CLUB_RE.test(homeT) ? homeT : awayT;
        out.push({ date: `${m[4]}-${pad(month)}-${pad(m[2])}`, time: '', competition: comp, home: true, opponent: 'Exempt', ourName: ours, exempt: true, played: false, gf: 0, ga: 0, venue: '' });
        i = j - 1; continue;
      }
      const home = CLUB_RE.test(homeT) || (!CLUB_RE.test(awayT) && !awayT);
      if (!CLUB_RE.test(homeT) && !CLUB_RE.test(awayT)) continue;
      const played = nums.length >= 2;
      out.push({ date: `${m[4]}-${pad(month)}-${pad(m[2])}`, time, competition: comp, home, opponent: (home ? awayT : homeT).replace(/\s+/g, ' '),
        ourName: home ? homeT : awayT, played, gf: played ? (home ? nums[0] : nums[1]) : 0, ga: played ? (home ? nums[1] : nums[0]) : 0, venue: ci > 0 ? block.slice(0, ci).join(' ') : '' });
      i = j - 1;
    }
    return out;
  }
  // Guess which category a match belongs to from its competition name
  // « U14 D4 - U15 - U14 Journée 1 » → U14 (the level comes first; « U15 - U14 » only says which ages may play)
  const levelOf = comp => { const m = norm(comp).match(/\bU ?(\d{1,2})\b/); return m ? 'U' + m[1] : ''; };
  function guessTeam(comp, ourName) {
    const c = norm(comp) + ' ' + norm(ourName), T = S().teams, lv = levelOf(comp) || levelOf(ourName);
    // the category itself (« U13 ») before its teams (« U13 A », which share its category)
    const by = name => T.find(t => norm(t.name) === name) || T.find(t => norm(t.category || t.name) === name);
    if (/ANCIEN|VETERAN|CDM|\b\+35|\b\+45/.test(c)) return by('VETERANS');
    // No U18 / U19 / U20 at the club: those players are in Seniors
    if (['U18', 'U19', 'U20'].includes(lv)) return by('SENIORS');
    for (const u of ['U17', 'U16', 'U15', 'U14', 'U13', 'U12', 'U11', 'U10', 'U9', 'U8', 'U7', 'U6']) if (lv ? lv === u : c.includes(u)) {
      const map = { U16: 'U17', U14: 'U15', U12: 'U13', U10: 'U11', U8: 'U9' }; // older clubs grouped two ages in one category
      const t = by(u) || by(map[u]);
      return t && pickTeam(t, ourName);
    }
    if (/SENIOR/.test(c)) { const t = by('SENIORS'); return t && pickTeam(t, ourName); }
    return null;
  }
  /* The District numbers the club's teams of a category: « FA LE RAINCY » = team 1, « FA LE RAINCY 2 » = team 2…
     Team 1 is « U14 A », team 2 « U14 B »… unless the responsable set another number on the team (Équipes → the team). */
  // « RAINCY F.A. » → 1, « RAINCY F.A. 2 » → 2, « F. ASSOCIATION LE RAINCY 1 » → 1, « FA LE RAINCY B » → 2
  const teamNo = ourName => {
    const s = norm(ourName).split(clubWord()).slice(1).join(clubWord()).replace(/^\s*F\.?\s*A\.?(?=\s|$)/, '').trim(), m = s.match(/^(\d)\b/) || s.match(/^([A-E])$/);
    return !m ? 1 : /\d/.test(m[1]) ? +m[1] : m[1].charCodeAt(0) - 64;
  };
  const letterNo = t => { const m = String(t.name || '').trim().match(/\s([A-E])$/i); return m ? m[1].toUpperCase().charCodeAt(0) - 64 : 0; };
  const districtNo = t => +t.districtNo || letterNo(t);
  function pickTeam(t, ourName) {
    const base = norm(t.category || t.name).replace(/\s+[A-E]$/, ''), no = teamNo(ourName);
    const lettered = S().teams.filter(x => norm(x.category || '').replace(/\s+[A-E]$/, '') === base && letterNo(x));
    return lettered.find(x => districtNo(x) === no) || t;
  }
  // Matches imported before (their note keeps « Équipe : FA LE RAINCY 2 »): put each one in its team, unless moved by hand
  function reassignImported(onlyCat) {
    let n = 0;
    S().matches.forEach(m => {
      if (m.teamManual) return;
      const ours = ((m.notes || '').match(/Équipe : (.+)/) || [])[1]; if (!ours) return;
      const cur = Store.get('teams', m.teamId); if (!cur) return;
      const base = norm(cur.category || cur.name).replace(/\s+[A-E]$/, ''); if (onlyCat && base !== norm(onlyCat).replace(/\s+[A-E]$/, '')) return;
      const t = pickTeam(cur, ours);
      if (t && t.id !== m.teamId) { m.teamId = t.id; m.updatedAt = Date.now(); n++; }
    });
    if (n) Store.save();
    return n;
  }

  function refileImported() {
    let n = 0;
    S().matches.forEach(m => {
      if (m.teamManual) return;
      const lines = String(m.notes || '').split('\n'), ours = ((m.notes || '').match(/Équipe : (.+)/) || [])[1]; if (!ours) return;
      const comp = lines[0] && !/^Équipe :/.test(lines[0]) ? lines[0] : '', t = guessTeam(comp, ours);
      if (t && t.id !== m.teamId) { m.teamId = t.id; m.updatedAt = Date.now(); n++; }
    });
    if (n) Store.save();
    return n;
  }

  /* ---------- .ics calendar files ---------- */
  function parseICS(text) {
    const unfolded = String(text).replace(/\r?\n[ \t]/g, ''), events = [];
    unfolded.split(/BEGIN:VEVENT/).slice(1).forEach(chunk => {
      const get = k => { const m = chunk.match(new RegExp('^' + k + '(?:;[^:\\n]*)?:(.*)$', 'mi')); return m ? m[1].trim().replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';') : ''; };
      const dt = get('DTSTART'), de = get('DTEND'); if (!dt) return;
      const toParts = v => { const m = v.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})\d{0,2}(Z)?)?/); if (!m) return null;
        let d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 12), +(m[5] || 0)));
        if (!m[6]) d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 12), +(m[5] || 0));
        return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: m[4] ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '', min: m[4] ? d.getHours() * 60 + d.getMinutes() : null }; };
      const a = toParts(dt), b = de ? toParts(de) : null; if (!a) return;
      events.push({ date: a.date, time: a.time, start: a.min, end: b && b.min != null ? b.min : null, title: get('SUMMARY'), place: get('LOCATION'), desc: get('DESCRIPTION') });
    });
    return events;
  }
  // "Raincy - Bondy", "Bondy vs Le Raincy FC", "Match U13 contre Bondy"…
  function matchFromTitle(ev) {
    const t = ev.title.replace(/\s+/g, ' ');
    const parts = t.split(/\s+(?:-|–|vs\.?|contre|x)\s+/i);
    if (parts.length >= 2) { const home = CLUB_RE.test(parts[0]) || !CLUB_RE.test(parts[1]); return { opponent: (home ? parts[1] : parts[0]).replace(/^(match|u\d+)\s+/i, '').trim(), home }; }
    return { opponent: t.replace(/^match\s*(contre|vs)?\s*/i, '').trim() || 'Adversaire', home: true };
  }

  /* ---------- .csv ---------- */
  function parseCSV(text) {
    const rows = String(text).replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
    if (!rows.length) return [];
    const sep = (rows[0].match(/;/g) || []).length >= (rows[0].match(/,/g) || []).length ? ';' : ',';
    const cells = l => l.split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
    const head = cells(rows[0]).map(norm), col = (...names) => head.findIndex(h => names.some(n => h.includes(n)));
    const iD = col('DATE'), iH = col('HEURE', 'HORAIRE', 'TIME'), iA = col('ADVERSAIRE', 'OPPOSANT', 'OPPONENT', 'CONTRE'), iL = col('DOMICILE', 'LIEU', 'HOME'), iC = col('COMPET', 'CATEGORIE', 'EQUIPE');
    const body = iD >= 0 ? rows.slice(1) : rows;
    return body.map(l => {
      const c = cells(l), d = (c[iD >= 0 ? iD : 0] || '').match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})|(\d{4})-(\d{2})-(\d{2})/); if (!d) return null;
      const date = d[4] ? `${d[4]}-${d[5]}-${d[6]}` : `${d[3].length === 2 ? '20' + d[3] : d[3]}-${pad(d[2])}-${pad(d[1])}`;
      const h = (c[iH] || '').match(/(\d{1,2})[h:](\d{2})?/i);
      const loc = norm(c[iL] || '');
      return { date, time: h ? `${pad(h[1])}:${h[2] || '00'}` : '', opponent: c[iA >= 0 ? iA : 1] || 'Adversaire', home: !/EXT|AWAY|VISITEUR|NON|^E$/.test(loc), competition: c[iC] || '', played: false, gf: 0, ga: 0 };
    }).filter(Boolean);
  }

  /* ---------- import screen for matches ---------- */
  // (1.40) the matches found (FFF / District page, file): updated when already there (same team, day and opponent), else added
  function applyFound(found, sel = 'auto', each) {
    const res = { added: 0, updated: 0, noTeam: 0, scores: 0 };
    found.forEach(m => {
      const t = sel === 'auto' ? guessTeam(m.competition, m.ourName || '') : Store.get('teams', sel);
      if (!t) { res.noTeam++; return; }
      // (1.51) « F.C. Bourget 2 » (AssistCoachAI) = « BOURGET FC 2 » (FFF): the same match, never a second one
      const ex = S().matches.find(x => x.teamId === t.id && x.date === m.date && norm(x.opponent) === norm(m.opponent))
        || S().matches.find(x => x.teamId === t.id && x.date === m.date && !x.exempt && ACImport.sameOpp(x.opponent, m.opponent) > 0);
      const comp = /coupe/i.test(m.competition) ? 'Coupe' : /brassage|plateau|challenge/i.test(m.competition) ? 'Plateau' : 'Championnat';
      if (ex) { if (m.played && (!ex.played || ex.gf !== m.gf || ex.ga !== m.ga)) res.scores++; Object.assign(ex, { time: m.time || ex.time, played: m.played || ex.played, gf: m.played ? m.gf : ex.gf, ga: m.played ? m.ga : ex.ga }); Store.upsert('matches', ex); res.updated++; }
      else { Store.upsert('matches', { id: Store.uid(), teamId: t.id, exempt: !!m.exempt, opponent: m.opponent || 'Adversaire', date: m.date, time: m.time || '', home: m.home, competition: comp, place: m.place || m.venue || '', rdv: '', played: m.played, gf: m.played ? m.gf : 0, ga: m.played ? m.ga : 0, convoked: [], lineupId: null, notes: '', imported: true }); res.added++; if (m.played) res.scores++; }
      each && each(m, t);
    });
    return res;
  }
  // (1.30) the official calendar of the club's federation (basket, hand, rugby, volley): opened on its site, then imported as a file
  function fedSteps() {
    const [short, name, url, host] = Sport.fed();
    return `<ol class="wizard small"><li>Ouvre le calendrier de ton équipe sur le site de la <b>${esc(name)}</b> : <a href="${esc(S().club.fffUrl || url)}" target="_blank" rel="noopener">${esc(S().club.fffUrl ? 'page du club' : host)}</a> (championnat, poule, puis ton équipe).</li>
      <li>S'il propose « Ajouter à mon agenda » ou « Exporter (.ics) », télécharge le fichier puis touche l'onglet <b>Fichier calendrier (.ics)</b>.</li>
      <li>Sinon, recopie les matchs dans un tableur (Date, Heure, Adversaire, Domicile) et touche l'onglet <b>Tableur (.csv)</b>.</li></ol>
      <p class="muted small">Astuce : enregistre l'adresse de la page de ton club (Réglages → Le club → « Page du club sur le site de la ${esc(short)} ») pour l'ouvrir directement d'ici.</p>`;
  }
  function matchesDialog(done) {
    let found = [];
    const teams = S().teams;
    modal({ title: 'Importer des matchs', body: `
      <div class="chips" id="srcTabs"><button class="chip on" data-v="fff">${Sport.isFoot() ? 'Site FFF / District' : 'Site ' + esc(Sport.fed()[0])}</button><button class="chip" data-v="ics">Fichier calendrier (.ics)</button><button class="chip" data-v="csv">Tableur (.csv)</button></div>
      <div id="srcFff" class="src">
        ${Sport.isFoot() ? `<ol class="wizard small"><li>Ouvre la page de l'équipe sur <a href="${esc(S().club.fffUrl || Sport.fed()[2])}" target="_blank" rel="noopener">epreuves.fff.fr</a> (ou le site de ton district), onglet <b>Résultats / Calendrier</b>.</li>
        <li>Sélectionne tout le texte des matchs du mois (ou de la page du club), copie-le, puis colle-le ici. Recommence mois par mois, les doublons sont ignorés.</li></ol>` : fedSteps()}
        <textarea id="fffText" ${Sport.isFoot() ? '' : 'hidden'} rows="6" placeholder="DIM 04 OCT 2026 - 15H30&#10;Seniors D3 - Senior Journée 1&#10;BFC 2&#10;15:30&#10;FC EXEMPLE"></textarea>
      </div>
      <div id="srcFile" class="src" hidden><p class="muted" id="fileHint"></p><button class="btn" id="pickFile">${I.upload}<span>Choisir le fichier</span></button></div>
      <label class="fld" style="margin-top:10px"><span>Catégorie</span><select id="impTeam"><option value="auto">Automatique (d'après la compétition)</option>${teams.map(t => `<option value="${t.id}">${esc(Store.teamLabel(t))}</option>`).join('')}</select></label>
      <label class="switch"><input type="checkbox" id="impBook" ${Cloud.ready() ? '' : 'disabled'}><span>Réserver aussi le terrain pour les matchs à domicile (2 h, grand terrain)</span></label>
      <div id="impPreview" class="imp-preview"></div>`,
      onOpen: r => {
        let src = 'fff';
        const preview = () => {
          const auto = $('#impTeam', r).value === 'auto';
          $('#impPreview', r).innerHTML = found.length ? `<p class="lead">${found.length} match${found.length > 1 ? 's' : ''} trouvé${found.length > 1 ? 's' : ''}</p><ul class="imp-list">${found.map(m => {
            const t = auto ? guessTeam(m.competition, m.ourName || '') : Store.get('teams', $('#impTeam', r).value);
            return `<li><b>${esc(UI.fmtDate(m.date))}${m.time ? ' · ' + esc(m.time) : ''}</b> ${m.exempt ? '⏸️ Exempt (pas de match)' : (m.home ? '🏠 ' : '🚌 ') + esc(m.opponent)} <span class="muted">${esc(t ? t.name : '⚠️ catégorie à choisir')}${m.played ? ` · ${m.gf}-${m.ga}` : ''}</span></li>`; }).join('')}</ul>` : '';
        };
        $$('#srcTabs .chip', r).forEach(b => b.onclick = () => {
          $$('#srcTabs .chip', r).forEach(x => x.classList.remove('on')); b.classList.add('on'); src = b.dataset.v; found = [];
          $('#srcFff', r).hidden = src !== 'fff'; $('#srcFile', r).hidden = src === 'fff';
          $('#fileHint', r).textContent = src === 'ics' ? 'Exporte ton agenda (Google Agenda, Calendrier iPhone, appli du club…) en fichier .ics, puis choisis-le. Chaque événement devient un match : « Mon club - Bondy » donne l\'adversaire et le domicile.' : 'Un tableau avec au moins les colonnes Date, Heure, Adversaire, et si possible Domicile (oui/non) et Compétition.';
          preview();
        });
        $('#fffText', r).oninput = e => { found = parseFFF(e.target.value); preview(); };
        $('#impTeam', r).onchange = preview;
        $('#pickFile', r).onclick = async () => {
          const [f] = await UI.pickFiles(); if (!f) return;
          const txt = await f.text();
          found = src === 'ics' ? parseICS(txt).map(ev => Object.assign({ date: ev.date, time: ev.time, competition: ev.desc || '', played: false, gf: 0, ga: 0, place: ev.place }, matchFromTitle(ev))) : parseCSV(txt);
          if (!found.length) toast('Aucun match trouvé dans ce fichier', 'err');
          preview();
        };
      },
      actions: [{ label: 'Annuler' }, { label: 'Importer', kind: 'primary', onClick: (close, r) => {
        if (!found.length) { toast('Rien à importer pour l\'instant', 'err'); return false; }
        const sel = $('#impTeam', r).value, book = $('#impBook', r).checked;
        const toBook = [];
        const res = applyFound(found, sel, (m, t) => { if (book && m.home && !m.exempt && m.time && m.date >= UI.today()) toBook.push({ m, t }); });
        close();
        (async () => {
          let booked = 0; const clash = [];
          if (toBook.length) {
            const b = UI.busy('Réservation du terrain pour les matchs à domicile…'), u = Auth.current();
            for (const { m, t } of toBook) {
              const [h, mi] = m.time.split(':').map(Number), s0 = h * 60 + mi;
              try { await Cloud.book({ date: m.date, start_min: s0, end_min: Math.min(s0 + 120, 23 * 60 + 45), field: 'T1', part: 'full', kind: 'match', team_id: t.id, team_name: t.name, author_id: u.id, author_name: Store.fullName(u), note: 'contre ' + m.opponent }); booked++; }
              catch (e) { clash.push(`${UI.fmtDate(m.date)} ${m.time} (${t.name}) : ${e.message.replace(/ Choisis.*$/, '')}`); }
            }
            b.done();
          }
          modal({ title: 'Matchs importés', noFocus: true, body: `<p class="lead">✓ ${res.added} ajouté${res.added > 1 ? 's' : ''}, ${res.updated} mis à jour.</p>
            ${res.noTeam ? `<p class="tip">${res.noTeam} match${res.noTeam > 1 ? 's' : ''} ignoré${res.noTeam > 1 ? 's' : ''} : catégorie introuvable. Choisis la catégorie à la main et recommence.</p>` : ''}
            ${toBook.length ? `<p>Terrain réservé pour ${booked} match${booked > 1 ? 's' : ''} à domicile.</p>${clash.length ? `<ul class="help-list">${clash.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}` : ''}`,
            actions: [{ label: 'OK', kind: 'primary' }] });
          done && done();
        })();
      } }] });
  }

  /* ---------- sessions from calendar files ---------- */
  async function trainingsFromICS(done) {
    const [f] = await UI.pickFiles(); if (!f) return;
    const evs = parseICS(await f.text());
    if (!evs.length) return toast('Aucun événement dans ce fichier', 'err');
    const team = Store.get('teams', S().ui.teamId) || null; let n = 0;
    evs.forEach(ev => {
      if (S().trainings.some(t => t.date === ev.date && t.title === ev.title)) return;
      Store.upsert('trainings', { id: Store.uid(), title: ev.title || 'Entraînement', date: ev.date, time: ev.time, teamId: team ? team.id : null, goal: ev.desc || '', exercises: [], presents: [] }); n++;
    });
    toast(`${n} séance${n > 1 ? 's' : ''} importée${n > 1 ? 's' : ''}`); done && done();
  }

  /* ---------- AssistCoachAI session sheet (PDF) ---------- */
  // Recognises the sections of an AssistCoachAI sheet: title + duration, ORG., CONSIGNES, ÉVOLUTIONS, MATÉRIEL
  function isAssistCoach(pages) { return pages.some(p => /ASSISTCOACHAI|ASSIST COACH/i.test(p.text || '')); }
  function parseAssistPage(text) {
    const t = String(text || '').replace(/ +/g, ' ');
    if (!/ORG\.|CONSIGNES/i.test(t)) return null;
    const lines = t.split('\n').map(l => l.trim()).filter(Boolean);
    // Title = the lines before "DURÉE" (or before the first "30min" line), without the number and the section word
    let end = lines.findIndex(l => /^DUR[ÉE]E$/i.test(l) || /^\d+\s*min$/i.test(l)); if (end < 0) end = Math.min(4, lines.length);
    const head = lines.slice(0, end);
    const title = head.filter(l => !/^\d+$/.test(l) && !/^(ATELIER|JEU|[ÉE]CHAUFFEMENT|EXERCICE)$/i.test(l)).map(l => l.replace(/\s*\d+\s*min\s*$/i, '')).join(' ').replace(/\s+/g, ' ').trim();
    const dur = ((head.join(' ') + ' ' + (lines[end + 1] || '') + ' ' + (lines[end] || '')).match(/(\d+)\s*min/i) || [])[1];
    const sec = (a, b) => { const m = t.match(new RegExp('(?:' + a + ')([\\s\\S]*?)(?:' + b + '|$)', 'i')); return m && m[1] ? m[1].trim() : ''; };
    const org = sec('ORG\\.', 'CONSIGNES');
    const cons = sec('CONSIGNES', 'ÉVOLUTIONS|EVOLUTIONS|MATÉRIEL|MATERIEL');
    const evo = sec('ÉVOLUTIONS|EVOLUTIONS', 'MATÉRIEL|MATERIEL');
    const mat = sec('MATÉRIEL|MATERIEL', 'ASSISTCOACHAI|$').replace(/--.*$/s, '').trim();
    const consList = cons.split(/\n(?=\d+\s)/).map(c => c.replace(/^\d+\s*/, '').replace(/\n/g, ' ').trim()).filter(Boolean);
    const evoList = evo.split(/\n?\+\s+/).map(e => e.replace(/\n/g, ' ').trim()).filter(Boolean);
    return { title: title.slice(0, 120) || 'Exercice', duration: dur ? +dur : 15, org: org.replace(/\n/g, ' ').slice(0, 1500) + (evoList.length ? '\n\nÉvolutions :\n' + evoList.map(e => '+ ' + e).join('\n') : ''), consignes: consList.join('\n'), materiel: mat.replace(/\n/g, ' ') };
  }

  return { applyFound, parseFFF, parseICS, parseCSV, guessTeam, reassignImported, refileImported, teamNo, levelOf, districtNo, letterNo, matchesDialog, trainingsFromICS, isAssistCoach, parseAssistPage };
})();
