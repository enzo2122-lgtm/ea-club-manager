-- Clubbo 1.81 : blessures signalées par le joueur, profil du joueur (poids, taille, pied fort, points forts et faibles) et vidéos « highlights » des matchs. À coller une fois dans Supabase (SQL Editor → Run).
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

-- (1.81) le joueur ou ses parents signalent une blessure (zone du corps, type, temps de rétablissement) ou son retour ;
-- elle s'ajoute à sa fiche (Infirmerie du coach) et les coachs de la catégorie reçoivent une notification (message de la catégorie)
create or replace function member_injury(p_code text, p_action text default 'list', p_data jsonb default null, p_parent boolean default false) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); tids text[] := ea_member_teams(pl); d0 date := current_date; n int; e jsonb; who text; lst jsonb;
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
  end if;
  -- ses blessures des 4 derniers mois (et celles en cours)
  return (select coalesce(jsonb_agg(jsonb_build_object('id', x->>'id', 'kind', x->>'kind', 'from', x->>'from', 'to', x->>'to', 'part', x->>'part', 'side', x->>'side', 'type', x->>'type')), '[]'::jsonb)
    from jsonb_array_elements(lst) x where x->>'kind' = 'injury' and (coalesce(x->>'to', '') = '' or x->>'to' >= to_char(d0 - 120, 'YYYY-MM-DD')));
end $$;
grant execute on function member_injury(text, text, jsonb, boolean) to anon, authenticated;
