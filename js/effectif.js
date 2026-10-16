/* (3.28) Effectif: each exercise adapted to the number of players of the day. The coach sets « joueurs à la séance » (or the app takes the
   présents, else the « présent » answers, else the squad), and changes it at the last minute (+ / −) when someone joins or drops out.
   The exercise's text is read (« 4 contre 4 + 2 jokers », « par 3 », « 25 × 25 m ») → how many workshops, who is left over
   (jokers or rotation), the size of each area, and whether it all fits in half the pitch. */
const Effectif = (() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // half a pitch, in m² (11: 68 × 52, 8: about 45 × 32, 5: about 20 × 18)
  const HALF = { '11': [68, 52], '8': [45, 32], '5': [20, 18] };
  function read(e) {
    const t = `${e.title || ''} ${e.org || ''}`.replace(/\s+/g, ' '), low = t.toLowerCase();
    const vs = /(?<!\d)(\d{1,2})\s*(?:contre|c|v|vs|x)\s*(\d{1,2})(?!\d)(?!\s*m\b)/i.exec(t);
    const jok = +((/\+\s*(\d{1,2})\s*(?:joker|appui|neutre)/i.exec(t) || [])[1] || 0) || (/\+\s*(?:un|1)\s*(?:joker|appui|neutre)/i.test(t) ? 1 : 0);
    const gk = /gardiens?/i.test(t) && vs ? (/\+\s*(?:2\s*)?gardiens/i.test(t) || /\+\s*gk/i.test(low) ? 2 : 0) : 0;
    const par = /par\s+(\d{1,2})\b/i.exec(t) || /groupes?\s+de\s+(\d{1,2})/i.exec(t) || /(\d)\s+joueurs\s+par\s+(?:carr|atelier|groupe)/i.exec(t);
    const sz = /(\d{1,3})\s*(?:m\s*)?[x×]\s*(\d{1,3})\s*m/i.exec(t);
    return { a: vs ? +vs[1] : 0, b: vs ? +vs[2] : 0, jok, gk, par: par ? +par[1] : 0, w: sz ? +sz[1] : 0, h: sz ? +sz[2] : 0 };
  }
  const round5 = x => Math.max(5, Math.round(x / 5) * 5);
  // (3.42) the text says nothing about the players: its schema (the coach's, or the one the app draws) shows them, two colours = two teams
  function fromSchema(e) {
    let sc = null;
    try { sc = (e.schemaId && typeof Store !== 'undefined' && Store.get('schemas', e.schemaId)) || (typeof AutoSchema !== 'undefined' && (e.org || e.consignes) ? AutoSchema.preview(e) : null); } catch (x) { sc = null; }
    const pl = ((sc && sc.objects) || []).filter(o => o.type === 'player'), by = {};
    pl.filter(o => !o.gk && o.label !== 'J').forEach(o => { by[o.color] = (by[o.color] || 0) + 1; });
    const cols = Object.values(by).sort((x, y) => y - x);
    if (cols.length !== 2 || cols[1] < 2) return {};
    return { a: cols[0], b: cols[1], jok: pl.filter(o => o.label === 'J').length, gk: pl.filter(o => o.gk).length };
  }
  // the advice for n players, or '' when the text says nothing about the players
  function adapt(e, n, format) {
    n = Math.max(0, Math.round(+n || 0)); if (!n) return '';
    const r = Object.assign(read(e), {}), half = HALF[format] || HALF['11'], halfArea = half[0] * half[1];
    if (!(r.a && r.b) && !r.par && !/\bmatch\b|opposition|jeu libre/i.test(`${e.title || ''} ${e.org || ''}`)) Object.assign(r, fromSchema(e)); // (3.42) nothing written (« Jeu à 4 portes ») : the players of its schema
    let line = '', groups = 1, per = 0, w = r.w, h = r.h;
    if (r.a && r.b) {
      per = r.a + r.b + r.jok + r.gk;
      if (per > 30) return '';
      groups = Math.floor(n / per);
      if (!groups) { // fewer players than the exercise: one game, smaller
        const field = n - r.jok - r.gk, a = Math.ceil(field / 2), b = Math.max(1, field - a);
        line = `1 atelier à ${a} contre ${b}${r.jok ? ` + ${r.jok} joker${r.jok > 1 ? 's' : ''}` : ''}${r.gk ? ' + gardiens' : ''}`;
        if (w && h) { const k = Math.sqrt(n / per); w = round5(w * k); h = round5(h * k); }
        groups = 1;
      } else if (groups === 1 && r.a >= 4 && n - per > 2 && n < per * 1.6) { // one game and several more players: the game gets bigger, nobody waits
        const field = n - r.jok - r.gk, a = Math.ceil(field / 2), b = field - a;
        line = `1 atelier à ${a} contre ${b}${r.jok ? ` + ${r.jok} joker${r.jok > 1 ? 's' : ''}` : ''}${r.gk ? ' + gardiens' : ''} (terrain agrandi)`;
        if (w && h) { const k = Math.sqrt(n / per); w = round5(w * k); h = round5(h * k); }
      } else {
        const rest = n - groups * per;
        line = `${groups} atelier${groups > 1 ? 's' : ''} de ${r.a} contre ${r.b}${r.jok ? ` + ${r.jok} joker${r.jok > 1 ? 's' : ''}` : ''}${r.gk ? ' + gardiens' : ''}`;
        if (rest) line += rest <= 2 * groups ? ` · ${rest} en plus : joker${rest > 1 ? 's' : ''}${groups > 1 ? ' (1 par atelier)' : ''}` : rest >= Math.ceil(per * .6) ? ` · ${rest} en plus : un atelier de plus à ${Math.ceil((rest - r.jok) / 2)} contre ${Math.floor((rest - r.jok) / 2)}` : ` · ${rest} en plus : rotation (on change toutes les 2-3 min)`;
        if (rest >= Math.ceil(per * .6)) groups++;
      }
    } else if (r.par) {
      per = r.par; groups = Math.floor(n / per); const rest = n - groups * per;
      if (!groups) return `${n} joueur${n > 1 ? 's' : ''} : un seul groupe`;
      line = `${groups} groupe${groups > 1 ? 's' : ''} de ${per}${rest ? ` · ${rest} en plus : ${rest === 1 ? 'il rejoint un groupe' : `un groupe de ${rest}` }` : ''}`;
      if (rest > 1) groups++;
    } else if (/\bmatch\b|opposition|jeu libre/i.test(`${e.title || ''} ${e.org || ''}`)) { // (3.41) a game without « 6 contre 6 » written: two teams, the odd one is a joker
      line = `2 équipes de ${Math.floor(n / 2)}${n % 2 ? ' + 1 joker (il joue avec l’équipe qui a le ballon)' : ''}`;
    } else return '';
    if (w && h) {
      const need = groups * w * h, fits = need <= halfArea * 1.05;
      line += ` · ${w} × ${h} m${groups > 1 ? ' chacun' : ''}`;
      if (groups > 1 || need > halfArea * .6) line += fits ? ' · tient dans le demi-terrain ✓' : ` · ⚠️ trop grand pour le demi-terrain : réduis à ${round5(w * Math.sqrt(halfArea / need))} × ${round5(h * Math.sqrt(halfArea / need))} m`;
    }
    return line;
  }
  // the number of the day and where it comes from
  function count(tr, squad, dispo) {
    if (tr.nPlayers) return [+tr.nPlayers, 'choisi'];
    if ((tr.presents || []).length) return [tr.presents.length, 'présents'];
    if (dispo && dispo.yes && dispo.yes.size) return [dispo.yes.size, 'ont répondu présent'];
    return [squad, 'effectif'];
  }
  // the bar above the exercises: − n +, and where the number comes from
  function bar(tr, squad, dispo) {
    const [n, from] = count(tr, squad, dispo);
    return `<div class="eff-bar"><span class="eff-l">👥 Joueurs à la séance</span>
      <span class="eff-step"><button type="button" class="icon-btn" data-effn="-1" aria-label="Un joueur de moins">−</button><b>${n}</b><button type="button" class="icon-btn" data-effn="1" aria-label="Un joueur de plus">+</button></span>
      ${dispo && dispo.ready && (dispo.yes.size || dispo.no.size) ? `<span class="eff-votes"><b class="eff-yes">✓ ${dispo.yes.size} présent${dispo.yes.size > 1 ? 's' : ''}</b><b class="eff-no">✗ ${dispo.no.size} absent${dispo.no.size > 1 ? 's' : ''}</b><span class="muted small">ont répondu</span></span>` : ''}
      <span class="muted small">${tr.nPlayers ? `choisi à la main · <button type="button" class="linkish" data-effn="0">reprendre ${(tr.presents || []).length ? 'les présents' : 'le compte automatique'}</button>` : esc(from)} · les exercices s'adaptent</span></div>`;
  }
  return { read, adapt, count, bar };
})();
