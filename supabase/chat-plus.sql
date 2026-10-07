-- Clubbo 2.03 : le chat en mieux. À coller une fois dans Supabase (SQL Editor → New query → coller → Run),
-- APRÈS chat-categorie.sql, notifs-chat.sql et sondages-chat.sql. Ne modifie aucune donnée existante.
-- · heures calmes : pas de notification de chat aux jeunes entre 22 h et 7 h (les messages restent là)
-- · « Signaler » : un joueur signale un message, les coachs de la catégorie sont prévenus
-- · réactions 👍 ❤️ 😂 ⚽ 🔥 sur un message
-- · répondre à un message (la citation s'affiche au-dessus)
-- · couper les notifications du chat pour soi

alter table chat_msgs add column if not exists reply_to bigint;
create table if not exists chat_reacts (club text not null references clubs(id) on delete cascade, msg_id bigint not null references chat_msgs(id) on delete cascade,
  who text not null, name text not null, emo text not null, at timestamptz not null default now(), primary key (club, msg_id, who, emo));
create table if not exists chat_reports (club text not null references clubs(id) on delete cascade, msg_id bigint not null references chat_msgs(id) on delete cascade,
  who text not null, name text not null, at timestamptz not null default now(), primary key (club, msg_id, who));
create table if not exists chat_mutes (club text not null references clubs(id) on delete cascade, person text not null, at timestamptz not null default now(), primary key (club, person));
alter table chat_reacts enable row level security;
alter table chat_reports enable row level security;
alter table chat_mutes enable row level security;
revoke all on chat_reacts, chat_reports, chat_mutes from public, anon, authenticated;

-- 22 h → 7 h, heure de Paris
create or replace function ea_quiet() returns boolean language sql stable as $$
  select extract(hour from (now() at time zone 'Europe/Paris')) >= 22 or extract(hour from (now() at time zone 'Europe/Paris')) < 7 $$;

-- the chat view: + the message answered, the reactions, the reports (coaches only), « muted » for the person asking
create or replace function ea_chat_view(c text, p_cat text, p_me text, p_mod boolean, p_after bigint) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare lo bigint := (select coalesce(min(id), 0) from (select id from chat_msgs where club = c and cat = p_cat and at > now() - interval '120 days' order by id desc limit 150) z);
begin
  return jsonb_build_object('cat', p_cat, 'filtered', not ea_chat_free(p_cat), 'mod', p_mod,
    'off', coalesce((select off from chat_state where club = c and cat = p_cat), false),
    'muted', exists (select 1 from chat_mutes where club = c and person = p_me),
    'quiet', not ea_chat_free(p_cat),
    'msgs', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'at', m.at, 'name', m.name, 'kind', m.kind, 'mine', m.author = p_me,
        'body', case when m.deleted then null else m.body end, 'deleted', m.deleted, 'poll', m.poll is not null,
        'reply', (select jsonb_build_object('id', r.id, 'name', r.name, 'body', case when r.deleted then null else left(r.body, 90) end) from chat_msgs r where r.club = c and r.id = m.reply_to)) order by m.id), '[]'::jsonb)
      from (select * from chat_msgs where club = c and cat = p_cat and id > coalesce(p_after, 0) and at > now() - interval '120 days' order by id desc limit 150) m),
    'gone', (select coalesce(jsonb_agg(id), '[]'::jsonb) from chat_msgs where club = c and cat = p_cat and deleted and coalesce(p_after, 0) > 0 and id <= p_after and at > now() - interval '120 days'),
    'polls', ea_chat_polls(c, p_cat, p_me),
    -- { "<id>": [{ e, n, me, who: [names] }] } for the last 150 messages
    'reacts', (select coalesce(jsonb_object_agg(x.msg_id::text, x.l), '{}'::jsonb) from (
        select msg_id, jsonb_agg(jsonb_build_object('e', emo, 'n', n, 'me', me, 'who', who) order by first) l from (
          select r.msg_id, r.emo, count(*) n, bool_or(r.who = p_me) me, jsonb_agg(r.name order by r.at) who, min(r.at) first
          from chat_reacts r join chat_msgs m on m.club = r.club and m.id = r.msg_id
          where r.club = c and m.cat = p_cat and r.msg_id >= lo group by r.msg_id, r.emo) y group by msg_id) x),
    'reports', case when p_mod then (select coalesce(jsonb_object_agg(x.msg_id::text, x.who), '{}'::jsonb) from (
        select r.msg_id, jsonb_agg(r.name order by r.at) who from chat_reports r join chat_msgs m on m.club = r.club and m.id = r.msg_id
        where r.club = c and m.cat = p_cat and r.msg_id >= lo and not m.deleted group by r.msg_id) x) else '{}'::jsonb end);
end $$;

-- a message, possibly an answer to another one of the same chat
drop function if exists member_chat_post(text, text, text);
drop function if exists club_chat_post(text, text, text);
drop function if exists ea_chat_post(text, text, text, text, text, text);
create or replace function ea_chat_post(c text, p_cat text, p_me text, p_kind text, p_name text, p_body text, p_reply bigint default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare b text := left(trim(regexp_replace(coalesce(p_body, ''), '[\x00-\x09\x0b-\x1f\x7f]', '', 'g')), 500); id bigint;
begin
  if b = '' then raise exception 'DONNEES'; end if;
  if coalesce((select off from chat_state where club = c and cat = p_cat), false) and p_kind = 'player' then raise exception 'CHAT_FERME'; end if;
  if exists (select 1 from chat_msgs where club = c and author = p_me and at > now() - interval '1 second') then raise exception 'TROP_VITE'; end if;
  if (select count(*) from chat_msgs where club = c and author = p_me and at > now() - interval '1 day') >= 200 then raise exception 'LIMITE_CHAT'; end if;
  if not ea_chat_free(p_cat) and ea_chat_bad(c, b) then raise exception 'MOT_INTERDIT'; end if;
  insert into chat_msgs (club, cat, author, kind, name, body, reply_to) values (c, p_cat, p_me, p_kind, coalesce(nullif(trim(p_name), ''), '?'), b,
    (select r.id from chat_msgs r where r.club = c and r.cat = p_cat and r.id = p_reply)) returning chat_msgs.id into id;
  return to_jsonb(id); end $$;
create or replace function member_chat_post(p_code text, p_cat text, p_body text, p_reply bigint default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code);
begin
  if not (p_cat = any(ea_chat_cats(pl.club, ea_member_teams(pl)))) then raise exception 'DONNEES'; end if;
  return ea_chat_post(pl.club, p_cat, pl.id, 'player', ea_short(pl.data), p_body, p_reply); end $$;
create or replace function club_chat_post(k text, p_team text, p_body text, p_reply bigint default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare x jsonb := ea_chat_coach(k, p_team); begin return ea_chat_post(x->>'club', x->>'cat', x->>'sid', 'coach', x->>'name', p_body, p_reply); end $$;

-- a reaction: touch it again to take it back
create or replace function ea_chat_react(c text, p_cat text, p_me text, p_name text, p_id bigint, p_emo text) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_emo not in ('👍', '❤️', '😂', '⚽', '🔥', '👏') then raise exception 'DONNEES'; end if;
  if not exists (select 1 from chat_msgs where club = c and cat = p_cat and id = p_id and not deleted) then raise exception 'DONNEES'; end if;
  if exists (select 1 from chat_reacts where club = c and msg_id = p_id and who = p_me and emo = p_emo) then delete from chat_reacts where club = c and msg_id = p_id and who = p_me and emo = p_emo;
  else insert into chat_reacts (club, msg_id, who, name, emo) values (c, p_id, p_me, coalesce(nullif(trim(p_name), ''), '?'), p_emo); end if;
  return to_jsonb(true); end $$;
create or replace function member_chat_react(p_code text, p_cat text, p_id bigint, p_emo text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code);
begin
  if not (p_cat = any(ea_chat_cats(pl.club, ea_member_teams(pl)))) then raise exception 'DONNEES'; end if;
  return ea_chat_react(pl.club, p_cat, pl.id, ea_short(pl.data), p_id, p_emo); end $$;
create or replace function club_chat_react(k text, p_team text, p_id bigint, p_emo text) returns jsonb language plpgsql security definer set search_path = public as $$
declare x jsonb := ea_chat_coach(k, p_team); begin return ea_chat_react(x->>'club', x->>'cat', x->>'sid', x->>'name', p_id, p_emo); end $$;

-- a player reports a message: the coaches of the category are told at once (any hour)
create or replace function member_chat_report(p_code text, p_cat text, p_id bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); m chat_msgs;
begin
  if not (p_cat = any(ea_chat_cats(pl.club, ea_member_teams(pl)))) then raise exception 'DONNEES'; end if;
  select * into m from chat_msgs where club = pl.club and cat = p_cat and id = p_id and not deleted;
  if m.id is null or m.author = pl.id then raise exception 'DONNEES'; end if;
  insert into chat_reports (club, msg_id, who, name) values (pl.club, p_id, pl.id, ea_short(pl.data)) on conflict do nothing;
  if found then
    begin
      perform ea_notify(pl.club, ea_cat_staff(pl.club, p_cat), 'mention', 'chatrep:' || p_id, '🚩 Message signalé · Chat ' || p_cat,
        ea_short(pl.data) || ' signale un message de ' || m.name || ' : « ' || left(m.body, 120) || ' »',
        '#/chat/' || coalesce((select t.id from items t where t.club = pl.club and t.col = 'teams' and not t.deleted and ea_team_cat(t.data) = p_cat order by t.data->>'name' limit 1), ''));
    exception when others then raise notice 'notification signalement : %', sqlerrm; end;
  end if;
  return to_jsonb(true); end $$;

-- notifications of the chat on or off, for oneself (all one's phones)
create or replace function member_chat_mute(p_code text, p_on boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code);
begin
  if p_on then insert into chat_mutes (club, person) values (pl.club, pl.id) on conflict do nothing; else delete from chat_mutes where club = pl.club and person = pl.id; end if;
  return to_jsonb(coalesce(p_on, false)); end $$;
create or replace function club_chat_mute(k text, p_on boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k); sid text := ea_staff(k);
begin
  if sid is null then raise exception 'CLE_CLUB'; end if;
  if p_on then insert into chat_mutes (club, person) values (c, sid) on conflict do nothing; else delete from chat_mutes where club = c and person = sid; end if;
  return to_jsonb(coalesce(p_on, false)); end $$;

-- the notification of a new message: not to the muted ones; young players: not between 22 h and 7 h
create or replace function ea_on_chat() returns trigger language plpgsql security definer set search_path = public as $$
declare title text := case when new.poll is not null then '📊 Sondage · ' else '💬 Chat ' end || new.cat;
  body text := new.name || ' : ' || left(new.body, 160);
  muted text[] := array(select person from chat_mutes where club = new.club);
begin
  begin
    if ea_chat_free(new.cat) or not ea_quiet() then
      perform ea_member_note(new.club, array(select x from unnest(ea_cat_players(new.club, new.cat)) x where x <> new.author and not (x = any(muted))), title, body, 'chat:' || new.cat, '#chat');
    end if;
    perform ea_notify(new.club, array(select x from unnest(ea_cat_staff(new.club, new.cat)) x where x <> new.author and not (x = any(muted))), 'messages', 'chat:' || new.cat, title, body,
      '#/chat/' || coalesce((select t.id from items t where t.club = new.club and t.col = 'teams' and not t.deleted and ea_team_cat(t.data) = new.cat order by t.data->>'name' limit 1), ''));
  exception when others then raise notice 'notification du chat : %', sqlerrm; end;
  return null;
end $$;

revoke all on function ea_quiet(), ea_chat_view(text, text, text, boolean, bigint), ea_chat_post(text, text, text, text, text, text, bigint), ea_chat_react(text, text, text, text, bigint, text), ea_on_chat() from public, anon, authenticated;
grant execute on function member_chat_post(text, text, text, bigint), club_chat_post(text, text, text, bigint), member_chat_react(text, text, bigint, text), club_chat_react(text, text, bigint, text),
  member_chat_report(text, text, bigint), member_chat_mute(text, boolean), club_chat_mute(text, boolean) to anon, authenticated;
notify pgrst, 'reload schema';
