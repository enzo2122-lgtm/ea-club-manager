/* President: the club at a glance for the responsables (numbers of the season, each category, what needs attention),
   and the club's backups (automatic every Monday on the server, or downloaded by hand). */
const President = (() => {
  const { esc, $, $$, toast, fmtDate, today } = UI;
  const S = () => Store.state;
  const addDays = (d, n) => { const x = new Date(d + 'T12:00'); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  const pl = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;
  const result = m => !m.played ? null : m.gf > m.ga ? 'V' : m.gf < m.ga ? 'D' : 'N';

  function figures() {
    const from = People.seasonFrom(), now = today();
    const ms = S().matches.filter(m => m.date >= from && !m.exempt && Store.kindOk(m)), played = ms.filter(m => m.played);
    const trs = S().trainings.filter(t => t.date >= from && t.date <= now);
    const rows = S().teams.map(t => {
      const ps = Store.playersOf(t.id), st = Store.staffOf(t.id);
      const tm = played.filter(m => m.teamId === t.id), called = trs.filter(x => x.teamId === t.id && (x.presents || []).length);
      const rate = called.length && ps.length ? Math.round(called.reduce((a, x) => a + Math.min(1, x.presents.length / ps.length), 0) / called.length * 100) : null;
      const r = k => tm.filter(m => result(m) === k).length;
      return { t, players: ps.length, staff: st.length, sessions: trs.filter(x => x.teamId === t.id).length, called: called.length, rate, played: tm.length, V: r('V'), N: r('N'), D: r('D'),
        noPhone: ps.filter(p => !p.phone && !(p.parents || []).some(x => x.phone)).length, noBirth: ps.filter(p => !p.birth).length,
        last: tm.slice().sort((a, b) => b.date.localeCompare(a.date))[0] };
    }).filter(r => r.players || r.played || r.sessions);
    return { ms, played, trs, rows, now };
  }

  function page(root) {
    if (!Auth.isAdmin()) { location.hash = '#/'; return; }
    const f = figures(), now = f.now, week = addDays(now, 7);
    const V = f.played.filter(m => result(m) === 'V').length, N = f.played.filter(m => result(m) === 'N').length, D = f.played.filter(m => result(m) === 'D').length;
    const bp = f.played.reduce((a, m) => a + (+m.gf || 0), 0), bc = f.played.reduce((a, m) => a + (+m.ga || 0), 0);
    const rates = f.rows.filter(r => r.rate != null), avgRate = rates.length ? Math.round(rates.reduce((a, r) => a + r.rate, 0) / rates.length) : null;
    const nextM = S().matches.filter(m => !m.exempt && !m.played && m.date >= now && m.date <= week).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
    const nextT = S().trainings.filter(t => t.date >= now && t.date <= week).length;
    const noScore = S().matches.filter(m => !m.exempt && !m.played && m.date < now && m.date >= People.seasonFrom());
    const issues = S().reports.filter(x => x.life === 'issue' && x.status !== 'done');
    const noCoach = f.rows.filter(r => r.players && !r.staff);
    const noPhone = f.rows.reduce((a, r) => a + r.noPhone, 0), noBirth = f.rows.reduce((a, r) => a + r.noBirth, 0);
    const maxP = Math.max(1, ...f.rows.map(r => r.players));
    const tile = (v, l, cls = '') => `<div class="tile ${cls}"><b>${v}</b><span>${l}</span></div>`;
    const alerts = [
      noCoach.length && `<li><b>${pl(noCoach.length, 'catégorie')} sans éducateur</b> : ${noCoach.map(r => `<a href="#/equipe/${r.t.id}">${esc(r.t.name)}</a>`).join(', ')}</li>`,
      noScore.length && `<li><b>${pl(noScore.length, 'match')} passé${noScore.length > 1 ? 's' : ''} sans score</b> : ${noScore.slice(0, 6).map(m => `<a href="#/match/${m.id}">${esc((Store.get('teams', m.teamId) || {}).name || '')} ${esc(fmtDate(m.date))}</a>`).join(', ')}${noScore.length > 6 ? '…' : ''}</li>`,
      issues.length && `<li><b>${pl(issues.length, 'signalement')} en cours</b> (objets perdus, matériel) : <a href="#/club">Vie du club</a></li>`,
      noPhone && `<li><b>${pl(noPhone, 'joueur')} sans aucun téléphone</b> (ni joueur ni parent) : <a href="#/joueurs">Joueurs</a></li>`,
      noBirth && `<li><b>${pl(noBirth, 'joueur')} sans date de naissance</b> (catégorie impossible à calculer)</li>`,
    ].filter(Boolean);
    root.innerHTML = `<header class="page-head"><div><h1>Tableau de bord</h1><p class="sub">Le club en un coup d'œil · saison ${esc(People.seasonLabel())}</p></div>
      <div class="head-actions"><a class="btn" href="#/codes">🔑<span>Codes personnels</span></a><a class="btn" href="#/licences">${I.check}<span>Licences et cotisations</span></a><a class="btn" href="#/encadrement">${I.whistle}<span>Qui encadre ?</span></a>
        <button class="btn" data-act="excel">${I.download}<span>Excel (présences, temps de jeu)</span></button><button class="btn" data-act="backup">${I.shield}<span>Sauvegardes</span></button></div></header>
      <div class="tiles">
        ${tile(S().players.length, 'Licenciés')}${tile(S().staff.length, 'Dirigeants')}${tile(f.rows.length, 'Équipes actives')}
        ${tile(f.played.length, 'Matchs joués')}${tile(V, 'Gagnés', 'v')}${tile(N, 'Nuls', 'n')}${tile(D, 'Perdus', 'd')}
        ${tile(`${bp}–${bc}`, Sport.W().Units + ' pour – contre')}${tile(avgRate == null ? '–' : avgRate + ' %', 'Présence moyenne')}${tile(f.trs.length, 'Séances passées')}
      </div>
      <div class="cards2">
        <section class="card"><h2>${I.calendar}Les 7 prochains jours</h2>
          <p class="muted">${pl(nextM.length, 'match')} · ${pl(nextT, 'séance')}</p>
          ${nextM.length ? `<ul class="res-list">${nextM.slice(0, 10).map(m => `<li><a class="${m.home ? 'side-home' : 'side-away'}" href="#/match/${m.id}"><span class="d">${esc(fmtDate(m.date))}${m.time ? ' ' + esc(m.time) : ''}</span><span class="o">${esc((Store.get('teams', m.teamId) || {}).name || '')} ${m.home ? 'contre' : 'chez'} ${esc(m.opponent || '?')}</span></a></li>`).join('')}</ul>` : ''}
        </section>
        <section class="card"><h2>${I.check}À surveiller</h2>${alerts.length ? `<ul class="alerts">${alerts.join('')}</ul>` : '<p class="muted">Rien à signaler 👍</p>'}</section>
        ${(() => { const reps = S().reports.filter(x => !x.life && x.status !== 'done').sort((a, b) => b.at - a.at);
          return `<section class="card"><h2>🐞 Signalements${reps.length ? ` <span class="pct pct-low">${reps.length} à traiter</span>` : ''}</h2>${reps.length ? `<ul class="alerts">${reps.slice(0, 5).map(x => `<li>${(Help.TYPES[x.type] || ['🐞'])[0]} <b>${esc(x.text.slice(0, 60))}${x.text.length > 60 ? '…' : ''}</b><br><span class="muted small">${esc(x.byName || '?')} · ${new Date(x.at).toLocaleDateString('fr-FR')}${x.page ? ' · page « ' + esc(x.page) + ' »' : ''}${x.shot ? ' · 📎 capture' : ''}</span></li>`).join('')}</ul>` : '<p class="muted">Aucun signalement en attente 👍</p>'}
            <a class="btn soft" href="#/reglages">${I.help}<span>Voir et traiter (Réglages)</span></a></section>`; })()}
        <section class="card" id="bkCard"><h2>${I.shield}Sauvegarde du club</h2><p class="muted">Chargement…</p></section>
      </div>
      <h2 class="section">Par catégorie</h2>
      <div class="table-wrap"><table class="tbl pres-tbl"><thead><tr><th>Catégorie</th><th>Licenciés</th><th>Encadrants</th><th>Séances (appel)</th><th>Présence</th><th>Matchs</th><th>V-N-D</th><th>Dernier match</th></tr></thead>
        <tbody>${f.rows.map(r => `<tr><td><a href="#/equipe/${r.t.id}"><b>${esc(r.t.name)}</b></a></td>
          <td><span class="bar-cell"><i style="width:${Math.round(r.players / maxP * 100)}%"></i><b>${r.players}</b></span></td>
          <td>${r.staff || '<span class="pct pct-low">0</span>'}</td><td>${r.sessions}${r.called !== r.sessions ? ` <span class="muted">(${r.called})</span>` : ''}</td>
          <td>${r.rate == null ? '–' : `<span class="pct ${r.rate >= 75 ? 'pct-good' : r.rate >= 50 ? 'pct-mid' : 'pct-low'}">${r.rate} %</span>`}</td>
          <td>${r.played}</td><td>${r.played ? `${r.V}-${r.N}-${r.D}` : '–'}</td>
          <td>${r.last ? `<a href="#/match/${r.last.id}">${esc(fmtDate(r.last.date))} ${r.last.home ? r.last.gf + '–' + r.last.ga : r.last.ga + '–' + r.last.gf}</a>` : '–'}</td></tr>`).join('')}</tbody></table></div>
      <p class="muted small">Présence : moyenne des séances où l'appel a été fait. Encadrants : dirigeants rattachés à la catégorie.</p>`;
    root.onclick = e => { const b = e.target.closest('button'); if (b && b.dataset.act === 'backup') return backupDialog(); if (b && b.dataset.act === 'excel') return ClubAdmin.csvSeason(); };
    backupCard($('#bkCard', root));
  }

  /* ---------- backups ---------- */
  const lastLocal = () => +S().club.lastBackupAt || 0;
  async function download(getData, label) {
    const b = UI.busy('Préparation de la sauvegarde…');
    try {
      const text = typeof getData === 'function' ? await getData() : getData;
      const r = await Exporter.json(text, `Sauvegarde-${S().club.name}-${label || today()}`);
      if (r !== 'cancel') { S().club.lastBackupAt = Date.now(); Store.save(); toast(r === 'downloaded' ? 'Sauvegarde enregistrée dans Téléchargements' : 'Sauvegarde prête'); }
    } catch (e) { toast(e.message || 'Sauvegarde impossible', 'err'); } finally { b.done(); }
  }
  const saveNow = () => download(async () => Library.withBackgrounds(Store.exportAll()), today());
  async function backupCard(box) {
    if (!box) return;
    const ago = lastLocal() ? Math.floor((Date.now() - lastLocal()) / 864e5) : null;
    let server = '';
    if (Cloud.ready()) {
      try {
        const [auto, list] = await Promise.all([Cloud.backupAuto(), Cloud.backups()]);
        const last = (list || [])[0];
        server = `<p>${auto ? '<span class="res res-V">Active</span> Copie automatique sur le serveur chaque lundi à 3 h (8 semaines gardées).' : '<span class="res res-N">Manuelle</span> La copie automatique n\'est pas activée sur le serveur.'}</p>
          <p class="muted small">${last ? `Dernière copie sur le serveur : ${esc(new Date(last.at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }))} (${(list || []).length} gardée${list.length > 1 ? 's' : ''}).` : 'Aucune copie sur le serveur pour l\'instant.'}</p>`;
      } catch (e) {
        server = e.code === 'MISE_A_JOUR' ? '<p class="tip">Pour la copie automatique chaque semaine : Réglages → Serveur du club → <b>Mettre à jour le serveur</b>.</p>' : `<p class="muted small">${esc(e.message)}</p>`;
      }
    }
    if (!box.isConnected) return;
    box.innerHTML = `<h2>${I.shield}Sauvegarde du club</h2>${server}
      <p class="muted small">Copie sur cet appareil : ${ago == null ? 'jamais' : ago === 0 ? 'aujourd\'hui' : `il y a ${pl(ago, 'jour')}`}.</p>
      <div class="chips"><button class="btn primary" data-bk="now">${I.download}<span>Télécharger une sauvegarde</span></button><button class="btn" data-bk="list">${I.layers}<span>Toutes les sauvegardes</span></button></div>`;
    box.onclick = e => { const b = e.target.closest('[data-bk]'); if (!b) return; if (b.dataset.bk === 'now') saveNow(); else backupDialog(); };
  }
  async function backupDialog() {
    let list = [], auto = false, err = '';
    if (Cloud.ready()) { try { [auto, list] = await Promise.all([Cloud.backupAuto(), Cloud.backups()]); } catch (e) { err = e.code === 'MISE_A_JOUR' ? 'Le serveur doit être mis à jour (Réglages → Serveur du club → Mettre à jour le serveur) pour les copies automatiques.' : e.message; } }
    const close = UI.modal({ title: 'Sauvegardes du club', noFocus: true, body: `
      <p><b>Chaque lundi à 3 h</b>, le serveur du club fait une copie complète des données (joueurs, dirigeants, séances, matchs, schémas…) et garde les <b>8 dernières semaines</b>. ${auto ? '✅ C\'est activé.' : ''}</p>
      ${err ? `<p class="tip">${esc(err)}</p>` : ''}
      ${list.length ? `<ul class="bk-list">${list.map(x => `<li><span><b>${esc(new Date(x.at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }))}</b> <span class="muted small">${x.kind === 'auto' ? 'automatique' : 'à la main'} · ${Math.max(1, Math.round((x.size || 0) / 1024))} Ko</span></span><button class="btn soft" data-bkget="${x.id}">${I.download}<span>Télécharger</span></button></li>`).join('')}</ul>` : Cloud.ready() && !err ? '<p class="muted">Pas encore de copie sur le serveur.</p>' : ''}
      <p class="tip">🔒 Ce fichier contient les noms, dates de naissance et téléphones des licenciés, dont des mineurs. Garde-le sur ton ordinateur ou une clé USB. <b>Ne le mets jamais sur GitHub</b>, dans un groupe WhatsApp ou un mail à plusieurs personnes. Pour le remettre dans l'appli : Réglages → Recevoir un fichier.</p>`,
      actions: [
        ...(Cloud.ready() && !err ? [{ label: 'Copie serveur maintenant', icon: I.shield, onClick: () => { (async () => { try { await Cloud.backupNow(); toast('Copie faite sur le serveur'); setTimeout(backupDialog, 60); } catch (e) { toast(e.message, 'err'); } })(); } }] : []),
        { label: 'Télécharger (cet appareil)', kind: 'primary', icon: I.download, onClick: () => { saveNow(); } }],
      onOpen: r => $$('[data-bkget]', r).forEach(b => b.onclick = () => { close(); const id = +b.dataset.bkget, x = list.find(y => y.id === id);
        download(async () => JSON.stringify(await Cloud.backupGet(id)), x ? new Date(x.at).toISOString().slice(0, 10) : 'serveur'); }) });
  }
  // Home page, responsables only: a reminder when no copy was taken for more than a week and the server doesn't do it
  function homeReminder() {
    if (!Auth.isAdmin() || !S().players.length) return '';
    const days = lastLocal() ? (Date.now() - lastLocal()) / 864e5 : 99;
    if (days < 7 || S().ui.autoBackup) return '';
    return `<section class="card backup-remind"><h2>${I.shield}Sauvegarde de la semaine</h2>
      <p class="muted">${lastLocal() ? `Dernière sauvegarde sur cet appareil il y a ${pl(Math.floor(days), 'jour')}.` : 'Aucune sauvegarde téléchargée sur cet appareil.'} Une copie des données du club, à garder en lieu sûr (jamais sur GitHub).</p>
      <div class="chips"><button class="btn primary" data-backup="now">${I.download}<span>Télécharger</span></button><a class="btn soft" href="#/president">${I.stats}<span>Tableau de bord</span></a></div></section>`;
  }
  // Once per session: if the server copies every week, no reminder is needed
  let checked = false;
  function checkAuto() {
    if (checked || !Auth.isAdmin() || !Cloud.ready()) return; checked = true;
    Cloud.backupAuto().then(a => { if (!!a !== !!S().ui.autoBackup) { S().ui.autoBackup = !!a; Store.persistNow(); } }).catch(() => {});
  }

  return { page, homeReminder, checkAuto, saveNow, backupDialog };
})();
