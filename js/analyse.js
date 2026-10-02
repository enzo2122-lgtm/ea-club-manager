/* Analyse: match video analysis and video briefings.
   A video of the library (or of a match's photos and videos) gets tagged sequences (goal, chance, ball lost…) with a note
   and the players involved; sequences from one or several videos make a briefing, shown full screen or exported as one video.
   Videos stay on the device (IndexedDB, js/media.js): the sequences are kept with the video, the briefings on this device. */
const Analyse = (() => {
  const { esc, $, $$, toast, modal, confirmBox } = UI;
  const S = () => Store.state;
  const TAGS = [['but', '⚽', 'But marqué', '#15803d'], ['encaisse', '🥅', 'But encaissé', '#be123c'], ['occasion', '🎯', 'Occasion', '#0891b2'],
    ['recup', '🔄', 'Récupération', '#2563eb'], ['perte', '❌', 'Perte de balle', '#dc2626'], ['pressing', '🔥', 'Pressing', '#ea580c'],
    ['cpa', '🚩', 'Coup de pied arrêté', '#7c3aed'], ['defense', '🛡️', 'Bien défendu', '#0d9488'], ['erreur', '⚠️', 'Erreur', '#a16207'], ['autre', '✏️', 'Autre', '#475569']];
  const tagOf = k => TAGS.find(t => t[0] === k) || TAGS[TAGS.length - 1];
  const mmss = t => { t = Math.max(0, Math.floor(t || 0)); const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); };
  const BRIEF = 'ea-briefings';
  const briefings = () => { try { return JSON.parse(localStorage.getItem(BRIEF)) || []; } catch (e) { return []; } };
  const saveBriefings = l => { try { localStorage.setItem(BRIEF, JSON.stringify(l)); } catch (e) { toast('Impossible d\'enregistrer le briefing sur cet appareil', 'err'); } };
  const pref = () => Object.assign({ before: 8, after: 4 }, S().ui.clipPref || {});
  let urlNow = null;
  const freeUrl = () => { if (urlNow) { URL.revokeObjectURL(urlNow); urlNow = null; } };

  /* ---------- YouTube: a link of the library, played in YouTube's own player ----------
     Tagging, sequences and the full-screen briefing work the same; YouTube never lets a page read its images,
     so no drawing on a frame and no exported video file for these sequences. */
  const ytId = url => { const m = /(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([\w-]{11})/.exec(url || ''); return m ? m[1] : null; };
  const isYT = rec => !!rec && rec.kind === 'link' && !!ytId(rec.url);
  let ytApi = null;
  const loadYT = () => ytApi || (ytApi = new Promise((res, rej) => {
    if (window.YT && YT.Player) return res(YT);
    const prev = window.onYouTubeIframeAPIReady; window.onYouTubeIframeAPIReady = () => { if (prev) prev(); res(YT); };
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => { ytApi = null; s.remove(); rej(new Error('YouTube injoignable')); };
    document.head.appendChild(s);
  }));
  // A YouTube player that answers like a <video>: currentTime, duration, paused, play(), pause(), playbackRate, onplay/onpause/ontimeupdate…
  async function ytPlayer(box, id) {
    const Y = await loadYT(), el = document.createElement('div'); box.appendChild(el);
    const v = { isYT: true }; let p, timer, known = false;
    await new Promise((res, rej) => {
      const to = setTimeout(() => rej(new Error('YouTube ne répond pas')), 20000);
      p = new Y.Player(el, { videoId: id, width: '100%', height: '100%', playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
        events: { onReady: () => { clearTimeout(to); res(); }, onError: e => { clearTimeout(to); rej(new Error('YT' + e.data)); },
          onStateChange: e => { if (e.data === 1 && v.onplay) v.onplay(); if (e.data === 2 && v.onpause) v.onpause(); if (e.data === 0) { if (v.onpause) v.onpause(); if (v.onended) v.onended(); } } } });
    });
    Object.defineProperties(v, {
      currentTime: { get: () => (p.getCurrentTime && p.getCurrentTime()) || 0, set: t => { p.seekTo(Math.max(0, t), true); setTimeout(() => { if (v.ontimeupdate) v.ontimeupdate(); if (v.onseeked) v.onseeked(); }, 300); } },
      duration: { get: () => (p.getDuration && p.getDuration()) || NaN },
      paused: { get: () => p.getPlayerState() !== 1 },
      playbackRate: { get: () => p.getPlaybackRate(), set: r => p.setPlaybackRate(r) },
      muted: { get: () => p.isMuted(), set: m => m ? p.mute() : p.unMute() },
    });
    v.play = () => { p.playVideo(); return Promise.resolve(); };
    v.pause = () => { try { p.pauseVideo(); } catch (e) {} };
    v.scrollIntoView = o => box.scrollIntoView(o);
    v.destroy = () => { clearInterval(timer); try { p.destroy(); } catch (e) {} };
    // no events from YouTube while playing: the time is read 4 times a second, and the player goes away with its page
    timer = setInterval(() => {
      if (!document.body.contains(box)) return v.destroy();
      if (!known && v.duration > 0) { known = true; if (v.onloadedmetadata) v.onloadedmetadata(); }
      if (v.ontimeupdate) v.ontimeupdate();
    }, 250);
    return v;
  }
  const ytError = e => /YT(101|150)/.test(String(e && e.message)) ? 'Le propriétaire de cette vidéo YouTube ne permet pas de la lire dans une autre appli. Télécharge-la sur l\'appareil puis importe-la dans la Bibliothèque.'
    : /YT(100|2)/.test(String(e && e.message)) ? 'Vidéo YouTube introuvable : elle est peut-être privée ou supprimée. Une vidéo « non répertoriée » fonctionne.'
    : 'YouTube ne répond pas : vérifie la connexion internet, puis réessaie.';

  /* ---------- analysis page (#/analyse/mediaId) ---------- */
  async function page(root, id) {
    freeUrl();
    const rec = id && await Media.get(id);
    const yt = isYT(rec);
    if (!rec || (rec.kind !== 'video' && !yt)) { root.innerHTML = `<div class="empty"><p>${rec && rec.kind === 'link' ? 'Seules les vidéos YouTube s\'analysent depuis un lien. Pour un autre site, télécharge la vidéo sur l\'appareil puis importe-la dans la Bibliothèque.' : 'Vidéo introuvable sur cet appareil : les vidéos restent sur l\'appareil qui les a importées.'}</p><a class="btn" href="#/bibliotheque">${I.back}<span>Bibliothèque</span></a></div>`; return; }
    rec.clips = rec.clips || [];
    if (!rec.matchId && String(rec.ref || '').startsWith('match:')) rec.matchId = rec.ref.slice(6);
    const match = () => rec.matchId && Store.get('matches', rec.matchId);
    const players = () => { const m = match(); return m ? (m.convoked || []).map(pid => Store.get('players', pid)).filter(Boolean).sort(Store.byName) : []; };
    if (!yt) urlNow = URL.createObjectURL(rec.blob);
    const ms =S().matches.filter(m => Auth.sees(m.teamId) && !m.exempt).sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 60);
    root.innerHTML = `<header class="page-head an-head"><div><h1>🎬 Analyse vidéo</h1><p class="sub">${esc(rec.name || 'Vidéo')}</p></div>
      <div class="head-actions"><button class="btn" data-a="back">${I.back}<span>Retour</span></button><button class="btn primary" data-a="briefings">${I.video}<span>Briefings</span></button></div></header>
      <label class="fld an-match"><span>Match analysé (pour choisir les joueurs)</span><select id="anMatch"><option value="">Aucun</option>${ms.map(m => `<option value="${m.id}" ${m.id === rec.matchId ? 'selected' : ''}>${esc(UI.fmtDate(m.date))} · ${esc((Store.get('teams', m.teamId) || {}).name || '')} ${m.home ? 'contre' : 'chez'} ${esc(m.opponent || '?')}</option>`).join('')}</select></label>
      ${yt ? `<div class="an-player an-yt"><div id="anYT" class="an-ytbox"><p class="muted">Chargement de YouTube…</p></div><div class="an-time" id="anTime">0:00</div></div>
        <p class="tip">Vidéo YouTube : marque les actions, dessine sur la vidéo et fais tes briefings comme d'habitude. YouTube ne laisse pas copier ses images : pas de zoom, pas de tableau tactique sur l'image, pas d'export en fichier vidéo. Pour ça, importe la vidéo elle-même dans la Bibliothèque.</p>`
      : `<div class="an-player"><video id="anVideo" src="${urlNow}" playsinline preload="auto"></video><div class="an-time" id="anTime">0:00</div></div>`}
      <div class="an-bar" id="anBar" role="slider" aria-label="Position dans la vidéo"><i class="an-pos" id="anPos"></i></div>
      <div class="an-ctrl">
        <button class="icon-btn" data-a="-5" aria-label="Reculer de 5 secondes">−5</button><button class="icon-btn" data-a="-f" aria-label="Image précédente">◀︎|</button>
        <button class="btn primary an-play" data-a="play" id="anPlay">${I.play}<span>Lecture</span></button>
        <button class="icon-btn" data-a="+f" aria-label="Image suivante">|▶︎</button><button class="icon-btn" data-a="+5" aria-label="Avancer de 5 secondes">+5</button>
        <span class="an-speed">${[.25, .5, 1, 2].map(r => `<button class="chip ${r === 1 ? 'on' : ''}" data-rate="${r}">×${String(r).replace('.', ',')}</button>`).join('')}</span></div>
      <div id="teleBox" class="tele-box"></div>
      <section class="card"><div class="row-head"><h2>Marquer une action</h2><button class="linkish" data-a="pref">Séquence : ${pref().before} s avant, ${pref().after} s après</button></div>
        <div class="an-tags">${TAGS.map(([k, ic, l, c]) => `<button class="an-tag" data-tag="${k}" style="--c:${c}"><b>${ic}</b><span>${esc(l)}</span></button>`).join('')}</div></section>
      <div id="anLive"></div>
      <div id="anStats"></div>
      <h2 class="section">Séquences</h2><div id="anClips"></div>`;
    const bar = $('#anBar', root);
    let v = $('#anVideo', root);
    if (yt) {
      try { v = await ytPlayer($('#anYT', root), ytId(rec.url)); $('#anYT p', root) && $('#anYT p', root).remove(); }
      catch (e) { $('#anYT', root).innerHTML = `<p class="an-yt-err">${esc(ytError(e))}</p><p><a class="btn soft" href="${esc(rec.url)}" target="_blank" rel="noopener noreferrer">${I.share}<span>Ouvrir sur YouTube</span></a></p>`; return; }
    }
    const save = async () => { await Media.put(rec); };
    // the drawings of the sequences, over the video (shown while it plays, drawn with « Dessins sur la vidéo »)
    const L = Tele.layer($('.an-player', root), yt ? $('#anYT', root) : v, () => v, () => rec.clips);
    const drawBar = () => {
      const d = isFinite(v.duration) ? v.duration : 0;
      bar.innerHTML = `<i class="an-pos" id="anPos" style="left:${d ? v.currentTime / d * 100 : 0}%"></i>` + (d ? rec.clips.map(c => `<button class="an-mark" data-seek="${c.start}" style="left:${c.start / d * 100}%;width:${Math.max(.6, (c.end - c.start) / d * 100)}%;--c:${tagOf(c.tag)[3]}" title="${esc(tagOf(c.tag)[2])} ${mmss(c.start)}"></button>`).join('') : '');
    };
    const drawStats = () => {
      const n = {}; rec.clips.forEach(c => { n[c.tag] = (n[c.tag] || 0) + 1; });
      $('#anStats', root).innerHTML = rec.clips.length ? `<div class="an-stats">${TAGS.filter(t => n[t[0]]).map(([k, ic, l, c]) => `<span style="--c:${c}">${ic} ${esc(l)} <b>${n[k]}</b></span>`).join('')}</div>` : '';
    };
    const clipRow = (c, i) => { const t = tagOf(c.tag), ps = players();
      return `<article class="card an-clip" data-clip="${c.id}" style="--c:${t[3]}">
        <div class="an-clip-head"><b>${t[1]} ${esc(t[2])}</b><span class="muted">${mmss(c.start)} → ${mmss(c.end)} · ${Math.round(c.end - c.start)} s</span><span class="grow"></span>
          <button class="btn soft" data-play="${c.id}">${I.play}<span>Voir</span></button></div>
        <div class="chips an-edit"><button class="chip" data-in="${c.id}">⇤ Début ici</button><button class="chip" data-out="${c.id}">Fin ici ⇥</button>
          <select class="add-select" data-retag="${c.id}" aria-label="Type d'action">${TAGS.map(([k, ic, l]) => `<option value="${k}" ${k === c.tag ? 'selected' : ''}>${ic} ${esc(l)}</option>`).join('')}</select></div>
        <label class="fld"><span>Commentaire (s'affiche dans le briefing)</span><input data-note="${c.id}" value="${esc(c.note || '')}" maxlength="120" placeholder="ex : on laisse l'intervalle ouvert entre le 4 et le 5"></label>
        ${ps.length ? `<div class="chips an-players">${ps.map(p => `<button class="chip ${(c.players || []).includes(p.id) ? 'on' : ''}" data-pl="${c.id}|${p.id}">${esc(Store.shortName(p))}</button>`).join('')}</div>` : ''}
        <div class="chips"><button class="btn primary" data-teleclip="${c.id}">🎨<span>Dessins sur la vidéo${(c.draws || []).length ? ' (' + c.draws.length + ')' : ''}</span></button>${c.phase ? `<span class="an-phase">${esc(c.phase)}</span>` : ''}
          ${yt ? '' : `<button class="btn soft" data-draw="${c.id}">${I.board}<span>Tableau tactique sur l'image</span></button>`}<button class="btn soft" data-brief="${c.id}">${I.video}<span>Ajouter à un briefing</span></button>
          ${yt ? '' : `<button class="btn soft" data-share="${c.id}">${I.share}<span>Exporter</span></button>`}<button class="icon-btn danger" data-del="${c.id}" aria-label="Supprimer la séquence">${I.trash}</button></div></article>`; };
    const drawClips = () => {
      rec.clips.sort((a, b) => a.start - b.start);
      $('#anClips', root).innerHTML = rec.clips.length ? rec.clips.map(clipRow).join('') : '<p class="muted">Lance la vidéo et touche une action (But, Occasion, Perte de balle…) au moment où elle arrive : la séquence est créée toute seule.</p>';
      drawBar(); drawStats();
    };
    drawClips();
    // the match was followed live: its events become sequences once the kick-off is found in the video
    const drawLive = () => {
      const box = $('#anLive', root), m = match(); if (!box) return;
      if (!m || !m.live || !m.live.events.length || !m.live.periods.length) { box.innerHTML = ''; return; }
      const n = rec.ko1 != null ? Live.videoClips(m, rec, rec.ko1, rec.ko2).length : m.live.events.length;
      box.innerHTML = `<section class="card an-livebox"><h2>📱 Séquences du match en direct</h2>
        <p class="muted small">Ce match a été suivi en direct (${m.live.events.length} événement${m.live.events.length > 1 ? 's' : ''}). Mets la vidéo sur le coup d'envoi et touche le bouton : l'appli place chaque but, occasion ou carton au bon moment de la vidéo.</p>
        <div class="chips"><button class="btn soft" data-ko="1">⏱ C'est le coup d'envoi${rec.ko1 != null ? ' (' + mmss(rec.ko1) + ')' : ''}</button>
        ${m.live.periods[1] ? `<button class="btn soft" data-ko="2">⏱ C'est la reprise${rec.ko2 != null ? ' (' + mmss(rec.ko2) + ')' : ' (facultatif)'}</button>` : ''}
        <button class="btn primary" data-livegen ${rec.ko1 == null || !n ? 'disabled' : ''}>🎬 Créer les séquences (${n})</button></div></section>`;
    };
    drawLive();
    let stopAt = null;
    // a video recorded in a browser may not know its length until the end has been read once
    v.onloadedmetadata = () => { if (v.duration === Infinity) { v.currentTime = 1e7; v.ondurationchange = () => { if (isFinite(v.duration)) { v.ondurationchange = null; v.currentTime = 0; drawBar(); } }; } drawBar(); };
    v.ontimeupdate = () => {
      $('#anTime', root).textContent = mmss(v.currentTime) + (isFinite(v.duration) ? ' / ' + mmss(v.duration) : '');
      const p = $('#anPos', root); if (p && isFinite(v.duration) && v.duration) p.style.left = v.currentTime / v.duration * 100 + '%';
      if (stopAt !== null && v.currentTime >= stopAt) { v.pause(); stopAt = null; }
    };
    v.onplay = v.onpause = () => { $('#anPlay', root).innerHTML = v.paused ? `${I.play}<span>Lecture</span>` : `${I.pause}<span>Pause</span>`; };
    bar.onclick = e => { const m = e.target.closest('[data-seek]'); if (m) { v.currentTime = +m.dataset.seek; return; } const r = bar.getBoundingClientRect(); if (isFinite(v.duration) && v.duration) v.currentTime = (e.clientX - r.left) / r.width * v.duration; };
    $('#anMatch', root).onchange = async e => { rec.matchId = e.target.value || null; await save(); drawClips(); drawLive(); };
    root.oninput = e => { const n = e.target.dataset.note; if (n) { const c = rec.clips.find(x => x.id === n); c.note = e.target.value; clearTimeout(page.t); page.t = setTimeout(save, 500); } };
    root.onchange = async e => { const t = e.target.dataset.retag; if (t) { rec.clips.find(x => x.id === t).tag = e.target.value; await save(); drawClips(); } };
    root.onclick = async e => {
      const b = e.target.closest('button'); if (!b || b.closest('#teleBox')) return;
      const a = b.dataset.a;
      if (a === 'back') { v.pause(); return history.length > 1 ? history.back() : (location.hash = '#/bibliotheque'); }
      if (a === 'briefings') { v.pause(); return briefingsDialog(); }
      if (a === 'play') { stopAt = null; L.cancelFreeze(); return v.paused ? v.play().catch(() => {}) : v.pause(); }
      if (a === '-5' || a === '+5') { const to = v.currentTime + (a === '-5' ? -5 : 5); v.currentTime = Math.max(0, isFinite(v.duration) && v.duration ? Math.min(v.duration, to) : to); return; }
      if (a === '-f' || a === '+f') { v.pause(); v.currentTime = Math.max(0, v.currentTime + (a === '-f' ? -1 : 1) / 25); return; }
      if (a === 'pref') return prefDialog(() => page(root, id));
      if (b.dataset.rate) { v.playbackRate = +b.dataset.rate; $$('[data-rate]', root).forEach(x => x.classList.toggle('on', x === b)); return; }
      if (b.dataset.tag) {
        const t = v.currentTime, p = pref(), c = { id: Store.uid(), tag: b.dataset.tag, start: Math.max(0, t - p.before), end: Math.min(isFinite(v.duration) && v.duration ? v.duration : t + p.after, t + p.after), at: t, note: '', players: [] };
        rec.clips.push(c); await save(); drawClips();
        return toast(`${tagOf(c.tag)[1]} ${tagOf(c.tag)[2]} à ${mmss(t)} : séquence ${mmss(c.start)} → ${mmss(c.end)}`);
      }
      const clip = x => rec.clips.find(c => c.id === x);
      if (b.dataset.play) { const c = clip(b.dataset.play); v.currentTime = c.start; stopAt = c.end; v.play().catch(() => {}); v.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
      if (b.dataset.in) { const c = clip(b.dataset.in); if (v.currentTime >= c.end) return toast('Le début doit être avant la fin', 'err'); c.start = v.currentTime; await save(); return drawClips(); }
      if (b.dataset.out) { const c = clip(b.dataset.out); if (v.currentTime <= c.start) return toast('La fin doit être après le début', 'err'); c.end = v.currentTime; await save(); return drawClips(); }
      if (b.dataset.pl) { const [cid, pid] = b.dataset.pl.split('|'), c = clip(cid); c.players = (c.players || []).includes(pid) ? c.players.filter(x => x !== pid) : [...(c.players || []), pid]; b.classList.toggle('on'); return save(); }
      if (b.dataset.del) { if (await confirmBox('Supprimer cette séquence ?', 'Supprimer')) { rec.clips = rec.clips.filter(c => c.id !== b.dataset.del); await save(); drawClips(); } return; }
      if (b.dataset.ko) { rec['ko' + b.dataset.ko] = +v.currentTime.toFixed(1); await save(); toast(b.dataset.ko === '1' ? 'Coup d\'envoi placé à ' + mmss(v.currentTime) : 'Reprise placée à ' + mmss(v.currentTime)); return drawLive(); }
      if (b.hasAttribute('data-livegen')) {
        const cs = Live.videoClips(match(), rec, rec.ko1, rec.ko2); if (!cs.length) return toast('Les séquences du direct sont déjà créées');
        rec.clips.push(...cs); await save(); drawClips(); drawLive(); return toast(`${cs.length} séquence${cs.length > 1 ? 's' : ''} créée${cs.length > 1 ? 's' : ''} depuis le direct`);
      }
      if (b.dataset.teleclip) {
        // drawing on a sequence: the video stops inside it, the tools open under the player
        const c = clip(b.dataset.teleclip); stopAt = null; v.pause();
        if (v.currentTime < c.start || v.currentTime > c.end) v.currentTime = c.at != null ? c.at : c.start;
        Tele.tools($('#teleBox', root), L, () => v, c, save, yt, () => drawClips());
        $('.an-player', root).scrollIntoView({ block: 'start', behavior: 'smooth' }); return;
      }
      if (b.dataset.brief) return addToBriefing([{ mediaId: rec.id, clipId: b.dataset.brief }]);
      if (b.dataset.share) return exportVideo([{ rec, clip: clip(b.dataset.share) }], `${tagOf(clip(b.dataset.share).tag)[2]} · ${rec.name || 'match'}`);
      if (b.dataset.draw) {
        // the frame on screen if it is inside the sequence, otherwise the moment of the action
        const c = clip(b.dataset.draw); v.pause();
        if (v.currentTime < c.start || v.currentTime > c.end) { v.currentTime = c.at != null ? c.at : c.start; await new Promise(r => { v.onseeked = () => { v.onseeked = null; r(); }; setTimeout(r, 1500); }); }
        const cv = Media.drawScaled(v, v.videoWidth, v.videoHeight, 1600), blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', .88));
        const sc = await Library.drawOnFrame(blob, cv.width, cv.height, `${tagOf(c.tag)[2]} · ${mmss(v.currentTime)} · ${rec.name || 'vidéo'}`);
        location.hash = '#/schema/' + sc.id; return;
      }
    };
  }
  function prefDialog(done) {
    const p = pref();
    modal({ title: 'Longueur des séquences', body: `<p class="muted small">Quand tu touches une action, la séquence commence un peu avant (pour voir comment l'action se construit) et finit un peu après.</p>
      <div class="row2"><label class="fld"><span>Secondes avant</span><input id="pB" type="number" min="0" max="60" value="${p.before}"></label><label class="fld"><span>Secondes après</span><input id="pA" type="number" min="0" max="60" value="${p.after}"></label></div>`,
      actions: [{ label: 'Annuler' }, { label: 'Enregistrer', kind: 'primary', onClick: (c, r) => { S().ui.clipPref = { before: Math.max(0, Math.min(60, +$('#pB', r).value || 0)), after: Math.max(0, Math.min(60, +$('#pA', r).value || 0)) }; Store.persistNow(); done && done(); } }] });
  }

  /* ---------- briefings (this device) ---------- */
  function addToBriefing(items) {
    const list = briefings();
    modal({ title: 'Ajouter à un briefing', body: `${list.length ? `<label class="fld"><span>Briefing</span><select id="bSel">${list.map(b => `<option value="${b.id}">${esc(b.name)} (${b.items.length})</option>`).join('')}<option value="">+ Nouveau briefing…</option></select></label>` : ''}
      <label class="fld" id="bNewBox" ${list.length ? 'hidden' : ''}><span>Nom du nouveau briefing</span><input id="bNew" maxlength="60" placeholder="ex : Seniors · causerie samedi"></label>`,
      onOpen: r => { const s = $('#bSel', r); if (s) s.onchange = () => { $('#bNewBox', r).hidden = !!s.value; }; },
      actions: [{ label: 'Annuler' }, { label: 'Ajouter', kind: 'primary', onClick: (c, r) => {
        const all = briefings(), sel = $('#bSel', r) ? $('#bSel', r).value : '';
        let b = sel && all.find(x => x.id === sel);
        if (!b) { const name = $('#bNew', r).value.trim(); if (!name) { toast('Donne un nom au briefing', 'err'); return false; } b = { id: Store.uid(), name, items: [], at: Date.now() }; all.unshift(b); }
        items.forEach(it => { if (!b.items.some(x => x.clipId === it.clipId)) b.items.push(it); });
        saveBriefings(all); toast(`Ajouté au briefing « ${b.name} » (${b.items.length} séquence${b.items.length > 1 ? 's' : ''})`);
      } }] });
  }
  // the clips of a briefing, with their video (a video removed from the device is skipped)
  async function resolve(b) {
    const out = [], cache = {};
    for (const it of b.items) {
      const rec = cache[it.mediaId] || (cache[it.mediaId] = await Media.get(it.mediaId));
      const clip = rec && (rec.clips || []).find(c => c.id === it.clipId);
      if (clip) out.push({ rec, clip });
    }
    return out;
  }
  function briefingsDialog() {
    const list = briefings();
    const close = modal({ title: 'Briefings vidéo', noFocus: true, body: `${list.length ? `<div class="list">${list.map(b => `<div class="list-item bf-item"><span class="li-main"><b>${esc(b.name)}</b><span class="muted">${b.items.length} séquence${b.items.length > 1 ? 's' : ''}</span></span>
        <button class="icon-btn" data-bdl="${b.id}" aria-label="Télécharger ${esc(b.name)}" title="Télécharger">${I.download}</button><button class="btn primary" data-bopen="${b.id}">${I.play}<span>Ouvrir</span></button></div>`).join('')}</div>` : '<p class="muted">Pas encore de briefing. Dans une analyse, touche « Ajouter à un briefing » sous une séquence.</p>'}
        <button class="btn soft wide" data-bimport style="margin-top:12px">${I.upload}<span>Importer un briefing (fichier .raincy-briefing)</span></button>
        <p class="muted small">Un briefing téléchargé depuis un autre téléphone, une tablette ou un ordinateur se rouvre ici, avec ses vidéos et ses séquences.</p>`,
      onOpen: r => {
        $$('[data-bopen]', r).forEach(x => x.onclick = () => { close(); location.hash = '#/briefing/' + x.dataset.bopen; });
        $$('[data-bdl]', r).forEach(x => x.onclick = () => { const b = briefings().find(y => y.id === x.dataset.bdl); close(); if (b) setTimeout(() => downloadDialog(b), 60); });
        $('[data-bimport]', r).onclick = () => { close(); pickBriefingFile(); };
      } });
  }

  /* ---------- a briefing on another device: one file with the briefing, its sequences and its videos ----------
     « RAINCYBRIEF1 », the size of the description, the description (JSON), then the videos one after the other.
     The file is shared like any other (Fichiers, Drive, WhatsApp, AirDrop, clé USB, ordinateur) and imported with « Importer un briefing ». */
  const MAGIC = 'RAINCYBRIEF1\n';
  const mo = n => n > 1048576 ? Math.round(n / 1048576) + ' Mo' : Math.max(1, Math.round(n / 1024)) + ' Ko';
  async function mediaOf(b) {
    const ids = [...new Set(b.items.map(it => it.mediaId))], out = [];
    for (const id of ids) { const r = await Media.get(id); if (r) out.push(r); }
    return out;
  }
  async function downloadDialog(b) {
    const recs = await mediaOf(b), size = recs.reduce((a, r) => a + (r.blob ? r.blob.size : 0), 0), nYT = recs.filter(isYT).length;
    modal({ title: `Télécharger « ${b.name} »`, noFocus: true, body: `<div class="src-list">
      <button class="src-btn" data-dl="file">${I.layers}<span><b>Briefing à rouvrir dans l'appli</b><span class="muted small">Un fichier (${mo(size)}) avec les vidéos, les séquences, les commentaires et les joueurs. Enregistre-le dans Fichiers, Google Drive, sur une clé USB ou un ordinateur, puis rouvre-le sur un autre appareil avec « Briefings → Importer un briefing ».${nYT ? ' Les vidéos YouTube restent des liens : il faudra internet pour les voir.' : ''}</span></span></button>
      <button class="src-btn" data-dl="video">${I.video}<span><b>Vidéo à regarder partout</b><span class="muted small">Un seul fichier vidéo avec les titres et les commentaires, lisible sur n'importe quel téléphone, ordinateur ou télé. Il ne se modifie plus.${nYT ? ' Les séquences YouTube n\'y seront pas.' : ''}</span></span></button></div>`,
      onOpen: (r, close) => $$('[data-dl]', r).forEach(x => x.onclick = async () => {
        close();
        if (x.dataset.dl === 'video') { const items = await resolve(b); return items.length ? exportVideo(items, b.name) : toast('Aucune séquence à mettre dans la vidéo', 'err'); }
        packBriefing(b, recs);
      }),
      actions: [{ label: 'Fermer' }] });
  }
  async function packBriefing(b, recs) {
    const withBlob = recs.filter(r => r.blob);
    const head = JSON.stringify({ v: 1, name: b.name, at: Date.now(), club: S().club.name || '', items: b.items,
      media: recs.map(r => ({ id: r.id, ref: r.ref, kind: r.kind, name: r.name, mime: r.mime, url: r.url, host: r.host, thumb: r.thumb, clips: r.clips || [], matchId: r.matchId || null, createdAt: r.createdAt, size: r.blob ? r.blob.size : 0 })) });
    const headBytes = new TextEncoder().encode(head);
    const file = new Blob([MAGIC, String(headBytes.length).padStart(12, '0') + '\n', headBytes, ...withBlob.map(r => r.blob)], { type: 'application/octet-stream' });
    const res = await Exporter.deliver(file, `${b.name.replace(/[^\wÀ-ÿ -]+/g, ' ').replace(/\s+/g, ' ').trim() || 'briefing'}.raincy-briefing`);
    if (res === 'downloaded') toast('Briefing enregistré dans Téléchargements');
  }
  function pickBriefingFile() {
    const inp = document.createElement('input'); inp.type = 'file';
    inp.onchange = () => { const f = inp.files && inp.files[0]; if (f) importBriefing(f); };
    inp.click();
  }
  async function importBriefing(file) {
    const task = UI.bgTask(`Import du briefing « ${file.name} »…`);
    try {
      const top = await file.slice(0, MAGIC.length + 13).text();
      if (!top.startsWith(MAGIC)) throw new Error('Ce fichier n\'est pas un briefing de l\'appli (fichier .raincy-briefing)');
      const len = parseInt(top.slice(MAGIC.length, MAGIC.length + 12), 10), start = MAGIC.length + 13;
      const head = JSON.parse(await file.slice(start, start + len).text());
      let off = start + len, n = 0;
      for (const m of head.media) {
        task.step(`Import des vidéos du briefing : ${++n} sur ${head.media.length}`, n / head.media.length);
        const blob = m.size ? file.slice(off, off + m.size, m.mime || 'video/mp4') : null; off += m.size || 0;
        const have = await Media.get(m.id);
        if (have) {
          // already on this device: only the missing sequences are added
          const ids = new Set((have.clips || []).map(c => c.id));
          have.clips = [...(have.clips || []), ...(m.clips || []).filter(c => !ids.has(c.id))];
          await Media.put(have); continue;
        }
        const rec = { id: m.id, ref: m.ref || 'lib', kind: m.kind, name: m.name, mime: m.mime, thumb: m.thumb, clips: m.clips || [], matchId: m.matchId, createdAt: m.createdAt || Date.now() };
        if (m.kind === 'link') Object.assign(rec, { url: m.url, host: m.host });
        else if (blob) rec.blob = new Blob([blob], { type: m.mime || 'video/mp4' });
        await Media.put(rec);
      }
      const all = briefings(), name = all.some(x => x.name === head.name) ? head.name + ' (importé)' : head.name;
      const b = { id: Store.uid(), name, items: head.items || [], at: Date.now() };
      all.unshift(b); saveBriefings(all);
      task.done(); toast(`Briefing « ${name} » importé`);
      location.hash = '#/briefing/' + b.id;
    } catch (e) { task.done(); toast(e.message && !/JSON/.test(e.message) ? e.message : 'Ce fichier de briefing est abîmé ou incomplet', 'err'); }
  }
  async function briefingPage(root, id) {
    freeUrl();
    const all = briefings(), b = all.find(x => x.id === id);
    if (!b) { root.innerHTML = `<div class="empty"><p>Briefing introuvable sur cet appareil.</p><a class="btn" href="#/bibliotheque">${I.back}<span>Bibliothèque</span></a></div>`; return; }
    const items = await resolve(b);
    root.innerHTML = `<header class="page-head"><div><h1>🎬 ${esc(b.name)}</h1><p class="sub">Briefing vidéo · ${items.length} séquence${items.length > 1 ? 's' : ''} · ${mmss(items.reduce((a, x) => a + x.clip.end - x.clip.start, 0))}</p></div>
      <div class="head-actions"><button class="btn" data-b="back">${I.back}<span>Retour</span></button><button class="btn" data-b="export" ${items.length ? '' : 'disabled'}>${I.download}<span>Télécharger</span></button><button class="btn primary" data-b="present" ${items.length ? '' : 'disabled'}>${I.play}<span>Présenter</span></button></div></header>
      <label class="fld"><span>Nom</span><input id="bfName" value="${esc(b.name)}" maxlength="60"></label>
      <div class="list">${items.map(({ rec, clip }, i) => { const t = tagOf(clip.tag), ps = (clip.players || []).map(pid => Store.get('players', pid)).filter(Boolean);
        return `<div class="list-item bf-row" style="--c:${t[3]}"><span class="bf-n">${i + 1}</span><span class="li-main"><b>${t[1]} ${esc(t[2])}${clip.note ? ' · ' + esc(clip.note) : ''}</b>
          <span class="muted">${esc(rec.name || 'vidéo')} · ${mmss(clip.start)} → ${mmss(clip.end)}${ps.length ? ' · ' + ps.map(p => esc(Store.shortName(p))).join(', ') : ''}</span></span>
          <button class="icon-btn" data-mv="${i}|-1" ${i ? '' : 'disabled'} aria-label="Monter">${I.up}</button><button class="icon-btn" data-mv="${i}|1" ${i < items.length - 1 ? '' : 'disabled'} aria-label="Descendre">${I.down}</button>
          <button class="icon-btn danger" data-rm="${i}" aria-label="Retirer">${I.x}</button></div>`; }).join('') || '<p class="muted">Aucune séquence (les vidéos ont peut-être été supprimées de cet appareil).</p>'}</div>
      <div class="danger-zone"><button class="btn danger" data-b="delete">${I.trash}<span>Supprimer le briefing</span></button></div>`;
    const persist = () => { const l = briefings(), i = l.findIndex(x => x.id === b.id); if (i >= 0) l[i] = b; saveBriefings(l); };
    $('#bfName', root).onchange = e => { b.name = e.target.value.trim() || b.name; persist(); };
    root.onclick = async e => {
      const x = e.target.closest('button'); if (!x) return;
      if (x.dataset.b === 'back') return history.length > 1 ? history.back() : (location.hash = '#/bibliotheque');
      if (x.dataset.b === 'present') return present(items, b.name);
      if (x.dataset.b === 'export') return downloadDialog(b);
      if (x.dataset.b === 'delete') { if (await confirmBox(`Supprimer le briefing « ${b.name} » ? Les séquences restent dans leurs vidéos.`)) { saveBriefings(briefings().filter(y => y.id !== b.id)); location.hash = '#/bibliotheque'; } return; }
      if (x.dataset.mv) { const [i, d] = x.dataset.mv.split('|').map(Number); [b.items[i], b.items[i + d]] = [b.items[i + d], b.items[i]]; persist(); return briefingPage(root, id); }
      if (x.dataset.rm) { b.items.splice(+x.dataset.rm, 1); persist(); return briefingPage(root, id); }
    };
  }

  /* ---------- full-screen presentation ---------- */
  function present(items, name) {
    const ov = document.createElement('div'); ov.className = 'an-show'; document.body.appendChild(ov);
    const urls = {}; let i = 0, v = null, stop = false, timer = null, lay = null, raf = 0;
    // one <video> for the whole briefing: the next sequence is loaded and placed on its first image while its title is shown
    const vid = document.createElement('video'); vid.playsInline = true; vid.setAttribute('playsinline', ''); vid.preload = 'auto';
    let vidSrc = null, prepTok = 0;
    const prepare = (rec, clip) => new Promise(res => {
      let to = 0; const tok = ++prepTok, done = () => { clearTimeout(to); if (tok === prepTok) vid.onloadedmetadata = vid.onseeked = vid.oncanplay = null; res(); };
      to = setTimeout(done, 8000);
      const seek = () => { vid.onseeked = () => { vid.onseeked = null; if (vid.readyState >= 3) done(); else vid.oncanplay = done; }; vid.currentTime = clip.start; };
      const u = urlOf(rec);
      if (vidSrc !== u) { vidSrc = u; vid.onloadedmetadata = seek; vid.src = u; vid.load(); }
      else if (vid.readyState >= 1) seek(); else vid.onloadedmetadata = seek;
    });
    const urlOf = rec => urls[rec.id] || (urls[rec.id] = URL.createObjectURL(rec.blob));
    const drop = () => { cancelAnimationFrame(raf); if (v) { v.ontimeupdate = v.onended = null; v.pause(); if (v.destroy) v.destroy(); } v = null; };
    const end = () => { stop = true; clearTimeout(timer); drop(); vid.removeAttribute('src'); vid.load(); Object.values(urls).forEach(u => URL.revokeObjectURL(u)); ov.remove(); document.removeEventListener('keydown', key); try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch (e) {} };
    const key = e => { if (e.key === 'Escape') end(); if (e.key === 'ArrowRight') go(i + 1); if (e.key === 'ArrowLeft') go(i - 1); if (e.key === ' ') { e.preventDefault(); if (v) v.paused ? v.play() : v.pause(); } };
    document.addEventListener('keydown', key);
    try { const d = document.documentElement, p = (d.requestFullscreen || d.webkitRequestFullscreen || (() => {})).call(d); if (p && p.catch) p.catch(() => {}); } catch (e) {}
    function go(n) {
      if (stop) return; clearTimeout(timer); drop();
      if (n < 0) n = 0;
      if (n >= items.length) { ov.innerHTML = `<div class="an-card"><p>Fin du briefing</p><h2>${esc(name)}</h2><button class="btn primary" data-x="again">${I.rotate}<span>Revoir</span></button><button class="btn" data-x="close">Fermer</button></div>`; return; }
      i = n; const { rec, clip } = items[i], t = tagOf(clip.tag), ps = (clip.players || []).map(pid => Store.get('players', pid)).filter(Boolean);
      const caption = `<b>${t[1]} ${esc(t[2])}</b>${clip.note ? ' · ' + esc(clip.note) : ''}${ps.length ? `<span>${ps.map(p => esc(Store.shortName(p))).join(', ')}</span>` : ''}`;
      // a title card, then the sequence
      ov.innerHTML = `<div class="an-card" style="--c:${t[3]}"><p>${i + 1} / ${items.length}</p><h2>${t[1]} ${esc(t[2])}</h2>${clip.note ? `<p class="an-note">${esc(clip.note)}</p>` : ''}</div>`;
      const at = i, yt = isYT(rec), ready = yt ? Promise.resolve() : prepare(rec, clip);
      timer = setTimeout(async () => {
        await ready;
        if (stop || i !== at) return;
        ov.innerHTML = `${yt ? '<div class="an-ytbox an-show-yt"></div>' : '<video playsinline></video>'}<div class="an-cap">${caption}</div>
          <div class="an-show-ctrl"><button class="icon-btn" data-x="prev" aria-label="Précédente">${I.back}</button><button class="icon-btn" data-x="pause" aria-label="Pause">${I.pause}</button>
          <span>${i + 1} / ${items.length}</span><button class="icon-btn" data-x="next" aria-label="Suivante">${I.next}</button><button class="icon-btn" data-x="close" aria-label="Fermer">${I.x}</button></div>`;
        // the drawings of the sequence over the video (projecteur, anneaux, vision, étiquettes…), the phase title at the top
        if (!yt) $('video', ov).replaceWith(vid);
        lay = Tele.layer(ov, () => $(yt ? '.an-ytbox' : 'video', ov), () => v, () => [clip], { phaseTop: true });
        const run = p => {
          v = p;
          p.ontimeupdate = () => { if (p.currentTime >= clip.end) { p.ontimeupdate = p.onended = null; p.pause(); go(i + 1); } };
          p.onended = () => { p.ontimeupdate = p.onended = null; go(i + 1); };
          // a file video: the end of the sequence is checked at every image (not 4 times a second), so it stops exactly at its end
          if (!yt) { const watch = () => { if (v !== p || stop) return; if (p.currentTime >= clip.end - .04) { p.ontimeupdate = p.onended = null; p.pause(); return go(i + 1); } raf = requestAnimationFrame(watch); }; raf = requestAnimationFrame(watch); }
        };
        if (yt) {
          ytPlayer($('.an-ytbox', ov), ytId(rec.url)).then(p => {
            if (stop || i !== at) return p.destroy();
            run(p); p.currentTime = clip.start; p.play();
            // with the sound when the browser allows it, otherwise muted
            setTimeout(() => { if (v === p && p.paused && p.currentTime < clip.start + .5) { p.muted = true; p.play(); } }, 1500);
          }).catch(e => { if (!stop && i === at) { toast(ytError(e), 'err'); go(i + 1); } });
          return;
        }
        // the video is already on the first image of the sequence: it starts at once, with the sound when the browser allows it
        if (Math.abs(vid.currentTime - clip.start) > .3) vid.currentTime = clip.start;
        run(vid); vid.play().catch(() => { vid.muted = true; vid.play().catch(() => {}); });
      }, 1800);
    }
    ov.onclick = e => {
      const b = e.target.closest('[data-x]'); if (!b) return;
      const x = b.dataset.x;
      if (x === 'close') return end();
      if (x === 'again') return go(0);
      if (x === 'next') return go(i + 1);
      if (x === 'prev') return go(i - 1);
      if (x === 'pause' && v) { if (lay) lay.cancelFreeze(); if (v.paused) { v.play(); b.innerHTML = I.pause; } else { v.pause(); b.innerHTML = I.play; } }
    };
    go(0);
  }

  /* ---------- one video file (share on WhatsApp): title cards + the sequences, with their caption ---------- */
  function pickMime() {
    const list = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    if (!window.MediaRecorder) return null;
    return list.find(m => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } }) || '';
  }
  async function exportVideo(items, name) {
    if (!Exporter.canVideo()) return toast('Cet appareil ne sait pas créer de vidéo depuis l\'appli : utilise « Présenter » avec l\'enregistrement d\'écran.', 'err');
    // YouTube never lets a page copy its images: its sequences stay out of the file
    const nYT = items.filter(x => isYT(x.rec)).length;
    items = items.filter(x => !isYT(x.rec));
    if (!items.length) return toast('Ces séquences viennent de YouTube : YouTube ne laisse pas en faire un fichier vidéo. Utilise « Présenter », ou importe la vidéo elle-même dans la Bibliothèque.', 'err');
    if (nYT) toast(`${nYT} séquence${nYT > 1 ? 's' : ''} YouTube ne ${nYT > 1 ? 'seront' : 'sera'} pas dans le fichier (YouTube ne le permet pas)`);
    const total = items.reduce((a, x) => a + (x.clip.end - x.clip.start) + 1.8, 2.2);
    if (!(await confirmBox(`Créer la vidéo « ${name} » (${mmss(total)}) ? Garde l'appli ouverte pendant la création, qui dure à peu près le temps de la vidéo.`, 'Créer la vidéo'))) return;
    const bz = UI.busy('Création de la vidéo… garde l\'appli ouverte');
    const W = 1280, H = 720, c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    /* MP4 (H.264) when the browser can: plays on every phone, computer and TV. Each image is put in the file at its exact time.
       Otherwise the browser records the canvas itself (MediaRecorder: MP4 on Safari, sometimes WebM elsewhere). */
    const wr = await Exporter.mp4Writer(W, H, 30);
    let rec = null, chunks = [], stopped = null, mime = null;
    if (!wr) {
      mime = Exporter.pickMime();
      rec = new MediaRecorder(c.captureStream(30), Object.assign({ videoBitsPerSecond: 5e6 }, mime ? { mimeType: mime } : {}));
      rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      stopped = new Promise(r => { rec.onstop = r; });
    }
    // the video plays in the page (hidden) so every browser decodes its images
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.style.cssText = 'position:fixed;left:-10px;top:0;width:2px;height:2px;opacity:0';
    document.body.appendChild(v);
    const urls = [];
    const wrap = (text, maxW, font) => { ctx.font = font; const words = String(text).split(/\s+/), lines = []; let l = ''; words.forEach(w => { const t = l ? l + ' ' + w : w; if (ctx.measureText(t).width > maxW && l) { lines.push(l); l = w; } else l = t; }); if (l) lines.push(l); return lines; };
    const drawCard = (color, top, title, sub) => {
      ctx.fillStyle = '#0e1d45'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = color || '#8c1024'; ctx.fillRect(0, H - 14, W, 14);
      ctx.fillStyle = '#e2c27d'; ctx.font = '600 30px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(top, W / 2, H / 2 - 80);
      ctx.fillStyle = '#fff'; wrap(title, W - 160, '800 58px system-ui, sans-serif').slice(0, 2).forEach((l, k) => ctx.fillText(l, W / 2, H / 2 + k * 66));
      if (sub) { ctx.fillStyle = '#cbd5e1'; wrap(sub, W - 200, '500 32px system-ui, sans-serif').slice(0, 3).forEach((l, k) => ctx.fillText(l, W / 2, H / 2 + 110 + k * 42)); }
    };
    const card = async (color, top, title, sub, ms) => {
      drawCard(color, top, title, sub);
      // MP4: the title card is written at once (no need to wait); recorder: it stays on screen for its time
      if (wr) { const n = Math.round(ms / 1000 * wr.fps); for (let i = 0; i < n; i++) await wr.frame(c); return; }
      const t0 = performance.now();
      await new Promise(res => { const tick = () => { drawCard(color, top, title, sub); if (performance.now() - t0 < ms) requestAnimationFrame(tick); else res(); }; tick(); });
    };
    try {
      if (rec) rec.start(250);
      await card('#8c1024', `${S().club.name || 'Clubbo'} · Briefing vidéo`, name, `${items.length} séquence${items.length > 1 ? 's' : ''}`, 2200);
      for (let k = 0; k < items.length; k++) {
        const { rec: m, clip } = items[k], t = tagOf(clip.tag), ps = (clip.players || []).map(pid => Store.get('players', pid)).filter(Boolean);
        bz.progress(k / items.length);
        await card(t[3], `${k + 1} / ${items.length}`, `${t[1]} ${t[2]}`, clip.note || '', 1800);
        const u = URL.createObjectURL(m.blob); urls.push(u); v.src = u;
        await new Promise(r => { v.onloadedmetadata = r; setTimeout(r, 5000); });
        v.currentTime = clip.start; await new Promise(r => { v.onseeked = r; setTimeout(r, 3000); });
        v.playbackRate = wr ? .5 : 1;
        await v.play().catch(() => {});
        const first = wr ? wr.count : 0, cap = `${t[1]} ${t[2]}${clip.note ? ' · ' + clip.note : ''}${ps.length ? ' · ' + ps.map(p => Store.shortName(p)).join(', ') : ''}`;
        // one image: the video, the drawings of the sequence (with the phase title at the top), the caption at the bottom
        const paint = ct => {
          const vw = v.videoWidth || 16, vh = v.videoHeight || 9, s = Math.min(W / vw, H / vh), dw = vw * s, dh = vh * s, box = { x: (W - dw) / 2, y: (H - dh) / 2, w: dw, h: dh };
          ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); try { ctx.drawImage(v, box.x, box.y, dw, dh); } catch (e) {}
          Tele.render(ctx, box, clip, ct, v, { phaseTop: true });
          ctx.fillStyle = 'rgba(14,29,69,.82)'; ctx.fillRect(0, H - 70, W, 70); ctx.fillStyle = t[3]; ctx.fillRect(0, H - 70, 10, 70);
          ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.font = '700 28px system-ui, sans-serif'; ctx.fillText(wrap(cap, W - 60, '700 28px system-ui, sans-serif')[0] || '', 28, H - 26);
        };
        let extra = 0, lastT = clip.start - .001;
        await new Promise((res, rej) => { const tick = async () => {
          try {
            const ct = Math.min(v.currentTime, clip.end);
            paint(ct);
            // MP4: the images follow the video's own clock (a slow phone never makes the sequence jerky or too short)
            if (wr) { const due = first + extra + Math.floor((ct - clip.start) * wr.fps); while (wr.count <= due) await wr.frame(c); }
            // « arrêt sur image » asked by a drawing: the image stays still a few seconds, with the drawing on it
            const fz = Tele.freezesBetween(clip, lastT, ct); lastT = ct;
            if (fz.length) {
              v.pause(); const secs = Math.max(...fz.map(d => d.freeze));
              if (wr) { const n = Math.round(secs * wr.fps); for (let k = 0; k < n; k++) await wr.frame(c); extra += n; }
              else await new Promise(r => setTimeout(r, secs * 1000));
              if (ct < clip.end) await v.play().catch(() => {});
            }
            if (v.currentTime >= clip.end || v.ended) { v.pause(); return res(); }
            requestAnimationFrame(tick);
          } catch (e) { rej(e); } }; tick(); });
      }
      await card('#8c1024', S().club.name || 'Clubbo', 'Fin du briefing', '', 1200);
      let blob;
      if (wr) blob = await wr.finish();
      else { rec.stop(); await stopped; blob = new Blob(chunks, { type: (rec.mimeType || mime || 'video/webm').split(';')[0] }); }
      bz.done();
      const mp4 = blob.type.includes('mp4');
      const r = await Exporter.deliver(blob, `${name.replace(/[^\wÀ-ÿ -]+/g, ' ').replace(/\s+/g, ' ').trim() || 'briefing'}.${mp4 ? 'mp4' : 'webm'}`);
      if (!mp4) toast('Ce navigateur ne sait faire qu\'une vidéo WebM (lisible sur ordinateur, pas toujours sur iPhone ni sur une télé). Pour un MP4 lisible partout : Chrome, Edge ou Safari à jour.', 'err');
      else if (r === 'downloaded') toast('Vidéo MP4 enregistrée dans Téléchargements');
    } catch (e) { bz.done(); if (wr) wr.cancel(); try { rec && rec.state !== 'inactive' && rec.stop(); } catch (e2) {} toast('La vidéo n\'a pas pu être créée : ' + (e.message || e), 'err'); }
    finally { v.remove(); urls.forEach(u => URL.revokeObjectURL(u)); }
  }

  // Library page: the briefings of this device
  function libraryCard() {
    const list = briefings();
    return `<section class="card"><div class="row-head"><h2>${I.video}Briefings vidéo</h2><button class="btn soft" data-anbrief>${I.layers}<span>Mes briefings (${list.length})</span></button></div>
      <p class="muted small">Ouvre une vidéo de match puis « Analyser » : marque les actions (but, occasion, perte de balle…), puis rassemble les séquences dans un briefing à présenter ou à envoyer en vidéo.</p></section>`;
  }
  return { page, briefingPage, briefingsDialog, libraryCard, importBriefing, TAGS, isYT, mmss, leave: freeUrl };
})();
