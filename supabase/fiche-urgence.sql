/* (2.42) Fiche urgence : la famille (ou le joueur adulte) la remplit dans son espace, onglet « Moi » ; seuls les coachs la voient.
   À coller dans Supabase → SQL Editor. */
create or replace function member_urgent(p_code text, p_data jsonb default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); u jsonb := '{}'::jsonb; k text; v text; cs jsonb := '[]'::jsonb; c jsonb;
begin
  if p_data is not null then
    if jsonb_typeof(p_data) <> 'object' then raise exception 'DONNEES'; end if;
    foreach k in array array['allergies', 'treat', 'pai', 'know', 'devices'] loop
      v := nullif(left(trim(coalesce(p_data->>k, '')), 400), '');
      if v is not null then u := u || jsonb_build_object(k, v); end if;
    end loop;
    if jsonb_typeof(p_data->'contacts') = 'array' then
      for c in select x from jsonb_array_elements(p_data->'contacts') x
          where jsonb_typeof(x) = 'object' and (coalesce(trim(x->>'name'), '') <> '' or coalesce(trim(x->>'phone'), '') <> '') limit 3 loop
        cs := cs || jsonb_build_array(jsonb_build_object('name', left(trim(coalesce(c->>'name', '')), 60), 'rel', left(trim(coalesce(c->>'rel', '')), 30), 'phone', left(trim(coalesce(c->>'phone', '')), 25)));
      end loop;
    end if;
    if jsonb_array_length(cs) > 0 then u := u || jsonb_build_object('contacts', cs); end if;
    if u = '{}'::jsonb then
      update items set data = data - 'urgent', updated_at = (extract(epoch from now()) * 1000)::bigint, rev = nextval('items_rev') where club = pl.club and col = 'players' and id = pl.id;
    else
      u := u || jsonb_build_object('at', now(), 'by', 'famille');
      update items set data = jsonb_set(data, '{urgent}', u), updated_at = (extract(epoch from now()) * 1000)::bigint, rev = nextval('items_rev') where club = pl.club and col = 'players' and id = pl.id;
    end if;
    return u;
  end if;
  return coalesce(pl.data->'urgent', '{}'::jsonb);
end $$;
revoke all on function member_urgent(text, jsonb) from public;
grant execute on function member_urgent(text, jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
