/* Imports: the club's players, dirigeants and matches from any document — a photo or a screenshot (text recognition),
   a PDF (its text, or text recognition when it is a scan), Excel / ODS / CSV, or a pasted text.
   The document becomes a table; each column is recognised (nom, prénom, date de naissance, licence… or date, adversaire, score…);
   the table can be corrected cell by cell before the import, which never makes a second card for the same person or match. */
const Imports = (() => {
  const { esc, $, $$, toast, modal } = UI;
  const S = () => Store.state;
  const XLSX_URL = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
  const TESS_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  const loadScript = (src, ok) => ok() ? Promise.resolve() : new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.onload = res;
    s.onerror = () => rej(new Error('Lecture impossible : la première fois, il faut être connecté à internet.')); document.head.appendChild(s);
  });
  const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
  const cap = s => String(s || '').toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());

  /* ================= a document → a table (rows of cells) ================= */
  // words with their position → lines (same height) → cells (a wide gap between two words starts a new cell)
  function wordsToRows(words) {
    const ws = words.filter(w => String(w.t).trim()).map(w => Object.assign({}, w, { yc: (w.y0 + w.y1) / 2, h: Math.max(1, w.y1 - w.y0) }));
    if (!ws.length) return [];
    const hMed = ws.map(w => w.h).sort((a, b) => a - b)[Math.floor(ws.length / 2)];
    ws.sort((a, b) => a.yc - b.yc || a.x0 - b.x0);
    const lines = [];
    ws.forEach(w => { const l = lines[lines.length - 1]; if (l && Math.abs(l.yc - w.yc) < hMed * .6) { l.ws.push(w); l.yc = (l.yc * (l.ws.length - 1) + w.yc) / l.ws.length; } else lines.push({ yc: w.yc, ws: [w] }); });
    return lines.map(l => {
      const row = [], sorted = l.ws.sort((a, b) => a.x0 - b.x0);
      sorted.forEach((w, i) => { const gap = i ? w.x0 - sorted[i - 1].x1 : 0; if (!i || gap > hMed * 1.2) row.push(w.t); else row[row.length - 1] += ' ' + w.t; });
      return row.map(c => c.trim());
    });
  }
  // a pasted or plain text: cells split by tabs, « ; », « | » or 2 spaces or more
  function textToRows(txt) {
    const lines = String(txt || '').replace(/\r/g, '').split('\n').filter(l => l.trim());
    const sep = lines.some(l => l.includes('\t')) ? /\t/ : lines.filter(l => l.includes(';')).length > lines.length / 2 ? /;/ : lines.some(l => l.includes('|')) ? /\|/ : /\s{2,}/;
    return lines.map(l => l.split(sep).map(c => c.replace(/^"|"$/g, '').trim()));
  }
  async function fromSheet(file) {
    if (/\.(csv|txt|tsv)$/i.test(file.name)) return textToRows(await file.text());
    await loadScript(XLSX_URL, () => window.XLSX);
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    // the biggest sheet of the file
    const sheets = wb.SheetNames.map(n => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '', dateNF: 'dd/mm/yyyy' }).filter(r => r.some(c => String(c).trim())));
    return sheets.sort((a, b) => b.length - a.length)[0] || [];
  }
  let tessWorker = null;
  async function ocr(img, progress) {
    await loadScript(TESS_URL, () => window.Tesseract);
    if (!tessWorker) tessWorker = await Tesseract.createWorker('fra', 1, { logger: m => { if (m.status === 'recognizing text' && progress) progress(m.progress); } });
    const { data } = await tessWorker.recognize(img);
    return (data.words || []).map(w => ({ t: w.text, x0: w.bbox.x0, x1: w.bbox.x1, y0: w.bbox.y0, y1: w.bbox.y1 }));
  }
  // a photo is made bigger (small text) and never more than 2600 px wide, in grey with more contrast: better recognition
  async function prepImage(file) {
    const url = URL.createObjectURL(file), im = new Image(); im.src = url; await im.decode();
    const k = Math.min(2600 / im.naturalWidth, Math.max(1, 1600 / im.naturalWidth));
    const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
    const g = c.getContext('2d'); g.filter = 'grayscale(1) contrast(1.35)'; g.drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
    return c;
  }
  async function fromImage(file, progress) { return wordsToRows(await ocr(await prepImage(file), progress)); }
  async function fromPdf(file, progress) {
    const pdfjs = await Library.pdfjs(), doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise, rows = [];
    for (let p = 1; p <= Math.min(doc.numPages, 30); p++) {
      const page = await doc.getPage(p), tc = await page.getTextContent(), vp = page.getViewport({ scale: 1 });
      let words = tc.items.filter(it => it.str && it.str.trim()).map(it => { const x = it.transform[4], y = vp.height - it.transform[5], h = Math.hypot(it.transform[2], it.transform[3]) || 10;
        return { t: it.str.trim(), x0: x, x1: x + (it.width || it.str.length * h * .5), y0: y - h, y1: y }; });
      if (words.map(w => w.t).join('').length < 20) { // a scanned page: its picture goes through text recognition
        const v2 = page.getViewport({ scale: 2.2 }), c = document.createElement('canvas'); c.width = v2.width; c.height = v2.height;
        await page.render({ canvasContext: c.getContext('2d'), viewport: v2 }).promise;
        words = await ocr(c, x => progress && progress((p - 1 + x) / doc.numPages));
      }
      rows.push(...wordsToRows(words)); progress && progress(p / doc.numPages);
    }
    return rows;
  }
  async function read(file, progress) {
    if (/^image\//.test(file.type) || /\.(jpe?g|png|webp|heic|gif|bmp)$/i.test(file.name)) return fromImage(file, progress);
    if (/pdf/.test(file.type) || /\.pdf$/i.test(file.name)) return fromPdf(file, progress);
    if (/\.(xlsx|xlsm|xls|ods|csv|tsv|txt)$/i.test(file.name) || /sheet|excel|csv|text/.test(file.type)) return fromSheet(file);
    throw new Error('Format non reconnu : photo, capture d\'écran, PDF, Excel, CSV ou texte.');
  }

  /* ================= what each column is ================= */
  const FIELDS = {
    players: [['lastName', 'Nom'], ['firstName', 'Prénom'], ['fullName', 'Nom et prénom'], ['birth', 'Date de naissance'], ['licence', 'N° de licence'], ['cat', 'Catégorie'],
      ['pos', 'Poste'], ['number', 'Numéro'], ['phone', 'Téléphone'], ['email', 'E-mail'], ['parent', 'Parent (nom)'], ['parentPhone', 'Téléphone parent'], ['', '— (ignorer)']],
    staff: [['lastName', 'Nom'], ['firstName', 'Prénom'], ['fullName', 'Nom et prénom'], ['role', 'Fonction'], ['cat', 'Catégorie(s)'], ['phone', 'Téléphone'], ['email', 'E-mail'], ['', '— (ignorer)']],
    matches: [['date', 'Date'], ['time', 'Heure'], ['homeTeam', 'Équipe à domicile'], ['awayTeam', 'Équipe à l\'extérieur'], ['opponent', 'Adversaire'], ['venue', 'Domicile / extérieur'],
      ['score', 'Score'], ['gf', 'Nos buts'], ['ga', 'Buts adverses'], ['competition', 'Compétition'], ['cat', 'Catégorie / équipe'], ['place', 'Lieu'], ['', '— (ignorer)']],
  };
  const HEAD = [
    [/^(NOM ET PRENOM|NOM PRENOM|PRENOM NOM|JOUEUR|JOUEUSE|LICENCIE|IDENTITE|NOM COMPLET)$/, 'fullName'], [/^(NOM|NOM DE FAMILLE|NOM USAGE)$/, 'lastName'], [/^PRENOM/, 'firstName'],
    [/NAISSANCE|^NE\(E\)|^NE LE|^DATE NAIS|^DDN$/, 'birth'], [/LICENCE|^N° ?LIC|^NUMERO LIC/, 'licence'], [/CATEG|^CAT\.?$|SOUS.?CAT|^EQUIPE$/, 'cat'],
    [/^POSTE/, 'pos'], [/^(N°|NUM|NUMERO|MAILLOT|DOSSARD)$/, 'number'], [/PARENT|RESPONSABLE LEGAL|REPRESENTANT/, 'parent'], [/TEL|PORTABLE|MOBILE|PHONE/, 'phone'], [/MAIL/, 'email'],
    [/FONCTION|ROLE|QUALITE/, 'role'], [/^DATE$|^JOUR$|DATE DU MATCH/, 'date'], [/^HEURE|HORAIRE|COUP D.ENVOI/, 'time'], [/^(DOMICILE|RECEVANT|LOCAUX|EQUIPE 1|EQUIPE A DOMICILE)$/, 'homeTeam'],
    [/^(EXTERIEUR|VISITEUR|VISITEURS|EQUIPE 2|EQUIPE A L.EXTERIEUR)$/, 'awayTeam'], [/ADVERSAIRE|CONTRE/, 'opponent'], [/^(DOM|EXT|DOM\.?\/EXT\.?|LIEU DU MATCH|D\/E)$/, 'venue'],
    [/^SCORE|RESULTAT/, 'score'], [/COMPETITION|CHAMPIONNAT|^TYPE$/, 'competition'], [/^(LIEU|STADE|TERRAIN|ADRESSE)$/, 'place'],
  ];
  const RE = { date: /^(\d{1,2})[\/.\- ](\d{1,2})[\/.\- ](\d{2}|\d{4})$|^(\d{4})-(\d{2})-(\d{2})/, licence: /^\d[\d ]{8,12}\d$/, time: /^\d{1,2}\s?[h:]\s?\d{0,2}$/i, score: /^\d{1,2}\s?[-–:]\s?\d{1,2}$/,
    phone: /^(\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}$/, email: /@.+\./, venue: /^(D|E|DOM|EXT|DOMICILE|EXTERIEUR)\.?$/i };
  function headerIndex(rows) {
    for (let i = 0; i < Math.min(rows.length, 6); i++) if (rows[i].filter(c => HEAD.some(([re]) => re.test(norm(c)))).length >= 2) return i;
    return -1;
  }
  function guess(rows, kind) {
    const hi = headerIndex(rows), n = Math.max(0, ...rows.map(r => r.length)), body = rows.slice(hi + 1, hi + 40), map = [];
    const allowed = new Set(FIELDS[kind].map(f => f[0]));
    for (let c = 0; c < n; c++) {
      let f = '';
      if (hi >= 0) { const h = norm(rows[hi][c]); const m = HEAD.find(([re, k]) => re.test(h) && allowed.has(k)); if (m) f = m[1]; }
      if (!f) {
        const vals = body.map(r => String(r[c] || '').trim()).filter(Boolean), share = re => vals.length && vals.filter(v => re.test(norm(v))).length / vals.length > .6;
        if (share(RE.date)) f = kind === 'matches' ? 'date' : 'birth';
        else if (share(RE.licence) && kind === 'players') f = 'licence';
        else if (share(RE.time) && kind === 'matches') f = 'time';
        else if (share(RE.score) && kind === 'matches') f = 'score';
        else if (share(RE.phone)) f = 'phone';
        else if (vals.length && vals.filter(v => RE.email.test(v)).length / vals.length > .6) f = 'email';
        else if (share(RE.venue) && kind === 'matches') f = 'venue';
        else if (vals.length && kind !== 'matches' && vals.every(v => /^[A-ZÀ-Ý' -]+$/.test(v) && v.length > 1)) f = 'lastName';
        else if (vals.length && kind !== 'matches' && vals.every(v => /^[A-ZÀ-Ý][a-zà-ÿ'-]+( [A-ZÀ-Ý][a-zà-ÿ'-]+)?$/.test(v))) f = 'firstName';
        else if (vals.length && kind !== 'matches' && vals.every(v => /^[A-ZÀ-Ý' -]{2,} [A-ZÀ-Ý][a-zà-ÿ]/.test(v))) f = 'fullName';
      }
      if (f && map.includes(f) && !['', 'phone'].includes(f)) f = '';
      map.push(f);
    }
    // two team columns and no opponent: « domicile » then « extérieur »
    if (kind === 'matches' && !map.includes('opponent') && !map.includes('homeTeam')) {
      const free = map.map((f, i) => [f, i]).filter(([f, i]) => !f && body.filter(r => String(r[i] || '').trim().length > 2 && !/^\d/.test(String(r[i]))).length > body.length / 2).map(x => x[1]);
      if (free.length >= 2) { map[free[0]] = 'homeTeam'; map[free[1]] = 'awayTeam'; } else if (free.length === 1) map[free[0]] = 'opponent';
    }
    return { head: hi >= 0, map, rows: rows.slice(hi + 1).filter(r => r.some(c => String(c).trim())) };
  }

  /* ================= values ================= */
  const MON = { JAN: 1, JANV: 1, FEV: 2, FEVR: 2, MAR: 3, MARS: 3, AVR: 4, AVRIL: 4, MAI: 5, JUIN: 6, JUIL: 7, JUILLET: 7, AOUT: 8, SEP: 9, SEPT: 9, OCT: 10, NOV: 11, DEC: 12 };
  function date(v, birth) {
    if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
    const s = norm(v).replace(/\s+/g, ' '), p2 = n => String(n).padStart(2, '0');
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/(\d{1,2})[\/.\- ](\d{1,2})[\/.\- ](\d{2,4})/);
    if (m) { let y = +m[3]; if (y < 100) y += birth ? (y > (new Date().getFullYear() % 100) ? 1900 : 2000) : 2000; return `${y}-${p2(m[2])}-${p2(m[1])}`; }
    m = s.match(/(\d{1,2})(?:ER)? ([A-Z]{3,9})\.? (\d{4})/); if (m && MON[m[2].replace(/\.$/, '')]) return `${m[3]}-${p2(MON[m[2]])}-${p2(m[1])}`;
    if (/^\d{5}$/.test(s)) { const d = new Date(Date.UTC(1899, 11, 30) + +s * 864e5); return d.toISOString().slice(0, 10); } // Excel serial date
    return '';
  }
  const time = v => { const m = norm(v).match(/(\d{1,2})\s?[H:]\s?(\d{2})?/); return m ? `${m[1].padStart(2, '0')}:${m[2] || '00'}` : ''; };
  const digits = v => String(v || '').replace(/\D/g, '');
  const phone = v => { const d = digits(v).replace(/^33/, '0'); return d.length === 10 ? d.replace(/(\d{2})(?=\d)/g, '$1 ') : String(v || '').trim(); };
  // « DUPONT Lucas », « Lucas DUPONT », « Dupont Lucas »: the words in capitals are the name
  function splitName(v) {
    const w = String(v || '').trim().split(/\s+/).filter(Boolean); if (!w.length) return ['', ''];
    const up = w.filter(x => x.length > 1 && x === x.toUpperCase() && /[A-ZÀ-Ý]/.test(x));
    if (up.length && up.length < w.length) return [up.join(' '), w.filter(x => !up.includes(x)).join(' ')];
    return [w[0], w.slice(1).join(' ')]; // « Dupont Lucas »: the name first, as in most club lists
  }
  const POS = [[/GARD|^GB$|^G$/, 'GB'], [/DEF|ARRI|LATER|CENTRAL|^DC$|^DD$|^DG$/, 'DEF'], [/MIL|^MC$|^MDC$|^MOC$/, 'MIL'], [/ATT|AVANT|AILI|BUT|POINTE|^BU$/, 'ATT']];

  /* ================= the club's own records: the same person / match is found again ================= */
  const key = (a, b) => norm(a).replace(/[^A-Z]/g, '') + '|' + norm(b).replace(/[^A-Z]/g, '');
  const clubWord = () => { const w = norm(S().club.fffName || S().club.name || '').split(/[^A-Z0-9]+/).filter(x => x.length > 2 && !/^(CLUB|FOOTBALL|FOOT|SPORTING|ASSOCIATION|OLYMPIQUE|UNION|ENTENTE|STADE|ETOILE)$/.test(x)).sort((a, b) => b.length - a.length); return w[0] || ''; };
  const isUs = s => { const w = clubWord(); return !!w && norm(s).includes(w); };
  function teamByName(v) {
    const n = norm(v).replace(/\s+/g, ''); if (!n) return null;
    return S().teams.find(t => norm(t.name).replace(/\s+/g, '') === n) || S().teams.find(t => n.includes(norm(t.name).replace(/\s+/g, '')) && t.name.length > 2) || null;
  }
  function record(kind, r, map, opts) {
    const get = f => { const i = map.indexOf(f); return i < 0 ? '' : String(r[i] == null ? '' : r[i]).trim(); };
    if (kind === 'players' || kind === 'staff') {
      let ln = get('lastName'), fn = get('firstName');
      if (!ln && !fn && get('fullName')) [ln, fn] = splitName(get('fullName'));
      if (!ln && !fn) return null;
      const o = { lastName: ln.toUpperCase(), firstName: cap(fn), phone: phone(get('phone')), email: get('email').toLowerCase() };
      if (kind === 'staff') return Object.assign(o, { role: get('role'), cat: get('cat') });
      const pos = norm(get('pos')), pm = POS.find(([re]) => re.test(pos));
      return Object.assign(o, { birth: date(get('birth'), true), licence: digits(get('licence')) ? get('licence').replace(/\s+/g, ' ') : '', cat: get('cat'),
        pos: pm ? pm[1] : '', number: digits(get('number')).slice(0, 2), parent: get('parent'), parentPhone: phone(get('parentPhone')) });
    }
    const d = date(get('date')); if (!d) return null;
    let opp = get('opponent'), home = null;
    const ht = get('homeTeam'), at = get('awayTeam');
    if (ht || at) { if (isUs(ht) && !isUs(at)) { home = true; opp = opp || at; } else if (isUs(at) && !isUs(ht)) { home = false; opp = opp || ht; } else { home = true; opp = opp || at || ht; } }
    const v = norm(get('venue')); if (v) home = /^D|DOM/.test(v);
    if (home == null) home = true;
    let gf = get('gf'), ga = get('ga'); const sc = get('score').match(/(\d+)\s*[-–:]\s*(\d+)/);
    if (sc && gf === '' && ga === '') { const a = +sc[1], b = +sc[2]; if (ht || at) { gf = home ? a : b; ga = home ? b : a; } else { gf = a; ga = b; } }
    const team = teamByName(get('cat')) || Store.get('teams', opts.teamId);
    return { date: d, time: time(get('time')), opponent: opp.replace(/\s+/g, ' ').trim() || 'Adversaire', home, gf: gf === '' ? null : +gf, ga: ga === '' ? null : +ga,
      competition: get('competition'), place: get('place'), teamId: team ? team.id : null };
  }
  function plan(kind, recs, opts) {
    return recs.map(x => {
      if (kind === 'matches') {
        const ex = S().matches.find(m => m.date === x.date && m.teamId === x.teamId && (norm(m.opponent).slice(0, 5) === norm(x.opponent).slice(0, 5) || !m.opponent));
        return { x, ex };
      }
      const list = kind === 'staff' ? S().staff : S().players;
      const ex = (x.licence && list.find(p => digits(p.licence) === digits(x.licence))) || list.find(p => key(p.lastName, p.firstName) === key(x.lastName, x.firstName) && (!x.birth || !p.birth || p.birth === x.birth));
      return { x, ex };
    });
  }
  const fillEmpty = (to, from, keys) => keys.forEach(k => { if ((to[k] == null || to[k] === '') && from[k] != null && from[k] !== '') to[k] = from[k]; });
  function apply(kind, items, opts) {
    let added = 0, updated = 0;
    items.forEach(({ x, ex }) => {
      if (kind === 'matches') {
        if (!x.teamId) return;
        const played = x.gf != null && x.ga != null;
        if (ex) { fillEmpty(ex, x, ['time', 'competition', 'place']); if (played) Object.assign(ex, { gf: x.gf, ga: x.ga, played: true }); Store.upsert('matches', ex); updated++; }
        else { Store.upsert('matches', { id: Store.uid(), teamId: x.teamId, date: x.date, time: x.time, opponent: x.opponent, home: x.home, competition: x.competition || 'Championnat', place: x.place,
          played, gf: played ? x.gf : 0, ga: played ? x.ga : 0, convoked: [], stats: {}, notes: '' }); added++; }
        return;
      }
      if (kind === 'staff') {
        const tids = String(x.cat || '').split(/[,;/]+/).map(teamByName).filter(Boolean).map(t => t.id);
        if (ex) { fillEmpty(ex, x, ['phone', 'email', 'role']); ex.teamIds = [...new Set([...(ex.teamIds || []), ...tids, ...(opts.teamId ? [opts.teamId] : [])])]; Store.upsert('staff', ex); updated++; }
        else { Store.upsert('staff', { id: Store.uid(), lastName: x.lastName, firstName: x.firstName, role: x.role || 'Éducateur', phone: x.phone, email: x.email, notes: '', teamIds: [...new Set([...tids, ...(opts.teamId ? [opts.teamId] : [])])] }); added++; }
        return;
      }
      // players: the chosen category, or the one of the document, or the one of the year of birth
      const t = (opts.teamId && Store.get('teams', opts.teamId)) || teamByName(x.cat) || (x.birth && People.catOf(x) ? People.ageTeam(People.catOf(x)) : null);
      const parents = x.parent || x.parentPhone ? [{ name: x.parent, rel: 'Parent', phone: x.parentPhone }] : [];
      if (ex) {
        fillEmpty(ex, x, ['birth', 'licence', 'phone', 'email', 'pos', 'number']);
        if (!(ex.parents || []).length && parents.length) ex.parents = parents;
        if (t) ex.teamIds = [...new Set([...(ex.teamIds || []), t.id])];
        Store.upsert('players', ex); updated++;
      } else {
        Store.upsert('players', { id: Store.uid(), lastName: x.lastName, firstName: x.firstName, birth: x.birth, licence: x.licence, number: x.number, pos: x.pos, phone: x.phone, email: x.email,
          parents, notes: '', subcat: '', teamIds: t ? [t.id] : [] }); added++;
      }
    });
    Store.sortTeams(); Store.save();
    return { added, updated };
  }

  /* ================= the wizard ================= */
  const KINDS = [['players', '👥 Joueurs (licenciés)'], ['matches', '⚽ Matchs (calendrier, résultats)'], ['staff', '🧢 Dirigeants et éducateurs']];
  function open(kind = 'players', done) {
    const teamOpts = sel => `<option value="">${kind === 'matches' ? 'Selon le document (colonne catégorie)' : 'Automatique (année de naissance)'}</option>` + Store.teamGroups(S().teams).flat().map(t => `<option value="${t.id}" ${t.id === sel ? 'selected' : ''}>${esc(Store.teamLabel(t))}</option>`).join('');
    const close = modal({ title: 'Importer des données', noFocus: true,
      body: `<div class="chips imp-kinds">${KINDS.map(([k, l]) => `<button class="chip ${k === kind ? 'on' : ''}" data-ik="${k}">${l}</button>`).join('')}</div>
        <p class="muted small">Une <b>photo</b> ou une <b>capture d'écran</b> d'une liste, un <b>PDF</b> (Footclubs, calendrier du district…), un fichier <b>Excel / CSV</b>, ou un texte copié. Tu vérifies et corriges le tableau avant d'importer : rien n'est créé en double.</p>
        <div class="imp-src">
          <label class="btn primary">📷<span>Prendre une photo</span><input type="file" accept="image/*" capture="environment" data-if hidden></label>
          <label class="btn">🖼️<span>Image / capture d'écran</span><input type="file" accept="image/*" data-if hidden multiple></label>
          <label class="btn">📄<span>PDF</span><input type="file" accept="application/pdf,.pdf" data-if hidden></label>
          <label class="btn">📊<span>Excel / CSV</span><input type="file" accept=".xlsx,.xls,.xlsm,.ods,.csv,.tsv,.txt" data-if hidden></label>
          <button class="btn" data-ipaste>📋<span>Coller un texte</span></button></div>
        <textarea id="impPaste" rows="6" hidden placeholder="Colle ici la liste (une ligne par joueur ou par match)"></textarea>
        <button class="btn" id="impPasteGo" hidden>Lire le texte</button>
        <div id="impProg" class="imp-prog" hidden><div class="bar"><i></i></div><p class="muted small" id="impProgT">Lecture…</p></div>
        <div id="impOut"></div>`,
      onOpen: r => {
        let rows = [], g = null;
        const out = $('#impOut', r), prog = $('#impProg', r), progT = $('#impProgT', r);
        const setProg = (p, t) => { prog.hidden = false; $('.bar i', prog).style.width = Math.round(p * 100) + '%'; if (t) progT.textContent = t; };
        $$('[data-ik]', r).forEach(b => b.onclick = () => { kind = b.dataset.ik; $$('[data-ik]', r).forEach(x => x.classList.toggle('on', x === b)); if (rows.length) show(); });
        $('[data-ipaste]', r).onclick = () => { $('#impPaste', r).hidden = false; $('#impPasteGo', r).hidden = false; $('#impPaste', r).focus(); };
        $('#impPasteGo', r).onclick = () => { rows = textToRows($('#impPaste', r).value); show(); };
        $$('[data-if]', r).forEach(inp => inp.onchange = async () => {
          const files = [...inp.files]; inp.value = ''; if (!files.length) return;
          out.innerHTML = ''; rows = [];
          try {
            for (const [i, f] of files.entries()) {
              setProg(0, /pdf/i.test(f.type + f.name) ? 'Lecture du PDF…' : /image/.test(f.type) ? 'Lecture de l\'image (reconnaissance du texte)… la première fois, cela peut prendre une minute.' : 'Lecture du fichier…');
              rows.push(...await read(f, p => setProg((i + p) / files.length)));
            }
            prog.hidden = true;
            if (!rows.length) return toast('Aucun texte trouvé dans ce document', 'err');
            show();
          } catch (e) { prog.hidden = true; toast(e.message || 'Lecture impossible', 'err'); }
        });
        function show() {
          g = guess(rows, kind);
          const n = Math.max(1, ...g.rows.map(x => x.length)), fields = FIELDS[kind];
          const sel = c => `<select data-col="${c}">${fields.map(([k, l]) => `<option value="${k}" ${g.map[c] === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
          out.innerHTML = `<h3>${g.rows.length} ligne${g.rows.length > 1 ? 's' : ''} trouvée${g.rows.length > 1 ? 's' : ''}</h3>
            <p class="muted small">Vérifie ce que contient chaque colonne (menu en haut), corrige une case en touchant dessus, retire une ligne avec ✕.</p>
            <label class="fld"><span>${kind === 'matches' ? 'Catégorie des matchs' : kind === 'staff' ? 'Ajouter aussi à la catégorie' : 'Catégorie des joueurs'}</span><select id="impTeam">${teamOpts(opts.teamId)}</select></label>
            <div class="imp-table-wrap"><table class="imp-table"><thead><tr><th></th>${Array.from({ length: n }, (_, c) => `<th>${sel(c)}</th>`).join('')}</tr></thead>
            <tbody>${g.rows.map((row, i) => `<tr data-r="${i}"><td><button class="icon-btn small" data-rm="${i}" aria-label="Retirer la ligne">✕</button></td>${Array.from({ length: n }, (_, c) => `<td contenteditable="true" data-c="${c}">${esc(row[c] == null ? '' : row[c])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
            <div id="impSum" class="imp-sum"></div>
            <button class="btn primary wide" id="impGo">Importer</button>`;
          const opts2 = () => ({ teamId: $('#impTeam', out).value });
          const cells = () => [...$$('tbody tr', out)].map(tr => [...tr.querySelectorAll('td[data-c]')].map(td => td.textContent.trim()));
          const summary = () => {
            const recs = cells().map(x => record(kind, x, g.map, opts2())).filter(Boolean), p = plan(kind, recs, opts2());
            const nn = p.filter(x => !x.ex).length, up = p.length - nn, noTeam = kind === 'matches' ? p.filter(x => !x.x.teamId).length : 0;
            $('#impSum', out).innerHTML = `<b>${nn}</b> nouveau${nn > 1 ? 'x' : ''} · <b>${up}</b> déjà dans l'appli (complété${up > 1 ? 's' : ''})${noTeam ? ` · <span class="res res-D">${noTeam} sans catégorie : choisis-la au-dessus</span>` : ''}${recs.length < cells().length ? ` · ${cells().length - recs.length} ligne(s) ignorée(s) (${kind === 'matches' ? 'sans date' : 'sans nom'})` : ''}`;
            return p;
          };
          $$('[data-col]', out).forEach(s => s.onchange = () => { g.map[+s.dataset.col] = s.value; summary(); });
          $('#impTeam', out).onchange = summary;
          out.oninput = () => summary();
          out.onclick = e => { const b = e.target.closest('[data-rm]'); if (b) { b.closest('tr').remove(); summary(); } };
          $('#impGo', out).onclick = () => {
            const p = summary(); if (!p.length) return toast('Rien à importer', 'err');
            if (kind === 'matches' && p.some(x => !x.x.teamId)) return toast('Choisis la catégorie des matchs', 'err');
            const res = apply(kind, p, opts2());
            toast(`${res.added} ajouté${res.added > 1 ? 's' : ''}, ${res.updated} complété${res.updated > 1 ? 's' : ''} ✓`);
            close(); done && done(res); App.route(true);
          };
          summary();
        }
        const opts = { teamId: '' };
      } });
  }
  return { open, read, guess, record, textToRows, wordsToRows, date, splitName };
})();
