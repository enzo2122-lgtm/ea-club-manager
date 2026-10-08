/* Helper (2.63): aide.html — an assistant or a parent notes the match live for the coach, with the code of the match (link / QR).
   Each action goes to the coach's phone (it is added to the match by his app); the score shown is the one of the coach's app. */
(() => {
  const $ = s => document.querySelector(s), page = $('#page');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let tt = 0; const toast = (m, err) => { const t = $('#toast'); t.textContent = m; t.className = 'toast show' + (err ? ' err' : ''); clearTimeout(tt); tt = setTimeout(() => { t.className = 'toast'; }, 2400); };
  const K = AppCfg.key('aide'), get = k => { try { return JSON.parse(localStorage.getItem(K + k)); } catch (e) { return null; } }, set = (k, v) => { try { localStorage.setItem(K + k, JSON.stringify(v)); } catch (e) {} };
  const fromHash = (location.hash.match(/[#&]c=([A-Z0-9]+)/i) || [])[1];
  let code = (fromHash || get('code') || '').toUpperCase(), who = get('who') || '', d = null, form = null, poss = get('poss:' + code) || null, timer = 0;
  if (fromHash) set('code', code);
  const ACTS = [['goal', '⚽', 'But pour nous', '#16a34a'], ['against', '🥅', 'But encaissé', '#dc2626'], ['chance', '🎯', 'Occasion', '#0891b2'], ['chanceThem', '⚠️', 'Occasion adverse', '#b45309'],
    ['save', '🧤', 'Arrêt du gardien', '#0d9488'], ['post', '🥅', 'Poteau / barre', '#0e7490'], ['yellow', '🟨', 'Carton jaune', '#ca8a04'], ['note', '📝', 'Note pour le coach', '#475569']];
  const NEED = { goal: ['player', 'assist'], yellow: ['player'], save: [], chance: ['player'] };
  const label = e => { const a = ACTS.find(x => x[0] === e.type); if (e.type === 'poss') return e.who === 'us' ? '👍 Ballon pour nous' : e.who === 'them' ? '👎 Ballon pour eux' : '⏸️ Possession arrêtée';
    const p = id => ((d && d.players || []).find(x => x.id === id) || {}).name || ''; return `${a ? a[1] + ' ' + a[2] : e.type}${e.player ? ' · ' + p(e.player) : ''}${e.assist ? ', passe de ' + p(e.assist) : ''}${e.text ? ' · ' + e.text : ''}`; };

  function ask() {
    page.innerHTML = `<div class="card"><h2>📲 Aide au match</h2><p class="info">Le coach t'a donné un code de match (ou un lien) : tu notes le match pour lui depuis ton téléphone.</p>
      <label class="fld"><span>Code du match</span><input class="ah-in" id="ahCode" value="${esc(code)}" placeholder="M…" autocapitalize="characters" maxlength="10"></label>
      <label class="fld"><span>Ton prénom (le coach saura qui note)</span><input class="ah-in" id="ahWho" value="${esc(who)}" placeholder="ex. Karim (papa de Yanis)" maxlength="40"></label>
      <p><button class="b yes on" id="ahGo">Ouvrir le match</button></p></div>`;
    $('#ahGo').onclick = () => { code = $('#ahCode').value.trim().toUpperCase(); who = $('#ahWho').value.trim(); set('code', code); set('who', who); load(); };
  }
  async function load(quiet) {
    if (!code) return ask();
    try { d = await Member.rpc('live_helper', { p_code: code }); }
    catch (e) { if (/CODE/.test(e.message) || /introuvable|invalide/i.test(e.message)) { toast('Code inconnu ou expiré : demande-le au coach', true); code = ''; set('code', ''); return ask(); } if (!quiet) toast(e.message, true); return; }
    if (!who && !quiet) return askWho();
    draw();
  }
  function askWho() { page.innerHTML = `<div class="card"><h2>Ton prénom</h2><p class="info">Le coach saura qui note le match.</p><input class="ah-in" id="ahWho" placeholder="ex. Karim (papa de Yanis)" maxlength="40"><p><button class="b yes on" id="ahOk">C'est parti</button></p></div>`;
    $('#ahOk').onclick = () => { who = $('#ahWho').value.trim() || 'Aide'; set('who', who); draw(); }; }
  function draw() {
    if (!d) return;
    $('#club').textContent = d.club || 'Clubbo'; $('#team').textContent = `${d.team || ''} · aide au match`;
    const us = d.team || 'Nous', them = d.opponent || 'Eux', gf = d.gf ?? 0, ga = d.ga ?? 0;
    const pl = d.players || [];
    page.innerHTML = `<div class="ah-score"><small>${esc(d.home ? us + ' – ' + them : them + ' – ' + us)}</small><b>${d.home ? gf : ga} – ${d.home ? ga : gf}</b><small>${d.status === 'end' ? 'Match terminé' : d.status && d.status !== 'pre' ? 'En cours · score du coach' : 'Pas encore commencé'}</small></div>
      ${form ? `<div class="card"><h3>${esc(label({ type: form.type }))}</h3>
        ${(NEED[form.type] || []).includes('player') ? `<p class="info">${form.type === 'goal' ? 'Buteur' : 'Joueur'} (facultatif)</p><div class="ah-pick">${pl.map(p => `<button class="${form.player === p.id ? 'on' : ''}" data-pk="player:${esc(p.id)}">${p.n ? esc(p.n) + '. ' : ''}${esc(p.name)}</button>`).join('')}</div>` : ''}
        ${(NEED[form.type] || []).includes('assist') ? `<p class="info">Passe décisive (facultatif)</p><div class="ah-pick">${pl.filter(p => p.id !== form.player).map(p => `<button class="${form.assist === p.id ? 'on' : ''}" data-pk="assist:${esc(p.id)}">${esc(p.name)}</button>`).join('')}</div>` : ''}
        <input class="ah-in" id="ahText" placeholder="${form.type === 'note' ? 'Ta note pour le coach' : 'Précision (facultatif)'}" maxlength="120" value="${esc(form.text || '')}">
        <p style="display:flex;gap:8px;justify-content:flex-end"><button class="b" data-ah="cancel">Annuler</button><button class="b yes on" data-ah="send">Envoyer au coach</button></p></div>` : ''}
      <div class="ah-acts">${ACTS.map(([k, ic, l, c]) => `<button style="--c:${c}" data-act="${k}"><b>${ic}</b>${esc(l)}</button>`).join('')}</div>
      <div class="card"><h3>⚽ Possession</h3><div class="ah-poss"><button class="${poss === 'us' ? 'on' : ''}" data-poss="us">👍 Nous</button><button class="them ${poss === 'them' ? 'on' : ''}" data-poss="them">Eux 👎</button></div>
        <p class="info">Touche quand le ballon change de camp ; retouche pour arrêter.</p></div>
      ${(d.sent || []).length ? `<div class="card"><h3>Envoyé au coach</h3><ul class="ah-sent">${d.sent.slice(0, 12).map(x => `<li>${esc(new Date(x.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))} · ${esc(label(x.ev))}${x.who ? ` <i>(${esc(x.who)})</i>` : ''}</li>`).join('')}</ul></div>` : ''}
      <p class="tip">Tu notes pour <b>${esc(who)}</b> · <a href="#" id="ahChange">changer</a></p>`;
  }
  async function send(ev) {
    try { d = await Member.rpc('live_helper_add', { p_code: code, p_ev: ev, p_who: who }); toast('✅ Envoyé au coach'); }
    catch (e) { toast(/LIMITE/.test(e.message) ? 'Trop d\'envois d\'un coup : attends un peu.' : e.message, true); }
    draw();
  }
  page.addEventListener('click', e => {
    if (e.target.id === 'ahChange') { e.preventDefault(); who = ''; set('who', ''); return askWho(); }
    const a = e.target.closest('[data-act]'); if (a) { const t = a.dataset.act; if (!NEED[t] && t !== 'note' && t !== 'against') return send({ type: t }); form = { type: t }; draw(); window.scrollTo(0, 0); return; }
    const pk = e.target.closest('[data-pk]'); if (pk) { const [k, v] = pk.dataset.pk.split(':'); form[k] = form[k] === v ? null : v; form.text = ($('#ahText') || {}).value || form.text; draw(); return; }
    const b = e.target.closest('[data-ah]'); if (b) { if (b.dataset.ah === 'cancel') { form = null; return draw(); } const f = form; f.text = ($('#ahText') || {}).value || ''; form = null; if (f.type === 'note' && !f.text.trim()) return draw(); return send(f); }
    const p = e.target.closest('[data-poss]'); if (p) { const w = p.dataset.poss, next = poss === w ? 'stop' : w; poss = next === 'stop' ? null : next; set('poss:' + code, poss); send({ type: 'poss', who: next }); }
  });
  load();
  timer = setInterval(() => { if (code && d && !form && !document.hidden) load(true); }, 10000);
})();
