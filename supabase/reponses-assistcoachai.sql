-- Clubbo 2.09 : les réponses des joueurs sur AssistCoachAI (présent / absent aux matchs et aux entraînements) arrivent dans l'appli.
-- À coller une fois dans Supabase (SQL Editor → New query → coller → Run). Ne modifie aucune donnée existante.
-- · une réponse plus récente donnée dans l'appli n'est jamais écrasée par une plus ancienne d'AssistCoachAI
-- · un match en double fusionné (AssistCoachAI + FFF) : les réponses du double suivent le match gardé

create or replace function club_import_answers(k text, p_rows jsonb, p_moves jsonb default '[]'::jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := ea_need(k); n int := 0; x jsonb;
begin
  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_rows, '[]'::jsonb)) > 1000
    or jsonb_typeof(coalesce(p_moves, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_moves, '[]'::jsonb)) > 200 then raise exception 'DONNEES'; end if;
  -- the answers of a removed duplicate follow the match kept (the newer answer of each player wins)
  for x in select * from jsonb_array_elements(coalesce(p_moves, '[]'::jsonb)) loop
    continue when coalesce(x->>'from', '') = '' or coalesce(x->>'to', '') = '' or x->>'from' = x->>'to';
    delete from answers a using answers b where a.club = c and b.club = c and a.player_id = b.player_id
      and a.match_id = x->>'to' and b.match_id = x->>'from' and a.updated_at < b.updated_at;
    delete from answers a using answers b where a.club = c and b.club = c and a.player_id = b.player_id
      and a.match_id = x->>'from' and b.match_id = x->>'to';
    update answers set match_id = x->>'to' where club = c and match_id = x->>'from';
  end loop;
  -- the answers: only on a match or a training of the club, for a player of the club
  insert into answers (club, match_id, player_id, status, note, by_coach, updated_at)
    select distinct on (r.m, r.p) c, r.m, r.p, r.s, nullif(left(trim(coalesce(r.note, '')), 120), ''), true,
      case when r.at ~ '^\d{4}-\d{2}-\d{2}' then least(r.at::timestamptz, now()) else now() end
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as r(m text, p text, s text, note text, at text)
    where r.s in ('oui', 'non')
      and exists (select 1 from items i where i.club = c and i.id = r.m and i.col in ('matches', 'trainings') and not i.deleted)
      and exists (select 1 from items i where i.club = c and i.id = r.p and i.col = 'players' and not i.deleted)
    order by r.m, r.p, r.at desc nulls last
  on conflict (club, match_id, player_id) do update set status = excluded.status, note = excluded.note, by_coach = true, updated_at = excluded.updated_at
    where (answers.status, coalesce(answers.note, '')) is distinct from (excluded.status, coalesce(excluded.note, ''))
      and answers.updated_at <= excluded.updated_at;
  get diagnostics n = row_count;
  return jsonb_build_object('saved', n); end $$;

revoke all on function club_import_answers(text, jsonb, jsonb) from public;
grant execute on function club_import_answers(text, jsonb, jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
