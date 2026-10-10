-- Clubbo 3.15 / Raincy 5.78 : à coller UNE fois dans Supabase (SQL Editor → New query → coller → Run). Sans danger à relancer.
-- 1) Pièces jointes : les vidéos s'effacent après 3 jours (le reste après 90 jours).
-- 2) Notifications des joueurs et des familles plus sobres : jamais deux fois la même en 2 heures, le chat d'un salon une fois
--    toutes les 45 minutes au plus, 3 notifications « ordinaires » par jour au plus, rien d'ordinaire entre 22 h et 7 h.
--    Les convocations, annulations, changements d'horaire et mentions passent toujours.
-- 3) FA Le Raincy : la fiche de Celia SOARES (trésorière et secrétaire) et son compte de responsable, prêt à recevoir son mot de passe.

create or replace function ea_att_begin(c text, p_scope text, p_by text, p_name text, p_mime text, p_size bigint, p_parts int) returns uuid language plpgsql security definer set search_path = public as $$
declare id uuid; lim bigint := case when p_mime like 'video/%' then 52428800 else 20971520 end;
begin
  if coalesce(p_mime, '') !~ '^(application/pdf|video/|image/|audio/|text/plain|text/csv|application/(msword|vnd\.openxmlformats-officedocument\.|vnd\.ms-excel|vnd\.ms-powerpoint|vnd\.oasis\.opendocument\.))' then raise exception 'FICHIER_TYPE'; end if;
  if p_size is null or p_size <= 0 or p_size > lim then raise exception 'FICHIER_POIDS'; end if;
  if p_parts is null or p_parts < 1 or p_parts <> ceil(p_size / 3145728.0)::int then raise exception 'DONNEES'; end if;
  if (select count(*) from att_files where club = c and author = p_by and at > now() - interval '1 day') >= 40
    or (select coalesce(sum(size), 0) from att_files where club = c and author = p_by and at > now() - interval '1 day') + p_size > 419430400 then raise exception 'LIMITE_CHAT'; end if;
  delete from att_files where club = c and (at < now() - interval '90 days' or (mime like 'video/%' and at < now() - interval '3 days') or (not done and at < now() - interval '1 day'));
  insert into att_files (club, scope, name, mime, size, parts, author) values (c, p_scope, left(coalesce(nullif(trim(p_name), ''), 'fichier'), 120), p_mime, p_size, p_parts, p_by) returning att_files.id into id;
  return id;
end $$;
-- une vidéo de plus de 3 jours n'est plus servie, même avant le prochain ménage
create or replace function ea_att_get(c text, p_id uuid, p_n int, p_scopes text[]) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare f att_files;
begin
  select * into f from att_files where club = c and id = p_id and done and not (mime like 'video/%' and at < now() - interval '3 days');
  if f.id is null or (p_scopes is not null and not (f.scope = any(p_scopes))) then raise exception 'FICHIER_ABSENT'; end if;
  return jsonb_build_object('name', f.name, 'mime', f.mime, 'size', f.size, 'parts', f.parts, 'data', (select data from att_parts where att = p_id and n = p_n));
end $$;

-- qui reçoit vraiment cette notification (les autres l'ont déjà, ou en ont eu assez pour aujourd'hui)
create or replace function ea_note_keep(c text, p_players text[], p_title text, p_tag text) returns text[] language sql stable security definer set search_path = public as $$
  with k as (select coalesce(p_title, '') ~ '^(📣 Convocation|❌|🕘|📣 .* t''a tagué)' as urgent,
      extract(hour from now() at time zone 'Europe/Paris') between 7 and 21 as day)
  select coalesce(array_agg(distinct x), '{}') from unnest(coalesce(p_players, '{}')) x, k
  where not exists (select 1 from member_notifs n where n.club = c and n.player_id = x and n.title = left(p_title, 120) and n.created_at > now() - interval '2 hours')
    and not (coalesce(p_tag, '') like 'chat:%' and exists (select 1 from member_notifs n where n.club = c and n.player_id = x and n.tag = p_tag and n.created_at > now() - interval '45 minutes'))
    and (k.urgent or (k.day and (select count(*) from member_notifs n where n.club = c and n.player_id = x and n.created_at > now() - interval '20 hours'
      and coalesce(n.title, '') !~ '^(📣 Convocation|❌|🕘)') < 3)) $$;

create or replace function member_note(c text, p_players text[], p_title text, p_body text) returns void language plpgsql security definer set search_path = public as $$
declare subs jsonb; cfg push_config; ids text[] := ea_note_keep(c, p_players, p_title, null);
begin
  if coalesce(array_length(ids, 1), 0) = 0 then return; end if;
  insert into member_notifs (club, player_id, title, body)
    select distinct c, s.player_id, left(p_title, 120), left(p_body, 240) from member_subs s where s.club = c and s.player_id = any(ids);
  select jsonb_agg(jsonb_build_object('id', x.id, 'endpoint', x.endpoint)) into subs
    from (select distinct on (endpoint) id, endpoint from member_subs where club = c and player_id = any(ids)) x;
  select * into cfg from push_config where id = 1;
  if subs is null or cfg.fn_url is null then return; end if;
  begin perform net.http_post(url := cfg.fn_url, body := jsonb_build_object('subs', subs), headers := jsonb_build_object('Content-Type', 'application/json', 'x-raincy-secret', cfg.secret));
  exception when others then raise notice 'notification des familles : %', sqlerrm; end;
end $$;
create or replace function ea_member_note(c text, p_players text[], p_title text, p_body text, p_tag text, p_url text) returns void language plpgsql security definer set search_path = public as $$
declare subs jsonb; cfg push_config; ids text[] := ea_note_keep(c, p_players, p_title, p_tag);
begin
  if coalesce(array_length(ids, 1), 0) = 0 then return; end if;
  insert into member_notifs (club, player_id, title, body, tag, url)
    select distinct c, s.player_id, left(p_title, 120), left(p_body, 240), p_tag, p_url from member_subs s where s.club = c and s.player_id = any(ids);
  select jsonb_agg(jsonb_build_object('id', x.id, 'endpoint', x.endpoint)) into subs
    from (select distinct on (endpoint) id, endpoint from member_subs where club = c and player_id = any(ids)) x;
  select * into cfg from push_config where id = 1;
  if subs is null or cfg.fn_url is null then return; end if;
  begin perform net.http_post(url := cfg.fn_url, body := jsonb_build_object('subs', subs), headers := jsonb_build_object('Content-Type', 'application/json', 'x-raincy-secret', cfg.secret));
  exception when others then raise notice 'notification des familles : %', sqlerrm; end;
end $$;
revoke all on function ea_note_keep(text, text[], text, text) from public, anon, authenticated;

-- FA Le Raincy : Celia SOARES, trésorière et secrétaire, responsable (sa fiche si elle n'existe pas, et son compte de responsable)
do $$
declare c text := (select id from clubs where slug = 'fa-le-raincy' or id = 'fa-le-raincy' limit 1); sid text;
begin
  if c is null then raise notice 'club fa-le-raincy introuvable'; return; end if;
  select i.id into sid from items i where i.club = c and i.col = 'staff' and not i.deleted and upper(i.data->>'lastName') = 'SOARES' and lower(i.data->>'firstName') in ('celia', 'célia') limit 1;
  if sid is null then
    sid := 'celia-soares';
    insert into items (club, col, id, data, updated_at, deleted, rev)
      values (c, 'staff', sid, jsonb_build_object('firstName', 'Celia', 'lastName', 'SOARES', 'role', 'Trésorière · Secrétaire', 'teamIds', '[]'::jsonb, 'phone', '', 'email', ''),
        (extract(epoch from now()) * 1000)::bigint, false, nextval('items_rev'))
      on conflict (club, col, id) do update set data = excluded.data, deleted = false, updated_at = excluded.updated_at, rev = excluded.rev;
  else
    update items set data = data || jsonb_build_object('role', 'Trésorière · Secrétaire'), updated_at = (extract(epoch from now()) * 1000)::bigint, rev = nextval('items_rev')
      where club = c and col = 'staff' and id = sid;
  end if;
  -- le compte existe déjà comme responsable : à sa première connexion (son lien), elle choisit son mot de passe et garde ce droit
  insert into accounts (club, staff_id, last_key, first_keys, display, admin) values (c, sid, 'SOARES', array['CELIA'], 'Celia SOARES', true)
    on conflict (club, staff_id) do update set admin = true, updated_at = now();
  raise notice 'Celia SOARES : fiche % prête, responsable', sid;
end $$;
notify pgrst, 'reload schema';
