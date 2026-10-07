-- Clubbo 1.81 : profil du joueur (poids, taille, pied fort, points forts et faibles) et vidéos « highlights » des matchs. À coller une fois dans Supabase (SQL Editor → Run).
-- (1.81) le joueur lit et modifie son profil (avec son code perso) ; p_data null : lecture seule
create or replace function member_profile(p_code text, p_data jsonb default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); w numeric; h numeric; f text; s text; k text;
begin
  if p_data is not null then
    begin w := nullif(p_data->>'weight', '')::numeric; exception when others then w := null; end;
    begin h := nullif(p_data->>'height', '')::numeric; exception when others then h := null; end;
    if w is not null and (w < 15 or w > 200) then raise exception 'DONNEES'; end if;
    if h is not null and (h < 80 or h > 230) then raise exception 'DONNEES'; end if;
    f := nullif(p_data->>'foot', ''); if f is not null and f not in ('Droit', 'Gauche', 'Les deux') then raise exception 'DONNEES'; end if;
    s := nullif(left(trim(coalesce(p_data->>'strengths', '')), 300), ''); k := nullif(left(trim(coalesce(p_data->>'weaknesses', '')), 300), '');
    update items set data = data || jsonb_build_object('weight', coalesce(w::text, ''), 'height', coalesce(h::text, ''), 'foot', coalesce(f, ''), 'strengths', coalesce(s, ''), 'weaknesses', coalesce(k, ''), 'profileAt', now()), updated_at = (extract(epoch from now()) * 1000)::bigint, rev = nextval('items_rev')
      where club = pl.club and col = 'players' and id = pl.id;
    select * into pl from items where club = pl.club and col = 'players' and id = pl.id;
  end if;
  return jsonb_build_object('weight', pl.data->>'weight', 'height', pl.data->>'height', 'foot', pl.data->>'foot', 'strengths', pl.data->>'strengths', 'weaknesses', pl.data->>'weaknesses');
end $$;
-- (1.81) les highlights envoyés par les coachs : les matchs de sa catégorie (A, B…) avec leurs vidéos
create or replace function member_videos(p_code text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pl items := ea_member(p_code); c text := pl.club; tids text[] := ea_member_cat_teams(pl);
begin
  return (select coalesce(jsonb_agg(x order by x->>'date' desc), '[]'::jsonb) from (
    select jsonb_build_object('id', m.id, 'date', m.data->>'date', 'opponent', m.data->>'opponent', 'home', m.data->'home', 'gf', m.data->'gf', 'ga', m.data->'ga', 'played', m.data->'played',
      'team', (select t.data->>'name' from items t where t.club = c and t.col = 'teams' and t.id = m.data->>'teamId'), 'sent', m.data->>'hlSent', 'clips', m.data->'highlights') x
    from items m where m.club = c and m.col = 'matches' and not m.deleted and m.data->>'teamId' = any(tids) and m.data->>'hlSent' is not null
      and jsonb_typeof(m.data->'highlights') = 'array' and jsonb_array_length(m.data->'highlights') > 0
    order by m.data->>'date' desc limit 30) q);
end $$;
grant execute on function member_profile(text, jsonb), member_videos(text) to anon, authenticated;
-- (1.81) « Envoyer aux joueurs » : une notification aux joueurs de l'équipe (ceux qui ont activé les notifications)
create or replace function ea_on_highlights() returns trigger language plpgsql security definer set search_path = public as $$
declare d jsonb := new.data; o jsonb; team text; lbl text; ids text[];
begin
  if new.col <> 'matches' or new.deleted or (d->>'hlSent') is null then return null; end if;
  if tg_op = 'UPDATE' then o := old.data; end if;
  if o is not null and (o->>'hlSent') is not distinct from (d->>'hlSent') then return null; end if;
  begin
    team := d->>'teamId'; lbl := coalesce((select data->>'name' from items where club = new.club and col = 'teams' and id = team), '');
    ids := array(select i.id from items i where i.club = new.club and i.col = 'players' and not i.deleted and coalesce(i.data->'teamIds', '[]'::jsonb) ? team);
    perform member_note(new.club, ids, '🎬 Highlights · ' || lbl, (case when coalesce((d->>'home')::boolean, false) then 'contre ' else 'chez ' end) || coalesce(d->>'opponent', '?') || ' : les vidéos du coach sont dans l''appli');
  exception when others then raise notice 'notification des highlights : %', sqlerrm; end;
  return null;
end $$;
drop trigger if exists ea_item_highlights on items;
create trigger ea_item_highlights after insert or update on items for each row execute function ea_on_highlights();
revoke all on function ea_on_highlights() from public, anon, authenticated;
