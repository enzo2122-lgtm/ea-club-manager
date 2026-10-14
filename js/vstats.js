/* (3.38) VStats: the sequences of a match video, kept in the match itself so they reach the club server and every coach's device.
   The video stays on the device that imported it (or on YouTube); the match keeps, for each analysed video, its name, its YouTube link
   and its sequences (action, moment, players, comment). From them: the card « Analyse vidéo » of the match (tab « Après »:
   actions, players, sequences to replay) and the card of a player (his actions of the season, from the analysed matches).
   Only the staff reads it: the families' pages get a few chosen fields of a match from the server, never this one. */
const VStats = (() => {
  const { esc } = UI;
  const tagOf = k => Analyse.TAGS.find(t => t[0] === k) || Analyse.TAGS[Analyse.TAGS.length - 1];
  const COUNTED = k => k !== 'autre'; // a sequence found by the sound and not named yet counts for nothing
  const vids = m => Object.entries((m && m.video) || {}).map(([id, v]) => Object.assign({ id }, v));
  const clipsOf = m => vids(m).flatMap(v => (v.clips || []).map(c => Object.assign({ vid: v.id, url: v.url, vname: v.name }, c)));

  /* ---------- the video's sequences → its match (called by the analysis page after each change) ---------- */
  function sync(rec) {
    if (!rec || typeof Store === 'undefined') return;
    if (Auth.canWrite && !Auth.canWrite('matches')) return; // read-only access: the sequences stay on this device, without a message each time
    const keep = c => ({ id: c.id, tag: c.tag, start: +(+c.start).toFixed(1), end: +(+c.end).toFixed(1), at: c.at != null ? +(+c.at).toFixed(1) : null, note: c.note || '', players: c.players || [], ...(c.auto ? { auto: true } : {}) });
    Store.state.matches.forEach(m => {
      const has = !!(m.video && m.video[rec.id]);
      if (m.id === rec.matchId) {
        const v = { name: rec.name || 'Vidéo', url: Analyse.isYT(rec) ? rec.url : '', ko1: rec.ko1 != null ? rec.ko1 : null, ko2: rec.ko2 != null ? rec.ko2 : null, at: Date.now(), clips: (rec.clips || []).map(keep) };
        const was = has ? JSON.stringify(Object.assign({}, m.video[rec.id], { at: 0 })) : '';
        if (was === JSON.stringify(Object.assign({}, v, { at: 0 }))) return; // nothing new: no write, no sync
        m.video = Object.assign({}, m.video, { [rec.id]: v }); Store.upsert('matches', m);
      } else if (has) { // the video now belongs to another match (or to none)
        const o = Object.assign({}, m.video); delete o[rec.id]; m.video = Object.keys(o).length ? o : undefined; Store.upsert('matches', m);
      }
    });
  }

  /* ---------- counts ---------- */
  // { playerId: { tag: n } } and { tag: n } for a list of sequences
  function count(clips) {
    const byP = {}, all = {};
    clips.filter(c => COUNTED(c.tag)).forEach(c => {
      all[c.tag] = (all[c.tag] || 0) + 1;
      (c.players || []).forEach(pid => { const x = byP[pid] = byP[pid] || {}; x[c.tag] = (x[c.tag] || 0) + 1; });
    });
    return { byP, all };
  }
  const tagsIn = all => Analyse.TAGS.filter(t => all[t[0]]);
  const chips = (all) => `<div class="an-stats">${tagsIn(all).map(([k, ic, l, c]) => `<span style="--c:${c}">${ic} ${esc(l)} <b>${all[k]}</b></span>`).join('')}</div>`;
  // the minute of the match of a moment of the video (kick-off and, if placed, second half kick-off)
  function minute(v, t) {
    if (v.ko1 == null || t == null || t < v.ko1) return '';
    if (v.ko2 != null && t >= v.ko2) return Math.floor((t - v.ko2) / 60) + 46 + "'";
    return Math.floor((t - v.ko1) / 60) + 1 + "'";
  }

  /* ---------- the card of a match (tab « Après ») ---------- */
  function matchCard(m) {
    const vs = vids(m), cl = clipsOf(m);
    if (!cl.length) return '';
    const { byP, all } = count(cl), tags = tagsIn(all);
    const ps = Object.keys(byP).map(id => Store.get('players', id)).filter(Boolean)
      .map(p => ({ p, n: byP[p.id], tot: Object.values(byP[p.id]).reduce((a, b) => a + b, 0) })).sort((a, b) => b.tot - a.tot || Store.byName(a.p, b.p));
    const vOf = c => vs.find(v => v.id === c.vid) || {};
    const rows = cl.slice().sort((a, b) => (a.vid === b.vid ? 0 : a.vid < b.vid ? -1 : 1) || a.start - b.start).map(c => {
      const t = tagOf(c.tag), names = (c.players || []).map(id => Store.get('players', id)).filter(Boolean).map(Store.shortName).join(', '), mn = minute(vOf(c), c.at != null ? c.at : c.start);
      const play = c.clip ? `<button type="button" class="btn soft small" data-vsclip="${esc(c.clip)}" data-vptitle="${esc(t[2] + (names ? ' · ' + names : ''))}">▶<span>Voir${c.draws ? ' 🎨' : ''}</span></button>`
        : c.url ? `<button type="button" class="btn soft small" data-vp="${esc(c.url)}" data-vpt="${Math.floor(c.start)}" data-vptitle="${esc(t[2] + (names ? ' · ' + names : ''))}">▶<span>Voir</span></button>`
        : `<a class="btn soft small" href="#/analyse/${esc(c.vid)}" title="La vidéo est sur l'appareil qui l'a importée">▶<span>Voir</span></a>`;
      return `<li class="vs-row" style="--c:${t[3]}"><span class="vs-t">${t[1]} <b>${esc(t[2])}</b>${mn ? ` <span class="muted">${mn}</span>` : ''} <span class="muted small">(${Analyse.mmss(c.start)})</span>${names ? `<br><span class="small">${esc(names)}</span>` : ''}${c.note ? `<br><i class="small">${esc(c.note)}</i>` : ''}</span>
        ${play}${c.url && !(m.highlights || []).some(h => h.vsClip === c.id) ? `<button type="button" class="btn soft small" data-vshl="${esc(c.vid)}|${esc(c.id)}" title="Ajouter aux highlights du match (les joueurs les voient quand tu les envoies)">＋🎬</button>` : ''}</li>`;
    }).join('');
    return `<section class="card vs-card"><h2>🎬 Analyse vidéo</h2>
      <p class="muted small">${vs.length} vidéo${vs.length > 1 ? 's' : ''} analysée${vs.length > 1 ? 's' : ''} · ${cl.length} séquence${cl.length > 1 ? 's' : ''}. Rempli par la page « Analyse vidéo » (Bibliothèque → la vidéo → Analyser) ou par l'application Raincy Vidéo de l'ordinateur du club, visible par les éducateurs sur tous les appareils.</p>
      ${chips(all)}
      ${ps.length && tags.length ? `<div class="vs-scroll"><table class="vs-table"><thead><tr><th>Joueur</th>${tags.map(([k, ic, l]) => `<th title="${esc(l)}">${ic}</th>`).join('')}</tr></thead>
        <tbody>${ps.map(({ p, n }) => `<tr><th><a href="#/joueur/${esc(p.id)}">${esc(Store.shortName(p))}</a></th>${tags.map(([k]) => `<td>${n[k] || ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
        : '<p class="tip">Pour les stats par joueur : sous chaque séquence de l\'analyse, touche les joueurs concernés.</p>'}
      <details class="vs-seq"><summary>Les ${cl.length} séquences</summary><ul class="vs-list">${rows}</ul>
        ${cl.some(c => !c.url) ? '<p class="muted small">« Voir » d\'une vidéo importée sur un appareil : elle s\'ouvre seulement sur cet appareil. Une vidéo YouTube (même « non répertoriée ») se regarde partout.</p>' : ''}</details></section>`;
  }
  // box: the element to fill (match page, tab « Après »); save: stores the match; redraw: the whole page (the highlights card changes too)
  function mount(box, m, save, redraw) {
    if (!box) return;
    box.innerHTML = matchCard(m);
    box.onclick = async e => {
      if (VPlayer.onClick(e)) return;
      const cb = e.target.closest('[data-vsclip]');
      if (cb) { // (3.38) un clip de Raincy Vidéo : rangé dans le stockage privé du club, lu avec une adresse valable 1 heure
        try { VPlayer.open(await clipUrl(cb.dataset.vsclip), 0, cb.dataset.vptitle); } catch (err) { UI.toast(err.message, 'err'); }
        return;
      }
      const b = e.target.closest('[data-vshl]'); if (!b) return;
      const [vid, cid] = b.dataset.vshl.split('|'), v = (m.video || {})[vid], c = v && (v.clips || []).find(x => x.id === cid);
      if (!c || !v.url) return;
      const names = (c.players || []).map(id => Store.get('players', id)).filter(Boolean).map(Store.shortName).join(', '), mn = minute(v, c.at != null ? c.at : c.start);
      m.highlights = [...(m.highlights || []), { id: Store.uid(), vsClip: c.id, url: v.url, title: (tagOf(c.tag)[2] + (names ? ' · ' + names : '') + (mn ? ', ' + mn : '')).slice(0, 80), t: Analyse.mmss(c.start) }];
      save(); UI.toast('Ajouté aux highlights du match ✓'); redraw();
    };
  }

  // the address of a clip of the club's storage (function « raincy-clips » of the server, which checks the connection)
  async function clipUrl(path) {
    const c = Cloud.cfg(), t = Cloud.token && Cloud.token();
    if (!c || !t) throw new Error('Connecte-toi au serveur du club pour voir ce clip.');
    const headers = { apikey: c.key, 'Content-Type': 'application/json' }; if (!String(c.key).startsWith('sb_')) headers.Authorization = 'Bearer ' + c.key;
    let r; try { r = await fetch(c.url.replace(/\/+$/, '') + '/functions/v1/raincy-clips', { method: 'POST', headers, body: JSON.stringify({ k: t, action: 'read', paths: [path] }) }); }
    catch (e) { throw new Error('Pas de connexion internet.'); }
    const o = await r.json().catch(() => ({}));
    if (!r.ok || !o.urls || !o.urls[path]) throw new Error(r.status === 401 ? 'Ta connexion a expiré : reconnecte-toi.' : r.status === 404 ? 'Les clips ne sont pas encore installés sur le serveur du club.' : 'Clip introuvable.');
    return o.urls[path];
  }

  /* ---------- the card of a player: his actions in the analysed matches of the season ---------- */
  function playerCard(p, ms) {
    const done = (ms || []).filter(m => clipsOf(m).length);
    if (!done.length) return '';
    const mine = done.map(m => ({ m, cl: clipsOf(m).filter(c => (c.players || []).includes(p.id) && COUNTED(c.tag)) }));
    const { all } = count(mine.flatMap(x => x.cl));
    return `<section class="card vs-card"><h2>🎬 Ses actions en vidéo</h2>
      <p class="muted small">${done.length} match${done.length > 1 ? 's' : ''} analysé${done.length > 1 ? 's' : ''} en vidéo cette saison.</p>
      ${Object.keys(all).length ? chips(all) + `<ul class="res-list">${mine.filter(x => x.cl.length).slice(0, 10).map(({ m, cl }) => { const n = count(cl).all;
        return `<li><a href="#/match/${esc(m.id)}"><span class="d">${esc(UI.fmtDate(m.date))}</span><span class="o">${m.home ? 'contre' : 'chez'} ${esc(m.opponent || '?')}</span><span class="s">${tagsIn(n).map(([k, ic]) => ic + (n[k] > 1 ? '×' + n[k] : '')).join(' ')}</span></a></li>`; }).join('')}</ul>`
        : '<p class="muted">Il n\'est encore sur aucune séquence : dans l\'analyse, touche son nom sous les séquences où il apparaît.</p>'}</section>`;
  }

  return { sync, count, matchCard, mount, playerCard, minute, clipUrl };
})();
