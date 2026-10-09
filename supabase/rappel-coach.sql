-- Clubbo 2.79 (10 octobre 2026) : la veille d'un match, le coach est prévenu si la convocation n'est pas partie ;
-- une famille répond « Présent / Absent » depuis la notification de relance (Android), sans ouvrir l'appli.
-- À coller dans Supabase → SQL (après reglages-notifs.sql). Sans danger à relancer.

create or replace function ea_relance() returns void language plpgsql security definer set search_path = public as $$
declare e items; ids text[]; lbl text; what text; names text; n int; k int; lvl int; ahead int; t text;
begin
  for e in select * from items i where i.col in ('matches', 'trainings') and not i.deleted
      and i.data->>'date' in (to_char(current_date + 1, 'YYYY-MM-DD'), to_char(current_date + 2, 'YYYY-MM-DD'))
      and not coalesce((i.data->>'model')::boolean, false) and not coalesce((i.data->>'exempt')::boolean, false) and not coalesce((i.data->>'played')::boolean, false)
      and coalesce(i.data->>'teamId', '') <> '' loop
    ahead := (e.data->>'date')::date - current_date;
    lbl := coalesce((select data->>'name' from items where club = e.club and col = 'teams' and id = e.data->>'teamId'), '');
    what := case when e.col = 'matches' then 'Match ' || case when coalesce((e.data->>'home')::boolean, false) then 'contre ' else 'chez ' end || coalesce(e.data->>'opponent', '?')
      else 'Entraînement' || coalesce(' · ' || nullif(e.data->>'title', ''), '') end || coalesce(' · ' || replace(nullif(e.data->>'time', ''), ':', 'h'), '');
    -- (2.79) demain il y a match et la convocation n'est pas partie : le coach le sait ce soir
    if ahead = 1 and e.col = 'matches' and coalesce(e.data->>'convSent', '') = '' then
      begin
        perform ea_notify(e.club, ea_team_staff(e.club, e.data->>'teamId'), 'planning', 'conv:' || e.id, '📣 Demain · ' || lbl || ' : convocation pas envoyée',
          what || case when jsonb_typeof(e.data->'convoked') = 'array' and jsonb_array_length(e.data->'convoked') > 0 then ' · les convoqués sont choisis, il reste à envoyer' else ' · personne n''est convoqué' end, '#/match/' || e.id);
      exception when others then raise notice 'rappel convocation % : %', e.id, sqlerrm; end;
    end if;
    lvl := coalesce((ea_notif_cfg(e.club)->>'relance')::int, 1);
    if lvl = 0 or (ahead = 2 and lvl < 2) then continue; end if;
    begin
      insert into relance_log (club, event_id, day) values (e.club, e.id, current_date);
    exception when unique_violation then continue; end;
    begin
      ids := ea_event_people(e);
      ids := array(select x from unnest(ids) x where not exists (select 1 from answers a where a.club = e.club and a.match_id = e.id and a.player_id = x));
      n := coalesce(array_length(ids, 1), 0);
      if n = 0 then continue; end if;
      t := case when ahead = 1 then 'Demain' else 'Après-demain' end;
      perform ea_member_note(e.club, ids, '⏰ ' || t || ' · ' || lbl || ' : tu viens ?', what || ' · touche pour répondre présent ou absent', 'relance:' || e.id, '');
      if ahead = 1 then
        select string_agg(ea_short(p.data), ', ' order by p.data->>'lastName') into names from (select * from items p where p.club = e.club and p.col = 'players' and p.id = any(ids) limit 12) p;
        perform ea_notify(e.club, ea_team_staff(e.club, e.data->>'teamId'), 'planning', 'relance:' || e.id, '⏰ Demain · ' || lbl || ' : ' || n || ' sans réponse',
          what || ' · relancés : ' || names || case when n > 12 then '…' else '' end, case when e.col = 'matches' then '#/match/' else '#/entrainement/' end || e.id);
      end if;
    exception when others then raise notice 'relance % : %', e.id, sqlerrm; end;
  end loop;
  delete from relance_log where day < current_date - 30;
end $$;

-- La réponse depuis la notification : le téléphone est reconnu par son abonnement aux notifications (member_subs), pas besoin du code.
create or replace function member_answer_push(p_endpoint text, p_match text, p_status text) returns jsonb language plpgsql security definer set search_path = public as $$
declare s member_subs; pl items; m items; n int := 0;
begin
  if coalesce(p_endpoint, '') = '' or p_status not in ('oui', 'non') then raise exception 'DONNEES'; end if;
  -- un téléphone de parent peut porter plusieurs enfants : la réponse vaut pour ceux de l'équipe du match
  for s in select * from member_subs where endpoint = p_endpoint loop
    select * into pl from items where club = s.club and col = 'players' and id = s.player_id and not deleted;
    if pl.id is null then continue; end if;
    select * into m from items where club = s.club and col = 'matches' and id = p_match and not deleted;
    if m.id is null or not (m.data->>'teamId' = any(ea_member_teams(pl))) then continue; end if;
    if coalesce((m.data->>'played')::boolean, false) or m.data->>'date' < to_char(current_date, 'YYYY-MM-DD') then raise exception 'MATCH_PASSE'; end if;
    insert into answers (club, match_id, player_id, status, seats, by_coach) values (s.club, p_match, pl.id, p_status, 0, false)
      on conflict (club, match_id, player_id) do update set status = excluded.status, by_coach = false, updated_at = now();
    n := n + 1;
  end loop;
  if n = 0 then raise exception 'DONNEES'; end if;
  return to_jsonb(true); end $$;
revoke all on function member_answer_push(text, text, text) from public;
grant execute on function member_answer_push(text, text, text) to anon, authenticated;
notify pgrst, 'reload schema';
