/* Sources: the club's data brought up to date in one gesture from AssistCoachAI and Footclubs (FFF), without any password kept.
   Neither site lets another app read it: the gesture starts ON the site, where the responsable is logged in. A bookmark
   (« favori ») reads the data with his own connection, opens the app on #/recevoir-source and hands the data over
   (postMessage, accepted only from these two sites). The app shows what changes, then imports without duplicates.
   Footclubs: new licenciés are added in their category; the players already there are completed (birth date, licence state)
   but never moved (a player put in another category by hand stays there). AssistCoachAI: the same import as its file. */
const Sources = (() => {
  const { esc, toast, modal } = UI;
  const S = () => Store.state;
  const ALLOWED = ['https://assistcoachai.com', 'https://footclubs.fff.fr', 'https://epreuves.fff.fr'];
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const appUrl = () => location.href.split('#')[0].split('?')[0].replace(/index\.html$/, '');

  /* ---------- the bookmarks, made for this app's address ---------- */
  function bookmarks() {
    const A = JSON.stringify(appUrl());
    const ac = `(async()=>{const A=${A};if(!/assistcoachai\\.com$/.test(location.host)){alert('Ouvre d\\'abord AssistCoachAI (connecté), puis touche ce favori.');return;}
const w=window.open(A+'#/recevoir-source','clubimport');
const j=async u=>{const r=await fetch(u,{credentials:'include'});if(!r.ok)throw new Error(u.split('?')[0]+' : '+r.status);return r.json();};
try{const eff=await j('/api/effectif/sync');const t=(eff.teams||[]).find(x=>x.is_active)||(eff.teams||[])[0];if(!t)throw new Error('aucune équipe');const T=t.id;
const d=new Date(),y=d.getMonth()>=6?d.getFullYear():d.getFullYear()-1,f=y+'-07-01',to=d.toISOString().slice(0,10),q='?teamId='+T;
const [planning,seances,medical,wellness,rpe,ch]=await Promise.all([j('/api/planning'+q),j('/api/seances'),j('/api/medical/cases'+q),j('/api/wellness/logs'+q+'&kind=wellness&from='+f+'&to='+to),j('/api/wellness/logs'+q+'&kind=rpe&from='+f+'&to='+to),j('/api/championship'+q)]);
delete planning.acks;const champDetail={};for(const c of (ch.championships||[])){try{champDetail[c.id]=await j('/api/championship/'+c.id);}catch(e){}}
const D={source:'assistcoachai',effectif:{players:(eff.players||[]).filter(p=>!p.team_id||p.team_id===T),teams:[t]},planning,seances,medical,wellness,rpe,champDetail};
let n=0;const send=()=>{try{w.postMessage({type:'club-import',source:'assistcoachai',payload:D},new URL(A).origin);}catch(e){}};
addEventListener('message',e=>{if(e.source===w&&e.data==='club-import-ready'&&!n++)send();});}catch(e){alert('Lecture impossible : '+e.message);}})()`;
    // Footclubs shows the list 30 by 30 (« De 1 à 30 sur 361 »): the bookmark reads every page (« page suivante », reading only)
    const fc = `(async()=>{const A=${A};const RG=/De (\\d+) à (\\d+) sur (\\d+)/;
const wins=[window];for(const f of document.querySelectorAll('frame,iframe')){try{if(f.contentWindow&&f.contentWindow.document)wins.push(f.contentWindow);}catch(e){}}
const W=wins.find(x=>{try{return RG.test(x.document.body.innerText);}catch(e){return false;}});
if(!W){alert('Dans Footclubs, ouvre Licences → Liste (touche « Afficher »), puis touche ce favori.');return;}
const w=window.open(A+'#/recevoir-source','clubimport');let ready=false,data=null;
const send=()=>{if(ready&&data){w.postMessage({type:'club-import',source:'footclubs',payload:data},new URL(A).origin);data=null;}};
addEventListener('message',e=>{if(e.source===w&&e.data==='club-import-ready'){ready=true;send();}});
const range=()=>{const m=RG.exec(W.document.body.innerText);return m?[+m[1],+m[2],+m[3]]:null;};
const wait=async s=>{for(let k=0;k<80;k++){await new Promise(r=>setTimeout(r,250));try{const r=range();if(r&&r[0]===s)return true;}catch(e){}}return false;};
const rows=[],seen={};const grab=()=>{for(const tr of W.document.querySelectorAll('tr')){const c=[...tr.cells].map(x=>x.innerText.trim());const i=c.findIndex(x=>/^\\d{2}\\/\\d{2}\\/\\d{4}$/.test(x));
if(i>0&&/[A-Z]/.test(c[i-1])&&c[i+1]){const k=c[i-1]+c[i]+c[i+1];if(!seen[k]){seen[k]=1;rows.push({name:c[i-1],birth:c[i],cat:c[i+1]||'',date:c[i+2]||'',etat:c[i+3]||'',lic:(tr.innerHTML.match(/selectPersonne\\('(\\d+)'/)||[])[1]||''});}}}};
let r=range();if(r&&r[0]!==1){W.otherlist(W.firstlist,W.name,'F');await wait(1);}
for(let p=0;p<80;p++){grab();r=range();if(!r||r[1]>=r[2])break;const nx=r[1]+1;W.otherlist(W.nextlist,W.name,'N');if(!await wait(nx))break;}
data={rows,total:(range()||[0,0,rows.length])[2]};send();})()`;
    const link = code => 'javascript:' + encodeURIComponent(code.replace(/\n/g, ''));
    // (1.40) the club's page on epreuves.fff.fr (public): the results shown and the official table of each of our divisions
    const ff = `(async()=>{const A=${A};const cm=/\\/competition\\/club\\/(\\d+)/.exec(location.pathname);
if(!/epreuves\\.fff\\.fr$/.test(location.host)||!cm){alert('Ouvre la page de ton club sur epreuves.fff.fr (Équipes, le mois du week-end), puis touche ce favori.');return;}
const w=window.open(A+'#/recevoir-source','clubimport');let ready=false,data=null;
const send=()=>{if(ready&&data){w.postMessage({type:'club-import',source:'fff',payload:data},new URL(A).origin);data=null;}};
addEventListener('message',e=>{if(e.source===w&&e.data==='club-import-ready'){ready=true;send();}});
const main=document.querySelector('main')||document.body,as=[...main.querySelectorAll('a[href]')],pou={},logos={};
const addLogos=r=>{for(const a of r.querySelectorAll('a[href*="/competition/club/"]')){const m=/\\/competition\\/club\\/(\\d+)/.exec(a.getAttribute('href'));const n=a.innerText.trim();if(m&&n&&m[1]!==cm[1]&&!/[\\n]|favoris|lien vers/i.test(n)&&!logos[n])logos[n]=m[1];}};addLogos(main);
as.forEach((a,i)=>{const m=/^\\/competition\\/engagement\\/\\d+[^/]*\\/phase\\/\\d+\\/\\d+/.exec(a.getAttribute('href')||'');if(!m||pou[m[0]])return;let our='';
for(let j=i+1;j<Math.min(as.length,i+7);j++){if((as[j].getAttribute('href')||'').indexOf('/competition/club/'+cm[1])===0){our=as[j].innerText.trim();break;}}
pou[m[0]]={url:m[0],comp:a.innerText.trim().replace(/\\s+(Journée|TOUR)\\b.*$/i,''),our};});
const poules=[];for(const p of Object.values(pou)){try{const d=new DOMParser().parseFromString(await (await fetch(p.url+'/classement')).text(),'text/html');let best=[];
for(const tb of d.querySelectorAll('table')){const rs=[...tb.querySelectorAll('tr')].map(tr=>[...tr.cells].map(c=>c.innerText.trim()));if(rs[0]&&rs[0].includes('Bp.')&&rs.length>best.length)best=rs;}
addLogos(d);p.rows=best;
try{const wd=new DOMParser().parseFromString(await (await fetch(p.url)).text(),'text/html'),week=[];let cur=null;
for(const s of wd.querySelectorAll('span.schedule-match,span.equipe-name,span.digit')){const c=String(s.className);if(/schedule-match/.test(c)){cur={when:s.textContent.trim(),teams:[],sc:[]};week.push(cur);}else if(cur){if(/equipe-name/.test(c))cur.teams.push(s.textContent.trim());else cur.sc.push(s.textContent.trim());}}
p.week=week.filter(x=>x.teams.length===2);}catch(e){}
poules.push(p);}catch(e){}}
const sheets=[],RGD=/(LUN|MAR|MER|JEU|VEN|SAM|DIM)\\s+\\d{2}\\s+[A-ZÉÛ]+\\s+\\d{4}/;
for(const a of main.querySelectorAll('a[href*="/competition/match/"]')){if(!/^\\d+\\s+\\d+$/.test(a.innerText.trim()))continue;let el=a,dt='';for(let k=0;k<6&&el;k++){el=el.parentElement;const m=el&&RGD.exec(el.innerText);if(m){dt=m[0];break;}}
try{const href=a.getAttribute('href').replace(/\\/match$/,''),d=new DOMParser().parseFromString(await (await fetch(href)).text(),'text/html');
const moments=[...d.querySelectorAll('app-moment-fort')].map(x=>{const ac=x.querySelector('.action'),sp=[...x.querySelectorAll('span')].map(s=>s.textContent.trim()).filter(Boolean);return {min:parseInt(sp[0],10)||0,side:ac&&/visiteur/.test(ac.className)?'away':'home',type:(sp[1]||'').split(' ')[0],names:sp.slice(4)};});
const teams=[...d.querySelectorAll('.compo-team')].map(c=>{const tb=[...c.querySelectorAll('table')].map(t=>[...t.querySelectorAll('tr.player')].map(tr=>{const v=[...tr.cells].map(z=>z.textContent.trim());return {n:v[0],name:v[1]};}));
const name=(c.querySelector('h1,h2,h3,h4,[class*=name]')||{}).textContent;return {name:(name||'').trim(),starters:tb[0]||[],subs:tb.slice(1).flat()};});
if(teams.length)sheets.push({date:dt,title:d.title,url:href,moments,teams});}catch(e){}}
data={club:cm[1],calendar:main.innerText,poules,logos,sheets};send();})()`;
    return { ac: link(ac), fc: link(fc), ff: link(ff) };
  }
  function card() {
    if (!Auth.isAdmin()) return '';
    const b = bookmarks();
    return `<section class="card src-card"><h2>📥 Mise à jour depuis AssistCoachAI et Footclubs</h2>
      <p class="muted small">Un geste, sans mot de passe enregistré : les joueurs à jour (licences, catégories, dates de naissance) et, depuis AssistCoachAI, le planning, les présences, les blessures et le bien-être. L'appli te montre ce qui change avant d'enregistrer, sans doublon.</p>
      <ol class="steps-help"><li><b>Une seule fois, sur l'ordinateur :</b> fais glisser ces deux boutons dans la barre des favoris de ton navigateur.
        <div class="chips src-bm"><a class="btn" href="${esc(b.ac)}" onclick="event.preventDefault();UI.toast('Fais-le glisser dans la barre des favoris')">📥 AssistCoachAI → ${esc(AppCfg.name)}</a><a class="btn" href="${esc(b.fc)}" onclick="event.preventDefault();UI.toast('Fais-le glisser dans la barre des favoris')">📥 Footclubs → ${esc(AppCfg.name)}</a><a class="btn" href="${esc(b.ff)}" onclick="event.preventDefault();UI.toast('Fais-le glisser dans la barre des favoris')">🏆 Résultats FFF → ${esc(AppCfg.name)}</a></div></li>
        <li><b>AssistCoachAI :</b> connecte-toi, puis touche le favori « AssistCoachAI ».</li>
        <li><b>Résultats du week-end</b> (le dimanche soir) : ouvre la page de ton club sur <a href="${esc(S().club.fffUrl || 'https://epreuves.fff.fr/')}" target="_blank" rel="noopener">epreuves.fff.fr</a> (onglet Équipes, le mois du week-end), puis touche le favori « Résultats FFF » : scores de toutes tes équipes et classements officiels de leurs poules.</li>
        <li><b>Footclubs :</b> connecte-toi, ouvre <b>Licences → Liste</b>, touche « Afficher », puis le favori « Footclubs ».</li>
        <li>L'appli s'ouvre et te montre les changements : touche <b>Importer</b>.</li></ol>
      <p class="muted small">À refaire quand tu veux (une fois par semaine, ou après une vague de licences). Rien n'est envoyé ailleurs que dans l'appli du club.</p></section>`;
  }

  /* ---------- the app opened by a bookmark ---------- */
  function receive() {
    if (!window.opener) return toast('Ouvre cette page avec le favori, depuis AssistCoachAI ou Footclubs.', 'err');
    const b = UI.busy('Réception des données…');
    let got = false;
    const ping = setInterval(() => { try { window.opener.postMessage('club-import-ready', '*'); } catch (e) {} }, 400);
    const stop = setTimeout(() => { clearInterval(ping); if (!got) { b.done(); toast('Rien reçu : touche à nouveau le favori sur le site.', 'err'); } }, 60000);
    addEventListener('message', e => {
      if (got || !ALLOWED.includes(e.origin) || !e.data || e.data.type !== 'club-import') return;
      got = true; clearInterval(ping); clearTimeout(stop); b.done();
      if (!Auth.isAdmin()) return toast('Réservé à un responsable du club.', 'err');
      try { e.data.source === 'footclubs' ? footclubs(e.data.payload) : e.data.source === 'fff' ? fff(e.data.payload) : assist(e.data.payload); } catch (err) { console.error(err); toast(err.message || 'Données illisibles', 'err'); }
    });
  }

  /* ---------- Footclubs: the licenciés ---------- */
  const PLAYER_CAT = /^(Libre|Foot Loisir|Futsal|Foot Entreprise)\b/i;
  const LIC = e => /valid|renouvel/i.test(e) && !/non valid/i.test(e) ? 'ok' : /non valid|incompl|non factur/i.test(e) ? 'attente' : '';
  function footclubs(P) {
    const rows = (P.rows || []).filter(r => PLAYER_CAT.test(r.cat) && !/supprim/i.test(r.etat))
      .map(r => Object.assign(People.parseLines(`${r.name}\t${r.birth}\t${r.cat}`)[0] || {}, { etat: r.etat, depart: /d[ée]part/i.test(r.etat), licence: r.lic || '' })).filter(x => x.lastName);
    const ours = S().players;
    const digits = s => String(s || '').replace(/\D/g, '');
    const find = x => (x.licence && ours.find(p => digits(p.licence) === x.licence)) || ours.find(p => (p.lastName || '').toUpperCase() === x.lastName && norm(p.firstName) === norm(x.firstName) && (!p.birth || p.birth === x.birth))
      || ours.find(p => norm(`${p.firstName} ${p.lastName}`) === norm(`${x.firstName} ${x.lastName}`) && p.birth === x.birth);
    const plan = rows.map(x => ({ x, p: find(x) }));
    const fresh = plan.filter(r => !r.p && !r.x.depart), known = plan.filter(r => r.p), gone = known.filter(r => r.x.depart);
    const upd = known.filter(r => (!r.p.birth && r.x.birth) || (r.x.licence && !r.p.licence) || (LIC(r.x.etat) && ((r.p.adm || {}).lic || '') !== LIC(r.x.etat)));
    const names = list => list.slice(0, 40).map(r => esc(`${r.x.firstName} ${r.x.lastName}`)).join(', ') + (list.length > 40 ? ` et ${list.length - 40} autres` : '');
    const all = (P.rows || []).length, miss = P.total && all < P.total;
    modal({ title: '📥 Footclubs : ce qui change', noFocus: true, body: `<p class="lead">${all} licence${all > 1 ? 's' : ''} lue${all > 1 ? 's' : ''} dans Footclubs${P.total ? ` sur ${P.total}` : ''}, dont ${rows.length} joueur${rows.length > 1 ? 's' : ''} (les dirigeants, éducateurs et arbitres sont laissés de côté).</p>
      ${miss ? '<p class="tip">⚠️ Toutes les pages de la liste n\'ont pas pu être lues : vérifie ta connexion à Footclubs et touche à nouveau le favori. Tu peux quand même importer ce qui a été lu.</p>' : ''}
      <ul class="src-sum"><li>🆕 <b>${fresh.length}</b> nouveau${fresh.length > 1 ? 'x' : ''} joueur${fresh.length > 1 ? 's' : ''}, rangé${fresh.length > 1 ? 's' : ''} dans ${fresh.length > 1 ? 'leur' : 'sa'} catégorie${fresh.length ? ` : <span class="muted small">${names(fresh)}</span>` : ''}</li>
      <li>✏️ <b>${upd.length}</b> joueur${upd.length > 1 ? 's' : ''} complété${upd.length > 1 ? 's' : ''} (numéro de licence, date de naissance, état de la licence)</li>
      <li>✅ <b>${known.length - upd.length}</b> déjà à jour, sans doublon</li>
      ${gone.length ? `<li>👋 <b>${gone.length}</b> marqué${gone.length > 1 ? 's' : ''} « Départ » dans Footclubs (gardé${gone.length > 1 ? 's' : ''} dans l'appli, à retirer à la main si besoin) : <span class="muted small">${names(gone)}</span></li>` : ''}</ul>
      <p class="muted small">Les joueurs déjà dans l'appli ne changent pas de catégorie (un joueur surclassé reste où tu l'as mis).</p>`,
      actions: [{ label: 'Annuler' }, { label: 'Importer', kind: 'primary', onClick: () => {
        fresh.forEach(({ x }) => { const cat = People.catOf(x), t = cat ? People.ageTeam(cat) : null;
          Store.upsert('players', { id: Store.uid(), firstName: x.firstName, lastName: x.lastName, birth: x.birth, subcat: x.subcat, licence: x.licence || '', number: '', pos: '', phone: '', email: '', parents: [], notes: '', teamIds: t ? [t.id] : [], adm: LIC(x.etat) ? { lic: LIC(x.etat) } : {} }); });
        upd.forEach(({ x, p }) => { if (!p.birth && x.birth) p.birth = x.birth; if (x.licence && !p.licence) p.licence = x.licence; if (LIC(x.etat)) p.adm = Object.assign({}, p.adm, { lic: LIC(x.etat) }); if (x.subcat && !p.subcat) p.subcat = x.subcat; Store.upsert('players', p); });
        Store.sortTeams(); Store.save(); App.route();
        toast(`Footclubs : ${fresh.length} ajouté${fresh.length > 1 ? 's' : ''}, ${upd.length} complété${upd.length > 1 ? 's' : ''}`);
      } }] });
  }

  /* ---------- AssistCoachAI: its team (players, planning, attendance, injuries, well-being) ---------- */
  function assist(D) {
    if (!ACImport.isExport(D)) throw new Error('Données AssistCoachAI incomplètes');
    const digits = s => String(s || '').replace(/\D/g, ''), ours = S().players;
    const ps = D.effectif.players || [], known = ps.filter(a => ours.some(x => x.acId === a.id || (digits(a.licence) && digits(x.licence) === digits(a.licence)) || (norm(`${x.firstName} ${x.lastName}`) === norm(`${a.prenom} ${a.nom}`) && (!a.dob || !x.birth || x.birth === a.dob))));
    const t = (D.effectif.teams || [])[0] || {}, evs = (D.planning.events || []).length;
    modal({ title: '📥 AssistCoachAI : ce qui va être mis à jour', noFocus: true, body: `<p class="lead">Équipe « ${esc(t.name || '')} »</p>
      <ul class="src-sum"><li>👥 <b>${ps.length}</b> joueurs : ${ps.length - known.length} nouveau${ps.length - known.length > 1 ? 'x' : ''}, ${known.length} déjà dans l'appli (complétés, sans doublon)</li>
      <li>📅 <b>${evs}</b> matchs et entraînements, avec convocations, présences et efforts</li>
      <li>🚑 ${((D.medical || {}).cases || []).length} blessures · 💚 ${((D.wellness || {}).logs || []).length} questionnaires de bien-être · 🏆 ${Object.keys(D.champDetail || {}).length} championnat${Object.keys(D.champDetail || {}).length > 1 ? 's' : ''}</li></ul>
      <p class="muted small">Ce qui existe déjà est mis à jour, rien n'est ajouté deux fois (chaque chose garde son lien avec AssistCoachAI).</p>`,
      actions: [{ label: 'Annuler' }, { label: 'Importer', kind: 'primary', onClick: () => { setTimeout(() => ACImport.fromText(JSON.stringify(D)), 60); } }] });
  }
  /* ---------- (1.40) the FFF / District site: results and official tables ---------- */
  const num = v => { const n = parseInt(String(v || '').replace(/[^\d-]/g, ''), 10); return isNaN(n) ? 0 : n; };
  function tableOf(rows) {
    const H = rows[0] || [], ix = k => H.indexOf(k);
    const iT = ix('Equipe'), cols = { pts: ix('Pts'), j: ix('J.'), v: ix('G.'), n: ix('N.'), d: ix('P.'), f: ix('F.'), bp: ix('Bp.'), bc: ix('Bc.'), diff: ix('Diff.') };
    if (iT < 0 || cols.pts < 0) return [];
    return rows.slice(1).filter(r => r[iT]).map(r => Object.assign({ rank: num(r[0]), name: r[iT] }, Object.fromEntries(Object.entries(cols).map(([k, i]) => [k, i < 0 ? 0 : num(r[i])]))));
  }
  function fff(P) {
    if (P.club) S().club.fffClub = P.club;
    const found = Importer.parseFFF(P.calendar || '').filter(m => m.date);
    const played = found.filter(m => m.played);
    const sheetsPlan = []; // filled once the scores are known (see below)
    const tables = (P.poules || []).map(p => ({ p, t: Importer.guessTeam(p.comp, p.our || ''), rows: tableOf(p.rows || []) })).filter(x => x.t && x.rows.length);
    (P.sheets || []).forEach(s => { const x = sheetPlan(s, found); if (x) sheetsPlan.push(x); });
    modal({ title: '🏆 Résultats FFF : ce qui change', noFocus: true, body: `<ul class="src-sum">
      <li>⚽ <b>${played.length}</b> résultat${played.length > 1 ? 's' : ''} lu${played.length > 1 ? 's' : ''} sur la page (${found.length} match${found.length > 1 ? 's' : ''} du mois en tout) : scores mis à jour sans doublon</li>
      ${sheetsPlan.length ? `<li>📋 <b>${sheetsPlan.length}</b> feuille${sheetsPlan.length > 1 ? 's' : ''} de match : ${sheetsPlan.reduce((a, s) => a + s.cards, 0)} carton${sheetsPlan.reduce((a, s) => a + s.cards, 0) > 1 ? 's' : ''}, ${sheetsPlan.reduce((a, s) => a + s.nsubs, 0)} remplacement${sheetsPlan.reduce((a, s) => a + s.nsubs, 0) > 1 ? 's' : ''}, temps de jeu de ${sheetsPlan.reduce((a, s) => a + s.known, 0)} joueur${sheetsPlan.reduce((a, s) => a + s.known, 0) > 1 ? 's' : ''}${sheetsPlan.some(s => s.unknown.length) ? `<br><span class="muted small">Noms de la feuille non reconnus dans l'appli (vérifie leur prénom) : ${esc([...new Set(sheetsPlan.flatMap(s => s.unknown))].slice(0, 20).join(', '))}</span>` : ''}</li>` : ''}
      <li>📅 <b>${(P.poules || []).reduce((a, p) => a + (p.week || []).length, 0)}</b> matchs de la semaine dans nos poules (tous les adversaires), ajoutés à ceux déjà gardés</li>
      <li>🛡️ <b>${Object.keys(P.logos || {}).length}</b> logos de clubs (adversaires de toutes les poules)</li>
      <li>🏆 <b>${tables.length}</b> classement${tables.length > 1 ? 's' : ''} officiel${tables.length > 1 ? 's' : ''} : ${tables.map(x => esc(x.t.name + ' (' + x.p.comp + ')')).join(', ') || 'aucun'}</li></ul>
      <p class="muted small">Les classements viennent du site de la FFF : tous les adversaires de chaque poule, « sous réserve d'éventuelles procédures ».</p>`,
      actions: [{ label: 'Annuler' }, { label: 'Importer', kind: 'primary', onClick: () => {
        const res = Importer.applyFound(found); Clubs.setOppLogos(P.logos);
        const sh = (P.sheets || []).map(s => sheetPlan(s)).filter(Boolean); sh.forEach(applySheet);
        // (1.48) one table per poule: a team playing two poules keeps both
        tables.forEach(({ p, t, rows }) => { const T = { name: p.comp, url: 'https://epreuves.fff.fr' + p.url + '/classement', our: p.our, rows, at: Date.now() };
          t.fffTables = Object.assign({}, t.fffTables || (t.fffTable ? { [t.fffTable.url]: t.fffTable } : {}), { [T.url]: T }); t.fffTable = T; Store.upsert('teams', t); });
        pouleWeeks(P.poules);
        Store.save(); App.route();
        toast(`FFF : ${res.scores} score${res.scores > 1 ? 's' : ''} mis à jour, ${res.added} match${res.added > 1 ? 's' : ''} ajouté${res.added > 1 ? 's' : ''}, ${tables.length} classement${tables.length > 1 ? 's' : ''}`);
      } }] });
  }
  /* ---------- (1.48) the results of every match of our poules (all the opponents), week after week ----------
     t.fffPoules[competition] = { name, url, our, list: [{ date, time, home, away, hs, as }] }: kept and completed at each import
     (a match is found again by its date and its two teams; its score is updated, nothing is removed; one team can play two poules) */
  function pouleWeeks(poules) {
    let n = 0;
    (poules || []).forEach(p => {
      const t = p.week && p.week.length && Importer.guessTeam(p.comp, p.our || ''); if (!t) return;
      const all = t.fffPoules = t.fffPoules || {}, R = all[p.url] = all[p.url] || { name: p.comp, url: 'https://epreuves.fff.fr' + p.url, list: [] };
      if (p.our) R.our = p.our;
      p.week.forEach(w => {
        const date = dayOf(w.when), time = (/(\d{1,2})h(\d{2})/.exec(w.when) || []).slice(1).map(x => x.padStart(2, '0')).join(':'); if (!date) return;
        const [home, away] = w.teams, sc = w.sc.length === 2 ? w.sc.map(Number) : null; if (/EXEMPT/i.test(home + ' ' + away)) return;
        const ex = R.list.find(x => x.date === date && x.home === home && x.away === away);
        if (ex) { if (sc && (ex.hs !== sc[0] || ex.as !== sc[1])) { ex.hs = sc[0]; ex.as = sc[1]; n++; } if (time) ex.time = time; }
        else { R.list.push({ date, time, home, away, hs: sc ? sc[0] : null, as: sc ? sc[1] : null }); n++; }
      });
      R.list.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)); R.at = Date.now();
      Store.upsert('teams', t);
    });
    return n;
  }
  /* ---------- (1.42) the match sheets of the FFF site: cards, substitutions, line-ups, playing time ---------- */
  const MONTHS = { JAN: 1, FEV: 2, MAR: 3, AVR: 4, MAI: 5, JUN: 6, JUI: 7, AOU: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
  function dayOf(s) { const m = /(\d{2})\s+([A-ZÉÛ]+)\s+(\d{4})/.exec(String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()); if (!m) return ''; const mo = m[2] === 'JUIL' ? 7 : m[2].startsWith('JUIN') ? 6 : MONTHS[m[2].slice(0, 3)]; return mo ? `${m[3]}-${String(mo).padStart(2, '0')}-${m[1]}` : ''; }
  // the sheet → our match in the app, our side, and each name of our side → one of our players
  function sheetPlan(s) {
    const date = dayOf(s.date), parts = String(s.title || '').split(' | '), [home, away] = (parts[1] || '').split(' - ').map(x => x.trim());
    if (!date || !home || !away) return null;
    const word = norm(S().club.fffName || S().club.short || S().club.name).split(' ')[0].toUpperCase();
    const ourHome = norm(home).toUpperCase().includes(word), ourName = ourHome ? home : away, oppName = ourHome ? away : home;
    const t = Importer.guessTeam(parts[2] || '', ourName); if (!t) return null;
    const m = S().matches.find(x => x.teamId === t.id && x.date === date && (norm(x.opponent) === norm(oppName) || ACImport.sameOpp(x.opponent, oppName)));
    if (!m) return null;
    const side = ourHome ? 'home' : 'away', team = (s.teams || []).find(x => norm(x.name) === norm(ourName)) || (s.teams || [])[ourHome ? 0 : 1] || { starters: [], subs: [] };
    const roster = Store.rosterOf(t.id), pool = roster.length ? roster : S().players, unknown = [];
    const who = name => { const w = String(name || '').trim().split(/\s+/), ini = (w.length > 1 ? w[w.length - 1] : '').replace('.', ''), first = norm(w.slice(0, -1).join(' ') || w[0]);
      let c = pool.filter(p => norm(p.firstName) === first && (!ini || norm(p.lastName).toUpperCase().startsWith(ini.toUpperCase())));
      if (c.length !== 1) c = pool.filter(p => norm(p.firstName) === first);
      if (c.length === 1) return c[0]; if (name && !/anonyme/i.test(name)) unknown.push(name); return null; };
    const starters = team.starters.map(x => who(x.name)), subs = team.subs.map(x => who(x.name));
    const ours = (s.moments || []).filter(x => x.side === side);
    return { s, m, t, side, starters, subs, ours, who, unknown, cards: ours.filter(x => /^(Avertissement|Exclusion)/.test(x.type)).length, nsubs: ours.filter(x => /^Changement/.test(x.type)).length, known: [...starters, ...subs].filter(Boolean).length };
  }
  function applySheet(x) {
    const { s, m, starters, subs, ours, who } = x, len = People.matchLength(m), start = {}, end = {};
    starters.forEach(p => { if (p) { start[p.id] = 0; end[p.id] = len; } });
    const stats = m.stats = m.stats || {}, cards = {};
    ours.forEach(e => {
      if (/^Changement/.test(e.type)) { const pin = who(e.names[0]), pout = who(e.names[1]); if (pout && start[pout.id] != null) end[pout.id] = Math.min(end[pout.id], e.min); if (pin) { start[pin.id] = e.min; end[pin.id] = len; } }
      if (/^Avertissement/.test(e.type)) { const p = who(e.names[0]); if (p) (cards[p.id] = cards[p.id] || { yc: 0, rc: 0 }).yc++; }
      if (/^Exclusion/.test(e.type)) { const p = who(e.names[0]); if (p) { (cards[p.id] = cards[p.id] || { yc: 0, rc: 0 }).rc++; if (start[p.id] != null) end[p.id] = Math.min(end[p.id], e.min); } }
    });
    // (1.47) the sheet completes the match, it does not replace it (a second import changes nothing):
    // cards: the most found by the sheet or the live match; minutes: those of the live match when it was followed live, the sheet's otherwise
    Object.entries(cards).forEach(([pid, c]) => { const o = stats[pid] || {}; stats[pid] = Object.assign({}, o, { yc: Math.max(+o.yc || 0, c.yc), rc: Math.max(+o.rc || 0, c.rc) }); });
    // (a player the sheet takes off earlier than the live match — a change or a red card not noted live — gets the sheet's time)
    const mm = m.minutes = m.minutes || {}, followed = !!(m.live && m.live.status === 'end' && !m.live.imported), sheetMin = {};
    Object.keys(start).forEach(pid => { const v = sheetMin[pid] = Math.max(0, end[pid] - start[pid]); mm[pid] = followed && +mm[pid] > 0 ? Math.min(+mm[pid], v) : v; });
    m.convoked = [...new Set([...(m.convoked || []), ...[...starters, ...subs].filter(Boolean).map(p => p.id)])];
    m.played = true;
    m.fffSheet = { url: 'https://epreuves.fff.fr' + s.url, moments: s.moments, teams: s.teams, minutes: sheetMin, at: Date.now() };
    Store.upsert('matches', m);
  }
  // the sheet on the match page (tab « Après »)
  function sheetCard(m) {
    const F = m.fffSheet; if (!F) return '';
    const ic = t => /^Avertissement/.test(t) ? '🟨' : /^Exclusion/.test(t) ? '🟥' : /^Changement/.test(t) ? '🔁' : /^But/.test(t) ? '⚽' : '•';
    const line = e => `<li><b>${e.min}’</b> ${ic(e.type)} ${esc(e.type === 'Changement' ? `${e.names[0] || ''} remplace ${e.names[1] || ''}` : (e.names[0] || ''))} <span class="muted small">${e.side === 'home' ? '(domicile)' : '(extérieur)'}</span></li>`;
    return `<section class="card sheet-card"><h2>📋 Feuille de match (FFF)</h2>
      ${(F.moments || []).length ? `<ul class="sheet-ev">${F.moments.map(line).join('')}</ul>` : '<p class="muted small">Pas de faits de match saisis sur la feuille.</p>'}
      <div class="sheet-teams">${(F.teams || []).map(t => `<div><h3>${esc(t.name)}</h3><ol>${t.starters.map(p => `<li>${esc(p.name)}</li>`).join('')}</ol>${t.subs.length ? `<p class="muted small">Remplaçants : ${t.subs.map(p => esc(p.name)).join(', ')}</p>` : ''}</div>`).join('')}</div>
      <p class="muted small">Cartons et temps de jeu repris de la feuille. <a href="${esc(F.url)}" target="_blank" rel="noopener">Voir sur le site de la FFF</a></p></section>`;
  }
  return { card, receive, bookmarks, sheetCard, fff };
})();
