/* (2.52) Réglages des notifications envoyées aux familles (Réglages → Notifications, pour le responsable) :
   - nouveau match / nouvelle séance : prévenir s'il a lieu dans les N jours (0 = jamais) ;
   - relance des indécis : aucune, la veille (18 h), ou 2 jours avant et la veille ;
   - changement (date, heure, lieu, rendez-vous) ou annulation : prévenir les joueurs si c'est dans les 48 h, 72 h, toujours (dans le mois) ou jamais.
   Les choix sont dans la fiche du club (notif). À coller dans Supabase → SQL Editor. */
create or replace function ea_notif_cfg(c text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('matchDays', 30, 'trainDays', 7, 'relance', 1, 'changeHours', 72)
    || coalesce((select case when coalesce((data->>'noRelance')::boolean, false) then jsonb_build_object('relance', 0) else '{}'::jsonb end
      || case when jsonb_typeof(data->'notif') = 'object' then data->'notif' else '{}'::jsonb end from items where club = c and col = 'club' and id = 'club' and not deleted), '{}'::jsonb) $$;
-- the players to remind for an event: a match with its convocation sent → the convoked ones; otherwise the players of the team
create or replace function ea_event_people(e items) returns text[] language sql stable security definer set search_path = public as $$
  select case when e.col = 'matches' and (e.data->>'convSent') is not null then member_arr(e.data->'convoked')
    else array(select p.id from items p where p.club = e.club and p.col = 'players' and not p.deleted and coalesce(p.data->'teamIds', '[]'::jsonb) ? (e.data->>'teamId')) end $$;

-- a new match or session: as before, with the windows of the club
create or replace function ea_on_item_new() returns trigger language plpgsql security definer set search_path = public as $$
declare d jsonb := new.data; dt date; team text; lbl text; body text; ids text[]; cfg jsonb; win int;
begin
  if new.col not in ('matches', 'trainings') or new.deleted then return null; end if;
  begin
    if tg_op = 'UPDATE' and not old.deleted then return null; end if;
    if coalesce((d->>'model')::boolean, false) or coalesce((d->>'exempt')::boolean, false) then return null; end if;
    begin dt := (d->>'date')::date; exception when others then return null; end;
    team := d->>'teamId'; cfg := ea_notif_cfg(new.club);
    win := coalesce((cfg->>(case when new.col = 'matches' then 'matchDays' else 'trainDays' end))::int, 0);
    if win <= 0 or dt is null or coalesce(team, '') = '' or dt < current_date or dt > current_date + win then return null; end if;
    lbl := coalesce((select data->>'name' from items where club = new.club and col = 'teams' and id = team), '');
    body := ea_day(dt) || coalesce(' · ' || replace(nullif(d->>'time', ''), ':', 'h'), '');
    if new.col = 'matches' then
      ids := ea_cat_players(new.club, (select ea_team_cat(data) from items where club = new.club and col = 'teams' and id = team));
      perform ea_member_note(new.club, ids, '📅 Nouveau match · ' || lbl,
        (case when coalesce((d->>'home')::boolean, false) then 'contre ' else 'chez ' end) || coalesce(d->>'opponent', '?') || ' · ' || body, 'new-m:' || team, '');
    else
      ids := array(select i.id from items i where i.club = new.club and i.col = 'players' and not i.deleted and coalesce(i.data->'teamIds', '[]'::jsonb) ? team);
      perform ea_member_note(new.club, ids, '🏃 Nouvelle séance · ' || lbl, body || coalesce(' · ' || nullif(d->>'title', ''), ''), 'new-t:' || team, '');
    end if;
  exception when others then raise notice 'notification nouveauté : %', sqlerrm; end;
  return null;
end $$;

-- a change (date, time, place, meeting time) or a cancellation: the players are told only if it is close enough (the club's choice)
create or replace function ea_chg_ok(c text, dt date) returns boolean language sql stable security definer set search_path = public as $$
  select case when h = 0 then false when h < 0 then true else (dt::timestamp at time zone 'Europe/Paris') <= now() + make_interval(hours => h) end
  from (select coalesce((ea_notif_cfg(c)->>'changeHours')::int, 72) h) z $$;
create or replace function ea_on_item_members() returns trigger language plpgsql security definer set search_path = public as $$
declare d jsonb; o jsonb; ismatch boolean := new.col = 'matches'; dt date; team text; lbl text; body text; conv text[]; added text[];
begin
  if new.col not in ('matches', 'trainings') then return null; end if;
  begin
    if tg_op = 'UPDATE' and not old.deleted then o := old.data; end if;
    d := case when new.deleted then o else new.data end;
    if d is null or coalesce((d->>'model')::boolean, false) or coalesce((d->>'exempt')::boolean, false) then return null; end if;
    begin dt := (d->>'date')::date; exception when others then return null; end;
    if dt is null or dt < current_date or dt > current_date + 30 then return null; end if;
    team := d->>'teamId'; if coalesce(team, '') = '' then return null; end if;
    lbl := coalesce((select data->>'name' from items where club = new.club and col = 'teams' and id = team), '');
    body := ea_day(dt) || coalesce(' · ' || replace(nullif(d->>'time', ''), ':', 'h'), '');
    if ismatch then
      body := (case when coalesce((d->>'home')::boolean, false) then 'contre ' else 'chez ' end) || coalesce(d->>'opponent', '?') || ' · ' || body
        || coalesce(' · RDV ' || replace(nullif(d->>'rdv', ''), ':', 'h'), '') || coalesce(' · ' || nullif(d->>'place', ''), '');
      conv := member_arr(d->'convoked');
      if new.deleted then if ea_chg_ok(new.club, dt) then perform member_note(new.club, conv, '❌ Match annulé · ' || lbl, body); end if; return null; end if;
      if (d->>'convSent') is null then return null; end if;
      if o is null or (o->>'convSent') is distinct from (d->>'convSent') then perform member_note(new.club, conv, '📣 Convocation · ' || lbl, body); return null; end if;
      added := array(select x from unnest(conv) x where not (coalesce(o->'convoked', '[]'::jsonb) ? x));
      if coalesce(array_length(added, 1), 0) > 0 then perform member_note(new.club, added, '📣 Convocation · ' || lbl, body); end if;
      if ((d->>'date') is distinct from (o->>'date') or (d->>'time') is distinct from (o->>'time') or (d->>'rdv') is distinct from (o->>'rdv') or (d->>'place') is distinct from (o->>'place'))
          and ea_chg_ok(new.club, least(dt, coalesce((o->>'date')::date, dt))) then
        perform member_note(new.club, array(select x from unnest(conv) x where not (x = any(added))), '🕘 Changement · match ' || lbl, body);
      end if;
    else
      if dt > current_date + 7 then return null; end if;
      body := body || coalesce(' · ' || nullif(d->>'title', ''), '');
      conv := array(select i.id from items i where i.club = new.club and i.col = 'players' and not i.deleted and coalesce(i.data->'teamIds', '[]'::jsonb) ? team);
      if new.deleted then if ea_chg_ok(new.club, dt) then perform member_note(new.club, conv, '❌ Séance annulée · ' || lbl, body); end if;
      elsif o is not null and ((d->>'date') is distinct from (o->>'date') or (d->>'time') is distinct from (o->>'time') or coalesce(d->>'place', '') <> coalesce(o->>'place', ''))
          and ea_chg_ok(new.club, least(dt, coalesce((o->>'date')::date, dt))) then
        perform member_note(new.club, conv, '🕘 Changement · séance ' || lbl, body || case when coalesce(d->>'place', '') <> coalesce(o->>'place', '') and coalesce(d->>'place', '') <> '' then ' · ' || (d->>'place') else '' end); end if;
    end if;
  exception when others then raise notice 'notification des familles : %', sqlerrm; end;
  return null;
end $$;

-- the reminder of the undecided: none (0), the day before (1), 2 days before and the day before (2)
create or replace function ea_relance() returns void language plpgsql security definer set search_path = public as $$
declare e items; ids text[]; lbl text; what text; names text; n int; k int; lvl int; ahead int; t text;
begin
  for e in select * from items i where i.col in ('matches', 'trainings') and not i.deleted
      and i.data->>'date' in (to_char(current_date + 1, 'YYYY-MM-DD'), to_char(current_date + 2, 'YYYY-MM-DD'))
      and not coalesce((i.data->>'model')::boolean, false) and not coalesce((i.data->>'exempt')::boolean, false) and not coalesce((i.data->>'played')::boolean, false)
      and coalesce(i.data->>'teamId', '') <> '' loop
    lvl := coalesce((ea_notif_cfg(e.club)->>'relance')::int, 1);
    ahead := (e.data->>'date')::date - current_date;
    if lvl = 0 or (ahead = 2 and lvl < 2) then continue; end if;
    begin
      insert into relance_log (club, event_id, day) values (e.club, e.id, current_date);
    exception when unique_violation then continue; end;
    begin
      lbl := coalesce((select data->>'name' from items where club = e.club and col = 'teams' and id = e.data->>'teamId'), '');
      ids := ea_event_people(e);
      what := case when e.col = 'matches' then 'Match ' || case when coalesce((e.data->>'home')::boolean, false) then 'contre ' else 'chez ' end || coalesce(e.data->>'opponent', '?')
        else 'Entraînement' || coalesce(' · ' || nullif(e.data->>'title', ''), '') end || coalesce(' · ' || replace(nullif(e.data->>'time', ''), ':', 'h'), '');
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
drop trigger if exists ea_item_change on items;
revoke all on function ea_notif_cfg(text), ea_event_people(items), ea_chg_ok(text, date), ea_on_item_members(), ea_relance() from public, anon, authenticated;
notify pgrst, 'reload schema';
