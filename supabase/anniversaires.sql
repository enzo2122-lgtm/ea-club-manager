-- Clubbo 2.19 : les anniversaires des joueurs.
-- À coller une fois dans Supabase (SQL Editor → New query → coller → Run), APRÈS espace-famille-u15.sql. Ne modifie aucune donnée existante.
-- · le jour de son anniversaire, un message « 👑 King of the day » arrive dans le chat de sa catégorie (le chat des parents pour les U15 et en dessous),
--   une seule fois, le matin (tâche planifiée) ou à la première ouverture du chat ; tout le monde reçoit la notification
-- · une couronne 👑 devant son nom dans le chat toute la journée
-- · la date de naissance ne sort pas : seul le prénom et l'initiale du nom sont écrits

create table if not exists bday_log (club text not null, player_id text not null, room text not null, day date not null, primary key (club, player_id, room, day));
alter table bday_log enable row level security;
revoke all on bday_log from public, anon, authenticated;

-- today in France, and « is it his birthday ? » (born on 29 February: the 28th in the other years)
create or replace function ea_today_fr() returns date language sql stable as $$ select (now() at time zone 'Europe/Paris')::date $$;
create or replace function ea_is_bday(p_birth text, p_day date default null) returns boolean language sql stable as $$
  select coalesce(p_birth, '') ~ '^\d{4}-\d{2}-\d{2}' and (substr(p_birth, 6, 5) = to_char(coalesce(p_day, ea_today_fr()), 'MM-DD')
    or (substr(p_birth, 6, 5) = '02-29' and to_char(coalesce(p_day, ea_today_fr()), 'MM-DD') = '02-28'
      and extract(day from date_trunc('year', coalesce(p_day, ea_today_fr())) + interval '2 months' - interval '1 day') = 28)) $$;

-- the players of a room whose birthday it is
create or replace function ea_room_kings(c text, p_cat text) returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(p.id), '{}') from items p where p.club = c and p.col = 'players' and not p.deleted
    and p.id = any(ea_cat_players(c, ea_room_base(p_cat))) and ea_is_bday(p.data->>'birth') $$;

-- the message « King of the day » of a room (once per player, room and day)
create or replace function ea_bday_post(c text, p_cat text) returns int language plpgsql security definer set search_path = public as $$
declare pl items; n int := 0; par boolean := p_cat like '% · Parents'; who text; first text;
begin
  if p_cat is distinct from ea_cat_room(ea_room_base(p_cat)) then return 0; end if;
  for pl in select * from items p where p.club = c and p.col = 'players' and not p.deleted and p.id = any(ea_room_kings(c, p_cat)) order by p.data->>'firstName' loop
    insert into bday_log values (c, pl.id, p_cat, ea_today_fr()) on conflict do nothing;
    continue when not found;
    who := ea_short(pl.data); first := coalesce(nullif(split_part(trim(coalesce(pl.data->>'firstName', '')), ' ', 1), ''), who);
    insert into chat_msgs (club, cat, author, kind, name, body) values (c, p_cat, 'bday:' || pl.id, 'coach', '👑 King of the day',
      '👑 KING OF THE DAY 👑' || E'\n' || '🎂 Aujourd''hui, c''est l''anniversaire de ' || who || ' ! Tout le club lui souhaite un très joyeux anniversaire 🥳' || E'\n'
      || case when par then 'Parents, coachs : souhaitez-lui un bon anniversaire ici, et transmettez-lui nos vœux 👇'
         else 'À vous de jouer : souhaitez tous un bon anniversaire à ' || first || ' ici 👇' end);
    n := n + 1;
  end loop;
  return n; end $$;

-- every club, every room: the morning task
create or replace function ea_bday_all() returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select distinct p.club, ea_cat_room(ea_team_cat(t.data)) room from items p
      join items t on t.club = p.club and t.col = 'teams' and not t.deleted and t.id = any(ea_arr(p.data->'teamIds'))
      where p.col = 'players' and not p.deleted and ea_is_bday(p.data->>'birth') and ea_team_cat(t.data) <> '' loop
    begin n := n + ea_bday_post(r.club, r.room); exception when others then raise notice 'anniversaire : %', sqlerrm; end;
  end loop;
  return n; end $$;
do $cron$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'ea-anniversaires';
    perform cron.schedule('ea-anniversaires', '0 7 * * *', 'select public.ea_bday_all()');
  end if;
end $cron$;

-- the chat view (as in 2.04) + the birthday message on opening, « kings » (the names), « king » (a crown on his messages), « bday » (the message of the day)
create or replace function ea_chat_view(c text, p_cat text, p_me text, p_mod boolean, p_after bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare lo bigint := (select coalesce(min(id), 0) from (select id from chat_msgs where club = c and cat = p_cat and at > now() - interval '120 days' order by id desc limit 150) z);
  pn bigint := (select pin from chat_state where club = c and cat = p_cat); kings text[];
begin
  -- (2.19) the birthday message of the day (once per player and room), if the morning task has not posted it yet
  if coalesce(p_after, 0) = 0 then begin perform ea_bday_post(c, p_cat); exception when others then raise notice 'anniversaire : %', sqlerrm; end; end if;
  kings := ea_room_kings(c, p_cat);
  return jsonb_build_object('cat', p_cat, 'filtered', not ea_chat_free(p_cat), 'mod', p_mod,
    'off', coalesce((select off from chat_state where club = c and cat = p_cat), false),
    'muted', exists (select 1 from chat_mutes where club = c and person = p_me),
    'photos', ea_chat_photos_ok(c, p_cat),
    'kings', (select coalesce(jsonb_agg(ea_short(p.data) order by p.data->>'firstName'), '[]'::jsonb) from items p where p.club = c and p.col = 'players' and p.id = any(kings)),
    'pin', (select jsonb_build_object('id', m.id, 'name', m.name, 'body', left(m.body, 140), 'img', m.img) from chat_msgs m where m.club = c and m.id = pn and not m.deleted),
    'msgs', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'at', m.at, 'name', m.name, 'kind', m.kind, 'mine', m.author = p_me, 'king', m.kind = 'player' and m.author = any(kings), 'bday', m.author like 'bday:%',
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

revoke all on function ea_room_kings(text, text), ea_bday_post(text, text), ea_bday_all(), ea_chat_view(text, text, text, boolean, bigint) from public, anon, authenticated;
notify pgrst, 'reload schema';
