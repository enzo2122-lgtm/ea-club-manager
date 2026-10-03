/* Weather: the week in the club's town (Réglages → Le club) and the weather of the next away match (city and date of the trip).
   Forecasts come from Open-Meteo (free, no account); asked by the device itself and kept 2 hours. */
const Weather = (() => {
  const { esc } = UI;
  const HOMEOF = () => { const c = Store.state.club; return c.lat != null && c.lon != null ? { name: c.city || 'le club', lat: +c.lat, lon: +c.lon } : null; };
  const TTL = 2 * 3600e3, KEY = AppCfg.key('weather'), GEO = AppCfg.key('geo');
  const load = k => { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  // WMO weather codes → emoji and words
  function look(code) {
    if (code === 0) return ['☀️', 'Soleil'];
    if (code === 1) return ['🌤️', 'Plutôt ensoleillé'];
    if (code === 2) return ['⛅', 'Nuageux'];
    if (code === 3) return ['☁️', 'Couvert'];
    if (code === 45 || code === 48) return ['🌫️', 'Brouillard'];
    if (code >= 51 && code <= 57) return ['🌦️', 'Bruine'];
    if (code >= 61 && code <= 67) return ['🌧️', code >= 65 ? 'Forte pluie' : 'Pluie'];
    if (code >= 71 && code <= 77) return ['🌨️', 'Neige'];
    if (code >= 80 && code <= 82) return ['🌦️', 'Averses'];
    if (code === 85 || code === 86) return ['🌨️', 'Averses de neige'];
    if (code >= 95) return ['⛈️', 'Orage'];
    return ['🌡️', ''];
  }
  // 16 days, day by day and hour by hour
  async function forecast(lat, lon) {
    const k = lat.toFixed(2) + ',' + lon.toFixed(2), all = load(KEY), c = all[k];
    if (c && Date.now() - c.at < TTL) return c.data;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=Europe%2FParis&forecast_days=16`
      + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max'
      + '&hourly=temperature_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m';
    const r = await fetch(url); if (!r.ok) throw new Error('météo indisponible');
    const data = await r.json();
    Object.keys(all).forEach(x => { if (Date.now() - all[x].at > TTL) delete all[x]; });
    all[k] = { at: Date.now(), data }; store(KEY, all);
    return data;
  }
  const day = (f, date) => { const i = f.daily.time.indexOf(date); if (i < 0) return null; const d = f.daily;
    return { date, code: d.weather_code[i], max: Math.round(d.temperature_2m_max[i]), min: Math.round(d.temperature_2m_min[i]), rain: d.precipitation_sum[i] || 0, prob: d.precipitation_probability_max[i] || 0, wind: Math.round(d.wind_speed_10m_max[i] || 0) }; };
  const hour = (f, date, time) => { if (!time) return null; const i = f.hourly.time.indexOf(`${date}T${time.slice(0, 2)}:00`); if (i < 0) return null; const h = f.hourly;
    return { code: h.weather_code[i], temp: Math.round(h.temperature_2m[i]), rain: h.precipitation[i] || 0, prob: h.precipitation_probability[i] || 0, wind: Math.round(h.wind_speed_10m[i] || 0) }; };

  // What a coach should know for a session or a match
  function warnings(d, h) {
    const w = [], x = h || {}, code = h ? h.code : d.code;
    if (code >= 95) w.push('⛈️ orage annoncé');
    else if ((code >= 71 && code <= 77) || code === 85 || code === 86) w.push('🌨️ neige possible');
    else if ((h ? x.rain >= 1 || x.prob >= 60 : d.rain >= 5 || d.prob >= 70)) w.push('🌧️ pluie : prévois K-way et affaires de rechange');
    if ((h ? x.wind : d.wind) >= 40) w.push('💨 vent fort');
    if ((h ? x.temp : d.min) <= 3) w.push('🥶 froid : gants et bonnets');
    if ((h ? x.temp : d.max) >= 28) w.push('🥵 chaleur : gourdes et pauses boisson');
    return w;
  }

  // City of an away match: from its place (« Stade …, 93140 Bondy »), else from the opponent's name (« AS Bondy »)
  function cityGuesses(m) {
    const out = [], p = String(m.place || '').trim();
    if (p) {
      const pc = p.match(/\b\d{5}\s+([A-Za-zÀ-ÿ' -]{2,40})/); if (pc) out.push(pc[1].trim());
      const parts = p.split(/[,\n]/).map(s => s.replace(/\b\d{5}\b/g, '').trim()).filter(Boolean);
      if (parts.length) out.push(parts[parts.length - 1]);
      out.push(p);
    }
    const o = String(m.opponent || '').replace(/\b(F\.?C\.?|A\.?S\.?|U\.?S\.?|C\.?S\.?|E\.?S\.?|S\.?C\.?|R\.?C\.?|J\.?S\.?|A\.?C\.?|C\.?O\.?|F\.?A\.?|U\.?S\.?M\.?|A\.?F\.?C\.?|Football|Club|Olympique|Stade|Entente|Sporting|Racing|Association|Sportive|Union|Jeunesse|Espoir|Red Star|U\d+|\d+)\b/gi, ' ')
      .replace(/[^A-Za-zÀ-ÿ' -]/g, ' ').replace(/\s+/g, ' ').trim();
    if (o.length >= 3) out.push(o);
    const own = String((HOMEOF() || {}).name || '').toLowerCase();
    return [...new Set(out)].filter(s => !own || s.toLowerCase() !== own);
  }
  const dist = (a, b) => Math.hypot((a.lat - b.lat) * 111, (a.lon - b.lon) * 73);
  async function geocode(name) {
    const cache = load(GEO), k = name.toLowerCase();
    if (k in cache) return cache[k];
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=10&language=fr&countryCode=FR`);
    if (!r.ok) throw new Error('lieu introuvable');
    const res = ((await r.json()).results || []).map(x => ({ name: x.name, lat: x.latitude, lon: x.longitude })).filter(x => !HOMEOF() || dist(x, HOMEOF()) < 250);
    if (HOMEOF()) res.sort((a, b) => dist(a, HOMEOF()) - dist(b, HOMEOF())); // the closest one: a club plays near home
    cache[k] = res[0] || null; store(GEO, cache);
    return cache[k];
  }
  async function cityOf(m) { for (const g of cityGuesses(m)) { try { const c = await geocode(g); if (c) return c; } catch (e) {} } return null; }

  /* ---------- home card ---------- */
  const DAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  const wd = date => DAYS[new Date(date + 'T12:00').getDay()];
  const longDay = date => new Date(date + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const placeholder = () => !HOMEOF() ? '' : `<section class="card wx-card" id="wxCard"><h2>🌤️ Météo · ${esc((HOMEOF() || {}).name || '')} · 7 jours</h2><p class="muted small">Chargement de la météo…</p></section>`;
  // events: [{ date, time, kind: 'match'|'training', label, match? }], trip: next away match of the coach
  async function mount(root, events, trip) {
    const box = root.querySelector('#wxCard'); if (!box || !HOMEOF()) return; const HOME = HOMEOF();
    if (!navigator.onLine) { box.innerHTML = '<h2>🌤️ Météo</h2><p class="muted small">Pas de connexion internet : la météo s\'affichera au retour du réseau.</p>'; return; }
    let f;
    try { f = await forecast(HOME.lat, HOME.lon); } catch (e) { box.innerHTML = '<h2>🌤️ Météo</h2><p class="muted small">La météo n\'a pas pu être chargée. Réessaie plus tard.</p>'; return; }
    const days = f.daily.time.slice(0, 7).map(d => day(f, d));
    const evOf = date => events.filter(e => e.date === date);
    const alerts = [];
    events.filter(e => !e.away && days.some(d => d.date === e.date)).forEach(e => {
      const w = warnings(day(f, e.date), hour(f, e.date, e.time));
      if (w.length) alerts.push(`<li><b>${esc(longDay(e.date))}</b> · ${esc(e.label)}${e.time ? ' à ' + esc(e.time) : ''} : ${esc(w.join(', '))}</li>`);
    });
    box.innerHTML = `<h2>🌤️ Météo · ${esc((HOMEOF() || {}).name || '')} · 7 jours</h2>
      <div class="wx-week">${days.map(d => { const ev = evOf(d.date), [ic, lab] = look(d.code);
        return `<div class="wx-day ${ev.length ? 'has-ev' : ''}" title="${esc(lab)}"><span class="wx-d">${wd(d.date)}</span><span class="wx-ic">${ic}</span>
          <span class="wx-t"><b>${d.max}°</b><i>${d.min}°</i></span>${d.rain >= 0.5 ? `<span class="wx-r">${Math.round(d.rain)} mm</span>` : '<span class="wx-r"></span>'}
          ${ev.length ? `<span class="wx-ev">${ev.some(e => e.kind === 'match') ? '⚽' : '🏃'}</span>` : ''}</div>`; }).join('')}</div>
      ${alerts.length ? `<ul class="wx-alerts">${alerts.join('')}</ul>` : events.some(e => !e.away && days.some(d => d.date === e.date)) ? '<p class="wx-ok">✅ Pas d\'alerte météo pour tes séances et matchs de la semaine.</p>' : ''}
      <div id="wxTrip"></div>`;
    if (trip) tripInfo(box.querySelector('#wxTrip'), trip);
  }
  async function tripInfo(el, m) {
    const team = Store.get('teams', m.teamId), who = `${team ? team.name + ' · ' : ''}chez ${m.opponent || '?'}`;
    const head = `<h3>🚌 Prochain déplacement</h3><p><b>${esc(longDay(m.date))}${m.time ? ' à ' + esc(m.time) : ''}</b> · ${esc(who)}</p>`;
    const limit = new Date(Date.now() + 15 * 864e5).toISOString().slice(0, 10);
    if (m.date > limit) { el.innerHTML = `<div class="wx-trip">${head}<p class="muted small">La météo de ce déplacement s'affichera à partir du ${esc(longDay(new Date(new Date(m.date + 'T12:00') - 15 * 864e5).toISOString().slice(0, 10)))}.</p></div>`; return; }
    el.innerHTML = `<div class="wx-trip">${head}<p class="muted small">Recherche de la ville…</p></div>`;
    const city = await cityOf(m);
    if (!city) { el.innerHTML = `<div class="wx-trip">${head}<p class="muted small">Ville du match inconnue : <a href="#/match/${m.id}">ajoute le lieu du match</a> (ex : « 93140 Bondy ») pour avoir sa météo.</p></div>`; return; }
    try {
      const f = await forecast(city.lat, city.lon), d = day(f, m.date), h = hour(f, m.date, m.time); if (!d) throw 0;
      const [ic, lab] = look(h ? h.code : d.code), w = warnings(d, h), rr = h ? h.rain : d.rain;
      el.innerHTML = `<div class="wx-trip">${head}<p class="wx-trip-line"><span class="wx-ic">${ic}</span><span><b>${esc(city.name)}</b> · ${esc(lab)} · ${h ? `${h.temp}° à ${esc(m.time)}` : `${d.max}° / ${d.min}°`}${rr >= 0.5 ? ` · ${Math.round(rr * 10) / 10} mm` : ''}</span></p>
        ${w.length ? `<p class="wx-warn">${esc(w.join(' · '))}</p>` : '<p class="wx-ok">✅ Rien à signaler pour le déplacement.</p>'}</div>`;
    } catch (e) { el.innerHTML = `<div class="wx-trip">${head}<p class="muted small">Météo du déplacement indisponible pour le moment.</p></div>`; }
  }
  // Short weather of today's event for the top of the home page (« ☀️ 21° »)
  async function todayShort(time) {
    const HOME = HOMEOF(); if (!HOME) return '';
    try { const f = await forecast(HOME.lat, HOME.lon), date = UI.today(), d = day(f, date), h = hour(f, date, time); if (!d) return '';
      const [ic] = look(h ? h.code : d.code), w = warnings(d, h);
      return `${ic} ${h ? h.temp : d.max}°${w.length ? ' · ' + w[0] : ''}`; } catch (e) { return ''; }
  }
  return { placeholder, mount, todayShort, forecast, cityGuesses, geocode, look, warnings };
})();
