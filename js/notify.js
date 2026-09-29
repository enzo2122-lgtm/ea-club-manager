/* Notify: notifications on the dirigeants' phones (new messages, @mentions, reports, planning changes of their categories).
   The club server prepares them; a Supabase Edge Function (supabase/raincy-push.ts) wakes the phone; the service worker
   (sw.js) reads and shows them. On iPhone, the app must be added to the home screen (Apple's rule). */
const Notify = (() => {
  const { esc, $, toast, modal } = UI;
  const S = () => Store.state;
  const ios = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => matchMedia('(display-mode: standalone)').matches || !!navigator.standalone;
  const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const prefs = () => Object.assign({ messages: true, planning: true }, S().ui.notifPrefs || {});
  const b64 = s => { const r = atob((s + '='.repeat((4 - s.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, c => c.charCodeAt(0)); };
  const fnUrl = () => { const c = Cloud.cfg(); return c ? c.url.replace(/\/+$/, '') + '/functions/v1/raincy-push' : ''; };
  const why = e => e && e.code === 'MISE_A_JOUR' ? 'Le serveur EA Club Manager est en cours de mise à jour : réessaie dans quelques minutes. ().' : (e && e.message) || 'Erreur';
  // the app's service worker (it shows the notifications); null if it does not answer within 4 s
  const ready = () => Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(() => r(null), 4000))]);
  async function current() { if (!supported()) return null; try { const reg = await ready(); return reg ? await reg.pushManager.getSubscription() : null; } catch (e) { return null; } }

  async function subscribe(ask) {
    if (!supported()) throw new Error(ios() && !standalone() ? 'Sur iPhone, ajoute d\'abord l\'appli à l\'écran d\'accueil (Partager → « Sur l\'écran d\'accueil »), puis ouvre-la depuis son icône et reviens ici.' : 'Ce navigateur ne sait pas recevoir de notifications.');
    if (Notification.permission !== 'granted') {
      if (!ask) return null;
      const p = await Notification.requestPermission();
      if (p !== 'granted') throw new Error('Notifications refusées. Pour les autoriser : réglages du téléphone → Notifications → EA Club Manager.');
    }
    const key = await Cloud.pushKey();
    if (!key) throw new Error('Les notifications du club ne sont pas encore activées : le responsable doit le faire une fois (Réglages → Serveur du club → Notifications).');
    const reg = await ready();
    if (!reg) throw new Error('L\'appli n\'est pas encore prête à recevoir des notifications : ferme-la, rouvre-la depuis son icône, puis réessaie.');
    let sub = await reg.pushManager.getSubscription();
    // a subscription made with another key (after a change on the server) is renewed
    const same = sub && sub.options && sub.options.applicationServerKey && btoa(String.fromCharCode(...new Uint8Array(sub.options.applicationServerKey))) === btoa(String.fromCharCode(...b64(key)));
    if (sub && sub.options && sub.options.applicationServerKey && !same) { await sub.unsubscribe().catch(() => {}); sub = null; }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
    await Cloud.pushSub(sub.endpoint, prefs());
    S().ui.notifOn = true; Store.persistNow();
    return sub;
  }
  // Each start of the app: the phone's subscription is sent again (it can change on its own)
  async function refresh() {
    if (!S().ui.notifOn || !Cloud.ready() || !Auth.current()) return;
    try { await subscribe(false); } catch (e) {}
  }

  /* ---------- Mon compte ---------- */
  function accountSection() {
    const p = prefs();
    return `<div class="notif-box" id="notifBox"><b>🔔 Notifications sur ce téléphone</b>
      <p class="muted small" id="notifState">Vérification…</p>
      <div class="chips" id="notifBtns"></div>
      <label class="switch small"><input type="checkbox" data-notifpref="messages" ${p.messages ? 'checked' : ''}><span>Messages (tout le club, mes catégories, privés, signalements)</span></label>
      <label class="switch small"><input type="checkbox" data-notifpref="planning" ${p.planning ? 'checked' : ''}><span>Planning de mes catégories (créneaux, matchs et séances ajoutés, déplacés, supprimés)</span></label>
      <p class="muted small">Quand quelqu'un écrit <b>@</b> suivi de ton prénom dans un message, tu es prévenu dans tous les cas.</p></div>`;
  }
  async function mountAccount(root) {
    const box = $('#notifBox', root); if (!box) return;
    const st = $('#notifState', box), btns = $('#notifBtns', box), sub = await current();
    const perm = 'Notification' in window ? Notification.permission : 'unsupported';
    let text, b = '';
    const swOk = supported() && !!(await ready());
    if (supported() && !swOk) text = 'L\'appli n\'est pas encore prête pour les notifications : ferme-la, rouvre-la depuis son icône, puis reviens ici.';
    else if (!supported()) text = ios() && !standalone() ? '📱 Sur iPhone : ajoute d\'abord l\'appli à l\'écran d\'accueil (Partager → « Sur l\'écran d\'accueil »), ouvre-la depuis son icône, puis reviens ici.' : 'Ce navigateur ne reçoit pas de notifications.';
    else if (perm === 'denied') text = '🚫 Notifications bloquées sur ce téléphone : autorise-les dans les réglages du téléphone (Notifications → EA Club Manager), puis reviens ici.';
    else if (sub && S().ui.notifOn) { text = '✅ Activées : tu es prévenu tout de suite, même appli fermée.'; b = `<button class="btn soft" data-notif="test">${I.check}<span>M'envoyer un test</span></button><button class="btn soft" data-notif="off">${I.x}<span>Désactiver</span></button>`; }
    else { text = 'Pas encore activées sur ce téléphone.'; b = `<button class="btn primary" data-notif="on">🔔<span>Activer les notifications</span></button>`; }
    if (!box.isConnected) return;
    st.textContent = text; btns.innerHTML = b;
  }
  async function onClick(b, rerender) {
    const act = b.dataset.notif;
    if (act === 'on') { b.disabled = true; try { await subscribe(true); toast('Notifications activées sur ce téléphone 🔔'); } catch (e) { toast(why(e), 'err'); } rerender(); return; }
    if (act === 'off') { const sub = await current(); if (sub) { try { await Cloud.pushUnsub(sub.endpoint); } catch (e) {} await sub.unsubscribe().catch(() => {}); } S().ui.notifOn = false; Store.persistNow(); toast('Notifications désactivées sur ce téléphone'); rerender(); return; }
    if (act === 'test') { try { const n = await Cloud.pushTest(); toast(n ? 'Test envoyé : la notification arrive dans quelques secondes' : 'Ce téléphone n\'est pas encore inscrit : touche « Activer »', n ? '' : 'err'); } catch (e) { toast(why(e), 'err'); } return; }
    if (act === 'setup') return setupDialog(rerender);
  }
  async function onChange(t) {
    if (!t.dataset.notifpref) return false;
    S().ui.notifPrefs = Object.assign(prefs(), { [t.dataset.notifpref]: t.checked }); Store.persistNow();
    const sub = await current(); if (sub) { try { await Cloud.pushSub(sub.endpoint, prefs()); } catch (e) {} }
    toast('Choix enregistré'); return true;
  }

  /* ---------- responsable: once for the club ---------- */
  function adminCard() {
    return `<div class="notif-admin"><b>🔔 Notifications des coachs</b> <span class="muted small" id="notifSrv"></span>
      <button class="btn soft" data-notif="setup">${I.settings}<span>Activer / vérifier</span></button></div>`;
  }
  async function mountAdmin(root) {
    const el = $('#notifSrv', root); if (!el) return;
    try { const k = await Cloud.pushKey(); if (el.isConnected) el.textContent = k ? '· activées ✓' : '· pas encore activées'; }
    catch (e) { if (el.isConnected) el.textContent = e.code === 'MISE_A_JOUR' ? '· serveur à mettre à jour' : ''; }
  }
  function setupDialog(rerender) {
    modal({ title: 'Activer les notifications du club', body: `
      <p>Une seule fois, pour tout le club. Ensuite chaque coach active les notifications sur son téléphone (Réglages → Mon compte).</p>
      <ol class="wizard">
        <li><b>Mettre à jour le serveur</b> : Réglages → Serveur du club → « Mettre à jour le serveur » (script à coller dans Supabase, comme d'habitude).</li>
        <li><b>Créer l'envoi des notifications</b> : touche « Copier le programme », puis ouvre <a href="https://supabase.com/dashboard/project/_/functions" target="_blank" rel="noopener">Supabase → Edge Functions</a>.
          <b>Deploy a new function</b> → <b>Via Editor</b>. Nom : <code>raincy-push</code>. Efface le code d'exemple, colle le programme, puis <b>Deploy</b>.</li>
        <li>Dans la fonction <code>raincy-push</code> → <b>Details</b> (ou Settings) : désactive <b>Verify JWT</b>, puis enregistre.</li>
        <li>Reviens ici et touche <b>Vérifier</b>.</li></ol>
      <p class="muted small">Aucun mot de passe ni clé à recopier : les clés de sécurité sont créées toutes seules et restent sur le serveur du club.</p>`,
      actions: [
        { label: 'Copier le programme', icon: I.copy, onClick: () => { fetch('supabase/raincy-push.ts?t=' + Date.now()).then(r => r.text()).then(t => navigator.clipboard.writeText(t)).then(() => toast('Programme copié : colle-le dans Supabase')).catch(() => toast('Copie impossible : ouvre supabase/raincy-push.ts sur GitHub', 'err')); return false; } },
        { label: 'Vérifier', kind: 'primary', icon: I.check, onClick: (close) => { verify().then(ok => { if (ok) { close(); rerender && rerender(); } }); return false; } }] });
  }
  async function verify() {
    const b = UI.busy('Vérification des notifications…');
    try {
      const cfg = await Cloud.pushSetup(fnUrl());
      let r; try { r = await fetch(fnUrl(), { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-raincy-secret': cfg.secret }, body: '{"init":true}' }); }
      catch (e) { toast('La fonction « raincy-push » ne répond pas : vérifie qu\'elle est bien déployée (étape 2).', 'err'); return false; }
      if (r.status === 401) { toast('La fonction refuse l\'appel : désactive « Verify JWT » (étape 3).', 'err'); return false; }
      if (r.status === 404) { toast('Fonction introuvable : son nom doit être exactement raincy-push (étape 2).', 'err'); return false; }
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.publicKey) { toast('Erreur de la fonction : ' + (j.error || r.status), 'err'); return false; }
      toast('Notifications du club activées ✓ Chaque coach peut maintenant les activer sur son téléphone.');
      return true;
    } catch (e) { toast(why(e), 'err'); return false; } finally { b.done(); }
  }

  return { refresh, accountSection, mountAccount, onClick, onChange, adminCard, mountAdmin, supported };
})();
