-- Clubbo 1.65 (serveur) : deux séances le même jour (une vide, une remplie) : le joueur voit la séance remplie, sa réponse « Présent » compte.
-- À coller une fois dans Supabase : SQL Editor → New query → coller → Run. Ne modifie aucune donnée.
-- (serveur, 1.65) deux séances le même jour pour la même équipe, l'une vide (planning, import…) et l'autre remplie par le coach :
-- le joueur ne voit que la séance remplie, sa réponse à la séance vide compte pour elle.
create or replace function ea_tr_empty(d jsonb) returns boolean language sql immutable as $$
  select coalesce(jsonb_typeof(d->'exercises') <> 'array' or jsonb_array_length(d->'exercises') = 0, true) $$;
create or replace function ea_tr_twins(c text, t items) returns text[] language sql stable security definer set search_path = public as $$
  select array_agg(j.id) from items j where j.club = c and j.col = 'trainings' and not j.deleted and j.id <> t.id
    and not coalesce((j.data->>'model')::boolean, false) and j.data->>'teamId' = t.data->>'teamId' and j.data->>'date' = t.data->>'date' $$;
create or replace function member_replies(p_code text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pl items := ea_member(p_code); c text := pl.club; tids text[] := ea_member_teams(pl); d0 text := to_char(current_date, 'YYYY-MM-DD');
begin
  return jsonb_build_object(
    'trainings', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'date', x.data->>'date', 'time', x.data->>'time', 'title', x.data->>'title', 'answer', x.st, 'reason', x.note)
        order by x.data->>'date', x.data->>'time'), '[]'::jsonb)
      from (select i.id, i.data,
          coalesce(a.status, (select a2.status from answers a2 where a2.club = c and a2.player_id = pl.id and a2.match_id = any(ea_tr_twins(c, i)) order by a2.updated_at desc limit 1)) st,
          coalesce(a.note, (select a2.note from answers a2 where a2.club = c and a2.player_id = pl.id and a2.match_id = any(ea_tr_twins(c, i)) order by a2.updated_at desc limit 1)) note
        from items i left join answers a on a.club = c and a.match_id = i.id and a.player_id = pl.id
        where i.club = c and i.col = 'trainings' and not i.deleted and not coalesce((i.data->>'model')::boolean, false) and i.data->>'teamId' = any(tids)
          and i.data->>'date' between d0 and to_char(current_date + 14, 'YYYY-MM-DD')
          -- une séance vide n'est pas montrée quand une autre séance du même jour (même équipe) a des exercices
          and not (ea_tr_empty(i.data) and exists (select 1 from items j where j.club = c and j.id = any(ea_tr_twins(c, i)) and j.col = 'trainings' and not ea_tr_empty(j.data)))) x),
    'reasons', (select coalesce(jsonb_object_agg(a.match_id, a.note), '{}'::jsonb) from answers a where a.club = c and a.player_id = pl.id and a.status = 'non' and a.note is not null and a.updated_at > now() - interval '120 days'));
end $$;
create or replace function member_session(p_code text, p_id text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pl items := ea_member(p_code); c text := pl.club; t items; f items;
begin
  select * into t from items where club = c and col = 'trainings' and id = p_id and not deleted;
  if t.id is null or not (t.data->>'teamId' = any(ea_member_teams(pl))) then raise exception 'DONNEES'; end if;
  if t.data->>'date' < to_char(current_date, 'YYYY-MM-DD') then raise exception 'MATCH_PASSE'; end if;
  -- présent à cette séance ou à sa jumelle du même jour
  if not exists (select 1 from answers a where a.club = c and a.player_id = pl.id and a.status = 'oui' and (a.match_id = p_id or a.match_id = any(coalesce(ea_tr_twins(c, t), '{}'::text[])))) then raise exception 'PRESENT_D_ABORD'; end if;
  -- séance vide : le contenu de la séance remplie du même jour
  if ea_tr_empty(t.data) then
    select * into f from items j where j.club = c and j.col = 'trainings' and j.id = any(coalesce(ea_tr_twins(c, t), '{}'::text[])) and not ea_tr_empty(j.data) order by j.updated_at desc limit 1;
    if f.id is not null then t := f; end if;
  end if;
  return jsonb_build_object('id', t.id, 'date', t.data->>'date', 'time', t.data->>'time', 'title', t.data->>'title', 'goal', t.data->>'goal',
    'exercises', (select coalesce(jsonb_agg(jsonb_build_object('title', e->>'title', 'duration', e->>'duration', 'org', e->>'org', 'consignes', e->>'consignes', 'materiel', e->>'materiel') order by n), '[]'::jsonb)
      from jsonb_array_elements(case when jsonb_typeof(t.data->'exercises') = 'array' then t.data->'exercises' else '[]'::jsonb end) with ordinality as x(e, n)));
end $$;
revoke all on function ea_tr_twins(text, items) from public, anon, authenticated;
grant execute on function member_replies(text), member_session(text, text) to anon, authenticated;
notify pgrst, 'reload schema';
