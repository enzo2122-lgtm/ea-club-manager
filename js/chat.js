/* Chat (1.96 → 1.98): the chat of a category, between the players of the category (teams A and B together) and their coaches.
   Club server: member_chat* for the players' and parents' pages (personal code), club_chat* for the coaches' app (they moderate:
   delete any message, close the chat). Vulgar or insulting words are refused by the server in every category but Seniors and Vétérans.
   (1.98) like a messaging app: the chat takes the whole screen (the page header goes away), messages appear at once when sent,
   new ones every 3 seconds without redrawing, bubbles grouped by person with initials, emojis, « new messages » button. */
const Chat = (() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ERR = [[/MOT_INTERDIT/, 'Pas envoyé : un mot grossier ou insultant n\'est pas accepté ici. Reformule gentiment 🙂'],
    [/TROP_VITE/, 'Doucement : attends une seconde entre deux messages.'], [/CHAT_FERME/, 'Les coachs ont mis le chat en lecture seule pour l\'instant.'],
    [/LIMITE_CHAT/, 'Beaucoup de messages aujourd\'hui : réessaie demain.'], [/PHOTOS_COACHS/, 'Dans ce chat, seuls les coachs envoient des photos pour l\'instant.'], [/\bPHOTO\b/, 'Cette photo ne passe pas : essaie avec une autre.'], [/SONDAGE_FINI/, 'Ce sondage est terminé.']];
  const nice = e => { const m = String((e && ((e.code || '') + ' ' + (e.message || ''))) || ''); const x = ERR.find(([r]) => r.test(m)); return x ? x[1] : (e && e.message) || 'Le serveur ne répond pas.'; };
  const EMOJI = ['👍', '⚽', '🔥', '💪', '😂', '👏', '🙏', '❤️', '😅', '🏆', '🥅', '✅'];
  const HELLO = ['Salut tout le monde 👋', 'Qui vient à l\'entraînement ? ⚽', 'On lâche rien ! 💪'];
  const FAST = 3000, SLOW = 30000, GROUP = 5 * 60e3; // (2.01) behind another tab: every 30 s (only for the badge)

  // one chat at a time: kept when the page is redrawn
  let box = null, o = null, view = null, cat = '', draft = '', timer = null, busy = false, lastPoll = 0, wasShown = false, pend = 0, queue = Promise.resolve(), armed = null;
  // (1.99) polls: the « Sondages » part, whose votes are shown, the new poll being written
  let mode = 'chat', sheet = null; const whoOpen = new Set(), drawn = new Set(); let animate = false;
  // (2.03) the message being answered, the bubble whose actions are open (« sure? » for a report)
  let replyTo = null, sure = null, editing = null; // editing (2.47): {id, body} of my message being changed
  // (2.04) the photos already loaded (id → picture), kept while the page lives
  const imgs = new Map(), imgAsk = new Map();
  const RX = ['👍', '❤️', '😂', '⚽', '🔥', '👏'];

  /* ---------- look ---------- */
  function css() {
    if (document.getElementById('chatCss')) return;
    const st = document.createElement('style'); st.id = 'chatCss';
    st.textContent = [
      // the whole screen for the chat: the page header and the player card go away while the chat is open
      'body.chat-on header.top,body.chat-on .card.who,body.chat-on .credit,body.chat-on .toast-bar,body.chat-on .quick-fab,body.chat-on .help-fab{display:none!important}',
      // (2.34) while typing, the tab bar goes away: on an iPhone it stayed above the keyboard and pushed the chat up
      'body.chat-kb .rail,body.chat-kb .tabbar,body.chat-kb #nav{display:none!important}',
      'body.chat-on main{padding-top:calc(env(safe-area-inset-top) + 8px)!important;padding-bottom:0!important}',
      // (2.00) the chat is fixed on the screen, the page behind does not move (not even with the keyboard)
      'html:has(body.chat-on),body.chat-on{overflow:hidden;overscroll-behavior:none}body.chat-on .cx{position:fixed;z-index:7;min-height:0;margin:0}',
      'body.chat-on main#view .page-head{display:none}body.chat-on main#view{padding-top:calc(env(safe-area-inset-top) + 8px)}',
      '.cx{display:flex;flex-direction:column;min-height:320px;box-sizing:border-box;border-radius:18px;background:var(--surface,#fff);border:1px solid var(--line,#e3e5ea);overflow:hidden;position:relative}',
      // (2.37) phone: the chat is part of the screen (no rounded card, no margins); the top of the chat sits under the status bar
      'body.chat-full .cx{border-radius:0;border:0;box-shadow:none}body.chat-edge .cx-top{padding-top:calc(env(safe-area-inset-top) + 8px)}body.chat-full.tabs-top:not(.chat-kb) .cx-bar,body.chat-full.nav-top:not(.chat-kb) .cx-bar{padding-bottom:calc(env(safe-area-inset-bottom) + 8px)}',
      '.cx-top{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--line,#e3e5ea);min-height:46px}',
      'body.tabs-top .cx-top,body.nav-top .cx-top{padding-right:118px}',
      '@media (max-width:430px){.cx-w{display:none}}', // (2.08) a narrow phone: the icons only, so the name of the room stays readable
      '.cx-top b{font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:0 1 auto}.cx-shield{font-size:12px;font-weight:700;color:#15803d;white-space:nowrap}',
      '.cx-top .cx-sp{flex:1}.cx-cats{display:flex;gap:4px}.cx-cats button,.cx-mod{border:1px solid var(--line,#d0d4dc);background:var(--surface,#fff);color:inherit;border-radius:999px;min-height:36px;padding:6px 12px;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer}',
      '.cx-cats button.on{background:#0e1d45;color:#fff;border-color:#0e1d45}',
      '.cx-list{flex:1;overflow-y:auto;padding:10px 10px 6px;display:flex;flex-direction:column;gap:2px;background:var(--bg,#f2f3f7);overscroll-behavior:contain;-webkit-overflow-scrolling:touch}',
      '.cx-day{align-self:center;margin:10px 0 6px;padding:3px 12px;border-radius:999px;background:var(--surface,#fff);font-size:12px;font-weight:700;color:var(--muted,#667);box-shadow:0 1px 2px rgba(0,0,0,.06)}',
      '.cx-row{display:flex;align-items:flex-end;gap:6px;max-width:100%}.cx-row.mine{justify-content:flex-end}.cx-row.first{margin-top:8px}',
      '.cx-av{flex:none;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#fff}.cx-av.ghost{visibility:hidden}',
      '.cx-b{position:relative;max-width:78%;padding:7px 11px 5px;border-radius:18px;background:var(--surface,#fff);color:var(--ink,#111);box-shadow:0 1px 1.5px rgba(0,0,0,.08);overflow-wrap:anywhere;font-size:15.5px;line-height:1.35;cursor:default}.cx-b.cx-in{animation:cxIn .18s ease-out}',
      '.cx-row:not(.mine).first .cx-b{border-bottom-left-radius:6px}.cx-row.mine .cx-b{background:#0e1d45;color:#fff}.cx-row.mine.first .cx-b{border-bottom-right-radius:6px}',
      '.cx-row.coach:not(.mine) .cx-b{background:color-mix(in srgb,#c9a45c 22%,var(--surface,#fff))}',
      '.cx-name{display:block;font-size:12.5px;font-weight:800;margin-bottom:1px}.cx-coach{font-size:10.5px;font-weight:800;padding:0 6px;border-radius:999px;background:#c9a45c;color:#0e1d45;margin-left:4px;vertical-align:1px}',
      '.cx-t{float:right;font-size:11px;opacity:.6;margin:6px 0 -2px 10px;white-space:nowrap}.cx-b.big{font-size:34px;line-height:1.15;background:none!important;box-shadow:none;padding:2px 4px}',
      '.cx-b.pend{opacity:.65}.cx-b.fail{outline:2px solid #dc2626}.cx-gone{font-style:italic;opacity:.6;font-size:14px}',
      '.cx-act{display:flex;gap:6px;justify-content:flex-end;margin:2px 0 4px}.cx-act button{border:0;border-radius:999px;min-height:40px;padding:8px 16px;font:inherit;font-size:14px;font-weight:700;cursor:pointer;background:#dc2626;color:#fff}.cx-act button.no{background:var(--line,#e3e5ea);color:inherit}',
      '.cx-retry{font-size:12px;color:#dc2626;font-weight:700;text-align:right;margin:2px 4px 4px;cursor:pointer}',
      '.cx-empty{margin:auto;text-align:center;padding:20px 10px;color:var(--muted,#667)}.cx-empty .e{font-size:44px}.cx-hello{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:10px}',
      '.cx-hello button,.cx-emo button{border:1px solid var(--line,#d0d4dc);background:var(--surface,#fff);color:inherit;border-radius:999px;padding:6px 12px;font:inherit;font-size:14px;cursor:pointer}',
      '.cx-new{position:absolute;left:50%;transform:translateX(-50%);bottom:76px;border:0;border-radius:999px;padding:7px 14px;background:#8c1024;color:#fff;font:inherit;font-size:13px;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,.2);cursor:pointer;z-index:2}',
      '.cx-off{padding:6px 12px;font-size:13px;font-weight:700;background:color-mix(in srgb,#b7791f 18%,transparent);text-align:center}',
      // (2.39) @ to tag a player: the suggestions above the box, the names tagged in the messages
      '.cx-ment{display:flex;flex-direction:column;max-height:190px;overflow-y:auto;margin:0 8px 4px;border:1px solid var(--line,#e3e5ea);border-radius:14px;background:var(--surface,#fff);box-shadow:0 -6px 20px rgba(0,0,0,.12)}.cx-ment[hidden]{display:none}',
      '.cx-ment button{display:flex;align-items:center;gap:10px;padding:9px 12px;border:0;border-bottom:1px solid var(--line,#eef0f3);background:none;text-align:left;font:600 15px/1.2 inherit;color:inherit}.cx-ment button:last-child{border-bottom:0}.cx-ment button:active,.cx-ment button.on{background:rgba(29,78,216,.08)}',
      '.cx-ment i{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:#1d4ed8;color:#fff;font:800 11px/1 system-ui;font-style:normal}.cx-ment i.co{background:#fde68a;font-size:15px}',
      '.cx-at{font-weight:800;color:#1d4ed8}.cx-row.mine .cx-at{color:inherit;text-decoration:underline}',
      '.cx-emo{display:flex;gap:4px;overflow-x:auto;padding:6px 10px 0;scrollbar-width:none}.cx-emo button{font-size:20px;padding:2px 8px;border:0;background:none}',
      '.cx-bar{display:flex;align-items:flex-end;gap:6px;padding:8px;border-top:1px solid var(--line,#e3e5ea);background:var(--surface,#fff)}',
      '.cx-bar textarea{flex:1;min-height:42px;max-height:120px;resize:none;padding:10px 14px;border-radius:21px;border:1px solid var(--line,#d0d4dc);background:var(--bg,#f2f3f7);color:inherit;font:inherit;font-size:16px;line-height:1.3;outline:none}',
      '.cx-ic{flex:none;width:42px;height:42px;border-radius:50%;border:0;display:flex;align-items:center;justify-content:center;font-size:20px;cursor:pointer;background:none;color:inherit}',
      '.cx-send{background:#8c1024;color:#fff;transition:transform .12s,opacity .12s}.cx-send:disabled{opacity:.35}.cx-send:not(:disabled):active{transform:scale(.9)}',
      '.cx-note{font-size:11.5px;color:var(--muted,#667);text-align:center;padding:0 10px 6px;background:var(--surface,#fff)}',
      '.tabbar .tab .cx-badge{position:absolute;top:2px;right:calc(50% - 22px);min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#e11d48;color:#fff;font:800 11px/18px system-ui,sans-serif}.tabbar .tab{position:relative}',
      '.cx-seg{display:flex;background:var(--bg,#f2f3f7);border-radius:999px;padding:2px;gap:2px}.cx-seg button{border:0;background:none;color:inherit;border-radius:999px;min-height:36px;padding:6px 12px;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;white-space:nowrap}.cx-seg button.on{background:var(--surface,#fff);box-shadow:0 1px 3px rgba(0,0,0,.12)}',
      '.cx-b.poll{min-width:min(78%,300px)}.cx-poll{display:flex;flex-direction:column;gap:5px;margin:2px 0 4px}.cx-pq{font-weight:800;font-size:15.5px;margin-bottom:2px}',
      '.cx-po{position:relative;overflow:hidden;display:flex;align-items:center;gap:8px;width:100%;min-height:44px;padding:6px 10px;border-radius:12px;border:1px solid color-mix(in srgb,currentColor 22%,transparent);background:color-mix(in srgb,currentColor 5%,transparent);color:inherit;font:inherit;font-size:14.5px;text-align:left;cursor:pointer}',
      '.cx-po:disabled{cursor:default}.cx-pf{position:absolute;left:0;top:0;bottom:0;background:color-mix(in srgb,currentColor 16%,transparent);transition:width .3s}.cx-po.me{border-color:currentColor;font-weight:700}.cx-po.win{font-weight:800}',
      '.cx-pt{position:relative;flex:1;min-width:0}.cx-pn{position:relative;font-weight:800;font-size:13px}.cx-pw{font-size:12px;opacity:.75;margin:-2px 4px 2px}',
      '.cx-pi{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:12px;opacity:.85}.cx-pi button{border:0;background:color-mix(in srgb,currentColor 10%,transparent);color:inherit;border-radius:999px;min-height:34px;padding:6px 12px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}',
      '.cx-pcard{background:var(--surface,#fff);border-radius:16px;padding:10px 12px;margin:4px 0 8px;box-shadow:0 1px 2px rgba(0,0,0,.08)}.cx-pby{font-size:12px;color:var(--muted,#667);margin-bottom:4px}',
      '.cx-newpoll{flex:1;min-height:44px;border:0;border-radius:22px;background:#8c1024;color:#fff;font:inherit;font-weight:700;cursor:pointer}',
      '.cx-sheet{position:absolute;inset:0;z-index:3;background:rgba(10,15,34,.45);display:flex;align-items:flex-end}.cx-sheet form{width:100%;max-height:100%;overflow-y:auto;background:var(--surface,#fff);border-radius:18px 18px 0 0;padding:14px;display:flex;flex-direction:column;gap:8px}',
      '.cx-sheet input[type=text]{min-height:42px;padding:8px 12px;border-radius:12px;border:1px solid var(--line,#d0d4dc);background:var(--bg,#f2f3f7);color:inherit;font:inherit;font-size:16px}',
      '.cx-sheet label{display:flex;align-items:center;gap:8px;font-size:14px}.cx-sh-b{display:flex;gap:8px;justify-content:flex-end}.cx-sh-b button,.cx-addopt{border:1px solid var(--line,#d0d4dc);background:var(--surface,#fff);color:inherit;border-radius:12px;padding:9px 14px;font:inherit;font-weight:700;cursor:pointer}.cx-sh-b button[type=submit]{background:#8c1024;color:#fff;border-color:#8c1024}',
      '.cx-q{display:block;margin:0 0 4px;padding:4px 8px;border-left:3px solid currentColor;border-radius:8px;background:color-mix(in srgb,currentColor 9%,transparent);font-size:13px;opacity:.9;cursor:pointer;max-height:3.2em;overflow:hidden}.cx-q b{display:block;font-size:12px}',
      '.cx-rxs{display:flex;flex-wrap:wrap;gap:4px;margin:2px 0 4px 36px}.cx-rxs.mine{justify-content:flex-end;margin:2px 0 4px}.cx-rxs button{border:1px solid var(--line,#d0d4dc);background:var(--surface,#fff);color:inherit;border-radius:999px;min-height:30px;padding:2px 9px;font:inherit;font-size:13px;cursor:pointer}.cx-rxs button.me{border-color:#0e1d45;background:color-mix(in srgb,#0e1d45 10%,var(--surface,#fff));font-weight:700}',
      '.cx-flag{display:inline-block;margin-left:6px;font-size:11.5px;font-weight:800;color:#dc2626}',
      '.cx-menu{display:flex;flex-direction:column;gap:6px;margin:4px 0 8px;padding:8px;border-radius:14px;background:var(--surface,#fff);box-shadow:0 4px 14px rgba(0,0,0,.14)}.cx-menu .cx-rxpick{display:flex;justify-content:space-around}.cx-menu .cx-rxpick button{border:0;background:none;font-size:26px;min-width:44px;min-height:44px;cursor:pointer;border-radius:12px}.cx-menu .cx-rxpick button.me{background:color-mix(in srgb,#0e1d45 12%,transparent)}',
      '.cx-menu .cx-mbtn{display:flex;flex-wrap:wrap;gap:6px}.cx-menu .cx-mbtn button{flex:1 1 auto;border:1px solid var(--line,#d0d4dc);background:var(--surface,#fff);color:inherit;border-radius:12px;min-height:42px;padding:6px 12px;font:inherit;font-size:14px;font-weight:700;cursor:pointer}.cx-menu .cx-mbtn .del,.cx-menu .cx-mbtn .rep.go{background:#dc2626;color:#fff;border-color:#dc2626}',
      '.cx-ed{font-style:normal;opacity:.85;margin-right:2px}.cx-editbar{background:#eff6ff!important}',
      '.cx-replybar{display:flex;align-items:center;gap:8px;padding:6px 10px;border-top:1px solid var(--line,#e3e5ea);background:var(--surface,#fff);font-size:13px}.cx-replybar span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-left:3px solid #8c1024;padding-left:8px}.cx-replybar button{border:0;background:none;font-size:18px;min-width:40px;min-height:40px;cursor:pointer;color:inherit}',
      '.cx-crown{margin-right:3px}.cx-kings{padding:7px 12px;font-size:13.5px;text-align:center;background:linear-gradient(90deg,#f6e3b0,#c9a45c,#f6e3b0);color:#14172b;border-bottom:1px solid var(--line,#e3e5ea)}',
      '.cx-bdrow{justify-content:center}.cx-b.cx-bday{max-width:92%;text-align:center;background:linear-gradient(160deg,#fff6d8,#f1d58a 55%,#c9a45c);color:#14172b;border:2px solid #c9a45c;border-radius:18px;padding:12px 16px 8px;font-weight:600;white-space:pre-line}',
      '.cx-bdc{display:block;font-size:34px;line-height:1;margin-bottom:4px;animation:cxCrown 2.4s ease-in-out infinite}.cx-bdgo{display:block;margin:10px auto 2px;padding:9px 16px;border:0;border-radius:999px;background:#0e1d45;color:#fff;font:inherit;font-weight:800;cursor:pointer}',
      '@keyframes cxCrown{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg) scale(1.08)}}@media (prefers-reduced-motion:reduce){.cx-bdc{animation:none}}',
      '.cx-row.flash .cx-b{outline:3px solid #c9a45c}.cx-mute{border:0;background:none;font-size:20px;min-width:40px;min-height:40px;cursor:pointer}',
      '.cx-img{display:block;margin:2px -4px 4px;border-radius:12px;overflow:hidden;min-height:120px;background:color-mix(in srgb,currentColor 8%,transparent);cursor:zoom-in}.cx-img img{display:block;width:100%;max-height:340px;object-fit:cover}',
      '.cx-b.photo{min-width:min(70%,260px)}.cx-pin{display:flex;align-items:center;gap:8px;padding:7px 12px;font-size:13px;background:color-mix(in srgb,#c9a45c 16%,var(--surface,#fff));border-bottom:1px solid var(--line,#e3e5ea);cursor:pointer}.cx-pin span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.cx-view{position:fixed;inset:0;z-index:99;background:rgba(0,0,0,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px}.cx-view img{max-width:100%;max-height:82vh;border-radius:8px}.cx-view p{color:#fff;margin:10px 0 0;font-size:14px;text-align:center}',
      '.cx-ph.off{opacity:.45}',
      '@keyframes cxIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}@media (prefers-reduced-motion:reduce){.cx-b.cx-in{animation:none}}',
    ].join('');
    document.head.appendChild(st);
  }
  const COLORS = ['#2563eb', '#15803d', '#b45309', '#7c3aed', '#db2777', '#0891b2', '#ea580c', '#4f46e5', '#0d9488', '#9333ea'];
  const color = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return COLORS[h % COLORS.length]; };
  const initials = n => String(n || '?').replace(/^Coach\s+/, '').split(/[\s.]+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';
  const time = d => { try { return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
  const dayOf = d => { try { const x = new Date(d), n = new Date(); if (x.toDateString() === n.toDateString()) return 'Aujourd\'hui'; n.setDate(n.getDate() - 1); if (x.toDateString() === n.toDateString()) return 'Hier';
    return x.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); } catch (e) { return ''; } };
  const onlyEmoji = s => /^(\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s){1,12}$/u.test(s || '') && !/^[\d#*\s]+$/.test(s);
  const linkify = s => tags(esc(s).replace(/https?:\/\/[^\s<]+/g, u => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`)).split('\n').join('<br>');
  // (2.39) the players tagged (@Lucas M.) stand out in the messages
  const fold = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const people = () => ((view && view.people) || []).filter(n => typeof n === 'string' && n);
  function tags(h) {
    if (h.indexOf('@') < 0) return h;
    const names = people().slice().sort((a, b) => b.length - a.length);
    return h.replace(/@([^\s@<]+(?: [^\s@<]+)?)/g, (all, w) => {
      w = w.split(' ')[0];
      const n = names.find(x => fold(all).startsWith('@' + fold(esc(x)))) || names.find(x => !/^Coach /.test(x) && fold(w).replace(/[^a-z0-9-]+$/, '') === fold(x.split(' ')[0]));
      if (!n) return all;
      const exact = fold(all).startsWith('@' + fold(esc(n))), len = exact ? esc(n).length + 1 : 1 + w.replace(/[^\p{L}\p{N}-]+$/u, '').length;
      return `<b class="cx-at">${all.slice(0, len)}</b>${all.slice(len)}`;
    });
  }
  // the suggestions when « @ » is typed: the players of the category whose name starts with what follows
  let ment = null;
  function mentionAsk(t) {
    const p = $('#cxMent'); if (!p) return;
    const before = t.value.slice(0, t.selectionStart ?? t.value.length), m = before.match(/(^|\s)@([^\s@]*(?: [^\s@]*)?)$/);
    const w = m ? fold(m[2]) : null;
    const list = w === null ? [] : people().filter(n => { const f = fold(n); return f.startsWith(w) || f.split(' ').some(x => x.startsWith(w)); }).slice(0, 8);
    if (!list.length) { ment = null; if (!p.hidden) { p.hidden = true; p.innerHTML = ''; fit(); } return; }
    ment = { from: before.length - m[2].length - 1, to: before.length };
    p.innerHTML = list.map(n => `<button type="button" data-cxment="${esc(n)}"><i class="${/^Coach /.test(n) ? 'co' : ''}">${/^Coach /.test(n) ? '🧢' : esc(n.split(' ').map(x => x[0] || '').join('').slice(0, 2).toUpperCase())}</i>${esc(n)}</button>`).join('');
    if (p.hidden) { p.hidden = false; fit(); }
  }
  function mentionPick(n) {
    const t = $('#cxText'); if (!t || !ment) return;
    const add = '@' + n + ' ';
    t.value = t.value.slice(0, ment.from) + add + t.value.slice(ment.to); const at = ment.from + add.length;
    draft = t.value; t.focus({ preventScroll: true }); t.setSelectionRange(at, at); grow();
    const s = $('#cxSend'); if (s) s.disabled = !draft.trim(); mentionAsk(t);
  }
  const $ = q => box && box.querySelector(q);

  /* ---------- (1.99) the polls ---------- */
  const pollOf = id => ((view && view.polls) || []).find(p => p.id === id);
  const openPolls = () => ((view && view.polls) || []).filter(p => !p.closed).length;
  function pollHtml(p) {
    if (!p) return '';
    const tot = p.opts.reduce((a, x) => a + x.n, 0), max = Math.max(0, ...p.opts.map(x => x.n)), seeWho = whoOpen.has(p.id), boss = p.mine || (view && view.mod);
    return `<div class="cx-poll"><div class="cx-pq">📊 ${esc(p.q)}</div>
      ${p.opts.map((x, i) => { const pct = tot ? Math.round(x.n * 100 / tot) : 0;
        return `<button class="cx-po ${x.me ? 'me' : ''} ${p.closed && max && x.n === max ? 'win' : ''}" data-cxvote="${p.id}:${i}" ${p.closed ? 'disabled' : ''}><span class="cx-pf" style="width:${pct}%"></span>
          <span class="cx-pt">${x.me ? '✓ ' : ''}${p.closed && max && x.n === max ? '🏆 ' : ''}${esc(x.t)}</span><span class="cx-pn">${x.n}${tot ? ` · ${pct}%` : ''}</span></button>
          ${seeWho && x.who.length ? `<div class="cx-pw">${x.who.map(esc).join(', ')}</div>` : ''}`; }).join('')}
      <div class="cx-pi">${p.voters} votant${p.voters > 1 ? 's' : ''} · ${p.closed ? '🔒 terminé' : p.multi ? 'plusieurs réponses' : 'une réponse'}
        ${p.voters ? `<button data-cxwho="${p.id}">${seeWho ? 'Masquer' : '👀 Qui a voté ?'}</button>` : ''}${boss ? `<button data-cxclose="${p.id}:${p.closed ? 0 : 1}">${p.closed ? 'Rouvrir' : 'Clôturer'}</button>` : ''}</div></div>`;
  }
  function pollsHtml() {
    const ps = (view && view.polls) || [];
    if (!ps.length) return `<div class="cx-empty"><div class="e">📊</div><b>Pas encore de sondage</b><p>Une date, un resto, un maillot… pose la question à toute la catégorie !</p></div>`;
    return ps.map(p => `<div class="cx-pcard"><div class="cx-pby">${p.kind === 'coach' ? '🧢 ' : ''}${esc(p.mine ? 'Toi' : p.name)} · ${esc(dayOf(p.at))} ${esc(time(p.at))}</div>${pollHtml(p)}</div>`).join('');
  }
  function sheetHtml() {
    if (!sheet) return '';
    return `<div class="cx-sheet" id="cxSheet"><form id="cxPollForm"><b>📊 Nouveau sondage</b>
      <input type="text" id="cxPq" maxlength="200" placeholder="Ta question (ex : qui vient au resto samedi ?)" value="${esc(sheet.q)}" aria-label="Question">
      ${sheet.opts.map((x, i) => `<input type="text" data-cxopt="${i}" maxlength="80" placeholder="Réponse ${i + 1}" value="${esc(x)}" aria-label="Réponse ${i + 1}">`).join('')}
      ${sheet.opts.length < 6 ? '<button type="button" class="cx-addopt" data-cxaddopt>＋ Ajouter une réponse</button>' : ''}
      <label><input type="checkbox" id="cxPmulti" ${sheet.multi ? 'checked' : ''}> Plusieurs réponses possibles</label>
      <div class="cx-sh-b"><button type="button" data-cxsheetno>Annuler</button><button type="submit">Créer le sondage</button></div></form></div>`;
  }
  /* ---------- (2.04) rooms: « U13 · Parents » next to « U13 » ---------- */
  const isParents = c => / · Parents$/.test(c || '');
  const roomTitle = c => isParents(c) ? '👪 ' + c.replace(/ · Parents$/, '') + ' · Parents' : c;
  const roomLabel = (c, cats) => { const base = c.replace(/ · Parents$/, ''); const both = cats.includes(base) && cats.includes(base + ' · Parents');
    return both ? (isParents(c) ? '👪 Parents' : '⚽ Joueurs') + (new Set(cats.map(x => x.replace(/ · Parents$/, ''))).size > 1 ? ' ' + base : '') : c; };
  /* ---------- (2.04) photos: loaded when shown, a big view when touched ---------- */
  function photoOf(id) {
    if (imgs.has(id)) return Promise.resolve(imgs.get(id));
    if (!imgAsk.has(id)) imgAsk.set(id, o.img(view.cat, id).then(v => { const ok = typeof v === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(v); if (ok) imgs.set(id, v); return ok ? v : null; }).catch(() => { imgAsk.delete(id); return null; }));
    return imgAsk.get(id);
  }
  function loadImgs() {
    if (!box || !o || !o.img) return;
    box.querySelectorAll('[data-cximg]').forEach(el => { if (el.querySelector('img')) return; const id = +el.dataset.cximg; if (!id) return;
      photoOf(id).then(v => { const now = box && box.querySelector(`[data-cximg="${id}"]`); if (v && now && !now.querySelector('img')) { const near = nearBottom(); now.innerHTML = `<img alt="Photo" src="${v}">`; if (near) toBottom(); } }); });
  }
  function viewPhoto(src, caption) {
    const v = document.createElement('div'); v.className = 'cx-view'; v.innerHTML = `<img alt="Photo" src="${src}"><p>${caption ? esc(caption) + '<br>' : ''}Touche pour fermer</p>`;
    v.onclick = () => v.remove(); document.body.appendChild(v);
  }
  // the phone makes the photo smaller (at most 1280 px, JPEG): a few hundred Ko instead of several Mo
  function shrink(file) {
    return new Promise((res, rej) => {
      const u = URL.createObjectURL(file), im = new Image();
      im.onload = () => { try { let w = im.naturalWidth, h = im.naturalHeight, max = 1280, q = .74, out = '';
          for (let k = 0; k < 4; k++) { const r = Math.min(1, max / Math.max(w, h)), c = document.createElement('canvas'); c.width = Math.round(w * r); c.height = Math.round(h * r);
            c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); out = c.toDataURL('image/jpeg', q); if (out.length < 650000) break; max = Math.round(max * .8); q -= .08; }
          URL.revokeObjectURL(u); out.length < 690000 ? res(out) : rej(new Error('PHOTO')); } catch (e) { URL.revokeObjectURL(u); rej(e); } };
      im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('PHOTO')); }; im.src = u;
    });
  }
  async function sendPhoto(file) {
    let data; try { data = await shrink(file); } catch (e) { return (o.toast || alert)(nice(e), true); }
    const t = $('#cxText'), cap = (t ? t.value : '').trim();
    const m = { id: 'p' + (++pend), at: new Date().toISOString(), name: 'moi', kind: o.kind || 'player', mine: true, body: cap, img: true, local: data, pend: true };
    view.msgs.push(m); draft = ''; if (t) { t.value = ''; grow(); } drawList(true);
    queue = queue.then(async () => {
      try { await o.photo(view.cat, data, cap); m.ok = true; lastPoll = 0; await load(false); }
      catch (e) { m.pend = false; m.fail = true; drawList(false); if (/MOT_INTERDIT/.test((e.code || '') + e.message)) { view.msgs = view.msgs.filter(x => x !== m); draft = cap; drawAll(); } (o.toast || alert)(nice(e), true); }
    });
  }
  /* ---------- the messages ---------- */
  // the key of a message for the grouping: same person, less than 5 minutes after the one before, same day
  function rowHtml(m, prev) {
    m.name = String(m.name || '?');
    const first = !prev || prev.who !== (m.mine ? 'me' : m.name) || new Date(m.at) - new Date(prev.at) > GROUP || dayOf(prev.at) !== dayOf(m.at);
    const day = !prev || dayOf(prev.at) !== dayOf(m.at) ? `<div class="cx-day">${esc(dayOf(m.at))}</div>` : '';
    const big = !m.deleted && onlyEmoji(m.body);
    const pic = m.img && !m.deleted ? `<span class="cx-img" data-cximg="${m.id}">${m.local || imgs.get(m.id) ? `<img alt="Photo" src="${m.local || imgs.get(m.id)}">` : ''}</span>` : '';
    const body = m.deleted ? '<span class="cx-gone">🚫 Message supprimé</span>' : m.poll && pollOf(m.id) ? pollHtml(pollOf(m.id)) : pic + (m.body ? linkify(m.body) : '');
    const av = m.mine ? '' : `<span class="cx-av ${first ? '' : 'ghost'}" style="background:${color(m.name)}" aria-hidden="true">${esc(initials(m.name))}</span>`;
    const name = !m.mine && first ? `<span class="cx-name" style="color:${color(m.name)}">${m.king ? '<span class="cx-crown" title="C\'est son anniversaire">👑</span>' : ''}${esc(m.name.replace(/^Coach\s+/, ''))}${m.kind === 'coach' ? '<span class="cx-coach">COACH</span>' : ''}</span>` : '';
    const st = m.fail ? '⚠️' : m.ok ? '✓' : m.pend ? '🕓' : '';
    const quote = m.reply && !m.deleted ? `<span class="cx-q" data-cxgoto="${m.reply.id}"><b>↩️ ${esc(String(m.reply.name || '').replace(/^Coach\s+/, ''))}</b>${m.reply.body == null ? '<i>Message supprimé</i>' : esc(m.reply.body)}</span>` : '';
    const rep = view && view.mod && view.reports && view.reports[m.id], flag = rep ? `<span class="cx-flag" title="Signalé par ${esc(rep.join(', '))}">🚩 ${rep.length}</span>` : '';
    const rx = (view && view.reacts && view.reacts[m.id]) || [];
    const rxs = rx.length && !m.deleted ? `<div class="cx-rxs ${m.mine ? 'mine' : ''}">${rx.map(r => `<button class="${r.me ? 'me' : ''}" data-cxrx="${m.id}:${r.e}" title="${esc((r.who || []).join(', '))}">${r.e} ${r.n}</button>`).join('')}</div>` : '';
    // (2.19) the birthday message of the day: a golden card in the middle, and « Souhaiter » in one touch
    if (m.bday && !m.deleted) { const who = (view.kings || []).map(n => String(n).split(' ')[0]); const wish = `Joyeux anniversaire${who.length === 1 ? ' ' + who[0] : ''} ! 🎂🎉`;
      return `${day}<div class="cx-row cx-bdrow" data-cx="${m.id}"><div class="cx-b cx-bday ${animate && !drawn.has(m.id) ? 'cx-in' : ''}"><span class="cx-bdc" aria-hidden="true">👑</span>${linkify(m.body || '')}
        ${canWrite() && !o.king && who.length ? `<button class="cx-bdgo" data-cxsay="${esc(wish)}">🎂 Lui souhaiter</button>` : ''}<span class="cx-t">${esc(time(m.at))}</span></div></div>${rxs}`; }
    return `${day}<div class="cx-row ${m.mine ? 'mine' : ''} ${first ? 'first' : ''} ${m.kind === 'coach' ? 'coach' : ''}" data-cx="${m.id}">${av}
      <div class="cx-b ${animate && !drawn.has(m.id) ? 'cx-in' : ''} ${big ? 'big' : ''} ${m.poll && !m.deleted ? 'poll' : ''} ${m.img && !m.deleted ? 'photo' : ''} ${m.pend ? 'pend' : ''} ${m.fail ? 'fail' : ''}">${name}${quote}${body}<span class="cx-t">${flag}${m.edited && !m.deleted ? '<i class="cx-ed">modifié</i> ' : ''}${esc(time(m.at))}${st ? ' ' + st : ''}</span></div></div>
      ${rxs}${m.fail ? `<div class="cx-retry" data-cxretry="${m.id}">Pas envoyé · toucher pour réessayer</div>` : ''}`;
  }
  // (2.03) the actions of a bubble: a reaction, answer, report, delete
  function menuHtml(m) {
    const mine = new Set(((view.reacts || {})[m.id] || []).filter(r => r.me).map(r => r.e));
    // (2.47) only the author deletes or changes his message (the coaches: reports, close the chat)
    const canDel = m.mine && typeof m.id === 'number', canEdit = canDel && o.edit && canWrite() && !m.poll && !m.bday && !m.deleted && (m.body || '') !== '', canRep = !m.mine && o.report && o.kind !== 'coach';
    return `<div class="cx-menu" data-cxmenu="${m.id}"><div class="cx-rxpick">${RX.map(e => `<button class="${mine.has(e) ? 'me' : ''}" data-cxrx="${m.id}:${e}" aria-label="Réagir ${e}">${e}</button>`).join('')}</div>
      <div class="cx-mbtn">${canWrite() ? `<button data-cxreply="${m.id}">↩️ Répondre</button>` : ''}${canRep ? `<button class="rep ${sure === m.id ? 'go' : ''}" data-cxreport="${m.id}">${sure === m.id ? '🚩 Oui, prévenir les coachs' : '🚩 Signaler'}</button>` : ''}
        ${view.mod && o.pin ? `<button data-cxpin="${view.pin && view.pin.id === m.id ? 0 : m.id}">${view.pin && view.pin.id === m.id ? '📌 Désépingler' : '📌 Épingler'}</button>` : ''}
        ${canEdit ? `<button data-cxedit="${m.id}">✏️ Modifier</button>` : ''}${canDel ? `<button class="del" data-cxdel="${m.id}">🗑️ Supprimer</button>` : ''}<button data-cxno>Fermer</button></div></div>`;
  }
  const withWho = m => Object.assign(m, { who: m.mine ? 'me' : m.name });
  function listHtml() {
    if (mode === 'polls') return pollsHtml();
    const ms = (view && view.msgs) || [];
    if (!ms.length) return `<div class="cx-empty"><div class="e">⚽</div><b>Pas encore de message</b><p>Lance la discussion avec ta catégorie !</p>
      ${view && (view.off && !view.mod) ? '' : `<div class="cx-hello">${HELLO.map(h => `<button data-cxsay="${esc(h)}">${esc(h)}</button>`).join('')}</div>`}</div>`;
    const h = ms.map((m, i) => rowHtml(withWho(m), i ? ms[i - 1] : null)).join('');
    ms.forEach(m => drawn.add(m.id)); return h;
  }
  const canWrite = () => view && view.cat && (!view.off || view.mod);
  const parRoom = () => !!(view && / · Parents$/.test(view.cat || '')); // (2.07) the parents' room: « off » = all the parents muted
  function shell() {
    if (!view) return '<div class="cx"><div class="cx-list"><div class="cx-empty"><div class="e">💬</div>Chargement du chat…</div></div></div>';
    if (!view.cat) return '<div class="cx"><div class="cx-list"><div class="cx-empty"><div class="e">💬</div>Pas de chat pour l\'instant : tu n\'es dans aucune équipe.</div></div></div>';
    const cats = view.cats || [];
    return `<div class="cx" id="cx">
      <div class="cx-top"><b>${esc(roomTitle(view.cat))}</b>${view.filtered ? '<span class="cx-shield" title="Les mots grossiers ou insultants sont bloqués">🛡️</span>' : ''}
        <span class="cx-seg"><button class="${mode === 'chat' ? 'on' : ''}" data-cxmode="chat" aria-label="Chat">💬<span class="cx-w"> Chat</span></button><button class="${mode === 'polls' ? 'on' : ''}" data-cxmode="polls" aria-label="Sondages">📊<span class="cx-w"> Sondages</span>${openPolls() ? ` (${openPolls()})` : ''}</button></span><span class="cx-sp"></span>
        ${cats.length > 1 ? `<span class="cx-cats">${cats.map(c => `<button class="${c === view.cat ? 'on' : ''}" data-cxcat="${esc(c)}">${esc(roomLabel(c, cats))}</button>`).join('')}</span>` : ''}
        ${o.mute && typeof view.muted === 'boolean' ? `<button class="cx-mute" data-cxmute="${view.muted ? 0 : 1}" title="${view.muted ? 'Notifications du chat coupées : toucher pour les remettre' : 'Couper les notifications du chat'}" aria-label="${view.muted ? 'Remettre les notifications' : 'Couper les notifications'}">${view.muted ? '🔕' : '🔔'}</button>` : ''}
        ${view.mod && o.photosOk && view.filtered ? `<button class="cx-mute cx-ph ${view.photos ? '' : 'off'}" data-cxphotos="${view.photos ? 0 : 1}" title="${view.photos ? 'Les joueurs peuvent envoyer des photos : toucher pour réserver les photos aux coachs' : 'Photos réservées aux coachs : toucher pour les ouvrir aux joueurs'}" aria-label="Photos des joueurs">📷</button>` : ''}
        ${view.mod && o.off ? `<button class="cx-mod" data-cxoff="${view.off ? 0 : 1}" title="${parRoom() ? (view.off ? 'Les parents lisent sans pouvoir écrire : toucher pour leur rendre la parole' : 'Mettre tous les parents en sourdine : ils lisent, seuls les coachs écrivent') : (view.off ? 'Rouvrir le chat aux joueurs' : 'Fermer le chat : les joueurs lisent, seuls les coachs écrivent')}">${parRoom() ? (view.off ? '🔊 Parole aux parents' : '🔇 Sourdine parents') : (view.off ? '🔓 Rouvrir' : '🔒 Fermer')}</button>` : ''}</div>
      ${(view.kings || []).length && mode === 'chat' ? `<div class="cx-kings">👑 <b>King of the day</b> : ${esc(view.kings.join(', '))} · joyeux anniversaire ! 🎂</div>` : ''}
      ${view.pin && mode === 'chat' ? `<div class="cx-pin" data-cxgoto="${view.pin.id}">📌<span><b>${esc(String(view.pin.name || '').replace(/^Coach\s+/, ''))}</b> : ${esc(view.pin.body || (view.pin.img ? '📷 Photo' : ''))}</span></div>` : ''}
      ${view.off ? `<div class="cx-off">${parRoom() ? '🔇 Parents en sourdine : seuls les coachs écrivent' : '🔒 Chat fermé par les coachs'}${view.mod ? ' (toi, tu peux écrire)' : ''}</div>` : ''}
      <div class="cx-list" id="cxList">${listHtml()}</div>
      <button class="cx-new" id="cxNew" hidden>⬇ Nouveaux messages</button>
      ${canWrite() && mode === 'polls' && o.poll ? '<div class="cx-bar"><button class="cx-newpoll" data-cxnewpoll>＋ Nouveau sondage</button></div>' : ''}
      ${canWrite() && mode === 'chat' ? `<div class="cx-emo" id="cxEmo" hidden>${EMOJI.map(e => `<button data-cxemo="${e}">${e}</button>`).join('')}</div>
      ${editing ? `<div class="cx-replybar cx-editbar"><span>✏️ <b>Modification</b> de ton message</span><button type="button" data-cxeditno aria-label="Annuler la modification">✕</button></div>` : ''}
      ${replyTo ? `<div class="cx-replybar"><span>↩️ Réponse à <b>${esc(String(replyTo.name).replace(/^Coach\s+/, ''))}</b> : ${esc(replyTo.body || '')}</span><button type="button" data-cxreplyno aria-label="Ne plus répondre">✕</button></div>` : ''}
      <div class="cx-ment" id="cxMent" hidden></div>
      <form class="cx-bar" id="cxForm"><button type="button" class="cx-ic" data-cxemotoggle aria-label="Émojis">😊</button>${o.poll ? '<button type="button" class="cx-ic" data-cxnewpoll aria-label="Nouveau sondage">📊</button>' : ''}${o.photo && (view.mod || view.photos) ? '<button type="button" class="cx-ic" data-cxphoto aria-label="Envoyer une photo">📷</button><input type="file" accept="image/*" id="cxFile" hidden>' : ''}
        <textarea id="cxText" rows="1" maxlength="500" placeholder="Message" aria-label="Message" enterkeyhint="send">${esc(draft)}</textarea>
        <button type="submit" class="cx-ic cx-send" id="cxSend" aria-label="Envoyer" ${draft.trim() ? '' : 'disabled'}>➤</button></form>
      ${o.note ? `<div class="cx-note">${esc(o.note)}</div>` : ''}` : ''}
      ${sheetHtml()}
    </div>`;
  }
  const nearBottom = () => { const l = $('#cxList'); return !l || l.scrollHeight - l.scrollTop - l.clientHeight < 90; };
  const toBottom = smooth => { const l = $('#cxList'); if (l) l.scrollTo({ top: l.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }); const n = $('#cxNew'); if (n) n.hidden = true; };
  // the whole chat (first time, another category, the page redrawn)
  function drawAll() {
    if (!box) return;
    const l0 = $('#cxList'), keep = l0 && !nearBottom() ? l0.scrollTop : null, focus = document.activeElement && document.activeElement.id === 'cxText';
    animate = false; box.innerHTML = shell(); animate = true; fit(); grow(); loadImgs();
    const l = $('#cxList'); if (l) l.scrollTop = keep == null ? l.scrollHeight : keep;
    if (focus) { const t = $('#cxText'); if (t) { t.focus({ preventScroll: true }); t.setSelectionRange(t.value.length, t.value.length); } }
  }
  // only the list, the bar stays as it is (the keyboard stays open, nothing blinks)
  function drawList(stick) {
    const l = $('#cxList'); if (!l) return drawAll();
    const was = nearBottom(), top = l.scrollTop;
    l.innerHTML = listHtml(); loadImgs();
    if (armed != null && mode === 'chat') openMenu(armed, false);
    if (mode === 'polls') { l.scrollTop = top; return; }
    if (stick || was) l.scrollTop = l.scrollHeight; else { l.scrollTop = top; const n = $('#cxNew'); if (n) n.hidden = false; }
  }
  const sameTop = r => { const t = $('.cx-top b'), m = $('.cx-mod'), off = $('.cx-off'); return t && !!off === !!r.off && (!m || m.dataset.cxoff === (r.off ? '0' : '1')); };

  /* ---------- the size: the chat fills the screen, above the tab bar and the keyboard ---------- */
  function shown() { return !!(box && document.body.contains(box) && box.offsetParent !== null); }
  let sTop = -1;
  function safeTop() { if (sTop < 0) { const d = document.createElement('div'); d.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:0;padding-top:env(safe-area-inset-top);visibility:hidden;pointer-events:none'; document.body.appendChild(d); sTop = d.offsetHeight; d.remove(); } return sTop; }
  function fit() {
    const cx = $('#cx') || (box && box.firstElementChild); if (!cx || !shown()) return;
    if (!document.body.classList.contains('chat-on')) { if (cx.dataset.fit) { cx.style.cssText = ''; cx.dataset.fit = ''; } return; }
    const vv = window.visualViewport, vh = window.innerHeight, vvH = vv ? vv.height : vh, vvTop = vv ? vv.offsetTop : 0;
    const keyboard = vh - vvH - vvTop > 80 || document.body.classList.contains('chat-kb');
    // (2.37) on a phone the chat takes the whole screen, edge to edge, down to the tab bar (no floating card)
    const full = window.innerWidth <= 760, pad = full ? 0 : 6;
    document.body.classList.toggle('chat-full', full);
    let bottom = full ? 0 : 8;
    if (keyboard) bottom = Math.max(full ? 0 : 4, vh - (vvH + vvTop) + (full ? 0 : 4));
    else document.querySelectorAll('.tabbar, .rail').forEach(b => { const r = b.getBoundingClientRect(); if (r.height && r.top > vh / 2) bottom = Math.max(bottom, vh - r.top + pad); });
    // on a phone, the chat starts at the very top when nothing is above it (players, parents), under what stays above it otherwise (the category of the coach)
    const r = box.getBoundingClientRect(), edge = full && r.top <= safeTop() + 14, top = (full ? (edge ? 0 : Math.max(0, r.top - 4)) : Math.max(8, r.top)) + vvTop;
    document.body.classList.toggle('chat-edge', edge);
    const css = full ? `left:0;width:100%;top:${Math.round(top)}px;bottom:${Math.round(bottom)}px;height:auto`
      : `left:${Math.round(r.left)}px;width:${Math.round(r.width)}px;top:${Math.round(top)}px;bottom:${Math.round(bottom)}px;height:auto`;
    if (cx.dataset.fit !== css) { cx.style.cssText = css; cx.dataset.fit = css; }
  }
  function setOn(on) {
    if (on === document.body.classList.contains('chat-on')) return;
    document.body.classList.toggle('chat-on', on); if (!on) document.body.classList.remove('chat-kb', 'chat-full', 'chat-edge');
    if (on) { window.scrollTo(0, 0); requestAnimationFrame(() => { fit(); toBottom(); }); }
    else { const cx = box && box.firstElementChild; if (cx) { cx.style.cssText = ''; cx.dataset.fit = ''; } }
  }
  function grow() { const t = $('#cxText'); if (!t) return; t.style.height = 'auto'; t.style.height = Math.min(120, t.scrollHeight + 2) + 'px'; }
  window.addEventListener('resize', () => { if (shown()) { fit(); if (nearBottom()) toBottom(); } });
  if (window.visualViewport) ['resize', 'scroll'].forEach(ev => window.visualViewport.addEventListener(ev, () => { if (shown()) { const b = nearBottom(); fit(); if (b) toBottom(); } }));
  // (2.35) iPhone: once the keyboard is closed, iOS can leave the screen lifted (the tab bar no longer at the bottom, a light strip under it).
  // The page is put back in place when the keyboard goes: at the top for the chat (it does not scroll), a 1-pixel nudge elsewhere (the reading place stays)
  let liftT = 0;
  const typing = () => { const a = document.activeElement; return !!a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable); };
  function unlift() {
    clearTimeout(liftT);
    liftT = setTimeout(() => {
      if (typing()) return;
      if (document.body.classList.contains('chat-on')) { window.scrollTo(0, 0); fit(); return; }
      const y = window.scrollY; window.scrollTo(0, y + 1); requestAnimationFrame(() => window.scrollTo(0, y));
    }, 350);
  }
  document.addEventListener('focusout', e => { if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) unlift(); }, true);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', () => { if (!typing()) unlift(); });

  /* ---------- unread messages: a badge on the « Chat » tab ---------- */
  const SEEN = () => 'chat-seen-' + (o ? o.key : '') + '-' + cat;
  const seen = () => { try { return +localStorage.getItem(SEEN()) || 0; } catch (e) { return 0; } };
  const markSeen = () => { const id = lastId(); if (id) try { localStorage.setItem(SEEN(), id); } catch (e) {} badge(0); };
  function badge(n) {
    document.querySelectorAll('.tabbar [data-tab="chat"]').forEach(t => { let b = t.querySelector('.cx-badge'); if (!n) { if (b) b.remove(); return; } if (!b) { b = document.createElement('span'); b.className = 'cx-badge'; t.appendChild(b); } b.textContent = n > 9 ? '9+' : n; });
  }
  const unread = () => ((view && view.msgs) || []).filter(m => !m.mine && !m.deleted && m.id > seen()).length;

  /* ---------- the server ---------- */
  const local = m => typeof m.id !== 'number'; // shown at once, not yet back from the server
  const lastId = () => { const ms = ((view && view.msgs) || []).filter(m => !local(m)); return ms.length ? ms[ms.length - 1].id : 0; };
  // (2.47) the messages changed by their author: the new text and « modifié »
  function edits(r) {
    let ch = false; const by = new Map((r.edits || []).map(x => [x.id, x]));
    if (by.size) view.msgs.forEach(m => { const x = by.get(m.id); if (x && !m.deleted && (m.body !== x.body || !m.edited) && !(editing && editing.id === m.id)) { m.body = x.body; m.edited = true; ch = true; } });
    return ch;
  }
  async function load(full) {
    if (!o || busy) return; busy = true; lastPoll = Date.now(); const asked = cat;
    try {
      const r = await o.load(cat || null, full || !view ? 0 : lastId());
      if (!r || asked !== cat) { if (asked !== cat) lastPoll = 0; return; } // (2.01) another category was chosen meanwhile
      if (full || !view || r.cat !== view.cat) { view = r; cat = r.cat || cat; edits(r); drawAll(); }
      else {
        const gone = new Set(r.gone || []), had = new Set(view.msgs.map(m => m.id)); let changed = false;
        if (edits(r)) changed = true;
        view.msgs.forEach(m => { if (gone.has(m.id) && !m.deleted) { m.deleted = true; m.body = null; changed = true; } });
        const fresh = (r.msgs || []).filter(m => !had.has(m.id));
        const topSame = sameTop(r) && openPolls() === (r.polls || []).filter(p => !p.closed).length;
        if (JSON.stringify(r.polls || []) !== JSON.stringify(view.polls || []) || JSON.stringify(r.reacts || {}) !== JSON.stringify(view.reacts || {}) || JSON.stringify(r.reports || {}) !== JSON.stringify(view.reports || {})) changed = true;
        if (r.muted !== view.muted || r.photos !== view.photos || JSON.stringify(r.pin || null) !== JSON.stringify(view.pin || null)) setTimeout(drawAll, 0);
        Object.assign(view, { off: r.off, filtered: r.filtered, mod: r.mod, cats: r.cats || view.cats, polls: r.polls || [], reacts: r.reacts || {}, reports: r.reports || {}, muted: r.muted, photos: r.photos, pin: r.pin || null, kings: r.kings || [] });
        if (fresh.length) {
          // my messages back from the server: their copy replaces the ones shown at once
          let mine = fresh.filter(m => m.mine).length;
          fresh.filter(m => m.mine && m.img).forEach(f => { const l = view.msgs.find(x => local(x) && x.local && x.ok); if (l) imgs.set(f.id, l.local); });
          const locals = view.msgs.filter(m => local(m) && !(m.ok && mine-- > 0));
          view.msgs = view.msgs.filter(m => !local(m)).concat(fresh, locals).slice(-250); changed = true;
        }
        if (!topSame && !sheet) drawAll(); else if (changed) drawList(fresh.some(m => m.mine));
      }
      if (shown() && document.visibilityState === 'visible' && nearBottom()) markSeen(); else badge(unread());
    } catch (e) { if (!view) { view = { cat: '', msgs: [] }; if (box) box.innerHTML = `<div class="cx"><div class="cx-list"><div class="cx-empty"><div class="e">😕</div>${esc(nice(e))}</div></div></div>`; } }
    finally { busy = false; }
  }
  // every 3 seconds while the chat is on screen, every 15 seconds behind another tab (for the badge)
  function tick() {
    if (!box || !document.body.contains(box)) { clearInterval(timer); timer = null; box = null; setOn(false); return; }
    const on = shown(); setOn(on);
    if (on && !wasShown) { fit(); toBottom(); markSeen(); } else if (on) fit();
    wasShown = on;
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - lastPoll >= (on ? FAST : SLOW) - 200) load(false);
  }
  // sent at once on the screen, then to the server one after the other
  function send(text) {
    const b = String(text || '').trim(); if (!b || !canWrite()) return;
    if (editing) return saveEdit(b);
    const m = { id: 'p' + (++pend), at: new Date().toISOString(), name: 'moi', kind: o.kind || 'player', mine: true, body: b, pend: true, reply: replyTo };
    if (replyTo) { replyTo = null; const rb = box.querySelector('.cx-replybar'); if (rb) rb.remove(); }
    view.msgs.push(m); draft = ''; const t = $('#cxText'); if (t && t.value.trim() === b) { t.value = ''; grow(); } { const mp = $('#cxMent'); if (mp && !mp.hidden) { mp.hidden = true; ment = null; fit(); } }
    const s = $('#cxSend'); if (s) s.disabled = true;
    drawList(true);
    queue = queue.then(() => post(m));
  }
  // (2.47) my message changed: at once on the screen, then on the server (back as it was if refused)
  async function saveEdit(b) {
    const ed = editing, m = view.msgs.find(x => x.id === ed.id); editing = null; draft = '';
    if (!m || b === ed.body) return drawAll();
    const old = m.body; m.body = b; m.edited = true; drawAll();
    try { await o.edit(view.cat, m.id, b); (o.toast || (() => {}))('✏️ Message modifié'); }
    catch (e) { m.body = old; if (!ed.was) m.edited = false; drawAll(); (o.toast || alert)(nice(e), true); }
  }
  async function post(m, again) {
    try {
      await o.post(view.cat, m.body, m.reply ? m.reply.id : null); m.ok = true;
      for (let i = 0; i < 10 && busy; i++) await new Promise(r => setTimeout(r, 150));
      lastPoll = 0; await load(false);
    }
    catch (e) {
      if (/TROP_VITE/.test((e.code || '') + e.message) && !again) { await new Promise(r => setTimeout(r, 1100)); return post(m, true); }
      m.pend = false; m.fail = true; drawList(false);
      if (/MOT_INTERDIT/.test((e.code || '') + e.message)) { view.msgs = view.msgs.filter(x => x !== m); draft = m.body; drawAll(); }
      (o.toast || alert)(nice(e), true);
    }
  }

  function closeMenu() { if (box) box.querySelectorAll('.cx-menu').forEach(x => x.remove()); }
  function openMenu(id, scroll) {
    closeMenu(); const m = view && view.msgs.find(x => x.id === id), row = m && box.querySelector(`.cx-row[data-cx="${id}"]`); if (!row) { armed = null; return; }
    const after = row.nextElementSibling && row.nextElementSibling.classList.contains('cx-rxs') ? row.nextElementSibling : row;
    after.insertAdjacentHTML('afterend', menuHtml(m));
    if (scroll) { const mn = box.querySelector('.cx-menu'); if (mn && mn.scrollIntoView) mn.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  }
  async function react(id, e) {
    const l = (view.reacts = view.reacts || {})[id] = (view.reacts[id] || []).map(r => Object.assign({}, r)); let r = l.find(x => x.e === e);
    if (r && r.me) { r.n--; r.me = false; if (!r.n) l.splice(l.indexOf(r), 1); } else if (r) { r.n++; r.me = true; } else l.push({ e, n: 1, me: true, who: ['Moi'] });
    if (!l.length) delete view.reacts[id];
    drawList(false);
    try { await o.react(view.cat, id, e); } catch (err) { (o.toast || alert)(nice(err), true); lastPoll = 0; load(true); }
  }
  // a vote shows at once, then the server's count
  async function vote(id, i) {
    const p = pollOf(id); if (!p || p.closed) return;
    const x = p.opts[i], was = x.me;
    if (!p.multi && !was) p.opts.forEach(y => { if (y.me) { y.me = false; y.n--; } });
    x.me = !was; x.n += was ? -1 : 1; drawList(false);
    try { view.polls = await o.vote(view.cat, id, i); drawList(false); } catch (err) { (o.toast || alert)(nice(err), true); lastPoll = 0; load(true); }
  }
  let creating = false;
  async function createPoll() {
    if (creating) return; // (2.01) one tap = one poll
    const q = String(sheet.q || '').trim(), opts = sheet.opts.map(x => String(x || '').trim()).filter(Boolean);
    if (!q) return (o.toast || alert)('Écris ta question.', true);
    if (opts.length < 2) return (o.toast || alert)('Il faut au moins 2 réponses.', true);
    creating = true; const sb = box.querySelector('#cxPollForm [type=submit]'); if (sb) { sb.disabled = true; sb.textContent = 'Envoi…'; }
    try { await o.poll(view.cat, q, opts, !!sheet.multi); sheet = null; mode = 'chat'; drawAll(); lastPoll = 0; await load(false); toBottom(); (o.toast || (() => {}))('📊 Sondage envoyé à la catégorie !'); }
    catch (err) { (o.toast || alert)(nice(err), true); if (sb && document.contains(sb)) { sb.disabled = false; sb.textContent = 'Créer le sondage'; } }
    finally { creating = false; }
  }
  /* ---------- the hands ---------- */
  function bind(el) {
    if (el.dataset.cxBound) return; el.dataset.cxBound = 1;
    el.addEventListener('submit', e => { if (e.target.id === 'cxPollForm') { e.preventDefault(); createPoll(); return; } if (e.target.id === 'cxForm') { e.preventDefault(); const t = $('#cxText'); send(t && t.value); if (t) t.focus({ preventScroll: true }); } });
    el.addEventListener('input', e => {
      if (sheet) { if (e.target.id === 'cxPq') sheet.q = e.target.value; if (e.target.dataset.cxopt) sheet.opts[+e.target.dataset.cxopt] = e.target.value; if (e.target.id === 'cxPmulti') sheet.multi = e.target.checked; }
    });
    el.addEventListener('change', e => { if (sheet && e.target.id === 'cxPmulti') sheet.multi = e.target.checked; if (e.target.id === 'cxFile' && e.target.files && e.target.files[0]) { sendPhoto(e.target.files[0]); e.target.value = ''; } });
    el.addEventListener('input', e => { if (e.target.id !== 'cxText') return; draft = e.target.value; grow(); const s = $('#cxSend'); if (s) s.disabled = !draft.trim(); mentionAsk(e.target); });
    // a touch on a name: the keyboard stays open
    el.addEventListener('pointerdown', e => { if (e.target.closest('[data-cxment]')) e.preventDefault(); });
    el.addEventListener('mousedown', e => { if (e.target.closest('[data-cxment]')) e.preventDefault(); });
    // (2.34) typing: no tab bar, the chat placed once the keyboard is up (not at each step of its animation)
    let kbT = 0;
    const kb = on => { clearTimeout(kbT); kbT = setTimeout(() => { document.body.classList.toggle('chat-kb', on); window.scrollTo(0, 0); fit(); toBottom(); }, on ? 0 : 120); };
    el.addEventListener('focusin', e => { if (e.target.id === 'cxText') { kb(true); setTimeout(() => { fit(); toBottom(); }, 300); } });
    el.addEventListener('focusout', e => { if (e.target.id === 'cxText') kb(false); });
    el.addEventListener('keydown', e => { if (e.target.id === 'cxText' && e.key === 'Enter' && ment) { const f = box.querySelector('#cxMent:not([hidden]) [data-cxment]'); if (f) { e.preventDefault(); mentionPick(f.dataset.cxment); return; } }
      if (e.target.id === 'cxText' && e.key === 'Enter' && !e.shiftKey && matchMedia('(pointer:fine)').matches) { e.preventDefault(); send(e.target.value); } });
    el.addEventListener('scroll', e => { if (e.target.id === 'cxList' && nearBottom()) { const n = $('#cxNew'); if (n) n.hidden = true; markSeen(); } }, true);
    el.addEventListener('click', async e => {
      const q = s => e.target.closest(s);
      if (q('#cxNew')) return toBottom(true);
      const mn = q('[data-cxment]'); if (mn) return mentionPick(mn.dataset.cxment);
      const md = q('[data-cxmode]'); if (md) { mode = md.dataset.cxmode; drawAll(); if (mode === 'chat') toBottom(); else { const l = $('#cxList'); if (l) l.scrollTop = 0; } return; }
      if (q('[data-cxnewpoll]')) { sheet = { q: '', opts: ['', ''], multi: false }; drawAll(); const i = $('#cxPq'); if (i) i.focus(); return; }
      if (q('[data-cxsheetno]') || e.target.id === 'cxSheet') { sheet = null; drawAll(); return; }
      if (q('[data-cxaddopt]')) { if (sheet.opts.length < 6) sheet.opts.push(''); drawAll(); const i = box.querySelector(`[data-cxopt="${sheet.opts.length - 1}"]`); if (i) i.focus(); return; }
      const vt = q('[data-cxvote]'); if (vt) { const [id, i] = vt.dataset.cxvote.split(':').map(Number); return vote(id, i); }
      const wh = q('[data-cxwho]'); if (wh) { const id = +wh.dataset.cxwho; whoOpen.has(id) ? whoOpen.delete(id) : whoOpen.add(id); drawList(false); return; }
      const cl = q('[data-cxclose]'); if (cl) { const [id, c] = cl.dataset.cxclose.split(':').map(Number);
        try { view.polls = await o.pollClose(view.cat, id, !!c); drawAll(); } catch (err) { (o.toast || alert)(nice(err), true); } return; }
      if (q('.cx-poll')) return; // a touch inside a poll: not the delete menu
      if (q('[data-cxemotoggle]')) { const p = $('#cxEmo'); if (p) p.hidden = !p.hidden; fit(); return; }
      const em = q('[data-cxemo]');
      if (em) { const t = $('#cxText'); if (!t) return; const a = t.selectionStart ?? t.value.length, b = t.selectionEnd ?? a; t.value = t.value.slice(0, a) + em.dataset.cxemo + t.value.slice(b); draft = t.value; t.selectionStart = t.selectionEnd = a + em.dataset.cxemo.length; grow(); const s = $('#cxSend'); if (s) s.disabled = false; return; }
      const hi = q('[data-cxsay]'); if (hi) return send(hi.dataset.cxsay);
      const rt = q('[data-cxretry]'); if (rt) { const m = view.msgs.find(x => String(x.id) === rt.dataset.cxretry); if (m) { m.fail = false; m.pend = true; drawList(true); queue = queue.then(() => post(m)); } return; }
      const c = q('[data-cxcat]'); if (c) { cat = c.dataset.cxcat; view = null; drawAll(); for (let i = 0; i < 20 && busy; i++) await new Promise(r => setTimeout(r, 100)); return load(true); }
      const f = q('[data-cxoff]');
      if (f && o.off) { const off = f.dataset.cxoff === '1'; try { await o.off(off); view.off = off; drawAll(); (o.toast || (() => {}))(parRoom() ? (off ? '🔇 Parents en sourdine : ils lisent, seuls les coachs écrivent.' : '🔊 Les parents peuvent de nouveau écrire.') : off ? '🔒 Chat fermé : les joueurs peuvent lire, plus écrire.' : '🔓 Chat rouvert.'); } catch (err) { (o.toast || alert)(nice(err), true); } return; }
      // (2.03) a reaction (in the menu or a chip under a bubble): shown at once
      if (q('[data-cxphoto]')) { const f = $('#cxFile'); if (f) f.click(); return; }
      const im = q('[data-cximg]'); if (im && !q('.cx-menu')) { const i = im.querySelector('img'); if (i) { const m = view.msgs.find(x => String(x.id) === im.dataset.cximg); viewPhoto(i.src, m && m.body); } return; }
      const pn = q('[data-cxpin]'); if (pn && o.pin) { const id = +pn.dataset.cxpin || null; armed = null; closeMenu();
        try { await o.pin(view.cat, id); view.pin = id ? (() => { const m = view.msgs.find(x => x.id === id); return m ? { id, name: m.name, body: (m.body || '').slice(0, 140), img: !!m.img } : null; })() : null; drawAll();
          (o.toast || (() => {}))(id ? '📌 Épinglé en haut du chat.' : 'Message désépinglé.'); } catch (err) { (o.toast || alert)(nice(err), true); } return; }
      const ph = q('[data-cxphotos]'); if (ph && o.photosOk) { const on = ph.dataset.cxphotos === '1';
        try { await o.photosOk(on); view.photos = on; drawAll(); (o.toast || (() => {}))(on ? '📷 Les joueurs peuvent envoyer des photos.' : '📷 Photos réservées aux coachs.'); } catch (err) { (o.toast || alert)(nice(err), true); } return; }
      const rx = q('[data-cxrx]'); if (rx && o.react) { const [id, e2] = rx.dataset.cxrx.split(':'); armed = null; sure = null; closeMenu(); return react(+id, e2); }
      const gt = q('[data-cxgoto]'); if (gt) { const r = el.querySelector(`.cx-row[data-cx="${gt.dataset.cxgoto}"]`); if (r) { r.scrollIntoView({ block: 'center', behavior: 'smooth' }); r.classList.add('flash'); setTimeout(() => r.classList.remove('flash'), 1400); } return; }
      const rp = q('[data-cxreply]'); if (rp) { const m = view.msgs.find(x => String(x.id) === rp.dataset.cxreply); if (m) { replyTo = { id: m.id, name: m.mine ? 'toi' : m.name, body: (m.body || '').slice(0, 90) }; armed = null; drawAll(); const t = $('#cxText'); if (t) t.focus(); } return; }
      if (q('[data-cxreplyno]')) { replyTo = null; drawAll(); return; }
      const rr = q('[data-cxreport]');
      if (rr) { const id = +rr.dataset.cxreport; if (sure !== id) { sure = id; openMenu(id, true); return; }
        sure = null; armed = null; closeMenu();
        try { await o.report(view.cat, id); (o.toast || (() => {}))('🚩 Merci, les coachs sont prévenus.'); } catch (err) { (o.toast || alert)(nice(err), true); } return; }
      const mu = q('[data-cxmute]'); if (mu && o.mute) { const on = mu.dataset.cxmute === '1';
        try { await o.mute(on); view.muted = on; drawAll(); (o.toast || (() => {}))(on ? '🔕 Plus de notifications du chat sur tes téléphones.' : '🔔 Les notifications du chat sont remises.'); } catch (err) { (o.toast || alert)(nice(err), true); } return; }
      const ed = q('[data-cxedit]'); if (ed) { const m = view.msgs.find(x => String(x.id) === ed.dataset.cxedit); armed = null; closeMenu(); if (!m) return;
        editing = { id: m.id, body: m.body || '', was: !!m.edited }; replyTo = null; draft = m.body || ''; drawAll(); const t = $('#cxText'); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); grow(); } return; }
      if (q('[data-cxeditno]')) { editing = null; draft = ''; drawAll(); return; }
      const yes = q('[data-cxdel]');
      if (yes) { const id = +yes.dataset.cxdel; armed = null; closeMenu();
        try { await o.del(view.cat, id); const m = view.msgs.find(x => x.id === id); if (m) { m.deleted = true; m.body = null; } drawList(false); } catch (err) { (o.toast || alert)(nice(err), true); } return; }
      if (q('[data-cxno]')) { armed = null; sure = null; closeMenu(); return; }
      // touch a bubble: its actions (again: closed)
      const row = q('.cx-row');
      if (row && !q('a')) { const m = view.msgs.find(x => String(x.id) === row.dataset.cx);
        if (!m || m.deleted || m.pend || m.fail || armed === m.id) { armed = null; sure = null; closeMenu(); return; }
        armed = m.id; sure = null; openMenu(m.id, true); }
    });
  }
  /* el: the box; opts: { key (who / which team: a new key = a new chat), kind ('player' | 'coach'), note, load(cat, after), post(cat, body), del(cat, id), off(bool) (coaches),
     poll(cat, q, opts, multi), vote(cat, id, opt), pollClose(cat, id, closed) (1.99), react(cat, id, emoji), report(cat, id), mute(on) (2.03),
     photo(cat, dataUrl, caption), img(cat, id), pin(cat, id|null), photosOk(on) (2.04), toast(msg, err) } */
  function mount(el, opts) {
    if (!el) return; css();
    if (!o || o.key !== opts.key) { view = null; cat = ''; draft = ''; mode = 'chat'; sheet = null; whoOpen.clear(); replyTo = null; armed = null; sure = null; editing = null; }
    const old = box && box !== el && view && o && o.key === opts.key && box.firstElementChild;
    o = opts; bind(el);
    if (old) { const l = old.querySelector('#cxList'), top = l ? l.scrollTop : 0, f = document.activeElement; el.innerHTML = ''; el.appendChild(old); box = el;
      if (l) l.scrollTop = top; if (f && old.contains(f)) f.focus({ preventScroll: true }); fit(); }
    else { box = el; wasShown = false; drawAll(); }
    if (!view) load(true); else if (Date.now() - lastPoll > FAST) load(false);
    if (!timer) timer = setInterval(tick, 500);
    tick();
  }
  return { mount, nice };
})();
