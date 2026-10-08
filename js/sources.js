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
const champDetail={};for(const c of (ch.championships||[])){try{champDetail[c.id]=await j('/api/championship/'+c.id);}catch(e){}}
const D={source:'assistcoachai',effectif:{players:(eff.players||[]).filter(p=>!p.team_id||p.team_id===T),teams:[t]},planning,seances,medical,wellness,rpe,champDetail};
let n=0;const send=()=>{try{w.postMessage({type:'club-import',source:'assistcoachai',payload:D},new URL(A).origin);}catch(e){}};
addEventListener('message',e=>{if(e.source===w&&e.data==='club-import-ready'&&!n++)send();});}catch(e){alert('Lecture impossible : '+e.message);}})()`;
    // Footclubs shows the list 30 by 30 (« De 1 à 30 sur 361 »): the bookmark reads every page (« page suivante », reading only)
    // (1.83) every frame, at any depth; the counter with any space (Footclubs puts non-breaking spaces); one page only if there is no counter;
    // an error is shown (it was silent)
    const fc = `(async()=>{const A=${A};const RG=/De\\s+(\\d+)\\s+à\\s+(\\d+)\\s+sur\\s+(\\d+)/i,DT=/^\\d{2}\\/\\d{2}\\/\\d{4}$/;
if(!/footclubs\\.fff\\.fr$/.test(location.host)){alert('Ouvre Footclubs (connecté), puis touche ce favori.');return;}
const T=window.top;const all=()=>{const out=[];const go=(x,d)=>{out.push(x);if(d>4)return;let fs=[];try{fs=x.document.querySelectorAll('frame,iframe');}catch(e){return;}for(const f of fs){try{if(f.contentWindow&&f.contentWindow.document)go(f.contentWindow,d+1);}catch(e){}}};go(T,0);return out;};
const txt=x=>{try{return x.document.body?x.document.body.innerText:'';}catch(e){return '';}};
const dates=x=>{try{return [...x.document.querySelectorAll('td')].filter(td=>DT.test(td.innerText.trim())).length;}catch(e){return 0;}};
const find=()=>{const ws=all();return ws.find(x=>RG.test(txt(x))&&dates(x)>0)||ws.find(x=>dates(x)>=3)||null;};
let W=find();
if(!W){try{const M=T.frames['menu'],a=[...M.document.querySelectorAll('a')].find(x=>/'LILIST'/.test(x.getAttribute('onclick')||''));M.gestOpen(a,'2',1,'LILIST');}catch(e){}for(let k=0;k<80&&!W;k++){await new Promise(r=>setTimeout(r,250));W=find();}}
if(!W){const ws=all();alert('Liste des licences introuvable ('+ws.length+' cadre'+(ws.length>1?'s':'')+' lus). Ouvre Licences → liste des licences (le tableau avec les dates de naissance), puis touche à nouveau ce favori.');return;}
const box=(html,btn)=>{try{const d=W.document;let b=d.getElementById('clubImp');if(!b){b=d.createElement('div');b.id='clubImp';b.style.cssText='position:fixed;top:8px;right:8px;z-index:99999;padding:14px 18px;background:#0e1d45;color:#fff;font:bold 15px sans-serif;border-radius:12px;box-shadow:0 6px 20px rgba(0,0,0,.35);max-width:340px';d.body.appendChild(b);}b.innerHTML=html;return b;}catch(e){return null;}};
try{box('📥 Lecture des licences pour l\\'appli… ne touche à rien');
const range=()=>{const m=RG.exec(txt(W));return m?[+m[1],+m[2],+m[3]]:null;};
const wait=async s=>{for(let k=0;k<80;k++){await new Promise(r=>setTimeout(r,250));try{const r=range();if(r&&r[0]===s)return true;}catch(e){}}return false;};
const rows=[],seen={};const grab=()=>{for(const tr of W.document.querySelectorAll('tr')){const c=[...tr.cells].map(x=>x.innerText.trim());const i=c.findIndex(x=>DT.test(x));
if(i>0&&/[A-Z]/.test(c[i-1])&&c[i+1]){const k=c[i-1]+c[i]+c[i+1];if(!seen[k]){seen[k]=1;rows.push({name:c[i-1],birth:c[i],cat:c[i+1]||'',date:c[i+2]||'',etat:c[i+3]||'',lic:(tr.innerHTML.match(/selectPersonne\\('(\\d+)'/)||[])[1]||''});}}}};
const paged=typeof W.otherlist==='function';let r=range();if(paged&&r&&r[0]!==1){W.otherlist(W.firstlist,W.name,'F');await wait(1);}
for(let p=0;p<80;p++){grab();r=range();if(r)box('📥 Lecture des licences… '+r[1]+' / '+r[2]+'<br><small>ne touche à rien</small>');if(!paged||!r||r[1]>=r[2])break;const nx=r[1]+1;W.otherlist(W.nextlist,W.name,'N');if(!await wait(nx))break;}
if(!rows.length){alert('Aucune licence lue dans ce tableau. Envoie une capture de la liste au créateur de l\\'appli.');return;}
const url=A+'#/recevoir-source/fc='+encodeURIComponent(JSON.stringify({rows,total:(range()||[0,0,rows.length])[2]}));
const b=box('✅ '+rows.length+' licences lues<br><button id="clubImpGo" style="margin-top:10px;padding:12px 16px;font:bold 16px sans-serif;border:0;border-radius:10px;background:#c9a45c;color:#14172b;cursor:pointer">Envoyer à l\\'appli →</button>');
const go=b&&b.querySelector('#clubImpGo');if(go)go.onclick=()=>{const w=W.open(url,'_blank');if(!w)location.href=url;box('✅ Envoyé : regarde l\\'appli (onglet ou fenêtre de l\\'appli).');};else if(confirm(rows.length+' licences lues. Ouvrir l\\'appli pour les importer ?'))W.open(url,'_blank');
}catch(e){alert('Footclubs : lecture impossible ('+e.message+')');}})()`;
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
    const c = S().club, at = +c.fffAutoAt ? new Date(+c.fffAutoAt).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
    return `${Sport.isFoot() ? `<section class="card src-card"><h2>🏆 Résultats FFF automatiques</h2>
      <p class="muted small">L'appli va chercher toute seule, sur le site officiel de la FFF, les scores de toutes tes équipes, le calendrier, les classements officiels et les résultats de tous les adversaires de chaque poule (à chaque ouverture, au plus toutes les 3 heures). Rien à faire.</p>
      ${affOf(c) ? `<p class="small">Club n° <b>${esc(affOf(c))}</b>${at ? ` · dernière mise à jour : <b>${esc(at)}</b>` : ''}</p><button class="btn primary" data-fff="now">🔄<span>Mettre à jour maintenant</span></button>`
        : `<label class="fld"><span>Page de ton club sur epreuves.fff.fr (une seule fois)</span><input id="fffUrlIn" placeholder="https://epreuves.fff.fr/competition/club/552176"></label><button class="btn primary" data-fff="set">Enregistrer</button>`}</section>` : ''}
      <section class="card src-card"><h2>📥 Mise à jour depuis AssistCoachAI et Footclubs</h2>
      <p class="muted small">Un geste, sans mot de passe enregistré : les joueurs à jour (licences, catégories, dates de naissance) et, depuis AssistCoachAI, le planning, les présences, les blessures et le bien-être. L'appli te montre ce qui change avant d'enregistrer, sans doublon.</p>
      <ol class="steps-help"><li><b>Une seule fois, sur l'ordinateur :</b> fais glisser ces deux boutons dans la barre des favoris de ton navigateur.
        <div class="chips src-bm"><a class="btn" href="${esc(b.ac)}" onclick="${DRAG}">📥 AssistCoachAI → ${esc(AppCfg.name)}</a><a class="btn" href="${esc(b.fc)}" onclick="${DRAG}">📥 Footclubs → ${esc(AppCfg.name)}</a></div></li>
        <li><b>AssistCoachAI :</b> connecte-toi, puis touche le favori « AssistCoachAI ».</li>
        <li><b>Footclubs :</b> connecte-toi, puis touche le favori « Footclubs » (depuis n'importe quelle page : il ouvre la liste des licences tout seul).</li>
        <li>L'appli s'ouvre et te montre les changements : touche <b>Importer</b>.</li></ol>
      <p class="muted small">À refaire quand tu veux (une fois par semaine, ou après une vague de licences). Rien n'est envoyé ailleurs que dans l'appli du club.</p>
      ${Sport.isFoot() ? `<details class="src-more"><summary>Facultatif : cartons et remplacements des feuilles de match FFF</summary>
        <p class="muted small">Les résultats arrivent déjà tout seuls. Ce favori ne sert qu'aux feuilles de match : fais-le glisser dans la barre des favoris, ouvre la page de ton club sur <a href="${esc(S().club.fffUrl || 'https://epreuves.fff.fr/')}" target="_blank" rel="noopener">epreuves.fff.fr</a>, puis touche-le <b>sur ce site-là</b>.</p>
        <div class="chips src-bm"><a class="btn" href="${esc(b.ff)}" onclick="${DRAG}">📋 Feuilles de match FFF → ${esc(AppCfg.name)}</a></div></details>` : ''}</section>`;
  }
  // (1.53) a bookmark button touched in the app instead of dragged: a message that stays (a toast was gone too fast)
  const DRAG = "event.preventDefault();alert('Ce bouton ne se touche pas ici : fais-le GLISSER (clic maintenu) jusqu\\'à la barre des favoris de ton navigateur. Ensuite, utilise ce favori sur le site concerné (AssistCoachAI, Footclubs ou la FFF), pas dans l\\'appli.')";

  /* ---------- the app opened by a bookmark ---------- */
  // (1.85) Footclubs: the data come in the address (#/recevoir-source/fc=…), so it works even when the app is installed
  // (Chrome then opens it in the app's own window, without « opener »); the address is cleaned at once
  function fromLink(raw) {
    if (!raw) { const m = location.hash.match(/^#\/recevoir-source\/fc=(.+)$/); if (!m) return false; raw = m[1]; history.replaceState(null, '', location.pathname + location.search + '#/'); }
    let P; try { P = JSON.parse(decodeURIComponent(raw)); } catch (e) { toast('Données Footclubs illisibles : refais la lecture.', 'err'); return true; }
    if (!Auth.isAdmin()) { toast('Réservé à un responsable du club.', 'err'); return true; }
    try { footclubs(P); } catch (err) { console.error(err); toast(err.message || 'Données illisibles', 'err'); }
    return true;
  }
  addEventListener('hashchange', () => { if (/^#\/recevoir-source\/fc=/.test(location.hash) && Auth.current()) fromLink(); });
  function receive(fc) {
    if (fc) { fromLink(fc); return; }
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
          t.fffTables = Object.assign({}, t.fffTables || (t.fffTable ? { [pkey(t.fffTable.url)]: t.fffTable } : {}), { [pkey(p.url)]: T }); t.fffTable = T; Store.upsert('teams', t); });
        pouleWeeks(P.poules);
        Store.save(); App.route();
        toast(`FFF : ${res.scores} score${res.scores > 1 ? 's' : ''} mis à jour, ${res.added} match${res.added > 1 ? 's' : ''} ajouté${res.added > 1 ? 's' : ''}, ${tables.length} classement${tables.length > 1 ? 's' : ''}${res.merged ? `, ${res.merged} doublon${res.merged > 1 ? 's' : ''} fusionné${res.merged > 1 ? 's' : ''}` : ''}`);
      } }] });
  }
  // one key per poule, whatever brought it (the FFF's API or the bookmark): « 457623/1/1 » (competition / phase / group)
  const pkey = u => { const m = /engagement\/(\d+)[^/]*\/phase\/(\d+)\/(\d+)/.exec(u || ''); return m ? `${m[1]}/${m[2]}/${m[3]}` : (u || ''); };

  /* ---------- (1.51) the FFF's public API (api-dofa.fff.fr, open to web apps): the app updates itself, no bookmark ----------
     From the club's number (its page on epreuves.fff.fr): its teams and their poules, then for each poule every match of the
     season (all the opponents) and the official table. Our matches: scores and calendar (Importer.applyFound, no duplicate).
     Everything completes what is already there (AssistCoachAI, the live match, the bookmark): nothing is removed.
     Automatic: when an admin opens the app, at most every 3 hours (and right away from Réglages). */
  const API = 'https://api-dofa.fff.fr';
  const getJ = async u => { const r = await fetch(API + u, { headers: { accept: 'application/ld+json' } }); if (!r.ok) throw new Error('FFF ' + r.status); return r.json(); };
  const members = j => Array.isArray(j) ? j : (j['hydra:member'] || []);
  async function pages(u) { let out = []; for (let p = 1; p <= 20; p++) { const j = await getJ(u + (u.includes('?') ? '&' : '?') + 'page=' + p), m = members(j); out = out.concat(m); const tot = j['hydra:totalItems']; if (!m.length || (tot != null ? out.length >= tot : m.length < 30)) break; } return out; }
  const affOf = c => String(c.fffClub || (/club\/(\d+)/.exec(c.fffUrl || '') || [])[1] || '');
  const teamName = e => e ? (e.short_name || '') + (+e.code > 1 ? ' ' + e.code : '') : '';
  const logoNo = e => (/BC(\d+)\.jpg/.exec(((e || {}).club || {}).logo || '') || [])[1];
  let running = null;
  // the buttons of the card (Réglages → Le club)
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-fff]'); if (!b) return;
    if (b.dataset.fff === 'now') { const bz = UI.busy('Mise à jour depuis la FFF…'); autoFFF({ force: true, verbose: true }).finally(() => { bz.done(); App.route(); }); }
    if (b.dataset.fff === 'set') { const v = ((document.getElementById('fffUrlIn') || {}).value || '').trim(), n = (/club\/(\d+)/.exec(v) || /^(\d{4,})$/.exec(v) || [])[1];
      if (!n) return toast('Colle l\'adresse de la page du club (…/competition/club/<numéro>)', 'err');
      S().club.fffUrl = 'https://epreuves.fff.fr/competition/club/' + n; S().club.fffClub = n; delete S().club.fffClNo; Store.save();
      const bz = UI.busy('Mise à jour depuis la FFF…'); autoFFF({ force: true, verbose: true }).finally(() => { bz.done(); App.route(); }); }
  });
  function autoFFF(o = {}) {
    const c = S().club, aff = affOf(c);
    if (!aff || !Sport.isFoot() || c.demo || (!Auth.isAdmin() && !o.force)) {
      if (o.verbose) modal({ title: '⚠️ Mise à jour FFF', body: `<p>${!aff ? 'Le numéro FFF du club n\'est pas renseigné : Réglages → Le club → « Résultats FFF automatiques », colle l\'adresse de la page du club sur epreuves.fff.fr.' : 'Disponible pour le football seulement.'}</p>`, actions: [{ label: 'OK', kind: 'primary' }] });
      return Promise.resolve(null);
    }
    if (!o.force && Date.now() - (+c.fffAutoAt || 0) < 3 * 3600e3) return Promise.resolve(null);
    return running = running || (async () => {
      const res = { scores: 0, added: 0, tables: 0, results: 0, poules: 0 };
      try {
        let cl = c.fffClNo;
        // (1.55) the number kept can be the affiliation number (552176, the club's page) or the FFF's own one (162203): both work
        if (!cl) {
          const nums = [...new Set([aff, (/club\/(\d+)/.exec(c.fffUrl || '') || [])[1]].filter(Boolean).map(String))];
          for (const n of nums) {
            try { const x = members(await getJ('/api/clubs?cl_cod=' + encodeURIComponent(n))).find(y => String(y.affiliation_number) === n); if (x) { cl = x.cl_no; c.fffClub = n; break; } } catch (e) {}
            try { const x = await getJ('/api/clubs/' + encodeURIComponent(n)); if (x && x.cl_no) { cl = x.cl_no; if (x.affiliation_number) c.fffClub = String(x.affiliation_number); break; } } catch (e) {}
          }
          if (!cl) throw new Error('Club introuvable à la FFF (n° ' + nums.join(' ou ') + ')');
          c.fffClNo = cl;
        }
        const teams = members(await getJ(`/api/clubs/${cl}/equipes`)), logos = {}, found = [];
        // (1.58) every poule read 4 at a time (≈ 4 times faster than one after the other), then filed one by one
        const fetched = {}, queue = [];
        for (const eq of teams) for (const en of eq.engagements || []) {
          const cp = (en.competition || {}).cp_no, ph = (en.phase || {}).number, gp = (en.poule || {}).stage_number, k = `${cp}/${ph}/${gp}`;
          if (cp && ph && gp && !fetched[k]) { const b = `/api/compets/${cp}/phases/${ph}/poules/${gp}`; fetched[k] = null; queue.push([k, () => Promise.all([pages(b + '/matchs'), pages(b + '/classement_journees').catch(() => null)])]); }
          // (1.70) every page of the tables: one line per team AND per matchday (12 teams × 10 matchdays = 120 lines, 30 a page);
          // with the first page only, the table shown was the one of the 2nd or 3rd matchday
        }
        await Promise.all([0, 1, 2, 3].map(async () => { while (queue.length) { const [k, f] = queue.shift(); try { fetched[k] = await f(); } catch (e) { fetched[k] = null; } } }));
        for (const eq of teams) for (const en of eq.engagements || []) {
          const cp = (en.competition || {}).cp_no, ph = (en.phase || {}).number, gp = (en.poule || {}).stage_number; if (!cp || !ph || !gp) continue;
          const our = teamName(eq), comp = `${en.competition.name} - ${eq.category_label || ''}`, t = Importer.guessTeam(comp, our);
          if (!t) { res.skipped = (res.skipped || 0) + 1; (res.skippedNames = res.skippedNames || []).push(`${en.competition.name} (${our})`); continue; }
          const base = `/api/compets/${cp}/phases/${ph}/poules/${gp}`, key = `${cp}/${ph}/${gp}`, url = `https://epreuves.fff.fr/competition/engagement/${cp}/phase/${ph}/${gp}`;
          const got = fetched[key]; if (!got) continue; const [ms, cjJ] = got;
          res.poules++;
          // every match of the poule (kept and completed), our matches for the calendar and the scores
          const all = t.fffPoules = t.fffPoules || {}, R = all[key] = all[key] || { name: en.competition.name, url, list: [] }; R.our = our; R.url = R.url || url;
          ms.forEach(m => {
            const h = teamName(m.home), a = teamName(m.away), date = String(m.date || '').slice(0, 10), time = String(m.time || '').replace(/H/i, ':');
            [m.home, m.away].forEach(e => { const n = logoNo(e); if (n && e) logos[teamName(e)] = n; });
            const hs = m.home_score == null ? null : +m.home_score, as = m.away_score == null ? null : +m.away_score;
            if (h && a && date) {
              const ex = R.list.find(x => x.date === date && x.home === h && x.away === a);
              if (ex) { if (hs != null && (ex.hs !== hs || ex.as !== as)) { ex.hs = hs; ex.as = as; res.results++; } if (time) ex.time = time; }
              else { R.list.push({ date, time, home: h, away: a, hs, as }); res.results++; }
            }
            const usH = (m.home || {}).club && +m.home.club.cl_no === +cl && teamName(m.home) === our, usA = (m.away || {}).club && +m.away.club.cl_no === +cl && teamName(m.away) === our;
            if (!usH && !usA || !date) return;
            const played = hs != null && as != null, opp = usH ? a : h;
            found.push({ date, time, competition: comp, home: usH, opponent: opp || 'Exempt', ourName: our, exempt: !opp, played, gf: played ? (usH ? hs : as) : 0, ga: played ? (usH ? as : hs) : 0, venue: ((m.terrain || {}).name || '') + ((m.terrain || {}).city ? ', ' + m.terrain.city : '') });
          });
          R.list.sort((x, y) => x.date.localeCompare(y.date) || String(x.time).localeCompare(String(y.time))); R.at = Date.now();
          // the official table (the last matchday of each team)
          try {
            const cj = cjJ ? members(cjJ) : [], last = {};
            cj.forEach(r => { const n = teamName(r.equipe); if (n && (!last[n] || (+r.cj_no || 0) >= (+last[n].cj_no || 0))) last[n] = r; });
            const rows = Object.values(last).sort((x, y) => (+x.rank || 99) - (+y.rank || 99)).map(r => ({ rank: +r.rank || 0, name: teamName(r.equipe), pts: +r.point_count || 0, j: +r.total_games_count || 0, v: +r.won_games_count || 0, n: +r.draw_games_count || 0, d: +r.lost_games_count || 0, f: +r.forfeits_games_count || 0, bp: +r.goals_for_count || 0, bc: +r.goals_against_count || 0, diff: +r.goals_diff || 0 }));
            // (1.71) goals for / against and difference counted from the scores of the poule (every match is read just above):
            // the difference sent by the FFF's table was wrong (all positive, e.g. +5 for a team with 3 defeats)
            const GF = {}; R.list.forEach(x => { if (x.hs == null || x.as == null || /exempt/i.test(x.home + x.away)) return;
              [[x.home, x.hs, x.as], [x.away, x.as, x.hs]].forEach(([n, f, a]) => { const g = GF[n] = GF[n] || { f: 0, a: 0 }; g.f += f; g.a += a; }); });
            rows.forEach(r => { const g = GF[r.name]; if (g) { r.bp = g.f; r.bc = g.a; r.diff = g.f - g.a; } });
            // no table published yet by the District: computed from the results of the poule (3 / 1 / 0), and said so
            let computed = false;
            // (1.57) a cup (knock-out: « DISTRICT CUP », « COUPE 93 ») has no table and never counts in the championship
            const isCup = en.competition.type !== 'CH' || /coupe|\bcup\b/i.test(en.competition.name); R.cup = isCup;
            if (isCup) { rows.length = 0; if (t.fffTables) delete t.fffTables[key]; }
            if (!rows.length && !isCup && R.list.some(x => x.hs != null)) {
              const T = {}; const row = n => T[n] = T[n] || { name: n, pts: 0, j: 0, v: 0, n: 0, d: 0, f: 0, bp: 0, bc: 0, diff: 0 };
              R.list.forEach(x => { if (/exempt/i.test(x.home + x.away)) return; row(x.home); row(x.away); if (x.hs == null) return; const H = T[x.home], A = T[x.away];
                H.j++; A.j++; H.bp += x.hs; H.bc += x.as; A.bp += x.as; A.bc += x.hs; if (x.hs > x.as) { H.v++; A.d++; H.pts += 3; } else if (x.hs < x.as) { A.v++; H.d++; A.pts += 3; } else { H.n++; A.n++; H.pts++; A.pts++; } });
              Object.values(T).forEach(x => { x.diff = x.bp - x.bc; });
              Object.values(T).sort((a, b) => b.pts - a.pts || b.diff - a.diff || b.bp - a.bp || a.name.localeCompare(b.name)).forEach((x, i) => { x.rank = i + 1; rows.push(x); });
              computed = true;
            }
            if (rows.length && !isCup) { const T = { name: en.competition.name, url: url + '/classement', our, rows, at: Date.now(), computed }; t.fffTables = Object.assign({}, t.fffTables || {}, { [key]: T }); t.fffTable = T; res.tables++; }
          } catch (e) {}
          Store.upsert('teams', t);
        }
        const r = Importer.applyFound(found.filter(f => !f.exempt || f.date >= UI.today())); res.scores = r.scores; res.added = r.added; res.merged = r.merged || 0;
        Clubs.setOppLogos(logos);
        c.fffAutoAt = Date.now(); c.fffClub = aff; Store.save();
        if (o.verbose) modal({ title: '🏆 Mise à jour FFF', body: `<ul class="src-sum"><li>Club n° <b>${esc(aff)}</b> trouvé à la FFF</li><li>📅 <b>${res.poules}</b> poule${res.poules > 1 ? 's' : ''} lue${res.poules > 1 ? 's' : ''} (${res.results} résultat${res.results > 1 ? 's' : ''} nouveaux ou changés, adversaires compris)</li><li>🏆 <b>${res.tables}</b> classement${res.tables > 1 ? 's' : ''}</li><li>⚽ <b>${res.scores}</b> score${res.scores > 1 ? 's' : ''} de nos matchs, <b>${res.added}</b> match${res.added > 1 ? 's' : ''} ajouté${res.added > 1 ? 's' : ''} au calendrier</li>${res.skipped ? `<li class="muted">${res.skipped} engagement${res.skipped > 1 ? 's' : ''} sans équipe correspondante dans l'appli : ${esc(res.skippedNames.slice(0, 8).join(', '))}</li>` : ''}</ul>`, actions: [{ label: 'OK', kind: 'primary' }] });
        else if (res.scores || res.added || res.merged) toast(`FFF à jour : ${res.scores} score${res.scores > 1 ? 's' : ''}, ${res.added} match${res.added > 1 ? 's' : ''} ajouté${res.added > 1 ? 's' : ''}, ${res.tables} classement${res.tables > 1 ? 's' : ''}${res.merged ? `, ${res.merged} doublon${res.merged > 1 ? 's' : ''} fusionné${res.merged > 1 ? 's' : ''}` : ''}`);
        if (res.scores || res.added || res.results || res.tables || res.merged) App.route();
        return res;
      } catch (e) { c.fffAutoErr = String(e && e.message || e); if (o.verbose) modal({ title: '⚠️ Mise à jour FFF impossible', body: `<p>${esc(c.fffAutoErr)}</p><p class="muted small">Vérifie la connexion internet, puis réessaie. Si ça continue, envoie une capture de ce message.</p>`, actions: [{ label: 'OK', kind: 'primary' }] }); return null; }
      finally { running = null; }
    })();
  }

  /* ---------- (1.48) the results of every match of our poules (all the opponents), week after week ----------
     t.fffPoules[competition] = { name, url, our, list: [{ date, time, home, away, hs, as }] }: kept and completed at each import
     (a match is found again by its date and its two teams; its score is updated, nothing is removed; one team can play two poules) */
  function pouleWeeks(poules) {
    let n = 0;
    (poules || []).forEach(p => {
      const t = p.week && p.week.length && Importer.guessTeam(p.comp, p.our || ''); if (!t) return;
      const all = t.fffPoules = t.fffPoules || {}, k = pkey(p.url), R = all[k] = all[k] || { name: p.comp, url: 'https://epreuves.fff.fr' + p.url, list: [] };
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
  return { card, receive, bookmarks, sheetCard, fff, autoFFF };
})();
