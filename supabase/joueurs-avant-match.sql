-- (3.56) Espace joueur : avant le match, le sac, la caisse de l'équipe, l'échauffement (mené par le capitaine) et les tableaux « Avant-match ».
-- À coller dans Supabase → SQL Editor → Run. Remplace member_view (codes-invites.sql) en gardant tout le reste à l'identique.
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
          'video', i.data#>>'{prep,talk,videoUrl}', 'system', i.data#>>'{prep,plan,system}',
          -- (3.56) before the match: the bag and the team's fines (chosen for the convocation), the warm-up (Jour J) and its captain,
          -- the boards the coach kept « Avant-match ». Never the lineup: the coach gives it in the locker room.
          'bring', (select t.data->'convBring' from items t where t.club = c and t.col = 'teams' and t.id = i.data->>'teamId' and not t.deleted),
          'fines', (select t.data->'convFines' from items t where t.club = c and t.col = 'teams' and t.id = i.data->>'teamId' and not t.deleted),
          'warm', jsonb_build_object('min', i.data#>>'{prep,day,warmMin}', 'sel', i.data#>'{prep,day,warm}', 'notes', i.data#>>'{prep,day,warmNotes}'),
          'captain', (select ea_short(cp.data) from items cp where cp.club = c and cp.col = 'players' and not cp.deleted
            and cp.id = coalesce(nullif(i.data#>>'{prep,plan,captain}', ''), i.data->>'captain')),
          'boards', (select coalesce(jsonb_agg(b->'data'), '[]'::jsonb) from jsonb_array_elements(case when jsonb_typeof(i.data->'boards') = 'array' then i.data->'boards' else '[]'::jsonb end) b
            where b->>'label' like 'Avant-match%')) else null end,
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
