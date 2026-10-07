-- Clubbo 2.05 : la confidentialité du chat, des photos et des classements. À coller une fois dans Supabase (SQL Editor → New query → coller → Run),
-- APRÈS suite-chat.sql.
-- · durées de conservation appliquées chaque nuit : photos du chat 90 jours, messages du chat 1 an
-- · un joueur (ou un dirigeant) supprimé par le club : ses messages, photos, réactions, votes, signalements et abonnements partent avec lui
-- · un joueur peut choisir de ne pas apparaître dans les classements de sa catégorie (il garde ses badges)

-- 1) durations: every night at 3 h 30 (UTC)
create or replace function ea_chat_purge() returns void language plpgsql security definer set search_path = public as $$
begin
  update chat_msgs m set img = false, body = case when m.body = '' then '📷 Photo effacée (plus de 90 jours)' else m.body end
    where m.img and m.at < now() - interval '90 days';
  delete from chat_files f using chat_msgs m where m.club = f.club and m.id = f.msg_id and not m.img;
  delete from chat_msgs where at < now() - interval '365 days'; -- with them: reactions, votes, reports (on delete cascade)
  update chat_state s set pin = null where s.pin is not null and not exists (select 1 from chat_msgs m where m.club = s.club and m.id = s.pin);
exception when others then raise notice 'nettoyage du chat : %', sqlerrm;
end $$;
do $cron$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'ea-chat-purge';
    perform cron.schedule('ea-chat-purge', '30 3 * * *', 'select public.ea_chat_purge()');
  end if;
exception when others then raise notice 'nettoyage : %', sqlerrm;
end $cron$;

-- 2) a player or a coach deleted by the club: what he wrote or did in the chat goes too
create table if not exists leader_optout (club text not null references clubs(id) on delete cascade, player_id text not null, at timestamptz not null default now(), primary key (club, player_id));
alter table leader_optout enable row level security;
revoke all on leader_optout from public, anon, authenticated;
create or replace function ea_on_person_gone() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.col not in ('players', 'staff') or not new.deleted or (tg_op = 'UPDATE' and old.deleted) then return null; end if;
  begin
    delete from chat_msgs where club = new.club and author = new.id; -- with their photos, reactions, votes, reports
    delete from chat_reacts where club = new.club and who = new.id;
    delete from chat_votes where club = new.club and voter = new.id;
    delete from chat_reports where club = new.club and who = new.id;
    delete from chat_mutes where club = new.club and person = new.id;
    delete from leader_optout where club = new.club and player_id = new.id;
    if new.col = 'players' then delete from member_subs where club = new.club and player_id = new.id; delete from member_notifs where club = new.club and player_id = new.id; end if;
  exception when others then raise notice 'suppression des traces : %', sqlerrm; end;
  return null;
end $$;
drop trigger if exists ea_person_gone on items;
create trigger ea_person_gone after insert or update on items for each row execute function ea_on_person_gone();

-- 3) the rankings: a player who said no is not shown to the others (he still sees his own numbers and badges)
create or replace function member_leader_optout(p_code text, p_on boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := ea_member(p_code);
begin
  if p_on then insert into leader_optout (club, player_id) values (pl.club, pl.id) on conflict do nothing; else delete from leader_optout where club = pl.club and player_id = pl.id; end if;
  return to_jsonb(coalesce(p_on, false)); end $$;
create or replace function member_leaders(p_code text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pl items := ea_member(p_code); c text := pl.club; cats text[] := ea_chat_cats(pl.club, ea_member_teams(pl)); tids text[];
  season text := case when extract(month from current_date) >= 8 then to_char(current_date, 'YYYY') else to_char(current_date - interval '1 year', 'YYYY') end || '-08-01';
  today text := to_char(current_date, 'YYYY-MM-DD');
begin
  select array_agg(t.id) into tids from items t where t.club = c and t.col = 'teams' and not t.deleted and ea_team_cat(t.data) = any(cats);
  return jsonb_build_object('cat', array_to_string(cats, ' · '),
    'hidden', exists (select 1 from unnest(cats) x where x ~* '^u ?[5-9]$'),
    'optout', exists (select 1 from leader_optout where club = c and player_id = pl.id),
    'players', (with ps as (select p.id, ea_short(p.data) name, ea_arr(p.data->'teamIds') tids from items p where p.club = c and p.col = 'players' and not p.deleted
          and ea_arr(p.data->'teamIds') && coalesce(tids, '{}') and (p.id = pl.id or not exists (select 1 from leader_optout o where o.club = c and o.player_id = p.id))),
      ms as (select i.data d from items i where i.club = c and i.col = 'matches' and not i.deleted and coalesce((i.data->>'played')::boolean, false) and i.data->>'date' >= season and i.data->>'teamId' = any(coalesce(tids, '{}'))),
      tr as (select i.data d from items i where i.club = c and i.col = 'trainings' and not i.deleted and not coalesce((i.data->>'model')::boolean, false) and i.data->>'teamId' = any(coalesce(tids, '{}'))
        and i.data->>'date' between season and today and jsonb_array_length(coalesce(i.data->'presents', '[]'::jsonb)) > 0)
      select coalesce(jsonb_agg(jsonb_build_object('id', ps.id, 'name', ps.name, 'me', ps.id = pl.id,
        'g', (select coalesce(sum(nullif(ms.d#>>array['stats', ps.id, 'g'], '')::int), 0) from ms),
        'a', (select coalesce(sum(nullif(ms.d#>>array['stats', ps.id, 'a'], '')::int), 0) from ms),
        'mp', (select count(*) from ms where coalesce(ms.d->'convoked', '[]'::jsonb) ? ps.id and coalesce(nullif(ms.d#>>array['minutes', ps.id], '')::int, 1) > 0),
        'full', (select count(*) from ms where coalesce(nullif(ms.d#>>array['minutes', ps.id], '')::int, 0) >= 60),
        'hat', (select count(*) from ms where coalesce(nullif(ms.d#>>array['stats', ps.id, 'g'], '')::int, 0) >= 3),
        'tr', (select count(*) from tr where (tr.d->'presents') ? ps.id), 'trt', (select count(*) from tr where tr.d->>'teamId' = any(ps.tids))
      )), '[]'::jsonb) from ps));
end $$;

revoke all on function ea_chat_purge(), ea_on_person_gone() from public, anon, authenticated;
grant execute on function member_leader_optout(text, boolean), member_leaders(text) to anon, authenticated;
notify pgrst, 'reload schema';
