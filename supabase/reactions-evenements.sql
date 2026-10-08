-- Clubbo 2.27 : réactions 🔥 et commentaires 💬 sous chaque séance et chaque match. À coller une fois dans Supabase (SQL Editor → Run).
-- (2.27) joueurs, parents et coachs réagissent (une réaction par personne) et commentent un événement de leur catégorie ; mêmes règles que le chat
-- (mots interdits sauf seniors / vétérans, limites), les coachs modèrent (ils suppriment n'importe quel commentaire) et sont prévenus d'un commentaire.
create table if not exists event_posts (id bigserial primary key, club text not null references clubs(id) on delete cascade, event_id text not null, person text not null, kind text not null,
  name text not null, emo text, body text, at timestamptz not null default now(), deleted boolean not null default false);
alter table event_posts enable row level security;
create index if not exists event_posts_ev on event_posts (club, event_id);
-- the feed of some events, for one person (his own reaction and comments marked)
create or replace function ea_event_feed(c text, p_ids text[], p_me text) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(e.ev, e.j), '{}'::jsonb) from (
    select p.event_id ev, jsonb_build_object(
      'fire', count(*) filter (where p.emo is not null),
      'mine', max(p.emo) filter (where p.emo is not null and p.person = p_me),
      'n', count(*) filter (where p.body is not null and not p.deleted),
      'last', (select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'name', q.name, 'kind', q.kind, 'body', q.body, 'at', q.at, 'mine', q.person = p_me) order by q.at), '[]'::jsonb)
        from (select * from event_posts p2 where p2.club = c and p2.event_id = p.event_id and p2.body is not null and not p2.deleted order by p2.at desc limit 30) q)) j
    from event_posts p where p.club = c and p.event_id = any(p_ids[1:60]) group by p.event_id) e $$;
-- the event (match or training) of the club, with its team and the category's chat name
create or replace function ea_event_of(c text, p_event text) returns table (id text, col text, team text, cat text) language sql stable security definer set search_path = public as $$
  select i.id, i.col, i.data->>'teamId', coalesce(nullif(t.data->>'category', ''), t.data->>'name')
  from items i left join items t on t.club = i.club and t.col = 'teams' and t.id = i.data->>'teamId'
  where i.club = c and i.col in ('matches', 'trainings') and i.id = p_event and not i.deleted $$;
create or replace function ea_event_react(c text, p_event text, p_me text, p_kind text, p_name text, p_emo text) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  delete from event_posts where club = c and event_id = p_event and person = p_me and emo is not null;
  if coalesce(p_emo, '') <> '' then
    if p_emo not in ('🔥', '👏', '💪', '❤️', '😂') then raise exception 'DONNEES'; end if;
    insert into event_posts (club, event_id, person, kind, name, emo) values (c, p_event, p_me, p_kind, coalesce(nullif(trim(p_name), ''), '?'), p_emo);
  end if;
  return to_jsonb(true); end $$;
create or replace function ea_event_post(c text, p_event text, p_me text, p_kind text, p_name text, p_body text, p_cat text) returns jsonb language plpgsql security definer set search_path = public as $$
declare b text := left(trim(regexp_replace(coalesce(p_body, ''), '[\x00-\x09\x0b-\x1f\x7f]', '', 'g')), 300); id bigint;
begin
  if b = '' then raise exception 'DONNEES'; end if;
  if exists (select 1 from event_posts where club = c and person = p_me and body is not null and at > now() - interval '2 seconds') then raise exception 'TROP_VITE'; end if;
  if (select count(*) from event_posts where club = c and person = p_me and body is not null and at > now() - interval '1 day') >= 50 then raise exception 'LIMITE_CHAT'; end if;
  if p_kind = 'player' and not ea_chat_free(coalesce(p_cat, '')) and ea_chat_bad(c, b) then raise exception 'MOT_INTERDIT'; end if;
  insert into event_posts (club, event_id, person, kind, name, body) values (c, p_event, p_me, p_kind, coalesce(nullif(trim(p_name), ''), '?'), b) returning event_posts.id into id;
  return to_jsonb(id); end $$;
-- the player or his parents (personal code): the events of his category
create or replace function member_event(p_code text, p_ids text[]) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pl items := ea_member(p_code); c text := pl.club; tids text[] := ea_member_cat_teams(pl);
begin
  return ea_event_feed(c, (select coalesce(array_agg(i.id), '{}') from items i where i.club = c and i.col in ('matches', 'trainings') and not i.deleted and i.id = any(p_ids[1:60]) and i.data->>'teamId' = any(tids)), pl.id);
end $$;
create or replace function member_event_react(p_code text, p_event text, p_emo text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); ev record;
begin
  select * into ev from ea_event_of(pl.club, p_event); if ev.id is null or not (ev.team = any(ea_member_cat_teams(pl))) then raise exception 'DONNEES'; end if;
  return ea_event_react(pl.club, p_event, pl.id, 'player', ea_short(pl.data), p_emo); end $$;
create or replace function member_event_post(p_code text, p_event text, p_body text, p_parent boolean default false) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); c text := pl.club; ev record; r jsonb; nm text;
begin
  select * into ev from ea_event_of(c, p_event); if ev.id is null or not (ev.team = any(ea_member_cat_teams(pl))) then raise exception 'DONNEES'; end if;
  nm := ea_short(pl.data) || case when p_parent then ' (parent)' else '' end;
  r := ea_event_post(c, p_event, pl.id, 'player', nm, p_body, ev.cat);
  begin perform ea_notify(c, ea_team_staff(c, ev.team), 'messages', 'ev:' || p_event, '💬 ' || nm, left(trim(p_body), 200), '#/' || case when ev.col = 'matches' then 'match/' else 'entrainement/' end || p_event);
  exception when others then raise notice 'notif commentaire : %', sqlerrm; end;
  return r; end $$;
create or replace function member_event_del(p_code text, p_id bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code);
begin update event_posts set deleted = true where club = pl.club and id = p_id and person = pl.id and body is not null; return to_jsonb(found); end $$;
grant execute on function member_event(text, text[]), member_event_react(text, text, text), member_event_post(text, text, text, boolean), member_event_del(text, bigint) to anon, authenticated;
-- the coach (his login): his teams' events (a responsable: all), he moderates
create or replace function club_event(k text, p_ids text[]) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c text := ea_need(k);
begin return ea_event_feed(c, p_ids, ea_staff(k)); end $$;
create or replace function club_event_react(k text, p_event text, p_emo text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k); st items;
begin select * into st from items where club = c and col = 'staff' and id = ea_staff(k) and not deleted;
  return ea_event_react(c, p_event, st.id, 'coach', 'Coach ' || ea_short(st.data), p_emo); end $$;
create or replace function club_event_post(k text, p_event text, p_body text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k); st items; ev record;
begin select * into st from items where club = c and col = 'staff' and id = ea_staff(k) and not deleted;
  select * into ev from ea_event_of(c, p_event); if ev.id is null then raise exception 'DONNEES'; end if;
  return ea_event_post(c, p_event, st.id, 'coach', 'Coach ' || ea_short(st.data), p_body, ev.cat); end $$;
create or replace function club_event_del(k text, p_id bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k);
begin update event_posts set deleted = true where club = c and id = p_id; return to_jsonb(found); end $$;
revoke all on function ea_event_feed(text, text[], text), ea_event_of(text, text), ea_event_react(text, text, text, text, text, text), ea_event_post(text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function club_event(text, text[]), club_event_react(text, text, text), club_event_post(text, text, text), club_event_del(text, bigint) from public;
grant execute on function club_event(text, text[]), club_event_react(text, text, text), club_event_post(text, text, text), club_event_del(text, bigint) to anon, authenticated;
-- ménage : plus de 180 jours
create or replace function ea_event_purge() returns void language sql security definer set search_path = public as $$ delete from event_posts where at < now() - interval '180 days' $$;
revoke all on function ea_event_purge() from public, anon, authenticated;
