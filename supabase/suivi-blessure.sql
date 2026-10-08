-- Clubbo 2.25 : suivi après blessure. À coller une fois dans Supabase (SQL Editor → Run).
-- (2.25) après chaque séance ou match où le blessé était présent, il répond « comment ça s'est passé ? » (ok = plus rien → guéri aujourd'hui,
-- watch = à surveiller, hurt = toujours blessé) ; la réponse s'ajoute à la blessure (checks) et les coachs sont prévenus si ça ne va pas / si c'est fini.
create or replace function member_injury(p_code text, p_action text default 'list', p_data jsonb default null, p_parent boolean default false) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); tids text[] := ea_member_teams(pl); d0 date := current_date; n int; e jsonb; who text; lst jsonb; st text; part text;
begin
  who := trim(coalesce(pl.data->>'firstName', '') || ' ' || coalesce(pl.data->>'lastName', '')) || case when p_parent then ' (parent)' else ' (joueur)' end;
  lst := case when jsonb_typeof(pl.data->'unavail') = 'array' then pl.data->'unavail' else '[]'::jsonb end;
  if p_action = 'add' then
    if coalesce(trim(p_data->>'part'), '') = '' then raise exception 'DONNEES'; end if;
    if (select count(*) from jsonb_array_elements(lst) x where x->>'self' = 'true' and (x->>'at')::timestamptz > now() - interval '1 day') >= 5 then raise exception 'LIMITE'; end if;
    begin n := least(greatest(coalesce((p_data->>'days')::int, 0), 0), 365); exception when others then n := 0; end;
    e := jsonb_build_object('id', replace(gen_random_uuid()::text, '-', ''), 'kind', 'injury', 'from', to_char(d0, 'YYYY-MM-DD'), 'to', case when n > 0 then to_char(d0 + n, 'YYYY-MM-DD') else '' end,
      'part', left(trim(p_data->>'part'), 80), 'zone', left(coalesce(p_data->>'zone', ''), 20), 'side', left(coalesce(p_data->>'side', ''), 1), 'type', left(coalesce(p_data->>'type', ''), 40),
      'note', left(trim(coalesce(p_data->>'note', '')), 140), 'reason', '', 'by', 'member', 'self', true, 'parent', coalesce(p_parent, false), 'at', now());
    lst := jsonb_build_array(e) || lst;
    update items set data = jsonb_set(data, '{unavail}', lst), updated_at = (extract(epoch from now()) * 1000)::bigint, rev = nextval('items_rev') where club = pl.club and col = 'players' and id = pl.id;
    if coalesce(array_length(tids, 1), 0) > 0 then
      insert into messages (club, channel, author_id, author_name, body) values (pl.club, 'team:' || tids[1], 'member:' || pl.id, who,
        '🚑 Blessure signalée : ' || (e->>'part') || case e->>'side' when 'g' then ' gauche' when 'd' then ' droit' else '' end || coalesce(' · ' || nullif(e->>'type', ''), '') || case when n > 0 then ' · retour estimé le ' || to_char(d0 + n, 'DD/MM') else ' · durée inconnue' end || coalesce(' · « ' || nullif(e->>'note', '') || ' »', ''));
    end if;
  elsif p_action = 'back' then
    select coalesce(jsonb_agg(case when x->>'id' = p_data->>'id' and x->>'kind' = 'injury' and (coalesce(x->>'to', '') = '' or x->>'to' > to_char(d0, 'YYYY-MM-DD'))
      then x || jsonb_build_object('to', to_char(d0, 'YYYY-MM-DD'), 'backBy', 'member') else x end), '[]'::jsonb) into lst from jsonb_array_elements(lst) x;
    update items set data = jsonb_set(data, '{unavail}', lst), updated_at = (extract(epoch from now()) * 1000)::bigint, rev = nextval('items_rev') where club = pl.club and col = 'players' and id = pl.id;
    if coalesce(array_length(tids, 1), 0) > 0 then
      insert into messages (club, channel, author_id, author_name, body) values (pl.club, 'team:' || tids[1], 'member:' || pl.id, who, '💪 Rétabli : peut rejouer (blessure terminée aujourd''hui)');
    end if;
  elsif p_action = 'check' then
    st := p_data->>'status'; if st not in ('ok', 'watch', 'hurt') then raise exception 'DONNEES'; end if;
    select x->>'part' into part from jsonb_array_elements(lst) x where x->>'id' = p_data->>'id' limit 1;
    if part is null then raise exception 'DONNEES'; end if;
    select coalesce(jsonb_agg(case when x->>'id' = p_data->>'id' then x
        || jsonb_build_object('checks', (case when jsonb_typeof(x->'checks') = 'array' then x->'checks' else '[]'::jsonb end) || jsonb_build_array(jsonb_build_object('ev', left(coalesce(p_data->>'ev', ''), 40), 'status', st, 'date', to_char(d0, 'YYYY-MM-DD'), 'note', left(trim(coalesce(p_data->>'note', '')), 120))))
        || case when st = 'ok' then jsonb_build_object('to', to_char(d0, 'YYYY-MM-DD'), 'backBy', 'member') else '{}'::jsonb end
      else x end), '[]'::jsonb) into lst from jsonb_array_elements(lst) x;
    update items set data = jsonb_set(data, '{unavail}', lst), updated_at = (extract(epoch from now()) * 1000)::bigint, rev = nextval('items_rev') where club = pl.club and col = 'players' and id = pl.id;
    if coalesce(array_length(tids, 1), 0) > 0 and st <> 'watch' then
      insert into messages (club, channel, author_id, author_name, body) values (pl.club, 'team:' || tids[1], 'member:' || pl.id, who,
        case when st = 'ok' then '💪 Plus rien après la séance : rétabli (' || part || ')' else '🩹 Toujours blessé après la séance (' || part || ')' || coalesce(' · « ' || nullif(left(trim(coalesce(p_data->>'note', '')), 120), '') || ' »', '') end);
    end if;
  end if;
  -- ses blessures des 4 derniers mois (et celles en cours), avec ses réponses de suivi
  return (select coalesce(jsonb_agg(jsonb_build_object('id', x->>'id', 'kind', x->>'kind', 'from', x->>'from', 'to', x->>'to', 'part', x->>'part', 'side', x->>'side', 'type', x->>'type', 'checks', coalesce(x->'checks', '[]'::jsonb), 'seen', x->>'seen')), '[]'::jsonb)
    from jsonb_array_elements(lst) x where x->>'kind' = 'injury' and (coalesce(x->>'to', '') = '' or x->>'to' >= to_char(d0 - 120, 'YYYY-MM-DD')));
end $$;
grant execute on function member_injury(text, text, jsonb, boolean) to anon, authenticated;
