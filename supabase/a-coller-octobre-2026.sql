-- Clubbo 1.73 à 1.75 : tout ce qu'il faut coller UNE fois dans Supabase (SQL Editor → New query → coller → Run).
-- Contient : dispos avant la convocation + saison complète pour les joueurs (dispos-matchs.sql), conseils avec séance / vidéos / PDF (conseils-fichiers.sql).
-- Ne modifie aucune donnée existante (crée seulement la table des fichiers des conseils).
-- (7 oct. 2026) member_view et member_reply prennent les matchs de toute la catégorie (Seniors A et B), comme matchs-categorie.sql : recoller ce fichier ne casse plus les matchs côté joueur.
-- (1.73) la fin de la saison (31 juillet), au moins 30 jours devant : les joueurs voient tous leurs matchs et entraînements à venir
create or replace function ea_tr_group(c text, d jsonb) returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(trim(d->>'group'), ''), (select 'Groupe ' || coalesce(nullif(st.data->>'firstName', ''), st.data->>'lastName') from items st
    where st.club = c and st.col = 'staff' and not st.deleted and st.id = coalesce(d->'staffIds'->>0, d->>'by'))) $$;
create or replace function ea_season_end() returns text language sql stable as $$
  select greatest(to_char(make_date(extract(year from current_date)::int + case when extract(month from current_date) >= 8 then 1 else 0 end, 7, 31), 'YYYY-MM-DD'),
    to_char(current_date + 30, 'YYYY-MM-DD')) $$;
-- (1.77) the teams of his category (Seniors → Seniors A and Seniors B): he can be picked in any of them, so he sees their matches
create or replace function ea_member_cat_teams(pl items) returns text[] language sql stable security definer set search_path = public as $$
  select array(select distinct x from (select unnest(ea_arr(pl.data->'teamIds')) x union
    select t.id from items t where t.club = pl.club and t.col = 'teams' and not t.deleted and coalesce(nullif(t.data->>'category', ''), t.data->>'name') in (
      select coalesce(nullif(m.data->>'category', ''), m.data->>'name') from items m where m.club = pl.club and m.col = 'teams' and not m.deleted and m.id = any(ea_arr(pl.data->'teamIds')))
    union select t.id from items t join items m on m.club = t.club and m.col = 'teams' and not m.deleted and m.id = any(ea_arr(pl.data->'teamIds'))
      where t.club = pl.club and t.col = 'teams' and not t.deleted and t.data->>'name' like (m.data->>'name') || ' %') y) $$;
create or replace function member_view(p_code text, p_preview boolean default false) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); c text := pl.club; tids text[] := ea_member_teams(pl); today text := to_char(current_date, 'YYYY-MM-DD'); first boolean;
  season text := case when extract(month from current_date) >= 8 then to_char(current_date, 'YYYY') else to_char(current_date - interval '1 year', 'YYYY') end || '-08-01';
begin
  if not coalesce(p_preview, false) then
    select first_at is null into first from member_codes where club = c and player_id = pl.id;
    update member_codes set used_at = now(), first_at = coalesce(first_at, now()) where club = c and player_id = pl.id;
    if first then begin
      perform ea_notify(c, array(select distinct x from (select a.staff_id x from accounts a where a.club = c and a.admin
          union select st.id from items st join accounts a on a.club = c and a.staff_id = st.id where st.club = c and st.col = 'staff' and not st.deleted
            and exists (select 1 from unnest(ea_arr(st.data->'teamIds')) y where y = any(tids))) z),
        'codes', 'codes', '✅ Code activé', ea_short(pl.data) || ' a ouvert son espace (joueur / parents)', '#/codes/' || coalesce(tids[1], ''));
    exception when others then raise notice 'notification code : %', sqlerrm; end; end if;
  end if;
  return jsonb_build_object(
    'team', coalesce((select string_agg(t.data->>'name', ' · ' order by t.data->>'name') from items t where t.club = c and t.col = 'teams' and not t.deleted and t.id = any(tids)), ''),
    'me', jsonb_build_object('id', pl.id, 'name', ea_short(pl.data), 'firstName', pl.data->>'firstName', 'number', pl.data->>'number', 'birth', pl.data->>'birth',
      'wb', (select max(w->>'day') from jsonb_array_elements(case when jsonb_typeof(pl.data->'wellness') = 'array' then pl.data->'wellness' else '[]'::jsonb end) w)),
    'club', (select jsonb_build_object('name', data->>'name', 'fieldName', data->>'fieldName', 'crest', data->>'crest', 'sport', data->>'sport') from items where club = c and col = 'club' and id = 'club' and not deleted),
    'volTasks', (select data->'volTasks' from items where club = c and col = 'club' and id = 'club' and not deleted),
    'coaches', (select coalesce(jsonb_agg(jsonb_build_object('name', trim(coalesce(st.data->>'firstName', '') || ' ' || coalesce(st.data->>'lastName', '')), 'role', st.data->>'role', 'phone', st.data->>'phone')
        order by st.data->>'lastName'), '[]'::jsonb) from items st where st.club = c and st.col = 'staff' and not st.deleted and st.data->>'phoneShow' = 'parents' and coalesce(st.data->>'phone', '') <> ''
        and exists (select 1 from unnest(ea_arr(st.data->'teamIds')) x where x = any(tids))),
    'matches', (select coalesce(jsonb_agg(x order by x->>'date', x->>'time'), '[]'::jsonb) from (
      select jsonb_build_object('id', i.id, 'date', i.data->>'date', 'time', i.data->>'time', 'rdv', i.data->>'rdv', 'opponent', i.data->>'opponent',
        'home', coalesce((i.data->>'home')::boolean, false), 'place', i.data->>'place', 'competition', i.data->>'competition',
        'exempt', coalesce((i.data->>'exempt')::boolean, false), 'played', coalesce((i.data->>'played')::boolean, false), 'gf', i.data->'gf', 'ga', i.data->'ga',
        'team', (select t.data->>'name' from items t where t.club = c and t.col = 'teams' and t.id = i.data->>'teamId'),
        'open', not coalesce((i.data->>'played')::boolean, false) and i.data->>'date' >= today,
        'convoked', coalesce(i.data->'convoked', '[]'::jsonb) ? pl.id, 'published', jsonb_array_length(coalesce(i.data->'convoked', '[]'::jsonb)) > 0,
        'answer', (select a.status from answers a where a.club = c and a.match_id = i.id and a.player_id = pl.id),
        'seats', (select a.seats from answers a where a.club = c and a.match_id = i.id and a.player_id = pl.id),
        'talk', case when not coalesce((i.data->>'played')::boolean, false) and i.data->>'date' >= today then jsonb_build_object(
          'objective', i.data#>>'{prep,talk,objective}', 'keys', coalesce(i.data#>'{prep,talk,keys}', '[]'::jsonb), 'final', i.data#>>'{prep,talk,final}',
          'video', i.data#>>'{prep,talk,videoUrl}', 'system', i.data#>>'{prep,plan,system}') else null end,
        'my', case when coalesce((i.data->>'played')::boolean, false) and coalesce(i.data->'convoked', '[]'::jsonb) ? pl.id then jsonb_build_object(
          'min', i.data#>>array['minutes', pl.id], 'g', i.data#>>array['stats', pl.id, 'g'], 'a', i.data#>>array['stats', pl.id, 'a']) else null end,
        'photos', (select coalesce(jsonb_agg(ph.id order by ph.created_at), '[]'::jsonb) from match_photos ph where ph.club = c and ph.match_id = i.id),
        'vol', case when i.data->>'date' >= today and jsonb_typeof(i.data->'vol') = 'object' then (select coalesce(jsonb_object_agg(v.key,
            (select coalesce(jsonb_agg(jsonb_build_object('mine', coalesce(e->>'pid', '') = pl.id, 'name', case when coalesce(e->>'pid', '') = pl.id then e->>'name' else null end)), '[]'::jsonb)
             from jsonb_array_elements(case when jsonb_typeof(v.value) = 'array' then v.value else '[]'::jsonb end) e)), '{}'::jsonb) from jsonb_each(i.data->'vol') v) else '{}'::jsonb end,
        'carpool', (select coalesce(jsonb_agg(jsonb_build_object('seats', coalesce((cp->>'seats')::int, 0), 'from', cp->>'from', 'time', cp->>'time',
            'n', jsonb_array_length(case when jsonb_typeof(cp->'kids') = 'array' then cp->'kids' else '[]'::jsonb end),
            'mine', coalesce(cp->'kids', '[]'::jsonb) ? pl.id, 'driver', case when coalesce(cp->'kids', '[]'::jsonb) ? pl.id then cp->>'driver' else null end)), '[]'::jsonb)
          from jsonb_array_elements(case when jsonb_typeof(i.data->'carpool') = 'array' then i.data->'carpool' else '[]'::jsonb end) cp)) x
      from items i where i.club = c and i.col = 'matches' and not i.deleted and i.data->>'teamId' = any(ea_member_cat_teams(pl))
        and i.data->>'date' between season and ea_season_end()) s),
    'trainings', (select coalesce(jsonb_agg(jsonb_build_object('date', i.data->>'date', 'time', i.data->>'time', 'title', i.data->>'title') order by i.data->>'date', i.data->>'time'), '[]'::jsonb)
      from items i where i.club = c and i.col = 'trainings' and not i.deleted and not coalesce((i.data->>'model')::boolean, false) and i.data->>'teamId' = any(tids)
        and i.data->>'date' between today and ea_season_end()));
end $$;
create or replace function member_reply(p_code text, p_kind text, p_id text, p_status text, p_seats int default 0, p_reason text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); c text := pl.club; m items; r text := nullif(left(trim(coalesce(p_reason, '')), 120), '');
begin
  if p_kind = 'match' then
    select * into m from items where club = c and col = 'matches' and id = p_id and not deleted;
    if m.id is null or not (m.data->>'teamId' = any(ea_member_cat_teams(pl))) then raise exception 'DONNEES'; end if; -- (1.73) avant la convocation aussi : « dispo / pas dispo » ; (1.77) A ou B de sa catégorie
    if coalesce((m.data->>'played')::boolean, false) then raise exception 'MATCH_PASSE'; end if;
  elsif p_kind = 'training' then
    select * into m from items where club = c and col = 'trainings' and id = p_id and not deleted;
    if m.id is null or not (m.data->>'teamId' = any(ea_member_teams(pl))) then raise exception 'DONNEES'; end if;
  else raise exception 'DONNEES'; end if;
  if m.data->>'date' < to_char(current_date, 'YYYY-MM-DD') then raise exception 'MATCH_PASSE'; end if;
  if coalesce(p_status, '') = '' then delete from answers where club = c and match_id = p_id and player_id = pl.id; return to_jsonb(true); end if;
  if p_status not in ('oui', 'non') then raise exception 'DONNEES'; end if;
  insert into answers (club, match_id, player_id, status, seats, note, by_coach)
    values (c, p_id, pl.id, p_status, case when p_kind = 'match' and p_status = 'oui' then greatest(0, least(coalesce(p_seats, 0), 8)) else 0 end, case when p_status = 'non' then r end, false)
    on conflict (club, match_id, player_id) do update set status = excluded.status, seats = excluded.seats, note = excluded.note, by_coach = false, updated_at = now();
  return to_jsonb(true); end $$;
-- ses réponses : les entraînements des 2 semaines à venir (avec sa réponse) et les raisons de ses absences aux matchs
create or replace function member_replies(p_code text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pl items := ea_member(p_code); c text := pl.club; tids text[] := ea_member_teams(pl); d0 text := to_char(current_date, 'YYYY-MM-DD');
  mygrp text := nullif(trim(pl.data->>'trGroup'), '');
begin
  return jsonb_build_object(
    -- (1.68) one line per day : several sessions the same day (one per training group) are answered once ;
    -- the line shows the session of his group when the coaches have chosen it
    'trainings', (with tr as (select i.* from items i where i.club = c and i.col = 'trainings' and not i.deleted and not coalesce((i.data->>'model')::boolean, false)
          and i.data->>'teamId' = any(tids) and i.data->>'date' between d0 and ea_season_end()),
        g as (select tr.data->>'teamId' tm, tr.data->>'date' d, array_agg(tr.id order by tr.data->>'time', tr.id) ids from tr group by 1, 2),
        p as (select g.*, case when array_length(g.ids, 1) = 1 then g.ids[1] else (select t.id from tr t where t.id = any(g.ids) and ea_tr_group(c, t.data) = mygrp limit 1) end mine from g)
      select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'date', p.d, 'time', t.data->>'time',
          'title', case when p.mine is null then 'Entraînement' else t.data->>'title' end,
          'group', case when array_length(p.ids, 1) > 1 then coalesce(case when p.mine is not null then ea_tr_group(c, t.data) end, 'Groupe choisi par le coach') end,
          'answer', ans.status, 'reason', ans.note) order by p.d, t.data->>'time'), '[]'::jsonb)
      from p join tr t on t.id = coalesce(p.mine, p.ids[1])
      left join lateral (select a.status, a.note from answers a where a.club = c and a.player_id = pl.id and a.match_id = any(p.ids) order by a.updated_at desc limit 1) ans on true),
    'reasons', (select coalesce(jsonb_object_agg(a.match_id, a.note), '{}'::jsonb) from answers a where a.club = c and a.player_id = pl.id and a.status = 'non' and a.note is not null and a.updated_at > now() - interval '120 days'));
end $$;
create or replace function member_replies(p_code text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pl items := ea_member(p_code); c text := pl.club; tids text[] := ea_member_teams(pl); d0 text := to_char(current_date, 'YYYY-MM-DD');
  mygrp text := nullif(trim(pl.data->>'trGroup'), '');
begin
  return jsonb_build_object(
    -- (1.68) one line per day : several sessions the same day (one per training group) are answered once ;
    -- the line shows the session of his group when the coaches have chosen it
    'trainings', (with tr as (select i.* from items i where i.club = c and i.col = 'trainings' and not i.deleted and not coalesce((i.data->>'model')::boolean, false)
          and i.data->>'teamId' = any(tids) and i.data->>'date' between d0 and ea_season_end()),
        g as (select tr.data->>'teamId' tm, tr.data->>'date' d, array_agg(tr.id order by tr.data->>'time', tr.id) ids from tr group by 1, 2),
        p as (select g.*, case when array_length(g.ids, 1) = 1 then g.ids[1] else (select t.id from tr t where t.id = any(g.ids) and ea_tr_group(c, t.data) = mygrp limit 1) end mine from g)
      select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'date', p.d, 'time', t.data->>'time',
          'title', case when p.mine is null then 'Entraînement' else t.data->>'title' end,
          'group', case when array_length(p.ids, 1) > 1 then coalesce(case when p.mine is not null then ea_tr_group(c, t.data) end, 'Groupe choisi par le coach') end,
          'answer', ans.status, 'reason', ans.note) order by p.d, t.data->>'time'), '[]'::jsonb)
      from p join tr t on t.id = coalesce(p.mine, p.ids[1])
      left join lateral (select a.status, a.note from answers a where a.club = c and a.player_id = pl.id and a.match_id = any(p.ids) order by a.updated_at desc limit 1) ans on true),
    'reasons', (select coalesce(jsonb_object_agg(a.match_id, a.note), '{}'::jsonb) from answers a where a.club = c and a.player_id = pl.id and a.status = 'non' and a.note is not null and a.updated_at > now() - interval '120 days'));
end $$;
grant execute on function member_view(text, boolean), member_reply(text, text, text, text, int, text), member_replies(text) to anon, authenticated;
revoke all on function ea_tr_group(text, jsonb) from public, anon, authenticated;
notify pgrst, 'reload schema';
create table if not exists tip_files (id uuid primary key default gen_random_uuid(), club text not null references clubs(id) on delete cascade,
  player_id text not null, tip_id text not null, name text, mime text not null, data text not null check (length(data) < 4200000), created_at timestamptz not null default now());
create index if not exists tip_files_player on tip_files (club, player_id);
alter table tip_files enable row level security;
-- (1.74) a coach joins a PDF or an image to a tip for one player (at most 40 files a player, ~3 Mo each)
create or replace function club_tip_file_add(k text, p_player text, p_tip text, p_name text, p_mime text, p_data text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k); r uuid;
begin
  if coalesce(p_mime, '') not in ('application/pdf', 'image/jpeg', 'image/png') or coalesce(p_data, '') not like 'data:' || p_mime || ';base64,%' or length(p_data) >= 4200000 then raise exception 'DONNEES'; end if;
  if not exists (select 1 from items where club = c and col = 'players' and id = p_player and not deleted) then raise exception 'DONNEES'; end if;
  if (select count(*) from tip_files where club = c and player_id = p_player) >= 40 then raise exception 'FICHIERS_MAX'; end if;
  insert into tip_files (club, player_id, tip_id, name, mime, data) values (c, p_player, left(p_tip, 40), left(p_name, 120), p_mime, p_data) returning id into r;
  return to_jsonb(r); end $$;
create or replace function club_tip_file_del(k text, p_id uuid) returns boolean language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k); begin delete from tip_files where club = c and id = p_id; return found; end $$;
-- the player (or his parents) reads a file of HIS tips only
create or replace function member_tip_file(p_code text, p_id uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pl items := ea_member(p_code);
begin return (select jsonb_build_object('name', name, 'mime', mime, 'data', data) from tip_files where club = pl.club and player_id = pl.id and id = p_id); end $$;
-- (1.65 → 1.74) the coach's tips for this player: the exercise, a ready session, video links, files
create or replace function member_tips(p_code text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pl items := ea_member(p_code);
begin
  return (select coalesce(jsonb_agg(jsonb_build_object('id', t->>'id', 'at', t->>'at', 'icon', t->>'icon', 'themeLabel', t->>'themeLabel', 'title', t->>'title', 'text', t->>'text', 'link', t->>'link', 'by', t->>'by',
      'session', t->'session', 'links', t->'links', 'files', t->'files') order by t->>'at' desc), '[]'::jsonb)
    from jsonb_array_elements(case when jsonb_typeof(pl.data->'coachTips') = 'array' then pl.data->'coachTips' else '[]'::jsonb end) t);
end $$;
grant execute on function club_tip_file_add(text, text, text, text, text, text), club_tip_file_del(text, uuid), member_tip_file(text, uuid), member_tips(text) to anon, authenticated;
notify pgrst, 'reload schema';
