-- Clubbo 1.98 : notifications partout, comme une messagerie. À coller une fois dans Supabase (SQL Editor → New query → coller → Run),
-- APRÈS chat-categorie.sql. Ne modifie aucune donnée existante.
-- · chat : chaque nouveau message prévient les joueurs (et parents) de la catégorie et leurs coachs (une seule notification par chat sur le téléphone, avec le nombre)
-- · joueurs → coachs : « dispo / présent » en plus de « absent » (déjà là)
-- · coachs → joueurs : nouveau match, nouvelle séance (en plus des convocations, changements, annulations déjà là)
-- · chat : 1 seconde entre deux messages (au lieu de 3), pour que ce soit fluide

-- 1) the notifications of the families get a « tag » (the same chat replaces its notification) and a link (« #chat » opens the chat)
alter table member_notifs add column if not exists tag text;
alter table member_notifs add column if not exists url text;
create or replace function member_news(p_endpoint text) returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if coalesce(p_endpoint, '') = '' then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object('title', n.title, 'body', n.body, 'url', s.page || coalesce(n.url, ''), 'tag', coalesce(n.tag, 'm' || n.id)) order by n.id desc), '[]'::jsonb) into r
    from member_notifs n join member_subs s on s.club = n.club and s.player_id = n.player_id and s.endpoint = p_endpoint
    where not n.delivered and n.created_at > now() - interval '2 days';
  update member_notifs n set delivered = true from member_subs s where s.club = n.club and s.player_id = n.player_id and s.endpoint = p_endpoint and not n.delivered;
  delete from member_notifs where created_at < now() - interval '30 days';
  return r; end $$;
create or replace function ea_member_note(c text, p_players text[], p_title text, p_body text, p_tag text, p_url text) returns void language plpgsql security definer set search_path = public as $$
declare subs jsonb; cfg push_config;
begin
  if coalesce(array_length(p_players, 1), 0) = 0 then return; end if;
  insert into member_notifs (club, player_id, title, body, tag, url)
    select distinct c, s.player_id, left(p_title, 120), left(p_body, 240), p_tag, p_url from member_subs s where s.club = c and s.player_id = any(p_players);
  select jsonb_agg(jsonb_build_object('id', x.id, 'endpoint', x.endpoint)) into subs
    from (select distinct on (endpoint) id, endpoint from member_subs where club = c and player_id = any(p_players)) x;
  select * into cfg from push_config where id = 1;
  if subs is null or cfg.fn_url is null then return; end if;
  begin perform net.http_post(url := cfg.fn_url, body := jsonb_build_object('subs', subs), headers := jsonb_build_object('Content-Type', 'application/json', 'x-raincy-secret', cfg.secret));
  exception when others then raise notice 'notification des familles : %', sqlerrm; end;
end $$;

-- 2) who is in a category: its players, its coaches
create or replace function ea_cat_players(c text, p_cat text) returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct p.id), '{}') from items p where p.club = c and p.col = 'players' and not p.deleted
    and exists (select 1 from items t where t.club = c and t.col = 'teams' and not t.deleted and t.id = any(ea_arr(p.data->'teamIds')) and ea_team_cat(t.data) = p_cat) $$;
create or replace function ea_cat_staff(c text, p_cat text) returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct s.id), '{}') from items s where s.club = c and s.col = 'staff' and not s.deleted
    and exists (select 1 from items t where t.club = c and t.col = 'teams' and not t.deleted and t.id = any(ea_arr(s.data->'teamIds')) and ea_team_cat(t.data) = p_cat) $$;

-- 3) a new message in the chat: everybody of the category but its author
create or replace function ea_on_chat() returns trigger language plpgsql security definer set search_path = public as $$
declare title text := '💬 Chat ' || new.cat; body text := new.name || ' : ' || left(new.body, 160);
begin
  begin
    perform ea_member_note(new.club, array(select x from unnest(ea_cat_players(new.club, new.cat)) x where x <> new.author), title, body, 'chat:' || new.cat, '#chat');
    perform ea_notify(new.club, array(select x from unnest(ea_cat_staff(new.club, new.cat)) x where x <> new.author), 'messages', 'chat:' || new.cat, title, body,
      '#/chat/' || coalesce((select t.id from items t where t.club = new.club and t.col = 'teams' and not t.deleted and ea_team_cat(t.data) = new.cat order by t.data->>'name' limit 1), ''));
  exception when others then raise notice 'notification du chat : %', sqlerrm; end;
  return null;
end $$;
drop trigger if exists ea_chat_notify on chat_msgs;
create trigger ea_chat_notify after insert on chat_msgs for each row execute function ea_on_chat();

-- 4) players → coaches: « dispo » / « présent » too (« absent » is already sent by ea_on_answer); one notification per match, with the number
create or replace function ea_on_answer_yes() returns trigger language plpgsql security definer set search_path = public as $$
declare m items; pl items; ismatch boolean; dt date; who text; what text;
begin
  begin
    if new.by_coach or new.status <> 'oui' then return null; end if;
    if tg_op = 'UPDATE' and old.status = 'oui' then return null; end if;
    select * into m from items where club = new.club and col in ('matches', 'trainings') and id = new.match_id and not deleted limit 1;
    if m.id is null or coalesce(m.data->>'teamId', '') = '' then return null; end if;
    select * into pl from items where club = new.club and col = 'players' and id = new.player_id;
    ismatch := m.col = 'matches';
    begin dt := (m.data->>'date')::date; exception when others then dt := null; end;
    who := coalesce(nullif(ea_short(pl.data), ''), 'Un joueur');
    what := case when ismatch then 'match ' || case when coalesce((m.data->>'home')::boolean, false) then 'contre ' else 'chez ' end || coalesce(m.data->>'opponent', '?')
      else 'séance' || coalesce(' « ' || nullif(m.data->>'title', '') || ' »', '') end || coalesce(' · ' || ea_day(dt), '');
    perform ea_notify(new.club, ea_team_staff(new.club, m.data->>'teamId'), 'planning', 'oui:' || new.match_id,
      '✓ ' || case when coalesce(m.data->'convoked', '[]'::jsonb) ? new.player_id then 'Présent' else 'Dispo' end || ' · ' || who, what,
      case when ismatch then '#/match/' else '#/entrainement/' end || m.id);
  exception when others then raise notice 'notification réponse : %', sqlerrm; end;
  return null;
end $$;
drop trigger if exists ea_answer_yes_notify on answers;
create trigger ea_answer_yes_notify after insert or update on answers for each row execute function ea_on_answer_yes();

-- 5) coaches → players: a new match (the players of the category, A and B) or a new session in the coming week (the team's players)
create or replace function ea_on_item_new() returns trigger language plpgsql security definer set search_path = public as $$
declare d jsonb := new.data; dt date; team text; lbl text; body text; ids text[];
begin
  if new.col not in ('matches', 'trainings') or new.deleted then return null; end if;
  begin
    if tg_op = 'UPDATE' and not old.deleted then return null; end if; -- only a new one (or one brought back)
    if coalesce((d->>'model')::boolean, false) or coalesce((d->>'exempt')::boolean, false) then return null; end if;
    begin dt := (d->>'date')::date; exception when others then return null; end;
    team := d->>'teamId';
    if dt is null or coalesce(team, '') = '' or dt < current_date or dt > current_date + (case when new.col = 'matches' then 30 else 7 end) then return null; end if;
    lbl := coalesce((select data->>'name' from items where club = new.club and col = 'teams' and id = team), '');
    body := ea_day(dt) || coalesce(' · ' || replace(nullif(d->>'time', ''), ':', 'h'), '');
    if new.col = 'matches' then
      ids := ea_cat_players(new.club, (select ea_team_cat(data) from items where club = new.club and col = 'teams' and id = team));
      perform ea_member_note(new.club, ids, '📅 Nouveau match · ' || lbl,
        (case when coalesce((d->>'home')::boolean, false) then 'contre ' else 'chez ' end) || coalesce(d->>'opponent', '?') || ' · ' || body, 'new-m:' || team, '');
    else
      ids := array(select i.id from items i where i.club = new.club and i.col = 'players' and not i.deleted and coalesce(i.data->'teamIds', '[]'::jsonb) ? team);
      perform ea_member_note(new.club, ids, '🏃 Nouvelle séance · ' || lbl, body || coalesce(' · ' || nullif(d->>'title', ''), ''), 'new-t:' || team, '');
    end if;
  exception when others then raise notice 'notification nouveauté : %', sqlerrm; end;
  return null;
end $$;
drop trigger if exists ea_item_new on items;
create trigger ea_item_new after insert or update on items for each row execute function ea_on_item_new();

-- 6) the chat: 1 second between two messages of the same person
create or replace function ea_chat_post(c text, p_cat text, p_me text, p_kind text, p_name text, p_body text) returns jsonb language plpgsql security definer set search_path = public as $$
declare b text := left(trim(regexp_replace(coalesce(p_body, ''), '[\x00-\x09\x0b-\x1f\x7f]', '', 'g')), 500); id bigint;
begin
  if b = '' then raise exception 'DONNEES'; end if;
  if coalesce((select off from chat_state where club = c and cat = p_cat), false) and p_kind = 'player' then raise exception 'CHAT_FERME'; end if;
  if exists (select 1 from chat_msgs where club = c and author = p_me and at > now() - interval '1 second') then raise exception 'TROP_VITE'; end if;
  if (select count(*) from chat_msgs where club = c and author = p_me and at > now() - interval '1 day') >= 200 then raise exception 'LIMITE_CHAT'; end if;
  if not ea_chat_free(p_cat) and ea_chat_bad(c, b) then raise exception 'MOT_INTERDIT'; end if;
  insert into chat_msgs (club, cat, author, kind, name, body) values (c, p_cat, p_me, p_kind, coalesce(nullif(trim(p_name), ''), '?'), b) returning chat_msgs.id into id;
  return to_jsonb(id); end $$;

revoke all on function ea_member_note(text, text[], text, text, text, text), ea_cat_players(text, text), ea_cat_staff(text, text), ea_on_chat(), ea_on_answer_yes(), ea_on_item_new(),
  ea_chat_post(text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function member_news(text) from public;
grant execute on function member_news(text) to anon, authenticated;
notify pgrst, 'reload schema';
