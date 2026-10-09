-- (2.75) Codes d'invitation : lien unique et expiration à 60 jours. À coller dans Supabase → SQL Editor (reprend les deux fonctions de codes-invites.sql).
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
    delete from guest_codes where club = c and team_id = p_team and player_id is null and created_at < now() - interval '60 days'; -- (2.75) the expired ones go
    if (select count(*) from guest_codes where club = c and team_id = p_team and player_id is null) + least(p_new, 10) > 50 then raise exception 'LIMITE'; end if;
    who := coalesce((select trim(coalesce(s.data->>'firstName', '') || ' ' || coalesce(s.data->>'lastName', '')) from items s where s.club = c and s.col = 'staff' and s.id = sid and not s.deleted), 'Responsable');
    for i in 1..least(p_new, 10) loop
      loop v := ea_code(8); exit when not exists (select 1 from guest_codes where code = v) and not exists (select 1 from member_codes where code = v); end loop;
      insert into guest_codes (club, team_id, code, created_by) values (c, p_team, v, who);
    end loop;
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('code', g.code, 'at', g.created_at, 'by', g.created_by, 'used', g.used_at, 'player', g.player_id,
      'expired', g.player_id is null and g.created_at < now() - interval '60 days',
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
  if g.created_at < now() - interval '60 days' then raise exception 'CODE_EXPIRE'; end if; -- (2.75) an invitation not used within 60 days is dead
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
