/* (2.62) Entretiens individuels partagés : le joueur (ou ses parents) lit ceux que le coach a partagés et peut répondre (une réponse par entretien,
   modifiable) ; le coach est prévenu par un message. À coller dans Supabase → SQL Editor. */
create or replace function member_talks(p_code text, p_action text default 'list', p_data jsonb default null, p_parent boolean default false) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); tids text[] := ea_member_teams(pl); lst jsonb; txt text; who text; hit jsonb;
begin
  lst := case when jsonb_typeof(pl.data->'talks') = 'array' then pl.data->'talks' else '[]'::jsonb end;
  if p_action = 'reply' then
    select x into hit from jsonb_array_elements(lst) x where x->>'id' = p_data->>'id' and (x->>'shared')::boolean limit 1;
    if hit is null then raise exception 'DONNEES'; end if;
    txt := left(trim(coalesce(p_data->>'text', '')), 600); if txt = '' then raise exception 'DONNEES'; end if;
    select coalesce(jsonb_agg(case when x->>'id' = hit->>'id' then x || jsonb_build_object('reply', txt, 'replyAt', now(), 'replyBy', case when p_parent then 'parent' else 'joueur' end) else x end), '[]'::jsonb) into lst from jsonb_array_elements(lst) x;
    update items set data = jsonb_set(data, '{talks}', lst), updated_at = (extract(epoch from now()) * 1000)::bigint, rev = nextval('items_rev') where club = pl.club and col = 'players' and id = pl.id;
    who := trim(coalesce(pl.data->>'firstName', '') || ' ' || coalesce(pl.data->>'lastName', '')) || case when p_parent then ' (parent)' else ' (joueur)' end;
    if coalesce(array_length(tids, 1), 0) > 0 then
      insert into messages (club, channel, author_id, author_name, body) values (pl.club, 'team:' || tids[1], 'member:' || pl.id, who, '🗣️ Réponse à l''entretien du ' || to_char((hit->>'date')::date, 'DD/MM') || ' : « ' || left(txt, 200) || ' »');
    end if;
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', x->>'id', 'date', x->>'date', 'strong', x->>'strong', 'work', x->>'work', 'goals', x->>'goals', 'feel', x->>'feel', 'reply', x->>'reply') order by x->>'date' desc), '[]'::jsonb)
    from jsonb_array_elements(lst) x where (x->>'shared')::boolean);
end $$;
grant execute on function member_talks(text, text, jsonb, boolean) to anon, authenticated;
notify pgrst, 'reload schema';
