-- Clubbo 2.14 : les signalements (problèmes, idées, questions) ne passent plus par la messagerie.
-- À coller une fois dans Supabase (SQL Editor → New query → coller → Run). Ne modifie aucune donnée existante.
-- Quand un éducateur envoie un signalement ou une idée, les responsables du club reçoivent une notification
-- qui ouvre « Signalements et idées » (et plus un message privé).
create or replace function ea_on_report() returns trigger language plpgsql security definer set search_path = public as $$
declare admins text[]; t text := coalesce(new.data->>'type', '');
begin
  if new.deleted or coalesce(new.data->>'life', '') <> '' or t not in ('bug', 'idea', 'question') then return null; end if;
  select array_agg(staff_id) into admins from accounts where club = new.club and admin and staff_id is distinct from new.data->>'by';
  begin
    perform ea_notify(new.club, admins, 'reports', 'report:' || new.id,
      case t when 'bug' then '🐞 Problème signalé' when 'idea' then '💡 Nouvelle idée' else '❓ Question' end || ' par ' || coalesce(nullif(new.data->>'byName', ''), 'un éducateur'),
      left(coalesce(new.data->>'text', ''), 200), '#/signalements');
  exception when others then raise notice 'notification signalement : %', sqlerrm; end;
  return null;
end $$;
drop trigger if exists ea_report_note on items;
create trigger ea_report_note after insert on items for each row when (new.col = 'reports') execute function ea_on_report();
revoke all on function ea_on_report() from public, anon, authenticated;
notify pgrst, 'reload schema';
