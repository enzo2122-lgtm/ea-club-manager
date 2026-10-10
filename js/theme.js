/* (3.15) Each person's look: a theme (the club, the stadium at night, the pitch, the nets), the colours of his favourite club,
   and his position (it suggests a theme and shows its little sign). Kept on this phone; the coaches' choice also travels with
   their dirigeant card (Store), so it follows them on another device. The decoration stays in the page heads: the rest of
   the page is unchanged, quick to read. Shared by the coaches' app (bundle) and the players' / families' pages. */
const Theme = (() => {
  const LOOKS = [
    ['club', 'Le club', 'Ses couleurs et les lignes du terrain'],
    ['stade', 'Le stade', 'Soir de match, tribunes et projecteurs'],
    ['pelouse', 'La pelouse', 'L\'herbe tondue en bandes'],
    ['filet', 'Les filets', 'Clair, le filet de la cage'],
  ];
  // [id, label, main colour (buttons, readable on white), second colour (the stripe)]
  const HEARTS = [['', 'Mon club', '', ''], ['paris', 'Paris', '#004170', '#da291c'], ['marseille', 'Marseille', '#0a7fb5', '#7fd0f0'], ['lyon', 'Lyon', '#1d4f9c', '#da1c2b'],
    ['lens', 'Lens', '#b30d27', '#f2c300'], ['saintetienne', 'Saint-Étienne', '#00703a', '#7fd6a2'], ['nantes', 'Nantes', '#00703a', '#ffe100'], ['lille', 'Lille', '#c8102e', '#1d2b5c'],
    ['barcelone', 'Barcelone', '#a50044', '#004d98'], ['madrid', 'Madrid', '#4b2483', '#d9c7ff'], ['turin', 'Turin', '#1f1f1f', '#bdbdbd'], ['liverpool', 'Liverpool', '#c8102e', '#00a398']];
  const POSTS = [['', 'Pas de poste', ''], ['gk', '🧤 Gardien', 'filet'], ['def', '🛡️ Défenseur', 'pelouse'], ['mil', '🎯 Milieu', 'pelouse'], ['att', '⚽ Attaquant', 'stade'],
    ['coach', '📋 Coach', 'club'], ['fan', '📣 Supporter', 'stade']];
  let scope = '';
  const KEY = () => (typeof AppCfg !== 'undefined' ? AppCfg.key('look') : 'look') + (scope ? ':' + scope : '');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function get() { try { const v = JSON.parse(localStorage.getItem(KEY()) || 'null'); if (v && typeof v === 'object') return { t: v.t || 'club', h: v.h || '', p: v.p || '', chosen: !!v.chosen }; } catch (e) {} return { t: 'club', h: '', p: '', chosen: false }; }
  function apply(v = get()) {
    const d = document.documentElement, h = HEARTS.find(x => x[0] === v.h);
    d.dataset.look = LOOKS.some(x => x[0] === v.t) ? v.t : 'club';
    if (h && h[2]) { d.dataset.heart = h[0]; d.style.setProperty('--heart', h[2]); d.style.setProperty('--heart2', h[3]); }
    else { delete d.dataset.heart; d.style.removeProperty('--heart'); d.style.removeProperty('--heart2'); }
    return v;
  }
  function set(v, onSaved) { try { localStorage.setItem(KEY(), JSON.stringify(v)); } catch (e) {} apply(v); if (onSaved) onSaved(v); }
  // the sign of one's position (in the header), or nothing
  const icon = (v = get()) => { const p = POSTS.find(x => x[0] === v.p); return p && p[0] ? p[1].split(' ')[0] : ''; };
  // a scope: one look per personal code on the players' / families' pages (a parent of two children may want two)
  function use(s, fromCard) { scope = s || ''; let v = get(); if (fromCard && fromCard.t && !localStorage.getItem(KEY())) { v = fromCard; try { localStorage.setItem(KEY(), JSON.stringify(v)); } catch (e) {} } return apply(v); }
  // the settings card: themes as small previews, the club of one's heart, one's position
  function card(title = 'Mon apparence', opts = {}) {
    const v = get();
    return `<section class="card look-card" id="lookCard"><h2>🎨 ${esc(title)}</h2>
      <p class="muted small">Pour toi seulement, sur ce téléphone. Le contenu ne change pas.</p>
      <div class="look-grid" role="radiogroup" aria-label="Thème">${LOOKS.map(([k, l, d]) => `<button type="button" class="look-pick ${v.t === k ? 'on' : ''}" role="radio" aria-checked="${v.t === k}" data-look="${k}">
        <span class="look-prev look-${k}"><i></i></span><b>${esc(l)}</b><small>${esc(d)}</small></button>`).join('')}</div>
      ${opts.heartNote ? `<p class="muted small">${esc(opts.heartNote)}</p>` : ''}<div class="lbl" ${opts.heartNote ? 'hidden' : ''}>Mon club de cœur</div>
      <div class="heart-row" ${opts.heartNote ? 'hidden' : ''}>${HEARTS.map(([k, l, a, b]) => `<button type="button" class="heart ${v.h === k ? 'on' : ''}" data-heart="${k}" aria-pressed="${v.h === k}" title="${esc(l)}">
        <span class="heart-sw" style="${a ? `background:linear-gradient(135deg,${a} 0 55%,${b} 55% 100%)` : ''}"></span><span>${esc(l)}</span></button>`).join('')}</div>
      <label class="fld"><span>Mon poste</span><select id="lookPost">${POSTS.map(([k, l]) => `<option value="${k}" ${v.p === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      <p class="muted small" id="lookTip">${v.p && POSTS.find(x => x[0] === v.p)[2] && POSTS.find(x => x[0] === v.p)[2] !== v.t ? `Pour ton poste, essaie « ${esc(LOOKS.find(x => x[0] === POSTS.find(y => y[0] === v.p)[2])[1])} ».` : ''}</p></section>`;
  }
  // (3.19) only the buttons of the card count: the page itself carries data-look / data-heart
  // the card's hands (call after the card is in the page); onSaved(v) to keep it elsewhere too, redraw() to show the change
  function bind(root, onSaved, redraw) {
    const box = root.querySelector('#lookCard'); if (!box) return;
    const again = () => { if (redraw) redraw(); else { const n = document.createElement('div'); n.innerHTML = card(); box.replaceWith(n.firstElementChild); bind(root, onSaved); } };
    box.onclick = e => {
      const l = e.target.closest('.look-pick[data-look]'), h = e.target.closest('.heart[data-heart]'); if (!l && !h) return;
      const v = get(); if (l) { v.t = l.dataset.look; v.chosen = true; } if (h) v.h = h.dataset.heart; set(v, onSaved); again();
    };
    const sel = box.querySelector('#lookPost'); if (sel) sel.onchange = () => { const v = get(), p = POSTS.find(x => x[0] === sel.value); v.p = sel.value; if (p && p[2] && !v.chosen) v.t = p[2]; set(v, onSaved); again(); };
  }
  const lum = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return 1; const n = parseInt(m[1], 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
  // the coaches' favourite club (chosen in « Mon compte »): its colours on their page, the darker one on the buttons (readable on white)
  function fromClub(c1, c2) {
    const d = document.documentElement; if (!c1 || get().h) return;
    const [a, b] = lum(c1) <= lum(c2) ? [c1, c2] : [c2, c1];
    if (lum(a) > .3) { d.style.setProperty('--heart2', a); return; } // two light colours: only the stripe
    d.dataset.heart = 'club'; d.style.setProperty('--heart', a); d.style.setProperty('--heart2', b);
  }
  // the pages that redraw themselves often (players / families): one listener for good, whatever the redraws
  let liveOn = false;
  function live(onSaved, redraw) {
    if (liveOn) return; liveOn = true;
    document.addEventListener('click', e => {
      const box = e.target.closest('#lookCard'); if (!box) return;
      const l = e.target.closest('.look-pick[data-look]'), h = e.target.closest('.heart[data-heart]'); if (!l && !h) return;
      const v = get(); if (l) { v.t = l.dataset.look; v.chosen = true; } if (h) v.h = h.dataset.heart; set(v, onSaved); redraw && redraw();
    });
    document.addEventListener('change', e => { if (e.target.id !== 'lookPost') return; const v = get(), p = POSTS.find(x => x[0] === e.target.value); v.p = e.target.value; if (p && p[2] && !v.chosen) v.t = p[2]; set(v, onSaved); redraw && redraw(); });
  }
  apply();
  return { LOOKS, HEARTS, POSTS, get, set, apply, use, card, bind, live, icon, fromClub };
})();
