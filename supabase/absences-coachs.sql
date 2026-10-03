-- (1.32) un joueur ou un parent répond « absent » (match ou séance) : les coachs de la catégorie sont prévenus, avec la raison
create or replace function ea_on_answer() returns trigger language plpgsql security definer set search_path = public as $$
declare m items; pl items; ismatch boolean; dt date; who text; what text;
begin
  begin
    if new.by_coach or new.status <> 'non' then return null; end if;
    if tg_op = 'UPDATE' and old.status = 'non' and coalesce(old.note, '') = coalesce(new.note, '') then return null; end if;
    select * into m from items where club = new.club and col in ('matches', 'trainings') and id = new.match_id and not deleted limit 1;
    if m.id is null or coalesce(m.data->>'teamId', '') = '' then return null; end if;
    select * into pl from items where club = new.club and col = 'players' and id = new.player_id;
    ismatch := m.col = 'matches';
    begin dt := (m.data->>'date')::date; exception when others then dt := null; end;
    who := coalesce(nullif(ea_short(pl.data), ''), 'Un joueur');
    what := case when ismatch then 'match ' || case when coalesce((m.data->>'home')::boolean, false) then 'contre ' else 'chez ' end || coalesce(m.data->>'opponent', '?')
      else 'séance' || coalesce(' « ' || nullif(m.data->>'title', '') || ' »', '') end
      || coalesce(' · ' || ea_day(dt), '');
    perform ea_notify(new.club, ea_team_staff(new.club, m.data->>'teamId'), 'planning', 'abs:' || new.match_id || ':' || new.player_id,
      '✗ Absent · ' || who, what || coalesce(' · ' || nullif(new.note, ''), ''),
      case when ismatch then '#/match/' else '#/entrainement/' end || m.id);
  exception when others then raise notice 'notification absence : %', sqlerrm; end;
  return null;
end $$;
drop trigger if exists ea_answer_notify on answers;
create trigger ea_answer_notify after insert or update on answers for each row execute function ea_on_answer();
revoke all on function ea_on_answer() from public, anon, authenticated;
