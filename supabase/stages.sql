-- Clubbo 3.21 : les stages vacances dans l'espace des familles (voir les stages, inscrire son enfant semaine par semaine).
-- À coller UNE fois dans Supabase (SQL Editor → New query → coller → Run). Sans danger à relancer.
-- Ne modifie aucune fonction existante : ajoute seulement member_stages et member_stage.
-- Les stages sont rangés avec les réglages du club (club.stages) ; l'inscription d'un enfant sur sa propre fiche (player.stageIds = ['stage:semaine', …]).
-- La validation (paiement reçu) est faite par un responsable dans l'appli (club.stages[].paidIds) : la famille voit « validée ».

-- member_stages : les stages à venir ouverts à la catégorie de l'enfant (sans les enfants extérieurs ni les paiements des autres),
-- ses inscriptions, ses validations, et le nombre d'inscrits par semaine (pour « complet »)
create or replace function member_stages(p_code text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); c text := pl.club; tids text[] := ea_member_teams(pl); today text := to_char(current_date, 'YYYY-MM-DD'); st jsonb;
begin
  select case when jsonb_typeof(data->'stages') = 'array' then data->'stages' else '[]'::jsonb end into st from items where club = c and col = 'club' and id = 'club' and not deleted;
  return jsonb_build_object(
    'stages', coalesce((select jsonb_agg((s - 'guests' - 'paidIds') || jsonb_build_object('validated',
        coalesce((select jsonb_agg(split_part(v, ':', 2)) from jsonb_array_elements_text(case when jsonb_typeof(s->'paidIds') = 'array' then s->'paidIds' else '[]'::jsonb end) v where split_part(v, ':', 1) = pl.id), '[]'::jsonb),
        'counts', coalesce((select jsonb_object_agg(w->>'id', (select count(*) from items p where p.club = c and p.col = 'players' and not p.deleted and jsonb_typeof(p.data->'stageIds') = 'array' and p.data->'stageIds' ? ((s->>'id') || ':' || (w->>'id')))
            + case when jsonb_typeof(s#>array['guests', w->>'id']) = 'array' then jsonb_array_length(s#>array['guests', w->>'id']) else 0 end)
          from jsonb_array_elements(case when jsonb_typeof(s->'weeks') = 'array' then s->'weeks' else '[]'::jsonb end) w), '{}'::jsonb)))
      from jsonb_array_elements(coalesce(st, '[]'::jsonb)) s
      where coalesce(s->>'end', '') >= today
        and (jsonb_typeof(s->'teamIds') <> 'array' or jsonb_array_length(s->'teamIds') = 0 or exists (select 1 from jsonb_array_elements_text(s->'teamIds') t where t = any(tids)))), '[]'::jsonb),
    'mine', case when jsonb_typeof(pl.data->'stageIds') = 'array' then pl.data->'stageIds' else '[]'::jsonb end);
end $$;

-- member_stage : inscrire (ou désinscrire) l'enfant pour une semaine. Refusé si le stage est fermé, la semaine commencée, la catégorie
-- pas concernée ou la semaine complète. Une inscription déjà validée (payée) ne peut être annulée que par le club.
create or replace function member_stage(p_code text, p_stage text, p_week text, p_remove boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code); c text := pl.club; tids text[] := ea_member_teams(pl); s jsonb; w jsonb; k text := coalesce(p_stage, '') || ':' || coalesce(p_week, '');
  lst jsonb; n int; mx int;
begin
  if coalesce(p_stage, '') !~ '^[A-Za-z0-9_-]{1,40}$' or coalesce(p_week, '') !~ '^[A-Za-z0-9_-]{1,40}$' then raise exception 'DONNEES'; end if;
  select x into s from items i, jsonb_array_elements(case when jsonb_typeof(i.data->'stages') = 'array' then i.data->'stages' else '[]'::jsonb end) x
    where i.club = c and i.col = 'club' and i.id = 'club' and not i.deleted and x->>'id' = p_stage;
  if s is null then raise exception 'DONNEES'; end if;
  select x into w from jsonb_array_elements(case when jsonb_typeof(s->'weeks') = 'array' then s->'weeks' else '[]'::jsonb end) x where x->>'id' = p_week;
  if w is null then raise exception 'DONNEES'; end if;
  if not (jsonb_typeof(s->'teamIds') <> 'array' or jsonb_array_length(s->'teamIds') = 0 or exists (select 1 from jsonb_array_elements_text(s->'teamIds') t where t = any(tids))) then raise exception 'DONNEES'; end if;
  lst := case when jsonb_typeof(pl.data->'stageIds') = 'array' then pl.data->'stageIds' else '[]'::jsonb end;
  if coalesce(p_remove, false) then
    if jsonb_typeof(s->'paidIds') = 'array' and s->'paidIds' ? (pl.id || ':' || p_week) then raise exception 'STAGE_VALIDE'; end if;
    lst := (select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements_text(lst) e where e <> k);
  else
    if s->>'open' = 'false' then raise exception 'STAGE_FERME'; end if;
    if w->>'from' <= to_char(current_date, 'YYYY-MM-DD') then raise exception 'STAGE_COMMENCE'; end if;
    if lst ? k then return jsonb_build_object('ok', true); end if;
    mx := coalesce(nullif(regexp_replace(coalesce(s->>'max', ''), '\D', '', 'g'), '')::int, 0);
    if mx > 0 then
      select count(*) into n from items p where p.club = c and p.col = 'players' and not p.deleted and jsonb_typeof(p.data->'stageIds') = 'array' and p.data->'stageIds' ? k;
      n := n + case when jsonb_typeof(s#>array['guests', p_week]) = 'array' then jsonb_array_length(s#>array['guests', p_week]) else 0 end;
      if n >= mx then raise exception 'COMPLET'; end if;
    end if;
    lst := lst || jsonb_build_array(k);
  end if;
  update items set data = jsonb_set(data, '{stageIds}', lst), updated_at = (extract(epoch from now()) * 1000)::bigint, rev = nextval('items_rev')
    where club = c and col = 'players' and id = pl.id;
  -- the responsables are told (a registration to validate once the payment is received)
  if not coalesce(p_remove, false) then
    perform ea_notify(c, array(select a.staff_id from accounts a where a.club = c and a.admin and a.staff_id is not null), 'stage', 'stage:' || k,
      'Stage : nouvelle inscription', coalesce(ea_short(pl.data), 'Un enfant') || ' · ' || coalesce(s->>'title', 'stage') || ' · à valider au paiement', '#/stages/' || p_stage || '/' || p_week);
  end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function member_stages(text) from public;
revoke all on function member_stage(text, text, text, boolean) from public;
grant execute on function member_stages(text) to anon, authenticated;
grant execute on function member_stage(text, text, text, boolean) to anon, authenticated;
notify pgrst, 'reload schema';
