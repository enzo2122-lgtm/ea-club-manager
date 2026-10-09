-- (2.75) Profil du joueur côté familles : photo de profil, historique taille / poids (courbes).
-- À coller dans Supabase → SQL Editor. Remplace member_profile (profil-videos.sql) : seules les clés envoyées sont modifiées.
create or replace function member_profile(p_code text, p_data jsonb default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); w numeric; h numeric; f text; s text; k text; ph text; up jsonb := '{}'::jsonb; g jsonb; today text := to_char(current_date, 'YYYY-MM-DD');
begin
  if p_data is not null then
    if p_data ? 'weight' then begin w := nullif(p_data->>'weight', '')::numeric; exception when others then w := null; end;
      if w is not null and (w < 15 or w > 200) then raise exception 'DONNEES'; end if; up := up || jsonb_build_object('weight', coalesce(w::text, '')); end if;
    if p_data ? 'height' then begin h := nullif(p_data->>'height', '')::numeric; exception when others then h := null; end;
      if h is not null and (h < 80 or h > 230) then raise exception 'DONNEES'; end if; up := up || jsonb_build_object('height', coalesce(h::text, '')); end if;
    if p_data ? 'foot' then f := nullif(p_data->>'foot', ''); if f is not null and f not in ('Droit', 'Gauche', 'Les deux') then raise exception 'DONNEES'; end if; up := up || jsonb_build_object('foot', coalesce(f, '')); end if;
    if p_data ? 'strengths' then s := nullif(left(trim(coalesce(p_data->>'strengths', '')), 300), ''); up := up || jsonb_build_object('strengths', coalesce(s, '')); end if;
    if p_data ? 'weaknesses' then k := nullif(left(trim(coalesce(p_data->>'weaknesses', '')), 300), ''); up := up || jsonb_build_object('weaknesses', coalesce(k, '')); end if;
    -- la photo de profil : un petit JPEG (320 px, carré) fabriqué par la page ; '' l'enlève
    if p_data ? 'photo' then ph := coalesce(p_data->>'photo', '');
      if ph <> '' and (ph !~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$' or length(ph) > 80000) then raise exception 'PHOTO'; end if;
      up := up || jsonb_build_object('photo', ph); end if;
    -- l'historique taille / poids : un point daté quand une mesure change (40 points au plus), le même que celui du coach
    if (w is not null or h is not null) and (coalesce(w::text, '') <> coalesce(pl.data->>'weight', '') or coalesce(h::text, '') <> coalesce(pl.data->>'height', '')) then
      g := case when jsonb_typeof(pl.data->'growth') = 'array' then pl.data->'growth' else '[]'::jsonb end;
      g := (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements(g) x where x->>'date' <> today);
      g := g || jsonb_build_array(jsonb_build_object('date', today, 'h', coalesce(h, nullif(pl.data->>'height', '')::numeric), 'w', coalesce(w, nullif(pl.data->>'weight', '')::numeric)));
      g := (select coalesce(jsonb_agg(x order by x->>'date'), '[]'::jsonb) from (select x from jsonb_array_elements(g) x order by x->>'date' desc limit 40) t);
      up := up || jsonb_build_object('growth', g); end if;
    if up <> '{}'::jsonb then
      update items set data = data || up || jsonb_build_object('profileAt', now()), updated_at = (extract(epoch from now()) * 1000)::bigint, rev = nextval('items_rev')
        where club = pl.club and col = 'players' and id = pl.id;
      select * into pl from items where club = pl.club and col = 'players' and id = pl.id;
    end if;
  end if;
  return jsonb_build_object('weight', pl.data->>'weight', 'height', pl.data->>'height', 'foot', pl.data->>'foot', 'strengths', pl.data->>'strengths', 'weaknesses', pl.data->>'weaknesses',
    'photo', case when coalesce(pl.data->>'photo', '') like 'data:image/%' then pl.data->>'photo' else null end,
    'growth', case when jsonb_typeof(pl.data->'growth') = 'array' then pl.data->'growth' else '[]'::jsonb end);
end $$;
grant execute on function member_profile(text, jsonb) to anon, authenticated;
