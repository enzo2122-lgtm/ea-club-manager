/* Clubs: each dirigeant can choose his favourite club; its crest is shown before his name in the messaging.
   The crest image comes from Wikipedia (the club's article picture), loaded by the device itself and remembered;
   until it arrives, or without internet, a small shield in the club's colours with its initials is shown. */
const Clubs = (() => {
  // key: [name, Wikipedia (en) article, colour 1, colour 2, initials, pattern]
  const LIST = {
    psg: ['Paris Saint-Germain', 'Paris Saint-Germain FC', '#004170', '#da291c', 'PSG', 'band'],
    om: ['Olympique de Marseille', 'Olympique de Marseille', '#2faee0', '#ffffff', 'OM', 'plain'],
    ol: ['Olympique lyonnais', 'Olympique Lyonnais', '#1d428a', '#da291c', 'OL', 'plain'],
    asm: ['AS Monaco', 'AS Monaco FC', '#e51b22', '#ffffff', 'ASM', 'halves'],
    losc: ['Lille OSC', 'Lille OSC', '#e01e13', '#20325f', 'LOSC', 'plain'],
    rcl: ['RC Lens', 'RC Lens', '#ffd400', '#e30613', 'RCL', 'halves'],
    srfc: ['Stade rennais', 'Stade Rennais FC', '#e13327', '#000000', 'SRFC', 'halves'],
    ogcn: ['OGC Nice', 'OGC Nice', '#c8102e', '#000000', 'OGCN', 'stripes'],
    fcn: ['FC Nantes', 'FC Nantes', '#fcd405', '#00843d', 'FCN', 'plain'],
    asse: ['AS Saint-Étienne', 'AS Saint-Étienne', '#00a650', '#ffffff', 'ASSE', 'plain'],
    real: ['Real Madrid', 'Real Madrid CF', '#ffffff', '#febe10', 'RM', 'plain'],
    barca: ['FC Barcelone', 'FC Barcelona', '#a50044', '#004d98', 'FCB', 'stripes'],
    atm: ['Atlético de Madrid', 'Atlético Madrid', '#cb3524', '#ffffff', 'ATM', 'stripes'],
    milan: ['AC Milan', 'AC Milan', '#fb090b', '#000000', 'ACM', 'stripes'],
    inter: ['Inter Milan', 'Inter Milan', '#010e80', '#000000', 'INT', 'stripes'],
    juve: ['Juventus', 'Juventus FC', '#000000', '#ffffff', 'JUV', 'stripes'],
    napoli: ['SSC Naples', 'SSC Napoli', '#12a0d7', '#ffffff', 'NAP', 'plain'],
    roma: ['AS Rome', 'AS Roma', '#8e1f2f', '#f0bc42', 'ASR', 'plain'],
    liverpool: ['Liverpool', 'Liverpool F.C.', '#c8102e', '#ffffff', 'LFC', 'plain'],
    manu: ['Manchester United', 'Manchester United F.C.', '#da291c', '#000000', 'MU', 'plain'],
    mancity: ['Manchester City', 'Manchester City F.C.', '#6cabdd', '#ffffff', 'MC', 'plain'],
    arsenal: ['Arsenal', 'Arsenal F.C.', '#ef0107', '#ffffff', 'AFC', 'plain'],
    chelsea: ['Chelsea', 'Chelsea F.C.', '#034694', '#ffffff', 'CFC', 'plain'],
    bayern: ['Bayern Munich', 'FC Bayern Munich', '#dc052d', '#0066b2', 'FCB', 'plain'],
    bvb: ['Borussia Dortmund', 'Borussia Dortmund', '#fde100', '#000000', 'BVB', 'plain'],
    porto: ['FC Porto', 'FC Porto', '#003893', '#ffffff', 'FCP', 'stripes'],
    benfica: ['Benfica', 'S.L. Benfica', '#e20e0e', '#ffffff', 'SLB', 'plain'],
    sporting: ['Sporting CP', 'Sporting CP', '#008057', '#ffffff', 'SCP', 'hoops'],
    ajax: ['Ajax Amsterdam', 'AFC Ajax', '#d2122e', '#ffffff', 'AJAX', 'band'],
    gala: ['Galatasaray', 'Galatasaray S.K. (football)', '#a90432', '#fdb912', 'GS', 'halves'],
    raja: ['Raja Casablanca', 'Raja CA', '#00843d', '#ffffff', 'RCA', 'plain'],
    wydad: ['Wydad Casablanca', 'Wydad AC', '#d71920', '#ffffff', 'WAC', 'plain'],
    est: ['Espérance de Tunis', 'Espérance Sportive de Tunis', '#c8102e', '#f5c400', 'EST', 'stripes'],
    jsk: ['JS Kabylie', 'JS Kabylie', '#ffd100', '#00843d', 'JSK', 'halves'],
    mca: ['MC Alger', 'MC Alger', '#d71920', '#00843d', 'MCA', 'halves'],
    crb: ['CR Belouizdad', 'CR Belouizdad', '#d71920', '#ffffff', 'CRB', 'plain'],
    boca: ['Boca Juniors', 'Boca Juniors', '#003087', '#ffd100', 'CABJ', 'band'],
    flamengo: ['Flamengo', 'CR Flamengo', '#c8102e', '#000000', 'CRF', 'hoops'],
    // (3.20) more clubs from the 5 big European leagues
    rcsa: ['RC Strasbourg', 'RC Strasbourg Alsace', '#009fe3', '#ffffff', 'RCSA', 'plain'],
    tfc: ['Toulouse FC', 'Toulouse FC', '#5b2c84', '#ffffff', 'TFC', 'plain'],
    brest: ['Stade brestois', 'Stade Brestois 29', '#e30613', '#ffffff', 'SB29', 'plain'],
    angers: ['Angers SCO', 'Angers SCO', '#000000', '#ffffff', 'SCO', 'stripes'],
    aja: ['AJ Auxerre', 'AJ Auxerre', '#0055a4', '#ffffff', 'AJA', 'plain'],
    hac: ['Le Havre AC', 'Le Havre AC', '#5ca0d3', '#003366', 'HAC', 'halves'],
    fcl: ['FC Lorient', 'FC Lorient', '#f58220', '#000000', 'FCL', 'plain'],
    metz: ['FC Metz', 'FC Metz', '#7a1c2c', '#ffffff', 'FCM', 'plain'],
    pfc: ['Paris FC', 'Paris FC', '#1b2a4a', '#ffffff', 'PFC', 'plain'],
    reims: ['Stade de Reims', 'Stade de Reims', '#e30613', '#ffffff', 'SDR', 'plain'],
    mhsc: ['Montpellier HSC', 'Montpellier HSC', '#f58220', '#003b7a', 'MHSC', 'halves'],
    fcgb: ['Girondins de Bordeaux', 'FC Girondins de Bordeaux', '#0a1f44', '#ffffff', 'FCGB', 'plain'],
    redstar: ['Red Star FC', 'Red Star F.C.', '#00843d', '#ffffff', 'RSFC', 'plain'],
    spurs: ['Tottenham Hotspur', 'Tottenham Hotspur F.C.', '#132257', '#ffffff', 'THFC', 'plain'],
    newcastle: ['Newcastle United', 'Newcastle United F.C.', '#000000', '#ffffff', 'NUFC', 'stripes'],
    villa: ['Aston Villa', 'Aston Villa F.C.', '#670e36', '#95bfe5', 'AVFC', 'halves'],
    westham: ['West Ham United', 'West Ham United F.C.', '#7a263a', '#1bb1e7', 'WHU', 'halves'],
    everton: ['Everton', 'Everton F.C.', '#003399', '#ffffff', 'EFC', 'plain'],
    brighton: ['Brighton & Hove Albion', 'Brighton & Hove Albion F.C.', '#0057b8', '#ffffff', 'BHA', 'stripes'],
    forest: ['Nottingham Forest', 'Nottingham Forest F.C.', '#dd0000', '#ffffff', 'NFFC', 'plain'],
    palace: ['Crystal Palace', 'Crystal Palace F.C.', '#1b458f', '#c4122e', 'CPFC', 'stripes'],
    leeds: ['Leeds United', 'Leeds United F.C.', '#1d428a', '#ffcd00', 'LUFC', 'plain'],
    fulham: ['Fulham', 'Fulham F.C.', '#000000', '#ffffff', 'FFC', 'halves'],
    wolves: ['Wolverhampton Wanderers', 'Wolverhampton Wanderers F.C.', '#fdb913', '#231f20', 'WOL', 'plain'],
    bournemouth: ['AFC Bournemouth', 'AFC Bournemouth', '#da291c', '#000000', 'AFCB', 'stripes'],
    brentford: ['Brentford', 'Brentford F.C.', '#e30613', '#ffffff', 'BFC', 'stripes'],
    sunderland: ['Sunderland', 'Sunderland A.F.C.', '#eb172b', '#ffffff', 'SAFC', 'stripes'],
    sevilla: ['FC Séville', 'Sevilla FC', '#d4021d', '#ffffff', 'SFC', 'plain'],
    betis: ['Real Betis', 'Real Betis', '#00954c', '#ffffff', 'RBB', 'stripes'],
    valencia: ['Valence CF', 'Valencia CF', '#ee3524', '#000000', 'VCF', 'plain'],
    villarreal: ['Villarreal', 'Villarreal CF', '#ffe667', '#005187', 'VIL', 'plain'],
    athletic: ['Athletic Bilbao', 'Athletic Bilbao', '#ee2523', '#ffffff', 'ATH', 'stripes'],
    rsociedad: ['Real Sociedad', 'Real Sociedad', '#0067b1', '#ffffff', 'RSO', 'stripes'],
    celta: ['Celta de Vigo', 'RC Celta de Vigo', '#8ac3ee', '#c8102e', 'RCC', 'plain'],
    girona: ['Girona FC', 'Girona FC', '#cd2534', '#ffffff', 'GFC', 'stripes'],
    espanyol: ['Espanyol Barcelone', 'RCD Espanyol', '#007fc8', '#ffffff', 'RCDE', 'stripes'],
    osasuna: ['CA Osasuna', 'CA Osasuna', '#d91a21', '#0a346f', 'CAO', 'plain'],
    mallorca: ['RCD Majorque', 'RCD Mallorca', '#e20613', '#000000', 'RCDM', 'plain'],
    getafe: ['Getafe CF', 'Getafe CF', '#004fa3', '#ffffff', 'GCF', 'plain'],
    rayo: ['Rayo Vallecano', 'Rayo Vallecano', '#e53027', '#ffffff', 'RAY', 'band'],
    lazio: ['Lazio Rome', 'SS Lazio', '#87d8f7', '#0a2240', 'SSL', 'plain'],
    atalanta: ['Atalanta Bergame', 'Atalanta BC', '#1e71b8', '#000000', 'ATA', 'stripes'],
    fiorentina: ['Fiorentina', 'ACF Fiorentina', '#482e92', '#ffffff', 'ACF', 'plain'],
    bologna: ['Bologne FC', 'Bologna FC 1909', '#1a2f48', '#a21c26', 'BFC', 'stripes'],
    torino: ['Torino FC', 'Torino FC', '#8a1e03', '#ffffff', 'TOR', 'plain'],
    genoa: ['Genoa CFC', 'Genoa CFC', '#ad1919', '#002147', 'GEN', 'halves'],
    udinese: ['Udinese', 'Udinese Calcio', '#000000', '#ffffff', 'UDI', 'stripes'],
    como: ['Côme 1907', 'Como 1907', '#003db8', '#ffffff', 'COM', 'plain'],
    cagliari: ['Cagliari', 'Cagliari Calcio', '#002350', '#a71c20', 'CAG', 'halves'],
    verona: ['Hellas Vérone', 'Hellas Verona FC', '#002f6c', '#ffd700', 'HVE', 'plain'],
    leverkusen: ['Bayer Leverkusen', 'Bayer 04 Leverkusen', '#e32221', '#000000', 'B04', 'plain'],
    leipzig: ['RB Leipzig', 'RB Leipzig', '#dd0741', '#ffffff', 'RBL', 'plain'],
    frankfurt: ['Eintracht Francfort', 'Eintracht Frankfurt', '#e1000f', '#000000', 'SGE', 'plain'],
    stuttgart: ['VfB Stuttgart', 'VfB Stuttgart', '#e32219', '#ffffff', 'VFB', 'band'],
    gladbach: ['Borussia Mönchengladbach', 'Borussia Mönchengladbach', '#000000', '#00a65a', 'BMG', 'plain'],
    freiburg: ['SC Fribourg', 'SC Freiburg', '#e30613', '#000000', 'SCF', 'plain'],
    wolfsburg: ['VfL Wolfsburg', 'VfL Wolfsburg', '#65b32e', '#ffffff', 'WOB', 'plain'],
    bremen: ['Werder Brême', 'SV Werder Bremen', '#1d9053', '#ffffff', 'SVW', 'plain'],
    union: ['Union Berlin', '1. FC Union Berlin', '#eb1923', '#ffffff', 'FCU', 'plain'],
    schalke: ['Schalke 04', 'FC Schalke 04', '#004d9d', '#ffffff', 'S04', 'plain'],
    hsv: ['Hambourg SV', 'Hamburger SV', '#0a3f86', '#ffffff', 'HSV', 'plain'],
    koln: ['FC Cologne', '1. FC Köln', '#ed1c24', '#ffffff', 'KOE', 'plain'],
    hoffenheim: ['Hoffenheim', 'TSG Hoffenheim', '#1961b5', '#ffffff', 'TSG', 'plain'],
    mainz: ['Mayence 05', '1. FSV Mainz 05', '#c3141e', '#ffffff', 'M05', 'plain'],
    augsburg: ['FC Augsbourg', 'FC Augsburg', '#ba3733', '#46714d', 'FCA', 'plain'],
    stpauli: ['FC St. Pauli', 'FC St. Pauli', '#5c3b25', '#ffffff', 'STP', 'plain'],
    raincy: ['FA Le Raincy', '', '#8b1426', '#0e1d45', 'FAR', 'halves'],
  };
  const KEY = AppCfg.key('crests');
  const cache = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })();
  const saveCache = () => { try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) {} };
  const asking = new Set(), inFlight = new Set(), waiting = new Set();
  let timer = null, pausedUntil = 0;

  // Shield in the club's colours (fallback, and while the crest loads)
  function shield(key, size) {
    const c = LIST[key] || ['', '', '#8a94a6', '#ffffff', '?', 'plain'], [, , a, b, txt, pat] = c, id = 'cl' + key + size;
    const fill = pat === 'stripes' ? `<pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="4" height="8" fill="${a}"/><rect x="4" width="4" height="8" fill="${b}"/></pattern>`
      : pat === 'hoops' ? `<pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="4" fill="${a}"/><rect y="4" width="8" height="4" fill="${b}"/></pattern>`
      : pat === 'halves' ? `<linearGradient id="${id}" x1="0" x2="1"><stop offset=".5" stop-color="${a}"/><stop offset=".5" stop-color="${b}"/></linearGradient>`
      : pat === 'band' ? `<linearGradient id="${id}" x1="0" x2="1"><stop offset=".36" stop-color="${a}"/><stop offset=".36" stop-color="${b}"/><stop offset=".64" stop-color="${b}"/><stop offset=".64" stop-color="${a}"/></linearGradient>` : '';
    const light = /^#f|^#e[0-9a-f]|^#fd|^#fc/i.test(a) && pat === 'plain';
    return `<svg class="crest-svg" viewBox="0 0 32 36" width="${size}" height="${Math.round(size * 1.12)}" aria-hidden="true"><defs>${fill}</defs>
      <path d="M16 1 30 5v12c0 9-6.5 15-14 18C8.5 32 2 26 2 17V5z" fill="${fill ? `url(#${id})` : a}" stroke="${light ? '#9aa3b2' : 'rgba(0,0,0,.35)'}" stroke-width="1.5"/>
      <rect x="3" y="12.5" width="26" height="10" rx="2" fill="rgba(255,255,255,.92)"/>
      <text x="16" y="20.3" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="900" font-size="${txt.length > 3 ? 6.3 : 7.8}" fill="#0e1d45">${txt}</text></svg>`;
  }
  // The clubs' crests from Wikipedia (the picture of each article), remembered on the device.
  // All the crests a page needs go in ONE request: Wikipedia refuses many separate requests in a row.
  function fetchCrest(key) {
    const c = LIST[key]; if (!c || !c[1] || cache[key] || inFlight.has(key) || !navigator.onLine || Date.now() < pausedUntil) return;
    asking.add(key);
    clearTimeout(timer); timer = setTimeout(fetchAll, 80);
  }
  async function fetchAll() {
    const keys = [...asking].slice(0, 50); asking.clear(); if (!keys.length) return;
    keys.forEach(k => inFlight.add(k));
    try {
      const url = 'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=pageimages&pilicense=any&pithumbsize=96&pilimit=50&titles=' + encodeURIComponent(keys.map(k => LIST[k][1]).join('|'));
      const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status);
      const q = (await r.json()).query || {}, to = {}, pages = {};
      (q.normalized || []).concat(q.redirects || []).forEach(x => to[x.from] = x.to);
      Object.values(q.pages || {}).forEach(p => pages[p.title] = p);
      let got = false;
      keys.forEach(k => {
        let t = LIST[k][1]; for (let i = 0; i < 5 && to[t]; i++) t = to[t];
        const p = pages[t]; if (p && p.thumbnail && p.thumbnail.source) { cache[k] = p.thumbnail.source; got = true; }
      });
      if (got) { saveCache(); const w = [...waiting]; waiting.clear(); w.forEach(f => f()); }
    } catch (e) { pausedUntil = Date.now() + 10 * 60000; } // refused or no network: shields for now, try again in 10 minutes
    finally { keys.forEach(k => inFlight.delete(k)); if (asking.size) timer = setTimeout(fetchAll, 80); }
  }
  // HTML for a crest; onReady is called once a missing crest has arrived (to redraw)
  function crest(key, size = 22, onReady) {
    if (!key || !LIST[key]) return '';
    if (cache[key]) return `<img class="crest-img" src="${cache[key]}" alt="Club de cœur : ${UI.esc(LIST[key][0])}" title="Club de cœur : ${UI.esc(LIST[key][0])}" width="${size}" height="${size}" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML=Clubs.shield('${key}',${size})">`;
    if (onReady) waiting.add(onReady);
    fetchCrest(key);
    return `<span class="crest-fallback" title="Club de cœur : ${UI.esc(LIST[key][0])}">${shield(key, size)}</span>`;
  }
  // (3.20) the clubs by country (the menu's groups)
  const COUNTRY = { France: 'psg om ol asm losc rcl srfc ogcn fcn asse rcsa tfc brest angers aja hac fcl metz pfc reims mhsc fcgb redstar',
    Angleterre: 'liverpool manu mancity arsenal chelsea spurs newcastle villa westham everton brighton forest palace leeds fulham wolves bournemouth brentford sunderland',
    Espagne: 'real barca atm sevilla betis valencia villarreal athletic rsociedad celta girona espanyol osasuna mallorca getafe rayo',
    Italie: 'milan inter juve napoli roma lazio atalanta fiorentina bologna torino genoa udinese como cagliari verona',
    Allemagne: 'bayern bvb leverkusen leipzig frankfurt stuttgart gladbach freiburg wolfsburg bremen union schalke hsv koln hoffenheim mainz augsburg stpauli' };
  function groups() {
    const seen = new Set(), byName = (a, b) => LIST[a][0].localeCompare(LIST[b][0], 'fr');
    const g = Object.entries(COUNTRY).map(([c, ks]) => { const l = ks.split(' ').filter(k => LIST[k]).sort(byName); l.forEach(k => seen.add(k)); return [c, l]; });
    return [['Le club', Object.keys(LIST).filter(k => k === 'raincy')], ...g, ['Autres pays', Object.keys(LIST).filter(k => !seen.has(k) && k !== 'raincy').sort(byName)]].filter(x => x[1].length);
  }
  const options = sel => `<option value="">Aucune</option>${groups().map(([c, l]) => `<optgroup label="${c}">${l.map(k => `<option value="${k}" ${k === sel ? 'selected' : ''}>${String(LIST[k][0]).replace(/[&<>"]/g, '')}</option>`).join('')}</optgroup>`).join('')}`;
  // « club: Juventus » in a pasted list → its key
  const n = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const ALIASES = { milanac: 'milan', acmilan: 'milan', milan: 'milan', juventus: 'juve', juve: 'juve', barcelone: 'barca', barcelona: 'barca', fcbarcelone: 'barca', fcbarcelona: 'barca', barca: 'barca', psg: 'psg', parissaintgermain: 'psg', paris: 'psg', porto: 'porto', fcporto: 'porto', om: 'om', marseille: 'om', real: 'real', realmadrid: 'real', inter: 'inter', intermilan: 'inter' };
  function find(txt) {
    const t = n(txt); if (!t) return '';
    if (ALIASES[t]) return ALIASES[t];
    const e = Object.entries(LIST).find(([k, c]) => n(c[0]) === t || n(c[1]) === t || n(c[4]) === t || k === t) || Object.entries(LIST).find(([, c]) => n(c[0]).includes(t) || t.includes(n(c[0])));
    return e ? e[0] : '';
  }
  /* (1.40) the crests of the opponents, from the FFF site (« Résultats FFF » bookmark): club.oppLogos = { « NOM » : FFF club number } */
  const okey = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  function oppId(name) {
    const L = (Store.state.club || {}).oppLogos || {}, k = okey(name); if (!k) return '';
    return L[k] || L[k.replace(/ \d+$/, '')] || (Object.entries(L).find(([n]) => n.replace(/ \d+$/, '') === k.replace(/ \d+$/, '')) || [])[1] || '';
  }
  const oppLogo = (name, cls = 'opp-logo') => { const id = oppId(name); return id ? `<img class="${cls}" src="https://cdn-transverse.azureedge.net/phlogos/BC${id}.jpg" alt="" loading="lazy" onerror="this.remove()">` : ''; };
  function setOppLogos(map) { const c = Store.state.club, L = c.oppLogos = Object.assign({}, c.oppLogos || {}); let n = 0; Object.entries(map || {}).forEach(([name, id]) => { const k = okey(name); if (k && /^\d+$/.test(id) && L[k] !== id) { L[k] = id; n++; } }); return n; }
  return { LIST, groups, crest, shield, options, find, name: k => (LIST[k] || [''])[0], oppLogo, setOppLogos };
})();
