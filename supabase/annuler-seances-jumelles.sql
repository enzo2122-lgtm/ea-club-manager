-- Annule le script « séances jumelles » : remet member_replies et member_session comme avant.
create or replace function member_replies(p_code text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pl items := ea_member(p_code); c text := pl.club; tids text[] := ea_member_teams(pl); d0 text := to_char(current_date, 'YYYY-MM-DD');
begin
  return jsonb_build_object(
    'trainings', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'date', i.data->>'date', 'time', i.data->>'time', 'title', i.data->>'title', 'answer', a.status, 'reason', a.note)
        order by i.data->>'date', i.data->>'time'), '[]'::jsonb)
      from items i left join answers a on a.club = c and a.match_id = i.id and a.player_id = pl.id
      where i.club = c and i.col = 'trainings' and not i.deleted and not coalesce((i.data->>'model')::boolean, false) and i.data->>'teamId' = any(tids)
        and i.data->>'date' between d0 and to_char(current_date + 14, 'YYYY-MM-DD')),
    'reasons', (select coalesce(jsonb_object_agg(a.match_id, a.note), '{}'::jsonb) from answers a where a.club = c and a.player_id = pl.id and a.status = 'non' and a.note is not null and a.updated_at > now() - interval '120 days'));
end $$;
create or replace function member_session(p_code text, p_id text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pl items := ea_member(p_code); c text := pl.club; t items;
begin
  select * into t from items where club = c and col = 'trainings' and id = p_id and not deleted;
  if t.id is null or not (t.data->>'teamId' = any(ea_member_teams(pl))) then raise exception 'DONNEES'; end if;
  if t.data->>'date' < to_char(current_date, 'YYYY-MM-DD') then raise exception 'MATCH_PASSE'; end if;
  if not exists (select 1 from answers a where a.club = c and a.match_id = p_id and a.player_id = pl.id and a.status = 'oui') then raise exception 'PRESENT_D_ABORD'; end if;
  return jsonb_build_object('id', t.id, 'date', t.data->>'date', 'time', t.data->>'time', 'title', t.data->>'title', 'goal', t.data->>'goal',
    'exercises', (select coalesce(jsonb_agg(jsonb_build_object('title', e->>'title', 'duration', e->>'duration', 'org', e->>'org', 'consignes', e->>'consignes', 'materiel', e->>'materiel') order by n), '[]'::jsonb)
      from jsonb_array_elements(case when jsonb_typeof(t.data->'exercises') = 'array' then t.data->'exercises' else '[]'::jsonb end) with ordinality as x(e, n)));
end $$;
drop function if exists ea_tr_twins(text, items);
drop function if exists ea_tr_empty(jsonb);
grant execute on function member_replies(text), member_session(text, text) to anon, authenticated;
notify pgrst, 'reload schema';
