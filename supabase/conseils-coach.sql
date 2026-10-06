-- Clubbo 1.65 : les conseils perso du coach, visibles par le joueur et ses parents dans leur espace (onglet « Séances »).
-- À coller une fois dans Supabase : SQL Editor → New query → coller → Run. Lecture seule, sans risque pour les données.
-- (1.65) les conseils perso du coach pour ce joueur (exercices pour progresser), lus seulement avec son code
create or replace function member_tips(p_code text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pl items := ea_member(p_code);
begin
  return (select coalesce(jsonb_agg(jsonb_build_object('id', t->>'id', 'at', t->>'at', 'icon', t->>'icon', 'themeLabel', t->>'themeLabel', 'title', t->>'title', 'text', t->>'text', 'link', t->>'link', 'by', t->>'by')
      order by t->>'at' desc), '[]'::jsonb)
    from jsonb_array_elements(case when jsonb_typeof(pl.data->'coachTips') = 'array' then pl.data->'coachTips' else '[]'::jsonb end) t);
end $$;
grant execute on function member_tips(text) to anon, authenticated;
notify pgrst, 'reload schema';
