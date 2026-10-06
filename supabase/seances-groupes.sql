-- Clubbo 1.68 : groupes d'entraînement. Plusieurs séances le même jour (une par groupe : Groupe Gianni, Groupe Enzo…) :
-- le joueur répond une fois pour la journée, les coachs choisissent son groupe, il voit ensuite la séance de son groupe.
-- À coller une fois dans Supabase : SQL Editor → New query → coller → Run. Ne modifie aucune donnée.
-- (1.66) le groupe d'entraînement d'une séance (« Groupe Gianni ») : écrit par le coach, sinon le prénom de son premier encadrant (ou de qui l'a créée)
create or replace function ea_tr_group(c text, d jsonb) returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(trim(d->>'group'), ''), (select 'Groupe ' || coalesce(nullif(st.data->>'firstName', ''), st.data->>'lastName') from items st
    where st.club = c and st.col = 'staff' and not st.deleted and st.id = coalesce(d->'staffIds'->>0, d->>'by'))) $$;
create or replace function member_replies(p_code text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pl items := ea_member(p_code); c text := pl.club; tids text[] := ea_member_teams(pl); d0 text := to_char(current_date, 'YYYY-MM-DD');
  mygrp text := nullif(trim(pl.data->>'trGroup'), '');
begin
  return jsonb_build_object(
    -- (1.68) one line per day : several sessions the same day (one per training group) are answered once ;
    -- the line shows the session of his group when the coaches have chosen it
    'trainings', (with tr as (select i.* from items i where i.club = c and i.col = 'trainings' and not i.deleted and not coalesce((i.data->>'model')::boolean, false)
          and i.data->>'teamId' = any(tids) and i.data->>'date' between d0 and to_char(current_date + 14, 'YYYY-MM-DD')),
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
create or replace function member_session(p_code text, p_id text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pl items := ea_member(p_code); c text := pl.club; t items; f items; ids text[];
begin
  select * into t from items where club = c and col = 'trainings' and id = p_id and not deleted;
  if t.id is null or not (t.data->>'teamId' = any(ea_member_teams(pl))) then raise exception 'DONNEES'; end if;
  if t.data->>'date' < to_char(current_date, 'YYYY-MM-DD') then raise exception 'MATCH_PASSE'; end if;
  -- (1.68) the sessions of that day for his team (one per training group): présent once for the day
  ids := array(select j.id from items j where j.club = c and j.col = 'trainings' and not j.deleted and not coalesce((j.data->>'model')::boolean, false)
    and j.data->>'teamId' = t.data->>'teamId' and j.data->>'date' = t.data->>'date');
  if not exists (select 1 from answers a where a.club = c and a.player_id = pl.id and a.status = 'oui' and a.match_id = any(ids || p_id)) then raise exception 'PRESENT_D_ABORD'; end if;
  if array_length(ids, 1) > 1 then
    select * into f from items j where j.club = c and j.col = 'trainings' and j.id = any(ids) and ea_tr_group(c, j.data) = nullif(trim(pl.data->>'trGroup'), '') limit 1;
    if f.id is null then
      return jsonb_build_object('id', t.id, 'date', t.data->>'date', 'time', t.data->>'time', 'title', 'Entraînement', 'group', 'Groupe choisi par le coach',
        'goal', 'Le coach va choisir ton groupe d''entraînement : ta séance s''affichera ici.', 'exercises', '[]'::jsonb);
    end if;
    t := f;
  end if;
  return jsonb_build_object('id', t.id, 'date', t.data->>'date', 'time', t.data->>'time', 'title', t.data->>'title', 'group', case when array_length(ids, 1) > 1 then ea_tr_group(c, t.data) end, 'goal', t.data->>'goal',
    'exercises', (select coalesce(jsonb_agg(jsonb_build_object('title', e->>'title', 'duration', e->>'duration', 'org', e->>'org', 'consignes', e->>'consignes', 'materiel', e->>'materiel') order by n), '[]'::jsonb)
      from jsonb_array_elements(case when jsonb_typeof(t.data->'exercises') = 'array' then t.data->'exercises' else '[]'::jsonb end) with ordinality as x(e, n)));
end $$;
revoke all on function ea_tr_group(text, jsonb) from public, anon, authenticated;
grant execute on function member_replies(text), member_session(text, text) to anon, authenticated;
notify pgrst, 'reload schema';
