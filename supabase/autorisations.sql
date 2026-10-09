/* (2.66) Autorisations dans l'appli (à la place du papier) : droit à l'image, soins d'urgence, transport, partir seul, données.
   La famille (ou le joueur adulte) répond dans son espace, onglet « Moi » ; chaque réponse garde le nom de qui a répondu et la date.
   Les coachs les voient sur la fiche du joueur et dans « Autorisations » de l'équipe. À coller dans Supabase → SQL Editor. */
create or replace function member_consent(p_code text, p_data jsonb default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); c jsonb := coalesce(pl.data->'consent', '{}'::jsonb); k text; x jsonb;
begin
  if p_data is not null then
    if jsonb_typeof(p_data) <> 'object' then raise exception 'DONNEES'; end if;
    for k, x in select * from jsonb_each(p_data) loop
      if k not in ('photo', 'care', 'transport', 'alone', 'data') or jsonb_typeof(x) <> 'object' or jsonb_typeof(x->'v') <> 'boolean' then raise exception 'DONNEES'; end if;
      if coalesce(trim(x->>'by'), '') = '' then raise exception 'NOM'; end if;
      c := c || jsonb_build_object(k, jsonb_build_object('v', (x->>'v')::boolean, 'at', now(), 'by', left(trim(x->>'by'), 60)));
    end loop;
    update items set data = jsonb_set(data, '{consent}', c), updated_at = (extract(epoch from now()) * 1000)::bigint, rev = nextval('items_rev')
      where club = pl.club and col = 'players' and id = pl.id;
  end if;
  return c;
end $$;
revoke all on function member_consent(text, jsonb) from public;
grant execute on function member_consent(text, jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
