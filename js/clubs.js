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
    raincy: ['FA Le Raincy', '', '#8b1426', '#0e1d45', 'FAR', 'halves'],
  };
  const KEY = 'ea-crests';
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
  const options = sel => `<option value="">Aucune</option>${Object.entries(LIST).sort((a, b) => a[1][0].localeCompare(b[1][0], 'fr')).map(([k, c]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${UI.esc(c[0])}</option>`).join('')}`;
  // « club: Juventus » in a pasted list → its key
  const n = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const ALIASES = { milanac: 'milan', acmilan: 'milan', milan: 'milan', juventus: 'juve', juve: 'juve', barcelone: 'barca', barcelona: 'barca', fcbarcelone: 'barca', fcbarcelona: 'barca', barca: 'barca', psg: 'psg', parissaintgermain: 'psg', paris: 'psg', porto: 'porto', fcporto: 'porto', om: 'om', marseille: 'om', real: 'real', realmadrid: 'real', inter: 'inter', intermilan: 'inter' };
  function find(txt) {
    const t = n(txt); if (!t) return '';
    if (ALIASES[t]) return ALIASES[t];
    const e = Object.entries(LIST).find(([k, c]) => n(c[0]) === t || n(c[1]) === t || n(c[4]) === t || k === t) || Object.entries(LIST).find(([, c]) => n(c[0]).includes(t) || t.includes(n(c[0])));
    return e ? e[0] : '';
  }
  return { LIST, crest, shield, options, find, name: k => (LIST[k] || [''])[0] };
})();
