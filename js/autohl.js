/* (1.88) Highlights made by the app (coach, page of a match → Highlights → « 🤖 Créer automatiquement »).
   Two sources, merged:
   - the sound of the match video (a file on the coach's device, read on the device, nothing sent): the moments where the noise jumps
     (shouts, whistles, applause) above the usual level of the minute around them;
   - the actions noted during the live match (goals of both teams, chances, post, saves, cards), placed in the video
     thanks to the time of the kick-off in the video.
   The coach checks the proposals (a preview of each one), names them (goal, chance, post… us or them) and adds them to the highlights,
   with the online link of the same video (YouTube, Drive…) so the players can watch them. */
const AutoHL = (() => {
  const { esc, toast, modal } = UI;
  const MP4BOX = 'https://cdn.jsdelivr.net/npm/mp4box@0.5.2/dist/mp4box.all.min.js';
  const BIN = 0.5; // seconds per loudness value
  const loadScript = src => new Promise((ok, ko) => { if (window.MP4Box) return ok(); const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ko(new Error('Pas de connexion internet pour charger l\'outil d\'analyse.')); document.head.appendChild(s); });
  const mmss = n => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;

  /* ---------- 1. the loudness of the sound, every half second (MP4 / MOV: the audio track only is decoded) ---------- */
  async function loudness(file, progress) {
    await loadScript(MP4BOX);
    if (typeof AudioDecoder === 'undefined') throw new Error('Ton navigateur ne sait pas analyser le son : utilise Chrome ou Edge à jour (ou Safari récent).');
    return new Promise((resolve, reject) => {
      const mp = MP4Box.createFile(), sums = [], cnts = [];
      let track = null, decoder = null, total = 1, got = 0, finished = false, failed = false;
      const fail = e => { if (failed || finished) return; failed = true; reject(e instanceof Error ? e : new Error(String(e))); };
      const finish = async () => {
        if (finished || failed) return; finished = true;
        try { if (decoder && decoder.state === 'configured') await decoder.flush(); } catch (e) {}
        const db = sums.map((s, i) => 10 * Math.log10((s || 0) / Math.max(1, cnts[i] || 0) + 1e-10));
        resolve(db);
      };
      mp.onError = e => fail(new Error('Vidéo illisible (' + e + '). Utilise un fichier MP4 ou MOV.'));
      mp.onReady = info => {
        track = (info.audioTracks || [])[0]; if (!track) return fail(new Error('Cette vidéo n\'a pas de son : impossible de repérer les moments forts au bruit.'));
        total = track.nb_samples || 1;
        let desc; try { const en = mp.getTrackById(track.id).mdia.minf.stbl.stsd.entries[0]; desc = en.esds.esd.descs[0].descs[0].data; } catch (e) {}
        decoder = new AudioDecoder({
          output: ad => {
            try {
              const n = ad.numberOfFrames, a = new Float32Array(n); ad.copyTo(a, { planeIndex: 0, format: 'f32-planar' });
              const t0 = ad.timestamp / 1e6, sr = ad.sampleRate, step = Math.max(1, Math.floor(sr * BIN / 8));
              for (let i = 0; i < n; i += 4) { const b = Math.floor((t0 + i / sr) / BIN); sums[b] = (sums[b] || 0) + a[i] * a[i]; cnts[b] = (cnts[b] || 0) + 1; }
              void step;
            } catch (e) {} finally { ad.close(); }
          }, error: e => fail(new Error('Son illisible : ' + e.message)) });
        try { decoder.configure({ codec: track.codec, sampleRate: track.audio.sample_rate, numberOfChannels: track.audio.channel_count, description: desc }); }
        catch (e) { return fail(new Error('Format du son non pris en charge (' + track.codec + ').')); }
        mp.setExtractionOptions(track.id, null, { nbSamples: 400 }); mp.start();
      };
      mp.onSamples = (id, user, samples) => {
        for (const s of samples) { try { decoder.decode(new EncodedAudioChunk({ type: 'key', timestamp: Math.round(s.cts * 1e6 / s.timescale), duration: Math.round(s.duration * 1e6 / s.timescale), data: s.data })); } catch (e) {} }
        got += samples.length; mp.releaseUsedSamples(id, samples[samples.length - 1].number + 1);
        progress(Math.min(0.99, got / total)); if (got >= total) finish();
      };
      // the file is given piece by piece (a match is several GB): MP4Box says where to read next (it jumps over the images)
      (async () => {
        const CH = 4 << 20; let off = 0, same = 0;
        while (off < file.size && !finished && !failed) {
          const buf = await file.slice(off, off + CH).arrayBuffer(); buf.fileStart = off;
          const next = mp.appendBuffer(buf);
          if (typeof next === 'number' && next !== off) { off = next; same = 0; } else { off += buf.byteLength; if (++same > 3) off += CH; }
          if (!track) progress(Math.min(0.2, off / file.size / 5));
        }
        mp.flush(); setTimeout(finish, 400);
      })().catch(fail);
    });
  }

  /* ---------- 2. the loud moments: well above the level of the minute around them ---------- */
  function peaks(db, max = 22) {
    const n = db.length; if (n < 20) return [];
    const W = Math.round(30 / BIN), base = new Array(n), sm = new Array(n);
    for (let i = 0; i < n; i++) { const w = db.slice(Math.max(0, i - W), Math.min(n, i + W)).filter(Number.isFinite).sort((a, b) => a - b); base[i] = w[Math.floor(w.length / 2)] || -100; }
    for (let i = 0; i < n; i++) { let s = 0, c = 0; for (let j = i - 1; j <= i + 1; j++) if (j >= 0 && j < n && Number.isFinite(db[j])) { s += db[j]; c++; } sm[i] = c ? s / c - base[i] : 0; }
    const cand = []; for (let i = 1; i < n - 1; i++) if (sm[i] >= 5 && sm[i] >= sm[i - 1] && sm[i] >= sm[i + 1]) cand.push({ t: i * BIN, score: sm[i] });
    cand.sort((a, b) => b.score - a.score); const out = [];
    for (const c of cand) { if (out.length >= max) break; if (out.every(o => Math.abs(o.t - c.t) > 40)) out.push(c); }
    return out.sort((a, b) => a.t - b.t);
  }

  /* ---------- 3. the actions noted live, placed in the video ---------- */
  const KEEP = { chance: ['chance', '🎯 Occasion'], post: ['post', '🥅 Poteau / barre'], chanceThem: ['chanceThem', '⚠️ Occasion adverse'], save: ['save', '🧤 Arrêt'], yellow: ['card', '🟨 Carton'], red: ['card', '🟥 Carton rouge'] };
  function liveMoments(m, k1, k2) {
    const l = m.live || {}, per = l.periods || [], evs = (l.events || []).slice().sort((a, b) => a.wall - b.wall), out = [];
    if (k1 == null) return out;
    const kick = p => p === 2 && k2 != null ? k2 : p > 1 && per[p - 1] && per[0] ? k1 + (per[p - 1].start - per[0].start) / 1000 : k1;
    evs.forEach(e => {
      const sc = Sport.scoreOf(e.type), keep = KEEP[e.type]; if (!sc && !keep) return;
      const p = e.period || 1, start = per[p - 1] && per[p - 1].start;
      const tv = start && e.wall ? kick(p) + (e.wall - start) / 1000 : k1 + (+e.min || 0) * 60;
      const who = e.player ? Store.shortName(Store.get('players', e.player) || {}) : '';
      out.push({ t: Math.max(0, tv), src: 'live', kind: sc ? (sc.us ? 'goalUs' : 'goalThem') : keep[0], title: sc ? (sc.us ? `⚽ But${who ? ' de ' + who : ''}` : '⚽ But adverse') : `${keep[1]}${who ? ' · ' + who : ''}`, min: e.min });
    });
    return out;
  }

  /* ---------- 4. the window: the video, the proposals, the check ---------- */
  const KINDS = [['goalUs', '⚽ But (nous)'], ['goalThem', '⚽ But (eux)'], ['chance', '🎯 Occasion (nous)'], ['chanceThem', '⚠️ Occasion (eux)'], ['post', '🥅 Poteau'], ['save', '🧤 Arrêt'], ['card', '🟨 Carton']];
  const BEFORE = { live: 12, sound: 15 }; // the clip starts a little before the action (the noise comes after it)
  function open(m, save, done) {
    const st = { file: null, url: null, db: null, sound: [], k1: m.videoKick1 || '', k2: m.videoKick2 || '', link: m.videoUrl || '', list: [], busy: '' };
    const merge = () => {
      const live = liveMoments(m, VPlayer.secs(st.k1) || (st.k1 === '0:00' || st.k1 === '0' ? 0 : null), st.k2 ? VPlayer.secs(st.k2) : null);
      const all = [...live.map(x => Object.assign({ keep: true }, x)), ...st.sound.filter(s => live.every(l => Math.abs(l.t - s.t) > 25)).map((s, i) => ({ t: s.t, src: 'sound', kind: '', title: `🔊 Action chaude ${i + 1}`, score: s.score, keep: true }))];
      const old = {}; st.list.forEach(x => { old[x.src + Math.round(x.t)] = x; });
      st.list = all.sort((a, b) => a.t - b.t).map(x => Object.assign(x, old[x.src + Math.round(x.t)] ? { keep: old[x.src + Math.round(x.t)].keep, kind: old[x.src + Math.round(x.t)].kind || x.kind, title: old[x.src + Math.round(x.t)].title } : {}));
    };
    const hasLive = ((m.live || {}).events || []).some(e => Sport.scoreOf(e.type) || KEEP[e.type]);
    const body = () => {
      const n = st.list.filter(x => x.keep).length;
      return `<p class="muted small">Gratuit, sur ton appareil : la vidéo n'est envoyée nulle part. L'appli repère les moments où le bruit monte (cris, sifflets, applaudissements)${hasLive ? ' et place les actions notées pendant le match en direct' : ''}. Tu vérifies, tu nommes, tu ajoutes.</p>
        <div class="ahl-step"><b>1. La vidéo complète du match</b> (fichier MP4 ou MOV, même plusieurs Go)
          <label class="btn soft ahl-file">📁 ${st.file ? esc(st.file.name) : 'Choisir le fichier'}<input type="file" accept="video/mp4,video/quicktime,video/*" id="ahlFile" hidden></label>
          ${st.busy ? `<p class="ahl-busy">⏳ ${esc(st.busy)}</p>` : st.db ? `<p class="muted small">✓ Son analysé : ${st.sound.length} moment${st.sound.length > 1 ? 's' : ''} fort${st.sound.length > 1 ? 's' : ''} repéré${st.sound.length > 1 ? 's' : ''}.</p>` : ''}
          ${st.url ? `<video id="ahlVid" src="${st.url}" controls playsinline preload="metadata"></video>` : ''}</div>
        ${hasLive ? `<div class="ahl-step"><b>2. Le coup d'envoi dans la vidéo</b> <span class="muted small">(pour placer les actions du direct)</span>
          <div class="row3"><label class="fld"><span>1re mi-temps à</span><input id="ahlK1" placeholder="2:35" value="${esc(st.k1)}"></label><label class="fld"><span>2e mi-temps à (si la vidéo est coupée)</span><input id="ahlK2" placeholder="52:10" value="${esc(st.k2)}"></label>
          ${st.url ? '<div class="fld"><span>&nbsp;</span><button class="btn soft" data-ahl="k1now">⏱️ Mettre l\'instant de la vidéo</button></div>' : ''}</div></div>` : ''}
        ${st.list.length ? `<div class="ahl-step"><b>${hasLive ? 3 : 2}. Les moments proposés</b> <span class="muted small">(décoche ceux à jeter, choisis ce que c'est)</span>
          <div class="ahl-list">${st.list.map((x, i) => `<div class="ahl-row ${x.keep ? '' : 'off'}"><label class="ahl-ck"><input type="checkbox" data-ahlk="${i}" ${x.keep ? 'checked' : ''}><b>${mmss(Math.max(0, x.t - BEFORE[x.src]))}</b></label>
            ${st.url ? `<button class="btn soft ahl-play" data-ahlp="${i}">▶</button>` : ''}<input class="ahl-title" data-ahlt="${i}" value="${esc(x.title)}" maxlength="80">
            <select data-ahls="${i}"><option value="">C'est…</option>${KINDS.map(([k, l]) => `<option value="${k}" ${x.kind === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
            <span class="muted small">${x.src === 'live' ? '📱 direct' : '🔊 bruit'}</span></div>`).join('')}</div></div>` : ''}
        <div class="ahl-step"><b>${st.list.length ? (hasLive ? 4 : 3) : hasLive ? 3 : 2}. Le lien en ligne de cette même vidéo</b> <span class="muted small">(YouTube « non répertoriée », Google Drive, Dropbox… : c'est lui que les joueurs regardent)</span>
          <input id="ahlLink" class="ahl-link" inputmode="url" placeholder="https://youtu.be/…" value="${esc(st.link)}"></div>
        <p class="muted small">${n} extrait${n > 1 ? 's' : ''} sélectionné${n > 1 ? 's' : ''}.</p>`;
    };
    let root = null;
    const draw = () => { if (!root) return; const b = root.querySelector('#ahlBody'), sc = b.scrollTop; b.innerHTML = body(); b.scrollTop = sc; };
    const readInputs = () => { if (!root) return; const g = id => (root.querySelector(id) || {}).value; if (root.querySelector('#ahlK1')) { st.k1 = g('#ahlK1').trim(); st.k2 = g('#ahlK2').trim(); } if (root.querySelector('#ahlLink')) st.link = g('#ahlLink').trim(); };
    async function analyse(file) {
      if (st.url) URL.revokeObjectURL(st.url);
      st.file = file; st.url = URL.createObjectURL(file); st.db = null; st.sound = []; st.busy = 'Lecture du son… 0 %'; draw();
      try {
        let lastDraw = 0;
        st.db = await loudness(file, p => { const now = Date.now(); if (now - lastDraw > 500) { lastDraw = now; st.busy = `Lecture du son… ${Math.round(p * 100)} %`; const el = root && root.querySelector('.ahl-busy'); if (el) el.textContent = '⏳ ' + st.busy; } });
        st.sound = peaks(st.db); st.busy = ''; merge(); draw();
        if (!st.sound.length) toast('Pas de moment fort repéré au son (vidéo très calme ou sans son).');
      } catch (e) { st.busy = ''; draw(); toast(e.message || 'Analyse impossible', 'err'); }
    }
    modal({ title: '🤖 Highlights automatiques', noFocus: true, wide: true, body: `<div id="ahlBody" class="ahl">${(merge(), body())}</div>`,
      onOpen: r => {
        root = r; css();
        r.addEventListener('change', e => {
          if (e.target.id === 'ahlFile' && e.target.files[0]) return analyse(e.target.files[0]);
          const k = e.target.dataset.ahlk; if (k != null) { st.list[+k].keep = e.target.checked; return draw(); }
          const s = e.target.dataset.ahls; if (s != null) { const x = st.list[+s]; x.kind = e.target.value; const l = (KINDS.find(z => z[0] === x.kind) || [])[1]; if (l && /^🔊|^(⚽|🎯|⚠️|🥅|🧤|🟨)/.test(x.title)) x.title = l.replace(/ \((nous|eux)\)/, x.kind.endsWith('Them') ? ' adverse' : ''); return draw(); }
          if (e.target.id === 'ahlK1' || e.target.id === 'ahlK2') { readInputs(); merge(); draw(); }
        });
        r.addEventListener('input', e => { const t = e.target.dataset.ahlt; if (t != null) st.list[+t].title = e.target.value; if (e.target.id === 'ahlLink') st.link = e.target.value.trim(); });
        r.addEventListener('click', e => {
          const p = e.target.closest('[data-ahlp]'); if (p) { const v = r.querySelector('#ahlVid'), x = st.list[+p.dataset.ahlp]; if (v) { v.currentTime = Math.max(0, x.t - BEFORE[x.src]); v.play(); v.scrollIntoView({ block: 'nearest' }); } return; }
          if (e.target.closest('[data-ahl="k1now"]')) { const v = r.querySelector('#ahlVid'); if (v) { readInputs(); st.k1 = mmss(v.currentTime); merge(); draw(); } }
        });
      },
      actions: [{ label: 'Fermer' }, { label: 'Ajouter aux highlights', kind: 'primary', onClick: () => {
        readInputs();
        const keep = st.list.filter(x => x.keep);
        if (!keep.length) { toast('Aucun extrait sélectionné', 'err'); return false; }
        if (!/^https:\/\//.test(st.link)) { toast('Colle le lien en ligne de la vidéo (YouTube, Drive…) : c\'est lui que les joueurs regardent', 'err'); const i = root.querySelector('#ahlLink'); if (i) i.focus(); return false; }
        m.videoUrl = st.link; m.videoKick1 = st.k1; m.videoKick2 = st.k2;
        const have = new Set((m.highlights || []).map(c => c.url + '|' + c.t));
        const add = keep.map(x => ({ id: Math.random().toString(36).slice(2, 10), url: st.link, t: mmss(Math.max(0, x.t - BEFORE[x.src])), title: x.title, kind: x.kind || '', auto: true })).filter(c => !have.has(c.url + '|' + c.t));
        m.highlights = [...(m.highlights || []), ...add].sort((a, b) => VPlayer.secs(a.t) - VPlayer.secs(b.t));
        save(); if (st.url) URL.revokeObjectURL(st.url); done && done(); toast(`${add.length} extrait${add.length > 1 ? 's' : ''} ajouté${add.length > 1 ? 's' : ''} : vérifie, puis « Envoyer aux joueurs » 🎬`);
      } }] });
  }
  function css() {
    if (document.getElementById('ahlCss')) return;
    const s = document.createElement('style'); s.id = 'ahlCss';
    s.textContent = '.ahl-step{margin:12px 0;padding:10px 12px;border:1px solid var(--line);border-radius:12px}.ahl-step>b{display:block;margin-bottom:6px}.ahl-file{display:inline-flex;cursor:pointer;margin:4px 0}'
      + '.ahl video{width:100%;max-height:44vh;background:#000;border-radius:10px;margin-top:8px}.ahl-busy{font-weight:700}.ahl-list{display:grid;gap:6px;max-height:46vh;overflow:auto}'
      + '.ahl-row{display:grid;grid-template-columns:auto auto minmax(140px,1fr) minmax(0,150px) auto;gap:6px;align-items:center;padding:6px;border-radius:10px;background:var(--bg)}.ahl-row.off{opacity:.45}.ahl-ck{display:flex;gap:6px;align-items:center;white-space:nowrap}'
      + '.ahl-title,.ahl-row select,.ahl-link{min-height:38px;border-radius:10px;border:1px solid var(--line);padding:0 8px;font:inherit;background:var(--surface);color:var(--ink);min-width:0}.ahl-link{width:100%;box-sizing:border-box}'
      + '@media (max-width:640px){.ahl-row{grid-template-columns:auto auto 1fr}.ahl-row select{grid-column:1/3}.ahl-row>span{grid-column:3}}';
    document.head.appendChild(s);
  }
  return { open, loudness, peaks, liveMoments };
})();
