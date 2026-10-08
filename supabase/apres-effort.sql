/* (2.51) Après l'effort, le joueur répond lui-même (espace joueur / parents) :
   - après une séance ou un match où il était : l'effort ressenti (RPE 1 à 10) et « tu as aimé ? » (1 à 3) ;
   - après un match où il a joué (3 h après le coup d'envoi, pendant 3 jours) : sa note de 0 à 10, son match et l'équipe en un mot,
     et son vote pour l'étoile du match (un coéquipier convoqué). Une réponse enregistrée ne change plus.
   Le coach voit tout sur la séance / le match ; l'effort du joueur compte dans la charge quand le coach n'a rien noté.
   À coller dans Supabase → SQL Editor. */
create or replace function member_after(p_code text, p_action text default 'list', p_data jsonb default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); tids text[] := ea_member_teams(pl); ev items; v int; f int; nv numeric; star text; d jsonb; ko timestamptz; pid text := pl.id;
begin
  if p_action = 'save' then
    select * into ev from items i where i.club = pl.club and i.id = p_data->>'id' and i.col in ('matches', 'trainings') and not i.deleted and i.data->>'teamId' = any(tids) limit 1;
    if not found then raise exception 'DONNEES'; end if;
    if (ev.data->>'date')::date < current_date - 3 or (ev.data->>'date')::date > current_date then raise exception 'DONNEES'; end if;
    if ev.col = 'trainings' and not (coalesce(ev.data->'presents', '[]'::jsonb) ? pid) then raise exception 'DONNEES'; end if;
    if ev.col = 'matches' and not (coalesce(ev.data->'convoked', '[]'::jsonb) ? pid) then raise exception 'DONNEES'; end if;
    d := ev.data;
    -- effort and pleasure (once)
    begin v := (p_data->>'rpe')::int; exception when others then v := null; end;
    begin f := (p_data->>'fun')::int; exception when others then f := null; end;
    if v between 1 and 10 and d #> array['rpeSelf', pid] is null then d := jsonb_set(d, '{rpeSelf}', coalesce(d->'rpeSelf', '{}'::jsonb) || jsonb_build_object(pid, v)); end if;
    if f between 1 and 3 and d #> array['fun', pid] is null then d := jsonb_set(d, '{fun}', coalesce(d->'fun', '{}'::jsonb) || jsonb_build_object(pid, f)); end if;
    -- his own match (once, from 3 h after the kick-off)
    if ev.col = 'matches' and p_data ? 'self' and d #> array['selfEval', pid] is null then
      ko := ((ev.data->>'date') || ' ' || coalesce(nullif(ev.data->>'time', ''), '12:00'))::timestamp at time zone 'Europe/Paris';
      if now() < ko + interval '3 hours' then raise exception 'TROP_TOT'; end if;
      begin nv := round((p_data #>> '{self,v}')::numeric * 2) / 2; exception when others then nv := null; end;
      if nv is null or nv < 0 or nv > 10 then raise exception 'DONNEES'; end if;
      star := nullif(p_data #>> '{self,star}', '');
      if star is not null and (star = pid or not (coalesce(ev.data->'convoked', '[]'::jsonb) ? star)) then star := null; end if;
      d := jsonb_set(d, '{selfEval}', coalesce(d->'selfEval', '{}'::jsonb) || jsonb_build_object(pid, jsonb_build_object('v', nv::float8,
        'word', left(trim(coalesce(p_data #>> '{self,word}', '')), 40), 'team', left(trim(coalesce(p_data #>> '{self,team}', '')), 40), 'star', star, 'at', now())));
    end if;
    update items set data = d, updated_at = (extract(epoch from now()) * 1000)::bigint, rev = nextval('items_rev') where club = ev.club and col = ev.col and id = ev.id;
  end if;
  -- the sessions and matches of the last 3 days where he was, and what he has answered
  return (select coalesce(jsonb_agg(x order by x->>'date' desc, x->>'time' desc), '[]'::jsonb) from (
    select jsonb_build_object('id', i.id, 'kind', case when i.col = 'matches' then 'match' else 'training' end, 'date', i.data->>'date', 'time', i.data->>'time',
      'title', case when i.col = 'matches' then 'Match ' || case when (i.data->>'home')::boolean then 'contre ' else 'chez ' end || coalesce(i.data->>'opponent', '?') else coalesce(nullif(i.data->>'title', ''), 'Entraînement') end,
      'rpe', i.data #> array['rpeSelf', pid], 'fun', i.data #> array['fun', pid], 'self', i.data #> array['selfEval', pid],
      'open', i.col = 'matches' and now() >= ((i.data->>'date') || ' ' || coalesce(nullif(i.data->>'time', ''), '12:00'))::timestamp at time zone 'Europe/Paris' + interval '3 hours',
      'mates', case when i.col = 'matches' then (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', ea_short(p.data)) order by p.data->>'firstName'), '[]'::jsonb)
        from items p where p.club = i.club and p.col = 'players' and not p.deleted and p.id <> pid and coalesce(i.data->'convoked', '[]'::jsonb) ? p.id) else null end) x
    from items i where i.club = pl.club and i.col in ('matches', 'trainings') and not i.deleted and i.data->>'teamId' = any(tids)
      and (i.data->>'date')::date between current_date - 3 and current_date
      and not coalesce((i.data->>'model')::boolean, false) and not coalesce((i.data->>'exempt')::boolean, false)
      and ((i.col = 'trainings' and coalesce(i.data->'presents', '[]'::jsonb) ? pid) or (i.col = 'matches' and coalesce(i.data->'convoked', '[]'::jsonb) ? pid))
      and ((i.data->>'date') || ' ' || coalesce(nullif(i.data->>'time', ''), '12:00'))::timestamp at time zone 'Europe/Paris' < now()
    limit 6) q);
end $$;
grant execute on function member_after(text, text, jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
