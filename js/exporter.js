/* Exporter: PNG images, video recordings of the animation and printable PDF sheets. */
const Exporter = (() => {
  // Club crest, drawn on images, videos and PDFs
  const crest = new Image(); let crestOk = false;
  crest.onload = () => { crestOk = true; }; crest.src = 'icons/ea-logo.png'; // then the club's own crest, once the app is loaded
  setTimeout(() => { try { const c = Supporters.crest(); if (c && c !== crest.src) { crestOk = false; crest.src = c; } } catch (e) {} }, 1500);
  const crestData = () => { if (!crestOk) return null; const c = document.createElement('canvas'); c.width = c.height = 256; c.getContext('2d').drawImage(crest, 0, 0, 256, 256); return c.toDataURL('image/png'); };
  const isTouch = () => matchMedia('(pointer: coarse)').matches;
  const safeName = s => (s || 'schema').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'schema';

  async function deliver(blob, filename) {
    const file = new File([blob], filename, { type: blob.type });
    if (isTouch() && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: filename }); return 'shared'; }
      catch (e) { if (e && e.name === 'AbortError') return 'cancel'; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 20000);
    return 'downloaded';
  }

  /* ---------- frames ---------- */
  function drawCaption(ctx, w, h, ch, sc, k) {
    ctx.fillStyle = '#0e1d45'; ctx.fillRect(0, h - ch, w, ch);
    ctx.fillStyle = '#8c1024'; ctx.fillRect(0, h - ch, w, Math.max(3, ch * .06));
    if (crestOk) ctx.drawImage(crest, w - ch * .95, h - ch * .92, ch * .84, ch * .84);
    const n = sc.steps.length, note = (sc.steps[k].note || '').trim();
    const fs = Math.round(ch * .34);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.font = `800 ${fs}px ui-rounded, system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = '#e2c27d';
    const tag = `Étape ${k + 1}/${n}`;
    ctx.fillText(tag, ch * .4, h - ch / 2);
    const x0 = ch * .4 + ctx.measureText(tag).width + fs * .8;
    ctx.font = `600 ${fs}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.fillStyle = '#eef5ee';
    let t = note || sc.name || '';
    const max = w - x0 - ch * 1.3;
    while (t.length > 3 && ctx.measureText(t).width > max) t = t.slice(0, -2);
    if (t !== (note || sc.name || '')) t = t.replace(/\s*\S?$/, '…');
    ctx.fillText(t, x0, h - ch / 2);
  }
  function frameCanvas(sc, k, u, o = {}) {
    const w = o.w || 1600, ch0 = Math.round((o.h || 1040) * .085);
    let h = o.h || 1040;
    if (sc.field.format === 'bg') { const d = Board.dims(sc.field); h = Math.round(w * Math.min(1.35, Math.max(.45, d.W / d.L)) * 1.04) + ch0; }
    const ch = o.caption === false ? 0 : ch0;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    Board.drawFrame(ctx, w, h - ch, sc, k, u, { homeBib: o.homeBib, names: o.names });
    if (ch) drawCaption(ctx, w, h, ch, sc, k);
    return c;
  }
  const toBlob = (c, type = 'image/png', q) => new Promise(r => c.toBlob(r, type, q));

  async function png(sc, k, o) {
    await Board.ensureBg(sc);
    const blob = await toBlob(frameCanvas(sc, k, 0, o));
    return deliver(blob, `${safeName(sc.name)}-etape-${k + 1}.png`);
  }

  /* ---------- video ---------- */
  function timeline(sc) {
    const seg = [], n = sc.steps.length;
    for (let k = 0; k < n; k++) {
      seg.push({ k, move: false, d: k === 0 ? 1 : .7 });
      if (k < n - 1) seg.push({ k, move: true, d: Board.stepDur(sc, k) });
    }
    seg.push({ k: n - 1, move: false, d: 1.2 });
    return seg;
  }
  function pickMime() {
    const list = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    if (!window.MediaRecorder) return null;
    return list.find(m => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } }) || '';
  }
  function canVideo() { return !!(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream) || !!window.VideoEncoder; }

  /* A real MP4 (H.264), the video every phone, computer and TV plays: the images of a canvas are encoded one by one
     (WebCodecs) and put in an MP4 file (mp4-muxer, loaded the first time). null when the browser can't: then MediaRecorder,
     which gives WebM on some browsers. */
  let muxerLoad = null;
  const loadMuxer = () => muxerLoad || (muxerLoad = new Promise((res, rej) => {
    if (window.Mp4Muxer) return res();
    const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.3/build/mp4-muxer.min.js';
    s.onload = res; s.onerror = () => { muxerLoad = null; s.remove(); rej(new Error('mp4')); }; document.head.appendChild(s);
  }));
  async function mp4Writer(w, h, fps = 30) {
    if (!window.VideoEncoder || !window.VideoFrame) return null;
    let cfg = null;
    for (const codec of ['avc1.42001f', 'avc1.4d001f', 'avc1.640028', 'avc1.42002a']) {
      const c = { codec, width: w, height: h, bitrate: 6e6, framerate: fps, avc: { format: 'avc' } };
      try { if ((await VideoEncoder.isConfigSupported(c)).supported) { cfg = c; break; } } catch (e) {}
    }
    if (!cfg) return null;
    try { await loadMuxer(); } catch (e) { return null; }
    const muxer = new Mp4Muxer.Muxer({ target: new Mp4Muxer.ArrayBufferTarget(), video: { codec: 'avc', width: w, height: h, frameRate: fps }, fastStart: 'in-memory' });
    let err = null, n = 0;
    const enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: e => { err = e; } });
    enc.configure(cfg);
    const dur = 1e6 / fps;
    return {
      fps,
      get count() { return n; },
      async frame(canvas) {
        if (err) throw err;
        while (enc.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 4));
        const f = new VideoFrame(canvas, { timestamp: Math.round(n * dur), duration: Math.round(dur) });
        enc.encode(f, { keyFrame: n % (fps * 2) === 0 }); f.close(); n++;
      },
      async finish() { await enc.flush(); if (err) throw err; muxer.finalize(); enc.close(); return new Blob([muxer.target.buffer], { type: 'video/mp4' }); },
      cancel() { try { enc.close(); } catch (e) {} },
    };
  }
  async function video(sc, o = {}, onProgress = () => {}) {
    await Board.ensureBg(sc);
    if (!canVideo()) throw new Error("Cet appareil ne sait pas enregistrer de vidéo depuis l'appli. Utilise l'enregistrement d'écran de l'iPad pendant la lecture.");
    const w = 1280, h = 832, ch = Math.round(h * .085);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const segs = timeline(sc), total = segs.reduce((a, s) => a + s.d, 0);
    const at = t => { let acc = 0; for (const s of segs) { if (t < acc + s.d) return { k: s.k, u: s.move ? (t - acc) / s.d : 0 }; acc += s.d; } const l = segs[segs.length - 1]; return { k: l.k, u: 0 }; };
    const draw = t => { const { k, u } = at(t); Board.drawFrame(ctx, w, h - ch, sc, k, u, { homeBib: o.homeBib, names: o.names }); drawCaption(ctx, w, h, ch, sc, k); };
    draw(0);
    // MP4 when possible: every image of the animation is computed, no need to wait for it to play
    const wr = await mp4Writer(w, h, 30);
    if (wr) {
      const nf = Math.ceil((total + .3) * wr.fps);
      for (let i = 0; i < nf; i++) { draw(Math.min(i / wr.fps, total)); await wr.frame(c); if (i % 10 === 0) onProgress(i / nf); }
      onProgress(1);
      return deliver(await wr.finish(), `${safeName(sc.name)}.mp4`);
    }
    const mime = pickMime();
    const stream = c.captureStream(30);
    const rec = new MediaRecorder(stream, Object.assign({ videoBitsPerSecond: 6e6 }, mime ? { mimeType: mime } : {}));
    const chunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise(r => rec.onstop = r);
    rec.start(250);
    const t0 = performance.now();
    await new Promise(res => {
      const tick = () => {
        const t = (performance.now() - t0) / 1000;
        draw(Math.min(t, total)); onProgress(Math.min(1, t / total));
        if (t >= total + .3) return res();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    rec.stop(); await stopped;
    const type = (rec.mimeType || mime || 'video/webm').split(';')[0];
    const blob = new Blob(chunks, { type });
    return deliver(blob, `${safeName(sc.name)}.${type.includes('mp4') ? 'mp4' : 'webm'}`);
  }

  /* ---------- PDF ---------- */
  const latin = s => String(s == null ? '' : s)
    .replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/→/g, '->')
    .replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/€/g, 'EUR').replace(/[^\x00-\xFF]/g, '');
  const HEX = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

  function Doc(club) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const PW = 210, PH = 297, M = 14, CW = PW - 2 * M;
    const accent = [140, 16, 36];
    let y = M;
    const api = {
      doc, M, CW, PH,
      get y() { return y; }, set y(v) { y = v; },
      header(title, sub) {
        doc.setFillColor(14, 29, 69); doc.rect(0, 0, PW, 26, 'F');
        doc.setFillColor(140, 16, 36); doc.rect(0, 26, PW, 1.6, 'F');
        const logo = crestData(), lx = logo ? M + 21 : M;
        if (logo) doc.addImage(logo, 'PNG', M, 3, 20, 20);
        doc.setTextColor(226, 194, 125); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
        doc.text(latin((club.name || '').toUpperCase()), lx, 9.5);
        doc.setTextColor(255, 255, 255); doc.setFontSize(17); doc.text(latin(title), lx, 18.5, { maxWidth: CW - (lx - M) });
        if (sub) { doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.text(latin(sub), PW - M, 8.5, { align: 'right' }); }
        doc.setTextColor(20, 30, 25); y = 35;
      },
      ensure(h) { if (y + h > PH - M) { doc.addPage(); y = M; } },
      h2(t) { api.ensure(12); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...accent); doc.text(latin(t), M, y + 4); doc.setTextColor(20, 30, 25); y += 8; },
      label(t) { api.ensure(8); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(95, 110, 100); doc.text(latin(t.toUpperCase()), M, y + 3); doc.setTextColor(20, 30, 25); y += 5; },
      para(t, size = 10.5) {
        if (!t) return; doc.setFont('helvetica', 'normal'); doc.setFontSize(size);
        const lines = doc.splitTextToSize(latin(t), CW);
        lines.forEach(l => { api.ensure(5); doc.text(l, M, y + 3.6); y += 4.8; }); y += 1.5;
      },
      bullets(items) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
        items.filter(Boolean).forEach(it => {
          const lines = doc.splitTextToSize(latin(it), CW - 6);
          lines.forEach((l, i) => { api.ensure(5); if (!i) { doc.setFillColor(...accent); doc.circle(M + 1.5, y + 2.4, .9, 'F'); } doc.text(l, M + 5, y + 3.6); y += 4.8; });
        });
        y += 1.5;
      },
      facts(pairs) {
        const cols = Math.min(4, pairs.length), w = CW / cols; api.ensure(14);
        pairs.forEach(([k, v], i) => {
          const x = M + (i % cols) * w; if (i && i % cols === 0) y += 13;
          doc.setFillColor(237, 241, 236); doc.roundedRect(x, y, w - 2, 11.5, 1.5, 1.5, 'F');
          doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(95, 110, 100); doc.text(latin(k.toUpperCase()), x + 2.5, y + 4);
          doc.setFontSize(10.5); doc.setTextColor(20, 30, 25); doc.text(latin(v), x + 2.5, y + 9, { maxWidth: w - 5 });
        });
        y += 15;
      },
      image(canvas, wmm) {
        const w = wmm || CW, h = w * canvas.height / canvas.width;
        api.ensure(h + 3);
        doc.addImage(canvas.toDataURL('image/jpeg', .86), 'JPEG', M + (CW - w) / 2, y, w, h, undefined, 'FAST');
        y += h + 5;
      },
      table(head, rows, widths) {
        const ws = widths.map(p => p * CW); doc.setFontSize(9.5);
        const row = (cells, bold, fill) => {
          api.ensure(7);
          if (fill) { doc.setFillColor(...fill); doc.rect(M, y, CW, 6.5, 'F'); }
          doc.setFont('helvetica', bold ? 'bold' : 'normal');
          let x = M; cells.forEach((c, i) => { doc.text(latin(c), x + 1.5, y + 4.5, { maxWidth: ws[i] - 3 }); x += ws[i]; });
          y += 6.5;
        };
        row(head, true, [226, 233, 226]); rows.forEach((r, i) => row(r, false, i % 2 ? [246, 248, 246] : null)); y += 3;
      },
      blob() { return doc.output('blob'); },
    };
    return api;
  }
  function schemaImages(P, sc, o) {
    sc.steps.forEach((st, k) => P.image(frameCanvas(sc, k, 0, Object.assign({ w: 1500, h: 980 }, o)), P.CW));
  }
  const fmtDate = d => d ? new Date(d + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const fieldLabel = f => f.format === 'bg' ? 'Dessin sur image' : f.format === 'zone' ? `Zone ${f.w} x ${f.h} m` : (Board.PITCH[f.format].label + (f.view === 'half' ? ' · demi-terrain' : ''));
  // Attached documents (images, PDF pages, videos) at the end of a printable PDF
  async function addDocs(P, ids) {
    const docs = await Library.docImages(ids); if (!docs.length) return;
    P.doc.addPage(); P.y = P.M; P.h2('Documents joints');
    for (const d of docs) {
      P.label(d.name || 'Document');
      if (d.video) { P.para('Vidéo : à regarder dans l\'appli EA Club Manager.'); continue; }
      if (d.link) { P.para('Lien : ' + d.link); continue; }
      for (const url of d.images) {
        const img = await Media.loadImage(url), ratio = img.naturalHeight / img.naturalWidth;
        let w = P.CW, h = w * ratio; if (h > 250) { h = 250; w = h / ratio; }
        P.ensure(h + 3); P.doc.addImage(url, 'JPEG', P.M + (P.CW - w) / 2, P.y, w, h, undefined, 'FAST'); P.y += h + 5;
      }
    }
  }

  async function pdfSchema(sc, club, o) {
    await Board.ensureBg(sc);
    const P = Doc(club);
    P.header(sc.name, fieldLabel(sc.field));
    P.facts([['Terrain', fieldLabel(sc.field)], ['Étapes', String(sc.steps.length)]]);
    if (sc.notes) { P.label('Notes'); P.para(sc.notes); }
    schemaImages(P, sc, o);
    return deliver(P.blob(), safeName(sc.name) + '.pdf');
  }
  async function pdfTraining(tr, team, club, o) {
    const P = Doc(club), S = Store.state;
    await Board.preloadBackgrounds(tr.exercises.map(e => Store.get('schemas', e.schemaId)).filter(Boolean));
    const total = tr.exercises.reduce((a, e) => a + (+e.duration || 0), 0);
    P.header(tr.title || 'Entraînement', team ? team.name : '');
    P.facts([['Date', fmtDate(tr.date)], ['Heure', tr.time || '-'], ['Durée', total + ' min'], ['Présents', tr.presents && tr.presents.length ? String(tr.presents.length) : '-']]);
    const staff = (tr.staffIds || []).map(id => Store.get('staff', id)).filter(Boolean);
    if (staff.length) { P.label('Encadrants'); P.para(staff.map(s => `${Store.fullName(s)}${s.role ? ' (' + s.role + ')' : ''}${People.staffPhone(s) ? ' - ' + s.phone : ''}`).join('\n')); }
    if (tr.goal) { P.label('Objectif'); P.para(tr.goal); }
    P.label('Programme');
    let cum = 0;
    P.table(['#', 'Exercice', 'Durée', 'Cumul'], tr.exercises.map((e, i) => { cum += +e.duration || 0; return [String(i + 1), e.title || '', (e.duration || 0) + ' min', cum + ' min']; }), [.07, .63, .15, .15]);
    tr.exercises.forEach((e, i) => {
      P.doc.addPage(); P.y = P.M;
      P.h2(`${i + 1}. ${e.title || 'Exercice'}  ·  ${e.duration || 0} min`);
      if (e.org) { P.label('Organisation'); P.para(e.org); }
      if (e.consignes) { P.label('Consignes'); P.bullets(e.consignes.split('\n')); }
      if (e.materiel) { P.label('Matériel'); P.para(e.materiel); }
      const sc = e.schemaId && S.schemas.find(s => s.id === e.schemaId);
      if (sc) { P.label('Schéma'); schemaImages(P, sc, o); }
    });
    await addDocs(P, tr.docIds);
    return deliver(P.blob(), safeName((tr.title || 'entrainement') + '-' + (tr.date || '')) + '.pdf');
  }
  async function pdfMatch(m, team, club, o) {
    const P = Doc(club), S = Store.state;
    const title = m.home ? `${club.name} - ${m.opponent || 'Adversaire'}` : `${m.opponent || 'Adversaire'} - ${club.name}`;
    P.header('Feuille de match', team ? team.name : '');
    P.h2(title);
    P.facts([['Date', fmtDate(m.date)], ['Coup d\'envoi', m.time || '-'], ['Rendez-vous', m.rdv || '-'], ['Compétition', m.competition || '-']]);
    if (m.place) { P.label('Lieu'); P.para(m.place); }
    if (m.played) {
      const opp = m.opponent || 'Adversaire', a = m.home ? club.name : opp, b = m.home ? opp : club.name;
      P.label('Score'); P.para(`${a}  ${m.home ? m.gf : m.ga} - ${m.home ? m.ga : m.gf}  ${b}`, 12);
    }
    const players = team ? Store.rosterOf(team.id).filter(p => (m.convoked || []).includes(p.id)) : [];
    const staff = (m.staffIds || []).map(id => Store.get('staff', id)).filter(Boolean);
    if (staff.length) { P.label('Encadrants'); P.table(['Nom', 'Rôle', 'Téléphone'], staff.map(s => [Store.fullName(s), s.role || '', People.staffPhone(s) || '']), [.45, .3, .25]); }
    if (players.length) {
      P.label(`Convoqués (${players.length})`);
      P.table(['N°', 'Joueur', 'Poste', 'Buts', 'Passes'], players.sort((a, b) => (a.number || 0) - (b.number || 0)).map(p => {
        const st = (m.stats || {})[p.id] || {}; return [String(p.number || ''), Store.fullName(p), People.postsLabel(p, true) || '', st.g ? String(st.g) : '', st.a ? String(st.a) : ''];
      }), [.1, .5, .14, .13, .13]);
    }
    const sc = m.lineupId && S.schemas.find(s => s.id === m.lineupId);
    if (sc) { P.label('Composition'); P.image(frameCanvas(sc, 0, 0, Object.assign({ w: 1500, h: 980, names: true }, o))); }
    if (m.notes) { P.label('Notes'); P.para(m.notes); }
    await addDocs(P, m.docIds);
    return deliver(P.blob(), safeName(`match-${m.opponent || ''}-${m.date || ''}`) + '.pdf');
  }
  async function json(text, name) { return deliver(new Blob([text], { type: 'application/json' }), safeName(name) + '.raincy.json'); }

  return { pdfDoc: Doc, latin, crestData, frameCanvas, png, video, canVideo, mp4Writer, pickMime, pdfSchema, pdfTraining, pdfMatch, json, deliver };
})();
