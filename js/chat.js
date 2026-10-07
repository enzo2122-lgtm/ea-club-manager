/* Chat (1.96 → 1.98): the chat of a category, between the players of the category (teams A and B together) and their coaches.
   Club server: member_chat* for the players' and parents' pages (personal code), club_chat* for the coaches' app (they moderate:
   delete any message, close the chat). Vulgar or insulting words are refused by the server in every category but Seniors and Vétérans.
   (1.98) like a messaging app: the chat takes the whole screen (the page header goes away), messages appear at once when sent,
   new ones every 3 seconds without redrawing, bubbles grouped by person with initials, emojis, « new messages » button. */
const Chat = (() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ERR = [[/MOT_INTERDIT/, 'Pas envoyé : un mot grossier ou insultant n\'est pas accepté ici. Reformule gentiment 🙂'],
    [/TROP_VITE/, 'Doucement : attends une seconde entre deux messages.'], [/CHAT_FERME/, 'Le chat est fermé pour l\'instant par les coachs.'],
    [/LIMITE_CHAT/, 'Beaucoup de messages aujourd\'hui : réessaie demain.'], [/SONDAGE_FINI/, 'Ce sondage est terminé.']];
  const nice = e => { const m = String((e && ((e.code || '') + ' ' + (e.message || ''))) || ''); const x = ERR.find(([r]) => r.test(m)); return x ? x[1] : (e && e.message) || 'Le serveur ne répond pas.'; };
  const EMOJI = ['👍', '⚽', '🔥', '💪', '😂', '👏', '🙏', '❤️', '😅', '🏆', '🥅', '✅'];
  const HELLO = ['Salut tout le monde 👋', 'Qui vient à l\'entraînement ? ⚽', 'On lâche rien ! 💪'];
  const FAST = 3000, SLOW = 15000, GROUP = 5 * 60e3;

  // one chat at a time: kept when the page is redrawn
  let box = null, o = null, view = null, cat = '', draft = '', timer = null, busy = false, lastPoll = 0, wasShown = false, pend = 0, queue = Promise.resolve(), armed = null;
  // (1.99) polls: the « Sondages » part, whose votes are shown, the new poll being written
  let mode = 'chat', sheet = null; const whoOpen = new Set(), drawn = new Set(); let animate = false;

  /* ---------- look ---------- */
  function css() {
    if (document.getElementById('chatCss')) return;
    const st = document.createElement('style'); st.id = 'chatCss';
    st.textContent = [
      // the whole screen for the chat: the page header and the player card go away while the chat is open
      'body.chat-on header.top,body.chat-on .card.who,body.chat-on .credit,body.chat-on .toast-bar{display:none!important}',
      'body.chat-on main{padding-top:calc(env(safe-area-inset-top) + 8px)!important;padding-bottom:0!important}',
      // (2.00) the chat is fixed on the screen, the page behind does not move (not even with the keyboard)
      'html:has(body.chat-on),body.chat-on{overflow:hidden;overscroll-behavior:none}body.chat-on .cx{position:fixed;z-index:7;min-height:0;margin:0}',
      'body.chat-on main#view .page-head{display:none}body.chat-on main#view{padding-top:calc(env(safe-area-inset-top) + 8px)}',
      '.cx{display:flex;flex-direction:column;min-height:320px;box-sizing:border-box;border-radius:18px;background:var(--surface,#fff);border:1px solid var(--line,#e3e5ea);overflow:hidden;position:relative}',
      '.cx-top{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--line,#e3e5ea);min-height:46px}',
      'body.tabs-top .cx-top,body.nav-top .cx-top{padding-right:118px}',
      '.cx-top b{font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cx-shield{font-size:12px;font-weight:700;color:#15803d;white-space:nowrap}',
      '.cx-top .cx-sp{flex:1}.cx-cats{display:flex;gap:4px}.cx-cats button,.cx-mod{border:1px solid var(--line,#d0d4dc);background:var(--surface,#fff);color:inherit;border-radius:999px;padding:3px 10px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer}',
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
      '.cx-act{display:flex;gap:6px;justify-content:flex-end;margin:2px 0 4px}.cx-act button{border:0;border-radius:999px;padding:5px 12px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;background:#dc2626;color:#fff}.cx-act button.no{background:var(--line,#e3e5ea);color:inherit}',
      '.cx-retry{font-size:12px;color:#dc2626;font-weight:700;text-align:right;margin:2px 4px 4px;cursor:pointer}',
      '.cx-empty{margin:auto;text-align:center;padding:20px 10px;color:var(--muted,#667)}.cx-empty .e{font-size:44px}.cx-hello{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:10px}',
      '.cx-hello button,.cx-emo button{border:1px solid var(--line,#d0d4dc);background:var(--surface,#fff);color:inherit;border-radius:999px;padding:6px 12px;font:inherit;font-size:14px;cursor:pointer}',
      '.cx-new{position:absolute;left:50%;transform:translateX(-50%);bottom:76px;border:0;border-radius:999px;padding:7px 14px;background:#8c1024;color:#fff;font:inherit;font-size:13px;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,.2);cursor:pointer;z-index:2}',
      '.cx-off{padding:6px 12px;font-size:13px;font-weight:700;background:color-mix(in srgb,#b7791f 18%,transparent);text-align:center}',
      '.cx-emo{display:flex;gap:4px;overflow-x:auto;padding:6px 10px 0;scrollbar-width:none}.cx-emo button{font-size:20px;padding:2px 8px;border:0;background:none}',
      '.cx-bar{display:flex;align-items:flex-end;gap:6px;padding:8px;border-top:1px solid var(--line,#e3e5ea);background:var(--surface,#fff)}',
      '.cx-bar textarea{flex:1;min-height:42px;max-height:120px;resize:none;padding:10px 14px;border-radius:21px;border:1px solid var(--line,#d0d4dc);background:var(--bg,#f2f3f7);color:inherit;font:inherit;font-size:16px;line-height:1.3;outline:none}',
      '.cx-ic{flex:none;width:42px;height:42px;border-radius:50%;border:0;display:flex;align-items:center;justify-content:center;font-size:20px;cursor:pointer;background:none;color:inherit}',
      '.cx-send{background:#8c1024;color:#fff;transition:transform .12s,opacity .12s}.cx-send:disabled{opacity:.35}.cx-send:not(:disabled):active{transform:scale(.9)}',
      '.cx-note{font-size:11.5px;color:var(--muted,#667);text-align:center;padding:0 10px 6px;background:var(--surface,#fff)}',
      '.tabbar .tab .cx-badge{position:absolute;top:2px;right:calc(50% - 22px);min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#e11d48;color:#fff;font:800 11px/18px system-ui,sans-serif}.tabbar .tab{position:relative}',
      '.cx-seg{display:flex;background:var(--bg,#f2f3f7);border-radius:999px;padding:2px;gap:2px}.cx-seg button{border:0;background:none;color:inherit;border-radius:999px;padding:5px 11px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap}.cx-seg button.on{background:var(--surface,#fff);box-shadow:0 1px 3px rgba(0,0,0,.12)}',
      '.cx-b.poll{min-width:min(78%,300px)}.cx-poll{display:flex;flex-direction:column;gap:5px;margin:2px 0 4px}.cx-pq{font-weight:800;font-size:15.5px;margin-bottom:2px}',
      '.cx-po{position:relative;overflow:hidden;display:flex;align-items:center;gap:8px;width:100%;min-height:38px;padding:6px 10px;border-radius:12px;border:1px solid color-mix(in srgb,currentColor 22%,transparent);background:color-mix(in srgb,currentColor 5%,transparent);color:inherit;font:inherit;font-size:14.5px;text-align:left;cursor:pointer}',
      '.cx-po:disabled{cursor:default}.cx-pf{position:absolute;left:0;top:0;bottom:0;background:color-mix(in srgb,currentColor 16%,transparent);transition:width .3s}.cx-po.me{border-color:currentColor;font-weight:700}.cx-po.win{font-weight:800}',
      '.cx-pt{position:relative;flex:1;min-width:0}.cx-pn{position:relative;font-weight:800;font-size:13px}.cx-pw{font-size:12px;opacity:.75;margin:-2px 4px 2px}',
      '.cx-pi{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:12px;opacity:.85}.cx-pi button{border:0;background:color-mix(in srgb,currentColor 10%,transparent);color:inherit;border-radius:999px;padding:3px 9px;font:inherit;font-size:12px;font-weight:700;cursor:pointer}',
      '.cx-pcard{background:var(--surface,#fff);border-radius:16px;padding:10px 12px;margin:4px 0 8px;box-shadow:0 1px 2px rgba(0,0,0,.08)}.cx-pby{font-size:12px;color:var(--muted,#667);margin-bottom:4px}',
      '.cx-newpoll{flex:1;min-height:44px;border:0;border-radius:22px;background:#8c1024;color:#fff;font:inherit;font-weight:700;cursor:pointer}',
      '.cx-sheet{position:absolute;inset:0;z-index:3;background:rgba(10,15,34,.45);display:flex;align-items:flex-end}.cx-sheet form{width:100%;max-height:100%;overflow-y:auto;background:var(--surface,#fff);border-radius:18px 18px 0 0;padding:14px;display:flex;flex-direction:column;gap:8px}',
      '.cx-sheet input[type=text]{min-height:42px;padding:8px 12px;border-radius:12px;border:1px solid var(--line,#d0d4dc);background:var(--bg,#f2f3f7);color:inherit;font:inherit;font-size:16px}',
      '.cx-sheet label{display:flex;align-items:center;gap:8px;font-size:14px}.cx-sh-b{display:flex;gap:8px;justify-content:flex-end}.cx-sh-b button,.cx-addopt{border:1px solid var(--line,#d0d4dc);background:var(--surface,#fff);color:inherit;border-radius:12px;padding:9px 14px;font:inherit;font-weight:700;cursor:pointer}.cx-sh-b button[type=submit]{background:#8c1024;color:#fff;border-color:#8c1024}',
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
  const linkify = s => esc(s).replace(/https?:\/\/[^\s<]+/g, u => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`).split('\n').join('<br>');
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
  /* ---------- the messages ---------- */
  // the key of a message for the grouping: same person, less than 5 minutes after the one before, same day
  function rowHtml(m, prev) {
    const first = !prev || prev.who !== (m.mine ? 'me' : m.name) || new Date(m.at) - new Date(prev.at) > GROUP || dayOf(prev.at) !== dayOf(m.at);
    const day = !prev || dayOf(prev.at) !== dayOf(m.at) ? `<div class="cx-day">${esc(dayOf(m.at))}</div>` : '';
    const big = !m.deleted && onlyEmoji(m.body);
    const body = m.deleted ? '<span class="cx-gone">🚫 Message supprimé</span>' : m.poll && pollOf(m.id) ? pollHtml(pollOf(m.id)) : linkify(m.body);
    const av = m.mine ? '' : `<span class="cx-av ${first ? '' : 'ghost'}" style="background:${color(m.name)}" aria-hidden="true">${esc(initials(m.name))}</span>`;
    const name = !m.mine && first ? `<span class="cx-name" style="color:${color(m.name)}">${esc(m.name.replace(/^Coach\s+/, ''))}${m.kind === 'coach' ? '<span class="cx-coach">COACH</span>' : ''}</span>` : '';
    const st = m.fail ? '⚠️' : m.ok ? '✓' : m.pend ? '🕓' : '';
    return `${day}<div class="cx-row ${m.mine ? 'mine' : ''} ${first ? 'first' : ''} ${m.kind === 'coach' ? 'coach' : ''}" data-cx="${m.id}">${av}
      <div class="cx-b ${animate && !drawn.has(m.id) ? 'cx-in' : ''} ${big ? 'big' : ''} ${m.poll && !m.deleted ? 'poll' : ''} ${m.pend ? 'pend' : ''} ${m.fail ? 'fail' : ''}">${name}${body}<span class="cx-t">${esc(time(m.at))}${st ? ' ' + st : ''}</span></div></div>
      ${m.fail ? `<div class="cx-retry" data-cxretry="${m.id}">Pas envoyé · toucher pour réessayer</div>` : ''}`;
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
  function shell() {
    if (!view) return '<div class="cx"><div class="cx-list"><div class="cx-empty"><div class="e">💬</div>Chargement du chat…</div></div></div>';
    if (!view.cat) return '<div class="cx"><div class="cx-list"><div class="cx-empty"><div class="e">💬</div>Pas de chat pour l\'instant : tu n\'es dans aucune équipe.</div></div></div>';
    const cats = view.cats || [];
    return `<div class="cx" id="cx">
      <div class="cx-top"><b>${esc(view.cat)}</b>${view.filtered ? '<span class="cx-shield" title="Les mots grossiers ou insultants sont bloqués">🛡️</span>' : ''}
        <span class="cx-seg"><button class="${mode === 'chat' ? 'on' : ''}" data-cxmode="chat">💬 Chat</button><button class="${mode === 'polls' ? 'on' : ''}" data-cxmode="polls">📊 Sondages${openPolls() ? ` (${openPolls()})` : ''}</button></span><span class="cx-sp"></span>
        ${cats.length > 1 ? `<span class="cx-cats">${cats.map(c => `<button class="${c === view.cat ? 'on' : ''}" data-cxcat="${esc(c)}">${esc(c)}</button>`).join('')}</span>` : ''}
        ${view.mod && o.off ? `<button class="cx-mod" data-cxoff="${view.off ? 0 : 1}">${view.off ? '🔓 Rouvrir' : '🔒 Fermer'}</button>` : ''}</div>
      ${view.off ? `<div class="cx-off">🔒 Chat fermé par les coachs${view.mod ? ' (toi, tu peux écrire)' : ''}</div>` : ''}
      <div class="cx-list" id="cxList">${listHtml()}</div>
      <button class="cx-new" id="cxNew" hidden>⬇ Nouveaux messages</button>
      ${canWrite() && mode === 'polls' && o.poll ? '<div class="cx-bar"><button class="cx-newpoll" data-cxnewpoll>＋ Nouveau sondage</button></div>' : ''}
      ${canWrite() && mode === 'chat' ? `<div class="cx-emo" id="cxEmo" hidden>${EMOJI.map(e => `<button data-cxemo="${e}">${e}</button>`).join('')}</div>
      <form class="cx-bar" id="cxForm"><button type="button" class="cx-ic" data-cxemotoggle aria-label="Émojis">😊</button>${o.poll ? '<button type="button" class="cx-ic" data-cxnewpoll aria-label="Nouveau sondage">📊</button>' : ''}
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
    animate = false; box.innerHTML = shell(); animate = true; fit(); grow();
    const l = $('#cxList'); if (l) l.scrollTop = keep == null ? l.scrollHeight : keep;
    if (focus) { const t = $('#cxText'); if (t) { t.focus({ preventScroll: true }); t.setSelectionRange(t.value.length, t.value.length); } }
  }
  // only the list, the bar stays as it is (the keyboard stays open, nothing blinks)
  function drawList(stick) {
    const l = $('#cxList'); if (!l) return drawAll();
    const was = nearBottom(), top = l.scrollTop;
    l.innerHTML = listHtml();
    if (mode === 'polls') { l.scrollTop = top; return; }
    if (stick || was) l.scrollTop = l.scrollHeight; else { l.scrollTop = top; const n = $('#cxNew'); if (n) n.hidden = false; }
  }
  const sameTop = r => { const t = $('.cx-top b'), m = $('.cx-mod'), off = $('.cx-off'); return t && !!off === !!r.off && (!m || m.dataset.cxoff === (r.off ? '0' : '1')); };

  /* ---------- the size: the chat fills the screen, above the tab bar and the keyboard ---------- */
  function shown() { return !!(box && document.body.contains(box) && box.offsetParent !== null); }
  function fit() {
    const cx = $('#cx') || (box && box.firstElementChild); if (!cx || !shown()) return;
    if (!document.body.classList.contains('chat-on')) { if (cx.dataset.fit) { cx.style.cssText = ''; cx.dataset.fit = ''; } return; }
    const vv = window.visualViewport, vh = window.innerHeight, vvH = vv ? vv.height : vh, vvTop = vv ? vv.offsetTop : 0;
    const keyboard = vh - vvH - vvTop > 80;
    let bottom = 8;
    if (keyboard) bottom = Math.max(4, vh - (vvH + vvTop) + 4);
    else document.querySelectorAll('.tabbar, .rail').forEach(b => { const r = b.getBoundingClientRect(); if (r.height && r.top > vh / 2) bottom = Math.max(bottom, vh - r.top + 6); });
    const r = box.getBoundingClientRect(), top = Math.max(8, r.top) + vvTop;
    const css = `left:${Math.round(r.left)}px;width:${Math.round(r.width)}px;top:${Math.round(top)}px;bottom:${Math.round(bottom)}px;height:auto`;
    if (cx.dataset.fit !== css) { cx.style.cssText = css; cx.dataset.fit = css; }
  }
  function setOn(on) {
    if (on === document.body.classList.contains('chat-on')) return;
    document.body.classList.toggle('chat-on', on);
    if (on) { window.scrollTo(0, 0); requestAnimationFrame(() => { fit(); toBottom(); }); }
    else { const cx = box && box.firstElementChild; if (cx) { cx.style.cssText = ''; cx.dataset.fit = ''; } }
  }
  function grow() { const t = $('#cxText'); if (!t) return; t.style.height = 'auto'; t.style.height = Math.min(120, t.scrollHeight + 2) + 'px'; }
  window.addEventListener('resize', () => { if (shown()) { fit(); if (nearBottom()) toBottom(); } });
  if (window.visualViewport) ['resize', 'scroll'].forEach(ev => window.visualViewport.addEventListener(ev, () => { if (shown()) { const b = nearBottom(); fit(); if (b) toBottom(); } }));

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
  async function load(full) {
    if (!o || busy) return; busy = true; lastPoll = Date.now();
    try {
      const r = await o.load(cat || null, full || !view ? 0 : lastId());
      if (!r) return;
      if (full || !view || r.cat !== view.cat) { view = r; cat = r.cat || cat; drawAll(); }
      else {
        const gone = new Set(r.gone || []), had = new Set(view.msgs.map(m => m.id)); let changed = false;
        view.msgs.forEach(m => { if (gone.has(m.id) && !m.deleted) { m.deleted = true; m.body = null; changed = true; } });
        const fresh = (r.msgs || []).filter(m => !had.has(m.id));
        const topSame = sameTop(r) && openPolls() === (r.polls || []).filter(p => !p.closed).length;
        if (JSON.stringify(r.polls || []) !== JSON.stringify(view.polls || [])) changed = true;
        Object.assign(view, { off: r.off, filtered: r.filtered, mod: r.mod, cats: r.cats || view.cats, polls: r.polls || [] });
        if (fresh.length) {
          // my messages back from the server: their copy replaces the ones shown at once
          let mine = fresh.filter(m => m.mine).length;
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
    const m = { id: 'p' + (++pend), at: new Date().toISOString(), name: 'moi', kind: o.kind || 'player', mine: true, body: b, pend: true };
    view.msgs.push(m); draft = ''; const t = $('#cxText'); if (t && t.value.trim() === b) { t.value = ''; grow(); }
    const s = $('#cxSend'); if (s) s.disabled = true;
    drawList(true);
    queue = queue.then(() => post(m));
  }
  async function post(m, again) {
    try {
      await o.post(view.cat, m.body); m.ok = true;
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

  // a vote shows at once, then the server's count
  async function vote(id, i) {
    const p = pollOf(id); if (!p || p.closed) return;
    const x = p.opts[i], was = x.me;
    if (!p.multi && !was) p.opts.forEach(y => { if (y.me) { y.me = false; y.n--; } });
    x.me = !was; x.n += was ? -1 : 1; drawList(false);
    try { view.polls = await o.vote(view.cat, id, i); drawList(false); } catch (err) { (o.toast || alert)(nice(err), true); lastPoll = 0; load(true); }
  }
  async function createPoll() {
    const q = String(sheet.q || '').trim(), opts = sheet.opts.map(x => String(x || '').trim()).filter(Boolean);
    if (!q) return (o.toast || alert)('Écris ta question.', true);
    if (opts.length < 2) return (o.toast || alert)('Il faut au moins 2 réponses.', true);
    try { await o.poll(view.cat, q, opts, !!sheet.multi); sheet = null; mode = 'chat'; drawAll(); lastPoll = 0; await load(false); toBottom(); (o.toast || (() => {}))('📊 Sondage envoyé à la catégorie !'); }
    catch (err) { (o.toast || alert)(nice(err), true); }
  }
  /* ---------- the hands ---------- */
  function bind(el) {
    if (el.dataset.cxBound) return; el.dataset.cxBound = 1;
    el.addEventListener('submit', e => { if (e.target.id === 'cxPollForm') { e.preventDefault(); createPoll(); return; } if (e.target.id === 'cxForm') { e.preventDefault(); const t = $('#cxText'); send(t && t.value); if (t) t.focus({ preventScroll: true }); } });
    el.addEventListener('input', e => {
      if (sheet) { if (e.target.id === 'cxPq') sheet.q = e.target.value; if (e.target.dataset.cxopt) sheet.opts[+e.target.dataset.cxopt] = e.target.value; if (e.target.id === 'cxPmulti') sheet.multi = e.target.checked; }
    });
    el.addEventListener('change', e => { if (sheet && e.target.id === 'cxPmulti') sheet.multi = e.target.checked; });
    el.addEventListener('input', e => { if (e.target.id !== 'cxText') return; draft = e.target.value; grow(); const s = $('#cxSend'); if (s) s.disabled = !draft.trim(); });
    el.addEventListener('focusin', e => { if (e.target.id === 'cxText') setTimeout(() => { fit(); toBottom(); }, 250); });
    el.addEventListener('keydown', e => { if (e.target.id === 'cxText' && e.key === 'Enter' && !e.shiftKey && matchMedia('(pointer:fine)').matches) { e.preventDefault(); send(e.target.value); } });
    el.addEventListener('scroll', e => { if (e.target.id === 'cxList' && nearBottom()) { const n = $('#cxNew'); if (n) n.hidden = true; markSeen(); } }, true);
    el.addEventListener('click', async e => {
      const q = s => e.target.closest(s);
      if (q('#cxNew')) return toBottom(true);
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
      const c = q('[data-cxcat]'); if (c) { cat = c.dataset.cxcat; view = null; drawAll(); return load(true); }
      const f = q('[data-cxoff]');
      if (f && o.off) { const off = f.dataset.cxoff === '1'; try { await o.off(off); view.off = off; drawAll(); (o.toast || (() => {}))(off ? '🔒 Chat fermé : les joueurs peuvent lire, plus écrire.' : '🔓 Chat rouvert.'); } catch (err) { (o.toast || alert)(nice(err), true); } return; }
      // delete: touch the bubble (mine, or any for a coach), then « Supprimer »
      const yes = q('[data-cxdel]');
      if (yes) { const id = +yes.dataset.cxdel; armed = null; yes.closest('.cx-act').remove();
        try { await o.del(view.cat, id); const m = view.msgs.find(x => x.id === id); if (m) { m.deleted = true; m.body = null; } drawList(false); } catch (err) { (o.toast || alert)(nice(err), true); } return; }
      if (q('[data-cxno]')) { armed = null; q('.cx-act').remove(); return; }
      const row = q('.cx-row');
      if (row && !q('a')) { const m = view.msgs.find(x => String(x.id) === row.dataset.cx); el.querySelectorAll('.cx-act').forEach(a => a.remove());
        if (!m || m.deleted || m.pend || m.fail || !(m.mine || view.mod) || armed === m.id) { armed = null; return; }
        armed = m.id; row.insertAdjacentHTML('afterend', `<div class="cx-act"><button class="no" data-cxno>Annuler</button><button data-cxdel="${m.id}">🗑️ Supprimer</button></div>`); }
    });
  }
  /* el: the box; opts: { key (who / which team: a new key = a new chat), kind ('player' | 'coach'), note, load(cat, after), post(cat, body), del(cat, id), off(bool) (coaches),
     poll(cat, q, opts, multi), vote(cat, id, opt), pollClose(cat, id, closed) (1.99), toast(msg, err) } */
  function mount(el, opts) {
    if (!el) return; css();
    if (!o || o.key !== opts.key) { view = null; cat = ''; draft = ''; mode = 'chat'; sheet = null; whoOpen.clear(); }
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
