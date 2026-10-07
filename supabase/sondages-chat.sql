-- Clubbo 1.99 : les sondages dans le chat de la catégorie. À coller une fois dans Supabase (SQL Editor → New query → coller → Run),
-- APRÈS chat-categorie.sql et notifs-chat.sql. Ne modifie aucune donnée existante.
-- Un joueur ou un coach pose une question avec 2 à 6 réponses (une seule ou plusieurs possibles) ; chacun vote, change d'avis,
-- voit le résultat et qui a voté. L'auteur ou un coach clôture le sondage. Mêmes mots bloqués que le chat (sauf Seniors et Vétérans).

alter table chat_msgs add column if not exists poll jsonb; -- { opts: ["…", …], multi: bool, closed: bool }
create table if not exists chat_votes (club text not null references clubs(id) on delete cascade, msg_id bigint not null references chat_msgs(id) on delete cascade,
  voter text not null, name text not null, opt int not null, at timestamptz not null default now(), primary key (club, msg_id, voter, opt));
alter table chat_votes enable row level security;
revoke all on chat_votes from public, anon, authenticated;

-- the polls of a category (the 30 newest), with the votes; « me » = the person asking
create or replace function ea_chat_polls(c text, p_cat text, p_me text) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(p order by (p->>'id')::bigint desc), '[]'::jsonb) from (
    select jsonb_build_object('id', m.id, 'at', m.at, 'name', m.name, 'kind', m.kind, 'mine', m.author = p_me, 'q', m.body,
      'multi', coalesce((m.poll->>'multi')::boolean, false), 'closed', coalesce((m.poll->>'closed')::boolean, false),
      'voters', (select count(distinct v.voter) from chat_votes v where v.club = c and v.msg_id = m.id),
      'opts', (select jsonb_agg(jsonb_build_object('t', o.t,
          'n', (select count(*) from chat_votes v where v.club = c and v.msg_id = m.id and v.opt = o.i - 1),
          'me', exists (select 1 from chat_votes v where v.club = c and v.msg_id = m.id and v.opt = o.i - 1 and v.voter = p_me),
          'who', (select coalesce(jsonb_agg(v.name order by v.at), '[]'::jsonb) from chat_votes v where v.club = c and v.msg_id = m.id and v.opt = o.i - 1)) order by o.i)
        from jsonb_array_elements_text(m.poll->'opts') with ordinality o(t, i))) p
    from (select * from chat_msgs where club = c and cat = p_cat and poll is not null and not deleted and at > now() - interval '120 days' order by id desc limit 30) m) z $$;

-- the chat view (as before) + « poll » on the messages that are polls + « polls »: their votes now
create or replace function ea_chat_view(c text, p_cat text, p_me text, p_mod boolean, p_after bigint) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  return jsonb_build_object('cat', p_cat, 'filtered', not ea_chat_free(p_cat), 'mod', p_mod,
    'off', coalesce((select off from chat_state where club = c and cat = p_cat), false),
    'msgs', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'at', m.at, 'name', m.name, 'kind', m.kind, 'mine', m.author = p_me,
        'body', case when m.deleted then null else m.body end, 'deleted', m.deleted, 'poll', m.poll is not null) order by m.id), '[]'::jsonb)
      from (select * from chat_msgs where club = c and cat = p_cat and id > coalesce(p_after, 0) and at > now() - interval '120 days' order by id desc limit 150) m),
    'gone', (select coalesce(jsonb_agg(id), '[]'::jsonb) from chat_msgs where club = c and cat = p_cat and deleted and coalesce(p_after, 0) > 0 and id <= p_after and at > now() - interval '120 days'),
    'polls', ea_chat_polls(c, p_cat, p_me));
end $$;

-- a new poll: the same checks as a message (chat closed, too fast, words)
create or replace function ea_chat_poll(c text, p_cat text, p_me text, p_kind text, p_name text, p_q text, p_opts text[], p_multi boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare q text := left(trim(regexp_replace(coalesce(p_q, ''), '[\x00-\x1f\x7f]', ' ', 'g')), 200); opts text[]; id bigint;
begin
  select array_agg(x order by i) into opts from (select left(trim(regexp_replace(o, '[\x00-\x1f\x7f]', ' ', 'g')), 80) x, i from unnest(coalesce(p_opts, '{}')) with ordinality u(o, i)) z where x <> '';
  if q = '' or coalesce(array_length(opts, 1), 0) < 2 or array_length(opts, 1) > 6 then raise exception 'DONNEES'; end if;
  if coalesce((select off from chat_state where club = c and cat = p_cat), false) and p_kind = 'player' then raise exception 'CHAT_FERME'; end if;
  if exists (select 1 from chat_msgs where club = c and author = p_me and at > now() - interval '1 second') then raise exception 'TROP_VITE'; end if;
  if (select count(*) from chat_msgs where club = c and author = p_me and at > now() - interval '1 day') >= 200 then raise exception 'LIMITE_CHAT'; end if;
  if not ea_chat_free(p_cat) and ea_chat_bad(c, q || ' ' || array_to_string(opts, ' . ')) then raise exception 'MOT_INTERDIT'; end if;
  insert into chat_msgs (club, cat, author, kind, name, body, poll) values (c, p_cat, p_me, p_kind, coalesce(nullif(trim(p_name), ''), '?'), q,
    jsonb_build_object('opts', to_jsonb(opts), 'multi', coalesce(p_multi, false), 'closed', false)) returning chat_msgs.id into id;
  return to_jsonb(id); end $$;
-- a vote: one answer (touch it again: no answer), or several when the poll allows it
create or replace function ea_chat_vote(c text, p_cat text, p_me text, p_kind text, p_name text, p_id bigint, p_opt int) returns jsonb language plpgsql security definer set search_path = public as $$
declare m chat_msgs;
begin
  select * into m from chat_msgs where club = c and cat = p_cat and id = p_id and not deleted and poll is not null;
  if m.id is null or p_opt < 0 or p_opt >= jsonb_array_length(m.poll->'opts') then raise exception 'DONNEES'; end if;
  if coalesce((m.poll->>'closed')::boolean, false) then raise exception 'SONDAGE_FINI'; end if;
  if coalesce((select off from chat_state where club = c and cat = p_cat), false) and p_kind = 'player' then raise exception 'CHAT_FERME'; end if;
  if exists (select 1 from chat_votes where club = c and msg_id = p_id and voter = p_me and opt = p_opt) then
    delete from chat_votes where club = c and msg_id = p_id and voter = p_me and opt = p_opt;
  else
    if not coalesce((m.poll->>'multi')::boolean, false) then delete from chat_votes where club = c and msg_id = p_id and voter = p_me; end if;
    insert into chat_votes (club, msg_id, voter, name, opt) values (c, p_id, p_me, coalesce(nullif(trim(p_name), ''), '?'), p_opt);
  end if;
  return ea_chat_polls(c, p_cat, p_me); end $$;
-- closed (or opened again) by its author or a coach
create or replace function ea_chat_poll_close(c text, p_cat text, p_me text, p_mod boolean, p_id bigint, p_closed boolean) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  update chat_msgs set poll = poll || jsonb_build_object('closed', coalesce(p_closed, true))
    where club = c and cat = p_cat and id = p_id and poll is not null and (author = p_me or p_mod);
  if not found then raise exception 'DONNEES'; end if;
  return ea_chat_polls(c, p_cat, p_me); end $$;

-- the player (personal code)
create or replace function member_chat_poll(p_code text, p_cat text, p_q text, p_opts text[], p_multi boolean default false) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code);
begin
  if not (p_cat = any(ea_chat_cats(pl.club, ea_member_teams(pl)))) then raise exception 'DONNEES'; end if;
  return ea_chat_poll(pl.club, p_cat, pl.id, 'player', ea_short(pl.data), p_q, p_opts, p_multi); end $$;
create or replace function member_chat_vote(p_code text, p_cat text, p_id bigint, p_opt int) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code);
begin
  if not (p_cat = any(ea_chat_cats(pl.club, ea_member_teams(pl)))) then raise exception 'DONNEES'; end if;
  return ea_chat_vote(pl.club, p_cat, pl.id, 'player', ea_short(pl.data), p_id, p_opt); end $$;
create or replace function member_chat_poll_close(p_code text, p_cat text, p_id bigint, p_closed boolean default true) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code);
begin
  if not (p_cat = any(ea_chat_cats(pl.club, ea_member_teams(pl)))) then raise exception 'DONNEES'; end if;
  return ea_chat_poll_close(pl.club, p_cat, pl.id, false, p_id, p_closed); end $$;
-- the coach (his login)
create or replace function club_chat_poll(k text, p_team text, p_q text, p_opts text[], p_multi boolean default false) returns jsonb language plpgsql security definer set search_path = public as $$
declare x jsonb := ea_chat_coach(k, p_team); begin return ea_chat_poll(x->>'club', x->>'cat', x->>'sid', 'coach', x->>'name', p_q, p_opts, p_multi); end $$;
create or replace function club_chat_vote(k text, p_team text, p_id bigint, p_opt int) returns jsonb language plpgsql security definer set search_path = public as $$
declare x jsonb := ea_chat_coach(k, p_team); begin return ea_chat_vote(x->>'club', x->>'cat', x->>'sid', 'coach', x->>'name', p_id, p_opt); end $$;
create or replace function club_chat_poll_close(k text, p_team text, p_id bigint, p_closed boolean default true) returns jsonb language plpgsql security definer set search_path = public as $$
declare x jsonb := ea_chat_coach(k, p_team); begin return ea_chat_poll_close(x->>'club', x->>'cat', x->>'sid', true, p_id, p_closed); end $$;

-- the notification of a new poll says it is a poll
create or replace function ea_on_chat() returns trigger language plpgsql security definer set search_path = public as $$
declare title text := case when new.poll is not null then '📊 Sondage · ' else '💬 Chat ' end || new.cat;
  body text := new.name || ' : ' || left(new.body, 160);
begin
  begin
    perform ea_member_note(new.club, array(select x from unnest(ea_cat_players(new.club, new.cat)) x where x <> new.author), title, body, 'chat:' || new.cat, '#chat');
    perform ea_notify(new.club, array(select x from unnest(ea_cat_staff(new.club, new.cat)) x where x <> new.author), 'messages', 'chat:' || new.cat, title, body,
      '#/chat/' || coalesce((select t.id from items t where t.club = new.club and t.col = 'teams' and not t.deleted and ea_team_cat(t.data) = new.cat order by t.data->>'name' limit 1), ''));
  exception when others then raise notice 'notification du chat : %', sqlerrm; end;
  return null;
end $$;

revoke all on function ea_chat_polls(text, text, text), ea_chat_poll(text, text, text, text, text, text, text[], boolean), ea_chat_vote(text, text, text, text, text, bigint, int),
  ea_chat_poll_close(text, text, text, boolean, bigint, boolean), ea_chat_view(text, text, text, boolean, bigint) from public, anon, authenticated;
grant execute on function member_chat_poll(text, text, text, text[], boolean), member_chat_vote(text, text, bigint, int), member_chat_poll_close(text, text, bigint, boolean),
  club_chat_poll(text, text, text, text[], boolean), club_chat_vote(text, text, bigint, int), club_chat_poll_close(text, text, bigint, boolean) to anon, authenticated;
notify pgrst, 'reload schema';
