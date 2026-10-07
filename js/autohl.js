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
  /* (1.93) the whole match, for sure: the index of the video first (a phone writes it at the END of the file: MP4Box says where to
     jump), then every audio frame read where the index says it is, in pieces of 4 Mo, decoded with a short queue. The old streaming
     reading below lost the end of the match (only 56 % of a 10 min test video, 2 loud moments out of 4); it stays for the videos
     cut in fragments (no sample table). */
  async function loudness(file, progress) {
    await loadScript(MP4BOX);
    if (typeof AudioDecoder === 'undefined') throw new Error('Ton navigateur ne sait pas analyser le son : utilise Chrome ou Edge à jour (ou Safari récent).');
    const mp = MP4Box.createFile(); let info = null, err = null;
    mp.onReady = i => { info = i; }; mp.onError = e => { err = e; };
    const CH = 4 << 20; let off = 0, n = 0;
    while (!info && !err && off < file.size && n++ < 2000) {
      const buf = await file.slice(off, off + CH).arrayBuffer(); buf.fileStart = off;
      const next = mp.appendBuffer(buf);
      off = typeof next === 'number' && next > off ? next : off + buf.byteLength;
      progress(Math.min(0.04, 0.04 * off / file.size));
    }
    if (err) throw new Error('Vidéo illisible (' + err + '). Utilise un fichier MP4 ou MOV.');
    if (!info) throw new Error('Vidéo illisible : son index est introuvable. Utilise un fichier MP4 ou MOV.');
    const track = (info.audioTracks || [])[0]; if (!track) throw new Error('Cette vidéo n\'a pas de son : impossible de repérer les moments forts au bruit.');
    const samples = ((mp.getTrackSamplesInfo && mp.getTrackSamplesInfo(track.id)) || []).filter(s => s.size > 0 && s.offset >= 0);
    if (!samples.length) return loudnessStream(file, progress); // fragmented video: no sample table
    let desc; try { const en = mp.getTrackById(track.id).mdia.minf.stbl.stsd.entries[0]; desc = en.esds.esd.descs[0].descs[0].data; } catch (e) {}
    const sums = [], cnts = []; let derr = null;
    const decoder = new AudioDecoder({
      output: ad => { try { const k = ad.numberOfFrames, a = new Float32Array(k); ad.copyTo(a, { planeIndex: 0, format: 'f32-planar' });
          const t0 = ad.timestamp / 1e6, sr = ad.sampleRate;
          for (let i = 0; i < k; i += 4) { const b = Math.floor((t0 + i / sr) / BIN); sums[b] = (sums[b] || 0) + a[i] * a[i]; cnts[b] = (cnts[b] || 0) + 1; } } catch (e) {} finally { ad.close(); } },
      error: e => { derr = e; } });
    try { decoder.configure({ codec: track.codec, sampleRate: track.audio.sample_rate, numberOfChannels: track.audio.channel_count, description: desc }); }
    catch (e) { throw new Error('Format du son non pris en charge (' + track.codec + ').'); }
    let i = 0;
    while (i < samples.length) {
      if (derr) throw new Error('Son illisible : ' + derr.message);
      const start = samples[i].offset; let j = i;
      while (j < samples.length && samples[j].offset >= start && samples[j].offset + samples[j].size - start <= CH && j - i < 3000) j++;
      if (j === i) j = i + 1;
      const end = Math.max(...samples.slice(i, j).map(s => s.offset + s.size)), buf = new Uint8Array(await file.slice(start, end).arrayBuffer());
      for (let q = i; q < j; q++) { const s = samples[q];
        try { decoder.decode(new EncodedAudioChunk({ type: 'key', timestamp: Math.round(s.cts * 1e6 / s.timescale), duration: Math.round(s.duration * 1e6 / s.timescale), data: buf.subarray(s.offset - start, s.offset - start + s.size) })); } catch (e) {} }
      i = j; progress(0.04 + 0.95 * i / samples.length);
      while (decoder.decodeQueueSize > 200) await new Promise(r => setTimeout(r, 4));
    }
    try { await decoder.flush(); } catch (e) {} try { decoder.close(); } catch (e) {}
    return Array.from({ length: sums.length }, (_, b) => 10 * Math.log10((sums[b] || 0) / Math.max(1, cnts[b] || 0) + 1e-10));
  }
  async function loudnessStream(file, progress) {
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
  /* ---------- (1.90) 5. the analysis by artificial intelligence (Google Gemini), paid by the coach himself at Google ----------
     His own key (Google AI Studio: a free quota, then Google bills him), kept on this device only. Gemini watches the video
     (a YouTube link, or the file up to 2 GB) and gives the moments of both teams. Nothing goes through the club's server. */
  const GKEY = () => AppCfg.key('gemini-key');
  const gKey = () => { try { return localStorage.getItem(GKEY()) || ''; } catch (e) { return ''; } };
  const setGKey = k => { try { k ? localStorage.setItem(GKEY(), k) : localStorage.removeItem(GKEY()); } catch (e) {} };
  const GAPI = 'https://generativelanguage.googleapis.com';
  const MODELS = ['gemini-flash-latest', 'gemini-2.5-flash'];
  async function gUpload(file, key, progress) {
    if (file.size > 2e9) throw new Error('Fichier de plus de 2 Go : Gemini ne le prend pas. Mets la vidéo sur YouTube (« non répertoriée » ne marche pas : « publique ») ou coupe-la en deux mi-temps.');
    const type = file.type || 'video/mp4';
    const s = await fetch(GAPI + '/upload/v1beta/files', { method: 'POST', headers: { 'x-goog-api-key': key, 'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start', 'X-Goog-Upload-Header-Content-Length': String(file.size), 'X-Goog-Upload-Header-Content-Type': type, 'Content-Type': 'application/json' }, body: JSON.stringify({ file: { display_name: 'match' } }) });
    if (!s.ok) throw new Error(await gErr(s));
    const up = s.headers.get('x-goog-upload-url'); if (!up) throw new Error('Envoi refusé par Google.');
    progress('Envoi de la vidéo chez Google… (plusieurs minutes pour un match entier)');
    const r = await fetch(up, { method: 'POST', headers: { 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' }, body: file });
    if (!r.ok) throw new Error(await gErr(r));
    let fl = (await r.json()).file;
    for (let i = 0; i < 180 && fl.state !== 'ACTIVE'; i++) {
      if (fl.state === 'FAILED') throw new Error('Google n\'a pas pu lire la vidéo.');
      progress('Google prépare la vidéo…'); await new Promise(z => setTimeout(z, 5000));
      fl = await (await fetch(GAPI + '/v1beta/' + fl.name, { headers: { 'x-goog-api-key': key } })).json();
    }
    return { uri: fl.uri, mime: fl.mimeType || type };
  }
  async function gErr(r) { let m = ''; try { m = ((await r.json()).error || {}).message || ''; } catch (e) {} return r.status === 400 && /API key/i.test(m) ? 'Clé Gemini refusée : vérifie-la.' : r.status === 429 ? 'Quota Google dépassé : active la facturation dans Google AI Studio, ou réessaie demain.' : r.status === 403 ? 'Accès refusé par Google (clé, facturation ou vidéo non publique).' : 'Google : ' + (m || r.status); }
  async function gemini({ key, link, file, club, opp, colors }, progress) {
    const src = file ? await gUpload(file, key, progress) : { uri: link, mime: 'video/*' };
    progress('L\'intelligence artificielle regarde le match… (1 à 3 minutes)');
    const prompt = `Tu regardes la vidéo d'un match de football amateur : ${club} contre ${opp || 'l\'adversaire'}${colors ? '. ' + club + ' joue en ' + colors : ''}.
Repère TOUS les moments forts des DEUX équipes : buts, tirs cadrés, tirs sur le poteau ou la barre, grosses occasions, arrêts du gardien, cartons.
Pour chacun, donne le moment de la vidéo où l'action commence (format m:ss ou h:mm:ss), son type, l'équipe (nous = ${club}, eux = l'adversaire) et une description courte en français (10 mots maximum).
Réponds seulement avec la liste JSON.`;
    const schema = { type: 'ARRAY', items: { type: 'OBJECT', properties: { t: { type: 'STRING' }, kind: { type: 'STRING', enum: ['goal', 'shot', 'post', 'chance', 'save', 'card'] }, team: { type: 'STRING', enum: ['nous', 'eux'] }, desc: { type: 'STRING' } }, required: ['t', 'kind', 'team'] } };
    let last = '';
    for (const model of MODELS) {
      const r = await fetch(`${GAPI}/v1beta/models/${model}:generateContent`, { method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ file_data: { file_uri: src.uri, mime_type: src.mime } }, { text: prompt }] }], generationConfig: { responseMimeType: 'application/json', responseSchema: schema, mediaResolution: 'MEDIA_RESOLUTION_LOW', temperature: 0.2 } }) });
      if (r.status === 404) { last = 'modèle introuvable'; continue; }
      if (!r.ok) throw new Error(await gErr(r));
      const j = await r.json(), txt = (((j.candidates || [])[0] || {}).content || { parts: [] }).parts.map(p => p.text || '').join('');
      let list; try { list = JSON.parse(txt); } catch (e) { throw new Error('Réponse de l\'IA illisible : réessaie.'); }
      const tsec = s => String(s || '').split(':').map(Number).reduce((a, x) => a * 60 + (x || 0), 0);
      const K = { goal: ['goal', '⚽ But'], shot: ['chance', '🎯 Tir'], post: ['post', '🥅 Poteau / barre'], chance: ['chance', '🎯 Occasion'], save: ['save', '🧤 Arrêt'], card: ['card', '🟨 Carton'] };
      return (Array.isArray(list) ? list : []).map(x => { const k = K[x.kind] || K.chance, them = x.team === 'eux';
        const kind = k[0] === 'goal' ? (them ? 'goalThem' : 'goalUs') : k[0] === 'chance' && them ? 'chanceThem' : k[0];
        return { t: tsec(x.t), src: 'ai', kind, title: `${k[1]}${them ? ' adverse' : ''}${x.desc ? ' · ' + String(x.desc).slice(0, 60) : ''}` }; }).filter(x => x.t >= 0);
    }
    throw new Error('Gemini indisponible (' + last + ').');
  }
  const BEFORE = { live: 12, sound: 15, ai: 6 }; // the clip starts a little before the action (the noise comes after it)
  function open(m, save, done) {
    const st = { file: null, url: null, db: null, sound: [], k1: m.videoKick1 || '', k2: m.videoKick2 || '', link: m.videoUrl || '', list: [], busy: '', ai: [], aiOpen: false, colors: m.ourColors || '' };
    const merge = () => {
      const live = liveMoments(m, VPlayer.secs(st.k1) || (st.k1 === '0:00' || st.k1 === '0' ? 0 : null), st.k2 ? VPlayer.secs(st.k2) : null);
      const ai = st.ai.filter(a => live.every(l => Math.abs(l.t - a.t) > 20)).map(x => Object.assign({ keep: true }, x));
      const all = [...live.map(x => Object.assign({ keep: true }, x)), ...ai, ...st.sound.filter(s => live.every(l => Math.abs(l.t - s.t) > 25) && ai.every(a => Math.abs(a.t - s.t) > 25)).map((s, i) => ({ t: s.t, src: 'sound', kind: '', title: `🔊 Action chaude ${i + 1}`, score: s.score, keep: true }))];
      const old = {}; st.list.forEach(x => { old[x.src + Math.round(x.t)] = x; });
      st.list = all.sort((a, b) => a.t - b.t).map(x => Object.assign(x, old[x.src + Math.round(x.t)] ? { keep: old[x.src + Math.round(x.t)].keep, kind: old[x.src + Math.round(x.t)].kind || x.kind, title: old[x.src + Math.round(x.t)].title } : {}));
    };
    const hasLive = ((m.live || {}).events || []).some(e => Sport.scoreOf(e.type) || KEEP[e.type]);
    const body = () => {
      const n = st.list.filter(x => x.keep).length;
      return `<p class="muted small">Gratuit. ${hasLive ? 'L\'appli place les actions notées pendant le match en direct, et' : 'L\'appli'} repère au son les moments où le bruit monte (cris, sifflets, applaudissements) si tu lui donnes le fichier. Tu vérifies, tu nommes, tu ajoutes.</p>
        <div class="ahl-step"><b>1. La vidéo complète du match</b>
          <label class="fld"><span>Son lien en ligne (YouTube « non répertoriée », Drive, Dropbox…) : c'est lui que les joueurs regardent</span><input id="ahlLink" class="ahl-link" inputmode="url" placeholder="https://youtu.be/…" value="${esc(st.link)}"></label>
          <p class="muted small">Et, pour repérer aussi les moments au son, le fichier de la même vidéo (MP4 ou MOV, même plusieurs Go ; il n'est envoyé nulle part). YouTube ne laisse pas écouter le son de ses vidéos.</p>
          <label class="btn soft ahl-file">📁 ${st.file ? esc(st.file.name) : 'Choisir le fichier (facultatif)'}<input type="file" accept="video/mp4,video/quicktime,video/*" id="ahlFile" hidden></label>
          ${st.busy ? `<p class="ahl-busy">⏳ ${esc(st.busy)}</p>` : st.db ? `<p class="muted small">✓ Son analysé : ${st.sound.length} moment${st.sound.length > 1 ? 's' : ''} fort${st.sound.length > 1 ? 's' : ''} repéré${st.sound.length > 1 ? 's' : ''}.</p>` : ''}</div>
        <details class="ahl-step ahl-ai" ${st.aiOpen ? 'open' : ''}><summary><b>🧠 Option : analyse par intelligence artificielle (Gemini)</b> <span class="muted small">payée par toi chez Google</span></summary>
          <p class="muted small">L'IA de Google regarde vraiment le match (le lien YouTube <b>publique</b>, ou le fichier jusqu'à 2 Go) et repère buts, tirs, poteaux, arrêts et cartons des deux équipes. C'est ta propre clé : Google te donne un quota gratuit, puis te facture directement (environ 0,10 € à 1 € par match). Le club et l'appli ne paient rien et ne voient pas ta clé, qui reste sur cet appareil.</p>
          <p><a class="btn soft" href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">🔑 Créer ma clé Gemini (Google AI Studio)</a> <a class="btn soft" href="https://aistudio.google.com/usage" target="_blank" rel="noopener noreferrer">💳 Facturation et consommation</a></p>
          <label class="fld"><span>Ma clé Gemini</span><input id="ahlGKey" type="password" autocomplete="off" placeholder="AIza…" value="${esc(gKey())}"></label>
          <label class="fld"><span>Notre maillot (aide l'IA à reconnaître les équipes)</span><input id="ahlColors" maxlength="60" placeholder="bleu et rouge" value="${esc(st.colors)}"></label>
          <label class="consent"><input type="checkbox" id="ahlOk"> <span>La vidéo part chez Google. Pour des joueurs mineurs, les parents ont donné leur accord à la diffusion de leur image.</span></label>
          <button type="button" class="btn primary" data-ahl="ai">🧠 Analyser avec Gemini</button>${st.ai.length ? ` <span class="muted small">✓ ${st.ai.length} moment${st.ai.length > 1 ? 's' : ''} trouvé${st.ai.length > 1 ? 's' : ''} par l'IA</span>` : ''}</details>
        ${hasLive ? `<div class="ahl-step"><b>2. Le coup d'envoi dans la vidéo</b> <span class="muted small">(pour placer les actions du direct)</span>
          <div class="row3"><label class="fld"><span>1re mi-temps à</span><input id="ahlK1" placeholder="2:35" value="${esc(st.k1)}"></label><label class="fld"><span>2e mi-temps à (si la vidéo est coupée)</span><input id="ahlK2" placeholder="52:10" value="${esc(st.k2)}"></label>
          ${P ? '<div class="fld"><span>&nbsp;</span><button type="button" class="btn soft" data-ahl="k1now">⏱️ Mettre l\'instant de la vidéo</button></div>' : ''}</div>
          ${P ? '<p class="muted small">Mets la vidéo au coup d\'envoi, puis touche ⏱️.</p>' : ''}</div>` : ''}
        ${st.list.length ? `<div class="ahl-step"><b>${hasLive ? 3 : 2}. Les moments proposés</b> <span class="muted small">(décoche ceux à jeter, choisis ce que c'est)</span>
          <div class="ahl-list">${st.list.map((x, i) => `<div class="ahl-row ${x.keep ? '' : 'off'}"><label class="ahl-ck"><input type="checkbox" data-ahlk="${i}" ${x.keep ? 'checked' : ''}><b>${mmss(Math.max(0, x.t - BEFORE[x.src]))}</b></label>
            ${P ? `<button type="button" class="btn soft ahl-play" data-ahlp="${i}">▶</button>` : ''}<input class="ahl-title" data-ahlt="${i}" value="${esc(x.title)}" maxlength="80">
            <select data-ahls="${i}"><option value="">C'est…</option>${KINDS.map(([k, l]) => `<option value="${k}" ${x.kind === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
            <span class="muted small">${x.src === 'live' ? '📱 direct' : x.src === 'ai' ? '🧠 IA' : '🔊 bruit'}</span></div>`).join('')}</div></div>` : ''}
        ${!st.list.length && !st.busy ? `<p class="tip">${hasLive ? 'Aucune action du direct placée pour l\'instant : indique le coup d\'envoi, ou' : 'Pas d\'actions notées en direct pour ce match :'} choisis le fichier de la vidéo pour repérer les moments au son.</p>` : ''}
        <p class="muted small">${n} extrait${n > 1 ? 's' : ''} sélectionné${n > 1 ? 's' : ''}.</p>`;
    };
    let root = null, P = null, ytp = null;
    const ytId = u => (String(u || '').match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/) || [])[1];
    // the player: the file, or YouTube (its API gives the time and seeks); kept between the redraws
    function setMedia() {
      const box = root && root.querySelector('#ahlMedia'); if (!box) return;
      if (st.url) { if (!box.querySelector('video')) box.innerHTML = `<video src="${st.url}" controls playsinline preload="metadata"></video>`; const v = box.querySelector('video'); P = { time: () => v.currentTime, seek: s => { v.currentTime = s; v.play(); } }; ytp = null; return; }
      const id = ytId(st.link);
      if (!id) { box.innerHTML = ''; P = null; ytp = null; return; }
      if (ytp && ytp.__id === id) return;
      box.innerHTML = '<div class="ahl-yt"><div id="ahlYT"></div></div>'; P = null;
      loadYT().then(() => { ytp = new YT.Player('ahlYT', { videoId: id, host: 'https://www.youtube-nocookie.com', playerVars: { playsinline: 1, rel: 0 }, events: { onReady: () => { P = { time: () => ytp.getCurrentTime(), seek: s => { ytp.seekTo(s, true); ytp.playVideo(); } }; draw(); } } }); ytp.__id = id; })
        .catch(() => toast('Lecteur YouTube indisponible (connexion ?)', 'err'));
    }
    const draw = () => { if (!root) return; const b = root.querySelector('#ahlBody'), sc = b.scrollTop; b.innerHTML = body(); b.scrollTop = sc; };
    const readInputs = () => { if (!root) return; const g = id => (root.querySelector(id) || {}).value; if (root.querySelector('#ahlK1')) { st.k1 = g('#ahlK1').trim(); st.k2 = g('#ahlK2').trim(); } if (root.querySelector('#ahlLink')) st.link = g('#ahlLink').trim(); };
    async function runAI() {
      readInputs(); const key = gKey();
      if (!key) { toast('Crée ta clé Gemini (bouton 🔑) et colle-la', 'err'); return; }
      if (!root.querySelector('#ahlOk').checked) { toast('Coche la case sur l\'accord des parents', 'err'); return; }
      const yt = /youtu\.?be/.test(st.link);
      if (!st.file && !yt) { toast('Il faut le lien YouTube publique de la vidéo, ou son fichier', 'err'); return; }
      m.ourColors = st.colors; st.busy = 'Connexion à Google…'; draw();
      try {
        st.ai = await gemini({ key, link: st.link, file: yt ? null : st.file, club: (Store.state.club || {}).name || 'notre équipe', opp: m.opponent, colors: st.colors }, msg => { st.busy = msg; const el = root.querySelector('.ahl-busy'); if (el) el.textContent = '⏳ ' + msg; else draw(); });
        st.busy = ''; merge(); draw(); toast(st.ai.length ? `L'IA a trouvé ${st.ai.length} moment${st.ai.length > 1 ? 's' : ''} : vérifie-les ✓` : 'L\'IA n\'a rien trouvé dans cette vidéo.');
      } catch (e) { st.busy = ''; draw(); toast(e.message || 'Analyse IA impossible', 'err'); }
    }
    async function analyse(file) {
      if (st.url) URL.revokeObjectURL(st.url);
      st.file = file; st.url = URL.createObjectURL(file); st.db = null; st.sound = []; st.busy = 'Lecture du son… 0 %'; root.querySelector('#ahlMedia').innerHTML = ''; setMedia(); draw();
      try {
        let lastDraw = 0;
        st.db = await loudness(file, p => { const now = Date.now(); if (now - lastDraw > 500) { lastDraw = now; st.busy = `Lecture du son… ${Math.round(p * 100)} %`; const el = root && root.querySelector('.ahl-busy'); if (el) el.textContent = '⏳ ' + st.busy; } });
        st.sound = peaks(st.db); st.busy = ''; merge(); draw();
        if (!st.sound.length) toast('Pas de moment fort repéré au son (vidéo très calme ou sans son).');
      } catch (e) { st.busy = ''; draw(); toast(e.message || 'Analyse impossible', 'err'); }
    }
    modal({ title: '🤖 Highlights automatiques', noFocus: true, wide: true, body: `<div class="ahl"><div id="ahlMedia"></div><div id="ahlBody">${(merge(), body())}</div></div>`,
      onOpen: r => {
        root = r; css(); setMedia();
        r.addEventListener('change', e => {
          if (e.target.id === 'ahlFile' && e.target.files[0]) return analyse(e.target.files[0]);
          const k = e.target.dataset.ahlk; if (k != null) { st.list[+k].keep = e.target.checked; return draw(); }
          const s = e.target.dataset.ahls; if (s != null) { const x = st.list[+s]; x.kind = e.target.value; const l = (KINDS.find(z => z[0] === x.kind) || [])[1]; if (l && /^🔊|^(⚽|🎯|⚠️|🥅|🧤|🟨)/.test(x.title)) x.title = l.replace(/ \((nous|eux)\)/, x.kind.endsWith('Them') ? ' adverse' : ''); return draw(); }
          if (e.target.id === 'ahlK1' || e.target.id === 'ahlK2') { readInputs(); merge(); draw(); }
          if (e.target.id === 'ahlLink') { st.link = e.target.value.trim(); setMedia(); draw(); }
        });
        r.addEventListener('input', e => { if (e.target.id === 'ahlGKey') setGKey(e.target.value.trim()); if (e.target.id === 'ahlColors') st.colors = e.target.value; const t = e.target.dataset.ahlt; if (t != null) st.list[+t].title = e.target.value; if (e.target.id === 'ahlLink') st.link = e.target.value.trim(); });
        r.addEventListener('toggle', e => { if (e.target.classList && e.target.classList.contains('ahl-ai')) st.aiOpen = e.target.open; }, true);
        r.addEventListener('click', e => {
          if (e.target.closest('[data-ahl="ai"]')) { runAI(); return; }
          const p = e.target.closest('[data-ahlp]'); if (p) { const x = st.list[+p.dataset.ahlp]; if (P) { P.seek(Math.max(0, x.t - BEFORE[x.src])); r.querySelector('#ahlMedia').scrollIntoView({ block: 'nearest' }); } return; }
          if (e.target.closest('[data-ahl="k1now"]')) { if (P) { readInputs(); st.k1 = mmss(P.time()); merge(); draw(); } }
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
  const loadYT = () => window.YT && YT.Player ? Promise.resolve() : new Promise((ok, ko) => { const prev = window.onYouTubeIframeAPIReady; window.onYouTubeIframeAPIReady = () => { if (prev) prev(); ok(); }; const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.onerror = ko; document.head.appendChild(s); });
  function css() {
    if (document.getElementById('ahlCss')) return;
    const s = document.createElement('style'); s.id = 'ahlCss';
    s.textContent = '.ahl-step{margin:12px 0;padding:10px 12px;border:1px solid var(--line);border-radius:12px}.ahl-step>b{display:block;margin-bottom:6px}.ahl-file{display:inline-flex;cursor:pointer;margin:4px 0}'
      + '.ahl video{width:100%;max-height:40vh;background:#000;border-radius:10px}.ahl-yt{position:relative;aspect-ratio:16/9;max-height:40vh;background:#000;border-radius:10px;overflow:hidden}.ahl-yt iframe{position:absolute;inset:0;width:100%;height:100%;border:0}#ahlMedia{position:sticky;top:0;z-index:1}.ahl-busy{font-weight:700}.ahl-ai summary{cursor:pointer}.ahl-ai .btn{margin:4px 4px 4px 0}.ahl-list{display:grid;gap:6px;max-height:46vh;overflow:auto}'
      + '.ahl-row{display:grid;grid-template-columns:auto auto minmax(140px,1fr) minmax(0,150px) auto;gap:6px;align-items:center;padding:6px;border-radius:10px;background:var(--bg)}.ahl-row.off{opacity:.45}.ahl-ck{display:flex;gap:6px;align-items:center;white-space:nowrap}'
      + '.ahl-title,.ahl-row select,.ahl-link{min-height:38px;border-radius:10px;border:1px solid var(--line);padding:0 8px;font:inherit;background:var(--surface);color:var(--ink);min-width:0}.ahl-link{width:100%;box-sizing:border-box}'
      + '@media (max-width:640px){.ahl-row{grid-template-columns:auto auto 1fr}.ahl-row select{grid-column:1/3}.ahl-row>span{grid-column:3}}';
    document.head.appendChild(s);
  }
  return { open, loudness, peaks, liveMoments };
})();
