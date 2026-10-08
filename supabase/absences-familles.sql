/* (2.50) Les familles préviennent le coach :
   - une absence de plusieurs jours (vacances, examens…) déclarée par le joueur ou ses parents : elle apparaît chez les coachs
     comme une indisponibilité (✈️), avec un message dans l'équipe ; « Finalement je serai là » l'enlève ;
   - « J'ai un souci » : en retard, souci de transport, une douleur, empêché, pour un entraînement ou un match proche (message au coach).
   À coller dans Supabase → SQL Editor. */
create or replace function member_absence(p_code text, p_action text default 'list', p_data jsonb default null, p_parent boolean default false) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); tids text[] := ea_member_teams(pl); d0 date := current_date; f date; t date; e jsonb; who text; lst jsonb; why text; hit jsonb;
begin
  who := trim(coalesce(pl.data->>'firstName', '') || ' ' || coalesce(pl.data->>'lastName', '')) || case when p_parent then ' (parent)' else ' (joueur)' end;
  lst := case when jsonb_typeof(pl.data->'unavail') = 'array' then pl.data->'unavail' else '[]'::jsonb end;
  if p_action = 'add' then
    begin f := (p_data->>'from')::date; t := (p_data->>'to')::date; exception when others then raise exception 'DONNEES'; end;
    if f is null or t is null or t < f or f < d0 - 1 or t > f + 365 then raise exception 'DONNEES'; end if;
    why := left(trim(coalesce(p_data->>'reason', '')), 40); if why = '' then raise exception 'DONNEES'; end if;
    if (select count(*) from jsonb_array_elements(lst) x where x->>'self' = 'true' and (x->>'at')::timestamptz > now() - interval '1 day') >= 5 then raise exception 'LIMITE'; end if;
    -- « to » is the first day back (as for the coaches' unavailabilities)
    e := jsonb_build_object('id', replace(gen_random_uuid()::text, '-', ''), 'kind', case when why ilike 'malade%' then 'ill' else 'away' end, 'from', to_char(f, 'YYYY-MM-DD'), 'to', to_char(t + 1, 'YYYY-MM-DD'),
      'reason', why, 'note', left(trim(coalesce(p_data->>'note', '')), 140), 'by', 'member', 'self', true, 'parent', coalesce(p_parent, false), 'at', now());
    lst := jsonb_build_array(e) || lst;
    update items set data = jsonb_set(data, '{unavail}', lst), updated_at = (extract(epoch from now()) * 1000)::bigint, rev = nextval('items_rev') where club = pl.club and col = 'players' and id = pl.id;
    if coalesce(array_length(tids, 1), 0) > 0 then
      insert into messages (club, channel, author_id, author_name, body) values (pl.club, 'team:' || tids[1], 'member:' || pl.id, who,
        '✈️ Absence déclarée : ' || why || ' · du ' || to_char(f, 'DD/MM') || ' au ' || to_char(t, 'DD/MM') || coalesce(' · « ' || nullif(e->>'note', '') || ' »', ''));
    end if;
  elsif p_action = 'del' then
    select x into hit from jsonb_array_elements(lst) x where x->>'id' = p_data->>'id' and x->>'self' = 'true' and x->>'kind' in ('away', 'ill') limit 1;
    if hit is null then raise exception 'DONNEES'; end if;
    -- not started yet: removed; started: it ends today
    if (hit->>'from')::date > d0 then
      select coalesce(jsonb_agg(x), '[]'::jsonb) into lst from jsonb_array_elements(lst) x where x->>'id' <> hit->>'id';
    else
      select coalesce(jsonb_agg(case when x->>'id' = hit->>'id' then x || jsonb_build_object('to', to_char(d0, 'YYYY-MM-DD'), 'backBy', 'member') else x end), '[]'::jsonb) into lst from jsonb_array_elements(lst) x;
    end if;
    update items set data = jsonb_set(data, '{unavail}', lst), updated_at = (extract(epoch from now()) * 1000)::bigint, rev = nextval('items_rev') where club = pl.club and col = 'players' and id = pl.id;
    if coalesce(array_length(tids, 1), 0) > 0 then
      insert into messages (club, channel, author_id, author_name, body) values (pl.club, 'team:' || tids[1], 'member:' || pl.id, who,
        '✅ Finalement disponible : absence « ' || (hit->>'reason') || ' » du ' || to_char((hit->>'from')::date, 'DD/MM') || ' annulée');
    end if;
  end if;
  -- his absences declared or set by a coach, current and to come
  return (select coalesce(jsonb_agg(jsonb_build_object('id', x->>'id', 'kind', x->>'kind', 'from', x->>'from', 'to', x->>'to', 'reason', x->>'reason', 'note', x->>'note', 'self', x->>'self' = 'true') order by x->>'from'), '[]'::jsonb)
    from jsonb_array_elements(lst) x where x->>'kind' in ('away', 'ill', 'susp') and (coalesce(x->>'to', '') = '' or x->>'to' > to_char(d0, 'YYYY-MM-DD')));
end $$;

-- « J'ai un souci » : a short message to the coaches of his team, for a session or a match coming
create or replace function member_alert(p_code text, p_kind text, p_event text default null, p_note text default null, p_parent boolean default false) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); tids text[] := ea_member_teams(pl); who text; ev items; what text; lbl text;
begin
  lbl := case p_kind when 'late' then '⏰ En retard' when 'ride' then '🚗 Souci de transport' when 'pain' then '🤕 Une douleur' when 'cant' then '🚫 Empêché' else null end;
  if lbl is null then raise exception 'DONNEES'; end if;
  if coalesce(array_length(tids, 1), 0) = 0 then raise exception 'DONNEES'; end if;
  if (select count(*) from messages m where m.club = pl.club and m.author_id = 'member:' || pl.id and m.created_at > now() - interval '1 hour') >= 10 then raise exception 'LIMITE'; end if;
  who := trim(coalesce(pl.data->>'firstName', '') || ' ' || coalesce(pl.data->>'lastName', '')) || case when p_parent then ' (parent)' else ' (joueur)' end;
  select * into ev from items i where i.club = pl.club and i.id = p_event and i.col in ('matches', 'trainings') and not i.deleted and i.data->>'teamId' = any(tids) limit 1;
  if found then
    what := case when ev.col = 'matches' then 'match contre ' || coalesce(ev.data->>'opponent', '?') else coalesce(nullif(ev.data->>'title', ''), 'entraînement') end
      || ' du ' || to_char((ev.data->>'date')::date, 'DD/MM') || coalesce(' à ' || replace(nullif(ev.data->>'time', ''), ':', 'h'), '');
  end if;
  insert into messages (club, channel, author_id, author_name, body) values (pl.club, 'team:' || coalesce(ev.data->>'teamId', tids[1]), 'member:' || pl.id, who,
    lbl || coalesce(' · ' || what, '') || coalesce(' · « ' || nullif(left(trim(coalesce(p_note, '')), 200), '') || ' »', ''));
  return to_jsonb(true);
end $$;
grant execute on function member_absence(text, text, jsonb, boolean), member_alert(text, text, text, text, boolean) to anon, authenticated;
notify pgrst, 'reload schema';
