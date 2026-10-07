/* (1.81) A video player inside the app: YouTube, Vimeo, Dailymotion, Google Drive, Streamable or a video file (mp4, webm…).
   Shared by the coach's app (highlights of a match) and the players' page (videos sent by the coach). Other links open in a new tab. */
const VPlayer = (() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // « 1:23 », « 83 » or « 1m23 » → seconds
  const secs = t => { const s = String(t || '').trim(); if (!s) return 0; if (/^\d+$/.test(s)) return +s; const p = s.split(/[:hm]/).map(x => +x || 0); return p.reduce((a, x) => a * 60 + x, 0); };
  const mmss = n => n ? `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}` : '';
  // the embeddable address of a link (null: not playable here)
  function src(url, start) {
    const u = String(url || '').trim(); if (!/^https:\/\//.test(u)) return null;
    const st = secs(start) || secs((u.match(/[?&#]t=(\d+[hms\d]*)/) || [])[1]);
    let m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
    if (m) return { kind: 'frame', url: `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0&playsinline=1${st ? '&start=' + st : ''}` };
    if ((m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/))) return { kind: 'frame', url: `https://player.vimeo.com/video/${m[1]}${st ? '#t=' + st + 's' : ''}` };
    if ((m = u.match(/dai(?:lymotion\.com\/video|\.ly)\/([a-z0-9]+)/i))) return { kind: 'frame', url: `https://www.dailymotion.com/embed/video/${m[1]}${st ? '?start=' + st : ''}` };
    if ((m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]+)/))) return { kind: 'frame', url: `https://drive.google.com/file/d/${m[1]}/preview` };
    if ((m = u.match(/streamable\.com\/([a-z0-9]+)/i))) return { kind: 'frame', url: `https://streamable.com/e/${m[1]}` };
    // (1.86) Dropbox: the file itself; any video file is tried in the player (MP4, WebM, MOV play everywhere; AVI, MPG, MKV, WMV: a message if the browser can't)
    if (/dropbox\.com\//.test(u)) { try { const x = new URL(u); x.searchParams.delete('dl'); x.searchParams.set('raw', '1'); x.hash = st ? 't=' + st : ''; return { kind: 'video', url: x.href }; } catch (e) { return null; } }
    if (/\.(mp4|webm|ogg|ogv|mov|m4v|3gp|mpe?g|mpg4|avi|mkv|wmv|flv|ts)(\?|#|$)/i.test(u)) return { kind: 'video', url: u + (st ? '#t=' + st : '') };
    return null;
  }
  const label = url => { const h = (String(url).match(/^https:\/\/(?:www\.)?([^/]+)/) || [])[1] || 'lien'; return /youtu/.test(h) ? 'YouTube' : /vimeo/.test(h) ? 'Vimeo' : /drive\.google/.test(h) ? 'Google Drive' : h; };
  function css() {
    if (document.getElementById('vpCss')) return;
    const st = document.createElement('style'); st.id = 'vpCss';
    st.textContent = '.vp-back{position:fixed;inset:0;z-index:120;background:rgba(5,8,20,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px}'
      + '.vp-box{width:min(960px,100%)}.vp-frame{position:relative;width:100%;aspect-ratio:16/9;background:#000;border-radius:12px;overflow:hidden}.vp-frame iframe,.vp-frame video{position:absolute;inset:0;width:100%;height:100%;border:0}'
      + '.vp-bar{display:flex;justify-content:space-between;align-items:center;gap:10px;color:#fff;margin-bottom:8px}.vp-bar b{font-size:16px}.vp-bar button,.vp-bar a{background:rgba(255,255,255,.14);color:#fff;border:0;border-radius:10px;padding:8px 12px;font:inherit;font-weight:700;text-decoration:none;cursor:pointer}'
      + '.vp-list{display:grid;gap:8px}.vp-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;border:1px solid var(--line,#ddd);background:var(--surface,#fff);color:inherit;font:inherit;text-align:left;cursor:pointer;width:100%}'
      + '.vp-item .pl{flex:none;width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:#be123c;color:#fff;font-size:15px}.vp-item small{display:block;opacity:.7}';
    document.head.appendChild(st);
  }
  // opens the player over the page
  function open(url, start, title) {
    css(); const s = src(url, start);
    if (!s) { window.open(url, '_blank', 'noopener'); return; }
    const o = document.createElement('div'); o.className = 'vp-back';
    o.innerHTML = `<div class="vp-box"><div class="vp-bar"><b>${esc(title || 'Vidéo')}</b><span><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">↗</a> <button type="button" data-vpx>✕ Fermer</button></span></div>
      <div class="vp-frame">${s.kind === 'video' ? `<video src="${esc(s.url)}" controls autoplay playsinline></video>` : `<iframe src="${esc(s.url)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`}</div></div>`;
    const close = () => { o.remove(); document.removeEventListener('keydown', key); };
    const key = e => { if (e.key === 'Escape') close(); };
    o.onclick = e => { if (e.target === o || e.target.closest('[data-vpx]')) close(); };
    document.addEventListener('keydown', key); document.body.appendChild(o);
    // a format the browser can't read (AVI, MPG, WMV…): say it, and offer to download it
    const v = o.querySelector('video'); if (v) v.onerror = () => { const f = o.querySelector('.vp-frame'); f.style.aspectRatio = 'auto'; f.innerHTML = `<div style="padding:24px;color:#fff;text-align:center;line-height:1.5"><p>😕 Ce format de vidéo ne se lit pas dans le navigateur (souvent AVI, MPG ou WMV).</p><p><a href="${esc(url)}" target="_blank" rel="noopener noreferrer" download style="color:#e2c27d;font-weight:700">⬇️ Télécharger la vidéo</a></p><p style="opacity:.75;font-size:14px">Coach : mets plutôt la vidéo en MP4, ou sur YouTube (en « non répertoriée ») ou Google Drive.</p></div>`; };
  }
  // a list of clips: [{ url, t, title }] → buttons that open the player (data-vp…)
  function list(clips) {
    css();
    return `<div class="vp-list">${(clips || []).filter(c => c && c.url).map(c => `<button type="button" class="vp-item" data-vp="${esc(c.url)}" data-vpt="${esc(c.t || '')}" data-vptitle="${esc(c.title || '')}"><span class="pl">▶</span><span><b>${esc(c.title || 'Vidéo')}</b><small>${esc(label(c.url))}${secs(c.t) ? ' · à ' + mmss(secs(c.t)) : ''}</small></span></button>`).join('')}</div>`;
  }
  // a click on one of these buttons (delegated by the page); true when handled
  function onClick(e) { const b = e.target.closest('[data-vp]'); if (!b) return false; open(b.dataset.vp, b.dataset.vpt, b.dataset.vptitle); return true; }
  return { open, list, onClick, src, secs, mmss };
})();
