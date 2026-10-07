-- Clubbo 2.04 : photos et message épinglé dans le chat, le chat des parents, les relances de la veille, classements et badges.
-- À coller une fois dans Supabase (SQL Editor → New query → coller → Run), APRÈS chat-plus.sql. Ne modifie aucune donnée existante.

/* ---------- 1) the parents' chat: a room « <catégorie> · Parents » next to the players' one (parents and coaches, adults: no word filter, no quiet hours) ---------- */
alter table chat_msgs drop constraint if exists chat_msgs_kind_check;
alter table chat_msgs add constraint chat_msgs_kind_check check (kind in ('player', 'coach', 'parent'));
create or replace function ea_chat_free(p_cat text) returns boolean language sql immutable as $$
  select coalesce(p_cat, '') ~* '(s[eé]nior|v[eé]t[eé]ran| · Parents$)' $$;
create or replace function ea_room_base(p_cat text) returns text language sql immutable as $$ select regexp_replace(coalesce(p_cat, ''), ' · Parents$', '') $$;
-- the code of a player opens the chat of his category and its parents' room (the parents use the child's code)
create or replace function ea_member_cat_ok(pl items, p_cat text) returns boolean language sql stable security definer set search_path = public as $$
  select ea_room_base(p_cat) = any(ea_chat_cats(pl.club, ea_member_teams(pl))) $$;
create or replace function ea_member_who(pl items, p_cat text) returns jsonb language sql stable as $$
  select case when p_cat like '% · Parents' then jsonb_build_object('kind', 'parent', 'name', 'Parent de ' || ea_short(pl.data)) else jsonb_build_object('kind', 'player', 'name', ea_short(pl.data)) end $$;

/* ---------- 2) photos, pinned message, photos of the players allowed or not (youth categories: not until a coach allows them) ---------- */
alter table chat_msgs add column if not exists img boolean not null default false;
create table if not exists chat_files (club text not null references clubs(id) on delete cascade, msg_id bigint primary key references chat_msgs(id) on delete cascade, data text not null);
alter table chat_files enable row level security;
revoke all on chat_files from public, anon, authenticated;
alter table chat_state add column if not exists pin bigint;
alter table chat_state add column if not exists photos boolean;
create or replace function ea_chat_photos_ok(c text, p_cat text) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select photos from chat_state where club = c and cat = p_cat), ea_chat_free(p_cat)) $$;

-- the chat view (as in 2.03) + « img » on the messages with a photo, the pinned message, « photos » (the players may send some)
create or replace function ea_chat_view(c text, p_cat text, p_me text, p_mod boolean, p_after bigint) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare lo bigint := (select coalesce(min(id), 0) from (select id from chat_msgs where club = c and cat = p_cat and at > now() - interval '120 days' order by id desc limit 150) z);
  pn bigint := (select pin from chat_state where club = c and cat = p_cat);
begin
  return jsonb_build_object('cat', p_cat, 'filtered', not ea_chat_free(p_cat), 'mod', p_mod,
    'off', coalesce((select off from chat_state where club = c and cat = p_cat), false),
    'muted', exists (select 1 from chat_mutes where club = c and person = p_me),
    'photos', ea_chat_photos_ok(c, p_cat),
    'pin', (select jsonb_build_object('id', m.id, 'name', m.name, 'body', left(m.body, 140), 'img', m.img) from chat_msgs m where m.club = c and m.id = pn and not m.deleted),
    'msgs', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'at', m.at, 'name', m.name, 'kind', m.kind, 'mine', m.author = p_me,
        'body', case when m.deleted then null else m.body end, 'deleted', m.deleted, 'poll', m.poll is not null, 'img', m.img and not m.deleted,
        'reply', (select jsonb_build_object('id', r.id, 'name', r.name, 'body', case when r.deleted then null when r.img and r.body = '' then '📷 Photo' else left(r.body, 90) end) from chat_msgs r where r.club = c and r.id = m.reply_to)) order by m.id), '[]'::jsonb)
      from (select * from chat_msgs where club = c and cat = p_cat and id > coalesce(p_after, 0) and at > now() - interval '120 days' order by id desc limit 150) m),
    'gone', (select coalesce(jsonb_agg(id), '[]'::jsonb) from chat_msgs where club = c and cat = p_cat and deleted and coalesce(p_after, 0) > 0 and id <= p_after and at > now() - interval '120 days'),
    'polls', ea_chat_polls(c, p_cat, p_me),
    'reacts', (select coalesce(jsonb_object_agg(x.msg_id::text, x.l), '{}'::jsonb) from (
        select msg_id, jsonb_agg(jsonb_build_object('e', emo, 'n', n, 'me', me, 'who', who) order by first) l from (
          select r.msg_id, r.emo, count(*) n, bool_or(r.who = p_me) me, jsonb_agg(r.name order by r.at) who, min(r.at) first
          from chat_reacts r join chat_msgs m on m.club = r.club and m.id = r.msg_id
          where r.club = c and m.cat = p_cat and r.msg_id >= lo group by r.msg_id, r.emo) y group by msg_id) x),
    'reports', case when p_mod then (select coalesce(jsonb_object_agg(x.msg_id::text, x.who), '{}'::jsonb) from (
        select r.msg_id, jsonb_agg(r.name order by r.at) who from chat_reports r join chat_msgs m on m.club = r.club and m.id = r.msg_id
        where r.club = c and m.cat = p_cat and r.msg_id >= lo and not m.deleted group by r.msg_id) x) else '{}'::jsonb end);
end $$;

-- a photo (a JPEG made smaller by the phone, at most ~500 Ko), with a few words or none
create or replace function ea_chat_photo(c text, p_cat text, p_me text, p_kind text, p_name text, p_img text, p_body text, p_mod boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare b text := left(trim(regexp_replace(coalesce(p_body, ''), '[\x00-\x09\x0b-\x1f\x7f]', '', 'g')), 300); id bigint;
begin
  if coalesce(p_img, '') !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$' or length(p_img) > 700000 then raise exception 'PHOTO'; end if;
  if not p_mod and not ea_chat_photos_ok(c, p_cat) then raise exception 'PHOTOS_COACHS'; end if;
  if coalesce((select off from chat_state where club = c and cat = p_cat), false) and not p_mod then raise exception 'CHAT_FERME'; end if;
  if exists (select 1 from chat_msgs where club = c and author = p_me and at > now() - interval '1 second') then raise exception 'TROP_VITE'; end if;
  if (select count(*) from chat_msgs where club = c and author = p_me and img and at > now() - interval '1 day') >= 30 then raise exception 'LIMITE_CHAT'; end if;
  if b <> '' and not ea_chat_free(p_cat) and ea_chat_bad(c, b) then raise exception 'MOT_INTERDIT'; end if;
  insert into chat_msgs (club, cat, author, kind, name, body, img) values (c, p_cat, p_me, p_kind, coalesce(nullif(trim(p_name), ''), '?'), b, true) returning chat_msgs.id into id;
  insert into chat_files (club, msg_id, data) values (c, id, p_img);
  return to_jsonb(id); end $$;
create or replace function ea_chat_img(c text, p_cat text, p_id bigint) returns jsonb language sql stable security definer set search_path = public as $$
  select to_jsonb(f.data) from chat_files f join chat_msgs m on m.club = f.club and m.id = f.msg_id where f.club = c and m.cat = p_cat and f.msg_id = p_id and not m.deleted $$;

/* ---------- 3) the player's (or parents') functions: the room checked, the right name ---------- */
drop function if exists member_chat(text, text, bigint);
create or replace function member_chat(p_code text, p_cat text default null, p_after bigint default 0, p_room text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); base text[] := ea_chat_cats(pl.club, ea_member_teams(pl)); cats text[]; cat text;
begin
  if cardinality(base) = 0 then return jsonb_build_object('cats', '[]'::jsonb, 'msgs', '[]'::jsonb); end if;
  -- « parents »: only the parents' rooms; « all »: the parents' rooms first, then the players' chats; otherwise the players' chats
  cats := case p_room when 'parents' then array(select b || ' · Parents' from unnest(base) b)
    when 'all' then array(select b || ' · Parents' from unnest(base) b) || base else base end;
  cat := case when p_cat = any(cats) then p_cat else cats[1] end;
  return ea_chat_view(pl.club, cat, pl.id, false, p_after) || jsonb_build_object('cats', to_jsonb(cats)); end $$;
create or replace function member_chat_post(p_code text, p_cat text, p_body text, p_reply bigint default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); w jsonb := ea_member_who(pl, p_cat);
begin
  if not ea_member_cat_ok(pl, p_cat) then raise exception 'DONNEES'; end if;
  return ea_chat_post(pl.club, p_cat, pl.id, w->>'kind', w->>'name', p_body, p_reply); end $$;
create or replace function member_chat_photo(p_code text, p_cat text, p_img text, p_body text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); w jsonb := ea_member_who(pl, p_cat);
begin
  if not ea_member_cat_ok(pl, p_cat) then raise exception 'DONNEES'; end if;
  return ea_chat_photo(pl.club, p_cat, pl.id, w->>'kind', w->>'name', p_img, p_body, false); end $$;
create or replace function member_chat_img(p_code text, p_cat text, p_id bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code);
begin
  if not ea_member_cat_ok(pl, p_cat) then raise exception 'DONNEES'; end if;
  return ea_chat_img(pl.club, p_cat, p_id); end $$;
create or replace function member_chat_poll(p_code text, p_cat text, p_q text, p_opts text[], p_multi boolean default false) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); w jsonb := ea_member_who(pl, p_cat);
begin
  if not ea_member_cat_ok(pl, p_cat) then raise exception 'DONNEES'; end if;
  return ea_chat_poll(pl.club, p_cat, pl.id, w->>'kind', w->>'name', p_q, p_opts, p_multi); end $$;
create or replace function member_chat_vote(p_code text, p_cat text, p_id bigint, p_opt int) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); w jsonb := ea_member_who(pl, p_cat);
begin
  if not ea_member_cat_ok(pl, p_cat) then raise exception 'DONNEES'; end if;
  return ea_chat_vote(pl.club, p_cat, pl.id, w->>'kind', w->>'name', p_id, p_opt); end $$;
create or replace function member_chat_poll_close(p_code text, p_cat text, p_id bigint, p_closed boolean default true) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code);
begin
  if not ea_member_cat_ok(pl, p_cat) then raise exception 'DONNEES'; end if;
  return ea_chat_poll_close(pl.club, p_cat, pl.id, false, p_id, p_closed); end $$;
create or replace function member_chat_react(p_code text, p_cat text, p_id bigint, p_emo text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); w jsonb := ea_member_who(pl, p_cat);
begin
  if not ea_member_cat_ok(pl, p_cat) then raise exception 'DONNEES'; end if;
  return ea_chat_react(pl.club, p_cat, pl.id, w->>'name', p_id, p_emo); end $$;
create or replace function member_chat_report(p_code text, p_cat text, p_id bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); w jsonb := ea_member_who(pl, p_cat); m chat_msgs;
begin
  if not ea_member_cat_ok(pl, p_cat) then raise exception 'DONNEES'; end if;
  select * into m from chat_msgs where club = pl.club and cat = p_cat and id = p_id and not deleted;
  if m.id is null or m.author = pl.id then raise exception 'DONNEES'; end if;
  insert into chat_reports (club, msg_id, who, name) values (pl.club, p_id, pl.id, w->>'name') on conflict do nothing;
  if found then
    begin
      perform ea_notify(pl.club, ea_cat_staff(pl.club, ea_room_base(p_cat)), 'mention', 'chatrep:' || p_id, '🚩 Message signalé · Chat ' || p_cat,
        (w->>'name') || ' signale un message de ' || m.name || ' : « ' || left(case when m.body = '' and m.img then '📷 Photo' else m.body end, 120) || ' »',
        '#/chat/' || coalesce((select t.id from items t where t.club = pl.club and t.col = 'teams' and not t.deleted and ea_team_cat(t.data) = ea_room_base(p_cat) order by t.data->>'name' limit 1), '')
        || case when p_cat like '% · Parents' then '|parents' else '' end);
    exception when others then raise notice 'notification signalement : %', sqlerrm; end;
  end if;
  return to_jsonb(true); end $$;

/* ---------- 4) the coach: « <équipe>|parents » opens the parents' room; he pins, allows the photos of the players ---------- */
create or replace function ea_chat_coach(k text, p_team text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c text := ea_need(k); sid text := ea_staff(k); st items; t items; team text := split_part(coalesce(p_team, ''), '|', 1); par boolean := p_team like '%|parents';
begin
  if sid is null then raise exception 'CLE_CLUB'; end if;
  select * into t from items where club = c and col = 'teams' and id = team and not deleted;
  if t.id is null then raise exception 'DONNEES'; end if;
  select * into st from items where club = c and col = 'staff' and id = sid and not deleted;
  if not ea_admin(k, c) and not (ea_team_cat(t.data) = any(ea_chat_cats(c, ea_arr(st.data->'teamIds')))) then raise exception 'DONNEES'; end if;
  return jsonb_build_object('club', c, 'sid', sid, 'cat', ea_team_cat(t.data) || case when par then ' · Parents' else '' end,
    'name', 'Coach ' || coalesce(nullif(split_part(trim(regexp_replace(coalesce(st.data->>'firstName', ''), '\(.*?\)', '', 'g')), ' ', 1), ''), ea_short(st.data), 'du club')); end $$;
create or replace function club_chat_photo(k text, p_team text, p_img text, p_body text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare x jsonb := ea_chat_coach(k, p_team); begin return ea_chat_photo(x->>'club', x->>'cat', x->>'sid', 'coach', x->>'name', p_img, p_body, true); end $$;
create or replace function club_chat_img(k text, p_team text, p_id bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare x jsonb := ea_chat_coach(k, p_team); begin return ea_chat_img(x->>'club', x->>'cat', p_id); end $$;
create or replace function club_chat_pin(k text, p_team text, p_id bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare x jsonb := ea_chat_coach(k, p_team);
begin
  if p_id is not null and not exists (select 1 from chat_msgs where club = x->>'club' and cat = x->>'cat' and id = p_id and not deleted) then raise exception 'DONNEES'; end if;
  insert into chat_state (club, cat, pin, by_name) values (x->>'club', x->>'cat', p_id, x->>'name')
    on conflict (club, cat) do update set pin = excluded.pin, by_name = excluded.by_name, at = now();
  return to_jsonb(true); end $$;
create or replace function club_chat_photos(k text, p_team text, p_on boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare x jsonb := ea_chat_coach(k, p_team);
begin
  insert into chat_state (club, cat, photos, by_name) values (x->>'club', x->>'cat', coalesce(p_on, false), x->>'name')
    on conflict (club, cat) do update set photos = excluded.photos, by_name = excluded.by_name, at = now();
  return to_jsonb(coalesce(p_on, false)); end $$;

/* ---------- 5) notifications: the parents' room to the phones of the parents' page; a photo says « 📷 » ---------- */
create or replace function ea_member_note_page(c text, p_players text[], p_title text, p_body text, p_tag text, p_url text, p_page text) returns void language plpgsql security definer set search_path = public as $$
declare subs jsonb; cfg push_config;
begin
  if coalesce(array_length(p_players, 1), 0) = 0 then return; end if;
  insert into member_notifs (club, player_id, title, body, tag, url)
    select distinct c, s.player_id, left(p_title, 120), left(p_body, 240), p_tag, p_url from member_subs s where s.club = c and s.player_id = any(p_players) and s.page = p_page;
  select jsonb_agg(jsonb_build_object('id', x.id, 'endpoint', x.endpoint)) into subs
    from (select distinct on (endpoint) id, endpoint from member_subs where club = c and player_id = any(p_players) and page = p_page) x;
  select * into cfg from push_config where id = 1;
  if subs is null or cfg.fn_url is null then return; end if;
  begin perform net.http_post(url := cfg.fn_url, body := jsonb_build_object('subs', subs), headers := jsonb_build_object('Content-Type', 'application/json', 'x-raincy-secret', cfg.secret));
  exception when others then raise notice 'notification des familles : %', sqlerrm; end;
end $$;
create or replace function ea_on_chat() returns trigger language plpgsql security definer set search_path = public as $$
declare base text := ea_room_base(new.cat); par boolean := new.cat like '% · Parents';
  title text := case when new.poll is not null then '📊 Sondage · ' else '💬 ' || case when par then 'Parents ' else 'Chat ' end end || base;
  body text := new.name || ' : ' || left(case when new.img then '📷 Photo' || case when new.body <> '' then ' · ' || new.body else '' end else new.body end, 160);
  muted text[] := array(select person from chat_mutes where club = new.club);
  people text[] := array(select x from unnest(ea_cat_players(new.club, base)) x where x <> new.author and not (x = any(muted)));
begin
  begin
    if par then perform ea_member_note_page(new.club, people, title, body, 'chat:' || new.cat, '#chat', 'parents.html');
    elsif ea_chat_free(new.cat) or not ea_quiet() then perform ea_member_note(new.club, people, title, body, 'chat:' || new.cat, '#chat'); end if;
    perform ea_notify(new.club, array(select x from unnest(ea_cat_staff(new.club, base)) x where x <> new.author and not (x = any(muted))), 'messages', 'chat:' || new.cat, title, body,
      '#/chat/' || coalesce((select t.id from items t where t.club = new.club and t.col = 'teams' and not t.deleted and ea_team_cat(t.data) = base order by t.data->>'name' limit 1), '')
      || case when par then '|parents' else '' end);
  exception when others then raise notice 'notification du chat : %', sqlerrm; end;
  return null;
end $$;

/* ---------- 6) the reminders of the day before (18 h): the players who have not answered, and a summary for the coaches ---------- */
create table if not exists relance_log (club text not null, event_id text not null, day date not null, primary key (club, event_id, day));
alter table relance_log enable row level security;
revoke all on relance_log from public, anon, authenticated;
create or replace function ea_relance() returns void language plpgsql security definer set search_path = public as $$
declare e items; ids text[]; lbl text; what text; d text := to_char(current_date + 1, 'YYYY-MM-DD'); names text; n int;
begin
  for e in select * from items i where i.col in ('matches', 'trainings') and not i.deleted and i.data->>'date' = d
      and not coalesce((i.data->>'model')::boolean, false) and not coalesce((i.data->>'exempt')::boolean, false) and not coalesce((i.data->>'played')::boolean, false)
      and coalesce(i.data->>'teamId', '') <> ''
      and not coalesce((select (c.data->>'noRelance')::boolean from items c where c.club = i.club and c.col = 'club' and c.id = 'club'), false) loop
    begin
      insert into relance_log (club, event_id, day) values (e.club, e.id, current_date); -- once a day for one event, even if the job runs twice
    exception when unique_violation then continue; end;
    begin
      lbl := coalesce((select data->>'name' from items where club = e.club and col = 'teams' and id = e.data->>'teamId'), '');
      if e.col = 'matches' then
        -- convocation sent: the convoked players; otherwise the players of the team (« dispo / pas dispo »)
        ids := case when (e.data->>'convSent') is not null then member_arr(e.data->'convoked')
          else array(select p.id from items p where p.club = e.club and p.col = 'players' and not p.deleted and coalesce(p.data->'teamIds', '[]'::jsonb) ? (e.data->>'teamId')) end;
        what := 'Match ' || case when coalesce((e.data->>'home')::boolean, false) then 'contre ' else 'chez ' end || coalesce(e.data->>'opponent', '?') || coalesce(' · ' || replace(nullif(e.data->>'time', ''), ':', 'h'), '');
      else
        ids := array(select p.id from items p where p.club = e.club and p.col = 'players' and not p.deleted and coalesce(p.data->'teamIds', '[]'::jsonb) ? (e.data->>'teamId'));
        what := 'Entraînement' || coalesce(' · ' || replace(nullif(e.data->>'time', ''), ':', 'h'), '') || coalesce(' · ' || nullif(e.data->>'title', ''), '');
      end if;
      ids := array(select x from unnest(ids) x where not exists (select 1 from answers a where a.club = e.club and a.match_id = e.id and a.player_id = x));
      n := coalesce(array_length(ids, 1), 0);
      if n = 0 then continue; end if;
      perform ea_member_note(e.club, ids, '⏰ Demain · ' || lbl || ' : tu viens ?', what || ' · touche pour répondre présent ou absent', 'relance:' || e.id, '');
      select string_agg(ea_short(p.data), ', ' order by p.data->>'lastName') into names from (select * from items p where p.club = e.club and p.col = 'players' and p.id = any(ids) limit 12) p;
      perform ea_notify(e.club, ea_team_staff(e.club, e.data->>'teamId'), 'planning', 'relance:' || e.id, '⏰ Demain · ' || lbl || ' : ' || n || ' sans réponse',
        what || ' · relancés : ' || names || case when n > 12 then '…' else '' end, case when e.col = 'matches' then '#/match/' else '#/entrainement/' end || e.id);
    exception when others then raise notice 'relance % : %', e.id, sqlerrm; end;
  end loop;
  delete from relance_log where day < current_date - 30;
end $$;
do $cron$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'ea-relances';
    perform cron.schedule('ea-relances', '0 16 * * *', 'select public.ea_relance()'); -- 16 h UTC = 18 h à Paris l'été, 17 h l'hiver
  end if;
exception when others then raise notice 'relances : %', sqlerrm;
end $cron$;

/* ---------- 7) the rankings of the category (season): goals, assists, attendance; and the player's own numbers for his badges ---------- */
create or replace function member_leaders(p_code text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pl items := ea_member(p_code); c text := pl.club; cats text[] := ea_chat_cats(pl.club, ea_member_teams(pl)); tids text[];
  season text := case when extract(month from current_date) >= 8 then to_char(current_date, 'YYYY') else to_char(current_date - interval '1 year', 'YYYY') end || '-08-01';
  today text := to_char(current_date, 'YYYY-MM-DD');
begin
  select array_agg(t.id) into tids from items t where t.club = c and t.col = 'teams' and not t.deleted and ea_team_cat(t.data) = any(cats);
  return jsonb_build_object('cat', array_to_string(cats, ' · '),
    -- the little ones (U6 to U9): no rankings, only the badges
    'hidden', exists (select 1 from unnest(cats) x where x ~* '^u ?[5-9]$'),
    'players', (with ps as (select p.id, ea_short(p.data) name, ea_arr(p.data->'teamIds') tids from items p where p.club = c and p.col = 'players' and not p.deleted and ea_arr(p.data->'teamIds') && coalesce(tids, '{}')),
      ms as (select i.data d from items i where i.club = c and i.col = 'matches' and not i.deleted and coalesce((i.data->>'played')::boolean, false) and i.data->>'date' >= season and i.data->>'teamId' = any(coalesce(tids, '{}'))),
      tr as (select i.data d from items i where i.club = c and i.col = 'trainings' and not i.deleted and not coalesce((i.data->>'model')::boolean, false) and i.data->>'teamId' = any(coalesce(tids, '{}'))
        and i.data->>'date' between season and today and jsonb_array_length(coalesce(i.data->'presents', '[]'::jsonb)) > 0)
      select coalesce(jsonb_agg(jsonb_build_object('id', ps.id, 'name', ps.name, 'me', ps.id = pl.id,
        'g', (select coalesce(sum(nullif(ms.d#>>array['stats', ps.id, 'g'], '')::int), 0) from ms),
        'a', (select coalesce(sum(nullif(ms.d#>>array['stats', ps.id, 'a'], '')::int), 0) from ms),
        'mp', (select count(*) from ms where coalesce(ms.d->'convoked', '[]'::jsonb) ? ps.id and coalesce(nullif(ms.d#>>array['minutes', ps.id], '')::int, 1) > 0),
        'full', (select count(*) from ms where coalesce(nullif(ms.d#>>array['minutes', ps.id], '')::int, 0) >= 60),
        'hat', (select count(*) from ms where coalesce(nullif(ms.d#>>array['stats', ps.id, 'g'], '')::int, 0) >= 3),
        'tr', (select count(*) from tr where (tr.d->'presents') ? ps.id), 'trt', (select count(*) from tr where tr.d->>'teamId' = any(ps.tids))
      )), '[]'::jsonb) from ps));
end $$;

revoke all on function ea_room_base(text), ea_member_cat_ok(items, text), ea_member_who(items, text), ea_chat_photos_ok(text, text), ea_chat_view(text, text, text, boolean, bigint),
  ea_chat_photo(text, text, text, text, text, text, text, boolean), ea_chat_img(text, text, bigint), ea_member_note_page(text, text[], text, text, text, text, text), ea_relance(), ea_on_chat()
  from public, anon, authenticated;
grant execute on function member_chat(text, text, bigint, text), member_chat_post(text, text, text, bigint), member_chat_photo(text, text, text, text), member_chat_img(text, text, bigint),
  member_chat_poll(text, text, text, text[], boolean), member_chat_vote(text, text, bigint, int), member_chat_poll_close(text, text, bigint, boolean), member_chat_react(text, text, bigint, text),
  member_chat_report(text, text, bigint), club_chat_photo(text, text, text, text), club_chat_img(text, text, bigint), club_chat_pin(text, text, bigint), club_chat_photos(text, text, boolean),
  member_leaders(text) to anon, authenticated;
notify pgrst, 'reload schema';
