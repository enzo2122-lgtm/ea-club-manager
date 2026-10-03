/* Sources: the club's data brought up to date in one gesture from AssistCoachAI and Footclubs (FFF), without any password kept.
   Neither site lets another app read it: the gesture starts ON the site, where the responsable is logged in. A bookmark
   (« favori ») reads the data with his own connection, opens the app on #/recevoir-source and hands the data over
   (postMessage, accepted only from these two sites). The app shows what changes, then imports without duplicates.
   Footclubs: new licenciés are added in their category; the players already there are completed (birth date, licence state)
   but never moved (a player put in another category by hand stays there). AssistCoachAI: the same import as its file. */
const Sources = (() => {
  const { esc, toast, modal } = UI;
  const S = () => Store.state;
  const ALLOWED = ['https://assistcoachai.com', 'https://footclubs.fff.fr'];
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
if(i>0&&/[A-Z]/.test(c[i-1])&&c[i+1]){const k=c[i-1]+c[i]+c[i+1];if(!seen[k]){seen[k]=1;rows.push({name:c[i-1],birth:c[i],cat:c[i+1]||'',date:c[i+2]||'',etat:c[i+3]||''});}}}};
let r=range();if(r&&r[0]!==1){W.otherlist(W.firstlist,W.name,'F');await wait(1);}
for(let p=0;p<80;p++){grab();r=range();if(!r||r[1]>=r[2])break;const nx=r[1]+1;W.otherlist(W.nextlist,W.name,'N');if(!await wait(nx))break;}
data={rows,total:(range()||[0,0,rows.length])[2]};send();})()`;
    const link = code => 'javascript:' + encodeURIComponent(code.replace(/\n/g, ''));
    return { ac: link(ac), fc: link(fc) };
  }
  function card() {
    if (!Auth.isAdmin()) return '';
    const b = bookmarks();
    return `<section class="card src-card"><h2>📥 Mise à jour depuis AssistCoachAI et Footclubs</h2>
      <p class="muted small">Un geste, sans mot de passe enregistré : les joueurs à jour (licences, catégories, dates de naissance) et, depuis AssistCoachAI, le planning, les présences, les blessures et le bien-être. L'appli te montre ce qui change avant d'enregistrer, sans doublon.</p>
      <ol class="steps-help"><li><b>Une seule fois, sur l'ordinateur :</b> fais glisser ces deux boutons dans la barre des favoris de ton navigateur.
        <div class="chips src-bm"><a class="btn" href="${esc(b.ac)}" onclick="event.preventDefault();UI.toast('Fais-le glisser dans la barre des favoris')">📥 AssistCoachAI → ${esc(AppCfg.name)}</a><a class="btn" href="${esc(b.fc)}" onclick="event.preventDefault();UI.toast('Fais-le glisser dans la barre des favoris')">📥 Footclubs → ${esc(AppCfg.name)}</a></div></li>
        <li><b>AssistCoachAI :</b> connecte-toi, puis touche le favori « AssistCoachAI ».</li>
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
      try { e.data.source === 'footclubs' ? footclubs(e.data.payload) : assist(e.data.payload); } catch (err) { console.error(err); toast(err.message || 'Données illisibles', 'err'); }
    });
  }

  /* ---------- Footclubs: the licenciés ---------- */
  const PLAYER_CAT = /^(Libre|Foot Loisir|Futsal|Foot Entreprise)\b/i;
  const LIC = e => /valid|renouvel/i.test(e) && !/non valid/i.test(e) ? 'ok' : /non valid|incompl|non factur/i.test(e) ? 'attente' : '';
  function footclubs(P) {
    const rows = (P.rows || []).filter(r => PLAYER_CAT.test(r.cat) && !/supprim/i.test(r.etat))
      .map(r => Object.assign(People.parseLines(`${r.name}\t${r.birth}\t${r.cat}`)[0] || {}, { etat: r.etat, depart: /d[ée]part/i.test(r.etat) })).filter(x => x.lastName);
    const ours = S().players;
    const find = x => ours.find(p => (p.lastName || '').toUpperCase() === x.lastName && norm(p.firstName) === norm(x.firstName) && (!p.birth || p.birth === x.birth))
      || ours.find(p => norm(`${p.firstName} ${p.lastName}`) === norm(`${x.firstName} ${x.lastName}`) && p.birth === x.birth);
    const plan = rows.map(x => ({ x, p: find(x) }));
    const fresh = plan.filter(r => !r.p && !r.x.depart), known = plan.filter(r => r.p), gone = known.filter(r => r.x.depart);
    const upd = known.filter(r => (!r.p.birth && r.x.birth) || (LIC(r.x.etat) && ((r.p.adm || {}).lic || '') !== LIC(r.x.etat)));
    const names = list => list.slice(0, 40).map(r => esc(`${r.x.firstName} ${r.x.lastName}`)).join(', ') + (list.length > 40 ? ` et ${list.length - 40} autres` : '');
    const all = (P.rows || []).length, miss = P.total && all < P.total;
    modal({ title: '📥 Footclubs : ce qui change', noFocus: true, body: `<p class="lead">${all} licence${all > 1 ? 's' : ''} lue${all > 1 ? 's' : ''} dans Footclubs${P.total ? ` sur ${P.total}` : ''}, dont ${rows.length} joueur${rows.length > 1 ? 's' : ''} (les dirigeants, éducateurs et arbitres sont laissés de côté).</p>
      ${miss ? '<p class="tip">⚠️ Toutes les pages de la liste n\'ont pas pu être lues : vérifie ta connexion à Footclubs et touche à nouveau le favori. Tu peux quand même importer ce qui a été lu.</p>' : ''}
      <ul class="src-sum"><li>🆕 <b>${fresh.length}</b> nouveau${fresh.length > 1 ? 'x' : ''} joueur${fresh.length > 1 ? 's' : ''}, rangé${fresh.length > 1 ? 's' : ''} dans ${fresh.length > 1 ? 'leur' : 'sa'} catégorie${fresh.length ? ` : <span class="muted small">${names(fresh)}</span>` : ''}</li>
      <li>✏️ <b>${upd.length}</b> joueur${upd.length > 1 ? 's' : ''} complété${upd.length > 1 ? 's' : ''} (date de naissance, état de la licence)</li>
      <li>✅ <b>${known.length - upd.length}</b> déjà à jour, sans doublon</li>
      ${gone.length ? `<li>👋 <b>${gone.length}</b> marqué${gone.length > 1 ? 's' : ''} « Départ » dans Footclubs (gardé${gone.length > 1 ? 's' : ''} dans l'appli, à retirer à la main si besoin) : <span class="muted small">${names(gone)}</span></li>` : ''}</ul>
      <p class="muted small">Les joueurs déjà dans l'appli ne changent pas de catégorie (un joueur surclassé reste où tu l'as mis).</p>`,
      actions: [{ label: 'Annuler' }, { label: 'Importer', kind: 'primary', onClick: () => {
        fresh.forEach(({ x }) => { const cat = People.catOf(x), t = cat ? People.ageTeam(cat) : null;
          Store.upsert('players', { id: Store.uid(), firstName: x.firstName, lastName: x.lastName, birth: x.birth, subcat: x.subcat, number: '', pos: '', phone: '', email: '', parents: [], notes: '', teamIds: t ? [t.id] : [], adm: LIC(x.etat) ? { lic: LIC(x.etat) } : {} }); });
        upd.forEach(({ x, p }) => { if (!p.birth && x.birth) p.birth = x.birth; if (LIC(x.etat)) p.adm = Object.assign({}, p.adm, { lic: LIC(x.etat) }); if (x.subcat && !p.subcat) p.subcat = x.subcat; Store.upsert('players', p); });
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
  return { card, receive, bookmarks };
})();
