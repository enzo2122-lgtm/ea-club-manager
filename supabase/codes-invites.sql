-- Clubbo 2.67 : codes d'invitation (joueurs sans licence, à l'essai, validés par le coach). À coller une fois dans Supabase (SQL Editor → Run).
-- Sans ce script : les codes d'invitation ne fonctionnent pas (l'appli le dit au coach).
create or replace function ea_member_any(p_code text) returns items language plpgsql stable security definer set search_path = public as $$
declare c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')); pl items;
begin
  if length(c) <> 8 then raise exception 'CODE_PERSO'; end if;
  select i.* into pl from member_codes mc join clubs cl on cl.id = mc.club and cl.status = 'active'
    join items i on i.club = mc.club and i.col = 'players' and i.id = mc.player_id and not i.deleted where mc.code = c;
  if pl.id is null then raise exception 'CODE_PERSO'; end if;
  return pl; end $$;
-- (2.67) un joueur inscrit avec un code d'invitation, pas encore validé par le coach : rien d'autre que la page d'attente (member_view)
create or replace function ea_member(p_code text) returns items language plpgsql stable security definer set search_path = public as $$
declare pl items := ea_member_any(p_code);
begin
  if pl.data->>'guest' = 'pending' then raise exception 'EN_ATTENTE'; end if;
  return pl; end $$;
create or replace function member_view(p_code text, p_preview boolean default false) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member_any(p_code); c text := pl.club; tids text[] := ea_member_teams(pl); today text := to_char(current_date, 'YYYY-MM-DD'); first boolean;
  season text := case when extract(month from current_date) >= 8 then to_char(current_date, 'YYYY') else to_char(current_date - interval '1 year', 'YYYY') end || '-08-01';
begin
  -- (2.67) a player signed up with an invitation code, not yet validated by the coach: the club, the category, his name — nothing else
  if pl.data->>'guest' = 'pending' then
    return jsonb_build_object('guest', 'pending',
      'team', coalesce((select string_agg(t.data->>'name', ' · ' order by t.data->>'name') from items t where t.club = c and t.col = 'teams' and not t.deleted and t.id = any(tids)), ''),
      'me', jsonb_build_object('id', pl.id, 'name', ea_short(pl.data), 'firstName', pl.data->>'firstName', 'birth', pl.data->>'birth'),
      'club', (select jsonb_build_object('name', data->>'name', 'fieldName', data->>'fieldName', 'crest', data->>'crest', 'sport', data->>'sport') from items where club = c and col = 'club' and id = 'club' and not deleted),
      'coaches', (select coalesce(jsonb_agg(jsonb_build_object('name', trim(coalesce(st.data->>'firstName', '') || ' ' || coalesce(st.data->>'lastName', '')), 'role', st.data->>'role', 'phone', st.data->>'phone')
          order by st.data->>'lastName'), '[]'::jsonb) from items st where st.club = c and st.col = 'staff' and not st.deleted and st.data->>'phoneShow' = 'parents' and coalesce(st.data->>'phone', '') <> ''
          and exists (select 1 from unnest(ea_arr(st.data->'teamIds')) x where x = any(tids))),
      'matches', '[]'::jsonb, 'trainings', '[]'::jsonb);
  end if;
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
/* ================= (2.67) codes d'invitation : un joueur sans licence s'inscrit lui-même, le coach valide ================= */
create table if not exists guest_codes (club text not null references clubs(id) on delete cascade, team_id text not null, code text not null unique,
  created_at timestamptz not null default now(), created_by text, used_at timestamptz, player_id text);
alter table guest_codes enable row level security;
-- le coach (ou le responsable) crée jusqu'à 10 codes à la fois pour une catégorie, et voit qui s'en est servi
create or replace function club_guest_codes(k text, admin_k text, p_team text, p_new int default 0) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k); adm boolean := ea_admin(admin_k, c); sid text := ea_staff(k); st items; v text; i int; who text;
begin
  if not exists (select 1 from items t where t.club = c and t.col = 'teams' and t.id = p_team and not t.deleted) then raise exception 'DONNEES'; end if;
  if not adm then
    if sid is null then raise exception 'ADMIN'; end if;
    select * into st from items where club = c and col = 'staff' and id = sid and not deleted;
    if not (p_team = any(ea_arr(st.data->'teamIds'))) then raise exception 'ADMIN'; end if;
  end if;
  if coalesce(p_new, 0) > 0 then
    if (select count(*) from guest_codes where club = c and team_id = p_team and player_id is null) + least(p_new, 10) > 50 then raise exception 'LIMITE'; end if;
    who := coalesce((select trim(coalesce(s.data->>'firstName', '') || ' ' || coalesce(s.data->>'lastName', '')) from items s where s.club = c and s.col = 'staff' and s.id = sid and not s.deleted), 'Responsable');
    for i in 1..least(p_new, 10) loop
      loop v := ea_code(8); exit when not exists (select 1 from guest_codes where code = v) and not exists (select 1 from member_codes where code = v); end loop;
      insert into guest_codes (club, team_id, code, created_by) values (c, p_team, v, who);
    end loop;
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('code', g.code, 'at', g.created_at, 'by', g.created_by, 'used', g.used_at, 'player', g.player_id,
      'name', (select ea_short(i.data) from items i where i.club = c and i.col = 'players' and i.id = g.player_id and not i.deleted),
      'status', case when g.player_id is null then null else coalesce((select case when i.data->>'guest' = 'pending' then 'pending' else 'ok' end from items i where i.club = c and i.col = 'players' and i.id = g.player_id and not i.deleted), 'gone') end)
      order by g.used_at nulls first, g.created_at), '[]'::jsonb) from guest_codes g where g.club = c and g.team_id = p_team);
end $$;
-- le joueur (ou un parent) tape le code d'invitation : d'abord le club et la catégorie (p_data null), puis son inscription (prénom, nom, naissance…)
-- La fiche est créée « à l'essai », en attente de validation ; le code devient son code personnel ; les coachs de la catégorie sont prévenus.
create or replace function member_guest(p_code text, p_data jsonb default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')); g guest_codes; t items; pid text; fn text; ln text; b text; ph text; em text; parent boolean;
begin
  if length(c) <> 8 then raise exception 'CODE_PERSO'; end if;
  select g1.* into g from guest_codes g1 join clubs cl on cl.id = g1.club and cl.status = 'active' where g1.code = c;
  if g.code is null or g.player_id is not null then raise exception 'CODE_PERSO'; end if;
  select * into t from items where club = g.club and col = 'teams' and id = g.team_id and not deleted;
  if t.id is null then raise exception 'CODE_PERSO'; end if;
  if p_data is null then
    return jsonb_build_object('guest', true, 'team', t.data->>'name', 'club', (select data->>'name' from items where club = g.club and col = 'club' and id = 'club' and not deleted));
  end if;
  fn := left(trim(coalesce(p_data->>'firstName', '')), 40); ln := upper(left(trim(coalesce(p_data->>'lastName', '')), 40)); b := nullif(trim(coalesce(p_data->>'birth', '')), '');
  if fn = '' or ln = '' or b is null or b !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'DONNEES'; end if;
  ph := left(trim(coalesce(p_data->>'phone', '')), 30); em := left(trim(coalesce(p_data->>'email', '')), 80); parent := coalesce((p_data->>'parent')::boolean, false);
  pid := 'g' || replace(gen_random_uuid()::text, '-', '');
  insert into items (club, col, id, data, updated_at, deleted, rev) values (g.club, 'players', pid,
    jsonb_build_object('firstName', fn, 'lastName', ln, 'birth', b, 'phone', ph, 'email', em, 'teamIds', jsonb_build_array(g.team_id),
      'trial', jsonb_build_object('since', to_char(current_date, 'YYYY-MM-DD')), 'guest', 'pending', 'guestAt', to_char(now(), 'YYYY-MM-DD'), 'guestBy', case when parent then 'parent' else 'joueur' end),
    (extract(epoch from now()) * 1000)::bigint, false, nextval('items_rev'));
  update guest_codes set used_at = now(), player_id = pid where code = c;
  insert into member_codes (club, player_id, code, given_at, given_by) values (g.club, pid, c, now(), 'invitation');
  begin
    perform ea_notify(g.club, array(select distinct x from (select a.staff_id x from accounts a where a.club = g.club and a.admin
        union select st.id from items st join accounts a on a.club = g.club and a.staff_id = st.id where st.club = g.club and st.col = 'staff' and not st.deleted and g.team_id = any(ea_arr(st.data->'teamIds'))) z),
      'codes', 'guest:' || pid, '🆕 Inscription à valider', fn || ' ' || ln || ' (' || coalesce(t.data->>'name', '') || ') s''est inscrit avec un code d''invitation', '#/joueur/' || pid);
  exception when others then raise notice 'notification invitation : %', sqlerrm; end;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function club_guest_codes(text, text, text, int) from public; revoke all on function member_guest(text, jsonb) from public;
grant execute on function club_guest_codes(text, text, text, int), member_guest(text, jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
