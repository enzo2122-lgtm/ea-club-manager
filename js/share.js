/* Share (2.06): results on the social networks, from the coaches' app, the players' and the parents' pages.
   The phone makes a picture in the club's colours (4:5, the size Instagram and Facebook like), then a window offers:
   the picture through the phone's own share (Instagram, WhatsApp, Facebook, Snapchat…), WhatsApp, Facebook, X, Telegram,
   SMS, e-mail, « copy the text » and « save the picture ». Nothing is sent to a server. */
const Share = (() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const W = 1080, H = 1350, NAVY = '#0e1d45', NAVY2 = '#182b5e', RED = '#8c1024', GOLD = '#c9a45c', GOLD2 = '#e2c27d';
  const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif';
  const RCOL = { V: '#16a34a', N: '#94a3b8', D: '#dc2626' }, RWORD = { V: 'VICTOIRE', N: 'MATCH NUL', D: 'DÉFAITE' };

  /* ---------- the picture ---------- */
  const loadImg = src => new Promise(res => { if (!src) return res(null); const im = new Image(); if (!/^data:/.test(src)) im.crossOrigin = 'anonymous';
    im.onload = () => res(im); im.onerror = () => res(null); im.src = src; setTimeout(() => res(null), 4000); });
  function base(ctx) {
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, NAVY); g.addColorStop(1, NAVY2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = .5; ctx.fillStyle = RED; ctx.beginPath(); ctx.moveTo(0, H * .86); ctx.lineTo(W, H * .76); ctx.lineTo(W, H * .8); ctx.lineTo(0, H * .9); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.fillStyle = GOLD; ctx.fillRect(0, 0, W, 10); ctx.fillRect(0, H - 10, W, 10);
  }
  function fitText(ctx, text, max, size, weight = 800) { let s = size; do { ctx.font = `${weight} ${s}px ${FONT}`; s -= 2; } while (ctx.measureText(text).width > max && s > 18); return text; }
  function center(ctx, text, y, size, color, weight = 800, max = W - 120) { fitText(ctx, text, max, size, weight); ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(text, W / 2, y); }
  function pill(ctx, text, x, y, bg, fg, size = 34) {
    ctx.font = `800 ${size}px ${FONT}`; const w = ctx.measureText(text).width + size * 1.2, h = size * 1.6;
    ctx.fillStyle = bg; ctx.beginPath(); (ctx.roundRect ? ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2) : ctx.rect(x - w / 2, y - h / 2, w, h)); ctx.fill();
    ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + 1); ctx.textBaseline = 'alphabetic';
  }
  async function header(ctx, o) {
    const im = await loadImg(o.crest);
    if (im) { const s = 190, r = Math.min(s / im.width, s / im.height); ctx.drawImage(im, W / 2 - im.width * r / 2, 70, im.width * r, im.height * r); }
    center(ctx, String(o.club || '').toUpperCase(), im ? 315 : 160, 44, GOLD2, 800);
  }
  function footer(ctx, o) {
    if (o.footer) center(ctx, o.footer, H - 120, 34, '#fff', 600);
    if (o.tag) center(ctx, o.tag, H - 60, 32, GOLD2, 700);
  }
  const canvas = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  // a result: { club, crest, cat, competition, home, us, them, gf, ga, date, place, scorers: ['Yanis B. ×2'], tag }
  async function result(o) {
    const c = canvas(), ctx = c.getContext('2d'); base(ctx); await header(ctx, o);
    const r = +o.gf > +o.ga ? 'V' : +o.gf < +o.ga ? 'D' : 'N';
    center(ctx, RWORD[r] + (r === 'V' ? ' !' : ''), 430, 96, r === 'V' ? GOLD2 : '#fff', 900);
    pill(ctx, [o.cat, o.competition].filter(Boolean).join(' · '), W / 2, 505, 'rgba(255,255,255,.12)', '#fff', 32);
    const [hn, an, hs, as] = o.home ? [o.us, o.them, o.gf, o.ga] : [o.them, o.us, o.ga, o.gf];
    center(ctx, `${hs} – ${as}`, 760, 230, '#fff', 900);
    ctx.textAlign = 'center';
    [[hn, W * .25, o.home], [an, W * .75, !o.home]].forEach(([n, x, us]) => { fitText(ctx, n, W * .44, 50, us ? 900 : 600); ctx.fillStyle = us ? GOLD2 : 'rgba(255,255,255,.85)'; ctx.fillText(n, x, 850); });
    (o.scorers || []).slice(0, 4).forEach((s, i) => center(ctx, '⚽ ' + s, 930 + i * 52, 38, '#fff', 600));
    footer(ctx, { footer: [o.date, o.place].filter(Boolean).join(' · '), tag: o.tag });
    return c;
  }
  // a weekend of the whole club: { club, crest, title, sub, rows: [{ cat, h, a, s, r, us: 'h'|'a' }], tally, tag }
  async function weekend(o) {
    const c = canvas(), ctx = c.getContext('2d'); base(ctx); await header(ctx, o);
    center(ctx, o.title || 'Résultats du week-end', 410, 70, '#fff', 900); if (o.sub) center(ctx, o.sub, 465, 36, GOLD2, 600);
    const rows = (o.rows || []).slice(0, 9), top = 520, rh = Math.min(84, 620 / Math.max(1, rows.length));
    rows.forEach((x, i) => {
      const y = top + i * rh;
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.beginPath(); (ctx.roundRect ? ctx.roundRect(60, y, W - 120, rh - 10, 18) : ctx.rect(60, y, W - 120, rh - 10)); ctx.fill();
      ctx.fillStyle = RCOL[x.r] || '#94a3b8'; ctx.fillRect(60, y, 12, rh - 10);
      const mid = y + (rh - 10) / 2 + 12, fs = Math.min(34, rh * .42);
      ctx.textAlign = 'left'; fitText(ctx, x.cat, 160, fs, 800); ctx.fillStyle = GOLD2; ctx.fillText(x.cat, 90, mid);
      ctx.textAlign = 'right'; fitText(ctx, x.h, 300, fs, x.us === 'h' ? 800 : 500); ctx.fillStyle = '#fff'; ctx.fillText(x.h, 555, mid);
      ctx.textAlign = 'center'; ctx.font = `900 ${fs + 4}px ${FONT}`; ctx.fillText(x.s, 640, mid);
      ctx.textAlign = 'left'; fitText(ctx, x.a, 280, fs, x.us === 'a' ? 800 : 500); ctx.fillStyle = '#fff'; ctx.fillText(x.a, 725, mid);
    });
    if ((o.rows || []).length > rows.length) center(ctx, `+ ${o.rows.length - rows.length} autres matchs`, top + rows.length * rh + 30, 30, '#fff', 600);
    footer(ctx, { footer: o.tally, tag: o.tag });
    return c;
  }
  // a player's season: { club, crest, name, cat, season, tiles: [[number, label]], badges: '⚽🎩…', tag }
  async function season(o) {
    const c = canvas(), ctx = c.getContext('2d'); base(ctx); await header(ctx, o);
    center(ctx, o.name || '', 420, 80, '#fff', 900); pill(ctx, [o.cat, 'Saison ' + (o.season || '')].filter(Boolean).join(' · '), W / 2, 490, 'rgba(255,255,255,.12)', '#fff', 32);
    const t = (o.tiles || []).slice(0, 6), cols = 3, tw = 290, th = 210, x0 = (W - cols * tw - (cols - 1) * 30) / 2;
    t.forEach(([n, l], i) => { const x = x0 + (i % cols) * (tw + 30), y = 560 + Math.floor(i / cols) * (th + 30);
      ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); (ctx.roundRect ? ctx.roundRect(x, y, tw, th, 26) : ctx.rect(x, y, tw, th)); ctx.fill();
      ctx.textAlign = 'center'; ctx.fillStyle = GOLD2; ctx.font = `900 96px ${FONT}`; ctx.fillText(String(n), x + tw / 2, y + 118); fitText(ctx, l, tw - 30, 32, 700); ctx.fillStyle = '#fff'; ctx.fillText(l, x + tw / 2, y + 172); });
    if (o.badges) center(ctx, o.badges, 1090, 64, '#fff', 400);
    footer(ctx, { tag: o.tag });
    return c;
  }

  /* ---------- the window: the networks ---------- */
  function css() {
    if (document.getElementById('shareCss')) return;
    const st = document.createElement('style'); st.id = 'shareCss';
    st.textContent = '.sh-back{position:fixed;inset:0;z-index:120;background:rgba(10,15,34,.6);display:flex;align-items:flex-end;justify-content:center}'
      + '.sh-sheet{width:min(560px,100%);max-height:92vh;overflow-y:auto;background:var(--surface,#fff);color:var(--ink,#111);border-radius:20px 20px 0 0;padding:14px 14px calc(env(safe-area-inset-bottom) + 14px)}'
      + '.sh-sheet h3{margin:0 0 10px;font-size:18px}.sh-img{display:block;width:100%;max-width:300px;margin:0 auto 12px;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.2)}'
      + '.sh-main{display:flex;width:100%;min-height:52px;align-items:center;justify-content:center;gap:8px;border:0;border-radius:14px;background:#8c1024;color:#fff;font:inherit;font-size:16px;font-weight:800;cursor:pointer;margin-bottom:10px}'
      + '.sh-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.sh-grid a,.sh-grid button{display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 4px;border-radius:14px;border:1px solid var(--line,#e2e4ec);background:var(--bg,#f3f4f8);color:inherit;font:inherit;font-size:12px;font-weight:700;text-decoration:none;cursor:pointer;min-height:72px;justify-content:center}'
      + '.sh-grid b{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:17px}'
      + '.sh-txt{width:100%;margin:10px 0 0;border-radius:12px;border:1px solid var(--line,#e2e4ec);background:var(--bg,#f3f4f8);color:inherit;font:inherit;font-size:14px;padding:8px;min-height:84px}'
      + '.sh-opt{display:flex;align-items:center;gap:8px;margin:0 0 10px;font-size:14px}.sh-close{width:100%;margin-top:10px;min-height:44px;border-radius:12px;border:1px solid var(--line,#e2e4ec);background:none;color:inherit;font:inherit;font-weight:700;cursor:pointer}';
    document.head.appendChild(st);
  }
  const blobOf = c => new Promise(r => { try { c.toBlob(b => r(b), 'image/jpeg', .9); } catch (e) { r(null); } });
  const NETS = [
    ['whatsapp', 'WhatsApp', '#25D366', '✆', (t, u) => `https://wa.me/?text=${encodeURIComponent(t + (u ? '\n' + u : ''))}`],
    ['facebook', 'Facebook', '#1877F2', 'f', (t, u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`],
    ['x', 'X', '#000', '𝕏', (t, u) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}${u ? '&url=' + encodeURIComponent(u) : ''}`],
    ['telegram', 'Telegram', '#229ED9', '✈', (t, u) => `https://t.me/share/url?url=${encodeURIComponent(u || '')}&text=${encodeURIComponent(t)}`],
    ['sms', 'SMS', '#16a34a', '💬', (t, u) => `sms:?&body=${encodeURIComponent(t + (u ? '\n' + u : ''))}`],
    ['mail', 'E-mail', '#64748b', '✉', (t, u, title) => `mailto:?subject=${encodeURIComponent(title || '')}&body=${encodeURIComponent(t + (u ? '\n\n' + u : ''))}`]];
  /* o: { title, text, url (a page to link, optional), filename, make: async (opts) => canvas, option: { label, on } (a choice that changes the picture and the text, e.g. the scorers), textOf(opts) } */
  async function open(o) {
    css();
    const opt = { on: !!(o.option && o.option.on) };
    const bk = document.createElement('div'); bk.className = 'sh-back';
    bk.innerHTML = `<div class="sh-sheet" role="dialog" aria-label="Partager"><h3>📣 ${esc(o.title || 'Partager')}</h3><p class="sh-wait" style="text-align:center">Préparation de l'image…</p></div>`;
    document.body.appendChild(bk);
    let cv = null, blob = null, file = null, url = '';
    const text = () => o.textOf ? o.textOf(opt) : o.text || '';
    async function draw() {
      try { cv = await o.make(opt); blob = await blobOf(cv); } catch (e) { cv = null; blob = null; }
      file = blob && typeof File !== 'undefined' ? new File([blob], (o.filename || 'resultat') + '.jpg', { type: 'image/jpeg' }) : null;
      if (url) URL.revokeObjectURL(url); url = blob ? URL.createObjectURL(blob) : '';
      const canFiles = !!(file && navigator.canShare && navigator.canShare({ files: [file] }));
      bk.firstElementChild.innerHTML = `<h3>📣 ${esc(o.title || 'Partager')}</h3>
        ${url ? `<img class="sh-img" alt="Image à partager" src="${url}">` : ''}
        ${o.option ? `<label class="sh-opt"><input type="checkbox" data-shopt ${opt.on ? 'checked' : ''}> ${esc(o.option.label)}</label>` : ''}
        ${canFiles ? '<button class="sh-main" data-sh="native">📤 Partager l\'image (Instagram, WhatsApp, Facebook…)</button>' : navigator.share ? '<button class="sh-main" data-sh="nativeText">📤 Partager…</button>' : ''}
        <div class="sh-grid">${NETS.filter(n => n[0] !== 'facebook' || o.url).map(([k, l, col, ic]) => `<a data-sh="${k}" href="#" rel="noopener"><b style="background:${col}">${ic}</b>${l}</a>`).join('')}
          <button data-sh="copy"><b style="background:#0e1d45">⧉</b>Copier le texte</button>${url ? `<button data-sh="save"><b style="background:#c9a45c">⤓</b>Enregistrer l'image</button>` : ''}</div>
        <textarea class="sh-txt" readonly aria-label="Texte du partage">${esc(text())}</textarea>
        <p class="info small" style="font-size:12.5px;opacity:.8;margin:8px 2px 0">Instagram : « Partager l'image », ou enregistre l'image puis publie-la depuis Instagram.</p>
        <button class="sh-close" data-sh="close">Fermer</button>`;
    }
    await draw();
    const close = () => { bk.remove(); if (url) URL.revokeObjectURL(url); };
    bk.addEventListener('change', async e => { if (e.target.matches('[data-shopt]')) { opt.on = e.target.checked; await draw(); } });
    bk.addEventListener('click', async e => {
      if (e.target === bk) return close();
      const b = e.target.closest('[data-sh]'); if (!b) return;
      const k = b.dataset.sh, t = text();
      if (k === 'close') return close();
      if (k === 'native') { e.preventDefault(); try { await navigator.share({ files: [file], title: o.title, text: t }); } catch (err) { /* cancelled */ } return; }
      if (k === 'nativeText') { try { await navigator.share({ title: o.title, text: t, url: o.url || undefined }); } catch (err) {} return; }
      if (k === 'copy') { try { await navigator.clipboard.writeText(t + (o.url ? '\n' + o.url : '')); b.lastChild.textContent = '✓ Copié'; } catch (err) { bk.querySelector('.sh-txt').select(); } return; }
      if (k === 'save') { const a = document.createElement('a'); a.href = url; a.download = (o.filename || 'resultat') + '.jpg'; document.body.appendChild(a); a.click(); a.remove(); return; }
      const n = NETS.find(x => x[0] === k); if (!n) return;
      e.preventDefault();
      if (k === 'facebook') { try { await navigator.clipboard.writeText(t); } catch (err) {} } // Facebook keeps only the link: the text is ready to paste
      window.open(n[4](t, o.url || '', o.title), k === 'sms' || k === 'mail' ? '_self' : '_blank', 'noopener');
    });
  }
  // the address of the app (Facebook needs a page to link)
  const appUrl = () => location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
  const tagOf = s => '#' + String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '');
  return { open, result, weekend, season, appUrl, tagOf };
})();
